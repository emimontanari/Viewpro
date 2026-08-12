## Exploration: Platform API in-process test seeding

### Current State
Issue #311 is the approved active P0 reliability work. #310 merged through PR #312 and is closed; the current platform-api integration setup shells out from Vitest into the production seed command:

`beforeAll` → local `seedOperator`/direct `execSync` → `pnpm db:seed` → `ts-node prisma/seed.ts` → new `PrismaClient` → `argon2.hash` → `operator.upsert` → `$disconnect`.

The root checkout currently contains 15 direct `execSync('pnpm db:seed')` sites across 14 normal integration spec files, producing 34 seed-process launches in one complete platform-api run. The production contract spec adds two intentional launches. In the current `platform-control.controller.spec.ts`, six operators are launched sequentially, not seven as stated in issue #311 and Engram #6789; this inventory discrepancy does not change the root cause because the hook still repeats pnpm, ts-node, Prisma startup, Argon2 work, and client teardown under Turbo contention.

Production `prisma/seed.ts` is intentionally an executable script, not an importable fixture API. It validates two environment variables, computes a default Argon2 hash, and idempotently upserts by email with `update: {}` and an explicit `ACTIVE`/`OWNER` create payload. Existing operators are therefore not reset on rerun. Its module-owned Prisma client disconnects in `finally`. `src/database/__tests__/seed.spec.ts` is the named subprocess contract test for create, explicit OWNER, idempotence, and InmoView DB isolation; it should remain the only integration consumer of the real CLI seed.

Normal integration tests need a different contract: deterministic reset of password hash, role, and status on the guarded test database. Several suites currently compensate for production seed no-op updates with follow-up Prisma updates. The Nest application already owns a guarded `PrismaService`, and `AuthModule` already provides the production `PASSWORD_HASHER`; those are the reusable in-process seams. Closing the Nest app invokes `PrismaService.onModuleDestroy()` and disconnects the client.

Vitest sets `fileParallelism: false`, `hookTimeout: 30000`, `testTimeout: 30000`, and `retry: 2`. This serializes files only inside platform-api. Root `turbo test` has no global serialization, so workspace suites still contend concurrently. `test/setup-env.ts` marks test runtime, removes `INMV_DATABASE_URL`, loads `.env.test`, defaults to `viewpro_platform_test`, and calls `assertSafeTestDatabaseUrl()` before tests. `PrismaService` repeats that guard on construction.

### Affected Areas
- `viewpro-app/apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts` — highest-impact hook; currently six sequential CLI seed launches and explicit role/status repair.
- `viewpro-app/apps/viewpro-api/src/operators/__tests__/operators.controller.spec.ts` — three launches and persisted-state repair.
- `viewpro-app/apps/viewpro-api/src/payments/__tests__/payments.controller.spec.ts` — three launches plus role updates.
- `viewpro-app/apps/viewpro-api/src/payments/__tests__/revenue.controller.spec.ts` — two launches plus role updates.
- `viewpro-app/apps/viewpro-api/src/payments/__tests__/judgment-fixes.spec.ts` — one direct launch.
- `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/audit.controller.spec.ts` — three launches plus role updates.
- `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/metrics.controller.spec.ts` — three launches plus role updates.
- `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/tenant-registry.controller.spec.ts` — three launches plus role updates.
- `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/tenant-detail.controller.spec.ts` — shared local helper used for four launches across two describe blocks.
- `viewpro-app/apps/viewpro-api/src/auth/__tests__/auth.controller.spec.ts` — one direct launch before app bootstrap.
- `viewpro-app/apps/viewpro-api/src/auth/__tests__/auth-me.controller.spec.ts` — one direct launch before app bootstrap.
- `viewpro-app/apps/viewpro-api/src/auth/__tests__/auth-idle-timeout.spec.ts` — one direct launch before app bootstrap.
- `viewpro-app/apps/viewpro-api/src/auth/__tests__/isolation.spec.ts` — one direct launch while preserving the absent InmoView DB invariant.
- `viewpro-app/apps/viewpro-api/src/auth/__tests__/step-up.controller.spec.ts` — two direct launches in separate app describe blocks.
- `viewpro-app/apps/viewpro-api/src/test-support/operator.fixture.ts` — recommended new shared test-only fixture accepting `PrismaService` and `IPasswordHasher`, with explicit email/password/role/status input and deterministic upsert create/update payloads.
- `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator.fixture.spec.ts` — PR1-only behavioral fixture coverage.
- `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator-fixture-boundary.spec.ts` — PR2-only source/Node16 dependency-closure ratchet.
- `viewpro-app/apps/viewpro-api/prisma/seed.ts` — production executable contract; inspect and retain unchanged.
- `viewpro-app/apps/viewpro-api/src/database/__tests__/seed.spec.ts` — retain as the sole named real-seed subprocess contract test.
- `viewpro-app/apps/viewpro-api/src/database/prisma.service.ts` and `src/database/test-database-url.guard.ts` — existing guarded client/lifecycle seams; retain unchanged.
- `viewpro-app/apps/viewpro-api/test/setup-env.ts`, `vitest.config.ts`, `package.json`, and root `turbo.json` — retain test DB safety, 30-second timeout, and global Turbo concurrency; PR2 alone may add command-scoped zero-retry control to Vitest.

