# Design — Stage 26.3 Full Seeded E2E

Architecture decisions for the 7 new Playwright seeded tests (S-1..S-11) that prove G-1..G-7 audit gaps. The work is test-first: each test is written RED against current behavior, then we make the smallest UI/seed change required to turn it GREEN. No new product features.

## Quick path

1. Keep all new tests in the existing `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (R5 decision).
2. Extract a tiny set of helper functions to a new `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` only when ≥3 new tests reuse them (sign-in stays inline, navigation helpers go to `_helpers.ts`).
3. Append ONE new seed fixture: a SUBMITTED document request on property index 1 (R2 decision). All existing counts stay intact.
4. R1: G-7 limit test temporarily lowers the demo tenant's `maxActivePropertyEngagements` via the existing admin BFF (`PATCH /api/admin/tenants/:id/limits`), then restores it in `test.afterEach`.
5. R3: WhatsApp test asserts `href` shape + tracking-endpoint POST via Playwright route interception. Click handler IS already wired (`onClick={handleContactClick}` in owner-home.tsx).
6. Add a Markdown audit-trace table at the top of `demo-smoke.spec.ts` (header block) AND extend the existing `tests/seeded/README.md`.
7. Ship as a single PR. Estimated diff ≈ 350–420 lines; below the 400-line conservative budget when test-helper extraction lands as a separate first commit.

## Architecture decisions

### A-1 — Test file placement (R5)

Keep all 7 new tests in `demo-smoke.spec.ts`. Current file is 614 lines with 13 tests. With 7 additions the file reaches ≈1000 lines, still below the split threshold the proposal flagged. Single file = single source of truth, simpler README pointer, no `globalSetup` changes, no risk of forgetting to register a new file in `playwright.seeded.config.ts` (which uses `testDir`, so it would auto-pick up new files, but adding a sibling file forces reviewers to track two execution orders for the serial suite).

Add a comment header block at the top of `demo-smoke.spec.ts` grouping tests by audit row, e.g.:

```ts
/**
 * Seeded smoke suite — audit-row trace
 *
 * | Block                            | Tests                | Audit row                                      |
 * |----------------------------------|----------------------|------------------------------------------------|
 * | Manager workflow                 | T01, T11, T13–T17   | Manager creates / opens / requests / rejects   |
 * | Seller workflow                  | T02–T03, T10        | Seller assigned visibility, movement w/ chip   |
 * | Owner workflow                   | T04–T05, T18        | Owner reads, uploads, WhatsApp link            |
 * | Notifications + admin           | T07–T09             | Internal + owner notifications, admin limits   |
 * | Status change requests           | T12–T13             | Approve + reject paths                          |
 * | Tenant limits                    | T19                 | Limit exceeded UI error                         |
 */
