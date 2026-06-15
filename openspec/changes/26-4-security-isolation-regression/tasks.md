# Tasks — Stage 26.4 Security and Isolation Regression

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~615–655 net |
| 400-line budget risk | High |
| Chained PRs recommended | No (single PR with `size:exception`) |
| Suggested split if forced | PR 1 (seed + helpers + spec patches + API negatives T-1..T-21, ~470–510L) → PR 2 (UI block + READMEs T-22..T-25, ~140L) · chain: `stacked-to-main` |
| Delivery strategy | `ask-on-risk` → surface `size:exception` before apply |
| Chain strategy | `size:exception` (single-PR; fallback `stacked-to-main` if forced) |

Decision needed before apply: No — apply measures actual diff after Commit A+B; if diff exceeds 600 lines it surfaces a split decision to the orchestrator before Commit C.
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units (forced-split fallback)

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| A | Seed isolation tenant + reset helper + spec patches | PR 1 (to main) | Independent; consumers in PR 2 depend on this |
| B | API negative catalogue (T-6..T-21) | PR 1 (same) | Same PR under size:exception |
| C | Seeded UI isolation block + READMEs | PR 2 (to main) | Depends on PR 1 merged; ~140L |

---

## Phase 1 — Foundation: Spec Patch + MUI Verification (pre-work, no code)

- [ ] **T-1** Patch `openspec/changes/26-4-security-isolation-regression/spec.md`: 4 line edits per design §Spec deltas required — replace B-1 open question with "Design accepted 403 as canonical for cross-tenant. Reason: guard fires pre-DB-lookup → no existence leak. See design.md §I1."; replace B-7 open question with "Design accepted 403 as canonical for SCR unassigned. Aligns with proposal's API 403 guard preservation. See design.md §I2."; replace MUI-1 "Decision needed in design phase" with "Resolved: reuse `notFound()` → existing `src/app/not-found.tsx`. See design.md §MUI-1."; replace MUI-2 "Decision needed in design phase" with "Resolved: reuse existing `OwnerDetailState` empty/error block in `owner-property-detail.tsx`. See design.md §MUI-2.". DoD: 4 string replacements, no behavior change, file saves clean.

- [ ] **T-2** Read-only MUI verification — confirm design's "already wired" claims: read `viewpro-app/apps/app-new/src/app/not-found.tsx` and `product-view-page.tsx:65` to verify `notFound()` is called on null query; read `owner-property-detail.tsx:54-61` to verify `OwnerDetailState` renders on `propertyQuery.isError`. If either claim is incorrect, document the delta and STOP (surface to orchestrator before apply). DoD: written confirmation in apply-progress or a delta note if a claim fails.

---

## Phase 2 — Seed Extension (Commit A)

- [ ] **T-3** Add isolation-tenant fixture to `viewpro-app/apps/api/scripts/seed-demo.mjs`. Per design §Seed extension (R1): add constant `DEMO_ISOLATION_TENANT_SLUG = 'viewpro-isolation-tenant'`; seed `Tenant` (slug, name "ViewPro Isolation Tenant"), `User` manager (`manager.isolation@viewpro.local`, role `PRINCIPAL_MANAGER`), `User` owner (`propietario.isolation@viewpro.local`), `PropertyAsset` (title `Propiedad isolation`, currency USD, price 1), `PropertyEngagement` (status `CAPTURE`), `PropertyAssetOwnerAccess` (ownerUserId = isolation owner, status ACTIVE). No agents, movements, notifications, or documents. Print entity counts in the summary log. DoD: `pnpm demo:seed` exits 0 with the new counts in stdout.

- [ ] **T-4** Add `resetTenantBySlug(slug)` shared helper in `seed-demo.mjs` and refactor `resetDemoTenant` to call it for both `viewpro-demo-inmobiliaria` and `viewpro-isolation-tenant`. FK-safe deletion order: notifications → analyticsEvent → document → documentRequest → statusChangeRequest → movement → propertyAgent → propertyEngagement → propertyAssetOwner → propertyAssetImage → propertyAsset → tenantMembership → tenant (same order as 20.13/20.10 pattern). DoD: `pnpm demo:seed` run twice in succession exits 0 both times (idempotency).

- [ ] **T-5** Sanity assertion post-seed: after both tenants are seeded, log (or assert via a Prisma count) that the demo tenant has exactly 20 `PropertyEngagement` rows and the isolation tenant has exactly 1. This guard must appear in the seed script's summary log. DoD: output visible in `pnpm demo:seed` stdout; running the seeded smoke test T01 "20 gestiones" still passes.

