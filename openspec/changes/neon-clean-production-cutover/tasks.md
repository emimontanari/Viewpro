# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,230–2,430; `sequential-to-develop`/auto-chain; WU target ≤350; hard stop 390.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
Protocol compatibility only: this token's project execution alias and authority is `sequential-to-develop`; every WU MUST target `develop`, NEVER production `main` or a stacked parent branch.
400-line budget risk: High

`sequential-to-develop`: each WU from live `origin/develop` worktree/branch → autonomous WU → review+green CI → `develop` merge → remove/fetch/audit; never `main`/stacked parent; no size-exception/mixing. Prefix: `main@868dc70` + #331/#333/#334/#335/#336.

Concurrency: every WU inspects `develop`/branch/worktree/planned-path overlap; overlap/new commit requires refresh/re-plan. WU3 package/lock, WU7 `app-new`/session likely conflict.

Two-stage manifests: #347 is WU2 implementation/null merge. Post-squash minimal closure PR from new `develop` binds actual SHA, marks WU2 complete; review/CI-green/merge gates WU2/WU3, then WU3-WU7 implementation/compatibility. WU3 commits tooling/schema/template only; WU3-WU7 emit reviewed merge receipts. Post-WU7 merge, read-only tooling assembles candidate from prefix+WU1-WU7 patches in disposable worktree; deterministic tree/runtime/image digests. Checkpoint 5.2 creates/closes populated `release-manifest.v1.json` outside candidate Git/private evidence and independently reassembles identities/verifies digests. External closure/reproduction+single-use authorization permit promotion; unrelated `develop`/public evidence/instance cannot alter bound tree.

### P1 — #327
- [x] 1.1 **WU1 (320–350):** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [ ] 1.2 **WU2 (300–340):** #347 implementation verified; post-merge closure PR binds its actual develop SHA, updates reviewed status, and closes the manifest.

### P2 — Candidate
- [ ] 2.1 **WU3 (330–350, blocked pending WU2 closure PR):** package/lock/config/CI, candidate/remediation/release-manifest tooling, versioned schema/template+specs; RED-CUT-01–04. Tooling/schema/template only, never instance. Pin tools/IDs, detached base, exact-tree CI/audit; changed/missing identity stops.
- [ ] 2.2 **WU4 (330–350):** receipt/checkpoint tooling+specs, receipt schema; RED-CUT-05–07, JCS redaction, generation/digest/state bindings, fail-closed receipts.

### P3 — Fresh
- [ ] 3.1 **WU5 (320–350):** roles/bootstrap tooling+specs; grants, allowlists, readiness, RED-CUT-09–11, S1/S3, acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** backup-lineage tooling+spec, db-backup workflow; RED-CUT-08, backups/heartbeats/pruning, old Neon/backup retained ≥one month.

### P4 — Cutover
- [ ] 4.1 **WU7 (330–350):** session tests, runbook/evidence templates; RED-CUT-12–13; emit identity/receipt, not instance.

Activation: promotion/provider-provisioning/activation/D.4/production-receipts/traffic require verified external closure+independent reproduction+single-use authorization: freeze → provision/bootstrap → image/receipts/inactive URLs → rotate access/step-up (control secret unchanged) → backends → frontends/fresh login → backups/heartbeats → resume. Old `200` permits pre-write rollback; `503` stops traffic; post-write reversal needs reconciliation/export authority. Read-only qualification authorized/no mutation.

## Lifecycle (8; WAIT/resume allowed)
- [ ] 5.1 Read-only provider qualification receipt.
- [ ] 5.2 Post-WU7 read-only assembly; external closure+independent reproduction before promotion/provider-mutation/D.4/production-receipts/traffic; distinct tree/runtime/image receipts. Immutable manifest digest+private receipt authoritative; pinned public alias retarget/unresolved/mismatch fails closed. Public evidence never enters candidate Git.
- [ ] 5.3 Single-use provisioning attempt.
- [ ] 5.4 Fresh single-use activation attempt.
- [ ] 5.5 #327 D.5 evidence ≥24h.
- [ ] 5.6 Verify/archive #327; open internal-pilot gate.
- [ ] 5.7 One-month evidence/retention checkpoint.
- [ ] 5.8 Verify/archive cutover; deletion separately approved.

## Traceability/Deny

S1→RED-CUT-10; S2→`PROVISION-DENY`; S3→RED-CUT-09; S4→RED-CUT-01/06/07/11; S5→`LIFECYCLE-DENY` (alias/direct/private fail-closed); S6→RED-CUT-06/07/11/13; S7→RED-CUT-08/12; S8→`EVIDENCE-DENY`; S9→`LIFECYCLE-DENY` (predecessor order); S10→`LIFECYCLE-DENY` (external closure/reproduction). `PROVISION-DENY`: unverified manifest/authorization/slot/allowance/policy ⇒ no project/traffic mutation. `EVIDENCE-DENY`: missing backup/heartbeat/D.5/month blocks. `LIFECYCLE-DENY`: missing predecessor/closure/reproduction/alias/direct/private match blocks #327/cutover verify/archive.

Provider mutations need fresh per-attempt SINGLE-USE authorization: ID/expiry, generation/lane, targets/action, digests, transition/owner, receipt/settlement; pass/fail consumes; retries/changed targets need new authorization. Retain old Neon/backups/R2/Sentry/Resend; exclude #290/#329, public launch/paid plans/broader release/unapproved org/destructive cleanup.