```

The numbering above is illustrative; tasks phase assigns final indices.

### A-2 — Per-test setup/cleanup pattern

Each new test follows the existing inline `signIn(page, email)` pattern. Fresh `page` context per test means cookies/localStorage are clean — no leak. Two tests need explicit cleanup:

- **T19 (S-11 G-7 limit)**: `test.afterEach` restores `maxActivePropertyEngagements = 25` via the admin BFF even if the test fails. We do NOT use `test.afterAll` because the test is the only consumer; failing-fast on restore is acceptable.
- **T13–T17 (S-1..S-4 G-1+G-2 creation chain)**: created engagement IS persistent state. We deliberately leave it in the DB — the next reseed wipes it. Other tests that count `total` properties (`SELLER_SCENARIOS.expectedTotal`) MUST NOT increment because: (a) sellers are unassigned at creation (FR-4), (b) the new property never enters `martin`'s or `lucia`'s assignment list. The existing seller-list assertions are by `expectedTotal` (8 and 6) — verify these tests run BEFORE the creation test in the serial order, OR confirm the API filter excludes unassigned properties for seller roles. The product list API is already scoped to assigned-only for sellers (Test 2/3 baseline proves this).

### A-3 — Helpers to extract

Extract to `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` only the pieces with ≥3 callers:

| Helper                              | Existing callers | New callers | Decision |
|-------------------------------------|------------------|-------------|----------|
| `signIn(page, email, redirectPath)` | 11               | 6           | Keep inline (single source already; moving forces ts-import noise). |
| `getJson<T>(page, url)`             | 4                | 4           | Extract — clearly reusable. |
| `getAssignedProducts(page)`         | 3                | 3           | Extract. |
| `getProductByTitle(page, title)`    | 1                | 4           | Extract. |
| `openOwnerPropertyDetail(page)`     | 2                | 1           | Keep inline. |
| `openManagerPropertyDetail(page, title)` | 0           | 5           | NEW helper, extract. |
| `assertFeedContains(page, regex)`   | 1 inline check   | 3           | NEW helper, extract. |

`signIn` stays inline because moving it adds an import in every test and the function is short. If apply-phase finds the inline cost too high, it can move `signIn` later — that's a follow-up, not a 26.3 requirement.

Rule: do NOT extract on speculation. Helpers go to `_helpers.ts` only when at least three callers consume them. Avoids premature abstraction.

### A-4 — Seed extension surface

The seed has one new fixture (R2 decision). Everything else is additive-only and reuses existing tenant + user IDs.

| Fixture | Table | New rows | FK order |
|---------|-------|----------|----------|
| Second SUBMITTED document request "Constancia de servicios pendiente de revisión" on property index 1 (`Casa luminosa con patio en Los Boulevares`) | `DocumentRequest` + `Document` + `DocumentVersion` | 3 rows | After property + owner + user fixtures, same insertion point as existing `createDemoDocumentReviewStates` |

That's it. No new properties, no new sellers, no new owners, no new limit fixtures.

### A-5 — Authentication boundaries are inherited

All new tests flow through `/auth/sign-in` exactly like the 13 existing tests. No test bypasses guards. R4-style budget pressure does NOT justify direct API session minting.

## Test catalog

| # | Scenario | Audit row | File / function (working name) | Setup | Cleanup | Expected duration |
|---|----------|-----------|--------------------------------|-------|---------|-------------------|
| T13 | S-1 + S-2 (G-1, FR-1..FR-4) | Manager creates property engagement | `demo-smoke.spec.ts` · `manager can create a new property engagement through the UI` | sign-in as `demo@viewpro.local` | none (engagement persists; martin/lucia counts unaffected) | 8–10s |
| T14 | S-3 (G-2, FR-5..FR-6) | Manager assigns seller | `demo-smoke.spec.ts` · `manager can assign martin to a new engagement via Gestionar vendedores` | T13 created the engagement OR test creates one inline via UI | none | 6–8s |
| T15 | S-4 (G-2, FR-7) | Manager assigns seller (unassign path) | `demo-smoke.spec.ts` · `manager can remove a seller assignment via Gestionar vendedores` | T14 finished with martin assigned | none | 5–7s |
| T16 | S-5 (G-3, FR-8..FR-10) | Manager creates movement (no outcome) | `demo-smoke.spec.ts` · `manager can create a plain movement without an outcome label` | sign-in as `demo@viewpro.local`; navigate to any seeded property | none | 6–8s |
| T17 | S-6 (G-4, FR-11..FR-13) | Manager requests document | `demo-smoke.spec.ts` · `manager can create a document request through the UI` | sign-in as `demo@viewpro.local`; nav to property index 0 (`Casa familiar con pileta en Villa Centenario`) | none | 7–9s |
| T18a | S-7 (G-5, FR-14..FR-15) | Manager rejects uploaded document | `demo-smoke.spec.ts` · `manager can reject an uploaded document request with a reason` | New SUBMITTED seed fixture on property index 1; sign-in as `demo@viewpro.local` | none | 7–9s |
| T18b | S-8 (G-5, FR-16) | Owner sees rejection + re-upload | `demo-smoke.spec.ts` · `owner sees rejection reason and re-upload action` | T18a finished | none | 5–7s |
| T19a | S-9 (G-6, FR-17..FR-18) | Owner WhatsApp link href | covered by existing Test 8 today — extend Test 8 OR add `owner WhatsApp contact link is wired to tenant phone` | sign-in as `propietario.demo@viewpro.local` | none | 4–6s (extends existing) |
| T19b | S-10 (G-6, FR-19) | Owner WhatsApp click tracking | `demo-smoke.spec.ts` · `owner WhatsApp click POSTs a tracking event` | sign-in as `propietario.demo@viewpro.local` | none | 5–7s |
| T20 | S-11 (G-7, FR-20..FR-22) | Tenant limit exceeded UI error | `demo-smoke.spec.ts` · `tenant engagement limit blocks creation with a clear UI error` | sign-in as admin → PATCH limit to current active count (≈20) → sign-in as manager | `afterEach` restores limit to 25 | 12–15s (exceeds 10s budget — R4) |

Total budget: ~75–95s for 9 new tests; existing 13 tests are ~50–60s. Combined wall-clock should stay under 150s, below the 120s proposal target after warm-up. R4 mitigations are listed below.

S-2 (FR-4) folds into T13's last assertion rather than getting its own test — it's a 1-line API call that the same browser context can issue. This trims one test file entry and helps the duration budget.

## Per-gap implementation strategy

### G-1 — Manager creates engagement (T13)

- Entry point: `ProductPageHeaderAction` renders `Link href='/dashboard/product/new'` when `canManagePropertyEngagements(activeMembership)` is true → click it.
- Selector: `page.getByRole('link', { name: 'Nueva propiedad' })`.
- Form: `product-form.tsx` uses `useAppForm` + tanstack form. Required fields per `productSchema` (need to confirm in tasks; minimum is title, address, propertyType, operationType, status, price/currency).
- Submit handler: `createProduct` POST → `/api/products` → BFF `/property-engagements`.
- Assertions:
  - `await page.waitForURL('**/dashboard/product')` after success router push.
  - `getJson('/api/products?limit=50').total` is one higher than the pre-create snapshot.
  - The newly created title is visible in the table.
  - Property detail URL `/dashboard/product/{newId}` opens and shows the seeded initial status (e.g., `CAPTURE` or `ACTIVE_PUBLICATION` per form default — confirm in tasks).
  - FR-4: `martin` API call `/api/products?limit=50` does NOT include the new property (sub-assertion at end of T13, separate `page.request.newContext` after sign-in).

### G-2 — Manager assigns/unassigns seller (T14 + T15)

- Selector: on property detail, click `getByRole('button', { name: /Gestionar vendedores/i })`.
- Dialog: `ManagePropertyAgentsDialog` shows "Disponibles para asignar" section; click `Asignar` on the row containing `martin`.
- API: `assignProductAgent(productId, userId)` POSTs to `/api/products/:id/agents`.
- Assertions T14:
  - In the same dialog "Asignados actualmente" now shows martin's email.
  - Outside dialog, fetch `/api/products?limit=50` while signed in as martin → response includes the new property.
- Assertions T15:
  - Reopen dialog, click `Quitar` next to martin → row moves back to "Disponibles".
  - Re-fetch as martin → property no longer in the response.

### G-3 — Plain movement without outcome (T16)

- Selector: `getByRole('button', { name: /Agregar actualización/i })` (already used by Test 10).
- Dialog: leave the outcome combobox unselected. Skip the "+ Agregar etiqueta" path entirely.
- Fill `Observación` only. Click `Guardar actualización`.
- Assertions:
  - Dialog closes.
  - New movement entry visible in the Seguimiento feed.
  - That movement row does NOT contain a chip with any seeded outcome label nor any of the DEMO_OUTCOME_LABELS (`Esperando documentos`, `En negociación avanzada`, `Propietario no responde`).
  - `getJson('/api/products/:id').status` equals the pre-test snapshot (FR-10).

### G-4 — Manager requests document (T17)

- Pre-check (MUI-3 below): `Solicitar documento` button is visible to managers today because `PropertyDocumentRequests` accepts `canRequestDocuments` defaulting to `true` and `product-view-page.tsx` does not pass `false` for managers. Confirmed reachable, no UI wiring required.
- Selector: `getByRole('button', { name: /Solicitar documento/i })`.
- Dialog: `CreateDocumentRequestDialog` — pick owner (the seeded `propietario.demo`), fill `title` "Constancia adicional smoke test", optional description.
- Submit → `createProductDocumentRequest` POSTs `/api/products/:id/document-requests`.
- Assertions:
  - Dialog closes.
  - Document list shows a new entry with `Pendiente` badge.
  - `getJson('/api/owner/notifications?page=1&pageSize=10')` for `propietario.demo` includes a notification with title containing `Document requested` or its localized equivalent.

### G-5 — Manager rejects uploaded document (T18a + T18b)

- Pre-condition: new SUBMITTED seed fixture on property index 1 (`Los Boulevares`). See R2 below for full schema.
- Selector: open property index 1, find the seeded fixture row by title, click `Rechazar`.
- Dialog: `RejectDocumentRequestDialog`, fill rejection reason "Falta firma del titular en página 2".
- API: `rejectProductDocumentRequest(requestId, { reason })`.
- Assertions T18a:
  - Toast `Documento rechazado` appears.
  - Document row badge transitions to `Rechazado`.
  - Rejection reason visible on the row (via expand or detail).
- Assertions T18b:
  - Sign-in as `propietario.demo`, navigate to property Los Boulevares documents tab.
  - Entry shows `Rechazado` badge + rejection reason text.
  - `Subir documento` (re-upload) button is visible on the row.

### G-6 — Owner WhatsApp link + tracking (T19a + T19b)

- T19a extends the existing Test 8 (`demo owner sees seeded notifications, images and contacts`) which already asserts `whatsappPhone: '+5493510000000'`. We additionally assert that the rendered owner-home anchor `href` matches `https://wa.me/5493510000000?text=...`. New helper `getOwnerWhatsappHref(page)` reads the anchor's `href` and parses it. The existing `buildOwnerPropertyWhatsappHref` already strips non-digits; assertion uses `expect(href).toContain('5493510000000')`.
- T19b adds click-tracking proof. The current owner-home already wires `onClick={handleContactClick}` (line 353) which calls `trackOwnerWhatsappContactClick(engagementId)` → POST `/api/owner/engagements/:id/whatsapp-contact-click`. Test uses `page.route('**/whatsapp-contact-click', route => { interceptCount++; route.continue(); })` BEFORE clicking, then expects `interceptCount === 1`. No UI wiring required (MUI-2 is moot).

