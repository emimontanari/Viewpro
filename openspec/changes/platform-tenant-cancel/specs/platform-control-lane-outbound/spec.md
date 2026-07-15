# Delta for platform-control-lane-outbound

## Context

`SetTenantStatusDto` (`apps/viewpro-api/src/platform-control/dto/set-tenant-
status.dto.ts`) is the local `viewpro-api` guard on
`PATCH /operators/tenants/:id/status` — it currently accepts only `ACTIVE`
and `SUSPENDED` (`@IsIn(['ACTIVE', 'SUSPENDED'])`) because those were the only
two targets `AdminTenantStatusService` supported. With `CANCELLED` now a
valid target in `admin-tenant-status`, this DTO must widen in lockstep so the
operator can reach it — otherwise `viewpro-api` would reject a valid
`CANCELLED` command locally before it ever reaches InmoView.

---

## MODIFIED Requirements

### Requirement: Operator Command — Tenant Status

`SetTenantStatusDto.status` MUST accept `'ACTIVE' | 'SUSPENDED' |
'CANCELLED'` (previously `'ACTIVE' | 'SUSPENDED'` only). Any value outside
this set MUST continue to be rejected locally with 400 before any service
token is minted and before any outbound call to InmoView. Accepted values
MUST be forwarded unchanged as `SetTenantStatusCommand.targetStatus` to
`POST /internal/platform/tenants/:id/status`, and the endpoint's docstring
MUST be updated to reflect the widened set.

#### Scenario: Operator PATCHes status=CANCELLED and it is forwarded

- GIVEN an authenticated operator with a valid session
- AND InmoView's internal endpoint is reachable
- WHEN `PATCH /operators/tenants/:id/status` is called with `{ status: 'CANCELLED' }`
- THEN `viewpro-api` mints a service token and forwards `targetStatus: 'CANCELLED'` to `POST /internal/platform/tenants/:id/status`
- AND the operator receives InmoView's response reflecting the outcome

#### Scenario: Unsupported status value is still rejected locally (regression)

- GIVEN an authenticated operator with a valid session
- WHEN `PATCH /operators/tenants/:id/status` is called with `{ status: 'TRIAL' }` (or any value outside `{ACTIVE, SUSPENDED, CANCELLED}`)
- THEN `viewpro-api` rejects the request with 400 before minting a service token
- AND no outbound call to InmoView is made

#### Scenario: ACTIVE and SUSPENDED targets continue to forward unchanged (regression)

- GIVEN an authenticated operator with a valid session
- WHEN `PATCH /operators/tenants/:id/status` is called with `{ status: 'SUSPENDED' }` or `{ status: 'ACTIVE' }`
- THEN `viewpro-api` forwards the command exactly as it did before this change

---

## ADDED Requirements

### Requirement: Terminality Rejection Is Relayed Unchanged

When InmoView's `POST /internal/platform/tenants/:id/status` rejects a
command with 400 because the tenant is already `CANCELLED` (terminality),
`viewpro-api` MUST relay that 400 response to the operator via the existing
generic downstream-failure forwarding — no special-casing, no additional
retry, no mutation to `platform_tenants`.

#### Scenario: A CANCELLED tenant's status PATCH surfaces InmoView's 400

- GIVEN a tenant is already `CANCELLED`
- AND an authenticated operator calls `PATCH /operators/tenants/:id/status` with any `status` value
- WHEN InmoView's internal endpoint responds 400 (terminality rejection)
- THEN `viewpro-api` relays a 400 response to the operator
- AND `platform_tenants` is not mutated for that call

---

## Invariants

- `SetTenantStatusDto.status` validates against exactly `{ACTIVE, SUSPENDED,
  CANCELLED}`; anything else is rejected with 400 before a service token is
  minted or any outbound call is made (unchanged principle, widened set).
- `viewpro-api` never special-cases the terminality 400 — it is relayed like
  any other downstream failure.
