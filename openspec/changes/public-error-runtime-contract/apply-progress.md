# Apply Progress: Public Error Runtime Contract

## Scope

- Change: `public-error-runtime-contract`
- Delivery: chained PRs with stacked-to-develop semantics.
- Remediation incident preserved: `unit-1-turbo-graph-remediation` repaired the confirmed generic Turbo dependency and strict-environment watch evidence defects. Its earlier single settlement request was blocked as `invalid_continuation`; no retry was made.
- Final remediation settlement: **complete** — token `sha256:85088994c917861c97077af39efa1fe9793fd3d12c8364f0aeff88ea535aaecc`, request `settle-public-error-runtime-contract-unit1-remediation-20260820-audit-7f3c91b2`, evidence revision `sha256:d01f4214702c88192cf99a885ed1320ff5cbd31d6c91a14ffffc66963677c1ad`.
- Review: clean dual Judgment Day approval recorded for the final Unit 1 remediation evidence.
- Commit status: Units 1–3 are merged through `392bcb0901b7eb5bd9ff1a2908fa3cbdd5913b02`; Unit 4 is the final CI/docs/manual-gate slice.

## Completed Tasks

- [x] 1.1 RED — package runtime contract proof.
- [x] 1.2 GREEN — CommonJS package output, consumer edges, lockfile ownership, and Turbo graph.
- [x] 1.3 REFACTOR — bounded root watch rebuilt and restarted both consumers for temporary and restored contract values.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `packages/contracts/test/runtime-contract.spec.ts` | Unit/runtime | N/A (new proof) | `pnpm --filter @viewpro/contracts exec vitest run test/runtime-contract.spec.ts` → 3/3 failed: missing `dist/index.{js,d.ts}` and both package load paths | `pnpm --filter @viewpro/contracts test` → 3/3 passed after build | Three independent assertions: exact artifact whitelist/declaration, `require`, dynamic `import` | Clean; generated `dist/**` removed after proof |
| 1.2 | `packages/contracts/test/runtime-contract.spec.ts` | Unit/runtime / Turbo graph | ✅ 3/3 package runtime proof | Fresh triage dry-runs failed: generic `build`/`typecheck` materialized `<NONEXISTENT>` `db:generate` nodes for non-API packages | Frozen install, package build/typecheck/test, root build/typecheck, and corrected root dry-runs passed; no `db:generate` node is nonexistent and only the two Prisma APIs retain real Prisma nodes | Build and typecheck independently confirmed generic ordering plus API/platform-API `db:generate` overrides | Generic `db:generate` was removed only from `build`/`typecheck`; no loose environment mode was added |
| 1.3 | `packages/contracts/test/runtime-contract.spec.ts` | Root watch integration | ✅ 3/3 package runtime proof before the temporary edit | Fresh triage dry-run showed API dev had no strict-environment passthrough for `PLATFORM_CONTROL_SECRET` | The exact root watch command, with only inline synthetic `PLATFORM_CONTROL_SECRET` and without `--env-mode=loose`, started both consumers; temporary and restored values each rebuilt contracts, restarted both consumers, and were observed from the API consumer workspace | Initial, temporary, and restored contract values were separately observed; both transitions rebuilt before API/App New dev invocations | ✅ Watcher and child processes terminated; generated `dist/` directories removed |

## Commands and Results

