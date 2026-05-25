# Inicio Operativo App-New Design

## Goal
Adapt Stage 12.1 to the active `app-new` dashboard by turning `/dashboard` into an operational homepage for inmobiliarias.

## Context
The documented Stage 12 direction is still valid, but its older implementation plan references `apps/web`. The active UI work is now in `viewpro-app/apps/app-new`, where `/dashboard` currently redirects to the template-style `/dashboard/overview`.

## Scope
- Replace the `/dashboard` redirect with an operational homepage.
- Keep the existing shell/sidebar/header.
- Use existing app-new BFF/data sources only:
  - `/api/activity/feed`
  - `/api/products`
- Update navigation copy so the main dashboard entry is `Inicio` and points to `/dashboard`.
- Redirect sign-in, sign-up, and the root authenticated entry to `/dashboard` instead of the template overview.
- Remove template/demo navigation entries from the customer menu (`Forms`, `React Query`, `Icons`, `Exclusive`, `Login`, etc.).
- Add component tests for loading, no-inmobiliaria, loaded homepage states, redirect helper behavior, and product-facing nav labels.

## Non-Goals
- No backend changes.
- No new owner/auth/email/invitation flows.
- No new document module or top-level documents section.
- No exact aggregate pipeline counts if the backend does not expose them.
- No changes to `/admin`.
- No deletion of demo/template routes in this slice; only remove them from customer navigation.
- No mock/template notifications in the customer dashboard; `/dashboard/notifications` redirects to Inicio until real ViewPro notifications exist.

## UX Direction
The page should answer quickly:
1. Which inmobiliaria am I working in?
2. What needs attention today?
3. Where do I go next?

Sections:
- Hero with inmobiliaria name, role, and primary actions.
- KPI cards from existing products/activity data.
- Priorities of today from activity counters.
- “Movimientos rápidos” list from the mixed activity feed.
- “Gestiones para retomar” preview from the first page of active property data.
- “Propiedades con más movimiento” and “Vendedores con más movimiento” recent-window insight cards.
- Quick actions to Seguimiento, Propiedades, and Nueva propiedad.

## Data Semantics
- Use `productsQueryOptions({ archived: 'active', limit: 6 })` for active property total and preview rows.
- Use `activityFeedOptions({ kind: 'all', pageSize: 20 })` for the dashboard activity window, counters, and derived recent insights.
- Display only the first 5 activity items in the quick movement list.
- Derive “Propiedades con más movimiento” and “Vendedores con más movimiento” from that recent 20-item window; labels must not claim exact global/monthly rankings.
- Labels must avoid overclaiming when data is a first-page or recent-window preview.
- Queries must stay disabled until `activeTenantId` is available and tenant loading is complete.

## Testing
- Component test renders loading state.
- Component test renders no-active-tenant state.
- Component test renders tenant name, KPI values, recent activity, and property links using mocked queries.
- Redirect helper test defaults login to `/dashboard` and rejects unsafe URLs.
- Nav config test verifies product-facing labels and absence of template/demo entries.
- Existing activity/BFF tests continue to pass.

## Validation
- `pnpm --filter next-shadcn-dashboard-starter test`
- `pnpm --filter next-shadcn-dashboard-starter lint`
- `pnpm --filter next-shadcn-dashboard-starter build`
- `git diff --check`
