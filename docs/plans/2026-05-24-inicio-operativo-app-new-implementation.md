# Inicio Operativo App-New Implementation Plan

## Goal
Implement the Stage 12.1 operational homepage in `apps/app-new` using existing frontend/BFF data sources.

## Work Units

### 1. Dashboard entrypoint
- Modify `viewpro-app/apps/app-new/src/app/dashboard/page.tsx`.
- Stop redirecting to `/dashboard/overview`.
- Render a new client component under `features/dashboard/components`.

### 2. Operational homepage component
- Create `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx`.
- Use `useActiveTenant()` for active inmobiliaria context.
- Use `useQuery` with:
  - `activityFeedOptions({ page: 1, pageSize: 20, kind: 'all', tenantId: activeTenantId })` for the recent activity window, counters, and derived insights.
  - `productsQueryOptions({ page: 1, limit: 6, archived: 'active', tenantId: activeTenantId })`
- Display only the first 5 activity items in the quick movement list.
- Derive recent-window property and seller activity summaries from the loaded activity items without claiming exact global rankings.
- Render loading and missing-inmobiliaria states without technical copy.
- Render hero, KPIs, priorities, quick movement activity, “Gestiones para retomar”, “Propiedades con más movimiento”, “Vendedores con más movimiento”, and quick actions.

### 3. Navigation and login redirect
- Modify `viewpro-app/apps/app-new/src/config/nav-config.ts`.
- Change `Dashboard` to `Inicio` and URL `/dashboard`.
- Remove template/demo customer menu entries such as Forms, React Query, Icons, Exclusive, Login, and Notifications.
- Remove the mock/template notification popover from the dashboard header.
- Redirect `/dashboard/notifications` back to `/dashboard` until real ViewPro notifications exist.
- Keep other demo/template routes available by URL for now; do not delete route files in this slice.
- Modify sign-in/sign-up/root redirects to land on `/dashboard` by default.

### 4. Tests
- Create `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx`.
- Mock `useActiveTenant`, `useQuery`, and router/link-safe UI as needed.
- Cover loading, no tenant, and loaded dashboard.
- Add tests for product-facing nav labels and absence of template menu entries.
- Add tests for sign-in redirect default/safety behavior.

### 5. Operational insight refinement
- Keep the slice frontend-only for now; do not add new backend analytics in this PR.
- Increase the activity preview window for dashboard-only derivations, but label insights as recent-window summaries instead of exact global rankings.
- Derive from current activity feed data:
  - quick movement/document activity;
  - properties with more recent activity;
  - sellers/agents generating more recent movement.
- Add a subtle “Atender primero” panel that points users to stale/attention/document work without inventing automation.
- Polish action buttons so `Abrir`/`Ver` actions use bordered, centered, consistent controls with obvious destinations and roughly 40px+ touch targets.
- Give “Atender primero” links explicit action labels and accessible names that include the count and destination.
- Keep future backend summary endpoint as a separate slice if/when exact period-based rankings are required.

### 6. Validation
Run from `viewpro-app`:

```bash
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint
pnpm --filter next-shadcn-dashboard-starter build
```

Then from repo root:

```bash
git diff --check
```
