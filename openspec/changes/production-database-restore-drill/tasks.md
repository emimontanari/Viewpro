# Tasks: Production Database Restore Drill

## Review Workload Forecast

| Slice | File-level estimate | Boundary |
|---|---:|---|
| PR2a five current artifact paths | 388 actual | Planning/evidence only; hard stop ≤400 |
| PR2b helper / tests / fixtures / package | 155–175 / 145–165 / 35–45 / 2–4 = 337–389 | No cloud/runtime; helper+security tests together |
| PR2c receipt / runbook / ledger / status / operations | 80–100 / 50–65 / 20–30 / 15–20 / 135–175 = 300–390 | Authorized restore/evidence/docs/cleanup |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

No size exception. At 390, stop. PR2b reduces duplication or replans only non-security fixture/package work; helper and security tests remain together. PR2c splits runbook/ledger/current-record reconciliation before 400 and delays closure; acceptance stays with cleanup evidence.

```text
PR1 planning (merged 2e493cb) -> PR2a planning correction -> PR2b helper/tests -> PR2c authorized operation/closure
```
## Phase 1: PR2a Planning Correction
- [ ] 1.1 Correct only the five authorized OpenSpec paths; preserve the 2,900-byte `apply-progress.md` prefix, record the four-PR chain, run budget/secret/diff checks, and keep total ≤400.

## Phase 2: PR2b RED — Helper Contract
- [ ] 2.1 Add fake-`psql` RED tests in `viewpro-app/apps/api/test/restore-schema-parity.spec.ts` for schemas/relkinds/ledger, `-X`, minimal environment, `ON_ERROR_STOP`, DB read-only/DDL failure, startup silence, constant stdin, nonzero status, and hostile stderr.
- [ ] 2.2 Add RED tests for lexical create/drop/rename/schema-move/quoted-case folds, comments/strings, procedural/dynamic rejection, and repository realpath traversal/wrong-root/symlink/metacharacter/schema injection failures.
- [ ] 2.3 Add fixtures under `viewpro-app/scripts/restore-drill/fixtures/`; prove current 23/6 expectations, deterministic output, and exit 1/2 behavior without PostgreSQL/cloud.

## Phase 3: PR2b GREEN and Verification
- [ ] 3.1 Create `viewpro-app/scripts/restore-drill/schema-parity.mjs`: resolve repository-bound paths/schema allowlist; fold supported DDL and reject unsupported shaping.
- [ ] 3.2 Spawn `psql` with sanitized argv/environment/read-only mode; execute one constant catalog query plus one bounded ledger query; exact-filter in JS without interpolation.
- [ ] 3.3 Emit fixed-order JSON with separated table/ledger parity, permitted sorted PostgreSQL-quoted qualified names, deterministic `pass:false`/exit 1, and sanitized exit 2.
- [ ] 3.4 Add `restore:parity` to `viewpro-app/package.json`; make every offline RED case GREEN with helper/security tests together.
- [ ] 3.5 Verify stdin/options/environment, DDL/startup defenses, byte determinism, secret scans, `git diff --check`, and ≤400; merge PR2b after review/CI, with no cloud/runtime action.

## Phase 4: PR2c Fresh Authorized Cycle
- [ ] 4.1 Before ANY operation, prove one conjunctive gate: PR2b merged; new authorization recorded; exhausted runtime reset approved+completed; fresh credentials/targets provisioned+validated.
- [ ] 4.2 Run guarded two-lane integrity/restore/helper/RPO/RTO/structural/invariant checks; require exit 0 plus `pass:true`; retain sanitized aggregate/object-name evidence.
- [ ] 4.3 Run digest-only cross-lane checks and all 18 scenarios; prohibit customer/runtime identifiers, values, rows, emails, URLs/hosts/IPs, credentials, exact dump keys, money, and payloads.
- [ ] 4.4 Prove target deletion and Neon/R2 revocation on every exit; remove Keychain/transient files/dumps; retain immutable cleanup receipts.
- [ ] 4.5 Within budget, reconcile runbook/ledger/current receipt and APPEND status only; never rewrite history. Roll back current records only. Close #290 after full acceptance/reconciliation.
