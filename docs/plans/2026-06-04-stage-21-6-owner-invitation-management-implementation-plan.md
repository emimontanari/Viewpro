# Owner Invitation Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let managers regenerate/copy and revoke pending owner invitation links without database or support intervention.

**Architecture:** Extend the existing property engagement owner invitation link flow. Keep generation/regeneration on the current endpoint, add a sibling revoke endpoint, and expose both actions in the existing property owner UI for invited owners only.

**Tech Stack:** NestJS 11, Prisma, Vitest/Supertest, Next.js app-new route handlers, React Testing Library, TanStack Query where currently used.

---

## Task 1: API RED for owner invitation revoke

**Files:**
- Modify: `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`

**Step 1: Write failing tests**

Add tests near the existing owner invitation link tests for:

- revoking a pending owner invitation link;
- validating the revoked token returns `410` from `/api/owner-invitations/:token`;
- rejecting revoke for an active owner;
- rejecting revoke for an owner from another property/tenant;
- regenerating after revoke returns a new valid link.

**Step 2: Run RED**

```bash
cd viewpro-app
DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' \
APP_PUBLIC_URL='http://localhost:3000' \
pnpm --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts
```

Expected: FAIL because the revoke endpoint does not exist.

---

## Task 2: Backend revoke endpoint/use-case/repository

**Files:**
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts`
- Modify: `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- Create or modify: `viewpro-app/apps/api/src/property-engagements/use-cases/revoke-owner-invitation-link.use-case.ts`
- Modify module wiring if needed: `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`

**Step 1: Add endpoint**

Add:

```txt
POST /api/property-engagements/:id/owners/:ownerId/invitation-link/revoke
```

Use the same auth, tenant, and permission guards as existing invitation link generation.

**Step 2: Add use case**

The use case should:

- load the engagement with `findByIdForTenant` like generation;
- verify owner belongs to the engagement property asset;
- require owner `accessStatus === INVITED`;
- call repository revoke method;
- return safe response with no raw token.

**Step 3: Add repository method**

The repository should revoke pending, not-expired invitations for `propertyAssetOwnerId`:

```ts
status: 'PENDING', expiresAt: { gt: now }, revokedAt: null
```

Return `revokedCount` and revoked invitation IDs if available.

**Step 4: Run GREEN**

Use the Task 1 command. Expected: PASS.

---

## Task 3: App BFF/service RED and implementation

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/revoke/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/revoke/route.test.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/service.test.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/types.ts`

**Step 1: Write failing BFF/service tests**

Prove:

- route proxies POST to `/property-engagements/:id/owners/:ownerId/invitation-link/revoke`;
- service calls `/api/products/:id/owners/:ownerId/invitation-link/revoke`;
- response shape excludes raw token/url.

**Step 2: Run RED**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter exec vitest run \
  src/app/api/products/[id]/owners/[ownerId]/invitation-link/revoke/route.test.ts \
  src/features/products/api/service.test.ts
```

Expected: FAIL because route/service do not exist.

**Step 3: Implement route/service/types**

Add the BFF route and exported service function.

**Step 4: Run GREEN**

Use the Task 3 command. Expected: PASS.

---

## Task 4: Owner card/section UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-card.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-card.test.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-owner-section.test.tsx`

**Step 1: Write failing UI tests**

Prove:

- invited owners show `Regenerar y copiar link` and `Revocar invitación`;
- active owners do not show revoke/regenerate actions;
- regenerate still copies or shows manual fallback;
- revoke calls the service and shows a success status;
- revoke errors are visible and do not remove the owner card.

**Step 2: Run RED**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter exec vitest run \
  src/features/products/components/property-owner-card.test.tsx \
  src/features/products/components/property-owner-section.test.tsx
```

Expected: FAIL until UI is updated.

**Step 3: Implement UI**

- Rename copy action label to `Regenerar y copiar link`.
- Add revoke action for invited owners.
- Add simple confirmation using existing UI patterns or a lightweight browser confirm if no project dialog pattern is already local.
- Show success/error feedback.
- Keep manual invitation fallback behavior for clipboard failures.

**Step 4: Run GREEN**

Use the Task 4 command. Expected: PASS.

---

## Implementation status

Completed in `feat/owner-invitation-management` with strict TDD evidence:

- RED: API targeted test failed before backend revoke endpoint existed (`404`/missing route); app-new BFF route test failed before the revoke route existed.
- GREEN targeted API: `test/property-engagements.e2e-spec.ts` passed with revoke coverage.
- GREEN targeted app-new: revoke BFF route, product service, owner card, and owner section tests passed.
- Revoke response excludes raw token/url; public validation of revoked token returns `410`; active/accepted, expired, already-revoked, unrelated-owner, and regenerate-after-revoke states are covered.

## Task 5: Validation and docs

**Files:**
- Modify: `docs/plans/README.md` after completion to advance next slice to Stage 25.1.
- Modify: `docs/plans/2026-06-04-final-mvp-execution-plan.md` to mark Stage 21.6 completed.
- Modify: `docs/plans/2026-06-04-mvp-closure-slices.md` and/or evidence audit only if status text changes.

**Step 1: Run targeted checks**

```bash
cd viewpro-app
DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' \
APP_PUBLIC_URL='http://localhost:3000' \
pnpm --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts

pnpm --filter next-shadcn-dashboard-starter exec vitest run \
  src/app/api/products/[id]/owners/[ownerId]/invitation-link/revoke/route.test.ts \
  src/features/products/api/service.test.ts \
  src/features/products/components/property-owner-card.test.tsx \
  src/features/products/components/property-owner-section.test.tsx
```

Expected: PASS.

**Step 2: Run broader checks**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit
pnpm --filter next-shadcn-dashboard-starter lint:strict
git diff --check
```

**Step 3: Fresh review**

Run a fresh read-only reviewer before committing.

**Step 4: Commit**

Suggested commit:

```bash
git commit -m "feat(owner-invitations): manage pending owner links"
```
