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

## Post-apply CI correction

- The first PR CI run exposed two stale exact-table-count assertions in `test/restore-schema-parity.spec.ts` (expected 23 product tables while S1 correctly adds two feedback tables). The correction updates the expected product count to 25 and includes both new tables in the canonical list; no product behavior or S1 scope boundary changed.
- Native remediation acquire for the settled S1 evidence returned `complete`, so no second SDD attempt was launched. The correction will be validated by the PR CI rerun.

## Delivery and status

- PR boundary: S1 only, ordinary/unmanaged delivery, no commit or lifecycle action performed.
- Consumed authoritative OpenSpec status: `applyState: ready`, `nextRecommended: apply`, allowed root is this worktree; strict TDD active. No unsafe action-context warning was supplied.
- Remaining implementation tasks: none for S1. Deferred parent lifecycle actions remain unchanged; later implementation rows remain unchecked.

## S2 — Authenticated durable submission boundary

- Added `POST /api/feedback` with ordered `AuthGuard`, `TenantMembershipGuard`, and S1 `FeedbackRateLimitGuard`, then server-derived user and tenant report creation.
- Added the exact DTO contract: `ERROR|SUGGESTION`, plaintext description length 10–2000, optional pathname-only ≤512, and lowercase canonical UUIDv4 request ID; global whitelist/forbid rejects identity spoofing.
- Added module/app wiring and focused unit/e2e coverage for both types, auth-success attribution, unauthenticated/non-member no-write, spoof rejection, input boundaries, and persistence rejection propagation.

## TDD Cycle Evidence

| Task | Layer | RED | GREEN / triangulation | REFACTOR |
|---|---|---|---|---|
| S2 DTO | Unit | Focused run failed on missing DTO import. | 2 tests pass across both types, 9/10/2000/2001, query/hash/length/UUID rejection, and canonical acceptance. | No behavior-preserving extraction needed. |
| S2 use case/controller | Unit | Focused run failed on missing controller import. | 2 tests pass for exact server-derived arguments and rejected repository persistence. | Kept dependency boundary minimal. |
| S2 HTTP boundary | PostgreSQL e2e | Route suite failed with 404 before module wiring. | 3 tests pass on test-worker PostgreSQL for 401/403 no-write, both-type authenticated success, and tenant/user attribution. | Final focused suite passed after all temporary restorations. |

## S2 Deliberate falsification evidence

| Mutation | Expected failing proof | Restoration |
|---|---|---|
| Removed `AuthGuard` | Authenticated-success e2e changed from 201 to 401 because `request.user` was never populated. | Restored ordered guard and focused auth-success passed. |
| Removed `TenantMembershipGuard` | Non-member and authenticated attribution tests failed; valid submission changed from 201 to 500 without tenant context. | Restored ordered guard and final focused suite passed. |
| Admitted body IDs and spread them after server IDs | Spoof-field e2e failed rather than accepting the required 400 boundary. | Removed temporary DTO fields and restored server IDs after body spread. |
| Removed pathname validator | DTO boundary assertion observed no errors for query/hash pathname input. | Restored `@Matches(PATHNAME)` and final focused suite passed. |

## S2 Verification and delivery

- `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts build`, and `pnpm db:generate` passed in the fresh worktree.
- Focused command: `pnpm --filter @viewpro/api exec vitest run src/feedback/__tests__/submit-feedback.dto.spec.ts src/feedback/__tests__/feedback.controller.spec.ts test/feedback.e2e-spec.ts --silent` passed: 3 files, 7 tests, on the configured per-worker test PostgreSQL database.
- `DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' DIRECT_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' pnpm --filter @viewpro/api exec sh -c 'prisma validate'` passed; `pnpm --filter @viewpro/api typecheck` passed; `pnpm --filter @viewpro/api test` passed: 131 files, 1,345 tests. `git diff --check` passed.
- No design deviation; notification is intentionally deferred to S3. PR boundary is S2 only, ordinary/unmanaged delivery, no commit or lifecycle action.
- Consumed authoritative status: `applyState: ready`, `nextRecommended: apply`, root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/in-app-feedback-s2-boundary`, strict TDD active, and supplied native attempt token `sha256:cba0b0db47ad364a33bb46023770deb7789186e8d2a41f5ed268c35cc70731d7`; no attempt was acquired or settled here.
- Task persistence warning: the delegated path restriction explicitly prohibited `tasks.md` edits, so the completed S2 implementation row remains unchecked and cannot be reported as reconciled by apply. Exact unchecked row: `- [ ] Implement and verify authenticated tenant-member validation and durable report creation. <!-- sdd-owner: implementation -->`.
