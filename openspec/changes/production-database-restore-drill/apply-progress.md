# Apply Progress: Production Database Restore Drill

## PR2 Execution State

- **Work unit:** `pr2-two-lane-restore-execution`
- **Mode:** Strict TDD operational acceptance
- **Outcome:** Attempt 2 failed truthfully after product restore reached structural validation
- **Completed tasks:** 0/12

## Attempt History

### Attempt 1 — Failed Before Download

The initial product preflight reached the isolated target and confirmed an empty schema and compatible server major. It incorrectly treated provider compute-side TLS diagnostics as client-TLS acceptance evidence, so the batch stopped before download or restore. The incident audit superseded that gate: successful client TLS with channel binding is authoritative; the compute-side diagnostic is retained as provider-boundary context only.

### Attempt 2 — Failed at Product Structural Validation

Both isolated targets passed fresh fail-closed preflight with verified client TLS, TLS 1.3, non-empty cipher evidence, required channel binding, expected host fingerprints, empty schemas, compatible server major, and the provider-boundary diagnostic recorded without gating. Current R2 list/HEAD guards passed and the product dump passed size, checksum, gzip, and plain-SQL-header checks. Product restore completed, but structural validation found a schema-table parity mismatch while repository migration parity and foreign-key validation passed. The platform lane was not started after that affected-lane failure.

All local transient material was removed. Temporary cloud projects and R2-token revocation remain explicit user-owned actions.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2 (attempt 1) | transient guard harness (removed) | Operational acceptance | N/A (transient harness) | ✅ Import failure observed before implementation | ✅ Guard tests passed | ✅ allow + production-like/equal/unknown/unallowlisted rejection | ✅ Header/metadata gate refined; compute-side TLS gate proved incorrect, task incomplete |
| 1.2 (attempt 2) | transient guard harness (removed) | Operational acceptance | N/A (transient harness) | ✅ Import failure observed before implementation | ✅ 5/5 guard tests passed | ✅ legacy/current libpq TLS metadata and trusted CA context | ✅ Client-TLS gate now uses verify-full, system trust, channel binding, TLS 1.3, and cipher evidence |
| 2.1 (attempt 2) | N/A — task incomplete | Operational acceptance | N/A | ➖ Runtime acceptance follows task 1.2 guard | ✅ Restore completed | ➖ Structural validation stopped the affected lane | ➖ No refactor; schema-table mismatch blocks completion |

## Pending Tasks

- [ ] 1.1–4.3 — no task checkbox changed. Reconcile the product schema-table parity mismatch before any new authorized attempt.

## Current Reconciliation — 2026-08-14

### Historical Plan Label

The historical **0/12** status and task IDs **1.1–4.3** above belong exclusively to the superseded 12-task operational plan. They are immutable attempt evidence and MUST NOT be attributed to the updated 14-task plan. Current chain: PR1 merged → PR2a planning correction → PR2b helper/tests → PR2c authorized operation. Current status is **0/14**; no task is complete.

### User-Attested Cleanup (Not Task Completion)

The user attests that both temporary Neon projects were deleted, the temporary R2 token was revoked, and all five related macOS Keychain entries were removed. This is user attestation only, not provider receipt evidence. It records cleanup of the historical failed attempt and does **not** complete PR2c task 4.4 or any other current-plan task.

### Append-Only Rule

Future reconciliation may append current task status and cleanup fields only. It MUST NOT alter, replace, or reinterpret prior attempt diagnosis, TDD evidence, pending-task text, or cleanup evidence. Rollback may remove current runbook/ledger/receipt changes, but immutable attempt history and cleanup receipts remain.

## PR2b Offline Helper — Blocked Before GREEN

- **Scope:** Offline fake-`psql` tests and fixture only; no source helper, package entry, cloud/runtime action, credentials, or external resource access.
- **Outcome:** Blocked by missing local Vitest executable before the focused test module could load. No PR2b task is complete and no task checkbox changed.
- **Command:** `pnpm --filter @viewpro/api test -- test/restore-schema-parity.spec.ts`
- **Result:** `vitest: command not found`; the worktree has no `node_modules` and the checked main workspace exposes only `turbo`.

### TDD Cycle Evidence

| Task | Test File | Layer | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 2.1–2.3 | `viewpro-app/apps/api/test/restore-schema-parity.spec.ts` | Unit/process seam | Written first; runner unavailable before execution | Blocked — no production code written | Not started |

## PR2b RED Scaffold Correction — 2026-08-14

