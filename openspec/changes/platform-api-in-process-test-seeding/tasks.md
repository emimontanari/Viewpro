# Tasks: Platform API In-Process Test Seeding

## Review Workload Forecast

| Slice | Lines | State / scope |
|---|---:|---|
| PR0 | 352 measured | Merged planning baseline; retain history |
| PR1 | 192 measured | Merged fixture/foundation |
| PR2 | 279 refined | Consumers + retry only |
| PR3 | 160–230 forecast | Readable AST ratchet, regressions, final acceptance |
| Implementation total | **631–701** | PR1+PR2+PR3; each PR <400 |
| Including PR0 | **983–1,053** | Honest total review cost |

delivery_strategy: auto-chain (user-approved sequential slices)
chain_strategy: stacked-to-main (integration branch: develop)
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
size:exception: not approved or required

### Delivery Topology

- **PR0:** #313 merged planning baseline; retain history.
- **PR1:** #314 merged fixture/foundation.
- **PR2:** `fix/platform-api-test-consumers` owns exactly all 14 consumer migrations/15 app-context calls, eight helper/seven direct-site removals, and command-scoped retry control. It excludes `operator-fixture-boundary.spec.ts`, final uncached acceptance, and #311 reconciliation.
- **PR3:** `test/platform-api-seed-boundary` starts from refreshed `develop` only after PR2 merges. It owns the complete readable Node16 AST dependency/ownership ratchet, fail-closed regressions, and first corrected-byte uncached zero-retry acceptance with `PLATFORM_CONTROL_SETUP_MS <20,000`. Its final acceptance and merge trigger explicit #311 reconciliation.
- No tracker or exception. Rollback is PR3→PR2→PR1; retain PR0. Historical failed, contaminated, pre-correction, or invalid PR2 receipts are non-acceptance evidence.

Branch graph: merged PR0 → merged PR1 → PR2 → refreshed `develop` → PR3 → explicit #311 reconciliation.

## Completed Baseline

- [x] 1.1 PR0 merged as #313 into `develop`.
- [x] 1.2 PR1 fixture/foundation merged as #314 into `develop` with behavioral fixture coverage.
- [x] 1.3 Inventory fixed at 14 specs/15 context calls, eight helpers/seven direct sites; production seed contract retained.

## PR2: Consumers and Retry

- [x] 2.1 Migrate all 14 specs/15 app contexts post-init and pre-login, including both step-up contexts and both tenant-detail contexts.
- [x] 2.2 Remove production-seed subprocess helpers/direct sites while preserving roles/statuses/passwords and named assertions.
- [x] 2.3 Add only command-scoped retry control; default remains 2 and timeout/Turbo/schema/API/runtime/seed remain unchanged.
- [x] 2.4 Prepare and approve the PR3 split contract without changing implementation source, test, or acceptance-task completion.
- [ ] 2.5 Deliver and merge the PR2 consumers/retry slice; #311 remains open.

## PR3: Boundary and Final Acceptance

- [ ] 3.1 Refresh `develop` after PR2 merge and create `test/platform-api-seed-boundary`.
- [ ] 3.2 RED: with the migrated 14-consumer inventory as GREEN baseline input, add source-only regressions for `Deno.Command` new expressions, `ImportEquals`, unresolved/escaping local edges, wrong-context/before-init/after-request calls, alias/type-only/unused/shadowed/wrapper-only bindings, and colocated-spec exclusion.
- [ ] 3.3 GREEN: implement the complete readable `operator-fixture-boundary.spec.ts` to lock the migrated inventory and fail closed for every PR3 RED regression; no opaque compression and no weakened AST contract.
- [ ] 3.4 Run focused boundary, unchanged seed contract, platform-control 37, validation/typecheck, and full platform-api serially; report baseline plus `Δnew`.
- [ ] 3.5 Run the first corrected-byte uncached zero-retry root acceptance once; require baseline plus `Δnew`, zero retries, and setup <20 seconds. Rerun-until-green is forbidden.
- [ ] 3.6 Fresh review, merge, then explicitly reconcile #311. Only afterward advance dependent delivery.
