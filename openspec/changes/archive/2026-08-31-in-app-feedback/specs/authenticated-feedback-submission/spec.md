# Authenticated Feedback Submission Specification

## Purpose

Issue #305 adds a bounded, user-authored feedback channel to the authenticated InmoView tenant application. An authenticated tenant member can submit an `ERROR` or `SUGGESTION` with safe page context; ViewPro attributes and stores the report durably, then makes one best-effort notification attempt without making email the source of truth.

This is a new capability. Existing authentication, tenant isolation, public-error, email-health, and automatic Sentry capabilities remain authoritative dependencies and are not otherwise changed.

## Requirements

### Requirement: Tenant-member-only access and server attribution

The feedback submission capability MUST be available only to an authenticated member of the active tenant application. The owner portal MUST NOT expose or authorize this capability. User and tenant identity MUST be derived from authenticated server context; the request MUST NOT be able to select, override, or forge either identity.

#### Scenario: Unauthenticated submission is rejected

- GIVEN a caller without an authenticated application session
- WHEN the caller submits feedback
- THEN the request is rejected without creating a report

#### Scenario: Non-member submission is rejected

- GIVEN an authenticated caller who is not a member of the active tenant
- WHEN the caller submits feedback
- THEN the request is rejected without creating a report

#### Scenario: Client identity fields cannot affect attribution

- GIVEN an authorized tenant member submits a request containing attempted user or tenant identity fields
- WHEN the request is evaluated
- THEN those fields do not determine attribution, and the durable report uses only the server-derived user and tenant

#### Scenario: Owner portal remains excluded

- GIVEN an owner-portal session or owner-portal surface
- WHEN feedback entry or submission is attempted
- THEN no V1 feedback entry point or authorization is provided

### Requirement: Exact feedback input contract

The submission contract MUST accept exactly the feedback types `ERROR` and `SUGGESTION`. It MUST require a bounded description of 10 through 2000 characters inclusive. The description MAY contain markup-looking or script-looking text within those bounds, but the system MUST treat and store it only as inert plaintext and MUST never render, interpret, or execute it as HTML or code. Page context MAY be omitted; when present it MUST be a pathname of at most 512 characters and MUST be rejected if it contains `?` or `#` rather than being stripped or normalized into a pathname.

#### Scenario: Both supported types are accepted

- GIVEN an authorized tenant member submits a valid bounded plaintext description
- WHEN the type is `ERROR` or `SUGGESTION`
- THEN the request passes type validation for the selected type

#### Scenario: Unsupported types are rejected

- GIVEN an authorized tenant member submits a type other than `ERROR` or `SUGGESTION`, including a near-match or extra enum value
- WHEN the request is validated
- THEN it is rejected and no durable report is created

#### Scenario: Description boundaries are enforced

- GIVEN a description shorter than 10 characters or longer than 2000 characters
- WHEN feedback is submitted
- THEN the request is rejected and no durable report is created

#### Scenario: Plaintext is preserved as non-executable content

- GIVEN a description containing markup-looking or script-looking text within the allowed length
- WHEN feedback is accepted
- THEN it is treated and stored as plaintext, never interpreted or executed as HTML or code

#### Scenario: Page context is pathname-only and bounded

- GIVEN a page context of at most 512 characters containing no `?` or `#`
- WHEN feedback is submitted
- THEN the pathname context is eligible for acceptance
- AND GIVEN a missing page context
- THEN the request remains valid

#### Scenario: Query and hash page context are rejected

- GIVEN a page context containing `?` or `#`, including one that could otherwise be shortened to a valid pathname
- WHEN feedback is submitted
- THEN the request is rejected and the value is not persisted

### Requirement: Client pathname and request correlation provenance

The authenticated UI MUST obtain page context from `window.location.pathname`. It MUST forward an optional request ID only when that exact ID was received in a previous application response. The API MUST accept a request ID only in canonical textual UUIDv4 form and MUST validate its shape without issuing, looking up, ownership-checking, or retaining a request-ID ledger in V1.

#### Scenario: UI captures the current pathname

- GIVEN the feedback form is opened on an authenticated tenant page
- WHEN the form is submitted
- THEN the page context sent by the UI is the current `window.location.pathname`, not a full URL, query string, hash, or user-entered value

#### Scenario: Valid prior response request ID is forwarded

- GIVEN a previous application response supplied a canonical UUIDv4 request ID
- WHEN the member submits feedback from the authenticated UI
- THEN the UI MAY forward that exact ID unchanged

