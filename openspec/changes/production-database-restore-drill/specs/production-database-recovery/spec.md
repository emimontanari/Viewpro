# production-database-recovery Specification

## Requirements

### Requirement: Safe Drill Preconditions

The drill MUST use two distinct temporary Neon projects, one per lane. Sources MUST be read-only. It MUST abort before restore on ambiguous, unallowlisted, non-distinct, or production targets.

#### Scenario: Isolated preflight passes

- GIVEN two distinct allowlisted projects and read-only sources
- WHEN identity and access scope pass
- THEN both lanes are authorized and production is untouched

#### Scenario: Unsafe destination aborts

- GIVEN a destination is ambiguous or could be production
- WHEN preflight evaluates it
- THEN restore does not start and no success is recorded

### Requirement: Recovery Input and RPO

For each lane, the drill MUST select the latest successful dump no more than 24 hours old. Before restore it MUST prove checksum, compression, and PostgreSQL readability without rows. At final lane validation, achieved RPO MUST be computed from validation completion to the dump timestamp; if it exceeds 24 hours, that lane MUST fail truthfully.

#### Scenario: Qualifying dumps pass

- GIVEN both lanes have qualifying dumps
- WHEN integrity checks pass
- THEN both dumps are accepted and final-validation RPO is recorded

#### Scenario: Stale or corrupt dump fails

- GIVEN a lane lacks a qualifying dump or any input check fails
- WHEN input validation completes
- THEN that lane fails and is not declared recoverable

### Requirement: Restore and RTO

Each lane MUST restore into its project and measure RTO from restore start to validated usability. It MUST pass at 60 minutes or less; other durations are separate.

#### Scenario: Restore meets objective

- GIVEN verified dumps and authorized destinations
- WHEN each restore reaches usability
- THEN each lane records RTO ≤60 minutes and passes

#### Scenario: Restore exceeds objective

- GIVEN a restore exceeds 60 minutes or never becomes usable
- WHEN timing or validation fails
- THEN the lane is truthfully reported as failed

### Requirement: Independent Restored-State Validation

Each restored database MUST match repository migrations/schema contracts. Validation MUST prove aggregate counts, relational and tenant isolation, and invariants without raw values.

#### Scenario: Structural and invariant checks pass

- GIVEN both databases restore
- WHEN migration, schema, aggregate, relational, and isolation checks run
- THEN all named checks pass with aggregate evidence only

#### Scenario: Invariant mismatch blocks success

- GIVEN any structural, count, relational, or isolation check fails
- WHEN validation completes
- THEN the affected lane fails and the drill is not successful

### Requirement: Cross-Lane Consistency

The drill MUST compare product/platform change-feed, mirror, and operator projections using digests and mismatch counts. It MUST verify tenant sets, status/limits, cursor order, event uniqueness, and non-status exclusion without raw data.

#### Scenario: Projections agree

- GIVEN both lanes pass independent validation
- WHEN cross-lane aggregate checks run
- THEN all required comparisons pass

#### Scenario: Projections disagree

- GIVEN tenant sets, statuses, limits, cursors, or event classes disagree
- WHEN comparisons complete
- THEN failure and mismatch counts are recorded without raw identifiers

### Requirement: Redacted Evidence

Evidence MUST include lane, dump age, checksums, versions, safe destinations, UTC timestamps, durations, outcomes, mismatch counts, cleanup receipts. It MUST NOT contain credentials, URLs, raw SQL, sensitive dump names, rows, customer identifiers, emails, storage keys, actor payloads, receipts, or money.

#### Scenario: Evidence is safe and reviewable

- GIVEN a completed or failed drill
- WHEN evidence is reviewed
- THEN objectives, checks, timings, failures, and redactions are auditable without prohibited values

### Requirement: Cleanup and Quarterly Reconciliation

After every outcome, the drill MUST prove deletion of projects and revocation of Neon/R2 credentials, retaining redacted evidence. A drill MUST recur quarterly, with runbook and ledger reconciled.

#### Scenario: Successful teardown reconciles records

- GIVEN both lanes complete validation
- WHEN teardown and reconciliation complete
- THEN both destinations are absent, credentials revoked, and records show the verified result

#### Scenario: Failed drill still cleans up

- GIVEN any preflight, input, restore, RTO, or invariant failure
- WHEN the drill exits
- THEN cleanup and revocation are proven, failure remains truthful, and the next quarterly drill is scheduled
