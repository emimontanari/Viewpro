<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase6-data-lane (delta dated 2026-07-14) -->

# platform-data-lane-outbox Specification

## Purpose

InmoView (apps/api) change-feed publisher. Provides a dedicated outbox table
written transactionally with every domain mutation, and a service-token-guarded
HTTP endpoint that lets ViewPro poll events since a given cursor.

---

## Requirements

### Requirement: Transactional Outbox Write

When a tenant status change is committed, `apps/api` MUST write one
`platform_outbox_events` row in the SAME database transaction as the domain
mutation. If the domain transaction is rolled back, NO outbox row MUST be
persisted (delivery ⇔ commit guarantee).

#### Scenario: Status change commits outbox row in same transaction

- GIVEN a tenant exists with status `ACTIVE`
- WHEN `PrismaAdminTenantStatusRepository.updateTenantStatus` runs inside its `$transaction` and the transaction commits
- THEN exactly one `platform_outbox_events` row exists for that mutation
- AND the row carries `eventType = TENANT_STATUS_CHANGED`, the correct `tenantId`, and `payload` with `previousStatus` and `newStatus`

#### Scenario: Rolled-back domain transaction leaves no outbox row

- GIVEN a tenant status update that causes the database transaction to roll back (e.g. constraint violation)
- WHEN the `$transaction` is aborted
- THEN no `platform_outbox_events` row is persisted for that mutation

---

### Requirement: Outbox Schema

The `apps/api` database MUST contain a `platform_outbox_events` table added by
a live, additive migration. The table MUST include: a UUID primary key, a
BIGSERIAL `seqNo` column providing strict monotonic total order, `eventType`,
`tenantId`, a JSONB `payload`, and `occurredAt`. Existing tables MUST NOT be
altered.

#### Scenario: Migration is additive — existing data is unaffected

- GIVEN the migration is applied to a live InmoView database
- WHEN existing tenant and analytics rows are inspected after migration
- THEN all pre-existing rows are intact and no columns have been removed or altered

#### Scenario: seqNo provides total order across millisecond-identical timestamps

- GIVEN two outbox events that are assigned the same `occurredAt` millisecond
- WHEN both rows are inserted
- THEN each row receives a distinct `seqNo` value and can be ordered deterministically by `seqNo`

---

### Requirement: Change-Feed Endpoint

`apps/api` MUST expose `GET /internal/platform/changes?since=<cursor>` protected
by the existing `PlatformControlGuard` (Phase 5 HS256 service token). The
endpoint MUST return a bounded batch of outbox events with `seqNo` strictly
greater than `cursor`, ordered by `seqNo` ascending, plus a `nextCursor` value.
The `nextCursor` MUST equal the highest `seqNo` in the returned batch, or equal
`cursor` when the batch is empty.

#### Scenario: Valid token with cursor returns events in order

- GIVEN three outbox events with seqNo 1, 2, 3 exist
- AND a valid service token is presented
- WHEN `GET /internal/platform/changes?since=0` is called
- THEN the response body contains all three events in ascending seqNo order
- AND `nextCursor` equals 3

#### Scenario: Cursor excludes already-seen events

- GIVEN events with seqNo 1, 2, 3 exist and the consumer last received seqNo 2
- WHEN `GET /internal/platform/changes?since=2` is called with a valid service token
- THEN only the event with seqNo 3 is returned
- AND `nextCursor` equals 3

#### Scenario: Empty result when no new events

- GIVEN the consumer's cursor equals the highest seqNo in the table
- WHEN `GET /internal/platform/changes?since=<cursor>` is called
- THEN the response body contains an empty events array
- AND `nextCursor` equals the supplied `cursor`

#### Scenario: Batch is bounded

- GIVEN more events exist than the server batch limit
- WHEN `GET /internal/platform/changes?since=0` is called
- THEN the response contains at most `batch_limit` events
- AND `nextCursor` is less than the highest seqNo in the table

#### Scenario: Missing or invalid service token is rejected

- GIVEN a request to `GET /internal/platform/changes?since=0` with no `Authorization` header or an expired/wrong-secret token
- WHEN `PlatformControlGuard` evaluates the request
- THEN the response status is 401

#### Scenario: Millisecond-collision events are both delivered

- GIVEN two events share the same `occurredAt` but have distinct `seqNo` values N and N+1
- WHEN `GET /internal/platform/changes?since=<N-1>` is called
- THEN both events appear in the response

---

### Requirement: Change-Feed Environment Configuration

`apps/api` MUST accept a configurable batch limit via an environment variable.
The app MUST apply a safe default when the variable is absent.

#### Scenario: Batch limit is configurable

- GIVEN `PLATFORM_DATA_BATCH_LIMIT=5` is set in the environment
- WHEN the change-feed endpoint is called with more than 5 pending events
- THEN at most 5 events are returned per response

---

## Invariants

- The outbox row MUST be written inside the same `$transaction` as the domain write — never in a separate round-trip.
- `GET /internal/platform/changes` is a READ-ONLY endpoint; it MUST NOT mutate any outbox row.
- `PLATFORM_CONTROL_SECRET` MUST NOT appear in any response body or server log.
- The change-feed endpoint MUST NOT be reachable without a valid service token.