#### Scenario: Unproven or arbitrary request IDs are not forwarded by the UI

- GIVEN a request ID that did not come from a previous application response, or arbitrary correlation text
- WHEN the UI submits feedback
- THEN the UI does not forward it as `requestId`

#### Scenario: API validates UUIDv4 shape without a ledger

- GIVEN an API request with a missing request ID or a canonical UUIDv4 request ID
- WHEN the request is validated
- THEN the missing value is allowed and the canonical UUIDv4 is allowed
- AND the API does not require issuance, lookup, ownership verification, or retention state for that ID

#### Scenario: Non-canonical or non-v4 request IDs are rejected

- GIVEN a request ID with malformed UUID syntax, non-canonical formatting, or a UUID version other than 4
- WHEN the request is validated
- THEN the request is rejected and the invalid value is not persisted

### Requirement: Exact per-member tenant rate limit

The feedback submission boundary MUST allow exactly five submission attempts per rolling ten-minute window for each server-derived `(userId, tenantId)` pair. The sixth and subsequent attempts in that pair's active rolling window MUST be rejected with HTTP 429 or an equivalent stable public rate-limit error code. The limit MUST be independent between different users and tenants and MUST NOT weaken authentication or tenant isolation.

#### Scenario: First five submissions are within the allowance

- GIVEN one authenticated user and one active tenant
- WHEN five feedback submission attempts occur within ten minutes
- THEN each is evaluated within the allowance, subject to its own authentication and input rules

#### Scenario: Sixth submission receives safe rate-limit semantics

- GIVEN the same `(userId, tenantId)` pair has made five attempts during the preceding rolling ten minutes
- WHEN a sixth attempt is made
- THEN no sixth report is created
- AND the response uses HTTP 429 or the stable public rate-limit error code
- AND the response does not expose backend prose or internal rate-limit details

#### Scenario: Quotas are isolated by user and tenant

- GIVEN user A has exhausted the quota in tenant T1
- WHEN user B submits in T1 or user A submits in another tenant T2 where authorized
- THEN those distinct server-derived pairs are evaluated against their own quotas

#### Scenario: Retry guidance is explicit

- GIVEN the UI receives the feedback rate-limit response
- WHEN it renders the failure state
- THEN it gives safe, explicit guidance to retry after the rolling limit can expire, without parsing a message substring

### Requirement: Durable tenant-scoped report acceptance

A valid authorized submission MUST create one durable report before any notification attempt. The durable record MUST contain the feedback type, plaintext description, server-derived tenant and user references, optional pathname context, optional canonical request ID, and `createdAt`. A request MUST be considered successfully accepted only after durable persistence succeeds.

#### Scenario: Accepted submission has complete durable attribution

- GIVEN an authorized request with valid type, description, pathname context, and optional request ID
- WHEN the submission is accepted
- THEN one durable report exists with those report fields, server-derived user and tenant references, and a creation timestamp

#### Scenario: Optional fields remain optional

- GIVEN a valid submission without pathname context or request ID
- WHEN it is accepted
- THEN the durable report is created without inventing either optional value

#### Scenario: Persistence failure is not reported as success

- GIVEN a valid authorized submission whose durable write fails
- WHEN the API responds
- THEN the request is not reported as durably accepted and the user receives a sanitized retryable failure outcome

#### Scenario: Tenant isolation is durable and observable

- GIVEN reports submitted by members of two tenants
- WHEN either tenant's authorized application accesses feedback behavior
- THEN each report remains attributable to and isolated within its own tenant, with no cross-tenant association or disclosure

### Requirement: Single-recipient best-effort notification

After durable persistence succeeds, the system MUST make at most one best-effort notification attempt to exactly one configured `FEEDBACK_RECIPIENT_EMAIL`. The notification MUST include the report fields plus the submitting user's email and tenant display name. It MUST NOT create an inbox, ticket, assignment, status, comment, attachment, screenshot, owner workflow, or multiple-recipient routing behavior.

#### Scenario: Notification follows durable persistence

- GIVEN a valid submission
- WHEN processing occurs
- THEN the durable report is committed before the notification attempt begins
- AND a notification attempt never precedes or substitutes for report persistence

#### Scenario: Notification contains the approved fields

- GIVEN a durably persisted report with its associated user and tenant
- WHEN the notification is attempted
- THEN its content is limited to the report type, description, pathname context, `createdAt`, report/user/tenant references, optional request ID, user email, and tenant display name

#### Scenario: Exactly one configured recipient is used

