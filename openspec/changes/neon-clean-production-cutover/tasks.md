# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,230–2,430 lines; force-chained/auto-chain; `stacked-to-main` means sequential PRs into integration `develop`, not production `main`; WU1 → WU2 → WU3 → WU4 → WU5 → WU6 → WU7; hard stop 390 (target ≤350; stop, settle, re-plan).

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Chain: Fresh `origin/develop` worktree/branch → one autonomous WU → review+green CI → merge `develop` → remove worktree/branch; next only after merge/fetch/audit. No size exception or strategy mixing. Incremental merges never reach production `main`; final candidate deterministically reconstructs `main@868dc70` + #331/#333–#336 + closed reviewed remediation manifest, excluding unrelated `develop` commits.

Concurrency gate: Before EVERY WU inspect live `develop`, open branches/worktrees, planned-path overlap; overlap/new `develop` commit requires refresh/re-plan before edits. WU3 root package/lock and WU7 `app-new`/session are likely conflicts; no permanent external dependency.

Remediation gate: Planning never fabricates hashes. WU1/WU2 emit bounded receipts/reviewed remediation SHA(s). WU2 closes `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json` with ordered real list; no placeholder/wildcard/optional entry. WU3+ candidate/provider/activation await verification; later changes need new version/review/authorization.

### Phase 1 — #327
- [ ] 1.1 **WU1 (320–350):** RED→GREEN: `viewpro-app/apps/viewpro-web/src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts`, `viewpro-app/apps/viewpro-web/src/features/tenants/components/__tests__/tenants-management-page.spec.tsx`, `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/platform-data.module.spec.ts`; visible render, elapsed zero-I/O idle, receipt.
- [ ] 1.2 **WU2 (300–340):** `viewpro-app/apps/viewpro-api/src/observability/sentry.service.ts`; tests `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/platform-sync-{coordinator,controller}.spec.ts`, `viewpro-app/apps/viewpro-api/src/observability/__tests__/sentry.service.spec.ts`; replace #334 fixture, sanitize telemetry, close manifest.

### Phase 2 — Candidate
- [ ] 2.1 **WU3 (330–350):** `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, `viewpro-app/vitest.production-cutover.config.ts`, `.github/workflows/ci.yml`, `viewpro-app/scripts/production-cutover/candidate.mjs`, `viewpro-app/scripts/production-cutover/__tests__/candidate.spec.ts`; RED-CUT-01–04. Verify CLOSED manifest `main@868dc70 → #331 b61798a → #333 02b8977 → #334 d70b905 → #335 e2d4c27 → #336 adc274b → remediation SHA(s)`; pin tools/IDs, detached base, full-tree hash, exact-tree CI/audit; changed/missing SHA stops.
- [ ] 2.2 **WU4 (330–350):** `viewpro-app/scripts/production-cutover/{receipt,checkpoint}.mjs`, `viewpro-app/scripts/production-cutover/__tests__/{receipt,checkpoint}.spec.ts`, `docs/evidence/production-cutover/receipt.schema.json`; RED-CUT-05–07, RFC-8785 JCS redaction, generation/digest/state bindings, fail-closed receipts.

### Phase 3 — Fresh
- [ ] 3.1 **WU5 (320–350):** `viewpro-app/scripts/production-cutover/{roles,bootstrap}.mjs`, `viewpro-app/scripts/production-cutover/__tests__/{roles,bootstrap}.spec.ts`; grants, allowlists, readiness, RED-CUT-09–11, S1/S3, runtime acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** `viewpro-app/scripts/production-cutover/backup-lineage.mjs`, `viewpro-app/scripts/production-cutover/__tests__/backup-lineage.spec.ts`, `.github/workflows/db-backup.yml`; RED-CUT-08, lane backups/heartbeats/pruning, old Neon/backup lineage retained ≥1 month.

### Phase 4 — Cutover
- [ ] 4.1 **WU7 (330–350):** Session tests `viewpro-app/apps/{api,viewpro-api}/test/production-cutover-session.spec.ts`, `viewpro-app/apps/{app-new,viewpro-web}/src/lib/__tests__/session-generation.spec.ts`; `docs/plans/2026-07-21-production-go-live-runbook.md`, `docs/evidence/production-cutover/{candidate,checkpoint,cutover}.template.json`; RED-CUT-12–13/checkpoints.

Activation: freeze writes/automation → provision/bootstrap → stage image/receipts/inactive URLs → rotate product/platform access+step-up (control secret unchanged) → activate product/platform → deploy frontends/prove fresh login → lane backups/heartbeats → checkpoint/resume. Old `200` permits pre-write rollback; `503` stops traffic; post-write reversal needs reconciliation/export authority.

## Lifecycle (7; WAIT/resume allowed)
- [ ] 5.1 Read-only provider qualification receipt.
- [ ] 5.2 Single-use provisioning attempt.
- [ ] 5.3 Fresh single-use activation attempt.
- [ ] 5.4 #327 D.5 evidence after ≥24h.
- [ ] 5.5 Verify/archive #327; open internal-pilot gate.
- [ ] 5.6 One-month evidence/retention checkpoint.
- [ ] 5.7 Verify/archive cutover; deletion separately approved.

## Traceability/Deny Oracles

S1→RED-CUT-10; S2→`PROVISION-DENY`; S3→RED-CUT-09; S4→RED-CUT-01/06/07/11; S5→RED-CUT-12/13; S6→RED-CUT-12; S7→`EVIDENCE-DENY`; S8→`LIFECYCLE-DENY`. Target `viewpro-app/scripts/production-cutover/__tests__/checkpoint.spec.ts` or relevant tests. `PROVISION-DENY`: no authorization/slot/allowance/policy receipt ⇒ no project/traffic mutation. `EVIDENCE-DENY`: missing lane backup/heartbeat/D.5/month blocks progression. `LIFECYCLE-DENY`: missing predecessor blocks #327/cutover verify/archive.

Provider mutations need fresh per-attempt SINGLE-USE authorization: ID/expiry, generation, lane, exact targets/action, candidate digests, transitions, owner, receipt/settlement; pass/fail consumes it; retries/changed targets need new authorization. No new retention policy; old Neon/backup lineage, R2, Sentry, Resend remain untouched; exclude #290/#329, public launch, paid plans, broader release, unapproved org, destructive cleanup.
