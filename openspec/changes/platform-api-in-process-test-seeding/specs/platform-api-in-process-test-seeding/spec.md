# Delta for Platform API In-Process Test Seeding

## ADDED Requirements

### Requirement: Normal integration tests use no production seed subprocess

Ordinary platform-api integration specs that need operator data MUST use the test-only in-process fixture and MUST NOT invoke the production seed CLI or another seed process. The dedicated `src/database/__tests__/seed.spec.ts` contract is the only root allowed to exercise that CLI.

#### Scenario: Migrated consumers retain the PR2 boundary

- GIVEN any of the 14 migrated integration specs needs operator data
- WHEN its setup creates that data
- THEN it uses the delivered in-process fixture rather than a production-seed process
- AND the 34 direct fixture calls and dedicated seed contract remain intact

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

The production `prisma/seed.ts`, schemas, APIs, runtime behavior, timeout values, global setup, and per-worker database topology MUST remain unchanged. Default retries MUST remain in place; zero retries MAY be command-scoped to acceptance. The production seed contract MUST continue covering CLI behavior.

#### Scenario: Delivered contracts remain bounded

- GIVEN the delivered fixture migration and focused PR3 boundary
- WHEN platform-api verification runs
- THEN production seeding, `_test` safety, Nest cleanup, default retries, and worker topology remain unchanged
- AND no source file other than the focused boundary spec is added or modified by PR3

### Requirement: Every configured ordinary spec has a local static dependency closure

The boundary MUST be one self-contained spec at `src/test-support/__tests__/operator-fixture-boundary.spec.ts`. It MUST discover each spec selected by configured roots under `src/` and `test/` and evaluate it independently, except exact path `src/database/__tests__/seed.spec.ts` MUST be exempt only when it is the root.

For each ordinary root, the boundary MUST traverse repository-local imports, reexports, literal `import()`, and literal `require()` using the package's effective TypeScript Node16 configuration. It MUST follow cycles safely, preserve root-specific chains while caching resolved files, and stop at resolved external dependencies.

#### Scenario: Root discovery and root-only exception are enforced

- GIVEN configured specs plus the dedicated seed-contract spec and global-setup infrastructure
- WHEN roots are selected
- THEN every ordinary spec is checked, global setup is not a root, and only the exact seed-contract root is skipped
- AND another root reaching that spec or production seed receives no exemption

#### Scenario: Node16 closure follows supported static edges

- GIVEN a local dependency reached by a relative, index, alias, reexport, or `.js`-to-TypeScript edge
- WHEN the ordinary root is traversed
- THEN effective Node16 resolution follows that file, including cycles
- AND a resolved external dependency terminates traversal without inspecting package internals

### Requirement: Unknown and forbidden reachability fails with a chain

An ordinary root MUST fail if its closure reaches `prisma/seed.ts`, `test/global-setup.ts`, or `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, or `zx`. It MUST also fail closed on nonliteral `import()`/`require()`, an unresolved local edge, or a resolved local edge escaping the package. Every failure MUST identify the root, ordered local chain, source edge, and offending target or condition.

#### Scenario: Transitive forbidden target is actionable

- GIVEN an ordinary spec reaches a forbidden target through a local helper
- WHEN the boundary checks its closure
- THEN it fails even when the target is seed-contract or global-setup infrastructure
- AND the diagnostic shows the root-to-offense chain

#### Scenario: Indeterminate local edge is not treated as external

- GIVEN a traversed nonliteral loader or unresolved/escaping local edge
- WHEN resolution cannot prove a safe local closure
- THEN the root fails closed with the edge and condition
- AND only an actually resolved external package is accepted as a terminal

### Requirement: PR3 evidence is ordered, restored, and executable

RED MUST first add the new spec with an executable contract calling a deliberately missing local boundary helper and capture the expected missing-symbol/compile failure. GREEN MUST define the minimum helper in that same spec and pass on the clean source tree. Only after GREEN, TRIANGULATE MUST separately add reachable `node:child_process` and `prisma/seed.ts` edges, capture a chain-bearing failure for each, and restore exact bytes after each run.
From `viewpro-app/`, final verification MUST execute the exact commands in design/tasks: focused boundary Vitest, seed-contract Vitest, timed platform-control Vitest, platform-api `db:validate`, typecheck, lint, and exactly one `/usr/bin/time -p env TURBO_FORCE=true TURBO_ENV_MODE=loose VIEWPRO_PLATFORM_TEST_RETRY=0 pnpm test`. Database-backed runs MUST use the guarded local `_test` worker databases. Evidence MUST report each test baseline, `Δnew`, resulting total, platform-control's 37 passing tests and setup below 20 seconds, and command timing; a rerun MUST NOT substitute for the one root acceptance.

#### Scenario: Honest RED precedes mutation diagnostics

- GIVEN the boundary helper does not yet exist
- WHEN the executable spec calls it
- THEN the focused run fails for the missing symbol before implementation
- AND no transitive mutation result is claimed until the helper passes GREEN

#### Scenario: Post-GREEN mutations prove the guard

- GIVEN the minimum helper passes on clean source bytes
- WHEN each forbidden edge is added and checked separately
- THEN each run fails with its root-to-offense chain
- AND both mutations are byte-restored and absent from final diffs

#### Scenario: Corrected bytes pass once without masking

- GIVEN restored bytes and the mandatory local `_test` guard
- WHEN the exact final checks run from `viewpro-app/`
- THEN platform-control reports 37 tests with setup below 20 seconds and the root run passes once at baseline plus `Δnew`
- AND no retry, rerun, production change, or stale serial-worker assumption supplies acceptance

### Rollback

PR3's guard is independently revertible. Full capability rollback proceeds PR3→PR2→PR1 while retaining PR0 history, matching revised issue #311.
