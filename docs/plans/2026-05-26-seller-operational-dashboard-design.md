# Seller Operational Dashboard Design

## Goal
Adapt the shared `/dashboard` entry point so sellers (`AGENT`) get a focused operational homepage while managers keep the existing inmobiliaria-wide dashboard.

## Decision
Do not add `/seller` yet. The MVP should keep one authenticated entry point and branch the content by active tenant role:

```txt
PRINCIPAL_MANAGER / MANAGER → current Inicio operativo
AGENT → seller operational dashboard
```

This avoids route fragmentation, duplicated layouts, and ambiguous behavior for users with multiple memberships.

## Scope
The seller dashboard should answer: “What do I need to work on today?”

It should show:

- assigned active properties;
- recent activity for assigned properties;
- counters for assigned properties/activity;
- CTAs to property list, seguimiento, and property detail for movement creation.

It should not show:

- tenant-wide top sellers;
- tenant-wide dashboard summary;
- “Nueva propiedad”; sellers do not have property creation permission;
- a new `/seller` route;
- new backend analytics endpoints.

## Architecture
Use existing backend permission behavior. Product list and activity feed already support assigned-only users:

- `productsQueryOptions({ archived: 'active', page: 1, limit, tenantId })` resolves to assigned properties for `AGENT` users because the backend filters by property assignment when the user lacks view-all permission.
- `activityFeedOptions({ kind: 'all', page: 1, pageSize, tenantId })` resolves activity for assigned properties for `AGENT` users.
- Do not call `dashboardSummaryOptions()` in the seller branch because `/analytics/dashboard-summary` requires `engagements.view_all`.
- Seeded smoke should verify that demo sellers see distinct assigned product sets, not the same properties.

Implementation shape:

```txt
OperationalHomepage
→ load tenant context
→ missing/loading states
→ if activeMembership.role === 'AGENT': SellerOperationalHomepage
→ else: ManagerOperationalHomepage
```

## UI direction
Keep the existing ViewPro design system, but change the seller language from “manager analytics” to “field workflow”:

- title: `Tu jornada comercial en <tenant>`;
- badge: `Panel de vendedor`;
- cards: `Mis propiedades asignadas`, `Actualizaciones hoy`, `Necesitan seguimiento`, `Sin novedades 7 días`;
- sections: `Mis propiedades asignadas` and `Actividad de mis propiedades`;
- CTAs: `Ver mis propiedades`, `Ver seguimiento`, `Abrir propiedad`.
- seller empty states must avoid create-property wording and explain that assigned properties appear when a manager assigns them.
- quick movement/property rows must be mobile-first: stacked on narrow screens, readable multi-line text, full-width visible action labels on mobile, compact icon actions only from larger breakpoints.

## Non-goals
- No new mobile app or PWA work.
- No owner portal work.
- No document upload/review flow changes.
- No property detail permission cleanup unless a test exposes a blocker.
- No backend changes.

## Validation
Run focused tests and smoke checks:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test -- src/features/dashboard/components/operational-homepage.test.tsx
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter @viewpro/api typecheck
git diff --check
```

Optional manual check:

```txt
pnpm demo:seed
login as martin.demo@viewpro.local / viewpro-demo-local
open /dashboard
```

## Risks
- Existing tests use colon-style permission strings while backend emits dot-style strings; role-based branching is safer for this slice.
- Seller activity should mean activity on assigned properties, not only activity created by the seller. Do not pass `sellerId` unless product scope changes.
- Detail page may still expose manager-looking actions; backend guards remain authority, and detail cleanup should be a separate slice if needed.
