# Tasks: Neon Clean Production Cutover

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,391–2,641 total; WU3a ~344; WU3b ~182 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | WU3a PR → WU3b PR; both target `develop` |
| Delivery strategy | force-chained/sequential-to-develop |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Table and guard lines are metadata; only `sequential-to-develop` routes. The token is non-operational: no PR targets `main` or a parent branch. Split approval is complete via the maintainer interactive decision and Engram #8114; native reset is phase-scoped. WU3b follows WU3a review/green CI/merge/fetch/audit; WU4 waits for WU3b. Reviewed WU3a/WU3b patches join candidate identity; exclusions and no-provider/no-populated-manifest authority remain.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| WU3a | Candidate repository/process/real-audit authority | WU3a | Then-live `origin/develop`; review/CI/merge; revert WU3a files |
| WU3b | Closed remediation/release schema, template, tree/path/dependency classification | WU3b | Clean `origin/develop` after WU3a merge; review/CI/merge; revert WU3b extension |

## Phase 1: Completed Foundation

- [x] 1.1 **WU1 (320–350):** Preserve RED→GREEN platform-sync/tenant/platform-data evidence, visible render, and zero-I/O idle receipt.
- [x] 1.2 **WU2 (300–340):** Preserve reviewed merge `d53a57c…`, closure metadata `3212c43…`, and exact remediation manifest gate.

## Phase 2: Candidate Slices

- [ ] 2.1a **WU3a (~344; target/stop 350, native max 390):** RED→GREEN `candidate.mjs`/baseline spec, justified root `package.json`, root-importer lock entries, additive CI, canonical repo/resolved Git, detached identity, porcelain-v2 `-z`, scrubbed env, and bounded TERM→KILL cleanup; prove RED-CUT-01/02/04 with real repositories/processes. No reset/acquire/settle occurs in this planning PR.
- [ ] 2.1b **WU3b (~182; target/stop 350, native max 390):** After WU3a merge, RED→GREEN NUL tree parsing, path/dependency/#314/excluded-patch classification and closed remediation/release validation; add only `release-manifest.v1.schema.json` and unpopulated template; prove RED-CUT-03. Do not alter WU3a authority.
- [ ] 2.2 **WU4 (330–350):** After WU3b review/CI/merge, implement receipt/checkpoint tooling and schema for RED-CUT-05–07, JCS redaction, and fail-closed generation/digest/state bindings.

## Phase 3: Fresh Lanes

- [ ] 3.1 **WU5 (320–350):** Implement roles/bootstrap specs for RED-CUT-09–11, grants, allowlists, readiness, and acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** Implement backup-lineage tooling/spec and workflow for RED-CUT-08, heartbeat/pruning receipts, and one-month retention.

## Phase 4: Cutover and Lifecycle

- [ ] 4.1 **WU7 (330–350):** Implement session tests, runbook, evidence templates, and RED-CUT-12/13 receipt; emit identity only, never an instance.
- [ ] 5.1 Keep provider qualification read-only.
- [ ] 5.2 Assemble the provisional candidate only after WU7, read-only.
- [ ] 5.3 Close the external manifest and reproduce identities/digests independently.
- [ ] 5.4 Require fresh single-use provisioning authorization.
- [ ] 5.5 Require fresh single-use activation with backend-first order.
- [ ] 5.6 Collect #327 D.5 evidence for ≥24h.
- [ ] 5.7 Verify/archive #327 and open the internal-pilot gate.
- [ ] 5.8 Verify/archive cutover after one-month evidence/retention.

Strict TDD records RED/GREEN, review/CI, and native admission separately. No native reset/acquire/settle occurs here. After merge, WU3a uses a fresh then-live `origin/develop` worktree plus maintainer-authorized reset/acquire; settle follows strict TDD, fresh 3-lens review, and final evidence. WU3b gets its own clean reset/acquire after WU3a merges.
