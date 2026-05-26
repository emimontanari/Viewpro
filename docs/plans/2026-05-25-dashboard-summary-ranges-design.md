# Dashboard Summary Ranges Design

## Goal
Make `/dashboard` Inicio consume backend-owned operational analytics with a default 7-day range and user-selectable 7/14/30 day presets.

## Context
PR #14 introduced a useful operational homepage in `apps/app-new`, but property and seller insights are derived in the browser from the latest 20 activity-feed items. That is acceptable for a visual MVP, but not enough for reliable operational visibility. The next slice should move summary ownership to the backend while keeping the UI focused and familiar.

## User Need
When an inmobiliaria enters ViewPro, they should quickly understand:
- what moved in the selected period;
- which properties have the most movement;
- which sellers are generating movement;
- which work should be attended first.

The default view should be the last 7 days, with quick switches to 14 and 30 days.

## Scope
### Slice 1 — Backend dashboard summary
- Add `GET /analytics/dashboard-summary?range=7d|14d|30d`.
- Default `range` to `7d`.
- Reject unsupported `range` values with validation errors instead of silently falling back.
- Resolve a rolling UTC-ish window from `now - days` to `now`.
- Keep endpoint tenant-scoped through the existing tenant guard/header flow.
- Keep permission aligned with existing aggregate analytics endpoints: `ENGAGEMENTS_VIEW_ALL`.
- Return counters, recent activity, top properties, and top sellers for the selected window.

### Slice 2 — app-new BFF/query layer
- Add `src/app/api/dashboard/summary/route.ts` in `apps/app-new`.
- Proxy to `/analytics/dashboard-summary` using existing `bffFetch` tenant/cookie forwarding.
- Forward only supported range presets from app-new (`7d`, `14d`, `30d`); omit unsupported frontend query values so the backend default applies.
- Add dashboard API types, service, and React Query options.
- Include the active tenant id and selected range in query keys.

### Slice 3 — Inicio UI range selector
- Add a 7/14/30 day selector to the operational homepage.
- Default to 7 days.
- Refetch dashboard summary when the range changes.
- Replace frontend-derived top property/seller summaries with backend summary data.
- Keep current layout and visual direction; do not redesign the page again.

## Non-Goals
- No custom date picker in this slice.
- No charts.
- No notifications.
- No owner portal changes.
- No schema migration unless implementation proves unavoidable.
- No changes to `/analytics/pilot-summary` semantics.
- No cleanup of remaining template routes in this PR.
- No movement creation workflow changes.

## Proposed API Contract
```ts
export type DashboardSummaryRange = '7d' | '14d' | '30d';

export type DashboardSummaryResponse = {
  range: {
    preset: DashboardSummaryRange;
    from: string;
    to: string;
  };
  counters: {
    activeProperties: number;
    movementsInRange: number;
    staleProperties: number;
    attentionNeeded: number;
  };
  recentActivity: ActivityFeedItem[];
  topProperties: Array<{
    engagementId: string;
    propertyId: string;
    title: string | null;
    addressLine: string | null;
    city: string | null;
    province: string | null;
    status: PropertyEngagementStatus;
    operationType: PropertyOperationType;
    agents: ProductAgent[];
    movementCount: number;
    documentRequestCount: number;
    lastActivityAt: string;
    lastActivityTitle: string;
  }>;
  topSellers: Array<{
    userId: string;
    name: string;
    email: string;
    movementCount: number;
    touchedPropertiesCount: number;
    lastMovementAt: string;
  }>;
};
```

## Data Semantics
- `movementsInRange`: movement activity count in the selected rolling window for non-archived active properties.
- `staleProperties`: non-archived active properties without a recent visible update in the selected window.
- `attentionNeeded`: non-archived active properties whose latest attention movement has no next step.
- `topProperties`: non-archived active properties sorted by total activity in range, then latest activity timestamp.
- `topSellers`: sellers sorted by manual movement count on non-archived active properties in range, then latest movement timestamp.
- Document requests contribute to property activity, but not seller movement ranking.
- Recent activity remains mixed movement/document activity and should link to property detail.

## Frontend UX
- Selector labels:
  - `7 días`
  - `14 días`
  - `30 días`
- Default selected label: `7 días`.
- Insight badge should reflect selected range, e.g. `Últimos 7 días`.
- Update KPI copy:
  - `Movimientos del período`
  - `Sin novedades en 7 días` / `14 días` / `30 días`
- Loading should keep the dashboard shell stable.
- If summary fails, keep an inline non-technical error and avoid crashing the page.

## Testing Strategy
### Backend
- Unit/use-case tests for:
  - default `7d` range;
  - `14d` and `30d` presets;
  - invalid range validation behavior;
  - repository calls use the expected tenant/window;
  - ranking sort order.
- E2E tests for:
  - authenticated tenant-scoped endpoint;
  - default response;
  - preset response;
  - invalid query validation;
  - archived active-status properties are not counted or ranked.

### app-new
- BFF route test:
  - forwards default/no range correctly;
  - forwards valid range;
  - strips/normalizes unsupported values according to final backend behavior.
- Component tests:
  - default range is 7 days;
  - selecting 14/30 updates query and labels;
  - summary data renders top properties/sellers;
  - loading/missing tenant states remain stable.

## Review Workload
Expected files: 10-14.
Expected diff: medium, mostly tests and DTO/types.
Bundling is acceptable because all slices serve one feature: backend-owned dashboard summary ranges.

## Future Follow-Up
- Add custom date range only after users need it.
- Add charts only after summary data semantics settle.
- Consider a dedicated analytics materialized view/cache if query cost grows.
