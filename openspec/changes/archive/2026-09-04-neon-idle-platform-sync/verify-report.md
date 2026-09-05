```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0b02e634b930a0b0810dc8291f02fb91ed1a8c7ab046d5500059588e65a79670
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 14/14
test_command: "pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__/platform-sync-projection-render.spec.tsx && pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__ && pnpm --filter viewpro-web test"
test_exit_code: 0
test_output_hash: sha256:b740dfb8fce9b3b9785d0777516909aedbb498968d5e8b3d4496c0e0e8b1a73b
build_command: "post-sync canonical delta/preservation/heading/GIVEN-WHEN-THEN audit && tracked/untracked git diff whitespace/scope/candidate-size checks"
build_exit_code: 0
build_output_hash: sha256:ca3dfbaba32370889601cac42fc81593c3815034b850d927d24f93bfd7e05127
```

# Verification Report: Demand-Triggered Platform Synchronization

## Result

**Post-sync successor note:** the canonical-only sync was reverified after this original report. The bounded `Post-sync canonical verification` section below is current and supersedes earlier worktree/lifecycle-state wording; original implementation and test evidence remains preserved.

**PASS WITH WARNINGS.** The retained implementation and current AC6/D.5 work unit satisfy **8/8 requirements and 14/14 scenarios**. There are no current closure or archive blockers. The historical D.4 gate-order deviation remains a real, non-repairable process deviation and is not rewritten as timely compliance. Fresh API verification could not execute because this worktree lacks `apps/viewpro-api/node_modules` and its generated Prisma client; retained apply evidence remains GREEN, and the current 113-line work unit changes no API or production source.

No publication, merge, deployment, provider access, issue mutation, database access, or implementation repair was performed.

## Structured status, action context, and tasks

- Consumed native `gentle-ai.sdd-status` schema version 2 for the unambiguous change `neon-idle-platform-sync`.
- `artifactStore=openspec`; proposal, two delta specs, design, tasks, and apply-progress are present; `dependencies.verify=ready`; `nextRecommended=verify`.
- `actionContext.mode=repo-local`; workspace and allowed edit root are `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-sync-matching-projection`.
- Verification wrote only this report within the allowed edit surface.
- `tasks.md` contains **14/14 checked implementation tasks** and **zero** lines matching `^\s*- \[ \]`. No unchecked implementation task remains.
- Current work-unit diff, including the intended untracked test: **112 additions + 1 deletion = 113 changed lines**. This is below both the runtime cap of 390 and review budget of 400.
- Changed files are the new AC6 test plus `tasks.md` and `apply-progress.md`; there are **no production source changes**.

## Requirement coverage — 8/8

| # | Requirement | Result | Evidence |
|---:|---|---|---|
| 1 | Operator console — Authenticated Visible Demand | PASS | Real hook tests cover mount/focus/visible 4s cadence, hidden stop, and 404 fallback; retained controller integration proves 401/403 start no run and authorized demand uses `viewpro-api`. |
| 2 | Operator console — Explicit Projection State | PASS | Provider/status tests retain projection data and truthful degraded state. The new component integration renders old data, receives durable non-empty `updating` metadata, invalidates/refetches, and renders new data. |
| 3 | Operator console — Conditional Normal-Path Freshness | PASS | New real-render oracle observes the matching projection at fake-clock `t0+9s`, without requiring `current`; existing hook coverage excludes unfinished batches. |
| 4 | Data lane — Interval Poll Job replacement | PASS | Retained coordinator/module tests prove one bounded batch, shared-promise coalescing, no queue, and no timer provider. Source inspection shows demand controller is the coordinator entry point. |
| 5 | Data lane — Durable Cursor Advance | PASS | Retained real-ingest coordinator tests cover ordered durable projection/cursor advancement and typed projection/cursor failures preserving position. |
| 6 | Data lane — Environment Configuration | PASS | Retained env tests require internal URL/control secret and prove `PLATFORM_POLL_INTERVAL_MS` is absent; timer files/providers are removed. |
| 7 | Data lane — Bounded Feed and Truthful Process Status | PASS | Source fixes feed timeout at 2s and backend race at 4s; retained tests cover stale restart, updating, all mapped failures, retry, empty-current confirmation, counters, and release. |
| 8 | Data lane — Compatibility, Rollback, and Provider Evidence | PASS WITH WARNING | Compatibility/rollback evidence and D.5 provider evidence pass. D.4 singleton reconfirmation occurred after merge/deploy, so historical ordering did not comply; current singleton/no-poll health evidence mitigates closure risk but cannot repair timing. |

