# Property Activity Monitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an app-new Seguimiento page where managers can see cross-property movement activity and operational attention counters.

**Architecture:** Add a tenant-scoped backend activity feed endpoint that queries movements across all visible property engagements and returns property summaries plus counters. App-new consumes it through a BFF route and renders a shadcn dashboard page with KPI cards, filters, and a feed. This MVP is movements-only; document/event merging and realtime updates remain future work.

**Tech Stack:** NestJS, Prisma, Vitest, Next.js App Router, TanStack Query, shadcn/ui, TypeScript.

---

## Guardrails

- Branch: `feat/property-activity-monitor`.
- Frontend target: `viewpro-app/apps/app-new`.
- Route: `/dashboard/seguimiento`.
- Visible label: `Seguimiento`.
- MVP source: movements only. Do not merge analytics events into the feed yet.
- Do not implement realtime, notifications, exports, or owner-facing visibility changes.
- Do not commit without maintainer approval.
- Use explicit `git add -- <paths>` only.

## Product Decisions

- The page answers: “¿Qué pasó hoy y qué propiedades necesitan atención?”
- Counters:
  - `todayCount`: movements in the last 24 hours.
  - `staleCount`: active, non-archived engagements without movement in the last 7 days.
  - `attentionCount`: active, non-archived engagements whose latest movement is `INQUIRY`, `VISIT_COMPLETED`, or `OFFER_RECEIVED` and has no `nextStep`.
- Feed item shows: movement type, date, observation, next step, created-by user, property title/address, operation type, status, assigned sellers, and a link to product detail.
- Filters for MVP: movement type, seller/user id, date from, date to. Status/search can be follow-up if the endpoint grows too much.

## Task 1: Backend repository query for cross-property movements

**Files:**

- Modify: `viewpro-app/apps/api/src/movements/movements.repository.ts`
- Modify: `viewpro-app/apps/api/src/movements/prisma-movements.repository.ts`
- Modify/add tests in: `viewpro-app/apps/api/test/movements.repository.spec.ts`

**Behavior:**

- Add repository method such as `findManyByTenant(input)`.
- Input includes `tenantId`, `userId`, `canViewAll`, `page`, `pageSize`, optional `type`, `createdByUserId`, `from`, `to`.
- Managers can view all tenant movements. Agents only see movements for property engagements where they are assigned.
- Exclude archived property engagements by default for this activity page.
- Include property engagement summary and property asset details required for the feed.
- Return `{ items, total }`.

**Validation:**

```bash
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/movements.repository.spec.ts --fileParallelism=false
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
```

## Task 2: Backend activity feed use case and endpoint

**Files:**

- Create: `viewpro-app/apps/api/src/analytics/dto/list-activity-feed.query.ts`
- Create: `viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.controller.ts`
- Modify: `viewpro-app/apps/api/src/analytics/analytics.module.ts`
- Modify if needed: `viewpro-app/apps/api/src/movements/movements.module.ts` to export repository/provider.
- Add tests in closest analytics or movement use-case test file.

**Behavior:**

- Add `GET /api/analytics/activity-feed`.
- Require tenant membership + appropriate analytics or engagement view permission. Managers view all; agents see assigned if allowed by existing visibility logic.
- Query params: `page`, `pageSize`, `type`, `sellerId`, `dateFrom`, `dateTo`.
- Response shape:

```ts
{
  total: number;
  page: number;
  pageSize: number;
  counters: {
    todayCount: number;
    staleCount: number;
    attentionCount: number;
  };
  items: Array<{
    id: string;
    type: MovementType;
    observation: string;
    nextStep: string | null;
    previousStatus: PropertyEngagementStatus | null;
    newStatus: PropertyEngagementStatus | null;
    createdAt: string;
    createdBy: { id: string; email: string; firstName: string | null };
    property: {
      id: string;
      title: string | null;
      addressLine: string | null;
      city: string | null;
      province: string | null;
      operationType: PropertyOperationType;
      status: PropertyEngagementStatus;
      agents: Array<{ id: string; userId: string; email: string; firstName: string | null }>;
    };
  }>;
}
```

**Validation:**

```bash
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/movements.repository.spec.ts test/analytics.use-cases.spec.ts --fileParallelism=false
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
```

## Task 3: app-new BFF, service, and types

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/activity/feed/route.ts`
- Create: `viewpro-app/apps/app-new/src/features/activity/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/activity/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/activity/api/queries.ts`

**Behavior:**

- BFF proxies `GET /api/activity/feed` to backend `/analytics/activity-feed`.
- Forward query params and tenant/cookie context through existing `bffFetch`.
- Types mirror backend response.
- Query key includes filters and tenant id if available.

**Validation:**

```bash
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

## Task 4: app-new Seguimiento page UI

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/dashboard/seguimiento/page.tsx`
- Create: `viewpro-app/apps/app-new/src/features/activity/components/activity-kpi-cards.tsx`
- Create: `viewpro-app/apps/app-new/src/features/activity/components/activity-feed.tsx`
- Create: `viewpro-app/apps/app-new/src/features/activity/components/activity-feed-item.tsx`
- Create: `viewpro-app/apps/app-new/src/features/activity/components/activity-filters.tsx`
- Modify: `viewpro-app/apps/app-new/src/config/nav-config.ts`
- Reuse labels from `features/products/constants/movement-options.ts` and product status/operation labels where possible.

**Behavior:**

- Add sidebar nav item `Seguimiento` under the product/operation area.
- Page layout:
  - title: `Seguimiento`;
  - subtitle: `Últimas actualizaciones y propiedades que necesitan atención.`;
  - KPI cards for `Movimientos hoy`, `Sin actualización`, `Requieren atención`;
  - filters for movement type, seller id text/select if available, date from/to;
  - feed list with loading/error/empty states;
  - feed items link to `/dashboard/product/:id`.
- Use product-oriented Spanish copy. Avoid technical terms like tenant, backend, request, UUID.

**Validation:**

```bash
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter run lint
```

## Task 5: Full validation and fresh review

**Validation commands:**

```bash
pnpm -C viewpro-app --filter @viewpro/api exec tsc --noEmit
pnpm -C viewpro-app --filter @viewpro/api exec vitest run test/movements.repository.spec.ts test/analytics.use-cases.spec.ts --fileParallelism=false
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
pnpm -C viewpro-app --filter next-shadcn-dashboard-starter run lint
git diff --check
```

**Fresh review focus:**

- Tenant/agent visibility for activity feed.
- Counter accuracy and performance.
- No archived property leakage unless explicitly filtered later.
- BFF query param forwarding.
- UI usefulness and no internal terminology.
- Review workload; split commits if diff grows.

## Suggested commits

```bash
feat(api): add property activity feed
feat(app-new): add property seguimiento page
```
