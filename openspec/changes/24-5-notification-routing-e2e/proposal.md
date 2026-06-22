# Proposal — Stage 24.5 Notification Routing E2E

## Status

Draft — proposed 2026-06-22.

## Origin

- `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — notification routing / read-unread flagged as a **P0 evidence gap** (JD-2 hypothesis). The audit asserts the production code routes correctly, but there is no database-level integration proof for the owner surface and no persistence proof for mark-read.
- `docs/plans/CURRENT_MVP_EXECUTION.md` — Stage 24.5 is the next and only unblocked MVP development slice.
- Stage 23.4 close-out — its slice contract explicitly named `24.5 — notification routing E2E` as the next slice.

## Slice contract

```txt
Stage: 24
Slice: 24.5 — Notification routing E2E (test-only evidence; conditional fix)
Objective: close the P0 audit gap on notification routing / read-unread by adding the missing
  database-level integration proof for the OWNER notification surface (at parity with the existing
  internal e2e spec) and seeded mark-read persistence proof for both surfaces.
Evidence needed: a new `owner-notifications.e2e-spec.ts` at full parity with the existing
  `notifications.e2e-spec.ts` (401-on-unauthenticated; list scoped to owner+recipient; the
  active-owner-access AND/OR WHERE clause enforced against a real DB; unread-count; mark-one-read
  own→200 / other-user→404; mark-all-read; cross-surface link sanitization to null); plus 2 new
  seeded Playwright tests proving mark-read + reload persistence for owner and manager, with
  afterEach API cleanup to restore readAt so existing T07/T08 count assertions stay green.
Do not touch: realtime/SSE/WebSockets; push/email providers; new notification types; producer
  call-site changes; NotificationCenter UI redesign; any schema migration. Notification
  deep-linking precision (document/movement-level targets) belongs to Stage 24.6, NOT 24.5.
Conditional: if the new owner e2e spec reveals a real bug in the active-owner-access WHERE clause,
  the production fix is IN-SCOPE for this slice (24.5 becomes a hybrid evidence+fix slice).
Done: the owner notification surface has a real-DB integration spec at parity with the internal
  surface; mark-read persistence is proven across a reload for both surfaces; existing baselines
  remain green; any WHERE-clause bug surfaced by the new spec is fixed.
Next slice: 24.6 — notification deep-linking precision (document/movement-level targets).
```

## Investigation summary (2026-06-22)

Grounded in the exploration artifact (`sdd/24-5-notification-routing-e2e/explore`) and confirmed against source.

**Two surfaces, two controllers, one shared repository.**

- **INTERNAL** (`NotificationsController`, `GET/POST /api/notifications`): guarded by `AuthGuard` + `TenantMembershipGuard` + `PermissionGuard(TENANT_VIEW)` + tenant-header scoping. Links sanitized via `sanitizeInternalNotificationLink` — allowlist `/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`, `/dashboard/status-change-requests`, and the `/dashboard/product/{engagementId}` pattern (`viewpro-app/apps/api/src/notifications/notification-link.helper.ts:1-31`).
- **OWNER** (`OwnerNotificationsController`, `GET/POST /api/owner/notifications`): guarded by `AuthGuard` ONLY — no tenant membership, no permission guard. Links sanitized via `sanitizeOwnerNotificationLink` — allowlist `/owner` and the `/owner/properties/{propertyAssetId}` pattern (`notification-link.helper.ts:33-54`).

**The active-owner-access filter (central risk).** `ownerScopeWhere` in `viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts:29-68` builds the owner list WHERE clause. It scopes to `recipientUserId` + `surface: OWNER`, then applies **4 nested AND/OR guards** (lines 44-65) — one each for `propertyAssetId`, `propertyEngagementId`, `documentRequestId`, `movementId` — each requiring either a null FK or an `accessStatus: "ACTIVE"` `PropertyAssetOwner` for the recipient. This clause is the surface-isolation and access-revocation invariant. It is unit-tested with a mocked Prisma client, so an integration-level SQL/relation bug (wrong join path, an OR that leaks an inactive-access record) could still exist undetected. **There is no real-DB test exercising it.**

**The asymmetry this slice closes.** `viewpro-app/apps/api/test/notifications.e2e-spec.ts` exists and gives the INTERNAL surface full real-DB coverage (401, surface isolation, unread-count, mark-one/all-read, 404-on-other-user, link sanitization). A parallel `owner-notifications.e2e-spec.ts` does **NOT** exist — confirmed by glob. The owner surface, despite owning the more complex WHERE clause and the weaker guard chain (no tenant/permission guard), has zero database-level integration proof.

**Seeded notifications (4 per demo run, `seed-demo.mjs`).** OWNER/DOCUMENT_REQUESTED (unread) and OWNER/DOCUMENT_REJECTED (read) to the owner; INTERNAL/DOCUMENT_UPLOADED (unread) and INTERNAL/MOVEMENT_CREATED (read) to the manager.

**The persistence gap.** Existing Playwright tests T07 (manager) and T08 (owner) in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` assert only listing + unread-count presence. Neither calls a mark-read endpoint, verifies `readAt` becomes non-null, or re-fetches to prove persistence across a reload. T17/T18a prove producers fire on create/reject but do no click-through or read-state work.

