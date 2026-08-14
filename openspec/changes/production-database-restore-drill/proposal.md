# Proposal: Production Database Restore Drill

## Intent

Prove quarterly product/platform recovery at RPO ≤24 hours and RTO ≤60 minutes without production writes, using reviewable, fail-closed evidence.

## Scope

### In Scope
- PR1 #320/PR2a #321 establish history; PR2b1 delivers fold/path RED-GREEN; PR2b2 delivers `psql` parity/CLI/fake/package; PR2c follows both merges and its gate.

### Out of Scope
- PR2b1/PR2b2 cloud, runtime, credential, production, or PR2b1 CLI/package actions; PR2c remediation, failover, PITR, cutover, raw-data inspection, or scheduler redesign unless objectives fail.

## Capabilities

### New Capabilities
- `production-database-recovery`: Recovery objectives, parity, evidence, teardown, and cadence.

### Modified Capabilities
None.

## Approach

`stacked-to-develop` means each slice starts from refreshed merged `develop`, targets `develop`, and merges before the next starts; no child targets an unmerged branch. The hard session maximum is 400; stop and re-slice at 390, accepting only ≤389 without exception.

Current diagram: `develop (merged #321) → 📍 PR2a2 split-plan amendment → develop → PR2b1 → develop → PR2b2 → develop → PR2c → develop`. Future PR bodies MUST copy it and move the single `📍` to their own slice; no placeholders.

| Slice | Start / dependency | Finish and verification | Revert boundary / budget |
|---|---|---|---|
| PR2b1 | merged #321 / `develop` → `develop` | Focused failing RED recorded before minimal GREEN for fold/path guards; no CLI/package entry | Revert its code/tests/fixtures; ≤389 |
| PR2b2 | refreshed `develop` after PR2b1 / `develop` → `develop` | Process/parity/CLI exact-byte contracts and script; focused RED before GREEN | Revert its process/parity/CLI/tests/script; ≤389 |
| PR2c | refreshed `develop` after both slices / `develop` → `develop` | Only after new authorization recorded; exhausted-attempt reset approved and completed; fresh credentials plus fresh targets provisioned and validated; read-only source and safe targets | Revert current records; retain history/cleanup receipts; ≤389 |

## Risks

SQL/input abuse, leakage, premature retry, and overload are controlled by constant SQL/realpath, redaction/immutable history, the PR2c conjunction, and the 390/≤389 rule.

## Rollback Plan

Remove or retarget dependents, then revert only the current slice. PR2c MUST retain immutable history and cleanup receipts. PR2b1/PR2b2 never touch production.

## Success Criteria

- [ ] PR2b1/PR2b2 merge to `develop` in order, stay ≤389 lines, and pass focused contracts.
- [ ] PR2b2 proves canonical `pass:true`/exit 0, deterministic `pass:false`/exit 1, sanitized exit 2, and exact bytes; PR2c accepts only exit 0 plus `pass:true`.
