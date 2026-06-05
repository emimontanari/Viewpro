# ViewPro Final MVP Execution Plan

This is the execution plan to take ViewPro from the current audited state to a **pilot-ready, 100% functional product for a real inmobiliaria**.

It does not replace the original roadmap. It consolidates the latest audit across foundational docs, Stage 20–24 docs, app-new docs, and the corrected closure plan.

## Decision

Start with evidence, then close the operational gaps that still require manual DB/support work.

Do **not** restart product discovery, do **not** reopen visual polish, and do **not** rebuild implemented flows.

## Definition of 100% functional for pilot

ViewPro is pilot-ready when a real estate agency can:

1. operate inside a tenant without developer help;
2. manage real team members and owner users;
3. create and manage property engagements;
4. assign sellers and enforce seller-only visibility;
5. invite owners, including owners that already have an account from another agency;
6. request, receive, review, approve, and reject documents;
7. show document and movement activity in Seguimiento;
8. notify internal users and owners with safe routing and read/unread state;
9. configure WhatsApp contact data without DB edits;
10. let ViewPro admins activate, suspend, reactivate, and limit tenants;
11. pass a reproducible seeded E2E from manager to owner to admin;
12. deploy to staging with documented env vars, storage, auth, CORS, migrations, smoke, and rollback.

## Canonical sources

| Source | Use |
| --- | --- |
| `docs/plans/2026-05-28-mvp-product-final-like-roadmap-design.md` | Original roadmap source of truth. |
| `docs/plans/2026-06-04-mvp-closure-slices.md` | Audited stage status and gap summary. |
| This file | Final execution order and gates. |

## Historical or non-canonical sources

These docs can provide context, but must not override the final plan without explicit review:

- `viewpro-app/apps/app-new/docs/clerk_setup.md` — starter/template-oriented.
- `viewpro-app/apps/app-new/docs/nav-rbac.md` — Clerk/client-side assumptions, not security source of truth.
- older `apps/web` frontend docs — historical after app-new became the active surface.
- Stage 0–11 docs — useful history, not current execution plan.
- untracked Stage 24 docs — promote unique decisions here or archive; do not keep as floating source of truth.

## Non-negotiable execution rule

Every implementation slice must declare:

```txt
Stage:
Slice:
Objective:
Evidence needed:
Do not touch:
Done:
Next slice:
```

Every PR must also include:

```txt
Stage:
Slice:
No tocar:
Evidence:
Next slice:
```

## Promoted architecture decisions from Stage 24

These notification decisions were promoted from the untracked Stage 24 design artifacts so those temporary docs can be removed without losing rationale.

| Decision | Final rule |
| --- | --- |
| Owner/internal notification separation | Keep dashboard/internal notifications under `/notifications...` and owner notifications under `/owner/notifications...`. Do not collapse them into `/notifications?surface=OWNER`. |
| Owner notification authorization | Owner reads/mutations require `recipientUserId === currentUser.id` and `surface === OWNER`; notifications with property/engagement/document/movement refs must also require active owner access. |
| Owner route guards | Owner notification routes use authenticated owner identity, not dashboard tenant membership or internal permission guards. |
| Link safety | Owner notification UI may open only safe relative `/owner...` links. Reject external URLs, protocol-relative URLs, malformed links, and `/dashboard...` links. |
| Producer architecture | Use a centralized `NotificationProducerService` for title/body/link/ref policy instead of scattering copy across use cases. |
| Analytics separation | Do not reuse analytics as a notification event bus; analytics is telemetry/audit-oriented and may not carry safe recipient/link/ref context. |
| Failure tolerance | Notification producer failures must not break primary domain commands unless a later slice explicitly changes that policy. |
| Realtime scope | Realtime, polling, cron, SSE, and WebSockets remain out of MVP scope. |

## Priority gates

### P0 — blocks a real pilot

| Area | Gate | Why it blocks |
| --- | --- | --- |
| Owner invitations | Existing owner accepts another agency/property | Owners are global; a real owner can belong to more than one agency. |
| Owner invitations | Explicit revoke/resend or regenerate-link UX | Managers cannot depend on support/DB when invite links fail. |
| Admin | Tenant status write API + audit log | ViewPro cannot operate pilots if tenant state changes require DB edits. |
| Admin | Tenant limits model and enforcement | Trial/pilot control requires property/user/document limits. |
| WhatsApp | Phone configuration without DB edits | Contact links cannot depend on seeded/manual phone data. |
| Notifications | Full producer/routing/read-unread E2E | Owners must not receive dashboard links; internal users must not leak cross-tenant data. |
| Evidence | Full seeded E2E | The product must be reproducibly proven end-to-end. |
| Hardening | Template/demo cleanup | A pilot cannot expose starter routes, fake actions, or dead UI. |
| Deploy | Staging/deploy checklist | A pilot is not real until deployment is reproducible. |

