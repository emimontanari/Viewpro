# Delta for Safe Public Error Boundary

## MODIFIED Requirements

### Requirement: Canonical public error catalog

Types and runtime membership MUST derive from one exact, unique, ordered tuple of 25 codes: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `REQUEST_FAILED`, `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`. It MUST preserve the prefix/order of the first 14 codes exactly as before. Further growth beyond these 25 codes MUST occur only through an explicit SDD delta to this requirement. Established codes MUST pass enabled unchanged; unknown/missing codes MUST become `REQUEST_FAILED`.

(Previously: froze the tuple at the original 14 codes and stated it "MUST NOT add auth, invitation, or actionable codes." This delta, delivered by the sibling `actionable-auth-errors` capability, appends the 11 codes defined by that capability's "Catalog growth to twenty-five codes" requirement and closes the tuple at exactly 25.)

#### Scenario: Catalog preservation
- GIVEN the runtime tuple and codes
- WHEN membership, uniqueness, order, and enabled emission are tested
- THEN exact equality passes and each code remains unchanged

#### Scenario: Unknown or missing code
- GIVEN an API failure has an unknown or absent producer code
- WHEN the enabled boundary shapes it
- THEN `errorCode` is `REQUEST_FAILED`

#### Scenario: Frozen prefix and closed 25-code tuple
- GIVEN the runtime `PUBLIC_ERROR_CODES` tuple after `actionable-auth-errors`
- WHEN its first 14 entries and total length are asserted
- THEN the first 14 entries are unchanged and the tuple contains exactly 25 entries in the frozen append order

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

## Archive-time reconciliation required

The parent spec carries a trailing `## Explicit scope` narrative section (`openspec/specs/safe-public-error-boundary/spec.md:74-76`) that sits outside every `### Requirement:` block and therefore cannot be reached by ADDED/MODIFIED/REMOVED delta mechanics. It currently reads:

> This child defers actionable codes; invitation/session/credential behavior; feature-parser/BFF migration; full Sentry/logging redesign; and #340/WU3a. No prose bridge or producer-outcome matrix.

Once this change merges, the first two clauses are false: actionable codes and invitation/session behavior are delivered here. `sdd-archive` MUST edit that sentence during the merge so the main spec does not contradict its own requirements — removing "actionable codes; invitation/session/credential behavior;" and leaving the remaining deferrals intact. This is a mandatory merge step, not an optional cleanup.
