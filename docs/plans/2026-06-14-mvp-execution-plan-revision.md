# ViewPro MVP Execution Plan — 2026-06-14 Revision

This revision is the **active execution plan** for ViewPro MVP delivery as of 2026-06-14.

It does not replace `docs/plans/2026-06-04-final-mvp-execution-plan.md`. The 2026-06-04 plan remains the canonical anchor. This revision reorders execution and adopts the sub-slices proposed by the Stage 26.0 audit (`docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`) that were never incorporated into the canonical order.

## Why this revision exists

Between 2026-06-04 and 2026-06-13 the audit reproduced confirmed P0 failures against seeded data (seller permission leak, seller official-state mutation, residual template routes, owner movement contact, missing seeded admin) and proposed eight corrective sub-slices. None were adopted into the canonical execution order. The live handoff continued to point at `26.3` next, ignoring the audit. Stage `26.2` shipped through PR #146 (`c7b646c`) in the meantime, leaving the plan and the codebase out of sync.

This revision closes that gap without rewriting history.

## Source precedence

| Priority | Source | Use it for |
|---|---|---|
| 1 | `docs/plans/CURRENT_MVP_EXECUTION.md` | Mutable status ledger and next-slice pointer. |
| 2 | This document | Active execution order, gates, and adopted sub-slices. |
| 3 | `docs/plans/2026-06-04-final-mvp-execution-plan.md` | Canonical anchor for gates, non-goals, and slice template. Historical and never rewritten. |
| 4 | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` | Evidence overlay and sub-slice origins. Historical and never rewritten. |
| 5 | `docs/plans/2026-06-04-mvp-closure-slices.md` and older dated docs | Historical context unless promoted by source #1, #2, or accepted OpenSpec. |

## Open product decisions

The order below depends on four decisions that this revision surfaces but does not resolve. Until they are recorded, dependent slices remain `decision pending`.

| # | Decision | Affects | Default if undecided |
|---|---|---|---|
| D1 | Does beta ship with sellers able to change official property status, or must Cuenta Madre approve state changes before pilot? | `20.10` priority | Treat as P0 immediate; lift if product rules seller mutation is acceptable for beta. |
| D2 | Is manual copy-link acceptable for beta invitation onboarding, or must transactional email ship now? | `21.7` priority | Treat as backlog; copy-link is the current beta path. |
| D3 | Is the property image limit increase from 5 to 10 confirmed by product, including storage implication? | `FB-8` small media slice | Treat as backlog until confirmed. |
| D4 | Do PR #138 seller permission guards hold in browser today against seeded `martin.demo@viewpro.local`, or did the audit findings reproduce? | `22.8` priority | Treat as P0 immediate browser revalidation; close `22.8` as already-done if guards hold, open the hotfix if they do not. |

## Done — completed slices

These slices are closed with evidence and **must not be reopened** without a confirmed regression.

| Slice | Title | Evidence |
|---|---|---|
| `0.2` | Clean or classify loose artifacts | Canonical plan 2026-06-04, section Phase 0. |
| `0.3` | Canonical docs classification | Canonical plan 2026-06-04, section Phase 0. |
| `21.5` | Existing owner accepts another agency/property | `feat/owner-existing-invite` per canonical plan. |
| `21.6` | Owner invitation management | `feat/owner-invitation-management` per canonical plan. |
| `25.1` | Admin tenant status write API + audit log | `feat/admin-tenant-status-audit` per canonical plan. |
| `25.2` | Admin tenant management UI | `feat/admin-tenant-management-ui` per canonical plan. |
| `25.3` | Tenant limits model and API | Audit confirms complete. |
| `25.4` | Tenant limits enforcement | Audit confirms complete. |
| `26.0` | MVP evidence audit | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`. |
| `26.1` | Template/demo route cleanup (code) | PR #140; **validation gate reopened**, see Active gates. |
| `26.2` | Deterministic seed contract | PR #146 (`c7b646c`). |

## Active gates — block the next slice until resolved

| Gate | What it checks | Required before |
|---|---|---|
| G1 — PR #138 browser revalidation | Sign in as `martin.demo@viewpro.local`; confirm seller does not see `Nueva propiedad`, `Gestionar vendedores`, status comboboxes, `Editar propiedad`, `Archivar propiedad`, `Agregar actualización`, `Solicitar documento`, owner invitation controls. Confirm seller cannot mutate status via the UI or BFF. | Promoting `22.8` or skipping it. |
| G2 — PR #140 route revalidation | Authenticated browser access to `dashboard/chat`, `dashboard/kanban`, `dashboard/forms/*`, `dashboard/elements/icons`, `dashboard/react-query`, `dashboard/workspaces` must return 404, redirect, or be removed. | Closing `26.1` validation reopen. |
| G3 — Seeded smoke against Postgres | `pnpm demo:seed` and `pnpm --filter next-shadcn-dashboard-starter test:seeded` green on the migrated local/dev DB. | Any slice that adds product behavior to the seed contract. |

## Execution order

The order is grouped by phase. Each group runs in sequence; inside a group, slices run in order. Adopted sub-slices are marked with the audit ID for trace.

### Phase A — Hotfix and gate revalidation (audit-driven)

