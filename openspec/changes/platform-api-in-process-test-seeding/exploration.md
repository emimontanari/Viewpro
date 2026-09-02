## Exploration: Platform API in-process test seeding

### Current State
Issue #311 remains open after PR0 planning (#313), PR1 fixture/foundation (#314), and PR2 consumer migration (#315) merged. PR3 starts at maintainer-approved base `a25dbf2ae8e0cb48a530069e9a9b26e631f71dbd` and is now narrowed to one self-contained dependency-closure spec; this supersedes the earlier general AST/ownership ratchet.

`beforeAll` → local `seedOperator`/direct `execSync` → `pnpm db:seed` → `ts-node prisma/seed.ts` → new `PrismaClient` → `argon2.hash` → `operator.upsert` → `$disconnect`.

The pre-migration baseline contained 15 production-seed subprocess source sites across 14 normal integration specs, producing 34 seed-process launches in one complete platform-api run. The production contract spec adds two intentional launches. In the baseline `platform-control.controller.spec.ts`, six operators are launched sequentially, not seven as stated in issue #311 and Engram #6789; this inventory discrepancy does not change the root cause because the hook still repeats pnpm, ts-node, Prisma startup, Argon2 work, and client teardown under Turbo contention.

Production `prisma/seed.ts` is intentionally an executable script, not an importable fixture API. It validates two environment variables, computes a default Argon2 hash, and idempotently upserts by email with `update: {}` and an explicit `ACTIVE`/`OWNER` create payload. Existing operators are therefore not reset on rerun. Its module-owned Prisma client disconnects in `finally`. `src/database/__tests__/seed.spec.ts` is the named subprocess contract test for create, explicit OWNER, idempotence, and InmoView DB isolation; it should remain the only integration consumer of the real CLI seed.

PR1 delivered `seedOperatorFixture`: it resolves the active Nest application's guarded `PrismaService` and `PASSWORD_HASHER`, resets password/role/status deterministically, and leaves Prisma lifecycle ownership with Nest. PR2 removed the 15 subprocess sites and replaced their 34 launches with 34 direct fixture calls across the same 14 consumers while retaining command-scoped retry control.

Vitest discovers configured specs under `src/` and `test/`, uses a worker pool backed by per-worker databases, and invokes `test/global-setup.ts` as infrastructure. Global setup legitimately imports `node:child_process` for migrations but is not a spec root. The former serial/shared-database assumption is stale.

The package's effective TypeScript configuration is Node16 and includes path mapping. PR3 must use that configuration instead of approximating relative, index, alias, reexport, or `.js`-to-TypeScript resolution.

### Affected Areas
- `viewpro-app/apps/viewpro-api/src/test-support/operator.fixture.ts` and its behavioral spec — merged PR1 contract; unchanged.
- The 14 migrated auth, operators, payments, platform-control, and platform-data consumer specs plus command-scoped retry control — merged PR2 contract; unchanged.
- `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator-fixture-boundary.spec.ts` — the only PR3 implementation file.
- `viewpro-app/apps/viewpro-api/prisma/seed.ts`, `src/database/__tests__/seed.spec.ts`, and `test/global-setup.ts` — unchanged protected targets/infrastructure.

### Root Cause
High confidence: repeated synchronous seed subprocess startup is unnecessary integration-fixture work and becomes nondeterministic at the exact 30-second hook boundary when Turbo runs workspace tests concurrently. The failure predated the now-merged #310 dependency remediation, which was outside this call path. Timeout inflation would only widen the edge while retaining 34 normal-suite process launches and production-seed coupling.

### Focused PR3 Boundary
For every ordinary spec selected by the configured roots, traverse repository-local static dependencies from imports, reexports, literal `import()`, and literal `require()`. Resolve with TypeScript's effective Node16 settings, follow cycles safely, cache resolved files, and stop at external packages.

`src/database/__tests__/seed.spec.ts` is exempt only as a root. Any ordinary root that reaches it, `prisma/seed.ts`, `test/global-setup.ts`, or a known process-launch module must fail. Unresolved or package-escaping local edges and nonliteral loaders also fail closed. Diagnostics must show the root-to-offense chain.

Known process-launch entrypoints are `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, and `zx`. PR3 does not own fixture call counting or placement, binding/shadowing analysis, `Bun`/`Deno` syntax, reverse production boundaries, or a reusable analyzer.

### Objective TDD Evidence
- **RED:** first create the new spec with an executable contract that calls a deliberately absent local `checkOrdinarySpecBoundary` helper; the focused run must capture the expected missing-symbol/compile failure. No mutation diagnostic is claimed yet.
- **GREEN:** define only the minimum helper in that same self-contained spec and pass the focused run on restored source bytes.
- **TRIANGULATE:** only after GREEN, separately add a reachable `node:child_process` edge and a reachable `prisma/seed.ts` edge; each focused run must show its root-to-offense chain, and each mutation must be byte-restored before continuing.
- **REFACTOR:** with both mutations absent, rerun focused and acceptance checks once, retaining the `_test` guard, platform-control's 37 tests and setup below 20 seconds.

### Risks
- A path-wide seed exemption would hide transitive violations; exemption must be root-only.
- Treating unresolved local edges as externals would create false negatives; local failures must be actionable.
- Discovering global setup as a spec would reject valid infrastructure, while allowing an ordinary closure to reach it would hide process coupling.
- TRIANGULATE mutations must be restored byte-for-byte before final verification, diff review, or delivery.

### Product Decisions Needed
None. This is a bounded test-infrastructure correction with unchanged production behavior and an approved delivery order.

### Key Learnings
- PR1/PR2 fixed the runtime cause; PR3 protects that delivered boundary rather than re-proving fixture ownership.
- Static dependency closure is the smallest enforceable guard: configured roots, one root-only exception, Node16 resolution, external terminals, and chain diagnostics.
- RED proves the missing helper before implementation; only a GREEN guard can honestly support transitive mutation diagnostics.
- Worker databases replace the stale serial/shared-database model, but local `_test` safety and one-run acceptance evidence remain required.

### Ready for Proposal
Yes. The five planning artifacts now describe one focused PR3 contract.
