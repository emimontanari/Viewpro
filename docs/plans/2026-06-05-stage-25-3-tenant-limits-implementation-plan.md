# Stage 25.3 Tenant Limits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist, read, and edit tenant pilot limits through ViewPro Admin without introducing billing or enforcement.

**Architecture:** Extend `Tenant` with nullable limit fields and expose them through the existing admin NestJS module and app-new BFF/UI. Keep status and limits as separate operations. Limits writes are audited through `AnalyticsEventName.TENANT_LIMITS_UPDATED` and remain idempotent.

**Tech Stack:** Prisma/Postgres, NestJS, Supertest/Vitest, Next.js App Router BFF, TanStack Query, shadcn-style UI primitives.

---

## Slice contract

```txt
Stage: 25
Slice: 25.3 — Tenant limits model and API
Objective: configure pilot limits for users/team, active property engagements, and documents/storage.
Evidence needed: schema/migration review, API tests, admin permission tests, default-limit behavior.
Do not touch: billing, paid plans, Stripe, Clerk Billing.
Done: tenant limits are persisted, readable, editable by ViewPro admin, and have safe defaults.
Next slice: 25.4 — Tenant limits enforcement.
```

## Task 1: Backend schema and generated client

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_tenant_limits/migration.sql`

**Steps:**
1. Add `TENANT_LIMITS_UPDATED` to `AnalyticsEventName`.
2. Add nullable `Int?` fields to `model Tenant`: `maxUsers`, `maxActivePropertyEngagements`, `maxDocumentsStorageMb`.
3. Generate Prisma migration with pnpm, or create equivalent SQL if local DB state blocks generation.
4. Run `pnpm --filter @viewpro/api prisma:generate` if available; otherwise use the repo’s existing Prisma generate script.
5. Verify `pnpm --filter @viewpro/api db:validate` passes.

## Task 2: Backend admin limits API

**Files:**
- Create: `viewpro-app/apps/api/src/admin/dto/update-admin-tenant-limits.dto.ts`
- Create: `viewpro-app/apps/api/src/admin/admin-tenant-limits.repository.ts`
- Create: `viewpro-app/apps/api/src/admin/prisma-admin-tenant-limits.repository.ts`
- Create: `viewpro-app/apps/api/src/admin/admin-tenant-limits.service.ts`
- Create: `viewpro-app/apps/api/src/admin/responses/admin-tenant-limits.response.ts`
- Modify: `viewpro-app/apps/api/src/admin/admin.controller.ts`
- Modify: `viewpro-app/apps/api/src/admin/admin.module.ts`
- Modify: `viewpro-app/apps/api/src/admin/admin-read-models.repository.ts`
- Modify: `viewpro-app/apps/api/src/admin/responses/admin-read-models.response.ts`

**Steps:**
1. Write failing E2E tests in `test/admin.e2e-spec.ts` for admin-only limits writes, default `null` read behavior, changed writes, idempotent writes, invalid negative values, and unknown tenant.
2. Implement DTO validation for optional nullable integer limit fields.
3. Implement repository contract and Prisma repository using a transaction and `FOR UPDATE` on the tenant row.
4. Update changed fields atomically; create one `TENANT_LIMITS_UPDATED` analytics event only when values change.
5. Add service validation for integer/null semantics.
6. Add `PATCH /admin/tenants/:tenantId/limits` controller route.
7. Register service/repository provider in `AdminModule`.
8. Extend admin tenant list read models and response mapping with `limits`.
9. Run targeted API test: `pnpm --filter @viewpro/api test -- admin.e2e-spec.ts`.

## Task 3: App-new BFF and API service

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/admin/tenants/[tenantId]/limits/route.ts`
- Modify: `viewpro-app/apps/app-new/src/features/admin/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/admin/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/admin/api/service.test.ts`

**Steps:**
1. Write failing service test for `updateAdminTenantLimits('tenant 1', payload)` serializing to `/api/admin/tenants/tenant%201/limits`.
2. Implement frontend types for limits.
3. Implement service function.
4. Implement BFF route with local validation and `includeTenantHeader: false`.
5. Run targeted service test.

## Task 4: App-new admin UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.test.tsx`

**Steps:**
1. Write failing UI tests for limits summary, opening edit dialog, saving changed limits, and `Sin límite` display.
2. Add limits summary column or compact cell to the tenant table.
3. Add edit dialog state and mutation using `updateAdminTenantLimits`.
4. Use Spanish labels: `Usuarios`, `Publicaciones activas`, `Storage documentos`, `Sin límite`.
5. Keep UI within the existing card/table/dialog system; no visual redesign.
6. Run targeted UI test.

## Task 5: Validation and review

**Files:**
- Review entire diff.

**Steps:**
1. Run API validation: `pnpm --filter @viewpro/api db:validate`, targeted admin E2E, and API typecheck if touched types require it.
2. Run app-new targeted tests and strict lint/typecheck for touched files where practical.
3. Run a fresh-context reviewer over the diff.
4. Fix confirmed blockers only.
5. Save memory summary for the Stage 25.3 implementation.

## Review workload forecast

Expected diff is multi-area and likely above 400 changed lines because it includes schema, migration, API, BFF, UI, tests, and docs. Keep this as one Stage 25.3 slice only if review remains coherent around the single tenant-limits concern. If it grows further, split PRs into backend schema/API and app-new UI.
