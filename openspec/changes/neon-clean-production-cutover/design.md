# Design: Neon Clean Production Cutover

## Technical Approach

Keep one external WU3 and replace failed `WU3-Contracts` with three `ask-always`, `sequential-to-develop` pure-contract delivery lineages, followed by the existing separate `WU3-Qualification`. Each starts from refreshed `develop` only after its predecessor is reviewed and merged. The three-slice repair forecast is 593 changed lines; every slice has material headroom below 400 and no size exception.

## Architecture Decisions

| Decision | Alternative | Choice and rationale |
|---|---|---|
| Contract split | Two larger slices | Three responsibility-aligned modules avoid minified data and shared giant implementation/test files; targets are 147/204/242. |
| Authority | Partial audit API/CLI in a contract slice | Pure exports only. Qualification alone may inspect a repository, run Git/processes, emit an audit result, or enter CI. This prevents a partially operational interface. |
| Threat boundary | Revive hostile same-user snapshots/capabilities | Preserve the approved trusted isolated-operator/disposable-worktree boundary; hostile concurrent same-user mutation remains out of scope. |
| Dependencies | Add schema/process packages | Node 22 built-ins and `node:test`; deterministic isolated no-network checks, with no package/lock churn. |

## Delivery Slices

All targets/caps count additions plus deletions, tests, and append-only `apply-progress.md` evidence.

| Lineage | Target / cap | Responsibility and non-authority | Owned files and Strict-TDD RED |
|---|---:|---|---|
| `neon-clean-production-cutover/WU3-Lineage-Contracts` | 147 / 190 | Exact `main@868dc70` + #331/#333/#334/#335/#336 prefix; immutable WU1 `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`/WU2 `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; ordered WU1–WU7 patch identities; exclusions; final≠prefix; recursively closed candidate/closure references. It cannot validate trees, classify evidence, validate release/remediation records, inspect repositories, or claim WU3 identity. | Create `viewpro-app/scripts/production-cutover/{candidate.v1.json,lineage-contract.mjs,lineage-contract.spec.mjs}`. RED-CUT-01 must first fail behavior assertions for arbitrary/retargeted/duplicate/reordered identities, unknown fields, and closure drift. RED and GREEN command, unchanged: `node --test scripts/production-cutover/lineage-contract.spec.mjs`; isolated/no-network. Allocation: implementation 50, tests 50, data 24, progress 23. |
| `neon-clean-production-cutover/WU3-Tree-Evidence-Contracts` | 204 / 250 | Byte-level JSON, UTF-8/NUL/type/hash/path validation; exact ordered baseline exceptions; default `100644 blob`; recursive hidden/optional/lifecycle/excluded/populated evidence classification. Exceptions are `.githooks/pre-push` `100755:d8016a819c234d99c5e8b627e34e1349695b3a44`, `viewpro-app/apps/app-new/.claude/skills/tanstack-form` `120000:d12d02091264079b6e212b88678e90f9651ec6e7`, and `viewpro-app/apps/app-new/.claude/skills/tanstack-query` `120000:a1aae1817a41407e92a0c2038623bdf7c146c4fd`, unchanged. It cannot alter lineage semantics or perform repository/Git/process audit. | Create `viewpro-app/scripts/production-cutover/{final-tree.v1.json,tree-evidence-contract.mjs,tree-evidence-contract.spec.mjs}`. RED-CUT-03 must fail first for duplicate/missing/changed exceptions, executable/symlink/submodule entries, control/disguised paths, malformed bytes, and nested evidence. RED and GREEN command, unchanged: `node --test scripts/production-cutover/tree-evidence-contract.spec.mjs`. Allocation: implementation 80, tests 80, data 20, progress 24. |
| `neon-clean-production-cutover/WU3-Release-Contracts` | 242 / 290 | Exact recursively closed WU1/WU2 remediation and populated release-manifest schema/cross-field contract; committed template must remain unpopulated. Its final reviewed closure, only after the reviewed Lineage and Tree/Evidence merges, is the sole aggregate Contracts remediation point for exact attempt-8 evidence `sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`. It cannot create/accept an authoritative populated instance, inspect a repository, or claim final WU3 authority. | Create `viewpro-app/scripts/production-cutover/{release-contract.mjs,release-contract.spec.mjs,release-manifest.v1.schema.json,release-manifest.v1.template.json}`. RED-CUT-01/03 must fail first for remediation drift, extra/missing/reordered/duplicate seven-WU patches, prefix/final mismatch, unknown fields, malformed digests/receipts, and populated template fields. RED and GREEN command, unchanged: `node --test scripts/production-cutover/release-contract.spec.mjs`. Allocation: implementation 44, tests 45, schema 104, template 25, progress 24. |

Pure slices contain no package/lock, repository audit, Git/process/CLI, CI, provider, or populated authoritative-manifest behavior. Shared progress is evidence-only; source/data/test ownership does not overlap.

Every pure contract accepts only plain records with `Object.prototype` or `null` prototypes, uses own-property required-field checks and own-key enumeration, and rejects custom prototypes plus own `__proto__`, `constructor`, or `prototype` authority keys. Each slice adds RED cases `INHERITED_REQUIRED_FIELD`, `CUSTOM_PROTOTYPE`, `AUTHORITY_KEY___PROTO__`, `AUTHORITY_KEY_CONSTRUCTOR`, and `AUTHORITY_KEY_PROTOTYPE`; inherited values cannot satisfy required fields or influence closure.

## Qualification Boundary

`WU3-Qualification` remains 244 target / 270 cap. After all three reviewed merges, it alone creates `viewpro-app/scripts/production-cutover/{candidate.mjs,candidate.spec.mjs}` as the audit composition boundary and adds the direct-Node step to `.github/workflows/ci.yml`. RED-CUT-02/04 prove canonical repository root, detached HEAD, exact commit/tree, ordered objects/exclusions, exact tracked blobs for all contract data/schema/template/remediation, one complete successful local audit, and bounded spawn/nonzero/signal/timeout/output handling with TERM→KILL→confirmed-close/drain cleanup. RED and GREEN command, unchanged: `node --test scripts/production-cutover/candidate.spec.mjs`. Output is qualification only, never provider/promotion authority.

```text
lineage contracts → tree/evidence contracts → release contracts
  → repository Qualification → post-WU7 external closure/reproduction
```

## Lineage, Remediation, and Rollback

Design does not touch idle native revision `sha256:38f2df20e3592c8278789fe70ca1579fabfeb19ae7586f399b53324ac33dad14`. Each pure slice gets a distinct bounded successor acquire only after explicit apply authority and predecessor merge, and settles only its own post-GREEN, reviewed evidence. After Lineage and Tree/Evidence merge, `WU3-Release-Contracts` final reviewed closure alone aggregates their reviewed identities and remediates exact attempt-8 evidence `sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce` as failed-contract evidence; it MUST NOT claim final WU3 identity. Qualification later solely remediates attempt-7 `sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf` and binds one aggregate WU3 release identity over all prerequisite merges.

Rollback is reverse dependency order: Qualification/CI, Release, Tree/Evidence, Lineage. Any rollback invalidates final closure and re-blocks WU4. WU4 remains blocked until all four slices are reviewed/merged and Qualification closure passes. These are internal delivery lineages; proposal/spec retain WU1–WU7 and one WU3.

## Consistency Verdict

**Proposal/spec amendment: No.** Internal modules and delivery lineages add no capability, public interface, authority, or lifecycle step. Total forecast is 593 for replacement contracts and 837 including unchanged Qualification.

## Open Questions

None.
