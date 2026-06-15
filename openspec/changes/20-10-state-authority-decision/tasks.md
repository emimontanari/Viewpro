# Tasks: Stage 20.10 — State Change Request Workflow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1 500–1 900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema + API + tests) → PR 2 (BFF + UI + seed + smoke) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |
| Decision needed before apply | Yes |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema, migration, constants, helper, Nest module, all use cases, authorization, notification wiring, unit + integration tests | PR 1 (~850–1 100 lines) | Fully functional API; UI not yet wired |
| 2 | BFF routes + zod + queries, all UI components, 200-cap banner, a11y pass, seed updates, Playwright seeded smoke | PR 2 (~650–800 lines) | Depends on PR 1 merged |

---

## Phase 1 — Pre-implementation checks (no code changes)

- [x] **T-1** Verify schema vocabulary: run `rg "PRINCIPAL_MANAGER|MANAGER|AGENT" apps/api/prisma/schema.prisma` and confirm role names match FR-4/FR-9/FR-11; note any drift. _(done: no changes needed if names match)_
- [x] **T-2** Confirm `MovementSource.SYSTEM` exists: run `rg "SYSTEM" apps/api/prisma/schema.prisma`; enum value already present at line 110 — no migration addition required. Document finding in PR description.
- [x] **T-3** Validate 400 vs 422 mapping: cross-check every `errorCode` in spec §Area 5 against the design's HTTP mapping table (§"400 vs 422 mapping"); record any mismatch in PR description before coding.

---

## Phase 2 — Schema & migration (PR 1)

- [x] **T-4** Add `StatusChangeRequestStatus` enum and `StatusChangeRequest` model to `apps/api/prisma/schema.prisma`, including all 4 `@@index` directives, 3 relation backrefs (`Tenant`, `User×2`, `PropertyEngagement`), and `@@map("status_change_requests")`. Add backrefs to `Tenant`, `User`, and `PropertyEngagement` models.
- [x] **T-5** Add 3 new `NotificationType` values to schema: `STATUS_CHANGE_REQUESTED`, `STATUS_CHANGE_APPROVED`, `STATUS_CHANGE_REJECTED`. Run `prisma migrate dev --name add_status_change_requests`. Then inspect the generated migration SQL and verify the `ALTER TYPE "NotificationType" ADD VALUE` appears as 3 separate statements. If Prisma coalesced them into fewer, split them manually before committing.
- [x] **T-6** Append the partial unique index block at the bottom of the generated migration, after all Prisma-generated blocks, using the same manually-managed header comment template as `20260615003659_add_movement_outcomes/migration.sql`:
  ```sql
  CREATE UNIQUE INDEX "status_change_requests_pending_engagement_key"
    ON "status_change_requests" ("propertyEngagementId")
    WHERE "status" = 'PENDING';
  ```
  Definition of done: `prisma migrate deploy` completes without error on a fresh DB.

---

## Phase 3 — Constants & helpers (PR 1)

- [x] **T-7** Create `apps/api/src/status-change-requests/constants/db.ts` exporting `STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT = 'status_change_requests_pending_engagement_key'`. Verify with `rg "status_change_requests_pending_engagement_key" apps/api` that exactly 2 hits exist after T-10 is done: the constant definition and the migration comment.
- [x] **T-8** Create `apps/api/src/status-change-requests/helpers/is-partial-unique-violation.ts` exporting `isPartialUniqueViolation(error: unknown, constraintName: string): boolean`. Must check both `meta.constraint === constraintName` and `Array.isArray(meta.target) && meta.target.includes(...)`. Write unit test in `apps/api/src/status-change-requests/helpers/is-partial-unique-violation.spec.ts` covering both P2002 meta shapes (constraint string form and target array form) and a non-P2002 error. _(depends on T-7)_

---

## Phase 4 — Nest module skeleton (PR 1)

