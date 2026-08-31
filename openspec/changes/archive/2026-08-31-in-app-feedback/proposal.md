# Proposal: Authenticated In-App Feedback

## Decision

Add a tenant-member feedback channel inside the authenticated InmoView application. Members can submit an `ERROR` or `SUGGESTION` report without leaving their workflow; ViewPro derives user and tenant identity on the server, durably records the report before attempting best-effort email notification, and presents a safe retry path when submission fails.

Sentry remains the channel for automatic technical-failure capture. This change adds intentional, user-authored product feedback and does not replace or weaken Sentry reporting.

## Verified Current-State Gap

The requested behavior does not exist today:

- `POST /api/feedback` returns `404` in the running API.
- Prisma DMMF contains no feedback model or equivalent durable record.
- The authenticated application has no dedicated in-app entry point for error or suggestion reports.
- Baseline verification is green at 48 API tests and 29 frontend tests, so implementation must preserve existing behavior while adding the capability.

ViewPro already has reusable authentication and tenant-membership enforcement, global DTO validation, throttling, tenant-isolation registration, Resend/email health recording, server-issued UUID request IDs, public `BffError` status/error-code semantics, dialogs, and textarea fields. These are foundations, not existing feedback behavior.

## Users and Product Outcomes

### V1 Audience

V1 serves authenticated tenant members working in the tenant application. Owner-portal users are explicitly excluded.

### Expected Outcome

A tenant member can:

1. open feedback from a floating trigger that does not occupy or alter navigation surfaces;
2. choose `ERROR` or `SUGGESTION`;
3. enter a bounded description and submit relevant safe context;
4. receive clear success confirmation after durable acceptance; and
5. see an explicit retry action after a failure, with public copy determined only by catalog `errorCode` or HTTP status.

For ViewPro operations, every accepted report is durably attributable to the authenticated user and active tenant even if email delivery is unavailable. A single configured recipient can receive best-effort notification without turning email into the source of truth.

## V1 Scope

### Submission Contract

- Accept exactly two feedback categories: `ERROR` and `SUGGESTION`.
- Require a plaintext description between 10 and 2000 characters.
- Accept optional page context as pathname only, with a maximum length of 512 characters. The authenticated client supplies `window.location.pathname`, and the API rejects any page-context value containing `?` or `#`.
- Accept an optional `requestId` only when it has canonical UUIDv4 syntax. The authenticated UI may send it only when that exact ID came from a previous application response. V1 adds no server-side issuance ledger, lookup, ownership verification, or retention: API validation proves shape, while the UI contract preserves provenance.
- Derive user identity and tenant identity from authenticated server context; never trust client-supplied identity fields.
- Enforce exactly 5 submissions per rolling 10 minutes for each server-derived `(userId, tenantId)` pair, and return a safe, actionable response when the limit is exceeded.

### Persistence and Notification

- Persist a valid feedback report durably before attempting any email notification.
- Treat email as best-effort: notification failure must not erase, duplicate, or report failure for an already accepted durable submission.
- Send to exactly one `FEEDBACK_RECIPIENT_EMAIL`.
- Operational notification content may include only the report type, description, pathname, `createdAt`, report/user/tenant IDs, optional `requestId`, submitting user's email, and tenant display name.
- Require that recipient configuration in production; development and test may use a no-op transport.
- Keep notification-failure observability sanitized: logs and diagnostics may include only report ID, timestamp, and provider category/code. They must never include description, recipient address, user email, tenant name, or provider prose.

### Authenticated UI

- Mount a floating feedback trigger from the authenticated tenant layout and keep it clear of navigation surfaces.
- Provide the category, bounded description, and submission states needed for a complete user flow.
- Preserve entered content when a retryable submission fails and provide an explicit retry action.
- Use icons only through `@/components/icons`.
- Branch public error behavior only on catalog `errorCode` or HTTP status, never on backend message substrings.

## Non-Goals

- No owner-portal feedback entry point or owner feedback authorization.
- No ticket workflow, internal inbox, assignment, status lifecycle, comments, threaded conversation, or support-case management.
- No changes to authentication, roles, navigation configuration, middleware, sidebar, or other surfaces owned by parallel issue #307.
- No arbitrary URL capture, query-string capture, hash capture, screenshots, attachments, browser dumps, or free-form client identity fields.
- No multiple recipients, recipient selection, mailing lists, or product-level email routing rules.
- No guarantee that notification email is delivered synchronously or at all after durable acceptance.
- No replacement for Sentry or expansion of automatic technical-failure telemetry.
- No broad redesign of shared error handling, email infrastructure, dialogs, or navigation.

