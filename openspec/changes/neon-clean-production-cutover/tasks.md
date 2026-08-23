# Tasks: Neon Clean Production Cutover

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,380–2,580 total; Contracts 238/260 cap; Qualification 244/270 cap |
| Suggested split | PR1 Contracts → refreshed `develop`; PR2 Qualification → refreshed `develop` |
| Delivery strategy | ask-always; split approved |
| Chain strategy | `stacked-to-main` (non-operational token) |
| Actual delivery | `sequential-to-develop` |
| Size exception | None |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main (non-operational token)
400-line budget risk: High

### Work Units

| Unit | Test | Harness | Rollback |
|---|---|---|---|
| Contracts | `node --test scripts/production-cutover/candidate.spec.mjs` | N/A: pure/no repository/network | Contracts before Qualification |
| Qualification | direct Node test | Disposable local-Git + full audit; no provider/network | Qualification/CI, then Contracts |

## Phase 1: Foundation

- [x] 1.1 **WU1 (320–350):** Preserve platform-sync/tenant/platform-data RED→GREEN evidence and zero-I/O idle receipt.
- [x] 1.2 **WU2 (300–340):** Preserve reviewed merge `d53a57c…`, closure metadata `3212c43…`, and remediation gate.

## Phase 2: Candidate

- [ ] 2.1 **WU3-Contracts (238 target; 260 cap; PR1):** Own `viewpro-app/scripts/production-cutover/{candidate.v1.json,release-manifest.v1.schema.json,release-manifest.v1.template.json,candidate.mjs,candidate.spec.mjs}`. Define prefix/WU1/WU2/future-WU order, exclusions `#338/#341/#344/#351/#314`, final≠prefix, recursive remediation/schema/template closure; classify hidden/optional/lifecycle/excluded evidence; reject populated templates. Enforce byte/NUL/type/hash/path parsing and exceptions `.githooks/pre-push` `100755 blob d8016a819c234d99c5e8b627e34e1349695b3a44`, `viewpro-app/apps/app-new/.claude/skills/tanstack-form` `120000 blob d12d02091264079b6e212b88678e90f9651ec6e7`/`viewpro-app/apps/app-new/.claude/skills/tanstack-query` `120000 blob a1aae1817a41407e92a0c2038623bdf7c146c4fd`; otherwise `100644 blob`. Safety→RED (RED-CUT-01/03)→GREEN→triangulation/refactor→fresh independent reliability/resilience/risk review + native settlement gate. Isolated Node, no network/package/lock; no repository inspection, audit API/CLI, CI/provider authority, populated manifest, final failed-evidence remediation, or final WU3 identity.
- [ ] 2.2 **WU3-Qualification (244 target; 270 cap; PR2):** Start only after reviewed Contracts merge + refreshed `develop`. Additive overlap only `candidate.mjs`/`candidate.spec.mjs`; add direct Node CI in `.github/workflows/ci.yml`, preserving order/dependencies. Safety→RED (behavioral RED-CUT-02/04)→GREEN→triangulation/refactor→fresh independent reliability/resilience/risk review + native settlement gate: canonical root/detached exact commit/tree, ordered identities/exclusions, final≠prefix, tracked-blob binding, full successful local audit, bounded spawn/nonzero/signal/timeout/output failures, TERM→KILL→confirmed-close/drain cleanup. Only Qualification final closure may remediate `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` and bind aggregate WU3 identity; no network/package/lock or semantic rewrite.
- [ ] 2.3 **WU4 (330–350):** After WU3, implement receipts/checkpoints, JCS redaction, fail-closed RED-CUT-05–07.

## Phase 3: Fresh

- [ ] 3.1 **WU5 (320–350):** Implement RED-CUT-09–11 roles/bootstrap, grants, allowlists, readiness, acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** Implement RED-CUT-08 backup lineage, heartbeat/pruning receipts, one-month retention.

## Phase 4: Cutover

- [ ] 4.1 **WU7 (330–350):** Implement session tests, runbook, evidence templates, RED-CUT-12/13; identity only, never an instance.
- [ ] 5.1 Keep provider qualification read-only; no mutation.
- [ ] 5.2 After WU7 review/CI/merge, provisionally assemble prefix + reviewed WU1–WU7.
- [ ] 5.3 Independently close external manifest; reproduce identities/tree/runtime/image digests.
- [ ] 5.4 Gated: Freeze once; separately obtain/consume single-use provisioning authority for Bootstrap/Staging exactly once.
- [ ] 5.5 After readiness/closure, authorize and resume (not restart) rotation → Product → Platform → frontends → fresh session → backups/heartbeats → checkpoint; retry needs fresh scoped authority.
- [ ] 5.6 Collect #327 D.5 for ≥24h.
- [ ] 5.7 Verify/archive #327 and open internal pilot.
- [ ] 5.8 Verify/archive cutover after one-month evidence/retention.

Rollback: Contracts alone pre-Qualification; afterward Qualification/CI then Contracts; rollback blocks WU4. Labels: `WU3-Contracts`/`WU3-Qualification`, never `WU3a`. Each slice runs `git diff --check`, `git status --short`, tracked stats + line counts for every untracked file (additions+deletions), and package/lock diff check. No successor reset/acquire/settle/apply/provider/network authority.
