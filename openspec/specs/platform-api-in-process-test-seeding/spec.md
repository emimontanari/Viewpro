# Platform API In-Process Test Seeding Specification

## Purpose

This capability keeps ordinary platform-api integration tests on deterministic, Nest-owned in-process operator seeding while preserving the production seed contract and enforcing the boundary through executable static dependency checks.

## Requirements

### Requirement: Normal integration tests use no production seed subprocess

Ordinary platform-api integration specs that need operator data MUST use the test-only in-process fixture and MUST NOT invoke the production seed CLI or another seed process. The dedicated `src/database/__tests__/seed.spec.ts` contract is the only root allowed to exercise that CLI.

#### Scenario: Ordinary consumers retain the in-process boundary

- GIVEN an ordinary integration spec needs operator data
- WHEN its setup creates that data
- THEN it uses the shared in-process fixture rather than a production-seed process
- AND only the dedicated seed contract may exercise the production seed CLI

### Requirement: A shared fixture uses active Nest-owned dependencies

The test-only operator fixture MUST obtain the active testing module/app’s Nest-owned `PrismaService` and `PASSWORD_HASHER`, hash in process, and accept explicit email, password, role, and status inputs with `OWNER`/`ACTIVE` defaults.

#### Scenario: Fixture follows the active application lifecycle

- GIVEN a bootstrapped Nest testing application
- WHEN the fixture creates an operator
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

#### Scenario: Production contracts remain bounded

- GIVEN the in-process fixture and static boundary are in place
- WHEN platform-api verification runs
- THEN production seeding, `_test` safety, Nest cleanup, default retries, and worker topology remain unchanged
- AND boundary maintenance does not require production source changes

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

An ordinary root MUST fail if its closure reaches `prisma/seed.ts`, `test/global-setup.ts`, or `node:child_process`, `child_process`, `execa`, `cross-spawn`, `tinyexec`, `shelljs`, or `zx`. It MUST also fail closed on nonliteral `import()`/`require()`, an unresolved local edge, or a resolved local edge escaping the Git repository. Every failure MUST identify the root, ordered local chain, source edge, and offending target or condition.

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
