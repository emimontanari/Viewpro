# Design: Neon Clean Production Cutover

## Approach and Decisions

Build immutable candidate, prove two dormant lanes, then activate sequentially under write freeze. Mismatches fail closed; #327 remains authoritative.

| Decision | Choice and rationale |
|---|---|
| Candidate | Known immutable prefix: `main@868dc70` → #331 `b61798a` → #333 `02b8977` → #334 `d70b905` → #335 `e2d4c27` → #336 `adc274b`; #333–#336 depend on #331 governance files. Remediation-producing WU1/WU2 each uses a bounded attempt/candidate receipt and yields reviewed SHA(s). At WU2 completion, order the actual SHAs after the prefix in `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json`; RFC-8785-canonicalize, receipt-bind, and CLOSE it without wildcards/placeholders/optional entries. It is intentionally unpopulated during planning; tasks MUST NOT claim unknown hashes. WU3+, isolated candidate construction, provisioning, activation, and production receipts are blocked until candidate verification accepts the complete ordered manifest. Later remediation changes manifest version/tree and requires re-review/re-authorization; never auto-import. Pin Git/tools; use detached base, verified IDs, ordered cherry-picks, full-tree hash, and exact-tree CI/audit. Governance remains in the Git tree/receipt, excluded only from runtime image paths/digest/build-context. Candidate receipt binds full-tree+ordered commits; runtime-image receipt binds allowlisted paths+digest. Reject hidden path-filtering, unknown/optional dependencies, unrelated `develop` commits, and #314. A reviewed remediation SHA replaces #334’s fixture dependency. |
| Rollback | Roll forward. Paired old image+URLs are pre-write eligible only after independently observed old-generation readiness `200`; old `503` proves neither candidate nor rollback. Post-write URL reversal requires reconciliation/export authority. |
| Lifecycle | Keep #327 active; run D.5 ≥24h post-deployment before its verify/archive. Cutover verify/archive follows #327 archive and one-month evidence/retention. Retain old Neon/backups ≥one month and exclude them from pruning. R2, Sentry, Resend remain untouched. |

Separate receipts gate frozen CI/audit, dormant bootstrap/readiness, old-deployment observation, and fresh activation. Timer-bearing/stale images receive no fresh routes.

## Role and Receipt Contracts

Fresh lanes revoke PUBLIC database `CONNECT/TEMPORARY/CREATE` and schema `CREATE`; all roles get `CONNECT`. `<migrator>` owns migration objects, gets schema `USAGE/CREATE`, conditional database `CREATE/TEMP`, matching future defaults, and no superuser/role/database/replication authority. `<runtime>` gets schema `USAGE`, table DML, and sequence use; no ownership/membership/DDL/database `CREATE/TEMP`. `<backup>` gets schema/table/sequence reads only. RED-CUT-09: DB+/DB−, SCHEMA+/SCHEMA−, OWNER−, MEMBER−, TABLE+/TABLE−, SEQUENCE+/SEQUENCE−, RUNTIME-DDL−, BACKUP-DML−. Owner exceptions need approved expiring receipts.

Each lane emits product/platform RFC-8785 JCS JSON. Public v1 binds versions, aliases, base, ordered patches, tree, path/image digests, deployment, secrets, backup/heartbeat, evidence, state, timestamps. Private off-Git receipts hold raw refs/hosts/IDs; correlate via `HMAC-SHA256` with named key-version authority, never plain hash. Separate receipts bind backup/pruning and candidate reproduction.

## Non-Atomic Activation

1. Freeze writes/automation. 2. Provision/bootstrap isolated roles/databases. 3. Stage image/receipts. 4. Stage inactive DB URLs. 5. Rotate product and platform access/step-up; keep `PLATFORM_CONTROL_SECRET`. 6. Activate product after digest, readiness `200`, empty allowlist. 7. Activate platform after digest, readiness, singleton, cursor `0`/one operator. 8. Deploy frontends; prove fresh login. 9. Bind/run lane backups/heartbeats. 10. Resume writes after immutable checkpoint. Partial progress retains freeze/isolation and rolls forward; only a qualified old pair permits pre-write compensation.