- [x] **T-9** Scaffold the `status-change-requests` Nest module at `apps/api/src/status-change-requests/`:
  - `status-change-requests.module.ts` — imports listed in design §A1
  - `status-change-requests.controller.ts` — 5 route stubs with guards (`AuthGuard`, `TenantMembershipGuard`, `PermissionGuard`) per design endpoint catalog; no use-case calls yet
  - `status-change-requests.repository.ts` — interface + DI token with all 6 methods from design §A4
  - `prisma-status-change-requests.repository.ts` — Prisma implementation of all 6 methods
  - `dto/create-status-change-request.dto.ts`, `dto/decide-status-change-request.dto.ts` (reject DTO), `dto/list-status-change-requests.query.ts` — per design §DTOs
  - `responses/status-change-request.response.ts` — type + mapper `mapStatusChangeRequest`
  - Definition of done: `nest build` passes.

---

## Phase 5 — Use cases (PR 1)

- [x] **T-10** Implement `use-cases/create-status-change-request.use-case.ts`:
  - Assignment check (FR-3): seller must be in `PropertyAgent` for the engagement
  - Archived engagement guard (FR-24): `422 ENGAGEMENT_ARCHIVED`
  - Same-status guard (FR-6): `422 TARGET_STATUS_SAME_AS_CURRENT`
  - Call `repo.createPending` inside try/catch; use `isPartialUniqueViolation` with `STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT` to map P2002 → `409 STATUS_CHANGE_REQUEST_ALREADY_PENDING` (covers both meta shapes per design R2)
  - After commit, call `notificationProducer.notifyStatusChangeRequested` with recipient list = all active managers MINUS the requester
  - Audit log line: `[StatusChangeRequest] {id} → CREATED by {userId} at {timestamp}`
  - _(depends on T-8, T-9)_