## Scenario coverage — 14/14

| # | Scenario | Result | Evidence |
|---:|---|---|---|
| 1 | Authorized open and unauthorized request | PASS | Hook/service boundary plus retained real HTTP 200/401/403 controller cases. |
| 2 | Backgrounding stops demand | PASS | Hidden focus/cadence tests and effect cleanup. |
| 3 | Cold, backlog, or failure degrades explicitly | PASS | Status badge/provider and unfinished-batch tests preserve data and expose truthful state. |
| 4 | Deterministic normal-path oracle | PASS | New component integration: real hook, real `QueryClient`, active projection consumer, matching DOM projection at `t0+9s`. |
| 5 | SLO precondition is absent | PASS | Existing unfinished snapshot and degraded-state cases make no completion claim. |
| 6 | Idle quiet; active demand coalesces | PASS | No poll provider; coordinator shared-promise/no-queue test. |
| 7 | Repeated demand drains backlog | PASS | One batch per completed cadence contract retained across hook/coordinator tests. |
| 8 | Failure preserves durable position | PASS | Coordinator failure mapping retains `lastObservedCursor`. |
| 9 | Restart resumes only on demand | PASS | Initial stale snapshot performs no dependency read; later run reads durable cursor. |
| 10 | Required secret absent | PASS | `env.schema.spec.ts` rejects missing `PLATFORM_CONTROL_SECRET`. |
| 11 | Timeout and later retry | PASS | Feed timeout mapping and later controller-demand retry tests. |
| 12 | Empty batch successful no-op | PASS | Empty recovery test asserts current/count 0/cursor unchanged/failure count 0/success timestamp. |
| 13 | Ordered gate blocks unsafe retirement | PASS WITH WARNING | Pre-retirement evidence existed, but D.4 pre-merge/deploy reconfirmation was late. The gate's intended historical ordering was violated and remains disclosed. |
| 14 | Closure evidence passes | PASS | ≥24h PROJECTED D.5 arithmetic, autosuspend/activity correlation, retained behavior, and current singleton/no-poll confirmation satisfy closure evidence. |

## AC6 real-render verification

`platform-sync-projection-render.spec.tsx` imports the production `PlatformSyncProvider`, which invokes the real `usePlatformSyncDemand`; only the HTTP demand service is mocked. It creates a real TanStack `QueryClient`, seeds `metricsKeys.summary()` with `old projection`, and mounts an active `useQuery` consumer. The first demand is unfinished. At the next visible cadence (`t0+4s`), a second demand starts; at `t0+8s` it resolves with `lastBatchCount: 1`, durable cursor `42`, and state still `updating`. Production hook invalidation triggers the active query refetch, and the DOM contains `new projection` by `t0+9s`. The badge simultaneously remains `Sincronizando datos…`, proving projection freshness does not depend on `current`.

Assertion-quality audit found no tautology, ghost loop, type-only-only assertion, smoke-only test, CSS/detail assertion, assertion without production execution, or mock-heavy ratio. The call-count assertion accompanies visible old/new projection and status behavior; it is not the sole oracle.

## D.5 arithmetic and provider evidence

- Exact window: `2026-09-01T00:00:00Z` → `2026-09-03T15:23:33.159Z` = `63.3925441667h` (reported rounded window `63.392544h`), therefore correctly labeled **PROJECTED**.
- Product: `158 / 3600 = 0.0438888889 CUh`; using the recorded rounded window, `0.0438888889 × (720 / 63.392544) = 0.4984813356 projected CUh`.
- Platform: `157 / 3600 = 0.0436111111 CUh`; using the recorded rounded window, `0.0436111111 × (720 / 63.392544) = 0.4953263904 projected CUh`.
- Both are far below the `≤10 projected CUh/project` threshold. Product active fraction is `620s / window = 0.2716758%`; platform is `616s / window = 0.2699231%`.
- Both endpoints were idle at capture, one endpoint each, fixed `0.25 CU`, default five-minute autosuspend.
- Sep 2/Sep 3 wake→suspend pairs correlate with successful backup runs `33618365559` and `33744195725`; Sep 1 run `33499351324` failed.
- Counters may lag, but capture was more than four hours after activity and stable for 45 minutes. Supplied user confirmation records desired/running `1/1` healthy, main/v1.2.0 `eaa2b279` or later no-poll image, and no intentional console demand.
- Query Performance public API is unavailable on the Free/public API and is explicitly non-gating.

