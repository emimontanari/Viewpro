# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,230–2,430 changed lines; `sequential-to-develop`/auto-chain; WU target ≤350 changed lines; hard stop 390.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
Protocol compatibility only: this token's project execution alias and authority is `sequential-to-develop`; every WU MUST target `develop`, NEVER production `main` or a stacked parent branch.
400-line budget risk: High

Chain: `sequential-to-develop`; each WU from live `origin/develop` worktree/branch → autonomous WU → review+green CI → merge to `develop` → remove/fetch/audit; never production `main`/stacked parent; no size-exception/mixing. Prefix: `main@868dc70` + #331/#333/#334/#335/#336.

Concurrency: EVERY WU inspects `develop`/branch/worktree/planned-path overlap; overlap/new commit requires refresh/re-plan. WU3 package/lock, WU7 `app-new`/session likely conflict.

Two-stage manifests: WU2 closes WU1/WU2 reviewed remediation identities/receipts; gates only WU3-WU7 implementation/compatibility. WU3 commits tooling/schema/template (never instance); WU3-WU7 emit reviewed develop-merge identities/receipts. Post-WU7 review/CI/merge: read-only-tooling assembles provisional isolated candidate from known-prefix+WU1-WU7 patches in disposable-worktree; no provider/traffic-authority; deterministic full-tree/runtime-path/image-digests. Checkpoint 5.2 creates/closes populated `release-manifest.v1.json` outside candidate Git/private evidence; independently reassembles exact identities/verifies digests. External closure+independent reproduction+single-use authorization permits promotion; unrelated `develop`/public evidence/instance cannot alter bound tree.

### P1 — #327
- [x] 1.1 **WU1 (320–350):** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [ ] 1.2 **WU2 (300–340):** `sentry.service`; platform-sync/sentry specs; replace #334 fixture, sanitize telemetry, close WU1/WU2 remediation manifest.

### P2 — Candidate
- [ ] 2.1 **WU3 (330–350):** package/lock/config/CI, candidate/remediation/release-manifest tooling, versioned schema/template+specs; RED-CUT-01–04. Tooling/schema/template only; never instance. Pin tools/IDs, detached base, exact-tree CI/audit; changed/missing identity stops.
- [ ] 2.2 **WU4 (330–350):** receipt/checkpoint tooling+specs, receipt schema; RED-CUT-05–07, JCS redaction, generation/digest/state bindings, fail-closed receipts.

### P3 — Fresh
- [ ] 3.1 **WU5 (320–350):** roles/bootstrap tooling+specs; grants, allowlists, readiness, RED-CUT-09–11, S1/S3, acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** backup-lineage tooling+spec, db-backup workflow; RED-CUT-08, backups/heartbeats/pruning, old Neon/backup retained ≥one month.

### P4 — Cutover
- [ ] 4.1 **WU7 (330–350):** session tests, runbook/evidence templates; RED-CUT-12–13; emit identity/receipt, not instance.

Activation: promotion/provider-provisioning/activation/D.4/production-receipts/traffic require verified external closure+independent reproduction+single-use authorization: freeze writes/automation → provision/bootstrap → stage image/receipts/inactive URLs → rotate access/step-up (control secret unchanged) → activate backends → frontends/fresh login → backups/heartbeats → resume. Old `200` permits pre-write rollback; `503` stops traffic; post-write reversal needs reconciliation/export authority. Read-only qualification separately authorized/no mutation.

## Lifecycle (8; WAIT/resume allowed)
- [ ] 5.1 Read-only provider qualification receipt.
- [ ] 5.2 Resumable post-WU7 provisional read-only assembly; external closure+independent reproduction before promotion/provider-mutation/D.4/production-receipts/traffic; distinct full-tree/runtime-path/image receipts. Immutable manifest digest+private receipt identity authoritative; digest-pinned non-authoritative public alias retarget/unresolved/mismatch fails closed. Public evidence never enters candidate Git.
- [ ] 5.3 Single-use provisioning attempt.
- [ ] 5.4 Fresh single-use activation attempt.
- [ ] 5.5 #327 D.5 evidence ≥24h.
- [ ] 5.6 Verify/archive #327; open internal-pilot gate.
- [ ] 5.7 One-month evidence/retention checkpoint.
- [ ] 5.8 Verify/archive cutover; deletion separately approved.

## Traceability/Deny

S1→RED-CUT-10; S2→`PROVISION-DENY`; S3→RED-CUT-09; S4→RED-CUT-01/06/07/11; S5→`LIFECYCLE-DENY` (alias/direct-digest/private-identity-fail-closed-validation); S6→RED-CUT-06/07/11/13; S7→RED-CUT-08/12; S8→`EVIDENCE-DENY`; S9→`LIFECYCLE-DENY` (predecessor-receipt-order); S10→`LIFECYCLE-DENY` (external-closure/independent-reproduction). `PROVISION-DENY`: unverified manifest/authorization/slot/allowance/policy receipt ⇒ no project/traffic mutation. `EVIDENCE-DENY`: missing backup/heartbeat/D.5/month blocks. `LIFECYCLE-DENY`: missing predecessor/closure/reproduction/alias-direct-private-identity-match blocks #327/cutover verify/archive.

Provider mutations need fresh per-attempt SINGLE-USE authorization: ID/expiry, generation/lane, exact targets/action, candidate digests, transitions/owner, receipt/settlement; pass/fail consumes it; retries/changed targets need new authorization. No new retention policy; old Neon/backup lineage/R2/Sentry/Resend untouched; exclude #290/#329, public launch/paid plans/broader release/unapproved org/destructive cleanup.
