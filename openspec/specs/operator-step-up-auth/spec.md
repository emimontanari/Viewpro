<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-step-up-reauth (delta dated 2026-07-15) -->

# operator-step-up-auth Specification

## Purpose

The operator-step-up-auth capability requires an already-authenticated
operator to re-prove their identity — via current-password re-entry — before
performing a destructive tenant action (suspend, cancel, or change-limits).
`POST /auth/step-up` verifies the operator's current password locally
(`Operator.passwordHash` + Argon2, reusing the existing login DI) and sets a
second short-lived httpOnly cookie carrying a stateless JWT
(`{ sub, stepUp:true, exp }`). A new `StepUpGuard`, layered additively on top
of the existing `AuthGuard`, protects the three destructive routes. The
5-minute freshness window is reusable (sudo-mode), not single-use.
Non-destructive reactivate (SUSPENDED→ACTIVE) is exempt. The mechanism is
operator-console-lane only; the legacy `/admin` lane is untouched.

---

## Requirements

### Requirement: Step-up Endpoint — Password Re-verification

`viewpro-api` MUST expose `POST /auth/step-up`, protected by the existing
`AuthGuard` (the operator must already hold a valid
`viewpro_platform_access_token`). The endpoint MUST re-verify the operator's
**current password** locally against `Operator.passwordHash` using Argon2,
reusing the `OPERATOR_REPOSITORY` and `PASSWORD_HASHER` providers already
wired in `AuthModule`. On success it MUST set a second httpOnly cookie
carrying a JWT payload `{ sub, stepUp:true, exp }` with a short TTL
(5 minutes). On failure (wrong password) it MUST respond 401 and MUST NOT
set the step-up cookie. Unauthenticated requests (no valid access cookie)
MUST be rejected 401 by `AuthGuard` before the password check runs.

#### Scenario: Correct current password sets the step-up cookie

- GIVEN an operator is signed in with a valid `viewpro_platform_access_token`
- WHEN `POST /auth/step-up` is called with the operator's correct current password
- THEN the response status is 200
- AND a step-up cookie is set, httpOnly, carrying a JWT with `stepUp:true`, `sub` equal to the operator's id, and an expiry ~5 minutes out

#### Scenario: Wrong password is rejected without setting a cookie

- GIVEN an operator is signed in with a valid `viewpro_platform_access_token`
- WHEN `POST /auth/step-up` is called with an incorrect password
- THEN the response status is 401
- AND no step-up cookie is set on the response

#### Scenario: Unauthenticated request is rejected before password check

- GIVEN no valid `viewpro_platform_access_token` cookie is present
- WHEN `POST /auth/step-up` is called with any password
- THEN the response status is 401
- AND no step-up cookie is set on the response

---

### Requirement: StepUpGuard Gates Destructive Tenant Routes

`viewpro-api` MUST protect three destructive routes with a new `StepUpGuard`,
applied **additively alongside** `AuthGuard` (never replacing it):
`PATCH /operators/tenants/:id/status` when the request's target status is
`SUSPENDED` or `CANCELLED`, and `PATCH /operators/tenants/:id/limits`.
A request to a gated route without a valid, fresh step-up cookie MUST be
rejected with **HTTP 403** and a machine-readable error code
**`STEP_UP_REQUIRED`**, distinct from the 401 an unauthenticated or
expired-session request receives. A rejected request MUST NOT mutate tenant
state, MUST NOT call the downstream service-token-mediated InmoView
platform-control lane, and MUST NOT produce an outbox event. A request with
a valid, fresh step-up cookie MUST proceed with existing behavior intact
(terminality guards, audit, outbox, downstream forwarding all unaffected).

#### Scenario: Suspend without a step-up cookie is blocked with STEP_UP_REQUIRED

- GIVEN an operator is signed in with a valid access cookie but no step-up cookie
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: SUSPENDED`
- THEN the response status is 403
- AND the response body carries error code `STEP_UP_REQUIRED`
- AND no tenant mutation occurs
- AND no call is made to the InmoView platform-control lane
- AND no outbox event is produced

#### Scenario: Cancel without a step-up cookie is blocked with STEP_UP_REQUIRED

- GIVEN an operator is signed in with a valid access cookie but no step-up cookie
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: CANCELLED`
- THEN the response status is 403
- AND the response body carries error code `STEP_UP_REQUIRED`
- AND no tenant mutation occurs

