# Owner Portal Read-only Design

## Context

ViewPro's MVP promise is that a seller can update a property engagement and the owner can understand what is happening without asking over WhatsApp.

The backend already exposes owner-scoped read APIs under `/api/owner/*`. These APIs use the authenticated user id and `PropertyAssetOwner.accessStatus = ACTIVE`; they do not depend on tenant membership. The active `app-new` UI does not yet expose this owner experience.

## Goal

Add a first owner portal slice to `viewpro-app/apps/app-new` so an authenticated property owner can:

- enter a dedicated owner portal;
- see their active properties;
- open a property detail;
- see active engagements and assigned agents;
- read the visible commercial timeline.

## Non-goals

This slice does not include:

- document upload;
- document review/approval;
- invitation activation;
- WhatsApp tracking;
- owner account self-registration;
- backend schema changes;
- a shared `/dashboard` owner experience;
- changes to seller or manager dashboards.

Document requests are intentionally deferred to the next owner slice. The first owner portal must prove the core follow-up loop before adding mutations.

## Route Strategy

Use a separate owner route tree:

```txt
/owner
/owner/properties/[propertyId]
```

Do not place this experience under `/dashboard`. The dashboard shell assumes tenant membership, workspace navigation, an organization switcher, and internal roles. Owner access is property-link based and may have no tenant membership.

## Layout

Create a minimal owner layout:

```txt
viewpro-app/apps/app-new/src/app/owner/layout.tsx
```

The layout should include:

- ViewPro brand;
- `Portal propietario` label;
- authenticated user identity when available;
- sign-out action;
- no sidebar;
- no organization switcher;
- no tenant selection dependency.

This keeps the owner experience focused and avoids exposing internal workspace navigation.

## BFF/API Layer

Add `app-new` BFF route handlers that proxy to existing backend owner endpoints:

```txt
GET /api/owner/properties
GET /api/owner/properties/[id]
GET /api/owner/properties/[id]/engagements
GET /api/owner/engagements/[id]/timeline
```

The backend endpoints already exist:

```txt
GET /api/owner/properties
GET /api/owner/properties/:propertyAssetId
GET /api/owner/properties/:propertyAssetId/engagements
GET /api/owner/engagements/:engagementId/timeline
```

The BFF should follow existing `app-new` same-origin service patterns. It can reuse the shared BFF fetch utility, but the owner feature must not rely on selected tenant state.

## Frontend Feature Structure

Add a dedicated owner feature module, for example:

```txt
src/features/owner/api/service.ts
src/features/owner/api/queries.ts
src/features/owner/api/types.ts
src/features/owner/components/owner-property-list.tsx
src/features/owner/components/owner-property-detail.tsx
src/features/owner/components/owner-engagement-card.tsx
src/features/owner/components/owner-timeline.tsx
```

Avoid reusing product forms or internal dashboard components that carry manager/seller mutations. Reuse only low-level UI primitives such as cards, badges, buttons, and page containers.

## Owner Home

`/owner` should show:

- welcome copy for the authenticated owner;
- total active owner properties;
- a card/list of owner-visible properties;
- empty state when the owner has no active property access.

Each property card should link to:

```txt
/owner/properties/[propertyId]
```

## Owner Property Detail

`/owner/properties/[propertyId]` should show:

- property title and location;
- operation/status information through owner-visible engagements;
- assigned agents;
- read-only timeline grouped by engagement.

If an owner opens a property they cannot access, the backend should return `404`; the UI should show a friendly not-found/error state.

## Timeline

The timeline is read-only. It should display:

- movement type;
- observation;
- next step when present;
- updated status when present;
- interest/visit counts when present;
- author label;
- created date.

No owner mutation is included.

## Demo Seed

Current demo seed creates owner reference/link rows as `INVITED` and without `userId`, so they are not visible through owner APIs.

Add one real owner demo user:

```txt
propietario.demo@viewpro.local
password: viewpro-demo-local
```

Then link that user to one deterministic demo property with:

```txt
PropertyAssetOwner.userId = owner.id
PropertyAssetOwner.accessStatus = ACTIVE
```

The linked property must already have at least one movement so the timeline smoke can assert visible activity.

## Seeded Smoke

Extend seeded Playwright coverage:

1. login as `propietario.demo@viewpro.local`;
2. visit `/owner`;
3. assert owner portal heading/copy;
4. assert the seeded owned property is visible;
5. open the owner property detail;
6. assert property detail and at least one timeline item are visible;
7. assert no internal manager/seller actions such as `Nueva propiedad` are visible.

## Permissions and Security

The owner frontend must rely on backend enforcement. The backend owner APIs already scope by authenticated `userId` and active owner access. The UI should not try to derive access from tenant membership.

A misleading or stale selected tenant cookie should not grant or remove owner access. Owner routes must function for authenticated users with no tenant memberships.

## Testing

Expected validation:

```bash
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter @viewpro/api typecheck
```

Run focused tests first while developing. Run seeded smoke sequentially because it uses shared local services and seeded database state.

## Rollout

This should ship as one focused PR:

```txt
feat(app-new): add owner readonly portal
```

If the diff grows too large, split follow-up document-request read UI into a separate slice.
