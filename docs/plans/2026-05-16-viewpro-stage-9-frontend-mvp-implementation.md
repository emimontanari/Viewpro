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
pnpm --filter @viewpro/web test
pnpm --filter @viewpro/web build
pnpm test
pnpm typecheck
pnpm build
pnpm lint
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

### Slice 3 implementation status — Internal engagements workspace

Slice 3 is the first operational workspace for agencies. It replaces the dashboard placeholder with real tenant-scoped engagement navigation and lets authenticated internal users list, inspect, and create property engagements against the backend API.

**Review path:**
- `apps/web/src/lib/engagements.ts` wraps `GET /api/property-engagements`, `GET /api/property-engagements/:id`, and `POST /api/property-engagements` with `x-tenant-id` from the selected tenant.
- `apps/web/src/app/(internal)/engagements/page.tsx` shows the real tenant engagement list, including loading, empty, and error states.
- `apps/web/src/app/(internal)/engagements/[id]/page.tsx` shows property summary, status, assigned sellers, and explicit placeholders for movements and documents.
- `apps/web/src/app/(internal)/engagements/new/page.tsx` creates an engagement with the fields required by the backend DTO, then routes to the detail page.

**Out of scope remains:** movement publishing, owner portal, document workflow, pilot analytics dashboard, and ViewPro admin backoffice.

**Verified:** web typecheck/build, root typecheck/build, and `git diff --check` passed for this slice.

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

### Slice 4 implementation status — Movement publishing

Slice 4 replaces the engagement detail movement placeholder with real tenant-scoped movement publishing. The detail page now loads the latest movement timeline from the backend, lets internal users publish a movement with type, observation, optional next step, and optional status change, then refreshes both the timeline and engagement status after submit.

**Review path:**
- `apps/web/src/lib/movements.ts` wraps `GET /api/property-engagements/:propertyEngagementId/movements` and `POST /api/property-engagements/:propertyEngagementId/movements` with `x-tenant-id` from the selected tenant.
- `apps/web/src/components/movements/movement-timeline.tsx` renders real movement data only, including empty state, status transitions, next step, author, and timestamp.
- `apps/web/src/components/movements/create-movement-form.tsx` publishes the backend-supported `CreateMovementDto` fields used in this slice: `type`, `observation`, optional `nextStep`, and optional `newStatus`.
- `apps/web/src/app/(internal)/engagements/[id]/page.tsx` integrates movement loading, creation refresh, and the existing document placeholder.

**TDD note:** `@viewpro/web` still has only placeholder test scripts, so no meaningful RED runtime test could be expressed without adding a new frontend test stack outside this slice. Verification used typecheck/build/root checks plus the placeholder test command, reported honestly.

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

### Slice 5 implementation status — Owner portal shell and property list/detail

Slice 5 adds the owner-facing portal under `/owner/properties`. Owner pages use only owner endpoints, preserve httpOnly cookie auth through `credentials: 'include'`, and intentionally do not send `x-tenant-id` because owner access is resolved by the backend from the authenticated user.

**Review path:**
- `apps/web/src/lib/owner-portal.ts` wraps `GET /api/owner/properties`, `GET /api/owner/properties/:propertyAssetId`, `GET /api/owner/properties/:propertyAssetId/engagements`, and `GET /api/owner/engagements/:engagementId/timeline` without tenant headers.
- `apps/web/src/components/layout/owner-shell.tsx` provides a calmer owner shell with Spanish owner-oriented navigation.
- `apps/web/src/app/(owner)/owner/properties/page.tsx` lists real owner properties with loading, empty, and error states.
- `apps/web/src/app/(owner)/owner/properties/[propertyAssetId]/page.tsx` shows property summary, related engagements, the latest engagement timeline, and an explicit Slice 6 documents placeholder.

**TDD note:** `@viewpro/web` still has only placeholder test scripts, so no meaningful RED runtime test could be expressed without adding a new frontend test stack outside this slice. Verification used typecheck/build/root checks plus the placeholder test command, reported honestly.

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

### Slice 6 implementation status — Documents UX

Slice 6 connects documents to real backend contracts for both audiences. Internal users can request documents from the engagement detail, see real document request/submission state, generate read URLs, and approve or reject submitted files. Owners can open `/owner/documents`, see only owner-scoped document requests, request an upload URL, upload the selected file to the returned storage URL, confirm the upload, and refresh status.

**Review path:**
- `apps/web/src/lib/documents.ts` wraps internal tenant-scoped endpoints with `x-tenant-id` and owner endpoints without tenant headers.
- `apps/web/src/components/documents/request-document-form.tsx` creates backend `CreateDocumentRequestDto` requests with `ownerUserId`, `title`, and optional `description`.
- `apps/web/src/components/documents/document-request-list.tsx` renders real request/version state and uses backend approve, reject, and read URL endpoints.
- `apps/web/src/app/(internal)/engagements/[id]/page.tsx` replaces the documents placeholder with the request/review workflow.
- `apps/web/src/app/(owner)/owner/documents/page.tsx` and `apps/web/src/components/documents/owner-document-upload.tsx` implement owner upload/read flows with owner endpoints only.