## Strict TDD compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | PASS | `apply-progress.md` contains `TDD Cycle Evidence` tables for A, B, C, D, and the AC6 correction. |
| Reported test files exist | PASS | New AC6 test and retained coordinator/controller/compatibility/module/config/component tests exist. |
| RED evidence | PASS | Tables preserve genuine missing-module, failed assertion, timeout, and retirement REDs; the AC6 harness records two genuine failing states before GREEN. |
| GREEN confirmed | PASS WITH WARNING | Fresh web focused/component/full runs pass. API GREEN is retained but could not be freshly rerun because API dependencies/generated client are absent in this worktree. |
| Triangulation | PASS | AC6 varies unfinished versus durable non-empty states; broader suites cover visible/hidden, authorized/unauthorized, success/failure/empty, compatibility, and rollback branches. |
| Safety net | PASS | Every slice records a pre-change suite baseline and post-change focused/full results. |

**TDD compliance:** substantive RED/GREEN/TRIANGULATE/REFACTOR evidence is complete; no CRITICAL TDD issue was found. The support template's literal `✅ Written`/`✅ Passed` wording is not used, but the recorded commands, failures, files, and pass counts provide equivalent auditable evidence.

### Test layer distribution for the primary verification inventory

| Layer | Tests | Files | Tools |
|---|---:|---:|---|
| Unit | 30 | 2 | Vitest (coordinator and config) |
| Integration | 24 | 7 | Vitest, Testing Library, real QueryClient, Nest/Supertest where dependencies are installed |
| E2E | 0 | 0 | Full multi-service E2E is explicitly #329 scope |
| **Total** | **54** | **9** | |

Changed-file coverage was skipped: no configured coverage command/plugin was detected for the current test-only delta. This is informational and non-blocking.

## Commands and exact results

Commands ran from `viewpro-app/` unless noted.

| Command | Result |
|---|---|
| `pnpm --filter viewpro-web test -- src/features/platform-sync/components/__tests__/platform-sync-projection-render.spec.tsx` | PASS, but the literal `--` did not scope under this pnpm/Vitest combination and ran the full suite: 58 files, 630/630. Not used as focused evidence. |
| `pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__/platform-sync-projection-render.spec.tsx` | PASS — 1 file, 1/1. |
| `pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__` | PASS — 4 files, 12/12. |
| `pnpm --filter viewpro-web test` | PASS — 58 files, 630/630. |
| `pnpm --filter viewpro-web typecheck` | PASS — `tsc --noEmit`. |
| `cd apps/viewpro-web && pnpm exec oxfmt --check src/features/platform-sync/components/__tests__/platform-sync-projection-render.spec.tsx` | PASS — 1 file correctly formatted. |
| `git diff --check HEAD` plus `git diff --no-index --check /dev/null <intended-untracked-test>` with expected no-index status handling | PASS — tracked and intended untracked content have no whitespace errors. |
| Exact numstat/source-scope script | PASS — 113 changed lines; no production `apps/*/src` file outside `__tests__`. |
| `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-sync-coordinator.spec.ts src/platform-data/__tests__/platform-sync.controller.spec.ts src/platform-data/__tests__/platform-sync-compatibility.spec.ts src/platform-data/__tests__/platform-data.module.spec.ts src/config/__tests__/env.schema.spec.ts` | **ENVIRONMENT FAILURE (exit 1)** — `sh: vitest: command not found`; pnpm reports local package exists but API `node_modules` is missing. No test or database setup ran. |
| Full `@viewpro/platform-api` suite and typecheck | SKIPPED — unsafe/unavailable with current missing API dependencies and generated client; no install, generation, or database mutation was authorized. Retained apply evidence reports focused 42/42-equivalent constituent suites, full 598/598, and typecheck GREEN after Slice D. |

