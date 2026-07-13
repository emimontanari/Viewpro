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
- WHEN `POST /platform/tenants/:id/status` is called on `viewpro-api`
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

`viewpro-api` MUST expose `POST /platform/tenants/:id/status` for setting
tenant status. The endpoint MUST forward `SetTenantStatusCommand` plus a
generated `idempotencyKey` to InmoView's internal endpoint and relay the
response.

#### Scenario: Happy path — operator sets tenant status

- GIVEN an authenticated operator with a valid session
- AND InmoView's internal endpoint is reachable
- WHEN `POST /platform/tenants/:id/status` is called with `{ targetStatus: "SUSPENDED" }`
- THEN `viewpro-api` mints a service token and POSTs the command to `INMOVIEW_API_INTERNAL_URL/internal/platform/tenants/:id/status`
- AND the operator receives a response reflecting the mutation outcome

#### Scenario: Downstream failure is surfaced

- GIVEN InmoView returns a non-2xx response
- WHEN the operator calls the status endpoint
- THEN `viewpro-api` returns an error response (4xx or 5xx) to the operator

---

### Requirement: Operator Command — Tenant Limits

`viewpro-api` MUST expose `POST /platform/tenants/:id/limits` for setting
tenant limits, with the same forwarding pattern as the status command.

#### Scenario: Happy path — operator sets tenant limits

- GIVEN an authenticated operator with a valid session
- WHEN `POST /platform/tenants/:id/limits` is called with a valid limits payload
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
