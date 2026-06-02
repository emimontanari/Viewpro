# Stage 24 Real Notifications Design

Stage 24 replaces template/local notifications with persisted, recipient-scoped notifications. The design starts with a backend foundation so dashboard and owner UIs can later consume safe, filtered data instead of mock Zustand state.

## Decision

Build notifications as **persisted per-user records** with explicit surface separation.

| Topic | Decision |
|---|---|
| Realtime | Out of scope for MVP Stage 24. Use API-backed persisted notifications first. Polling can be added later if needed. |
| Storage | Add a Prisma `Notification` model. Analytics events remain analytics; they are not notification storage. |
| Recipient model | Store one row per recipient user. Broadcast-like behavior expands into multiple recipient rows later. |
| Surfaces | Use explicit `INTERNAL` and `OWNER` surfaces to prevent dashboard/owner leakage. |
| Links | Backend-generated and allowlisted. No arbitrary client-provided notification URLs. |
| First slice | Stage 24.1 should be backend-only: model, repository/use cases, internal read/unread API. |

## Why not realtime first?

Realtime does not solve the current product risk. The current risk is that notifications are fake, template-backed, and can point to routes that do not exist or are not safe for the current surface. Persisted API-backed notifications solve truthfulness, read state, and access filtering. Realtime can be layered later with polling, SSE, WebSocket, or push without changing the core notification model.

## Current state

Scout artifact: `context/stage-24-notifications-scout.md`.

Frontend findings:

- `viewpro-app/apps/app-new/src/features/notifications/utils/store.ts` contains mock Zustand notification data.
- `NotificationCenter` is rendered from the shared `Header`, which is used by both `/dashboard` and `/owner` layouts.
- Owner portal currently suppresses visible notifications client-side by forcing an empty source.
- Existing notification action routes are template routes such as `/dashboard/workspaces`, `/dashboard/billing`, `/dashboard/kanban`, and `/dashboard/chat`.
- `/dashboard/notifications` redirects to `/dashboard` and has a test that locks this behavior.

Backend findings:

- No notification model/API exists.
- Existing event sources already produce domain activity:
  - document request created;
  - owner document upload confirmed;
  - document approved/rejected;
  - movement/status update created;
  - inactive engagement analytics query.
- Existing auth patterns are suitable:
  - internal routes use tenant membership/permission guards;
  - owner routes use owner-access repository checks.

## Goals

Stage 24 is complete when:

- dashboard and owner notification surfaces are backed by real API data;
- users can see unread counts and mark notifications read;
- owners never see dashboard-only notifications;
- internal users never see cross-tenant notifications;
- notification links point only to real accessible routes;
- important document and movement events create notifications;
- empty states are honest when no notifications exist.

## Non-goals

- Realtime delivery in the first implementation.
- Email, push, WhatsApp Business API, or browser push notifications.
- Notification preferences.
- Scheduled stale notification generation until a scheduler/idempotency model exists.
- Arbitrary notification links from clients.
- Enabling `/dashboard/notifications` before it is API-backed.

## Data model

Add enums:

```prisma
enum NotificationSurface {
  INTERNAL
  OWNER
}

enum NotificationType {
  DOCUMENT_REQUESTED
  DOCUMENT_UPLOADED
  DOCUMENT_APPROVED
  DOCUMENT_REJECTED
  PROPERTY_STATUS_CHANGED
  MOVEMENT_CREATED
}
```

Add model:

```prisma
model Notification {
  id                   String              @id @default(uuid())
  tenantId             String?
  recipientUserId      String
  surface              NotificationSurface
  type                 NotificationType
  title                String
  body                 String?
  linkHref             String?
  propertyEngagementId String?
  propertyAssetId      String?
  documentRequestId    String?
  movementId           String?
  readAt               DateTime?
  createdAt            DateTime            @default(now())

  tenant             Tenant?             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipientUser      User                @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)
  propertyEngagement PropertyEngagement? @relation(fields: [propertyEngagementId], references: [id], onDelete: Cascade)
  propertyAsset      PropertyAsset?      @relation(fields: [propertyAssetId], references: [id], onDelete: Cascade)
  documentRequest    DocumentRequest?    @relation(fields: [documentRequestId], references: [id], onDelete: SetNull)
  movement           Movement?           @relation(fields: [movementId], references: [id], onDelete: SetNull)

  @@index([recipientUserId, surface, readAt, createdAt])
  @@index([tenantId, recipientUserId, surface, createdAt])
  @@index([tenantId, surface, createdAt])
  @@index([propertyEngagementId])
  @@index([propertyAssetId])
  @@index([documentRequestId])
  @@index([movementId])
  @@map("notifications")
}
```