### P1 — important for robust pilot readiness

| Area | Gate |
| --- | --- |
| Seguimiento | Document activity visible and filterable with movement/document feed. |
| Tenant loading | Login/no-tenant/stale tenant/loading states validated globally. |
| Seller experience | Seller dashboard and pages are assigned-only; no create-property CTA. |
| Owner portal | Owner surface has no tenant dependency and no internal actions. |
| Agent assignment | Assign/unassign sellers validates visibility and duplicate safety. |
| Dashboard | Summary ranges remain coherent for 7/14/30 days. |
| Pilot metrics | Pilot metrics dashboard remains usable and tenant-scoped. |
| Docs | Canonical/historical docs are classified before final pilot handoff. |

### P2 — backlog, not pilot-blocking

- reset password and email verification;
- owner archived/finalized views;
- Platform Owner impersonation;
- email delivery/templates;
- advanced reporting/BI;
- custom statuses per agency;
- document download flows;
- realtime notifications via SSE/WebSockets/polling;
- WhatsApp Business API;
- billing/Stripe/Clerk Billing;
- buyers/renters as product users;
- native mobile app;
- AI/chat/marketplace.

## Final coverage matrix

| Area | Current status | Remaining gap | Priority | Evidence required |
| --- | --- | --- | --- | --- |
| Auth / tenant | Mostly implemented | Trial/status/limits operational closure | P0 | API tests + seeded E2E + tenant guard behavior |
| Property engagements | Implemented | Regression proof | P0 | Seeded E2E manager/seller/owner |
| Seller assignment | Implemented | Assignment visibility proof | P1 | API/UI tests + seeded seller scope |
| Movements / Seguimiento | Implemented | Mixed document/movement activity proof | P1 | UI tests + seeded E2E |
| Documents | Mostly implemented | Regression proof, not storage | P0/P1 | Owner upload + manager review + activity evidence |
| Owner invitations | Partial gap | Existing owner acceptance + invite management | P0 | API/UI/E2E |
| Team real | Mostly implemented | UI/evidence + inactive/seller permissions | P1 | API/UI/E2E |
| WhatsApp/contact | Partial | Editable phone config + priority rule | P0 | API/UI tests + click tracking evidence |
| Notifications | Mostly implemented | Full routing/read-unread E2E | P0 | Producer tests + seeded E2E |
| Admin ViewPro | Read-only partial | Status writes, audit, limits, UI | P0 | API/UI/audit tests |
| Hardening | Pending | cleanup, isolation, deploy, smoke | P0 | checklist + full green E2E |
| Slides/deck | Pending | only after proof | P2 until hardening | final pilot deck |

## Execution phases

## Phase 0 — Repo and source-of-truth cleanup

### Slice 0.2 — Clean or classify loose artifacts

```txt
Stage: 0
Slice: 0.2 — Clean or classify loose artifacts
Objective: start final execution from a clean, auditable working tree.
Evidence needed: `git status --short` and decision log for each artifact.
Do not touch: app behavior.
Done: `context/`, `reports/`, untracked Stage 24 docs, and migration `20260603144100` are deleted, archived, or turned into explicit follow-up PRs.
Next slice: 26.0.
```

### Slice 0.3 — Canonical docs classification

```txt
Stage: 0
Slice: 0.3 — Canonical docs classification
Objective: prevent stale template/historical docs from driving future work.
Evidence needed: short docs index that marks canonical, historical, and archived docs.
Do not touch: product code.
Done: final plan and closure plan are marked canonical; stale app-new Clerk/Billing docs are demoted or annotated.
Next slice: 26.0.
```

## Phase 1 — Evidence before new feature work

### Slice 26.0 — Full MVP evidence audit

```txt
Stage: 26
Slice: 26.0 — Full MVP evidence audit
Objective: prove what works and convert failures into a closed P0/P1 gap list before adding risky code.
Evidence needed: report with pass/fail for manager, seller, owner, property, movements, documents, notifications, WhatsApp, team, and admin.
Do not touch: feature implementation unless a smoke test cannot run due to trivial setup/docs issue.
Done: `docs/plans/YYYY-MM-DD-stage-26-0-mvp-evidence-audit.md` exists with P0/P1/P2 findings and the next implementation slice selected.
Next slice: highest P0, expected 21.5 or 25.1 depending audit result.
```

