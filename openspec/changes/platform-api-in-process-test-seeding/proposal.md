# Proposal: Platform API In-Process Test Seeding

## Intent

Complete issue #311 by preventing ordinary platform-api specs from regaining static dependencies on production seeding or process-launch infrastructure. Preserve the delivered fix: PR1 #314 added the Nest-owned in-process fixture, and PR2 #315 replaced 15 subprocess source sites across 14 specs (34 launches) with 34 direct fixture calls.

## Scope

### Delivered and Preserved
- `seedOperatorFixture` uses the active application's guarded `PrismaService` and `PASSWORD_HASHER`, resets password, role, and status deterministically, and leaves cleanup to Nest.
- The 14 migrated consumers, command-scoped retry control, `_test` database guard, and dedicated production seed contract remain unchanged.
- Production `prisma/seed.ts`, schemas, APIs, runtime settings, global setup, timeout values, and per-worker database topology remain unchanged.

### Focused PR3
- Add only `src/test-support/__tests__/operator-fixture-boundary.spec.ts`, a self-contained static dependency-closure spec.
- Treat configured ordinary specs under `src/` and `test/` as roots; exempt only `src/database/__tests__/seed.spec.ts`, and only as a root.
- Traverse repository-local imports, reexports, literal `import()`, and literal `require()` with the effective TypeScript Node16 configuration; handle cycles/cache resolved files and stop at external dependencies.
- Reject closure reachability to `prisma/seed.ts`, `test/global-setup.ts`, or known process-launch module entrypoints. Fail closed on nonliteral loaders and unresolved or repository-escaping local edges, with root-to-offense chain diagnostics.

### Superseded / Out of Scope
Fixture ownership/call counting, binding or shadowing analysis, a reusable AST analyzer, `Bun`/`Deno` or general command interpretation, reverse production boundaries, and serial/shared-database assumptions are superseded. No source change beyond the one focused spec, no production change, and no timeout/topology refactor belongs in PR3.

## Approach

Parse the package's effective TypeScript configuration and build the local static dependency graph from each configured ordinary root. The sole seed-contract exception affects root selection, not transitive traversal. Exact forbidden process modules are `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, and `zx`; resolved external packages otherwise terminate traversal.

Strict TDD starts by adding the new spec with an executable contract that calls a deliberately missing local boundary helper and records the expected missing-symbol/compile RED. GREEN defines the minimum helper in that same spec and passes the clean source tree. Only then does TRIANGULATE separately add reachable `node:child_process` and `prisma/seed.ts` edges, capture chain-bearing failures, and restore each mutation byte-for-byte.

## Affected Areas

| Area | Impact |
|---|---|
| `viewpro-app/apps/viewpro-api/src/test-support/__tests__/operator-fixture-boundary.spec.ts` | Sole PR3 implementation: focused boundary and its cases |
| Configured ordinary specs under `src/` and `test/` | Traversal roots; unchanged |
| `src/database/__tests__/seed.spec.ts` | Sole root-only exception; unchanged |
| `prisma/seed.ts`, `test/global-setup.ts`, production/runtime code | Unchanged protected targets/infrastructure |

## Risks

| Risk | Mitigation |
|---|---|
| Seed exception becomes a transitive allow-list | Apply it only during root selection |
| Local resolution failure is mistaken for an external | Use effective Node16 resolution and fail closed with the chain |
| Valid global migration setup is rejected | Do not discover it as a root; still reject transitive reachability |
| Temporary TRIANGULATE mutation remains | Restore exact bytes after each run and verify the final diff |

## Dependencies

PR0 #313, PR1 #314, PR2 #315, and focused amendment #499 are merged. PR3 is based at `4116621c583b7a51f4be16a078fd63ae0a7b8953`; implementation may proceed without another product decision.

## Rollback Plan

Revert PR3 alone to remove only the guard. To roll back the full capability, revert PR3→PR2→PR1 and retain PR0 history; this matches revised issue #311 and preserves dependency order.

## Success Criteria

- [ ] The self-contained spec checks every configured ordinary root and enforces the root-only seed exception through effective Node16 local closure.
- [ ] Forbidden targets, nonliteral loaders, and unresolved/escaping local edges fail with actionable dependency chains; external packages terminate traversal.
- [ ] Missing-helper RED precedes minimum-helper GREEN; only post-GREEN, byte-restored mutations prove chain diagnostics for `node:child_process` and `prisma/seed.ts`.
- [ ] From `viewpro-app/`, run the focused boundary, seed contract, timed 37-test platform-control suite, platform-api `db:validate`, typecheck, lint, and the exact one-run root acceptance defined in design/tasks.
- [ ] Record baseline totals, `Δnew`, resulting totals, setup and real timing; accept no rerun substitution.
- [ ] Local `_test` database safety, PR1/PR2 behavior, per-worker topology, and production bytes remain unchanged.
