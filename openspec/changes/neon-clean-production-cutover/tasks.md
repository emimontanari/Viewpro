# Tasks: Neon Clean Production Cutover

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,230–2,430 total; WU3 330–350 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Seven autonomous WU PRs, each sequentially targeting `develop` |
| Delivery strategy | sequential-to-develop |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Non-operational token; sequential-to-develop; separate native reset approval.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| WU1 | Platform-sync/tenant foundation | PR 1 | — |
| WU2 | Remediation closure | PR 2 | WU1 |
| WU3 | Candidate tooling/schema | PR 3 | WU2; no populated manifest |
| WU4 | Receipts/checkpoint tooling | PR 4 | WU3 |
| WU5 | Roles/bootstrap lane | PR 5 | WU4 |
| WU6 | Backup lineage/retention | PR 6 | WU5 |
| WU7 | Sessions/cutover evidence | PR 7 | WU6 |

## Phase 1: Completed Foundation

- [x] 1.1 **WU1 (320–350):** Preserve platform-sync/tenant/platform-data RED→GREEN evidence and zero-I/O idle receipt.
- [x] 1.2 **WU2 (300–340):** Preserve reviewed merge `d53a57c…`, closure metadata `3212c43…`, and remediation gate.

## Phase 2: Candidate and Receipts

- [ ] 2.1 **WU3 (330–350; pause before >350; hard stop 390, no over-350 approval):** Create `viewpro-app/scripts/production-cutover/candidate.v1.json`, `candidate.mjs`, `candidate.spec.mjs`, `release-manifest.v1.schema.json`, and unpopulated `release-manifest.v1.template.json`; validate exact prefix/WU1/WU2/future WU3–WU7 identity order, final-tree NUL classification, closed manifests, bounded subprocess failure, RED-CUT-01–04, and the trusted disposable-worktree precondition. Add only additive CI in `.github/workflows/ci.yml`; no package/lock churn.
- [ ] 2.2 **WU4 (330–350):** After reviewed WU3 merge, implement receipt/checkpoint tooling, JCS redaction, and fail-closed generation/digest/state bindings for RED-CUT-05–07.

## Phase 3: Fresh Lanes

- [ ] 3.1 **WU5 (320–350):** Implement roles/bootstrap specs for RED-CUT-09–11, grants, allowlists, readiness, and acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** Implement backup-lineage tooling/spec and workflow for RED-CUT-08, heartbeat/pruning receipts, and one-month retention.

## Phase 4: Cutover and Lifecycle

- [ ] 4.1 **WU7 (330–350):** Implement session tests, runbook, evidence templates, and RED-CUT-12/13 receipt; emit identity only, never an instance.
- [ ] 5.1 Keep provider qualification read-only.
- [ ] 5.2 After WU7 review/green CI/merge, assemble provisionally from the known prefix plus reviewed WU1–WU7.
- [ ] 5.3 Independently close external manifest; reproduce identities, tree, runtime, image digests.
- [ ] 5.4 Execute Step1 **Freeze** once as the local fail-closed/rollback boundary; obtain/consume fresh single-use provisioning authorization for Step2 **Bootstrap** and Step3 **Staging** exactly once.
- [ ] 5.5 After Step3 readiness/receipts and independent closure, obtain/consume separate fresh single-use activation authorization and resume—not restart—Steps4–10: **Secret rotation** (invalidate product JWTs/cookies, platform JWTs/step-up, abandoned refresh/reset/verification tokens; reject cross-generation writes) → **Product backend** → **Platform backend** → **Frontends** → **Fresh login/session validation** → **Backups/heartbeats** → **Checkpoint/resume**; neither authority is reusable; failure/retry requires fresh scoped authorization.
- [ ] 5.6 Collect #327 D.5 evidence for ≥24h.
- [ ] 5.7 Verify/archive #327 and open internal pilot.
- [ ] 5.8 Verify/archive cutover after one-month evidence/retention.

Candidate identity excludes #338/#341/#344/#351; `3212c438…` is closure metadata only. TDD, review/CI/merge, and native admission remain separate; no reset/acquire/settle occurs here.
