# platform-control-lane-inbound Specification

## Purpose

`apps/api` (InmoView) service-token-guarded internal WRITE endpoints.
Accepts platform commands from `viewpro-api` over a separate trust path,
applies tenant status and limits mutations transactionally, records the
operator as audit actor, and enforces idempotency.

---

## Requirements

### Requirement: PlatformControlGuard — Service Token Verification

The system MUST verify incoming requests to `/internal/platform/**` using
a dedicated `PlatformControlGuard` that validates the HS256 JWT signed
with `PLATFORM_CONTROL_SECRET`. A valid token MUST populate
`request.platformCaller` (`PlatformServiceIdentity`) and MUST NOT touch
`request.user`.

#### Scenario: Valid service token is accepted

- GIVEN a request to `POST /internal/platform/tenants/:id/status` carrying a valid, non-expired HS256 JWT in `Authorization: Bearer`
- WHEN `PlatformControlGuard` processes the request
- THEN `request.platformCaller` is populated with the operator identity from the token
- AND `request.user` is not set

#### Scenario: Missing token is rejected

- GIVEN a request to the internal endpoint with no `Authorization` header
- WHEN `PlatformControlGuard` processes the request
- THEN the response status is 401
- AND `request.user` is not set

#### Scenario: Expired token is rejected

- GIVEN a request carrying an otherwise valid HS256 JWT whose `exp` claim is in the past
- WHEN `PlatformControlGuard` processes the request
- THEN the response status is 401

#### Scenario: Wrong-secret token is rejected

- GIVEN a request carrying a JWT signed with a secret that does not match `PLATFORM_CONTROL_SECRET`
- WHEN `PlatformControlGuard` processes the request
- THEN the response status is 401

#### Scenario: User access token is not accepted by PlatformControlGuard

- GIVEN a request carrying a valid `viewpro_access_token` (user JWT) instead of a service token
- WHEN `PlatformControlGuard` processes the request
- THEN the response status is 401
- AND `request.platformCaller` is not set

---

### Requirement: Trust Path Isolation

`PlatformControlGuard` and the user `AuthGuard` MUST be mutually exclusive trust paths.
A service token MUST NOT satisfy `AuthGuard`. A user JWT MUST NOT satisfy `PlatformControlGuard`.

#### Scenario: Service token rejected by AuthGuard

- GIVEN a route protected by the user `AuthGuard`
- WHEN a request is made carrying only a valid service token (no user JWT)
- THEN the response status is 401

#### Scenario: User JWT rejected by PlatformControlGuard

- GIVEN a route protected by `PlatformControlGuard`
- WHEN a request is made carrying only a valid user JWT (no service token)
- THEN the response status is 401

---

### Requirement: Internal Tenant Status Write

The system MUST expose `POST /internal/platform/tenants/:id/status` that
accepts a `SetTenantStatusCommand` payload. The endpoint MUST delegate to
the existing `AdminTenantStatusService` and apply the mutation
transactionally. Only permitted target statuses (e.g. `ACTIVE`, `SUSPENDED`)
MUST be accepted; any other value MUST be rejected.

#### Scenario: Valid status command mutates tenant

- GIVEN a tenant exists with status `ACTIVE`
- AND a valid service token with operatorId `op-1` is presented
- WHEN `POST /internal/platform/tenants/:id/status` is called with `{ targetStatus: "SUSPENDED", idempotencyKey: "key-1" }`
- THEN the response status is 200
- AND the tenant's status in the database is `SUSPENDED`

#### Scenario: Tenant not found returns 404

- GIVEN no tenant exists for the given `:id`
- WHEN `POST /internal/platform/tenants/:id/status` is called with a valid command
- THEN the response status is 404

#### Scenario: Invalid target status is rejected

- GIVEN a valid service token and an existing tenant
- WHEN `POST /internal/platform/tenants/:id/status` is called with an unpermitted `targetStatus`
- THEN the response status is 400

---

### Requirement: Internal Tenant Limits Write

The system MUST expose `POST /internal/platform/tenants/:id/limits` that
accepts a `SetTenantLimitsCommand` payload and delegates to
`AdminTenantLimitsService` transactionally.

#### Scenario: Valid limits command updates tenant limits

- GIVEN a tenant exists
- AND a valid service token with operatorId `op-1` is presented
- WHEN `POST /internal/platform/tenants/:id/limits` is called with a valid limits payload and `idempotencyKey: "key-2"`
- THEN the response status is 200
- AND the tenant's limits reflect the new values

---

### Requirement: Idempotency Store

The system MUST record each processed command in an idempotency store keyed
on `idempotencyKey`. A duplicate `idempotencyKey` MUST be deduplicated:
the mutation MUST NOT be applied a second time. The response on replay is
left to design (e.g. 200 or 409); this spec only constrains the no-double-apply rule.

#### Scenario: Duplicate key does not double-apply

- GIVEN a command with `idempotencyKey: "key-1"` was already successfully processed
- WHEN the same command is sent again with the same `idempotencyKey`
- THEN the tenant's state is not mutated a second time

#### Scenario: Different key applies normally

- GIVEN a command with `idempotencyKey: "key-1"` was already processed
- WHEN a new command is sent with `idempotencyKey: "key-2"`
- THEN the second mutation is applied

---

### Requirement: Operator Audit Attribution

A successful platform command MUST write an `AnalyticsEvent` with
`actorOperatorId` set to the `callerId` from `request.platformCaller`,
`actorType` set to `AnalyticsActorType.PLATFORM_OPERATOR`, and
`actorUserId` set to `null`.

#### Scenario: Audit event records operator actor

- GIVEN a valid service token carrying `callerId: "op-1"`
- WHEN `POST /internal/platform/tenants/:id/status` succeeds
- THEN an `AnalyticsEvent` row is created with `actorOperatorId = "op-1"`, `actorType = PLATFORM_OPERATOR`, and `actorUserId = null`

#### Scenario: actorUserId remains null for control-lane events

- GIVEN a successful control-lane command
- WHEN the resulting `AnalyticsEvent` is inspected
- THEN `actorUserId` is `null`

---

### Requirement: Additive DB Schema

The `AnalyticsEvent` table MUST gain a nullable `actorOperatorId` column
and the `AnalyticsActorType.PLATFORM_OPERATOR` enum value in a live,
additive migration. Existing `actorUserId` columns and rows MUST remain
untouched.

#### Scenario: Existing user-actor events are unaffected

- GIVEN existing `AnalyticsEvent` rows with `actorUserId` set
- WHEN the migration is applied
- THEN those rows still have their `actorUserId` values and `actorOperatorId = null`

---

## Invariants

- `request.user` is NEVER populated by `PlatformControlGuard` on any code path.
- Existing `/admin` status and limits write routes remain functional (not removed this phase).
- The `actorUserId` semantic on existing events is not altered by the migration.
