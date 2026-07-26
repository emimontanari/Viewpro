<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-audit-log (delta dated 2026-07-15) -->

# platform-audit-log Specification

## Purpose

The platform-audit-log capability makes every platform mutation (tenant
status changes today, limits changes today, and future cancel/role/plan
mutations without further contract changes) visible to the operator as a
global, chronological trail — **who / what / when / old→new**. A single
generic `AUDIT_LOGGED` outbox event is emitted inside the same transaction
as the mutation; viewpro-api ingests it into an append-only
`platform_audit_log` projection; `GET /operators/audit` serves a
newest-first paginated feed exclusively from `viewpro_platform`; and
viewpro-web renders the feed as a global, chronological view across all
tenants.

---

## Requirements

### Requirement: Status Change Audit Event — Transactional Emit

When InmoView commits a tenant status mutation that actually changes the
status, `PrismaAdminTenantStatusRepository.updateTenantStatus` MUST emit
exactly one `AUDIT_LOGGED` outbox event **in the same database transaction**
as the status mutation, in addition to its existing `TENANT_STATUS_CHANGED`
emit. The `AUDIT_LOGGED` payload's `action` MUST be
`'TENANT_STATUS_CHANGED'`, `previousValue`/`newValue` MUST carry the
previous and new status, and `actor` MUST identify who performed the
change. If the enclosing transaction is rolled back, NO `AUDIT_LOGGED` row
MUST be persisted.

#### Scenario: Status change emits exactly one AUDIT_LOGGED event in-transaction

- GIVEN a tenant exists with status `TRIAL`
- WHEN `PrismaAdminTenantStatusRepository.updateTenantStatus` changes its status to `ACTIVE` and the `$transaction` commits
- THEN exactly one `platform_outbox_events` row exists with `eventType = AUDIT_LOGGED`
- AND its payload has `action = 'TENANT_STATUS_CHANGED'`, `previousValue` reflecting `TRIAL`, `newValue` reflecting `ACTIVE`, and the acting `actor`

#### Scenario: TENANT_STATUS_CHANGED emit is unaffected (regression)

- GIVEN the same status-change transaction as above
- WHEN it commits
- THEN a `TENANT_STATUS_CHANGED` `platform_outbox_events` row is also present, exactly as before this change — the tenant-registry projection continues to work unmodified

#### Scenario: Rolled-back status change leaves no AUDIT_LOGGED row

- GIVEN a tenant status update whose `$transaction` is aborted (e.g. a constraint violation)
- WHEN the transaction rolls back
- THEN no `AUDIT_LOGGED` row is persisted for that attempt

---

### Requirement: Limits Change Audit Event — Transactional Emit

When InmoView commits a tenant limits mutation that actually changes the
limits, `PrismaAdminTenantLimitsRepository.updateTenantLimits` MUST emit
exactly one `AUDIT_LOGGED` outbox event **in the same database transaction**
as the limits mutation (this is limits' first-ever outbox emit — today it
emits nothing to the outbox). The payload's `action` MUST be
`'TENANT_LIMITS_UPDATED'`, `previousValue`/`newValue` MUST carry the
previous and new limits object, and `actor` MUST identify who performed the
change. If the enclosing transaction is rolled back, NO `AUDIT_LOGGED` row
MUST be persisted.

#### Scenario: Limits change emits exactly one AUDIT_LOGGED event in-transaction

- GIVEN a tenant exists with `maxUsers = 10`
- WHEN `PrismaAdminTenantLimitsRepository.updateTenantLimits` changes `maxUsers` to `25` and the `$transaction` commits
- THEN exactly one `platform_outbox_events` row exists with `eventType = AUDIT_LOGGED`
- AND its payload has `action = 'TENANT_LIMITS_UPDATED'`, `previousValue` reflecting the prior limits, `newValue` reflecting the updated limits, and the acting `actor`

