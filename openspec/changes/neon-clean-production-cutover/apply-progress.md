# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Tasks: 3/18 complete — WU1, WU2, and only 2.1 Lineage; Attempt 13 proxy correction is active and correction-pending. Later work remains pending.
- Delivery remains `sequential-to-develop`; no package, lockfile, repository/Git/process/CLI/CI, provider, deployment, traffic, or populated-manifest authority was used.

## Preserved Attempt and Reset History

- Attempts 1–4 remain immutable foundation history. WU1 merged `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`; WU2 merged `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; `3212c438f0ef5be886b090478acfba3a38d64102` is closure metadata, not a patch.
- Attempts 5–8 are terminal failures: mock-only candidate audit (`sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`), unsafe repository/process authority (`sha256:666da4d8ae325d2c0ef01351db0ecb8b05bad374d1b3c794d9f6ae25f02d27f3`), bounded correction over cap (`sha256:e21a67d37149bf785b187343082475e23435ce8489378c659705942901edcedf`), and incomplete Contracts (`sha256:4f2ba1c39662dc5136829e63e87f5d848af1f7975f9039482b02824df61940ce`).
- Maintainer reset `sha256:797825e9f95f4c6d02226f185576913741e71ad136d5ac7bd51844a216274386` preserves Attempt 9’s premature pass (`sha256:2312d7b9112cf9792caa2b6a4830c88b576ba99b0f02388012f958112b3c7a84`): review found duplicate/sparse/proxy/retarget and receipt defects.
- Attempt 10 fixed those defects: immutable behavioral RED found closure-metadata acceptance and `RegExp.test` object coercion (2/2); GREEN 6/6 and independent probes 77/77 passed, 2/2 mutants were killed, and it settled at 154/190 with `sha256:ed58aca31fd274053d05d5cd36231e37ccc1b9726c441892fb4c1ea92cf76a05`. Its receipt was later found stale.
- Attempt 11 terminally passed at `sha256:c1ad9db96626527d7db342d1064156f4a1c339165513b1f8858a39b6e710de42`; Attempt 12 rebaseline passed at `sha256:a14a7cb0ce3297f55e0443abb30dc0f10fcbf48a1a2efcd41785be5598824b20` on `c343ddee267ced73349c0405dadbae242a3ac212`; both remain immutable.

## Attempt 13 — WU3-Lineage-Contracts Active Proxy Correction

- State invariant: Attempt 13 is active; task 2.1 remains complete, no successor is active or authorized, and next after successful settlement is delivery review/PR only.
- Active request/token: `wu3-lineage-proxy-correction-acquire-20260824` / `sha256:080c0ca442658060b164fbdfb674141b6c834905d97b4cf27b42620cf96fa272`; intended settle request: `wu3-lineage-proxy-correction-settle-20260824`.
- Candidate evidence digest: `sha256:1f254d8ae54a505fe8b4eda2f2f09ee89ce8ebb988ff877f08359c3501587874`; SHA-256 uses `c343ddee267ced73349c0405dadbae242a3ac212` plus NUL then five lexicographic UTF-8 path/NUL/bytes/NUL records, replacing only this token with `<self>` before hashing.
- Exact scope: `candidate.v1.json`, `lineage-contract.mjs`, `lineage-contract.spec.mjs`, `tasks.md`, and this receipt; frozen local `node:util` `types.isProxy` guards before reflection/reads, and `dense()` reads its local length only after that rejection.

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
- WU4 remains blocked until all four WU3 slices are independently reviewed and merged and Qualification closes; no successor is authorized.

## Transaction Handling

This active receipt does not claim terminal PASS: only after a fresh independent read-only verifier reproduces the corrected exact five-byte candidate/digest, accounting, 8/8 focused tests, 23/23 probes, root/nested/closure/revoked zero-trap proof, and all clean checks, returns **PASS**, and explicitly authorizes `wu3-lineage-proxy-correction-settle-20260824` may that exact native settle record PASS; any mutation invalidates it, and until then Attempt 13 remains active for review.