---

## Phase 3 — API Negative Test Catalogue (Commit B)

> All tests live in `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts`. Strict TDD: write each `it` block RED first (guard removed or wrong expectation), then GREEN.

- [ ] **T-6** Create `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts` with shared setup: `beforeAll` that calls `resetDemoTenant` + seeds via `pnpm demo:seed` (or reuses a running seed), signs in `tenantA manager`, `tenantB (isolation) manager`, `demo seller` (unassigned to target engagement), `demo owner`, and `VIEWPRO_ADMIN` user. Implement `expectNoLeak(res, ...fragments)` helper that asserts `expect(JSON.stringify(res.body)).not.toContain(fragment)` for each fragment. `afterAll` cleans up only mutation-test throwaway rows (T-12/T-13 setup). DoD: file compiles; `describe` block registered; no tests run yet (stubs only).

- [ ] **T-7** Implement **T-1 / S-1** in `security-isolation.e2e-spec.ts`: `it('S-1: cross-tenant property engagement read returns 403 and no resource detail')` — tenantA manager calls `GET /property-engagements/{isolationEngagementId}` with `x-tenant-id: {isolationTenantId}`; assert 403 + `expectNoLeak(res, isolationEngagementId, 'Propiedad isolation')`. Sanity-inversion comment: `// inversion: remove TenantMembershipGuard from PropertyEngagementsController → 200`. DoD: test RED with guard removed, GREEN with guard in place.

- [ ] **T-8** Implement **T-2 / S-2**: `it('S-2: cross-tenant movement list returns 403 and no resource detail')` — tenantA manager calls `GET /property-engagements/{isolationEngagementId}/movements` with isolation `x-tenant-id`; assert 403 + `expectNoLeak(res, isolationEngagementId)`. Inversion comment: remove `TenantMembershipGuard` from `MovementsController`. DoD: GREEN.

- [ ] **T-9** Implement **T-3 / S-3**: `it('S-3: unassigned seller GET /property-engagements/:id returns 404 and no resource detail')` — demo seller calls `GET /property-engagements/{unassignedEngagementId}` within demo tenant; assert 404 + `expectNoLeak(res, unassignedEngagementId, engagementTitle, ownerEmail)`. Inversion: remove agents filter in `prisma-property-engagements.repository.findByIdForTenant` when `canViewAll=false`. DoD: GREEN. This is one of the two mandatory RED-GREEN inversion proofs.

- [ ] **T-10** Implement **T-4 / S-4**: `it('S-4: unassigned seller GET movements returns 404 and no resource detail')` — demo seller calls `GET /property-engagements/{unassignedEngagementId}/movements`; assert 404 + `expectNoLeak(res, unassignedEngagementId)`. Inversion: same agents filter. DoD: GREEN.

- [ ] **T-11** Implement **T-5 / S-6**: `it('S-6: owner GET /owner/properties/:id for unowned property returns 404 and no resource detail')` — demo owner calls `GET /owner/properties/{isolationAssetId}`; assert 404 + `expectNoLeak(res, isolationAssetId, 'Propiedad isolation', 'propietario.isolation@viewpro.local')`. Inversion: remove `ownerUserId` filter in `ownerPortalRepository.findPropertyByOwner`. DoD: GREEN.

- [ ] **T-12** Implement **T-6 / S-8** — notification surface manager test: `it('S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak)')`. Setup step: in `beforeAll`, fetch owner notifications as the demo owner via `GET /api/owner/notifications`, store all `.title` fields into `SEEDED_OWNER_NOTIFICATION_TITLES` (runtime derivation — eliminates hardcoded drift). Then assert: manager agent calls `GET /api/owner/notifications` → 200, `res.body` is an array of length 0, `expectNoLeak(res, ...SEEDED_OWNER_NOTIFICATION_TITLES)`. Inversion: insert a seed row with `recipientUserId=manager.id` and `NotificationSurface.OWNER`. DoD: GREEN; runtime title derivation confirmed by a JSDoc comment on the constant.

- [ ] **T-13** Implement **T-7 / S-9**: `it('S-9: owner GET /notifications returns 403 and no internal notification content')` — owner user (no tenant membership) calls `GET /notifications` with any `x-tenant-id`; assert 403 + `expectNoLeak(res, <seeded internal notification title>)`. Inversion: remove `TenantMembershipGuard` from `NotificationsController`. DoD: GREEN.

