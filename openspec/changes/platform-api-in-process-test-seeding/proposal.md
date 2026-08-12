# Proposal: Platform API In-Process Test Seeding

## Intent

Remove production-seed subprocess reuse from 14 normal platform-api integration specs: 15 historical subprocess source sites caused 34 launches of pnpm, ts-node, Prisma, and Argon2. The migration replaces them with 34 direct fixture invocations in the consumer specs. This is the root load-dependent timeout class, not a single slow hook. Issue #311 is approved; no product decisions remain.

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

Resolve `PrismaService` and `PASSWORD_HASHER` from each Nest test application and pass them to one test-only fixture. PR1 owns the merged fixture and behavioral `operator.fixture.spec.ts`. PR2 `fix/platform-api-test-consumers` owns 14 consumer specs, removal of 15 historical production-seed subprocess source sites, 34 direct fixture invocations in their app-owning setup contexts, helper/direct-site removal, and command-scoped retry control. PR3 `test/platform-api-seed-boundary`, from refreshed `develop` after PR2 merges, owns the separate readable Node16 `operator-fixture-boundary.spec.ts` ratchet/regressions and final acceptance. CLI remains only in `seed.spec.ts`; preserve `prisma/seed.ts` unchanged.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/apps/viewpro-api/src/test-support/` | New | PR1 fixture/behavior spec; PR3 boundary ratchet spec |
| `viewpro-app/apps/viewpro-api/src/{auth,operators,payments,platform-control,platform-data}/**/*.spec.ts`; `vitest.config.ts` | Modified | PR2 replaces 14 specs' CLI helpers/calls and adds retry control |
| `viewpro-app/apps/viewpro-api/{prisma/seed.ts,src/database/__tests__/seed.spec.ts}` | Preserved | Sole production CLI contract |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auth setup ordering or stale fixture state | Medium | Seed before login; assert reset and no duplicates |
| Cumulative implementation review cost | High | PR1 measured 192; PR2 refined 279; PR3 forecast 160–230; every slice remains below 400 without exception |

## Rollback Plan

Roll back PR3→PR2→PR1; retain PR0 planning history. No data/schema migration exists.

## Dependencies

- PR0 #313 and PR1 #314 are merged. PR2 `fix/platform-api-test-consumers` owns consumers and retry control, not the boundary, final acceptance, or #311 reconciliation. PR3 follows PR2 from refreshed `develop`; only its final acceptance and merge trigger explicit #311 reconciliation.

## Success Criteria

- [ ] PR3 boundary ratchet treats the migrated inventory as GREEN baseline input and proves only `seed.spec.ts` invokes the production CLI; its RED regressions cover incomplete analyzer behavior, while PR1 fixture behavior remains the password/role/status reset proof.
- [ ] PR2 retains focused/package/serial evidence only. PR3 runs platform-control, platform-api, and the first corrected-byte uncached zero-retry root acceptance at recorded baseline-plus-`Δnew`, with setup below 20 seconds and no rerun-until-green.
- [ ] `_test` guards/lifecycle, production behavior/schema/API, global Turbo concurrency, and the 30-second timeout remain unchanged. Historical failed, contaminated, pre-correction, or invalid PR2 receipts are non-acceptance evidence.
