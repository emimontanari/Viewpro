# Proposal: Neon Clean Production Cutover

## Intent
Govern production-generation cutover while #327 remains authoritative, without redefining it.

## Scope
### In Scope
- Abandon PostgreSQL rows; bootstrap allowlisted migrations/seeds and one authorized operator.
- Prove isolation, backup lineage, receipts, and retention.
- Run backend-first blue/green cutover, invalidate sessions, and bound rollback.
- Gate a 24-hour internal pilot, then one month of Free evidence.

### Out of Scope
- Row restore or deletion of retained Neon, backup/R2, Sentry, or Resend data.
- Changes to #327 contracts; #290/#329, `develop`, public launch, paid plans/upgrades, or destructive cleanup.

## Capabilities
### New Capabilities
- `production-cutover-lineage`: clean bootstrap, isolation, ordered cutover, lineage, retention, rollback, and receipts.

### Modified Capabilities
None.

## Approach
The sole `production-cutover-lineage` specification is the final planning authority. Feature Branch Chain is selected. This planning set grants no runtime, provider, or apply authority.

`neon-idle-platform-sync` (#327) remains active and authoritative throughout cutover. Cutover uses exact-version dependency receipts and MUST NOT duplicate or weaken it. Fresh current-organization projects require policy, slots, and independent quota. Release only the exact approved #327 candidate after its D.4/pre-production traffic gate. Cut product backend, platform backend, then frontends; rotate access/step-up secrets.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| Cutover specs | New capability | `production-cutover-lineage` governs cutover |
| #327 | Dependency | Exact-version receipts; unchanged authority |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Circularity/drift | High | Active #327, exact receipts, ordered gates |
| Cross-generation writes | High | Identity, role, and ordering gates |
| Policy/quota failure | High | Stop before provisioning |

## Rollback Plan
Before the first business write, restore the old generation. Afterward, URL rollback needs reconciliation/export authority; otherwise roll forward. Never delete retained resources.

## Dependencies
- #327 final verify/spec synchronization/archive are NOT prerequisites for cutover spec/design/isolated apply because D.5 is post-deployment.
- Before ANY fresh-generation traffic, the exact immutable #327 candidate MUST pass retained pre-production behavior proofs, runtime visible-freshness and idle-quiet evidence, sanitized failure alert/remediation gates, D.1–D.2 reconfirmation, and D.4 merge/deploy/rollback receipts. Failure blocks traffic.
- After cutover, #327 D.5 MUST run at least 24 hours on both fresh production projects; only then may #327 final verify/sync/archive occur.
- Cutover final verification/archive follows #327 archive and additionally requires its own one-month Free evidence and retention/non-deletion gates.

## Success Criteria
- [ ] Exact-version receipts prove the approved #327 candidate passed every traffic gate.
- [ ] Sole `production-cutover-lineage` spec coherently governs cutover.
- [ ] D.5 completes on both projects before #327 final verify/archive.
- [ ] Internal pilot remains gated; no public launch occurs.
- [ ] One-month evidence informs the commercial decision; retained resources remain undeleted.
