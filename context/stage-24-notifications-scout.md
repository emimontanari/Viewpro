# Stage 24 Notifications Scout

## Scope

Read-only SDD Explore for Stage 24 real notifications.

Roadmap goal:

- make notification center truthful and API-backed;
- add notification model/API;
- replace local/template notification store;
- notify internal users for document uploads, stale items, and relevant activity;
- notify owners for document requests, review results, and status updates;
- add read/unread and owner-safe/dashboard-safe filtering.

Session preflight:

- mode: interactive;
- artifacts: `docs/plans` + Engram memory;
- PR strategy: auto forecast;
- review budget: 400 changed lines per PR.

## Files retrieved

1. `docs/plans/2026-05-28-mvp-product-final-like-roadmap-design.md` — Stage 24 goal and acceptance constraints.
2. `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx` — current header popover uses local mock store, hardcoded template links, owner portal suppression.
3. `viewpro-app/apps/app-new/src/features/notifications/components/notifications-page.tsx` — dormant full notifications page UI with local store and hardcoded routes.
4. `viewpro-app/apps/app-new/src/features/notifications/utils/store.ts` — Zustand mock/template notification source.
5. `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.tsx` — route currently redirects to `/dashboard`.
6. `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.test.ts` — test locks redirect behavior until real notifications exist.
7. `viewpro-app/apps/app-new/src/components/ui/notification-card.tsx` — reusable card types/actions/status UI.
8. `viewpro-app/apps/app-new/src/components/layout/header.tsx` — notification center mounted in dashboard and owner layouts.
9. `viewpro-app/apps/app-new/src/app/owner/layout.tsx` — owner layout also renders shared `Header`.
10. `viewpro-app/apps/api/prisma/schema.prisma` — no notification model; key user/tenant/owner/document/movement/analytics relations.
11. `viewpro-app/apps/api/src/documents/documents.controller.ts` — internal document request/review endpoints.
12. `viewpro-app/apps/api/src/documents/owner-documents.controller.ts` — owner document request/upload/read endpoints.
13. `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts` — document request event source, currently tracks analytics only.
14. `viewpro-app/apps/api/src/documents/use-cases/confirm-owner-document-upload.use-case.ts` — owner upload event source, analytics lacks tenantId here.
15. `viewpro-app/apps/api/src/movements/use-cases/create-movement.use-case.ts` — movement/status-change event source.
16. `viewpro-app/apps/api/src/analytics/use-cases/list-inactive-engagements.use-case.ts` — stale/inactive source candidate.
17. `viewpro-app/apps/api/src/owner-portal/owner-portal.controller.ts` — real owner-safe routes available today.
18. `viewpro-app/apps/app-new/src/features/activity/components/activity-monitor.tsx` — internal activity/stale counters surface.
19. `viewpro-app/apps/api/src/permissions/role-permissions.ts` — internal tenant role permissions.

## Current state map

### Frontend

- `NotificationCenter` is shared by dashboard and owner layouts through `Header`.
- It currently reads local Zustand mock data from `features/notifications/utils/store.ts`.
- In `/owner`, it suppresses visible notifications by forcing an empty source, but the owner layout still renders the component.
- Action links are template/hardcoded and not Stage 24-safe:
  - `/dashboard/workspaces`
  - `/dashboard/product`
  - `/dashboard/billing`
  - `/dashboard/kanban`
  - `/dashboard/chat`
- `NotificationsPage` exists but uses the same local store.
- `/dashboard/notifications` intentionally redirects to `/dashboard`, and a test locks that behavior.

### Backend

- No `Notification` model or API exists.
- Existing analytics events are not suitable as notification storage because notifications require recipient-specific read state.
- Nest modules already use clear auth patterns:
  - internal document endpoints: `AuthGuard + TenantMembershipGuard + PermissionGuard`;
  - owner endpoints: `AuthGuard` plus repository-level owner access.

## Identity and isolation primitives

- Internal access is tenant-membership based: `TenantMembership` with `tenantId`, `role`, and `status`.
- Owner access is property-owner-link based: `PropertyAssetOwner` with `userId`, `propertyAssetId`, and `accessStatus`.
- Owner-only users can have no tenant memberships.
- Document requests carry useful notification context:
  - `tenantId`
  - `propertyEngagementId`
  - `propertyAssetOwnerId`
  - `ownerUserId`
  - `requestedByUserId`
- Movements carry:
  - `tenantId`
  - `propertyEngagementId`
  - `createdByUserId`

## Real route targets available today

Dashboard/internal:

- `/dashboard`
- `/dashboard/product/[productId]`, where `productId` is the property engagement id
- `/dashboard/seguimiento`
- `/dashboard/users`

Owner:

- `/owner`
- `/owner/properties/[propertyId]`, where `propertyId` is property asset id

Avoid for Stage 24:

- `/dashboard/notifications` until implemented;
- template routes: `/dashboard/workspaces`, `/dashboard/product` without id, `/dashboard/billing`, `/dashboard/kanban`, `/dashboard/chat`;
- fake document preview URLs.

## Event sources

Best first hooks, after foundation exists:

1. Document request created
   - Notify owner when `ownerUserId` exists.
   - Link: `/owner/properties/[propertyAssetId]` or a future owner document section anchor.