- [ ] **T-14** Implement **T-8 / S-10**: `it('S-10: unauthenticated POST /document-versions/:id/read-url returns 401')` — unauthenticated agent calls `POST /document-versions/{anyId}/read-url`; assert 401. Inversion: remove `AuthGuard`. DoD: GREEN.

- [ ] **T-15** Implement **T-9 / S-11**: `it('S-11: owner POST /owner/document-versions/:id/read-url for unowned version returns 404 and no storage detail')` — demo owner calls `POST /owner/document-versions/{isolationDocVersionId}/read-url`; assert 404 + `expectNoLeak(res, storageKey, fileName, 'propietario.isolation@viewpro.local')`. Note: isolation tenant has no documents in seed; use a non-existent UUID to trigger the not-found path. Inversion: remove `ownerUserId` filter in `findOwnerReadableVersion`. DoD: GREEN.

- [ ] **T-16** Implement **T-10 / S-12**: `it('S-12: VIEWPRO_ADMIN GET /property-engagements/:id returns 403 and no resource detail')` — admin user calls `GET /property-engagements/{demoEngagementId}` with demo `x-tenant-id`; assert 403 + `expectNoLeak(res, demoEngagementId, demoEngagementTitle)`. Inversion: remove `TenantMembershipGuard` from `PropertyEngagementsController`. DoD: GREEN.

- [ ] **T-17** Implement **T-11 / S-13**: `it('S-13: VIEWPRO_ADMIN GET /admin/access-check returns 200 (inversion proof for S-12)')` — admin user calls `GET /admin/access-check`; assert 200. Inversion (positive): removing `GlobalAdminGuard` would make this 403. DoD: GREEN.

- [ ] **T-18** Implement **T-12 / S-14** SCR unassigned (catalogue copy + no-leak): per-test setup — `beforeAll` creates a throwaway PENDING `StatusChangeRequest` in the isolation tenant (to have a mutation target); tests run; `afterAll` deletes via direct Prisma call (NOT the SCR API to avoid auth complexity). `it('S-14: unassigned seller POST status-change-request returns 403 and no resource detail')` — demo seller (not assigned to isolation engagement) calls `POST /property-engagements/{isolationEngagementId}/status-change-requests` with isolation `x-tenant-id`; assert 403 + `expectNoLeak(res, isolationEngagementId, 'Propiedad isolation')`. Inversion: remove assignment check in `CreateStatusChangeRequestUseCase`. DoD: GREEN; cleanup hook documented in a JSDoc `// cleanup: afterAll deletes throwaway SCR via Prisma direct call`.

- [ ] **T-19** Implement **T-13** cross-tenant SCR bandeja: per-test setup same pattern as T-18. `it('cross-tenant: manager GET /api/tenants/me/status-change-requests with foreign x-tenant-id returns 403')` — tenantA manager calls the bandeja route with isolation `x-tenant-id`; assert 403 + `expectNoLeak(res, isolationEngagementId)`. Inversion: remove `TenantMembershipGuard` from the bandeja route. DoD: GREEN.

- [ ] **T-20** Runtime notification title derivation (T-6 implementation detail — depends on T-12 GREEN): add a JSDoc above `SEEDED_OWNER_NOTIFICATION_TITLES` in `security-isolation.e2e-spec.ts` explaining: "Titles are fetched at runtime in `beforeAll` via `GET /api/owner/notifications` as the demo owner. Do NOT hardcode these — they drift if the seed changes." DoD: comment present; no hardcoded title strings in the test.

- [ ] **T-21** Reference-only acceptance map note (no new tests): in a `// Acceptance map` comment block at the top of `security-isolation.e2e-spec.ts`, note that S-9 and S-11 in `status-change-requests.e2e-spec.ts` cover the same boundary at module level; the SCR tests here add the no-leak body assertion not present in the module spec. DoD: comment added.

---

## Phase 4 — Seeded UI Isolation Block (Commit C)

- [ ] **T-22** Extend `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` with `test.describe('isolation', () => { ... })` block containing U-1 and U-2:
  - **U-1 / S-5**: `test('isolation: seller direct deep-link to unassigned property is denied')` — sign in as demo seller WITH active tenant context (see T-23); navigate to `/dashboard/product/{demoUnassignedEngagementId}` (use an engagement the seller is not assigned to, e.g. Funes/Catalina property); assert `page.getByText('404')` is visible AND `page.getByText(unassignedEngagementTitle)` has count 0.
  - **U-2 / S-7**: `test('isolation: owner direct deep-link to unowned property is denied')` — sign in as demo owner; navigate to `/owner/properties/{isolationAssetId}`; assert `page.getByText('No pudimos cargar esta propiedad')` is visible AND `page.getByText('Propiedad isolation')` has count 0.
  - DoD: both tests GREEN; total seeded suite is 24 tests (22 existing + 2 new); wall-clock each < 10 s.

