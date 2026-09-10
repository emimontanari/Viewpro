# Tasks — issue599 owner-seeded denial retry
## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | 140–220 including tests and evidence |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
## Strict TDD implementation
### RED
- [x] Extend `viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts` with compact callback tests for both owner detail options: typed `BffError(404)` stops immediately; non-404/network failures allow counts `0..2` and stop at `3`. <!-- sdd-owner: implementation -->
### GREEN
- [x] Add a local shared predicate in `viewpro-app/apps/app-new/src/features/owner/api/queries.ts` using `isBffError`, terminal only for typed status `404` and otherwise preserving `failureCount < 3`. <!-- sdd-owner: implementation -->
- [x] Wire the predicate only into `ownerPropertyOptions` and `ownerPropertyEngagementsOptions`; preserve all global, list, and other owner-query retry behavior. <!-- sdd-owner: implementation -->
### TRIANGULATE
- [x] Change Martin's three upstream flags in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` to bounded `await expect.poll(() => flag).toBe(true)` waits after reload and heading; preserve authorized assertions and timeouts. <!-- sdd-owner: implementation -->
- [x] Run the focused owner query-option Vitest suite through RED, GREEN, and triangulation; retain the seeded denial no-leak assertions and document the unavailable seeded runtime. <!-- sdd-owner: implementation -->
### REFACTOR
- [x] Keep imports and naming compact; run frontend typecheck and strict lint, confirming changes are limited to the approved owner queries/tests, seeded smoke test, and OpenSpec evidence. <!-- sdd-owner: implementation -->
## Evidence, line budget, and delivery
- [x] Update `openspec/changes/owner-seeded-denial-retry/apply-progress.md` with concise commands/results, boundary evidence, rollback, mutation, seeded-runtime limitation, and line budget. <!-- sdd-owner: implementation -->
- [x] Run focused frontend Vitest, `lint:strict`, and `typecheck`; record that targeted `test:seeded` is skipped because its `demo:seed` setup lacks `DATABASE_URL` (P1001). <!-- sdd-owner: implementation -->
## Parent lifecycle
- [ ] Start or reuse bounded review after apply, then prepare one issue599 PR with `openspec/changes/owner-seeded-denial-retry/{tasks.md,apply-progress.md,verify-report.md}` and clean diff targeting `develop`; this phase creates no commit. <!-- sdd-owner: parent -->