- RED bootstrap: `pnpm --filter @viewpro/contracts exec vitest run test/runtime-contract.spec.ts` initially failed because Vitest was not yet a contracts dependency.
- RED evidence: after the package dependency/lockfile update, the same command failed 3/3: `dist/` was absent and `require('@viewpro/contracts')` plus dynamic `import('@viewpro/contracts')` each resolved the missing `dist/index.js`.
- GREEN: `pnpm --filter @viewpro/contracts test` passed 3/3 after `tsc -p tsconfig.json` emitted the two allowed files.
- Frozen install: `pnpm install --frozen-lockfile` passed.
- Replacement graph GREEN: `pnpm exec turbo run build --dry=json` and `pnpm exec turbo run typecheck --dry=json` each reported no nonexistent `db:generate` task. Each retained exactly `@viewpro/api#db:generate` and `@viewpro/platform-api#db:generate`, both running `prisma generate`; generic build resolved `^build`, generic typecheck resolved `^build` then `^typecheck`, and both API overrides retained their required edges plus `db:generate`.
- Replacement dev GREEN: `pnpm exec turbo run dev --filter=@viewpro/api --dry=json` reported strict mode with `dependsOn: ["^build"]`, `cache: false`, `persistent: true`, `interruptible: true`, and `passThroughEnv: ["PLATFORM_CONTROL_SECRET"]`. The secret remains passthrough-only: it is neither hashed nor persisted.
- Replacement root watch: exactly `PLATFORM_CONTROL_SECRET=<synthetic> pnpm exec turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter` ran without `--env-mode=loose`. Initial contracts build completed before both dev invocations. The temporary edit produced a fresh contracts build before fresh API/App New dev invocations; restoration replayed the current contracts build before fresh API/App New dev invocations. The API consumer workspace observed `not-generated-yet` → `temporarily-generated` → `not-generated-yet` from the emitted package. This evidence makes no claim about old-process interruption timing.
- Cleanup: the bounded watcher was terminated after both transitions; process inspection found no worktree `turbo watch`, `nest start --watch`, or `next dev` process. Generated `packages/contracts/dist`, `apps/api/dist`, and `apps/viewpro-api/dist` were removed after verification.
- Final regression: `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts test` (3/3), `pnpm --filter @viewpro/contracts build`, `pnpm --filter @viewpro/contracts typecheck`, `pnpm build` (8/8), and `pnpm typecheck` (10/10) all passed after restoration.

## Changed Files

- `viewpro-app/packages/contracts/package.json`
- `viewpro-app/packages/contracts/tsconfig.json`
- `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`
- `viewpro-app/package.json`
- `viewpro-app/turbo.json`
- `viewpro-app/apps/api/package.json`
- `viewpro-app/apps/app-new/package.json`
- `viewpro-app/pnpm-lock.yaml`
- `tasks.md` and this progress artifact.

## Review and Rollback

- Source/test/config/lockfile changed lines: **118 / 400** (OpenSpec bookkeeping excluded; 75 tracked additions/deletions plus 43 lines in the new runtime test).
- Rollback boundary: revert the eight Unit 1 source/test/config/lockfile paths and only the two consumer contract importer links plus the contracts Vitest importer entry; remove the Unit 1 test. No Unit 2–4 path was changed.
- Current boundary: Units 1–3 are complete; Unit 4's 4.1 and 4.3 plus the versioned `ignoreCommand` prerequisite are complete/staged, while 4.2 production retry remains pending.

## Unit 2 — ordinal 5 exit-only correction

- Ordinal 4 passed with `settle-public-error-runtime-contract-unit2-bounded-reap-20260820-1`, token `sha256:d1df362b994c5857bad75e05f94ce8fee31c7bff170df03f5230410d75b49e1f`, and evidence `sha256:6abf3def1cdea72e21be1d0ad2d79086f3e3f0b44dbc7c93b8fe9fbf53f82655`; it is predecessor evidence only and does not prove this future source.
- 2.3 was reopened. RED: focused Vitest failed 4/13 for missing exit-only stdout/stderr destruction and persistent late-error guarding.
- GREEN: exit-only timed-out/nonzero/signaled failures and natural-success final-evidence expiry now settle, clear timers/remove terminal listeners, retain the runner error guard, destroy stdout then stderr, and unref. Neither event reports `runtime_smoke_termination_unconfirmed` without a reap/orphan claim; complete close success preserves streams/output.
- Focused Vitest passed 13/13; coverage includes cooperative timeout, SIGKILL exit-only, natural exit-only deadline, neither-event, unowned late error settle-once, complete success, ordered teardown, and tokenized Docker cleanup.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.3 | `apps/api/src/runtime-contract-smoke.spec.ts` | Unit/process | prior 13/13 | 4/13 failed before source change | 13/13 passed | six exit/close paths | no behavior change |