2. Document review result
   - Notify owner on approved/rejected.
   - Link: owner property route.
3. Owner upload confirmed
   - Notify internal requester or responsible internal recipient.
   - Link: `/dashboard/product/[propertyEngagementId]`.
4. Movement/status update
   - Notify owner only if the movement/status is owner-visible.
   - Link: owner property route.
5. Stale items
   - Defer unless there is a scheduler/job; current stale logic is query-time analytics.

## Recommended model direction

A persisted per-recipient notification row is preferred.

Likely fields:

- `id`
- `tenantId` nullable only when truly not tenant-originated; for ViewPro owner/internal notifications, keep tenant where available
- `recipientUserId`
- `surface` or `audience`: `INTERNAL` / `OWNER`
- `type`
- `title`
- `body`
- `linkHref`
- optional refs:
  - `propertyEngagementId`
  - `propertyAssetId`
  - `documentRequestId`
  - `movementId`
- `readAt`
- `createdAt`

Rules:

- Internal list endpoint filters by `tenantId + recipientUserId + surface = INTERNAL` and requires active membership.
- Owner list endpoint filters by `recipientUserId + surface = OWNER`, and owner-access-related links must be safe for current owner.
- Backend should generate/allowlist links. Do not accept arbitrary client-provided URLs for notification creation.

## Proposed Stage 24 slices

### Stage 24.1 — backend notification foundation

Risk: medium. Keep backend-only to stay near review budget.

- Add Prisma model + migration.
- Add notification repository/use cases.
- Add internal API:
  - list current tenant/current user notifications;
  - unread count;
  - mark one read;
  - mark all read.
- Optionally add owner API if line budget allows, but avoid frontend replacement in same PR.
- Seed/create notifications only in tests/repository helpers; no broad event hooks yet.

### Stage 24.2 — dashboard frontend replacement

Risk: medium.

- Add BFF routes under `app/api/notifications`.
- Add app-new notification service/query hooks.
- Replace dashboard mock store usage in `NotificationCenter`.
- Keep owner popover from calling dashboard endpoints.
- Only enable `/dashboard/notifications` after API-backed list is real.

### Stage 24.3 — owner notification API and owner-safe UI

Risk: medium-high.

- Add owner notification backend endpoint.
- Add app-new BFF owner notification routes.
- Show owner-safe notifications in owner header.
- Links limited to `/owner` and `/owner/properties/[propertyId]`.

### Stage 24.4 — event hooks

Risk: high if broad. Split further if needed.

- Document request → owner notification.
- Document upload → internal notification.
- Approve/reject → owner notification.
- Movement status update → owner notification only if owner-visible.
- Defer stale notifications unless scheduler/background job exists.

## Recommended Stage 24.1 design direction

Start with **backend model/API/read-unread foundation**, not frontend replacement.

Reason:

- Stage 24 acceptance is primarily authorization/isolation.
- Replacing the local UI before the backend contract exists risks owner/dashboard leakage.
- A tested backend recipient/surface model gives later UI slices a safe source of truth.

Stage 24.1 should likely be backend-only:

- Prisma model.
- Internal notification API.
- Maybe owner API if still reviewable, otherwise defer.
- Explicit link allowlist/generation pattern.
- Unit/repository tests for recipient and tenant filtering.
- E2E tests for internal endpoint if local DB is available; otherwise focused repository/use-case tests plus CI.

## Test strategy candidates

Backend:

- Repository tests for tenant/recipient filtering.
- Use-case/controller tests:
  - internal user only sees own tenant notifications;
  - owner does not see internal/dashboard notifications;
  - mark-read rejects/not found for other recipient/tenant;
  - mark-all-read affects only current recipient/tenant/surface.
- Event hook tests in later slices.

Frontend later:

- Dashboard `NotificationCenter` calls dashboard endpoint and shows unread badge.
- Owner route does not call dashboard endpoint.
- Empty state is honest when API returns empty.
- BFF route tests mirror existing app-new BFF style.
- Update redirect test only when `/dashboard/notifications` becomes real.

## Risks

- Shared `Header` can accidentally fetch dashboard notifications in owner portal.
- Arbitrary notification links can violate access constraints.
- Owner upload analytics currently lacks `tenantId`; notification event hooks may need repository lookup to derive context.
- Stale notifications need scheduling/idempotency; current stale logic is query-time only.
- Broad event hooks can create a large review diff across documents, movements, owner portal, and frontend.

## Out of scope for Stage 24.1

- Realtime/websocket/push/email.
- Stale scheduled notification generation.
- Notification preferences.
- Archiving/deleting unless model requires it.
- Broad event hook integration.
- Enabling `/dashboard/notifications` full page before API replacement.
- Owner notification UI if backend foundation alone approaches budget.

## Open questions

1. Should notifications be per-user only, or should role/team broadcast expand into per-user rows?
2. For internal document upload notifications, who receives them: requester only, assigned agents, managers, or all with review permission?
3. Are movement/status owner notifications limited to owner-visible timeline items?
4. Should owner document request links target property detail only, or support deep-link anchors/query params?
5. Is a background scheduler planned for stale items, or should stale notifications be generated lazily/idempotently from analytics queries?

## Skill resolution

`paths-injected`
