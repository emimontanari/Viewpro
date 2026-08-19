# Delta for platform-data-lane-ingest-metrics

## MODIFIED Requirements
### Requirement: Interval Poll Job [AC1–AC4]
The subsystem MUST replace perpetual polling with authenticated demand through `viewpro-api`; the browser MUST NOT call the product API. Production MUST have one manually verified synchronization replica. One demand MUST start at most one producer-bounded batch. Demand received during an active run MUST join that run's promise and MUST NOT queue a follow-up; after completion, the next visible four-second cadence MAY start the next batch. Hidden/unmounted consoles MUST create no demand.
(Previously: a configurable timer polled continuously.)

#### Scenario: Idle is quiet and active demand coalesces
- GIVEN no authenticated visible-console demand, or one run is active
- WHEN time passes or another demand arrives
- THEN idle performs no feed/cursor/projection/database work, and active demand joins without overlap or queue

#### Scenario: Repeated demand drains backlog
- GIVEN more than one producer-bounded batch is retained
- WHEN visible cadences continue after each run completes
- THEN at most one batch starts per cadence and the backlog eventually drains

### Requirement: Durable Cursor Advance [AC5, AC7]
`viewpro-api` MUST replay retained events ascending with existing idempotent writes. `IngestService.ingestBatch` MUST return a discriminated projection/cursor-advance outcome or propagate typed failures; swallowed/logged failures MUST NOT produce success. It MUST advance the cursor only after all returned writes are durable. `lastObservedCursor` MUST equal the durable cursor read at run start and change only after successful cursor advance; projection or cursor-advance failure MUST preserve it. Cursor-read, projection, cursor-advance, feed-timeout, and feed-failure outcomes MUST remain retryable and distinguishable. Payload hardening and DB cancellation remain #329.
(Previously: startup polling retried on a later interval.)

#### Scenario: Failure preserves durable position
- GIVEN cursor 5 and events 6–7 are requested
- WHEN cursor read, feed, projection, or cursor advance fails
- THEN the status identifies that stage, reports no success, preserves `lastObservedCursor`, and later demand resumes from it

#### Scenario: Restart resumes only on demand
- GIVEN cursor 10 when the process restarts
- WHEN later authenticated demand runs
- THEN the feed starts at `since=10` and replay remains ordered/idempotent

### Requirement: Data-Lane Environment Configuration [AC2]
The `apps/api` producer MUST own its safe `PLATFORM_DATA_BATCH_LIMIT`. `viewpro-api` MUST retain required `INMOVIEW_API_INTERNAL_URL` and `PLATFORM_CONTROL_SECRET`, process the returned bounded batch, and MUST NOT require a polling interval or consumer batch-limit setting.
(Previously: consumer configuration included recurring poll and batch settings.)

#### Scenario: Required secret is absent
- GIVEN `PLATFORM_CONTROL_SECRET` is absent
- WHEN `viewpro-api` starts
- THEN startup fails before requests are accepted

## ADDED Requirements
### Requirement: Bounded Feed and Truthful Process Status [AC5–AC6]
Feed HTTP MUST time out within two seconds without cancelling admitted DB work. After restart, process state MUST be `stale` with null observation fields; demand start/join MUST transition it to `updating`. Backend demand MUST race admitted work and return status by four seconds without cancellation. A new run MUST increment `attemptCount`; mapped failure MUST increment `consecutiveFailureCount`, set `failed`, release single-flight, and preserve unfinished cursor. Complete pipeline success MUST reset `consecutiveFailureCount` to zero and update `lastSuccessAt`. A successful non-empty event-bearing batch MUST durably write its projections and advance its cursor within that budget to be normal-path SLO eligible, but MUST remain `updating` until feed head is confirmed; its response MAY be `updating` with successful batch metadata. A later empty feed batch MUST succeed as a no-op confirmation: set `current`, set `lastBatchCount` to `0`, leave the cursor unchanged without requiring cursor advance, reset or maintain the failure count at zero, and update `lastSuccessAt`. Status MUST map `CURSOR_READ_FAILED`, `FEED_TIMEOUT`, `FEED_FAILED`, `PROJECTION_FAILED`, and `CURSOR_ADVANCE_FAILED` without sensitive detail.

#### Scenario: Timeout and later retry
- GIVEN feed HTTP exceeds two seconds
- WHEN it aborts
- THEN status is failed with `FEED_TIMEOUT`, cursor is unchanged, and later demand may retry

#### Scenario: Empty batch is successful no-op
- GIVEN consecutive failures and durable cursor 10
- WHEN the next demand receives an empty feed batch
- THEN status is current with batch count 0, cursor 10 without advance, failure count 0, and an updated success timestamp

### Requirement: Compatibility, Rollback, and Provider Evidence [AC8–AC11]
Before timer/config deletion, merge, or deployment, read-only actual state MUST prove desired and healthy running replica counts equal one, and focused old/new API-web plus rollback evidence MUST pass. Rollback MUST preserve singleton topology, cursor, and outbox. After deployment, each project MUST have ≥24h read-only evidence recording exact start/end, raw CU-hour delta, scheduled activity, no intentional authenticated demand, provider delay, and idle autosuspension. It MUST calculate `projected CU-hours = observed CU-hours × (720 / observation-window hours)` and PASS only at ≤10 CU-hours/project; sub-30-day evidence MUST be labeled projected. #327 MUST remain open until retained implementation and provider evidence pass. Automated gates and full harness remain #329.

#### Scenario: Ordered gate blocks unsafe retirement
- GIVEN timer retirement is proposed
- WHEN topology is unknown/non-singleton or compatibility evidence fails
- THEN timer/config deletion, merge, and deployment are blocked or rolled back

#### Scenario: Closure evidence passes
- GIVEN the implementation is deployed for at least 24 hours
- WHEN normalized provider and retained behavior evidence are reviewed
- THEN each project shows idle autosuspension and projected CU-hours ≤10 before #327 closes