Required audit checklist:

- manager creates/opens property engagement;
- manager assigns seller;
- seller sees only assigned properties and no create-property CTA;
- manager creates movement/status update;
- owner sees read-only property detail and movement timeline;
- manager requests document from owner link;
- owner uploads document;
- manager reads/reviews document;
- approval and rejection both update owner/internal state;
- document activity appears in Seguimiento or is logged as a P1 gap;
- notifications fire for requested/uploaded/approved/rejected/status/movement where supported;
- notification read/unread persists;
- owner notification links never point to dashboard-only routes;
- WhatsApp contact link uses configured tenant/user phone or displays no-config state;
- team member invitations/role/deactivation still work;
- admin read-only pages still work;
- tenant suspended/limit behavior is documented as missing until Stage 25.

## Phase 2 — Owner onboarding closure

### Slice 21.5 — Existing owner accepts another agency/property

```txt
Stage: 21
Slice: 21.5 — Existing owner accepts another agency/property
Objective: let a global owner account accept a new property/agency invitation without conflict or duplicate user creation.
Evidence needed: API tests, UI tests, and seeded acceptance proof for an already-registered owner email.
Do not touch: email delivery, billing, full owner account settings.
Done: existing owner accepts an invite, gains access to the new property/agency, and no longer receives a registered-email conflict.
Next slice: 21.6.
```

Status: completed with API, UI, and seeded E2E evidence in `feat/owner-existing-invite`.

### Slice 21.6 — Minimal owner invitation management

```txt
Stage: 21
Slice: 21.6 — Minimal owner invitation management
Objective: give managers a clear way to regenerate/resend-copy and revoke pending owner invite links.
Evidence needed: API/UI tests for regenerate and revoke; accepted/expired/revoked states remain safe.
Do not touch: email delivery automation or advanced invitation analytics.
Done: manager can regenerate/copy a fresh pending link and revoke a pending link without DB/support help.
Next slice: 25.1.
```

Status: completed in `feat/owner-invitation-management` with API revoke coverage, app-new BFF/service tests, and property owner UI tests for regenerate/copy plus explicit revoke. Evidence includes safe handling for pending, active/accepted, expired, already-revoked, unrelated-owner, and regenerate-after-revoke states without exposing raw token/url from the revoke response.

## Phase 3 — ViewPro Admin operational control

### Slice 25.1 — Admin tenant status write API + audit log

```txt
Stage: 25
Slice: 25.1 — Admin tenant status write API + audit log
Objective: let ViewPro admins activate, suspend, and reactivate tenants without touching DB.
Evidence needed: API tests, global admin guard tests, tenant guard behavior, and audit record verification.
Do not touch: billing, limits, large admin UI, owner/team/document UI.
Done: admin can change tenant status; suspended tenant is blocked by existing guards; every status change is audited.
Next slice: 25.2.
```

Status: completed in `feat/admin-tenant-status-audit` with API evidence for admin-only authorization, `ACTIVE`/`SUSPENDED` policy, `TRIAL -> ACTIVE`, suspension/reactivation, same-status idempotency, unknown tenant handling, tenant guard enforcement, atomic `TENANT_STATUS_CHANGED` audit, and concurrent duplicate-write protection.

### Slice 25.2 — Admin tenant management UI

```txt
Stage: 25
Slice: 25.2 — Admin tenant management UI
Objective: expose minimal tenant operations in app-new for ViewPro admins.
Evidence needed: UI tests for tenant list, status badge, status action confirmation, loading/error states.
Do not touch: limits, billing, impersonation, private tenant content browsing.
Done: ViewPro admin can list tenants and activate/suspend/reactivate them from UI.
Next slice: 25.3.
```

Status: completed in `feat/admin-tenant-management-ui` with app-new `/admin` UI, admin BFF routes that disable tenant header forwarding, status badges/actions for `TRIAL`, `ACTIVE`, and `SUSPENDED`, confirmation dialog, Spanish loading/error/success states, and pnpm UI/service/type/lint evidence.

### Slice 25.3 — Tenant limits model and API

```txt
Stage: 25
Slice: 25.3 — Tenant limits model and API
Objective: configure pilot limits for users/team, active property engagements, and documents/storage.
Evidence needed: schema/migration review, API tests, admin permission tests, default-limit behavior.
Do not touch: billing, paid plans, Stripe, Clerk Billing.
Done: tenant limits are persisted, readable, editable by ViewPro admin, and have safe defaults.
Next slice: 25.4.
```

