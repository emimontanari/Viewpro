# Tasks — Stage 26.3 Full Seeded E2E

Implements the design decisions from `design.md` as verifiable work units. Three-commit structure mirrors the design's rollout plan.

---

## Review Workload Forecast

| Item | Value |
|------|-------|
| Estimated changed lines | 630–910 |
| 400-line budget risk | **High** (design estimates 350–420 but heuristic accounting for 9 new tests × 50–80 lines each + helpers + MUI-1 + seed puts total at 630–910) |
| Chained PRs recommended | **Borderline — orchestrator must confirm** |
| Suggested split if chained | PR 1: Commit A (helper extraction + README trace) + Commit B (seed SUBMITTED fixture + Test 8 stability) ≈ 250–350 lines. PR 2: Commit C (9 new Playwright tests T13–T20 + MUI-1 toast mapping) ≈ 450–650 lines. |
| Delivery strategy | Single-PR by design intent (cohesive test scope, no module-spanning feature); escalate to chained if apply-phase diff measurement exceeds 400 lines. |
| Chain strategy if applicable | `stacked-to-main` — each PR targets `main` in order. |
| Decision needed before apply | **Yes.** Orchestrator must decide single-PR vs chained now. If the total diff after Commit A+B measures ≤ 200 lines, proceed single-PR. If Commit C alone measures ≥ 400 lines, split PR 1 = A+B, PR 2 = C. |

---

## Pre-implementation tasks

### T-1 — Verify MUI-2 and MUI-3 "already wired" claims

**Action:** Read `owner-home.tsx` and confirm `onClick={handleContactClick}` calls `trackOwnerWhatsappContactClick` (MUI-2). Read `product-view-page.tsx` and `property-document-requests.tsx` and confirm `Solicitar documento` button is visible for manager role with default `canRequestDocuments=true` (MUI-3).

**Files to inspect:**
- `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx` (line ~353)
- `viewpro-app/apps/app-new/src/features/products/components/product-view-page.tsx`
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx` (line ~100)

**Definition of done:** Both claims confirmed in code with line-number evidence. If either is wrong, surface a design delta to the orchestrator BEFORE proceeding further.

---

### T-2 — Locate the backend limit-exceeded message constant (Risk #5 mitigation)

**Action:** Run `rg 'active property engagement limit exceeded' viewpro-app/apps/api/src --ignore-case -n` to find the exact string and its defining constant name. Confirm it is in `tenant-limit-enforcement.constants.ts` or a sibling file. Record the constant name and its exact value.

**Definition of done:** Exact constant name, file path, and string value are documented in a code comment in `product-form.tsx` when T-6 lands. No hardcoded duplicate — the toast check in `product-form.tsx` uses a case-insensitive substring of this exact backend string.

---

## Commit A — Helper extraction + README trace

### T-3 — Create `_helpers.ts` with extracted helpers

**Action:** Create `/Users/emimontanari/Work/Apps/Viewpro/viewpro-app/apps/app-new/tests/seeded/_helpers.ts`. Extract from `demo-smoke.spec.ts` (lines 532–555) the following four functions:

| Helper | Signature |
|--------|-----------|
| `getJson<T>` | `(page: Page, url: string): Promise<T>` |
| `getAssignedProducts` | `(page: Page): Promise<ProductsResponse>` |
| `getProductByTitle` | `(page: Page, title: string): Promise<Product>` |
| `openManagerPropertyDetail` | `(page: Page, title: string): Promise<void>` — NEW helper: navigate to `/dashboard/product`, find the row with `title`, click "Ver detalle" via the kebab menu. |

Also add `assertFeedContains` — NEW helper: `(page: Page, regex: RegExp): Promise<void>` — asserts that at least one visible element in the Seguimiento feed matches `regex`.

Export all. Keep inline types (`ProductsResponse`, etc.) in `demo-smoke.spec.ts` or re-export from `_helpers.ts` — apply-phase picks the cleaner option. `signIn`, `openOwnerPropertyDetail`, and `openAndVerifySignedReadUrl` stay in `demo-smoke.spec.ts`.

**File:** `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` (new file, ~60 lines)

**Definition of done:** File exists, all five exported functions compile with `pnpm --filter next-shadcn-dashboard-starter typecheck`.

---

### T-4 — Update imports in `demo-smoke.spec.ts` (existing 13 tests unchanged)

**Action:** Replace the inline bodies of `getJson`, `getAssignedProducts`, and `getProductByTitle` in `demo-smoke.spec.ts` with import references from `./_helpers`. Add import for the new helpers. Every existing call site must be unchanged in behavior.

**File:** `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (~5-line import delta, remove ~30 lines of inline bodies)

