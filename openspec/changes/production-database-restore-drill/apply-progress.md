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
