# Stage 25.2 Admin Tenant Management UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal `app-new` ViewPro Admin UI for tenant listing and tenant status actions.

**Architecture:** Keep admin UI in a new `features/admin` app-new feature and expose local BFF routes under `/api/admin/*`. The UI uses the existing app-new component system and Spanish copy, while BFF route handlers forward auth cookies but explicitly disable `x-tenant-id` forwarding for global admin endpoints.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, shadcn-style local UI components, Vitest/Testing Library, pnpm workspace scripts.

---

## Slice contract

```txt
Stage: 25
Slice: 25.2 — Admin tenant management UI
Objective: expose minimal tenant operations in app-new for ViewPro admins.
Evidence needed: UI tests for tenant list, status badge, status action confirmation, loading/error states.
Do not touch: limits, billing, impersonation, private tenant content browsing.
Done: ViewPro admin can list tenants and activate/suspend/reactivate them from UI.
Next slice: 25.3 — Tenant limits model and API.
```

## Implementation guardrails

- Use `pnpm`; do not use `bun` commands.
- Preserve app-new visual language and existing UI primitives.
- Do not create a separate admin visual system.
- Do not modify login flow unless a failing test proves it is required.
- Do not forward `x-tenant-id` from app-new BFF admin routes.
- Only send `ACTIVE` or `SUSPENDED` status writes from UI/BFF.
- Do not touch limits, billing, impersonation, private tenant content browsing, or owner/team/document UI.
- Keep user-facing copy in Spanish; technical identifiers stay in English.

## Implementation evidence

- Service tests: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/api/service.test.ts` → `1 passed`, `6 passed`.
- UI tests: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/components/admin-tenant-management-page.test.tsx` → `1 passed`, `9 passed`.
- TypeScript: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit` → PASS.
- Strict lint: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` → PASS.
- LSP diagnostics: changed app-new admin/BFF files → no diagnostics.
- Review follow-up: admin UI now consumes the existing `SessionProvider`/`useSession` flow instead of issuing a separate `getSession` query.
- Whitespace: `git diff --check` → PASS.

## Task 1: Add RED service tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/admin/api/service.test.ts`

**Step 1: Write failing tests**

Cover:

- `getAdminDashboardData` loads summary, tenants, and activity in parallel from local `/api/admin/*` routes.
- `listAdminTenants` serializes `page`, `pageSize`, and optional `status`.
- `listAdminActivity` serializes `page`, `pageSize`, and optional `tenantId`.
- `updateAdminTenantStatus` sends `PATCH` to `/api/admin/tenants/:tenantId/status` with JSON `{ status }`.
- service parses backend/BFF error messages into Spanish-facing errors.

**Step 2: Run test to verify RED**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/api/service.test.ts
```

Expected: FAIL because `features/admin/api/service.ts` does not exist.

## Task 2: Implement admin API types and service

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/admin/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/admin/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/admin/api/queries.ts`
- Test: `viewpro-app/apps/app-new/src/features/admin/api/service.test.ts`

**Step 1: Add types**

Port the sanitized admin read-model types from `apps/web/src/lib/admin.ts` and add:

```ts
export type AdminTenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
export type AdminTenantStatusAction = 'ACTIVE' | 'SUSPENDED'

export type AdminTenantStatusUpdateResponse = {
  tenantId: string
  previousStatus: AdminTenantStatus
  status: AdminTenantStatus
  unchanged: boolean
  updatedAt: string
}
```

**Step 2: Add service functions**

Implement local BFF fetches with `credentials: 'include'`, timeout, JSON parsing, and Spanish error fallback:

- `getAdminSummary()`
- `listAdminTenants(filters)`
- `listAdminActivity(filters)`
- `updateAdminTenantStatus(tenantId, { status })`
- `getAdminDashboardData()`

**Step 3: Add query keys/options**

Create stable keys:

- `adminKeys.all`
- `adminKeys.summary()`
- `adminKeys.tenants(filters)`
- `adminKeys.activity(filters)`

**Step 4: Run service tests**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/api/service.test.ts
```

Expected: PASS.

## Task 3: Add RED BFF route tests if route-handler pattern exists

**Files:**
- Modify or create the smallest route-handler test only if app-new already has route-handler test infrastructure.

**Step 1: Search before adding**

```bash
cd viewpro-app && rg "route\.test|route\.spec|bffFetch" apps/app-new/src apps/app-new/tests
```

If no route-handler test pattern exists, do not invent a large new harness. Cover tenant-header behavior with focused unit tests around `bffFetch` if feasible, and with seeded/e2e request interception later if needed.

## Task 4: Add BFF tenant-header opt-out and admin route handlers

**Files:**
- Modify: `viewpro-app/apps/app-new/src/lib/bff-api.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/admin/summary/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/admin/tenants/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/admin/activity/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/admin/tenants/[tenantId]/status/route.ts`

**Step 1: Extend `bffFetch` safely**

Add an options shape without breaking existing callers:

```ts
type BffFetchOptions = RequestInit & {
  includeTenantHeader?: boolean
}
```

Default `includeTenantHeader` to `true`. Only set `x-tenant-id` when it is true.

**Step 2: Add read route handlers**

Proxy:

- `/api/admin/summary` -> backend `/admin/summary`
- `/api/admin/tenants` -> backend `/admin/tenants` with allowlisted query params `page`, `pageSize`, `status`
- `/api/admin/activity` -> backend `/admin/activity` with allowlisted query params `page`, `pageSize`, `tenantId`

All calls use:

```ts
bffFetch('/admin/...', { includeTenantHeader: false })
```

**Step 3: Add PATCH route handler**

For `/api/admin/tenants/[tenantId]/status`, parse JSON and reject unsupported statuses locally:

```txt
ACTIVE | SUSPENDED
```

Then proxy to backend with method `PATCH`, JSON body, auth cookie forwarding, and `includeTenantHeader: false`.

**Step 4: Run app-new type/lint feedback early**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

Expected: no new type errors from route handlers.

## Task 5: Add RED admin UI component tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.test.tsx`

