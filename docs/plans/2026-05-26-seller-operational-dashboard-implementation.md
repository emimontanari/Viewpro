# Seller Operational Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a seller-focused `/dashboard` for `AGENT` memberships while preserving the existing manager dashboard.

**Architecture:** Branch inside `OperationalHomepage` after tenant context is loaded. Keep the current manager dashboard in a `ManagerOperationalHomepage` component. Add a `SellerOperationalHomepage` component that uses existing product and activity feed queries; do not call dashboard summary for sellers.

**Tech Stack:** Next.js 16, React 19, TanStack Query, app-new component tests with Vitest/RTL.

---

### Task 1: Refactor dashboard by role

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx`

**Step 1: Add imports**

Add:

```ts
import { activityFeedOptions } from '@/features/activity/api/queries';
import type { TenantMembership } from '@/lib/session';
```

**Step 2: Split the current manager dashboard**

Keep `OperationalHomepage` as the exported component, but make it responsible for tenant loading/missing state and role branching:

```tsx
export function OperationalHomepage() {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();

  if (isTenantLoading) return <OperationalHomepageSkeleton />;
  if (!activeTenantId || !activeMembership) return <MissingInmobiliariaState />;

  if (isSellerMembership(activeMembership)) {
    return <SellerOperationalHomepage activeMembership={activeMembership} activeTenantId={activeTenantId} />;
  }

  return <ManagerOperationalHomepage activeMembership={activeMembership} activeTenantId={activeTenantId} />;
}
```

Move the existing dashboard body into `ManagerOperationalHomepage`. Its queries should be enabled with `Boolean(activeTenantId)` because the parent already handled tenant loading.

**Step 3: Add seller role helper**

Add:

```ts
function isSellerMembership(membership: TenantMembership) {
  return membership.role === 'AGENT';
}
```

Optionally support `engagements.view_assigned` fallback later, but role check is enough for this slice.

---

### Task 2: Add seller dashboard UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx`

**Step 1: Add seller queries**

In `SellerOperationalHomepage`, query:

```ts
const productsQuery = useQuery({
  ...productsQueryOptions({ archived: 'active', limit: PROPERTY_PREVIEW_SIZE, page: 1, tenantId: activeTenantId }),
  enabled: Boolean(activeTenantId),
  refetchOnReconnect: false,
  refetchOnWindowFocus: false
});

const activityQuery = useQuery({
  ...activityFeedOptions({ kind: 'all', page: 1, pageSize: SELLER_ACTIVITY_PREVIEW_SIZE, tenantId: activeTenantId }),
  enabled: Boolean(activeTenantId),
  refetchOnReconnect: false,
  refetchOnWindowFocus: false
});
```

Do not call `dashboardSummaryOptions()` in this component.

**Step 2: Add seller hero**

Render:

- badge `Panel de vendedor`;
- heading `Tu jornada comercial en {tenant.name}`;
- copy focused on assigned properties and quick follow-up;
- links to `/dashboard/product` and `/dashboard/seguimiento`.

Do not render `Nueva propiedad`.

**Step 3: Add seller counters**

Use product total and activity counters:

- `Mis propiedades asignadas` → `productsQuery.data?.total ?? 0`;
- `Actualizaciones hoy` → `activityQuery.data?.counters.todayCount ?? 0`;
- `Necesitan seguimiento` → `activityQuery.data?.counters.attentionCount ?? 0`;
- `Sin novedades 7 días` → `activityQuery.data?.counters.staleCount ?? 0`.

**Step 4: Reuse existing list components**

Use:

- `PropertyPreviewList` for assigned properties with seller-safe empty-state copy and mobile-first row actions;
- `RecentActivityList` for assigned property activity with mobile-first row actions.

Quick movement/property rows should stack content above the action on mobile, avoid truncating important text, show a full-width visible action label on mobile, and collapse back to compact icon-style controls on larger screens.

Keep existing manager-only top properties/top sellers cards out of the seller branch.

---

### Task 3: Add component tests

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx`

**Step 1: Add activity fixture**

Create an `activityFeedResponse` fixture with:

```ts
{
  total: 2,
  page: 1,
  pageSize: 6,
  counters: { todayCount: 1, staleCount: 2, attentionCount: 3 },
  items: dashboardSummaryResponse.recentActivity
}
```

**Step 2: Update query mock**

Make `mockDashboardQueries` return activity data when `queryKey[0] === 'activity'`.

**Step 3: Add AGENT tests**

Add tests that:

- set `activeMembership.role = 'AGENT'`;
- assert seller heading/copy/cards render;
- assert `Nueva propiedad`, `Propiedades con más movimiento`, and `Vendedores con más movimiento` are absent;
- assert no `dashboard` query was called;
- assert product and activity queries were called;
- assert links to `/dashboard/product`, `/dashboard/seguimiento`, and `/dashboard/product/engagement-1` exist;
- assert empty assigned-property state does not tell sellers to create a property.

---

### Task 4: Validate seeded seller behavior

**Files:**
- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

Add seeded smoke coverage for demo seller users:

- `martin.demo@viewpro.local` should see seller dashboard copy and a distinct assigned product set.
- `lucia.demo@viewpro.local` should see seller dashboard copy and a different assigned product set.
- neither seller should see `Nueva propiedad`.

Use the app BFF `/api/products?limit=50` after UI login to assert every returned property includes the logged-in seller in its assigned agents.

### Task 5: Validate

Run:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/dashboard/components/operational-homepage.test.tsx
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter @viewpro/api typecheck
git diff --check
```

Expected:

- Focused dashboard tests pass.
- Full app-new tests pass.
- TypeScript passes.
- Seeded smoke still passes for the manager demo user.
- API typecheck passes.
- Diff has no whitespace errors.

---

### Task 6: Fresh review and PR

Ask a fresh reviewer to inspect:

- seller branch does not call manager summary;
- manager branch behavior is preserved;
- query mocks reflect real query keys;
- no new route or backend scope was introduced;
- role logic is simple and explicit.

Commit with:

```bash
git commit -m "feat(app-new): add seller operational dashboard"
```