### Slice 25.4 — Tenant limits enforcement

```txt
Stage: 25
Slice: 25.4 — Tenant limits enforcement
Objective: block actions that exceed tenant limits with clear, recoverable errors.
Evidence needed: tests for property creation, team invitation/member activation, document upload/request/storage limit paths.
Do not touch: billing upgrades or automated plan changes.
Done: exceeded limits block the right actions, return clear messages, and do not corrupt existing data.
Next slice: 23.3.
```

## Phase 4 — Contact and communication closure

### Slice 23.3 — Minimal WhatsApp contact configuration

```txt
Stage: 23
Slice: 23.3 — Minimal WhatsApp contact configuration
Objective: remove DB/seed dependency for tenant and seller WhatsApp phone configuration.
Evidence needed: API/UI tests for editing tenant phone and current-user/seller phone where permitted.
Do not touch: WhatsApp Business API, messaging automation, chat, templates.
Done: a manager/admin can configure tenant contact phone; sellers can have contact phone configured; owner links use the priority rule or show no-config state.
Next slice: 23.4.
```

### Slice 23.4 — Contact priority and tracking proof

```txt
Stage: 23
Slice: 23.4 — Contact priority and tracking proof
Objective: prove owner contact always resolves to the right destination or an explicit no-config state.
Evidence needed: tests for seller phone, tenant phone fallback, missing phone, and click tracking.
Do not touch: Business API or automated reminders.
Done: owner contact is deterministic, trackable, and never fake.
Next slice: 24.5.
```

## Phase 5 — Notification and activity proof

### Slice 24.5 — Notification routing E2E

```txt
Stage: 24
Slice: 24.5 — Notification routing E2E
Objective: prove notification producers, routing, and read/unread state across dashboard and owner surfaces.
Evidence needed: seeded E2E or integration tests for requested/uploaded/approved/rejected/status/movement notifications.
Do not touch: realtime/SSE/WebSockets, cron polling, notification redesign.
Done: owner/internal notifications are created, routed safely, displayed, marked read, and isolated by tenant/surface.
Next slice: 20.9.
```

### Slice 20.9 — Seguimiento document activity proof

```txt
Stage: 20
Slice: 20.9 — Seguimiento document activity proof
Objective: ensure document request/upload/review events are visible where operational users expect them.
Evidence needed: UI/API tests for mixed movement/document feed, filters, URL state, card metadata, manager/seller visibility.
Do not touch: document storage, document panel redesign, new document workflows.
Done: Seguimiento can show movement and document activity with correct permissions and ordering.
Next slice: 22.6.
```

## Phase 6 — Team, seller, and owner operational validation

### Slice 22.6 — Team UI and inactive/seller proof

```txt
Stage: 22
Slice: 22.6 — Team UI and inactive/seller proof
Objective: prove team management is usable in app-new and permissions behave correctly.
Evidence needed: UI tests and seeded E2E for manager, seller, inactive member, pending invitation, resend/revoke if applicable.
Do not touch: billing, bulk import, advanced team analytics.
Done: managers operate team from UI; sellers cannot manage team; inactive members cannot operate.
Next slice: 22.7.
```

### Slice 22.7 — Seller assignment regression proof

```txt
Stage: 22
Slice: 22.7 — Seller assignment regression proof
Objective: prove assignment/unassignment controls the seller experience across dashboard, products, and Seguimiento.
Evidence needed: API/UI/E2E tests for assigned-only visibility and duplicate-safe assignment.
Do not touch: product form refactors or visual redesigns.
Done: seller scope is correct after assignment changes and no unassigned property leaks.
Next slice: 26.1.
```

## Phase 7 — Hardening and deploy readiness

### Slice 26.1 — Template/demo route cleanup

```txt
Stage: 26
Slice: 26.1 — Template/demo route cleanup
Objective: remove or gate starter/template/demo surfaces from production navigation and routes.
Evidence needed: route inventory, screenshots if UI visible, tests or redirects for removed/gated routes.
Do not touch: working product routes or UI redesign.
Done: no fake/starter/template route is visible to pilot users.
Next slice: 26.2.
```

### Slice 26.2 — Deterministic seed contract

```txt
Stage: 26
Slice: 26.2 — Deterministic seed contract
Objective: keep a stable demo/pilot dataset that exercises real business flows.
Evidence needed: seed run logs and smoke proof for manager, seller, owner, properties, images, movements, documents, notifications.
Do not touch: production data behavior.
Done: seed is deterministic, safe, and covers the full product story.
Next slice: 26.3.
```