#### Scenario: Rolled-back limits change leaves no AUDIT_LOGGED row

- GIVEN a tenant limits update whose `$transaction` is aborted (e.g. a constraint violation)
- WHEN the transaction rolls back
- THEN no `AUDIT_LOGGED` row is persisted for that attempt

---

### Requirement: Audit Actor Identity Carries a Display Label In-Payload

Every `AUDIT_LOGGED` event's `actor` MUST be `{ id, type, label }`, where
`type` distinguishes a platform operator from an InmoView product user
(mirroring the existing `CommandActor` discriminated union), `id` is the
operator's or user's identifier, and `label` is a human-readable display
name resolved by the emitting side (InmoView) and embedded directly in the
payload. Consumers (viewpro-api, viewpro-web) MUST NOT perform a cross-DB
lookup to resolve the actor's display name — the label travels with the
event.

#### Scenario: Operator-driven change records actor.type = 'operator'

- GIVEN a platform operator changes a tenant's status via the control lane
- WHEN the `AUDIT_LOGGED` event is emitted
- THEN `actor.type = 'operator'`, `actor.id` is the operator's id, and `actor.label` is a non-empty display name

#### Scenario: Product-user-driven change records actor.type = 'user'

- GIVEN an InmoView admin user changes a tenant's limits via the `/admin` route
- WHEN the `AUDIT_LOGGED` event is emitted
- THEN `actor.type = 'user'`, `actor.id` is the user's id, and `actor.label` is a non-empty display name

#### Scenario: viewpro-api never resolves actor identity via a second lookup

- GIVEN an `AUDIT_LOGGED` event has been ingested into `platform_audit_log`
- WHEN `GET /operators/audit` serves that row
- THEN the returned `actor` is read verbatim from the stored row — no query against InmoView's database or any other identity source occurs

---

### Requirement: platform_audit_log Append-Only Projection

`viewpro-api` MUST maintain an append-only `platform_audit_log` table in
`viewpro_platform` with columns `id`, `sourceEventId` (unique), `action`,
`tenantId`, `actor` (Json), `previousValue` (Json), `newValue` (Json),
`occurredAt`, and `seqNo`. The table MUST be created by an additive
migration that does not alter existing tables. Insertion MUST be idempotent
on `sourceEventId`: re-delivery of the same `AUDIT_LOGGED` event MUST NOT
create a second row. `platform_audit_log`'s own `sourceEventId` unique
constraint is the SOLE durability/replay-dedup mechanism for `AUDIT_LOGGED`
— `AUDIT_LOGGED` is never written to `platform_mirror_events` (see the
`platform-data-lane` delta), so the mirror's dedup plays no role here.

#### Scenario: Ingest of AUDIT_LOGGED creates one row

- GIVEN no `platform_audit_log` row exists for a given `sourceEventId`
- WHEN an `AUDIT_LOGGED` event with that `sourceEventId` is ingested
- THEN exactly one row exists in `platform_audit_log` with `action`, `tenantId`, `actor`, `previousValue`, `newValue`, `occurredAt`, and `seqNo` populated from the event

#### Scenario: Re-delivery of the same event is idempotent

- GIVEN a `platform_audit_log` row already exists for `sourceEventId = evt-1`
- WHEN the same `AUDIT_LOGGED` event (`sourceEventId = evt-1`) is ingested again
- THEN `platform_audit_log` still contains exactly one row for `evt-1`
- AND no error is raised

---

### Requirement: Operator Audit Feed Endpoint

`viewpro-api` MUST expose `GET /operators/audit` protected by the operator
`AuthGuard`. It MUST accept `offset`/`limit` query params (default `limit`
50, capped at 200) and return items sorted newest-first by `seqNo`
descending. The response body MUST be
`{ total, items: [{ id, action, tenantId, actor, previousValue, newValue, occurredAt, seqNo }] }`,
sourced exclusively from `viewpro_platform`. The endpoint MUST NOT accept
a per-tenant filter parameter — it serves a single global feed only.
Unauthenticated requests MUST be rejected with 401.

