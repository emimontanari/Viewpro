# Spec — Stage 26.4 Security and Isolation Regression

## Slice contract (verbatim)

```
Stage: 26
Slice: 26.4 — Security and isolation regression
Objective: prove that no role, surface, or tenant can read or mutate resources outside its declared scope.
Evidence needed: a focused suite of negative API and seeded UI tests that exercise each isolation boundary the audit listed and asserts the expected denial response.
Do not touch: schema, permission semantics, the API 403 guard, the 26.2 deterministic seed contract, the 26.2.1 image fixtures, or any product UI beyond minimal wiring if a denial path lacks an error surface.
Done: every listed isolation boundary has at least one automated test that proves the denial; the test suite is reproducible from a clean pnpm demo:seed.
Next slice: 26.5 — Staging/deploy checklist.
```

---

## Boundary catalogue

| B-ID | Audit row | Resource | Protected against | Today's guard mechanism | Today's response | Body leaks resource detail? |
|------|-----------|----------|-------------------|------------------------|------------------|-----------------------------|
| B-1 | Coverage matrix — Security/isolation | PropertyEngagement (any tenant route) | Member of a different tenant | `TenantMembershipGuard` (checks membership scoped to x-tenant-id header); if no membership → 403. DB queries also filter by `tenantId`, so a forged header with no membership never reaches the query. | **403** (guard fires before query; cross-tenant header with no membership: `Tenant access denied`) | No: message is generic |
| B-2 | FB-1 / Coverage matrix — Seller unassigned | PropertyEngagement detail/sub-resources for an unassigned property within the same tenant | Seller not in `PropertyAgent` for that engagement | `findByIdForTenant(canViewAll=false)` — scopes by `agents.agentUserId = userId`; returns null → NotFoundException | **404** (`Property engagement not found`) | No: no property id or title in body |
| B-3 | JD-2 / Coverage matrix — Owner unauthorised | PropertyAsset and PropertyAssetOwnerAccess | Owner user without an ACTIVE `PropertyAssetOwnerAccess` record for the requested property | `ownerPortalRepository.findPropertyByOwner` filters by `ownerUserId`; null → NotFoundException | **404** (`Owner property not found`) | No |
| B-4 | JD-2 / Notification routing | INTERNAL surface notifications via `GET /notifications` | Owner role (has no `TenantMembership`) | `TenantMembershipGuard` on `NotificationsController` blocks any user without active membership | **403** (`Tenant access denied` or `Tenant context required`) | No |
| B-5 | Coverage matrix — Document URL privacy | DocumentVersion signed read URL (`POST /document-versions/:id/read-url`, internal or owner) | Unauthenticated user; user with no owner/membership access to the version | `AuthGuard` first → 401; if authenticated but version not in scope → NotFoundException | **401** (unauthenticated) / **404** (authenticated but wrong scope) | No |
| B-6 | Coverage matrix — Admin scope | Tenant-private property detail (`GET /property-engagements/:id`) | `VIEWPRO_ADMIN` with no active tenant membership | `TenantMembershipGuard` fires before any controller; admin has no membership → 403 | **403** (`Tenant context required` / `Tenant access denied`) | No |
| B-7 | Coverage matrix — StatusChangeRequest scope | `POST /property-engagements/:id/status-change-requests` for unassigned engagement | Seller not assigned to that engagement | `CreateStatusChangeRequestUseCase` calls `findByIdForTenant(canViewAll=false)` → null → **ForbiddenException** | **403** (`NOT_ASSIGNED_TO_ENGAGEMENT`) | No: errorCode is semantic, no property id or title |

### Spec deltas required

