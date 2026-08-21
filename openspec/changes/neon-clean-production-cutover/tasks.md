# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,227–2,442; `sequential-to-develop`/auto-chain; WU target ≤350; hard stop 390.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
Compatibility token only; execution authority is `sequential-to-develop`: every WU targets `develop`, NEVER production `main`/chained parent.
400-line budget risk: High

`sequential-to-develop`: live `origin/develop` worktree/branch → WU → review+green CI → `develop` merge → remove/fetch/audit; never `main`/chained parent; no size-exception/mixing. Delivery base: `3212c438f0ef5be886b090478acfba3a38d64102`.

Concurrency: pre-work audit live `develop`, branches, worktrees, paths; overlap/new commit ⇒ refresh AND re-plan. Clean WU3 ignores dirty-root/stale-worktree contamination. Lock owns only root-importer (`.`) changes from explicit `package.json` tooling pins/scripts; reject other/external importers, `autoInstallPeers`, unrelated resolutions; preserve deepmerge. AJV iff schema execution requires it. WU7 `app-new`/session conflicts.

Candidate: `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 runtime patches + approved WU3–WU7 patches. Exclude #338/#341/#344/#351; retain as `develop` prerequisites/history. Reject hidden AND optional dependencies and #314. WU2 runtime patch: `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; `3212c43…` is closure metadata only. WU3 unchecked until correction merges; tooling/schema/template only, never instance. Post-WU7 external private manifest+independent reproduction+single-use authorization permit promotion. History/evidence/instances cannot alter tree.

### P1 — #327
- [x] 1.1 **WU1 (320–350):** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [x] 1.2 **WU2 (300–340):** #347 merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` is bound as reviewed-develop-merged; manifest closed.

### P2 — Candidate
- [ ] 2.1 **WU3 (327–362; eligible after correction merge):** package/lock/config/CI; candidate/manifest tooling; schema/template/specs; RED-CUT-01–04. Extend—not replace/weaken/reorder—#351 CI. Lock guard; never instance. Pin tools/IDs; detach base; exact-tree CI/audit rejects changed/missing/forbidden identity. At/near 350 stop for reforecast+reviewer-burden approval before continuing; hard stop 390; no size exception.
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