### Call Paths and Blast Radius
- Current normal path: integration `beforeAll` → 15 source-level CLI call sites → 34 runtime process launches → package `db:seed` script → production `prisma/seed.ts` → Argon2 → no-op-on-existing upsert → per-process disconnect.
- Recommended normal path: app/module bootstrap → resolve `PrismaService` and `PASSWORD_HASHER` from Nest DI → shared `seedOperatorFixture` → in-process Argon2 hash → explicit operator upsert create/update → `app.close()` → one Prisma lifecycle disconnect.
- Retained production path: `seed.spec.ts` → two CLI launches → production seed script. This preserves executable packaging, environment validation, explicit OWNER creation, no-duplicate behavior, and database isolation evidence.
- Direct consumers are test-only. No controller, use case, repository, schema, migration, platform contract, production seed, global Turbo setting, or timeout changes; PR2 may change only Vitest retry control for acceptance evidence.

### Root Cause
High confidence: repeated synchronous seed subprocess startup is unnecessary integration-fixture work and becomes nondeterministic at the exact 30-second hook boundary when Turbo runs workspace tests concurrently. The failure predated the now-merged #310 dependency remediation, which was outside this call path. Timeout inflation would only widen the edge while retaining 34 normal-suite process launches and production-seed coupling.

### Approaches
1. **Shared DI-backed in-process operator fixture** — bootstrap the Nest test module, resolve its guarded `PrismaService` and `PASSWORD_HASHER`, and upsert requested test state through one shared helper; retain CLI use only in `seed.spec.ts`.
   - Pros: removes process startup at the root; reuses the real Argon2 provider and guarded client; resets stale role/status/password deterministically; preserves production seed coverage; no new product state or flag.
   - Cons: auth suites that currently seed before app construction must reorder setup; a test-support module is compiled under the current `src/**/*.ts` TypeScript boundary.
   - Effort: Medium.

2. **Extract production seed into an importable library and reuse it** — refactor `prisma/seed.ts` into exported logic with injected Prisma/hasher dependencies.
   - Pros: one seed implementation.
   - Cons: broadens a test-infrastructure fix into production seed refactoring; production `update: {}` semantics do not reset mutated test state; introduces module-entry/lifecycle risk and still needs test-only role/status repair.
   - Effort: Medium/High. Rejected unless later evidence shows the executable contract itself requires refactoring.

3. **One global CLI seed or suite-global operator pool** — reduce launches through Vitest global setup and share rows across files.
   - Pros: fewer processes than today.
   - Cons: preserves shell coupling, creates cross-file mutable state and ordering dependence, complicates future worker isolation, and does not consolidate explicit fixture state cleanly.
   - Effort: Medium. Rejected.

