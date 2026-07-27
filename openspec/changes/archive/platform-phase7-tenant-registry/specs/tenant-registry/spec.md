# tenant-registry Specification

## Purpose

The tenant-registry capability makes every InmoView tenant visible to the
operator console (viewpro-api / viewpro-web) through an event-sourced
projection. A new `TENANT_REGISTERED` outbox event is emitted inside the
tenant-creation transaction; viewpro-api ingests it into a `platform_tenants`
projection table; pre-existing tenants are backfilled once via a service-token-
guarded internal endpoint; and `GET /operators/tenants` serves the full list
exclusively from `viewpro_platform`.

---

## Requirements

### Requirement: Registration Event — Transactional Emit

When a new tenant is created in InmoView, the system MUST emit one
`TENANT_REGISTERED` outbox event **in the same database transaction** as the
user + tenant + membership creation. If the enclosing transaction is rolled
back, NO outbox row MUST be persisted. The event payload MUST carry: `id`,
`name`, `slug`, `newStatus` (the tenant's initial status, e.g. `TRIAL`), and
`limits` (`{ maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb }`).
`newStatus` MUST be present so the event passes the existing mirror W2 guard.

#### Scenario: Successful registration emits one event in-transaction

- GIVEN a valid tenant registration request is received by InmoView
- WHEN `PrismaAuthRegistrationRepository.registerTenant` commits its `$transaction`
- THEN exactly one `platform_outbox_events` row exists with `eventType = TENANT_REGISTERED`
- AND the row payload contains the new tenant's `id`, `name`, `slug`, `newStatus`, and `limits`

#### Scenario: Rolled-back registration leaves no outbox row

- GIVEN a tenant registration whose `$transaction` is aborted (e.g. duplicate slug constraint)
- WHEN the transaction rolls back
- THEN no `platform_outbox_events` row is persisted for that attempt

#### Scenario: Emit does not require an InmoView schema migration

- GIVEN the existing `platform_outbox_events` table is in place (Phase 6)
- WHEN a `TENANT_REGISTERED` row is inserted
- THEN no DDL change to InmoView's database is needed — only new rows are written

---

### Requirement: platform_tenants Projection

`viewpro-api` MUST maintain a `platform_tenants` table in `viewpro_platform`
that stores: `id`, `name`, `slug`, `latestStatus`, `limits`, and `updatedAt`.
The table MUST be created by an additive migration that does not alter existing
tables. Every write to `platform_tenants` MUST be an idempotent upsert keyed on
`id`.

#### Scenario: Ingest of TENANT_REGISTERED upserts a full row

- GIVEN no `platform_tenants` row exists for tenant `t-1`
- WHEN a `TENANT_REGISTERED` event for `t-1` (with name, slug, status, limits) is ingested
- THEN exactly one row exists in `platform_tenants` for `t-1` with all fields populated

#### Scenario: Re-delivery of TENANT_REGISTERED is idempotent

- GIVEN a `platform_tenants` row already exists for tenant `t-1`
- WHEN the same `TENANT_REGISTERED` event for `t-1` is ingested again
- THEN `platform_tenants` still contains exactly one row for `t-1`
- AND no error is raised

#### Scenario: Ingest of TENANT_STATUS_CHANGED updates latestStatus

- GIVEN a `platform_tenants` row exists for tenant `t-1` with `latestStatus = TRIAL`
- WHEN a `TENANT_STATUS_CHANGED` event for `t-1` with `newStatus = ACTIVE` (and optional `name`/`slug`) is ingested
- THEN the row for `t-1` has `latestStatus = ACTIVE`
- AND `name` and `slug` are updated when present in the payload

#### Scenario: Unknown event type does not crash ingest

- GIVEN an outbox event with an unrecognized `eventType` arrives in the change feed
- WHEN the ingest job processes the batch
- THEN the event is skipped without error
- AND the cursor advances past the skipped event

---

### Requirement: Operator Tenant List Endpoint

`viewpro-api` MUST expose `GET /operators/tenants` protected by the Phase 4
operator `AuthGuard`. The endpoint MUST return a paginated response
`{ total, items: [{ id, name, slug, status, limits }] }` sourced exclusively
from `viewpro_platform`. It MUST NOT make any connection to InmoView's database.
Unauthenticated requests MUST be rejected with 401.

#### Scenario: Authenticated operator receives paginated tenant list

- GIVEN three tenants exist in `platform_tenants`
- AND an operator is signed in with a valid `viewpro_platform_access_token`
- WHEN `GET /operators/tenants` is called
- THEN the response status is 200
- AND the body contains `total` and an `items` array with `id`, `name`, `slug`, `status`, and `limits` per tenant

#### Scenario: Unauthenticated request is rejected

- GIVEN no `viewpro_platform_access_token` cookie is present
- WHEN `GET /operators/tenants` is called
- THEN the response status is 401

#### Scenario: Tenant list served with zero InmoView DB reads

- GIVEN InmoView's database is unreachable
- WHEN `GET /operators/tenants` is called by an authenticated operator
- THEN the response returns 200 with data from `viewpro_platform`
- AND no connection attempt to InmoView's database occurs

#### Scenario: Empty registry returns well-formed zero result

- GIVEN no tenants have been registered or backfilled (`platform_tenants` is empty)
- WHEN `GET /operators/tenants` is called by an authenticated operator
- THEN the response status is 200
- AND `total` is 0 and `items` is an empty array

---

### Requirement: Backfill — InmoView Internal Tenants Endpoint

InmoView MUST expose `GET /internal/platform/tenants` protected by the
existing `PlatformControlGuard` (Phase 5 HS256 service token). The endpoint
MUST return all tenants with their `id`, `name`, `slug`, `status`, and `limits`.
Requests without a valid service token MUST be rejected with 401.

#### Scenario: Valid service token returns all tenants

- GIVEN InmoView has three existing tenants and a valid service token is presented
- WHEN `GET /internal/platform/tenants` is called
- THEN the response body lists all three tenants with `id`, `name`, `slug`, `status`, and `limits`

#### Scenario: Missing or invalid service token is rejected

- GIVEN a request to `GET /internal/platform/tenants` with no or invalid `Authorization`
- WHEN `PlatformControlGuard` evaluates the request
- THEN the response status is 401

---

### Requirement: Backfill — Idempotent Seed

`viewpro-api` MUST provide a one-time idempotent backfill mechanism that calls
`GET /internal/platform/tenants`, then upserts each returned tenant into
`platform_tenants` keyed on `id`. Running the backfill multiple times MUST NOT
produce duplicate rows.

#### Scenario: First backfill run populates all pre-existing tenants

- GIVEN `platform_tenants` is empty and InmoView has two pre-existing tenants
- WHEN the backfill seed is executed
- THEN both tenants appear as rows in `platform_tenants` with all fields populated

#### Scenario: Re-running backfill is idempotent

- GIVEN the backfill has already been run and `platform_tenants` has two rows
- WHEN the backfill seed is executed again
- THEN `platform_tenants` still contains exactly two rows — no duplicates

---

## Invariants

- `GET /operators/tenants` MUST query only `viewpro_platform` — never InmoView's database.
- All writes to `platform_tenants` MUST be upserts keyed on `id`.
- `TENANT_REGISTERED` MUST be emitted inside the same `$transaction` as the tenant creation — never in a separate round-trip.
- `GET /internal/platform/tenants` MUST NOT be reachable without a valid service token.
- No InmoView schema migration is required — only new `platform_outbox_events` rows.
