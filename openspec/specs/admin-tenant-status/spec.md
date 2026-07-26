<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-tenant-cancel (delta dated 2026-07-15) -->

### Delta scope: admin-tenant-status

## Context

`AdminTenantStatusService` (`apps/api/src/admin/admin-tenant-status.service.ts`)
is the single authoritative domain gate shared by both InmoView-side status
write paths — `PATCH /admin/tenants/:tenantId/status` (product-user actor) and
`POST /internal/platform/tenants/:tenantId/status` (operator actor via the
control lane). Today `ALLOWED_TARGET_STATUSES = {ACTIVE, SUSPENDED}` and there
is no check on the tenant's *current* status before applying a target — any
non-`notFound` tenant can move between `ACTIVE` and `SUSPENDED` freely. This
delta (1) widens the allowed target set to include `CANCELLED`, and (2)
introduces a genuinely new invariant: `CANCELLED` is terminal, enforced
server-side.

---

## MODIFIED Requirements

### Requirement: Writable-Target Status Policy

`AdminTenantStatusService` MUST accept `ACTIVE`, `SUSPENDED`, and `CANCELLED`
as valid `targetStatus` values (previously only `ACTIVE` and `SUSPENDED`). A
tenant in any non-terminal state (`ACTIVE`, `SUSPENDED`, or `TRIAL`) MUST be
transitionable directly to `CANCELLED` — no forced intermediate `SUSPENDED`
step is required. A successful transition to `CANCELLED` MUST reuse the
existing status-change transaction, which emits exactly one
`TENANT_STATUS_CHANGED` outbox event (`previousStatus` → `newStatus:
CANCELLED`) and exactly one `AUDIT_LOGGED` event (`action:
TENANT_STATUS_CHANGED`) — no new emission code path.

#### Scenario: Cancel from ACTIVE succeeds and is emitted once

- GIVEN a tenant with status `ACTIVE`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: CANCELLED`
- THEN the call succeeds (200 at the HTTP layer), the tenant's status becomes `CANCELLED`
- AND exactly one `TENANT_STATUS_CHANGED` outbox event is emitted with `previousValue: ACTIVE`, `newValue: CANCELLED`
- AND exactly one `AUDIT_LOGGED` event is emitted with `action: TENANT_STATUS_CHANGED`

#### Scenario: Cancel from SUSPENDED succeeds and is emitted once

- GIVEN a tenant with status `SUSPENDED`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: CANCELLED`
- THEN the call succeeds, the tenant's status becomes `CANCELLED`
- AND exactly one `TENANT_STATUS_CHANGED` event (`SUSPENDED` → `CANCELLED`) and one `AUDIT_LOGGED` event are emitted

#### Scenario: Cancel from TRIAL succeeds and is emitted once

- GIVEN a tenant with status `TRIAL`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: CANCELLED`
- THEN the call succeeds, the tenant's status becomes `CANCELLED`
- AND exactly one `TENANT_STATUS_CHANGED` event (`TRIAL` → `CANCELLED`) and one `AUDIT_LOGGED` event are emitted

#### Scenario: ACTIVE → SUSPENDED still succeeds (regression)

- GIVEN a tenant with status `ACTIVE`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: SUSPENDED`
- THEN the call succeeds exactly as before this change, with the existing single `TENANT_STATUS_CHANGED` + `AUDIT_LOGGED` emission

#### Scenario: SUSPENDED → ACTIVE still succeeds (regression)

- GIVEN a tenant with status `SUSPENDED`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: ACTIVE`
- THEN the call succeeds exactly as before this change

---

## ADDED Requirements

### Requirement: CANCELLED Is Terminal — Server-Side Enforcement

`AdminTenantStatusService` MUST reject any status-change call where the
tenant's *current* status is already `CANCELLED`, regardless of the
requested `targetStatus` — including a same-value `CANCELLED → CANCELLED`
call, which does NOT fall back to the existing "unchanged" short-circuit.
The rejection MUST be a `BadRequestException` (400), MUST occur before any
database write, and MUST NOT emit any `TENANT_STATUS_CHANGED` or
`AUDIT_LOGGED` event. This is new behavior: prior to this change no
current-status validation existed at all.

#### Scenario: CANCELLED → ACTIVE is rejected

- GIVEN a tenant with status `CANCELLED`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: ACTIVE`
- THEN the call is rejected with a 400 `BadRequestException`
- AND the tenant's status remains `CANCELLED`
- AND no `TENANT_STATUS_CHANGED` or `AUDIT_LOGGED` event is emitted

