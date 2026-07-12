# Dashboard Summary Ranges Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add backend-owned dashboard analytics with default 7-day range and 7/14/30 day presets, then wire app-new Inicio to consume it.

**Architecture:** Add a new NestJS analytics use case and controller route without changing existing `pilot-summary` semantics. Add an app-new BFF route and React Query feature API. Update `OperationalHomepage` to use the summary response as the source of truth while preserving tenant gating and current layout.

**Tech Stack:** NestJS, Prisma, Vitest/Supertest, Next.js App Router, React Query, TypeScript, shadcn/ui/Tailwind.

---

## Guardrails
- Active frontend is `viewpro-app/apps/app-new`, not legacy `apps/web`.
- Default range is `7d`; supported presets are `7d`, `14d`, `30d`.
- Keep scope backend summary + BFF/query + Inicio selector only.
- Do not add notifications, charts, custom date picker, owner portal, or route cleanup.
- Do not change `/analytics/pilot-summary` semantics.
- Keep all tenant scoped data behind existing tenant/permission guards.
- Do not stage `subagent-artifacts/` or local scratch.

## Task 1: Backend contract and use-case tests

**Files:**
- Create: `viewpro-app/apps/api/src/analytics/dto/get-dashboard-summary.query.ts`
- Create: `viewpro-app/apps/api/src/analytics/responses/dashboard-summary.response.ts`
- Create: `viewpro-app/apps/api/src/analytics/use-cases/get-dashboard-summary.use-case.ts`
- Modify: `viewpro-app/apps/api/test/analytics.use-cases.spec.ts` or existing analytics unit test file with current use-case coverage.

**Step 1: Write failing tests**
- Test default range resolves to rolling last 7 days.
- Test `14d` and `30d` resolve correct windows.
- Test top property sorting by activity count then latest timestamp.
- Test top seller sorting by movement count then latest timestamp.
- Test document requests count for top properties but do not count as seller movement.

**Step 2: Run focused backend tests**
```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- analytics.use-cases
```
Expected: fails because use case/types do not exist.

**Step 3: Implement DTO/types/use case**
- DTO validates/normalizes `range` as `7d | 14d | 30d` with default `7d`.
- Use case accepts `{ tenantId, range?, now? }`.
- Resolve `{ from, to }` rolling window.
- Query repository methods for:
  - active property count;
  - stale properties;
  - activity items/top property/top seller data.
- If repository lacks dedicated methods, add interface methods in Task 2 rather than overloading existing methods.

**Step 4: Re-run focused tests**
```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- analytics.use-cases
```
Expected: pass.

## Task 2: Backend repository and controller route

**Files:**
- Modify: `viewpro-app/apps/api/src/analytics/analytics.repository.ts`
- Modify: `viewpro-app/apps/api/src/analytics/prisma-analytics.repository.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.controller.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.module.ts`
- Modify: `viewpro-app/apps/api/test/analytics.e2e-spec.ts`

**Step 1: Write failing E2E tests**
- `GET /api/analytics/dashboard-summary` returns default `7d` summary.
- `GET /api/analytics/dashboard-summary?range=14d` returns `preset: '14d'`.
- Invalid range returns a validation error.
- Archived active-status properties are excluded from active counts, stale counts, attention counts, movement counts, top properties, top sellers, and recent dashboard activity.
- Endpoint requires same auth/tenant/permission pattern as existing aggregate analytics endpoints.

**Step 2: Run focused E2E tests**
```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- analytics.e2e
```
Expected: fails because route does not exist.

**Step 3: Implement repository methods**
Implemented backend repository methods:
```ts
countMovementsInWindow(input: TenantWindowInput): Promise<number>;
countActiveEngagementsWithoutRecentMovement(input: TenantWindowInput): Promise<number>;
countActiveEngagementsNeedingAttention(input: TenantWindowInput & { movementTypes: MovementType[] }): Promise<number>;
listTopPropertiesByActivity(input: TenantWindowInput & { limit: number }): Promise<DashboardTopPropertyRecord[]>;
listTopSellersByMovement(input: TenantWindowInput & { limit: number }): Promise<DashboardTopSellerRecord[]>;
```

Recent mixed activity is intentionally reused from existing movement/document activity repositories and mapped through the existing activity-feed response mappers.

Implementation notes:
- Prefer existing movement/document tables if they already power activity feed.
- Keep queries tenant-scoped.
- Treat active dashboard properties as `archivedAt: null` plus non-closed/non-cancelled status.
- Avoid N+1; include/select necessary property and agent data in one query per collection.
- Keep limit small, e.g. 5 recent activity, 3 top properties, 3 top sellers.

