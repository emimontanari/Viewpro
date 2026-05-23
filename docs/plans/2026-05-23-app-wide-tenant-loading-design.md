# App-Wide Tenant Loading Design

## Goal
Prevent tenant-scoped pages from briefly showing misleading “Seleccioná una inmobiliaria” states while the session and selected tenant are still loading or being synchronized.

## Problem
The app currently stores the active tenant in `localStorage` and resolves session memberships through React Query. Several pages treat `!selectedTenantId` as a final empty state. On slow connections or first hydration, `selectedTenantId` can be `null` before session memberships load or before the sidebar defaulting effect writes the first available tenant. That creates a false missing-tenant UI even though the user already belongs to an inmobiliaria.

## Recommended Approach
Centralize tenant resolution in the session layer and expose a loading-aware active tenant contract.

The central resolver should:
- return a valid stored tenant membership when available;
- otherwise fall back to the first session membership;
- persist that fallback to `localStorage` and the tenant cookie;
- re-write the tenant cookie when `localStorage` has a valid tenant but the cookie is missing or stale;
- expose `isTenantLoading` while session data or tenant persistence is unresolved;
- expose a real missing-tenant state only after session loading finishes and no membership exists.

## Data Flow
1. `SessionProvider` loads `/auth/me`.
2. The provider reads the selected tenant external store.
3. It derives `activeMembership` from the valid selected tenant or first membership.
4. If fallback is used, or if the cookie is missing/stale, the provider writes through `setSelectedTenantId`, which updates both `localStorage` and the BFF cookie.
5. Tenant-scoped components use `activeTenantId` and do not run tenant API queries until `!isTenantLoading`.

## UI Rules
- Loading tenant/session context: show skeleton or neutral loading UI.
- Active tenant available: render the page normally.
- No memberships after session load: show “Seleccioná una inmobiliaria” / create/select workspace guidance.

## Non-Goals
- No new routes.
- No owner portal/auth/email/invitation work.
- No server-side tenant routing redesign in this slice.
- No change to backend tenant authorization semantics.

## Likely Files
- `viewpro-app/apps/app-new/src/lib/session-context.tsx`
- `viewpro-app/apps/app-new/src/components/org-switcher.tsx`
- `viewpro-app/apps/app-new/src/features/activity/components/activity-monitor.tsx`
- `viewpro-app/apps/app-new/src/features/products/components/product-tables/index.tsx`
- `viewpro-app/apps/app-new/src/features/products/components/product-view-page.tsx`
- `viewpro-app/apps/app-new/src/app/dashboard/billing/page.tsx`
- `viewpro-app/apps/app-new/src/hooks/use-nav.ts`
- `viewpro-app/apps/app-new/src/components/layout/app-sidebar.tsx`

## Validation
- LSP diagnostics on touched frontend files.
- `pnpm --filter next-shadcn-dashboard-starter lint`.
- `pnpm --filter next-shadcn-dashboard-starter build`.
- Manual smoke on `/dashboard/seguimiento`, `/dashboard/product`, product detail/new, billing, and workspace switcher under a full dev-stack restart.
