# Delta for Platform API In-Process Test Seeding

## ADDED Requirements

### Requirement: Normal integration tests use no production seed subprocess

Normal platform-api integration specs MUST NOT invoke `pnpm db:seed`, the production seed CLI, `execSync`, or any process-per-operator equivalent. Only `src/database/__tests__/seed.spec.ts`, the dedicated production seed contract test, MAY invoke CLI seeding. Migration is complete only when all 15 confirmed call sites across these 14 consumers are removed: auth controller, auth-me, auth idle-timeout, isolation, step-up controller, operators controller, payments controller, revenue controller, judgment-fixes, platform-control controller, audit controller, metrics controller, tenant-registry controller, and tenant-detail specs.

#### Scenario: Boundary and consumer inventory are clean

- GIVEN the platform-api test sources and the explicit production-contract allow-list
- WHEN the PR2 source-boundary regression runs
- THEN it rejects every normal consumer still containing a forbidden seed path and accepts CLI use only in `seed.spec.ts`
- AND partial migration is a failure

### Requirement: A shared fixture uses active Nest-owned dependencies

The test-only operator fixture MUST obtain the active testing module/app’s Nest-owned `PrismaService` and `PASSWORD_HASHER`, hash in process, and accept explicit email, password, role, and status inputs with `OWNER`/`ACTIVE` defaults.

#### Scenario: Fixture follows the active application lifecycle

- GIVEN a bootstrapped Nest testing application
- WHEN the PR1 behavioral fixture test creates an operator fixture
- THEN the fixture uses that application’s dependencies and creates no independent Prisma client or disconnect path
- AND `app.close()` remains responsible for Prisma cleanup

### Requirement: Fixture state is deterministic and idempotent

The fixture MUST upsert by email and MUST reset its owned email, password hash, role, and status on both create and update. Repeated calls MUST produce one login-valid operator with no duplicate or stale fixture-owned state.

#### Scenario: Re-seeding restores requested state

- GIVEN an operator exists with the same email but changed password, role, or status
- WHEN the fixture is called with the desired state
- THEN the existing row is updated to exactly that state
- AND a repeated call leaves exactly one matching operator

### Requirement: Test-database safety and failure cleanup remain enforced

The existing safe `_test` database guard MUST remain mandatory; the fixture MUST reject non-test databases before writes. Hashing or persistence failures MUST fail the invoking test deterministically, perform no CLI fallback, and leave no partial fixture mutation; normal Nest teardown MUST retain existing cleanup/rollback behavior.

#### Scenario: Unsafe or failed setup cannot proceed silently

- GIVEN a non-test database or an injected hash/database failure
- WHEN fixture setup is attempted
- THEN it fails before unsafe writes or propagates the original failure without retry-based masking
- AND no unmanaged client or orphaned cleanup is introduced

### Requirement: Production and execution contracts remain unchanged

The production `prisma/seed.ts`, schemas, APIs, runtime behavior, timeout values, and Turbo global concurrency MUST remain unchanged. PR2 MAY add only command-scoped zero-retry control to platform-api `vitest.config.ts` for acceptance evidence. The existing production seed contract MUST continue to cover its CLI behavior.

#### Scenario: Named verification proves bounded behavior

- GIVEN the #311 implementation and its focused regression tests
- WHEN verification runs PR1 fixture behavior/idempotence, PR2 source-boundary regression, unchanged seed contract, platform-control, platform-api, and one first uncached zero-retry root run
- THEN all named evidence passes at recorded baseline-plus-`Δnew` totals, with setup below 20 seconds and no timeout increase
- AND no acceptance criterion is satisfied merely by rerunning a flaky suite until green

### Requirement: Delivery order and rollback are explicit

#311 delivery MUST be PR0 docs → refreshed `develop` → PR1 fixture/foundation → refreshed `develop` → PR2 consumers/ratchet/retry, with every PR below 400 changed lines, no tracker, and no size exception. Retain PR0 planning history; a failed implementation reverts PR2 first, then PR1 if needed, without schema/data migration.

#### Scenario: Delivery remains sequenced and reconciled

- GIVEN PR0 is unmerged, PR1 is incomplete, or PR2 verification evidence is insufficient
- WHEN delivery is reviewed
- THEN later implementation slices do not advance early and #311 remains open
- AND after accepted PR2 merge, #311 is explicitly reconciled because `develop` is not the default branch, then PR #309/#308 refreshes before #284 continues
