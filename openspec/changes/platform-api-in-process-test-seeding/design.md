# Design: Platform API In-Process Test Seeding

## Technical Approach

Preserve PR1's fail-closed Nest-owned fixture and PR2's replacement of 15 historical subprocess sites with 34 direct calls across 14 specs. PR3 adds one self-contained static dependency-closure spec; it changes no production, fixture, consumer, timeout, retry-default, global-setup, or worker-database behavior.

## Delivered Architecture

| Decision | Choice and rationale |
|---|---|
| Placement/direction | `src/test-support/operator.fixture.ts` remains compiled test support; PR3 lives only at `src/test-support/__tests__/operator-fixture-boundary.spec.ts`. |
| Ownership | `seedOperatorFixture(app,input)` uses the active context's `app.get(PrismaService)` and `app.select(AuthModule).get(PASSWORD_HASHER,{strict:true})`; it creates/disconnects nothing. |
| Identity/state | Canonicalize with `trim().toLowerCase()` and atomically upsert one row per canonical email. Create/update both set a fresh real Argon2 hash, role, and status (`OWNER`/`ACTIVE` defaults); return stable `id/email/role/status`. No retry, fallback, or secret logging. |
| Safety | The existing test-runtime and `_test` database guards run before dependency resolution, hashing, or writes; Nest teardown owns cleanup. |

PR1 behavioral coverage remains the proof of guard ordering, defaults/overrides, canonical identity, idempotent reset, login validity, and failure atomicity. PR2's migrated inventory and command-scoped retry control remain delivered evidence, not responsibilities for PR3 to re-analyze.

## Focused Dependency-Closure Boundary

The one PR3 spec reads Vitest configuration to identify ordinary `.spec.ts` roots under `src/` and `test/`. It omits exact root `src/database/__tests__/seed.spec.ts`; that exception is applied only to root selection, so another root may not reach the seed contract or production seed through it. `test/global-setup.ts` remains infrastructure rather than a root.

The spec parses `tsconfig.json` with TypeScript APIs and uses the effective Node16 compiler options. For each traversed file it collects:

- static imports and `export ... from` reexports;
- literal `import()` expressions; and
- literal `require()` calls.

Resolve each edge with TypeScript module resolution from its containing file. Repository-local results remain in the graph, including aliases, barrels/indexes, cycles, and `.js` specifiers resolving to TypeScript. Cache parsed/resolved files, but retain each root's ordered predecessor chain for diagnostics. Resolved external package dependencies terminate traversal and their internals are not scanned.

An ordinary closure fails when it reaches `prisma/seed.ts`, `test/global-setup.ts`, or exact process-launch entrypoints `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, or `zx`. It also fails when a dynamic loader is nonliteral or a local edge is unresolved or escapes the package. Diagnostics name the root, each local edge in order, and the forbidden target or resolution condition.

## Explicitly Superseded Machinery

PR3 does not create a reusable analyzer or enforce fixture ownership, context placement, call counts, bindings, aliases, shadowing, wrapper use, `Bun.spawn`, `Deno.Command`, generalized command semantics, or a reverse production-to-test-support boundary. The former serial/shared-database model is also superseded by the current per-worker database topology. These exclusions keep the guard aligned with the approved dependency boundary rather than historical implementation metadata.

## Strict TDD and Verification

1. **RED:** create `operator-fixture-boundary.spec.ts` with an executable contract that calls a deliberately undefined local `checkOrdinarySpecBoundary`; run the focused command and capture the expected missing-symbol/compile failure. Do not claim mutation diagnostics.
2. **GREEN:** define only the minimum helper in that same self-contained spec; the focused command must pass on clean source bytes.
3. **TRIANGULATE:** after GREEN, temporarily add a reachable `node:child_process` edge, capture the root-to-target failure, and byte-restore it; then separately do the same for a reachable `prisma/seed.ts` edge. Cover the remaining resolution/fail-closed cases in the spec.
4. **REFACTOR:** verify both mutations are absent, retain the readable minimum guard, and rerun final checks without source drift.

Run every command from `viewpro-app/` in this order:
```sh
pnpm --filter @viewpro/platform-api exec vitest run src/test-support/__tests__/operator-fixture-boundary.spec.ts
pnpm --filter @viewpro/platform-api exec vitest run src/database/__tests__/seed.spec.ts
/usr/bin/time -p pnpm --filter @viewpro/platform-api exec vitest run src/platform-control/__tests__/platform-control.controller.spec.ts
pnpm --filter @viewpro/platform-api db:validate
pnpm --filter @viewpro/platform-api typecheck
pnpm --filter @viewpro/platform-api lint
/usr/bin/time -p env TURBO_FORCE=true TURBO_ENV_MODE=loose VIEWPRO_PLATFORM_TEST_RETRY=0 pnpm test
```
Before database-backed runs, require the local platform Postgres test base and its derived worker names to retain `_test`; `setup-env.ts`/the guard must reject anything else. Record each test command's clean-base total, `Δnew`, resulting total, and timing; platform-control must report 37 tests and `PLATFORM_CONTROL_SETUP_MS < 20000`. Invoke the root command exactly once after corrected bytes; no rerun substitutes for acceptance.

## Delivery and Rollback

PR0 #313, PR1 #314, and PR2 #315 are merged. Current PR3 branch `test/platform-api-seed-boundary-focused` starts at approved base `a25dbf2ae8e0cb48a530069e9a9b26e631f71dbd`. Implementation owns the focused spec/evidence; the parent owns review and delivery. Revert PR3 alone to remove the guard; full capability rollback is PR3→PR2→PR1, retaining PR0, as revised issue #311 requires.

## Open Questions

None.
