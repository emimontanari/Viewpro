# Design: Neon Clean Production Cutover

## Technical Approach

Keep proposal WU3 as one functionality/threat boundary but deliver its 482-line coherent correction as two sequential review slices targeting `develop`: `WU3-Contracts`, then `WU3-Qualification`. Neither slice creates provider, populated-manifest, deployment, traffic, provisioning, activation, or production authority. WU4 remains blocked until both merges and final WU3 closure.

## Architecture Decisions

| Decision | Alternatives | Choice and rationale |
|---|---|---|
| Split | One 330–350-line slice; revive attempt-6 snapshots/capability stores | Two stable successor lineages preserve the approved functionality while keeping each review below 400 lines. Hostile same-user mutation remains out of scope. |
| First-slice authority | Ship a partial audit CLI/API | `WU3-Contracts` validates only the recursive closed binding data contract through pure internal validators/classifiers; it has no repository inspection/audit authority and cannot emit qualification. Only `WU3-Qualification` proves candidate config/schema/template/remediation are the exact tracked blobs at the audited commit/tree. |
| Delivery | Feature stack to `main` | Both slices start sequentially from live `origin/develop`, review/CI/merge to `develop`, then fetch/overlap audit. `stacked-to-main` remains only the historically required non-operational token. |
| Dependencies | Add validator/process packages | Node 22 built-ins and `node:test`; both slice suites and direct Node CI must be deterministic, isolated, and no-network; no package/lock churn. |

## Slice Boundaries

| Lineage | Target / hard cap | Responsibilities, RED, verification, rollback |
|---|---:|---|
| `neon-clean-production-cutover/WU3-Contracts` | 238 / 260 changed lines | Own initial `candidate.v1.json`, release schema/template, and pure `candidate.mjs`/`candidate.spec.mjs`. RED-CUT-01 proves exact closed identities/order/exclusions, final candidate distinct from prefix, the recursive closed binding data-contract shape, and exact remediation status/path/receipts. RED-CUT-03 proves strict byte/NUL/type/hash/path parsing; hidden/optional/lifecycle/`#314`/excluded evidence classification; recursive closed release/remediation contracts; and unpopulated template rejection. Final-tree policy permits only baseline `.githooks/pre-push` (`100755 blob d8016a819c234d99c5e8b627e34e1349695b3a44`), `viewpro-app/apps/app-new/.claude/skills/tanstack-form` (`120000 blob d12d02091264079b6e212b88678e90f9651ec6e7`), and `viewpro-app/apps/app-new/.claude/skills/tanstack-query` (`120000 blob a1aae1817a41407e92a0c2038623bdf7c146c4fd`) unchanged; every other entry must be `100644 blob`. Unauthorized executable, symlink, submodule, disguise, or changed approved object fails. Verify with deterministic, isolated, no-network direct `node --test`; no repository inspection/audit entry point. Contracts may revert alone only before Qualification merges. |
| `neon-clean-production-cutover/WU3-Qualification` | 244 / 270 changed lines | Depends on reviewed/merged Contracts. Add repository audit and bounded Git runner to `candidate.mjs`, behavioral/local-Git tests to `candidate.spec.mjs`, and additive `.github/workflows/ci.yml`. RED-CUT-02 proves canonical root, detached HEAD, exact commit/tree, ordered object existence/exclusions, and that candidate config/schema/template/remediation are the exact tracked blobs at that commit/tree, plus at least one complete successful local audit. RED-CUT-04 proves spawn/nonzero/signal/timeout/output failures and TERM→KILL→confirmed-close/drain cleanup with timers, listeners, and buffers released. Tests and direct CI invocation `node --test scripts/production-cutover/candidate.spec.mjs` are deterministic, isolated, and no-network while preserving existing job order/dependencies. After this merges, rollback reverts Qualification/CI first, then Contracts. |

Overlap is intentionally limited to additive changes in `candidate.mjs` and `candidate.spec.mjs`; Contracts owns contract semantics, Qualification consumes them. Any semantic rewrite returns to Contracts review.

## Data Flow

```text
tracked closed contracts → pure validation/classification (no authority)
  → canonical detached repository audit → bounded qualification result only
  → post-WU7 independent reassembly/digests → separately authorized promotion
```

## File Changes

| File | Slice | Action |
|---|---|---|
| `viewpro-app/scripts/production-cutover/{candidate.v1.json,release-manifest.v1.schema.json,release-manifest.v1.template.json}` | Contracts | Create |
| `viewpro-app/scripts/production-cutover/{candidate.mjs,candidate.spec.mjs}` | Both | Create pure contracts, then extend with qualification |
| `.github/workflows/ci.yml` | Qualification | Add direct Node test step only |

## Interfaces / Contracts

Qualification input remains `{ repository, config, expectedCommit, expectedTree }`; output is a local qualification result, never operational authority. Exact prefix, WU1/WU2, future WU3–WU7 order, exclusions, tracked contracts, final-tree modes/objects, and recursive unknown-field rejection fail closed.

## Migration / Lineage / Rollout

No migration. Failed evidence `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` remains invalidated negative evidence; neither successor may copy it or revive attempt-6 capability/snapshot designs. No native acquire occurs in design. Contracts may settle only its bounded lineage. Only Qualification's final settlement, after both sequential merges and a fresh full successful audit with distinct evidence, may claim WU3 remediation and unblock WU4. Contracts may revert alone only before Qualification merges; afterward rollback must revert Qualification first and then Contracts. Any rollback invalidates final WU3 closure and re-blocks WU4. These are native delivery lineages, not new release-manifest work units: the external contract remains WU1–WU7, and WU3's sole reviewed identity is the final Qualification merge/closure binding the prerequisite Contracts merge and aggregate WU3 patch.

## Consistency Verdict

**Proposal/spec amendment: No.** This planning transaction synchronizes the maintainer-approved design/task amendments and apply-progress; it changes no capability, threat boundary, public interface, authority, or lifecycle requirement. Implementation remains blocked pending planning review/merge and explicit apply authority.

## Open Questions

None.
