# Current MVP Execution Handoff

**Current answer:** Phase A is closed. Gates **G1, G2, and G3 all PASS** against the migrated demo seed on 2026-06-14. Decision **D4 is resolved** — PR #138 seller guards and PR #140 route cleanup both hold in browser. Stage `22.8` closes as **evidence-only**, no hotfix code required. The next executable step is **Phase B1 — Stage 26.3 Full seeded E2E**.

Stage `26.2` (Deterministic seed contract) merged via PR #146 (`c7b646c`). Stage `26.2.1` (Visible demo property image fixtures) merged via PR #148 (`5384f05`) so the demo renders real property photos instead of blank tiles while preserving the offline determinism of the 26.2 contract. The active execution plan is `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, which adopts the Stage 26.0 audit sub-slices that the 2026-06-04 canonical plan did not include.

## Source precedence

| Priority | Source | Use it for |
|---|---|---|
| 1 | This handoff | Mutable status ledger and next-slice pointer. |
| 2 | `docs/plans/2026-06-14-mvp-execution-plan-revision.md` | Active execution order, gates, and adopted sub-slices. |
| 3 | `docs/plans/2026-06-04-final-mvp-execution-plan.md` | Canonical anchor: gates, non-goals, slice template. Historical, never rewritten. |
| 4 | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` | Evidence overlay and sub-slice origins. Historical, never rewritten. |
| 5 | `docs/plans/README.md` | Planning index. |
| 6 | Older dated `docs/plans/*` docs | Historical context only unless promoted by sources 1–4 or accepted OpenSpec. |

Unsupported completed/current/next claims are not execution directives. Future product/source changes must go through SDD/OpenSpec before code, seed, migration, test, or runtime-config edits.

## Status ledger

| State | Slice or claim | Evidence | Action |
|---|---|---|---|
| Canonical | 2026-06-04 plan remains the historical anchor. | `docs/plans/2026-06-04-final-mvp-execution-plan.md`. | Do not rewrite. |
| Active plan | 2026-06-14 revision is the active execution order. | `docs/plans/2026-06-14-mvp-execution-plan-revision.md`. | Read it for slice priorities and gates. |
| Evidence overlay | Stage 26.0 audit records pilot-readiness gaps and originates the adopted sub-slices. | `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`. | Use as evidence/correction context. |
| Completed | PR #142 merged MVP execution handoff to `develop`. | `openspec/changes/consolidate-mvp-master-plan/` + merge `a08d318`. | Control-plane baseline. |
| Completed | PR #144 removed billing route for pilot users. | `openspec/changes/stage-26-1-billing-route-cleanup/` + merge `3a7ded3`. | `26.1` code closed; validation gate G2 reopened. |
| Completed | PR #146 merged deterministic seed contract. | `openspec/changes/stage-26-2-deterministic-seed-contract/` + merge `c7b646c`. | `26.2` Done. |
| Completed | PR #147 merged MVP plan reorder. | `openspec/changes/mvp-plan-reorder/` + merge `57623dc`. | Active plan = `docs/plans/2026-06-14-mvp-execution-plan-revision.md`. |
| Completed | PR #148 merged visible demo property image fixtures. | `openspec/changes/26-2-1-visible-demo-property-fixtures/` + merge `5384f05`. | Demo renders real photos; 26.2 determinism preserved. |
| Completed | G1 PASS — PR #138 seller guards hold. | Browser session as `martin.demo@viewpro.local` against migrated seed on 2026-06-14; API `POST /property-engagements/<id>/movements` with `ACTIVE_PUBLICATION` returned `403 Forbidden "Insufficient permissions"`. | `22.8` closes as evidence-only; D4 resolved. |
| Completed | G2 PASS — PR #140 route cleanup holds. | Authenticated probe to `dashboard/chat`, `dashboard/kanban`, `dashboard/forms*`, `dashboard/elements/icons`, `dashboard/react-query`, `dashboard/exclusive` all returned `404`. `dashboard/billing` redirected. `dashboard/workspaces` is a real ViewPro "Inmobiliarias" page, not a starter route. | `26.1` validation reopen closes. |
| Completed | G3 PASS — seed and seeded smoke green. | `pnpm demo:seed` succeeded with the 26.2 contract (`Properties: 20, Images: 60` post-26.2.1). `pnpm --filter next-shadcn-dashboard-starter test:seeded` → 10 passed. | Seed contract verified end-to-end on local Postgres. |
| Next | Stage `26.3` — Full seeded E2E. | Revised plan Phase B, slice B1. | Run the full manager → seller → owner → documents → notifications → WhatsApp → admin choreography in one reproducible suite. |

## Active gates

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS 2026-06-14 | Seller does not see `Nueva propiedad`, `Gestionar vendedores`, `Editar/Archivar propiedad`, `Solicitar documento`, `Invitar propietario`. Status badge is static text, no combobox. API `POST /property-engagements/<id>/movements` as seller returned `403 Insufficient permissions`. |
| G2 | PASS 2026-06-14 | `dashboard/{chat,kanban,forms,forms/simple,elements/icons,react-query,exclusive}` → `404`. `dashboard/billing` → redirect. `dashboard/workspaces` is the real "Inmobiliarias" page, not a starter route. |
| G3 | PASS 2026-06-14 | `pnpm demo:seed` writes the deterministic contract offline (`Properties: 20, Images: 60` post-26.2.1). `pnpm --filter next-shadcn-dashboard-starter test:seeded` → `10 passed` including the owner notifications/images/contacts test. |

## Open product decisions

| # | Decision | Affects | Status |
|---|---|---|---|
| D1 | Beta ships with seller status mutation, or Cuenta Madre approval gates state changes. | `20.10` priority | Pending — default P0 immediate until product decides. |
| D2 | Manual copy-link acceptable, or transactional email ships now. | `21.7` priority | Pending — default backlog (copy-link is current beta path). |
| D3 | Image limit 5→10 confirmed by product. | `FB-8` small media slice | Pending — default backlog until product confirms. |
| D4 | PR #138 guards hold in browser, or the audit reproductions stand. | `22.8` priority | **Resolved 2026-06-14** — guards hold per gate G1; `22.8` closes as evidence-only. |

## Next slice contract

```txt
Stage: 26
Slice: 26.3 — Full seeded E2E
Objective: prove the entire pilot workflow in one reproducible Playwright/seeded suite.
Evidence needed: manager → seller → owner → property → Seguimiento → documents → notifications → WhatsApp → admin status/limits passes locally and stays green.
Do not touch: new features unless tests expose a P0 gap; the 26.2 deterministic seed contract; the 26.2.1 image fixtures.
Done: a single command runs the full choreography against the seeded demo tenant and exits clean.
Next slice: `23.5` Owner contact CTA semantics and priority proof (Phase B4).
```

## Adopted sub-slices from the audit

These are staged in `openspec/changes/` and follow the revised plan order. Each carries an explicit `Status:` line in its proposal.

- `openspec/changes/22-8-seller-permission-hotfix/` — Phase A, gated by D4.
- `openspec/changes/20-10-state-authority-decision/` — Phase A, gated by D1.
- `openspec/changes/23-5-owner-contact-cta-semantics/` — Phase B.
- `openspec/changes/20-11-seguimiento-filter-corrections/` — Phase B.
- `openspec/changes/20-12-document-duplicate-guard/` — Phase B, gated by taxonomy decision.
- `openspec/changes/21-7-transactional-invitation-email/` — Phase D, gated by D2.
- `openspec/changes/26-5a-inmoview-domain-handoff/` — Phase E.
- `openspec/changes/26-6a-inmoview-copy-pass/` — Phase F.

## Update rule

Update this file whenever a slice handoff, validation result, merge, or accepted OpenSpec change changes completed/current/next MVP status. Every status update needs evidence. Do not delete prior revisions of the revised plan; create a new dated revision under `docs/plans/` and update this handoff to point at it.