Successful combined web test output hash: `sha256:b740dfb8fce9b3b9785d0777516909aedbb498968d5e8b3d4496c0e0e8b1a73b`. Successful combined type/format/diff/scope output hash: `sha256:3816ed63337f00031beeb2340b5e515b47a04e7c99ceb4b216b84b82243dc93b`.

## Review workload and lifecycle readiness

- Forecast required PR0→A→B→C→D sequentially to `develop`, each ≤400, no `size:exception`. Retained slice records show 338, 217, 317, and 313 changed lines respectively and preserve the chained boundaries.
- Current `ac6-render-and-d5` closure work unit is exactly 113 changed lines, below its 390 authority and the 400 review budget. It contains only the new matching-projection test and lifecycle evidence updates; no scope creep or production source change exists.
- No `size:exception` was used or needed. No commit, PR, merge, publication, deployment, receipt, or archive action occurred during verification.
- **D.4 decision:** the late singleton reconfirmation does not block current closure or archive because it cannot now be repaired, current singleton/no-poll state is affirmatively confirmed, compatibility/rollback evidence passed, and ≥24h D.5 evidence shows safe idle behavior. It remains a permanent process warning and must not be described as timely gate compliance.
- Lifecycle disposition: ready for archive after the parent accepts this warning-bearing verification; no publication or merge is implied or authorized.

## Post-sync canonical verification

**PASS WITH WARNINGS.** The canonical-only successor preserves the original **8/8 requirement and 14/14 delta-scenario** coverage, has zero blockers and zero critical findings, and changes no implementation or test file. Verdict remains warning-bearing solely for the already-disclosed D.4 gate-order deviation and the historical API-local dependency limitation.

### Status, task completion, and ownership

