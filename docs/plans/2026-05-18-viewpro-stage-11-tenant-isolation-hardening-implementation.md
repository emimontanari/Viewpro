# Stage 11 Tenant Isolation Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove ViewPro's multi-tenant boundaries with targeted e2e tests and a reviewer-friendly isolation matrix.

**Architecture:** Add high-value cross-tenant tests around existing guards/repositories. Keep code changes minimal and only patch endpoints if a new failing test exposes a concrete leak.

**Tech Stack:** NestJS 11, Prisma 6, Vitest, Supertest, existing ViewPro auth/tenant/permission modules.

---

## Constraints

- Test/docs-first. Do not refactor tenant isolation broadly.
- Apply bug fixes only when a failing test proves a leak.
- Preserve status semantics: guard-level `403`, resource-level non-disclosure `404`.
- Owners are not tenant members.
- Admin global access is based only on `User.globalRole === VIEWPRO_ADMIN`.
- Do not commit unless the user explicitly approves.

## Task 1: Add tenant isolation matrix docs

**Files:**
- Keep: `docs/plans/2026-05-18-viewpro-stage-11-tenant-isolation-hardening-design.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`

**Step 1: Update roadmap status placeholder**

Under Stage 11 status, add after implementation:

```markdown
- Slice 3 implementado: matriz de aislamiento multi-tenant y cobertura e2e focalizada para movimientos, documentos, analytics, owner portal y admin global.
```

**Step 2: Run markdown diff check**

Run:

```bash
git diff --check
```

Expected: PASS.

## Task 2: Add cross-tenant movement creation test

**Files:**
- Modify: `viewpro-app/apps/api/test/movements.e2e-spec.ts`

**Step 1: Write failing e2e test**

Add a test using existing helpers/fixtures:

```ts
it('returns 404 when creating a movement for another tenant engagement', async () => {
  // create tenant A manager/session
  // create tenant B engagement
  // POST /api/movements with x-tenant-id tenant A and propertyEngagementId from tenant B
  // expect 404
})
```

**Step 2: Run RED/GREEN**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/movements.e2e-spec.ts
```

Expected: PASS if current implementation already blocks it; otherwise apply minimal fix.

## Task 3: Add document approve/reject cross-tenant tests

**Files:**
- Modify: `viewpro-app/apps/api/test/documents.e2e-spec.ts`

**Step 1: Add approve/reject denial tests**

Add tests that:

- create or reuse a document request in Tenant B;
- authenticate a manager/seller in Tenant A;
- attempt approve/reject action with Tenant A header;
- expect `404`.

**Step 2: Run targeted docs tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/documents.e2e-spec.ts
```

Expected: PASS or minimal bugfix.

## Task 4: Add analytics cross-tenant contamination test

**Files:**
- Modify: `viewpro-app/apps/api/test/analytics.e2e-spec.ts`

**Step 1: Add report isolation test**

Add a test that creates analytics events for Tenant A and Tenant B, then requests a Tenant A report and asserts Tenant B event counts/names do not appear.

**Step 2: Run targeted analytics tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/analytics.e2e-spec.ts
```

Expected: PASS or minimal bugfix.

## Task 5: Add owner misleading tenant header test

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts`

**Step 1: Add owner access independence test**

Add a test where owner has active `PropertyAssetOwner` access, sends a misleading `x-tenant-id` from another tenant, and still gets the owner-owned resource.

**Step 2: Add non-owner denial remains 404**

If not already covered with misleading header, add non-owner with misleading tenant header and expect `404`.

**Step 3: Run targeted owner tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/owner-portal.e2e-spec.ts
```

Expected: PASS or minimal bugfix.

## Task 6: Add admin arbitrary tenant header tests

**Files:**
- Modify: `viewpro-app/apps/api/test/admin.e2e-spec.ts`

**Step 1: Add global admin succeeds with arbitrary tenant header**

Add/strengthen tests that call one or more admin read-model endpoints with arbitrary `x-tenant-id` and expect success for `VIEWPRO_ADMIN`.

**Step 2: Add non-admin still fails with arbitrary tenant header**

Add/strengthen tests that a tenant manager/member with arbitrary tenant header still gets `403`.

**Step 3: Run admin tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/admin.e2e-spec.ts
```

Expected: PASS.

## Task 7: Full verification

**Step 1: Run targeted tenant isolation suite**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/movements.e2e-spec.ts test/documents.e2e-spec.ts test/analytics.e2e-spec.ts test/owner-portal.e2e-spec.ts test/admin.e2e-spec.ts
```

Expected: PASS.

**Step 2: API typecheck/build**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
```

Expected: PASS.

**Step 3: Root checks**

```bash
cd viewpro-app
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Diff check**

```bash
git diff --check
```

Expected: PASS.

## Commit boundary

Only if the user explicitly authorizes it:

```bash
git add docs/plans/2026-05-13-viewpro-implementation-roadmap.md \
  docs/plans/2026-05-18-viewpro-stage-11-tenant-isolation-hardening-design.md \
  docs/plans/2026-05-18-viewpro-stage-11-tenant-isolation-hardening-implementation.md \
  viewpro-app/apps/api/test
git commit -m "test(api): harden tenant isolation coverage"
```

Do not push unless the user explicitly approves after commit.