## Affected Capabilities and Areas

### New Capability: Authenticated Feedback Submission

The next spec phase should define a new capability contract covering authenticated tenant-member access, input boundaries, tenant-safe durable acceptance, best-effort notification, throttling, safe public failures, and retry behavior.

### Modified Capabilities

None. Existing auth, tenant isolation, public error, email health, and automatic Sentry capabilities remain authoritative dependencies and retain their current external behavior.

| Area | Expected impact |
|---|---|
| Authenticated tenant application | Floating entry point, feedback form states, success, and explicit retry UX. |
| API feedback boundary | Authenticated tenant-member submission and safe result semantics. |
| Durable data | Tenant- and user-attributed feedback records with bounded safe context. |
| Email configuration and delivery | One production recipient and post-persistence best-effort notification. |
| Public error contract | Catalog-code/status-only UI decisions and preserved canonical request correlation. |
| Operational observability | Sanitized delivery/submission diagnostics while Sentry continues automatic failure capture. |
| Automated verification | Strict-TDD coverage for API, persistence ordering, isolation, failure paths, and UI states. |

## Security and Privacy Invariants

- Only authenticated tenant members may submit V1 feedback.
- The server derives and validates both user and tenant identity; the client cannot select, override, or forge either identity.
- Feedback records are tenant-scoped and must participate in the repository's tenant-isolation safeguards.
- Cross-tenant access, association, or disclosure is forbidden, including through errors and observability.
- Description text is bounded plaintext. It must not be interpreted as HTML or executable content.
- Page context stores pathname only. The authenticated client supplies `window.location.pathname`, and the API rejects page-context values containing `?` or `#` rather than stripping or persisting them.
- An optional request ID must have canonical UUIDv4 syntax. The authenticated UI may submit it only when received in a previous application response. V1 deliberately has no server-side issuance ledger, lookup, ownership verification, or retention, so server validation proves shape and the UI contract—not server state—preserves provenance. Existing client behavior that drops canonical request IDs is a known gap to resolve without accepting arbitrary correlation text.
- Public responses and UI copy must not expose backend messages, provider responses, recipient addresses, stored feedback prose, stack traces, or internal identifiers.
- Notification-failure logs and diagnostics may contain only report ID, timestamp, and provider category/code; description, recipient address, user email, tenant name, and provider prose are forbidden.
- Rate limiting is exactly 5 submissions per rolling 10 minutes for each server-derived `(userId, tenantId)` pair and must not weaken authentication or tenant isolation.
- Production must fail safe when the single required recipient configuration is absent; development/test no-op behavior must not silently become the production behavior.

## Dependencies and Relationships

- Depends on established `AuthGuard` and `TenantMembershipGuard` patterns, global DTO validation, Throttler, and the Prisma tenant-isolation registry.
- Depends on the existing email transport/health boundary, while preserving the rule that persistence succeeds independently of notification delivery.
- Depends on UUID request IDs returned by application responses and the public error catalog/status contract. The current BFF client dropping canonical request IDs is an explicit integration gap. V1 restores UI propagation but adds no server-side provenance ledger, lookup, ownership check, or retention.
- Relates to issue #307 only through shared authenticated layout context. This change must not edit auth, role, middleware, navigation, or sidebar ownership assigned to that parallel work.
- Sentry remains independently responsible for automatic technical failures; user-submitted feedback may carry an application-issued request ID for correlation but does not replace Sentry events.

## Risks and Tradeoffs

| Risk or tradeoff | Product impact | Required control |
|---|---|---|
| Email is treated as the record of truth | Accepted reports can be lost during provider outages. | Define acceptance at durable persistence and attempt email afterward. |
| Client identity or tenant is trusted | Reports can be misattributed or cross tenant boundaries. | Derive and validate identity entirely on the server. |
| Feedback or URL context leaks into failure observability | User-authored or sensitive data becomes operationally exposed. | Allow failure logs only report ID, timestamp, and provider category/code; forbid description, recipient address, user email, tenant name, and provider prose. |
| Request correlation accepts arbitrary values or is dropped | Correlation becomes spoofable or ineffective. | Validate canonical UUIDv4 shape and require the authenticated UI to propagate only an ID from a previous application response; acknowledge that V1 has no server-side provenance verification. |
| The fixed submission limit blocks urgent repetition or permits coordinated abuse | A member may have to wait, while separate user/tenant pairs retain independent quotas. | Enforce exactly 5 submissions per rolling 10 minutes per server-derived `(userId, tenantId)` pair and provide safe retry guidance. |
| Notification failure causes client retries after persistence | Duplicate durable reports can be created. | Keep accepted persistence successful despite email failure and make UI states unambiguous. |
| Floating UI obscures core actions or expands navigation scope | Existing workflows regress or conflict with #307. | Keep the trigger outside navigation surfaces and verify authenticated-layout usability. |
| Scope grows into support tooling | V1 becomes an unbounded ticketing project. | Preserve the explicit no-inbox/no-workflow boundaries. |