| Order | Slice | Status | Notes |
|---|---|---|---|
| A1 | G1 PR #138 browser revalidation | Pending | Closes D4. |
| A2 | `22.8` — Seller permission and activity-scope hotfix | P0 if G1 fails, else `closed by evidence` | Audit-adopted. See `openspec/changes/22-8-seller-permission-hotfix/`. |
| A3 | `20.10` — State authority decision and change-request workflow | Decision pending (D1) | Audit-adopted. See `openspec/changes/20-10-state-authority-decision/`. If D1 = approval required, runs here; else moved to backlog. |
| A4 | G2 PR #140 route revalidation | Pending | If fails, opens `26.1.fix` slice scoped to the residual routes only. |

### Phase B — Full seeded E2E and product proof (canonical + audit-adopted)

| Order | Slice | Status | Notes |
|---|---|---|---|
| B1 | `26.3` — Full seeded E2E | Pending | Canonical. Runs once Phase A is stable. |
| B2 | `23.3` — Minimal WhatsApp contact configuration | Pending | Canonical. |
| B3 | `23.4` — Contact priority and tracking proof | Pending | Canonical. |
| B4 | `23.5` — Owner contact CTA semantics and priority proof | P0 | Audit-adopted. Covers movement-level `Contacto no configurado` finding. See `openspec/changes/23-5-owner-contact-cta-semantics/`. |
| B5 | `24.5` — Notification routing E2E | P0 | Canonical. Closes owner read/unread reload gap. |
| B6 | `20.9` — Seguimiento document activity proof | Pending | Canonical. |
| B7 | `20.11` — Seguimiento daily workflow corrections | P1 | Audit-adopted. Fixes seller/date/kind filters. See `openspec/changes/20-11-seguimiento-filter-corrections/`. |
| B8 | `20.12` — Document duplicate guard and visibility decision | P1, decision pending (taxonomy) | Audit-adopted. See `openspec/changes/20-12-document-duplicate-guard/`. |

### Phase C — Team and seller proof (canonical)

| Order | Slice | Status | Notes |
|---|---|---|---|
| C1 | `22.6` — Team UI and inactive/seller proof | Pending | Canonical. |
| C2 | `22.7` — Seller assignment regression proof | Pending | Canonical. Confirms G1 outcomes hold under assignment changes. |

### Phase D — Onboarding closure (decision-gated)

| Order | Slice | Status | Notes |
|---|---|---|---|
| D1s | `21.7` — Minimal transactional invitation email delivery | Decision pending (D2) | Audit-adopted. See `openspec/changes/21-7-transactional-invitation-email/`. Promoted only if beta requires real email. |
| D2s | `FB-8` — Property image limit 5→10 | Decision pending (D3) | Not a numbered slice. Adopted only if product confirms with storage review. |

### Phase E — Security and deploy (canonical + audit-adopted)

| Order | Slice | Status | Notes |
|---|---|---|---|
| E1 | `26.4` — Security and isolation regression | Pending | Canonical. |
| E2 | `26.5` — Staging/deploy checklist | Pending | Canonical. |
| E3 | `26.5a` — InmoView domain, branding, and demo handoff | P0 | Audit-adopted. See `openspec/changes/26-5a-inmoview-domain-handoff/`. |

### Phase F — Pilot narrative (canonical + audit-adopted)

| Order | Slice | Status | Notes |
|---|---|---|---|
| F1 | `26.6a` — InmoView copy and role-language pass | P1/P2 | Audit-adopted. Vendedor / Encargado / Cuenta Madre copy. See `openspec/changes/26-6a-inmoview-copy-pass/`. |
| F2 | `26.6` — Pilot-ready deck and slides | Pending | Canonical. Runs last. |

## Slice contract — non-negotiable

Inherited verbatim from the canonical plan. Every implementation slice and every PR must declare:

```txt
Stage:
Slice:
Objective:
Evidence needed:
Do not touch:
Done:
Next slice:
```

## Scope-control rules

Inherited verbatim from the canonical plan, section *Scope-control rules*. The revision does **not** loosen any backlog exclusion. Billing, paid plans, WhatsApp Business API, realtime notifications, AI/chat, mobile, marketplace, advanced BI, impersonation, admin browsing of private tenant content, and ProductForm/UI refactors without a failing functional test remain out of scope.

## PR slicing strategy

Inherited from the canonical plan. One PR per slice by default; 300–400 changed-line target; split into chained PRs when schema/API/UI/E2E mix. Fresh review before every merge.

## First executable next step

```txt
Stage: 26
Slice: G1 — PR #138 seller permission browser revalidation
Objective: confirm or refute the audit finding that seller still sees and operates management controls and can mutate official property status.
Evidence needed: browser session as `martin.demo@viewpro.local` against migrated seed; pass/fail per control listed in G1.
Do not touch: product code unless G1 reproduces a failure, in which case `22.8` is opened.
Done: G1 either records a pass (closes D4, `22.8` closes as evidence) or a fail (opens `22.8` immediate P0 hotfix).
Next slice: `22.8` if G1 fails; otherwise A4 G2 PR #140 route revalidation.
```

## Update rule

Update this file whenever a slice handoff, validation result, merge, or accepted OpenSpec change changes the active execution order. Every status update needs evidence. Do not delete prior revisions; create a new dated revision doc and update `CURRENT_MVP_EXECUTION.md` to point at it.
