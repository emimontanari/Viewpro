# Tasks: Platform API In-Process Test Seeding

## Review Workload Forecast

| Plan | Lines / files | Risk | Delivery |
|---|---:|---|---|
| PR0 | 352 / 5 OpenSpec files | Low | Planning baseline/docs |
| PR1 | 150–185 / fixture + `operator.fixture.spec.ts` | Low | Fixture/foundation |
| PR2 | 280–335 / `operator-fixture-boundary.spec.ts`, 15 modified | Low | Migration/ratchet |
| Implementation total | 430–520; each PR <400 | High cumulative | PR0 → PR1 → PR2 |

delivery_strategy: auto-chain (sequential user-approved slices)
chain_strategy: stacked-to-main (integration branch: develop)
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Delivery Topology

- **PR0:** `docs/platform-api-in-process-test-seeding-plan` → refreshed `develop`; five files (`exploration.md`, `proposal.md`, `specs/.../spec.md`, `design.md`, `tasks.md`), 352 additions, `Refs #311`; docs review/merge first.
- **PR1:** `fix/platform-api-test-fixture` → refreshed `develop` after PR0; 150–185 lines, fixture plus `operator.fixture.spec.ts` behavioral coverage, `Refs #311`.
- **PR2:** `fix/platform-api-test-consumers` → refreshed `develop` after PR1; 280–335 lines, `operator-fixture-boundary.spec.ts` source/Node16 ratchet, migration/retry acceptance, and #311 reconciliation.
- No tracker/exception; refresh `origin/develop` each time. GitHub defaults `main`: explicitly reconcile #311 after PR2 acceptance/merge. Retain PR0 history; roll back PR2→PR1; then refresh PR #309/#308 and continue #284.

Branch graph: refreshed `origin/develop` → PR0 → `develop` → PR1 → refreshed `develop` → PR2 → #311 reconciliation.
Apply gate: PR0 only; stop at independent docs review/merge. Do not mark PR0 delivered here.

## Phase 1

- [x] 1.1 (#6829) PR0 was committed, pushed, and opened as PR #313 from `docs/platform-api-in-process-test-seeding-plan`; green checks, final review, and merge are pending. #310 merged via PR #312 and closed; its retained worktree is untouched.
- [ ] 1.2 Inventory 14 specs/15 sites and eight helpers/seven direct sites; retain `prisma/seed.ts` and `src/database/__tests__/seed.spec.ts` unchanged.
- [ ] 1.3 Review and merge PR0’s five-file planning baseline independently before PR1; PR0 remains undelivered until that review/merge completes.

## Phase 2: RED contracts (strict TDD)

- [ ] 2.1 Add PR1 `src/test-support/__tests__/operator.fixture.spec.ts` RED behavioral fixture coverage.
- [ ] 2.2 RED fixture tests: runtime/DB zero DI/hash/write, defaults/overrides, canonical identity, one row/email, reset, hash/write atomicity, Argon2/login validity, Nest lifecycle.

## Phase 3: GREEN fixture

- [ ] 3.1 Create `src/test-support/operator.fixture.ts`: guard first; resolve active `PrismaService`/strict `AuthModule` `PASSWORD_HASHER`; hash and upsert state; never create/disconnect Prisma or retry/fallback.
- [ ] 3.2 Fixture tests pass on `viewpro_platform_test`; failure preserves state and unsafe setup resolves nothing.

## Phase 4: GREEN migration and ratchets

- [ ] 4.1 Migrate 14 specs at `viewpro-app/apps/viewpro-api/src/{auth,operators,payments,platform-control,platform-data}/**/*.spec.ts`: auth {controller,me,idle,isolation,step-up}, operators, payments {controller,revenue,judgment}, platform-control, data {audit,metrics,registry,detail}; remove 8 helpers/7 sites; seed post-init pre-login.
- [ ] 4.2 In step-up’s two app contexts reseed canonical email; in tenant-detail’s two contexts seed context-owned emails; preserve every named assertion.
- [ ] 4.3 Add PR2 source-only `src/test-support/__tests__/operator-fixture-boundary.spec.ts` (no fixture import): Node16 import/export/literal dynamic import/require closure; fail closed unresolved/nonliteral/escaping; forbid runners/Bun.spawn/Deno.Command/prisma/seed.ts/production→test-support; require 14 post-init consumers.
- [ ] 4.4 Only `vitest.config.ts`: mechanical `VIEWPRO_PLATFORM_TEST_RETRY=0`, default retry 2; preserve timeouts/Turbo/schema/API/runtime/seed; note packaging warning pre-existing/non-goal.

## Phase 5: Evidence and delivery

- [ ] 5.1 Run boundary/fixture, seed-contract, platform-control (`baseline + Δnew`; `PLATFORM_CONTROL_SETUP_MS <20,000`), validation/typecheck, full platform-api; report baseline + `Δnew`.
- [ ] 5.2 FIRST uncached: `/usr/bin/time -p env TURBO_FORCE=true TURBO_ENV_MODE=loose VIEWPRO_PLATFORM_TEST_RETRY=0 pnpm exec turbo test --force --env-mode=loose`; zero retries, report recorded root baseline + `Δnew`, no rerun-until-green.
- [ ] 5.3 Keep tests with behavior; record PR boundaries, clean diff, rollback, explicit #311 reconciliation, then PR #309/#308 refresh before #284.
