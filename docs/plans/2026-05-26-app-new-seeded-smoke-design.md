# App-new Seeded Smoke Design

## Goal
Add a small seeded authenticated smoke suite for the active `apps/app-new` UI so the merged demo seed can prove the main dashboard flows load end-to-end.

## Context
The project now has a deterministic developer seed via `pnpm demo:seed` that creates the `ViewPro Demo Inmobiliaria` tenant, demo users, properties with local images, movements, document requests, and analytics events. `apps/app-new` is the active frontend, but it currently has Vitest coverage only; the older `apps/web` package has Playwright auth smoke patterns that should not be reused directly because app-new stores tenant selection differently.

## Scope
The first seeded smoke slice should verify the existing product works rather than create new product behavior.

Covered flow:

```txt
pnpm demo:seed
→ app-new sign-in with demo@viewpro.local
→ /dashboard loads the operational homepage
→ /dashboard/product shows seeded properties
→ a seeded property detail opens from the UI
→ /dashboard/seguimiento shows seeded activity
```

## Non-goals
- No new backend endpoints or schema changes.
- No new UI behavior, visual redesign, owner portal, seller portal, or upload flows.
- No mutation assertions beyond the demo seed reset.
- No reliance on image download success; image fetches are network-dependent and the seed is resilient by design.

## Architecture
Add an app-new-specific Playwright config with two local web servers: the Nest API and the Next app-new dev server. A global setup runs `pnpm demo:seed` once before tests. The config must set the same `ACCESS_TOKEN_SECRET` for both API and app-new because app-new middleware verifies JWT cookies locally. The API runs in local development mode for this smoke suite because the demo seed may intentionally target a safe local/dev database; the seed script itself refuses unsafe production-looking database URLs.

Tests remain serial (`workers: 1`) because the demo seed resets shared DB state. The smoke test uses the real sign-in UI and app-new's own tenant-selection flow. It discovers a property detail through UI navigation instead of hardcoding generated IDs.

## Test boundaries
Use stable user-facing copy from the seeded dataset and pages:

- `ViewPro Demo Inmobiliaria`
- `Inicio operativo de ViewPro Demo Inmobiliaria`
- `20 gestiones inmobiliarias en total`
- a visible seeded property title, currently `Casa compacta en Funes`
- `Detalle de propiedad`
- `Seguimiento` / `Últimas actualizaciones`

Avoid brittle generated IDs and avoid checking exact analytics counts unless those counts are central to the assertion.

## Validation
Required validation for this slice:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --filter @viewpro/api typecheck
git diff --check
```

If Playwright browsers are missing locally, install them outside the repo with the normal Playwright install command before rerunning the seeded smoke suite.

## Risks
- If API and app-new use different `ACCESS_TOKEN_SECRET` values, login succeeds but `/dashboard` redirects back to sign-in.
- If the selected tenant cookie is absent, BFF routes cannot forward `x-tenant-id`; the UI sign-in path should set it via `setSelectedTenantId`.
- Existing local servers on ports `3001` or `3100` can cause false failures; the config should allow env overrides.
- The demo seed resets local demo data and must not run against production databases.
