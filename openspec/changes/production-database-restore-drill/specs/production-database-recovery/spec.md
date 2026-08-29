# production-database-recovery Specification

## Requirements

### Requirement: Safe Drill Preconditions
Before ANY operation, PR2c MUST prove both slices merged; new authorization recorded; exhausted-attempt reset approved and completed; fresh credentials plus fresh targets provisioned and validated; read-only sources; and targets distinct, allowlisted, empty, compatible, and production-denylisted.
#### Scenario: Isolated
- GIVEN complete gate; WHEN targets pass; THEN authorize PR2c, not production.
#### Scenario: Unsafe
- GIVEN false term/check; WHEN action requested; THEN block before cloud/runtime access.

### Requirement: Persistent Schema Parity Gate
Both slices MUST provide RED-GREEN evidence: PR2b1 realpath-confines paths and rejects missing/non-directory/traversal/wrong-root/symlink/metacharacter input; PR2b2 adds subprocess/parity/CLI. Helper MUST support mapped/ignored/implicit-join/custom-schema/quoted-case tables, create/drop, rename, and schema move; ignore comments/strings; reject procedural/dynamic DDL; allowlist schemas; and keep user input out of SQL.

PR2b2 MUST use `psql -X`, minimal env, `ON_ERROR_STOP`, and read-only mode. It MUST execute constant catalog and `LIMIT 1000` ledger queries and filter. 23/6 sets derive from migrations; saturation fails closed. Keep `r`/`p` and classify `_prisma_migrations` as applied, rolled-back, or incomplete.

Output MUST emit canonical `pass:true`/exit 0; deterministic `pass:false`/exit 1 mismatch; sanitized exit 2 invalid/process error. Focused RED executes/records before GREEN. PR2b2 MUST prove schema injection, malformed output, constant SQL across valid schemas, startup/DDL isolation, redaction, exits 0/1/2, and exit 2 on spawn failure, signal termination, or deterministic hung-`psql` timeout with forced cleanup.
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
Each lane MUST select its latest successful dump ≤24h, prove checksum/compression/PostgreSQL readability without rows, and compute RPO; older input fails.
#### Scenario: Qualifying
- GIVEN qualifying dumps; WHEN integrity passes; THEN accept, recording RPO.
#### Scenario: Stale/corrupt
- GIVEN invalid input; WHEN validated; THEN fail lane.

### Requirement: Restore and RTO
Each lane MUST measure RTO from restore start to validated usability; RTO MUST be ≤60m.
#### Scenario: RTO pass
- GIVEN authorized restore; WHEN usable within 60m; THEN pass, recording RTO.
#### Scenario: RTO fail
- GIVEN RTO >60m or unusable state; WHEN validated; THEN fail lane.

### Requirement: Independent Restored-State Validation
Each database MUST match repository contracts and prove aggregate counts, relational/tenant isolation, and invariants without raw values. PR2c acceptance requires helper exit 0 and receipt `pass:true`.
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
Evidence MUST include lane, dump age/checksums, versions, safe destinations, UTC durations, outcomes, mismatch counts, and cleanup receipts. It MAY include sorted PostgreSQL-quoted repository object names. It MUST exclude customer/runtime identifiers, values, rows, emails, URLs/hosts/IPs, credentials, dump keys, money, payloads, and raw SQL.
#### Scenario: Evidence
- GIVEN completed drill; WHEN reviewed; THEN outcomes auditable, prohibited fields absent.

### Requirement: Cleanup and Quarterly Reconciliation
PR2c MUST prove deletion/revocation, retain immutable receipts, recur quarterly, and reconcile runbook/ledger. Apply-progress MAY append sanitized local TDD evidence separately from immutable operational evidence, never rewriting history or reinterpreting the contract.
#### Scenario: Teardown
- GIVEN validation; WHEN teardown finishes; THEN targets absent, credentials revoked.
#### Scenario: Cleanup
- GIVEN failure; WHEN reconciled; THEN failure/history remain truthful, next drill scheduled.
