# Exploration: ZonaProp property import (#456)

**Status: ACCEPTED (2026-10-04).** Exploration complete; the user accepted the resulting design.

## Problem and outcome

A new Argentine agency may have many public ZonaProp listings and no ViewPro inventory. The user supplies a publisher-page URL, verifies control of that publisher, reviews staged exceptions, and confirms tenant-owned property engagements. Owners are not imported; owner linking/invitations continue in #459.

## Evidence inspected

- `docs/zonaprop-import-discovery.md`: tested pathway is `apify/web-fetch` links discovery then `memo23/zonaprop-scraper` on slug-bearing classified URLs. Direct agency `startUrls`, publisher override, slugless URLs, API endpoint, and ordinary WebFetch are documented as unsuccessful. Actor `callOptions.maxItems` is ignored for pay-per-event; use actor input `maxItems` and `maxTotalChargeUsd`.
- `odd/tasks/issue-456-zonaprop-import.md`: accepted verification ladder and accepted durable in-process work-row strategy.
- Issue body: acceptance scope covers parsing, publisher claim, bounded asynchronous scraping, completeness, tenant staging, mapping, idempotent confirmation, images, UI, secrets, retention, fixtures, smoke test, and Neon coordination.
- Existing canonical sources verified: `viewpro-app/apps/api/prisma/schema.prisma` has `PropertyAsset`, `PropertyAssetImage`, `PropertyEngagement`, `Tenant`; create path is `apps/api/src/property-engagements/use-cases/create-property-engagement.use-case.ts` + `prisma-property-engagements.repository.ts:createWithAsset`; capacity is `active-property-engagement-capacity.ts`; materializer is `canonical-property-materializer.ts`; image storage is `property-images.storage.ts`.
- Isolation sources: `apps/api/src/database/tenant-isolation.extension.ts` and `tenant-isolation.registry.spec.ts`. Configuration: `apps/api/src/config/env.schema.ts`, `app.config.ts`. Email: `apps/api/src/email/resend-email-sender.ts`. App BFF: `apps/app-new/src/lib/bff-api.ts`; product feature under `apps/app-new/src/features/products/`.
- Existing platform-control/service-token and Apify/webhook-specific integration pointers were not located/verified in this read-only pass; design must confirm available guard/service-token interfaces before implementation. Existing Resend sender is verified; delivery semantics/template limits still need implementation inspection.

## Accepted and proposed decisions

Accepted publisher proof ladder: (1) verified `PRINCIPAL_MANAGER` email domain matches non-generic published `agencyEmail` domain; (2) otherwise email one-time code to exact published address; (3) fallback short code in a publisher listing description, proven by bounded single-listing scrape. Contact name/phone are display-only. Another tenant's approved claim blocks with contact-support message; pending claims do not block. Claim transfer/revocation operations are defined as data/contracts, not live review UI.

Proposed, pending acceptance: database work rows with state/attempts/lease/last error, triggered by webhook, confirmation, explicit retry, and API startup resume; in-process execution, idempotent handlers, no periodic timers/polling. Earliest slice stages/confirms from fixtures before Apify integration.

## Discovery-derived mapping

Publisher ID from canonical agency slug; verify each result's publisher ID. Deduplicate slug-bearing listing URLs. Location parsing must handle Córdoba's three components and CABA's two. Use stable feature codes; map unknown type to `OTHER`, temporary rental to `RENT`; validate price/currency pair and cents integer range. No owner identity is available from the source.
