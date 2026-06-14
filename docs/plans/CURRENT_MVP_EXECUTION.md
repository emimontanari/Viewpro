# Current MVP Execution Handoff

**Current answer:** the next step is **gate G1 — PR #138 seller permission browser revalidation** against the migrated demo seed. Its outcome decides whether Stage `22.8` opens as an immediate P0 hotfix or closes as evidence-only.

Stage `26.2` (Deterministic seed contract) merged via PR #146 (`c7b646c`). The active execution plan is now `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, which adopts the Stage 26.0 audit sub-slices that the 2026-06-04 canonical plan did not include.

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
| In progress | MVP plan reorder (this change). | `openspec/changes/mvp-plan-reorder/` + branch `chore/mvp-plan-reorder`. | Merge before resuming product slices. |
| Next | G1 PR #138 seller permission browser revalidation. | Revised plan Phase A, slice A1. | Run against `martin.demo@viewpro.local` on migrated seed; record pass/fail. |

## Active gates

| Gate | Purpose | Blocks |
|---|---|---|
| G1 | Confirm or refute the audit reproduction that seller sees and operates management controls and can mutate official status. | Promoting `22.8`; opening Phase A4. |
| G2 | Confirm template/starter routes (`dashboard/chat`, `dashboard/kanban`, `dashboard/forms/*`, `dashboard/elements/icons`, `dashboard/react-query`, `dashboard/workspaces`) return 404/redirect for authenticated users. | Closing `26.1` validation reopen. |
| G3 | `pnpm demo:seed` and `pnpm --filter next-shadcn-dashboard-starter test:seeded` green on migrated local DB. | Any slice that adds product behavior to the seed contract. |

## Open product decisions

| # | Decision | Affects | Default if undecided |
|---|---|---|---|
| D1 | Beta ships with seller status mutation, or Cuenta Madre approval gates state changes. | `20.10` priority | Treat as P0 immediate; lift if product rules seller mutation is acceptable for beta. |
| D2 | Manual copy-link acceptable, or transactional email ships now. | `21.7` priority | Treat as backlog; copy-link is the current beta path. |
| D3 | Image limit 5→10 confirmed by product. | `FB-8` small media slice | Treat as backlog until confirmed. |
| D4 | PR #138 guards hold in browser, or the audit reproductions stand. | `22.8` priority | Treat as P0 immediate revalidation; close `22.8` as evidence-only if guards hold. |

## Next slice contract

```txt
Stage: 26
Slice: G1 — PR #138 seller permission browser revalidation
Objective: confirm or refute the audit finding that seller still sees and operates management controls and can mutate official property status.
Evidence needed: browser session as `martin.demo@viewpro.local` against migrated seed; pass/fail per control listed in revised plan, gate G1.
Do not touch: product code unless G1 reproduces a failure, in which case `22.8` opens.
Done: G1 either records a pass (closes D4, `22.8` closes as evidence) or a fail (opens `22.8` immediate P0 hotfix).
Next slice: `22.8` if G1 fails; otherwise A4 G2 PR #140 route revalidation.
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