Backend tests reject old product cookies/JWTs/refresh, platform JWTs/step-up, and abandoned DB-backed reset/verification tokens. Frontend fresh-login/session proof never substitutes for backend rejection.

## Named Threat/RED Contracts

| ID | Target | Failure oracle |
|---|---|---|
| RED-CUT-01 | `candidate.mjs` | moved/stale ref or unauthorized patch rejected |
| RED-CUT-02 | `candidate.mjs` | reject `git -C`, relative/absolute escape, shell/path/argument injection |
| RED-CUT-03 | `candidate.mjs` | reject symlink and executable-looking Markdown/MDX, `README.sh`, `requirements.txt`, `CMakeLists.txt` |
| RED-CUT-04 | `candidate.mjs` | nonzero/timeout fails; TERM→KILL, drain, no child |
| RED-CUT-05 | `receipt.mjs` | secret/raw identifier redacted |
| RED-CUT-06 | `checkpoint.mjs` | partial provider state fails closed |
| RED-CUT-07 | `receipt.mjs` | wrong generation/digest/state rejected |
| RED-CUT-08 | `backup-lineage.mjs` | prefix collision or retained-lineage prune rejected |
| RED-CUT-09 | `roles.mjs` | catalog detects any excess privilege/ownership/membership |
| RED-CUT-10 | `bootstrap.mjs` | any non-allowlisted row rejected |
| RED-CUT-11 | `checkpoint.mjs` | non-`200` or wrong baseline rejected |
| RED-CUT-12 | `checkpoint.mjs` | post-write URL reversal refused |
| RED-CUT-13 | `viewpro-app/apps/{api,viewpro-api}/test/production-cutover-session.spec.ts` | every old session/token rejected |

Commit/index, push/refspec, and PR commands are N/A; tooling performs none.

## Work Units

| WU | Files; tests; rollback | Estimate |
|---|---|---|
| 1 | `viewpro-app/apps/viewpro-api/src/platform-data/**`, `viewpro-app/apps/viewpro-web/src/features/{platform-sync,tenants}/**`: fixture/freshness/render/idle proofs; reviewed remediation SHA(s). Revert. | 350 |
| 2 | `viewpro-app/apps/viewpro-api/src/observability/**`, fixture specs, `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json`: sanitized telemetry/alert/remediation; close receipt-bound manifest from reviewed SHA(s). Revert. | 340 |
| 3 | `viewpro-app/scripts/production-cutover/candidate.mjs` and specs; `viewpro-app/{package.json,pnpm-lock.yaml,vitest.production-cutover.config.ts}`, `.github/workflows/ci.yml`: RED-CUT-01..04 and closed-manifest verification. Revert tooling. | 350 |
| 4 | `viewpro-app/scripts/production-cutover/{receipt,checkpoint}.mjs` plus specs; `docs/evidence/production-cutover/receipt.schema.json`: RED-CUT-05..07, reproducibility/JCS. Revert tooling. | 350 |
| 5 | `viewpro-app/scripts/production-cutover/{bootstrap,roles}.mjs` plus specs: RED-CUT-09..11, grants, allowlists. Keep lanes isolated. | 350 |
| 6 | `viewpro-app/scripts/production-cutover/backup-lineage.mjs` plus specs; `.github/workflows/db-backup.yml`: RED-CUT-08, lane backup/pruning receipts. Revert workflow. | 340 |
| 7 | Runbook, session tests, evidence templates: RED-CUT-12..13/checkpoints. Revert; retain freeze. | 350 |

Forecast>400; approved force-chained Feature Branch Chain: draft/no-merge tracker; PR1→tracker; PRn→PRn-1; only-final-tracker-integration→production after-all-gates; no-size-exception/strategy-mixing; tasks-retain-390-hard-stop; no-provisioning-authority.