### Slice 26.3 — Full seeded E2E

```txt
Stage: 26
Slice: 26.3 — Full seeded E2E
Objective: prove the entire pilot workflow in one reproducible suite.
Evidence needed: Playwright/seeded smoke passing in local/CI-compatible mode.
Do not touch: new features unless tests expose a P0 gap.
Done: manager → seller → owner → property → Seguimiento → documents → notifications → WhatsApp → admin status/limits passes.
Next slice: 26.4.
```

### Slice 26.4 — Security and isolation regression

```txt
Stage: 26
Slice: 26.4 — Security and isolation regression
Objective: prove tenant, seller, owner, notification, and document isolation.
Evidence needed: targeted tests for cross-tenant denial, owner access denial, seller unassigned denial, private document URL access, notification surface isolation.
Do not touch: impersonation or admin browsing of private tenant content.
Done: no cross-role or cross-tenant leakage in tested critical paths.
Next slice: 26.5.
```

### Slice 26.5 — Staging/deploy checklist

```txt
Stage: 26
Slice: 26.5 — Staging/deploy checklist
Objective: make deployment reproducible and safe for a real pilot.
Evidence needed: checklist covering env vars, auth, S3/R2 storage, CORS, DB migrations, seed/smoke, backup/restore, rollback, Sentry/observability.
Do not touch: infrastructure provider migration or billing automation.
Done: a new operator can deploy/validate/rollback from the checklist.
Next slice: 26.6.
```

## Phase 8 — Final product narrative

### Slice 26.6 — Pilot-ready deck and slides

```txt
Stage: 26
Slice: 26.6 — Pilot-ready deck and slides
Objective: produce the final presentation using implemented, verified product capabilities.
Evidence needed: screenshots or demo references from the green seeded flow.
Do not touch: product code.
Done: deck explains problem, solution, roles, document flow, Seguimiento, notifications, WhatsApp, admin control, security, and pilot next steps.
Next slice: pilot handoff.
```

Recommended deck outline:

1. Problem for inmobiliarias.
2. ViewPro solution.
3. Roles and permissions.
4. Property engagement flow.
5. Seguimiento flow.
6. Document request/review flow.
7. Owner portal.
8. Notifications and WhatsApp contact.
9. ViewPro Admin and pilot control.
10. Security/isolation.
11. Demo checklist.
12. Pilot rollout plan.

## PR slicing strategy

- One PR per slice by default.
- Keep review load under 300–400 changed lines where possible.
- If a slice touches model/API/UI/E2E, split into chained PRs:
  1. schema/API/tests;
  2. BFF/services/UI/tests;
  3. E2E/docs.
- Every PR needs fresh review before merge.
- Do not commit unrelated dirty/untracked files.

## Execution order summary

1. `0.2` clean/classify loose artifacts.
2. `0.3` classify canonical vs historical docs.
3. `26.0` full MVP evidence audit.
4. `21.5` existing owner accepts another agency/property.
5. `21.6` owner invitation management.
6. `25.1` admin tenant status API + audit log.
7. `25.2` admin tenant management UI.
8. `25.3` tenant limits model/API.
9. `25.4` tenant limits enforcement.
10. `23.3` WhatsApp contact configuration.
11. `23.4` contact priority/tracking proof.
12. `24.5` notification routing E2E.
13. `20.9` Seguimiento document activity proof.
14. `22.6` team UI and inactive/seller proof.
15. `22.7` seller assignment regression proof.
16. `26.1` template/demo route cleanup.
17. `26.2` deterministic seed contract.
18. `26.3` full seeded E2E.
19. `26.4` security/isolation regression.
20. `26.5` staging/deploy checklist.
21. `26.6` pilot-ready deck.

## Scope-control rules

Do not add these unless explicitly approved as post-MVP:

- Billing or paid plans.
- WhatsApp Business API.
- Realtime notifications.
- AI/chat features.
- Buyers/renters as users.
- Mobile app.
- Marketplace.
- Advanced BI/reporting.
- Impersonation.
- Admin access to private tenant document content.
- ProductForm/UI refactors without a failing functional test.

## First executable next step

```txt
Stage: 0
Slice: 0.2 — Clean or classify loose artifacts
Objective: begin final execution from a clean working tree.
Evidence needed: `git status --short`; artifact decision log.
Do not touch: product behavior.
Done: loose artifacts are removed, archived, or converted into explicit PR scope.
Next slice: 0.3 — Canonical docs classification.
```
