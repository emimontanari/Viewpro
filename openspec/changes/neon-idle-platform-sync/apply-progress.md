# Apply Progress: Slice A — complete (attempt 2 correction)
## Scope
- `slice-a-coordinator-timeout` (A.1–A.3); timer retained; no B–D, payload, DB cancellation, or multi-replica scope.
## Preserved history
- Attempt 1 blocked: `pnpm --filter @viewpro/platform-api test -- src/platform-data/__tests__/platform-data-poll-job.spec.ts` exited 1 before tests because frozen install omitted generated `@prisma-platform/client`; lockfile unchanged.
- Prior attempt-2 RED: six stale `undefined` assertions failed against the discriminated outcome contract.
## TDD Cycle Evidence
| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| A.1 | 589 prior tests passed | `vitest ...change-feed... --testTimeout=1000`: stalled body timed out | 26 feed; 36 coordinator/poll/feed | timeout cleanup moved to body `finally` |
| A.2 | same | Prior RED preserved; correction adds no fabricated RED | real `IngestService` projection/cursor stages pass | outcome coverage consolidated |
| A.3 | same | Prior RED preserved | timer/coordinator suite passes | scope checked |
## Work Unit Evidence
| Focused | `vitest`: coordinator/poll/feed 36; ingest/audit 39; module DI 1 passed. |
| Runtime | N/A: process-local coordinator; real `IngestService` seam exercises durable-stage outcomes. |
| Rollback | Revert only Slice-A platform-data coordinator/client/ingest/job/module and tests. |
## Verification
- GREEN: `pnpm --filter @viewpro/platform-api typecheck` and `git diff --check` passed.
- Refactor/scope: no timer removal, payload validation, DB cancellation, or multi-replica work.
## Candidate Evidence
- Changed lines: 338 additions plus deletions; A.1–A.3 checked, B–D unchecked.
- Candidate method: SHA-256 of `git diff --binary --full-index b61798a9368c7930b8e4c716bd6b1458a946375e -- . ':(exclude)openspec/changes/neon-idle-platform-sync/apply-progress.md'` followed by sorted untracked `git diff --binary --full-index --no-index /dev/null <file>`, excluding this file.
- Candidate diff SHA-256: `2e638c507659bcf17b184df919f01a2475c19d9ee45cba09779349c97d0c1b27`.
- Canonical payload (UTF-8, exact shown bytes plus one LF): `{"attempt":2,"attemptToken":"sha256:3bf68b28efa07273038ecb2ffd12eb626319df16724347b5630065ff7615d9bf","base":"b61798a9368c7930b8e4c716bd6b1458a946375e","candidateDiff":"sha256:2e638c507659bcf17b184df919f01a2475c19d9ee45cba09779349c97d0c1b27","red":"stalled-body:1 failed timeout","green":"feed:26;coordinator-poll-feed:36;ingest-audit:39;module:1;typecheck;diff-check","changedLines":338}`.
- Evidence SHA-256: `082465c946b0be20b919d6c118a074e00743dcda73e3b0e096899b8f3809c982`; distinct from failed attempt-1 `sha256:d18a2e9403d5a383791c88a67ccef24d97bc2503a6de8d1c2c9ca0e66703e8bd`.

