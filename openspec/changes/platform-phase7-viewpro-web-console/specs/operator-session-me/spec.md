# operator-session-me Specification

## Purpose

viewpro-api `GET /api/auth/me` — an operator-authenticated endpoint that returns
the current operator's identity from the JWT already decoded by `AuthGuard`.
Enables the viewpro-web console to rehydrate the client session on page reload
without a database call or a separate migration.

---

## Requirements

### Requirement: GET /api/auth/me Endpoint

viewpro-api MUST expose `GET /api/auth/me` protected by the operator `AuthGuard`
(HS256 JWT, `viewpro_platform_access_token` cookie). The endpoint MUST return
`{ operator: { id, email } }` sourced directly from `request.user` as populated
by `AuthGuard`. It MUST NOT perform any database query or require a migration.

#### Scenario: Valid operator session returns operator identity

- GIVEN a request to `GET /api/auth/me` with a valid `viewpro_platform_access_token` cookie
- WHEN `AuthGuard` validates the token and populates `request.user`
- THEN the response status is 200
- AND the body is `{ operator: { id, email } }` matching the token claims

#### Scenario: Missing cookie returns 401

- GIVEN a request to `GET /api/auth/me` with no `viewpro_platform_access_token` cookie
- WHEN `AuthGuard` evaluates the request
- THEN the response status is 401
- AND no operator data is returned in the body

#### Scenario: Expired or invalid token returns 401

- GIVEN a request to `GET /api/auth/me` with an expired or tampered `viewpro_platform_access_token` cookie
- WHEN `AuthGuard` evaluates the request
- THEN the response status is 401
- AND no operator data is returned in the body

---

### Requirement: No Database Access in /api/auth/me

`GET /api/auth/me` MUST NOT issue any database query. The operator identity
(`id`, `email`) MUST be read exclusively from `request.user` as set by
`AuthGuard` during JWT verification.

#### Scenario: Response data comes from JWT, not a DB lookup

- GIVEN a valid operator session
- WHEN `GET /api/auth/me` is called
- THEN the response contains the `id` and `email` values encoded in the JWT
- AND no database query is executed during the request

---

### Requirement: Additive — No Migration Required

The `GET /api/auth/me` addition to `auth.controller.ts` MUST be additive. No
database schema changes, no Prisma migrations, and no modifications to existing
endpoints MUST be required.

#### Scenario: Existing auth endpoints are unaffected

- GIVEN the `/auth/me` route is added to viewpro-api
- WHEN existing endpoints (`POST /api/auth/login`, etc.) are called
- THEN they behave identically to before the addition

---

## Invariants

- `GET /api/auth/me` MUST be protected by `AuthGuard` — unauthenticated requests MUST receive 401.
- The response payload MUST contain only `{ operator: { id, email } }` — no additional fields required by this slice.
- No database access and no migration MUST be introduced by this endpoint.