## Scope

This is a **test-only evidence slice** with a **conditional production-fix branch**.

### 1. New API e2e spec — owner notification surface (P0 must-have)

`viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` (NEW) — real-DB integration test for the OWNER surface, at **full parity** with the existing internal `notifications.e2e-spec.ts`. Covers:

- Unauthenticated request → **401**.
- List scoped to owner + recipient (excludes the INTERNAL surface, excludes other recipients' owner records).
- **Active-owner-access filter** (the 4 AND/OR guards in `ownerScopeWhere`) enforced against a real DB — a notification whose FK points at a property the recipient does NOT have ACTIVE access to is **not** returned, and an inactive (`accessStatus != "ACTIVE"`) owner-access record does **not** leak notifications.
- Unread-count scoped to the owner surface only.
- Mark-one-read: own record → **200**; another user's record → **404**.
- Mark-all-read scoped to the owner surface (internal records untouched; unread-count → 0).
- Cross-surface link sanitization: a dashboard-style link stored on an owner record sanitizes to **null**.

### 2. Seeded mark-read + reload persistence proof (P0 must-have)

**2 new seeded Playwright tests** in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`:

- **Owner:** open the notification center → mark one notification read → re-fetch → verify `readAt` is non-null (persisted across a reload).
- **Manager:** mark-all-read → re-fetch → verify the unread-count becomes **0**.

State-mutation isolation via `afterEach` is **REQUIRED** (not serial ordering): each test restores the seeded `readAt` state through an API cleanup call so existing T07/T08 count assertions are not broken.

### 3. Conditional production-fix branch (becomes hybrid evidence+fix if triggered)

If the new owner e2e spec reveals a **real bug** in the active-owner-access WHERE clause (`ownerScopeWhere`, `prisma-notifications.repository.ts:29-68`) — e.g. an OR that leaks an inactive-access record, or a wrong relation join path — the fix is **IN-SCOPE** for this slice. 24.5 then becomes a hybrid evidence+fix slice. This is a **conditional branch, not guaranteed work**: if the spec passes green against the real DB, no production code changes.

## Out of scope (explicit non-goals)

- **Notification deep-linking precision** (document/movement-level exact-target navigation) — this is a **separate planned feature, Stage 24.6, NOT part of 24.5**. 24.5 asserts the **current** property/engagement-level link destinations (`/owner/properties/{propertyAssetId}`, `/dashboard/product/{engagementId}`); 24.6 will change them to point at the exact document/movement target. Any test in 24.5 must assert today's destinations, not 24.6's.
- **G3 click-through UI navigation Playwright proof** — punted. Click-through navigation is already covered by unit tests in `viewpro-app/apps/app-new/src/features/notifications/.../notification-center.test.tsx` (9 tests including click-through navigation and unsafe-link rejection). A seeded Playwright click-through is redundant for this slice.
- Realtime / SSE / WebSockets.
- Push or email notification providers.
- New notification types.
- Producer call-site changes (`NotificationProducerService` and all 8 produce methods stay as-is).
- NotificationCenter UI redesign.
- Any schema migration.

## Preserve unchanged

- The existing internal `notifications.e2e-spec.ts` and all its assertions.
- T07, T08, T17, T18a in `demo-smoke.spec.ts` — must remain green; the `afterEach` cleanup exists specifically to protect their count assertions.
- The Stage 26.2 deterministic seed contract (`seed-demo.mjs`) — no seed change.
- The link allowlists and both sanitizers in `notification-link.helper.ts`.
- The guard chains on both controllers.
- Current link destinations (`/owner`, `/owner/properties/{propertyAssetId}`, `/dashboard/*`, `/dashboard/product/{engagementId}`) — 24.5 asserts these as-is; 24.6 owns changing them.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- None on the happy path (test-only). **Conditional:** if the owner e2e spec surfaces a WHERE-clause bug, `notifications` (owner-surface list scoping) gains a corrected active-owner-access filter — documented and re-proven by the same spec.

## Affected areas

Tests (this slice is test-only on the happy path):

- `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` (NEW) — owner-surface real-DB integration spec at parity with the internal spec.
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (extend) — 2 new seeded tests (owner mark-one-read + reload; manager mark-all-read → count 0) with `afterEach` API cleanup.

Conditional production code (only if the e2e spec reveals a real bug):

- `viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts` — `ownerScopeWhere` (lines 29-68) active-owner-access WHERE clause.

OpenSpec:

- `openspec/changes/24-5-notification-routing-e2e/` — this folder.

## Safety and integrity constraints

- **Test-only on the happy path.** No controller, use-case, producer, sanitizer, UI, copy, seed, or schema change unless the conditional fix branch is triggered.
- The `afterEach` cleanup MUST restore the exact seeded `readAt` state (owner DOCUMENT_REQUESTED unread, owner DOCUMENT_REJECTED read; manager DOCUMENT_UPLOADED unread, manager MOVEMENT_CREATED read) so T07/T08 count assertions are unaffected. State isolation via `afterEach` is required — do NOT rely on serial test ordering.
- The new owner e2e spec MUST exercise the **real** active-owner-access filter against a real DB — it must seed at least one notification the recipient should NOT see (inactive or cross-property access) and assert it is filtered out, otherwise the spec proves nothing about the central risk.
- If the conditional fix triggers, the diff touches the owner-surface list scoping — treat it as a hot path and run the new spec to green before merging.
- No `--no-verify` on commits; lint/typecheck/tests must pass.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 — The active-owner-access WHERE clause (`ownerScopeWhere`, 4 AND/OR guards) is unproven against a real DB.** Unit tests mock Prisma, so a wrong join path or a leaking OR could pass unit coverage yet expose another property's / an inactive owner's notifications. | Med | This is the core reason for the slice. The new e2e spec MUST seed a notification the recipient should NOT see (cross-property AND inactive-access cases) and assert it is excluded. If a leak is found, the conditional fix branch (R-fix) activates. |
| **R2 — `afterEach` cleanup incomplete → T07/T08 count assertions break.** Marking records read without restoring `readAt` shifts seeded unread counts and breaks the existing smokes. | High | Mandatory `afterEach` that restores the precise seeded `readAt` state per record. Verify T07/T08 stay green in the same run before tagging done. State isolation via `afterEach`, never serial ordering. |
| **R3 — Conditional fix scope creep.** If a WHERE-clause bug is found, the temptation is to refactor the whole scoping. | Med | The conditional fix is limited to correcting the surfaced bug in `ownerScopeWhere`, re-proven by the same spec. No refactor, no new types, no producer changes. |
| **R4 — Asserting 24.6's link destinations by mistake.** Tests could be written against the future deep-link targets instead of today's property/engagement-level destinations. | Med | Assert current destinations only (`/owner/properties/{propertyAssetId}`, `/owner`). Add an explicit comment in the spec pointing to 24.6 as the owner of destination changes. |
| **R5 — Parity drift from the internal spec.** The new owner spec could silently omit a case the internal spec covers. | Low | Mirror `notifications.e2e-spec.ts` case-by-case (401, surface isolation, unread-count, mark-one own→200 / other→404, mark-all, link sanitization) and cross-check the case list before tagging done. |

## Rollback

Revert the new `owner-notifications.e2e-spec.ts`, the 2 seeded-test extensions + `afterEach` cleanup in `demo-smoke.spec.ts`, and this OpenSpec folder. If the conditional fix branch shipped, revert the `ownerScopeWhere` change as well. No seed, schema, or UI touched on the happy path. Pre-existing baselines (the internal e2e spec, T07/T08/T17/T18a, the 26.2 deterministic seed contract, both controllers' guard chains, the link allowlists) remain intact.

## Success criteria

- [ ] `owner-notifications.e2e-spec.ts` exists and covers, against a real DB: 401-on-unauthenticated; owner+recipient scoping; the active-owner-access AND/OR filter (including at least one record the recipient should NOT see); unread-count; mark-one own→200 / other-user→404; mark-all-read; cross-surface link sanitization to null.
- [ ] The new spec is at parity with the internal `notifications.e2e-spec.ts` case list.
- [ ] A seeded test proves the demo owner can mark one notification read and the `readAt` persists across a reload.
- [ ] A seeded test proves the demo manager can mark all read and the unread-count becomes 0.
- [ ] `afterEach` API cleanup restores seeded `readAt` state; T07/T08 count assertions remain green.
- [ ] If a WHERE-clause bug was surfaced, it is fixed and re-proven green by the same spec; otherwise no production code changed.
- [ ] All pre-existing test baselines remain green.

## Next phases

Proceed to `sdd-spec` (and `sdd-design` in parallel — the design phase resolves the e2e fixture/seeding seam for the active-owner-access negative case and the `afterEach` cleanup mechanism, plus the conditional-fix decision point).