- `pnpm install --frozen-lockfile`, API typecheck, forced Turbo API build (4/4), real `runtime:smoke`, and `git diff --check` passed. Image `sha256:3228c1bf1b063a292d6538b413867aee7db83e3445e278f7644e3db6582d51f6` and all matching labeled containers were removed.
- Final exact numstat: implementation **331 / 400** (target ≤351); complete PR **361 / 400**. Settlement complete exactly once: `settle-public-error-runtime-contract-unit2-exit-stdio-20260820-1`, token `sha256:a2cb626e2ef6567385b6e5e3d73cd3c57c20739f6f96650d3ba6e0de5c61fb47`.

## Unit 3 — App New Node Marker / Image
- Bounded attempt acquired: `acquire-public-error-runtime-contract-unit3-app-20260820-a1`, state `proceed`, token `sha256:bf18d0060cbab973bd3b1a72d941e1723e55b4432aa8a65f1204b4e4699d1572`.
- Settlement: **complete** — `settle-public-error-runtime-contract-unit3-app-20260820-a1`, outcome `passed`, sealed evidence revision `sha256:6dd6aaf94c33927cecbce8db3c724b9f6c912d942a501991d593685224bf0d01`.
- Corrective attempt acquired: `acquire-public-error-runtime-contract-unit3-remediation-20260820-c1`, state `proceed`, token `sha256:afd908b1e50154e74e8f45f9edf76483cbb6c587c4202ff56cf8f898760ac292`.
- Corrective settlement: **complete** — `settle-public-error-runtime-contract-unit3-remediation-20260820-c1`, outcome `passed`, evidence revision `sha256:99d482d27e5d938b0454dea74883da4557c75afbed0a8f0952ed61c98e58e362`.
- The prior wording that the shared import was at the instrumentation module boundary was false: the current Edge bundle contained the shared literal. The helper now solely owns the static contract import; the Node server chunk contains it, while Edge and Middleware artifacts do not.
- Completed 3.1–3.3 only. This historical Unit 3 record does not determine the current Unit 4 task state.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 | `apps/app-new/src/instrumentation.spec.ts` | Unit/runtime | ✅ 5/5 before correction | 1/5 failed: Edge evaluated the mocked `@viewpro/contracts` factory. | 5/5 passed after moving the static import into the Node helper. | Edge evaluates neither contract nor helper factory; Node/absent env/exact response/`EADDRINUSE` remain covered. | No behavior change beyond the Node-only bundle boundary. |
| 3.2 | `apps/app-new/scripts/runtime-contract-image-smoke.spec.mjs` | Unit/harness | N/A (new coverage) | Focused suite failed at import because the executable script could not be injected. | 5/5 passed after exporting injected readiness, teardown, and cleanup seams. | Direct 200/manual redirect; premature exit; deadline abort; stop→kill→wait→rm; cleanup failure. | Script remains the executable entry point; no Docker failure fixture is needed. |
| 3.3 | both focused suites | Standalone integration | ✅ 10/10 focused tests | RED cases above | Exact-token Docker smoke passed. | Build scans found no `not-generated-yet` or `@viewpro/contracts` bytes in `.next/server/{edge,middleware}`. | Real cleanup reports 0 labeled containers/images and no standalone server process. |

### Unit 3 Commands and Results
- Corrective RED/GREEN: instrumentation RED 1/5 → GREEN 5/5; harness RED import failure → GREEN 5/5; combined focused Vitest is **10/10**.
- `lint:strict`, App New typecheck, contracts build, and `BUILD_STANDALONE=true NEXT_PUBLIC_SENTRY_DISABLED=true` App New production build passed.
- Exact-token standalone smoke passed; it required `/auth/sign-in` itself to return 200, read the byte-exact loopback marker, and reaped its server. Labeled containers/images and matching standalone server processes returned **0** afterward.

