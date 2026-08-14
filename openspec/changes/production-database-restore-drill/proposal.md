# Proposal: Production Database Restore Drill

## Intent

Prove product/platform recoverability quarterly at RPO ≤24 hours and RTO ≤60 minutes without production writes, while replacing transient parity diagnosis with reviewable, fail-closed evidence.

## Scope

### In Scope
- PR2a corrects only these five planning/evidence artifacts, including append-only progress reconciliation; no code, cloud, or runtime action.
- PR2b adds the dependency-free parity helper with all strict RED-GREEN tests/fixtures and package entry; no cloud or runtime action.
- PR2c performs the two-lane restore only after PR2b merges and the complete fresh-cycle gate passes, preserving denylisting, integrity, RPO/RTO, invariants, cross-lane checks, evidence, teardown, and records.

### Out of Scope
- PR2a/PR2b cloud/runtime actions; PR2c production remediation, failover, PITR, traffic cutover, or raw-data inspection.
- Backup scheduler redesign unless recovery objectives fail.

## Capabilities

### New Capabilities
- `production-database-recovery`: Two-lane objectives, parity gates, evidence, teardown, and cadence.

### Modified Capabilities
None.

## Approach

Use stacked-to-main/develop slices: PR2a corrects planning; PR2b proves helper behavior; PR2c owns operational gates/actions and may close #290. Catalog access uses `psql -X`, minimal environment, `ON_ERROR_STOP`, database-enforced read-only mode, one constant catalog query, and a bounded ledger query. Schema input is allowlisted and never interpolated into SQL.

## Affected Areas

| Area | Impact |
|---|---|
| `viewpro-app/scripts/restore-drill/` | PR2b helper/fixtures |
| `viewpro-app/apps/api/test/restore-schema-parity.spec.ts` | PR2b offline tests |
| `openspec/changes/production-database-restore-drill/` | PR2a planning; PR2c receipt |
| Runbook/ledger | PR2c reconciliation |

## Risks

| Risk | Mitigation |
|---|---|
| SQL/startup-file execution | Constant SQL, `-X`, read-only DB mode, hostile tests |
| Unsafe paths/schema input | Realpath repository boundary, exact allowlist, symlink/metacharacter rejection |
| Sensitive output | Permit only quoted qualified object names and aggregate status fields |
| Premature retry | Conjunctive PR2c gate; no partial satisfaction |
| Evidence loss | Historical attempt bytes immutable; append current status only |

## Rollback Plan

Revert PR2a planning or PR2b helper/tests independently. PR2c may revert runbook, ledger, and current receipt changes, but MUST retain immutable historical evidence and cleanup receipts. Production remains untouched.

## Success Criteria

- [ ] PR2a remains five planning/evidence paths and ≤400 lines; PR2b proves deterministic `pass:false`, exit 1 mismatch, and exit 2 sanitized errors.
- [ ] PR2c starts no operation until PR2b merges and its complete gate passes.
- [ ] Both lanes meet recovery contracts or record truthful failure, then prove cleanup.
