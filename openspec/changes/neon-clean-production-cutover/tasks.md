# Tasks: Neon Clean Production Cutover

## Forecast

Forecast: 2,230–2,430 changed lines; force-chained/auto-chain; feature-branch-chain; WU1 → WU2 → WU3 → WU4 → WU5 → WU6 → WU7; hard stop 390 (target ≤350; stop, settle, re-plan).

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain: draft/no-merge tracker; PR1→tracker; PRn→PRn-1; tracker alone reaches production after all WUs/gates; no strategy mixing; polluted diff: retarget/rebase; no size exception.

Remediation gate: Planning MUST NOT fabricate hashes. WU1/WU2 emit bounded receipts and real reviewed production remediation SHA(s). WU2 closes `viewpro-app/scripts/production-cutover/remediation-manifest.v1.json` with complete ordered real list; no placeholder/wildcard/optional entry. WU3+ candidate/provider/activation await manifest verification; later changes require new version/review/authorization.

### Phase 1 — #327
- [ ] 1.1 **WU1 (320–350):** RED→GREEN: `viewpro-app/apps/viewpro-web/src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts`, `viewpro-app/apps/viewpro-web/src/features/tenants/components/__tests__/tenants-management-page.spec.tsx`, `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/platform-data.module.spec.ts`; visible render, elapsed zero-I/O idle, receipt.
- [ ] 1.2 **WU2 (300–340):** `viewpro-app/apps/viewpro-api/src/observability/sentry.service.ts`; tests `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/platform-sync-coordinator.spec.ts`, `viewpro-app/apps/viewpro-api/src/platform-data/__tests__/platform-sync.controller.spec.ts`, `viewpro-app/apps/viewpro-api/src/observability/__tests__/sentry.service.spec.ts`; replace #334 fixture, sanitize telemetry, close manifest.

### Phase 2 — Candidate
- [ ] 2.1 **WU3 (330–350):** `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, `viewpro-app/vitest.production-cutover.config.ts`, `.github/workflows/ci.yml`, `viewpro-app/scripts/production-cutover/candidate.mjs`, `viewpro-app/scripts/production-cutover/__tests__/candidate.spec.ts`; RED-CUT-01–04. Verify CLOSED manifest `main@868dc70 → #331 b61798a → #333 02b8977 → #334 d70b905 → #335 e2d4c27 → #336 adc274b → remediation SHA(s)`; pin tools/IDs, detached base, full-tree hash, exact-tree CI/audit; changed/missing SHA stops.
- [ ] 2.2 **WU4 (330–350):** `viewpro-app/scripts/production-cutover/receipt.mjs`, `viewpro-app/scripts/production-cutover/checkpoint.mjs`, `viewpro-app/scripts/production-cutover/__tests__/receipt.spec.ts`, `viewpro-app/scripts/production-cutover/__tests__/checkpoint.spec.ts`, `docs/evidence/production-cutover/receipt.schema.json`; RED-CUT-05–07, RFC-8785 JCS redaction, generation/digest/state bindings, fail-closed receipts.

### Phase 3 — Fresh
- [ ] 3.1 **WU5 (320–350):** `viewpro-app/scripts/production-cutover/roles.mjs`, `viewpro-app/scripts/production-cutover/bootstrap.mjs`, `viewpro-app/scripts/production-cutover/__tests__/roles.spec.ts`, `viewpro-app/scripts/production-cutover/__tests__/bootstrap.spec.ts`; grants, allowlists, readiness, RED-CUT-09–11, S1/S3, runtime acquire→settle; stop before provisioning.
- [ ] 3.2 **WU6 (300–340):** `viewpro-app/scripts/production-cutover/backup-lineage.mjs`, `viewpro-app/scripts/production-cutover/__tests__/backup-lineage.spec.ts`, `.github/workflows/db-backup.yml`; RED-CUT-08, lane backups/heartbeats/pruning, old Neon/backup lineage retained ≥1 month.

### Phase 4 — Cutover
- [ ] 4.1 **WU7 (330–350):** Session tests `viewpro-app/apps/api/test/production-cutover-session.spec.ts`, `viewpro-app/apps/viewpro-api/test/production-cutover-session.spec.ts`, `viewpro-app/apps/app-new/src/lib/__tests__/session-generation.spec.ts`, `viewpro-app/apps/viewpro-web/src/lib/__tests__/session-generation.spec.ts`; `docs/plans/2026-07-21-production-go-live-runbook.md`, `docs/evidence/production-cutover/candidate.template.json`, `docs/evidence/production-cutover/checkpoint.template.json`, `docs/evidence/production-cutover/cutover.template.json`; RED-CUT-12–13/checkpoints.

Activation order: (1) freeze automation/writes, (2) provision/bootstrap, (3) stage image/receipts, (4) stage inactive URLs, (5) rotate product/platform access and step-up, control secret unchanged, (6) activate product, (7) activate platform, (8) deploy frontends/fresh login, (9) bind/run both lane backups/heartbeats, (10) immutable checkpoint then resume. Old `200` permits pre-write rollback only; old `503` means rollback unavailable and traffic stays stopped; post-write URL reversal requires reconciliation/export authority.

## Lifecycle (7 checkpoints; WAIT/resume allowed)
- [ ] 5.1 Record read-only provider qualification receipt.
- [ ] 5.2 Execute one single-use provisioning attempt.
- [ ] 5.3 Execute one fresh single-use activation attempt.
- [ ] 5.4 Record #327 D.5 evidence checkpoint after ≥24h.
- [ ] 5.5 Verify/archive #327, then open the internal-pilot gate.
- [ ] 5.6 Record one-month evidence and retention checkpoint.
- [ ] 5.7 Verify/archive cutover; deletion remains a separate future approval.

## Traceability/Deny Oracles

S1→RED-CUT-10; S2→`PROVISION-DENY`; S3→RED-CUT-09; S4→RED-CUT-01/06/07/11; S5→RED-CUT-12/13; S6→RED-CUT-12; S7→`EVIDENCE-DENY`; S8→`LIFECYCLE-DENY`. All target `viewpro-app/scripts/production-cutover/__tests__/checkpoint.spec.ts` or appropriate checkpoint tests. `PROVISION-DENY`: absent authorization/slot/allowance/policy receipt ⇒ no project creation/no traffic mutation. `EVIDENCE-DENY`: missing lane backup/heartbeat/D.5/month receipt blocks only corresponding progression. `LIFECYCLE-DENY`: missing predecessor receipt blocks #327 or cutover verify/archive.

Every provider mutation needs fresh per-attempt SINGLE-USE authorization binding attempt ID/expiry, generation, lane, exact targets/action, candidate digests, transitions, owner, receipt/settlement; pass/fail consumes it; retries/changed targets need new authorization. Retention/control-secret boundary: no new retention policy; old Neon/backup lineage, R2, Sentry, and Resend remain untouched; exclude #290/#329, `develop`, public launch, paid plans, broader release, unapproved org, and destructive cleanup.
