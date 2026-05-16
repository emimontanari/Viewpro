# ViewPro Stage 9 Frontend MVP Vertical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the premium frontend vertical that lets agencies and owners use the completed ViewPro backend MVP.

**Architecture:** Implement a Next.js App Router frontend in `apps/web` with a local premium design system, a small API client that preserves httpOnly cookie auth, and tenant-aware requests for internal agency routes. Build in reviewable slices: foundation, auth/tenant selection, engagements, movements, owner portal, documents, and pilot metrics.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, CSS variables/global CSS, NestJS API with httpOnly cookies and `x-tenant-id`, pnpm/Turbo.

---

## Rules for this stage

- Follow the approved clear/editorial premium visual direction.
- Do not use generic AI dashboard aesthetics.
- No emoji icons; use inline SVG or a deliberate icon set if one is added later.
- Keep slices reviewable.
- Do not commit unless the user explicitly authorizes it.
- Use real backend endpoints. Avoid fake demo data except explicit loading/empty examples.
- Preserve auth through httpOnly cookies; do not store access tokens in `localStorage`.
- Internal tenant routes must send `x-tenant-id` from the selected tenant.
- Owner portal routes must not send `x-tenant-id` unless the backend requires it later.

## Verification commands

Run from `viewpro-app/` unless noted otherwise:

```bash
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
pnpm typecheck
pnpm build
pnpm lint
```

When frontend smoke tests are added, also run:

```bash
pnpm --filter @viewpro/web test
```

## Slice 1 — Frontend foundation and premium shell

### Task 1: Add global design system foundation

**Files:**
- Create: `viewpro-app/apps/web/src/app/globals.css`
- Modify: `viewpro-app/apps/web/src/app/layout.tsx`
- Modify: `viewpro-app/apps/web/src/app/page.tsx`

**Step 1: Add global CSS tokens**

Create CSS variables for:
- warm ivory background
- petroleum ink text
- muted teal accent
- muted brass accent
- border, surface, danger, success
- radius and shadow scale

Include `prefers-reduced-motion` support and visible focus states.

**Step 2: Wire typography**

Use `next/font/google` with an editorial serif for headings and a refined sans for UI. Avoid Inter/Arial/system-only styling as the main identity.

**Step 3: Replace placeholder home**

Turn the current home page into a premium entry screen that links to login/register routes once they exist.

**Step 4: Verify**

Run:

```bash
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
```

Expected: pass.

### Task 2: Add shared UI primitives

**Files:**
- Create: `viewpro-app/apps/web/src/components/ui/button.tsx`
- Create: `viewpro-app/apps/web/src/components/ui/input.tsx`
- Create: `viewpro-app/apps/web/src/components/ui/card.tsx`
- Create: `viewpro-app/apps/web/src/components/ui/badge.tsx`
- Create: `viewpro-app/apps/web/src/components/ui/page-shell.tsx`
- Create: `viewpro-app/apps/web/src/components/ui/empty-state.tsx`

**Step 1: Build accessible components**

Keep primitives small, typed, and styleable through class names or variants.

**Step 2: Use components on the home page**

Replace raw markup with primitives to prove the style direction.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

## Slice 2 — Auth and tenant selection

### Task 3: Add API client and session model

**Files:**
- Create: `viewpro-app/apps/web/src/lib/api-client.ts`
- Create: `viewpro-app/apps/web/src/lib/session.ts`
- Create: `viewpro-app/apps/web/src/lib/tenant-selection.ts`

**Step 1: Implement API client**

The API client must:
- use the configured API base URL
- send `credentials: 'include'`
- attach `x-tenant-id` only when a tenant is selected and the route is internal
- parse JSON errors into a small app error type

**Step 2: Add session helpers**

Wrap:
- `POST /api/auth/register-tenant`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

### Task 4: Add login/register screens

**Files:**
- Create: `viewpro-app/apps/web/src/app/(public)/login/page.tsx`
- Create: `viewpro-app/apps/web/src/app/(public)/register/page.tsx`
- Create: `viewpro-app/apps/web/src/components/auth/login-form.tsx`
- Create: `viewpro-app/apps/web/src/components/auth/register-tenant-form.tsx`

**Step 1: Build forms as client components**

Include labels, loading state, visible errors, and disabled submit during requests.

**Step 2: On success**

After login/register, load `/me`; if one tenant, select it and route to dashboard; if multiple tenants, route to tenant selector.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

### Task 5: Add tenant selector and protected internal shell

**Files:**
- Create: `viewpro-app/apps/web/src/app/(internal)/select-tenant/page.tsx`
- Create: `viewpro-app/apps/web/src/app/(internal)/dashboard/page.tsx`
- Create: `viewpro-app/apps/web/src/components/layout/internal-shell.tsx`

**Step 1: Tenant selector**

Show tenant name, role, and an enter action.

**Step 2: Internal shell**

Add premium navigation and selected tenant context.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

## Slice 3 — Internal engagements workspace

### Task 6: Add engagement API helpers

**Files:**
- Create: `viewpro-app/apps/web/src/lib/engagements.ts`

Wrap:
- `GET /api/property-engagements`
- `GET /api/property-engagements/:id`
- `POST /api/property-engagements`

### Task 7: Add engagement list and detail

**Files:**
- Create: `viewpro-app/apps/web/src/app/(internal)/engagements/page.tsx`
- Create: `viewpro-app/apps/web/src/app/(internal)/engagements/[id]/page.tsx`
- Create: `viewpro-app/apps/web/src/components/engagements/engagement-list.tsx`
- Create: `viewpro-app/apps/web/src/components/engagements/engagement-summary-card.tsx`