### Unit 3 Review and Rollback
- Final exact full branch diff: **376 additions + 24 deletions = 400 / 400 changed lines** including untracked files; OpenSpec evidence is included.
- Implementation paths: `viewpro-app/apps/app-new/{Dockerfile,next.config.ts,package.json,vercel.json,src/instrumentation.ts,src/instrumentation-node.ts,src/instrumentation.spec.ts,scripts/runtime-contract-image-smoke.{mjs,spec.mjs}}` plus this correction evidence and the design ownership path list.
- Rollback boundary: revert only Unit 3 App New paths, including `vercel.json`, and its three task checkboxes; Units 1–2 evidence is preserved and no Unit 4 path was changed by Unit 3.

### Final Unit 3 evidence correction
- Attempt `acquire-public-error-runtime-contract-unit3-evidence-remediation-20260820-e1` settled passed as `settle-public-error-runtime-contract-unit3-evidence-remediation-20260820-e1`; token `sha256:4fd155ddde2b05f6d05d2e077b2e9942fdb1fa51dcecb0f24b78345b3257a582`, evidence `sha256:e86e77219c5e5f135ab3385f4c2d424bba6f41f51b848990daaa492e920f61d9`.
- RED is the prior independent FAIL: the Node-helper import contract, direct-200 readiness acceptance, and premature-exit request observation were incomplete or false.
- GREEN: the contract wording is exact; focused App New Vitest is 10/10 with direct-200/manual-redirect and injected premature-exit request assertions; typecheck, strict lint, production build, and Edge/Middleware scan pass. Repo-owned `apps/app-new/vercel.json` runs `cd ../.. && pnpm exec turbo run build --filter=next-shadcn-dashboard-starter` so `@viewpro/contracts#build` precedes App New; this historical entry made no preview claim. Unit 4 records the later authenticated inspection outcome separately.

## Unit 4 — CI / Docs / Manual Gate

