## Exploration: Production Database Restore Drill

### Current State

Issue #290 remains pending: historical evidence covers only one Neon branch, while acceptance requires both current dumps, restored-state validation, redacted RPO/RTO evidence, cleanup proof, cadence, and reconciled docs.

Production has two authoritative PostgreSQL sources:

| Lane | Application | Source secret | R2 prefix |
|---|---|---|---|
| Product/tenant | `apps/api` | `NEON_PROD_DIRECT_URL` | `inmoview-prod/` |
| Platform/operator | `apps/viewpro-api` | `NEON_PLATFORM_DIRECT_URL` | `viewpro-platform-prod/` |

`.github/workflows/db-backup.yml` runs nightly at 06:00 UTC, uses PostgreSQL 17, uploads owner/privilege-free gzipped plain SQL to R2, and retains 30 days. Current workflow metadata shows successful runs through 2026-08-13 and both prefixes in the latest run. R2 object metadata was not queried and no dump was downloaded.

The local PostgreSQL client is 18.4. The ledger and runbook still describe backups/restore work as incomplete.

### Acceptance Gap

Both-lane restore, migration/schema/count/invariant validation, redacted timing evidence, target removal, credential revocation, quarterly cadence, and documentation reconciliation remain unproven in the repository.

### Resolved Decisions and Boundaries

- Use exactly two distinct dedicated temporary Neon projects, one per lane; never use production-project branches or local substitutes.
- Enforce RPO ≤24h and RTO ≤60m per lane; run full drills quarterly, with the next date and escalation recorded.
- Use temporary least-privilege Neon/R2 credentials, read-only production sources, destination-only restore environments, and aggregate/redacted evidence.
- Require explicit two-person or maintainer confirmation before any restore.
- PR1 is planning-only OpenSpec work targeting `develop`; it performs no production access or operation. PR2 is created only after PR1 merges, starts from updated `develop`, and contains execution, cleanup evidence, runbook/ledger updates, and the sanitized receipt.

### Safety and Validation Findings

Select the newest successful object under each exact prefix only after metadata, timestamp, non-zero size, checksum, gzip, and PostgreSQL readability checks. Do not infer freshness from workflow success. `psql -v ON_ERROR_STOP=1` is the restore proof; `prisma migrate status` must show repository parity without repairing via `migrate deploy`.

Product checks cover tenant-scoped aggregates, relational orphans/agreement, command idempotency, and ordered outbox sequences. Platform checks cover operator/tenant aggregates, mirror/audit uniqueness, cursor state, payment/reversal classes, and active OWNER presence without monetary output. Cross-lane checks use salted set hashes, mismatch counts, projection status/limits, cursor bounds, and event-class booleans only.

Achieved RPO is `validation_complete_utc - dump_timestamp_utc`, evaluated separately for each lane at final validation; a value over 24 hours fails that lane truthfully. Achieved RTO is validation completion minus restore start. Record UTC timestamps and monotonic durations separately from provisioning, download, validation, teardown, and total duration.

Cleanup must run on success, failure, and interruption: remove targets and transient files, verify absence, revoke credentials, verify revocation, and retry idempotently. Retain only a sanitized receipt; raw logs, dumps, URLs, credentials, rows, identifiers, payloads, and money stay outside Git.

### Non-goals and Risks

No production writes, failover, PITR, traffic cutover, object recovery, workflow rewrite, restore automation, or raw-row inspection. Logical dumps do not prove roles/grants. Backup success does not prove object integrity; authenticated metadata checks remain mandatory.