- GIVEN a valid production notification configuration
- WHEN a report notification is attempted
- THEN it targets exactly the single `FEEDBACK_RECIPIENT_EMAIL` value and does not select additional recipients or accept recipient choice from the client

#### Scenario: Development and test may use a deterministic no-op

- GIVEN a development or test environment configured for no-op notification behavior
- WHEN a valid report is submitted
- THEN durable acceptance remains testable without requiring external email delivery

### Requirement: Production recipient configuration fails safe

Production MUST require exactly one valid `FEEDBACK_RECIPIENT_EMAIL` configuration. If it is missing, empty, malformed, or represents multiple recipients, the feedback notification capability MUST fail safe rather than use a fallback, silently no-op, or expose configuration details to users. Development and test MAY use a no-op transport and MUST NOT make that behavior the production default.

#### Scenario: Missing production recipient is not accepted as configured

- GIVEN a production environment without a valid single `FEEDBACK_RECIPIENT_EMAIL`
- WHEN configuration readiness is evaluated
- THEN the capability is not treated as operationally configured and no fallback recipient or multi-recipient behavior is used

#### Scenario: Production and non-production modes remain distinct

- GIVEN the same missing recipient setting in production, development, and test
- WHEN each environment evaluates notification behavior
- THEN production fails safe, while development and test may use the explicitly permitted no-op behavior

### Requirement: Notification failure does not undo acceptance

If notification delivery fails after the report is durably persisted, the report MUST remain accepted and MUST NOT be rolled back, duplicated, or converted into a failed submission response. The public success outcome MUST represent durable acceptance, not synchronous email delivery.

#### Scenario: Email provider failure preserves the report

- GIVEN a report has been durably persisted
- WHEN the single notification attempt fails
- THEN the report remains available as the accepted durable record
- AND the API request remains successful
- AND the UI confirms durable success rather than asking the member to submit the same report again

#### Scenario: Notification failure does not create a duplicate on retry of delivery

- GIVEN a persisted report whose notification attempt failed
- WHEN notification failure handling completes
- THEN no second feedback report is created merely because email failed

### Requirement: Sanitized failure and technical observability

Public failures and UI copy MUST NOT expose feedback description, recipient address, user email, tenant name, provider prose, secrets, stack traces, or internal exception details. Notification-failure diagnostics MUST contain only the report ID, failure timestamp, and provider category or code. Sentry MUST continue automatic technical-failure capture; this capability MUST NOT add user-authored feedback or sensitive notification fields to technical-failure diagnostics.

#### Scenario: Notification diagnostics use the allowlist only

- GIVEN a notification provider returns an error containing prose or sensitive context
- WHEN notification failure is recorded
- THEN diagnostics contain only report ID, timestamp, and provider category/code
- AND they contain neither description, recipient, user email, tenant name, provider prose, nor secrets

#### Scenario: Public persistence failure is sanitized

- GIVEN durable persistence fails with an internal exception
- WHEN the API and UI render the failure
- THEN the public result uses a safe status or catalog `errorCode` and sanitized copy, without the exception message or stack data

#### Scenario: Sentry remains automatic for technical failures

- GIVEN a technical failure occurs in the feedback path
- WHEN the normal application telemetry boundary handles it
- THEN Sentry continues its automatic technical-failure capture without making telemetry failure alter the public response

### Requirement: Safe public error branching

The API MUST expose feedback failure outcomes through the established public error/status contract. The authenticated UI MUST branch only on HTTP status and validated catalog `errorCode`; it MUST never inspect backend message substrings or provider prose. Rate-limit and persistence failures MUST have distinct safe user outcomes where their status or catalog code permits that distinction.

#### Scenario: Status or catalog code selects the user outcome

- GIVEN a feedback response with an HTTP status and optional validated public `errorCode`
- WHEN the UI chooses copy or controls
- THEN it uses only those structured values and renders local safe copy

#### Scenario: Backend prose cannot control a branch

- GIVEN two failures with identical status and error code but different backend messages
- WHEN the UI renders them
- THEN it chooses the same outcome without searching or matching either message

#### Scenario: Internal response data is not reflected

- GIVEN a failure response containing unexpected details, provider prose, or internal identifiers
- WHEN the UI renders the failure
- THEN those values are not shown to the member

### Requirement: Authenticated floating feedback flow

The authenticated tenant layout MUST provide a floating feedback trigger that is usable without changing navigation surfaces. The trigger and form MUST use icons from `@/components/icons`. The flow MUST provide type selection, bounded description entry, submission progress, durable-success confirmation, and failure states. It MUST NOT change authentication, roles, navigation configuration, middleware, sidebar behavior, or owner-portal surfaces.

