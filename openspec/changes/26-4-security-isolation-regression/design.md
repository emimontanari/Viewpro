# Design — Stage 26.4 Security and Isolation Regression

> Scope: HOW we prove every isolation boundary. No new features, no permission changes. Negative tests + the smallest possible UI denial surfaces required to assert them.

## Quick path

1. Add an additive second-tenant fixture in `seed-demo.mjs` (the isolation tenant).
2. Add a central API negative-test catalogue at `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts` with one or two tests per boundary.
3. Extend `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` with an isolation block (S-5 and S-7) using the existing surfaces (`notFound()` for product, `OwnerDetailState` for owner).
4. Patch the spec for I1 (cross-tenant canonical 403, not 404).
5. Add audit-row trace blocks to both test READMEs.

---

## Architecture decisions

| Topic | Choice | Rejected | Why |
|-------|--------|----------|-----|
| API catalogue placement | Single new file `security-isolation.e2e-spec.ts` | Inline into each module spec | One source of truth for the audit row map; reviewers can read 14 scenarios in one file |
| UI placement | Extend `demo-smoke.spec.ts` with `test.describe('isolation', ...)` block | Sibling `demo-isolation.spec.ts` file | 26.3 precedent — keeps serial workers=1 baseline; only two UI tests planned (S-5, S-7) |
| Cross-tenant fixture | Additive second tenant in `seed-demo.mjs` (slug `viewpro-isolation-tenant`) — `resetDemoTenant` extended by slug list | Runtime tenant creation per test via API | Deterministic, debuggable; ~80 LOC additive vs ~150 LOC of test-level setup |
| Cross-tenant canonical code | Accept **403** at the guard layer (no shim) | Add 404 rewrite middleware | Guard fires pre-DB-lookup → no existence leak; aligns with proposal "do not touch the API 403 guard" |
| SCR unassigned code | Accept **403** (existing) | Force 404 | Proposal explicitly preserves the API 403 guard |
| MUI-1 surface | Reuse existing `notFound()` flow already wired in `product-view-page.tsx` (line 65) → renders `src/app/not-found.tsx` | New denial page | Zero new product surface; the seller deep link already 404s on missing data; the seeded test just asserts the 404 surface is reached |
| MUI-2 surface | Reuse existing `OwnerDetailState` empty/error block in `owner-property-detail.tsx` (lines 54–61) which renders "No pudimos cargar esta propiedad" | Force `notFound()` like the dashboard route | The block already exists for the 404 from `/api/owner/properties/[id]`; the seeded test asserts that text |
| Duplicate vs new SCR tests | Reference existing S-9 and S-11 in `status-change-requests.e2e-spec.ts` from the catalogue's acceptance map; add only the GET bandeja cross-tenant and a no-leak body assertion that the existing tests do not cover | Move (rewrites PR-1 tests) / Duplicate (waste) | Preserves coverage, focuses new tests on uncovered ground |

---

## Test catalogue

API tests live in `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts`. UI tests live in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (isolation block).

