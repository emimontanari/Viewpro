# Design — MVP Plan Reorder

## Approach

Treat the reorder as a docs-only control-plane change, executed in three layers that are reviewable independently:

1. **Anchor layer.** A new dated revision doc (`2026-06-14-mvp-execution-plan-revision.md`) becomes the active execution plan. It references the 2026-06-04 canonical plan as source and explicitly does not replace it.
2. **Pipeline layer.** Eight new OpenSpec change folders with `proposal.md` stubs stage the audit-proposed sub-slices for future SDD work. They carry `status: proposed` until product decides their priority.
3. **Routing layer.** `CURRENT_MVP_EXECUTION.md` and `docs/plans/README.md` are updated to point at the revision doc, mark already-merged slices as Done with evidence, and reopen the `26.1` validation gate.

## Why three layers

- Anchor and pipeline are independent units. The revision plan can ship even if some sub-slice stubs are deferred. Sub-slice stubs can be deleted later if product decides against them, without rewriting the plan.
- Routing changes are tiny and high-blast-radius — every future agent reads them — so they belong in a separate commit so review can focus on routing accuracy.

## Slice adoption rules

Each audit-proposed sub-slice is adopted into the revised plan with a fixed shape:

| Field | Rule |
|---|---|
| `priority` | One of `P0 confirmed`, `P0 if decision`, `P1`, `P2`, `decision pending`. |
| `depends on decision` | Reference to one of the four open product decisions, if any. |
| `gate` | What evidence closes the slice; usually browser reproduction against seeded data. |
| `do not touch` | Inherited verbatim from the audit slice contract. |

Sub-slices with `depends on decision` cannot be promoted to `P0 confirmed` until the user records the decision. Until then the revised plan lists them in their probable order but flags them visually.

## Already-merged slices

Marked Done with the merge commit short SHA and PR number recorded in the revised plan, no further action. These are: `0.2`, `0.3`, `21.5`, `21.6`, `25.1`, `25.2`, `25.3`, `25.4`, `26.1` (with reopened validation gate), `26.2`.

## 26.1 validation reopening

The audit reproduced template routes still reachable after PR #140. Rather than create `26.1.b`, the revised plan keeps `26.1` Done by code but adds a validation sub-task: browser proof that `dashboard/chat`, `dashboard/kanban`, `dashboard/forms/*`, `dashboard/elements/icons`, `dashboard/react-query`, and `dashboard/workspaces` are removed or 404/redirect for an authenticated user. If revalidation fails, a `26.1.fix` slice opens; if it passes, the reopened gate closes immediately.

## Non-goals

- No spec layer. This is a docs-only reorder; there are no testable runtime requirements to encode in `specs/`.
- No automation of plan generation. Future plan revisions remain hand-authored from evidence.
- No retroactive renaming of slice numbers. The audit numbers (`22.8`, `20.10`, etc.) are kept as-is so trace from audit to slice is direct.

## Rollout

Single PR to `develop` containing:

1. `openspec/changes/mvp-plan-reorder/` (this change folder).
2. `docs/plans/2026-06-14-mvp-execution-plan-revision.md` (new revision).
3. `docs/plans/CURRENT_MVP_EXECUTION.md` and `docs/plans/README.md` (routing updates).
4. Eight sub-slice stubs in `openspec/changes/`.

Estimated changed lines: well under the 400-line budget per `openspec/config.yaml`, even with eight stubs, because each stub is a small proposal file. No code, no tests, no migrations.

## Validation

Manual cross-reference pass before commit:

- Every slice referenced in `CURRENT_MVP_EXECUTION.md` exists in the revised plan.
- Every adopted sub-slice in the revised plan has a stub folder in `openspec/changes/`.
- Every `Done` slice has a PR or commit reference.
- Every `decision pending` slice points at the right open decision.
- `README.md` lists the revision plan as active and keeps the 2026-06-04 canonical plan as historical.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Plan drift between revision doc and handoff | Cross-reference pass at Task #6 reads both end to end. |
| Sub-slice stubs interpreted as approved scope | Each stub starts with `Status: proposed, awaiting product decision`. |
| Reopening `26.1` interpreted as code-level reopen | Revised plan and handoff state explicitly that the reopen is a browser revalidation only. |
| Future agents bypass the revision doc | Source precedence in the handoff and README is reordered so the revision doc is priority 2 right after the handoff. |
