# Stage 25.4 Tenant Limit Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce tenant user, active property engagement, and document storage limits at backend mutation boundaries.

**Architecture:** Add backend tenant-limit enforcement helpers and call them from race-sensitive mutation paths. Keep controllers thin, return stable `409 Conflict` quota errors, and preserve Stage 25.3 semantics where `null` is unlimited and `0` blocks new usage.

**Tech Stack:** NestJS, Prisma/Postgres, Vitest/Supertest, pnpm.

---

## Slice contract

```txt
Stage: 25
Slice: 25.4 — Tenant limits enforcement
Objective: enforce configured pilot limits for users/team, active property engagements, and documents/storage at mutation boundaries.
Evidence needed: API tests for allowed/blocked mutations, admin limit configuration checks, safe default behavior, and no regression to existing tenant workflows.
Do not touch: billing, paid plans, Stripe, or external billing providers.
Done: tenant limits are enforced consistently with clear errors and existing allowed flows still pass.
Next slice: 26.0 — MVP evidence audit.
```

## Task 1: Shared API quota primitives

**Files:**

- Create: `viewpro-app/apps/api/src/tenant-limits/tenant-limit-enforcement.constants.ts`
- Create: `viewpro-app/apps/api/src/tenant-limits/tenant-limit-enforcement.repository.ts`
- Create: `viewpro-app/apps/api/src/tenant-limits/prisma-tenant-limit-enforcement.repository.ts`
- Create: `viewpro-app/apps/api/src/tenant-limits/tenant-limit-enforcement.service.ts`
- Create: `viewpro-app/apps/api/src/tenant-limits/tenant-limits.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts` only if feature modules need a shared import from root.

**Steps:**

1. Define stable messages:

   ```ts
   export const TENANT_USER_LIMIT_EXCEEDED_MESSAGE = 'Tenant user limit exceeded';
   export const TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED_MESSAGE =
     'Tenant active property engagement limit exceeded';
   export const TENANT_DOCUMENT_STORAGE_LIMIT_EXCEEDED_MESSAGE =
     'Tenant document storage limit exceeded';
   export const BYTES_PER_MIB = 1024 * 1024;
   ```

2. Define repository contract for usage reads:

   ```ts
   export type TenantLimitSnapshot = {
     maxUsers: number | null;
     maxActivePropertyEngagements: number | null;
     maxDocumentsStorageMb: number | null;
   };

   export abstract class TenantLimitEnforcementRepository {
     abstract getLimits(tenantId: string): Promise<TenantLimitSnapshot | null>;
     abstract countActiveUsers(tenantId: string): Promise<number>;
     abstract countActivePropertyEngagements(tenantId: string): Promise<number>;
     abstract sumDocumentStorageBytes(tenantId: string): Promise<number>;
   }
   ```

3. Implement Prisma repository counts:
   - Active users: `tenantMembership.count({ where: { tenantId, status: 'ACTIVE' } })`.
   - Active property engagements: `propertyEngagement.count({ where: { tenantId, archivedAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } } })`.
   - Document storage: sum uploaded/current document version bytes for tenant-owned document requests. Prefer current versions if the schema exposes `Document.currentVersionId`; otherwise document the chosen aggregate in code comments and tests.

4. Implement service methods:

   ```ts
   assertCanAddTenantUser(tenantId: string): Promise<void>
   assertCanAddActivePropertyEngagement(tenantId: string): Promise<void>
   assertCanStoreDocumentBytes(tenantId: string, requestedBytes: number): Promise<void>
   ```

   Use explicit `limit !== null` checks so `0` blocks correctly.

5. Throw `ConflictException` with the stable messages above.

6. Export the service and repository provider from `TenantLimitsModule`.

**Verification:**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
```

Expected: pass or only unrelated pre-existing errors. If errors appear in touched tenant-limits files, fix them before moving on.

## Task 2: Enforce `maxUsers` on invitation acceptance

**Files:**

- Modify: `viewpro-app/apps/api/src/team/team.module.ts`
- Modify: `viewpro-app/apps/api/src/team/team-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/src/team/use-cases/accept-team-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/test/team-invitations.e2e-spec.ts`

**Steps:**

1. Write failing E2E tests in `team-invitations.e2e-spec.ts`:
   - `maxUsers: null` allows acceptance.
   - `maxUsers: 0` blocks acceptance with `409` and `Tenant user limit exceeded`.
   - `maxUsers` equal to current active membership count blocks acceptance.
   - A deactivated membership does not count against the active user limit.

2. Run targeted tests and confirm failure:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api test -- team-invitations.e2e-spec.ts
   ```

3. Import `TenantLimitsModule` into `TeamModule` if the use case enforces at service level, or inject `TenantLimitEnforcementService` into `PrismaTeamInvitationsRepository` if enforcing inside the transaction.

4. Enforce before `markInvitationAccepted` and `tenantMembership.create` in:
   - `acceptForNewUser`
   - `acceptForExistingUser`

5. Prefer transaction-safe enforcement. If using a service outside the transaction, document residual race risk and add follow-up note; if practical, add a Prisma transaction helper that reads tenant limits/counts inside the same transaction.

6. Map repository/use-case result to `ConflictException` with the stable user-limit message.

7. Re-run targeted tests.