| ID | Boundary | Scenario | File | Function name (it) | Expected | Body assertion | Sanity inversion target |
|----|---------|----------|------|--------------------|----------|----------------|------------------------|
| T-1 | B-1 | S-1 cross-tenant engagement read | api/test | `S-1: cross-tenant property engagement read returns 403 and no resource detail` | 403 | body string excludes tenantB engagementId, title, address | remove `TenantMembershipGuard` from `PropertyEngagementsController` |
| T-2 | B-1 | S-2 cross-tenant movement list | api/test | `S-2: cross-tenant movement list returns 403 and no resource detail` | 403 | body string excludes tenantB engagementId | remove `TenantMembershipGuard` from `MovementsController` |
| T-3 | B-2 | S-3 unassigned seller engagement read | api/test | `S-3: unassigned seller GET /property-engagements/:id returns 404 and no resource detail` | 404 | body excludes engagementId, title, owner email | remove agents filter in `prisma-property-engagements.repository.findByIdForTenant` when `canViewAll=false` |
| T-4 | B-2 | S-4 unassigned seller movement list | api/test | `S-4: unassigned seller GET movements returns 404 and no resource detail` | 404 | body excludes engagementId | remove agents filter in `findByIdForTenant` |
| T-5 | B-3 | S-6 owner unowned property read | api/test | `S-6: owner GET /owner/properties/:id for unowned property returns 404 and no resource detail` | 404 | body excludes property id, title, other owner email | remove `ownerUserId` filter in `ownerPortalRepository.findPropertyByOwner` |
| T-6 | B-4 | S-8 manager calling /owner/notifications | api/test | `S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak)` | 200 | `body.length === 0` AND body does NOT contain any seeded owner notification title (e.g. `Documento solicitado`) | grant owner-surface notifications to the manager (add a row in seed with recipientUserId=manager.id) |
| T-7 | B-4 | S-9 owner calling /notifications | api/test | `S-9: owner GET /notifications returns 403 and no internal notification content` | 403 | body excludes any seeded internal notification title | remove `TenantMembershipGuard` from `NotificationsController` |
| T-8 | B-5 | S-10 unauthenticated document URL | api/test | `S-10: unauthenticated POST /document-versions/:id/read-url returns 401` | 401 | n/a | remove `AuthGuard` |
| T-9 | B-5 | S-11 owner unowned document URL | api/test | `S-11: owner POST /owner/document-versions/:id/read-url for unowned version returns 404 and no storage detail` | 404 | body excludes storageKey, file name, other owner email | remove `ownerUserId` filter in `findOwnerReadableVersion` |
| T-10 | B-6 | S-12 VIEWPRO_ADMIN tenant content | api/test | `S-12: VIEWPRO_ADMIN GET /property-engagements/:id returns 403 and no resource detail` | 403 | body excludes engagement id, title | remove `TenantMembershipGuard` from `PropertyEngagementsController` |
| T-11 | B-6 | S-13 VIEWPRO_ADMIN admin access | api/test | `S-13: VIEWPRO_ADMIN GET /admin/access-check returns 200 (inversion proof for S-12)` | 200 | n/a | remove `GlobalAdminGuard` (positive proof) |
| T-12 | B-7 | S-14 SCR unassigned (catalogue copy) | api/test | `S-14: unassigned seller POST status-change-request returns 403 and no resource detail` | 403 | body excludes engagement id, title, address (the existing test in `status-change-requests.e2e-spec.ts` only asserts the 403; this one adds the no-leak check) | remove assignment check in `CreateStatusChangeRequestUseCase` |
| T-13 | B-1 (extra) | cross-tenant SCR bandeja | api/test | `cross-tenant: manager GET /api/tenants/me/status-change-requests with foreign x-tenant-id returns 403` | 403 | body excludes any other-tenant SCR id | remove `TenantMembershipGuard` from the bandeja route |
| U-1 | B-2 UI | S-5 seller deep link unassigned | app-new/tests/seeded | `isolation: seller direct deep-link to unassigned property is denied` | `not-found.tsx` rendered | page contains `404` heading; does NOT contain the engagement title | n/a — UI smoke |
| U-2 | B-3 UI | S-7 owner deep link unowned | app-new/tests/seeded | `isolation: owner direct deep-link to unowned property is denied` | `OwnerDetailState` rendered | page contains `No pudimos cargar esta propiedad`; does NOT contain the property title | n/a — UI smoke |

> Apply phase MUST RED-GREEN at least one per file (e.g., T-3 and U-1) by reverting the sanity-inversion target locally before committing.

---

## Seed extension (R1)

**Choice**: additive — append a minimal second tenant to `seed-demo.mjs`. Keep the existing `viewpro-demo-inmobiliaria` untouched. The current "20 gestiones" assertion (`demo-smoke.spec.ts:68`) is tenant-scoped via `x-tenant-id`, so a foreign engagement does not raise that count — verified by reading the products list code path.

### Shape

| Entity | Value | Notes |
|--------|-------|-------|
| `Tenant.slug` | `viewpro-isolation-tenant` | New constant `DEMO_ISOLATION_TENANT_SLUG` |
| `Tenant.name` | `ViewPro Isolation Tenant` | Visible only inside negative tests |
| `User` (manager) | `manager.isolation@viewpro.local` | `firstName: "Iso"`, `lastName: "Manager"`, role `PRINCIPAL_MANAGER` |
| `User` (seller-empty) | omit | not needed; cross-tenant tests only need 1 user |
| `User` (owner) | `propietario.isolation@viewpro.local` | only created for B-3 isolation; minimal — no documents |
| `PropertyAsset` + `PropertyEngagement` | 1 row | title `Propiedad isolation`, status `CAPTURE`, currency USD, price 1; the title is used to assert it does NOT leak in the body |
| `PropertyAssetOwnerAccess` | 1 row | `ownerUserId = isolation owner.id`, status ACTIVE, links isolation owner ↔ isolation asset |
| `PropertyAgent` | omit | no agents assigned (validates B-2 from the OTHER side too) |
| `Movement` / `Notification` / `Document` | omit | not needed; we only need a foreign existing engagement |

### Reset ordering (in `resetDemoTenant`)

`resetDemoTenant` is currently slug-scoped. Add a second pass with the isolation slug. Reuse the same FK-safe order: notifications → analyticsEvent → document → documentRequest → statusChangeRequest → movement → propertyAgent → propertyEngagement → propertyAssetOwner → propertyAssetImage → propertyAsset → tenantMembership → tenant. Touched lines: ~20 to factor the reset into `resetTenantBySlug(slug)` + 2 callers + ~60 lines to seed the isolation tenant.

