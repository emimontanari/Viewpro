# Apply Progress — Stage 20.10 State Change Request Workflow (PR 1)

**Branch**: `feat/stage-20-10-pr-1-schema-api-tests`
**Date**: 2026-06-15
**Mode**: Strict TDD (RED → GREEN per task)
**PR scope**: PR 1 of 2 (schema + API + tests)

---

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR | Notes |
|------|-----|-------|----------|-------|
| T-8 (is-partial-unique-violation) | Tests written first, failed | Implementation added, 9 tests pass | — | Both P2002 meta shapes covered |
| T-18 (create use case RED) | 8 tests written, all failed | Impl written (T-10), 8 pass | — | ForbiddenException, UPE, Conflict both shapes |
| T-19 (approve use case RED) | 5 tests written, all failed | Impl written (T-11), 5 pass | — | Self-approval, stale, already-resolved, not-found |
| T-20 (reject use case RED) | 5 tests written, all failed | Impl written (T-12), 5 pass | — | Self-rejection, missing comment, not-found |
| T-22 (integration) | 17 e2e scenarios written, all failed | Module wired, all 17 pass | — | S-1..S-14 + dual-role + bandeja + per-property list |
| T-35 (gate G1) | Included in T-22 S-13 | Passes: 403 "Insufficient permissions" | — | CreateMovementUseCase lines 66-68 unchanged |

---

## Completed Tasks (PR 1)

- [x] **T-1** — Verified schema vocabulary: TenantRole (PRINCIPAL_MANAGER, MANAGER, AGENT) confirmed at schema lines 28-30. No drift.
- [x] **T-2** — Confirmed `MovementSource.SYSTEM` exists at schema line 110. No migration addition required.
- [x] **T-3** — 400/422 mapping validated against spec Area 5 and design HTTP mapping table. All consistent.
- [x] **T-4** — Added `StatusChangeRequestStatus` enum and `StatusChangeRequest` model to `apps/api/prisma/schema.prisma`. Added 4 `@@index` directives, 4 relations, backrefs on Tenant/User/PropertyEngagement.
- [x] **T-5** — Added 3 new `NotificationType` values. Ran `prisma migrate dev --name add_status_change_requests`. Verified 3 separate `ALTER TYPE ... ADD VALUE` statements in generated SQL (already correct).
- [x] **T-6** — Appended partial unique index block at bottom of migration SQL with manually-managed header comment (mirroring 20.13 template).
- [x] **T-7** — Created `status-change-requests/constants/db.ts` exporting `STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT = 'status_change_requests_pending_engagement_key'`.
- [x] **T-8** — Created helper `is-partial-unique-violation.ts` + unit test (9 cases, both P2002 meta shapes + non-P2002).
- [x] **T-9** — Scaffolded full Nest module skeleton: controller, module, repository interface + Prisma adapter, DTOs (create, reject, list query), response mapper. Module wired into AppModule.
- [x] **T-10** — Implemented `create-status-change-request.use-case.ts`: assignment check (ForbiddenException when not in PropertyAgent), archived guard (422), same-status guard (422), P2002 catch (409) with dual meta shape.
- [x] **T-11** — Implemented `approve-status-change-request.use-case.ts`: 10-step transaction (FOR UPDATE lock, reload, self-approval guard with JSDoc, already-resolved guard, load engagement, archived guard, stale guard, status update, movement insert via buildMovementCreatePayload, request resolution). Post-transaction: analytics + seller notification (best-effort).
- [x] **T-12** — Implemented `reject-status-change-request.use-case.ts`: lock + reload + self-rejection guard + already-resolved guard + RESOLVED update with resolutionComment. Post-transaction: seller notification (best-effort).
- [x] **T-13** — Implemented `list-tenant-pending-status-change-requests.use-case.ts`: createdAt ASC, take 200 default.
- [x] **T-14** — Implemented `list-engagement-status-change-requests.use-case.ts`: visibility check (canViewAll or assigned), createdAt DESC.
- [x] **T-15** — Extended `NotificationProducerService` with 3 new methods: `notifyStatusChangeRequested`, `notifyStatusChangeApproved`, `notifyStatusChangeRejected`. All wrapped in try/catch + Logger.warn.
- [x] **T-16** — Extended `SAFE_INTERNAL_LINKS` Set in `notification-link.helper.ts` with `/dashboard/status-change-requests`.
- [x] **T-17** — Recipient exclusion for `STATUS_CHANGE_REQUESTED` handled by `userId: { not: requestedByUserId }` in the Prisma query. Unit test asserts the WHERE clause and the recipient list excludes the requester.
- [x] **T-18** — RED unit tests for create use case (8 tests). All passed GREEN after T-10 implementation.
- [x] **T-19** — RED unit tests for approve use case (5 tests). All passed GREEN after T-11 implementation.
- [x] **T-20** — RED unit tests for reject use case (5 tests). All passed GREEN after T-12 implementation.
- [x] **T-21** — Controller wired to all 5 use cases. All unit tests GREEN (602 unit tests total).
- [x] **T-22** — Integration test suite covering all 14 spec scenarios + dual-role self-approval + bandeja + per-property list (17 e2e tests). All pass.
- [x] **T-23 / T-35** — Gate G1 preserved: S-13 e2e test confirms seller POST /property-engagements/:id/movements with type=STATUS_CHANGE returns 403 "Insufficient permissions". `CreateMovementUseCase` lines 66-68 unchanged.