- **Historical preservation:** All prior apply-progress bytes remain unchanged; this is an append-only correction.
- **Contract correction:** The RED expectation retains both `"public"."Camel"` and `"public"."Thing"` after the schema move and rename. It now covers lexical ordering, `r`/`p` relkinds, multiple allowlisted schemas, incomplete and rolled-back ledger rows, sorted multi-item diffs, hostile migration paths, schema injection, dynamic DDL, malformed output, and sanitized command failure.
- **Fake process correction:** The fake `psql` can reject an attempted table-shaping DDL statement and emits a synthetic startup marker only when `-X` is absent; production-path tests require neither condition to occur.
- **Focused command correction:** After dependency hydration, use `pnpm --filter @viewpro/api test test/restore-schema-parity.spec.ts` (no `--` separator) so the manifest's `vitest run` receives the sole focused file argument.
- **Environment correction:** The worktree has no `node_modules`. The main workspace API has Vitest 4.1.6, but its modules do not resolve into this separate worktree. RED remains unexecuted; no PR2b task is complete.

## PR2b RED Coverage Correction — 2026-08-14

- **Migration and relkind coverage:** RED now asserts exact mapped, ignored, and implicit-join physical names, and proves unsupported `v`/`S` relkinds inside allowlisted schemas do not enter parity.
- **Process boundary coverage:** RED compares byte-identical catalog stdin for distinct valid schema selections. The fake rejects create (standard/temp/unlogged), alter, drop, truncate, and select-into table shaping while allowing a string literal containing DDL text.

## PR2b RED Determinism and Boundary Correction — 2026-08-14

- **Determinism and bounded ledger:** RED now serializes two identical runs byte-for-byte, requires each ledger query to contain a numeric `LIMIT`, and makes the fake reject an unbounded ledger query.
- **Filesystem and lexical guards:** RED rejects nested migration-directory and `migration.sql` escape symlinks. Fake SQL recognition ignores comments, quoted strings/identifiers, and dollar-quoted bodies while still rejecting comment-separated table DDL.

## PR2b RED Public-Contract Correction — 2026-08-14

- **Public output and environment:** RED permits repository-derived missing names but requires unexpected catalog identifiers to remain count-only. It asserts an explicit libpq/locale/executable allowlist and rejects unrelated inherited variables.
- **CLI and repository contracts:** RED now compares offline CLI stdout bytes, newline policy, and exit status, asserts both complete sorted repository physical sets, and keeps bounded-ledger enforcement active on the production-path fake.

## PR2b RED External-Contract Correction — 2026-08-14

- **Redaction and forwarding:** Unexpected runtime catalog names are count-only, while repository-derived missing names remain reviewable. The process seam permits only explicit executable, locale, and libpq connection keys.
- **Executable proof:** RED exercises the offline CLI twice for byte-identical newline-terminated stdout and exit status; ledger bounds must be numeric executable tokens, never comment or string text.

## PR2b RED CLI-Failure Correction — 2026-08-14

- **CLI and traversal proof:** RED now exercises actual offline CLI exit 1 and sanitized exit 2 outputs, compares catalog and ledger stdin across distinct selections, and traverses to an existing path outside the repository boundary.

## PR2b RED PostgreSQL-CLI Correction — 2026-08-14

- **Binding and output proof:** RED now requires ordered `psql -X -v ON_ERROR_STOP=1` argv binding, executable read-only SQL, and exact newline-terminated canonical stdout for CLI exits 0, 1, and 2.

## PR2b RED Query-Shape Correction — 2026-08-14

- **Query, mode, and environment proof:** RED requires catalog namespace/name/relkind and ledger state projections, rejects later read-write overrides, and records exact synthetic forwarded environment values with no unrelated key.

## PR2b RED Effective-Query Correction — 2026-08-14

- **Projection, order, and limit proof:** RED validates required columns in each SELECT list before `FROM`, requires read-only setup before discovery, and fixes the ledger cap at synthetic constant `1000` so all current migration states fit while `0`/`1` fail.

## PR2b RED Exact-Byte Correction — 2026-08-14

- **Exact query proof:** RED sidecars define the only accepted catalog and ledger SQL bytes, including ordered projections, read-only setup, deterministic ordering, and `LIMIT 1000`; all mutations fail offline.

## PR2b Split-Authority Correction — 2026-08-14

- The unexecuted combined-RED engineering notes above are invalidated as current-plan authority; they remain historical local notes only. Current PR2b authority is the amended spec, design, and uniquely labelled tasks.
- Apply-progress MAY append sanitized local TDD status/evidence separately from immutable operational evidence. It MUST never rewrite history, reinterpret an operational attempt, or replace the contract.

## PR2b Current-Status Authority Correction — 2026-08-14

- The historical `current chain`, `0/14`, and task `4.4` statements at lines 38/42 are not current status. Current authority is the amended 11 uniquely labelled tasks across PR2b1, PR2b2, and PR2c; historical operational facts remain immutable.

## PR2b Task-Count Scope Correction — 2026-08-14

- The 11 current tasks comprise `PLAN.1` plus ten delivery tasks across PR2b1, PR2b2, and PR2c; this corrects the scope wording above without changing the authoritative total.
