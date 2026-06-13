# Stage 26.0 MVP Evidence Audit

Stage 26.0 turns the current product state into reproducible pilot-readiness evidence. It does not add product scope first; it proves the full ViewPro workflow, records what is missing, and selects the next fix slice from evidence.

## Verdict

**Status:** audit started.

**Current Judgment Day baseline:**

| Target          | Verdict            |
| --------------- | ------------------ |
| Controlled demo | READY WITH CAVEATS |
| Real pilot      | NOT READY          |

The product core is implemented enough for a controlled demo, but pilot readiness is blocked until the remaining P0 evidence gates are either proven or fixed.

## Slice contract

```txt
Stage: 26
Slice: 26.0 — MVP evidence audit
Objective: verify the final MVP end-to-end against canonical pilot readiness gates and collect reproducible evidence.
Evidence needed: seeded API/app-new/owner/admin flows, tenant isolation checks, hardening checklist, and deploy-readiness notes.
Do not touch: new product scope, billing, paid plans, Stripe, or external billing providers.
Done: MVP evidence is complete, reproducible, and ready for pilot handoff or prioritized fix selection.
Next slice: pilot handoff or fixes discovered by the audit.
```

## Quick path

1. Run the validation commands in this document.
2. Update the coverage matrix with PASS / PARTIAL / FAIL.
3. Run or document the manual demo walkthrough.
4. Classify findings as P0, P1, or P2.
5. Select the next implementation slice.

## Source of truth

Read in this order:

| Priority | Source                                                                                  | Use                                                                                             |
| -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1        | `docs/plans/README.md`                                                                  | Current plan index and next active slice.                                                       |
| 2        | `docs/plans/2026-06-04-final-mvp-execution-plan.md`                                     | Canonical pilot gates and execution order.                                                      |
| 3        | `docs/plans/2026-06-04-mvp-closure-slices.md`                                           | Historical audited closure matrix; must be reconciled because Stage 25.3/25.4 are now complete. |
| 4        | `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md`                                | Previous baseline audit; now historical after Stage 25.3/25.4.                                  |
| 5        | `viewpro-app/apps/app-new/docs/auth.md` and `viewpro-app/apps/app-new/docs/nav-rbac.md` | Active app-new auth/session/nav constraints.                                                    |

## Meeting feedback overlay — 2026-06-12

This overlay converts the 2026-06-12 InmoView demo feedback into Stage 26.0 evidence checks. It does **not** replace the canonical route, and it does not treat meeting-derived docs as project truth without verification.

### Intake rule

| Input | How to use it |
| ----- | ------------- |
| `/Users/emimontanari/Work/Apps/IDEAS/inmoview-resumen-reunion-2026-06-12.md` | Product/domain feedback from the demo. Use to discover pain, language, and corrections. |
| `/Users/emimontanari/Work/Apps/IDEAS/inmoview-plan-desarrollo.md` | Technical planning input from the meeting. Verify every technical claim against the repo before implementation. |
| Current code and canonical docs | Source of truth for package names, data model, routes, permissions, test commands, and current MVP boundaries. |

Repo reality for this audit:

- Active repo root: `/Users/emimontanari/Work/Apps/Viewpro/viewpro-app`.
- Active backend: `apps/api` (`@viewpro/api`, NestJS, Prisma, PostgreSQL, JWT, argon2).
- Active frontend: `apps/app-new` (`next-shadcn-dashboard-starter`, Next/React app-new surface).
- Current data model uses UUID ids, `PropertyAsset` + `PropertyEngagement`, request/version documents, tenant memberships, owner access records, and internal/owner notification surfaces.
- Current auth is API-backed email/password. Google/Facebook/phone auth stays backlog unless explicitly reprioritized.

### Technical plan corrections before implementation