- **B-1 vs canonical 404**: The proposal proposes 404 for cross-tenant resource lookups. The `TenantMembershipGuard` currently returns **403** when the requesting user has no membership in the x-tenant-id tenant, before the DB is queried. This is the existing confirmed behavior from `tenant-membership.guard.ts`. The design phase MUST decide: (a) accept 403 at the guard layer for cross-tenant, or (b) introduce a 404 shim at the use-case layer for cross-tenant lookups. This spec documents today's 403 and flags it for design decision.
- **B-7 vs canonical 404**: `CreateStatusChangeRequestUseCase` throws `ForbiddenException(NOT_ASSIGNED_TO_ENGAGEMENT)` → 403, not 404. The proposal states 404 for unassigned sellers. The design phase MUST confirm whether this stays 403 (existing guard) or changes. The proposal's "Do not touch: the API 403 guard" clause suggests 403 is intentional for B-7.

---

## Functional requirements

### B-1 — Cross-tenant denial

**FR-1** The system MUST return HTTP 403 when a user authenticated to tenant A sends a request to any `/property-engagements/*` route with `x-tenant-id` set to tenant B's id, and must not include any content of tenant B's resources in the response body.

**FR-2** The system MUST return HTTP 403 for cross-tenant requests to `/notifications`, `/movements`, `/document-requests`, and `/status-change-requests` routes under the same conditions as FR-1.

### B-2 — Seller unassigned denial

**FR-3** The system MUST return HTTP 404 when a seller (AGENT role) requests `GET /property-engagements/:id` for a property engagement in their tenant to which they are not assigned.

**FR-4** The system MUST return HTTP 404 when a seller (AGENT role) requests `GET /property-engagements/:id/movements` for a property engagement in their tenant to which they are not assigned.

**FR-5** The response body for FR-3 and FR-4 MUST NOT contain the engagement's id, title, address, or any owner email.

### B-3 — Owner unauthorised access

**FR-6** The system MUST return HTTP 404 when an owner requests `GET /owner/properties/:id` for a property asset they do not own (no ACTIVE `PropertyAssetOwnerAccess` record).

**FR-7** The response body for FR-6 MUST NOT contain the property's id, title, address, or any tenant name.

### B-4 — Notification surface isolation

**FR-8** The system MUST return HTTP 403 (or 401 if unauthenticated) when a request for `GET /notifications` or `POST /notifications/:id/read` is made by a user with `GlobalRole=USER` and no active tenant membership for the specified `x-tenant-id`.

**FR-9** Owner-surface notifications (`GET /owner/notifications`) MUST NOT appear for a user authenticated as a tenant member (AGENT/MANAGER) making an authenticated GET to that endpoint without owner access. The owner notification endpoint only uses `AuthGuard`; access is implicitly scoped to the authenticated `userId` querying their own owner-surface records, so a manager token calling `/owner/notifications` will receive an empty list (no cross-surface leak).

### B-5 — Document URL privacy

**FR-10** The system MUST return HTTP 401 when an unauthenticated request is made to `POST /document-versions/:id/read-url` (internal or owner path).

**FR-11** The system MUST return HTTP 404 when an authenticated user requests `POST /owner/document-versions/:id/read-url` for a document version not linked to a property they own.

**FR-12** The response body for FR-11 MUST NOT contain the storage key, file name, or owner email.

### B-6 — Admin scope

**FR-13** The system MUST return HTTP 403 when a `VIEWPRO_ADMIN` user (no tenant membership) makes a request to `GET /property-engagements/:id` with any `x-tenant-id` header.

**FR-14** The admin routes (`/admin/*`) MUST remain accessible to `VIEWPRO_ADMIN` (positive proof: `GET /admin/access-check` → 200).

### B-7 — StatusChangeRequest seller scope

**FR-15** The system MUST return HTTP 403 when a seller makes `POST /property-engagements/:engagementId/status-change-requests` for an engagement in their tenant to which they are not assigned.

**FR-16** The response body for FR-15 MUST NOT contain the engagement's id, title, or address.

---

## Acceptance scenarios

### B-1 — Cross-tenant

