# Tasks: Demand-Triggered Platform Synchronization

## Review workload forecast
Estimated implementation: 840–1,280 lines (A 220–340; B 160–250; C 240–350; D 220–340).
400-line budget risk: High
Chained PRs recommended: Yes
Decision needed before apply: No
Chain strategy: sequential-to-develop
Planning PR0: finalized 269 lines, hard cap 400. Delivery PR0→A→B→C→D; each targets `develop` after its predecessor merges, each ≤400, no size exception.

Aliases: `API=viewpro-app/apps/viewpro-api/src/platform-data`; `WEB=viewpro-app/apps/viewpro-web/src`; `CFG=viewpro-app/apps/viewpro-api/src/config`; `RUNBOOK=docs/plans/2026-07-21-production-go-live-runbook.md`.

## Slice A: Coordinator and timeout (220–340; max 340)
- [ ] A.1 **RED:** Focused `API/__tests__` coverage for one batch, shared-promise/no queue, 2s feed timeout, typed projection/cursor-advance outcomes, swallowed-error rejection, non-empty success metadata with durable target projection/cursor while remaining `updating`, later empty-batch confirmation (`current`, count 0, cursor unchanged/no advance, failure zero, success time), and `finally` release. **AC3–AC7, AC9**
- [ ] A.2 **GREEN:** Create `API/platform-sync-coordinator.ts`; make `IngestService.ingestBatch` return a discriminated stage outcome (or propagate typed failures); modify client/job/module. Timer delegates; projection/cursor failure cannot report success. Keep #329 payload/DB cancellation excluded.
- [ ] A.3 **REFACTOR:** Prove timer/coordinator compatibility and no #329 DB cancellation, payload, or multi-replica scope.

## Slice B: Authenticated demand/status API (160–250; max 250)
- [ ] B.1 **RED:** Controller/coordinator tests for 401/403, joined demand/no queue, backend return by 4s, restart `stale` with null observations, demand→`updating`, successful non-empty `updating` response metadata, failure mapping, and snapshot access without synchronization DB reads. **AC2–AC7, AC9**
- [ ] B.2 **GREEN:** Add controller; wire guards/permission and sanitized status with `consecutiveFailureCount` increment/reset; keep timer.
- [ ] B.3 **REFACTOR:** Prove old-web/new-API compatibility and later-demand retry; durable evidence remains #329.

## Slice C: Compatible web demand and degraded UX (240–350; max 350)
- [ ] C.1 **RED:** Fake-clock tests for mount/focus/refresh, visible 4s cadence, hidden stop, invalidation, and 404 fallback; at normal maxima assert target projection visibility and durable cursor (demand +4s, backend +4s while possibly `updating`, client +1s = 9s ≤10s), not `current`; assert unfinished target work is excluded and updating/stale/failed renders by demand +5s. **AC2, AC4, AC6, AC9**
- [ ] C.2 **GREEN:** Create `WEB/features/platform-sync/{api,components}` and tests; modify dashboard layout. Browser calls only `viewpro-api`; preserve projection zero states.
- [ ] C.3 **REFACTOR:** Prove old-API/new-web fallback, new-API/old-web behavior, and no unload dependency. Full E2E remains #329.

## Slice D: Gate, retire timer, prove operations (220–340; max 340)
- [ ] D.1 **PRE-CHANGE GATE:** Record read-only actual Dokploy app/environment, observation time, desired and healthy running counts, IDs/health, digest, and domain; both counts exactly one. Unknown/non-singleton stops/rolls back. **AC1**
- [ ] D.2 **PRE-CHANGE GATE:** Pass focused old/new API-web matrix and reverse rollback evidence while timer/config remain. **AC8–AC9**
- [ ] D.3 **RED/GREEN/REFACTOR:** Only after D.1–D.2, delete job/test; update module, `CFG/{app.config.ts,env.schema.ts,__tests__/env.schema.spec.ts}`, `.env.example`, and `RUNBOOK`; verify idle performs no synchronization work. **AC2, AC7**
- [ ] D.4 **MERGE/DEPLOY GATE:** Reconfirm D.1–D.2 before merge/deploy; rollback backend timer image first, then web, preserving singleton and cursor/outbox.
- [ ] D.5 **EVIDENCE:** Per project over ≥24h, record exact start/end, raw CU-hour delta, scheduled activity, no intentional authenticated demand, provider delay, and autosuspension; calculate `projected CU-hours = observed CU-hours × (720 / observation-window hours)`, label sub-30-day evidence projected, and PASS only at ≤10 CU-hours/project. **AC10–AC11**
