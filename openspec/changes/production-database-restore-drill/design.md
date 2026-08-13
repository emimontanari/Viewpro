# Design: Production Database Restore Drill

## Technical Approach

Add a quarterly recovery procedure for the nightly plain-SQL dumps from `.github/workflows/db-backup.yml`. Product (`inmoview-prod/`) and platform (`viewpro-platform-prod/`) run independently into dedicated temporary Neon projects. Production is only an R2-origin backup source; restore and validation receive destination credentials only.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Manual runbook with checked commands | Less repeatable, but keeps deletion and sensitive inputs under explicit review | Use first; no destructive script before one evidenced drill. |
| Two temporary Neon projects | Costs quota but gives control-plane isolation and unambiguous deletion | Required: one project per lane, never branches in production projects. |
| Sanitized committed receipt | Durable and reviewable, but metadata must be minimized | Generate a non-committed working receipt, review/redact it, then commit only the approved sanitized Markdown summary. Never commit downloaded dumps or transient JSON. |

## Data Flow and Safety Gates

```text
R2 list/head -> newest qualifying object per exact prefix -> checksum/gzip/header checks
   -> guarded destination-only psql restore -> schema/invariants -> sanitized receipt
   -> delete projects/files -> verify absence -> revoke credentials
```

Preflight resolves target identity through Neon metadata and requires explicit allowlisted temporary project IDs **and** names containing the generated drill marker, distinct lane project/database IDs, source/target inequality, and temporary environment labels. A production project ID/name/host denylist is mandatory. Missing or conflicting metadata aborts. Restore subprocess environments contain `TARGET_DATABASE_URL` only; `NEON_PROD_DIRECT_URL`, `NEON_PLATFORM_DIRECT_URL`, and other source DB variables must be absent. R2 credentials are list/get-only; Neon credentials are temporary, target-scoped, and revoked on every exit.

For each prefix, list successful objects and select the latest key matching its timestamp format and completed before drill start. Record hashed key, object timestamp, age, non-zero size, provider ETag/checksum metadata, and compressed SHA-256. Require age <=24h, `gzip -t`, and a decompressed first-line/header classification as PostgreSQL plain SQL without printing content. `psql -v ON_ERROR_STOP=1` provides final SQL readability proof.

## Validation Contract

Against target direct URLs, `prisma migrate status` must report repository parity for both `viewpro-app/apps/api/prisma/migrations/` and `viewpro-app/apps/viewpro-api/prisma/migrations/`; do not repair with `migrate deploy`. Compare expected tables, enums, indexes, foreign keys, and `_prisma_migrations` names/counts with the two `schema.prisma` roots.

Evidence queries return counts, mismatch counts, salted set hashes, or booleans only:

- **Product:** counts for tenants, users/memberships, assets/engagements/agents, movements, document requests/documents/versions, notifications, analytics, command log, and outbox; zero FK orphans; membership and engagement-child tenant agreement; unique command idempotency keys and outbox `seqNo` with monotonic min/max/count checks.
- **Platform:** counts for operators by role/status, tenants, mirror, cursor, audit by source, and payment/reversal classes; active OWNER exists; unique mirror/audit source events; one cursor row; reversal links reference originals uniquely, never reversals; payment periods are ordered. No monetary totals are emitted.
- **Cross-lane:** salted tenant-set hashes and mismatch count; status/limit projection mismatch counts; cursor <= product outbox maximum; mirror/audit source-event uniqueness; audit-only events excluded from mirror; status mirror values non-empty.

## Timing and Evidence

Record UTC timestamps plus monotonic durations: dump timestamp; drill/preflight start; restore start; schema-ready; invariant-validation complete; teardown start/complete. At final lane validation, `RPO = validation_complete - dump_timestamp`; if it exceeds 24h, the lane fails. `RTO = validation_complete - restore_start`; teardown and total drill durations are separate. Each lane must meet RPO <=24h and RTO <=60m.

The receipt records lane, dump fingerprint/bytes, tool/server major versions, hashed target identity, timings, aggregate vectors, named invariant outcomes, mismatch counts, cleanup absence, and revocation outcome. It excludes URLs, secrets, raw SQL/rows, customer identifiers, emails, storage keys, JSON payloads, receipts, money, and unapproved object names.

## File Changes During Apply

| File | Action | Description |
|---|---|---|
| `docs/plans/2026-07-21-production-go-live-runbook.md` | Modify | Add guarded two-lane procedure, receipt template, quarterly cadence, abort/cleanup checklist. |
| `docs/plans/2026-07-20-recta-final-execution.md` | Modify | Reconcile backup automation separately from drill completion. |

Keep this documentation-only work unit <=400 changed lines. The first operational receipt is a later, separately reviewed work unit.

## Testing Strategy

| Layer | Approach |
|---|---|
| Static safety | Review commands for fail-closed allowlists, destination-only environment, `ON_ERROR_STOP`, redaction, and idempotent cleanup; no script is added now. |
| Dry run | Exercise preflight with synthetic metadata; prove production-like, equal, unknown, or unallowlisted targets abort before download/restore. |
| Acceptance | Perform both isolated restores, validations, timing, teardown, absence checks, and revocation; production remains read-only. |

Abort on any ambiguity, stale/corrupt input, restore error, invariant failure, or RTO breach. Cleanup is retry-safe: absent projects/files and already-revoked credentials count as success after provider verification; recovery success remains false if validation failed.

## Migration / Rollout

No application or database migration. Publish the runbook first; execute only after prerequisites are approved.
