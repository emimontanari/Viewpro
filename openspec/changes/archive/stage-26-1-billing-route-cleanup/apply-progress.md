# Apply Progress — Stage 26.1 Billing Route Cleanup

**Status:** completed  
**Scope:** route/nav cleanup only

## Files changed

- Nav/config/tests: `nav-config.ts`, `nav-config.test.ts`, `palette.test.ts`, `infoconfig.ts`.
- Menus: `app-sidebar.tsx`, `user-nav.tsx`.
- Route: `dashboard/billing/page.tsx`, `page.test.ts`.

## TDD evidence

| Step | Evidence |
| --- | --- |
| RED | Focused tests failed while billing remained in nav, menus, command actions, and direct route. |
| GREEN | Billing links/copy were removed and `/dashboard/billing` redirects to `/dashboard`. |
| TRIANGULATE | Nav, kbar, route tests plus source grep prove pilot-visible entry points are gone. |
| REFACTOR | Removed unused billing info content and imports. |

## Validation

- `cd viewpro-app/apps/app-new && pnpm test -- src/config/nav-config.test.ts src/components/kbar/palette.test.ts src/app/dashboard/billing/page.test.ts` — PASS, 76 files / 359 tests.
- `cd viewpro-app/apps/app-new && ! rg -n "/dashboard/billing|Facturación" src/config src/components --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` — PASS.
- `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` — PASS.
- `lsp_diagnostics` changed app-new files — PASS, 0 diagnostics.
- `git diff --check` — PASS.
