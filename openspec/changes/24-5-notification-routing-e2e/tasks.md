# Tasks: Stage 24.5 — Notification Routing E2E

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (happy path) / ~335 (conditional fix triggered) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (test-only happy path ~330 LOC < 400; conditional fix +~5 LOC) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All phases in one PR | PR 1 | Test-only; ~330 LOC. Conditional fix (+~5 LOC) included if triggered by Phase 3 run. |

---

## Phase 1 — Pre-implementation audit

Run ALL commands before writing any code. Paste verbatim output into apply-progress audit section. **Any unexpected result blocks apply.**

- [x] 1.1 `fd owner-notifications.e2e-spec.ts viewpro-app/apps/api/test` — expected: NO match. If a file is found, STOP and re-scope; the spec already exists.
- [x] 1.2 `rg "register-tenant|registerTenantSession|createApiApp|seedNotification" viewpro-app/apps/api/test/notifications.e2e-spec.ts` — confirms harness symbols and line numbers to mirror (createApiApp boot, registerTenantSession at ~:301, seedNotification at ~:320).
- [x] 1.3 `rg -n "ownerScopeWhere|activeOwnerAccess|accessStatus" viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts` — expected: 1 declaration of `ownerScopeWhere` (~:29), used by `listOwnerForRecipient`, `countUnreadOwnerForRecipient`, `markOwnerRead`, `markAllOwnerRead`. Confirms all four owner paths share the clause under test.
- [x] 1.4 **(A4 — D3 restore-mechanism decision)** `rg -rn "demo:seed|seed-demo|test-support|reset.*notification" viewpro-app/apps/api viewpro-app/apps/app-new/tests` — determine whether an HTTP-reachable test-reset affordance already exists. **Decision**: if yes, use it in afterEach; if no, use the full-notifications re-seed fallback (`pnpm demo:seed`-equivalent scoped to the title-guarded afterEach). **DO NOT add a new production route** regardless of outcome.
- [x] 1.5 `rg -n "PropertyAssetOwnerAccessStatus|accessStatus" viewpro-app/apps/api/prisma/schema.prisma` — expected: enum at ~:64-68 (INVITED|ACTIVE|REVOKED), accessStatus field at ~:318. Confirms non-ACTIVE values available for negative fixtures.
- [x] 1.6 `rg -n "mode: 'serial'|test.afterEach|t20TenantId|testInfo.title" viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — expected: serial config at ~:55, T20 title-guarded afterEach at ~:1028. Confirms the afterEach restoration pattern to mirror for D3.
- [x] 1.7 Record 1.4 outcome in apply-progress as **"restore-mechanism: re-seed-fallback"** or **"restore-mechanism: http-reset (route: X)"** — this drives the afterEach implementation in Phase 4.

---

## Phase 2 — Owner e2e spec: harness and helpers

Depends on: Phase 1 complete and no blockers.

Create `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` (NEW file, ~260 LOC total across phases 2–3).

- [x] 2.1 Add file header + imports: mirror `notifications.e2e-spec.ts` — `describe`/`beforeAll`/`afterAll` structure, `PrismaService` acquisition, `createApiApp()` boot, `APP_PORT` env, supertest `request` import.
- [x] 2.2 Add `beforeEach` FK-ordered wipe: mirror the exact delete order from `notifications.e2e-spec.ts:23-37`. Ensure `propertyAssetOwner` and `propertyAsset` deletes are present (R7 — both already in the internal wipe).
- [x] 2.3 Add local `registerTenantSession(app)` helper (mirror internal ~:301): calls `POST /api/auth/register-tenant`, returns `{ agent, userId, tenantId }`. Note in comment: tenantId is incidental for owner surface (scoped by recipientUserId, not tenant).
- [x] 2.4 Add extended local `seedNotification(prisma, overrides)` helper: accepts `{ recipientUserId, surface, readAt, linkHref, propertyAssetId?, propertyEngagementId?, documentRequestId?, movementId? }`. Creates one `Notification` row; all FK fields optional (default null).
- [x] 2.5 Add `seedPropertyAsset(prisma, createdByUserId)` helper: creates one `PropertyAsset` with required fields (`title`, `addressLine`, `city`, `province`, `propertyType`, `createdByUserId`). Returns the created record.
- [x] 2.6 Add `linkOwner(prisma, propertyAssetId, userId, accessStatus)` helper: creates one `PropertyAssetOwner` row with required fields (`ownerEmail`, `ownerFirstName`, `ownerLastName`, `userId`, `accessStatus`). Ensures `@@unique([propertyAssetId, userId])` is not violated.
- [x] 2.7 Add `afterAll` close: `await app.close()`.
- [x] 2.8 Add file-level comment documenting the owner-controller guard asymmetry: "OwnerNotificationsController uses @UseGuards(AuthGuard) only — no TenantMembershipGuard or PermissionGuard. The 403 'Tenant context required' case from notifications.e2e-spec.ts has no owner-surface equivalent. Omission is deliberate."

---

## Phase 3 — Owner e2e spec: test cases (S-A1 through S-A9)

Depends on: Phase 2 complete (file with harness exists).

All cases go inside the describe block created in Phase 2.

- [x] 3.1 **S-A1** — `it('returns 401 when unauthenticated')`: `GET /api/owner/notifications` without agent → expect 401. No tenant header needed (no TenantMembershipGuard).
- [x] 3.2 **S-A2** — `it('scopes list to recipient and OWNER surface; hides sensitive fields')`: seed O1-OWNER (ACTIVE access), O1-INTERNAL, O2-OWNER for same tenant. O1 fetches list → total: 1, item has no `tenantId`/`recipientUserId` top-level fields (FR-A2, FR-A10).
- [x] 3.3 **S-A3 (D1 — CRITICAL)** — `it('access filter: excludes cross-property and inactive-access records; returns only ACTIVE-access record')`: seed asset A + `linkOwner(A, recipient, ACTIVE)` + N-visible; seed asset B + `linkOwner(B, recipient, REVOKED)` + N-revoked; seed asset C + `linkOwner(C, OTHER_user, ACTIVE)` (recipient has NO link to C) + N-other. O1 fetches list → total: 1, only N-visible present. Assert unread-count reflects only A. (FR-A3, FR-A3a, FR-A3b — must be real-DB assertions, not mocked.)
- [x] 3.4 **S-A3 D1b** — within the same `it` or a sibling `it`: seed one `propertyEngagement` on A, one `documentRequest` on that engagement, one `movement` on that engagement. Seed OWNER notifications pointing at each deeper FK for the same recipient (with ACTIVE access via A). Assert all three are returned. Proves deeper join paths reach the correct `activeOwnerAccess` predicate.
- [x] 3.5 **S-A4** — `it('unread-count excludes INTERNAL-surface records')`: seed O1 with one OWNER-unread (ACTIVE access) + one INTERNAL-unread. `GET /api/owner/notifications/unread-count` → `{ unreadCount: 1 }` (FR-A4).
- [x] 3.6 **S-A5** — `it('mark-one-read on own record returns 200 with non-null readAt')`: seed O1 OWNER-unread (ACTIVE access). `POST /api/owner/notifications/:id/read` → 200, `readAt` is non-null ISO-8601 string (FR-A5).
- [x] 3.7 **S-A6** — `it('mark-one-read on another user record returns 404')`: seed O2 OWNER notification. O1 calls `POST /api/owner/notifications/:O2-id/read` → 404 (FR-A6).
- [x] 3.8 **S-A7** — `it('mark-all-read scopes to OWNER surface; leaves INTERNAL untouched')`: seed O1 with 2 OWNER-unread (ACTIVE access) + 1 INTERNAL-unread. `POST /api/owner/notifications/read-all` → 200, `{ updatedCount: 2 }`. Re-fetch `unread-count` → 0. Assert INTERNAL record still has `readAt: null` in DB (FR-A7).
- [x] 3.9 **S-A8** — `it('cross-surface link sanitization: /dashboard/* on OWNER record → null')`: seed O1 with N-dashboard (`linkHref: "/dashboard/product/some-id"`) and N-unsafe (`linkHref: "https://external.example.com"`), both with null FK (isolates link behavior, ACTIVE access via null FK short-circuit). Fetch list → both items present with `linkHref: null` (FR-A8). Add comment: "Asserts CURRENT 24.5 destinations; Stage 24.6 owns deep-link target changes."
- [x] 3.10 **S-A9** — `it('unreadOnly filter works within owner scope')`: seed O1 with 1 OWNER-unread + 1 OWNER-read (ACTIVE access or null FK). `GET /api/owner/notifications?unreadOnly=true` → total: 1. `GET /api/owner/notifications?unreadOnly=false` → total: 2 (FR-A9 parity).
- [x] 3.11 Parity cross-check comment: add a comment block before the closing `})` listing each internal spec case and its owner equivalent (or documented asymmetry). Confirms D6 case map is locked.

---

## Phase 4 — Seeded Playwright persistence tests (demo-smoke.spec.ts extension)

Depends on: Phase 1 audit (specifically 1.4 restore-mechanism decision) complete.

File: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (~70 LOC added).

- [x] 4.1 Add module-scoped state variables: `let ownerUnreadIds: string[] = []` and `let managerUnreadIds: string[] = []` (capture slots for afterEach restore, mirroring T20's `t20TenantId` pattern).
- [x] 4.2 Add title-guarded `test.afterEach` block (mirror T20 pattern at ~:1028): guard runs ONLY when `testInfo.title` matches one of the two new test titles. On teardown, restore captured unread ids to `readAt: null` using the restore mechanism resolved in 1.4 (re-seed fallback or HTTP reset route). Idempotent, order-independent.
- [x] 4.3 **S-B1** — `test('T-NEW-1: owner mark-one-read persists across re-fetch')`: sign in as `propietario.demo@viewpro.local`. Capture current unread owner notification ids via `GET /api/owner/notifications?unreadOnly=true`; store in `ownerUnreadIds`. Take first id. `POST /api/owner/notifications/:id/read`. Re-fetch `GET /api/owner/notifications?page=1&pageSize=10` → find same id in response → assert `readAt` is non-null non-empty string. (FR-B1, FR-B3, FR-B4.)
- [x] 4.4 **S-B2** — `test('manager mark-all-read yields unread-count zero after re-fetch')`: sign in as `demo@viewpro.local` (session auto-selects the single demo-tenant membership; no client `x-tenant-id` header — mirrors T07). Assert at least one unread via `GET /api/notifications?unreadOnly=true`. `POST /api/notifications/read-all`. Re-fetch `GET /api/notifications/unread-count` → `{ unreadCount: 0 }`. (FR-B2, FR-B3, FR-B4.)
- [x] 4.5 Verify T07 (`unreadCount >= 1` for manager internal) and T08 (`unreadCount >= 1` for owner, linkHref matches `/owner/` pattern) assertion lines are UNCHANGED. Do not modify T07/T08 bodies.

---

## Phase 5 — CONDITIONAL: production fix for ownerScopeWhere (only if Phase 3 red)

**SKIPPED — owner-notifications.e2e-spec.ts passed green on first real-DB run (11/11 tests). ownerScopeWhere is correct. FR-C3 applies.**

- [x] 5.1 N/A — no failing assertion. Phase 5 not triggered.
- [x] 5.2 N/A — no fix required. prisma-notifications.repository.ts is unchanged.
- [x] 5.3 N/A — spec passed green without any fix.
- [x] 5.4 N/A — typecheck passes; no production code changed.

---

## Phase 6 — Verification gates

Depends on: Phases 2–4 complete (and Phase 5 if triggered). All gates must be GREEN before tagging done.

- [x] 6.1 `pnpm --filter @viewpro/api test` — 61 test files, 726 tests, all green. owner-notifications.e2e-spec.ts: 11/11 green. notifications.e2e-spec.ts: green (S-D1 / FR-D1).
- [x] 6.2 `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors.
- [ ] 6.3 `pnpm --filter next-shadcn-dashboard-starter test:seeded` — pending (requires seeded Playwright server running; blocked by environment availability, not by code).
- [x] 6.4 Cross-check parity comment in `owner-notifications.e2e-spec.ts` — every internal case has a documented owner equivalent or justified asymmetry note (FR-A9 / D6). Comment block present at file top.
- [x] 6.5 `seed-demo.mjs` is UNCHANGED — `git diff` returns empty (FR-D3).
- [x] 6.6 `notification-link.helper.ts` is UNCHANGED — `git diff` returns empty (FR-D4).
- [x] 6.7 Guard chains on both controllers confirmed UNCHANGED: `NotificationsController @UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)`; `OwnerNotificationsController @UseGuards(AuthGuard)` (FR-D5).
- [x] 6.8 Link assertions in `owner-notifications.e2e-spec.ts` use only `/dashboard/product/some-engagement-id` and `https://external.example.com` as inputs that sanitize to null; no 24.6 deep-link targets asserted. Boundary comment present in S-A8 (FR-D6 / S-D3).

