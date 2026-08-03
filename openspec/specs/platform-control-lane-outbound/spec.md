<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase5-admin-control-lane (delta dated 2026-07-13) -->

# platform-control-lane-outbound Specification

## Purpose

`viewpro-api` operator-facing HTTP endpoints that accept authenticated
operator commands, mint a short-lived HS256 service token, and forward
the command to InmoView's internal control-lane endpoint synchronously.

---

## Requirements

### Requirement: Operator Endpoint Authentication

Operator-facing control-lane endpoints in `viewpro-api` MUST require a
valid operator session via the Phase 4 `AuthGuard`
(`viewpro_platform_access_token`). Unauthenticated or invalid sessions
MUST be rejected.

#### Scenario: Valid operator session passes authentication

- GIVEN an operator is signed in and presents a valid `viewpro_platform_access_token` cookie
- WHEN `PATCH /operators/tenants/:id/status` is called on `viewpro-api`
- THEN the request is forwarded to the control-lane client

#### Scenario: Missing session is rejected

- GIVEN no `viewpro_platform_access_token` cookie is present
- WHEN any operator control-lane endpoint is called
- THEN the response status is 401

#### Scenario: Invalid/expired session is rejected

- GIVEN a `viewpro_platform_access_token` cookie that is expired or invalid
- WHEN any operator control-lane endpoint is called
- THEN the response status is 401

---

### Requirement: Operator Command — Tenant Status

`viewpro-api` MUST expose `PATCH /operators/tenants/:id/status` for setting
tenant status. The endpoint MUST forward `SetTenantStatusCommand` plus a
generated `idempotencyKey` to InmoView's internal endpoint and relay the
response.

#### Scenario: Happy path — operator sets tenant status

- GIVEN an authenticated operator with a valid session
- AND InmoView's internal endpoint is reachable
- WHEN `PATCH /operators/tenants/:id/status` is called with `{ targetStatus: "SUSPENDED" }`
- THEN `viewpro-api` mints a service token and POSTs the command to `INMOVIEW_API_INTERNAL_URL/api/internal/platform/tenants/:id/status`
- AND the operator receives a response reflecting the mutation outcome

#### Scenario: Downstream failure is surfaced

- GIVEN InmoView returns a non-2xx response
- WHEN the operator calls the status endpoint
- THEN `viewpro-api` returns an error response (4xx or 5xx) to the operator

---

### Requirement: Operator Command — Tenant Limits

`viewpro-api` MUST expose `PATCH /operators/tenants/:id/limits` for setting
tenant limits, with the same forwarding pattern as the status command.

#### Scenario: Happy path — operator sets tenant limits

- GIVEN an authenticated operator with a valid session
- WHEN `PATCH /operators/tenants/:id/limits` is called with a valid limits payload
- THEN `viewpro-api` forwards the command to InmoView's internal limits endpoint via a service token
- AND the operator receives a response reflecting the outcome

---

### Requirement: Service Token Minting

`viewpro-api` MUST mint a short-lived HS256 JWT signed with
`PLATFORM_CONTROL_SECRET` for each outbound control-lane request. The
token MUST carry the authenticated operator's `operatorId` as
`PlatformServiceIdentity.callerId`. The token MUST NOT be logged or
persisted. The signing secret MUST be distinct from the operator access
token secret.

#### Scenario: Token carries operator identity

- GIVEN operator `op-1` is authenticated and calls a control-lane endpoint
- WHEN `viewpro-api` mints the service token
- THEN the token payload contains `callerId = "op-1"`
- AND the token is signed with `PLATFORM_CONTROL_SECRET` (not `ACCESS_TOKEN_SECRET`)

#### Scenario: Token does not use the operator JWT secret

- GIVEN a service token minted by `viewpro-api`
- WHEN an attempt is made to verify it with `ACCESS_TOKEN_SECRET`
- THEN verification fails

---

### Requirement: Environment Configuration

`viewpro-api` MUST require `INMOVIEW_API_INTERNAL_URL` and
`PLATFORM_CONTROL_SECRET` in its env schema. The app MUST fail to start
if either is absent.

#### Scenario: Missing env variable prevents startup

- GIVEN `PLATFORM_CONTROL_SECRET` is not set in the environment
- WHEN `viewpro-api` starts
- THEN the process fails with a configuration error before accepting requests

---

### Requirement: Auth Hardening — Login Throttler

The viewpro-api login endpoint MUST throttle requests per client IP.
The throttler MUST key correctly when `viewpro-api` is behind a proxy
(`trust proxy` configured). In production, the `viewpro_platform_access_token`
cookie MUST have `Secure=true`.

#### Scenario: Cookie is Secure in production

- GIVEN `NODE_ENV === 'production'`
- WHEN an operator signs in successfully
- THEN the `Set-Cookie` header for `viewpro_platform_access_token` includes the `Secure` attribute

#### Scenario: Throttler keys per real IP behind proxy

- GIVEN `viewpro-api` is behind a reverse proxy that sets `X-Forwarded-For`
- WHEN multiple login attempts arrive from the same real client IP
- THEN the throttler counts those requests against the same IP bucket

---

## Invariants

- `viewpro-api` MUST NOT hold or cache the service token across requests.
- The service token secret (`PLATFORM_CONTROL_SECRET`) MUST NOT appear in logs.
- `viewpro-api` does NOT write to InmoView's database directly at any point.

---

<!-- Source: openspec/changes/archive/platform-tenant-cancel (delta dated 2026-07-15) -->

## Delta — platform-tenant-cancel

> Requirements below were added by a later change on top of the sections above.
> Where a requirement title repeats, the version in this section is the newer one.

### Delta scope: platform-control-lane-outbound

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
