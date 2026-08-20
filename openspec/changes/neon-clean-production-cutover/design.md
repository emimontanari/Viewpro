# Design: Neon Clean Production Cutover

## Approach and Decisions

Write-freeze activation. Fail closed; #327 authoritative.

| Decision | Choice and rationale |
|---|---|
| Candidate | Prefix: `main@868dc70` + #331/#333/#334/#335/#336. WU2 RFC-8785-canonicalizes/receipt-binds/closes reviewed WU1/WU2 identities; only gates WU3-WU7 implementation/compatibility. WU3 commits tooling+versioned schema/template, never instance; WU3-WU7 emit reviewed develop-merge identity/receipt. Post-WU7 review/CI/merge, tooling may read-only assemble provisional isolated candidate from prefix+WU1-WU7 patches in disposable local worktree; no provider/traffic authority. Compute deterministic full-tree/runtime-path/image digests; checkpoint writes/closes populated `release-manifest.v1.json` outside candidate Git in private evidence, independently reassembles exact identities, verifies digests. Closure+reproduction plus single-use authorization permit promotion; public evidence/instance never alter bound tree. Pin tools/IDs, detached base, verified IDs, ordered cherry-picks, exact-tree CI/audit; reject hidden/optional dependencies/#314. |
| Delivery | Force-chained `stacked-to-main`: sequential PRs into integration `develop`, never `main`; fresh worktree → autonomous WU → review+CI → merge → remove → fetch/audit. Before EVERY WU audit `develop`, branches/worktrees/paths; overlap/new commit ⇒ refresh/re-plan. WU3 package/lock and WU7 `app-new`/session likely conflict. |
| Gates | WU3+ blocks only on remediation. Candidate-promotion/provider-provisioning/activation/D.4/production-receipts/traffic block until verified external closure+independent reproduction, then matching single-use authorization. Read-only qualification is separately authorized/no mutation. |
| Rollback | Roll forward. Paired old image+URLs are pre-write eligible only after independently observed old-generation readiness `200`; old `503` proves neither candidate nor rollback. Post-write URL reversal requires reconciliation/export authority. |
| Lifecycle | Keep #327 active; run D.5 ≥24h post-deployment before its verify/archive. Cutover verify/archive follows #327 archive and one-month evidence/retention. Retain old Neon/backups ≥one month and exclude them from pruning. R2, Sentry, Resend remain untouched. |

Separate receipts gate CI/audit, bootstrap/readiness, old observation, activation. Timer-bearing/stale images get no routes.

## Role and Receipt Contracts

Fresh lanes: PUBLIC DB no `CONNECT/TEMPORARY/CREATE`, schema no `CREATE`; roles get `CONNECT`. `<migrator>` owns objects: schema `USAGE/CREATE`, conditional DB `CREATE/TEMP`/future defaults, never superuser/role/database/replication. `<runtime>`: schema `USAGE`, table DML, sequence use; no ownership/membership/DDL/database `CREATE/TEMP`. `<backup>`: schema/table/sequence reads. RED-CUT-09: DB+/DB−, SCHEMA+/SCHEMA−, OWNER−, MEMBER−, TABLE+/TABLE−, SEQUENCE+/SEQUENCE−, RUNTIME-DDL−, BACKUP-DML−. Exceptions need approved expiry receipts.

Each lane emits RFC-8785 JCS JSON. Public v1 binds versions/aliases/base/patches/tree/path-image-digests/deployment/secrets/backup-heartbeat/evidence-state-timestamps. Private off-Git receipts/final manifest hold raw refs/hosts/IDs; correlate with named key-version `HMAC-SHA256`, never plain hash. Immutable manifest digest+private receipt identity is authoritative; public opaque aliases are non-authoritative/pinned. Retargeted/unresolved/digest-mismatched/direct-private-mismatched aliases fail closed; direct manifest identity wins. Candidate Git holds only tooling/schema/template; redacted digest/alias may be issue/PR/provider evidence, never Git. Full-tree/candidate and runtime-image receipts remain distinct external evidence.

## Non-Atomic Activation

1. Freeze writes/automation. 2. Provision/bootstrap isolated roles/DBs. 3. Stage immutable image/receipts. 4. Stage inactive URL generation. 5. Rotate access/step-up; keep `PLATFORM_CONTROL_SECRET`. 6. Activate product after digest/readiness `200`/empty allowlist. 7. Activate platform after digest/readiness/singleton/cursor `0`/one operator. 8. Deploy frontends; prove fresh login. 9. Bind backups/heartbeats. 10. Checkpoint/resume. Partial progress retains freeze/isolation, rolls forward; only qualified old pair permits pre-write compensation.

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

Tooling performs no commit/index, push/refspec, or PR commands.

## Work Units

| WU | Files; tests; rollback | Estimate |
|---|---|---|
| 1 | `viewpro-app/apps/viewpro-api/src/platform-data/**`, `viewpro-app/apps/viewpro-web/src/features/{platform-sync,tenants}/**`: fixture/freshness/render/idle proofs; reviewed remediation SHA(s). Revert. | 350 |
| 2 | `viewpro-app/apps/viewpro-api/src/observability/**`, fixture specs, `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json`: sanitized telemetry/alert/remediation; close receipt-bound WU1/WU2 manifest. Revert. | 340 |
| 3 | `viewpro-app/scripts/production-cutover/{candidate,remediation-manifest,release-manifest}.mjs`, versioned schema/template, specs; package/lock/config/CI: RED-CUT-01..04; implement/test stages and gates, never a populated final instance. Revert tooling. | 350 |
| 4 | `viewpro-app/scripts/production-cutover/{receipt,checkpoint}.mjs` plus specs; `docs/evidence/production-cutover/receipt.schema.json`: RED-CUT-05..07, reproducibility/JCS. Revert tooling. | 350 |
| 5 | `viewpro-app/scripts/production-cutover/{bootstrap,roles}.mjs` plus specs: RED-CUT-09..11, grants, allowlists. Keep lanes isolated. | 350 |
| 6 | `viewpro-app/scripts/production-cutover/backup-lineage.mjs` plus specs; `.github/workflows/db-backup.yml`: RED-CUT-08, lane backup/pruning receipts. Revert workflow. | 340 |
| 7 | Runbook, session tests, evidence templates: RED-CUT-12..13/checkpoints; emit reviewed develop-merge identity/receipt. Post-WU7 provisional assembly, external closure, and independent reproduction follow. Revert; retain freeze. | 350 |

Forecast>400; force-chained/auto-chain, no size exception/strategy mixing; tasks retain the 390 hard stop and no provisioning authority.