### Constants to add to `demo-smoke.spec.ts`

| Constant | Value | Used by |
|----------|-------|---------|
| `ISOLATION_TENANT_SLUG` | `viewpro-isolation-tenant` | U-1, U-2 helpers (compute the unassigned engagement id via API list as the demo manager from the isolation tenant) |
| `ISOLATION_MANAGER_EMAIL` | `manager.isolation@viewpro.local` | API call to fetch the foreign engagement id, then the demo seller deep-links to it |

> Note: U-1 uses the isolation tenant's engagement id but signs in as the demo seller — that's the canonical "unassigned within MY tenant" semantics. Wait — U-1 is specifically B-2 (unassigned within the same tenant). To stay precise: U-1 uses a demo-tenant engagement the seller is NOT assigned to (Funes/Catalina), not a foreign-tenant one. The foreign engagement is used only by the API cross-tenant tests (T-1..T-2, T-13). U-2 uses the isolation tenant's `PropertyAsset.id` so the demo owner is denied.

---

## R1 strategy — chosen

Additive second-tenant fixture in `seed-demo.mjs`. Slug `viewpro-isolation-tenant`. Minimal rows. No movements, no documents, no images. Reset extended via a shared `resetTenantBySlug(slug)` helper.

## R2 strategy — chosen

(a) — implement both denial surfaces using existing patterns:
- MUI-1: the product detail already calls `notFound()` when the query returns `null` or fails validation; the API returns 404 on cross-seller access for unassigned engagements (FR-3), so the existing flow renders `not-found.tsx` automatically. **No new UI code needed.**
- MUI-2: the owner detail already renders `OwnerDetailState` ("No pudimos cargar esta propiedad") on `propertyQuery.isError`; the API returns 404 (FR-6), so this surface already fires. **No new UI code needed.**

This is the cheapest path. Effectively MUI-1 and MUI-2 collapse to: assert the existing surfaces are reached. The "minimal UI wiring required" line item turns into zero net product UI changes.

## R3 strategy — chosen

(a) — dual assertion in T-6:

```ts
// S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak)
const res = await managerAgent.get('/api/owner/notifications').expect(200);
expect(Array.isArray(res.body)).toBe(true);
expect(res.body).toHaveLength(0);
// Negative no-leak proof: no seeded owner notification title or body must appear
const body = JSON.stringify(res.body);
for (const ownerTitle of SEEDED_OWNER_NOTIFICATION_TITLES) {
  expect(body).not.toContain(ownerTitle);
}
// inversion: insert a row in seed with recipientUserId=manager.id and NotificationSurface.OWNER → test must fail
```

## R4 strategy — chosen

(b) — reference + add focused new tests. The acceptance map already names T-12 (matches S-14) and T-13 (new — cross-tenant bandeja). No move, no delete in `status-change-requests.e2e-spec.ts`. The new central catalogue is the canonical map; the module spec retains its in-context coverage.

## I1 strategy — chosen

Canonical cross-tenant response is **403** (no shim). Rationale: `TenantMembershipGuard` runs before any DB lookup, so the 403 cannot leak resource existence. It only signals "this URL pattern exists for some tenant", which is a generic, low-signal disclosure inherent to RESTful routing. A 404 shim would require either (i) middleware that runs after the guard (illogical — the guard already rejected the request) or (ii) reversing guard order so the lookup runs first against an unauthorised user, which DEGRADES security. Decision documented; spec deltas listed below.

## I2 strategy — chosen

Accept 403 for SCR unassigned. Proposal explicitly preserves the API 403 guard. No spec delta needed (the spec already states 403 for FR-15).

## MUI-1 / MUI-2 strategy — chosen

| MUI | Route | Render path | Test assertion |
|-----|-------|-------------|----------------|
| MUI-1 | `/dashboard/product/{unassignedId}` (seller) | Existing `notFound()` in `product-view-page.tsx:65` → `src/app/not-found.tsx` | `page.getByText('404')` + `page.getByText(unassignedTitle)).toHaveCount(0)` |
| MUI-2 | `/owner/properties/{unownedId}` (owner) | Existing `OwnerDetailState` in `owner-property-detail.tsx:54-61` | `page.getByText('No pudimos cargar esta propiedad')` + `page.getByText(unownedTitle)).toHaveCount(0)` |

---

## Spec deltas required

Apply phase MUST patch the spec to align with the I1 decision:

| Spec ID | Current text | Patch |
|--------|--------------|-------|
| Boundary catalogue, B-1 row, "Today's response" | already says 403 — keep | no-op |
| **Spec deltas required, B-1** | Currently flags 403 vs 404 as a design decision | Replace with: "Design accepted 403 as canonical for cross-tenant. Reason: guard fires pre-DB-lookup → no existence leak. See design.md §I1." |
| **Spec deltas required, B-7** | Currently flags 403 vs 404 as a design decision | Replace with: "Design accepted 403 as canonical for SCR unassigned. Aligns with proposal's API 403 guard preservation. See design.md §I2." |
| FR-1 | Already says 403 — no change | no-op |
| FR-2 | Already says 403 — no change | no-op |
| Acceptance scenarios S-1..S-2 | Already 403 — no change | no-op |
| Minimal UI wiring required, MUI-1 | "Decision needed in design phase" | Replace with: "Resolved: reuse `notFound()` → existing `src/app/not-found.tsx`. See design.md §MUI-1." |
| Minimal UI wiring required, MUI-2 | "Decision needed in design phase" | Replace with: "Resolved: reuse existing `OwnerDetailState` empty/error block in `owner-property-detail.tsx`. See design.md §MUI-2." |

> The spec's FR/scenario bodies for B-1 already use 403 (the prior phase corrected them). The deltas above only clean up the "Spec deltas required" and "Minimal UI wiring required" sections — they no longer hold open decisions.

---

## Non-goals

- New product features beyond minimal denial surfaces (already zero).
- Changes to `TenantMembershipGuard`, role definitions, or `TenantRole` enum.
- Changes to the API 403 guard for direct seller `STATUS_CHANGE` mutations.
- Changes to the 26.2 deterministic seed contract beyond additive isolation tenant.
- Refactoring existing guard code.
- Cryptographic review of signed URLs.
- Cross-region or cross-environment isolation (single-DB only).
- Stage 26.5 deploy checklist work.

---

## Rollout & rollback

### Workload heuristic

| Bucket | Estimated changed lines |
|--------|------------------------|
| API negative tests (T-1..T-13) | ~280 (13 tests × ~18 LOC + ~50 shared setup) |
| Seed isolation tenant + reset refactor | ~100 |
| UI isolation block (U-1, U-2) | ~80 |
| Spec deltas | ~20 |
| READMEs (api/test + app-new/tests/seeded) | ~30 |
| **Total estimate** | **~510 lines** |

**Decision**: single PR with `size:exception` — coverage is one logical theme (negative-test catalogue) and chaining would split the seed change from its consumers, increasing review burden, not reducing it. If the orchestrator's `delivery_strategy` is `ask-on-risk`, surface the exception request. If `auto-chain`, split into two slices: (Slice A) seed isolation tenant + READMEs (~150 LOC) → (Slice B) API + UI catalogues (~360 LOC). The default recommendation is single PR.

### Rollback

- Revert the new e2e file, the demo-smoke isolation block, and the seed isolation tenant.
- `pnpm demo:seed` returns to the pre-26.4 fixture; no schema or guard code changed.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Seed reset ordering misses an FK (notifications/movements/documents on isolation tenant) | Reuse the existing FK-safe order; add a smoke step in `seed-demo.mjs` that asserts `tenant.count({where: {slug: ISOLATION_SLUG}}) === 1` after seed |
| "20 gestiones" assertion in T01 fragility | Verified — the count is per-tenant via `x-tenant-id`; isolation tenant engagement does not affect it. Apply phase MUST run the full seeded smoke after the seed change as a regression gate. |
| `MissingTenantState` short-circuits the seller deep link before `notFound()` fires (would render the workspaces prompt, not 404) | U-1 must sign in as a seller WITH an active tenant context (demo tenant) before navigating to the unassigned engagement deep link. Helper required. |
| Owner property API returns 404 but the page still flashes the skeleton before `OwnerDetailState` renders | Assertion uses Playwright's `toBeVisible` with default timeout — covers the transition |
| T-6 false-pass if `SEEDED_OWNER_NOTIFICATION_TITLES` list goes stale | Derive it from a runtime query in `beforeAll` (e.g. fetch notifications as the owner, store titles) — eliminates hardcoded drift |
| API `security-isolation.e2e-spec.ts` adds >30 s | Reuse seed once via `beforeAll`; do NOT call `resetDemoTenant` per test — the existing `status-change-requests.e2e-spec.ts` pattern uses per-test deletes; this catalogue should NOT delete the seeded data — it consumes it. Apply phase chooses between "consume seed" (faster, requires the seeded fixture to be present) vs "setup per test" (slower, independent). Recommended: consume seed for read-only negatives; per-test setup only for write-mutation tests (T-12, T-13). |

---

## Open questions

None blocking. All design forks resolved above. The apply phase may surface micro-questions (exact error code constants, exact body shape strings) — those are mechanical and resolved during RED.
