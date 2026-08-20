# Proposal: Neon Clean Production Cutover

## Intent
Govern production-generation cutover while #327 remains authoritative, without redefining it.

## Scope
### In Scope
- Abandon PostgreSQL rows; bootstrap allowlisted migrations/seeds and one authorized operator.
- Prove isolation, backup lineage, receipts, retention.
- Run backend-first blue/green cutover, invalidate sessions, bound rollback.
- Gate 24-hour internal pilot, then one month Free evidence.

### Out of Scope
- Row restoration or retained Neon/backup/R2/Sentry/Resend deletion.
- Changes to #327 contracts; #290/#329, public launch, paid plans/upgrades, or destructive cleanup.
- Unrelated `develop` commits in the reconstructed runtime candidate; `develop` remains every reviewed WU's required integration branch.

## Capabilities
### New Capabilities
- `production-cutover-lineage`: clean bootstrap, isolation, ordered cutover, lineage, retention, rollback, and receipts.

### Modified Capabilities
None.

## Approach
Ledger guard `stacked-to-main` mandates force-chained WU PRs sequential-to-`develop`: each starts from current `origin/develop`, passes individual review/CI, merges to `develop`; fetch/overlap audit precedes next. No incremental WU reaches production `main`. `production-cutover-lineage` remains sole planning authority and grants no runtime, provider, or apply authority.

The final runtime candidate deterministically reconstructs `main@868dc70` + #331/#333–#336 + the closed reviewed remediation manifest; unrelated `develop` commits remain excluded.

`neon-idle-platform-sync` (#327) remains active/authoritative; exact-version receipts MUST preserve it. Fresh organization projects require policy, slots, independent quota. Release the approved #327 candidate only after D.4/pre-production traffic gate. Cut product backend, platform backend, then frontends; rotate access/step-up secrets.

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
Before first business write, restore the old generation. Afterward, URL rollback requires reconciliation/export authority; otherwise roll forward. Never delete retained resources.

## Dependencies
- Cutover spec/design/isolated apply precede #327 final verify/spec sync/archive because D.5 is post-deployment.
- Fresh traffic requires immutable #327 candidate proofs for retained pre-production behavior, visible-freshness/idle-quiet, sanitized failure alert/remediation, D.1–D.2, and D.4 merge/deploy/rollback; failure blocks.
- #327 D.5 MUST run ≥24 hours on both fresh projects before final verify/sync/archive.
- Cutover final verify/archive follows #327 archive plus one-month Free and retention/non-deletion gates.

## Success Criteria
- [ ] Exact-version receipts prove approved #327 candidate passed all traffic gates.
- [ ] Sole `production-cutover-lineage` spec governs cutover.
- [ ] D.5 completes on both projects before #327 final verify/archive.
- [ ] Internal pilot remains gated; no public launch occurs.
- [ ] One-month evidence informs the commercial decision; retained resources remain undeleted.
