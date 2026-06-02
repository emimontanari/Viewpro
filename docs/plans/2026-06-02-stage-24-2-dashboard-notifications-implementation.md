# Stage 24.2 Dashboard Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dashboard header notifications API-backed through app-new BFF routes while keeping owner portal notification UI safely empty.

**Architecture:** Stage 24.2 consumes the Stage 24.1 internal notification API through app-new BFF routes. The dashboard notification center moves from local mock Zustand data to typed service/query calls. Owner routes stay isolated and must not call dashboard/internal notification endpoints until Stage 24.3.

**Tech Stack:** Next.js App Router BFF routes, React, TanStack Query, Vitest, existing app-new BFF helpers, backend Stage 24.1 notification API.

---

## Review strategy

Use two PRs unless implementation evidence proves the combined diff remains under budget:

| Slice | Scope | Forecast |
|---|---|---|
| Stage 24.2a | BFF routes, notification service/types/query options, route/service/query tests. No visible UI replacement. | ~330-390 changed lines |
| Stage 24.2b | Dashboard `NotificationCenter` consumes API, owner portal remains safe/empty, remove dead mock store if unused. | ~250-350 additions plus template deletions |

Do **not** enable the full `/dashboard/notifications` page in Stage 24.2 unless explicitly approved; that should be Stage 24.2c if needed.

Use `pnpm`, not Bun.

---

## BFF endpoint contracts

### `GET /api/notifications`

Proxies backend:

```txt
GET /notifications
```

Allowed query params:

- `page`: positive integer;
- `pageSize`: integer `1..50`;
- `unreadOnly`: `true | false`.

Response proxied from backend:

```ts
{
  items: NotificationResponse[];
  total: number;
  page: number;
  pageSize: number;
}
```

Error behavior:

- Backend non-2xx: proxy backend status/body unchanged.
- BFF/network error: `{ message: 'No se pudieron cargar las notificaciones.' }`, status `502`.
- Timeout: `{ message: 'Las notificaciones tardaron demasiado.' }`, status `504`.

### `GET /api/notifications/unread-count`

Proxies backend:

```txt
GET /notifications/unread-count
```

Response:

```ts
{ unreadCount: number }
```

### `POST /api/notifications/:id/read`

App route path:

```txt
viewpro-app/apps/app-new/src/app/api/notifications/[id]/read/route.ts
```

Proxies backend:

```txt
POST /notifications/${encodeURIComponent(id)}/read
```

Response: backend `NotificationResponse`.

### `POST /api/notifications/read-all`

Proxies backend:

```txt
POST /notifications/read-all
```

Response:

```ts
{ updatedCount: number }
```

---

## Frontend type/service/query design

### Types

Create:

```txt
viewpro-app/apps/app-new/src/features/notifications/api/types.ts
```

Use backend-aligned types:

```ts
export type NotificationSurface = 'INTERNAL' | 'OWNER';

export type NotificationType =
  | 'DOCUMENT_REQUESTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'PROPERTY_STATUS_CHANGED'
  | 'MOVEMENT_CREATED';

export type DashboardNotification = {
  id: string;
  type: NotificationType;
  surface: NotificationSurface;
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
};

export type NotificationsResponse = {
  items: DashboardNotification[];
  total: number;
  page: number;
  pageSize: number;
};

export type UnreadNotificationsCountResponse = {
  unreadCount: number;
};
```

### Service

Create:

```txt
viewpro-app/apps/app-new/src/features/notifications/api/service.ts
```

Functions:

- `getNotifications(filters, init?)`;
- `getUnreadNotificationCount(init?)`;
- `markNotificationRead(id)`;
- `markAllNotificationsRead()`.

Rules:

- Fetch app-new BFF paths only: `/api/notifications...`.
- Use `credentials: 'include'` and `cache: 'no-store'`.
- Follow existing service timeout/error parsing patterns.
- Encode notification IDs.
- Parse `{ message }` from error responses.

### Queries

Create:

```txt
viewpro-app/apps/app-new/src/features/notifications/api/queries.ts
```

Keys:

- `notificationKeys.all`;
- `notificationKeys.list({ tenantId, page, pageSize, unreadOnly })`;
- `notificationKeys.unreadCount(tenantId)`.

Rules:

- Include `tenantId ?? 'no-tenant'` in keys to avoid cross-tenant stale data.
- No polling/refetch interval.
- Query fetches on mount only/default React Query behavior.

---

## Owner/dashboard safety rules

1. `NotificationCenter` must keep checking `usePathname()`.
2. If `pathname.startsWith('/owner')`:
   - do not execute dashboard notification fetches;
   - badge count is `0`;
   - popover shows honest owner empty copy: `Sin novedades nuevas`;
   - do not link to `/dashboard/notifications`.
