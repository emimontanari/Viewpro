# Proposal: Neon Clean Production Cutover

## Intent
Govern production-generation cutover without redefining authoritative #327.

## Scope
### In Scope
- Clean bootstrap/isolation/backup-lineage/receipts/retention; one authorized operator.
- Backend-first cutover, session invalidation, bounded rollback, 24-hour pilot, one-month Free evidence.

### Out of Scope
- Row restoration, retained Neon/backup/R2/Sentry/Resend deletion, #327 changes.
- #290/#329, public launch, paid plans, destructive cleanup, unrelated `develop` candidate commits.

## Capabilities
### New Capabilities
- `production-cutover-lineage`: bootstrap, cutover, lineage, retention, rollback, and receipts.

### Modified Capabilities
None.

## Approach
`stacked-to-main`: force-chained WU PRs sequential-to-`develop`: fresh `origin/develop`, review/CI, merge, fetch/overlap audit. No WU reaches `main`; planning grants no runtime/provider/apply authority.

Prefix: `main@868dc70` + #331/#333/#334/#335/#336. WU2 closes reviewed `remediation-manifest.v1.json` with WU1/WU2 identities/receipts; only gates WU3-WU7 implementation/compatibility. WU3 commits tooling+versioned schema/template, never a populated instance. WU3-WU7 emit reviewed develop-merge identity/receipt.

After WU7 review/CI/merge, tooling may read-only assemble a provisional isolated candidate from prefix+WU1-WU7 patches in a disposable local worktree; no provider/traffic authority. It computes deterministic full-tree/runtime-path/image digests; a resumable external checkpoint creates/closes populated `release-manifest.v1.json` outside candidate Git in private evidence: exact reviewed WU1-WU7 identities/prefix/digests/tool-schema-versions/private-receipts. Independently reassemble identities and verify digests before promotion. Immutable manifest digest+private receipt identity is authoritative; public opaque aliases are non-authoritative/pinned; unresolved/retargeted/mismatched aliases fail closed; direct identity wins. Rework regenerates/reviews; no auto-import. WU3+ blocks on remediation; candidate-promotion/provider-mutation/D.4/production-receipts block until closure+reproduction pass under single-use authorization. Read-only qualification grants no mutation; instance/public evidence never alter bound tree.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| Cutover | New capability | `production-cutover-lineage` |
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
- [ ] Cutover remains sole-spec governed, pilot-gated, non-public, and retention-safe through one-month evidence.
