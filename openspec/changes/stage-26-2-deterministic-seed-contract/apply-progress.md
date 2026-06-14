# Apply Progress — Stage 26.2 Deterministic Seed Contract

**Status:** implementation and DB-backed verification complete  
**Branch:** `feat/stage-26-2-deterministic-seed-contract`

## Files changed

- `viewpro-app/apps/api/scripts/seed-demo.mjs`
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`
- `docs/plans/CURRENT_MVP_EXECUTION.md`
- `openspec/changes/stage-26-2-deterministic-seed-contract/*`

## Manual review findings addressed

| Finding | Resolution |
|---------|------------|
| Admin smoke test tried deep-link `/admin` from sign-in, but the app only allows `/dashboard` and `/owner` as safe redirects. | Test now signs in to `/owner` and then navigates to `/admin`. |
| `DEMO_PROPERTY_IMAGE_URLS` retained dead remote URLs after moving to deterministic local bytes. | Replaced with scalar `DEMO_IMAGES_PER_PROPERTY = 1`. |
| Notification reset deleted by `recipientUserId` demo set, which could touch other tenants. | Scoped to `tenantId: existingTenant.id` only. |
| Sign-in helper reused cookies/localStorage across personas in new tests. | Added `clearCookies()` and `localStorage.clear()` before each sign-in. |
| Seller WhatsApp contact was not explicitly asserted. | Added owner timeline assertion for `contact.whatsappPhone === '+5493511111111'`. |
| Seed summary did not explicitly state deterministic asset strategy or scope. | Added `Scope:` and `Image assets:` lines. |

## TDD evidence

| Step | Evidence |
| --- | --- |
| RED | Recon confirmed no seeded `VIEWPRO_ADMIN`, no notification rows, remote-image dependency, no fixed seed date, no seller contact fixture, and no Stage 26.2 smoke proof. |
| GREEN | Seed now creates admin persona, tenant limits, fixed clock, local PNG images, notification fixtures, seller contact, admin audit events, and safer summary logs. |
| TRIANGULATE | Smoke now checks notifications/safe links, owner contacts, images, and admin limits while leaving full choreography to Stage 26.3. |
| REFACTOR | Kept production guards and demo-only scope; no schema/API/runtime feature change. |

## Validation run

- `node --check viewpro-app/apps/api/scripts/seed-demo.mjs` — PASS.
- `git diff --check` — PASS.
- `lsp_diagnostics` on changed seed/smoke files — PASS, 0 diagnostics.
- `cd viewpro-app && pnpm --filter @viewpro/api db:validate` — PASS.
- `cd viewpro-app && pnpm --filter @viewpro/api typecheck` — PASS.
- `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` — PASS.
- `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter test` — PASS, 76 files / 359 tests.
- `cd viewpro-app && pnpm demo:seed` — PASS.
- `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter test:seeded` — PASS, 10 tests.

## Seed output contract

```
Seeded ViewPro Demo Inmobiliaria
Tenant slug: viewpro-demo-inmobiliaria
Scope: canonical demo tenant and demo users only
Tenant status: ACTIVE
Tenant limits: users=12, activeEngagements=25, documentsMb=512
Logins:
- Manager: demo@viewpro.local / <VIEWPRO_DEMO_PASSWORD>
- Seller: martin.demo@viewpro.local / <VIEWPRO_DEMO_PASSWORD>
- Owner: propietario.demo@viewpro.local / <VIEWPRO_DEMO_PASSWORD>
- ViewPro admin: admin.demo@viewpro.local / <VIEWPRO_DEMO_PASSWORD>
Properties: 20
Images: 20
Image assets: deterministic local PNG fixtures
Movements: 57
Document requests: 17
Notifications: 4
Admin audit events: 2
Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía no-config movement contact
```

## Review status

- Fresh reviewer subagent was attempted three times and failed for infrastructure reasons:
  - Attempt 1: Codex usage limit reached (429).
  - Attempt 2: No API key configured for `google/gemini-3-pro`.
  - Attempt 3: Subagent failed before returning a text report.
- A manual audit was performed instead. No correctness or safety blockers were found; see findings table above.
- DB-backed verification passed, reducing the review risk.