#### Scenario: Tenant member can open the form from the tenant layout

- GIVEN an authenticated tenant member is using the tenant application
- WHEN the member activates the floating trigger
- THEN the feedback form opens without adding or modifying a navigation item or sidebar entry

#### Scenario: Form exposes the bounded submission choices

- GIVEN the feedback form is open
- WHEN the member interacts with the form
- THEN exactly `ERROR` and `SUGGESTION` are selectable and the description input communicates the 10–2000 character boundary

#### Scenario: Successful UI state confirms durable acceptance

- GIVEN the API reports durable persistence success, whether or not notification delivery succeeded
- WHEN the UI receives the result
- THEN it shows success confirmation for the accepted report and does not imply that email delivery is the source of truth

#### Scenario: Submission progress is safe and deterministic

- GIVEN the member submits a valid form
- WHEN the request is in flight
- THEN the UI shows a submitting state and prevents an accidental duplicate submission from the same interaction

### Requirement: Retry preserves entered content

When durable persistence fails, the UI MUST show sanitized local retry guidance and an explicit retry action. The retry state MUST preserve the member's entered type and description, and MUST NOT require the member to reconstruct the report. A rate-limit outcome MUST additionally provide explicit retry timing guidance. A successful durable submission MUST NOT be presented as retryable solely because notification delivery failed.

#### Scenario: Persistence failure preserves the form

- GIVEN a valid form submission receives a retryable persistence failure
- WHEN the failure state renders
- THEN the UI preserves the selected type and entered description
- AND it offers an explicit retry action with sanitized copy

#### Scenario: Retry submits the preserved content

- GIVEN the member activates retry after a persistence failure
- WHEN the retry request is made
- THEN it uses the preserved entered values and the same safe pathname/request-ID rules as the original submission

#### Scenario: Rate-limit state gives actionable guidance

- GIVEN the member reaches the exact rolling submission limit
- WHEN the UI renders the 429 or stable rate-limit error-code state
- THEN it explains that retry must wait for the rolling window and does not discard the entered content unless the member chooses to do so

### Requirement: Strict-TDD acceptance evidence

Implementation of this capability MUST be driven by strict TDD: each behavior slice MUST record RED evidence before product code, GREEN evidence for the intended behavior, triangulation across success and failure variants, and REFACTOR evidence preserving the contract. Verification MUST cover authorization, validation, request-ID provenance and shape, exact rate limiting, ordering, notification failure, tenant isolation, production configuration, observability redaction, public-error branching, and all required UI states while preserving the existing 48 API and 29 frontend baseline tests.

#### Scenario: Security and boundary cases have executable evidence

- GIVEN the strict-TDD verification record for this capability
- WHEN it is reviewed
- THEN it includes failing-first and passing evidence for unauthenticated access, non-membership, tenant isolation, exact input boundaries, pathname rejection, and request-ID rules

#### Scenario: Degraded dependencies and ordering have executable evidence

- GIVEN the strict-TDD verification record for notification and persistence
- WHEN it is reviewed
- THEN it proves the fifth-versus-sixth submission limit, durable-before-email ordering, production configuration behavior, email failure acceptance, and diagnostic redaction

#### Scenario: UI safety states have executable evidence

- GIVEN the strict-TDD verification record for the authenticated UI
- WHEN it is reviewed
- THEN it proves floating entry, type and description boundaries, submitting state, durable success, sanitized persistence failure, preserved retry content, rate-limit guidance, and status/errorCode-only branching

#### Scenario: Existing behavior remains green

- GIVEN the completed feedback capability
- WHEN the existing API and frontend baseline suites run
- THEN all 48 API tests and 29 frontend tests remain green in addition to the new focused evidence

## Explicit Non-Goals

- Owner-portal feedback entry or owner authorization.
- An inbox, ticket workflow, assignment, status lifecycle, comments, threaded conversation, attachments, screenshots, or support-case management.
- Multiple recipients, recipient selection, mailing lists, or product-level email routing.
- Arbitrary URL, query-string, hash, browser-dump, or client identity capture.
- A V1 request-ID issuance ledger, lookup, ownership verification, or retention mechanism.
- Replacing Sentry or redesigning automatic technical-failure telemetry.
- Changes to authentication, roles, navigation configuration, middleware, sidebar, or the parallel issue #307 surfaces.
- Broad redesign of shared error handling, email infrastructure, dialogs, or navigation.
