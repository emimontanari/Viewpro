# Tasks: Neon Clean Production Cutover

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Exact WU3 total 837: L147/190, T204/250, R242/290, Q244/270; Contracts 593 |
| Split / delivery | PR1 L → PR2 T → PR3 R → PR4 Q; reviewed→refreshed `develop`; ask-always; approved; `sequential-to-develop`; no exception |
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main (non-operational token)
400-line budget risk: High

`L: node --test scripts/production-cutover/lineage-contract.spec.mjs; isolated/no-network; rollback none` → `T: node --test scripts/production-cutover/tree-evidence-contract.spec.mjs; isolated/no-network; rollback L` → `R: node --test scripts/production-cutover/release-contract.spec.mjs; isolated/no-network; rollback T` → `Q: node --test scripts/production-cutover/candidate.spec.mjs; disposable local audit only; rollback Q/CI then R/T/L`.

External WU3 only; 2.1–2.4 internal, never `WU3a`. Caps count add+del/tests/progress; Strict-TDD safety→RED→GREEN→triangulation; deterministic isolated/no-network; diff/status, complete tracked+untracked add+del accounting, package/lock/no-authority scans, fresh-reviews. Pure contracts accept plain Object/null own-key records; reject inherited/custom/prototype authority keys. Native acquire needs authority+reviewed predecessor merge/refreshed `develop`; settle own reviewed evidence. Pure slices lack repo/Git/process/CLI/CI/provider/final-WU3 authority; planning grants none. Rollback Q/CI→R/T/L re-blocks WU4.

## Phase 1: Foundation

- [x] 1.1 **WU1 (320–350):** Preserve platform-sync/tenant/platform-data RED→GREEN evidence and zero-I/O idle receipt.
- [x] 1.2 **WU2 (300–340):** Preserve reviewed merge `d53a57c…`, closure metadata `3212c43…`, and remediation gate.

## Phase 2: WU3 Sequential Contracts

- [ ] 2.1 **WU3-Lineage-Contracts (147/190):** WU2 reviewed merge→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{candidate.v1.json,lineage-contract.mjs,lineage-contract.spec.mjs}`; `main@868dc70` + #331/#333/#334/#335/#336, WU1 `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`, WU2 `d53a57c04f34efd20fc825aff5c03115c9c6c99f`, exclusions `#338/#341/#344/#351/#314`, ordered/recursive closure, final≠prefix. RED-CUT-01 first: arbitrary/retargeted/duplicate/reordered/unknown/drift/prototype/authority-key; `node --test scripts/production-cutover/lineage-contract.spec.mjs`. No tree/evidence/release/repo audit/WU3 identity.
- [ ] 2.2 **WU3-Tree-Evidence-Contracts (204/250):** 2.1 reviewed merge→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{final-tree.v1.json,tree-evidence-contract.mjs,tree-evidence-contract.spec.mjs}`; byte/UTF-8/NUL/type/hash/path, default `100644 blob`, exceptions `.githooks/pre-push` `100755:d8016a819c234d99c5e8b627e34e1349695b3a44`, tanstack-form `120000:d12d02091264079b6e212b88678e90f9651ec6e7`, tanstack-query `120000:a1aae1817a41407e92a0c2038623bdf7c146c4fd`, recursive evidence. RED-CUT-03 first: duplicate/missing/changed, executable/symlink/submodule, control/disguised, malformed/nested; `node --test scripts/production-cutover/tree-evidence-contract.spec.mjs`. No lineage/repo audit.
- [ ] 2.3 **WU3-Release-Contracts (242/290):** 2.2 reviewed merge→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{release-contract.mjs,release-contract.spec.mjs,release-manifest.v1.schema.json,release-manifest.v1.template.json}`; recursive WU1/WU2 remediation, seven-WU schema/cross-fields, unpopulated template. RED-CUT-01/03 first: remediation/patch/order/prefix-final/unknown/malformed/populated-template; `node --test scripts/production-cutover/release-contract.spec.mjs`. Final reviewed closure solely remediates negative attempt-8 candidate `sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`; no final WU3 authority.
- [ ] 2.4 **WU3-Qualification (244/270):** Three reviewed merges→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{candidate.mjs,candidate.spec.mjs}`; add direct-Node CI in `.github/workflows/ci.yml`; RED-CUT-02/04 first: `node --test scripts/production-cutover/candidate.spec.mjs`; canonical root/detached exact commit/tree, ordered identities/exclusions, tracked blobs, local audit, bounded spawn/nonzero/signal/timeout/output, TERM→KILL→confirmed-close/drain. Solely remediates `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` and binds one aggregate WU3 identity; no provider/promotion authority.
- [ ] 2.5 **WU4 (330–350):** Blocked until four reviewed merges/final Qualification closure; implement receipts/checkpoints, JCS redaction, fail-closed RED-CUT-05–07.

## Phase 3: Fresh

- [ ] 3.1 **WU5 (320–350):** Implement RED-CUT-09–11 roles/bootstrap, grants, allowlists, readiness, acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** Implement RED-CUT-08 backup lineage, heartbeat/pruning receipts, one-month retention.

## Phase 4: Cutover

- [ ] 4.1 **WU7 (330–350):** Implement session tests, runbook, evidence templates, RED-CUT-12/13; identity only, never an instance.

## Phase 5: Closure

- [ ] 5.1 Keep provider qualification read-only; no mutation.
- [ ] 5.2 After WU7 review/CI/merge, provisionally assemble prefix + reviewed WU1–WU7.
- [ ] 5.3 Independently close external manifest; reproduce identities/tree/runtime/image digests.
- [ ] 5.4 Gated freeze once; consume single-use Bootstrap/Staging authority once.
- [ ] 5.5 After readiness/closure, resume (not restart) rotation→Product→Platform→frontends→session→backups/heartbeats→checkpoint; retry needs fresh scoped authority.
- [ ] 5.6 Collect #327 D.5 for ≥24h.
- [ ] 5.7 Verify/archive #327 and open internal pilot.
- [ ] 5.8 Verify/archive cutover after one-month evidence/retention.
