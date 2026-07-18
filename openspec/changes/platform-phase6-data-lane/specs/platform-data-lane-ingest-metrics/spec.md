# platform-data-lane-ingest-metrics Specification

## Purpose

ViewPro (viewpro-api) data-lane consumer side. Polls InmoView's change-feed,
ingests events idempotently into a `viewpro_platform` mirror table, persists
the poll cursor durably, and exposes an operator-only metrics endpoint served
exclusively from the mirror — never from InmoView's database.

---

## Requirements

### Requirement: Idempotent Mirror Ingest

`viewpro-api` MUST store each ingested outbox event in a mirror table in
`viewpro_platform`. The mirror table MUST enforce `UNIQUE` on the source event
identifier so that ingesting the same event twice results in exactly one row.
A re-delivered event MUST be silently discarded (no error, no duplicate row).

#### Scenario: First ingest stores the event

- GIVEN no mirror row exists for source event id `evt-abc`
- WHEN the ingest job processes an outbox event with id `evt-abc`
- THEN exactly one mirror row exists for `evt-abc`

#### Scenario: Re-delivered event is discarded

- GIVEN a mirror row already exists for source event id `evt-abc`
- WHEN the ingest job processes the same event with id `evt-abc` again (e.g. after a crash-restart)
- THEN the mirror table still contains exactly one row for `evt-abc`
- AND no error is raised

---

### Requirement: Durable Cursor Advance

`viewpro-api` MUST persist the poll cursor to `viewpro_platform` after events
are durably ingested. The cursor MUST only advance once the ingest write is
confirmed. On restart the poller MUST resume from the last persisted cursor
with no gaps and no skips.

#### Scenario: Cursor advances after successful ingest

- GIVEN the persisted cursor is 5 and a batch containing events with seqNo 6 and 7 is ingested
- WHEN ingest completes successfully
- THEN the persisted cursor is 7

#### Scenario: Cursor does not advance if ingest fails

- GIVEN the persisted cursor is 5 and a batch fetch succeeds but the ingest write fails
- WHEN the poller retries on the next interval
- THEN the poll request uses `since=5` (the previous cursor) — no events are skipped

#### Scenario: Restart resumes from persisted cursor

- GIVEN the persisted cursor is 10 when `viewpro-api` is restarted
- WHEN the poller starts after restart
- THEN the first poll request is `GET /internal/platform/changes?since=10`

---

### Requirement: Interval Poll Job

`viewpro-api` MUST run a lightweight interval-based poller that calls
`GET /internal/platform/changes?since=<cursor>` using the existing
`INMOVIEW_API_INTERNAL_URL` and `PLATFORM_CONTROL_SECRET`. The poll interval
MUST be configurable via an environment variable with a safe default. The
poller MUST NOT start a new poll while a previous one is still in flight
(overlap guard).

#### Scenario: Poller uses persisted cursor on each tick

- GIVEN the persisted cursor is 20
- WHEN the poller ticks
- THEN it calls `GET /internal/platform/changes?since=20`

#### Scenario: Overlapping poll is skipped

- GIVEN a poll tick is already in flight
- WHEN the next tick fires
- THEN the new tick is skipped until the in-flight poll completes

#### Scenario: Poll interval is configurable

- GIVEN `PLATFORM_POLL_INTERVAL_MS=5000` is set in the environment
- WHEN the poller runs
- THEN it fires approximately every 5000 ms

---

### Requirement: Metrics Endpoint — Operator-Only Access

`viewpro-api` MUST expose `GET /operators/metrics/summary` protected by the
Phase 4 operator `AuthGuard` (`viewpro_platform_access_token`). Unauthenticated
requests and requests from non-operators MUST be rejected with 401. The
endpoint MUST NOT make any connection or query to InmoView's database.

#### Scenario: Authenticated operator receives metrics

- GIVEN an operator is signed in and presents a valid `viewpro_platform_access_token`
- WHEN `GET /operators/metrics/summary` is called
- THEN the response status is 200
- AND the response body contains a well-formed metrics payload sourced from `viewpro_platform`

#### Scenario: Unauthenticated request is rejected

- GIVEN no `viewpro_platform_access_token` cookie is present
- WHEN `GET /operators/metrics/summary` is called
- THEN the response status is 401

#### Scenario: Metrics reflect an ingested TENANT_STATUS_CHANGED event

- GIVEN a `TENANT_STATUS_CHANGED` event with `newStatus = SUSPENDED` for tenant `t-1` has been ingested into the mirror
- WHEN `GET /operators/metrics/summary` is called by an authenticated operator
- THEN the response reflects that tenant `t-1`'s status is `SUSPENDED`
- AND the aggregate counts are consistent with the mirror data

#### Scenario: InmoView database isolation — metrics served from mirror only

- GIVEN InmoView's database is unreachable or not configured
- WHEN `GET /operators/metrics/summary` is called by an authenticated operator
- THEN the response still returns 200 with metrics sourced from `viewpro_platform`
- AND no connection attempt to InmoView's database occurs

---

### Requirement: Empty-State Metrics

Before any event has been ingested, `GET /operators/metrics/summary` MUST return
a well-formed response with zeroed or empty aggregate values. It MUST NOT return
an error.

#### Scenario: Empty mirror returns well-formed zero result

- GIVEN no events have been ingested into the mirror (empty mirror table)
- WHEN `GET /operators/metrics/summary` is called by an authenticated operator
- THEN the response status is 200
- AND the response body is a valid metrics payload (e.g. total tenant count = 0, empty status breakdown)

---

### Requirement: Data-Lane Environment Configuration

`viewpro-api` MUST reuse `INMOVIEW_API_INTERNAL_URL` and
`PLATFORM_CONTROL_SECRET` (already required by Phase 5). It MUST additionally
accept `PLATFORM_POLL_INTERVAL_MS` and `PLATFORM_DATA_BATCH_LIMIT` with safe
defaults. The app MUST fail to start if either of the shared required variables
is absent.

#### Scenario: Missing shared secret prevents startup

- GIVEN `PLATFORM_CONTROL_SECRET` is not set
- WHEN `viewpro-api` starts
- THEN the process fails with a configuration error before accepting requests

---

## Invariants

- `GET /operators/metrics/summary` MUST query only `viewpro_platform` — never InmoView's database.
- The ingest mirror table MUST enforce `UNIQUE` on source event id at the database level.
- The poll cursor MUST only advance after the ingest write is durably committed.
- The poller MUST NOT issue parallel concurrent poll requests (overlap guard).
- `PLATFORM_CONTROL_SECRET` MUST NOT appear in any response body or server log.