#### Scenario: Change-limits without a step-up cookie is blocked with STEP_UP_REQUIRED

- GIVEN an operator is signed in with a valid access cookie but no step-up cookie
- WHEN `PATCH /operators/tenants/:id/limits` is called with new limit values
- THEN the response status is 403
- AND the response body carries error code `STEP_UP_REQUIRED`
- AND no tenant mutation occurs
- AND no call is made to the InmoView platform-control lane

#### Scenario: Suspend with a fresh step-up cookie proceeds normally

- GIVEN an operator is signed in with a valid access cookie and a fresh step-up cookie (`sub` matching the access cookie's `sub`)
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: SUSPENDED`
- THEN the response status is 200
- AND the tenant status mutation, audit trail, and outbox event all occur as before this change

#### Scenario: Change-limits with a fresh step-up cookie proceeds normally

- GIVEN an operator is signed in with a valid access cookie and a fresh step-up cookie
- WHEN `PATCH /operators/tenants/:id/limits` is called with new limit values
- THEN the response status is 200
- AND the limits mutation and downstream forwarding occur as before this change

---

### Requirement: Reactivate Is Exempt from Step-up

Setting a tenant's status to `ACTIVE` (the reactivate transition,
`SUSPENDED`→`ACTIVE`) MUST NOT require a step-up cookie. `StepUpGuard` MUST
apply only when the target status is `SUSPENDED` or `CANCELLED`.

#### Scenario: Reactivate succeeds without a step-up cookie

- GIVEN an operator is signed in with a valid access cookie and no step-up cookie
- AND a tenant is currently `SUSPENDED`
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: ACTIVE`
- THEN the response status is 200
- AND the tenant transitions to `ACTIVE`

---

### Requirement: Step-up Freshness — 5-Minute Reusable Window

A step-up cookie MUST be accepted for repeated destructive actions within
5 minutes of issuance (reusable, sudo-mode — not single-use). After the
5-minute window elapses, the cookie MUST be rejected as if absent, requiring
a new `POST /auth/step-up` call.

#### Scenario: Step-up cookie is reused across two destructive actions within the window

- GIVEN an operator calls `POST /auth/step-up` successfully and receives a step-up cookie
- WHEN the operator calls `PATCH /operators/tenants/:id/limits` and then, within the same 5-minute window, `PATCH /operators/tenants/:id/status` with `status: SUSPENDED` on the same session
- THEN both requests succeed (200) without any additional `POST /auth/step-up` call

#### Scenario: Expired step-up cookie is rejected

- GIVEN a step-up cookie was issued more than 5 minutes ago
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: CANCELLED`
- THEN the response status is 403
- AND the response body carries error code `STEP_UP_REQUIRED`

---

### Requirement: Cross-Operator Step-up Rejection

`StepUpGuard` MUST bind the step-up cookie's `sub` claim to the requesting
operator's authenticated identity (`request.user.id`, set by `AuthGuard`). A
step-up cookie minted for one operator MUST be rejected on a request
authenticated as a different operator, even if the cookie is otherwise valid
and unexpired.

#### Scenario: Operator B's request with operator A's step-up cookie is rejected

- GIVEN operator A calls `POST /auth/step-up` and receives a step-up cookie with `sub = A`
- AND operator B is signed in with their own valid access cookie (`sub = B`)
- WHEN operator B's browser sends a destructive request carrying operator A's step-up cookie alongside operator B's access cookie
- THEN the response status is 403
- AND the response body carries error code `STEP_UP_REQUIRED`
- AND no tenant mutation occurs

---

### Requirement: Cookie Hygiene — Symmetric Clear on Logout and Auth Failure

`POST /auth/logout` MUST clear **both** the access-token cookie and the
step-up cookie. Any path that clears the access-token cookie on
`AuthGuard` failure MUST also clear the step-up cookie, so no stale step-up
cookie can outlive a rotated or invalidated session.

#### Scenario: Logout clears both cookies

- GIVEN an operator holds both a valid access cookie and a valid step-up cookie
- WHEN `POST /auth/logout` is called
- THEN both the access-token cookie and the step-up cookie are cleared on the response
- AND a subsequent destructive request using the now-stale step-up cookie is rejected (401 for the missing session, or 403 `STEP_UP_REQUIRED` if a session exists without step-up)

#### Scenario: AuthGuard-failure clear path also clears the step-up cookie

- GIVEN an operator's access cookie has expired or is invalid, and a step-up cookie is still present
- WHEN a request hits a route guarded by `AuthGuard` and the guard's failure-clear path executes
- THEN the step-up cookie is cleared alongside the access-token cookie

---

### Requirement: StepUpGuard Never Bypasses AuthGuard

`StepUpGuard` MUST be additive only — it MUST NOT authenticate a request on
its own, and it MUST NOT replace `AuthGuard` on any destructive route. An
unauthenticated request to a destructive route MUST still be rejected 401 by
`AuthGuard`, even when a step-up cookie is present.

#### Scenario: Unauthenticated destructive request is 401, not 403

- GIVEN no valid `viewpro_platform_access_token` cookie is present
- AND a valid, fresh step-up cookie is present (e.g. left over from a prior session)
- WHEN `PATCH /operators/tenants/:id/status` is called with `status: SUSPENDED`
- THEN the response status is 401
- AND the response is NOT the `STEP_UP_REQUIRED` 403 shape

---

### Requirement: Frontend Step-up Prompt for Destructive Actions

`viewpro-web` MUST present a shared step-up modal (password re-entry) when
an operator attempts a destructive action (suspend, cancel, or change-limits)
and no fresh step-up is known to be valid client-side. The modal MUST be
skipped when a fresh step-up is still valid. On password submission the
client MUST call `POST /auth/step-up`; on success it MUST retry the original
destructive action; on failure it MUST surface an error and MUST NOT perform
the destructive action. A `403 STEP_UP_REQUIRED` response received from any
destructive-action call MUST re-open the step-up modal — it MUST NOT trigger
a logout or a redirect to sign-in.

#### Scenario: First destructive action of a session opens the step-up modal

- GIVEN an operator is signed in and has not yet completed a step-up in this session
- WHEN the operator triggers a suspend action on a tenant
- THEN the step-up modal is shown, prompting for the current password
- AND the suspend mutation has not yet been sent

#### Scenario: Correct password in the modal completes the original action

- GIVEN the step-up modal is open following a suspend attempt
- WHEN the operator submits their correct current password
- THEN `POST /auth/step-up` succeeds
- AND the original suspend action is retried and completes
- AND the tenant list reflects the new status

#### Scenario: Wrong password in the modal shows an error and performs no action

- GIVEN the step-up modal is open following a cancel attempt
- WHEN the operator submits an incorrect password
- THEN an error is shown in the modal
- AND the cancel action is not performed
- AND the modal remains open for retry

#### Scenario: A second destructive action within 5 minutes skips the modal

- GIVEN the operator completed a step-up less than 5 minutes ago in this session
- WHEN the operator triggers a change-limits action on any tenant
- THEN the step-up modal is not shown
- AND the limits mutation is sent directly

#### Scenario: A 403 STEP_UP_REQUIRED mid-session re-opens the modal instead of logging out

- GIVEN the operator's client believes its step-up is still fresh, but the server-side window has actually expired
- WHEN the operator triggers a suspend action and the API responds `403 STEP_UP_REQUIRED`
- THEN the step-up modal is shown again, prompting for the current password
- AND the operator is NOT logged out and NOT redirected to sign-in

---

## Invariants

- `POST /auth/step-up` MUST NOT be reachable without a valid access cookie (`AuthGuard` applies first).
- A wrong password on `POST /auth/step-up` MUST NEVER set the step-up cookie.
- `StepUpGuard` MUST apply only to `PATCH .../status` (targets `SUSPENDED`/`CANCELLED`) and `PATCH .../limits` — never to reactivate (`status: ACTIVE`).
- A blocked destructive request (403 `STEP_UP_REQUIRED`) MUST NEVER mutate tenant state, call the InmoView platform-control lane, or produce an outbox event.
- The step-up cookie's `sub` MUST always be checked against `request.user.id` before a destructive action is allowed to proceed.
- Logout and every `AuthGuard`-failure clear path MUST clear the step-up cookie symmetrically with the access-token cookie.
- `StepUpGuard` MUST NEVER be the sole guard on a destructive route — `AuthGuard` MUST always apply first.
- The legacy `/admin` lane (`apps/api`) MUST remain untouched by this capability — no route, guard, or cookie changes outside `viewpro-api` / `viewpro-web`.
- No InmoView schema migration and no `platform-contract` change is required — the step-up cookie is stateless and local to `viewpro-api`.