| Meeting-plan claim | Verified project reality | Planning impact |
| ------------------ | ------------------------ | --------------- |
| Deploy from `main`. | Current execution history and active branch use `develop` plus feature branches; deploy branch still needs explicit confirmation. | Do not encode `main` as a deployment rule until Stage 26.5. |
| IDs should be `prop_xxx`, `usr_xxx`, `doc_xxx`. | Prisma models use UUID strings. | Do not migrate public ids during MVP hardening. |
| Auth includes Google/Facebook/phone. | Code and active auth docs support email/password only. | Keep multi-method auth post-MVP. |
| Storage provider is undecided. | API already supports `fake`, `local`, and `s3`; S3/R2 adapter work is considered completed unless evidence fails. | Stage 26.5 must prove env/deploy config, not reopen storage architecture. |
| Apify/Zonaprop import is confirmed. | Canonical final MVP excludes import integrations from current pilot-readiness gates. | Keep Apify/Zonaprop and Excel import backlog unless user explicitly promotes them later. |
| Full dual state model is required now. | Code already has `PropertyEngagementStatus` and movement status history. No approval-request model exists. | Verify whether sellers can mutate official state incorrectly before creating a large Stage 20.10 implementation slice. |
| Documents need a `visibilidad` column. | Current visibility is permission/requester based; no canonical document-type taxonomy exists. | Do not add schema until duplicate/visibility failures are proven and taxonomy is decided. |
| Image limit should be 10. | Code currently enforces 5 images. | Treat 5→10 as an explicit product/storage decision, not an automatic bug fix. |
| Invitation email is MVP-critical. | Manual invite/regenerate/copy flows exist; no email provider env/module is present. | Decide whether real transactional email moves from P2/backlog into MVP v1. |

### Feedback classification

| ID | Priority | Feedback | Type | Destination | Evidence needed |
| -- | -------- | -------- | ---- | ----------- | --------------- |
| FB-1 | P0 if reproduced | Seller can manage or reassign other sellers from a property. | Permission bug | Stage 22.8 / Stage 26.4 | Login as seller, open assigned property, verify assignment controls are hidden and API/BFF denies assignment mutations. |
| FB-2 | P0 decision | Seller should not directly change official property state; seller should request a change for Cuenta Madre approval. | Domain flow | Stage 20.10 only if current code/evidence violates beta needs | Confirm current status mutation rules by role and decide whether approval workflow must ship before July beta. |
| FB-3 | P1, P0 if data leak | Seller sees other sellers' individual update history. | Visibility rule | Stage 22.7 / Stage 20.9 | Define global movement vs seller-specific history visibility, then test seller session. |
| FB-4 | P1 | Seguimiento filters do not return expected results. | Bug | Stage 20.11 / Stage 20.9 | Reproduce seller/date/kind filters against seeded data and fix only confirmed failures. |
| FB-5 | P0 decision | Invitation email delivery does not work. | Onboarding/deploy | Stage 21.7 or Stage 26.5 | Decide whether beta can use copy-link fallback or needs real email provider now. |
| FB-6 | P0 | Owner `Contactar inmobiliaria` must open Cuenta Madre WhatsApp; seller contact remains separate when present. | Contact semantics | Stage 23.3 / Stage 23.4 / Stage 23.5 | Prove tenant phone config, seller phone behavior, no-config state, and click tracking. |
| FB-7 | P1 | Owner timeline should move above the fold, horizontally near the title/status. | UX correction | Owner portal proof / Stage 26 polish | Screenshot/manual proof on owner portal after core P0s. |
| FB-8 | P1 decision | Property image limit should increase from 5 to 10. | Product/storage tweak | Small media slice or Stage 26 fix | Confirm storage/tenant-limit implications, then update API/UI/tests together. |
| FB-9 | P1 decision | Prevent duplicate document requests when an approved document already exists. | Domain/UX correction | Stage 20.12 | Decide canonical document taxonomy/synonyms before implementation. |
| FB-10 | P1/P2 | Rename user-facing roles: Agente → Vendedor, Manager → Encargado. | Copy/domain language | Stage 26.6a | Copy inventory; no internal enum/security rename unless separately approved. |
| FB-11 | P0 | Deploy under InmoView/domain and provide stable demo accounts. | Deploy/demo handoff | Stage 26.5a | DNS/deploy checklist, env proof, smoke run, credentials handoff. |
| FB-12 | P0/P1 | Remove/gate starter, billing, demo, or template routes before pilot. | Hardening | Stage 26.1 | Route inventory, nav proof, tests/redirects for gated routes. |
| FB-13 | Backlog | Apify/Zonaprop import, Excel import, public portal AI, native mobile, WhatsApp bot, white-label, advanced KPIs. | Post-MVP idea | Backlog | Revisit only after MVP v1 pilot-readiness gates are green. |