### G-7 — Tenant limit exceeded UI error (T20)

- Setup: sign-in as `admin.demo@viewpro.local` (already used by Test 9). Read current active engagement count via `/api/products?limit=50` (under `demo@viewpro.local` session, but admin can `PATCH` regardless of session — admin BFF doesn't require manager context). PATCH `/api/admin/tenants/viewpro-demo-tenant-id/limits` setting `maxActivePropertyEngagements` to the current active count (≈20).
  - Note: we look up the tenant ID from `getJson('/api/admin/tenants?page=1&pageSize=10')` (Test 9 already uses this).
- Sign-in as manager → navigate to `/dashboard/product/new`, fill the form, submit.
- BFF returns a 409 with `message: 'Tenant active property engagement limit exceeded'` from the existing `ConflictException`.
- Current `product-form.tsx` onError fallback shows `toast.error('No se pudo crear la propiedad')` — generic. R4 + MUI-1 decision below specifies the minimal UI mapping.
- Assertions:
  - Toast contains the limit message (specific Spanish-language text, see MUI-1 below).
  - URL did NOT navigate to `/dashboard/product` — we stay on `/dashboard/product/new`.
  - `getJson('/api/products?limit=50').total` is unchanged from pre-test snapshot (FR-21).
  - Form remains interactive (e.g., title input is still editable → FR-22).
- Cleanup `afterEach`: PATCH limit back to 25.

## Risk strategies

### R1 — G-7 limit setup approach

**Decision: use the existing admin PATCH BFF to temporarily lower the limit, with `afterEach` cleanup.**

Rejected alternatives:
- (a) Seeding 25 active engagements would break Test 1 (`'20 gestiones inmobiliarias en total'`), Tests 2/3 (`expectedTotal: 8` and `6`), and the spec.md proposal's "Preserve unchanged" guarantee. Hard NO.
- (c) A parallel limit-only tenant requires non-trivial seed changes, new auth users, and a separate admin token — explodes scope.
- (b) — chosen — only requires one HTTP request before the test action and one after. The admin endpoint is already covered by Test 9.

Implementation contract:
- `setup`: read tenant id from `/api/admin/tenants`, snapshot current `maxActivePropertyEngagements` (expect 25), count active engagements via `/api/products?limit=50&archived=false`, PATCH the limit to that count.
- `assert`: see G-7 above.
- `afterEach`: restore via PATCH `maxActivePropertyEngagements: 25`. Always runs even on test failure thanks to Playwright's `afterEach` semantics. Tasks phase MUST register this hook as `test.afterEach` scoped to the single test, not the entire `describe.serial`, to avoid restoring during unrelated tests.

**Risk if cleanup hook is missing**: the tenant limit stays low between runs in dev; the next reseed restores it (`pnpm demo:seed` rewrites the tenant row to 25). Reseeding is part of the canonical workflow, so the failure mode is bounded to a single suite run.

### R2 — G-5 rejection fixture

**Decision: add one new SUBMITTED document request fixture in `createDemoDocumentReviewStates` on property index 1 (`Casa luminosa con patio en Los Boulevares`).**

Why property index 1: the existing two fixtures both attach to property index 0. Using index 1 means the new fixture doesn't collide with Test 11 (which asserts exactly two items on the `Resueltos` tab of property 0). The owner (`propietario.demo`) is already linked to property index 0 via `createDemoOwnerLinks`, but property index 1 also has an owner link in the seeded data — verify in tasks; if not, link the owner to property 1 as part of the additive seed change (still additive, no counts changed elsewhere).

Concrete entry to append:

```js
// NEW additive fixture for Stage 26.3 G-5
{
  title: 'Constancia de servicios pendiente de revisión',
  description: 'Documento demo cargado para test de rechazo manager.',
  status: DocumentRequestStatus.SUBMITTED,
  versionStatus: DocumentVersionStatus.UPLOADED,
  originalFilename: 'servicios-pendientes-demo.pdf',
  body: Buffer.from('%PDF-1.4\n% ViewPro stage 26.3 reject fixture\n', 'utf8'),
  createdAt: daysAgo(2),
  uploadedAt: daysAgo(1),
  // NOTE: target property index 1 instead of [0] — requires factoring the property
  //       resolution out of createDemoDocumentReviewStates. Tasks phase decides
  //       whether to refactor or duplicate the function for index 1.
  targetPropertyIndex: 1
}
```

Impact on existing tests:
- Test 8 (`demo owner sees seeded notifications, images and contacts`) checks that notifications include `Document requested` and `Document rejected`. The new SUBMITTED fixture will emit a `DOCUMENT_REQUESTED` analytics event AND a notification. Test 8's `arrayContaining` matcher tolerates the additional notification, but the `unreadCount` lower-bound is `>=1` so any increment is fine. Confirm in tasks.
- Test 11 explicitly looks at property 0's `Escritura firmada` SUBMITTED entry — unaffected.

### R3 — WhatsApp tracking proof

**Decision: assert (a) the rendered link `href` contains the expected phone, AND (b) the tracking endpoint is called via Playwright route interception.**

The current owner-home component (`owner-home.tsx`) already has `onClick={handleContactClick}` wired to `trackOwnerWhatsappContactClick`. No UI changes required — MUI-2 is resolved as "no change needed". The test proof:

```ts
let trackingHits = 0;
await page.route('**/api/owner/engagements/*/whatsapp-contact-click', (route) => {
  trackingHits++;
  return route.continue();
});
// click the WhatsApp anchor
expect(trackingHits).toBeGreaterThanOrEqual(1);
```

We intercept-and-continue rather than fulfill — this preserves the real backend call so the analytics event is still recorded. This is robust against client-side retry behavior and works in serial mode.

### R4 — Duration budget

| Test | Estimate | Notes |
|------|----------|-------|
| T13  | 8–10s    | form submit + redirect + table assert |
| T14  | 6–8s     | dialog open + assign + API check |
| T15  | 5–7s     | dialog reopen + remove + API check |
| T16  | 6–8s     | dialog + feed assert |
| T17  | 7–9s     | dialog + list assert + owner-notifications API |
| T18a | 7–9s     | dialog + assert reason text |
| T18b | 5–7s     | owner-portal navigation only |
| T19a | 4–6s     | extends Test 8 in-place; +2s budget |
| T19b | 5–7s     | route intercept + click |
| T20  | 12–15s   | admin PATCH + sign-in switch + form submit + assert + restore PATCH |

Total new wall-clock: ~75–95s. Adding to the existing ~50–60s baseline puts the suite at ~135–155s — still inside 2 minutes when the dev box is warm. T20 is the only test that overruns the soft 10s budget (per spec NFR section). Justification: the test legitimately requires 2 admin API calls plus a sign-in switch; below 15s is acceptable and the spec explicitly tolerates flagged exceedances.

If duration becomes an issue in CI, T19a should remain folded into Test 8 (no new test, just an `expect(href).toContain(...)` line added).

### R5 — Test file placement

**Decision: keep everything in `demo-smoke.spec.ts`. Add a header table mapping tests to audit rows.** See A-1 above. Revisit only if the file exceeds 1200 lines after 26.3 lands.

## MUI strategies

### MUI-1 — G-7 limit-exceeded error message

**Decision: add ONE error mapping in `product-form.tsx` onError handler. Component path: `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx` around line 192.**

Current behavior: `toast.error('No se pudo crear la propiedad')` for every error. Change:

```ts
onError: (error) => {
  if (error instanceof Error && error.message === 'IMAGE_LIMIT_EXCEEDED') {
    toast.error('La propiedad puede tener hasta 5 imágenes.');
    return;
  }
  // NEW (Stage 26.3 MUI-1):
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes('tenant active property engagement limit exceeded')
  ) {
    toast.error('Alcanzaste el límite de propiedades activas del plan. Archivá una propiedad o contactá a soporte.');
    return;
  }
  toast.error(isEditMode ? 'No se pudo editar la propiedad' : 'No se pudo crear la propiedad');
}
```

Why it's wiring, not a feature: the error already surfaces from the API. We translate ONE existing error code into a readable message. No new endpoints, no new state, no new components. The `parseJsonResponse` helper already lifts `body.message` from the BFF response (it goes via `getErrorMessage(body, response.statusText)`), so the English backend phrase reaches the UI as `error.message`.

The test assertion uses `expect(page.getByText(/Alcanzaste el límite de propiedades activas/i)).toBeVisible()`.

### MUI-2 — G-6 WhatsApp click tracking

**Decision: no UI change required.** Verified in code: `owner-home.tsx` line 353 already wires `onClick={handleContactClick}` which calls `trackOwnerWhatsappContactClick`. R3 strategy uses route interception to prove the call happens. Drop MUI-2 from the apply scope.

### MUI-3 — G-4 "Solicitar documento" visibility

**Decision: no UI change required.** Verified in code:
- `property-document-requests.tsx` line 100 has `canRequestDocuments = true` default.
- `product-view-page.tsx` does NOT pass `canRequestDocuments={false}` — it omits the prop, so the default applies for managers.
- The button only hides when (a) `isArchived` is true, (b) `eligibleOwners.length === 0`, or (c) `canRequestDocuments` is explicitly `false`.

For seeded property index 0 (Villa Centenario, has `propietario.demo` linked) all three conditions clear → button is visible. The test relies on this without modification.

If the tasks phase finds the button hidden during test execution, that's a regression in `product-view-page.tsx` not present today and should be filed as a bug before the test ships.

## Helpers to extract — final list

Create `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` with exactly:

```ts
export async function getJson<T>(page: Page, url: string): Promise<T>;
export async function getAssignedProducts(page: Page): Promise<ProductsResponse>;
export async function getProductByTitle(page: Page, title: string): Promise<Product>;
export async function openManagerPropertyDetail(page: Page, title: string): Promise<void>;
```

Move the existing functions from `demo-smoke.spec.ts` lines 532–555 into this file. Update existing tests' imports. This is a touch-point on every existing test; tasks phase MUST run the full suite green before/after the move as a separate commit (commit A: extract helpers; commit B: add new tests; commit C: seed extension + MUI-1).

`signIn`, `openOwnerPropertyDetail`, `openAndVerifySignedReadUrl`, and the inline types stay in `demo-smoke.spec.ts`.

## README trace table

Replace or create `viewpro-app/apps/app-new/tests/seeded/README.md` with:

```markdown
# Seeded Playwright suite — pilot audit trace

| Test name (substring)                            | Audit row (2026-06-13)                              | FR(s)         | File                       |
|--------------------------------------------------|-----------------------------------------------------|---------------|----------------------------|
| `demo user can navigate the seeded operational`  | Manager dashboard / property list / property detail | (baseline)    | demo-smoke.spec.ts         |
| `seller dashboard` (martin / lucia)              | Seller assigned-only visibility                     | (baseline)    | demo-smoke.spec.ts         |
| `manager can create a new property engagement`   | Manager creates property engagement                 | FR-1..FR-4    | demo-smoke.spec.ts         |
| `manager can assign martin via Gestionar`        | Manager assigns seller                              | FR-5..FR-6    | demo-smoke.spec.ts         |
| `manager can remove a seller assignment`         | Manager assigns seller (unassign)                   | FR-7          | demo-smoke.spec.ts         |
| `manager can create a plain movement`            | Manager creates movement/status update              | FR-8..FR-10   | demo-smoke.spec.ts         |
| `manager can create a document request`          | Manager requests document                           | FR-11..FR-13  | demo-smoke.spec.ts         |
| `manager can reject an uploaded document`        | Manager approves/rejects document (reject)          | FR-14..FR-15  | demo-smoke.spec.ts         |
| `owner sees rejection reason and re-upload`      | Manager approves/rejects document (owner side)      | FR-16         | demo-smoke.spec.ts         |
| `owner WhatsApp click POSTs a tracking event`    | WhatsApp contact link priority + tracking           | FR-17..FR-19  | demo-smoke.spec.ts         |
| `tenant engagement limit blocks creation`        | Tenant suspended/limit behavior                     | FR-20..FR-22  | demo-smoke.spec.ts         |
| (existing) `demo owner sees seeded notifications`| WhatsApp link href (extended)                       | FR-17, FR-18  | demo-smoke.spec.ts         |
```

Required columns: **Test name (substring), Audit row, FR(s), File**. Test names use a substring match so future renames don't break the table.

## Rollout & rollback

**Single PR**, three commits in order to keep the diff reviewable:

1. **Commit A — `test(seeded): extract _helpers.ts and add trace README`** (~80 lines, mostly file move + README). No new behavior. Suite must run green before and after.
2. **Commit B — `feat(seed): add SUBMITTED document fixture on property index 1`** (~60 lines in `seed-demo.mjs` + maybe property-owner link). Re-run `pnpm demo:seed` and existing 13 tests must stay green.
3. **Commit C — `test(seeded): cover G-1..G-7 audit gaps with 9 new tests`** + **MUI-1 toast mapping** (~230–280 lines). Adds T13–T20 and the one `product-form.tsx` toast line.

Total estimated diff: **350–420 lines**. Within the 400-line conservative single-PR budget when commit A and B trim early review surface. If apply-phase measures show the diff over 400 lines, escalate to chained PRs (A+B as one PR, C as a child PR) per the review workload guard.

**Rollback**: revert the PR (or delete the new tests + restore `seed-demo.mjs` to the prior fixture list + revert the `product-form.tsx` toast line). Existing 13-test baseline remains intact.

## Non-goals (carried + new)

- No new product features. Only the MUI-1 toast mapping is added; it surfaces an existing API error.
- No refactor of existing 13 tests beyond the helper extraction in Commit A.
- No changes to `playwright.seeded.config.ts`, ports, or `globalSetup`.
- No new admin endpoints; reuses `PATCH /admin/tenants/:id/limits`.
- No changes to the 26.2 deterministic seed contract beyond appending one fixture.
- No changes to the 26.2.1 image fixtures.
- No changes to the API 403 guard contract.
- No client-side analytics SDK addition — the existing `WHATSAPP_CONTACT_CLICKED` event flows server-side via the existing BFF route.
- No persisted state cleanup for created engagements (T13's engagement stays until next reseed; documented).

## Risks (design-level — tasks/apply must watch)

| Risk | Mitigation |
|------|------------|
| R1.a — T20's `afterEach` doesn't run on hard process kill (timeout) and leaves the limit at ~20. Next `pnpm test:seeded` blocks at engagement creation. | Document in test comment; reseed restores. Tasks MUST add a `console.warn` in `afterEach` if restore fails. |
| R2.a — New SUBMITTED fixture's `Document requested` notification trips existing Test 8 assertion if the notification arrives in unexpected order. | Test 8 uses `arrayContaining`, not strict equality. Verify before Commit B. |
| A-3 — Helper extraction in Commit A modifies every test import. Risk of TypeScript drift. | Commit A is its own commit; run full suite between A and B. |
| G-7 admin PATCH races a parallel test. | Suite is serial (`workers: 1`). Not a real risk but call out in Commit C PR description. |
| MUI-1 toast string drift between English backend message and Spanish UI mapping. | Use case-insensitive substring match on the canonical backend constant `Tenant active property engagement limit exceeded` (defined in `viewpro-app/apps/api/src/tenant-limits/tenant-limit-enforcement.constants.ts`). |
| Helpers file move breaks other suites that import from `demo-smoke.spec.ts`. | No suite imports test files; only `playwright.seeded.config.ts` references the testDir. Safe. |
| T13's new engagement leaks state — a later test asserting `total === N` would fail. | Audit existing assertions: only Test 1 asserts `'20 gestiones inmobiliarias en total'` literal. T13 runs AFTER Test 1 in serial order. Verify ordering in tasks. |

## Spec deltas required

None. Spec FRs are testable as written. The minor change to assertion mechanics (intercept tracking POST vs DB query for S-10/FR-19) is within spec's "verified via tracking API response or analytics event in DB state" wording.

## Next step

Move to `sdd-tasks` to break this design into work units. Tasks phase should mirror the three-commit structure.