**Definition of done:** No new test logic introduced. Import statement present at top of file.

---

### T-5 — Run full suite GREEN after Commit A (verification gate)

**Action:** From `viewpro-app/`, run:
```
pnpm --filter next-shadcn-dashboard-starter test:seeded
```
All 13 existing tests must pass. This is a hard gate: **no new test commits land until this is green.**

**Definition of done:** Console output shows `13 passed`. Record the result as evidence in the PR description.

---

### T-6 (also Commit A) — Write README trace table

**Action:** Create or replace `viewpro-app/apps/app-new/tests/seeded/README.md` with the audit-row trace table from the design (`README trace table` section). Include all columns: Test name (substring), Audit row, FR(s), File. Add a header comment block in `demo-smoke.spec.ts` (above the first `test(...)`) grouping tests by audit row per design A-1.

**File:** `viewpro-app/apps/app-new/tests/seeded/README.md` (~30 lines)
**File:** `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` header block (~15 lines)

**Definition of done:** README file exists, header block is in the spec file, no test logic changed.

---

## Commit B — Seed extension + Test 8 stability check

### T-7 — Add SUBMITTED document fixture in `seed-demo.mjs`

**Action:** Append one new document fixture to `createDemoDocumentReviewStates` in `viewpro-app/apps/api/scripts/seed-demo.mjs`:

- Title: `'Constancia de servicios pendiente de revisión'`
- Status: `DocumentRequestStatus.SUBMITTED`
- Version status: `DocumentVersionStatus.UPLOADED`
- Target: property index 1 (`Casa luminosa con patio en Los Boulevares`)
- FK ordering: after property + owner + user rows, at the same insertion point as existing `createDemoDocumentReviewStates` call.

Before appending: verify that `propietario.demo@viewpro.local` is linked to property index 1 via `createDemoOwnerLinks`. If not, add the owner link (additive-only, no existing rows changed). Update the summary log `console.log` to print the new fixture count.

**File:** `viewpro-app/apps/api/scripts/seed-demo.mjs` (~30–40 lines delta)

**Definition of done:** Running `pnpm demo:seed` completes without error. New fixture is queryable via the API.

---

### T-8 — Verify Test 8 passes after seed change (Risk #3 mitigation)

**Action:** Run `pnpm demo:seed` then `pnpm --filter next-shadcn-dashboard-starter test:seeded`. The new SUBMITTED fixture emits one extra `DOCUMENT_REQUESTED` notification for `propietario.demo`. Test 8 uses `arrayContaining` — it should tolerate the new entry. Confirm Test 8 passes.

**If Test 8 fails:** The notification assertion needs narrowing. Narrow the Test 8 assertion by adding the property 1 document title to an explicit exclusion, OR add a stricter filter (by `linkHref` property prefix) so the extra notification is tolerated. Commit this as a separate small fix commit inside Commit B scope.

**Definition of done:** All 13 existing tests pass after the seed change. Test 8 output explicitly confirmed green. If a fix was required, it is committed and the change is noted in the PR description.

---

## Commit C — 9 new Playwright tests T13–T20 + MUI-1

### T-9 — MUI-1: Add limit-exceeded toast mapping in `product-form.tsx`

**Pre-condition:** T-2 completed (backend constant located).

**Action:** In `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`, extend the `onError` handler (around line 192) to check for the limit-exceeded message and show:
```
'Alcanzaste el límite de propiedades activas del plan. Archivá una propiedad o contactá a soporte.'
```
Use a **case-insensitive substring check** against the exact backend constant string found in T-2. Add a comment naming the backend constant and its file. Do NOT duplicate the full string — the check pattern must be a unique substring.

Add one RTL unit test (Vitest) for the `onError` toast mapping: stub an error with the limit-exceeded message and assert `toast.error` was called with the Spanish text.

