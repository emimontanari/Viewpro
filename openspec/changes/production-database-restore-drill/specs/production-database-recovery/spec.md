# production-database-recovery Specification

## Requirements

### Requirement: Safe Drill Preconditions
PR2c MUST use distinct targets and read-only sources. Before ANY operation, one gate MUST hold conjunctively: PR2b merged; new authorization recorded; exhausted reset approved/completed; fresh credentials/targets provisioned/validated. Targets MUST be allowlisted, empty, and production-denylisted.
#### Scenario: Isolated
- GIVEN complete gate; WHEN targets pass; THEN authorize PR2c, not production.
#### Scenario: Unsafe
- GIVEN false term/check; WHEN action requested; THEN block before cloud/runtime access.

### Requirement: Persistent Schema Parity Gate
PR2b MUST provide strict RED-GREEN evidence. Its dependency-free helper MUST lexically fold migrations into physical tables, supporting mapped, ignored, implicit-join, custom-schema, qualified quoted/case names, create/drop, rename, and schema move. It MUST ignore DDL in comments/strings and reject procedural/dynamic DDL. Migration paths MUST realpath beneath repository root; missing, non-directory, traversal, wrong-root, and symlink inputs MUST fail. Schemas MUST match an exact allowlist. CLI/user input MUST NOT enter SQL.

Discovery MUST use `psql -X`, minimal environment, `ON_ERROR_STOP`, and database read-only mode. Execute one constant `pg_catalog` query plus one separately-bounded ledger query, then exact-filter in JS. Include relkind `r`/`p`; exclude others. Separate `_prisma_migrations`; classify applied, rolled-back, and incomplete rows.

Output MUST return deterministic `pass:false`/exit 1 for mismatch and sanitized exit 2 for invalid/error. Tests MUST prove DDL fails and startup files cannot execute/output. PR2a records this contract only; PR2b proves helper behavior; PR2c owns gates/acceptance.
#### Scenario: Migration fold
- GIVEN folds, comments/strings, and dynamic DDL; WHEN tested; THEN fold or exit 2 exactly.
#### Scenario: Catalog and ledger
- GIVEN fake-`psql` schema/relkind/ledger fixtures; WHEN subprocess inspected; THEN bounded contracts pass.
#### Scenario: Missing/extra
- GIVEN parity/ledger difference; WHEN compared; THEN sorted differences, `pass:false`, exit 1.
#### Scenario: Invalid or hostile input
- GIVEN injection input, symlink/wrong-root, nonzero status, or hostile stderr; WHEN run; THEN exit 2 without interpolation/leakage.
#### Scenario: Redaction
- GIVEN sensitive fixtures; WHEN repeated; THEN bytes match with only counts/status and sorted PostgreSQL-quoted qualified repository names.

### Requirement: Recovery Input and RPO
Each lane MUST select its latest successful dump ≤24h, prove checksum/compression/PostgreSQL readability without rows, and compute RPO; >24h MUST fail.
#### Scenario: Qualifying
- GIVEN qualifying dumps; WHEN integrity passes; THEN accept, recording RPO.
#### Scenario: Stale/corrupt
- GIVEN invalid input; WHEN validated; THEN fail lane.

### Requirement: Restore and RTO
Each lane MUST restore and measure RTO from restore start to validated usability. RTO MUST be ≤60m; other durations remain separate.
#### Scenario: RTO pass
- GIVEN authorized restore; WHEN usable within 60m; THEN pass, recording RTO.
#### Scenario: RTO fail
- GIVEN RTO >60m or unusable state; WHEN validated; THEN fail lane.

### Requirement: Independent Restored-State Validation
Each database MUST match repository contracts and prove aggregate counts, relational/tenant isolation, and invariants without raw values.
#### Scenario: Structural
- GIVEN restored databases; WHEN contracts/helper pass; THEN aggregates pass.
#### Scenario: Invariant
- GIVEN mismatch; WHEN validated; THEN fail lane and drill.

### Requirement: Cross-Lane Consistency
The drill MUST compare product/platform change-feed, mirror, and operator projections through digests/counts, including tenants, status/limits, cursor order, uniqueness, and exclusions.
#### Scenario: Agree
- GIVEN valid lanes; WHEN compared; THEN pass without rows.
#### Scenario: Disagree
- GIVEN disagreement; WHEN compared; THEN fail with counts, never raw IDs.

### Requirement: Redacted Evidence
Evidence MUST include lane, dump age/checksums, versions, safe destinations, UTC durations, outcomes, mismatch counts, and cleanup receipts. It MAY include sorted PostgreSQL-quoted schema-qualified repository object names. It MUST exclude customer/runtime identifiers, values, rows, emails, URLs/hosts/IPs, credentials, exact dump keys, money, payloads, and raw SQL.
#### Scenario: Evidence
- GIVEN completed drill; WHEN reviewed; THEN outcomes auditable, prohibited fields absent.

### Requirement: Cleanup and Quarterly Reconciliation
PR2c MUST prove project deletion and Neon/R2 revocation, retain history/cleanup receipts immutably, recur quarterly, and reconcile runbook/ledger. Apply progress MAY append current status only.
#### Scenario: Teardown
- GIVEN validation; WHEN teardown finishes; THEN targets absent, credentials revoked.
#### Scenario: Cleanup
- GIVEN failure; WHEN reconciled; THEN failure/history remain truthful, next drill scheduled.
