```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:dee95bac29af88a1b8727fa4fefdbdbe8da39d839c5acbc09968c9f1f242869e
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 34/34
test_command: "pnpm --filter next-shadcn-dashboard-starter test"
test_exit_code: 0
test_output_hash: sha256:6eb986eb66b6ca830ca3719e867a22633b006e512d37c0b7b47085bf52ac9b3e
build_command: "pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter next-shadcn-dashboard-starter lint:strict"
build_exit_code: 0
build_output_hash: sha256:1ea88ab5dfb48921bb548423a63dadc8400872106e22c405f1f5a2d05de784d6
```

# Verification Report: Seller Home Reference Fidelity

**Final disposition:** PASS
**Verified target HEAD:** `66c858f0926a6baf881bb8bc1f90572a746532cd`
**Date:** 2026-09-08 UTC
**Receipt status:** RDD is disabled/unmanaged; this report does not claim receipt approval.

## Provenance

- The exact-target `sdd-status` reported verification ready. Package `sdd-verify` was not used because its cross-worktree status was stale; an independent generic verifier and a bounded command worker performed the final verification instead. This is process provenance, not a blocker.
- Independent verifier: contracts build; focused seller C **30**; BFF **13**; Protected **47**; frontend **810 tests / 120 files**; app typecheck and strict lint; API local validation, typecheck, and **1,732 tests / 168 files**; clean status and diffcheck.
- Command worker: repository Docker PostgreSQL only, with `DATABASE_URL` and `DIRECT_URL` explicitly set to `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro`; `db:generate`, `db:validate`, and migrate deploy passed. All **32 migrations** were applied; none were pending. Strict OpenSpec validation passed. CI fresh-server Martín browser proof passed **1/1** on **3052/3152**; full seeded suite passed **35/35** on **3053/3153**. Generated artifacts were removed and the final tree was clean.
- Parent diagnostics: the final I4 changed TS/TSX files had **0** LSP diagnostics; every individual implementation slice also had **0** primary diagnostics.

## Envelope digest basis

- `evidence_revision` is the SHA-256 of the exact pre-envelope `verify-report.md` bytes merged at HEAD `602a1c7766f955248984c0cf9bacdb0359a16789`.
- `test_output_hash` is the SHA-256 of the newline-terminated retained summary `PASS: 810 tests in 120 files`; raw command stdout was not retained and is not claimed.
- `build_output_hash` is the SHA-256 of the newline-terminated retained summary `PASS: app typecheck and strict lint`; raw command stdout was not retained and is not claimed.
- The complete independent target evidence and all additional exact counts remain recorded below; this envelope does not relabel GREEN-on-arrival probes as RED or claim new implementation execution.

## Requirement and scenario results

| Requirement | PASS scenarios | Count | Evidence |
| --- | --- | ---: | --- |
| R1 | 1.1 exact agent; 1.2 protected managers; 1.3 fail closed | 3/3 | seller gates; Protected regression |
| R2 | 2.1 real identity + tenant; 2.2 missing identity; 2.3 no reference shell chrome | 3/3 | summary and seeded browser proof |
| R3 | 3.1 assigned scope; 3.2 rolling movement/stale; 3.3 narrow follow-up | 3/3 | seller facts/priorities |
| R4 | 4.1 two rows; 4.2 truthful zero priorities; 4.3 activity-failure priorities | 3/3 | section state contrasts |
| R5 | 5.1 real assigned preview; 5.2 permitted source activity; 5.3 successful empties; 5.4 prose/malformed time | 4/4 | bounded presenter and composition tests |
| R6 | 6.1 product loading; 6.2 both successful empty; 6.3 product local failure; 6.4 activity local failure; 6.5 local retry; 6.6 retained refresh; 6.7 tenant transition | 7/7 | C, BFF, and production-container proofs |
| R7 | 7.1 authorized destinations; 7.2 invalid identity; 7.3 contextual movement only; 7.4 forbidden populated home | 4/4 | link, composition, and seeded proofs |
| R8 | 8.1 keyboard/focus; 8.2 long responsive content; 8.3 non-color meaning | 3/3 | CI-fresh browser proof at four widths |
| R9 | 9.1 server authorization; 9.2 public/auth unchanged; 9.3 owner/manager/shell unchanged; 9.4 contracts not expanded | 4/4 | protected, API-local-only, and scope audit |
| **Total** | **R1.1–R9.4** | **34/34** | **PASS** |

## Commands and counts

| Check | Result |
| --- | --- |
| Contracts build | PASS |
| C / BFF / Protected | PASS: 30 / 13 / 47 tests |
| Frontend | PASS: 810 tests in 120 files; typecheck and strict lint PASS |
| API local-only | PASS: generate, validate, typecheck, 1,732 tests in 168 files; 32/32 migrations, none pending |
| Browser | PASS: CI-fresh Martín 1/1 (3052/3152); seeded 35/35 (3053/3153) |
| Static | PASS: strict OpenSpec, LSP 0 diagnostics, clean status, and `git diff --check` |

## Chain, boundaries, and findings

- Merged, CI-green delivery chain to `develop`: #561 (188 lines) → #563 (248 lines) → #564 (272 lines) → #565 (343 lines) → #566 (147 lines) → #567 (385 lines) → #569 (400 lines) → #571 (292 lines) → #573 (400 lines) → #575 (400 lines) → #577 (344 lines) → #579 (336 lines). First-parent integration is sequential; unrelated proposal PRs are interleaved. Documented per-slice rollback boundaries were not executed.
- File-scope audit and regressions preserve #306, #327, manager, owner, public, auth, shell, navigation, API, and BFF boundaries.
- Resolved finding: I1B timestamps labeled UTC were Argentina host-local UTC−3. `09:39` converts to `12:39Z`, after #567 merged at `12:34:46Z`; this is a label inaccuracy, not a predecessor-order failure.
- Resolved finding: I3A's explicit presenter-module task had a valid missing-module RED. Later expanded assertions were honestly GREEN-on-arrival; no RED was manufactured.

## Cleanup and remaining gates

No generated artifacts remain. The documentation-only verification candidate is within the 400-line review budget. Archive is technically eligible after this report and the canonical-spec consolidation/sync decision; archive and issue #523 closure remain parent-owned, unchecked gates.
