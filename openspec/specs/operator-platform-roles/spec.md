<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-operator-roles-seam (delta dated 2026-07-16) -->

# operator-platform-roles Specification

## Purpose

The operator-platform-roles capability introduces internal, static
role-based authorization for `viewpro-api` operator routes. Every
`Operator` carries a `PlatformOperatorRole` (`OWNER`, `OPERATIONS`,
`ANALYST`) resolved to a fixed permission set. Every protected
`operators/*` route declares the platform permission it requires, and a
`PlatformPermissionGuard` enforces that declaration (403 on mismatch),
running after `AuthGuard` (401 for unauthenticated) and before
`StepUpGuard` (403 `STEP_UP_REQUIRED` for stale freshness) on the two
destructive routes. The single existing operator is `OWNER` and keeps
full, unchanged access; ANALYST and OPERATIONS are correctly scoped
without any controller rewrite. Operator management (creating/inviting
other operators) is out of scope.

---

## Requirements

### Requirement: Every Operator Has a Platform Role; Existing Operators Default to OWNER

The system MUST associate every `Operator` record with exactly one
`PlatformOperatorRole` (`OWNER`, `OPERATIONS`, or `ANALYST`). Every
operator that existed before this capability MUST resolve to `OWNER`
after migration, and `OWNER` MUST hold every platform permission, so
authorization for the current, single operator MUST NOT change.

#### Scenario: Existing seeded operator keeps full access after migration

- GIVEN the pre-existing seeded operator had no role column before this change
- WHEN the migration runs and assigns `role = OWNER` by default
- THEN the operator successfully calls every protected `operators/*` route (all 3 READs and both WRITEs) exactly as before this change

#### Scenario: OWNER role holds all defined platform permissions

- GIVEN an operator has role `OWNER`
- WHEN their resolved permission set is computed
- THEN it includes `PLATFORM_METRICS_READ`, `PLATFORM_TENANTS_READ`, `PLATFORM_AUDIT_READ`, `PLATFORM_TENANT_STATUS_WRITE`, `PLATFORM_TENANT_LIMITS_WRITE`, and `PLATFORM_OPERATORS_MANAGE`

---

### Requirement: Read Routes Require the Declared READ Permission

Each read route — `GET /operators/metrics/summary`
(`PLATFORM_METRICS_READ`), `GET /operators/tenants`
(`PLATFORM_TENANTS_READ`), `GET /operators/audit`
(`PLATFORM_AUDIT_READ`) — MUST require its declared READ permission via
`PlatformPermissionGuard`. An operator whose role grants that permission
MUST be allowed; an operator whose role does not grant it MUST receive
403.

#### Scenario: ANALYST reads metrics summary successfully

- GIVEN an operator has role ANALYST
- WHEN they call `GET /operators/metrics/summary`
- THEN the response is 200 and the metrics summary is returned

#### Scenario: ANALYST reads tenant list and audit log successfully

- GIVEN an operator has role ANALYST
- WHEN they call `GET /operators/tenants` and `GET /operators/audit`
- THEN both responses are 200

#### Scenario: Operator lacking a READ permission is denied

- GIVEN an operator's role does not grant `PLATFORM_AUDIT_READ`
- WHEN they call `GET /operators/audit`
- THEN the response is 403 Forbidden

---

### Requirement: Write Routes Require the Declared WRITE Permission; ANALYST Is Denied and Nothing Mutates

Both write routes — `PATCH /operators/tenants/:id/status`
(`PLATFORM_TENANT_STATUS_WRITE`) and `PATCH /operators/tenants/:id/limits`
(`PLATFORM_TENANT_LIMITS_WRITE`) — MUST require their declared WRITE
permission via `PlatformPermissionGuard`, in addition to `AuthGuard` and
`StepUpGuard`. OPERATIONS and OWNER MUST be allowed; ANALYST MUST be
denied with 403, and a denied request MUST NOT mutate tenant state, MUST
NOT write an outbox event, and MUST NOT call the downstream InmoView
platform-control lane.

#### Scenario: OPERATIONS updates tenant status successfully

- GIVEN an operator has role OPERATIONS and a fresh step-up
- WHEN they call `PATCH /operators/tenants/:id/status` with a valid transition
- THEN the response is 200 and the tenant status mutation occurs

#### Scenario: ANALYST is denied tenant status update and nothing mutates

- GIVEN an operator has role ANALYST
- WHEN they call `PATCH /operators/tenants/:id/status` with any status
- THEN the response is 403 Forbidden
- AND no tenant mutation occurs, no outbox event is produced, and no call is made to the InmoView platform-control lane

#### Scenario: ANALYST is denied tenant limits update and nothing mutates

- GIVEN an operator has role ANALYST
- WHEN they call `PATCH /operators/tenants/:id/limits` with new limit values
- THEN the response is 403 Forbidden
- AND no limits mutation occurs and no call is made to the InmoView platform-control lane

---

### Requirement: Role Hierarchy — OPERATIONS Excludes PLATFORM_OPERATORS_MANAGE

ANALYST's permission set MUST contain only the three READ permissions.
OPERATIONS' permission set MUST contain the three READ permissions plus
the two WRITE permissions, and MUST NOT contain
`PLATFORM_OPERATORS_MANAGE`. OWNER's permission set MUST be a strict
superset of OPERATIONS', additionally containing
`PLATFORM_OPERATORS_MANAGE`.

#### Scenario: OPERATIONS lacks PLATFORM_OPERATORS_MANAGE

- GIVEN an operator has role OPERATIONS
- WHEN their resolved permission set is computed
- THEN it includes all 3 READ + 2 WRITE permissions and does NOT include `PLATFORM_OPERATORS_MANAGE`