**Files:**
- `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
- New test file alongside: `product-form.toast-limit.test.tsx` or add to existing test file (~40 lines delta total)

**Definition of done:** `pnpm --filter next-shadcn-dashboard-starter test` passes. The onError handler has the new branch; the RTL test is green.

---

### T-10 — T13: Manager creates a new property engagement (S-1 + S-2, FR-1..FR-4)

**Pre-condition:** T-5 green (all 13 tests passing), T-9 complete.

**Order note:** T13 creates a 21st engagement. It MUST be placed AFTER Test 1 in the serial test file, because Test 1 asserts `'20 gestiones inmobiliarias en total'`. Comment at top of T13 must state: `// ORDERING: must run after Test 1 which asserts the 20-engagement count (Risk #4 mitigation)`.

**Test function name:** `manager can create a new property engagement through the UI`

**Setup:** Sign in as `demo@viewpro.local`. Snapshot `getJson('/api/products?limit=50').total` before creation.

**Strategy:**
- Click `getByRole('link', { name: 'Nueva propiedad' })` from `/dashboard/product`.
- Fill required form fields per `productSchema`: title, address, propertyType, operationType, status, price/currency. (Apply phase must confirm required fields by inspecting `product-form.tsx` schema before writing the fill calls.)
- Submit and `waitForURL('**/dashboard/product')`.

**Assertions:**
1. `getJson('/api/products?limit=50').total` equals snapshot + 1.
2. New property title visible in the product table.
3. Navigate to the new property's detail page; assert correct title and initial status.
4. FR-4: using a fresh request context signed in as `martin.demo@viewpro.local`, call `/api/products?limit=50` and assert the new property is NOT in the response (martin was not assigned at creation).

**Definition of done:** Test written RED first (fails on first run without UI), then GREEN after confirming form fills + assertions work.

---

### T-11 — T14: Manager assigns a seller via Gestionar vendedores (S-3, FR-5..FR-6)

**Pre-condition:** T-10 complete (new engagement exists in DB).

**Test function name:** `manager can assign martin to the new engagement via Gestionar vendedores`

**Setup:** Sign in as `demo@viewpro.local`. Navigate to the detail page of the engagement created in T13 (look it up by the new title via `getProductByTitle`).

**Strategy:**
- `getByRole('button', { name: /Gestionar vendedores/i })`.click()
- In the `ManagePropertyAgentsDialog`, find `martin.demo@viewpro.local` in "Disponibles para asignar" and click `Asignar`.

**Assertions:**
1. Within the still-open dialog, "Asignados actualmente" section shows martin's email.
2. Close dialog. Fetch `/api/products?limit=50` while signed in as martin (new request context); assert the new property IS in the response.

**Definition of done:** RED first, then GREEN. Dialog and API assertion both verified.

---

### T-12 — T15: Manager unassigns the seller (S-4, FR-7)

**Pre-condition:** T-11 complete (martin assigned to the new engagement).

**Test function name:** `manager can remove martin's assignment via Gestionar vendedores`

**Setup:** Sign in as `demo@viewpro.local`. Navigate to the new engagement's detail page.

**Strategy:**
- Open `Gestionar vendedores` dialog.
- In "Asignados actualmente", click `Quitar` on martin's row.

**Assertions:**
1. Martin's row moves to "Disponibles para asignar".
2. Close dialog. Fetch `/api/products?limit=50` as martin; assert the new property is NOT in the response.

**Definition of done:** RED first, then GREEN.

---

### T-13 — T16: Manager creates a plain movement without an outcome (S-5, FR-8..FR-10)

**Pre-condition:** T-5 green (does not depend on T13–T15).

**Test function name:** `manager can create a plain movement without an outcome label`

**Setup:** Sign in as `demo@viewpro.local`. Navigate to any seeded property detail (use `openManagerPropertyDetail` with `VISIBLE_DEMO_PROPERTY_TITLE`). Snapshot `getJson('/api/products/:id').status`.

**Strategy:**
- `getByRole('button', { name: /Agregar actualización/i })`.click()
- Do NOT interact with the outcome combobox. Fill `Observación` only.
- `getByRole('button', { name: /Guardar actualización/i })`.click()

