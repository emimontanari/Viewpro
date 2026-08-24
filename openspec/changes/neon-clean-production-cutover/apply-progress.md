# Apply Progress: Neon Clean Production Cutover

## Synchronization Scope

This is a planning-progress synchronization only. It merges the full persisted apply-progress history and the preserved failed WU3-Contracts worktree evidence into the approved four-slice replan. Planning/design state changed: `design.md` and the four-slice task plan were regenerated. Implementation, task-checkbox, proposal, specification, source, test, package, lockfile, CI, native, provider, and production state did not change.

## Cumulative Status

- Task plan: 18 total tasks; exactly 2/18 are complete. Only WU1 and WU2 are complete. All WU3 through WU7 and closure tasks remain pending, with existing task checkboxes left untouched.
- Delivery: `sequential-to-develop`. Each approved WU3 slice starts only after its predecessor has a successful review and merge, followed by refreshed `develop`.
- Planning and design gates passed; the 18-task plan was regenerated. This synchronization grants no implementation or native authority.
- Native state is idle: no active objective or attempt, `decision_required: false`, and `next_action: begin`. No new slice has been acquired.

## Completed Foundation History

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data evidence, visible render, zero-I/O idle receipt; reviewed `develop` merge `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`.
- [x] 1.2 **WU2:** #347 implementation merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` and exact remediation-manifest closure. `3212c43…` is closure metadata only, never a runtime patch or base.

## Preserved WU3 Attempt History

- Production reconstruction remains the original prefix `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 + future reviewed WU3–WU7 patches. #338/#341/#344/#351 remain excluded; normal `develop` history is retained.
- **Attempt 5 — WU3 candidate manifest tooling CI:** terminal failed; negative evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`. Focused tests passed 8/8 and typecheck passed 10/10, but a real-worktree audit failed `candidate_tree_invalid`; three fresh reviews failed because the mock-only gate could not audit a reconstructed candidate. The preserved 195-line working diff is historical evidence; no correction was attempted after its complete forecast exceeded the prior review stop.
- **Attempt 6 — WU3a candidate repository/process audit authority:** terminal failed; negative evidence `sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`. Its 307-line diff is non-mergeable historical evidence and must not be copied or salvaged. Focused tests passed 11/11 and typecheck passed, but deterministic attacks reproduced child-lifetime source swap, post-validation config/alternates injection, `core.trustctime=false` same-size-plus-mtime dirtiness bypass, and post-cleanliness mutation.
- **Attempt 7 — WU3 bounded candidate manifest tooling/schema/CI:** terminal failed; negative evidence `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf`. The preserved 229-line candidate in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-clean-production-cutover-wu3-bounded` is historical evidence only; focused candidate tests passed 10/10 and `git diff --check` passed. Qualification is the sole future remediation boundary for this evidence and the sole final-WU3 identity binder.
- **Attempt 8 — WU3-Contracts:** terminal failed; settled evidence `sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`. Preserve the 151-line candidate in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-clean-production-cutover-wu3-contracts` and all review evidence. Its original closed-data validator test cycle was RED `ERR_MODULE_NOT_FOUND`, then GREEN 2/2 for `node --test scripts/production-cutover/candidate.spec.mjs`; runtime harness was N/A because the candidate had no runtime, repository, or network boundary. Three independent reviews returned FAIL: the 2/2 result did not establish the missing exact identity, exception, parser, evidence, remediation, and release-schema contracts. A complete correction forecasts 593 changed lines (174 implementation, 175 tests, 44 configuration, 104 schema, 25 template, 71 progress), above the 260-line cap; no partial correction was attempted.

## Planning Reset and Current Native Admission

- Planning reset revision: `sha256:38f2df20e3592c8278789fe70ca1579fabfeb19ae7586f399b53324ac33dad14`.
- Clean base: `develop@b1e598e3d025539258e176a3e227cf3cb9f133dd`.
- Reset identity: `sha256:38b510759547b914bb4803d6a8525f654b2fd55df08e5ef3190a0edb351703e2` (`38b510…`); reset tree: `2849c127c9893a9cb7580fc2723e2f188ddf56a7` (`2849c127…`).
- The reset preserves attempts 5–8 as history. It does not authorize acquire, reset, settle, implementation, or a successor slice.

## Approved WU3 Four-Slice Sequence

| Slice | Budget | Required predecessor and admission | Direct Node command | Runtime boundary / rollback |
|---|---:|---|---|---|
| Lineage Contracts | 147 / 190 | WU2 reviewed merge → refreshed `develop` → explicit apply authority | `node --test scripts/production-cutover/lineage-contract.spec.mjs` | Isolated/no-network; rollback none |
| Tree/Evidence Contracts | 204 / 250 | Lineage reviewed merge → refreshed `develop` → explicit apply authority | `node --test scripts/production-cutover/tree-evidence-contract.spec.mjs` | Isolated/no-network; rollback Lineage |
| Release Contracts | 242 / 290 | Tree/Evidence reviewed merge → refreshed `develop` → explicit apply authority | `node --test scripts/production-cutover/release-contract.spec.mjs` | Isolated/no-network; rollback Tree/Evidence, then Lineage |
| Qualification | 244 / 270 | Three reviewed merges → refreshed `develop` → explicit apply authority | `node --test scripts/production-cutover/candidate.spec.mjs` | Disposable local audit only; rollback Qualification/CI, then Release, Tree/Evidence, Lineage |

- The sequence is `Lineage → Tree/Evidence → Release → Qualification`, with review, merge, and refreshed-`develop` dependencies between every slice. All slices remain `sequential-to-develop`.
- Lineage owns only immutable ordered prefix/identity closure validation; it has no tree/evidence, release, repository audit, or WU3-identity authority.
- Tree/Evidence owns only byte-level tree/evidence contract validation; it has no lineage semantics or repository/Git/process audit authority.
- Release owns only release/remediation contract validation. Its final reviewed closure is the sole aggregate Contracts remediation of attempt-8 evidence `sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`; it cannot bind final WU3 identity.
- Qualification alone may compose the local audit and direct-Node CI boundary. It is the sole remediation of attempt-7 evidence `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` and the sole final WU3 identity binder; it has no provider or promotion authority.
- No slice has package, lockfile, provider, or populated authoritative-manifest authority. Pure contract slices also have no repository, Git, process, CLI, or CI authority. A committed template remains unpopulated.
- Rollback is strictly reverse dependency order: Qualification/CI → Release → Tree/Evidence → Lineage. Any rollback invalidates final WU3 closure and re-blocks WU4.

## Blocking and Next Action

- WU4 remains blocked until all four WU3 slices are independently reviewed and merged and Qualification closure passes. WU5–WU7 and closure work remain sequentially blocked thereafter.
- Next action: `planning-gate`. Review the regenerated plan and merge it before any explicit apply authorization. Do not acquire a slice or change native state.

## Synchronization Boundaries

- This record grants no implementation, task-completion, native, provider, network, package, lockfile, populated authoritative-manifest, deployment, traffic, production, commit, push, or PR authority.
- No new TDD cycle, test execution, native acquisition, reset, or settlement occurred during this synchronization.
