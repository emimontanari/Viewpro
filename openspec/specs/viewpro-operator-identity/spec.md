<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase4-operator-identity (delta dated 2026-07-13) -->

# viewpro-operator-identity Specification

## Purpose

ViewPro's own operator identity store: a standalone `viewpro-api` NestJS application backed by
the `viewpro_platform` Postgres database. Provides operator sign-in with a ViewPro-scoped JWT
and cookie, with zero dependency on InmoView's `viewpro` database or its `UsersRepository`.

---

## Requirements

### Requirement: App Bootstrap

The `viewpro-api` app MUST start as a standalone NestJS process independent of `apps/api`.
The app MUST expose a `GET /api/health` endpoint that returns HTTP 200.

#### Scenario: Health check returns 200

- GIVEN the `viewpro-api` process is running with a valid `DATABASE_URL` pointing at `viewpro_platform`
- WHEN `GET /api/health` is requested (no authentication required)
- THEN the response status is 200

---

### Requirement: Operator Model

The `viewpro_platform` database MUST contain an `Operator` model with exactly the fields:
`id`, `email`, `passwordHash`, `status`, and timestamps (`createdAt`, `updatedAt`).
The `Operator` model MUST NOT include role, invite, or refresh-token fields in this slice.

#### Scenario: Operator table exists with minimal fields

- GIVEN the `viewpro-api` Prisma schema is applied to `viewpro_platform`
- WHEN the schema is introspected
- THEN an `Operator` table exists with columns `id`, `email`, `passwordHash`, `status`, `createdAt`, `updatedAt` and no others from this slice

---

### Requirement: Operator Seed

A Prisma seed MUST bootstrap at least one operator record into `viewpro_platform` so that the
sign-in flow is exercisable without manual DB intervention.

#### Scenario: Seed creates the first operator

- GIVEN `viewpro_platform` is empty
- WHEN the seed script is run
- THEN at least one `Operator` row exists in `viewpro_platform` with a valid `email` and a non-empty `passwordHash`
- AND no operator record is written to InmoView's `viewpro` database

---

### Requirement: Operator Sign-In

The `viewpro-api` MUST provide a sign-in endpoint that accepts operator credentials, verifies
the password hash using Argon2, issues a JWT signed with the app's own `ACCESS_TOKEN_SECRET`,
and sets an HTTP response cookie named **exactly** `viewpro_platform_access_token`.

#### Scenario: Valid credentials issue a JWT cookie

- GIVEN a seeded operator exists in `viewpro_platform`
- WHEN `POST /auth/login` is called with that operator's email and correct password
- THEN the response status is 200
- AND the `Set-Cookie` header contains a cookie named `viewpro_platform_access_token`
- AND the cookie value is a valid JWT signed by `viewpro-api`'s `ACCESS_TOKEN_SECRET`

#### Scenario: Wrong password is rejected

- GIVEN a seeded operator exists in `viewpro_platform`
- WHEN `POST /auth/login` is called with that operator's email and an incorrect password
- THEN the response status is 401
- AND no `Set-Cookie` header is present in the response

#### Scenario: Unknown operator is rejected

- GIVEN no operator exists with a given email in `viewpro_platform`
- WHEN `POST /auth/login` is called with that email and any password
- THEN the response status is 401
- AND no `Set-Cookie` header is present in the response

---

### Requirement: Cookie Name Isolation (Guardrail 2)

The auth cookie MUST be named `viewpro_platform_access_token`.
The name `viewpro_access_token` MUST NOT appear in any `Set-Cookie` header issued by `viewpro-api`.

#### Scenario: Cookie name is exactly viewpro_platform_access_token

- GIVEN a successful operator sign-in
- WHEN the `Set-Cookie` response header is inspected
- THEN the cookie name equals `viewpro_platform_access_token`
- AND the string `viewpro_access_token` (without the `_platform` segment) does not appear as a standalone cookie name

---

### Requirement: Cookie Security Attributes

The `viewpro_platform_access_token` cookie MUST be set with `httpOnly=true`, `sameSite=Strict`
(or `Lax`), and `Secure=true` in production-equivalent environments.

#### Scenario: Cookie carries required security attributes

- GIVEN a successful operator sign-in
- WHEN the `Set-Cookie` response header is inspected
- THEN the cookie has the `HttpOnly` attribute
- AND the cookie has a `SameSite` attribute set to `Strict` or `Lax`
- AND the cookie has the `Secure` attribute when the request is served over HTTPS

---

### Requirement: Database Isolation

Operator sign-in MUST use only the `viewpro-api`-own `DATABASE_URL` (pointing at
`viewpro_platform`). No code path in the sign-in flow MUST read from or write to InmoView's
`viewpro` database.

#### Scenario: Sign-in succeeds when InmoView DB is unreachable

- GIVEN `viewpro-api` is configured with its own `DATABASE_URL` for `viewpro_platform`
- AND InmoView's `viewpro` database is not configured or is unreachable
- WHEN `POST /auth/login` is called with valid operator credentials
- THEN the response status is 200 and a `viewpro_platform_access_token` cookie is issued
- AND no connection attempt to InmoView's database occurs

#### Scenario: Sign-in uses its own JWT secret

- GIVEN `viewpro-api` is configured with its own `ACCESS_TOKEN_SECRET`
- AND InmoView's `apps/api` is configured with a different `ACCESS_TOKEN_SECRET`
- WHEN `POST /auth/login` succeeds and issues a `viewpro_platform_access_token`
- THEN the issued JWT cannot be verified using InmoView's `ACCESS_TOKEN_SECRET`

---

### Requirement: Workspace Integration

The `viewpro-api` app MUST be included in the pnpm workspace so that turbo tasks (`build`,
`dev`, `lint`, `typecheck`, `test`) execute against it when run from the workspace root.

#### Scenario: Turbo runs typecheck against viewpro-api

- GIVEN `viewpro-api` is registered in the pnpm workspace
- WHEN `turbo run typecheck` is executed from the workspace root
- THEN the `viewpro-api` package's typecheck task is included in the turbo task graph and runs

#### Scenario: Turbo runs test against viewpro-api

- GIVEN `viewpro-api` is registered in the pnpm workspace
- WHEN `turbo run test` is executed from the workspace root
- THEN the `viewpro-api` package's test task is included in the turbo task graph and runs

---

## Invariants (MUST remain true throughout)

- `apps/api` (InmoView) source files are untouched by this slice.
- InmoView's `viewpro` database is not migrated, seeded, or altered by this slice.
- Existing `VIEWPRO_ADMIN` records in `viewpro` are untouched (migration is a follow-up task).
- The cookie name `viewpro_access_token` (InmoView's cookie) MUST NOT be emitted by `viewpro-api` under any path.