### Proposed correction sub-slices

These sub-slices are candidates selected by evidence, not automatic scope expansion.

```txt
Stage: 26
Slice: 26.0-FB — Meeting feedback audit overlay
Objective: verify meeting feedback against code and canonical MVP gates before selecting implementation work.
Evidence needed: classification table, reproduction notes, and P0/P1/P2/backlog mapping.
Do not touch: product implementation, post-MVP integrations, broad roadmap changes.
Done: each meeting item has a destination slice, verification status, and next action.
Next slice: highest confirmed P0.
```

```txt
Stage: 22
Slice: 22.8 — Seller permission and activity-scope hotfix
Objective: close confirmed seller permission leaks and prove seller-scoped visibility.
Evidence needed: API/BFF/UI/seeded proof that sellers cannot manage other sellers and see only allowed property/update scopes.
Do not touch: team redesign, advanced analytics, billing, broad navigation redesign.
Done: seller cannot access assignment management or unrelated seller-specific history through UI or API.
Next slice: return to Stage 26.0 decision rule.
```

```txt
Stage: 20
Slice: 20.10 — State authority decision and change-request workflow
Objective: decide and, only if confirmed necessary, implement Cuenta Madre authority over official property status with seller change requests.
Evidence needed: current-role status mutation proof, approval/rejection tests if implemented, timeline/movement evidence.
Do not touch: custom workflow builder, custom statuses per agency, ProductForm redesign.
Done: official state cannot be overwritten by sellers outside the agreed rule.
Next slice: Stage 24.5 if notifications are involved; otherwise Stage 20.11.
```

```txt
Stage: 20
Slice: 20.11 — Seguimiento daily workflow corrections
Objective: fix confirmed Seguimiento filter/navigation issues without turning it into advanced BI.
Evidence needed: seeded/API/UI proof for seller/date/kind filters, observation display, and stale-property links.
Do not touch: advanced reporting, exports, archived analytics unless separately approved.
Done: daily Seguimiento works predictably for manager/seller workflows.
Next slice: Stage 20.12 if document duplicate/visibility is confirmed.
```

```txt
Stage: 20
Slice: 20.12 — Document duplicate guard and visibility decision
Objective: prevent owner-frustrating duplicate document requests if a canonical type taxonomy is approved.
Evidence needed: approved-document duplicate tests, free-text normalization tests, requester/role visibility tests.
Do not touch: OCR/scanning, storage adapter, document panel redesign.
Done: users cannot re-request already-approved canonical documents and unrelated sellers do not see seller-specific requests.
Next slice: Stage 23.3/23.4 or next confirmed P0.
```

```txt
Stage: 23
Slice: 23.5 — Owner contact CTA semantics and priority proof
Objective: align owner contact buttons with meeting decision and prove deterministic WhatsApp routing.
Evidence needed: Cuenta Madre phone, seller phone, missing phone no-config state, click tracking, and WhatsApp URL/message tests.
Do not touch: WhatsApp Business API, bots, automated reminders, chat inbox.
Done: `Contactar inmobiliaria` routes to the tenant/Cuenta Madre contact; seller contact remains separate and safe.
Next slice: Stage 24.5 or Stage 26.2/26.3.
```

```txt
Stage: 21
Slice: 21.7 — Minimal transactional invitation email delivery
Objective: if approved, send real owner/team invitation emails while preserving manual copy-link fallback.
Evidence needed: provider env docs, mocked provider tests, failure behavior, staging smoke or delivery proof.
Do not touch: marketing campaigns, password reset, full email verification, social auth.
Done: beta users can receive invitation emails without developer DB/support intervention.
Next slice: Stage 26.5 deploy checklist.
```

