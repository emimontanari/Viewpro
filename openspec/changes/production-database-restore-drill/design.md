# Design: Production Database Restore Drill

## Technical Approach

PR2a changes only the five planning/evidence artifacts. PR2b adds the dependency-free Node ESM helper, all offline Vitest security/behavior tests, fixtures, and package entry. PR2c retains guarded two-lane restore execution and cannot begin until its conjunctive gate is complete.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Migration DDL lexer/folder | More code than regex | Choose: migrations encode physical names. Lexically sort directories; tokenize comments, strings, quoted/qualified identifiers; fold `CREATE/DROP TABLE`, rename, and schema move; fail closed on procedural/dynamic table shaping. |
| Constant catalog SQL + JS filter | Returns bounded metadata before filtering | Choose: eliminates schema interpolation. Validate schemas against an exact allowlist, query constant metadata once, then exact-filter in JS. Query `_prisma_migrations` separately with a constant bounded statement. |
| `psql` subprocess | Requires installed client | Choose: no dependency change and fake executable gives a complete offline seam. Use `-X`, `ON_ERROR_STOP`, minimal inherited environment, and database-enforced read-only mode. |
| Append-only history | Current-state correction is less compact | Choose: attempt diagnosis and cleanup receipts are audit evidence, not mutable task state. |

## Data Flow and Boundaries

```text
realpath(repo/migrations) -> ordered DDL fold -> expected tables
allowlisted schemas -> constant pg_catalog SQL -> exact JS filter -> actual tables
constant bounded ledger SQL -------------------------------> ledger state
expected + actual + ledger -> canonical receipt + exit 0/1/2
```

The CLI accepts only a migration directory resolving beneath the discovered repository root and repeatable schemas from a fixed allowlist. Reject missing/non-directory, traversal, wrong-root, symlink, metacharacter, and injection-shaped input before spawning. Never place user input in SQL.

Spawn `psql` with explicit argv including `-X`; pipe exactly one static catalog query to stdin under `ON_ERROR_STOP` and `default_transaction_read_only=on` (or an explicit read-only transaction), then run one separately bounded constant ledger query. Pass only required executable/libpq/locale variables; do not spread `process.env`. Capture output, discard hostile stderr from public results, and return sanitized exit 2 on failure. Catalog rows include namespace/name/relkind only; JS accepts allowed schemas and relkind `r`/`p`, excludes views, sequences, other relkinds, and separates `_prisma_migrations`.

Canonical output has fixed key order and sorted PostgreSQL-quoted qualified names. Exit 0 requires `pass:true`; exit 1 always includes deterministic `pass:false` for parity/ledger mismatch; exit 2 covers invalid input, unsupported SQL, or subprocess error. Permitted names are repository schema objects—not customer/runtime identifiers. Prohibited output includes values, rows, emails, URLs/hosts/IPs, credentials, exact dump keys, money, payloads, raw SQL, environment, and child stderr.

## File Changes and Review Forecast

| File | Action | Estimate |
|---|---|---:|
| Current five OpenSpec paths | PR2a planning correction | 388 actual |
| `viewpro-app/scripts/restore-drill/schema-parity.mjs` | PR2b helper/CLI | 155–175 |
| `viewpro-app/apps/api/test/restore-schema-parity.spec.ts` | PR2b tests | 145–165 |
| `viewpro-app/scripts/restore-drill/fixtures/*` | PR2b fixtures/fake `psql` | 35–45 |
| `viewpro-app/package.json` | PR2b command | 2–4 |

PR2a is exactly these five paths at 388 changed lines: hard stop ≤400. PR2b forecasts 337–389. At 390, stop and reduce duplicated fixture/helper code; if still projected over 400, replan a stacked non-security fixture/package slice. Helper and every security test remain together; none may be dropped. No size exception.

PR2c file budget: receipt 80–100; runbook 50–65; ledger 20–30; append-only status 15–20; operational evidence 135–175: **300–390**. At 390, stop; before 400, split runbook/ledger/current-record reconciliation into a later stacked-to-main slice. Keep operational acceptance with cleanup evidence; delay #290 closure until reconciliation lands.

## Testing Strategy

PR2b RED cases cover lexical order; create/drop; rename; schema move; quoted qualified/case names; comments/string literals; dynamic/procedural rejection; repository boundary/symlinks; and deterministic exits. Fake-`psql` tests inspect stdin, argv, and environment; provide multiple schemas, every relevant relkind, separate ledger applied/rolled-back/incomplete rows, attempted DDL, startup-file output, nonzero status, and hostile stderr. They prove `-X`, read-only DB enforcement, constant query count, exact JS filtering, no interpolation, no leakage, and current 23/6-table expectations.

## PR2c Gate, Rollout, and Rollback

No PR2c action occurs until all are true: PR2b merged; new explicit authorization recorded; exhausted runtime reset approved+completed; fresh credentials/targets provisioned+validated. PR2c alone owns restore acceptance, RPO/RTO, invariants, cross-lane checks, evidence, teardown, and retry decisions.

Rollback may revert PR2a planning, PR2b code, or PR2c runbook/ledger/current receipt changes. Immutable attempt history and cleanup receipts MUST remain. No database migration is required.

## Open Questions

None.
