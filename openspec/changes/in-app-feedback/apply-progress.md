# Apply Progress: in-app-feedback

## S1 — Atomic tenant-pair quota foundation

- Completed the S1 implementation task; the canonical `tasks.md` plan remains unchanged in this work unit and will be updated through the normal SDD evidence/sync flow.
- Added `FeedbackType`, tenant-owned report/attempt models, their relations/indexes, and visible `20260831090000_add_feedback` SQL migration.
- Added repository tokens plus Prisma `reserveAttempt`: parameterized transaction-scoped PostgreSQL advisory lock, database `CURRENT_TIMESTAMP`, tenant expiry deletion, exact pair count, and conditional insert.
- Added the guard seam with authorized request fields and stable HTTP 429; S1 intentionally does not bind an HTTP controller.
- Registered `FeedbackReport` and `FeedbackSubmissionAttempt` in `TENANT_OWNED_MODELS`.

## TDD Cycle Evidence

| Task | Layer | RED | GREEN / triangulation | REFACTOR |
|---|---|---|---|---|
| S1 quota guard | Unit | Missing guard/repository imports failed in the focused suite. | Allowed reservation and limited-to-429 cases pass. | Re-ran after narrowing 429 assertion to status. |
| S1 reservation/migration | PostgreSQL integration | Missing repository import failed in the focused suite. | Five/six concurrent result, row count, cutoff expiry, and separate user/tenant pairs pass on `viewpro_test`. | Re-ran after order-independent concurrency assertions and typed DB-time result handling. |
| S1 registry | Unit | Schema parity initially required new model registration. | Both model entries pass schema parity. | Re-ran focused suite after all restorations. |

## Deliberate falsification evidence

| Mutation | Expected failure | Restoration |
|---|---|---|
| Guard always allowed | limited reservation resolved `true` instead of rejecting 429. | Restored status-429 branch; final focused suite green. |
| Removed advisory lock | real PostgreSQL concurrent-six test observed six `allowed` results. | Restored `pg_advisory_xact_lock`; five allowed, one limited, five rows. |
| Removed `FeedbackReport` registry entry | schema parity reported the missing `FeedbackReport`. | Restored entry. |
| Removed `FeedbackSubmissionAttempt` registry entry | schema parity reported the missing `FeedbackSubmissionAttempt`. | Restored entry. |

## Verification

- `pnpm install --frozen-lockfile` and `pnpm --filter @viewpro/contracts build` passed.
- With `TEST_DATABASE_URL`/`DATABASE_URL`/`DIRECT_URL` set to `postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public`: `pnpm --filter @viewpro/api db:validate`, `pnpm --filter @viewpro/api db:generate`, and `pnpm --filter @viewpro/api typecheck` passed.
- Executed from `viewpro-app/apps/api`: `pnpm exec vitest run src/feedback/__tests__/feedback-rate-limit.guard.spec.ts src/feedback/__tests__/feedback-rate-limit.repository.spec.ts src/database/tenant-isolation.registry.spec.ts test/feedback-rate-limit.e2e-spec.ts --silent`; all 4 files / 6 tests passed against real PostgreSQL.
- `git diff --check` passed. No design deviations.

## Delivery and status

- PR boundary: S1 only, ordinary/unmanaged delivery, no commit or lifecycle action performed.
- Consumed authoritative OpenSpec status: `applyState: ready`, `nextRecommended: apply`, allowed root is this worktree; strict TDD active. No unsafe action-context warning was supplied.
- Remaining implementation tasks: none for S1. Deferred parent lifecycle actions remain unchanged; later implementation rows remain unchecked.