```txt
Stage: 26
Slice: 26.5a — InmoView domain, branding, and demo handoff
Objective: make the pilot demo reachable and understandable as InmoView while preserving ViewPro as umbrella context where needed.
Evidence needed: `inmoview.app` DNS/deploy proof, env checklist, smoke run, seeded demo credentials, and no starter/template route exposure.
Do not touch: package-wide technical renames unless required, subdomain architecture, billing/Stripe, marketplace.
Done: Pato can open the deployed app, log in with demo accounts, and show the pilot safely.
Next slice: Stage 26.6 pilot-ready deck.
```

```txt
Stage: 26
Slice: 26.6a — InmoView copy and role-language pass
Objective: apply low-risk user-facing copy corrections for the real-estate audience.
Evidence needed: copy inventory and screenshots/tests for critical login/nav/dashboard/owner/admin surfaces.
Do not touch: internal enum names, auth/permission semantics, database role migrations unless explicitly approved.
Done: critical UI uses InmoView, Vendedor, Encargado, Cuenta Madre language consistently enough for pilot.
Next slice: pilot handoff.
```

## Initial Judgment Day hypotheses

These are not final findings until this audit re-runs evidence, but both judges independently flagged them.

| ID   | Priority | Area               | Hypothesis                                                                                                                  |
| ---- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| JD-1 | P0       | WhatsApp/contact   | Tenant/seller phone contact is still seed/DB dependent; operational UI/API editing and priority proof are missing.          |
| JD-2 | P0       | Notifications      | Owner/internal notification routing, links, and read/unread state are not proven in seeded E2E.                             |
| JD-3 | P0       | Full seeded E2E    | Current seeded smoke does not cover the full manager → seller → owner → documents → notifications → WhatsApp → admin story. |
| JD-4 | P0       | Deploy readiness   | Staging/deploy checklist is not closed.                                                                                     |
| JD-5 | P0/P1    | Template hardening | Billing/starter/template routes are still visible or reachable.                                                             |
| JD-6 | P1       | Seguimiento        | Document activity proof is broad text-only; filters, metadata, ordering, and seller visibility need stronger evidence.      |
| JD-7 | P1       | Team/inactive      | Team UI and inactive/seller management are API-tested but not fully proven in seeded UI flow.                               |
| JD-8 | P1       | Docs drift         | Closure docs still reference Stage 25.3/25.4 as pending even though they are complete.                                      |

## Validation commands

Run from `/Users/emimontanari/Work/Apps/Viewpro/viewpro-app` unless noted.

| ID  | Command                                                                                                                                                                          | Purpose                                | Result                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| C1  | `pnpm --filter @viewpro/api db:validate`                                                                                                                                         | Prisma schema validity.                | PASS — Prisma schema valid.                     |
| C2  | `pnpm --filter @viewpro/api typecheck`                                                                                                                                           | API TypeScript validity.               | PASS — `tsc --noEmit` completed without errors. |
| C3  | `pnpm --filter @viewpro/api test`                                                                                                                                                | Full API regression.                   | BLOCKED — Prisma cannot reach `localhost:5432`; attempted run reported 14 failed / 31 passed files and 201 failed / 329 passed tests before DB-dependent failures dominated. |
| C4  | `pnpm --filter next-shadcn-dashboard-starter lint:strict`                                                                                                                        | app-new strict lint.                   | PASS — strict app lint completed with `oxlint --deny-warnings`. |
| C5  | `pnpm --filter next-shadcn-dashboard-starter test`                                                                                                                               | app-new unit/component/BFF regression. | PASS — app Vitest suite passed: 73 files, 343 tests. |
| C6  | `pnpm --filter next-shadcn-dashboard-starter build`                                                                                                                              | app-new production build.              | PASS — Next build compiled successfully and generated 45/45 static pages. |
| C7  | `APP_PUBLIC_URL=http://127.0.0.1:3100 VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3101 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3100 pnpm --filter next-shadcn-dashboard-starter test:seeded` | Seeded Playwright demo smoke.          | BLOCKED — seeded Playwright global setup failed during `pnpm demo:seed` because Prisma cannot reach `localhost:5432`. |