# Apply Progress: Slice B — complete (attempt 1)
## Scope
- `slice-b-demand-api` (B.1–B.3); timer retained; no A internals modified (consumed as-is), no C/D web/timer-retirement/#329 scope.
## TDD Cycle Evidence
| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| B.1 | 590 prior tests passed (full suite before edits) | `platform-sync-coordinator.spec.ts`: `coordinator.getStatus is not a function` (2 tests); `platform-sync.controller.spec.ts`: suite failed to load — `Cannot find module '../platform-sync.controller'` | Added `PlatformSyncCoordinator.getStatus()` (sync snapshot, no DB read) and `platform-sync.controller.ts` (`raceDemand`, `PlatformSyncController`); wired into `platform-data.module.ts`. Focused run: 20/20 passed | `raceDemand` condensed to a single `Promise.race` + `.then`; coordinator spec's two new tests merged into one dense assertion, matching the file's existing style |
| B.2 | same | Prior RED preserved; controller wiring (guards, `RequirePlatformPermission(METRICS_READ)`, `HttpCode(200)`) added under the same RED | 401/403/200 integration tests (real `AuthModule`+`PermissionsModule`+Postgres test DB via supertest) and `consecutiveFailureCount` increment/reset pass through the existing coordinator status untouched | Trimmed controller doc comments and test file (removed redundant per-status tests via `it.each`, dropped a duplicate "joined demand" pure test already proven at Slice A) to stay inside the 160–250 line budget |
| B.3 | same | Prior RED preserved; no new fabricated RED | `platform-data.module.spec.ts` extended to resolve `PlatformSyncController` alongside pre-existing `MetricsController` (old-web/new-API DI compatibility); controller-spec "later demand call retries after failure" proves retry | Scope checked: no #329 payload/DB-cancellation/multi-replica/durable-evidence work; timer (`PlatformDataPollJob`) untouched and still delegates to the same coordinator |
## Work Unit Evidence
| Focused | `pnpm --filter @viewpro/platform-api test <path>` (no `--`; see Verification note): `platform-sync.controller.spec.ts` + `platform-sync-coordinator.spec.ts` + `platform-data.module.spec.ts` + `platform-data-poll-job.spec.ts` — 20/20 passed. |
| Runtime | Real: `platform-sync.controller.spec.ts` integration describe boots a real Nest app (`AuthModule`, `PermissionsModule`, `DatabaseModule`) against the real Postgres test DB (`localhost:5434/viewpro_platform_test`) and drives it over real HTTP via `supertest` — login, session-revocation-after-login (403), and unauthenticated (401) all exercise the real `AuthGuard`/`PlatformPermissionGuard` chain; only `PlatformSyncCoordinator` is a test double. |
| Rollback | Revert only: `platform-sync.controller.ts` (new), `__tests__/platform-sync.controller.spec.ts` (new), the `getStatus()` addition in `platform-sync-coordinator.ts`, the `PlatformSyncController` wiring in `platform-data.module.ts`, and the two additive test assertions in `platform-sync-coordinator.spec.ts`/`platform-data.module.spec.ts`. No Slice A file's existing behavior changed. |
## Verification
- GREEN: `pnpm --filter @viewpro/platform-api typecheck` passed (`tsc --noEmit`, no errors). `git diff --check` passed (exit 0, no whitespace errors).
- Full safety-net suite (all platform-api tests): 599/599 passed across 67 files (baseline 590/66 + 9 new tests + 1 new file), confirming Slice A and pre-existing behavior unaffected.
- Note: `pnpm --filter @viewpro/platform-api test -- <path>` (with the literal `--`) does NOT scope to `<path>` in this pnpm/vitest combination — it silently runs the full suite instead. The equivalent that DOES scope correctly is `pnpm --filter @viewpro/platform-api test <path>` (no `--`), or `pnpm vitest run <path>` from inside `apps/viewpro-api`. All focused-run evidence above used the working form.
- Refactor/scope: no timer removal, no web changes, no #329 payload/BigInt validation, DB cancellation, multi-replica coordination, or durable-evidence work.
## Candidate Evidence
- Changed lines: 217 (39 modified across 4 pre-existing files + 178 in 2 new files); B.1–B.3 checked, C–D unchecked.
- Candidate method: SHA-256 of `git diff --binary --full-index 02b8977 -- . ':(exclude)openspec/changes/neon-idle-platform-sync/apply-progress.md'` (run from the outer worktree root, the actual git top-level) followed by sorted untracked `git diff --binary --full-index --no-index /dev/null <file>`, excluding this file.
- Candidate diff SHA-256: `f6d84071f0cb8d43f34eb704fe39acde285f48ad3dc13d3c81b06fa362630878`.
- Canonical payload (UTF-8, exact shown bytes plus one LF): `{"attempt":1,"attemptToken":"sha256:2a2e8d4332c39777bd847d78d179d60fd04f894ae3bc21a81439278b2064a452","base":"02b8977","candidateDiff":"sha256:f6d84071f0cb8d43f34eb704fe39acde285f48ad3dc13d3c81b06fa362630878","red":"getStatus-missing:2 failed;controller-module-not-found:suite failed to load","green":"controller+coordinator+module+poll-job:20;full-suite:599;typecheck;diff-check","changedLines":217}`.
- Evidence SHA-256: `6d01a091f3fa9961c3fcf856ed33676c54e589854b8873ab095ad5ab9384e93f`.

# Apply Progress: Slice C — complete (attempt 1)
## Scope
- `slice-c-web-demand-ux` (C.1–C.3); `viewpro-web` only, consumes Slice A/B API as-is; no D/timer-retirement/#329/E2E scope.
## TDD Cycle Evidence
| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| C.1 | 612/53 files passed (baseline) | 4 new spec files failed: `Cannot find module` for service/hook/badge | service+hook+badge created; focused run 9/9 passed | comments/JSX trimmed to fit the line budget |
| C.2 | same | Prior RED preserved | `features/platform-sync/{api,components}` created; `app/dashboard/layout.tsx` wraps children in `PlatformSyncProvider` | provider kept as pure composition (no own test — covered structurally by hook+badge) |
| C.3 | same | Prior RED preserved | full suite 621/56 files passed (no regression proves new-API/old-web); 404-fallback test proves old-API/new-web | grepped source: no `unload`/`beforeunload`/`pagehide` listener |
## Work Unit Evidence
| Focused | `pnpm vitest run src/features/platform-sync`: 9/9 passed (service 2, badge 4, hook 3). |
| Runtime | N/A: browser-only hook against a mocked `apiRequest`; real HTTP integration already proven by Slice B's controller test. |
| Rollback | Revert only `src/features/platform-sync/**` and the 2-line `app/dashboard/layout.tsx` wrap; no Slice A/B file touched. |
## Verification
- GREEN: `pnpm --filter viewpro-web typecheck` (`tsc --noEmit`, no errors) and `git diff --check` (exit 0) passed.
- Full suite: 621/621 passed across 56 files (baseline 612/53 + 9 new tests + 3 new files) — no regression.
## Candidate Evidence
- Changed lines: 317 (`git diff --numstat` against `d70b905`, source + `tasks.md`; `apply-progress.md` excluded per Slice A/B convention).

