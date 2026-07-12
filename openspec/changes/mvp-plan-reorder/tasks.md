# Tasks — MVP Plan Reorder

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 350–500 docs-only |
| 400-line budget risk | Low–medium |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Decision needed before apply | No (product decisions surface in the revised plan, not in apply) |

## Tasks

- [x] Create `openspec/changes/mvp-plan-reorder/` with proposal, design, and this tasks file.
- [ ] Draft `docs/plans/2026-06-14-mvp-execution-plan-revision.md` adopting the eight audit-proposed sub-slices, marking already-merged slices Done with evidence, and reopening the `26.1` validation gate.
- [ ] Create eight sub-slice stub folders under `openspec/changes/` with `proposal.md` for `22.8`, `20.10`, `20.11`, `20.12`, `23.5`, `21.7`, `26.5a`, `26.6a`. Each stub starts with `Status: proposed, awaiting product decision` and references its open decision if any.
- [ ] Update `docs/plans/CURRENT_MVP_EXECUTION.md`: mark Stage 26.2 Done with PR #146 evidence, reopen the `26.1` validation gate, set source precedence to point at the revised plan, list the four open product decisions and the next-slice rule.
- [ ] Update `docs/plans/README.md`: add the revised plan as active source while keeping the 2026-06-04 canonical plan as historical anchor.
- [ ] Cross-reference pass: every slice referenced in the handoff exists in the revised plan; every adopted sub-slice has a stub folder; every `Done` slice has a PR/commit; every `decision pending` slice points at the right open decision.
- [ ] Commit by work-unit on `chore/mvp-plan-reorder` (openspec change → revision plan + routing → sub-slice stubs) and open PR to `develop`.

## Acceptance

- [ ] A new session opening `docs/plans/CURRENT_MVP_EXECUTION.md` identifies the same next slice as the revised plan recommends.
- [ ] Every audit-confirmed P0 (`22.8`, residual `26.1` routes, `23.5` movement contact, missing seeded admin already absorbed by `26.2`, `26.5a`) maps to a slice in the revised order with a defined gate.
- [ ] All ten already-merged slices are marked Done with PR/commit evidence and are not reopened.
- [ ] The four open product decisions (`20.10` state authority, `21.7` email, `FB-8` image limit, `PR #138` revalidation) are visible in both the proposal and the revised plan.
- [ ] No content edits or deletions to `2026-06-04-final-mvp-execution-plan.md`, `2026-06-08-stage-26-0-mvp-evidence-audit.md`, `2026-06-04-mvp-closure-slices.md`, or any older dated planning doc.
- [ ] Eight sub-slice stub folders exist under `openspec/changes/` with `proposal.md` and a clear `Status: proposed, awaiting product decision` line.
