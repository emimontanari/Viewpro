# ViewPro Stage 8 Pilot Metrics Design

Stage 8 adds internal analytics for the MVP pilot. The goal is not to track everything. The goal is to answer whether ViewPro is creating value: are agencies keeping owners informed, and are owners receiving meaningful updates?

## Outcome

ViewPro will record safe backend events in its own database and expose manager-only pilot reports. PostHog can be added later as a visualization/export adapter, but it is not the source of truth for the MVP pilot.

## Core decision

Use an internal event log first.

| Area | Decision |
|------|----------|
| Source of truth | `analytics_events` table in Postgres. |
| Tracking API | `AnalyticsService.track(...)` used by backend use cases. |
| External analytics | Future outbound adapter to PostHog, not required for Stage 8. |
| Privacy | Store IDs and safe metadata only. Never store document content, observations, addresses, emails, names, tokens, or credentials. |
| Reporting | Manager-only endpoints for pilot health. |

## Why not PostHog first?

PostHog is useful for dashboards and funnels, but the pilot needs reliable internal traceability. If a third-party delivery fails or is misconfigured, ViewPro should still know whether agencies updated owners during the week.

The right order is:

1. Capture clean backend events internally.
2. Query the pilot metrics from our own data.
3. Add PostHog later for dashboards/funnels if needed.

## North-star metric

```txt
% of active property engagements with at least one owner-visible update per week
```

For the first backend version, an owner-visible update is represented by `MOVEMENT_CREATED` events for active engagements. If later we add explicit visibility flags, the metric can be tightened without changing the event log foundation.

## Event model

### `AnalyticsEvent`

Fields:

- `id`
- `tenantId`
- `actorUserId`
- `actorType`
- `eventName`
- `propertyEngagementId`
- `propertyAssetId`
- `documentRequestId`
- `movementId`
- `metadata`
- `occurredAt`

### Enums

```prisma
enum AnalyticsActorType {
  INTERNAL_USER
  OWNER
  SYSTEM
}

enum AnalyticsEventName {
  SELLER_LOGGED_IN
  MOVEMENT_CREATED
  PROPERTY_STATUS_CHANGED
  OWNER_VIEWED_PROPERTY
  DOCUMENT_REQUESTED
  DOCUMENT_UPLOADED
  DOCUMENT_APPROVED
  DOCUMENT_REJECTED
}
```

Enums are intentional. Free-form strings create dirty analytics data over time.

## Initial events

| Event | Trigger | Actor | Required references |
|-------|---------|-------|---------------------|
| `SELLER_LOGGED_IN` | Internal user logs in. | `INTERNAL_USER` | `tenantId`, `actorUserId` when tenant context is available. |
| `MOVEMENT_CREATED` | Movement is created. | `INTERNAL_USER` | `tenantId`, `actorUserId`, `propertyEngagementId`, `movementId`. |
| `PROPERTY_STATUS_CHANGED` | Movement changes engagement status. | `INTERNAL_USER` | `tenantId`, `actorUserId`, `propertyEngagementId`, `movementId`. |
| `OWNER_VIEWED_PROPERTY` | Owner reads property detail. | `OWNER` | `actorUserId`, `propertyAssetId`. |
| `DOCUMENT_REQUESTED` | Internal user creates document request. | `INTERNAL_USER` | `tenantId`, `actorUserId`, `propertyEngagementId`, `documentRequestId`. |
| `DOCUMENT_UPLOADED` | Owner confirms document upload. | `OWNER` | `actorUserId`, `documentRequestId`. |
| `DOCUMENT_APPROVED` | Internal user approves document. | `INTERNAL_USER` | `tenantId`, `actorUserId`, `documentRequestId`. |
| `DOCUMENT_REJECTED` | Internal user rejects document. | `INTERNAL_USER` | `tenantId`, `actorUserId`, `documentRequestId`. |

Deferred events:

- `OWNER_INVITED`
- `OWNER_ACTIVATED`
- `OWNER_VIEWED_DASHBOARD`
- `WHATSAPP_CONTACT_CLICKED`

Those product surfaces are not complete enough yet. Tracking them now would create fake confidence.

## Metadata rules

Allowed metadata examples:

```json
{
  "source": "owner_portal",
  "previousStatus": "CAPTURE",
  "newStatus": "ACTIVE_PUBLICATION"
}
```

Never store:

- emails
- names
- full addresses
- document content
- movement observations
- tokens
- passwords
- secrets

## Tracking failure rule

Analytics must not break the primary product flow.

If `AnalyticsService.track(...)` fails:

- creating the movement/document request/login/etc. should still succeed
- the failure should be isolated
- tests should prove the main use case still completes

This keeps analytics useful without making it a production reliability risk.

## Reporting endpoints

Manager-only internal endpoints:

- `GET /api/analytics/pilot-summary`
- `GET /api/analytics/inactive-engagements`
- `GET /api/analytics/events`

### `pilot-summary`

Returns weekly pilot health:

- active engagements count
- active engagements with movement updates this week
- north-star percentage
- document requested/uploaded/approved/rejected counts
- owner viewed property count

### `inactive-engagements`

Returns active engagements without a movement update in the selected window.

Default window: 7 days.

### `events`

Returns paginated event audit for the tenant.

## Access rules

- Reports are internal only.
- Managers/gerentes can view reports.
- Sellers/agents should not access aggregate pilot reports in the MVP.
- Cross-tenant access must be impossible because all queries are tenant-scoped.

## Implementation slices

### Slice 1 — Base analytics

- Prisma enums/model/migration.
- `AnalyticsModule`.
- Repository contract + Prisma implementation.
- `AnalyticsService`.
- Unit tests.
- No existing flows changed yet.

### Slice 2 — Emit backend events

- Track events from existing use cases.
- Ensure analytics failures do not break primary flows.
- Unit tests for emitted events and privacy-safe metadata.

### Slice 3 — Pilot reports

- Report use cases.
- Manager-only controller.
- E2E tests.
- Docs/roadmap updates.
- Full verification.

## Acceptance checklist

- [ ] Events are persisted internally.
- [ ] Event names use enums, not arbitrary strings.
- [ ] No sensitive data is stored in metadata.
- [ ] Analytics failures do not break primary flows.
- [ ] Movement/document/owner events are tracked.
- [ ] Pilot summary can compute weekly active-engagement update percentage.
- [ ] Inactive active engagements can be listed.
- [ ] Events audit is tenant-scoped and paginated.
- [ ] Reports are manager-only.
- [ ] Full verification passes.

## Out of scope

- PostHog integration.
- Frontend dashboards.
- Notifications.
- Owner-facing analytics.
- Revenue/billing metrics.
- Event backfill.