- Attempt 1 acquired: `acquire-public-error-runtime-contract-unit4-release-gate-20260821-o1`, state `proceed`, token `sha256:c63e9ecf16e10eb204ef6920572f7289e2cf0e452f4c5dbdb6a0d60eaa197efd`; settlement `settle-public-error-runtime-contract-unit4-release-gate-20260821-o1` was `interrupted`.
- The earlier continuation `acquire-public-error-runtime-contract-unit4-production-gate-20260821-p1` was blocked before acquisition because its stored objective was read-only. The repaired native objective subsequently authorized attempt `acquire-public-error-runtime-contract-unit4-production-promotion-20260821-a1` with token `sha256:eb3c2bfe55b4c1dda233b979ccf1dacb0e4537abcb1c598dbccfdf939b1f2e87`.
- CI now runs root build, typecheck, and serial test phases in order: the `test` job needs the build/typecheck/lint quality job.
- Contributor guidance names only the root commands and the native root watch command. The release guide records a manual, authenticated, read-only two-project Vercel gate and reverse-order rollback without evidence tooling or secrets.
- Final root verification passed: frozen install, build, typecheck, serial root test (8/8 Turbo tasks; API 113 files/1,178 tests; App New 91 files/504 tests), and lint (6/6 Turbo tasks; existing `viewpro-web` warnings only).
- The authorized App production promotion created `dpl_3yAQxmTu44MwM9qRLLZgDJQ2FLkY` for the reviewed SHA, but Vercel CANCELED it before build because its dashboard ignored-build step found an existing READY preview at the same SHA. No production alias moved; 4.2 remains unchecked. Tasks 4.1 and 4.3 plus the versioned prerequisite are complete/staged; production retry is deferred until the prerequisite is reviewed and merged on a new SHA.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | N/A (CI configuration) | Root CI | Existing root commands | Root install/build/typecheck passed; serial root test exceeded the initial 120-second bound before completion, exposing that the pre-change workflow allowed its test job to run independently of quality. | `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, and `pnpm exec turbo run test --concurrency=1` passed; the serial root suite completed 8/8 tasks. | N/A — structural ordering only. | CI YAML structure validation confirmed build → typecheck → lint and `test.needs: quality`. |
| 4.2 | `.github/workflows/ci.yml` inline Node policy proof | Config/CI | Existing root config | The command-only proof failed because `vercel.json` had no `ignoreCommand`. | GREEN: JSON parsed; production exited `1` without invoking the safe `npx` double, and preview delegated to that double while preserving its distinctive exit `73`. The earlier authorized App promotion remains `production`/`CANCELED`; Demo was untouched, so task remains unchecked. | Production and preview exercise distinct branches; CI invokes no network-dependent command and captures the preview status through `spawnSync`. | The policy is concise; production retry stays deferred until the reviewed configuration is merged on a new SHA. |

### Unit 4 production-promotion attempt — failed safely

- Timestamp: 2026-08-21 UTC (bounded Vercel CLI commands only).
- Canonical failed-gate evidence digest: `sha256:5778bbd94541a441f5c66ff7baf4e8a61d526d875562f774a5c022cefe6b5718` (canonical fields: change/scope, reviewed and restore SHAs, App candidate/new/prior deployment states, both App smokes, and untouched Demo state).
- The restoration envelope was re-read before mutation and matched: `RESTORE_SHA` `868dc70a025d208fd4d1f7ece52640cc92187e1e`; App rollback `dpl_6X8hPf6ue6tati8s86evqYNsSRXb`; Demo rollback `dpl_8o3FMdFzShMirgdpy5FovCRoyNd3`.
- Preflight confirmed both candidates were the sole READY preview artifacts for reviewed SHA `392bcb0901b7eb5bd9ff1a2908fa3cbdd5913b02`; both projects retained root `viewpro-app/apps/app-new`, Next.js, Node 24.x, and the repository-owned filtered-Turbo build configuration. No environment value was read.
- App promotion of `dpl_Ai72m1LABYhgMFBwJWv6mSikLrPL` created `dpl_3yAQxmTu44MwM9qRLLZgDJQ2FLkY`, which Vercel reported as `production`/`CANCELED`. This failed the required READY hard stop. Its observed aliases were only owner/develop aliases; the two production domains remained on the prior production deployment.
- App rollback was requested exactly to `dpl_6X8hPf6ue6tati8s86evqYNsSRXb`; Vercel returned 422 because it was already the current production deployment. Independent verification then confirmed it remained `production`/`READY`, retained both App production aliases, and was the sole production artifact for `RESTORE_SHA`.
- Restored App smokes: `https://app.inmoview.app/privacy-policy` → 200; `https://inmoview-app.vercel.app/privacy-policy` → 200 (each bounded to 15 seconds).
- Demo was never promoted or rolled back. It remained candidate `dpl_B5wtwFhSx6pghm4oSCgeVfESyhvk` `preview`/`READY`, with prior production `dpl_8o3FMdFzShMirgdpy5FovCRoyNd3` `production`/`READY`.
- No dashboard/settings/environment/secret/alias reassignment, production-branch, Git/GitHub, issue, #285, or #327 mutation occurred. Task 4.2 remains unchecked; cumulative task state is 11/12.
- Versioned prerequisite remediation generation 15 passed: `settle-public-error-runtime-contract-unit4-versioned-ignore-command-20260821-b1`, token `sha256:c63dc032a2577406787ec5da06da085395970cb26d118b971878449a6f6c0c12`, evidence `sha256:637162c125e99d9dfe8bd273aafe757ef5f18a3de01b5deefb3521a5646bc36e`; it remediated `sha256:5778bbd94541a441f5c66ff7baf4e8a61d526d875562f774a5c022cefe6b5718` without a production retry.
- Generation 16 passed for work unit `unit-4-prerequisite-review-remediation`, token `sha256:614e7cc77744494f4c08999c0a120e26eddee292c645fdb930ebb8a9b2667fd5`, evidence `sha256:19c0387526a04f584f7a5e03de0bd1bebe986c8de3e2c23ead9f0954dc32ae7b`; it corrected CI preview exit preservation and Unit 4 task/rollback-owner evidence without production mutation.
| 4.3 | N/A (documentation) | Documentation/manual operation | N/A (new rollback section) | N/A — documentation-only requirement; no fake executable RED was created. | Documentation structure validation confirmed external `RESTORE_SHA`, Unit 3/2 diagnostic smokes, reverse 4 → 1 restoration, revision assertions, SHA-available checks, and the no-automation rule. | N/A — reverse dependency order is a single prescribed path. | No behavior change; only concise rollback guidance. |