Notes:

- Use `pnpm`, not Bun.
- Avoid `pnpm --filter @viewpro/api test -- file`; targeted Vitest files in this repo use `pnpm --filter @viewpro/api test file`.
- Confirm test DB and ports before running seeded E2E.
- Previous local blocker: Docker/Postgres availability blocked API and seeded E2E validation. On 2026-06-12 the local `viewpro` database was migrated and seeded manually, and demo login was verified. C3 and C7 still need a fresh rerun before changing their status.

## Existing seeded smoke coverage

Current seeded smoke file: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`.

| Flow                                                      | Current status        | Evidence                                                         |
| --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Manager opens dashboard/property list/property detail     | Covered               | Seeded Playwright smoke.                                         |
| Seller assigned-only visibility and no create CTA         | Covered               | Seeded Playwright smoke for two sellers.                         |
| Owner portal read-only property/timeline/documents        | Covered               | Seeded Playwright smoke.                                         |
| Owner uploads document                                    | Covered               | Seeded Playwright smoke.                                         |
| Existing owner accepts another property/agency invitation | Covered               | Seeded Playwright smoke.                                         |
| Manager reads and approves submitted document             | Partial               | Approval covered; rejection still needs stronger seeded proof.   |
| Manager creates property engagement                       | Missing in seeded E2E | API coverage exists; browser creation proof needed.              |
| Manager assigns seller                                    | Missing in seeded E2E | API/UI tests exist; seeded assign/unassign proof needed.         |
| Manager creates movement/status update                    | Missing in seeded E2E | API coverage exists; browser proof needed.                       |
| Manager requests document                                 | Missing in seeded E2E | Seed creates requests; browser request creation proof needed.    |
| Notifications read/unread and safe links                  | Missing in seeded E2E | API/unit tests exist; seeded owner/internal proof needed.        |
| WhatsApp/contact priority and tracking                    | Missing in seeded E2E | Fields/routes exist; editable config and priority proof pending. |
| Admin status/limits in browser                            | Missing in seeded E2E | API/UI tests exist; browser admin proof needed.                  |
| Tenant limit error surfaced to user                       | Missing in seeded E2E | API enforcement exists; UI/BFF error proof needed.               |
| Team invitation/role/deactivation/inactive denial         | Missing in seeded E2E | API/BFF/component coverage exists; browser proof pending.        |

## Coverage matrix

| Gate from final plan                              | API evidence                                  | app-new/unit evidence                      | Seeded/manual evidence                               | Status             | Priority |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------ | -------- |
| Manager creates/opens property engagement         | Existing API coverage; verify in run.         | Existing app-new tests likely; verify.     | Opens existing seeded property; create flow missing. | PARTIAL            | P1       |
| Manager assigns seller                            | Existing API coverage; verify in run.         | Existing UI/BFF tests likely; verify.      | Missing in seeded flow.                              | PARTIAL            | P1       |
| Seller sees assigned-only and no create CTA       | Existing API coverage; verify in run.         | Existing tests; verify.                    | Covered in seeded smoke.                             | PASS pending rerun | P1       |
| Manager creates movement/status update            | Existing API coverage; verify in run.         | Existing tests; verify.                    | Missing in seeded flow.                              | PARTIAL            | P1       |
| Owner sees read-only detail and timeline          | Existing API coverage; verify in run.         | Existing tests; verify.                    | Covered in seeded smoke.                             | PASS pending rerun | P1       |
| Manager requests document                         | Existing API coverage; verify in run.         | Existing tests; verify.                    | Missing in seeded flow.                              | PARTIAL            | P1       |
| Owner uploads document                            | Existing API coverage; verify in run.         | Existing tests; verify.                    | Covered in seeded smoke.                             | PASS pending rerun | P0       |
| Manager approves/rejects document                 | Existing API coverage; verify in run.         | Existing tests; verify.                    | Approve covered; reject missing.                     | PARTIAL            | P1       |
| Document activity appears in Seguimiento          | Existing analytics/activity coverage; verify. | Existing activity component tests; verify. | Broad text-only check.                               | PARTIAL            | P1       |
| Notifications producer/routing/read-unread        | Existing API/unit coverage; verify.           | Existing BFF/page tests; verify.           | Missing seeded owner/internal flow.                  | PARTIAL            | P0       |
| Owner notification links never route to dashboard | Existing helper/API tests; verify.            | Existing BFF tests; verify.                | Missing seeded click-through.                        | PARTIAL            | P0       |
| WhatsApp contact configured or no-config state    | Click tracking routes/tests exist; verify.    | Existing route tests; verify.              | Missing seeded priority/config proof.                | PARTIAL            | P0       |
| Team invitation/role/deactivation                 | Existing API tests; verify.                   | Existing BFF/component tests; verify.      | Missing seeded flow.                                 | PARTIAL            | P1       |
| Admin status/limits                               | Existing API/UI tests; verify.                | Existing admin page tests; verify.         | Missing seeded admin flow.                           | PARTIAL            | P0       |
| Tenant suspended/limit behavior                   | Existing API tests; verify.                   | UI surfacing likely partial; verify.       | Missing seeded proof.                                | PARTIAL            | P0       |
| Security/isolation                                | Strong API coverage expected; verify.         | UI coverage partial.                       | Missing explicit seeded negative tests.              | PARTIAL            | P1       |
| Template/demo route cleanup                       | Inventory required.                           | Routes exist; verify nav/access.           | Missing proof.                                       | FAIL hypothesis    | P0/P1    |
| Deploy/staging checklist                          | Missing.                                      | Not applicable.                            | Missing.                                             | FAIL hypothesis    | P0       |

## Manual demo walkthrough

Use seeded accounts from `viewpro-app/apps/api/scripts/seed-demo.mjs`.

| Role    | Email                            |
| ------- | -------------------------------- |
| Manager | `demo@viewpro.local`             |
| Manager | `sofia.demo@viewpro.local`       |
| Seller  | `martin.demo@viewpro.local`      |
| Seller  | `lucia.demo@viewpro.local`       |
| Owner   | `propietario.demo@viewpro.local` |

Checklist:

1. Sign in as manager and confirm dashboard tenant heading.
2. Open property list and a seeded property detail.
3. Open Seguimiento and confirm movement/document activity.
4. Sign in as each seller and confirm assigned-only scope plus no create-property CTA.
5. As each seller, open an assigned property and confirm seller assignment/management controls are hidden or denied.
6. As each seller, inspect property history/Seguimiento and record whether unrelated seller-specific updates leak.
7. Sign in as owner and open owner property/timeline/documents; record whether timeline placement is acceptable for pilot.
8. Upload a document as owner and confirm it becomes `En revisión`.
9. Sign in as manager, open the submitted document, read it, approve it, then repeat or inspect rejection path.
10. Accept `seeded-existing-owner-invitation-token` as existing owner and confirm both properties appear.
11. Open dashboard notifications and owner notifications; mark read and reload.
12. Test owner WhatsApp contact links: `Contactar inmobiliaria` must resolve to Cuenta Madre/tenant contact; seller contact must remain separate when available.
13. Sign in as a ViewPro admin, open `/admin`, change tenant status, edit limits, and inspect audit.
14. Trigger a tenant limit error and confirm the user-visible error is recoverable.
15. Attempt representative cross-role/cross-tenant access and record 403/404 behavior.
16. Inventory billing/template/demo routes and decide hide/gate/remove.

## Fresh validation run — 2026-06-13

Automated checks after local DB migration/seed repair:

| Check | Result | Evidence |
| ----- | ------ | -------- |
| API regression | PASS | `pnpm --filter @viewpro/api test -- --reporter=basic` → `46 passed`, `535 tests passed`. Earlier full-suite run exposed one flaky/contextual `admin.e2e` failure; isolated `admin.e2e` and full rerun passed. |
| Seeded E2E | PASS | `APP_PUBLIC_URL=http://127.0.0.1:3100 VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3101 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3100 pnpm --filter next-shadcn-dashboard-starter test:seeded` → `7 passed`. |
| Typecheck | PASS | `pnpm typecheck`. |
| Frontend strict lint | PASS | `pnpm --filter next-shadcn-dashboard-starter lint:strict`. |
| Whitespace diff check | PASS | `git diff --check`. |

