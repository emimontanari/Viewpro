# U12 verification mapping

- Skill resolution: `paths-injected` (`gentle-ai`). Preflight: auto / OpenSpec / ask-on-risk / 400; model default balanced.
- Read live ledger first, OpenSpec config, accepted tasks/evidence/commands/spec/design/delivery plan/apply progress, and current PostgreSQL race harnesses. Native `gentle-ai sdd-status` was unavailable to this executor because no command-execution tool is exposed.

## Exact U12 scope

1. U12 is verification-only and is ready as the next source unit after completed U11B1/U11B2/U11B3; it is not global SDD verify.
2. Add/repeat only already-green eligibility, reviewer, approval, quota, direct-path, primary, and cleanup behavior. It owns no first RED, production fix, schema, transport, UI, or product change.
3. Its manifest is `apps/api/test/property-proposal-concurrency-matrix.e2e-spec.ts`, `apps/api/test/property-proposal-concurrency-fixtures.ts`, and the existing `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts`.
4. Every race must use independently named clients, bounded connection/statement/lock and observation timeouts, and PostgreSQL `pg_stat_activity` / `pg_blocking_pids` evidence rather than unsettled promises. Every `finally` releases barriers, settles operations, disconnects clients, restores limits, and deletes source engagements, captured orphan assets, proposals/history, tenant data, and users in dependency order.

## Coverage and gaps

- Existing `test/property-proposal-eligibility-race.spec.ts` covers eight create/update × deactivation/role-change × lock-order cases with a real lock observer.
- Existing `test/property-proposal-approval-race.spec.ts` covers four same-proposal approval/rejection cases plus six final-slot approval/direct-create/restore cases, coded/public quota outcomes, exact blocker PID, and aggregate cleanup.
- Existing `test/property-agent-primary-concurrency.e2e-spec.ts` covers primary set/clear/remove serialization, invalidation ordering, rollback, sole non-primary assignment, and explicit set/change/clear.
- The two U12 proposal-matrix files do not exist in this worktree, so no repeatable U12 cross-area matrix or shared U12 fixture helper is currently covered. The normative U12 command therefore cannot pass until verification-only test code is supplied.
- U12 final evidence maps S32, S33, S41, and S42 only; it does not replace the completed first-green owners or later U22 API/App integration evidence.

## Execution prerequisites and bounded strategy

- Run from `viewpro-app`; use `pnpm@10.13.1`. Install only if required: `pnpm install --offline --frozen-lockfile`; generate Prisma before Prisma-importing tests: `pnpm --filter @viewpro/api db:generate` (or forced API Turbo typecheck where generation is needed).
- Before any database command, require a localhost/127.0.0.1 `DATABASE_URL` whose decoded database name matches the normative `_test` regex, and set matching `DIRECT_URL`. No Neon, providers, or external services.
- The API Vitest config always executes `test/global-setup.ts`: it deploys migrations to `viewpro_test` and clones worker databases `viewpro_test_w1`–`w4`; `setup-env.ts` then maps each worker to its own database. This is database-mutating and was not run here.
- Exact U12 evidence command: `pnpm --filter @viewpro/api exec vitest run test/property-proposal-concurrency-matrix.e2e-spec.ts test/property-agent-primary-concurrency.e2e-spec.ts`; repeat exactly the same command. The default config has `retry: 2`; do not silently substitute a global full-suite verify.
- Keep local execution to the guarded U12 command twice, optionally preceded by the existing focused prerequisite races with `--retry=0` only for diagnostic isolation. Record each run's result, timeout/lock observation, cleanup/postcheck, skips, blockers, and residual risk; do not run DB work in this mapping phase.

## Documentation and budget

- Planned source/test surfaces only: the two new U12 matrix/fixture files and the existing primary concurrency file if a repeat-only assertion is genuinely needed.
- Minimal closure documentation is the two existing U12 checkboxes in `tasks.md` plus a concise U12 section in `apply-progress.md`; `task-verification-commands.md`, the evidence matrix, spec, design, and delivery plan already prescribe the scope and need no edit unless an exact command/requirement changes.
- The accepted U12 forecast is 310–370 changed lines, including `property-proposal-concurrency-matrix` T150–170/F45–55, fixtures T45–55/F45–55, and primary test T25–35. Preserve this bound; pause for the ask-on-risk gate if the honest candidate forecast exceeds 400.

## U12 bounded correction: invalidation signal lifecycle

- The two held-invalidation paths in the primary harness previously awaited a signal promise directly. If the invalidation transaction rejected before signaling, that await never settled, so the test body could not enter its `finally`; Vitest timeout would not release the transaction or fixture.
- The correction races the signal against both transaction settlement and the existing 2-second observation deadline. A pre-signal fulfillment or rejection therefore fails explicitly and reaches cleanup.
- Fixture construction now occurs inside each protected block. Finalization releases the held transaction/barrier, waits for every launched operation to settle, runs fixture cleanup, and aggregates the primary, unexpected-settlement, and cleanup failures instead of masking the original failure.
- This is U12 repeat-only test-harness reliability work. It neither adds a first RED nor changes production behavior, schema, transport, or fixture ownership.
