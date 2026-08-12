# Proposal: Platform API In-Process Test Seeding

## Intent

Remove production-seed subprocess reuse from 14 normal platform-api integration specs: 15 source call sites cause 34 launches of pnpm, ts-node, Prisma, and Argon2. This is the root load-dependent timeout class, not a single slow hook. Issue #311 is approved; no product decisions remain.

## Scope

### In Scope
- Add one shared DI-backed operator fixture using the Nest-owned `PrismaService` and `PASSWORD_HASHER`/Argon2.
- Upsert deterministically by email, resetting password hash, role, and status on create and update without duplicates.
- Migrate all normal integration specs off CLI seeding; retain `_test` database guards and Nest-owned lifecycle.
- Keep `src/database/__tests__/seed.spec.ts` as the sole production CLI seed contract.

### Out of Scope
- Production seed refactoring, production behavior, schema, API, runtime configuration, global Turbo concurrency, or 30-second timeout changes.
- Timeout inflation, global Turbo serialization, shared mutable operator pools, or broad production-seed extraction.

## Capabilities

### New Capabilities
None — test infrastructure only.

### Modified Capabilities
None — production requirements remain unchanged.

## Approach

Resolve `PrismaService` and `PASSWORD_HASHER` from each Nest test application and pass them to one test-only fixture. PR1 owns the fixture and behavioral `operator.fixture.spec.ts`; PR2 owns the separate source/Node16 `operator-fixture-boundary.spec.ts` ratchet. CLI remains only in `seed.spec.ts`; preserve `prisma/seed.ts` unchanged.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/apps/viewpro-api/src/test-support/` | New | PR1 fixture/behavior spec; PR2 boundary ratchet spec |
| `viewpro-app/apps/viewpro-api/src/{auth,operators,payments,platform-control,platform-data}/**/*.spec.ts`; `vitest.config.ts` | Modified | Replace 14 specs' CLI helpers/calls; PR2 retry control |
| `viewpro-app/apps/viewpro-api/{prisma/seed.ts,src/database/__tests__/seed.spec.ts}` | Preserved | Sole production CLI contract |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auth setup ordering or stale fixture state | Medium | Seed before login; assert reset and no duplicates |
| 430–520 implementation lines exceed one review | High | Sequential PR1 150–185 and PR2 280–335; each stays below 400 |

## Rollback Plan

Retain PR0 planning history; after implementation, revert PR2 first, then PR1 if needed, restoring CLI helpers without a data/schema migration.

## Dependencies

- PR0 docs → refreshed `develop` → PR1 fixture/foundation → refreshed `develop` → PR2 consumers/ratchet/retry; after #311 reconciliation, refresh PR #309/#308 and continue #284.

## Success Criteria

- [ ] PR1 fixture behavior proves password/role/status reset; PR2 boundary ratchet proves only `seed.spec.ts` invokes the production CLI.
- [ ] Platform-control passes its baseline plus `Δnew`; platform-api and the first uncached zero-retry root run pass their recorded baselines plus `Δnew`, with setup under 20 seconds and no rerun-until-green.
- [ ] `_test` guards/lifecycle, production behavior/schema/API, global Turbo concurrency, and the 30-second timeout remain unchanged; PR2 may add command-scoped Vitest retry control.
