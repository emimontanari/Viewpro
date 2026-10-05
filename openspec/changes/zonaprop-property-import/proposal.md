# Proposal: ZonaProp property import (#456)

**Status: ACCEPTED (2026-10-04).** The user accepted the design; implementation proceeds by the work units in `tasks.md`.

## Decision

Add an explicit, tenant-scoped one-time import from a public ZonaProp publisher page. Prove publisher control automatically before staging can be confirmed, review exceptions, then materialize selected ready rows through canonical engagement creation/capacity logic. Copy images to R2 asynchronously. Owners are not imported; handoff to #459.

## User outcome

An authorized agency user submits a canonical publisher URL, sees processing/completeness, corrects or excludes exceptions, confirms without duplicate listings, tracks image outcomes, and proceeds to owner linking. No public listing becomes canonical before confirmation.

## Product rules

- Publisher domain equality is a context signal only, never approval or proof. Every claim requires a one-time code sent to the exact trusted provider-published agency address; bounded single-listing description-code verification is the fallback if email verification cannot be used. Specify length, TTL, attempts, rate limit, hashed-at-rest storage, and audit. Names/phones are display signals only. No manual operator review or new provider/identity integration is included.
- Only approved `(externalSource, publisherId)` claims are globally exclusive; pending claims never block. A different tenant's approved claim yields contact-support outcome. Define claim approve/reject/revoke/transfer at contract/data level; no live review UI.
- Canonical listing identity is tenant-scoped `ExternalPropertyReference(tenantId, externalSource, externalId)` unique by those three fields and linked to `PropertyEngagement`. Never store identity on `PropertyAsset` alone.
- Proposed async durability: DB-backed work rows, triggered by webhook/confirmation/explicit retry, startup resume, leases and idempotent handlers; no periodic polling/timers. Fixture-fed staging and confirmation precede Apify integration.
- Imports only confirmed ready selections. Partial retries process pending rows only. Plan-capacity outcomes are explicit and retryable.
- Six required editable fields: title, addressLine, city, province, propertyType, operationType. Córdoba/CABA mapping, `OTHER` fallback, temporary rental→`RENT`; price/currency pair and cents overflow are validated.
- All staging and new tenant-owned models obey tenant isolation. Initiator/actor attribution is explicit and permissions revalidated on confirmation. No token or raw payload leakage; define raw payload retention.
- Image copy is durable/asynchronous, SSRF-safe and independently retryable per image with idempotent keys and per-image results.

## Scope and non-goals

Includes URL/publisher parsing, claims, bounded Apify discovery/detail runs and webhook, completeness accounting, tenant staging, mapping/edit/review/confirm, capacity-safe canonical materialization, image copy, UI states, fixtures/contracts, opt-in bounded smoke, and Neon migration coordination. Excludes owner import, continuous sync, general scraper framework, and live manual claim-review UI.

## Acceptance boundary

Design is accepted. The corrected U4a implementation is pending parent review/publication; U4 remains incomplete. The user selected feature-branch-chain delivery: draft tracker PR to `develop`, followed by one child PR per work unit. See `tasks.md` for ordered slices and forecasts.
