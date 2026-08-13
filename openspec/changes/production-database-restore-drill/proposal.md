# Proposal: Production Database Restore Drill

## Intent

Prove recoverability—not merely backup execution—for both production databases: product and platform. Establish quarterly drills with RPO ≤24 hours and RTO ≤60 minutes per lane while production remains read-only.

## Scope

### In Scope
- Select each lane's latest verified dump and prove metadata, checksum, gzip, and restore integrity.
- Restore into two temporary Neon projects with preflight target guards.
- Validate migrations, schema, aggregate counts, lane invariants, and cross-lane consistency.
- Record RPO/RTO timings and aggregate/redacted evidence; prove target cleanup and credential revocation.
- Establish quarterly drills; reconcile the stale ledger and runbook.

### Out of Scope
- Production writes, failover, PITR validation, or application traffic cutover.
- Raw-data inspection/export or permanent environments.
- Backup scheduler redesign unless drill evidence shows it fails recovery objectives.

## Capabilities

### New Capabilities
- `production-database-recovery`: Two-lane drills, recovery objectives, redacted evidence, teardown, and cadence.

### Modified Capabilities
None.

## Approach

Run product and platform restore lanes against separately allowlisted temporary Neon projects. Preflight requires generated target markers and production denylisting. Each lane verifies its dump, restores with fail-fast PostgreSQL tooling, validates migrations/schema/counts/invariants, and records RPO/RTO. Cross-lane checks use only digests and mismatch counts. Teardown confirms target absence and Neon/R2 credential revocation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/specs/production-database-recovery/spec.md` | New | Recovery drill contract |
| `docs/plans/2026-07-21-production-go-live-runbook.md` | Modified | Procedure, evidence, cadence |
| `docs/plans/2026-07-20-recta-final-execution.md` | Modified | Reconciled status |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong destination | Low | Allowlist temporary IDs; deny production; abort on ambiguity |
| Sensitive evidence | Med | Prohibit secrets, rows, customer identifiers, and sensitive object metadata |
| Corrupt dump or role/grant gaps | Med | Integrity checks; fail-fast restore; document logical-dump limits |
| Cross-lane mismatch | Med | Independent restores plus digest/mismatch checks |
| Cost/quota limits | Med | Confirm capacity before provisioning; destroy targets promptly |
| Incomplete cleanup | Low | Cleanup on every exit; verify deletion and credential revocation |

## Rollback Plan

Abort before restore on target ambiguity. On failure, destroy isolated targets, remove transient artifacts, revoke credentials, and retain only redacted evidence. Production remains untouched.

## Dependencies

- Least-privilege Neon and R2 access; current successful dumps.
- PostgreSQL client ≥ server; Neon capacity/quota; operator availability.

## Success Criteria

- [ ] Both lanes restore and pass migration, schema, count, invariant, and cross-lane validation.
- [ ] RPO ≤24 hours and RTO ≤60 minutes are met or accurately recorded as failures.
- [ ] Redacted evidence is retained; targets are absent and credentials revoked.
- [ ] Quarterly cadence, runbook, and ledger reflect verified reality.
