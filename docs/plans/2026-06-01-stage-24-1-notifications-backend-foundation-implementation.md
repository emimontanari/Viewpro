# Stage 24.1 Notifications Backend Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Stage 24.1 backend-only notification foundation: Prisma notification storage plus internal-only `/api/notifications` read/unread endpoints with strict tenant/user/surface isolation.

**Architecture:** Persist one notification row per recipient user. Stage 24.1 only supports the `INTERNAL` surface API; owner notifications, frontend replacement, realtime, and event hooks are later slices. Every internal query/mutation is scoped by current tenant, current user, and `NotificationSurface.INTERNAL`.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Vitest, existing ViewPro auth/tenant/permission guards.

---

## Review strategy

The full Stage 24.1 backend foundation is likely too large for the 400 changed-line review budget once schema, migration, module, repository, use cases, controller, and tests are included.

Use two PRs unless implementation evidence proves the combined diff remains reviewable:

| Slice | Scope | Forecast |
|---|---|---|
| Stage 24.1a | Persistence + domain foundation: Prisma model/migration, repository, mapper, internal link allowlist, repository/use-case tests. | ~350-450 changed lines |
| Stage 24.1b | Internal API surface: module, controller, DTO, AppModule registration, controller/e2e tests. | ~250-380 changed lines |

Stage 24.1 is complete only after both slices land.

Do not implement frontend/BFF/UI, owner notification API, event hooks, realtime, stale notifications, notification preferences, or delete/archive behavior in Stage 24.1.

---

## Endpoint contracts

### `GET /api/notifications`

Query:

```ts
{
  page?: number;      // default 1, min 1
  pageSize?: number;  // default 20, min 1, max 50
  unreadOnly?: boolean;
}
```

Response:

```ts
{
  total: number;
  page: number;
  pageSize: number;
  items: NotificationResponse[];
}
```

### `GET /api/notifications/unread-count`

Response:

```ts
{
  unreadCount: number;
}
```

### `POST /api/notifications/:id/read`

Response:

```ts
NotificationResponse
```

Behavior:

- `200` if the current user owns the current-tenant internal notification.
- `404` if missing, cross-tenant, other-recipient, or non-internal surface.
- Idempotent when already read.

### `POST /api/notifications/read-all`

Response:

```ts
{
  updatedCount: number;
}
```

Behavior:

- Only marks unread rows matching current tenant, current user, and `INTERNAL` surface.

### `NotificationResponse`

```ts
{
  id: string;
  type:
    | 'DOCUMENT_REQUESTED'
    | 'DOCUMENT_UPLOADED'
    | 'DOCUMENT_APPROVED'
    | 'DOCUMENT_REJECTED'
    | 'PROPERTY_STATUS_CHANGED'
    | 'MOVEMENT_CREATED';
  surface: 'INTERNAL';
  title: string;
  body: string | null;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
  refs: {
    propertyEngagementId: string | null;
    propertyAssetId: string | null;
    documentRequestId: string | null;
    movementId: string | null;
  };
}
```

Do not expose:

- `tenantId`;
- `recipientUserId`;
- owner-only links;
- arbitrary/external URLs.

---

## Permission and isolation rules

All internal notification routes use:

- `AuthGuard`;
- `TenantMembershipGuard`;
- `PermissionGuard`;
- `PERMISSIONS.TENANT_VIEW`.

Every repository query/mutation must include:

```ts
{
  tenantId: currentTenantId,
  recipientUserId: currentUserId,
  surface: NotificationSurface.INTERNAL,
}
```

Owner-only users with no tenant membership must receive `403` from `TenantMembershipGuard`.

Owner-surface notifications must never be returned from `/api/notifications`.

Cross-tenant and other-recipient notifications must never be counted, listed, or mutated.

---

## Data model

Add enums to `viewpro-app/apps/api/prisma/schema.prisma`:

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

Add inverse relation arrays to:

- `User`;
- `Tenant`;
- `PropertyEngagement`;
- `PropertyAsset`;
- `DocumentRequest`;
- `Movement`.

---

## Stage 24.1a — persistence and domain foundation

### Task 1: Add failing repository tests

**Files:**

- Create: `viewpro-app/apps/api/test/notifications.repository.spec.ts`

**Step 1: Test Prisma enums**

Write RED tests expecting Prisma Client to expose:

```ts
NotificationSurface.INTERNAL
NotificationSurface.OWNER
NotificationType.DOCUMENT_REQUESTED
NotificationType.DOCUMENT_UPLOADED
NotificationType.DOCUMENT_APPROVED
NotificationType.DOCUMENT_REJECTED
NotificationType.PROPERTY_STATUS_CHANGED
NotificationType.MOVEMENT_CREATED
```

**Step 2: Test repository filtering**

Add tests for a future `PrismaNotificationsRepository` using mocked Prisma methods:

- list only `tenantId + recipientUserId + INTERNAL`;
- `unreadOnly` adds `readAt: null`;
- unread count filters by tenant/user/internal;
- mark-one-read scopes by tenant/user/internal;
- mark-all-read scopes by tenant/user/internal.

**Step 3: Run RED test**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.repository.spec.ts
```

Expected: fail because Prisma enums/model and repository do not exist.

---

### Task 2: Add Prisma schema and migration

**Files:**

- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_notifications/migration.sql`

**Step 1: Add schema**

Add enums, model, and inverse relations from the data model section.

**Step 2: Validate schema**

Run:

```bash
pnpm --dir viewpro-app/apps/api db:validate
```

Expected: pass.

**Step 3: Create migration**

Run:

```bash
pnpm --dir viewpro-app/apps/api prisma migrate dev --name add_notifications
pnpm --dir viewpro-app/apps/api db:generate
```

Expected: migration applies locally and Prisma Client exposes notification enums/model.

If local DB is unavailable, manually create the migration SQL and still run:

```bash
pnpm --dir viewpro-app/apps/api db:validate
pnpm --dir viewpro-app/apps/api db:generate
```

---

### Task 3: Create repository contract

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/notifications.repository.ts`

**Step 1: Add token and record type**

Create:

```ts
export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');
```

Define `NotificationRecord` with fields matching the Prisma model fields required by API responses.

**Step 2: Add method inputs**

Define inputs for:

- `createInternal`;
- `listInternalForRecipient`;
- `countUnreadInternalForRecipient`;
- `markInternalRead`;
- `markAllInternalRead`.

All internal methods must require `tenantId` and `recipientUserId` at the contract boundary.

**Step 3: Add repository interface**

Expose methods:

```ts
createInternal(input): Promise<NotificationRecord>;
listInternalForRecipient(input): Promise<{ items: NotificationRecord[]; total: number }>;
countUnreadInternalForRecipient(input): Promise<number>;
markInternalRead(input): Promise<NotificationRecord | null>;
markAllInternalRead(input): Promise<number>;
```

Expected: typecheck may fail until implementation/use cases are added.

---

### Task 4: Add internal link allowlist helper

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`
- Modify: `viewpro-app/apps/api/test/notifications.repository.spec.ts`

**Step 1: Write helper tests**

Cover:

- `/dashboard` is allowed;
- `/dashboard/seguimiento` is allowed;
- `/dashboard/users` is allowed;
- `/dashboard/product/:propertyEngagementId` is allowed only with an engagement id;
- `/owner/*` returns `null`;
- external URLs return `null`;
- unknown `/dashboard/*` template routes return `null`.

**Step 2: Implement helper**

Create a helper such as:

```ts
export function sanitizeInternalNotificationLink(input: {
  linkHref?: string | null;
  propertyEngagementId?: string | null;
}): string | null
```

Allowed paths only:

- `/dashboard`;
- `/dashboard/seguimiento`;
- `/dashboard/users`;
- `/dashboard/product/${propertyEngagementId}`.

**Step 3: Run tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.repository.spec.ts
```

Expected: helper tests pass once implemented; repository tests may still fail until repository implementation exists.

---

### Task 5: Implement Prisma notifications repository

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts`
- Modify: `viewpro-app/apps/api/test/notifications.repository.spec.ts`

**Step 1: Implement strict filters**

Every internal repository method must constrain:

```ts
{
  tenantId,
  recipientUserId,
  surface: NotificationSurface.INTERNAL,
}
```

**Step 2: Implement list**

List behavior:

- order by `createdAt desc`, then `id desc`;
- pagination with `skip` and `take`;
- optional `unreadOnly` adds `readAt: null`;
- return `{ items, total }`.

**Step 3: Implement unread count**

Count rows matching tenant/user/internal and `readAt: null`.

**Step 4: Implement mark one read**

Behavior:

- find scoped notification first;
- return `null` if absent;
- preserve existing `readAt` if already read;
- set `readAt` to `now` if unread;
- return updated/current record.

**Step 5: Implement mark all read**

