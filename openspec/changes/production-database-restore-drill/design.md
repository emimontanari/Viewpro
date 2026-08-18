# Design: Production Database Restore Drill

## Technical Approach

Deliver the offline parity gate as two dependency-free Node ESM work units. `stacked-to-develop` means PR2b1 starts from merged `develop` and targets `develop`; after merge, PR2b2 starts from refreshed `develop` and targets `develop`; PR2c follows both the same way. No child targets an unmerged branch.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Pure migration module | Adds one internal module boundary | PR2b1 owns `migration-contract.mjs`; PR2b2 imports it without modification. This makes folding/path security independently reviewable, testable, and revertible. |
| DDL token fold | More code than regex | Lexically order migration directories; tokenize comments, strings, dollar quotes, and quoted/qualified identifiers; fold `CREATE/DROP TABLE`, rename, and schema move; fail closed on procedural/dynamic table shaping. |
| Two constant `psql` calls | Two processes rather than one | PR2b2 sends one exact catalog statement and one separately bounded ledger statement. No CLI value enters SQL; JS performs exact schema/relkind filtering. |
| Subprocess seam | Requires installed `psql` operationally | Use `psql -X -v ON_ERROR_STOP=1`, database-enforced read-only execution, and a minimal environment. The exact-byte fake proves argv, stdin, environment, startup isolation, and DDL rejection offline. |
| Canonical aggregate receipt | Omits unexpected object names | Fixed key order, sorted permitted repository names, counts/status only, and sanitized errors prevent runtime or credential leakage. |

## Slice Boundaries and Data Flow

```text
PR2b1: candidate path -> repository realpath confinement -> ordered DDL fold -> expected tables
                                                                    |
PR2b2: allowlisted schemas -> constant catalog SQL -> exact filter --+-> parity + ledger -> canonical CLI
                           -> bounded ledger SQL ---------------------+
PR2c:  authorization gate -> two-lane restore/validate/evidence/cleanup (unchanged)
```

PR2b1 has no subprocess import, database connection, public CLI, package script, cloud call, or production operation. It realpath-confines paths, rejecting missing/non-directory/traversal/wrong-root/symlink/metacharacter input, and folds physical tables. Focused RED executes and is recorded before minimal GREEN.

PR2b2 validates schemas, imports PR2b1, then runs RED before GREEN. It owns injection, malformed/nonzero output, exact catalog/ledger SQL across valid schemas, startup/DDL isolation, redaction, exits 0/1/2, and 23/6 physical sets. It passes explicit argv and only required executable/libpq/locale variables; child stderr, raw SQL, environment, hosts, credentials, and runtime identifiers never reach public output. `LIMIT 1000` is a bounded ceiling above current migration counts; saturation fails closed.

PR2b2 bounds each child: timeout sends SIGTERM, then SIGKILL after 250ms grace; spawn/signal/timeout return sanitized exit 2. Current diagram: `develop (merged #321) → PR2a2 split-plan amendment → develop → PR2b1 → develop → 📍 PR2b2 → develop → PR2c → develop`. Future PR bodies copy it and move the single `📍` to their own slice; no placeholders.

## Interfaces / Contracts

```js
// PR2b1: scripts/restore-drill/migration-contract.mjs
validateMigrationDirectory(candidate, { repositoryRoot }) -> canonicalDirectory
foldMigrations(candidate, { repositoryRoot }) -> { tables: readonly string[] }

// PR2b2: scripts/restore-drill/schema-parity.mjs
runParity({ migrationDir, repositoryRoot, schemas, psqlPath })
  -> { exitCode: 0 | 1 | 2, output: CanonicalReceipt }
```

Production uses four options; tests alone call async `runParity(options, { spawnProcess, timeoutMs })` with Node `spawn` compatibility; CLI accepts neither.

PR2b1 errors use stable internal codes: `migration_path_invalid`, `expected_tables_invalid`, or `migration_sql_unsupported`. PR2b2 maps invalid schema/process/output failures to sanitized exit 2; parity or ledger mismatch yields deterministic exit 1; pass yields exit 0. JSON is newline-terminated with fixed key order and sorted PostgreSQL-quoted repository names. Apply-progress may append sanitized local TDD evidence separately from immutable operational evidence, never rewriting history or reinterpreting this contract.

## File Changes and Review Budget

| Slice | Files | Target |
|---|---|---:|
| PR2b1 | Migration contract and focused fold/path tests/fixtures | ≤389 |
| PR2b2 | Parity CLI, remaining tests/fake, package script | ≤389 |
| PR2c | Existing receipt/runbook/ledger/status/evidence paths only | ≤389 |

The prior combined RED notes are non-authoritative planning input. Apply follows the current spec/design/tasks. Hard maximum 400; re-slice at 390; accept ≤389.

## Verification and Rollback

| Slice | Verification | Rollback boundary |
|---|---|---|
| PR2b1 | Create/narrow tests, execute/record focused failing RED, then minimal GREEN and diff/secret checks | Revert only migration module and focused tests/fixtures. |
| PR2b2 | Create/narrow tests, execute/record focused failing RED, then minimal GREEN; prove exact SQL/query count, lifecycle exit 2, process safety, outputs, and 23/6 sets | Revert process/parity/CLI tests/fake/script; PR2b1 remains valid. |
| PR2c | Existing authorization, integrity, RPO/RTO, invariants, cross-lane evidence, teardown, and reconciliation checks | Revert current records only; retain immutable history and cleanup receipts. |

## PR2c Gate, Rollout, and Open Questions

No PR2c action occurs until all are true: PR2b1/PR2b2 merged; new authorization recorded; exhausted-attempt reset approved and completed; fresh credentials plus fresh targets provisioned and validated; read-only sources; and targets distinct, allowlisted, empty, compatible, and production-denylisted. PR2c owns restore acceptance, retry decisions, evidence, and cleanup. No database migration is required.

Open questions: None.
