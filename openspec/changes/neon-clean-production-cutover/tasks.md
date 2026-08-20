# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,230–2,430 changed lines; force-chained/auto-chain; WU target ≤350 changed lines; hard stop 390 changed lines.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Chain: fresh `origin/develop` worktree/branch → autonomous WU → review+green CI → merge → remove/fetch/audit. No size-exception/strategy mixing. Prefix: `main@868dc70` + #331/#333/#334/#335/#336.

Concurrency: before EVERY WU inspect `develop`, branches/worktrees/planned-path overlap; overlap/new commit requires refresh/re-plan. WU3 package/lock and WU7 `app-new`/session likely conflict.

Manifest gates: WU2 closes reviewed WU1/WU2 remediation identities/receipts; only gates WU3-WU7 implementation/compatibility. WU3 commits tooling/schema/template, never instance; WU3-WU7 emit reviewed develop-merge identity/receipt. Post-WU7 review/CI/merge, tooling may read-only assemble provisional isolated candidate from known-prefix+WU1-WU7 patches in disposable local worktree; no provider/traffic authority; compute deterministic full-tree/runtime-path/image digests. Checkpoint 5.2 creates/closes populated `release-manifest.v1.json` outside candidate Git in private evidence, independently reassembles exact identities/verifies digests. Closure+reproduction plus single-use authorization permits promotion; no unrelated `develop`, public evidence, or instance alters bound tree.

### Phase 1 — #327
- [ ] 1.1 **WU1 (320–350):** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [ ] 1.2 **WU2 (300–340):** `sentry.service`; platform-sync/sentry specs; replace #334 fixture, sanitize telemetry, close WU1/WU2 remediation manifest.

### Phase 2 — Candidate
- [ ] 2.1 **WU3 (330–350):** package/lock/config/CI, candidate/remediation/release-manifest tooling, versioned schema/template+specs; RED-CUT-01–04. Tooling/schema/template only; never instance. Pin tools/IDs, detached base, exact-tree CI/audit; changed/missing identity stops.
- [ ] 2.2 **WU4 (330–350):** receipt/checkpoint tooling+specs, receipt schema; RED-CUT-05–07, JCS redaction, generation/digest/state bindings, fail-closed receipts.

### Phase 3 — Fresh
- [ ] 3.1 **WU5 (320–350):** roles/bootstrap tooling+specs; grants, allowlists, readiness, RED-CUT-09–11, S1/S3, acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** backup-lineage tooling+spec, db-backup workflow; RED-CUT-08, backups/heartbeats/pruning, old Neon/backup retained ≥one month.

### Phase 4 — Cutover
- [ ] 4.1 **WU7 (330–350):** session tests, runbook/evidence templates; RED-CUT-12–13; emit identity/receipt, not instance.

Activation: promotion/provider-provisioning/activation/D.4/production-receipts/traffic only follow verified external closure+independent reproduction+single-use authorization: freeze writes/automation → provision/bootstrap → stage image/receipts/inactive URLs → rotate access/step-up (control secret unchanged) → activate backends → frontends/fresh login → backups/heartbeats → resume. Old `200` permits pre-write rollback; `503` stops traffic; post-write reversal needs reconciliation/export authority. Read-only qualification is separately authorized/no mutation.

## Lifecycle (8; WAIT/resume allowed)
- [ ] 5.1 Read-only provider qualification receipt.
- [ ] 5.2 Resumable post-WU7 provisional read-only assembly; external closure+independent reproduction before promotion/provider-mutation/D.4/production-receipts/traffic; distinct full-tree/runtime-path/image receipts. Immutable manifest digest+private receipt identity authoritative; pinned non-authoritative public alias retarget/unresolved/mismatch fails closed. Public evidence never enters candidate Git.
- [ ] 5.3 Single-use provisioning attempt.
- [ ] 5.4 Fresh single-use activation attempt.
- [ ] 5.5 #327 D.5 evidence after ≥24h.
- [ ] 5.6 Verify/archive #327; open internal-pilot gate.
- [ ] 5.7 One-month evidence/retention checkpoint.
- [ ] 5.8 Verify/archive cutover; deletion separately approved.

## Traceability/Deny Oracles

S1→RED-CUT-10; S2→`PROVISION-DENY`; S3→RED-CUT-09; S4→RED-CUT-01/06/07/11; S5→RED-CUT-12/13; S6→RED-CUT-12; S7→`EVIDENCE-DENY`; S8→`LIFECYCLE-DENY`. `PROVISION-DENY`: no verified manifest/authorization/slot/allowance/policy receipt ⇒ no project/traffic mutation. `EVIDENCE-DENY`: missing backup/heartbeat/D.5/month blocks. `LIFECYCLE-DENY`: missing predecessor/closure/reproduction/alias-direct-private identity match blocks #327/cutover verify/archive.

Provider mutations need fresh per-attempt SINGLE-USE authorization: ID/expiry, generation, lane, exact targets/action, candidate digests, transitions, owner, receipt/settlement; pass/fail consumes it; retries/changed targets need new authorization. No new retention policy; old Neon/backup lineage, R2, Sentry, Resend remain untouched; exclude #290/#329, public launch, paid plans, broader release, unapproved org, destructive cleanup.
