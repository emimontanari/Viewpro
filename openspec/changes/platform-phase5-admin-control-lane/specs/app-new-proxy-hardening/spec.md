# Delta for app-new Proxy Hardening

## Context

Small fold-in hardening for the `apps/app-new` proxy and `viewpro-api`
auth stack, required before the control lane is live. No prior spec file
exists for this capability.

---

## ADDED Requirements

### Requirement: /admin Server-Side Protection

The `apps/app-new` proxy MUST include `/admin` in `isProtectedAppPath`
so that unauthenticated browser requests to any `/admin` path are blocked
at the proxy layer before reaching InmoView.

#### Scenario: Unauthenticated /admin request is blocked at proxy

- GIVEN an unauthenticated browser request to any `/admin/**` path
- WHEN the `app-new` proxy evaluates `isProtectedAppPath`
- THEN the request is denied (redirect to login or 401) before being forwarded

#### Scenario: Authenticated /admin request passes proxy

- GIVEN a browser request to `/admin/**` with a valid session
- WHEN the `app-new` proxy evaluates the path
- THEN the request is forwarded to InmoView normally

---

## Invariants

- Other protected paths already in `isProtectedAppPath` are unaffected.
- The proxy change is additive (no existing paths removed).