Behavior:

- update only unread rows matching tenant/user/internal;
- return updated count.

**Step 6: Run GREEN tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.repository.spec.ts
```

Expected: repository tests pass.

---

### Task 6: Add response mapper

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/notification-response.mapper.ts`
- Modify: `viewpro-app/apps/api/test/notifications.repository.spec.ts`

**Step 1: Add mapper tests**

Assert:

- `createdAt` and `readAt` use ISO strings;
- `readAt` is `null` when unread;
- refs are returned under `refs`;
- `tenantId` and `recipientUserId` are omitted;
- unsafe links become `null`;
- internal safe links are preserved.

**Step 2: Implement mapper**

Return:

```ts
{
  id,
  type,
  surface,
  title,
  body,
  linkHref,
  readAt,
  createdAt,
  refs: {
    propertyEngagementId,
    propertyAssetId,
    documentRequestId,
    movementId,
  },
}
```

Use the internal link helper before returning `linkHref`.

**Step 3: Run tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.repository.spec.ts
```

Expected: repository/helper/mapper tests pass.

---

### Task 7: Add failing use-case tests

**Files:**

- Create: `viewpro-app/apps/api/test/notifications.use-cases.spec.ts`

**Step 1: Test list use case**

Assert it passes current tenant id and current user id into repository and returns mapped list response.

**Step 2: Test unread count use case**

Assert it returns:

```ts
{ unreadCount: number }
```

**Step 3: Test mark one read use case**

Assert:

- accessible notification returns mapped response;
- missing/inaccessible notification throws `NotFoundException('Notification not found')`.

**Step 4: Test mark all read use case**

Assert it returns:

```ts
{ updatedCount: number }
```

**Step 5: Run RED tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.use-cases.spec.ts
```

Expected: fail because use cases do not exist.

---

### Task 8: Implement internal notification use cases

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/use-cases/list-notifications.use-case.ts`
- Create: `viewpro-app/apps/api/src/notifications/use-cases/get-unread-notifications-count.use-case.ts`
- Create: `viewpro-app/apps/api/src/notifications/use-cases/mark-notification-read.use-case.ts`
- Create: `viewpro-app/apps/api/src/notifications/use-cases/mark-all-notifications-read.use-case.ts`

**Step 1: Implement list**

Accept current tenant/current user and query pagination. Call repository with current tenant id and current user id.

**Step 2: Implement unread count**

Return `{ unreadCount }`.

**Step 3: Implement mark one read**

Call repository scoped to current tenant/current user. Throw `NotFoundException('Notification not found')` when repository returns `null`.

**Step 4: Implement mark all read**

Return `{ updatedCount }`.

**Step 5: Run tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.use-cases.spec.ts
```

Expected: use-case tests pass.

---

## Stage 24.1b — internal API surface

### Task 9: Add list query DTO

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/dto/list-notifications.query.ts`

**Step 1: Define validated query**

Fields:

- `page = 1`, int, min 1;
- `pageSize = 20`, int, min 1, max 50;
- `unreadOnly = false`, boolean transform from query string.

Follow existing DTO validation patterns in the API.

---

### Task 10: Add notifications controller

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/notifications.controller.ts`

**Step 1: Add controller shell**

Use:

```ts
@Controller('notifications')
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
```

Add `@RequirePermissions(PERMISSIONS.TENANT_VIEW)` on all routes.

**Step 2: Add routes**

Routes:

- `GET /api/notifications`;
- `GET /api/notifications/unread-count`;
- `POST /api/notifications/:id/read`;
- `POST /api/notifications/read-all`.

Inject and call the four use cases.

No request body is required for POST routes.

---

### Task 11: Create and register NotificationsModule

**Files:**

