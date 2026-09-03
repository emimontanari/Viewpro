# Apply Progress: Platform API In-Process Test Seeding

## Status consumed

- Native `sdd-status platform-api-in-process-test-seeding --json`: `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`, repository-local workspace, and no blocked reasons.
- Attempt continuation authenticated with the parent token and returned `proceed`.
- Base was `4116621c583b7a51f4be16a078fd63ae0a7b8953`; branch wording now reflects `test/platform-api-seed-boundary-pr3`.

## Completed implementation tasks

- [x] 3.2 RED persisted in `tasks.md`.
- [x] 3.3 GREEN persisted in `tasks.md`.
- [x] 3.4 TRIANGULATE persisted in `tasks.md`.
- [x] 3.5 verification persisted in `tasks.md`.
- [x] 3.6 final evidence persisted in `tasks.md`.

## TDD Cycle Evidence

| Cycle | Command/result |
| --- | --- |
| RED | `pnpm --filter @viewpro/platform-api exec vitest run src/test-support/__tests__/operator-fixture-boundary.spec.ts` failed as expected: `ReferenceError: checkOrdinarySpecBoundary is not defined`. |
| GREEN | The self-contained helper reads Vitest roots, parses effective Node16 options, follows imports/reexports/literal loaders cycle-safely, terminates external packages, and fails closed with chains. Its first trial exposed workspace-package classification; the corrected focused run passed 1 file/1 test in 2.59s. |
| TRIANGULATE process | Temporarily appending `import 'node:child_process'` failed with `health.controller.spec.ts -> health.module.ts -> health.controller.ts -> node:child_process`; exit 1. |
| TRIANGULATE seed | Temporarily appending `import '../../prisma/seed.js'` failed with the same ordered chain ending `forbidden prisma/seed.ts`; exit 1. |
| Review remediation: package subpath | On restored GREEN bytes, temporarily appending `import 'zx/globals'` failed in order with `src/health/__tests__/health.controller.spec.ts --(../health.module)--> src/health/health.module.ts --(./health.controller)--> src/health/health.controller.ts --(zx/globals)--> forbidden module`; exit 1. |
| Review remediation: import-equals | After restoring again, temporarily appending `import launcher = require('node:child_process')` failed with the same ordered source chain ending `--(node:child_process)--> forbidden module`; exit 1. |
| REFACTOR/cleanup | Every health mutation was restored byte-for-byte; health SHA-256 before and after was `16fcdabb5a65d68131d5779bed73873e5a10375c89ceee01c53e1df2342cf45e`. |

## Safety and prerequisites

- Read `vitest.config.ts`, `test/setup-env.ts`, `test/worker-databases.ts`, `test/global-setup.ts`, and the URL guard before execution; `.env` files were not modified.
- Forced only `postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test` for test commands; setup derives only `_w1` through `_w4` worker names.
- Platform inventory was template plus `viewpro_platform_test_w1` through `_w4`; active worker connections were zero before, after every recorded focused cycle, and after cleanup.
- Offline prerequisite install used `COREPACK_ENABLE_NETWORK=0 /opt/homebrew/bin/pnpm install --offline --frozen-lockfile --ignore-scripts`: `downloaded 0`; local `pnpm --filter @viewpro/platform-api db:generate` then generated the client.

## Corrected verification and TDD repair

- The earlier `db:validate` result remains separately invalid: Prisma P1012 because `DIRECT_URL` was omitted; it was not a candidate failure and no root acceptance was run then.
- The first corrected pass exposed candidate type errors in the new spec (`import.meta` under CommonJS, unchecked indexed values, and an obsolete `ts.ModuleSpecifier` type); a later lint run exposed an unused `dirname` import. These were the only source repairs, all in the allowed new spec.
- RED equivalent: `pnpm --filter @viewpro/platform-api typecheck` failed with those diagnostics. GREEN: after each focused boundary rerun, typecheck and finally lint passed. No production code changed.
- Offline prerequisites used `COREPACK_ENABLE_NETWORK=0 pnpm install --offline --frozen-lockfile --ignore-scripts` with `downloaded 0`, then local `db:generate`; both generated dependencies and client are cleaned after evidence capture.

## Ordered verification

All commands ran from `viewpro-app/` with `VIEWPRO_PLATFORM_TEST_BASE_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` set to exactly `postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test`. The inherited environment had no other `*DATABASE_URL`/`*DIRECT_URL`; worker connections were zero before the final sequence.