**S-1** Cross-tenant property engagement read
- GIVEN tenant A and tenant B exist with a seeded engagement each
- WHEN a manager of tenant A sends `GET /property-engagements/{tenantB_engagementId}` with `x-tenant-id: {tenantB_id}` using a valid tenantA JWT
- THEN the response status is 403
- AND the response body does not contain tenantB's engagement id or title
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-1: cross-tenant property engagement read returns 403 and no resource detail`
- Key assertion: `expect(res.status).toBe(403); expect(JSON.stringify(res.body)).not.toContain(tenantBEngagementId)`

**S-2** Cross-tenant movement read
- GIVEN tenant A and tenant B exist with a seeded movement on a tenantB engagement
- WHEN a manager of tenant A requests `GET /property-engagements/{tenantB_engagementId}/movements` with `x-tenant-id: {tenantB_id}`
- THEN the response status is 403
- AND the response body does not contain tenantB's engagement id
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-2: cross-tenant movement list returns 403 and no resource detail`

### B-2 — Seller unassigned

**S-3** Seller reads unassigned engagement detail
- GIVEN a seller is authenticated in tenant A and is NOT assigned to engagement E
- WHEN they request `GET /property-engagements/{E.id}` with `x-tenant-id: {tenantA_id}`
- THEN the response status is 404
- AND the response body does not contain E's id, title, or any owner email
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-3: unassigned seller GET /property-engagements/:id returns 404 and no resource detail`
- Key assertion: `expect(res.status).toBe(404); expect(JSON.stringify(res.body)).not.toContain(engagementId)`

**S-4** Seller reads movements on unassigned engagement
- GIVEN a seller is authenticated in tenant A and is NOT assigned to engagement E
- WHEN they request `GET /property-engagements/{E.id}/movements` with `x-tenant-id: {tenantA_id}`
- THEN the response status is 404
- AND the response body does not contain E's id
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-4: unassigned seller GET movements on unassigned engagement returns 404 and no resource detail`

**S-5 (UI)** Seller direct deep-link to unassigned property
- GIVEN a seller is signed in and has assigned properties
- WHEN they navigate directly to `/dashboard/product/{unassignedEngagementId}` in the browser
- THEN the page does not render the property title or any engagement data
- AND a 404 or access-denied UI surface is shown (or blank — flagged as MUI-1)
- Test file: `demo-smoke.spec.ts` (isolation block) or sibling
- Test name: `isolation: seller direct deep-link to unassigned property is denied`

### B-3 — Owner unauthorised access

**S-6** Owner reads property they do not own
- GIVEN owner O1 exists and property P belongs to owner O2 only
- WHEN O1 requests `GET /owner/properties/{P.id}`
- THEN the response status is 404
- AND the response body does not contain P's id, title, or O2's email
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-6: owner GET /owner/properties/:id for unowned property returns 404 and no resource detail`

**S-7 (UI)** Owner direct deep-link to property they do not own
- GIVEN owner O1 is signed in and property P belongs to O2
- WHEN O1 navigates directly to `/owner/properties/{P.id}` in the browser
- THEN the page does not render P's title or any property data
- AND a 404 or access-denied surface is shown (flagged as MUI-2)
- Test file: `demo-smoke.spec.ts` (isolation block) or sibling
- Test name: `isolation: owner direct deep-link to unowned property is denied`

### B-4 — Notification surface isolation

**S-8** Manager cannot access owner notification endpoint with meaningful data
- GIVEN a tenant manager (AGENT/MANAGER role, no owner access status) is authenticated
- WHEN they request `GET /owner/notifications` (no x-tenant-id needed; scoped to userId)
- THEN the response is 200 with an empty items array (manager has no owner-surface notifications)
- AND no INTERNAL-surface notification appears in the response
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak)`

