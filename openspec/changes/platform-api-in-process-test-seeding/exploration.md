## Exploration: Platform API in-process test seeding

### Current State
Issue #311 is approved P0 reliability work. PR0 planning (#313) and PR1 fixture/foundation (#314) are merged. Delivery is the approved PR0→PR1→PR2→PR3 sequence: PR2 owns consumer migration and retry control; PR3 owns the readable boundary ratchet and final acceptance.

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
- `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator.fixture.spec.ts` — merged PR1 behavioral fixture coverage.
- `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator-fixture-boundary.spec.ts` — PR3-only readable Node16 dependency-closure ratchet and regressions.
- `viewpro-app/apps/viewpro-api/prisma/seed.ts` — production executable contract; inspect and retain unchanged.
- `viewpro-app/apps/viewpro-api/src/database/__tests__/seed.spec.ts` — retain as the sole named real-seed subprocess contract test.
- `viewpro-app/apps/viewpro-api/src/database/prisma.service.ts` and `src/database/test-database-url.guard.ts` — existing guarded client/lifecycle seams; retain unchanged.
- `viewpro-app/apps/viewpro-api/test/setup-env.ts`, `vitest.config.ts`, `package.json`, and root `turbo.json` — retain test DB safety, 30-second timeout, and global Turbo concurrency; PR2 alone may add command-scoped retry control to Vitest.

### Call Paths and Blast Radius
- Current normal path: integration `beforeAll` → 15 source-level CLI call sites → 34 runtime process launches → package `db:seed` script → production `prisma/seed.ts` → Argon2 → no-op-on-existing upsert → per-process disconnect.
- Recommended normal path: app/module bootstrap → resolve `PrismaService` and `PASSWORD_HASHER` from Nest DI → shared `seedOperatorFixture` → in-process Argon2 hash → explicit operator upsert create/update → `app.close()` → one Prisma lifecycle disconnect.
- Retained production path: `seed.spec.ts` → two CLI launches → production seed script. This preserves executable packaging, environment validation, explicit OWNER creation, no-duplicate behavior, and database isolation evidence.
- Direct consumers are test-only. No controller, use case, repository, schema, migration, platform contract, production seed, global Turbo setting, or timeout changes; PR2 changes only command-scoped retry control.

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
Use Approach 1 through the approved sequential slices. PR2 `fix/platform-api-test-consumers` owns exactly the 14 consumer migrations/15 app-context calls, removal of eight helpers/seven direct sites, and command-scoped retry control. PR3 `test/platform-api-seed-boundary`, from refreshed `develop` after PR2 merges, owns the complete readable Node16 AST dependency/ownership ratchet, fail-closed regressions, and the first corrected-byte uncached zero-retry acceptance with setup below 20 seconds. The fixture accepts explicit `email`, `password`, `role` (default OWNER), and `status` (default ACTIVE); hashes through app-provided `PASSWORD_HASHER`; resets create/update state; owns no client; and never bypasses `assertSafeTestDatabaseUrl()`.

Keep `prisma/seed.ts` and `seed.spec.ts` unchanged. Add a regression assertion that all normal platform-api integration specs are free of `node:child_process`/`pnpm db:seed`, with an explicit allow-list for `src/database/__tests__/seed.spec.ts`. Do not add a seed mode, timeout increase, global Turbo serialization, or parallel representation of production seed behavior.

### Objective RED/GREEN Evidence
- PR1 RED/GREEN behavioral fixture coverage is merged.
- PR2 has focused/package/serial evidence for consumers and retry control only; it does not activate the boundary, claim final uncached acceptance, or reconcile #311.
- PR3 RED starts from the migrated consumer inventory as GREEN baseline input. It adds failing analyzer regressions for `Deno.Command` new expressions, `ImportEquals`, unresolved or escaping local edges, wrong-context/before-init/after-request calls, alias/type-only/unused/shadowed/wrapper-only bindings, and colocated-spec exclusion.
- PR3 GREEN completes the readable Node16 closure/ownership ratchet so those regressions fail closed while preserving the already-migrated 14-consumer inventory.
- PR3 runs unchanged `src/database/__tests__/seed.spec.ts`, platform-control (37), platform-api baseline-plus-`Δnew`, and the first corrected-byte uncached zero-retry root acceptance. It records target-file setup below 20 seconds and does not rerun until green.

### Scope Estimate and Review Forecast
- PR0 measured 352 lines; PR1 measured 192; PR2 is refined to 279; PR3 is forecast at 160–230. Implementation review cost is 631–701, or 983–1,053 including PR0. Every slice remains below 400; no size exception is approved or required.
- Delivery: merged PR0 → merged PR1 → PR2 → PR3. Keep tests with their behavior and do not split slices by file type.
- Rollback: PR3→PR2→PR1; retain PR0 history. No schema/data migration is involved.

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
PR0 #313 and PR1 #314 are merged. PR2 `fix/platform-api-test-consumers` owns only consumers and retry control, not the ratchet, final acceptance, or #311 closure. After PR2 merges, PR3 starts from refreshed `develop`; final PR3 acceptance and merge trigger explicit #311 reconciliation. Historical failed, contaminated, pre-correction, or invalid PR2 receipts are non-acceptance evidence and cannot be reused.

### Ready for Proposal
Yes. The approved versioned contract defines the remaining delivery slices.