| Command | Clean-base total | Δnew | Result / timing |
| --- | ---: | ---: | --- |
| focused boundary | 0 files / 0 tests | +1 file / +1 test | pass: 1 file / 1 test; Vitest 1.94s; real 2.57s |
| seed contract | 1 file / 4 tests | 0 | pass: 1 file / 4 tests; Vitest 3.27s; real 3.79s |
| timed platform-control | 1 file / 37 tests | 0 | pass: 1 file / 37 tests; `PLATFORM_CONTROL_SETUP_MS=335` (<20,000); real 4.74s |
| `db:validate` | n/a | 0 | pass with both explicit local URLs; real 0.85s |
| platform-api typecheck | n/a | 0 | pass; real 1.63s |
| platform-api lint | n/a | 0 | pass; real 0.49s |
| final hardened-byte root acceptance | exact base: 8/8 Turbo tasks; platform-api 73 files / 633 tests | +1 file / +1 test in platform-api | pass uncached: 8/8 Turbo tasks; platform-api 74 files / 634 tests; real 94.00s |

After final workspace-traversal hardening, the exact root command ran once with both explicit localhost `_test` base URLs and passed API 140/1,426, App New 116/750, Viewpro Web 57/629, contracts 1/5, and 8/8 uncached Turbo tasks. An earlier pre-hardened revision's one-shot root failed only the unrelated API feedback-rate-limit assertion (platform-api still 74/634); it was not retried or reused for acceptance.

## Review-remediation verification

- With only the explicit local platform `_test` URLs, offline `db:generate` passed and regenerated the temporary Prisma client.
- Restored-source boundary passed 1 file/1 test in 3.24s; platform-api typecheck and lint passed with no diagnostics.
- Both initial review mutations produced the ordered diagnostics above and were restored; the health controller has no diff and its expected SHA-256 remains `16fcdabb5a65d68131d5779bed73873e5a10375c89ceee01c53e1df2342cf45e`.
- Final RED proved a workspace-local package could hide `node:child_process`, and direct seed-contract reachability was rejected only incidentally. GREEN canonicalizes resolved targets, traverses symlinked workspace sources, explicitly forbids the seed-contract file, and asserts that real workspace traversal occurred.
- Post-fix mutations rejected the workspace-local launcher and direct seed-contract edge with ordered chains; exact source bytes were restored before focused 1/1, typecheck, and lint passed.
- The final hardened-byte root acceptance then ran exactly once and passed with the attributable totals above.

## Completion, scope, cleanup, and boundary

- [x] All PR3 implementation and parent lifecycle rows are complete; PR #502 merged as `c5caa7e9124ce665a66912cdd5a00de3fc9ec097`, and issue #311 closed `COMPLETED`.
- Changed only the focused boundary spec, branch/base evidence in `exploration.md`, `proposal.md`, `design.md`, and `tasks.md`, plus this progress artifact. The health controller SHA-256 is still `16fcdabb5a65d68131d5779bed73873e5a10375c89ceee01c53e1df2342cf45e`; all TRIANGULATE mutations remain absent.
- No design deviation: this remains one self-contained static guard with no production, fixture, consumer, timeout, retry, or topology change.
- Status is `artifactStore: openspec`, repository-local at `/Users/emimontanari/Work/Apps/Viewpro-worktrees/platform-api-seed-boundary-implementation`, with implementation `applyState: all_done` and route `parent-lifecycle`; there is no missing-spec apply blocker.
- PR boundary remains one self-contained PR3 spec and evidence: seven files, 267 additions + 15 deletions = 282 changed lines. Temporary dependencies, generated clients, contract build output, upload/cache/report artifacts, and `tsconfig.tsbuildinfo` were removed; both four-worker database inventories remain with zero active connections.

## Deferred parent lifecycle actions

- [x] 3.7 **Parent-owned review:** APPROVED after final workspace-package, transitive seed-contract, corrected-byte acceptance, cleanup, and accounting review. <!-- sdd-owner: parent -->
- [x] 3.8 **Parent-owned delivery:** PR #502 passed CI/review and merged into `develop` as `c5caa7e9124ce665a66912cdd5a00de3fc9ec097`. <!-- sdd-owner: parent -->
- [x] 3.9 **Parent-owned completion:** PR #502 merged and issue #311 closed `COMPLETED`; closure comment: https://github.com/emimontanari/Viewpro/issues/311#issuecomment-5524325047. <!-- sdd-owner: parent -->

## Key Learnings

- Forbidden-package matching must include package subpaths; `zx/globals` is rejected through the ordinary-spec closure with a complete source chain.
- TypeScript import-equals external references must be traversed; `import launcher = require('node:child_process')` is rejected with the same ordered chain.
- Root acceptance attribution must compare the candidate's platform-api 74 files/634 tests to the exact-base 73 files/633 tests, not to an unrelated repository-wide API total.
