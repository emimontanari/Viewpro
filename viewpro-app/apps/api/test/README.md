# API e2e test suite — audit-row trace

Run with: `pnpm --filter @viewpro/api test`

## Stage 26.4 — Security isolation negative catalogue

All 13 new tests live in `test/security-isolation.e2e-spec.ts`.

| Test ID | Scenario | Boundary | Audit row | Expected HTTP | Inversion target |
|---------|----------|----------|-----------|---------------|-----------------|
| T-1 | S-1: cross-tenant property engagement read returns 403 and no resource detail | B-1 | Coverage matrix — Security/isolation | 403 | Remove `TenantMembershipGuard` from `PropertyEngagementsController` |
| T-2 | S-2: cross-tenant movement list returns 403 and no resource detail | B-1 | Coverage matrix — Security/isolation | 403 | Remove `TenantMembershipGuard` from `MovementsController` |
| T-3 | S-3: unassigned seller GET /property-engagements/:id returns 404 and no resource detail | B-2 | FB-1 / Coverage matrix — Seller unassigned | 404 | Remove agents filter in `prisma-property-engagements.repository.findByIdForTenant` when `canViewAll=false` |
| T-4 | S-4: unassigned seller GET movements returns 404 and no resource detail | B-2 | FB-1 / Coverage matrix — Seller unassigned | 404 | Same agents filter as T-3 |
| T-5 | S-6: owner GET /owner/properties/:id for unowned property returns 404 and no resource detail | B-3 | JD-2 / Coverage matrix — Owner unauthorised | 404 | Remove `ownerUserId` filter in `ownerPortalRepository.findPropertyByOwner` |
| T-6 | S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak) | B-4 | JD-2 / Coverage matrix — Notification routing | 200 (empty) | Insert a seed row with `recipientUserId=manager.id` and `NotificationSurface.OWNER` |
| T-7 | S-9: owner GET /notifications returns 403 and no internal notification content | B-4 | JD-2 / Coverage matrix — Notification routing | 403 | Remove `TenantMembershipGuard` from `NotificationsController` |
| T-8 | S-10: unauthenticated POST /document-versions/:id/read-url returns 401 | B-5 | Coverage matrix — Document URL privacy | 401 | Remove `AuthGuard` from `DocumentVersionsController` |
| T-9 | S-11: owner POST /owner/document-versions/:id/read-url for unowned version returns 404 and no storage detail | B-5 | Coverage matrix — Document URL privacy | 404 | Remove `ownerUserId` filter in `findOwnerReadableVersion` |
| T-10 | S-12: VIEWPRO_ADMIN GET /property-engagements/:id returns 403 and no resource detail | B-6 | Coverage matrix — Admin scope | 403 | Remove `TenantMembershipGuard` from `PropertyEngagementsController` |
| T-11 | S-13: VIEWPRO_ADMIN GET /admin/access-check returns 200 (inversion proof for S-12) | B-6 | Coverage matrix — Admin scope | 200 | Remove `GlobalAdminGuard` (positive proof) |
| T-12 | S-14: unassigned seller POST status-change-request returns 403 and no resource detail | B-7 | Coverage matrix — StatusChangeRequest scope | 403 | Remove assignment check in `CreateStatusChangeRequestUseCase` |
| T-13 | cross-tenant: manager GET /api/tenants/me/status-change-requests with foreign x-tenant-id returns 403 | B-1 (extra) | Coverage matrix — Security/isolation | 403 | Remove `TenantMembershipGuard` from the bandeja route |

## Notes

- **No-leak rule**: every negative test asserts both the expected HTTP status AND that the response body does not contain resource content (title, email, tenant slug). The NestJS error body format includes the request `path` field (which echoes back the URL); this is inherent to the framework and not a resource data leak — the no-leak assertion targets resource *content* only.
- **Existing coverage referenced (not duplicated)**: S-9 and S-11 in `status-change-requests.e2e-spec.ts` cover the same B-7 / B-1 boundaries at the module level. The catalogue tests add the no-leak body assertion not present in those module specs.
- **Sanity-inversion (T-N4)**: T-1 (S-1) was chosen for the verified RED/GREEN inversion. Removing `TenantMembershipGuard` from `PropertyEngagementsController` caused 114 tests to fail (RED). Restoring the guard returned all 632 tests to GREEN.