#### Scenario: Authenticated operator receives a newest-first paginated feed

- GIVEN three `AUDIT_LOGGED` events have been ingested with increasing `seqNo`
- AND an operator is signed in with a valid `viewpro_platform_access_token`
- WHEN `GET /operators/audit` is called
- THEN the response status is 200
- AND `items` is ordered by `seqNo` descending (the most recent event first)
- AND each item contains `id`, `action`, `tenantId`, `actor`, `previousValue`, `newValue`, `occurredAt`, and `seqNo`

#### Scenario: Pagination defaults and cap are enforced

- GIVEN 250 rows exist in `platform_audit_log`
- WHEN `GET /operators/audit` is called with no `limit` query param
- THEN at most 50 items are returned
- WHEN `GET /operators/audit` is called with `limit=1000`
- THEN at most 200 items are returned (the cap)

#### Scenario: Empty feed returns a well-formed zero result

- GIVEN `platform_audit_log` is empty
- WHEN `GET /operators/audit` is called by an authenticated operator
- THEN the response status is 200
- AND `total` is 0 and `items` is an empty array

#### Scenario: Unauthenticated request is rejected

- GIVEN no `viewpro_platform_access_token` cookie is present
- WHEN `GET /operators/audit` is called
- THEN the response status is 401

#### Scenario: Feed served with zero InmoView DB reads

- GIVEN InmoView's database is unreachable
- WHEN `GET /operators/audit` is called by an authenticated operator
- THEN the response returns 200 with data from `viewpro_platform` only
- AND no connection attempt to InmoView's database occurs

---

### Requirement: viewpro-web Global Audit Feed

`viewpro-web` MUST provide a `features/audit` feature rendering a single
global, paginated, chronological audit feed (not per-tenant), following the
established `api/{types,schemas,service,queries}.ts` + components split
used by `features/tenants`. Each row MUST display the actor, the action,
the target tenant, the timestamp, and the old→new value change. The route
MUST be gated behind authentication, and the fetched response MUST be
defensively parsed (zod) before rendering.

#### Scenario: Feed renders fetched audit rows

- GIVEN the audit endpoint returns three items (varying actor, action, tenant, timestamp, previous/new value)
- WHEN the audit feature mounts
- THEN three rows are rendered, each showing its actor, action, target tenant, timestamp, and old→new values

#### Scenario: Pagination controls request the next page

- GIVEN the feed shows the first page of results and more pages exist
- WHEN the operator triggers the next-page control
- THEN a request for the next `offset` is issued and the returned rows replace/append the displayed list

#### Scenario: Loading state is shown while fetching

- GIVEN the audit request has not yet resolved
- WHEN the feature renders
- THEN a loading indicator is shown instead of the (not yet available) rows

#### Scenario: Empty state is shown when there are no events

- GIVEN the audit endpoint returns `{ total: 0, items: [] }`
- WHEN the feature renders
- THEN an empty-state message is shown instead of a table

#### Scenario: Error state is shown on fetch failure

- GIVEN the audit request fails (network error or non-2xx response)
- WHEN the feature renders
- THEN an error message is shown instead of a table, and no unhandled exception is thrown

---

## Invariants

- `GET /operators/audit` MUST query only `viewpro_platform` — never InmoView's database.
- `AUDIT_LOGGED` MUST be emitted inside the SAME `$transaction` as the status or limits mutation — never in a separate round-trip.
- `platform_audit_log` inserts MUST be idempotent on `sourceEventId`.
- `actor.label` MUST travel in-payload — no consumer-side cross-DB identity lookup is ever performed.
- `GET /operators/audit` MUST NOT accept a per-tenant filter — the feed is global only.
- No InmoView schema migration is required — only new `platform_outbox_events` rows.