**S-9** Owner cannot access dashboard notification endpoint
- GIVEN an owner user (no tenant membership) is authenticated
- WHEN they request `GET /notifications` with any x-tenant-id header
- THEN the response status is 403
- AND the response body does not contain any internal notification content
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-9: owner GET /notifications returns 403 and no internal notification content`

### B-5 — Document URL privacy

**S-10** Unauthenticated user cannot generate a document read URL
- GIVEN no authentication cookie/token is present
- WHEN a request is made to `POST /document-versions/{anyId}/read-url` (internal path)
- THEN the response status is 401
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-10: unauthenticated POST /document-versions/:id/read-url returns 401`

**S-11** Owner cannot generate a read URL for a document version they do not own
- GIVEN owner O1 is authenticated and document version V belongs to owner O2's request
- WHEN O1 requests `POST /owner/document-versions/{V.id}/read-url`
- THEN the response status is 404
- AND the response body does not contain V's storage key, file name, or O2's email
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-11: owner POST /owner/document-versions/:id/read-url for unowned version returns 404 and no storage detail`

### B-6 — Admin scope

**S-12** VIEWPRO_ADMIN cannot read tenant-private engagement content
- GIVEN a user with GlobalRole=VIEWPRO_ADMIN and no tenant membership exists
- WHEN they request `GET /property-engagements/{tenantA_engagementId}` with `x-tenant-id: {tenantA_id}`
- THEN the response status is 403
- AND the response body does not contain the engagement's id or title
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-12: VIEWPRO_ADMIN GET /property-engagements/:id returns 403 and no resource detail`

**S-13** VIEWPRO_ADMIN can still access admin routes (positive inversion proof)
- GIVEN a user with GlobalRole=VIEWPRO_ADMIN is authenticated
- WHEN they request `GET /admin/access-check`
- THEN the response status is 200
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-13: VIEWPRO_ADMIN GET /admin/access-check returns 200 (inversion proof for S-12)`

### B-7 — StatusChangeRequest seller scope

**S-14** Seller cannot create a status change request for an unassigned engagement
- GIVEN a seller is authenticated in tenant A and is NOT assigned to engagement E
- WHEN they POST to `/property-engagements/{E.id}/status-change-requests` with `x-tenant-id: {tenantA_id}`
- THEN the response status is 403
- AND the response body does not contain E's id, title, or address
- Test file: `security-isolation.e2e-spec.ts`
- Test name: `S-14: unassigned seller POST status-change-request returns 403 and no resource detail`
- Note: existing S-11 in `status-change-requests.e2e-spec.ts` covers this pattern; the new test in `security-isolation.e2e-spec.ts` duplicates it by intent as the central isolation catalogue.

---

## No-leak verification rule

Every negative-path test MUST assert ALL of:
1. The expected HTTP status code (403, 404, or 401 per boundary).
2. The absence of any of the following in `JSON.stringify(response.body)`:
   - The targeted resource id (engagementId, propertyAssetId, documentVersionId)
   - Any owner email (pattern: `/@.*\.local/` or the exact seeded email)
   - Any tenant name or tenant slug
3. Sanity inversion: each test file MUST include a comment naming the specific guard or repository method that, if removed, would cause the test to fail (e.g., `// inversion: remove TenantMembershipGuard → 200`).

---

## Minimal UI wiring required

| ID | Route | Current behaviour | Minimum acceptable surface |
|----|-------|------------------|---------------------------|
| MUI-1 | `/dashboard/product/{unassigned_engagement_id}` for a seller | Unknown — no seeded negative test today; likely renders blank or loading spinner | Reuse generic 404 page or show "No tenés acceso a esta propiedad." text. Decision needed in design phase. |
| MUI-2 | `/owner/properties/{unowned_property_id}` for an owner | Unknown — no seeded negative test today; likely renders blank or redirect to `/owner` | Reuse generic 404 page or redirect to `/owner`. Decision needed in design phase. |

---

## Acceptance map