---

## Acceptance checklist — spec scenarios

| Scenario | Phase | Task(s) | Status |
|----------|-------|---------|--------|
| S-A1 — 401 unauthenticated | 3 | 3.1 | DONE |
| S-A2 — List scoped to recipient + OWNER surface; hides sensitive fields | 3 | 3.2 | DONE |
| S-A3a — Cross-property exclusion (real DB) | 3 | 3.3 | DONE |
| S-A3b — Inactive-access (REVOKED) exclusion (real DB) | 3 | 3.3 | DONE |
| S-A3 D1b — Deeper-FK positive records (engagement/documentRequest/movement) | 3 | 3.4 | DONE |
| S-A4 — Unread-count excludes INTERNAL surface | 3 | 3.5 | DONE |
| S-A5 — Mark-one-read own → 200 + readAt populated | 3 | 3.6 | DONE |
| S-A6 — Mark-one-read other user → 404 | 3 | 3.7 | DONE |
| S-A7 — Mark-all-read scopes to OWNER; INTERNAL untouched | 3 | 3.8 | DONE |
| S-A8 — /dashboard/* link on OWNER record → null | 3 | 3.9 | DONE |
| S-A9 — unreadOnly filter parity | 3 | 3.10 | DONE |
| S-A10 — invalid query 400 | 3 | 3.11 | DONE |
| S-B1 — Owner mark-one-read persists across re-fetch | 4 | 4.3 | DONE |
| S-B2 — Manager mark-all-read → unread-count 0 on re-fetch | 4 | 4.4 | DONE |
| S-C1 — Fixed ownerScopeWhere passes S-A3/D1b green (conditional) | 5 | 5.1–5.4 | SKIPPED (not triggered) |
| S-D1 — Internal e2e spec remains green | 6 | 6.1 | DONE (726/726) |
| S-D2 — T07 + T08 remain green after afterEach cleanup | 6 | 6.3 | PENDING (requires seeded server) |
| S-D3 — No 24.6 deep-link destinations asserted | 6 | 6.8 | DONE |
