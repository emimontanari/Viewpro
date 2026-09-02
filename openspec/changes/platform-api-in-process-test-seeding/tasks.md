# Tasks: Platform API In-Process Test Seeding

## Review Workload Forecast

The complete five-artifact planning amendment must remain at or below the repository-normal 400 changed lines against `HEAD`. PR3 implementation is one focused test spec; no exception or unrelated cleanup is approved.

### Delivery Topology

- **PR0 #313:** merged planning baseline.
- **PR1 #314:** merged Nest-owned fixture and behavioral coverage.
- **PR2 #315:** merged migration of 15 subprocess sites/34 launches across 14 specs to 34 direct fixture calls, plus command-scoped retry control.
- **PR3:** current `test/platform-api-seed-boundary-focused` branch at approved base `a25dbf2ae8e0cb48a530069e9a9b26e631f71dbd`; one self-contained boundary spec and final evidence only.
- Revert PR3 alone to remove the guard; full capability rollback is PR3→PR2→PR1 while retaining PR0, matching revised issue #311.

## Completed Baseline

- [x] 1.1 PR0 merged as #313 into `develop`.
- [x] 1.2 PR1 fixture/foundation merged as #314 into `develop` with behavioral fixture coverage.
- [x] 1.3 Fix inventory established: 14 consumer specs, 15 historical subprocess source sites/34 launches, and a retained production seed contract.

## PR2: Consumers and Retry

- [x] 2.1 Migrate all 14 consumer specs: remove 15 historical production-seed subprocess source sites and place 34 direct fixture invocations post-init and pre-login, including both step-up contexts and both tenant-detail contexts.
- [x] 2.2 Remove production-seed subprocess helpers/direct sites while preserving roles/statuses/passwords and named assertions.
- [x] 2.3 Add only command-scoped retry control; default remains 2 and timeout/Turbo/schema/API/runtime/seed remain unchanged.
- [x] 2.4 Prepare and approve the PR3 split contract without changing implementation source, test, or acceptance-task completion.
- [x] 2.5 Merge PR2 as #315 (`8ba9fc37`); issue #311 remains open.

## PR3: Boundary and Final Acceptance

- [x] 3.1 Start `test/platform-api-seed-boundary-focused` at approved base `a25dbf2ae8e0cb48a530069e9a9b26e631f71dbd`, which contains merged PR2.
- [ ] 3.2 **RED:** first create `src/test-support/__tests__/operator-fixture-boundary.spec.ts` with an executable contract calling a deliberately missing local `checkOrdinarySpecBoundary`; run the focused Vitest and capture its expected missing-symbol/compile failure without claiming mutation diagnostics. <!-- sdd-owner: implementation -->
- [ ] 3.3 **GREEN:** define the minimum helper in that same self-contained spec and pass the focused Vitest on clean source bytes; implement configured roots, root-only seed exemption, effective Node16 closure/cycles, external terminals, forbidden/fail-closed edges, and chain diagnostics only. <!-- sdd-owner: implementation -->
- [ ] 3.4 **TRIANGULATE:** only after GREEN, separately add reachable `node:child_process` and `prisma/seed.ts` edges, capture each chain-bearing focused failure, and restore each mutation byte-for-byte before continuing. <!-- sdd-owner: implementation -->
- [ ] 3.5 **Verification:** from `viewpro-app/`, with guarded local `_test` worker databases, run the following once on restored bytes in order; the root acceptance cannot be replaced by a rerun. <!-- sdd-owner: implementation -->
```sh
pnpm --filter @viewpro/platform-api exec vitest run src/test-support/__tests__/operator-fixture-boundary.spec.ts
pnpm --filter @viewpro/platform-api exec vitest run src/database/__tests__/seed.spec.ts
/usr/bin/time -p pnpm --filter @viewpro/platform-api exec vitest run src/platform-control/__tests__/platform-control.controller.spec.ts
pnpm --filter @viewpro/platform-api db:validate
pnpm --filter @viewpro/platform-api typecheck
pnpm --filter @viewpro/platform-api lint
/usr/bin/time -p env TURBO_FORCE=true TURBO_ENV_MODE=loose VIEWPRO_PLATFORM_TEST_RETRY=0 pnpm test
```
- [ ] 3.6 **Final evidence:** require platform-control 37/37 and setup below 20 seconds; record every test command's clean-base total, `Δnew`, resulting total and timing, then verify byte restoration, status, focused diff/check, and exact five-artifact/implementation changed-line accounting at `<=400` per unit. <!-- sdd-owner: implementation -->
- [ ] 3.7 **Parent-owned review:** freshly review planning, implementation, ordered TDD evidence, one-run acceptance, ownership parsing, and accounting; request fixes if needed. <!-- sdd-owner: parent -->
- [ ] 3.8 **Parent-owned delivery:** after approval, commit, push, and open/update the PR using repository policy. <!-- sdd-owner: parent -->
- [ ] 3.9 **Parent-owned completion:** merge the approved PR, explicitly close/reconcile issue #311, then advance dependent delivery. <!-- sdd-owner: parent -->