**Step 1: List real tenant engagements**

Include loading, empty, and error states.

**Step 2: Detail layout**

Show property summary, status, assigned sellers, movement timeline placeholder, and document request placeholder.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

### Task 8: Add create engagement screen

**Files:**
- Create: `viewpro-app/apps/web/src/app/(internal)/engagements/new/page.tsx`
- Create: `viewpro-app/apps/web/src/components/engagements/create-engagement-form.tsx`

**Step 1: Build form**

Use fields required by the backend DTO.

**Step 2: Submit**

Create the engagement and route to detail.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

## Slice 4 — Movement publishing

### Task 9: Add movement timeline and create movement form

**Files:**
- Create: `viewpro-app/apps/web/src/lib/movements.ts`
- Create: `viewpro-app/apps/web/src/components/movements/movement-timeline.tsx`
- Create: `viewpro-app/apps/web/src/components/movements/create-movement-form.tsx`
- Modify: `viewpro-app/apps/web/src/app/(internal)/engagements/[id]/page.tsx`

**Step 1: Wrap movement endpoints**

Use:
- `GET /api/property-engagements/:propertyEngagementId/movements`
- `POST /api/property-engagements/:propertyEngagementId/movements`

**Step 2: Mobile-first form**

Movement creation should take under 60 seconds: type, short text, optional next step, optional status change.

**Step 3: Refresh timeline after submit**

Show success state and latest movement.

**Step 4: Verify**

Run web typecheck/build.

Expected: pass.

## Slice 5 — Owner portal

### Task 10: Add owner portal shell and property list/detail

**Files:**
- Create: `viewpro-app/apps/web/src/app/(owner)/owner/properties/page.tsx`
- Create: `viewpro-app/apps/web/src/app/(owner)/owner/properties/[propertyAssetId]/page.tsx`
- Create: `viewpro-app/apps/web/src/components/layout/owner-shell.tsx`
- Create: `viewpro-app/apps/web/src/lib/owner-portal.ts`

**Step 1: Wrap owner endpoints**

Use:
- `GET /api/owner/properties`
- `GET /api/owner/properties/:propertyAssetId`
- `GET /api/owner/properties/:propertyAssetId/engagements`
- `GET /api/owner/engagements/:engagementId/timeline`

**Step 2: Build owner views**

Owner UI should be simpler than internal UI and must not expose tenant internals.

**Step 3: Verify**

Run web typecheck/build.

Expected: pass.

## Slice 6 — Documents UX

### Task 11: Add internal document request/review screens

**Files:**
- Create: `viewpro-app/apps/web/src/lib/documents.ts`
- Create: `viewpro-app/apps/web/src/components/documents/request-document-form.tsx`
- Create: `viewpro-app/apps/web/src/components/documents/document-request-list.tsx`
- Modify: `viewpro-app/apps/web/src/app/(internal)/engagements/[id]/page.tsx`

Wrap internal document endpoints and expose request/approve/reject flows.

### Task 12: Add owner document upload flow

**Files:**
- Create: `viewpro-app/apps/web/src/app/(owner)/owner/documents/page.tsx`
- Create: `viewpro-app/apps/web/src/components/documents/owner-document-upload.tsx`
- Modify: `viewpro-app/apps/web/src/lib/documents.ts`

Use owner document endpoints for upload URL, confirm upload, and read URL.

**Verification:** web typecheck/build.

## Slice 7 — Pilot metrics dashboard

### Task 13: Add analytics dashboard

**Files:**
- Create: `viewpro-app/apps/web/src/lib/analytics.ts`
- Create: `viewpro-app/apps/web/src/app/(internal)/analytics/page.tsx`
- Create: `viewpro-app/apps/web/src/components/analytics/pilot-summary-panel.tsx`
- Create: `viewpro-app/apps/web/src/components/analytics/inactive-engagements-panel.tsx`
- Create: `viewpro-app/apps/web/src/components/analytics/event-audit-table.tsx`

Use Stage 8 endpoints:
- `GET /api/analytics/pilot-summary`
- `GET /api/analytics/inactive-engagements`
- `GET /api/analytics/events`

**Verification:** web typecheck/build and root typecheck/build.

## Slice 8 — Smoke tests and roadmap update

### Task 14: Add frontend smoke test capability

**Files:**
- Modify: `viewpro-app/apps/web/package.json`
- Create: frontend smoke test files once test runner is selected.

Do not add a large testing stack without confirming the tool choice. Candidate: Playwright for browser smoke tests once the vertical flow exists.

### Task 15: Update roadmap/docs

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Modify: `docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-design.md`
- Modify: `docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md`

Document completed frontend slices and keep ViewPro Admin Backoffice as a required pre-MVP-complete item.

## Review workload forecast

Estimated total changed lines for all frontend slices: high, definitely over 400 lines.

Recommended delivery:
- Keep Stage 9 split into the slices above.
- Commit each slice separately after explicit user approval.
- Do not squash the frontend vertical into one large PR/commit.

## Done when

- A manager can register/login, select tenant, open dashboard, create/open an engagement, publish a movement, and see metrics.
- An owner can login, see properties, read timeline, and handle documents.
- The interface consistently follows clear/editorial premium direction.
- Frontend typecheck/build pass.
- ViewPro Admin Backoffice remains explicitly tracked before MVP closure.
