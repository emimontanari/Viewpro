# Delta for Safe Public Error Boundary

## MODIFIED Requirements

### Requirement: Canonical public error catalog

Types and runtime membership MUST derive from one exact, unique, ordered tuple of exactly 37 codes: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `REQUEST_FAILED`, `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `phone.required`, `phone.invalid`, `phone.country_unsupported`, `PRIMARY_AGENT_CANDIDATE_INVALID`, `PRIMARY_AGENT_STATE_CONFLICT`, `PROPERTY_PROPOSAL_NOT_FOUND`, `PROPERTY_PROPOSAL_STATE_CONFLICT`, `PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN`, `PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE`, `PROPERTY_PROPOSAL_REJECTION_REASON_INVALID`, `PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE`, `TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED`. The first 30 entries MUST remain the exact byte-for-byte ordered prefix already present at runtime. Further growth beyond these 37 codes MUST occur only through an explicit SDD delta to this requirement. Established and newly appended codes MUST pass through enabled unchanged; unknown or missing codes MUST become `REQUEST_FAILED`.

(Previously: the canonical text closed the catalog at 28 codes, while runtime already contained a 30-code ordered tuple because `PRIMARY_AGENT_CANDIDATE_INVALID` and `PRIMARY_AGENT_STATE_CONFLICT` were delivered by #304 without corresponding canonical synchronization. This delta records that pre-existing 28-to-30 drift, freezes the exact runtime 30-code prefix, and appends the seven property-proposal codes in the order above to close the durable contract at exactly 37 codes.)

#### Scenario: Catalog preservation

- GIVEN the runtime tuple and codes
- WHEN membership, uniqueness, order, and enabled emission are tested
- THEN exact equality passes and each established and newly appended code remains unchanged

#### Scenario: Unknown or missing code

- GIVEN an API failure has an unknown or absent producer code
- WHEN the enabled boundary shapes it
- THEN `errorCode` is `REQUEST_FAILED`

#### Scenario: Frozen prefix and closed 37-code tuple

- GIVEN the runtime `PUBLIC_ERROR_CODES` tuple after `seller-property-proposals`
- WHEN its first 30 entries and total length are asserted
- THEN the first 30 entries are unchanged byte-for-byte in their existing order and the tuple contains exactly 37 entries in the specified append order