3. Dashboard routes may call only app-new BFF `/api/notifications...`.
4. Do not add owner notification routes or owner API calls in Stage 24.2.
5. Notification action links must use backend `linkHref`, not the legacy hardcoded route map.
6. Defense-in-depth: only navigate if `linkHref` is a relative `/dashboard...` URL and not `//...`.

---

# Stage 24.2a — BFF and frontend notification API foundation

## Task 1: Preflight repository state

**Files:** none.

Run:

```bash
git branch --show-current
git status --short
```

Expected:

- branch is `develop` before branching;
- status is clean.

---

## Task 2: Write failing BFF tests for notification list/count

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/notifications/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/notifications/unread-count/route.test.ts`

Test list route:

- forwards no query as `/notifications`;
- forwards valid query as `/notifications?page=2&pageSize=5&unreadOnly=true`;
- omits invalid query values;
- returns Spanish fallback error on BFF failure.

Test unread route:

- forwards `/notifications/unread-count`;
- preserves backend status/body;
- returns Spanish fallback error on BFF failure.

Run RED:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/notifications/route.test.ts src/app/api/notifications/unread-count/route.test.ts
```

Expected: fail because routes do not exist.

---

## Task 3: Implement BFF list/count routes

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/notifications/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/notifications/unread-count/route.ts`

Implementation:

- use existing `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse` patterns;
- whitelist/normalize `page`, `pageSize`, `unreadOnly`;
- do not forward tenant id through query;
- rely on cookies/header handling in BFF helper.

Run GREEN:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/api/notifications/route.test.ts src/app/api/notifications/unread-count/route.test.ts
```

Expected: pass.

---

## Task 4: Write failing BFF mutation tests

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/notifications/[id]/read/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/notifications/read-all/route.test.ts`

Test mark-one route:

- calls `/notifications/${encodedId}/read`;
- uses `POST`;
- proxies backend status/body;
- returns Spanish fallback error on BFF failure.

Test read-all route:

- calls `/notifications/read-all`;
- uses `POST`;
- proxies backend status/body;
- returns Spanish fallback error on BFF failure.

Run RED:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/notifications/[id]/read/route.test.ts' src/app/api/notifications/read-all/route.test.ts
```

Expected: fail because routes do not exist.

---

## Task 5: Implement BFF mutation routes

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/notifications/[id]/read/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/notifications/read-all/route.ts`

Implementation:

- POST only;
- no request body forwarding;
- encode route id;
- proxy backend JSON/status.

Run GREEN:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/notifications/[id]/read/route.test.ts' src/app/api/notifications/read-all/route.test.ts
```

Expected: pass.

---

## Task 6: Write failing notification service tests

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/notifications/api/service.test.ts`

Test:

- `getNotifications()` fetches `/api/notifications`;
- filters serialize to `?page=2&pageSize=5&unreadOnly=true`;
- `getUnreadNotificationCount()` fetches `/api/notifications/unread-count`;
- `markNotificationRead('notification 1')` encodes id;
- `markAllNotificationsRead()` POSTs `/api/notifications/read-all`;
- errors parse `{ message }`.

Run RED:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/notifications/api/service.test.ts
```

Expected: fail because service/types do not exist.

---

## Task 7: Implement notification service/types

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/notifications/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/notifications/api/service.ts`

Implementation:

- add backend-aligned types;
- add service functions and local `apiFetch`/`parseJsonResponse` helpers following existing app-new service patterns;
- timeout message: `Las notificaciones tardaron demasiado.`.

Run GREEN:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/notifications/api/service.test.ts
```

Expected: pass.

---

## Task 8: Write and implement notification query options

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/notifications/api/queries.ts`
- Create: `viewpro-app/apps/app-new/src/features/notifications/api/queries.test.ts`

Test:

- tenant id is included in list/count keys;
- `no-tenant` fallback key is used;
- no `refetchInterval` is configured;
- query functions call the service functions.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/notifications/api/queries.test.ts
```

Expected: pass.

---

## Task 9: Validate Stage 24.2a

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/app/api/notifications/route.test.ts \
  src/app/api/notifications/unread-count/route.test.ts \
  'src/app/api/notifications/[id]/read/route.test.ts' \
  src/app/api/notifications/read-all/route.test.ts \
  src/features/notifications/api/service.test.ts \
  src/features/notifications/api/queries.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

Expected: pass.

---

# Stage 24.2b — Dashboard header consumes API

