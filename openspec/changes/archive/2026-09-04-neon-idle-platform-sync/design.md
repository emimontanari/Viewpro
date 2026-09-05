# Design: Demand-Triggered Platform Synchronization

## Technical approach
Extract `PlatformDataPollJob.tick` into singleton `PlatformSyncCoordinator.runOneBatch()`: read cursor, fetch exactly one producer-bounded batch, apply existing ordered/idempotent writes, advance cursor only after durable writes, and release single-flight in `finally`. Timer and authenticated demand share it until Slice D. The producer remains batch-limit owner. **AC2–AC7**

## Decisions
| Choice | Tradeoff and rationale |
|---|---|
| Process-local shared promise | Smallest safe correction under one verified replica; multi-replica coordination is #329. |
| Active demand joins the same promise; no queued follow-up | Prevents overlap and hidden per-request loops. The next visible 4s cadence may start one batch after completion. |
| 2s `fetchChanges` abort only | Bounds cross-service HTTP without redesigning DB cancellation; later demand retries. |
| In-memory sanitized status | Supports UX without synchronization DB reads; restarts `stale` with null observation fields and is not durable evidence. |
| Discriminated ingest outcome | `IngestService.ingestBatch` reports projection/cursor-advance success or typed stage failure; logged/swallowed errors can never become coordinator success. Payload hardening and DB cancellation remain #329. |

## API, status, and transitions
`POST /operators/platform-sync/demand`, body `{}`, uses existing `AuthGuard`, `PlatformPermissionGuard`, and `PLATFORM_PERMISSIONS.METRICS_READ`. It starts/joins the shared promise, races it for 4s without cancelling admitted work, and returns `200` status; 401/403 starts no demand. **AC2, AC3, AC9**

```ts
type PlatformSyncStatus = {
  state: 'current' | 'updating' | 'stale' | 'failed'; inFlight: boolean;
  attemptCount: number; consecutiveFailureCount: number;
  lastAttemptAt: string | null; lastSuccessAt: string | null;
  lastFailureAt: string | null; lastObservedCursor: number | null;
  lastBatchCount: number | null;
  failureCode: 'CURSOR_READ_FAILED' | 'FEED_TIMEOUT' | 'FEED_FAILED' |
    'PROJECTION_FAILED' | 'CURSOR_ADVANCE_FAILED' | null;
}
type IngestBatchOutcome =
  | { kind: 'succeeded'; advancedCursor: number | null }
  | { kind: 'failed'; stage: 'projection' | 'cursor-advance' }
```

At restart, state is `stale`, `inFlight` is false, counters are zero, and observation fields are null; demand start transitions to `updating`. Only a new run increments `attemptCount`. `lastObservedCursor` is assigned from the durable cursor read at run start and changes during that run only after successful cursor advance; projection or cursor-advance failure preserves it. Any mapped failure increments `consecutiveFailureCount`, sets `failed`, and releases the promise. Complete success resets that count and updates `lastSuccessAt`; `ingestBatch` failure is never logged/swallowed into success. A successful non-empty event-bearing batch records batch success and its durable advanced cursor but remains `updating` because feed head is unconfirmed; the response may therefore be `updating` with successful batch metadata. A later empty feed batch is successful no-op confirmation: `current`, `lastBatchCount: 0`, unchanged cursor with no advance required, failure count kept at zero, and updated success timestamp. **AC4–AC7**

`visible authenticated console → POST demand → cursor → feed ≤2s → one-batch ingest/cursor → invalidate projection queries → render`

The backend races admitted work and returns status by 4s without cancellation. The provider demands on mount/focus/refresh and each visible 4s cadence; hidden/unmounted stops. When successful batch metadata shows the target projection write and cursor advance are durable, the web invalidates projection queries, reads, and renders even if state remains `updating`. If that target batch is unfinished at the race, the event is not normal-path SLO eligible; by 5s from demand the console renders updating/stale/failed and never implies completion. A 404 preserves legacy visible 5s projection polling during compatibility. Repeated visible cadence drains at most one batch each. **AC4, AC6, AC8**

## Freshness oracle
The ≤10s SLO applies only to an event returned in one feed-visible batch with visible/authenticated demand, no cold/backlog/timeout/failure, and that target event's projection write plus cursor advance durable within the 4s backend budget; coordinator `current` is not required. The web then invalidates, reads, and renders within 1s. From feed visibility `t0`, worst phase is 4s to demand + 4s backend + 1s client = 9s, leaving 1s margin. The fake-clock oracle asserts target projection visibility and cursor durability at those maxima while status may remain `updating`. It also holds target work past the 4s race and requires no completion claim plus updating/stale/failed by demand + 5s. **AC6, AC9**

## Files and slices
| Slice | Files/evidence | Range/max |
|---|---|---:|
| A | `apps/viewpro-api/src/platform-data/`: coordinator, client/ingest/job/module and focused tests; timer retained | 220–340/340 |
| B | Same area: demand controller, coordinator/module and auth/status tests; timer retained | 160–250/250 |
| C | `apps/viewpro-web/src/features/platform-sync/`, dashboard layout, fake-clock component tests | 240–350/350 |
| D | Delete job/test; update module, config tests, `.env.example`, runbook | 220–340/340 |

Planning PR0→A→B→C→D targets `develop` sequentially; predecessor merges before successor starts. Every PR ≤400 lines; no size exception.

## Gates, rollout, rollback
Before Slice D timer/config deletion, merge, or deployment: (1) record read-only actual Dokploy application/environment, time, desired and healthy running counts, instance health/IDs, digest, and domain; both counts must equal one; (2) pass old/new API-web compatibility and rollback evidence. Unknown/non-singleton stops or rolls back. Then remove timer/config. After deploy, for each project record an exact ≥24h start/end, raw CU-hour delta, scheduled activity, no intentional authenticated demand, provider delay, and idle autosuspension. Calculate `projected CU-hours = observed CU-hours × (720 / observation-window hours)`; PASS only at ≤10 CU-hours/project and label every sub-30-day result projected. Rollback backend timer-bearing image first, then web; preserve cursor/outbox and singleton topology. **AC1, AC8, AC10–AC11**

## #329 non-goals
Payload/BigInt validation, DB cancellation, multi-replica coordination, automated topology/image/drift gates, restart-durable evidence, and a full multi-service harness.

## Open questions
None. Planning gate: **PASS**.
