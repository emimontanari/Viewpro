# Spec — Stage 24.5 Notification Routing E2E

## Status

Draft — 2026-06-22.

## Origin

Proposal: `openspec/changes/24-5-notification-routing-e2e/proposal.md`
Evidence audit: `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — JD-2, P0 gap.
Parity reference: `viewpro-app/apps/api/test/notifications.e2e-spec.ts`.

---

## Functional Requirements

### Group A — Owner-Notifications API e2e (new file, real-DB)

**FR-A1. Unauthenticated request is rejected.**
`GET /api/owner/notifications` without a valid session cookie returns HTTP 401.
No tenant-header or permission guard is required — the owner controller uses `AuthGuard` only.

**FR-A2. List is scoped to recipient and OWNER surface.**
An authenticated owner receives only notifications where `recipientUserId` matches their own user
id and `surface = OWNER`. Records belonging to:
- a different `recipientUserId` (same or different tenant), or
- the same `recipientUserId` but `surface = INTERNAL`
are excluded from the list response and from the unread-count.

**FR-A3. Active-owner-access filter excludes notifications for properties the recipient does not have ACTIVE access to.**
When `ownerScopeWhere` is applied, a notification record whose FK chain does NOT satisfy at least one
of the four AND/OR guards is excluded from the list. This requirement must be demonstrated
against a **real database** by seeding at least one should-not-see record and asserting exclusion.
Two distinct exclusion cases are required:

- **FR-A3a (cross-property):** A notification whose `propertyAssetId` points to a `PropertyAsset`
  for which the recipient has NO `PropertyAssetOwner` row is not returned.
- **FR-A3b (inactive access):** A notification whose `propertyAssetId` points to a `PropertyAsset`
  for which the recipient has a `PropertyAssetOwner` row with `accessStatus != "ACTIVE"` (e.g.
  `"REVOKED"`) is not returned.

Both cases must be seeded as `surface = OWNER` notifications with the recipient as
`recipientUserId`, so the only reason for exclusion is the active-owner-access guard — not surface
or recipient mismatch. At least one should-be-visible notification (with a valid ACTIVE access
row) must also be seeded so that exclusion of the other record is unambiguous.

**FR-A4. Unread-count is scoped to the owner surface only.**
`GET /api/owner/notifications/unread-count` returns `{ unreadCount: N }` where N counts only
`surface = OWNER, readAt = null` records for the current recipient. INTERNAL surface records with
`readAt = null` for the same user do not inflate the owner unread-count.

**FR-A5. Mark-one-read on own record returns 200 with readAt populated.**
`POST /api/owner/notifications/:id/read` where `:id` belongs to the authenticated owner returns
HTTP 200 with the notification object; `readAt` is a non-null ISO-8601 string in the response.

**FR-A6. Mark-one-read on another user's record returns 404.**
`POST /api/owner/notifications/:id/read` where `:id` belongs to a different `recipientUserId`
returns HTTP 404 (not 403 — the record is invisible to the caller's scope).

**FR-A7. Mark-all-read scopes to the owner surface only.**
`POST /api/owner/notifications/read-all` marks unread `surface = OWNER` records for the recipient
and leaves `surface = INTERNAL` records for the same user untouched. After the call:
- `GET /api/owner/notifications/unread-count` returns `{ unreadCount: 0 }`.
- Any INTERNAL-surface unread notifications for the same user remain with `readAt = null`.
- `updatedCount` in the response body equals the number of previously-unread OWNER records.

**FR-A8. Cross-surface link sanitization: dashboard-style link stored on an OWNER record sanitizes to null.**
When a notification has `surface = OWNER` and `linkHref = "/dashboard/product/<someId>"`, the list
response returns `linkHref: null` for that record. The `sanitizeOwnerNotificationLink` allowlist
permits only `/owner` and `/owner/properties/{propertyAssetId}`; any `/dashboard/*` path is not in
the allowlist and must map to null.

**FR-A9. The e2e spec is at case-level parity with the internal `notifications.e2e-spec.ts`.**
The new `owner-notifications.e2e-spec.ts` covers every category covered by the internal spec:
unauthenticated rejection, recipient+surface scoping, unread filtering and unread-count, mark-one
own→200 / other-user→404, mark-all-read, and link sanitization. No case from the internal spec
may be silently dropped. (Note: the internal spec also covers a missing-tenant-header 403; the
owner controller has no `TenantMembershipGuard`, so there is no equivalent — this asymmetry is
expected and must be noted in the new spec file.)

**FR-A10. Response shape hides sensitive fields.**
List items returned by `GET /api/owner/notifications` do not expose `tenantId` or `recipientUserId`
as top-level response properties.

---

### Group B — Seeded Playwright mark-read + reload persistence

**FR-B1. Owner mark-one-read persists across re-fetch.**
After the demo owner calls `POST /api/owner/notifications/:id/read` on an unread notification,
a subsequent `GET /api/owner/notifications` for that record returns `readAt` as a non-null string
(i.e. the write persisted to the real DB and is observable across a separate HTTP request).

**FR-B2. Manager mark-all-read yields unread-count 0 on re-fetch.**
After the demo manager calls `POST /api/notifications/read-all` (the tenant is resolved server-side
from the session-selected membership — the BFF auto-selects `memberships[0]` for the single-tenant
demo manager, so no client `x-tenant-id` header is needed), a subsequent
`GET /api/notifications/unread-count` returns `{ unreadCount: 0 }`.

**FR-B3. afterEach restores exact seeded readAt state.**
Each of the two new Playwright tests MUST restore the seeded `readAt` state via an API cleanup
call in `afterEach`. The exact seeded state to restore is:
- Owner: `Document requested` → `readAt: null` (unread); `Document rejected` → `readAt` non-null
  (read). The `afterEach` resets any records marked read by the test back to `readAt: null` via a
  direct API or Prisma reset so the seeded state is deterministic for subsequent tests.
- Manager: `Document uploaded` → `readAt: null` (unread); `Movement created` → `readAt` non-null
  (read). Same reset requirement.
This ensures existing T07 and T08 count assertions remain green regardless of test ordering.

**FR-B4. State isolation via afterEach — not serial ordering.**
Correctness of the two new tests and of T07/T08 MUST NOT depend on the serial order in which
tests run. `afterEach` cleanup is the required isolation mechanism.

---

### Group C — Conditional production fix (triggered only if e2e reveals a real bug)

**FR-C1. If FR-A3 fails against the real DB, the ownerScopeWhere fix is in-scope.**
If the new e2e spec reveals that the active-owner-access WHERE clause (`ownerScopeWhere`,
`prisma-notifications.repository.ts:29-68`) leaks a record that should be excluded (e.g. an OR
that returns inactive-access notifications, or a wrong relation join path), the fix is limited to
correcting the surfaced bug in that function. No refactor of the surrounding repository methods,
no new types, no producer call-site changes.

**FR-C2. The conditional fix must be re-proven green by the same e2e spec.**
After applying any fix to `ownerScopeWhere`, `owner-notifications.e2e-spec.ts` must run to green
against the real DB before merge. No mocked-Prisma-only fix is acceptable as evidence.

**FR-C3. If FR-A3 passes green on the first run, no production code is changed.**
The conditional branch does not trigger and `prisma-notifications.repository.ts` is unchanged.

---

### Group D — Preservation invariants (must remain true)

**FR-D1.** The existing `notifications.e2e-spec.ts` and all its assertions remain green.
**FR-D2.** T07, T08, T17, T18a in `demo-smoke.spec.ts` remain green after the two new tests
and their `afterEach` cleanups are added.
**FR-D3.** No seed change (`seed-demo.mjs` is unchanged).
**FR-D4.** The link allowlists and both sanitizers in `notification-link.helper.ts` are unchanged.
**FR-D5.** The guard chains on both controllers are unchanged.
**FR-D6.** Current link destinations (`/owner`, `/owner/properties/{propertyAssetId}`,
`/dashboard/*`, `/dashboard/product/{engagementId}`) are asserted as-is. Stage 24.6 owns
destination changes; this spec MUST NOT assert deep-link (24.6) targets.

---

## Acceptance Scenarios

### A — Owner-Notifications API e2e

**S-A1 — Unauthenticated GET /api/owner/notifications returns 401.**
Given: no session cookie is present.
When: `GET /api/owner/notifications` is sent.
Then: HTTP 401 is returned.
(Covers FR-A1.)

**S-A2 — List excludes INTERNAL-surface records and other-recipient OWNER records.**
Given: owner O1 has one OWNER-surface notification and one INTERNAL-surface notification;
user O2 has one OWNER-surface notification. All three share the same tenant.
O1 has ACTIVE `PropertyAssetOwner` access for the `propertyAssetId` of their OWNER record.
When: O1 calls `GET /api/owner/notifications`.
Then: exactly one item is returned — O1's OWNER notification.
The INTERNAL-surface record and O2's record are not present.
`total: 1`.
The response item does not have `tenantId` or `recipientUserId` as top-level fields.
(Covers FR-A2, FR-A10.)

**S-A3a — Cross-property exclusion: notification for a property the recipient does not own is excluded.**
Given: owner O1 has ACTIVE `PropertyAssetOwner` access for `PropertyAsset` P-mine.
A notification N-other exists with `recipientUserId = O1.id`, `surface = OWNER`,
`propertyAssetId = P-other.id` where O1 has NO `PropertyAssetOwner` row for P-other.
A notification N-visible exists with `recipientUserId = O1.id`, `surface = OWNER`,
`propertyAssetId = P-mine.id`.
When: O1 calls `GET /api/owner/notifications`.
Then: N-visible is present. N-other is absent. `total: 1`.
(Covers FR-A3, FR-A3a — real DB, not mocked.)

**S-A3b — Inactive-access exclusion: notification for a revoked property is excluded.**
Given: owner O1 has a `PropertyAssetOwner` row for `PropertyAsset` P-revoked
with `accessStatus = "REVOKED"`.
A notification N-revoked exists with `recipientUserId = O1.id`, `surface = OWNER`,
`propertyAssetId = P-revoked.id`.
A notification N-visible exists with `recipientUserId = O1.id`, `surface = OWNER`,
`propertyAssetId = P-active.id` where O1 has a row with `accessStatus = "ACTIVE"`.
When: O1 calls `GET /api/owner/notifications`.
Then: N-visible is present. N-revoked is absent. `total: 1`.
(Covers FR-A3, FR-A3b — real DB, not mocked.)

**S-A4 — Unread-count does not include INTERNAL-surface unread records.**
Given: owner O1 has one OWNER-surface unread notification (ACTIVE access) and one
INTERNAL-surface unread notification.
When: O1 calls `GET /api/owner/notifications/unread-count`.
Then: `{ unreadCount: 1 }`.
(Covers FR-A4.)

**S-A5 — Mark-one-read on own OWNER record returns 200 with readAt.**
Given: O1 has one OWNER-surface unread notification N-own with ACTIVE access.
When: O1 calls `POST /api/owner/notifications/{N-own.id}/read`.
Then: HTTP 200; response body includes `{ id: N-own.id, readAt: <ISO-8601 string> }`.
`readAt` is non-null and a valid date string.
(Covers FR-A5.)

**S-A6 — Mark-one-read on another recipient's OWNER record returns 404.**
Given: O2 has one OWNER-surface notification N-other.
When: O1 (authenticated) calls `POST /api/owner/notifications/{N-other.id}/read`.
Then: HTTP 404.
(Covers FR-A6.)

**S-A7 — Mark-all-read scopes to OWNER surface; INTERNAL records are untouched.**
Given: O1 has two OWNER-surface unread notifications (both with ACTIVE access) and one
INTERNAL-surface unread notification.
When: O1 calls `POST /api/owner/notifications/read-all`.
Then:
- HTTP 200; `{ updatedCount: 2 }`.
- `GET /api/owner/notifications/unread-count` returns `{ unreadCount: 0 }`.
- The INTERNAL-surface notification record in the DB still has `readAt = null`.
(Covers FR-A7.)

**S-A8 — Cross-surface link sanitization: dashboard-style link on OWNER record returns null.**
Given: O1 has two OWNER-surface notifications:
- N-dashboard: `linkHref = "/dashboard/product/some-engagement-id"`.
- N-unsafe: `linkHref = "https://external.example.com"`.
O1 has ACTIVE access for both records' propertyAssetId (set to null to isolate to link behavior).
When: O1 calls `GET /api/owner/notifications`.
Then: both items are returned with `linkHref: null`.
No `/dashboard/` path passes through `sanitizeOwnerNotificationLink`.
(Covers FR-A8.)

**S-A9 — Unread filtering parameter works within owner scope.**
Given: O1 has one OWNER-surface unread notification and one OWNER-surface read notification
(both with ACTIVE access or null FK).
When: O1 calls `GET /api/owner/notifications?unreadOnly=true`.
Then: `total: 1`; only the unread item is returned.
When: O1 calls `GET /api/owner/notifications?unreadOnly=false`.
Then: `total: 2`; both items are returned.
(Parity with internal spec case; no standalone FR — covered by FR-A9 parity requirement.)

---

### B — Seeded Playwright mark-read + reload persistence

**S-B1 — Owner mark-one-read: readAt is non-null on re-fetch.**
Given: the demo seed is applied; `propietario.demo@viewpro.local` has at least one OWNER
notification with `readAt: null` (specifically the `Document requested` record).
When: the test signs in as the owner and calls
`POST /api/owner/notifications/{id}/read` on the unread notification.
And: then calls `GET /api/owner/notifications?page=1&pageSize=10`.
Then: the re-fetched response contains the same notification id with `readAt` as a non-null
non-empty string.
afterEach: call the appropriate API or direct DB reset to set that notification's `readAt` back
to `null`, restoring the exact seeded state so T08's count assertion stays green.
(Covers FR-B1, FR-B3, FR-B4.)

**S-B2 — Manager mark-all-read: unread-count is 0 on re-fetch.**
Given: the demo seed is applied; `demo@viewpro.local` has at least one INTERNAL notification
with `readAt: null` (specifically the `Document uploaded` record).
When: the test signs in as the manager (the session auto-selects the single demo-tenant
membership; no client `x-tenant-id` header is set — mirrors the T07 precedent) and calls
`POST /api/notifications/read-all`.
And: then calls `GET /api/notifications/unread-count`.
Then: `{ unreadCount: 0 }`.
afterEach: call the API or direct DB reset to set all manager INTERNAL notifications back to
their seeded `readAt` values (`Document uploaded` → null, `Movement created` → non-null),
restoring state so T07's count assertion stays green.
(Covers FR-B2, FR-B3, FR-B4.)

---

### C — Conditional production-fix scenarios (run only if S-A3a or S-A3b fail on first run)

**S-C1 — Fixed ownerScopeWhere: S-A3a and S-A3b pass green against the real DB.**
Given: a bug was surfaced in `ownerScopeWhere` by S-A3a or S-A3b failing.
When: the correction is applied to `prisma-notifications.repository.ts:ownerScopeWhere`.
Then: running `owner-notifications.e2e-spec.ts` against the real DB passes green for all cases,
including S-A3a and S-A3b.
No other test file is changed as part of the fix.
(Covers FR-C1, FR-C2.)

---

### D — Preservation regression guards

**S-D1 — Internal e2e spec remains green.**
Given: the new `owner-notifications.e2e-spec.ts` is added and `demo-smoke.spec.ts` is extended.
When: `notifications.e2e-spec.ts` is run.
Then: all existing cases pass unchanged.
(Covers FR-D1.)

**S-D2 — T07 and T08 seeded smoke assertions remain green.**
Given: the two new Playwright tests with `afterEach` cleanup are added to `demo-smoke.spec.ts`.
When: the full seeded smoke suite is run.
Then: T07 (`unreadCount >= 1` for manager internal) and T08 (`unreadCount >= 1` for owner,
linkHref matches `/owner/` pattern) pass without modification.
(Covers FR-D2, FR-B3.)

**S-D3 — Link destinations are today's property/engagement-level paths only.**
Given: any assertion in `owner-notifications.e2e-spec.ts` that checks link values.
Then: asserted destinations are `/owner` or `/owner/properties/{propertyAssetId}` only.
No test in 24.5 asserts document-level or movement-level deep-link paths — those belong to 24.6.
(Covers FR-D6.)

---

## Non-Functional Notes

- **Test isolation model.** `owner-notifications.e2e-spec.ts` uses a `beforeEach` that wipes and
  re-seeds per test (matching the internal spec pattern), allowing complete fixture control for the
  active-owner-access seeding required by FR-A3. No dependency on the demo seed.
- **No new npm/pnpm dependency.** The new spec uses the same `supertest` + `vitest` stack as the
  internal spec. The Playwright extension uses the existing `getJson` helper pattern.
- **No schema migration.** `PropertyAssetOwner.accessStatus`, `NotificationSurface.OWNER`,
  `Notification.*Id` FK columns all exist in the current schema.
- **Owner controller guard asymmetry.** `OwnerNotificationsController` uses only `AuthGuard`; there
  is no `TenantMembershipGuard` or `PermissionGuard`. The 403 "Tenant context required" case in
  the internal spec has no owner-surface equivalent. The new spec file must include a comment
  acknowledging this asymmetry so the omission is deliberate and visible.
- **Sanitizer allowlists are unchanged.** `sanitizeOwnerNotificationLink` allowlist (`/owner`,
  `/owner/properties/{propertyAssetId}`) and `sanitizeInternalNotificationLink` allowlist are
  not modified by this slice. Tests assert current behavior against current allowlists.
- **Parity cross-check obligation.** Before tagging this slice done, cross-check the case list in
  `owner-notifications.e2e-spec.ts` against `notifications.e2e-spec.ts` case-by-case. Any
  coverage difference must be justified (e.g. the missing-tenant-header asymmetry above).
