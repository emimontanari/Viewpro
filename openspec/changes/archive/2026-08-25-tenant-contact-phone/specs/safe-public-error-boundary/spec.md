# Delta for Safe Public Error Boundary

## MODIFIED Requirements

### Requirement: Canonical public error catalog

Types and runtime membership MUST derive from one exact, unique, ordered tuple of 28 codes: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `REQUEST_FAILED`, `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `phone.required`, `phone.invalid`, `phone.country_unsupported`. It MUST preserve the prefix/order of the first 14 codes exactly as before. Further growth beyond these 28 codes MUST occur only through an explicit SDD delta to this requirement. Established codes MUST pass enabled unchanged; unknown/missing codes MUST become `REQUEST_FAILED`.

(Previously: froze the tuple at 25 codes, closed by the sibling `actionable-auth-errors` capability. This delta, delivered by the sibling `tenant-contact-phone` capability, appends the 3 codes defined by that capability's "Catalog growth to twenty-eight codes" requirement — `phone.required`, `phone.invalid`, `phone.country_unsupported` — strictly after `AUTH_TOKEN_INVALID`, and closes the tuple at exactly 28.)

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
- WHEN its first 25 entries and total length are asserted
- THEN the first 25 entries are unchanged and the tuple contains exactly 28 entries in the frozen append order
