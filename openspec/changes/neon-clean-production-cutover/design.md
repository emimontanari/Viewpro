# Design: Neon Clean Production Cutover

## Approach and Decisions

Write-freeze activation. Fail closed; #327 authoritative.

| Decision | Choice and rationale |
|---|---|
| Candidate | Delivery: `develop@3212c438f0ef5be886b090478acfba3a38d64102`; reconstruction: `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 runtime patches + approved WU3–WU7 patches. WU2 runtime patch: `d53a57c04f34efd20fc825aff5c03115c9c6c99f`; `3212c43…` is closure metadata only. Exclude #338/#341/#344/#351 patches; retain `develop` history. Reject hidden AND optional dependencies and #314. WU3: tooling/schema/template only; WU3–WU7 emit merge receipts. Post-WU7 assembly computes tree/runtime/image digests. External private closure+reproduction precede single-use promotion; evidence/instances never alter tree. Pin IDs/base/order; exact-tree CI/audit. |
| Delivery | `sequential-to-develop`: live `origin/develop` → review/CI → merge → remove/fetch/audit; never `main`. Pre-work audit live `develop`, branches, worktrees, paths; overlap/new commit ⇒ refresh AND re-plan. Clean WU3 ignores dirty-root/stale-worktree contamination. Lock owns only `viewpro-app` root-importer (`.`) changes from explicit `package.json` tooling pins/scripts; preserve deepmerge; reject other/external importers, `autoInstallPeers`, unrelated resolutions. AJV iff schema execution requires it. Extend—not replace/weaken/reorder—#351 CI. WU7 `app-new`/session conflicts. |
| Gates | WU2 closure is satisfied. WU3 stays unchecked until the identity-correction PR merges; predecessor gates remain. Promotion/provider provisioning/activation/D.4/production receipts/traffic require verified external closure+reproduction and single-use authorization. Read-only qualification permits no mutation. |
| Rollback | Roll forward. Paired old image+URLs are pre-write eligible only after independently observed old-generation readiness `200`; old `503` proves neither candidate nor rollback. Post-write URL reversal requires reconciliation/export authority. |
| Lifecycle | Keep #327 active; run D.5 ≥24h post-deployment before its verify/archive. Cutover verify/archive follows #327 archive and one-month evidence/retention. Retain old Neon/backups ≥one month and exclude them from pruning. R2, Sentry, Resend remain untouched. |

Separate receipts gate CI/audit, bootstrap/readiness, old observation, activation. Timer-bearing/stale images get no routes.

## Role and Receipt Contracts

Fresh lanes: PUBLIC DB no `CONNECT/TEMPORARY/CREATE`, schema no `CREATE`; roles get `CONNECT`. `<migrator>` owns objects with schema `USAGE/CREATE`, conditional DB `CREATE/TEMP`/future defaults, never superuser/role/database/replication. `<runtime>` has schema `USAGE`, table DML, sequence use, no ownership/membership/DDL/database `CREATE/TEMP`; `<backup>` reads schema/table/sequence. RED-CUT-09: DB+/DB−, SCHEMA+/SCHEMA−, OWNER−, MEMBER−, TABLE+/TABLE−, SEQUENCE+/SEQUENCE−, RUNTIME-DDL−, BACKUP-DML−. Exceptions need approved expiry receipts.

Each lane emits RFC-8785 JCS JSON. Public v1 binds versions/aliases/base/patches/tree/path-image-digests/deployment/secrets/backup-heartbeat/evidence-state-timestamps. Private off-Git receipts/final manifest hold raw refs/hosts/IDs; correlate with named key-version `HMAC-SHA256`, never plain hash. Immutable manifest digest+private receipt identity is authoritative; public opaque aliases are non-authoritative/pinned. Retargeted/unresolved/digest-mismatched/direct-private-mismatched aliases fail closed; direct manifest identity wins. Candidate Git holds only tooling/schema/template; redacted digest/alias may be issue/PR/provider evidence, never Git. Full-tree/candidate and runtime-image receipts remain distinct external evidence.

## Non-Atomic Activation

1. Freeze writes/automation. 2. Provision/bootstrap roles/DBs. 3. Stage image/receipts. 4. Stage inactive URLs. 5. Rotate access/step-up; keep `PLATFORM_CONTROL_SECRET`. 6. Activate product after digest/readiness `200`/empty allowlist. 7. Activate platform after digest/readiness/singleton/cursor `0`/one operator. 8. Deploy frontends/fresh login. 9. Bind backups/heartbeats. 10. Checkpoint/resume. Retain freeze/isolation; roll forward; only qualified old pair permits pre-write compensation.

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
| 2 | `viewpro-app/apps/viewpro-api/src/observability/**`, fixture specs, `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json`: sanitized telemetry/alert/remediation; implementation `d53a57c…`, closure receipt/gate `3212c43…`; complete. Revert. | 340 |
| 3 | Candidate/manifest tooling, schema/template/specs, package/lock/config/CI: RED-CUT-01..04; extend #351; never instance. Revert. 327–362; at/near 350 stop for reforecast+reviewer-burden approval; hard stop 390; no exception. | 327–362 |
| 4 | `viewpro-app/scripts/production-cutover/{receipt,checkpoint}.mjs` plus specs; `docs/evidence/production-cutover/receipt.schema.json`: RED-CUT-05..07, reproducibility/JCS. Revert tooling. | 350 |
| 5 | `viewpro-app/scripts/production-cutover/{bootstrap,roles}.mjs` plus specs: RED-CUT-09..11, grants, allowlists. Keep lanes isolated. | 350 |
| 6 | `viewpro-app/scripts/production-cutover/backup-lineage.mjs` plus specs; `.github/workflows/db-backup.yml`: RED-CUT-08, lane backup/pruning receipts. Revert workflow. | 340 |
| 7 | Runbook, session tests, evidence templates: RED-CUT-12..13/checkpoints; emit reviewed develop-merge identity/receipt. Post-WU7 provisional assembly, external closure, and independent reproduction follow. Revert; retain freeze. | 350 |

Forecast>400; `sequential-to-develop`/auto-chain; global WU target ≤350, hard stop 390, no size exception/strategy mixing or provisioning authority.