Notes:

- `tenantId` is nullable for model flexibility, but ViewPro tenant-originated notifications should set it whenever known.
- Internal list queries must require `tenantId`.
- Owner list queries should filter by `recipientUserId + surface = OWNER` and validate links/refs through owner access when returning notification data.
- Notifications are not mutable except `readAt` for MVP.

## API shape

### Internal dashboard API

Backend routes under `/api/notifications`:

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/notifications` | List current user's notifications in current tenant. Supports pagination and unread-only filter. |
| `GET` | `/api/notifications/unread-count` | Return unread count for current user/current tenant/internal surface. |
| `POST` | `/api/notifications/:id/read` | Mark one current-user/current-tenant notification read. |
| `POST` | `/api/notifications/read-all` | Mark all current-user/current-tenant internal notifications read. |

Guarding:

- `AuthGuard`
- `TenantMembershipGuard`
- active membership check

Filtering:

```ts
where: {
  tenantId: currentTenantId,
  recipientUserId: currentUserId,
  surface: 'INTERNAL',
}
```

### Owner API

Backend routes under `/api/owner/notifications` in a later slice:

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/owner/notifications` | List current owner's owner-surface notifications. |
| `GET` | `/api/owner/notifications/unread-count` | Return unread owner-surface count. |
| `POST` | `/api/owner/notifications/:id/read` | Mark one owner notification read if current owner can access its linked owner resource. |
| `POST` | `/api/owner/notifications/read-all` | Mark all owner-surface notifications read for current owner. |

Guarding:

- `AuthGuard`
- no tenant membership requirement
- repository-level owner access checks for linked property/document refs

## Response shape

```ts
type NotificationResponse = {
  id: string;
  type: NotificationType;
  surface: 'INTERNAL' | 'OWNER';
  title: string;
  body: string | null;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
  refs: {
    propertyEngagementId?: string;
    propertyAssetId?: string;
    documentRequestId?: string;
    movementId?: string;
  };
};
```

No emails, names, phone numbers, property addresses, tenant names, or message bodies beyond notification title/body should be returned unless explicitly required by the notification itself. Titles/bodies should be generic enough to be safe in a header popover.

## Link policy

Links are generated by backend helpers from notification type and surface.

Allowlisted dashboard links:

- `/dashboard`
- `/dashboard/product/:propertyEngagementId`
- `/dashboard/seguimiento`
- `/dashboard/users`

Allowlisted owner links:

- `/owner`
- `/owner/properties/:propertyAssetId`

Rules:

- Internal notifications must never return `/owner/*` links.
- Owner notifications must never return `/dashboard/*` links.
- If the required id is missing or no route is safe, return `linkHref: null` rather than a fake fallback.

## Event hook policy

Event hooks should be added after read/unread APIs are stable.

Recommended order:

1. Document request created → owner notification.
   - Recipient: `DocumentRequest.ownerUserId` if present.
   - Surface: `OWNER`.
   - Link: `/owner/properties/:propertyAssetId` after resolving the engagement property.
2. Owner document upload confirmed → internal notification.
   - Initial recipient: `DocumentRequest.requestedByUserId`.
   - Surface: `INTERNAL`.
   - Link: `/dashboard/product/:propertyEngagementId`.
3. Document approved/rejected → owner notification.
   - Recipient: `DocumentRequest.ownerUserId` if present.
   - Surface: `OWNER`.
   - Link: owner property route.
4. Status-changing movement → owner notification.
   - Scope: owner-visible status updates only.
   - Surface: `OWNER`.
   - Link: owner property route.
5. Stale items → defer.
   - Needs scheduler or idempotent generation strategy.

## Frontend architecture

### Dashboard replacement

Replace local Zustand store only after internal backend API exists.

Files likely affected:

