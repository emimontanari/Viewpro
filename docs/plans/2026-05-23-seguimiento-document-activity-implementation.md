# Seguimiento Document Activity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show document request activity inside the existing `/dashboard/seguimiento` operational feed without adding a new top-level documents section.

**Architecture:** Extend the existing activity feed into a discriminated union of movement and document request items. Backend owns filtering, permission checks, ordering, and pagination; app-new renders movement cards with the current UI and adds document activity cards plus a simple kind filter.

**Tech Stack:** NestJS 11, Prisma 6, Vitest/Supertest, Next.js 16 app-new, React 19, TanStack Query, nuqs.

---

### Task 1: Extend backend activity feed query contract

**Files:**
- Modify: `viewpro-app/apps/api/src/analytics/dto/list-activity-feed.query.ts`
- Modify: `viewpro-app/apps/app-new/src/app/api/activity/feed/route.ts`

**Step 1: Add activity kind filter**

Add a query field:

```ts
kind?: 'all' | 'movement' | 'document_request'
```

Default should behave like `all` once document items are implemented. If omitted, existing callers continue to work.

**Step 2: Forward the query from app-new BFF**

Allow `kind` through the BFF route in `app/api/activity/feed/route.ts`.

**Step 3: Run DTO/unit validation**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
```

Expected: pass.

---

### Task 2: Add document activity records to backend feed

**Files:**
- Modify: `viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts`
- Modify: `viewpro-app/apps/api/src/analytics/responses/activity-feed.response.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Test: `viewpro-app/apps/api/test/analytics.e2e-spec.ts` or relevant analytics/document feed spec

**Step 1: Expand movement item response with kind**

Add:

```ts
kind: 'movement'
```

to mapped movement feed items.

**Step 2: Add document request query support**

Add repository support to list document requests for activity feed with:

- tenant visibility;
- requesting-user visibility for non-manager users;
- property summary;
- owner link summary;
- requester summary;
- current version summary;
- createdAt ordering.

Use existing document permission semantics. Do not expose raw storage keys beyond current API behavior.

**Step 3: Merge and paginate in backend**

For this slice, acceptable implementation:

1. Fetch up to `page * pageSize` movement records when kind includes movements.
2. Fetch up to `page * pageSize` document records when kind includes documents.
3. Merge by `createdAt desc`.
4. Slice requested page.

If this becomes inefficient later, replace with SQL union/keyset pagination. For MVP-size data, this keeps scope contained.

**Step 4: Return counters carefully**

Keep existing counters movement-focused unless changed intentionally. Do not pretend they include documents. If necessary, rename UI copy later, not in backend.

**Step 5: Backend tests**

Add tests that assert:

- `kind=movement` returns movement items only;
- `kind=document_request` returns document request items only;
- default/all returns both kinds ordered by `createdAt desc`;
- non-manager user does not see peer seller document requests;
- document items include property, owner, requester, status, and current version summary.

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api exec vitest run test/analytics.e2e-spec.ts test/documents.e2e-spec.ts
```

Expected: pass.

---

### Task 3: Update app-new activity API types and service

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/activity/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/activity/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/activity/api/queries.ts` only if query keys need kind/status updates

**Step 1: Create discriminated union types**

Define:

```ts
export type ActivityFeedItem = ActivityMovementItem | ActivityDocumentRequestItem;
```

Movement item should include `kind: 'movement'`.

Document request item should include the fields returned by backend.

**Step 2: Add kind filter type**

```ts
export type ActivityKindFilter = 'all' | 'movement' | 'document_request';
```

Add `kind?: ActivityKindFilter` to `ActivityFeedFilters`.

**Step 3: Send kind query param**

`getActivityFeed()` should append `kind` when set and not equal to default if preferred.

**Step 4: Run frontend typecheck/build later after UI tasks**

No separate validation required yet unless TS errors appear.

---

### Task 4: Add Seguimiento kind filter UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/activity/components/activity-monitor.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/activity/components/activity-filters.tsx`

**Step 1: Store kind in URL**

Use `nuqs` like existing filters.

Default: `all`.

**Step 2: Add segmented control**

Add options:

```txt
Todo | Movimientos | Documentos
```

Keep it visually lightweight and near the top of filters.

**Step 3: Keep scope simple**

Do not add document status filter unless backend already supports it cleanly and UI remains simple.

**Step 4: Update clear filters behavior**

Clear should reset `kind` to `all` and existing filters to defaults.

---

### Task 5: Render document activity cards

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/activity/components/activity-feed.tsx`
- Rename or keep: `viewpro-app/apps/app-new/src/features/activity/components/activity-feed-item.tsx`
- Create optional: `viewpro-app/apps/app-new/src/features/activity/components/activity-document-request-feed-item.tsx`

**Step 1: Split card rendering by kind**

In feed map:

```tsx
item.kind === 'movement'
  ? <ActivityFeedItem item={item} />
  : <ActivityDocumentRequestFeedItem item={item} />
```

**Step 2: Build document card**

Card should show:

- badge: `Solicitud documental`;
- document status badge;
- property summary;
- document title/description;
- owner display;
- requester display;
- current version status/filename when present;
- link/button: `Ver propiedad`.

**Step 3: Empty/error copy**

Change movement-specific empty copy to activity-aware copy when `kind=all` or `kind=document_request`.

**Step 4: Keep movement detail dialog unchanged**

Only movement items open the movement detail dialog. Document items link to property detail.

---

### Task 6: Update tests/docs and validate

**Files:**
- Create/Modify: `docs/plans/2026-05-23-seguimiento-document-activity-design.md`
- Create/Modify: `docs/plans/2026-05-23-seguimiento-document-activity-implementation.md`
- Optional docs: update roadmap only if behavior changes are worth documenting there.

**Step 1: Backend validation**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api exec vitest run test/analytics.e2e-spec.ts test/documents.e2e-spec.ts
```

**Step 2: Frontend validation**

Run:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter lint
pnpm --filter next-shadcn-dashboard-starter build
```

**Step 3: Diff hygiene**

Run:

```bash
git diff --check
```

**Step 4: Fresh review before commit/push**

Ask a fresh reviewer to check:

- no new top-level docs section;
- no owner login/email/magic-link scope creep;
- backend permission semantics preserved;
- feed ordering/pagination coherent enough for MVP;
- UI remains simple and consistent with Seguimiento.

---
