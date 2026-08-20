# Design: Neon Clean Production Cutover

## Approach and Decisions

Immutable candidate; dormant-lane proof; write-freeze activation. Fail closed; #327 authoritative.

| Decision | Choice and rationale |
|---|---|
| Candidate | Prefix: `main@868dc70` → #331 `b61798a` → #333 `02b8977` → #334 `d70b905` → #335 `e2d4c27` → #336 `adc274b`; #333–#336 need #331 governance. WU1/WU2 use bounded receipts, reviewed remediation SHA(s). WU2 orders SHAs in `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json`, RFC-8785-canonicalizes, receipt-binds, and CLOSES (no wildcard/placeholder/optional entry). Planning never invents SHA(s). WU3+, candidate, provisioning, activation, and production receipts block until the ordered manifest verifies. Changes need version/tree/review/authorization; never auto-import. Pin tools/IDs; detached base, verified IDs, ordered cherry-picks, full-tree hash, exact-tree CI/audit. Governance remains Git-tree/receipt, excluded only from runtime image paths/digest/build context. Candidate receipt binds tree+commits; image receipt binds allowlisted paths+digest. Reject hidden filtering, unknown/optional dependencies, unrelated `develop`, and #314. Reviewed SHA replaces #334 fixture dependency. |
| Delivery | Force-chained/auto-chain uses `stacked-to-main`: sequential PRs into integration `develop`, never production `main`. Each WU: fresh `origin/develop` worktree/branch → autonomous unit → review+green CI → merge `develop` → remove worktree/branch; next only after merge/fetch/audit. Before EVERY WU inspect live `develop`, open branches/worktrees/planned paths; overlap/new commit ⇒ refresh/re-plan before edits. WU3 root package/lock and WU7 `app-new`/session are likely conflicts. Final candidate deterministically reconstructs `main@868dc70` + #331/#333–#336 + closed reviewed remediation manifest, excluding unrelated `develop`. |
| Rollback | Roll forward. Paired old image+URLs are pre-write eligible only after independently observed old-generation readiness `200`; old `503` proves neither candidate nor rollback. Post-write URL reversal requires reconciliation/export authority. |
| Lifecycle | Keep #327 active; run D.5 ≥24h post-deployment before its verify/archive. Cutover verify/archive follows #327 archive and one-month evidence/retention. Retain old Neon/backups ≥one month and exclude them from pruning. R2, Sentry, Resend remain untouched. |

Separate receipts gate frozen CI/audit, dormant bootstrap/readiness, old-deployment observation, and fresh activation. Timer-bearing/stale images receive no fresh routes.

## Role and Receipt Contracts

Fresh lanes revoke PUBLIC DB `CONNECT/TEMPORARY/CREATE` and schema `CREATE`; all roles get `CONNECT`. `<migrator>` owns objects: schema `USAGE/CREATE`, conditional DB `CREATE/TEMP`/future defaults, never superuser/role/database/replication authority. `<runtime>`: schema `USAGE`, table DML, sequence use; no ownership/membership/DDL/database `CREATE/TEMP`. `<backup>`: schema/table/sequence reads. RED-CUT-09: DB+/DB−, SCHEMA+/SCHEMA−, OWNER−, MEMBER−, TABLE+/TABLE−, SEQUENCE+/SEQUENCE−, RUNTIME-DDL−, BACKUP-DML−. Owner exceptions need approved expiring receipts.

Each lane emits product/platform RFC-8785 JCS JSON. Public v1 binds versions, aliases, base, patches, tree, path/image digests, deployment, secrets, backup/heartbeat, evidence/state/timestamps. Private off-Git receipts hold raw refs/hosts/IDs; correlate via `HMAC-SHA256` with named key-version authority, never plain hash. Separate receipts bind backup/pruning and candidate reproduction.

## Non-Atomic Activation

1. Freeze writes/automation. 2. Provision/bootstrap isolated roles/DBs. 3. Stage image/receipts. 4. Stage inactive URLs. 5. Rotate product/platform access/step-up; keep `PLATFORM_CONTROL_SECRET`. 6. Activate product after digest/readiness `200`/empty allowlist. 7. Activate platform after digest/readiness, singleton, cursor `0`/one operator. 8. Deploy frontends; prove fresh login. 9. Bind/run lane backups/heartbeats. 10. Immutable checkpoint/resume writes. Partial progress retains freeze/isolation, rolls forward; only qualified old pair permits pre-write compensation.

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

Forecast>400; force-chained/auto-chain, no size exception/strategy mixing; tasks retain the 390 hard stop and no provisioning authority.
