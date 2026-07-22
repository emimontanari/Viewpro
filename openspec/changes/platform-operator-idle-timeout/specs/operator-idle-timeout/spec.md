# operator-idle-timeout Specification

## Purpose

The operator-idle-timeout capability turns the operator access token from a
fixed-TTL token into a **rolling (sliding) session** with a hard **absolute
cap**: on authenticated activity the token's `exp` is re-issued to
`now + IDLE_TIMEOUT_SECONDS`, so true inactivity ends the session, while an
absolute-deadline claim minted at login and carried forward unchanged across
every re-sign caps total session length at `ABSOLUTE_SESSION_SECONDS`
regardless of activity. `AuthGuard` rejects (401, both cookies cleared) when
either deadline is past. This capability is additive to, and independent
from, `operator-step-up-auth` — the step-up cookie's own fixed 5-minute
window is untouched by idle-timeout activity. Operator-console lane only
(`viewpro-api` / `viewpro-web`); no DB migration, no platform-contract
change, no `apps/api` change.

---

## Requirements

### Requirement: Rolling Idle Deadline on Authenticated Activity

`viewpro-api` MUST treat the access token's sliding `exp` as a rolling idle
deadline. A request MUST succeed and the session MUST remain able to keep
receiving requests indefinitely as long as no gap between authenticated
requests exceeds `IDLE_TIMEOUT_SECONDS`. Re-issuance of the access cookie is
NOT required on literally every request — the system MAY re-issue only as
needed to keep the idle deadline from lapsing. A request arriving more than
`IDLE_TIMEOUT_SECONDS` after the operator's last authenticated activity MUST
be rejected.

#### Scenario: Activity within the idle window keeps the session alive

- GIVEN an operator authenticated at T0 with `IDLE_TIMEOUT_SECONDS = 600`
- WHEN the operator makes an authenticated request at T0+540s (9 minutes)
- THEN the response status is not 401
- AND the session remains valid for at least `IDLE_TIMEOUT_SECONDS` beyond that request

#### Scenario: No activity beyond the idle window rejects the next request

- GIVEN an operator's last authenticated request was at T0, `IDLE_TIMEOUT_SECONDS = 600`
- WHEN the operator's next request arrives at T0+601s with no intervening activity
- THEN the response status is 401
- AND both the access-token cookie and the step-up cookie are cleared on the response

---

### Requirement: Absolute Session Deadline Independent of Activity

`viewpro-api` MUST mint an absolute-deadline claim at login, set to
`now + ABSOLUTE_SESSION_SECONDS`, and MUST carry it forward byte-identical on
every re-sign of the same session. A request MUST be rejected once `now` is
past the absolute deadline, regardless of how recently the operator was
active.

#### Scenario: Continuous activity does not survive the absolute deadline

- GIVEN a session started at T0 with `ABSOLUTE_SESSION_SECONDS = 28800`, kept active at least once per minute
- WHEN a request arrives at T0+28801s
- THEN the response status is 401
- AND both cookies are cleared

#### Scenario: Absolute-deadline claim is unchanged across re-signs

- GIVEN a session started at T0 with an absolute-deadline claim value V
- WHEN the access cookie is re-issued on a later authenticated request inside the idle window
- THEN the re-issued token's absolute-deadline claim is still V, byte-identical to the value minted at login

---

### Requirement: Dual-Deadline Rejection Precedence

Whichever deadline is reached first — the sliding idle `exp` or the absolute
deadline — MUST trigger rejection. The two checks MUST be evaluated
independently; either one failing is sufficient to reject the request.

#### Scenario: Idle deadline rejects while the absolute deadline is still far off

- GIVEN a session whose absolute deadline is hours away
- WHEN a request arrives more than `IDLE_TIMEOUT_SECONDS` after the last activity
- THEN the response status is 401

#### Scenario: Absolute deadline rejects while the idle deadline alone would still allow the request

- GIVEN a session kept continuously active (every request inside the idle window) until it crosses `ABSOLUTE_SESSION_SECONDS`
- WHEN a request arrives just after the absolute deadline, well inside what the idle deadline alone would permit
- THEN the response status is 401

---

### Requirement: Symmetric Cookie Clearing on Idle or Absolute Expiry

On rejection for either idle or absolute expiry, `viewpro-api` MUST clear
both the access-token cookie and the step-up cookie on the response. A
subsequent request presenting the now-stale cleared access cookie MUST also
be rejected.

#### Scenario: Idle expiry clears both cookies

- GIVEN a session is rejected for idle expiry
- WHEN the rejection response is inspected
- THEN both the access-token cookie and the step-up cookie are cleared on that response

#### Scenario: A stale cookie replayed after clearing is rejected again

- GIVEN a browser replays an access cookie that was cleared on a prior 401
- WHEN a new authenticated request is made carrying that stale cookie value
- THEN the response status is 401

---

### Requirement: Step-up Cookie Independence from Access-Session Activity

