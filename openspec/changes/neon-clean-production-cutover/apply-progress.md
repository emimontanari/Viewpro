# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Tasks: **8/18 complete** — WU1, WU2, 2.1 Lineage, 2.2 Tree/Byte, 2.3 Release, 2.4 Qualification, 2.5 WU4 receipts/checkpoints, and 3.1 WU5 roles/bootstrap; later work remains pending.
- Attempt 23 carries WU5; terminal status remains exclusively in the native ledger.

## Preserved Attempt and Reset History

- Attempts 1–4 remain immutable foundation history. WU1 merged `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`; WU2 merged `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; `3212c438f0ef5be886b090478acfba3a38d64102` is closure metadata, not a patch.
- Attempts 5–8 are terminal failures: mock-only candidate audit (`sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`), unsafe repository/process authority (`sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`), bounded correction over cap (`sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf`), and incomplete Contracts (`sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`).
- Maintainer reset `sha256:797825e9f95f4c6d02226f185576913741e71ad136d5ac7bd51844a216274386` preserves Attempt 9’s premature pass (`sha256:2312d7b9112cf9792caa2b6a4830c88b576ba99b0f02388012f958112b3c7a84`): review found duplicate/sparse/proxy/retarget and receipt defects.
- Attempt 10 fixed those defects: immutable behavioral RED found closure-metadata acceptance and `RegExp.test` object coercion (2/2); GREEN 6/6 and independent probes 77/77 passed, 2/2 mutants were killed, and it settled at 154/190 with `sha256:ed58aca31fd274053d05d5cd36231e37ccc1b9726c441892fb4c1ea92cf76a05`. Its receipt was later found stale.
- Attempt 11 terminally passed at `sha256:c1ad9db96626527d7db342d1064156f4a1c339165513b1f8858a39b6e710de42`; Attempt 12 rebaseline passed at `sha256:09edb3d6d2f11e346533b7816a59a056ae40ffe612e7ee8ea4d41d641b9355aa`; both remain immutable.

## Attempt 13 — WU3-Lineage-Contracts Terminal Passed

- Attempt 13 terminal evidence remains in the native ledger; task 2.1 stays complete with its immutable Lineage scope and proxy guard history.

### TDD Cycle Evidence

| Task | Safety | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|
| 2.1 / Attempt 13 | ✅ Passed — safety 8/8 | ✅ Written — root, nested, and closure-array proxies | ✅ Passed — RED 7/8, GREEN 8/8 | ✅ Passed — 23/23 probes | ✅ Passed — compact, no semantic loss |

| Focused command/result | Runtime/adversarial probes | Rollback |
|---|---|---|
| `node --test scripts/production-cutover/lineage-contract.spec.mjs` — ✅ Passed 8/8 | N/A runtime — pure isolated/no-network; root/nested/closure/revoked zero traps; independent probes ✅ Passed 23/23 | Revert only the three Lineage files, task 2.1 checkbox, and this receipt |

## Final Accounting and Boundary

- Exactly five intended paths: the three Lineage files, `tasks.md`, and this receipt; full PR accounting is **143 additions + 45 deletions = 188/190**, correction versus `7cc8d0b` is **31 additions + 33 deletions = 64**.
- `git diff --check`, package/lock audit, scope audit, and no-process/no-authority audit passed; transparent/stateful/closure proxy acceptance or any trap execution fails closed.
- WU4 remains blocked until Lineage, Tree/Byte, Release, and Qualification complete in dependency order.

## Tree/Byte Execution History

Attempt 14 failed and reset. Attempt 15 terminally passed with evidence `sha256:8764521cb22aab2f1d1e52fc99db33a21b697cc27a4058f39fd91473b71edd5b`; its settled blobs are present here as `final-tree.v1.json` `f6f55cf0ae989fb56b8afd19e4bff5d7d5f637c3`, `tree-byte-contract.mjs` `a47bee91eb68d277edbf5aab95fc60d4a3ff7c05`, and `tree-byte-contract.spec.mjs` `8c287d94194658a21df22708a56e64594623b7f5`. Attempt 16 was interrupted and reset; Attempt 17 was acquired for the Release correction and remains active without a settlement claim.
## WU3 Release Contracts — Task 2.3 Correction
- Task 2.3 remains `[x]`; 5/18 tasks are complete. This seven-path ≤220/400 candidate corrects prefixed final/closure consistency, proxy rejection, captured dispatch, and explicit denials without design deviation.
| TDD Cycle Evidence | Safety | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.3 correction | 5/5 | prefixed valid contract: false≠true | 6/6 | root/nested transparent and revoked proxies; poisoned parse/regex/every; prefix/closure/authority cases | 6/6 |
- Focused `node --test scripts/production-cutover/release-contract.spec.mjs`: 6/6 passed; JSON, hostile probes, path, package/lock, diff, scope, process, and non-authority audits passed before parent validation. Native status consumed: apply ready, repo-local root allowed, no warnings. Remaining work is the 13 unchecked rows in `tasks.md`; parent owns validation and settlement.

## WU3 Qualification — Task 2.4

- Task 2.4 is `[x]`; 6/18 tasks are complete. This four-path candidate qualifies one detached candidate from closed audits and wires the first CI coverage the production-cutover contracts have ever had. Attempts 19 and 20 failed and were reset under maintainer authorization; attempt 21 carries this work and solely remediates `sha256:3326e44f6288e08ca6a541b895b56e2067cbf50b6f712ca86437880f03305a4a`.
| TDD Cycle Evidence | Safety | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.4 | 44/44 | constant-success stub rejected by every test | 23/23 | 13 defect mutations, 10 caught | 23/23 |
- Focused `node --test scripts/production-cutover/candidate.spec.mjs`: 23/23 passed; composed contract suites 44/44. Two independent four-lens reviews ran before settlement; the first returned six blockers and the attempt was settled failed rather than corrected, and the second returned two, both corrected once and re-validated.
- Design consequences of those reviews: `git hash-object` is removed from the trust path entirely because clean filters make it execute attacker configuration and report a spoofed identity, so worktree blob identity is computed in process; settlement is terminating and absolutely bounded, since a group that never reports close or exit would otherwise hang the caller forever; every probe fails closed as a set; and all fixtures are self-built, because continuous integration leaves `HEAD` attached or detached depending on the event.
- First CI run on the pull-request head found one environment-dependent test: the object-alternates fixture relied on `git clone --shared`, whose behaviour differs between a full developer checkout and a shallow CI one. It was rebuilt as a hermetic standalone repository that proves both directions from one fixture, and the six critical mechanisms were re-pinned by mutation afterwards.
- Known uncovered by construction: injecting a fault into exactly one probe, and a non-ENOENT alternates read fault, are unreachable from a test against the closed operation table. Budget reconciled from the historical `244/270` to the delivered `1017/1080`; the `<=400` review-size guidance was waived for this work unit by the maintainer.

## WU4 Receipts and Checkpoints — Task 2.5

- Task 2.5 is `[x]`; 7/18 tasks are complete. This nine-path candidate adds the public receipt, its redaction boundary and the fail-closed activation checkpoint. RED-CUT-05/06/07 were recovered from history and restated in the delta spec, because commit `623b286` removed the design table that defined them and task 2.5 referenced identifiers nothing in the repository still defined.
| TDD Cycle Evidence | Safety | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.5 | 86/86 | module absent, then every hostile case failing | 42/42 | 34 defect mutations, all caught after correction | 42/42 |
- Focused `node --test scripts/production-cutover/{receipt,checkpoint}.spec.mjs`: 42/42 passed; composed contract suites 86/86. One independent four-lens review ran before settlement and returned eight blockers; one consolidated correction addressed them and a targeted validator re-ran every reviewer mutation.
- Design consequences of that review: validation reasons over a canonical data-only snapshot, because an own non-enumerable member passed an `ownKeys` count yet vanished from the digest projection, binding two different trees to one identity; member NAMES and redaction key versions are scanned like values, because both reach the public receipt as cleartext; every member is bound to its claimed form, because a content scan alone is not a redaction boundary; denials name the member and never reproduce its value; the key version is length prefixed and the key carries a 32-byte floor; and `resumePoint` contains exceptions, reads only the validated view, and reports completion independently of whether resuming is permitted.
- Three review findings were test-validity defects rather than runtime bugs, and one was a recurrence within this work unit: the activation sequence had no oracle independent of the module, four of six content patterns were shadowed by structural rules, and three of this author's own hardening tests passed under the mutation they claimed to cover. All are now pinned. Budget reconciled from the historical `330–350` to the delivered `1299/1360`; the `<=400` review-size guidance remains waived for this change.

## WU5 Roles and Bootstrap — Task 3.1

- Task 3.1 is `[x]`; 8/18 tasks are complete. This six-path candidate adds the least-privilege lane role model, the clean bootstrap allowlist, and the per-lane activation baseline. RED-CUT-09/10/11 were recovered from `800d1a3` and restated in the delta spec, because `e083fc3` removed the design table and task 3.1 referenced identifiers nothing in the repository still defined. RED-CUT-11's recovered row names the already-merged `checkpoint.mjs`; the baseline validator was placed in `bootstrap.mjs` instead, which stays inside this work unit's paths and does not reopen a reviewed module.
| TDD Cycle Evidence | Safety | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 3.1 | 126/126 | modules absent, then every hostile case failing | 40/40 | 57 defect mutations, all caught after correction | 40/40 |
- Focused `node --test scripts/production-cutover/{roles,bootstrap}.spec.mjs`: 40/40 passed; composed contract suites 126/126. One independent four-lens review ran before settlement and returned four blockers; one consolidated correction addressed them and a targeted validator re-ran every reviewer mutation.
- Design consequences of that review: an expiry must be a real instant rather than a well-shaped one, because `9999-99-99T99:99:99.999Z` matches the shape, sorts after every real date, and made exceptions permanent; an approval must be a non-empty string, because `null`, `false` and `0` are what a serializer writes for an absent approval and all three admitted excess ownership; accessors and `toJSON` are refused before serialization rather than invoked; denials name a closed-vocabulary token or a position, never a caller-supplied string; migrator ownership is bounded to migration objects; a fault carries a reason distinct from every in-band rejection.
- The most consequential finding was methodological. This author's own mutation battery scored 22 of 22 and an independent battery of 139 found 72 survivors, because the author's mutations targeted the paths the author's tests already covered. RED-CUT-09 was enumerated as a hand-written blacklist of twelve pairs against a closed allowlist model, so 22 of 35 denied pairs were unprovable and widening the permitted table went unnoticed. The oracle is now derived from the complement of the required and permitted sets over the whole grant vocabulary, and both sets are pinned as independent literals. Budget reconciled from the historical `320–350` to the delivered `1152/1220`; the `<=400` review-size guidance remains waived for this change.