**Assertions:**
1. Dialog closes.
2. New movement entry is visible in the Seguimiento feed (use `assertFeedContains` with the observation text).
3. The movement row does NOT contain any of `['Esperando documentos', 'En negociación avanzada', 'Propietario no responde', 'Consultas y visitas', 'Smoke test label']` — no outcome chip.
4. `getJson('/api/products/:id').status` equals the snapshot (FR-10).

**Definition of done:** RED first, then GREEN.

---

### T-14 — T17: Manager creates a document request (S-6, FR-11..FR-13)

**Pre-condition:** T-5 green, T-1 confirmed MUI-3 button is visible.

**Test function name:** `manager can create a document request through the UI`

**Setup:** Sign in as `demo@viewpro.local`. Navigate to property index 0 (`Casa familiar con pileta en Villa Centenario`) via `getProductByTitle`.

**Strategy:**
- `getByRole('button', { name: /Solicitar documento/i })`.click()
- In `CreateDocumentRequestDialog`, select the owner (`propietario.demo`) and fill title `'Constancia adicional smoke test'`.
- Submit.

**Assertions:**
1. Dialog closes.
2. Document list shows a new entry with `Pendiente` badge containing the title.
3. `getJson('/api/owner/notifications?page=1&pageSize=10')` (signed in as `propietario.demo`) includes an entry with `title: 'Document requested'`.

**Definition of done:** RED first, then GREEN.

---

### T-15 — T18a: Manager rejects an uploaded document (S-7, FR-14..FR-15)

**Pre-condition:** T-7 complete (SUBMITTED seed fixture on property index 1 exists). T-8 confirmed green.

**Test function name:** `manager can reject an uploaded document request with a reason`

**Setup:** Sign in as `demo@viewpro.local`. Navigate to property index 1 (`Casa luminosa con patio en Los Boulevares`) via `openManagerPropertyDetail`.

**Strategy:**
- Find the document row with title `'Constancia de servicios pendiente de revisión'` and `Subido` badge.
- `getByRole('button', { name: 'Rechazar' })`.click()
- In `RejectDocumentRequestDialog`, fill reason `'Falta firma del titular en página 2'`.
- Submit.

**Assertions:**
1. Toast `Documento rechazado` (or localized equivalent) is visible.
2. Document row badge transitions to `Rechazado`.
3. Rejection reason text `'Falta firma del titular en página 2'` is visible on the row (via expansion or inline).
4. `getJson('/api/owner/notifications?page=1&pageSize=10')` as `propietario.demo` includes `{ title: 'Document rejected' }`.

**Definition of done:** RED first, then GREEN.

---

### T-16 — T18b: Owner sees rejection reason and re-upload option (S-8, FR-16)

**Pre-condition:** T-15 complete.

**Test function name:** `owner sees rejection reason and re-upload action on the rejected document`

**Setup:** Sign in as `propietario.demo@viewpro.local`. Navigate to property `Casa luminosa con patio en Los Boulevares` documents tab.

**Assertions:**
1. Entry for `'Constancia de servicios pendiente de revisión'` shows `Rechazado` badge.
2. Rejection reason `'Falta firma del titular en página 2'` is visible on the entry.
3. `Subir documento` (re-upload) button is visible on the same entry.

**Definition of done:** RED first, then GREEN.

---

### T-17 — T19a: Extend Test 8 with WhatsApp href assertion (S-9, FR-17..FR-18)

**Note:** Design decision: extend existing Test 8 in-place rather than adding a standalone test. This is a 2-line addition to the existing `'demo owner sees seeded notifications, images and contacts'` test.

**Action:** After the existing `ownerEngagements[0]?.contact` assertion in Test 8, add:
```ts
const ownerWhatsappAnchor = page.locator('a[href*="wa.me"]').first();
await expect(ownerWhatsappAnchor).toBeVisible();
const href = await ownerWhatsappAnchor.getAttribute('href');
expect(href).toContain('5493510000000');
```

**Pre-condition:** Owner portal must be loaded and the WhatsApp anchor rendered. Test 8 already navigates to `/owner` and confirms contact data.

**Definition of done:** Test 8 still passes after the addition. `pnpm --filter next-shadcn-dashboard-starter test:seeded` all 13 green.

---

### T-18 — T19b: Owner WhatsApp click POSTs a tracking event (S-10, FR-19)