#### Scenario: ANALYST lacks any WRITE permission

- GIVEN an operator has role ANALYST
- WHEN their resolved permission set is computed
- THEN it includes only the 3 READ permissions and does NOT include either WRITE permission or `PLATFORM_OPERATORS_MANAGE`

---

### Requirement: Guard Order Keeps 401, Permission-403, and Step-up-403 Distinct

On every protected `operators/*` route, `AuthGuard` MUST run before
`PlatformPermissionGuard`, which MUST run before `StepUpGuard` on the two
destructive routes. An unauthenticated request MUST always receive 401,
never 403, regardless of role or step-up state. An authenticated operator
who lacks the declared permission MUST receive 403 without code
`STEP_UP_REQUIRED`, and MUST be stopped before step-up freshness is
evaluated. An authenticated, permitted operator without a fresh step-up
MUST receive 403 with code `STEP_UP_REQUIRED`, distinct from a plain
permission 403.

#### Scenario: Unauthenticated request is 401 regardless of role

- GIVEN no valid access cookie is present
- WHEN any protected `operators/*` route is called
- THEN the response is 401 and is never the permission-403 or `STEP_UP_REQUIRED`-403 shape

#### Scenario: ANALYST is stopped at permission-403 before step-up is evaluated

- GIVEN an operator has role ANALYST and no step-up cookie
- WHEN they call `PATCH /operators/tenants/:id/status`
- THEN the response is 403 and the body does NOT carry error code `STEP_UP_REQUIRED`

#### Scenario: OPERATIONS with the permission but no fresh step-up gets STEP_UP_REQUIRED

- GIVEN an operator has role OPERATIONS and no fresh step-up cookie
- WHEN they call `PATCH /operators/tenants/:id/limits`
- THEN the response is 403 and the body carries error code `STEP_UP_REQUIRED`

---

### Requirement: A Role Change Takes Effect on the Operator's Very Next Request

When an operator's stored role changes, the change MUST be observable in
authorization decisions on that operator's next request, without
requiring the operator to re-login and without depending on any token
re-issuance for the new role to take effect.

#### Scenario: Role downgrade denies the next request immediately

- GIVEN an operator currently holds role OPERATIONS and successfully calls a WRITE route
- WHEN their stored role is changed to ANALYST
- THEN their very next call to a WRITE route, on the same still-valid session, is denied with 403, with no re-login or token refresh performed in between

#### Scenario: Role upgrade allows the next request immediately

- GIVEN an operator currently holds role ANALYST and is denied a WRITE route
- WHEN their stored role is changed to OPERATIONS
- THEN their very next call to that WRITE route, on the same still-valid session, succeeds, with no re-login or token refresh performed in between

---

### Requirement: Protected Routes Fail Closed When No Permission Is Declared

`PlatformPermissionGuard` MUST NOT authorize a request on a route that
has no declared platform permission. A protected `operators/*` route
guarded by `PlatformPermissionGuard` without a
`@RequirePlatformPermission` declaration MUST deny the request rather
than silently granting access.

#### Scenario: A route without a declared permission denies access

- GIVEN a protected `operators/*` route has `PlatformPermissionGuard` applied but no `@RequirePlatformPermission` declaration
- WHEN any authenticated operator, regardless of role, calls that route
- THEN the request is denied rather than authorized by default

#### Scenario: All five current routes declare a permission

- GIVEN the five protected routes (metrics summary, tenant list, audit, status PATCH, limits PATCH)
- WHEN each route's guard metadata is inspected
- THEN each has exactly one `@RequirePlatformPermission` declaration matching this spec's route-to-permission mapping

---

### Requirement: Migration Backfills Existing Operators and Seed Sets OWNER Explicitly

Adding the `role` column MUST backfill every pre-existing `Operator` row
to `OWNER`, and no existing operator MUST lose access as a result of the
migration. The seed script MUST create the first operator with
`role: OWNER` explicitly set, not relying only on the column default.

#### Scenario: Post-migration, the seeded operator reads back OWNER

- GIVEN the database contained the pre-existing seeded operator before migration
- WHEN the role migration runs
- THEN a fresh read of that operator's row returns `role = OWNER`

#### Scenario: Freshly seeded operator has an explicit OWNER role

- GIVEN the seed script runs against an empty database
- WHEN the operator row is created
- THEN its role field is explicitly `OWNER` in the create payload, not implicitly relying on the column default

---

### Requirement: Zero Change to Platform Contract, InmoView API, and viewpro-web

This capability MUST be fully contained within `viewpro-api`. It MUST NOT
require any `packages/platform-contract` change, MUST NOT require any
`apps/api` (InmoView) change, and MUST NOT require any `viewpro-web`
change. The only schema change introduced MUST be `Operator.role`.

#### Scenario: Diff touches only viewpro-api and its schema

- GIVEN the completed change set for this capability
- WHEN the diff is inspected
- THEN `packages/platform-contract`, `apps/api`, and `viewpro-web` contain zero changes, and the only Prisma schema change is the addition of `Operator.role` (plus its enum)

---

## Invariants

- `AuthGuard` MUST always run before `PlatformPermissionGuard`, which MUST always run before `StepUpGuard` on destructive routes.
- A 401 (unauthenticated) MUST NEVER be reported as a 403, and vice versa.
- A permission 403 MUST NEVER carry error code `STEP_UP_REQUIRED`; only a step-up-freshness failure MAY carry that code.
- `PLATFORM_OPERATORS_MANAGE` MUST be declared for OWNER in the role→permission map but MUST NOT be required by any route in this change.
- A denied WRITE request MUST NEVER mutate tenant state, produce an outbox event, or call the InmoView platform-control lane.
- Every existing operator MUST resolve to `OWNER` post-migration; no operator loses access.
