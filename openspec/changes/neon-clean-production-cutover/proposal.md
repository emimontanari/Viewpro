# Proposal: Neon Clean Production Cutover

## Intent
Govern production-generation cutover without redefining authoritative #327.

## Scope
### In Scope
- Clean bootstrap/isolation/backup-lineage/receipts/retention; one authorized operator.
- Backend-first cutover, session invalidation, bounded rollback, 24-hour pilot, one-month Free evidence.

### Out of Scope
- Row restoration, retained Neon/backup/R2/Sentry/Resend deletion, #327 changes.
- #290/#329, public launch, paid plans, destructive cleanup, and unrelated candidate content.

## Capabilities
### New Capabilities
- `production-cutover-lineage`: bootstrap, cutover, lineage, retention, rollback, and receipts.
- `production-cutover-tree-byte-contracts`: exact policy bytes, canonical paths and hashes, deterministic validation, and explicit non-authority.

### Modified Capabilities
None.

## Approach
Requirements define behavior, tasks define planned work and completion, the native ledger records execution history, and commit/PR review records delivery evidence. Planning grants no implementation, provider, traffic, promotion, or merge authority.

Tree/Byte is an isolated policy contract within external WU3. External closure and independent reproduction gate promotion or provider mutation; populated evidence never alters the bound tree.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| Cutover | New capabilities | Lineage and Tree/Byte contracts |
| #327 | Dependency | Exact receipts; unchanged authority |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Drift | High | #327/exact receipts/ordered gates |
| Cross-generation writes | High | Identity/role/order gates |
| Policy/quota | High | Stop before provisioning |

## Rollback Plan
Before business writes, restore old generation. Later URL rollback needs reconciliation/export authority; otherwise roll forward. Never delete retained resources.

## Dependencies
- Planning/apply precede #327 final archive; D.5 is post-deployment.
- Traffic needs immutable #327 proofs, D.1-D.2, D.4, ≥24-hour D.5 on both projects.
- Cutover archive follows #327, one-month Free, retention/non-deletion gates.

## Success Criteria
- [ ] #327 exact receipts pass traffic gates; D.5 completes before its archive.
- [ ] Remediation is WU1/WU2-only; provisional assembly follows WU7 and external closure plus independent reproduction authorizes promotion.
- [ ] External manifest has actual WU1–WU7 identities/digests/receipts; aliases are pinned, non-authoritative, and never wildcard, placeholder, or optional.
- [ ] Cutover remains sole-spec governed, while Tree/Byte remains deterministic, isolated, non-operational, and bounded by external closure.
