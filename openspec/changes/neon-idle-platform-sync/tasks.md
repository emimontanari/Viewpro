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
- [x] A.1 **RED:** Focused `API/__tests__` coverage for one batch, shared-promise/no queue, 2s feed timeout, typed projection/cursor-advance outcomes, swallowed-error rejection, non-empty success metadata with durable target projection/cursor while remaining `updating`, later empty-batch confirmation (`current`, count 0, cursor unchanged/no advance, failure zero, success time), and `finally` release. **AC3–AC7, AC9**
- [x] A.2 **GREEN:** Create `API/platform-sync-coordinator.ts`; make `IngestService.ingestBatch` return a discriminated stage outcome (or propagate typed failures); modify client/job/module. Timer delegates; projection/cursor failure cannot report success. Keep #329 payload/DB cancellation excluded.
- [x] A.3 **REFACTOR:** Prove timer/coordinator compatibility and no #329 DB cancellation, payload, or multi-replica scope.

## Slice B: Authenticated demand/status API (160–250; max 250)
- [x] B.1 **RED:** Controller/coordinator tests for 401/403, joined demand/no queue, backend return by 4s, restart `stale` with null observations, demand→`updating`, successful non-empty `updating` response metadata, failure mapping, and snapshot access without synchronization DB reads. **AC2–AC7, AC9**
- [x] B.2 **GREEN:** Add controller; wire guards/permission and sanitized status with `consecutiveFailureCount` increment/reset; keep timer.
- [x] B.3 **REFACTOR:** Prove old-web/new-API compatibility and later-demand retry; durable evidence remains #329.

## Slice C: Compatible web demand and degraded UX (240–350; max 350)
- [x] C.1 **RED:** Fake-clock tests for mount/focus/refresh, visible 4s cadence, hidden stop, invalidation, and 404 fallback; at normal maxima assert target projection visibility and durable cursor (demand +4s, backend +4s while possibly `updating`, client +1s = 9s ≤10s), not `current`; assert unfinished target work is excluded and updating/stale/failed renders by demand +5s. **AC2, AC4, AC6, AC9**
  - **AC6 closure-evidence correction (2026-09-03):** `platform-sync-projection-render.spec.tsx` uses the real `usePlatformSyncDemand`, a real `QueryClient`, and an active metrics projection consumer. It renders `old projection`, resolves a durable non-empty batch at fake-clock t0+8s while `updating`, permits invalidation/refetch, and observes `new projection` in the DOM at t0+9s. The earlier hook-only invalidation spy did not itself prove matching projection render.
- [x] C.2 **GREEN:** Create `WEB/features/platform-sync/{api,components}` and tests; modify dashboard layout. Browser calls only `viewpro-api`; preserve projection zero states.
- [x] C.3 **REFACTOR:** Prove old-API/new-web fallback, new-API/old-web behavior, and no unload dependency. Full E2E remains #329.

## Slice D: Gate, retire timer, prove operations (220–340; max 340)
- [x] D.1 **PRE-CHANGE GATE:** Record read-only actual Dokploy app/environment, observation time, desired and healthy running counts, IDs/health, digest, and domain; both counts exactly one. Unknown/non-singleton stops/rolls back. **AC1**
- [x] D.2 **PRE-CHANGE GATE:** Pass focused old/new API-web matrix and reverse rollback evidence while timer/config remain. **AC8–AC9**
- [x] D.3 **RED/GREEN/REFACTOR:** Only after D.1–D.2, delete job/test; update module, `CFG/{app.config.ts,env.schema.ts,__tests__/env.schema.spec.ts}`, `.env.example`, and `RUNBOOK`; verify idle performs no synchronization work. **AC2, AC7**
- [x] D.4 **MERGE/DEPLOY GATE:** Reconfirm D.1–D.2 before merge/deploy; rollback backend timer image first, then web, preserving singleton and cursor/outbox.
  - Evidence 2026-08-29: Dokploy `inmoview-prod` / `viewpro-platform-api`
    (`viewpro-platform-api-375xud`), Advanced -> Cluster Settings shows
    **Replicas: 1** with a green health indicator, and the panel reports the
    cluster feature is unavailable until a registry is configured — so this
    deployment cannot scale past a single replica at all, which is stronger
    than a point-in-time count.
  - **Deviation:** this singleton reconfirmation was performed *after* the
    merge and deploy of v1.2.0, not before as the gate requires. The gate was
    not satisfied at the moment it was meant to hold. Recorded rather than
    silently ticked; nothing observed suggests the deploy was unsafe, but the
    ordering this task specifies was not honoured.
- [x] D.5 **EVIDENCE:** Per project over ≥24h, record exact start/end, raw CU-hour delta, scheduled activity, no intentional authenticated demand, provider delay, and autosuspension; calculate `projected CU-hours = observed CU-hours × (720 / observation-window hours)`, label sub-30-day evidence projected, and PASS only at ≤10 CU-hours/project. **AC10–AC11**
  - **PASS — PROJECTED:** 2026-09-01T00:00:00Z → 2026-09-03T15:23:33.159Z (63.392544h; <30d), threshold ≤10 projected CUh/project. Product: 158 compute seconds, raw 0.043888889 CUh, 620s active, projected 720h 0.4984813356 CUh (0.2716758%). Platform: 157 seconds, raw 0.043611111 CUh, 616s active, projected 0.4953263904 CUh (0.2699231%).
  - Both endpoints were idle at capture with one endpoint each, fixed 0.25 CU, and plan-default five-minute autosuspend. Sep2/Sep3 start→suspend pairs correlate exactly with scheduled backup runs 33618365559 and 33744195725, which uploaded both DBs; Sep1 run 33499351324 failed.
  - Counters may lag, but capture was >4h after last activity and stable for 45m; user confirmed desired=1/running=1 healthy, deployed main/v1.2.0 `eaa2b279` or later no-poll image, and no intentional operator-console opening since Sep1. Public Query Performance is unavailable on Free/public API and explicitly complementary/non-gating. D.4's after-deploy ordering deviation remains historical and disclosed.
