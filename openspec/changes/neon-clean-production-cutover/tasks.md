# Tasks: Neon Clean Production Cutover

## Review Workload Forecast

| Field | Value |
|---|---|
| Evidence budget | Semantic implementation ≤200 lines; fixed evidence allowance ≤20 lines; total semantic attempt cap 220; full PR review budget 400 |
| Delivery | Sequential independent WU PRs; dependency order Lineage → Tree/Byte → Release → Qualification |

## Shared Execution Contract

Authorities: proposal/spec/design own requirements; `tasks.md` owns planned work and completion; progress/native ledger own execution history; exact commit, PR/CI, and human review own delivery evidence.

Terminal sequence: freeze scope, scenarios, reviews, budgets, and rollback → strict RED–GREEN–REFACTOR → run every frozen review before settlement → at most one consolidated correction → settle → commit the exact unchanged tree → CI and human review own delivery. A second independent blocking class returns to planning with no further mutation-review loop.

Drift routing: no owned-path or semantic-dependency overlap means no native rebaseline; docs-only overlap means reconcile text/readability; spec/code/test/policy or semantic-dependency overlap means fresh bounded semantic evidence; conflict or unclear impact goes to a maintainer.

Upstream-only paths: `BASE=$(git merge-base origin/develop HEAD)` then `git diff --name-only "$BASE"..origin/develop`. Authored committed PR scope: `BASE=$(git merge-base origin/develop HEAD)` then `git diff "$BASE"...HEAD`.

## Phase 1: Foundation

- [x] 1.1 **WU1 (320–350):** Preserve platform-sync/tenant/platform-data RED→GREEN evidence and zero-I/O idle receipt.
- [x] 1.2 **WU2 (300–340):** Preserve reviewed merge `d53a57c…`, closure metadata `3212c43…`, and remediation gate.

## Phase 2: WU3 Sequential Contracts

- [x] 2.1 **WU3-Lineage-Contracts (147/190):** WU2 reviewed merge→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{candidate.v1.json,lineage-contract.mjs,lineage-contract.spec.mjs}`; `main@868dc70` + #331/#333/#334/#335/#336, WU1 `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`, WU2 `d53a57c04f34efd20fc825aff5c03115c9c6c99f`, exclusions `#338/#341/#344/#351/#314`, ordered/recursive closure, final≠prefix. RED-CUT-01 first: arbitrary/retargeted/duplicate/reordered/unknown/drift/prototype/authority-key; `node --test scripts/production-cutover/lineage-contract.spec.mjs`. No tree/evidence/release/repo audit/WU3 identity.
- [x] 2.2 **WU3-Tree/Byte Contracts:** After 2.1, own exactly `viewpro-app/scripts/production-cutover/{final-tree.v1.json,tree-byte-contract.mjs,tree-byte-contract.spec.mjs}` and the Tree/Byte delta specification; preserve exact policy bytes, closed JSON, fatal UTF-8, canonical paths/hashes, deterministic isolation, and explicit non-authority. Behavior command: `node --test scripts/production-cutover/tree-byte-contract.spec.mjs`.
- [x] 2.3 **WU3-Release-Contracts (≤220/400):** Fresh Release objective after 2.2; own `viewpro-app/scripts/production-cutover/{release-contract.mjs,release-contract.spec.mjs,release-manifest.v1.schema.json,release-manifest.v1.template.json}`; validate recursive exact WU1–WU7 order/cross-fields, exact WU1/WU2 inputs, closed malformed/unknown/duplicate rejection, unpopulated template, and non-authority. RED-CUT-01/03 first: `node --test scripts/production-cutover/release-contract.spec.mjs`; no native remediation selector or settlement authority.
- [x] 2.4 **WU3-Qualification (1017/1080):** Three reviewed merges→refreshed `develop`; own `viewpro-app/scripts/production-cutover/{candidate.mjs,candidate.spec.mjs}`; add direct-Node CI in `.github/workflows/ci.yml`; RED-CUT-02/04 first: `node --test scripts/production-cutover/candidate.spec.mjs`; canonical root/detached exact commit/tree, ordered identities/exclusions, tracked and worktree blob identity computed in-process, uniform fail-closed probes, bounded spawn/nonzero/signal/timeout/output, TERM→KILL→confirmed-close with an absolute residue backstop. Solely remediates `sha256:3326e44f6288e08ca6a541b895b56e2067cbf50b6f712ca86437880f03305a4a` and binds one aggregate WU3 identity; no provider/promotion authority.
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
