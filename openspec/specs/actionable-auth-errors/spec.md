# Actionable Auth and Invitation Errors Specification

## Purpose

Session, invitation, and token-recovery states surfaced by `apps/api` auth, team-invitation, and owner-invitation flows emit stable public error codes so App New consumers can branch to distinct, actionable recovery copy instead of one generic panel.

## Requirements

### Requirement: Catalog growth to twenty-five codes

`PUBLIC_ERROR_CODES` MUST append exactly eleven codes after `REQUEST_FAILED`, in this exact order: `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`. The resulting tuple MUST total exactly 25 codes; the first 14 codes MUST remain unchanged and order-frozen.

#### Scenario: Exact append order and count
- GIVEN the runtime `PUBLIC_ERROR_CODES` tuple after this change
- WHEN its length and order are asserted
- THEN it has exactly 25 entries, the first 14 match the pre-existing frozen prefix, and entries 15-25 match the append order above

#### Scenario: No duplicate or reordered codes
- GIVEN the appended 11 codes
- WHEN uniqueness is checked against the full 25-code tuple
- THEN every code appears exactly once and none collides with an existing code

### Requirement: Production-mode code emission at throw sites

Every annotated throw site MUST emit its assigned `errorCode` under `NODE_ENV=production`, because `sanitizeProductionMessage` (`global-exception.filter.ts:87`) only activates in that mode. A test suite that does not force `NODE_ENV=production` MUST NOT be treated as sufficient evidence that a code reaches the client.

#### Scenario: Session and token guards emit codes in production
- GIVEN `NODE_ENV=production`
- WHEN `auth.guard.ts`, `get-current-user.use-case.ts`, or `refresh-session.use-case.ts` reject a missing, invalid, or expired session
- THEN the response body's `errorCode` is `SESSION_EXPIRED` and contains no server prose

#### Scenario: Invitation throw sites emit codes in production
- GIVEN `NODE_ENV=production`
- WHEN a team or owner invitation validate/accept flow hits a not-found, expired, revoked, already-accepted, email-mismatch, already-member, email-registered, or tenant-limit condition
- THEN the response body's `errorCode` matches the corresponding catalog code and contains no server prose

#### Scenario: Token-state use cases emit codes in production
- GIVEN `NODE_ENV=production`
- WHEN `verify-email.use-case.ts:23` or `reset-password.use-case.ts:29` reject an invalid or expired token
- THEN the response body's `errorCode` is `AUTH_TOKEN_INVALID` and contains no server prose

#### Scenario: Development-mode-only suite is not sufficient evidence
- GIVEN a test suite that asserts an `errorCode` without setting `NODE_ENV=production`
- WHEN it is offered as verification of client-visible behavior
- THEN it MUST NOT be accepted as proof, because `sanitizeProductionMessage` never activates outside production mode

### Requirement: Enumeration protection stays collapsed

`login.use-case.ts:35` and `register-tenant.use-case.ts:52` MUST continue to throw generic, vague responses that do not distinguish missing user, wrong password, inactive account, or attacker-supplied email existence. This change MUST NOT add new codes or code-based branching to either site.

#### Scenario: Login failure stays collapsed
- GIVEN a login attempt with a nonexistent user, wrong password, or inactive account
- WHEN the API responds
- THEN the response is the same generic `Invalid email or password` shape regardless of cause, with no distinguishing `errorCode`

#### Scenario: Register-tenant email conflict stays collapsed
- GIVEN a tenant registration whose email is already registered
- WHEN the API responds
- THEN the response uses the pre-existing generic 409 shape with no new `errorCode`, and the existing status-code-based existence leak remains an accepted, documented residual

### Requirement: Consumer branches on errorCode and HTTP status only

`team-invitation-acceptance-view.tsx` and `owner-invitation-acceptance-view.tsx` MUST derive recovery copy from `errorCode` plus HTTP status only. Neither view MAY call `message.includes(...)` or otherwise branch on server prose. The four distinguished 410 states (`INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`), the 403 `INVITATION_EMAIL_MISMATCH`, the three distinct 409 states (`INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`), and `SESSION_EXPIRED` MUST each render distinct recovery copy.

