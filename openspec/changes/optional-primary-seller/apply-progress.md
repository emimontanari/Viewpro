# Apply Progress: optional-primary-seller — S1 schema persistence

## Scope and status
- Work unit `s1-ci-lint-remediation` (PR1/S1 only); adds only `candidateReplayFailure` as the AggregateError cause in `property-agent-primary-schema.spec.ts`; no PR2–PR7, production schema, migration, fixtures, cleanup helper, or test behavior changed.
- Native OpenSpec status consumed: `applyState: ready`, `nextRecommended: apply`, repo-local root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/optional-primary-seller-s1-schema`, no warnings; parent retains the active attempt token.
- Persisted S1 Slice 1A/1B implementation rows at `tasks.md:72-75,79-82` remain visibly checked: 8/8; all PR2+ and seven parent lifecycle rows remain untouched.
- First attempt was blocked solely by 449 changed lines (441 additions + 8 deletions), bound to failed evidence `sha256:188ebe0ff2cd972f631af35caaab60e616af93ff5066a2b1f753788926df7ebb`.

## TDD Cycle Evidence
| Slice | RED → GREEN | TRIANGULATE → REFACTOR |
|---|---|---|
| 1A schema/migration | RED removed named index: `primaryIndex` undefined (1F/2P); GREEN restored exact bytes, 3/3. | Replay seeds two legacy rows, proves false/zero, permits one true, rejects second with `23505`; additive/no-backfill retained. |
| 1B fixture | RED/GREEN adds only narrow-fixture `isPrimary: false`; focused use case remains 1 file/37 passed. | Scoped fixture only; no shared `ProductAgent`, auto-selection, or parallel entity. |
| Cleanup + CI lint | RED missing `cleanup-steps`; GREEN aggregate-and-continue 1/1; CI lint RED `preserve-caught-error` at schema spec:96. | Ordered all-success 2/2; lint GREEN after `AggregateError` ErrorOptions causes the caught replay failure to be preserved. |
- Fault injection appended `THIS_INTENTIONALLY_BREAKS_CANDIDATE_MIGRATION;`: replay failed as expected, then independent fallback restored `isPrimary` non-null/default false and named index; candidate bytes were immediately restored.
- Dependency remediation: identical-lock frozen `pnpm@10.13.1` temporary-store install ignored Prisma build scripts, so explicit `db:generate` and `@viewpro/contracts build` were required; generated links, `node_modules`, and contract `dist` were removed after checks.

## Final verification
- RED: `pnpm --filter @viewpro/api lint` — FAIL only `eslint(preserve-caught-error)` at `test/property-agent-primary-schema.spec.ts:96`; GREEN rerun after the cause change — PASS.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api exec vitest run test/cleanup-steps.spec.ts test/property-agent-primary-schema.spec.ts` — PASS, 2 files/5 tests.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api db:validate` — PASS.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api typecheck` — PASS.
- `git diff --no-ext-diff --check` — PASS; `--no-ext-diff` bypasses this worktree's configured `/bin/false` external diff.
- Every database command used only local `viewpro_test` and derived `viewpro_test_w1`–`w4`; no Neon, development `viewpro`, production, or other database was accessed.

## Candidate budget and boundary
- Corrected full-candidate accounting, including docs/tasks: `git diff --no-ext-diff --numstat HEAD^` = 390 additions + 8 deletions; total = 398 changed lines (<=400).
- The 398-line candidate includes progress 30, migration 8, cleanup spec 57, cleanup helper 22, schema spec 262, and docs/tasks; no generated dependency artifacts remain.
- Residual risk: Prisma cannot declare the partial unique index; the named raw migration and automated live PostgreSQL replay remain its contract.
- `auto-chain` boundary is S1 only; PR2 owns transaction/eligibility/error mapping and begins only from refreshed landed `develop`; next action is `parent-lifecycle`.