---

## Tasks NOT in PR 1 (PR 2 scope)

- [ ] T-24 – T-29: BFF routes + zod + TanStack queries
- [ ] T-30 – T-37: UI components + accessibility
- [ ] T-38: Seed update
- [ ] T-39: Playwright seeded smoke

---

## Files Changed (PR 1)

### Schema & migration
- `viewpro-app/apps/api/prisma/schema.prisma` — Added StatusChangeRequestStatus enum, StatusChangeRequest model, 3 NotificationType values, backrefs on Tenant/User/PropertyEngagement
- `viewpro-app/apps/api/prisma/migrations/20260615023015_add_status_change_requests/migration.sql` — New migration with partial unique index appended

### New module
- `viewpro-app/apps/api/src/status-change-requests/constants/db.ts`
- `viewpro-app/apps/api/src/status-change-requests/helpers/is-partial-unique-violation.ts`
- `viewpro-app/apps/api/src/status-change-requests/helpers/is-partial-unique-violation.spec.ts`
- `viewpro-app/apps/api/src/status-change-requests/dto/create-status-change-request.dto.ts`
- `viewpro-app/apps/api/src/status-change-requests/dto/reject-status-change-request.dto.ts`
- `viewpro-app/apps/api/src/status-change-requests/dto/list-status-change-requests.query.ts`
- `viewpro-app/apps/api/src/status-change-requests/responses/status-change-request.response.ts`
- `viewpro-app/apps/api/src/status-change-requests/status-change-requests.repository.ts`
- `viewpro-app/apps/api/src/status-change-requests/prisma-status-change-requests.repository.ts`
- `viewpro-app/apps/api/src/status-change-requests/status-change-requests.controller.ts`
- `viewpro-app/apps/api/src/status-change-requests/status-change-requests.module.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/create-status-change-request.use-case.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/create-status-change-request.use-case.spec.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/approve-status-change-request.use-case.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/approve-status-change-request.use-case.spec.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/reject-status-change-request.use-case.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/reject-status-change-request.use-case.spec.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/list-tenant-pending-status-change-requests.use-case.ts`
- `viewpro-app/apps/api/src/status-change-requests/use-cases/list-engagement-status-change-requests.use-case.ts`

### Modified
- `viewpro-app/apps/api/src/app.module.ts` — Registered StatusChangeRequestsModule
- `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` — Added 3 new methods + input types
- `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` — Added /dashboard/status-change-requests to SAFE_INTERNAL_LINKS

### Integration tests
- `viewpro-app/apps/api/test/status-change-requests.e2e-spec.ts`

---

## Design Deviations

1. **Manager bandeja endpoint** uses path `/tenants/me/status-change-requests` (design A5). ✅ As designed.
2. **Recipient query for notifications** uses `PrismaService` directly (not a port/repository) to query `tenantMembership.findMany`. Rationale: the existing `MembershipsRepository` has no `findActiveMembershipsForTenant` method; adding it would be a separate task. The Prisma query is localized in `notifyManagers()` private method of the use case, same pattern as other use cases that call Prisma directly.
3. **`isPartialUniqueViolation`** helper: the `createPending` catch in the use case also checks `meta.target.includes('propertyEngagementId')` as an additional fallback (per design R2 text). This is an additive safety measure, not a deviation.

---

## Non-obvious Findings (for PR 2 + next session)

- **Prisma `$queryRaw` FOR UPDATE** syntax in the approve/reject use cases: `WHERE id = ${requestId} AND "tenantId" = ${tenantId}` — column names need no quotes unless mixed-case. `tenantId` is camelCase in Prisma but snake_case (`tenantid`) in Postgres? Actually Prisma maps `tenantId` → `"tenantId"` in the DB (quoted camelCase). The column in SQL is `"tenantId"`.
- **P2002 meta shape for partial unique indexes in Prisma 6**: the `meta.constraint` field carries the constraint/index name as a string (e.g., `'status_change_requests_pending_engagement_key'`). The `meta.target` field carries field names (e.g., `['propertyEngagementId']`), NOT the index name. This matches design R2's dual-check strategy.
- **Login endpoint returns 201** (NestJS POST default) — not 200. Don't add `.expect(200)` to login calls in e2e tests.
- **PropertyAgent assignment** uses `POST /property-engagements/:id/agents` which also returns 201.
- **Migration applied to `viewpro_dev`** (new DB created from scratch for migration generation) and to `viewpro_test` (existing test DB via `prisma migrate deploy`). The `viewpro` DB (development) is the one used in daily work — it needs the migration applied manually or via seed reset.
- **`isPartialUniqueViolation`** tests import from `@prisma/client` directly — `Prisma.PrismaClientKnownRequestError` constructor in tests works fine in Prisma 6.
- **S-6 (dual-role self-approval)**: `TenantMembership` has `@@unique([userId, tenantId])` so a user cannot have two membership rows for the same tenant. The test simulates dual-role by updating the membership role from AGENT to MANAGER mid-test (after the request was created), then the seller (now MANAGER) tries to approve.

---

## Verification Results

| Gate | Result |
|------|--------|
| `db:validate` | ✅ pass |
| `typecheck` | ✅ pass |
| `test` (full suite) | ✅ 619/619 pass |
| Test files | 55 passed |
| Gate G1 (existing 403 preserved) | ✅ S-13 asserts 403 "Insufficient permissions" |
