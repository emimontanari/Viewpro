# Owner Portal Detail UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the owner property detail with owner-safe property images/facts, tabs, and a status path while keeping the portal read-only.

**Architecture:** Expand the existing backend owner property response with safe `PropertyAsset` fields and images. Update `app-new` owner types/services and render a richer owner detail UI with `Resumen` and `Seguimiento` tabs. Keep access checks in existing owner backend queries and avoid internal dashboard components that include mutations.

**Tech Stack:** NestJS, Prisma, Next.js App Router, React, TanStack Query, TypeScript, Vitest, Playwright seeded smoke.

---

## Constraints

- Work on branch `feat/owner-readonly-portal`.
- Active UI is `viewpro-app/apps/app-new`.
- Keep `/owner` outside `/dashboard`.
- Do not add document upload/request UI.
- Do not add a property description schema field in this slice.
- Do not expose internal controls to owners.
- Do not change owner authorization semantics.

## Task 1: Expand owner property backend response

**Files:**
- Modify: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/responses/owner-property.response.ts`
- Test: relevant owner portal API tests, likely `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts` or use-case tests if present.

**Steps:**
1. Inspect the current owner property repository record type.
2. Include property images in `findPropertiesByOwnerUserId` and `findPropertyByOwner`.
3. Expand the property response mapper with safe facts:
   - `totalAreaSqm`
   - `coveredAreaSqm`
   - `rooms`
   - `bedrooms`
   - `bathrooms`
   - `garages`
   - `ageYears`
   - `orientation`
   - `images`
   - `primaryImage`
4. Sort images by `sortOrder`, then `createdAt` if needed.
5. Add/adjust backend tests asserting owner-accessible property detail includes image/fact fields and inaccessible properties remain hidden.
6. Run focused API test(s).

## Task 2: Update owner frontend API types

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`

**Steps:**
1. Add `OwnerPropertyImage` type.
2. Expand `OwnerProperty` with the backend fields from Task 1.
3. Keep nullable numeric fields nullable.
4. Run `tsc` after UI changes consume these fields.

## Task 3: Build owner property summary UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- Create or modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-summary.tsx`
- Test: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`

**Steps:**
1. Add tests that assert:
   - primary image or image placeholder renders;
   - facts such as bedrooms/bathrooms/covered area render when present;
   - no internal actions like `Editar` or `Nueva propiedad` render.
2. Implement a summary section with:
   - primary image;
   - thumbnail strip if multiple images exist;
   - property title/location/type;
   - price/operation/current status from engagement;
   - facts grid.
3. Use owner-safe copy in Spanish.
4. Avoid importing `ProductForm`; copy/extract only display-safe patterns.

## Task 4: Add detail tabs

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- Test: `owner-property-detail.test.tsx`

**Steps:**
1. Use existing `src/components/ui/tabs.tsx`.
2. Add tabs:
   - `Resumen`
   - `Seguimiento`
3. Put the property summary in `Resumen`.
4. Put the state path + movement history in `Seguimiento`.
5. Keep the page mobile-first.

## Task 5: Add owner status path component

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-status-path.tsx`
- Modify: `owner-property-detail.tsx` or `owner-engagement-card.tsx`
- Test: `owner-property-detail.test.tsx` or a new focused `owner-status-path.test.tsx`

**Steps:**
1. Reuse status labels/order from `viewpro-app/apps/app-new/src/features/products/constants/product-options.ts` if suitable.
2. Render all major engagement states as connected dots.
3. Mark previous states as completed, current state as highlighted, and future states as muted.
4. Handle exceptional/unknown states gracefully.
5. Place existing movement history below the path.

## Task 6: Update seeded smoke

**Files:**
- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Steps:**
1. After owner opens property detail, assert:
   - `Resumen` tab visible;
   - `Seguimiento` tab visible;
   - at least one property fact visible;
   - status path/current status visible;
   - no internal actions visible.
2. Avoid brittle assertions on external image rendering; prefer alt text or stable property fact text.

## Task 7: Validate

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- owner-portal
pnpm --filter @viewpro/api typecheck
pnpm --filter next-shadcn-dashboard-starter test -- src/features/owner/components/owner-property-detail.test.tsx src/features/owner/components/owner-home.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
cd ..
git diff --check
```

Use exact test commands available in the repo if the API filter differs.

## Task 8: Fresh review and PR update

Before committing/pushing:

- run LSP diagnostics on touched TS/TSX files;
- run fresh reviewer with focus on owner data exposure, read-only UI, status path correctness, and seeded smoke reliability;
- commit as:

```txt
feat(app-new): enrich owner property detail
```

Push to existing PR #19.
