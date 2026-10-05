# ZonaProp property import

**Status: ACCEPTED (2026-10-04).** New capability; requirements are ADDED.

## Requirement: Canonical publisher intake and proof of control

The system MUST accept only recognized HTTPS ZonaProp advertiser URLs and derive publisher identity server-side. Domain equality is context signal only, never proof or approval; every claim MUST require a one-time code sent to the exact trusted provider-published agency address or the bounded listing-description code fallback. Contact name and phone MUST NOT establish control.

### Scenario: Verified principal-manager domain matches
- **GIVEN** an active same-tenant `PRINCIPAL_MANAGER` has a verified email domain matching ZonaProp's published `agencyEmail` domain
- **WHEN** the agency submits a valid advertiser URL
- **THEN** the domain match is a context signal only, the system binds its parsed publisher ID to the tenant, and a proof challenge is still required before any claim approval.

### Scenario: Email challenge proves exact published address
- **GIVEN** no other tenant owns an approved claim
- **WHEN** the user enters a valid, unexpired, rate-limit-compliant one-time code sent to the exact published `agencyEmail`
- **THEN** the system approves the claim and records method and outcome in audit history.

### Scenario: Listing-description fallback
- **GIVEN** email verification cannot be used
- **WHEN** the publisher places the issued short code in a listing description and the bounded single-listing verification scrape finds it
- **THEN** the system approves the claim and audits the verification.

### Scenario: Domain match is signal only for all domains
- **GIVEN** published agency email uses any public or organizational domain, including a match with a verified principal-manager domain
- **WHEN** a user submits the publisher URL
- **THEN** domain equality may provide context but never approves the claim; exact published-address code proof or listing-description code fallback is required, and contact name or phone is not proof.

### Scenario: Approved publisher already claimed elsewhere
- **GIVEN** a different tenant has an approved claim for the publisher
- **WHEN** another tenant attempts to claim it
- **THEN** the system blocks the attempt with a contact-support outcome; pending claims do not block, and claim transfer/revocation remain auditable operations.

## Requirement: Safe, bounded discovery and durable execution

The system MUST discover listing URLs with `apify/web-fetch`, scrape details with pinned `memo23/zonaprop-scraper`, bind runs/datasets to batch, and process asynchronously with durable idempotent work and no periodic poll/timer.

### Scenario: Successful bounded discovery
- **GIVEN** an approved publisher and configured server-side Apify secret
- **WHEN** discovery runs under actor-native maxItems, maxTotalChargeUsd, bounded concurrency and retry limits
- **THEN** the batch records pinned actor build, expected/discovered/unique-received counts and only scrapes deduplicated slug-bearing listing URLs.

### Scenario: Webhook is duplicate, stale, or unbound
- **GIVEN** a webhook names a run/dataset not currently bound to the batch, or repeats an already handled event
- **WHEN** the endpoint validates its webhook secret
- **THEN** it responds promptly, rejects stale/unbound authority, and idempotently schedules or ignores valid duplicate work without trusting webhook tenant IDs.

### Scenario: Work resumes without polling
- **GIVEN** durable work remains non-terminal after process restart
- **WHEN** API startup resumes work or a webhook, confirmation, or explicit retry triggers it
- **THEN** lease-based idempotent processing continues without periodic polling or timers.

### Scenario: Truncated or zero-result run
- **GIVEN** zero results, only first-page discovery, unexplained expected-count mismatch, stale run, or a configured cap is reached
- **WHEN** run results are reconciled
- **THEN** completeness is withheld and a specific truncation/failure reason is retained; valid previously received candidates remain retryable.

## Requirement: Tenant-isolated staging and mapping

The system MUST stage candidates under the owning tenant without creating canonical assets, engagements or images before confirmation, preserving sufficient retained source snapshot for remapping.

### Scenario: Map supported and edge locations
- **GIVEN** fixture listings for Córdoba with three location components and CABA with two
- **WHEN** candidates are mapped
- **THEN** city/province are correct, stable feature codes are parsed, unknown type maps to `OTHER`, and temporary rental maps to `RENT`.

### Scenario: Candidate states and editing
- **GIVEN** discovered listing rows include complete, existing, incomplete and invalid records
- **WHEN** staging completes
- **THEN** candidates expose ready/existing/incomplete/rejected outcomes and reasons; six required fields are editable, and no canonical records exist yet.

### Scenario: Invalid identity or price pair
- **GIVEN** result publisher ID differs from the URL publisher, or price/currency is absent, mismatched, unsupported or overflows stored cents
- **WHEN** mapping validates the row
- **THEN** that candidate is rejected with a reason and does not stop processing independent rows.

## Requirement: Idempotent, authorized confirmation

The system MUST enforce unique tenant/source/listing references, revalidate permission at confirmation, use canonical create/capacity behavior, and retry only pending candidates.

### Scenario: Concurrent confirmations
- **GIVEN** two authorized confirmations select the same ready listing concurrently
- **WHEN** both attempt canonical materialization
- **THEN** exactly one engagement/reference is created and the other observes the existing result without duplication.

### Scenario: Capacity limit
- **GIVEN** selected candidates exceed current active-engagement capacity
- **WHEN** confirmation materializes them
- **THEN** outcomes explicitly identify retryable capacity-blocked rows and do not report full success; retry processes only pending rows.

### Scenario: Stale permission or webhook attribution
- **GIVEN** initiating user's permission is revoked before confirmation or a webhook requests canonical creation
- **WHEN** confirmation is attempted
- **THEN** current permission is revalidated and webhook authority is insufficient; createdBy/uploadedBy attribution is explicit.

## Requirement: Safe asynchronous image copy

The system MUST copy images to R2 asynchronously using bounded SSRF-safe fetches, idempotent keys and per-image outcomes.

### Scenario: Safe image accepted
- **GIVEN** a valid permitted image URL within count, MIME and byte limits
- **WHEN** image-copy work runs
- **THEN** it stores the image under a deterministic key and records its individual success.

### Scenario: Unsafe or oversized image
- **GIVEN** an image redirects to private/reserved network, uses disallowed protocol/host/MIME, or exceeds byte/count limits
- **WHEN** it is fetched
- **THEN** fetch is blocked and the individual failure is recorded without rolling back the property.

### Scenario: Retry image copy
- **GIVEN** one image copy failed while others succeeded
- **WHEN** pending image work is retried
- **THEN** successful keys are not duplicated and only failed/pending image results change.

## Requirement: Secrets, retention, and operability

The system MUST guard required secrets in production, minimize and expire raw payloads, maintain tenant-isolation registration, and keep ordinary tests offline.

### Scenario: Missing production secret
- **GIVEN** production configuration lacks an Apify, webhook, or challenge secret
- **WHEN** configuration is validated
- **THEN** startup fails safely without exposing secret values.

### Scenario: Contract tests and bounded smoke
- **GIVEN** ordinary CI tests or an operator-authorized smoke run
- **WHEN** each is executed
- **THEN** normal tests use Córdoba/CABA fixtures only; smoke is explicit and enforces item/cost limits, and migration timing is coordinated with Neon operations.