- [ ] **T-23** Update `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` — add or extend the seller sign-in helper to include tenant context selection before navigation. Per design risk R2: if the seller is signed in without an active tenant context, `MissingTenantState` short-circuits BEFORE `notFound()` fires, asserting the wrong surface. Add a JSDoc: `/** IMPORTANT: must select the active tenant (demo tenant) before navigating to any product deep link, otherwise MissingTenantState renders instead of the 404 surface. */`. DoD: U-1 asserts `404` heading (not workspace-selector prompt).

---

## Phase 5 — Documentation

- [ ] **T-24** Update `viewpro-app/apps/app-new/tests/seeded/README.md`: add 2 rows to the audit-row trace table for U-1 (S-5, B-2, FB-1) and U-2 (S-7, B-3, JD-2). DoD: table updated; file saves clean.

- [ ] **T-25** Create or extend `viewpro-app/apps/api/test/README.md`: add audit-row trace table with 13 rows mapping T-1..T-13 to their scenario IDs (S-1..S-14), boundary (B-1..B-7), audit row, expected HTTP status, and inversion target. DoD: file exists; 13 rows present.

---

## Phase 6 — Verification

- [ ] **T-N1** Run `pnpm --filter next-shadcn-dashboard-starter test:seeded` (cwd `viewpro-app`). Must show 24 tests GREEN (22 existing + 2 new U-1, U-2). No existing test may turn RED. DoD: `PASSED 24` in stdout.

- [ ] **T-N2** Run `pnpm --filter @viewpro/api test` (cwd `viewpro-app`). Must show at least +13 new tests passing from `security-isolation.e2e-spec.ts` (total ~632) with NO existing test regression. DoD: `PASSED` suite-level, diff confirms +13 new tests.

- [ ] **T-N3** Run `pnpm --filter next-shadcn-dashboard-starter test` (cwd `viewpro-app`). Must show 403 existing app-new unit tests passing (no regression from helper changes). DoD: `PASSED 403` in stdout.

- [ ] **T-N4** Sanity-inversion proof for one chosen test: temporarily comment out the `TenantMembershipGuard` decorator in `PropertyEngagementsController` (or the agents filter in `findByIdForTenant`), run the corresponding test (T-7 for S-1 or T-9 for S-3), confirm it FAILS RED, restore the guard, confirm it passes GREEN. Document which test was chosen and its stdout in the apply-progress note. DoD: RED/GREEN evidence recorded.

---

## Acceptance Checklist

| Scenario | Task(s) that prove it |
|----------|-----------------------|
| S-1 cross-tenant engagement read | T-7 |
| S-2 cross-tenant movement list | T-8 |
| S-3 unassigned seller engagement read | T-9 |
| S-4 unassigned seller movement list | T-10 |
| S-5 seller UI deep-link denied | T-22, T-23 |
| S-6 owner unowned property read | T-11 |
| S-7 owner UI deep-link denied | T-22 |
| S-8 manager owner-notifications empty | T-12, T-20 |
| S-9 owner dashboard-notifications 403 | T-13 |
| S-10 unauthenticated document URL 401 | T-14 |
| S-11 owner unowned document URL 404 | T-15 |
| S-12 admin tenant-private 403 | T-16 |
| S-13 admin access-check 200 | T-17 |
| S-14 unassigned SCR 403 | T-18 |
| No spec drift | T-1 |
| No API 403 guard weakened | T-N4 (inversion proof) |
| Existing tests still pass | T-N1, T-N2, T-N3 |

---

## Task Dependency Order

```
T-1, T-2 (parallel, pre-work)
  → T-3 → T-4 → T-5 (sequential seed work, Commit A)
    → T-6 → T-7..T-19 (sequential setup then parallel tests, Commit B)
      → T-20, T-21 (docs comments, depend on T-6/T-12 GREEN)
        → T-22 (depends on T-3+T-4 GREEN)
          → T-23 (depends on T-22 shape)
            → T-24, T-25 (parallel docs, Commit C)
              → T-N1, T-N2, T-N3, T-N4 (parallel verification)
```

**Critical path**: T-3 → T-4 → T-6 → T-9 (mandatory RED-GREEN) → T-22 → T-N1.