# Apply Progress: Slice D (D.1–D.3) — complete
## Scope
- `slice-d-retire-timer` (D.1–D.3); D.4/D.5 explicitly out (deploy-time/≥24h evidence). Worktree: `neon-idle-platform-sync-d`, base `origin/develop@e2d4c27` (A/B/C already merged).
## D.1 — evidence (recorded, not re-gathered; supplied by orchestrator)
Read-only Dokploy observation 2026-08-19T19:33:27Z, app `viewpro-platform-api` (`Lsl92KkwFQ4zjleYllaPY`), swarm `viewpro-platform-api-375xud`, project `inmoview-prod`/`production`: desired=1, healthy running=1 (`13f36b253a2d`, `Up 2 weeks (healthy)`), digest `sha256:93accbb...68a8b2f`, domain `api-console.inmoview.app`. Singleton gate PASSES. Operational fact: app auto-deploys from `main` (`autoDeploy: true`), not `develop` — Slices A–C merged to `develop` are not yet live.
## TDD Cycle Evidence
| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| D.2 | 599/67 (API), 621/56 (web) passed | N/A — approval-style gate over already-correct Slice A–C behavior (no new production code) | `platform-sync-compatibility.spec.ts`: 2/2 passed pre-deletion, rewritten post-D.3 against `coordinator.runOneBatch()` directly (still 2/2) | Trimmed doc comments to fit budget |
| D.3 | same | `env.schema.spec.ts` "no longer defines PLATFORM_POLL_INTERVAL_MS": 5000 received vs undefined expected — failed; `platform-data.module.spec.ts` "provides no interval poll job": true vs false — failed | Deleted `platform-data-poll-job.ts`+spec; removed provider/import from `platform-data.module.ts`; removed `PLATFORM_POLL_INTERVAL_MS` from `env.schema.ts`/`app.config.ts`/`.env.example`; both new tests pass | Stale doc comments in `platform-data.module.ts`/`platform-sync.controller.ts` corrected |
## Work Unit Evidence
| Focused | `pnpm --filter @viewpro/platform-api test <path>` (no `--`): `platform-sync-compatibility.spec.ts` 2/2, `platform-data.module.spec.ts` 3/3, `env.schema.spec.ts` 23/23 — all passed. |
| Runtime | Real: `platform-data.module.spec.ts` compiles the actual `PlatformDataModule` DI graph (no live DB, per its own doc comment) and resolves `PlatformSyncCoordinator`; reflection over real `@Module` metadata proves no poll-job provider remains. |
| Rollback | Revert only: deleted `platform-data-poll-job.ts`+spec, `platform-data.module.ts`, `platform-sync.controller.ts` comment, `CFG/{app.config.ts,env.schema.ts,__tests__/env.schema.spec.ts}`, `.env.example`, `RUNBOOK` line 205, new `platform-sync-compatibility.spec.ts`. No Slice A/B/C file's behavior changed. |
## Verification
- GREEN: `pnpm --filter @viewpro/platform-api typecheck` (`tsc --noEmit`, no errors) and `git diff --check` (exit 0) passed.
- Full suite: platform-api 598/598 across 67 files (baseline 599/67 − 5 deleted poll-job tests + 1 module + 1 env.schema + 2 compatibility = 598, matches exactly). viewpro-web 621/621 across 56 files — unaffected (Slice D touches no web file).
- Idle-quiet proof: `rg "setInterval|OnModuleInit" apps/viewpro-api/src/platform-data` (excluding `__tests__`) returns only a doc comment — no lifecycle hook or interval remains; `PlatformSyncCoordinator.runOneBatch()` is reachable only from `PlatformSyncController.demand()`.
- Scope: D.4 (merge/deploy gate) and D.5 (≥24h CU-hour evidence) untouched — both explicitly deferred to deploy time / post-deploy observation window.
## Candidate Evidence
- Changed lines: 291 (source + `tasks.md`, `git diff --numstat e2d4c27`) + 22 (this file's own diff) = 313 total, within the 220–340 budget (hard max 340).
