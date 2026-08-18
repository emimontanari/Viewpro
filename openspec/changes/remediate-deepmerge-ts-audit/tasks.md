# Tasks: Remediate DeepmergeTS High Advisory

## Review Workload Forecast

| Field | Value |
|---|---|
| Exact PR A diff | 375 additions + 0 deletions; 25 changed-line headroom; PR B: ≤149 independently; total 450–491 planning estimate |
| 400-line budget risk | High; each PR requires an independent recount |
| Chained PRs recommended | Yes |
| Suggested split | PR A planning → PR B remediation/evidence, sequentially to `develop` |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main (PR A then PR B, both to `develop`) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Boundary |
|---|---|---|---|
| 1 | Review and land planning artifacts only | PR A | `develop`; no dependency mutation |
| 2 | Apply, verify, and evidence the scoped remediation | PR B | updated `develop`; independent ≤400-line recount |

## Phase 1: PR A Planning Boundary

- [ ] 1.1 Review only `exploration.md`, `proposal.md`, `specs/dependency-security/spec.md`, `design.md`, and this plan; do not mutate dependencies.
- [ ] 1.2 Commit the planning artifact, open PR A to `develop`, obtain independent review, and merge only after the ≤400-line recount.

## Phase 2: PR B Preflight and Safety Net

- [ ] 2.1 Start PR B from updated `develop`; reproduce the clean baseline `pnpm audit --prod --audit-level high` failure without mutation.
- [ ] 2.2 Capture RED checks rejecting global/Prisma overrides, manual lock edits, vulnerable ancestry, and unrelated lock churn; keep them pending until apply.
- [ ] 2.3 Set the exact PR B candidate budget and stop before any change if its independent additions plus deletions could exceed 400 lines.

## Phase 3: Scoped Resolution and Deterministic Install

- [ ] 3.1 Add only the parent-scoped `@prisma/config@6.19.2>deepmerge-ts` override to `viewpro-app/package.json`; preserve Prisma 6.19.2 and unrelated consumers.
- [ ] 3.2 Run one controlled `pnpm install --lockfile-only --ignore-scripts` from `viewpro-app`; then snapshot/archive/hash ignored generated outputs and record absence before Task 3.3; preserve this rollback input.
- [ ] 3.3 Remove workspace `node_modules` and generated state, then run the clean full `pnpm install --frozen-lockfile` matching CI with pnpm 10.13.1.
## Phase 4: Compatibility, Security, and Safe Runtime Verification

- [ ] 4.1 Require a reviewed `POSTGRES_16_ALPINE_IMAGE` digest; fail closed on port/name or probe/tool/daemon/permission errors; create/protect one unique owned parent directory, reserve unique nonexistent `--cidfile` paths, and trap before startup; let Docker create/reject existing files, then `docker rm -f` only IDs read from files under it and remove those files/directory after absent/partial/interrupted starts.
- [ ] 4.2 Run product and platform Prisma `validate`/`generate` against those databases; prove expected generated outputs and no tracked generated changes.
- [ ] 4.3 Run `typecheck`, `lint`, `build`, and `test` for `@viewpro/api` and `@viewpro/platform-api` using only the owned localhost databases.
- [ ] 4.4 Verify both Prisma ancestry paths resolve only `deepmerge-ts@8.0.1`, preserve Prisma 6.19.2, and leave unrelated consumers unchanged.
- [ ] 4.5 Run exact `pnpm audit --prod --audit-level high` and document the residual two low and three moderate findings without suppression.
- [ ] 4.6 Consume the Task 3.2 preserved snapshots/hashes to prove rollback restores/verifies generated outputs with manifests, lockfile, `7.1.5` ancestry, and merge blocking; require `gitleaks detect --no-git --source openspec/changes/remediate-deepmerge-ts-audit --no-banner` exit 0.
## Phase 5: Evidence, Review, and Issue Sequencing

- [ ] 5.1 Record apply-progress evidence in `apply.md` and exact command/results, skipped checks, rollback proof, and residual risks in `verify.md`.
- [ ] 5.2 Independently review PR B’s boundary, recount, CI-equivalent verification, clean output, rollback, and PR #324 isolation.
- [ ] 5.3 Merge PR B green, then close issue #325; only afterward update and rerun PR #324 from the fixed `develop` base without copying this fix into its diff.