4. **Raise timeouts or serialize Turbo globally** — add more headroom without changing fixture setup.
   - Pros: smallest immediate diff.
   - Cons: hides waste, slows feedback, leaves the root flake load-dependent, and changes repository-wide execution policy for one local defect.
   - Effort: Low. Explicitly rejected.

### Recommendation
Use Approach 1 across sequential PR0 → PR1 → PR2: PR0 independently reviews the five planning artifacts, PR1 test-drives fixture/foundation, and PR2 atomically migrates consumers, activates the ratchet, and adds retry control. The fixture accepts explicit `email`, `password`, `role` (default OWNER), and `status` (default ACTIVE); hashes through app-provided `PASSWORD_HASHER`; resets create/update state; owns no client; and never bypasses `assertSafeTestDatabaseUrl()`.

Keep `prisma/seed.ts` and `seed.spec.ts` unchanged. Add a regression assertion that all normal platform-api integration specs are free of `node:child_process`/`pnpm db:seed`, with an explicit allow-list for `src/database/__tests__/seed.spec.ts`. Do not add a seed mode, timeout increase, global Turbo serialization, or parallel representation of production seed behavior.

### Objective RED/GREEN Evidence
- RED: PR1 `src/test-support/__tests__/operator.fixture.spec.ts` — `re-seeding an operator resets password, role, and status without duplication` has no implementation before the fixture exists.
- GREEN: PR1 behavioral fixture tests pass against the guarded `viewpro_platform_test` database.
- RED/GREEN: PR2 `src/test-support/__tests__/operator-fixture-boundary.spec.ts` reports 14 missing consumer violations before migration and passes only after the Node16 closure migration.
- GREEN: `src/database/__tests__/seed.spec.ts` passes unchanged, proving the production executable seed contract remains covered.
- GREEN: `src/platform-control/__tests__/platform-control.controller.spec.ts` passes all 37 tests directly/cold without changing the 30-second timeout; record file/setup timing.
- GREEN: `pnpm --filter @viewpro/platform-api test` passes the baseline plus the recorded `Δnew` tests.
- GREEN: one bounded first uncached zero-retry root run passes at the baseline plus recorded `Δnew`; record target-file timing and do not rerun until green.

### Scope Estimate and Review Forecast
- Expected implementation boundary: one fixture, focused behavior spec, source ratchet, retry control, and 14 consumers; production seed and contract spec remain unchanged.
- Forecast: 430–520 implementation changed lines; every sequential PR stays below 400, with no tracker or size exception.
- Delivery: PR0 docs → refreshed `develop` → PR1 fixture/foundation → refreshed `develop` → PR2 consumers/ratchet/retry. Keep tests with each behavior; do not split PR2 by file type.
- Rollback: retain PR0 planning history; after implementation, revert PR2 first, then PR1 if needed. No schema/data migration is involved.

### Risks
- Reordering auth-suite setup could accidentally seed after the first login; each migrated suite must prove its existing named auth tests unchanged.
- A fixture that preserves production `update: {}` behavior would retain stale role/status/password and fail isolation; update payloads must explicitly reset all fixture-owned fields.
- Creating a standalone Prisma client in the fixture would duplicate lifecycle management and weaken the guard seam; use the Nest-owned `PrismaService`.
- Source-inventory assertions must allow only the production contract spec and avoid scanning generated/build output.
- Current bytes show six platform-control launches while issue evidence says seven; acceptance should bind to eliminating all current launches, not a hard-coded historical count.
- Test files share one database and remain serial; this change must not imply per-worker isolation or remove existing cleanup.

### Product Decisions Needed
None. This is a bounded test-infrastructure correction with unchanged production behavior and an approved delivery order.

### Delivery Sequence
Historical incident evidence records that this failure predated #310; #310 has now merged and closed through PR #312. Deliver #311 as PR0 → PR1 → PR2, explicitly reconcile #311 after PR2 because `develop` is not the default branch, then refresh PR #309/#308 and continue #284. This work does not authorize touching the retained #310 worktree.

### Ready for Proposal
Yes. PR0 is the planning baseline; after its independent review/merge, PR1 begins strict-TDD fixture work, then PR2 completes migration and acceptance evidence.
