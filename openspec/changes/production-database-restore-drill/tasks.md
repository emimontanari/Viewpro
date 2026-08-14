# Tasks: Production Database Restore Drill

## Review Workload Forecast — stacked-to-develop

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-develop
400-line budget risk: High

| Slice | Estimated changed lines | Chained PRs recommended | 400-line budget risk | Decision needed before apply |
|---|---:|---|---|---|
| PR2b1 migration contract | 180–230 | Yes | Low | No |
| PR2b2 parity/CLI integration | 165–220 | Yes | Medium | No |
| PR2c authorized operation | 300–389 | Yes | Medium | No |
| Overall chain | 645–839 aggregate; each PR ≤389 | Yes | High | No |

The hard session maximum is 400 changed lines; at 390, stop and re-slice, accepting only ≤389 without exception. `stacked-to-develop`: current merged `develop` → PR2b1/target `develop` → refreshed merged `develop` → PR2b2/target `develop` → refreshed merged `develop` → PR2c/target `develop`. No child targets an unmerged branch. Current diagram: `develop (merged #321) → 📍 PR2a2 split-plan amendment → develop → PR2b1 → develop → PR2b2 → develop → PR2c → develop`; future PR bodies copy it and move the single `📍` to their own slice.

## Phase 1: Historical Boundary
- [ ] PLAN.1 Preserve PR1 #320/PR2a #321 as immutable history; current authority is spec/design/tasks, not combined-RED notes.

## Phase 2: PR2b1 — Pure Migration Contract
- [ ] B1.1 Create/narrow fold/path tests and fixtures, then execute/record focused failing RED for missing, non-directory, traversal, wrong-root, symlink, metacharacter input, physical names, comments/strings, and dynamic SQL.
- [ ] B1.2 Minimal GREEN: create `migration-contract.mjs` with `validateMigrationDirectory`/`foldMigrations`; no subprocess, CLI, package, cloud, runtime, or credential code.
- [ ] B1.3 Verify owned files, secret/diff checks, ≤389 lines, and the current-slice `📍` PR-body diagram; review/merge to `develop` before PR2b2.

## Phase 3: PR2b2 — Parity and Canonical CLI
- [ ] B2.1 Start only after PR2b1 merges; consume stable interfaces/error codes without rewriting `migration-contract.mjs`.
- [ ] B2.2 Create/narrow tests, then execute/record focused failing RED for schema injection, malformed output, spawn/signal/timeout exit 2 with forced cleanup, constant catalog+ledger SQL, startup/DDL isolation, redaction, exits 0/1/2, and 23/6 sets.
- [ ] B2.3 Minimal GREEN: create `schema-parity.mjs` and `restore:parity`; use constant bounded queries, exact filtering, sanitized receipt, and no environment spread/cloud access.
- [ ] B2.4 Verify canonical `pass:true`/exit 0, deterministic `pass:false`/exit 1, sanitized exit 2, lifecycle cleanup, secret/diff checks, ≤389 lines, and the current-slice `📍` diagram.

## Phase 4: PR2c — Fresh Authorized Cycle
- [ ] C.1 Before ANY operation, prove both slices merged; new authorization recorded; exhausted-attempt reset approved and completed; fresh credentials plus fresh targets provisioned and validated; read-only sources; and distinct, allowlisted, empty, compatible, production-denylisted targets.
- [ ] C.2 Run guarded integrity/restore/RPO/RTO/structural/invariant and digest-only cross-lane checks; accept only helper exit 0 plus receipt `pass:true`; retain sanitized aggregate evidence.
- [ ] C.3 Prove teardown/revocation, retain immutable receipts, reconcile within ≤389 lines, and include the current-slice `📍` diagram without rewriting history.
