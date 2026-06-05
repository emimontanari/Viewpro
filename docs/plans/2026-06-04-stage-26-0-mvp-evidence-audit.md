# Stage 26.0 MVP Evidence Audit

This report captures the first evidence gate before new product-feature work. It was run after Stage 0.2 cleanup and Stage 0.3 canonical-doc classification, then rerun after Stage 26.0a validation baseline fixes.

## Verdict

The validation baseline is now green enough to proceed with product P0 slices.

Core API, app-new component/unit tests, strict lint, and seeded E2E all run successfully. The remaining work is not setup noise anymore; it is product closure work from the final execution plan.

## Final validation results

| Command | Result | Evidence |
| --- | --- | --- |
| `cd viewpro-app && pnpm --filter @viewpro/api db:validate` | PASS | Prisma schema valid. |
| `cd viewpro-app && pnpm --filter @viewpro/api typecheck` | PASS | `tsc --noEmit` completed without errors. |
| `cd viewpro-app && DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public APP_PUBLIC_URL=http://localhost:3000 pnpm --filter @viewpro/api test` | PASS | `Test Files 46 passed (46)`, `Tests 497 passed (497)`. |
| `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter test` | PASS | `Test Files 70 passed (70)`, `Tests 317 passed (317)`. |
| `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` | PASS | `oxlint --deny-warnings` completed without warnings/errors. |
| `cd viewpro-app && APP_PUBLIC_URL=http://127.0.0.1:3100 VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3101 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3100 pnpm --filter next-shadcn-dashboard-starter test:seeded` | PASS | `7 passed`, including existing-owner owner invitation acceptance. Seed output: 20 properties, 20 images, 57 movements, 17 document requests. |

## Stage 26.0a baseline fixes applied

| Area | Fix |
| --- | --- |
| app-new strict lint | Fixed a11y label warnings, no-img warning handling for blob preview, addEventListener warnings, nested component warnings, mock function scoping warnings, and slider underscore warning. |
| API test DB | Applied pending migrations to `viewpro_test` so notification tables exist for the API suite. |
| API tests | Updated stale tests for recent admin activity dates, production exception-filter boot with production storage guard, and owner document storage driver expectation. |
| Seeded E2E | Stopped an existing dev server that blocked Next dev, ran seeded E2E on alternate ports, and updated stale expectations after UI/document UX changes. |

## Coverage matrix

| Area | Evidence found | Status | Priority |
| --- | --- | --- | --- |
| Manager property engagement | Seeded smoke opens property list/detail; API e2e covers create/list/read tenant-scoped engagements. | PASS evidence | keep regression |
| Seller assignment/scope | Seeded sellers see assigned-only dashboards and no create-property CTA; API covers assign/unassign/duplicate safety. | PASS evidence | keep regression |
| Owner portal read-only | Seeded owner sees property/tabs and no internal actions; API owner portal isolation exists. | PASS evidence | keep regression |
| Document request/upload/review | Seeded owner upload + manager read/approve passes; API covers request/upload/reject/read-url/isolation. | PASS evidence | keep regression |
| Document activity in Seguimiento | Seeded smoke checks some document activity text; mixed feed/filter/metadata/seller visibility still needs stronger proof. | PARTIAL | P1 — Slice 20.9 |
| Owner invitations existing owner + revoke/regenerate | Existing owner public acceptance has API/UI/seeded evidence; Stage 21.6 adds manager regenerate/copy and explicit revoke with API/UI evidence for pending, active/accepted, expired, already-revoked, unrelated-owner, and regenerate-after-revoke states. | PASS evidence | keep regression |
| Team roles/inactive/invitations | Strong API evidence; app-new/team seeded UI evidence incomplete. | PARTIAL | P1 — Slice 22.6 |
| WhatsApp config/contact/tracking | Mapping and click tracking tests exist; editable tenant/user phone config not proven. | PARTIAL | P0 — Slices 23.3/23.4 |
| Notifications producer/routing/read-unread | Producer and API tests exist; full seeded owner/internal routing/read-unread not proven. | PARTIAL | P0 — Slice 24.5 |
| Admin status/limits | Admin read-only exists; Stage 25.1 adds status write API, atomic audit, tenant guard proof, and concurrent duplicate-write protection; Stage 25.2 adds app-new status UI and admin BFF routes without tenant-header forwarding. Limits and enforcement pending. | PARTIAL | P0 — Slices 25.3–25.4 |
| Tenant loading/no-tenant/stale tenant | API tenant-context tests exist; app-new global no-tenant/stale/loading evidence incomplete. | PARTIAL | P1 |
| Security/isolation | Strong API evidence; seeded UI covers core seller/owner paths; final isolation regression still needed. | API PASS / UI PARTIAL | P1 — Slice 26.4 |

## Remaining P0 product gaps

1. **Stage 25.3–25.4 — Admin limits model/API and enforcement.**
2. **Stage 23.3–23.4 — WhatsApp contact configuration and priority/tracking proof.**
3. **Stage 24.5 — Notification routing/read-unread E2E.**

## Next selected slice

```txt
Stage: 25
Slice: 25.3 — Tenant limits model and API
Objective: configure pilot limits for users/team, active property engagements, and documents/storage.
Evidence needed: schema/migration review, API tests, admin permission tests, default-limit behavior.
Do not touch: billing, paid plans, Stripe, Clerk Billing.
Done: tenant limits are persisted, readable, editable by ViewPro admin, and have safe defaults.
Next slice: 25.4 — Tenant limits enforcement.
```
