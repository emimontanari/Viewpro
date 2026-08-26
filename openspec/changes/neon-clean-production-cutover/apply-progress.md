# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Tasks: **5/18 complete** — WU1, WU2, 2.1 Lineage, 2.2 Tree/Byte, and 2.3 Release; later work remains pending.
- Attempt 17 is active after factual acquisition; this correction is un-settled and terminal status remains exclusively in the native ledger.

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
