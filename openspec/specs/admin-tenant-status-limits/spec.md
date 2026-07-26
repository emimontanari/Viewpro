<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase5-admin-control-lane (delta dated 2026-07-13) -->

### Delta scope: admin-tenant-status and admin-tenant-limits

## Context

No prior spec file exists for these capabilities in this repo. This delta
documents the behavior ADDED by Phase 5: the audit actor can now be an
operator (via the control lane) in addition to a product user (via `/admin`).
Existing `/admin` transactional semantics are unchanged.

---

## ADDED Requirements

### Requirement: Dual-Actor Audit Attribution

The `AdminTenantStatusService` and `AdminTenantLimitsService` MUST accept
an optional operator actor context. When the command arrives via the
control lane, services MUST stamp `actorOperatorId` + `PLATFORM_OPERATOR`
on the resulting `AnalyticsEvent`; when the command arrives via `/admin`,
existing `actorUserId` stamping MUST continue unchanged.

#### Scenario: Control-lane command stamps operator actor

- GIVEN a `SetTenantStatusCommand` arrives via the control lane with `operatorId = "op-1"`
- WHEN the service executes the mutation
- THEN the resulting `AnalyticsEvent` has `actorOperatorId = "op-1"`, `actorType = PLATFORM_OPERATOR`, and `actorUserId = null`

#### Scenario: Admin-route command stamps user actor (unchanged)

- GIVEN a tenant status change is triggered via the existing `POST /admin/.../status` route by a product user
- WHEN the service executes the mutation
- THEN the resulting `AnalyticsEvent` has `actorUserId` set to the product user's id and `actorOperatorId = null`

---

### Requirement: Idempotency Key Scope

When a `SetTenantStatusCommand` or `SetTenantLimitsCommand` arrives with
an `idempotencyKey`, the services MUST check the idempotency store before
applying the mutation. A previously seen key MUST short-circuit the write.

#### Scenario: Idempotency prevents double-write on status

- GIVEN `SetTenantStatusCommand` with `idempotencyKey: "k-1"` was applied successfully
- WHEN the same command is replayed with `idempotencyKey: "k-1"`
- THEN the tenant's status is not mutated again
- AND the idempotency short-circuit does not create a duplicate `AnalyticsEvent`

#### Scenario: Idempotency prevents double-write on limits

- GIVEN `SetTenantLimitsCommand` with `idempotencyKey: "k-2"` was applied successfully
- WHEN the same command is replayed with `idempotencyKey: "k-2"`
- THEN the tenant's limits are not mutated again

---

### Requirement: Writable-Target Status Policy

`AdminTenantStatusService` MUST enforce that only permitted target
statuses (e.g. `ACTIVE`, `SUSPENDED`) are accepted from any caller.
An unpermitted target MUST be rejected before any DB write occurs.

#### Scenario: Permitted status is accepted

- GIVEN target status is `SUSPENDED` (permitted)
- WHEN `SetTenantStatusCommand` is executed
- THEN the mutation proceeds and the tenant status is updated

#### Scenario: Unpermitted status is rejected

- GIVEN target status is an arbitrary value not in the permitted set
- WHEN `SetTenantStatusCommand` is attempted
- THEN the command is rejected with a validation error
- AND no DB mutation occurs

---

## Invariants

- Existing `actorUserId` rows in `AnalyticsEvent` are not altered.
- The `actorOperatorId` column is nullable; rows from user-actor commands have it as `null`.
- `/admin` write routes for status and limits remain operative (not removed this phase).