#### Scenario: CANCELLED → SUSPENDED is rejected

- GIVEN a tenant with status `CANCELLED`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: SUSPENDED`
- THEN the call is rejected with a 400 `BadRequestException`
- AND the tenant's status remains `CANCELLED`
- AND no outbox or audit event is emitted

#### Scenario: CANCELLED → CANCELLED is rejected (not treated as unchanged)

- GIVEN a tenant with status `CANCELLED`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: CANCELLED`
- THEN the call is rejected with a 400 `BadRequestException`
- AND no `TENANT_STATUS_CHANGED` or `AUDIT_LOGGED` event is emitted
- AND the response is NOT the existing `unchanged: true` success shape

---

### Requirement: Same-Status Idempotency Unaffected for Non-Terminal Tenants

For any tenant whose *current* status is `ACTIVE`, `SUSPENDED`, or `TRIAL`
(i.e. NOT `CANCELLED`), setting `targetStatus` to that same current value
MUST continue to short-circuit to the existing `unchanged: true` response —
no mutation, no new `TENANT_STATUS_CHANGED`/`AUDIT_LOGGED` event, exactly as
before this change.

#### Scenario: ACTIVE tenant set to ACTIVE remains a no-op

- GIVEN a tenant with status `ACTIVE`
- WHEN `AdminTenantStatusService.updateTenantStatus` is called with `targetStatus: ACTIVE`
- THEN the call succeeds with `unchanged: true`
- AND no new `TENANT_STATUS_CHANGED` or `AUDIT_LOGGED` event is emitted

---

### Requirement: Downstream Effects of a Cancel Are Verified, Not Reimplemented

The following downstream behaviors already handle `CANCELLED` generically and
require no code change in this capability; this delta adds coverage that
confirms they hold once `CANCELLED` becomes reachable through the write path.

- `tenant-membership.guard.ts` already blocks members of a `SUSPENDED` OR
  `CANCELLED` tenant identically with `ForbiddenException('Tenant is not
  active')`.
- The `platform_tenants` projection ingest and the `byStatus` metrics bucket
  handle any status string generically (no special-casing).

#### Scenario: Members of a newly-CANCELLED tenant are blocked

- GIVEN a tenant was just transitioned to `CANCELLED`
- AND a user holds an active membership in that tenant
- WHEN that user makes a request to a route protected by `TenantMembershipGuard`
- THEN the request is rejected with 403 `Tenant is not active`

#### Scenario: platform_tenants projection reflects the CANCELLED status

- GIVEN a tenant was transitioned to `CANCELLED` and its `TENANT_STATUS_CHANGED` event was ingested
- WHEN `platform_tenants` is queried for that tenant
- THEN `latestStatus` is `CANCELLED`

#### Scenario: Metrics byStatus bucket includes CANCELLED

- GIVEN one or more tenants have `latestStatus: CANCELLED` in `platform_tenants`
- WHEN the operator metrics summary is computed
- THEN the `byStatus` breakdown includes a `CANCELLED` bucket with the correct count

---

## Out of Scope (Note, Not a Requirement)

The legacy `apps/app-new/src/app/admin` console is untouched by this change.
It remains capped at `ACTIVE`/`SUSPENDED` in its own UI, and its DTOs
(`@IsEnum(TenantStatus)`) already accepted `CANCELLED` before this change —
they simply had no UI path to send it, and now route through the same
`AdminTenantStatusService` gate this delta modifies. No task in this change
touches `apps/app-new`.

---

## Invariants

- `ALLOWED_TARGET_STATUSES` is `{ACTIVE, SUSPENDED, CANCELLED}` — `TRIAL` is
  still not a settable target via this write path (unchanged; `TRIAL` is an
  initial-only status).
- Any call whose current tenant status is `CANCELLED` MUST be rejected with
  400 before any database write, for every target status, with zero
  exceptions.
- A rejected terminality call MUST NOT emit `TENANT_STATUS_CHANGED` or
  `AUDIT_LOGGED`.
- No data archival or deletion occurs as part of a cancel — status transition
  and access-cut only.
