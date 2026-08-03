<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase7-viewpro-web-console (delta dated 2026-07-14) -->

# operator-console Specification

## Purpose

`apps/viewpro-web` — a global-operator console (Next.js) that authenticates
against viewpro-api and renders a read-only metrics dashboard. Operators are
GLOBAL (no tenant-membership concept). The console MUST talk ONLY to
viewpro-api; it MUST NOT call the InmoView API (`apps/api`).

---

## Requirements

### Requirement: Operator Sign-In

The system MUST provide a sign-in page that accepts operator credentials and
posts them to `POST /api/auth/login` on viewpro-api. On success, viewpro-api
sets the `viewpro_platform_access_token` HTTP-only cookie. The console MUST
treat receipt of that cookie as the established session and redirect the operator
to the dashboard.

#### Scenario: Valid credentials establish session and redirect

- GIVEN an operator is on the sign-in page and is not authenticated
- WHEN the operator submits a valid email and password
- THEN `POST /api/auth/login` responds 200 and sets the `viewpro_platform_access_token` cookie
- AND the operator is redirected to the dashboard page

#### Scenario: Invalid credentials show error, no session

- GIVEN an operator is on the sign-in page
- WHEN the operator submits an incorrect email or password
- THEN `POST /api/auth/login` responds 401
- AND an error message is displayed on the sign-in page
- AND no `viewpro_platform_access_token` cookie is set

---

### Requirement: Client Session Model

The console MUST maintain an operator session object of the form
`{ operator: { id, email } }`. The session MUST NOT include membership,
tenant-selection, or permission fields.

#### Scenario: Session contains only operator identity

- GIVEN an operator has signed in successfully
- WHEN the session object is inspected in the client
- THEN it contains exactly `{ operator: { id, email } }`
- AND no membership, tenant, or permission fields are present

---

### Requirement: Session Rehydration on Reload

On page reload, the console MUST rehydrate the operator session by calling
`GET /api/auth/me` on viewpro-api using the existing
`viewpro_platform_access_token` cookie. A valid response MUST restore the
session without redirecting to sign-in. A 401 response MUST clear the session
and redirect to sign-in.

#### Scenario: Valid session cookie rehydrates session on reload

- GIVEN an operator has a valid `viewpro_platform_access_token` cookie
- WHEN the operator reloads a console page
- THEN `GET /api/auth/me` returns 200 with `{ operator: { id, email } }`
- AND the operator remains on the same page without being redirected

#### Scenario: Missing or expired session cookie causes redirect on reload

- GIVEN the `viewpro_platform_access_token` cookie is absent or expired
- WHEN the operator reloads a console page
- THEN `GET /api/auth/me` returns 401
- AND the operator is redirected to the sign-in page

---

### Requirement: Protected Route Middleware

The console middleware MUST verify the `viewpro_platform_access_token` cookie
using HS256 locally. Routes under the authenticated shell MUST NOT be accessible
without a valid token. The middleware MUST NOT attempt a token refresh; expiry
MUST result in a redirect to the sign-in page.

#### Scenario: Unauthenticated visit to dashboard redirects to sign-in

- GIVEN no valid `viewpro_platform_access_token` cookie is present
- WHEN a request is made to the dashboard route
- THEN the middleware redirects the request to the sign-in page

#### Scenario: Authenticated request proceeds to dashboard

- GIVEN a valid `viewpro_platform_access_token` cookie is present and not expired
- WHEN a request is made to the dashboard route
- THEN the middleware allows the request to proceed
- AND the dashboard page renders

#### Scenario: Expired token redirects to sign-in — no refresh attempted

- GIVEN a `viewpro_platform_access_token` cookie that has passed its expiry
- WHEN a request is made to any protected route
- THEN the middleware redirects to sign-in without attempting any token refresh

---

### Requirement: Read-Only Metrics Dashboard

The dashboard MUST call `GET /api/operators/metrics/summary` on viewpro-api and
render the response: total tenant count, per-status breakdown, and `generatedAt`
timestamp. The dashboard MUST be read-only — no mutations. An empty status
breakdown (zero tenants) MUST render a well-formed zero-state UI, not an error.

#### Scenario: Dashboard renders metrics data

- GIVEN an authenticated operator is on the dashboard page
- WHEN `GET /api/operators/metrics/summary` returns a payload with tenant count, `byStatus`, and `generatedAt`
- THEN the dashboard displays the total tenant count
- AND each status bucket from `byStatus` is displayed with its count
- AND the `generatedAt` timestamp is displayed

#### Scenario: Empty state — zero tenants renders without error

- GIVEN `GET /api/operators/metrics/summary` returns `{ total: 0, byStatus: {}, generatedAt: "<timestamp>" }`
- WHEN the dashboard renders
- THEN a zero-state UI is displayed (e.g. "No tenants" or equivalent)
- AND no error, exception, or crash occurs

#### Scenario: Metrics API failure does not crash the page

- GIVEN `GET /api/operators/metrics/summary` returns a non-200 response
- WHEN the dashboard attempts to render
- THEN an error state is displayed
- AND the operator can navigate back to sign-in or retry

---

### Requirement: Isolation from InmoView API

The console MUST make NO HTTP calls to the InmoView API (`apps/api`). All
network calls MUST target viewpro-api exclusively. The `NEXT_PUBLIC_API_URL`
environment variable MUST point to viewpro-api.

#### Scenario: No InmoView calls from viewpro-web

- GIVEN the console is running and an operator is authenticated
- WHEN any console page or feature makes a network request
- THEN all requests target the viewpro-api base URL
- AND no request is made to any InmoView (`apps/api`) endpoint

---

### Requirement: Cookie and Auth Boundary

The console MUST use the `viewpro_platform_access_token` cookie for operator
authentication. It MUST NOT use or accept the `viewpro_access_token` cookie
(InmoView tenant cookie). On any 401 response from viewpro-api, the console
MUST redirect the operator to the sign-in page.

#### Scenario: Platform access token is the auth cookie

- GIVEN an operator is authenticated
- WHEN the console attaches auth credentials to a viewpro-api request
- THEN it uses the `viewpro_platform_access_token` cookie
- AND the `viewpro_access_token` cookie is not used or required

#### Scenario: 401 from viewpro-api triggers redirect to sign-in

- GIVEN the operator's session has expired or the cookie is invalid
- WHEN viewpro-api returns 401 for any request
- THEN the console redirects the operator to the sign-in page

---

## Invariants

- The console MUST NOT contain tenant-membership, tenant-switcher, or multi-tenant session logic.
- All viewpro-web network calls MUST target viewpro-api; InmoView (`apps/api`) calls are prohibited.
- Token refresh MUST NOT be implemented; session expiry MUST redirect to sign-in.
- The `viewpro_platform_access_token` cookie is the sole auth credential for the console.
