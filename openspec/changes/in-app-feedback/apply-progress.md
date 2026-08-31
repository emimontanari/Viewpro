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

## S3 — Durable-before-email notification and production configuration

- Added a feedback-only notifier port, escaped approved-field text/HTML renderer, Resend adapter, deterministic development/test no-op, and module token binding; shared email abstractions, routing, health, Sentry, UI, and BFF were untouched.
- `SubmitFeedbackUseCase` now awaits durable report creation before exactly one notification call; notifier errors are mapped to the closed categories/codes and logged only as `{ reportId, timestamp, category, code }`, while accepted success is retained.
- Production validation now requires one trimmed valid `FEEDBACK_RECIPIENT_EMAIL` and `RESEND_API_KEY`; app config exposes the recipient and `.env.example` documents it.

## S3 TDD Cycle Evidence

| Task | Layer | RED | GREEN / triangulation | REFACTOR |
|---|---|---|---|---|
| notifier/template | Unit | Missing template/adapter imports and unimplemented ordering, failure, escape, and redaction assertions failed. | Focused suite passed 24 tests: escaping/literal text, optional fields, durable-before-one-send, persistence rejection, no-op, and all four closed diagnostics. | Kept rendering pure and notifier port narrow; final focused suite and typecheck passed. |
| production config | Unit | Missing recipient/key validation and recipient trim assertions failed. | Missing, malformed, multi-recipient, and missing-key production cases fail; single trimmed recipient passes. | Retained validation as the production readiness gate and deterministic non-production adapter selection. |

## S3 Deliberate falsification evidence

| Mutation | Expected failing proof | Restoration |
|---|---|---|
| Rethrew the caught notifier failure | `feedback-notifier.spec.ts` rejected hostile provider failure instead of resolving accepted success. | Restored swallow-plus-sanitized log; focused suite green. |
| Logged `description` rather than allowlisted diagnostic | Exact logger payload/redaction assertion failed. | Restored exactly `{ reportId, timestamp, category, code }`; focused suite green. |
| Removed the production recipient guard | Production missing-recipient config case no longer threw. | Restored recipient guard; focused suite green. |

## S3 Verification and delivery