Manual/browser evidence against seeded data:

| Area | Result | Evidence | Priority |
| ---- | ------ | -------- | -------- |
| Manager dashboard/list/detail basics | PASS with hardening notes | Manager sees tenant dashboard, property list, property detail, and Seguimiento activity. However, starter infobar/docs and billing nav are visible. | P0/P1 via hardening |
| Seller assigned property list | PASS | Seller `martin.demo@viewpro.local` sees `7` assigned properties in `/property-engagements?pageSize=50`; list excludes the known unassigned seller property from seeded E2E. | P1 |
| Seller permission controls | FAIL | Seller sees `Nueva propiedad`, status comboboxes, `Editar`, `Archivar propiedad`, `Agregar actualización`, `Editar propiedad`, owner invitation controls, `Gestionar vendedores`, and `Solicitar documento` on an assigned property. | P0 |
| Seller official status mutation | FAIL | Seller changed `Casa compacta en Funes` from `Preparando publicación` to `Publicación activa` and received success toast `Estado cambiado a Publicación activa`. | P0 |
| Seller Seguimiento/activity scope | FAIL | Seller activity feed returned `26` items and includes properties assigned to another seller, e.g. `Casa con jardín en Villa Catalina`, `Casa premium en Cerro de las Rosas`, and `Casa de categoría en Farm Club`. | P0/P1 data-scope risk |
| Owner property contact | PASS | `/owner/properties/:propertyAssetId/engagements` returns `contact.targetType = tenant`, label `Contactar inmobiliaria`, and tenant WhatsApp `+5493510000000`. | P0 satisfied for seeded property-level contact |
| Owner movement/seller contact | PARTIAL | Owner timeline renders movement actions as `Contacto no configurado`; seller-specific WhatsApp contact behavior is not proven by seed. | P1/P0 if required for pilot |
| Owner timeline placement | PARTIAL | Owner timeline exists, but it is behind the `Seguimiento` tab rather than above the fold near title/status. | P1 UX |
| Owner notifications | PARTIAL | Owner notification dropdown shows `Document approved: Escritura firmada`; click-through stays in owner route. Read/unread reload proof remains incomplete. | P0 evidence gap |
| Admin seeded browser flow | PARTIAL | API admin tests passed, but `seed-demo` does not provide a `VIEWPRO_ADMIN` account, so seeded browser status/limits flow remains unproven. | P0 evidence gap |
| Template/demo/billing route cleanup | FAIL | Active route inventory still includes template/starter routes such as `dashboard/chat`, `dashboard/kanban`, `dashboard/forms/*`, `dashboard/elements/icons`, `dashboard/react-query`, `dashboard/workspaces`, and `dashboard/billing`; authenticated browser access to `dashboard/chat` renders starter chat UI. | P0/P1 hardening |
| Deploy/domain handoff | NOT RUN | No staging/domain/rollback proof produced in this run. | P0 before external pilot |