**Step 4: Wire controller/module**
- Add `@Get('dashboard-summary')` with `@RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)`.
- Inject `GetDashboardSummaryUseCase`.
- Pass current tenant id and query range.

**Step 5: Re-run backend tests**
```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- analytics.use-cases analytics.e2e
```
Expected: pass.

## Task 3: app-new BFF and feature API

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/dashboard/summary/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/dashboard/summary/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/features/dashboard/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/dashboard/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/dashboard/api/queries.ts`

**Step 1: Write failing BFF route test**
- No query forwards `/analytics/dashboard-summary`.
- `?range=14d` forwards `/analytics/dashboard-summary?range=14d`.
- Unsupported/empty range is omitted before forwarding so the backend default applies.

**Step 2: Run focused app-new tests**
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- dashboard/summary
```
Expected: fails because route does not exist.

**Step 3: Implement BFF route**
Follow `src/app/api/activity/feed/route.ts`. Final app-new BFF behavior: no query forwards `/analytics/dashboard-summary`, supported presets forward `?range=...`, and unsupported presets are omitted before forwarding:
- use `NextRequest`;
- use `bffFetch`;
- use `proxyJsonResponse`;
- use `toBffErrorResponse` with Spanish non-technical error copy.

**Step 4: Implement feature API**
- Types mirror backend response.
- Service fetches same-origin `/api/dashboard/summary`.
- Query keys include `tenantId ?? 'no-tenant'` and `range`.

Suggested key:
```ts
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (filters: DashboardSummaryFilters) =>
    [...dashboardKeys.all, 'summary', filters] as const
};
```

**Step 5: Re-run focused app-new tests**
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- dashboard/summary
```
Expected: pass.

## Task 4: Inicio selector and summary-driven UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx`

**Step 1: Write failing component tests**
- Default selected range is `7 días`.
- Selecting `14 días` updates the dashboard summary query key and visible range badge.
- Summary response renders counters/top properties/top sellers.
- Loading/missing tenant states still work.

**Step 2: Run focused test**
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- operational-homepage
```
Expected: fails until component is updated.

**Step 3: Update component**
- Add local `range` state default `'7d'`.
- Add a small segmented selector near hero or insight heading.
- Add `useQuery(dashboardSummaryOptions({ range, tenantId: activeTenantId }))` gated by active tenant.
- Use summary response for:
  - counters;
  - quick movement list;
  - top properties;
  - top sellers.
- Remove browser-derived grouping helpers if no longer needed.
- Keep current product preview query if “Gestiones para retomar” still needs first-page active properties.

**Step 4: Update labels**
- `Movimientos hoy` → `Movimientos del período`.
- `Sin actualización` → `Sin novedades en X días`.
- Insight badge → `Últimos X días`.

**Step 5: Re-run focused test**
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- operational-homepage
```
Expected: pass.

## Task 5: Docs and validation

**Files:**
- Modify: `docs/plans/2026-05-25-dashboard-summary-ranges-design.md`
- Modify: `docs/plans/2026-05-25-dashboard-summary-ranges-implementation.md`

**Step 1: Update docs with final contract**
- Reflect exact endpoint/query name.
- Invalid `range` validates strictly through `GetDashboardSummaryQuery`; unsupported values return 400.
- Repository methods are listed above; recent activity reuses existing movement/document repositories.
- Active dashboard analytics exclude archived engagements even when their status is still active.

**Step 2: Run validation**
Backend:
```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- analytics.use-cases analytics.e2e
pnpm --filter @viewpro/api typecheck
```

Frontend:
```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint
pnpm --filter next-shadcn-dashboard-starter build
```

Repo:
```bash
git diff --check
```

**Step 3: Fresh review**
Ask a fresh reviewer to check:
- backend range semantics;
- tenant/permission behavior;
- query performance/N+1 risk;
- app-new tenant gating/query keys;
- no unsupported features or overclaiming labels.

## Commit Plan
Use one commit if the diff remains focused:
```bash
git add docs/plans/2026-05-25-dashboard-summary-ranges-*.md viewpro-app/apps/api viewpro-app/apps/app-new
 git commit -m "feat(analytics): add dashboard summary ranges"
```

If diff exceeds review comfort, split into:
1. `feat(api): add dashboard summary ranges`
2. `feat(app-new): consume dashboard summary ranges`

## PR Notes
PR title:
```txt
feat(analytics): add dashboard summary ranges
```

PR body should mention:
- default 7-day dashboard summary;
- 14/30 day presets;
- backend-owned top property/seller analytics;
- app-new Inicio selector;
- validation evidence.