**Pre-condition:** T-1 confirmed `onClick={handleContactClick}` is wired.

**Test function name:** `owner WhatsApp click POSTs a tracking event`

**Setup:** Sign in as `propietario.demo@viewpro.local`, navigate to `/owner`, open the property.

**Strategy:**
- Before clicking: `page.route('**/api/owner/engagements/*/whatsapp-contact-click', route => { trackingHits++; route.continue(); })`
- Click the WhatsApp anchor (use `locator('a[href*="wa.me"]').first()`). Use `click({ modifiers: ['Meta'] })` or handle the popup/navigation to prevent leaving the test page.

**Assertions:**
1. `trackingHits >= 1` after the click.

**Definition of done:** RED first (route intercept works but click assertion fails until the wiring is confirmed). Then GREEN. If the anchor opens a new tab, use `page.waitForEvent('popup')` and close it before asserting.

---

### T-19 — T20: Tenant engagement limit blocks creation with a UI error (S-11, FR-20..FR-22)

**Pre-condition:** T-9 complete (MUI-1 toast mapping in `product-form.tsx`).

**Test function name:** `tenant engagement limit blocks creation with a clear UI error`

**Setup (inside test body, try/finally for robustness — Risk #1 mitigation):**
```
try {
  1. Sign in as admin.demo@viewpro.local.
  2. Read tenant ID: getJson('/api/admin/tenants?page=1&pageSize=10').items[0].id (find by slug 'viewpro-demo-inmobiliaria').
  3. Snapshot current maxActivePropertyEngagements (expect 25).
  4. Count active engagements: getJson('/api/products?limit=50') as manager context → .total.
  5. PATCH /api/admin/tenants/:id/limits with maxActivePropertyEngagements = activeCount.
  6. Sign in as demo@viewpro.local.
  7. Navigate to /dashboard/product/new.
  8. Fill the required form fields.
  9. Submit.
  → BFF returns 409. Toast with limit-exceeded message appears.
} finally {
  10. PATCH /api/admin/tenants/:id/limits restoring maxActivePropertyEngagements = 25.
      On failure: console.warn('T20 afterEach restore failed — run pnpm demo:seed to restore limit').
}
```

**Global `test.afterEach` hook (added at describe block level, scoped to this test by name guard):** unconditionally restores `maxActivePropertyEngagements` to the `KNOWN_LIMITS.maxActivePropertyEngagements` constant (= 25). Runs even on hard process kill within Playwright's afterEach semantics.

**Comment in test:** `// NEXT-RESEED FALLBACK: if afterEach fails (e.g. hard kill), run 'pnpm demo:seed' to restore the limit.`

**ORDERING comment:** T20 must be the last test in the describe block (or at minimum after T13–T18). Serial execution guarantees no overlap.

**Assertions:**
1. Toast contains `/Alcanzaste el límite de propiedades activas/i`.
2. URL remains `/dashboard/product/new` (no redirect to `/dashboard/product`).
3. `getJson('/api/products?limit=50').total` (as manager) equals the pre-test snapshot — no new engagement created (FR-21).
4. Title input field remains editable (FR-22): `await expect(page.getByLabel(/Título/i)).toBeEditable()`.

**Definition of done:** RED first (toast shows generic message before T-9 MUI-1 is applied; test fails on the `Alcanzaste` assertion). GREEN after T-9 lands. `afterEach` restore confirmed by running a second pass and checking Test 9 still reads `maxActivePropertyEngagements: 25`.

---

## Verification tasks

### T-N1 — Run the full `test:seeded` suite (22 tests minimum)

**Action:** From `viewpro-app/`, run:
```
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

**Expected:** ≥22 tests green (13 existing + 9 new: T13–T20 plus the T17 extension counted as 1 inline addition to Test 8). Wall-clock under 150 seconds on a warm dev box. Zero failures.

**Definition of done:** Console shows `22 passed` (or more). Screenshot / terminal output copied to PR description as evidence.

---

### T-N2 — Run API unit/integration tests

**Action:** From `viewpro-app/`, run:
```
pnpm --filter @viewpro/api test
```

Confirm the seed change (T-7) did not regress any API test. The seed script is not directly tested by the API suite, but any schema change in `seed-demo.mjs` that altered FK relations could surface here.

**Definition of done:** API test suite passes with same baseline count as before this change. Zero new failures.

---

### T-N3 — Confirm README trace table is complete

**Action:** Verify `viewpro-app/apps/app-new/tests/seeded/README.md` includes rows for all 11 scenarios S-1..S-11 (mapped via audit row), references all FR numbers, and lists `demo-smoke.spec.ts` as the single file. Verify the header comment block in `demo-smoke.spec.ts` is in sync.

**Definition of done:** README and header block both present and complete. PR reviewer can trace any audit row to a test name substring without opening the spec file.

---

## Acceptance checklist — Scenarios to task map

| Scenario | FR(s) | Task(s) that prove it | Confirmed green |
|----------|-------|-----------------------|-----------------|
| S-1 Manager creates new engagement | FR-1, FR-2, FR-3 | T-10 (T13) | [ ] |
| S-2 New engagement not visible to unassigned seller | FR-4 | T-10 (T13, assertion 4) | [ ] |
| S-3 Manager assigns seller | FR-5, FR-6 | T-11 (T14) | [ ] |
| S-4 Manager unassigns seller | FR-7 | T-12 (T15) | [ ] |
| S-5 Manager creates plain movement | FR-8, FR-9, FR-10 | T-13 (T16) | [ ] |
| S-6 Manager creates document request | FR-11, FR-12, FR-13 | T-14 (T17) | [ ] |
| S-7 Manager rejects uploaded document | FR-14, FR-15 | T-15 (T18a) | [ ] |
| S-8 Owner sees rejection + re-upload | FR-16 | T-16 (T18b) | [ ] |
| S-9 Owner WhatsApp href wired to tenant phone | FR-17, FR-18 | T-17 (Test 8 extension) | [ ] |
| S-10 WhatsApp click produces tracking event | FR-19 | T-18 (T19b) | [ ] |
| S-11 Tenant limit blocks creation with UI error | FR-20, FR-21, FR-22 | T-9 + T-19 (MUI-1 + T20) | [ ] |
| No spec drift | All FRs | T-N1 all 22+ green | [ ] |
| No extra MUI beyond MUI-1 | MUI-2 resolved (no change), MUI-3 resolved (no change) | T-1 verification + T-N1 | [ ] |

---

## Task dependency graph

```
T-1 ──────────────────────────────────────────────────────────────┐
T-2 ──────────────────────────────────────────────────────────────┤
                                                                   ↓
T-3 → T-4 → T-5 (GREEN gate) → T-6 (Commit A complete)
                  │
                  ↓
T-7 → T-8 (Commit B complete)
      │
      ↓
T-9 (depends on T-2) ─────────────────────────────────────────────┐
T-10 (depends on T-5) → T-11 (depends on T-10) → T-12           │
T-13 (depends on T-5)                                             │
T-14 (depends on T-5, T-1)                                        │
T-15 (depends on T-7, T-8)  → T-16 (depends on T-15)            │
T-17 (depends on T-5, T-1, extends Test 8 inline)                 │
T-18 (depends on T-5, T-1)                                        │
T-19 (depends on T-9) ────────────────────────────────────────────┘
                  │
                  ↓
T-N1 → T-N2 → T-N3 (all final verification)
```

**Parallel-safe within Commit C:** T-10, T-13, T-14, T-17, T-18 have no shared state dependency beyond T-5 and can be authored in parallel, but must land in a single commit in a specific serial order. T-11 depends on T-10, T-12 depends on T-11, T-15 depends on T-7+T-8, T-16 depends on T-15.

**Serial order in file (required for test runner):**
1. Existing tests 1–13 (unchanged)
2. T17 (Test 8 inline extension — minimal addition inside existing test)
3. T13 (T-10) — engagement creation; must follow Test 1
4. T14 (T-11) — seller assignment
5. T15 (T-12) — seller unassignment
6. T16 (T-13) — plain movement
7. T17 (T-14) — document request creation (T17 file position, not same as the Test 8 extension)
8. T18a (T-15) — manager rejects document
9. T18b (T-16) — owner sees rejection
10. T19b (T-18) — WhatsApp tracking click
11. T20 (T-19) — tenant limit exceeded (MUST BE LAST — has afterEach restore)