Next implementation slice selected from evidence: **Stage 22.8 / Stage 20.10 seller permission and official-state guard hotfix first**. This comes before route hardening because the seller can currently perform real operational mutations and see management controls. Stage 26.1 route cleanup remains the next confirmed hardening slice after seller permissions are fixed.

## Evidence ledger

| Evidence                            | Status      | Notes                                                            |
| ----------------------------------- | ----------- | ---------------------------------------------------------------- |
| Branch created from clean `develop` | PASS        | `chore/stage-26-0-mvp-evidence-audit`.                           |
| Issue created and approved          | PASS        | Issue #134.                                                      |
| New audit doc created               | PASS        | This file.                                                       |
| Meeting feedback overlay            | PASS        | 2026-06-12 product and technical meeting notes classified as verified input, not source of truth. |
| Validation commands                 | PASS        | API regression, seeded E2E, typecheck, frontend strict lint, and `git diff --check` passed on 2026-06-13. |
| Manual demo walkthrough             | COMPLETE WITH FAILURES | Browser/API pass reproduced seller permission/status mutation failures and template route hardening gaps. |
| P0/P1/P2 classification             | COMPLETE    | Confirmed P0: seller permission controls/status mutation; confirmed P0/P1: seller activity scope and template route cleanup; remaining P0 evidence gaps: notifications, admin seeded browser flow, deploy/domain. |
| Next slice selected                 | SELECTED    | Stage 22.8 / Stage 20.10 seller permission and official-state guard hotfix first; Stage 26.1 route cleanup next. |