- [x] **T-11** Implement `use-cases/approve-status-change-request.use-case.ts` following the 10-step transaction sequence from design §"Approval transaction design":
  1. `$queryRaw FOR UPDATE` lock
  2. Prisma reload
  3. Self-approval guard (FR-16): `403 SELF_APPROVAL_FORBIDDEN` — add JSDoc above the identity check explaining `currentUser.id` stability assumption and referencing FR-16 / R5 (issue #6)
  4. Already-resolved guard (FR-15): `409 STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`
  5. Load engagement
  6. Archived engagement guard: `422 ENGAGEMENT_ARCHIVED`
  7. Stale-state guard (FR-14): `409 STATUS_CHANGE_REQUEST_SUPERSEDED`
  8. Mutate `engagement.status`
  9. Build movement via `buildMovementCreatePayload` + `tx.movement.create` with `source = SYSTEM`, both outcome fields null (FR-13)
  10. Resolve request (`status = RESOLVED`, `resolvedByUserId`, `resolvedAt`)
  - Post-transaction: analytics event (`PROPERTY_STATUS_CHANGED`, FR-17) + `notificationProducer.notifyStatusChangeApproved` — both best-effort / `catch(() => {})`
  - Audit log: `[StatusChangeRequest] {id} → RESOLVED (approved) by {userId}`
  - _(depends on T-9)_
- [x] **T-12** Implement `use-cases/reject-status-change-request.use-case.ts`:
  - Same lock + reload + self-rejection guard + already-resolved guard as T-11 (steps 1–4)
  - No status mutation, no movement insert
  - Set `status = RESOLVED`, `resolvedByUserId`, `resolvedAt`, `resolutionComment`
  - Post-transaction: `notificationProducer.notifyStatusChangeRejected` best-effort
  - Audit log: `[StatusChangeRequest] {id} → RESOLVED (rejected) by {userId}`
  - _(depends on T-9)_
- [x] **T-13** Implement `use-cases/list-tenant-pending-status-change-requests.use-case.ts`:
  - Query `repo.listPendingForTenant({ tenantId, take: query.take ?? 200 })` (hard cap 200 — R4)
  - Sort by `createdAt ASC` per spec FR-9
  - _(depends on T-9)_
- [x] **T-14** Implement `use-cases/list-engagement-status-change-requests.use-case.ts`:
  - Query `repo.listByEngagementForTenant({ engagementId, tenantId })` sort `createdAt DESC`
  - Visibility check: manager OR assigned seller (FR-8/FR-3)
  - _(depends on T-9)_

---

## Phase 6 — Notification producer (PR 1)

- [x] **T-15** Add 3 methods to `NotificationProducerService`:
  - `notifyStatusChangeRequested` — recipients = active managers MINUS requester (query with `userId: { not: requestedByUserId }` per design §"Producer call sites"); `linkHref = /dashboard/status-change-requests`
  - `notifyStatusChangeApproved` — recipient = `requestedByUserId`; `linkHref = /dashboard/product/:propertyEngagementId`
  - `notifyStatusChangeRejected` — recipient = `requestedByUserId`; body includes `resolutionComment`
  - All 3 wrapped in `try/catch` with `Logger.warn` (FR-30)
  - _(depends on T-5 for enum values)_
- [x] **T-16** Extend `SAFE_INTERNAL_LINKS` set in `apps/api/src/notifications/notification-link.helper.ts` by adding `/dashboard/status-change-requests` (R3). Add corresponding unit test cases to `apps/api/test/notifications.repository.spec.ts`: assert the new path is returned unchanged, and `/owner/...` remains null. _(depends on T-5)_
- [x] **T-17** Write focused unit test in `apps/api/src/status-change-requests/use-cases/create-status-change-request.use-case.spec.ts` verifying that when the requester also holds a manager membership, they are excluded from the `STATUS_CHANGE_REQUESTED` notification recipient list (issue #7). Stub `tenantMembership.findMany` to return a list that includes the requester's userId; assert the notification producer is called with a recipient array that does not contain that userId.

---

## Phase 7 — Unit tests RED → GREEN (PR 1, strict TDD)

- [x] **T-18** Write RED unit tests for `create-status-change-request.use-case.spec.ts` covering: assignment check (FR-3), archived engagement (FR-24), same-status guard (FR-6), duplicate PENDING → 409 with `meta.constraint` shape, duplicate PENDING → 409 with `meta.target` array shape (both P2002 meta variants from T-8). Run tests; all must fail before implementation in T-10.
- [x] **T-19** Write RED unit tests for `approve-status-change-request.use-case.spec.ts` covering: self-approval guard (S-6, FR-16), already-resolved guard (FR-15), stale-state guard (S-7, FR-14), happy path (S-2). Run tests; all must fail before T-11.
- [x] **T-20** Write RED unit tests for `reject-status-change-request.use-case.spec.ts` covering: missing `resolutionComment` → 400 (S-4), self-rejection (FR-20), already-resolved, happy path (S-3). Run tests; all must fail before T-12.
- [x] **T-21** Wire controller to use cases in `status-change-requests.controller.ts`. Run all unit tests GREEN. _(depends on T-10–T-14, T-18–T-20)_

---

## Phase 8 — Integration tests (PR 1)

- [x] **T-22** Integration test suite `apps/api/test/status-change-requests.e2e-spec.ts` covering all 14 spec scenarios:
  - S-1 create happy path (201 + notification to managers)
  - S-2 approve full transaction (status update + movement + resolved request + analytics)
  - S-3 reject with comment
  - S-4 reject without comment → 400
  - S-5 duplicate PENDING → 409
  - S-6 self-approval with dual-role user → 403
  - S-7 stale-state guard → 409 SUPERSEDED
  - S-8 concurrent approval (two parallel calls) → exactly one 200, one 409 ALREADY_RESOLVED
  - S-9 cross-tenant isolation → 404
  - S-10 owner access → 403
  - S-11 unassigned seller → 403
  - S-12 notification failure does not roll back transaction
  - S-13 existing 403 guard on `POST /property-engagements/:id/movements` unchanged (FR-34)
  - S-14 same-status target → 422

---

## Phase 9 — Guard preservation verification (PR 1)

- [x] **T-23** Explicit gate: re-run the integration test from S-13 and confirm `POST /property-engagements/:id/movements` with `type=STATUS_CHANGE, newStatus=ACTIVE_PUBLICATION` by a seller still returns `403 "Insufficient permissions"`. Assert `apps/api/src/movements/use-cases/create-movement.use-case.ts` lines 66–68 are unchanged. Document in PR description: "Gate G1 preserved — seller direct STATUS_CHANGE blocked."

---

## Phase 10 — BFF routes (PR 2)

- [ ] **T-24** Create BFF route `apps/app-new/src/app/api/products/[id]/status-change-requests/route.ts` — `POST` and `GET` handlers using `bffFetch` + `proxyJsonResponse`, mirroring `apps/app-new/src/app/api/products/[id]/movements/route.ts`. _(depends on PR 1 merged)_
- [ ] **T-25** Create BFF route `apps/app-new/src/app/api/tenants/me/status-change-requests/route.ts` — `GET` handler; forwards query string. _(depends on T-24)_
- [ ] **T-26** Create BFF routes `apps/app-new/src/app/api/status-change-requests/[id]/approve/route.ts` and `apps/app-new/src/app/api/status-change-requests/[id]/reject/route.ts` — `PATCH` handlers; approve passes empty body, reject forwards JSON body. _(depends on T-25)_
- [ ] **T-27** Create `apps/app-new/src/features/status-change-requests/api/types.ts` with `createStatusChangeRequestSchema` and `rejectStatusChangeRequestSchema` zod validators per design §"Zod validators".
- [ ] **T-28** Create `apps/app-new/src/features/status-change-requests/api/queries.ts` with `statusChangeRequestKeys` query key factory and TanStack Query hooks: `useStatusChangeRequestsByEngagement`, `usePendingStatusChangeRequests`.
- [ ] **T-29** Create mutation hooks: `useCreateStatusChangeRequest` (optimistic prepend to `byEngagement`), `useApproveStatusChangeRequest` (optimistic RESOLVED in `pendingBandeja` + `byEngagement`, invalidates engagement detail + movements list), `useRejectStatusChangeRequest` (optimistic RESOLVED, invalidates `byEngagement` only). _(depends on T-27, T-28)_

---

## Phase 11 — UI components (PR 2)

- [ ] **T-30** Create `apps/app-new/src/app/dashboard/status-change-requests/page.tsx` — manager bandeja page using `PageContainer`, `DataTable` of `PendingRequestRow` records, empty state "No pending status change requests.". Each row: property title linked to `/dashboard/product/:id`, current status chip → target status chip, requester name, time ago, request note (truncated), Approve + Reject buttons. _(depends on T-29)_
- [ ] **T-31** Add 200-cap banner to the bandeja page: when `data.length >= 200`, render a `<Banner>` with copy "Showing the 200 oldest pending requests. Approve or reject some to see more." Write RTL test in `apps/app-new/tests/unit/status-change-requests-bandeja.spec.tsx` asserting the banner appears when response length = 200 and is absent when < 200. _(issue #5 — depends on T-30)_
- [ ] **T-32** Create `apps/app-new/src/features/status-change-requests/components/PendingRequestCard.tsx` — manager-only inline card on property detail showing "current → target" diff, requester, request note, Approve + Reject buttons. Approve opens inline confirmation; Reject opens a modal with required `resolutionComment` textarea (1–1000 chars). _(depends on T-29)_
- [ ] **T-33** Create `apps/app-new/src/features/status-change-requests/components/RequestStatusChangeDialog.tsx` — seller-only modal triggered by "Request status change" button. Fields: `targetStatus` dropdown (excluding current status), `requestNote` textarea (optional, max 1000). On success: close modal + show pending notice with `role="status"` + `aria-live="polite"`. Remove the seller's previous direct status edit control from the property detail page. _(depends on T-29)_
- [ ] **T-34** Add pending chip to the existing `StatusBadge` component: when `pendingRequest` prop is present, render a secondary chip with screen-reader copy `"Pending approval"`. Visible to both seller and manager views.
- [ ] **T-35** Add resolution toasts: seller success `"Status change request submitted"`, manager approve `"Approved · status updated to <target>"`, manager reject `"Request rejected"`, race 409 stale `"The property status changed since this request was created. Please review."`, race 409 already-resolved `"This request was already resolved."`. _(depends on T-32)_

---

## Phase 12 — Accessibility pass (PR 2)

- [ ] **T-36** Bandeja: each table row is `<tr>` with `aria-label="{propertyTitle} to {targetStatus}, requested by {requesterName}"`. Approve/Reject buttons tab-reachable; reject modal traps focus and returns to triggering button on close. Live region `aria-live="polite"` announces optimistic resolution.
- [ ] **T-37** Property detail seller card: confirm `role="status"` or `aria-live="polite"` on the pending notice. Verify keyboard nav: tab to "Request status change" button, Enter opens dialog, Tab through dialog fields, Esc closes without submit.

---

## Phase 13 — Seed update (PR 2)

- [ ] **T-38** Extend `apps/api/scripts/seed-demo.mjs`:
  - Add `createDemoStatusChangeRequests(client, tenant, users, properties)` function
  - Fixture 1 — PENDING: `martin.demo` requests `CAPTURE → ACTIVE_PUBLICATION` on property index 6 ("Casa para refaccionar en Mapuche", current status `CAPTURE`), `requestNote = "Listo para publicar"`; `createdAt = daysAgo(2)`
  - Fixture 2 — RESOLVED (historic approved): `martin.demo` requested `INQUIRIES_AND_VISITS → OFFER_NEGOTIATION` on property index 1, `createdAt = daysAgo(15)`, `resolvedAt = daysAgo(13)`, `resolvedByUserId = demo@viewpro.local`, plus corresponding `STATUS_CHANGE` movement with `source = SYSTEM` on the same property
  - Call in `seedDemo` after `movements`; add `statusChangeRequestsCount` to `printSummary`
  - Also add `client.statusChangeRequest.deleteMany({ where: { tenantId: existingTenant.id } })` to `resetDemoTenant` transaction
  - Definition of done: seed runs without error, bandeja shows 1 PENDING request, property history shows the resolved STATUS_CHANGE movement.
  - _(depends on T-5 for enum values, PR 1 merged)_

---

## Phase 14 — Playwright seeded smoke (PR 2)

- [ ] **T-39** Extend `apps/app-new/tests/seeded/demo-smoke.spec.ts` with:
  - Happy path: authenticate as `martin.demo`, open property "Casa para refaccionar en Mapuche", click "Request status change", submit `targetStatus = ACTIVE_PUBLICATION`, assert toast "Status change request submitted" and pending chip visible
  - Manager approve path: authenticate as `demo@viewpro.local`, navigate to `/dashboard/status-change-requests`, find the pending row for "Mapuche", click Approve, confirm, assert toast "Approved · status updated to ACTIVE_PUBLICATION", assert bandeja row disappears
  - Reject path: seed a second PENDING request (or re-seed), manager clicks Reject, enters `resolutionComment = "Documentación incompleta"`, confirms, asserts toast "Request rejected"
  - Definition of done: `playwright test demo-smoke.spec.ts` exits 0.

---

## Acceptance checklist

| Spec scenario / item | Tasks that prove it |
|---|---|
| S-1 create happy path | T-18, T-22 |
| S-2 approve full transaction | T-19, T-22, T-39 |
| S-3 reject with comment | T-20, T-22, T-39 |
| S-4 reject without comment → 400 | T-20, T-22 |
| S-5 duplicate PENDING → 409 | T-18, T-22 |
| S-6 self-approval dual-role → 403 | T-19, T-22 |
| S-7 stale-state → 409 SUPERSEDED | T-19, T-22 |
| S-8 concurrent approval race | T-22 |
| S-9 cross-tenant isolation | T-22 |
| S-10 owner access → 403 | T-22 |
| S-11 unassigned seller → 403 | T-18, T-22 |
| S-12 notification failure no rollback | T-22 |
| S-13 existing 403 guard preserved | T-22, T-23 |
| S-14 same-status → 422 | T-18, T-22 |
| No spec drift | T-1, T-3 |
| API 403 guard preserved (G1) | T-23 |
| P2002 meta shape variability | T-8, T-18 |
| Requester excluded from REQUESTED recipients | T-17 |
| 200-cap banner | T-31 |
| Self-approval JSDoc | T-11 |
| Constraint name single source of truth | T-7, T-10 |
| ALTER TYPE split verification | T-5 |