- Create: `viewpro-app/apps/api/src/notifications/notifications.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Add module imports**

Imports should mirror existing guarded modules and include as needed:

- `AuthModule`;
- `MembershipsModule`;
- `PermissionsModule`;
- `TenantContextModule`.

**Step 2: Add providers**

Providers:

- repository token bound to `PrismaNotificationsRepository`;
- four use cases.

**Step 3: Add controller**

Register `NotificationsController`.

**Step 4: Register in AppModule**

Add `NotificationsModule` near analytics/documents or other API feature modules.

**Step 5: Typecheck**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: no TypeScript errors.

---

### Task 12: Add controller unit tests

**Files:**

- Create: `viewpro-app/apps/api/test/notifications.controller.spec.ts`

**Step 1: Mock use cases**

Mock all four use cases.

**Step 2: Verify forwarding**

Assert each controller method forwards:

- tenant context;
- current user;
- query params or notification id.

**Step 3: Run tests**

Run:

```bash
pnpm --dir viewpro-app/apps/api test test/notifications.controller.spec.ts
```

Expected: pass.

---

### Task 13: Add internal notification e2e tests

**Files:**

- Create: `viewpro-app/apps/api/test/notifications.e2e-spec.ts`

**Step 1: Seed data directly through Prisma**

Use existing e2e style from document/analytics/owner tests.

Clean notifications before referenced rows:

```ts
await prisma.notification.deleteMany();
```

**Step 2: Test unauthenticated and tenant guard behavior**

Cover:

- unauthenticated request returns `401`;
- authenticated request without `x-tenant-id` returns `403` or existing guard-specific behavior.

**Step 3: Test list isolation**

Seed rows for:

- current tenant/current recipient/internal;
- current tenant/current recipient/owner;
- other tenant/current recipient/internal;
- current tenant/other recipient/internal.

Assert list only returns current tenant/current recipient/internal.

**Step 4: Test unread count isolation**

Assert unread count respects the same filters.

**Step 5: Test mark one read isolation**

Assert current row can be read and inaccessible rows return `404`.

**Step 6: Test mark all read isolation**

Assert only current tenant/current recipient/internal unread rows are updated.

**Step 7: Test link sanitization**

Seed unsafe `/owner/*` or external links and assert API returns `linkHref: null`.

**Step 8: Run e2e**

Run:

```bash
pnpm --dir viewpro-app db:up
pnpm --dir viewpro-app/apps/api test test/notifications.e2e-spec.ts
```

Expected: pass when local Postgres is available. If DB is unavailable, record caveat and rely on focused tests plus CI.

---

## Final validation

Run after implementation:

```bash
pnpm --dir viewpro-app/apps/api db:validate
pnpm --dir viewpro-app/apps/api test test/notifications.repository.spec.ts test/notifications.use-cases.spec.ts test/notifications.controller.spec.ts test/notifications.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
git diff --check
```

Expected:

- Prisma validates;
- notification tests pass, except e2e may be locally blocked if Postgres is unavailable;
- API typecheck passes;
- diff has no whitespace errors.

---

## Files to modify

- `viewpro-app/apps/api/prisma/schema.prisma` — add notification enums/model and inverse relations.
- `viewpro-app/apps/api/src/app.module.ts` — register `NotificationsModule`.

## New files

- `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_notifications/migration.sql`
- `viewpro-app/apps/api/src/notifications/notifications.module.ts`
- `viewpro-app/apps/api/src/notifications/notifications.controller.ts`
- `viewpro-app/apps/api/src/notifications/notifications.repository.ts`
- `viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts`
- `viewpro-app/apps/api/src/notifications/notification-response.mapper.ts`
- `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`
- `viewpro-app/apps/api/src/notifications/dto/list-notifications.query.ts`
- `viewpro-app/apps/api/src/notifications/use-cases/list-notifications.use-case.ts`
- `viewpro-app/apps/api/src/notifications/use-cases/get-unread-notifications-count.use-case.ts`
- `viewpro-app/apps/api/src/notifications/use-cases/mark-notification-read.use-case.ts`
- `viewpro-app/apps/api/src/notifications/use-cases/mark-all-notifications-read.use-case.ts`
- `viewpro-app/apps/api/test/notifications.repository.spec.ts`
- `viewpro-app/apps/api/test/notifications.use-cases.spec.ts`
- `viewpro-app/apps/api/test/notifications.controller.spec.ts`
- `viewpro-app/apps/api/test/notifications.e2e-spec.ts`

---

## Risks

- Full Stage 24.1 may exceed 400 changed lines; split into 24.1a and 24.1b if forecast holds.
- Prisma enum migrations will need future additions when stale/preference notification types are introduced.
- Unsafe links must be sanitized at response time; never trust stored `linkHref` blindly.
- Do not reuse the internal controller for owner notifications.
- Do not import notifications into document/movement event hooks until Stage 24.4.
- E2E tests require local Postgres via `pnpm --dir viewpro-app db:up`.

## Out of scope

- Frontend/BFF/UI changes.
- Owner notification API.
- Domain event hooks.
- Realtime/websocket/SSE/push/email.
- Stale notification generation.
- Notification preferences.
- Notification delete/archive.