## Rollout and Rollback

Roll out only after configuration validation, schema/data readiness, and focused authenticated API and UI verification are complete. Production rollout requires exactly one valid `FEEDBACK_RECIPIENT_EMAIL`; no-op notification is limited to development and test.

If the feature must be rolled back, remove or disable the authenticated UI entry and submission route together, then revert notification integration. Preserve already accepted feedback records according to normal data-retention policy rather than destructively deleting them during application rollback. Any schema reversal must be a separately reviewed, data-safe action after confirming whether retained records are required. Sentry and all existing automatic error handling continue unchanged throughout rollout and rollback.

## Strict-TDD Expectation

Implementation follows repository strict TDD. Each behavior slice must record RED before product code, then GREEN, TRIANGULATE across success and failure variants, and REFACTOR while preserving evidence. At minimum, tests must drive authentication and membership enforcement, tenant isolation, DTO boundaries, request-ID rules, rate limiting, durable-before-email ordering, notification degradation, sanitized public failures, and frontend success/retry states. Existing 48 API and 29 frontend baseline tests must remain green.

## Success Criteria

- [ ] An authenticated tenant member can submit either `ERROR` or `SUGGESTION` from the floating authenticated-layout entry point.
- [ ] Descriptions shorter than 10 or longer than 2000 characters are rejected; valid bounded plaintext is accepted.
- [ ] The authenticated client supplies `window.location.pathname`; page context accepts pathname-only values up to 512 characters, and the API rejects values containing `?` or `#`.
- [ ] User and tenant attribution are server-derived, and automated cross-tenant tests prove isolation.
- [ ] Optional request correlation accepts only canonical UUIDv4 syntax and survives the relevant client/API boundary; the authenticated UI sends it only after receiving it in a previous application response, with no V1 server-side provenance ledger, lookup, ownership verification, or retention.
- [ ] Every successful response corresponds to a durable record created before notification is attempted.
- [ ] Operational notification content is limited to report type, description, pathname, `createdAt`, report/user/tenant IDs, optional `requestId`, submitting user's email, and tenant display name.
- [ ] Email delivery failure leaves the durable report accepted, and its logs/diagnostics contain only report ID, timestamp, and provider category/code—never description, recipient address, user email, tenant name, or provider prose.
- [ ] Production requires exactly one configured recipient; development/test can execute deterministically with a no-op transport.
- [ ] Exactly 5 submissions per rolling 10 minutes are enforced for each server-derived `(userId, tenantId)` pair and covered by a safe HTTP/error-code response plus explicit retry UX.
- [ ] Frontend error branches use only catalog `errorCode` or HTTP status and never inspect backend message substrings.
- [ ] Public responses and logs do not expose feedback prose, recipient/provider prose, query/hash data, secrets, or internal exception details.
- [ ] Owner-portal, auth, roles, middleware, navigation configuration, sidebar, ticketing, and Sentry behavior remain unchanged.
- [ ] Strict-TDD evidence is recorded and the existing 48 API plus 29 frontend baseline tests remain green.

## Proposal Decision Status

The product question round has been resolved in the approved contract supplied for this change. Audience, field boundaries, the exact rolling rate limit, request-ID V1 provenance and its explicit server-side limitation, notification content, failure-observability allowlist, recipient policy, UI placement, parallel-work boundaries, public-error rules, and non-goals are fixed V1 scope. The spec and design phases must encode these decisions rather than reopen or defer them.

## Review Workload Warning

This is a cross-cutting change spanning durable data, API security, email degradation, public errors, and authenticated UI. A single implementation diff is likely to exceed the repository's 400-changed-line review budget even with narrow scope. Subsequent spec, design, and tasks should define independently reviewable strict-TDD slices and keep generated migration artifacts visible, without weakening end-to-end acceptance ordering or tenant-isolation proof.
