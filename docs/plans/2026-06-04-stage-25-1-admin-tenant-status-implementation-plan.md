# Stage 25.1 Admin Tenant Status Write API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a backend-only ViewPro admin API that changes tenant status and writes an atomic audit record.

**Architecture:** Keep admin writes inside the `admin` feature module. Use `AuthGuard + GlobalAdminGuard` for platform authorization, a dedicated write service/repository for tenant status changes, and a Prisma transaction for tenant update plus audit event creation. Reuse the existing tenant guard for suspended-tenant enforcement instead of duplicating status checks in business routes.

**Tech Stack:** NestJS, Prisma, PostgreSQL enum migration, class-validator DTOs, Vitest/Supertest E2E.

---

## Slice contract

```txt
Stage: 25
Slice: 25.1 — Admin tenant status write API + audit log
Objective: let ViewPro admins activate, suspend, and reactivate tenants without touching DB.
Evidence needed: API tests, global admin guard tests, tenant guard behavior, and audit record verification.
Do not touch: billing, limits, large admin UI, owner/team/document UI.
Done: admin can change tenant status; suspended tenant is blocked by existing guards; every status change is audited.
Next slice: 25.2 — Admin tenant management UI.
```

## Implementation guardrails

- Allow only `ACTIVE` and `SUSPENDED` target statuses.
- Treat same-status writes as idempotent: `200`, `unchanged: true`, no audit event.
- Add `AnalyticsEventName.TENANT_STATUS_CHANGED`; do not reuse property/document event names.
- Lock the tenant row before comparing/updating status so concurrent duplicate requests cannot create duplicate audit records.
- Create audit records in the same Prisma transaction as real status updates.
- Do not call `AnalyticsService.track` because it swallows write failures.
- Do not add app-new UI in this slice.

## Implementation evidence

- RED: `cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/admin.e2e-spec.ts` → expected failure before endpoint existed: `8 failed | 24 passed (32)` with `404 Not Found` on the new PATCH route.
- Prisma client: `cd viewpro-app && pnpm --filter @viewpro/api exec prisma generate` → PASS.
- Test DB migration: `cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' pnpm --filter @viewpro/api exec prisma migrate deploy` → PASS, applied `20260604190000_add_tenant_status_changed_event`.
- GREEN admin API: `cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/admin.e2e-spec.ts` → `34 passed`.
- Tenant guard regression: `cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/tenant-context.e2e-spec.ts` → `7 passed`.
- Prisma validate: `cd viewpro-app && pnpm --filter @viewpro/api exec prisma validate` → PASS.
- Typecheck: `cd viewpro-app && pnpm --filter @viewpro/api typecheck` → PASS.
- Whitespace: `git diff --check` → PASS.
- Test execution note: run API E2E suites sequentially when they share `viewpro_test`; parallel processes can race because each suite clears DB tables in `beforeEach`.

## Task 1: Add RED admin status API tests

**Files:**
- Modify: `viewpro-app/apps/api/test/admin.e2e-spec.ts`

**Step 1: Add tests before implementation**

Add focused E2E tests near the existing admin read-model authorization tests:

- unauthenticated `PATCH /api/admin/tenants/:tenantId/status` returns `401`;
- tenant `USER` returns `403` even with `x-tenant-id`;
- `VIEWPRO_ADMIN` can suspend a tenant and an audit event is written;
- suspended tenant is blocked by `TenantMembershipGuard` on `/api/tenant-context/demo/view`;
- `VIEWPRO_ADMIN` can reactivate the tenant and the guard allows access again;
- same-status write returns `unchanged: true` and does not add a second audit event;
- invalid statuses (`TRIAL`, `CANCELLED`, invalid string) return `400`;
- unknown tenant returns `404`.

**Step 2: Run tests to verify RED**

Run from repo root:

```bash
cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/admin.e2e-spec.ts
```

Expected: FAIL because the endpoint, DTO, and enum value do not exist yet.

## Task 2: Add audit enum migration

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/20260604190000_add_tenant_status_changed_event/migration.sql`

**Step 1: Update Prisma schema**

Add this enum value to `AnalyticsEventName`:

```prisma
TENANT_STATUS_CHANGED
```

**Step 2: Add migration SQL**

```sql
ALTER TYPE "AnalyticsEventName" ADD VALUE 'TENANT_STATUS_CHANGED';
```

**Step 3: Generate Prisma client if required by local tooling**

Run:

```bash
cd viewpro-app && pnpm --filter @viewpro/api exec prisma generate
```

Expected: Prisma client regenerates without errors.

## Task 3: Add DTO and response mapper

**Files:**
- Create: `viewpro-app/apps/api/src/admin/dto/update-admin-tenant-status.dto.ts`
- Create: `viewpro-app/apps/api/src/admin/responses/admin-tenant-status.response.ts`

**Step 1: DTO**

Create a DTO that validates the incoming `status` as `TenantStatus`, then exposes a helper or property validation that rejects `TRIAL` and `CANCELLED` in the service.

Expected code shape:

```ts
import { IsEnum } from 'class-validator'
import { TenantStatus } from '@prisma/client'