## Task 10: Write failing NotificationCenter behavior tests

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.test.tsx`

Mock:

- `next/navigation`;
- notification API service/query layer as needed;
- active tenant context.

Dashboard tests:

- shows unread badge from API count;
- shows honest empty state when API returns `items: []`;
- renders API notifications;
- mark-read button calls `markNotificationRead`;
- mark-all button calls `markAllNotificationsRead`;
- action button/link uses backend `linkHref`;
- external/unsafe links do not navigate.

Owner tests:

- path `/owner/...` shows `Sin novedades nuevas`;
- does not call notification service fetch functions;
- badge is absent.

Run RED:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/notifications/components/notification-center.test.tsx
```

Expected: fail against current mock-store implementation.

---

## Task 11: Refactor NotificationCenter to use API

**Files:**

- Modify: `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx`

Implementation:

- remove `useNotificationStore`;
- remove legacy `actionRoutes`;
- use notification query options and mutation service functions;
- use active tenant id in query keys;
- disable queries when:
  - owner pathname;
  - tenant context loading;
  - no active tenant id;
- map API notification status:
  - `readAt ? 'read' : 'unread'`;
- map body:
  - `body ?? ''`;
- create one action only when safe `linkHref` exists;
- invalidate list/count queries after mark mutations;
- no polling;
- if `/dashboard/notifications` page stays disabled, use a plain popover heading instead of a link to that route.

Run GREEN:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/notifications/components/notification-center.test.tsx
```

Expected: pass.

---

## Task 12: Remove dead mock notification store/page component if no imports remain

**Files:**

- Delete if unused: `viewpro-app/apps/app-new/src/features/notifications/utils/store.ts`
- Delete if unused: `viewpro-app/apps/app-new/src/features/notifications/components/notifications-page.tsx`
- Keep unchanged: `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.tsx`
- Keep unchanged unless needed: `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.test.ts`

Steps:

1. Run grep:

```bash
grep -R "useNotificationStore\|actionRoutes\|NotificationsPage" viewpro-app/apps/app-new/src/features/notifications viewpro-app/apps/app-new/src/app/dashboard/notifications || true
```

2. If no imports remain, delete dead mock files.
3. Keep `/dashboard/notifications` redirect unchanged.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/app/dashboard/notifications/page.test.ts
```

Expected:

- no `useNotificationStore` usage;
- no legacy notification `actionRoutes`;
- redirect test still passes.

---

## Task 13: Validate Stage 24.2b

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/features/notifications/components/notification-center.test.tsx \
  src/app/dashboard/notifications/page.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

Expected: pass.

---

## Task 14: Final validation before review

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test \
  src/app/api/notifications/route.test.ts \
  src/app/api/notifications/unread-count/route.test.ts \
  'src/app/api/notifications/[id]/read/route.test.ts' \
  src/app/api/notifications/read-all/route.test.ts \
  src/features/notifications/api/service.test.ts \
  src/features/notifications/api/queries.test.ts \
  src/features/notifications/components/notification-center.test.tsx \
  src/app/dashboard/notifications/page.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

Optional if time/review budget permits:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter build
```

---

## Files to modify

- `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx`
- `viewpro-app/apps/app-new/src/features/notifications/utils/store.ts` — delete if unused.
- `viewpro-app/apps/app-new/src/features/notifications/components/notifications-page.tsx` — delete if unused.
- `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.tsx` — keep redirect unchanged unless explicitly approved.
- `viewpro-app/apps/app-new/src/app/dashboard/notifications/page.test.ts` — keep redirect test unchanged unless explicitly approved.

## New files

- `viewpro-app/apps/app-new/src/app/api/notifications/route.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/unread-count/route.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/unread-count/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/[id]/read/route.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/[id]/read/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/read-all/route.ts`
- `viewpro-app/apps/app-new/src/app/api/notifications/read-all/route.test.ts`
- `viewpro-app/apps/app-new/src/features/notifications/api/types.ts`
- `viewpro-app/apps/app-new/src/features/notifications/api/service.ts`
- `viewpro-app/apps/app-new/src/features/notifications/api/service.test.ts`
- `viewpro-app/apps/app-new/src/features/notifications/api/queries.ts`
- `viewpro-app/apps/app-new/src/features/notifications/api/queries.test.ts`
- `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.test.tsx`

---

## Risks

- Backend may return empty notifications until event hooks exist; Stage 24.2 must show honest empty state, not mocks.
- Linking to `/dashboard/notifications` while the page redirects is misleading; use a plain popover heading until that page is enabled.
- Cross-tenant stale data is possible if query keys omit active tenant id.
- Unsafe `linkHref` navigation must be guarded in frontend even though backend sanitizes internal links.
- Deleting dead mock files is safe only after grep confirms no imports remain.
- Combining Stage 24.2a and 24.2b may exceed the 400-line review budget; split if needed.

## Out of scope

- Backend changes.
- Owner notification API/UI.
- Domain event hooks.
- Realtime/polling/refetch intervals.
- Enabling full `/dashboard/notifications` page.
- Notification preferences/delete/archive.
