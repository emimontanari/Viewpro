# Current MVP Execution Handoff

**Last updated:** 2026-06-23.

**Current answer:** the project is still in **100% development mode**. There is no pilot deadline, no demo-to-sell pressure, and no deploy clock. Since the dev-mode reframe, the `24.5` notification routing E2E proof and the full `24.6` notification deep-linking bundle (a/b/c) all landed. **D5 was resolved on 2026-06-23**, unblocking the last development slice:

1. `20.12` — Document duplicate guard (**unblocked** — D5 canonical taxonomy approved; ready for `sdd-spec`).

After `20.12` ships, the development queue is closed and the project reaches the decision point the plan reserves for development completion: create a new handoff revision that reopens deploy planning.

Deploy, architectural scalability prep, external service integration, and the pilot-ready deck remain explicitly deferred until the development queue is closed or the user reopens deploy planning.

**Active phase:** development.
**Current base:** `develop` at `99fcfc2` / PR #179.
**Next active slice:** `20.12` — Document duplicate guard (D5 resolved; ready for `sdd-spec`).

## Source precedence

| Priority | Source | Use it for |
|---|---|---|
| 1 | This handoff | Mutable status ledger and next-slice pointer. |
| 2 | `docs/plans/2026-06-14-mvp-execution-plan-revision.md` | Active execution plan and gate definitions. |
| 3 | `docs/plans/2026-06-04-final-mvp-execution-plan.md` | Canonical anchor: gates, non-goals, slice template. Historical, never rewritten. |
| 4 | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` | Evidence overlay and origin of the adopted sub-slices. Historical, never rewritten. |
| 5 | `docs/plans/README.md` | Planning index. |
| 6 | Older dated `docs/plans/*` docs | Historical context only unless promoted by sources 1–4 or accepted OpenSpec. |

Unsupported completed/current/next claims are not execution directives. Future product/source changes must go through SDD/OpenSpec before code, seed, migration, test, or runtime-config edits.

**Artifact caveat:** individual OpenSpec proposal `Status:` lines can be historical. For current execution status, trust this handoff first, then merge evidence and apply-progress artifacts.

## What changed since the dev-mode reframe

This update does **not** introduce a new roadmap. It reconciles the dev-mode queue created by PR #164 with the merge history through PR #175.

The previous handoff still pointed at `26.6a` as next. Git first-parent history now proves these development slices have merged after PR #163:

| Slice | Merge evidence | Result |
|---|---|---|
| `26.6a` — InmoView copy and role-language pass | PR #165 / `a40ea51` | User-facing role labels updated to real-estate vocabulary in the targeted UI surfaces. |
| `20.11` — Seguimiento filter corrections | PR #167 / `8c4a366` | Timezone/date parsing and Responsable filter semantics fixed with strict TDD evidence. |
| `20.9` — Seguimiento document activity proof | PR #169 / `6962c0f` | Document-request lifecycle proof added to activity feed, use cases, seed, and smoke coverage. |
| `23.3` — WhatsApp tenant contact configuration | PR #171 / `537a426` | Tenant WhatsApp GET/PATCH API, settings UI, validation, and seeded round-trip shipped. |
| `23.5` — Owner contact CTA semantics | PR #173 / `0858752` | Owner movement contact now resolves to assigned seller semantics, with backend/frontend/seeded proof. |
| `23.4` — WhatsApp contact priority and tracking proof | PR #175 / `c1aea0f` | Contact tracking guards and seeded movement-level WhatsApp proof completed. |

Supporting SDD/documentation PRs also landed for those slices: #166, #168, #170, #172, and #174.

## Status ledger

| State | Slice or claim | Evidence | Action |
|---|---|---|---|
| Canonical | 2026-06-04 plan remains the historical anchor. | `docs/plans/2026-06-04-final-mvp-execution-plan.md`. | Do not rewrite. |
| Active plan | 2026-06-14 revision is the active execution order. | `docs/plans/2026-06-14-mvp-execution-plan-revision.md`. | Read for slice priorities and gates. |
| Evidence overlay | Stage 26.0 audit records pilot-readiness gaps. | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`. | Use as evidence/correction context. |
| Completed | Phase A gates G1/G2/G3 all PASS; 22.8 closed by evidence. | PR #149. | D4 resolved. |
| Completed | MVP plan reorder adopted Stage 26.0 audit sub-slices. | PR #147. | Active plan = 2026-06-14 revision. |
| Completed | Stage 26.1 template/demo route cleanup. | PR #140 + #144 (billing route gated). | G2 PASS. |
| Completed | Stage 26.2 deterministic seed contract. | PR #146 (`c7b646c`). | Seed contract in place. |
| Completed | Stage 26.2.1 visible demo property image fixtures. | PR #148 (`5384f05`). | Demo renders real photos. |
| Completed | Stage 20.13 movement outcomes + custom tenant labels. | PR #152 (PR 1) + #155 (PR 2 recovery). | Sellers label movements operationally without moving official state. |
| Completed | Stage 20.10 state change request workflow. | PR #157 (PR 1 schema+API+tests) + #158 (PR 2 BFF+UI+bandeja+smoke). | Seller proposes, manager approves; API 403 guard preserved. |
| Completed | Owner invitation expiry test stability fix. | PR #159. | Closes the 14-day expiry time bomb introduced by the deterministic seed clock. |
| Completed | Stage 26.3 full seeded E2E. | PR #161. | Full pilot choreography reproducible from one command. |
| Completed | Stage 26.4 security and isolation regression. | PR #163. | 13 API negative tests + 2 seeded UI tests; sanity-inversion proven. |
| Completed | Stage 26.6a InmoView copy and role-language pass. | PR #165 (`a40ea51`), 13 files / +27 / -27. | Copy pass landed; no enum/schema/security rename. |
| Completed | Stage 20.11 Seguimiento daily workflow corrections. | PR #167 (`8c4a366`), apply-progress complete; API 659/659, app 403/403, seeded 25/25. | Responsable/date filter bugs closed. |
| Completed | Stage 20.9 Seguimiento document activity proof. | PR #169 (`6962c0f`), apply-progress complete; API 665/665, app 419/419, seeded 27/27. | Document lifecycle visibility proof landed. |
| Completed | Stage 23.3 WhatsApp tenant contact configuration. | PR #171 (`537a426`), apply-progress Phase 7 GREEN; API 702/702, app 426/426, seeded 28/28. | Tenant WhatsApp editor and round-trip shipped. |
| Completed | Stage 23.5 owner contact CTA semantics. | PR #173 (`0858752`), Phase 7 GREEN; backend 713/713, frontend 426/426, seeded 29/29. | Owner movement contact resolves to assigned seller. |
| Completed | Stage 23.4 WhatsApp contact priority and tracking proof. | PR #175 (`c1aea0f`), Phase 6 GREEN; API 715/715, app 430/430, seeded 30/30. | WhatsApp bundle closed end-to-end. |
| Completed | Stage 24.5 Notification routing E2E. | PR #176 (`94fd146`), archived `e310cb4`. | Owner/internal notification routing, links, and read/unread persistence proven under seeded E2E. |
| Completed | Stage 24.6a Notification deep-linking: owner document notifications. | PR #177 (`d947496`), archived `461f278`. | DOCUMENT_REQUESTED/APPROVED/REJECTED deep-link to the exact owner document. |
| Completed | Stage 24.6b Notification deep-linking: internal document-uploaded. | PR #178 (`47faa2d`), archived `321497b`. | Internal DOCUMENT_UPLOADED deep-links to the exact document on the product page. |
| Completed | Stage 24.6c Notification deep-linking: owner PROPERTY_STATUS_CHANGED. | PR #179 (`99fcfc2`). | Owner status-change notification deep-links to the movement timeline with scroll/highlight. |
| Next | Stage 20.12 — Document duplicate guard and visibility decision. | `openspec/changes/20-12-document-duplicate-guard/proposal.md`; D5 resolved 2026-06-23. | Unblocked — ready for `sdd-spec`. Only remaining unshipped slice. |

## Active gates

Phase A gates all PASSED on 2026-06-14 and are kept here for traceability. Latest seeded smoke evidence has since increased from the original 24/24 baseline to 30/30 after PR #175.

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS 2026-06-14 | Seller does not see flagged management controls. API direct call returns `403 Insufficient permissions`. Later security/isolation and WhatsApp slices preserved this. |
| G2 | PASS 2026-06-14 | `dashboard/{chat,kanban,forms,forms/simple,elements/icons,react-query,exclusive}` → `404`. `dashboard/billing` → redirect. |
| G3 | PASS 2026-06-14; latest smoke 30/30 by PR #175 | `pnpm demo:seed` clean offline; `test:seeded` baseline grew as evidence slices landed. Latest recorded result: Stage 23.4 seeded smoke 30/30 GREEN. |

## Open product decisions

| # | Decision | Affects | Status |
|---|---|---|---|
| D1 | Beta ships with seller status mutation, or Cuenta Madre approval gates state changes. | `20.10` priority | **Resolved 2026-06-14** — approval workflow shipped via 20.10. |
| D2 | Manual copy-link acceptable, or transactional email ships now. | `21.7` priority | **Deferred** — no email provider work scheduled while in development mode. |
| D3 | Image limit 5→10 confirmed by product. | `FB-8` small media slice | Pending — default backlog until product confirms with storage implications. |
| D4 | PR #138 guards hold in browser, or the audit reproductions stand. | `22.8` priority | **Resolved 2026-06-14** — guards hold per gate G1; `22.8` closes as evidence-only. |
| D5 | Document type taxonomy and synonym map. | `20.12` document duplicate guard | **Resolved 2026-06-23** — canonical taxonomy + synonym map + guard rules approved (see `openspec/changes/20-12-document-duplicate-guard/proposal.md`). 20.12 unblocked for `sdd-spec`. |

## Phase ordering — development first, deploy at the end

Project is in **development mode**. The eight audit-adopted product slices were selected by the 2026-06-14 revision. Six are now closed; two remain.

### Closed development slices

| Order | Slice | Evidence |
|---:|---|---|
| 1 | `26.6a` — Copy pass (Vendedor / Encargado / Cuenta Madre) | PR #165. |
| 2 | `20.11` — Seguimiento daily workflow corrections | PR #167. |
| 3 | `20.9` — Seguimiento document activity proof | PR #169. |
| 4 | `23.3` — WhatsApp tenant contact configuration | PR #171. |
| 5 | `23.5` — Owner contact CTA semantics | PR #173. |
| 6 | `23.4` — WhatsApp contact priority and tracking proof | PR #175. |

### Remaining development queue

```
7. 24.5   Notification routing E2E                         ← DONE (PR #176)
   24.6a  Deep-link owner document notifications           ← DONE (PR #177)
   24.6b  Deep-link internal document-uploaded             ← DONE (PR #178)
   24.6c  Deep-link owner PROPERTY_STATUS_CHANGED          ← DONE (PR #179)
8. 20.12  Document duplicate guard                          ← BLOCKED on D5 taxonomy (only slice left)
```

Execution notes:

- `24.5` shipped (PR #176) and was followed by the `24.6` deep-linking bundle (a/b/c, PRs #177/#178/#179), which wires notification click-through to the exact document/movement. These were added after the 2026-06-19 revision and are now all merged.
- `20.12` is the only remaining unshipped slice. **D5 resolved 2026-06-23** — the canonical taxonomy, synonym map, and guard rules are approved (see the 20.12 proposal). The slice is unblocked and ready for `sdd-spec`.

### Reconciliation with older canonical phases

Older canonical plans still contain `22.6` (team UI/inactive/seller proof) and `22.7` (seller assignment regression proof). They are **not promoted as active next slices by this handoff** because PR #164 intentionally reframed the immediate development queue around the eight audit-adopted slices above, and later proof already covers the critical seller-assignment/isolation paths:

- `26.3` added seeded manager assign/unassign seller coverage via `Gestionar vendedores`.
- `26.4` added seller unassigned API/UI denial and security/isolation regression coverage.

Do not silently reopen `22.6` or `22.7`. Reopen a focused follow-up only if a fresh failing gate proves an uncovered team/inactive/seller behavior.

### Deferred until development complete

These slices stay in the plan but **do not run** until `24.5` and the `20.12` decision path are closed or explicitly re-prioritized by the user.

```
26.5    Staging / deploy checklist
26.5a   InmoView domain handoff
        Architectural scalability prep (multi-user, service integration)
        External services wiring (Sentry, S3/R2 verification, email provider, etc.)
26.6    Pilot-ready deck
21.7    Transactional invitation email delivery (deferred by D2)
FB-8    Property image limit 5→10 (deferred by D3)
```

When development is complete, create a new handoff revision that explicitly reopens deploy planning.

## Next slice contract

```txt
Stage: 24
Slice: 24.5 — Notification routing E2E
Objective: prove owner/internal notification routing, links, and read/unread persistence under seeded E2E conditions.
Evidence needed: audit existing API/BFF/unit notification coverage; add or confirm seeded owner/internal notification flow; prove notification appearance, click-through, mark-read, and reload persistence; prove owner notifications do not route into dashboard surfaces.
Do not touch: realtime notifications, SSE/WebSockets, cron polling, push/email providers, broad notification redesign, deploy/runtime configuration, or unrelated dashboard navigation.
Done: the Stage 26.0 notification routing/read-unread evidence gap is closed with deterministic tests/evidence, and the PR description traces the audit gap.
Next slice: 20.12 — Document duplicate guard, only after D5 taxonomy is resolved.
```

## Adopted sub-slices from the audit

Current state by change:

- `openspec/changes/26-6a-inmoview-copy-pass/` — **completed/merged** via PR #165.
- `openspec/changes/20-11-seguimiento-filter-corrections/` — **completed/merged** via PR #167.
- `openspec/changes/20-9-seguimiento-document-activity-proof/` — **completed/merged** via PR #169.
- `openspec/changes/23-3-whatsapp-tenant-contact-configuration/` — **completed/merged** via PR #171.
- `openspec/changes/23-5-owner-contact-cta-semantics/` — **completed/merged** via PR #173.
- `openspec/changes/23-4-whatsapp-contact-priority-tracking/` — **completed/merged** via PR #175.
- `openspec/changes/24-5-notification-routing-e2e/` — **completed/merged** via PR #176.
- `openspec/changes/24-6a-notification-deeplink-owner-documents/` — **completed/merged** via PR #177.
- `openspec/changes/24-6b-notification-deeplink-internal-documents/` — **completed/merged** via PR #178.
- `openspec/changes/24-6c-notification-deeplink-owner-movement/` — **completed/merged** via PR #179.
- `openspec/changes/20-12-document-duplicate-guard/` — **proposal exists, blocked on D5 taxonomy**. Only remaining unshipped slice.

Deferred until development complete:

- `openspec/changes/26-5a-inmoview-domain-handoff/` — proposal exists; do not run.
- `openspec/changes/21-7-transactional-invitation-email/` — proposal exists; do not run unless D2 changes.

## Update rule

Update this file whenever a slice handoff, validation result, merge, blocker decision, or accepted OpenSpec change changes completed/current/next MVP status. Every status update needs evidence. Do not delete prior revisions of the revised plan; create a new dated revision under `docs/plans/` only when the execution plan itself changes, then update this handoff to point at it.