**Expected:** user limit tests pass and existing invitation tests remain green.

## Task 3: Enforce `maxActivePropertyEngagements` on create/restore/reactivation

**Files:**

- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts` if result unions need a limit-exceeded status.
- Modify: `viewpro-app/apps/api/src/property-engagements/use-cases/create-property-engagement.use-case.ts` if error mapping is use-case level.
- Modify: `viewpro-app/apps/api/src/property-engagements/use-cases/restore-property-engagement.use-case.ts` if error mapping is use-case level.
- Inspect/modify movement status transition path if it can move terminal engagements back to active:
  - `viewpro-app/apps/api/src/movements/use-cases/create-movement.use-case.ts`
  - `viewpro-app/apps/api/src/movements/prisma-movements.repository.ts`
- Modify: `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`
- Modify: `viewpro-app/apps/api/test/movements.e2e-spec.ts` only if movement reactivation can bypass create/restore.

**Steps:**

1. Write failing E2E tests for property engagements:
   - `maxActivePropertyEngagements: null` allows create.
   - `maxActivePropertyEngagements: 0` blocks create with `409` and stable message.
   - closed/cancelled engagements do not count.
   - archived engagements do not count.
   - restoring an archived active-status engagement at the limit is blocked.

2. Run targeted tests and confirm failure:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api test -- property-engagements.e2e-spec.ts
   ```

3. Inject tenant limit enforcement into `PropertyEngagementsModule`/repository.

4. Enforce before writes that increase active count:
   - before `createWithAsset` creates engagement and asset;
   - before `restoreForTenant` clears `archivedAt` when the restored status is not `CLOSED`/`CANCELLED`.

5. Inspect movement status updates. If an API can move `CLOSED`/`CANCELLED` to active, write the failing test and enforce before the status update.

6. Re-run targeted property and movement tests.

**Expected:** active engagement limit tests pass and existing property/movement flows remain green.

## Task 4: Enforce `maxDocumentsStorageMb` before owner upload URL creation

**Files:**

- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/create-owner-document-upload-url.use-case.ts`
- Modify: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/owner-documents.e2e-spec.ts` if E2E fixtures make quota proof practical.

**Steps:**

1. Write failing use-case tests:
   - `maxDocumentsStorageMb: null` allows upload URL creation.
   - `maxDocumentsStorageMb: 0` blocks upload URL creation with `409` and stable message.
   - current storage plus requested bytes over limit blocks upload URL creation.
   - a request exactly at the limit is allowed.

2. Run targeted tests and confirm failure:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api test -- owner-documents.use-cases.spec.ts
   ```

3. Add repository method for tenant document storage usage if not covered by the shared tenant-limit repository.

4. Inject `TenantLimitEnforcementService` into `CreateOwnerDocumentUploadUrlUseCase`.

5. After the use case resolves the document request and validates owner access/file size, call `assertCanStoreDocumentBytes(request.tenantId, input.sizeBytes)` before creating pending version/upload URL.

6. Ensure storage conversion uses `maxDocumentsStorageMb * 1024 * 1024`.

7. Re-run targeted use-case tests and owner document E2E if modified.

**Expected:** upload URL quota tests pass and existing owner document upload tests remain green.

## Task 5: Regression evidence and docs update

**Files:**

- Modify: `docs/plans/README.md`
- Optionally modify: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md` if it tracks completed Stage 25.4 evidence.

**Steps:**

1. Update `docs/plans/README.md` after implementation to move Stage 25.4 into recently completed and set Stage 26.0 as next active slice.

2. Run API validation:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api db:validate
   pnpm --filter @viewpro/api typecheck
   pnpm --filter @viewpro/api test -- team-invitations.e2e-spec.ts property-engagements.e2e-spec.ts owner-documents.use-cases.spec.ts
   ```

3. Run broader API tests if targeted tests touch shared fixtures heavily:

   ```bash
   cd viewpro-app
   pnpm --filter @viewpro/api test
   ```

4. Run app-new tests only if BFF/UI code was touched. Expected no app-new code changes unless error propagation requires it.

5. Run grep guard:

   ```bash
   cd /Users/emimontanari/Aurvox/Apps/Viewpro
   rg -n -i 'stripe|billing|paid plan|external billing' viewpro-app/apps/api/src viewpro-app/apps/app-new/src || true
   ```

   This is informational; Stage 25.4 must not introduce billing behavior.

6. Run fresh reviewer before commit/PR.

## PR checklist

- Issue: #132.
- Branch: `feat/stage-25-4-tenant-limit-enforcement`.
- Commit message: `feat(api): enforce tenant limits` or split focused conventional commits if the diff grows.
- PR base: `develop`.
- PR body must include:
  - Stage: 25
  - Slice: 25.4 — Tenant limits enforcement
  - No tocar: billing, paid plans, Stripe, external billing providers, auth migration
  - Evidence commands and results
  - Next slice: 26.0 — MVP evidence audit

## Review workload forecast

This likely touches API modules, repositories, use cases, and tests across team, property engagements, and documents. If the diff exceeds 400 changed lines or the implementation becomes hard to review, split into chained PRs:

1. Team/user limit enforcement.
2. Active property engagement enforcement.
3. Document storage enforcement and docs completion.

Prefer a single PR only if the resulting diff stays coherent and tests are easy to review.