export class UpdateAdminTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus
}
```

The service remains the final policy boundary for allowed target statuses.

**Step 2: Response mapper**

Create:

```ts
export type AdminTenantStatusUpdateResponse = {
  tenantId: string
  previousStatus: TenantStatus
  status: TenantStatus
  unchanged: boolean
  updatedAt: string
}
```

Map `Date` values with `.toISOString()`.

## Task 4: Add write repository and service

**Files:**
- Create: `viewpro-app/apps/api/src/admin/admin-tenant-status.repository.ts`
- Create: `viewpro-app/apps/api/src/admin/prisma-admin-tenant-status.repository.ts`
- Create: `viewpro-app/apps/api/src/admin/admin-tenant-status.service.ts`

**Step 1: Repository contract**

Define an injection token and result union:

```ts
export const ADMIN_TENANT_STATUS_REPOSITORY = Symbol('ADMIN_TENANT_STATUS_REPOSITORY')

export type UpdateAdminTenantStatusResult =
  | { status: 'updated'; tenantId: string; previousStatus: TenantStatus; currentStatus: TenantStatus; updatedAt: Date }
  | { status: 'unchanged'; tenantId: string; previousStatus: TenantStatus; currentStatus: TenantStatus; updatedAt: Date }
  | { status: 'notFound' }
```

Input includes `tenantId`, `targetStatus`, `actorUserId`, and `now`.

**Step 2: Prisma implementation**

Implement with a Prisma transaction:

1. lock the target tenant row with `SELECT ... FOR UPDATE`;
2. if not found, return `notFound`;
3. if status already equals target, return `unchanged` without creating audit;
4. update tenant status;
5. create `analyticsEvent` with `TENANT_STATUS_CHANGED`, `INTERNAL_USER`, `actorUserId`, `tenantId`, and metadata `{ previousStatus, newStatus: targetStatus }`;
6. return updated values.

**Step 3: Service policy**

Service responsibilities:

- allow only `TenantStatus.ACTIVE` and `TenantStatus.SUSPENDED`;
- throw `BadRequestException('Unsupported tenant status')` for `TRIAL`/`CANCELLED`;
- throw `NotFoundException('Tenant not found')` for missing tenant;
- pass `actorUserId` from `request.user.id`;
- return sanitized response mapper output.

## Task 5: Wire controller and module

**Files:**
- Modify: `viewpro-app/apps/api/src/admin/admin.controller.ts`
- Modify: `viewpro-app/apps/api/src/admin/admin.module.ts`

**Step 1: Controller**

Add:

```ts
@Patch('tenants/:tenantId/status')
updateTenantStatus(
  @Param('tenantId') tenantId: string,
  @Body() body: UpdateAdminTenantStatusDto,
  @Req() request: AuthenticatedRequest,
): Promise<AdminTenantStatusUpdateResponse>
```

Use the existing controller-level `@UseGuards(AuthGuard, GlobalAdminGuard)`.

**Step 2: Module providers**

Register the new service and repository provider in `AdminModule`.

## Task 6: GREEN targeted tests

**Files:**
- All files from previous tasks.

**Step 1: Run targeted API tests**

```bash
cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/admin.e2e-spec.ts
```

Expected: PASS.

**Step 2: Run tenant guard regression if not covered in admin test**

```bash
cd viewpro-app && DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' APP_PUBLIC_URL='http://localhost:3000' pnpm --filter @viewpro/api exec vitest run test/tenant-context.e2e-spec.ts
```

Expected: PASS.

## Task 7: Update docs and evidence

**Files:**
- Modify: `docs/plans/2026-06-04-stage-25-1-admin-tenant-status-design.md`
- Modify: `docs/plans/2026-06-04-stage-25-1-admin-tenant-status-implementation-plan.md`
- Modify after implementation: `docs/plans/README.md`
- Modify after implementation if needed: `docs/plans/2026-06-04-final-mvp-execution-plan.md`
- Modify after implementation if needed: `docs/plans/2026-06-04-mvp-closure-slices.md`
- Modify after implementation if needed: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md`

**Step 1: Record evidence**

Add the exact commands and pass counts to the implementation plan.

**Step 2: Advance next slice only after implementation is validated**

Move docs from Stage 25.1 active to Stage 25.2 active after all checks pass.

## Task 8: Final validation and review

**Step 1: Run broader checks**

```bash
cd viewpro-app && pnpm --filter @viewpro/api typecheck
```

```bash
git diff --check
```

Use LSP diagnostics on changed API files.

**Step 2: Fresh review**

Ask a fresh reviewer to audit:

- admin-only authorization;
- DTO/status validation;
- transaction/audit atomicity;
- tenant guard behavior after suspension/reactivation;
- no out-of-scope UI/billing/limits changes;
- tests meaningful and not weakened.

**Step 3: Commit**

Suggested commit:

```bash
git add docs/plans viewpro-app/apps/api
 git commit -m "feat(admin): manage tenant status"
```

Then create the approved issue and PR using the standard branch/PR rules.