- `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx`
- `viewpro-app/apps/app-new/src/features/notifications/components/notifications-page.tsx`
- `viewpro-app/apps/app-new/src/features/notifications/utils/store.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/*`
- `viewpro-app/apps/app-new/src/features/notifications/api/service.ts`
- `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.tsx`

Behavior:

- Dashboard routes call dashboard notification BFF/API.
- Header badge uses real unread count.
- Empty state appears when API returns zero notifications.
- Template action route map is removed.
- `/dashboard/notifications` remains redirected until the API-backed full list is implemented.

### Owner replacement

Owner notification UI should use separate owner BFF/API routes.

Behavior:

- Owner routes must not call dashboard notification endpoints.
- Owner links must be owner-safe.
- If owner API is not implemented yet, owner header should remain honest empty state.

## Slice plan

### Stage 24.1 — backend notification foundation

Goal: create safe persisted internal notifications and read/unread API.

In scope:

- Prisma model/enums/migration.
- `NotificationsModule`.
- Repository and use cases for internal notifications.
- Internal controller routes:
  - list;
  - unread count;
  - mark one read;
  - mark all read.
- Tests for tenant/recipient/surface filtering.
- Link helper with allowlisted internal links.

Out of scope:

- Frontend replacement.
- Owner notification API/UI.
- Domain event hooks.
- Realtime.

Review forecast: backend-only, medium. If migration + module + tests exceed 400 changed lines, split into:

1. model/repository/use-case tests;
2. controller/e2e/API tests.

### Stage 24.2 — dashboard notification UI

Goal: replace dashboard mock store with API-backed notifications.

In scope:

- app-new BFF routes for internal notifications;
- frontend service/types;
- `NotificationCenter` dashboard API integration;
- honest empty state;
- optional `/dashboard/notifications` page if budget allows.

Out of scope:

- owner notifications;
- event hooks;
- realtime.

### Stage 24.3 — owner notifications

Goal: add owner-safe notification API and owner header UI.

In scope:

- owner notification backend endpoints;
- owner BFF routes;
- owner header notifications;
- owner-safe link filtering.

Out of scope:

- broad event hooks beyond test seed/helper notifications unless budget allows.

### Stage 24.4 — event hooks

Goal: create real notifications from document and movement events.

Split by event family if needed:

- 24.4a documents: request/upload/approve/reject;
- 24.4b movements/status updates;
- 24.4c stale items only after scheduler/idempotency decision.

## Testing strategy

### Backend

Use strict TDD for Stage 24.1.

Test categories:

- repository filtering:
  - internal user sees only own `tenantId + recipientUserId + INTERNAL` rows;
  - cross-tenant rows are hidden;
  - other recipient rows are hidden;
  - owner-surface rows are hidden from internal list;
- read mutations:
  - mark one read affects only current user's current-tenant row;
  - mark all read affects only current user's current-tenant internal rows;
  - unread count respects filtering;
- controller/use-case:
  - auth/tenant guard behavior follows existing internal route patterns;
  - response shape is stable and safe.

### Frontend later

- Dashboard header fetches dashboard notification endpoint and shows unread badge.
- Owner route does not fetch dashboard notifications.
- Empty state is honest.
- Links use backend `linkHref`, not hardcoded template action maps.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Owner sees dashboard notifications | Separate `surface` and separate owner/dashboard endpoints. |
| Internal user sees cross-tenant notifications | Always filter internal list/mutations by `tenantId + recipientUserId + surface`. |
| Fake or unsafe routes leak into UI | Backend-generated allowlisted links only. |
| Event hooks balloon first PR | Defer event hooks until after model/API foundation. |
| Realtime distracts from MVP | Persisted API first; polling/realtime is future enhancement. |
| Stale item notifications duplicate endlessly | Defer stale until scheduler or idempotency key exists. |

## Open decisions for implementation planning

Recommended defaults:

| Question | Recommended answer |
|---|---|
| Per-user vs broadcast | Per-user rows. Broadcast expands into rows later. |
| Internal upload recipient | Start with `requestedByUserId`; expand to assigned agents/managers later if product needs it. |
| Movement owner notifications | Limit to owner-visible status updates first. |
| Owner document deep links | Use property detail route first; anchors/query params can be added later. |
| Stale notifications | Defer until a scheduler/idempotency design exists. |

## Next step

If this design is approved, write the Stage 24.1 implementation plan for the backend notification foundation only.
