# Safe Public Error Boundary Specification

## Purpose

API disclosure boundary.

## Requirements

### Requirement: Canonical public error catalog

Types and runtime membership MUST derive from one exact, unique, ordered tuple of 28 codes: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `REQUEST_FAILED`, `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `phone.required`, `phone.invalid`, `phone.country_unsupported`. It MUST preserve the prefix/order of the first 14 codes exactly as before. Further growth beyond these 28 codes MUST occur only through an explicit SDD delta to this requirement. Established codes MUST pass enabled unchanged; unknown/missing codes MUST become `REQUEST_FAILED`.

(Previously: froze the tuple at the original 14 codes and stated it "MUST NOT add auth, invitation, or actionable codes." This delta, delivered by the sibling `actionable-auth-errors` capability, appends the 11 codes defined by that capability's "Catalog growth to twenty-five codes" requirement and closes the tuple at exactly 25. This second delta, delivered by the sibling `tenant-contact-phone` capability, appends the 3 codes defined by that capability's "Catalog growth to twenty-eight codes" requirement and closes the tuple at exactly 28.)

#### Scenario: Catalog preservation
- GIVEN the runtime tuple and codes
- WHEN membership, uniqueness, order, and enabled emission are tested
- THEN exact equality passes and each code remains unchanged

#### Scenario: Unknown or missing code
- GIVEN an API failure has an unknown or absent producer code
- WHEN the enabled boundary shapes it
- THEN `errorCode` is `REQUEST_FAILED`

#### Scenario: Frozen prefix and closed 28-code tuple
- GIVEN the runtime `PUBLIC_ERROR_CODES` tuple after `tenant-contact-phone`
- WHEN its first 14 entries and total length are asserted
- THEN the first 14 entries are unchanged and the tuple contains exactly 28 entries in the frozen append order

### Requirement: Focused tolerant direct consumer

Scope MUST be limited to direct App New `api-client.ts` consumers relevant to #285. HTTP status MUST remain transport authority and parsing MUST never throw. The consumer MAY retain only a catalog-valid `errorCode` and canonical request ID; it MUST discard arbitrary `details`/server prose and use local generic fallback copy. It MUST NOT claim migration/coverage of feature-local parsers or BFF forwarders. Invitation and session-recovery copy in the two invitation acceptance views, `verify-email-view.tsx`, and `reset-password-view.tsx` MAY be driven by catalog-valid `errorCode` values, exactly as scoped by the sibling `actionable-auth-errors` capability.

(Previously: additionally stated the consumer "MUST NOT ... change invitation copy/recovery." This delta narrows that prohibition to permit `errorCode`-driven invitation/session/token recovery copy exactly as defined by `actionable-auth-errors`; every other constraint — status as transport authority, never-throw parsing, discarding arbitrary details/prose, no claim over feature-local parsers or BFF forwarders — is unchanged.)

#### Scenario: Legacy or malformed body
- GIVEN a direct client receives a legacy, malformed, extra-key, or non-JSON error body
- WHEN it parses the response
- THEN parsing does not throw and status plus local generic fallback remain authoritative

#### Scenario: Valid fields only
- GIVEN a body contains a valid catalog code, canonical request ID, prose, and arbitrary details
- WHEN the direct client constructs its error
- THEN only the validated code and request ID are retained

### Requirement: Global exact producer envelope

When enabled, every API error route MUST return exactly `statusCode`, `errorCode`, and `requestId`, excluding `error`, `message`, `path`, `timestamp`, stack data, and arbitrary metadata. Unknown codes MUST become `REQUEST_FAILED`; established codes remain unchanged. Telemetry failure MUST NOT alter the response. This child MUST add no auth/invitation annotations.

#### Scenario: Exact enabled response
- GIVEN an enabled API error route, including a known established code
- WHEN the route returns an error
- THEN the body has exactly three keys and preserves the known code or uses `REQUEST_FAILED`

#### Scenario: Telemetry failure isolation
- GIVEN enabled error handling and a telemetry capture failure
- WHEN the API produces its response
- THEN the exact sanitized response is still returned

### Requirement: Server-owned correlation

The server MUST generate a fresh lowercase RFC 4122 UUID v4 for every request and replace every incoming ID. The same ID MUST be available in request context, the `x-request-id` header on success and error responses, enabled error bodies, and bounded telemetry.

#### Scenario: Fresh replacement and equality
- GIVEN two requests with attacker-supplied IDs
- WHEN success and error surfaces are observed
- THEN each server ID differs from its input and the other request, and all available surfaces match

### Requirement: Controlled rollout and rollback

Catalog and tolerant consumer MUST deploy first. `PUBLIC_ERROR_ENVELOPE_ENABLED` MUST default to `false` when unset and gate the complete envelope. Candidate-bound evidence MUST cover package, App New, and API for applicable unset/false/true states, reviewed SHA/evidence ID, and production boundary results. Switching off MUST restore the legacy producer body while retaining correlation and consumer safety; code rollback MUST revert WU2 before WU1.

#### Scenario: Candidate enablement gate
- GIVEN one reviewed SHA and evidence ID
- WHEN package, App New, and API matrix evidence passes
- THEN the switch may be enabled only on that evidenced deployment

#### Scenario: Switch-off rollback
- GIVEN the enabled envelope requires rollback
- WHEN the switch is set false and the false-state smoke passes
- THEN the legacy body resumes while correlation and consumer safety remain active

## Explicit scope

This child defers feature-parser/BFF migration; full Sentry/logging redesign; and #340/WU3a. No prose bridge or producer-outcome matrix.
