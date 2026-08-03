# Delta for platform-data-lane

## ADDED Requirements

### Requirement: TENANT_REGISTERED Event Type

The `PlatformOutboxEvent.eventType` union in `platform-contract` MUST be widened
to include `TENANT_REGISTERED` alongside `TENANT_STATUS_CHANGED`. The
`PlatformOutboxWriter` input type MUST accept either event type so both can be
emitted from InmoView without a separate code path.

#### Scenario: Contract accepts TENANT_REGISTERED as a valid eventType

- GIVEN the platform-contract package is updated with the union type
- WHEN code attempts to construct a `TENANT_REGISTERED` outbox event input
- THEN the TypeScript compiler accepts the type without error

#### Scenario: Contract continues to accept TENANT_STATUS_CHANGED

- GIVEN the platform-contract package is updated
- WHEN code constructs a `TENANT_STATUS_CHANGED` outbox event input
- THEN the TypeScript compiler accepts it — backward compatibility is preserved

---

### Requirement: Ingest Event-Type Routing

The viewpro-api ingest job MUST branch on `eventType` before writing to
`platform_tenants`:

- `TENANT_REGISTERED` → upsert full identity + limits into `platform_tenants`
- `TENANT_STATUS_CHANGED` → update `latestStatus` (and `name`/`slug` when present) in `platform_tenants`
- Any other `eventType` → skip without error

The existing `platform_mirror_events` append MUST continue to execute for every
ingested event regardless of `eventType`, so metrics remain unaffected.

#### Scenario: Both event types append to platform_mirror_events

- GIVEN one `TENANT_REGISTERED` event and one `TENANT_STATUS_CHANGED` event are ingested
- WHEN the ingest job processes both events
- THEN two rows exist in `platform_mirror_events` (one per event)
- AND the metrics summary reflects both events

#### Scenario: Routing does not affect cursor or mirror_events on unknown type

- GIVEN an event with `eventType = UNKNOWN_FUTURE_TYPE` arrives
- WHEN the ingest job processes it
- THEN the event is skipped for `platform_tenants` routing
- AND one row is still appended to `platform_mirror_events`
- AND the cursor advances past the event

---

## MODIFIED Requirements

### Requirement: Transactional Outbox Write

When a tenant status change is committed, `apps/api` MUST write one
`platform_outbox_events` row in the SAME database transaction as the domain
mutation. If the domain transaction is rolled back, NO outbox row MUST be
persisted (delivery ⇔ commit guarantee). The `TENANT_STATUS_CHANGED` payload
MUST now also carry `name` and `slug` in addition to `previousStatus` and
`newStatus` (additive enrichment — no payload fields removed).

(Previously: payload carried only `previousStatus` and `newStatus`; `name`
and `slug` were absent.)

#### Scenario: Status change commits outbox row in same transaction

- GIVEN a tenant exists with status `ACTIVE`
- WHEN `PrismaAdminTenantStatusRepository.updateTenantStatus` runs inside its `$transaction` and the transaction commits
- THEN exactly one `platform_outbox_events` row exists for that mutation
- AND the row carries `eventType = TENANT_STATUS_CHANGED`, the correct `tenantId`, and `payload` with `previousStatus`, `newStatus`, `name`, and `slug`

#### Scenario: Rolled-back domain transaction leaves no outbox row

- GIVEN a tenant status update that causes the database transaction to roll back (e.g. constraint violation)
- WHEN the `$transaction` is aborted
- THEN no `platform_outbox_events` row is persisted for that mutation

#### Scenario: name and slug are read from the tenant row in the same transaction

- GIVEN a tenant with `name = "Acme"` and `slug = "acme"` has its status changed
- WHEN the status-change `$transaction` commits
- THEN the `TENANT_STATUS_CHANGED` outbox row payload includes `name = "Acme"` and `slug = "acme"`