#### Scenario: Distinct 410 recovery copy
- GIVEN an invitation acceptance view receives a 410 response
- WHEN `errorCode` is one of `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, or `INVITATION_ALREADY_ACCEPTED`
- THEN the view renders the copy specific to that code, and no two of the four render identical copy

#### Scenario: Distinct 409 recovery copy
- GIVEN an invitation acceptance view receives a 409 response
- WHEN `errorCode` is one of `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, or `TENANT_USER_LIMIT_EXCEEDED`
- THEN the view renders the copy specific to that code, and no two of the three render identical copy

#### Scenario: Email mismatch copy
- GIVEN an invitation acceptance view receives a 403 response with `errorCode: INVITATION_EMAIL_MISMATCH`
- WHEN the view renders
- THEN it shows copy explaining the authenticated session does not match the invited email

#### Scenario: No prose matching remains
- GIVEN the source of either acceptance view
- WHEN it is inspected for `message.includes(...)` calls
- THEN none exist; all branching reads `errorCode` and/or HTTP status

### Requirement: Session expiry never renders credential copy

A 401 with `errorCode: SESSION_EXPIRED` MUST render session-expired recovery copy (for example, prompting re-authentication) and MUST NOT render password-focused copy. A 401 with `errorCode: INVITATION_INVALID_CREDENTIALS` MUST continue to render password-focused copy. The two MUST NOT share a rendering branch.

#### Scenario: Expired session during accept
- GIVEN a team or owner invitation acceptance flow where the caller's session expired mid-accept
- WHEN the API returns 401 with `errorCode: SESSION_EXPIRED`
- THEN the view shows session-expired copy and never shows password-recovery copy such as "Revisá tu contraseña"

#### Scenario: Invalid credentials during accept in login mode
- GIVEN an invitation accept attempt in login mode with a wrong password
- WHEN the API returns 401 with `errorCode: INVITATION_INVALID_CREDENTIALS`
- THEN the view shows password-focused recovery copy

### Requirement: Token-state recovery copy without weakening generic DTO validation

`verify-email-view.tsx` and `reset-password-view.tsx` MUST branch on `errorCode: AUTH_TOKEN_INVALID` to render flow-specific recovery copy; each view supplies its own copy, and the code deliberately does not distinguish invalid from expired. Ordinary 400-level DTO validation failures unrelated to token state MUST continue to render the existing generic fallback copy; this change MUST NOT add `errorCode` branching for them.

#### Scenario: Invalid or expired verification link
- GIVEN `NODE_ENV=production` and a verify-email request with an invalid or expired token
- WHEN the API returns 400 with `errorCode: AUTH_TOKEN_INVALID`
- THEN `verify-email-view.tsx` renders its own link-recovery copy instead of the generic "Invalid request payload" fallback

#### Scenario: Invalid or expired reset-password link
- GIVEN `NODE_ENV=production` and a reset-password request with an invalid or expired token
- WHEN the API returns 400 with `errorCode: AUTH_TOKEN_INVALID`
- THEN `reset-password-view.tsx` renders its own link-recovery copy instead of the generic fallback

#### Scenario: Ordinary DTO validation stays generic
- GIVEN a 400 response from either view's flow whose failure is an ordinary DTO validation error unrelated to token state
- WHEN the view renders
- THEN it shows the existing generic fallback copy, unchanged by this capability

## Explicit Non-Goals

- Open-endpoint `login.use-case.ts` and `register-tenant.use-case.ts` responses stay intentionally vague; not solved here.
- The register-tenant 409 status-code existence leak is a documented, accepted residual, not fixed by this change.
- Staff RBAC `Insufficient permissions` denials and ordinary 400 DTO validation outside the two token-state sites are untouched.
- Staff-side team invitation lifecycle throw sites (`create-team-invitation.use-case.ts:51`, `resend-team-invitation.use-case.ts:44,48`, `revoke-team-invitation.use-case.ts:26,30`) are not annotated; deferred as a follow-up with no consumer in this scope.
- The wider App New dead-branch class (`status-change-requests`, `product-form`, `property-agents-section`, `property-owner-section`) belongs to issue #374; only the two invitation acceptance views are in scope here.
- `apps/viewpro-api` and `apps/viewpro-web` are a separate bounded context with their own already-safe, already-actionable error contract; issue #372 is not a dependency of this change.