**Backend gaps/follow-ups:**
- Internal document listing supports `page`, `pageSize`, and `status`, but not `propertyEngagementId`; the engagement detail currently requests up to 50 real document requests and filters the current engagement client-side.
- The engagement response exposes owner name/email but not the active owner user id required by `CreateDocumentRequestDto`; the internal form therefore asks for the owner user id until an owner picker or response field exists.
- The configured fake storage adapter returns `https://fake-documents.local/...` signed URLs. The frontend performs the required storage `PUT` before confirmation, but local end-to-end upload success depends on that storage URL being reachable or replaced by a real/local upload adapter.

**TDD note:** Strict TDD mode was active, but `@viewpro/web` still has only a placeholder test script. No meaningful RED runtime test could be expressed for these frontend flows without adding a new test stack, which is explicitly out of scope for this slice. Verification used web/root typecheck, build, placeholder test commands, and `git diff --check`.

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

### Slice 7 implementation status — Pilot metrics dashboard

Slice 7 adds the internal `/analytics` dashboard for managers using only real Stage 8 report endpoints. The dashboard reads the selected tenant from the existing versioned localStorage selector, sends `x-tenant-id` through the existing API client, fetches pilot summary, inactive engagements, and audit events in parallel, and renders loading, empty, and error states in Spanish without fake metrics or chart dependencies.

**Review path:**
- `apps/web/src/lib/analytics.ts` wraps `GET /api/analytics/pilot-summary`, `GET /api/analytics/inactive-engagements`, and `GET /api/analytics/events` with tenant-scoped requests.
- `apps/web/src/app/(internal)/analytics/page.tsx` performs the session/membership check and coordinates dashboard loading plus event pagination/filter refresh.
- `apps/web/src/components/analytics/*` renders the summary cards, inactive engagement risk list, and event audit table. Event metadata is shown only as compact key/value pairs after confirming the backend sanitizer removes sensitive metadata keys.
- `apps/web/src/components/layout/internal-shell.tsx` adds the workspace navigation link to `/analytics`.

**TDD note:** Strict TDD mode was active, but `@viewpro/web` still has only a placeholder test script. No meaningful RED runtime test could be expressed for this frontend dashboard without adding a new test stack, which is explicitly out of scope for this slice. Verification used web/root typecheck, build, placeholder test commands, and `git diff --check`.

## Slice 8 — Smoke tests and roadmap update

### Task 14: Add frontend smoke test capability

**Files:**
- Modify: `viewpro-app/apps/web/package.json`
- Create: frontend smoke test files once test runner is selected.

Do not add a large testing stack without confirming the tool choice. Candidate: Playwright for browser smoke tests once the vertical flow exists.

### Slice 8 implementation status — Smoke tests and roadmap update

Slice 8 replaces the placeholder `@viewpro/web` test script with a real minimal Playwright smoke capability. The runner starts the Next.js web app on a dedicated test port, opens Chromium, and checks the public unauthenticated routes that do not require backend seeds or session fixtures.

**Review path:**
- `apps/web/package.json` maps `test` to `test:smoke` and runs `playwright test`.
- `apps/web/playwright.config.ts` defines the smoke test directory, Chromium project, base URL, and Next.js `webServer` on port `3100` with local server reuse outside CI.
- `apps/web/tests/smoke/public-routes.spec.ts` verifies user-visible content and accessible controls for `/`, `/login`, and `/register`.

**TDD evidence:**
- RED: the new smoke script failed before dependency installation with `playwright: command not found`.
- Infrastructure RED: after `pnpm install`, the tests failed because Chromium browser binaries were missing.
- GREEN: after `pnpm --filter @viewpro/web exec playwright install chromium`, the three public route smoke tests passed.

**Remaining test gap:** Authenticated tenant, engagement, movement, owner, and document journey smoke tests are intentionally deferred until seeded users/sessions or equivalent deterministic test infrastructure exists.

### Task 15: Update roadmap/docs

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Modify: `docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-design.md`
- Modify: `docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md`

Document completed frontend slices and keep ViewPro Admin Backoffice as a required pre-MVP-complete item.

### Slice 8 documentation status — Stage 9 closed

Stage 9 is complete as the frontend MVP vertical plus smoke capability. The roadmap now keeps Stage 10, ViewPro Admin Backoffice, as the next required pre-MVP closure item rather than treating the MVP as finished immediately after the tenant/owner frontend.

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
- Public frontend smoke tests pass.
- ViewPro Admin Backoffice remains explicitly tracked before MVP closure.