Idle-timeout activity MUST NOT extend or shorten the step-up cookie's own
TTL (`STEP_UP_TTL_SECONDS`, unchanged by this capability); re-issuing the
access cookie MUST NOT touch the step-up cookie. Conversely, a fresh, valid
step-up cookie MUST NOT keep an access session alive past its idle or
absolute deadline.

#### Scenario: Access-session activity does not extend the step-up cookie

- GIVEN an operator holds a valid access cookie and a step-up cookie issued at T0
- WHEN the operator makes several authenticated requests before `T0 + STEP_UP_TTL_SECONDS`, each re-issuing the access cookie
- THEN the step-up cookie's expiry remains `T0 + STEP_UP_TTL_SECONDS`, unchanged by those requests

#### Scenario: An active step-up cookie does not rescue an idle-expired access session

- GIVEN a step-up cookie is still fresh and valid
- AND the access session has passed its idle deadline
- WHEN the operator makes an authenticated request
- THEN the response status is 401

---

### Requirement: Tokens Without an Absolute-Deadline Claim Are Rejected

An access token that lacks the absolute-deadline claim MUST be treated as
expired and rejected — it MUST NOT be grandfathered as valid.

#### Scenario: A token without the absolute-deadline claim is rejected

- GIVEN an access token was signed without the absolute-deadline claim
- WHEN an authenticated request is made using that token
- THEN the response status is 401
- AND both cookies are cleared

---

### Requirement: Global 401 Handling Redirects to Sign-in with Session-Expired Indication

`viewpro-web` MUST treat any 401 response from an authenticated operator API
call — not limited to `GET /auth/me` — as session expiry: it MUST redirect
the operator to the sign-in screen and MUST show a neutral/professional
Spanish "sesión expirada" indication. A 401 returned from a sign-in/login
attempt itself (wrong credentials) MUST NOT be treated as session expiry and
MUST NOT trigger this redirect. A 403 `STEP_UP_REQUIRED` response MUST NOT be
treated as a 401 and MUST NOT trigger this redirect.

#### Scenario: A 401 from any authenticated operator request redirects to sign-in

- GIVEN an operator is on a console page (tenants, audit, or limits) with an expired session
- WHEN an API call from that page returns 401
- THEN the operator is redirected to the operator sign-in screen
- AND a "sesión expirada" indication is shown

#### Scenario: A failed login attempt does not trigger the expiry redirect

- GIVEN an operator is on the sign-in screen, not yet authenticated
- WHEN the sign-in submission returns 401 for incorrect credentials
- THEN the operator remains on the sign-in screen with a credentials error
- AND no "sesión expirada" redirect occurs

#### Scenario: A 403 STEP_UP_REQUIRED does not trigger the expiry redirect

- GIVEN an operator's access session is valid but a destructive action lacks a fresh step-up
- WHEN the destructive-action call returns 403 with error code `STEP_UP_REQUIRED`
- THEN the operator is not redirected to sign-in
- AND no "sesión expirada" indication is shown

---

### Requirement: Idle and Absolute Timeout Are Required, Validated Configuration

`viewpro-api` MUST expose `IDLE_TIMEOUT_SECONDS` (default 600) and
`ABSOLUTE_SESSION_SECONDS` (default 28800) as validated configuration,
following the existing TTL-config pattern; invalid values MUST fail
application boot. The effective idle window governing the access token's
sliding `exp` MUST be `IDLE_TIMEOUT_SECONDS` — `ACCESS_TOKEN_TTL_SECONDS`, if
still present, MUST NOT independently control the access token's idle
behavior.

#### Scenario: An invalid idle or absolute timeout value fails boot

- GIVEN `IDLE_TIMEOUT_SECONDS` or `ABSOLUTE_SESSION_SECONDS` is set to a non-positive or non-numeric value
- WHEN the application starts
- THEN startup fails with a validation error naming the offending variable

#### Scenario: Effective idle window matches IDLE_TIMEOUT_SECONDS

- GIVEN `IDLE_TIMEOUT_SECONDS` is configured to a value different from the legacy `ACCESS_TOKEN_TTL_SECONDS` default
- WHEN an access token is signed or re-issued
- THEN its sliding idle deadline is `now + IDLE_TIMEOUT_SECONDS`, not `now + ACCESS_TOKEN_TTL_SECONDS`

---

## Invariants

- The step-up cookie's TTL and independence (`operator-step-up-auth`) are
  unaffected — this capability never sets, clears, or extends the step-up
  cookie except via the existing symmetric-clear-on-`AuthGuard`-failure path.
- No `Operator` schema change, no session store, no migration — the access
  token stays a stateless, self-contained JWT.
- The distinct-secrets boot guard (`ACCESS_TOKEN_SECRET` /
  `STEP_UP_TOKEN_SECRET` / `PLATFORM_CONTROL_SECRET`) is unchanged by this
  capability.
- No `apps/api` (InmoView tenant lane) route, guard, or cookie is touched.