- Consumed `gentle-ai.sdd-status` v2 for unambiguous change `neon-idle-platform-sync`, `artifactStore=openspec`, repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-idle-platform-sync-canonical`, and the same path as the allowed edit root.
- Verification ownership is proven inside that workspace. This phase edited only `openspec/changes/neon-idle-platform-sync/verify-report.md`; canonical specs, sync report, implementation, tests, tasks, and apply-progress were not edited.
- `tasks.md` remains **14/14 checked** with no line matching `^\s*- \[ \]`; archive completeness is satisfied.
- `sync-report.md` is the intended untracked sync artifact. The current successor contains Markdown only; `git diff 3b7342cf -- viewpro-app/apps ':!**/*.md'` is empty.

### Canonical delta and preservation audit

| Check | Result |
|---|---|
| ADDED/MODIFIED blocks | PASS — exact normalized block equality for operator-console 3/3 and platform-data lane 5/5, total 8/8. |
| Delta scenarios | PASS — all 14/14 are retained inside those exact blocks. |
| Canonical heading integrity | PASS — operator console has 10 unique requirements and 19 unique scenarios; platform data lane has 8 unique requirements and 16 unique scenarios. |
| GIVEN/WHEN/THEN structure | PASS — 19/19 and 16/16 canonical scenarios contain all three clauses. |
| Unrelated requirements | PASS — 7/7 operator-console and 3/3 platform-data-lane pre-existing unrelated blocks are byte-equivalent after normalized block extraction. |
| Purpose/invariants/provenance | PASS — operator-console invariants are unchanged; both provenance comments and all unrelated lane purpose/invariant text are preserved. Only the directly superseded polling purpose sentence and parallel-poller invariant changed to demand/single-flight semantics. |
| Obsolete contracts | PASS — `PLATFORM_POLL_INTERVAL_MS`, tick cadence, configurable recurring poll, and affirmative perpetual-poller contracts are absent. Parenthetical `Previously:` text and “replace perpetual polling” are historical/negative context, not live contracts. |
| Same-domain collision | PASS — active #306 `seller-property-proposals` deltas are only `property-primary-seller`, `property-proposals`, `safe-public-error-boundary`, and `seller-navigation-scope`. |

Canonical SHA-256 remains `c743e2955d39ebad93f4674458b1e412e5da82c182646cacc6f120d6cf29a6d1` for operator-console and `cc814b3061f97855b6af977f177536f65feb2e89536df5538ce32a7102f25ec6` for platform-data-lane-ingest-metrics. Sync-report SHA-256 is `952442b7bf7eae1dff93f2c0b5c167b81d56057dfd96cf7d4d986d0c275428dc`.

### Strict TDD and retained execution evidence

- Strict TDD remains active. `apply-progress.md` still contains TDD Cycle Evidence tables for A, B, C, D, and AC6 closure; referenced retained tests exist. The former `platform-data-poll-job.spec.ts` is intentionally absent because D.3 deleted the timer and its test under recorded RED/GREEN evidence.
- Test and implementation files are unchanged from merged commit `3b7342cf58637d235da21e6ef85607cea793d362` (PR #513). The prior focused/component/full web execution remains exactly 1/1, 12/12, and 630/630 with output hash `sha256:b740dfb8fce9b3b9785d0777516909aedbb498968d5e8b3d4496c0e0e8b1a73b`; the supplied merge context records all 10 CI checks passed.
- The prior assertion-quality audit remains applicable because no test changed: zero tautologies, ghost loops, type-only-only assertions, smoke-only tests, CSS-detail assertions, or assertion-without-production-execution findings. AC6 still executes the real hook, real `QueryClient`, and active projection consumer.
- No production/provider/database retest was invented for a Markdown-only sync. The API-local `node_modules`, Vitest binary, and generated Prisma client are still absent, so the original fresh-API warning remains accurate; retained API GREEN evidence is unchanged.

### Post-sync command results

- Corrected inline Python canonical audit: PASS, exact delta 8/8; unrelated blocks 10/10; canonical heading uniqueness and GIVEN/WHEN/THEN 35/35; output SHA-256 `f48fd7b8b29659a171ec2b7ae93ad9f4e47039e5b836d811278106b9ea93c9b4`.
- `env -u GIT_EXTERNAL_DIFF git diff --no-ext-diff --check` plus no-index whitespace validation for `openspec/changes/neon-idle-platform-sync/sync-report.md`: PASS.
- Exact changed-path/source-scope and candidate-size script including the intended untracked sync report: PASS — 149 tracked additions + 61 tracked deletions + 67 untracked additions = **277 changed lines**, below both the 390 authority and 400 review budget. The build-output hash is the SHA-256 manifest of semantic output `f48fd7…c9b4` and scope output `48e25f…abb9`; the final artifact hash is returned in the phase envelope.
- `gentle-ai sdd-verify-validate --input openspec/changes/neon-idle-platform-sync/verify-report.md --requirements 8 --scenarios 14`: PASS — `{"valid":true,"verdict":"pass_with_warnings","evidence_revision":"sha256:0b02e634b930a0b0810dc8291f02fb91ed1a8c7ab046d5500059588e65a79670"}`.
- Diagnostic failures were resolved without protected-artifact mutation: plain `git diff -- ...` exited 128 and the first binary no-index candidate-hash attempt exited 1 because inherited `GIT_EXTERNAL_DIFF=/bin/false`; two initial inline audit parsers exited 1 and 3 due operation-boundary and AC-suffix handling. Reruns with `env -u GIT_EXTERNAL_DIFF` and the corrected parser passed.

### Review workload and current risks

The current canonical sync unit remains below the 400-line review budget and changes no code. It is one coherent Markdown-only successor to the already-merged sequential PR chain; no `size:exception` was used, and no slice boundary was crossed. D.4 remains a permanent historical warning because singleton reconfirmation occurred after deployment. Provider-counter lag and the historical API-local dependency warning remain disclosed but do not create a new post-sync blocker.

## Exact blockers and residual risks

**Blockers: none.**

Warnings:
1. D.4 was performed after, not before, v1.2.0 merge/deploy; historical ordering compliance is false even though current closure evidence is sufficient.
2. Fresh platform-api focused/full/typecheck verification is unavailable in this worktree because API dependencies and the generated Prisma client are absent. Current code delta does not touch API source, and retained apply evidence is GREEN.
3. Provider counters can lag; the >4h post-activity delay and 45-minute stability reduce but do not eliminate that observational limitation.
