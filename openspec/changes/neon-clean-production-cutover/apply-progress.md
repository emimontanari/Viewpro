# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Tasks: 3/18 complete — WU1, WU2, and only 2.1 Lineage. Later work remains pending.
- Delivery remains `sequential-to-develop`; no package, lockfile, repository/Git/process/CLI/CI, provider, deployment, traffic, or populated-manifest authority was used.

## Preserved Attempt and Reset History

- Attempts 1–4 remain immutable foundation history. WU1 merged `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`; WU2 merged `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; `3212c438f0ef5be886b090478acfba3a38d64102` is closure metadata, not a patch.
- Attempts 5–8 are terminal failures: mock-only candidate audit (`sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`), unsafe repository/process authority (`sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`), bounded correction over cap (`sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf`), and incomplete Contracts (`sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`).
- Maintainer reset `sha256:797825e9f95f4c6d02226f185576913741e71ad136d5ac7bd51844a216274386` preserves Attempt 9’s premature pass (`sha256:2312d7b9112cf9792caa2b6a4830c88b576ba99b0f02388012f958112b3c7a84`): review found duplicate/sparse/proxy/retarget and receipt defects.
- Attempt 10 fixed those defects: immutable behavioral RED found closure-metadata acceptance and `RegExp.test` object coercion (2/2); GREEN 6/6 and independent probes 77/77 passed, 2/2 mutants were killed, and it settled at 154/190 with `sha256:ed58aca31fd274053d05d5cd36231e37ccc1b9726c441892fb4c1ea92cf76a05`. Its receipt was later found stale.
- Maintainer reset `sha256:d0e974bcdddc3f8d50610ba3839f7a83542e248588b55a182bf0d82358dd2445` authorized only this clean-baseline reconstruction from `be01b677c690b217f592d6f2de31ac46db1c1332`; Attempts 9–10 and their evidence remain immutable.

## Attempt 11 — WU3-Lineage-Contracts Terminal Receipt

- State invariant: before settlement Attempt 11 remains active; after, and only after, the fail-closed authorization/settlement invariant below is satisfied, it is **terminal passed**, task 2.1 is complete, no active attempt or successor exists, and the next action is delivery review/PR only.
- Intended settle request ID: `wu3-lineage-terminal-reconcile-settle-20260824`.
- Settlement evidence revision: `sha256:c1ad9db96626527d7db342d1064156f4a1c339165513b1f8858a39b6e710de42`; SHA-256 of UTF-8 `be01b677c690b217f592d6f2de31ac46db1c1332` plus NUL, then each of the five intended paths in lexicographic order as UTF-8 path plus NUL plus exact file bytes plus NUL, replacing only this line’s digest token with `<self>` before hashing.
- Exact approved blobs: `candidate.v1.json` `6df64053c4ddc2d0f87319f4d939e98dd60cb0e8`; `lineage-contract.mjs` `31a5c9c4a64d69c7b7235f9d7fee06ed8ec6ccb2`; `lineage-contract.spec.mjs` `46685028dd538c5ba449f3616c9ce371994e19ac`.

### TDD Cycle Evidence

| Task | Safety | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|
| 2.1 | ✅ Passed — Attempt 10 baseline 4/4 | ✅ Written — immutable behavioral 2/2 | ✅ Passed — rerun 6/6 | ✅ Passed — exact, duplicate, sparse, recursive, retarget, prototype, proxy, no-mutation | ✅ Passed — clean |

| Focused command/result | Runtime/adversarial probes | Rollback |
|---|---|---|
| `node --test scripts/production-cutover/lineage-contract.spec.mjs` — ✅ Passed 6/6 | N/A runtime — pure isolated/no-network; locally runnable adversarial probes ✅ Passed 6/6 | Revert only the three Lineage files, task 2.1 checkbox, and this receipt |

## Final Accounting and Boundary

- Exactly five intended paths: the three Lineage files, `tasks.md`, and this receipt; exact full accounting is **145 additions + 45 deletions = 190/190 changed lines** and must be rechecked on the final bytes immediately before review and settlement.
- `git diff --check`, exact blob comparison, package/lock audit, scope audit, and no-process/no-authority audit passed. No behavior, fixture, or test differs from the independently approved correction bytes.
- WU4 remains blocked until all four WU3 slices are independently reviewed and merged and Qualification closes; no successor is authorized.

## Transaction Handling

This receipt predeclares, but does not presently claim, the final Attempt 11 review result: settlement is authorized only if a fresh independent read-only verifier reviews the exact five-path candidate and evidence revision above, reproduces the accounting/checks/tests, returns **PASS**, and explicitly authorizes request `wu3-lineage-terminal-reconcile-settle-20260824`; that exact settle request must record the PASS/authorization in native diagnosis/process evidence, native acceptance then makes the terminal statements true, and any file mutation after review or settlement invalidates this receipt.