| Scenario | FR(s) | Boundary | Audit row | Test file | Expected response | Inversion target |
|----------|-------|----------|-----------|-----------|-------------------|------------------|
| S-1 | FR-1 | B-1 | Coverage matrix / Security | `security-isolation.e2e-spec.ts` | 403 | Remove `TenantMembershipGuard` |
| S-2 | FR-2 | B-1 | Coverage matrix / Security | `security-isolation.e2e-spec.ts` | 403 | Remove `TenantMembershipGuard` |
| S-3 | FR-3, FR-5 | B-2 | FB-1 / Coverage matrix | `security-isolation.e2e-spec.ts` | 404 | Remove agent scope in `findByIdForTenant` |
| S-4 | FR-4, FR-5 | B-2 | FB-1 / Coverage matrix | `security-isolation.e2e-spec.ts` | 404 | Remove agent scope in `findByIdForTenant` |
| S-5 | FR-3 (UI) | B-2 | FB-1 | `demo-smoke.spec.ts` (isolation block) | 404 page / access denied | Remove seller scope filter in BFF |
| S-6 | FR-6, FR-7 | B-3 | JD-2 / Coverage matrix | `security-isolation.e2e-spec.ts` | 404 | Remove `ownerUserId` filter in `findPropertyByOwner` |
| S-7 | FR-6 (UI) | B-3 | JD-2 | `demo-smoke.spec.ts` (isolation block) | 404 page / redirect | Remove owner scope check in BFF/page |
| S-8 | FR-9 | B-4 | JD-2 / Coverage matrix | `security-isolation.e2e-spec.ts` | 200 empty list | Add owner notifications to a manager's surface |
| S-9 | FR-8 | B-4 | JD-2 / Coverage matrix | `security-isolation.e2e-spec.ts` | 403 | Remove `TenantMembershipGuard` from `NotificationsController` |
| S-10 | FR-10 | B-5 | Coverage matrix | `security-isolation.e2e-spec.ts` | 401 | Remove `AuthGuard` |
| S-11 | FR-11, FR-12 | B-5 | Coverage matrix | `security-isolation.e2e-spec.ts` | 404 | Remove `ownerUserId` filter in `findOwnerReadableVersion` |
| S-12 | FR-13 | B-6 | Coverage matrix | `security-isolation.e2e-spec.ts` | 403 | Remove `TenantMembershipGuard` |
| S-13 | FR-14 | B-6 | Coverage matrix | `security-isolation.e2e-spec.ts` | 200 | Remove `GlobalAdminGuard` |
| S-14 | FR-15, FR-16 | B-7 | Coverage matrix / StatusChangeRequest | `security-isolation.e2e-spec.ts` | 403 | Remove assignment check in `CreateStatusChangeRequestUseCase` |

---

## Non-functional notes

- API isolation tests (`security-isolation.e2e-spec.ts`) MUST add fewer than 30 seconds to the total API suite wall-clock time.
- New seeded Playwright isolation tests (S-5, S-7) MUST each complete in under 10 seconds.
- Any new seed fixture with a TTL MUST use the 10-year window pattern established by PR #159 (see Engram `infra/seed-clock-expiry-mismatch`).

---

## Open questions

None at spec time. All design decisions are surfaced under "Spec deltas required" and "Minimal UI wiring required."

---

## Trace: FR → proposal scope

| FR | Proposal scope item |
|----|---------------------|
| FR-1, FR-2 | "Add a focused security regression test file … Each test names the boundary it proves" + cross-tenant denial boundary |
| FR-3, FR-4, FR-5 | Seller unassigned denial + "no information leak through error messages" |
| FR-6, FR-7 | Owner unauthorised access boundary |
| FR-8, FR-9 | Notification surface isolation boundary |
| FR-10, FR-11, FR-12 | Private document URL privacy boundary |
| FR-13, FR-14 | Admin scope boundary |
| FR-15, FR-16 | StatusChangeRequest scope boundary + proposal constraint "Do not touch: the API 403 guard" |
