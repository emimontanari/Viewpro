# Design: Platform API In-Process Test Seeding

## Technical Approach

Replace 15 production-seed sites in 14 specs with one fail-closed, Nest-owned fixture. Preserve real Argon2, Prisma lifecycle, production `prisma/seed.ts`/CLI contract, 30-second timeout, global Turbo topology, and sequential PR0 → PR1 → PR2 rollback.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Placement/direction | Keep `src/test-support/operator.fixture.ts`: current `rootDir: ./src` and `include: src/**/*.ts` make `test/` imports from typechecked `src` specs unsafe. The ratchet forbids direct/transitive production imports of test support; no build-root change. |
| Ownership | `seedOperatorFixture(app,input)` uses the active context's `app.get(PrismaService)` and `app.select(AuthModule).get(PASSWORD_HASHER,{strict:true})`; it creates/disconnects nothing. |
| Identity/state | Canonicalize with `trim().toLowerCase()` and atomically upsert one row per canonical email. Create/update both set a fresh real Argon2 hash, role, and status (`OWNER`/`ACTIVE` defaults); return stable `id/email/role/status`. No retry, fallback, or secret logging. |

## Fail-Closed Fixture Contract

Before validating input, resolving Nest dependencies, hashing, or touching Prisma:

```ts
if (!isTestRuntime()) throw new Error('Operator fixture requires test runtime')
assertSafeTestDatabaseUrl(process.env.DATABASE_URL)
```

Only after both pass may it validate non-empty email/password, resolve dependencies, hash, and upsert. Tests spy/fail dependencies to prove unsafe runtime/URL performs **zero resolution, zero hash, zero write**, while hash/Prisma failures propagate and preserve prior state.

Lifecycle: setup-env guard → compile (`PrismaService` guard) → create/configure app → `app.init()` → fixture → login/tests → cleanup → `app.close()` disconnect. Every created app context invokes the fixture after its own init using that app argument; no context shares resolved dependencies. Step-up's two `beforeAll`s each reseed its shared canonical email. Tenant-detail's two `beforeAll`s each seed their two context-owned emails. All other consumers have one app context and seed it once before login.

## Dependency-Closure Ratchet

PR2 creates source-only `src/test-support/__tests__/operator-fixture-boundary.spec.ts`; it never imports the fixture, so initial RED reports all consumers rather than failing module load. PR1 exclusively owns behavioral coverage in `src/test-support/__tests__/operator.fixture.spec.ts`.

1. Read `tsconfig.json` with TypeScript APIs and build one cached graph. Discover every `.spec.ts` recursively under configured Vitest roots `src/` and `test/`; sole process-rule exemption is normalized `src/database/__tests__/seed.spec.ts`.
2. For each file, collect `import`, `export ... from`, literal `import()`, and literal `require()` edges. Resolve with `ts.resolveModuleName` using parsed Node16 options and package root: `.js`→`.ts`, aliases, barrels, and index files therefore follow compiler behavior. Traverse **every** resolved local file regardless of path/name; cache cycles. A nonliteral, local-looking unresolved, or escaping edge fails closed; external packages terminate traversal.
3. For every non-exempt spec closure, fail on any import/require/use of exact process-runner modules `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, or `zx`, including aliases/namespaces, plus `Bun.spawn`/`Deno.Command`. No fuzzy command interpretation and no current unrelated subprocess allowlist: current inventory has none. Future exceptions require a named spec and rationale but cannot reuse the seed exemption.
4. Fail normal closures resolving `prisma/seed.ts`. Separately start from every production `src/**/*.ts` root excluding specs, `__tests__`, and `src/test-support/**`; fail if its transitive local closure reaches `operator.fixture.ts`.
5. Exact 14-consumer metadata requires the fixture import binding and calls inside each app-owning `beforeAll`, after `app.init()`: minimum one for 12 single-app contexts, one in each of step-up's two contexts, and two in each of tenant-detail's two contexts. Unused imports, wrapper-only calls, missing contexts, or partial migration fail.

Inventory remains auth controller, auth-me, idle-timeout, isolation, step-up; operators; payments, revenue, judgment-fixes; platform-control; audit, metrics, tenant-registry, tenant-detail. Eight helpers and seven direct sites disappear.

## Strict TDD and Verification

PR1 RED behavioral spec observes absent fixture behavior, then GREEN proves guard ordering, defaults/overrides, canonical identity, idempotent password/role/status reset, login validity, and failure atomicity. PR2 RED boundary reports 14 missing import/call violations; it greens only after complete migration.

Platform-control records setup-only time from first `beforeAll` statement through final fixture call as `PLATFORM_CONTROL_SETUP_MS=<integer>`. First uncached root acceptance requires `<20,000ms` (≥10,000ms/33% hook headroom). Make retry disabling mechanical by changing only platform-api `vitest.config.ts` to `retry: process.env.VIEWPRO_PLATFORM_TEST_RETRY === '0' ? 0 : 2`; normal runs retain `2`. Turbo loose mode passes this command-scoped variable, and forced execution avoids cache:

```bash
/usr/bin/time -p env TURBO_FORCE=true TURBO_ENV_MODE=loose \
  VIEWPRO_PLATFORM_TEST_RETRY=0 pnpm test
```

This first run must pass structurally and behaviorally; identical reruns cannot supply acceptance. Also run focused boundary/behavior, unchanged seed contract, platform-control, validation/typecheck, and full platform-api. Report each total as its recorded baseline plus `Δnew` from output.

## Forecast, Delivery, Rollback

| Boundary | Lines |
|---|---:|
| Fixture / behavior / ratchet | 60–70 / 95–115 / 120–145 |
| Fourteen consumers + targeted Vitest config | 155–190 |
| **Total: 3 new, 15 modified** | **430–520** |

400-line risk: **High** for the 430–520 implementation total, resolved by sequential PR0 docs → refreshed `develop` → PR1 fixture/foundation → refreshed `develop` → PR2 consumers/ratchet/retry. Every PR stays below 400; no tracker or size exception. Retain PR0 planning history; roll back PR2 then PR1, restore helpers, and preserve schema/API/runtime, 30-second timeout, global Turbo, and production seed. #310 merged/closed historically; after #311 reconciliation refresh PR #309/#308 and continue #284.

## Open Questions

None.