**Step 1: Write failing tests**

Mock session and admin service. Cover:

- loading state: `Cargando consola admin…`.
- forbidden state for non-`VIEWPRO_ADMIN`.
- initial error state: `No pudimos cargar el admin`.
- tenant list renders tenant name, slug, and status badges.
- `TRIAL` shows `Activar`; confirm sends `ACTIVE`.
- `ACTIVE` shows `Suspender`; confirm sends `SUSPENDED`.
- `SUSPENDED` shows `Reactivar`; confirm sends `ACTIVE`.
- `CANCELLED` shows no status action.
- clicking action opens confirmation and does not call service until confirm.
- successful mutation shows appropriate toast/copy and invalidates/refetches tenant data.
- failed mutation shows `No se pudo actualizar el estado del tenant.`.

**Step 2: Run test to verify RED**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/components/admin-tenant-management-page.test.tsx
```

Expected: FAIL because the component does not exist.

## Task 6: Implement admin page/component with existing UI primitives

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/admin/page.tsx`
- Create: `viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.tsx`
- Test: `viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.test.tsx`

**Step 1: Create route page**

`src/app/admin/page.tsx` should render the client feature component and set metadata/title if consistent with app-new patterns.

**Step 2: Implement client component**

Use existing app-new primitives only:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Badge`
- `Button`
- `AlertDialog`
- `Select` or existing filter components if needed
- `sonner` toast
- existing loading/empty/error patterns from app-new features

Do not port custom CSS classnames from `apps/web` unless they already exist in app-new.

**Step 3: Access flow**

Use the existing app-new session mechanism and require:

```txt
session.user.globalRole === 'VIEWPRO_ADMIN'
```

Backend BFF remains authoritative, so client-side role check is UX only.

**Step 4: Tenant actions**

Map statuses:

- `TRIAL` -> `Activar` -> `ACTIVE`
- `ACTIVE` -> `Suspender` -> `SUSPENDED`
- `SUSPENDED` -> `Reactivar` -> `ACTIVE`
- `CANCELLED` -> no action

Use confirmation dialog before calling `updateAdminTenantStatus`.

**Step 5: Run UI tests**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/components/admin-tenant-management-page.test.tsx
```

Expected: PASS.

## Task 7: Optional seeded E2E proof

**Files:**
- Create if required: `viewpro-app/apps/app-new/tests/seeded/admin-tenant-management.spec.ts`

**Step 1: Decide after unit coverage**

If unit tests cover all required Stage 25.2 evidence and route/BFF behavior is covered, seeded E2E can be deferred to a later full MVP seeded run. If added, keep it minimal:

- login as seeded ViewPro admin;
- open `/admin`;
- verify tenant list/badges;
- intercept `/api/admin/*` and assert no `x-tenant-id` request header;
- avoid destructive status mutation unless fixture reset is explicit.

**Step 2: Run seeded command if added**

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts tests/seeded/admin-tenant-management.spec.ts
```

Expected: PASS.

## Task 8: Update docs and evidence

**Files:**
- Modify: `docs/plans/2026-06-04-stage-25-2-admin-tenant-management-ui-design.md`
- Modify: `docs/plans/2026-06-04-stage-25-2-admin-tenant-management-ui-implementation-plan.md`
- Modify after validation: `docs/plans/README.md`
- Modify after validation: `docs/plans/2026-06-04-final-mvp-execution-plan.md`
- Modify after validation: `docs/plans/2026-06-04-mvp-closure-slices.md`
- Modify after validation: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md`

**Step 1: Record exact evidence**

Add command outputs/pass counts for all targeted checks.

**Step 2: Advance next slice only after validation**

After Stage 25.2 is green, mark Stage 25.2 complete and set Stage 25.3 as next.

## Task 9: Final validation

Run targeted checks from the workspace root:

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/api/service.test.ts
```

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/components/admin-tenant-management-page.test.tsx
```

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

```bash
cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict
```

```bash
git diff --check
```

Then run LSP diagnostics on changed app-new files before fresh review.

## Task 10: Fresh review and PR prep

**Step 1: Fresh review**

Run a fresh-context reviewer before commit/PR. The review must check:

- visual consistency with existing app-new components;
- no tenant-header leakage from admin BFF;
- role boundary and no email-based admin checks;
- no out-of-scope billing/limits/impersonation/private browsing changes;
- test evidence and docs.

**Step 2: Issue/commit/PR**

Create an approved issue before PR if not already created. Commit with:

```bash
git commit -m "feat(admin): add tenant management UI"
```

Open PR against `develop` with exactly one `type:*` label.