- Safety net before edits: existing controller/config tests passed (14 tests); bootstrap commands `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts build`, and `pnpm db:generate` passed.
- With `NODE_ENV=test`, `DATABASE_URL`, `DIRECT_URL`, and `VIEWPRO_TEST_BASE_DATABASE_URL` set to clearly marked `viewpro_test_s3`, the mandated focused command passed: 3 files / 24 tests. The supplied `src/config/__tests__/app.config.spec.ts` path does not exist; its actual repository path `src/config/app.config.spec.ts` separately passed (4 tests).
- `pnpm --filter @viewpro/api typecheck`, `pnpm --filter @viewpro/api test` (135 files / 1,368 tests), and `git diff --check` passed. No design deviations.
- PR boundary: S3 only, ordinary/unmanaged delivery; no commit, push, PR, RDD, or lifecycle operation was performed. Consumed authoritative status `applyState: ready`, `nextRecommended: apply`, root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/in-app-feedback-s3-notifications`, strict TDD active, and supplied native token `sha256:cff105c05b7aea1ce7973d8281f5ce7a13673a2b303cf2e6b3136e55ebd4b61a`; no attempt action was taken.
- The delegated S3 contract prohibited `tasks.md` changes, so no task checkbox was persisted. Exact unchecked implementation row remains: `- [ ] Implement and verify the dedicated sanitized notifier and fail-safe environment selection. <!-- sdd-owner: implementation -->`.

## Post-apply CI correction

- Independent verification reproduced a full API-suite cleanup failure in the S2 feedback e2e fixture: existing `property_assets` rows could reference users before the suite deleted users. The fixture now deletes property-asset owners, agents, engagements, and assets before users, matching the repository's established e2e cleanup order; this is test isolation only and does not change product behavior.
- `feedback.controller.spec.ts` is updated only as the existing S2 use-case constructor fixture required by the S3 notifier dependency; it remains within the feedback test surface.

## S4 — Provenance-preserving BFF submission

- Added `POST /api/feedback`, which proxies JSON to `/feedback` with the existing authenticated/tenant-aware `bffFetch` transport and preserves proxy status/body error semantics.
- `proxyJsonResponse` forwards only a canonical lowercase UUIDv4 backend `x-request-id`; `bffRequest` keeps only the latest canonical header (preferred) or body fallback in browser-private memory.
- Added typed `submitFeedback({ type, description })`; it derives `window.location.pathname`, reads the clear-only private ID getter, and conditionally sends that proven value without accepting a caller request-ID argument.

## S4 TDD Cycle Evidence

| Task | Layer | Safety net / RED | GREEN / TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| BFF provenance | Unit | Existing client safety net passed 13 tests after bootstrap; new tests failed for missing route/service/exports and absent header propagation. | 26 mandated focused tests passed: header preference/body fallback, invalid/uppercase/non-v4 rejection, SSR empty, clear-only exports, pathname, and service provenance. | Extracted canonical checks and reran focused tests after lint cleanup. |
| Feedback BFF route | Route unit | New route test failed because `./route` was absent. | 2 tests passed for POST proxying and 502 body/status transport. | No further refactor needed. |

## S4 Deliberate falsification evidence

| Mutation | Expected failing proof | Restoration |
|---|---|---|
| Forwarded arbitrary `x-request-id` values | `bff-api.test.ts` failed 2 allowlist cases (uppercase and arbitrary IDs). | Restored canonical UUIDv4 filter; 3 tests passed. |
| Added public `setLatestApplicationRequestId(requestId)` | Export-surface test failed on the extra value-taking setter. | Removed setter; client suite passed 20 tests. |
| Added a caller `requestId` parameter to `submitFeedback` | Service provenance test failed because the exported function had two parameters. | Removed the parameter; service suite passed 3 tests. |
| Allowed SSR capture and SSR getter access | SSR provenance test exposed the canonical ID instead of `undefined`. | Restored browser guard; client suite passed 20 tests. |

## S4 Verification and delivery

- Bootstrap passed from `viewpro-app`: `pnpm install --frozen-lockfile`; `pnpm --filter @viewpro/contracts build`; `pnpm db:generate`. Initial safety run could not resolve contracts before its required build; the post-bootstrap safety net passed 13 client tests.
- Passed: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/bff-api.test.ts src/lib/__tests__/bff-client.spec.ts src/features/feedback/api/service.test.ts` (3 files / 26 tests); route test separately (1 file / 2 tests); `lint:strict`; `typecheck`; and package `test` (111 files / 685 tests).
- `git diff --check` passed. No design deviations. PR boundary: S4 only, ordinary/unmanaged delivery; no commit, push, PR, RDD, or lifecycle action was performed.
- Consumed authoritative status `applyState: ready`, `nextRecommended: apply`, supplied root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/in-app-feedback-s4-bff`, strict TDD, and parent-provided token `sha256:80608addd16b8352d2025ad71ba51497a9562d777b7c77c1e2174904f7252964`; no native attempt action was taken.
- Completed the S4 implementation task; the canonical `tasks.md` plan remains unchanged in this work unit and will be reconciled through the normal SDD evidence/sync flow.
- Deferred parent lifecycle actions: settle the supplied native S4 attempt, independently verify, then perform ordinary commit/PR delivery; RDD remains disabled.

## S5 — Authenticated floating feedback flow

- Added the client-only `FeedbackWidget` and mounted it after the authenticated dashboard structure, leaving navigation, auth, owners, BFF/service, and icon registry untouched.
- The floating Spanish-labelled trigger uses `Icons.chat`, safe-area placement, the Radix dialog, exactly `ERROR`/`SUGGESTION`, 10–2000 local validation/count, duplicate prevention, spinner, durable acceptance, structured safe failures, retry preservation, explicit discard, and `aria-live`/alert feedback.
- Mount and unmount each call the S4 clear-only provenance API; the widget has no request-ID field and passes only typed `{ type, description }` to the existing service.

## S5 TDD Cycle Evidence

| Task | Layer | Safety net / RED | GREEN / TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| S5 widget | Component integration | New focused test failed before production because `./feedback-widget` did not exist. | 9 tests pass: choices/bounds, invalid input, duplicate progress, durable success, generic retry, discard, 429/session copy, lifecycle, and equal-status/prose isolation. | Re-ran focused tests after lifecycle cleanup, mock isolation, accessibility label, and lint fixes. |

## S5 Deliberate falsification evidence

| Mutation | Expected failing proof | Restoration |
|---|---|---|
| Omitted mount clear | Lifecycle test expected first mount clear once, received zero. | Restored mount clear; focused suite passed. |
| Omitted unmount cleanup | Lifecycle test expected two calls after unmount, received one. | Restored cleanup; focused suite passed. |
| Branched generic copy on `error.message` | Equal-status/different-message test returned `one` versus `another`; hostile-prose assertion also failed. | Restored structured status/errorCode-only copy; focused suite passed. |
| Added a Request ID form input | No-request-ID provenance assertion found the injected input. | Removed it; focused suite passed. |

## S5 Verification and delivery

- Bootstrap from `viewpro-app`: `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts build`, and `pnpm db:generate` passed. The pre-bootstrap focused command could not find `vitest`; after installation the RED command failed as expected on the missing widget import.
- Passed focused command repeatedly after GREEN/restorations: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/feedback/components/feedback-widget.test.tsx` (final: 1 file / 9 tests).
- Passed: `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `pnpm --filter next-shadcn-dashboard-starter typecheck`, and package `test` (112 files / 694 tests); `git diff --check` passed.
- No design deviation. S5 PR boundary is widget, focused test, dashboard mount, and this evidence only; ordinary/unmanaged delivery applies and RDD remains disabled. No commit, push, PR, review, or attempt acquisition/settlement was performed; parent retains the supplied S5 attempt token and lifecycle.
- Consumed authoritative native status: `applyState: ready`, `nextRecommended: apply`, repo-local root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/in-app-feedback-s5-widget`, and that root is the only allowed edit root. No action-context warnings.
- Task artifact is intentionally stale by explicit parent direction, so `tasks.md` was not edited. Exact S5 row remains unchecked: `- [ ] Implement and verify the complete floating widget with safe success, retry, rate-limit, and accessibility states. <!-- sdd-owner: implementation -->`.

## V1 — Final cross-slice verification

- Verified the integrated chain at `f4d4eca1` using PostgreSQL `viewpro_test` and derived workers only; no development/production database was used.
- Recorded premise baselines: API command remained 48/48; frontend command passed 36/36 because seven S4 provenance tests now extend the original 29-test subset.
- Passed `pnpm db:generate`, API schema validation/typecheck, full API (137 files / 1,379 tests), full frontend (112 files / 694 tests), strict frontend lint, and seeded Playwright (32 tests).
- Focused cross-slice aggregates passed: API S1–S3/config 11 files / 41 tests; frontend S4–S5 5 files / 37 tests.
- `prisma migrate status` reports 30 migrations and an up-to-date test schema; generated DMMF exposes both feedback models and `FeedbackType(ERROR,SUGGESTION)`.
- Confirmed all S1–S5 deliberate mutation/restoration evidence remains present, feature commits respect sequential slice/cap boundaries, and forbidden #307 surfaces were untouched.
- `git diff --check` passed before evidence edits. Full command detail, setup failures, assertion audit, residual risks, and the unreconciled V1 checkbox are in `verify-report.md`.
- V1 did not edit `tasks.md` by authority; task-state reconciliation remains parent/native work after this evidence phase.