## Current P0 findings to verify

These are the likely pilot blockers unless evidence proves them closed:

1. Stage 22.8 — Seller permission leak and seller activity-scope proof, if the meeting bug reproduces.
2. Stage 23.3/23.4/23.5 — WhatsApp/contact configuration, Cuenta Madre contact semantics, and priority proof.
3. Stage 24.5 — Notification routing/read-unread E2E.
4. Stage 26.1 — Template/demo/billing route cleanup or gating.
5. Stage 26.2/26.3 — Deterministic seed and full seeded E2E coverage.
6. Stage 26.5/26.5a — Deploy/staging/rollback checklist plus InmoView domain/demo handoff.
7. Stage 21.7 — Transactional invitation email delivery only if real beta onboarding cannot rely on manual copy-link fallback.

## Recommended next slice decision rule

After running evidence:

- If a seller can manage other sellers or access assignment mutations, choose Stage 22.8 first.
- If sellers can mutate official property state against the agreed domain rule and this must ship before beta, choose Stage 20.10; otherwise keep state approval as a later confirmed slice.
- If WhatsApp/contact is still seed/DB dependent or `Contactar inmobiliaria` does not resolve to Cuenta Madre contact, choose Stage 23.3/23.4/23.5 first.
- If notification routing/read-unread breaks or lacks proof, choose Stage 24.5 first.
- If demo users can see billing/template routes during the controlled walkthrough, choose Stage 26.1 first before demo.
- If real beta onboarding requires email delivery, choose Stage 21.7; if manual copy-link is acceptable, keep email delivery out of the immediate path.
- If all P0 product gaps are already covered by existing tests, choose Stage 26.2/26.3 full seeded E2E hardening.
- If staging/deploy/domain handoff is the only remaining P0, choose Stage 26.5/26.5a.

## Out of scope

- Billing, paid plans, Stripe, external billing providers, or automated plan upgrades.
- Apify/Zonaprop import, Excel/PDF import, and import-job cost accounting.
- WhatsApp Business API, bots, automated reminders, or chat inboxes.
- Google/Facebook/phone auth, reset password, or full email verification.
- Public id prefix migration (`prop_xxx`, `usr_xxx`, `doc_xxx`) from current UUID ids.
- Realtime notifications, SSE, WebSockets, or cron polling.
- AI/chat/marketplace features or public property portal search.
- Buyers/renters as users.
- Native mobile app.
- White-label logo/color customization beyond low-risk InmoView pilot copy/branding.
- Advanced BI/reporting, seller KPI dashboards, or last-connection analytics.
- Broad state-model rewrites, custom statuses per agency, or workflow builders without a confirmed P0/P1 evidence failure.
- Document OCR/scanning or duplicate-document taxonomy work before canonical document types are approved.
- Broad UI polish without a failing functional/evidence gate.
- Platform Owner impersonation.
- Admin browsing of private tenant document content.
