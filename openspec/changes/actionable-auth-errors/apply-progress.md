# Apply Progress: Actionable Auth and Invitation Errors (#285)

## Status and Identity
Phase 1 (WU-A) complete in Strict TDD mode; phases 2-6 not started. Delivery is `dependency-parallel-to-develop`: A ships first because every later unit needs its catalog.

## Completed Tasks
- [x] 1.1-1.3 RED: catalog assertion extended to 25 with the prefix frozen at 14; hermetic boundary harness and per-file exhaustiveness guards created; guard scope confirmed to exclude `login.use-case.ts` and `register-tenant.use-case.ts`.
- [x] 1.4 Pre-GREEN grep: no test or consumer binds the legacy `error` field on the seven annotated routes, so its documented degradation to the filter default `'Error'` breaks nothing.
- [x] 1.5-1.6 GREEN: 11 codes appended after `REQUEST_FAILED`; 7 sites annotated inline per ADR-1 with every message string byte-identical.
- [x] 1.7-1.9 REFACTOR: full focused matrix, both typechecks, and the derived e2e suite.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `pnpm --filter @viewpro/contracts test` | 3/3 before edits |
| RED 1 | `NODE_ENV=production pnpm --filter @viewpro/contracts test` | exit 1; **2 failed, 3 passed** — catalog still 14 codes against 25 expected |
| RED 2 | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | exit 1; **10 failed, 1 passed** — 5 boundary cases missing `errorCode` (message already sanitized), 5 exhaustiveness guards showing throw-count against `errorCode:`-count mismatch |
| GREEN | both commands unchanged | contracts **5/5**; boundary harness **11/11** |
| TRIANGULATE | `test/errors.e2e-spec.ts` | **39/39** — grew automatically because `PUBLIC_ERROR_CASES` derives from the catalog, with no edit to that file |
| REFACTOR | contracts test + typecheck, API focused matrix, API typecheck | 4 files / **77 tests**, both typechecks clean |
| Regression | the five files holding the nine `'Authentication required'` assertions | 5 files / **102 tests**, all unmodified |
| Consumer | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts` | **7/7** |

## Work Unit Evidence
- Runtime harness: `new GlobalExceptionFilter('production', undefined, {})` with a direct `ArgumentsHost` (ADR-2). Production-mode sanitization is exercised without a live app and without a process-wide env var, so the assertion holds regardless of how the suite is invoked. Every REFACTOR command re-runs at default `NODE_ENV` to prove no leakage.
- Enumeration protection: `login.use-case.ts:35` and `register-tenant.use-case.ts:52` are untouched, confirmed by `git status` and by task 1.3's scope-exclusion guard.
- Message preservation: `HttpException.initMessage()` reads `message` off an object-form response, so annotating a throw leaves `.message` byte-identical. The nine pre-existing assertions passed unmodified; none was edited to accommodate the change.
- WU-A count: **222 additions + 10 deletions = 232 changed lines** of source and tests, 168 under the 400-line budget. `git diff --check` passes.

## Deviations and Issues
- Task 1.2 stated "4 boundary cases" while enumerating 5 files. Implemented 5, one per annotated file, because the spec gives `verify-email` and `reset-password` separate scenarios and collapsing them would leave one `AUTH_TOKEN_INVALID` producer without boundary coverage. The task text has been corrected to 5.
- Docker was down at batch start, so DB-backed suites failed with `PrismaClientInitializationError`. Environmental, not a regression: Docker was started, both Postgres containers reached healthy, and the suites passed on rerun.

## Rollback Boundary
Revert `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `auth.guard.ts`, `get-current-user.use-case.ts`, `refresh-session.use-case.ts`, `verify-email.use-case.ts`, `reset-password.use-case.ts`; delete `apps/api/test/public-error-annotations.spec.ts`. WU-A reverts **last** — B1, B2 and C1 must revert first, or their producers reference absent codes.

## Remaining
Phases 2-6 pending. No user-visible behavior changes until the view slices C1 and C2 ship; WU-A only makes the codes available on the wire.
