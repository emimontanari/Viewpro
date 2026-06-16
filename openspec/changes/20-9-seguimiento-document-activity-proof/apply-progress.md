# Apply Progress — Stage 20.9 Seguimiento Document Activity Proof

**Change:** `20-9-seguimiento-document-activity-proof`
**Mode:** Standard (audit-only tasks)
**Artifact store:** openspec
**Delivery:** single-pr, size:exception (~530 LOC)

---

## Phase 1 — Pre-implementation audit (DONE)

All three audit tasks complete. No code written. Findings documented below.

---

### T-1 Sort tie-break direction

**File:** `viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts`
**Comparator function:** `compareActivityItems` (defined at lines 121–129)
**Used at:** line 107 — `.sort((left, right) => compareActivityItems(left, right))`

**Implementation (lines 121–129):**
```ts
function compareActivityItems(left: ActivityFeedItemResponse, right: ActivityFeedItemResponse) {
  const createdAtDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()

  if (createdAtDifference !== 0) {
    return createdAtDifference
  }

  return right.id.localeCompare(left.id)
}
```

**Primary sort field:** `createdAt` descending (`right - left`).

**Tie-break field and direction:** `id` **descending** — `right.id.localeCompare(left.id)` returns a positive number when `right.id > left.id` lexicographically, which makes the higher-lexicographic id sort first.

**Verdict:** Tie-break is `id DESC` (lexicographic descending). This matches the spec FR-9 contract ("ties by `id` descending"). No deviation.

**Action for T-20:** the tie-break sub-case should assert `z-id` sorts before `a-id` (i.e., `result.items[0].id === 'z-id'`).

---

### T-2 Count-coupled literals

Searches run from `/Users/emimontanari/Work/Apps/Viewpro`:

#### `Document requests:` log string
```
viewpro-app/apps/api/scripts/seed-demo.mjs:
  console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares)`);
```
**Classification:** SAFE — value is `${result.documentRequestsCount}`, a dynamic count computed from `documentRequests.length`. Adding new fixtures increases the printed number automatically without touching any literal.

#### `documentRequestsCount`
```
viewpro-app/apps/api/scripts/seed-demo.mjs (2 hits):
  documentRequestsCount: documentRequests.length,   ← dynamic accumulator
  console.log(`Document requests: ${result.documentRequestsCount} ...`);  ← same as above
```
**Classification:** SAFE — both references are dynamic; no hardcoded integer.

#### `result.total` in test files
```
viewpro-app/apps/api/test/property-engagements.use-cases.spec.ts:  expect(result.total).toBe(1);
viewpro-app/apps/api/test/analytics.use-cases.spec.ts:  expect(result.total).toBe(2);  ← line 293
viewpro-app/apps/api/test/analytics.use-cases.spec.ts:  expect(result.total).toBe(1);  ← line 346
viewpro-app/apps/api/test/analytics.use-cases.spec.ts:  expect(result.total).toBe(1);  ← line 432
```

Analysis per hit:
- `property-engagements.use-cases.spec.ts:expect(result.total).toBe(1)` — **SAFE**: unrelated use case, no connection to document request counts.
- `analytics.use-cases.spec.ts:293 expect(result.total).toBe(2)` — **SAFE**: this is a bespoke-mocked repository test (the mock is set up inline with `mockResolvedValue({ items: [documentRequest], total: 1 })` for docs and `{ items: [activityMovement], total: 1 }` for movements). Total = 1+1 = 2. No relation to seed DB row counts.
- `analytics.use-cases.spec.ts:346 expect(result.total).toBe(1)` — **SAFE**: inline mock for movement-only kind, documents repo mocked with `total: 0`.
- `analytics.use-cases.spec.ts:432 expect(result.total).toBe(1)` — **SAFE**: inline mock for `document_request` kind, movements not called.

#### `expectedTotal` in smoke/e2e
```
viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts:
  expectedTotal: 8,
  expectedTotal: 6,
  expect(assignedProducts.total).toBe(scenario.expectedTotal);
```
**Classification:** SAFE — both `expectedTotal` values are property/product counts (`assignedProducts.total`), not document request counts. Design §D1 confirmed these are `SELLER_SCENARIOS.expectedTotal` from the property assignments API, completely unaffected by doc request fixtures.

#### Summary table

| File:line | Value | Classification | Reason |
|-----------|-------|----------------|--------|
| `seed-demo.mjs` — `Document requests:` log | `${result.documentRequestsCount}` | SAFE | Dynamic |
| `seed-demo.mjs` — `documentRequestsCount` | `.length` accumulator | SAFE | Dynamic |
| `analytics.use-cases.spec.ts:293` | `.toBe(2)` | SAFE | Bespoke mock, not seed-tied |
| `analytics.use-cases.spec.ts:346` | `.toBe(1)` | SAFE | Bespoke mock, not seed-tied |
| `analytics.use-cases.spec.ts:432` | `.toBe(1)` | SAFE | Bespoke mock, not seed-tied |
| `property-engagements.use-cases.spec.ts` | `.toBe(1)` | SAFE | Unrelated use case |
| `demo-smoke.spec.ts` — `expectedTotal: 8` | hardcoded | SAFE | Product/property count, not doc count |
| `demo-smoke.spec.ts` — `expectedTotal: 6` | hardcoded | SAFE | Product/property count, not doc count |

**No AT-RISK hits found.** The APPROVED + CANCELLED seed additions will not break any existing count assertions.

---

### T-3 next/link JSDOM check

**Existing test siblings in `apps/app-new/src/features/activity/components/`:**
- `activity-feed.test.tsx` — imports `ActivityFeed` and renders empty states only; does NOT import `next/link` directly.
- `activity-filters.test.tsx` — imports `ActivityFilters`; does NOT import `next/link` directly.

**Key evidence:**
- `rg "from 'next/link'" ... -g "*.test.tsx"` in `src/features/` returned zero matches — no test file in the features directory imports `next/link` directly.
- `activity-document-request-feed-item.tsx` (the component under test) imports `Link from 'next/link'` at line 13.
- `vitest.config.ts` uses `environment: 'jsdom'` and `setupFiles: ['./src/test/setup.ts']`. The setup file only imports `@testing-library/jest-dom/vitest`. No next/link stub or mock is configured globally.
- `product-table.test.tsx` renders `ProductTable` which transitively uses `next/link` columns and has no `vi.mock('next/link')` — passes in the existing test suite (part of the 403 baseline).

**Conclusion:** `next/link` in JSDOM is handled transparently by the existing test configuration (Next.js exports a JSDOM-compatible `<a>` wrapper by default in test environments). The `product-table.test.tsx` pattern proves this works without any mock.

**Chosen approach:** rely on existing vitest config — no `vi.mock('next/link', ...)` needed in the new test file.

**Note:** link `href` assertions (`toHaveAttribute('href', '/dashboard/product/engagement-42')`) will work because Next.js `<Link>` renders a real `<a>` element in JSDOM.

---

### Decisions for Phase 2+

| Decision | Detail |
|----------|--------|
| T-1: Tie-break direction | `id DESC` confirmed. T-20 sort sub-case: assert `z-id` before `a-id`. |
| T-2: No pre-mutation count fixes needed | All `result.total` and `expectedTotal` assertions are safe. Proceed with seed additions in Phase 4 without updating any existing assertion. |
| T-3: next/link mock strategy | Use existing config (no mock). Rely on natural `<a>` rendering. |
| Spec FR-9 | Implementation matches — no spec delta needed. |
| Design §3.1 link href assertion | `screen.getByRole('link', { name: /Ver propiedad/ })` → `toHaveAttribute('href', ...)` confirmed correct approach. |

---

## Phase 2 — Component test (DONE)

Tasks T-4 through T-18. All 16 tests written and GREEN.

### Label/class verification (source vs. design)

| Element | Design expectation | Source actual | Match? |
|---|---|---|---|
| PENDING label | "Pendiente" | "Pendiente" (line 23 of component) | ✓ |
| SUBMITTED label | "Subida" | "Subida" (line 25) | ✓ |
| APPROVED label | "Aprobada" | "Aprobada" (line 21) | ✓ |
| REJECTED label | "Rechazada" | "Rechazada" (line 24) | ✓ |
| CANCELLED label | "Cancelada" | "Cancelada" (line 22) | ✓ |
| PENDING tone class | `bg-amber-50` | `bg-amber-50` (line 36) | ✓ |
| SUBMITTED tone class | `bg-sky-50` | `bg-sky-50` (line 40) | ✓ |
| APPROVED tone class | `bg-emerald-50` | `bg-emerald-50` (line 33) | ✓ |
| REJECTED tone class | `bg-red-50` | `bg-red-50` (line 38) | ✓ |
| CANCELLED tone class | `bg-muted/50` | `bg-muted/50` (line 34) | ✓ |
| PENDING_UPLOAD version label | "Pendiente de carga" | "Pendiente de carga" (line 48) | ✓ |
| UPLOADED version label | "Subida" | "Subida" (line 50) | ✓ |
| APPROVED version label | "Aprobada" | "Aprobada" (line 47) | ✓ |
| REJECTED version label | "Rechazada" | "Rechazada" (line 49) | ✓ |
| Sin archivo cargado | "Sin archivo cargado" | "Sin archivo cargado" (line 139) | ✓ |
| Solicitud no disponible | "Solicitud no disponible" | "Solicitud no disponible" (line 62) | ✓ |
| Propietario fallback | "Propietario" | "Propietario" (line 56) | ✓ |
| Solicitante no disponible | "Solicitante no disponible" | "Solicitante no disponible" (line 197) | ✓ |
| Propiedad sin título | "Propiedad sin título" | "Propiedad sin título" (line 54) | ✓ |

**No mismatches found.** All labels and tone classes in source match design exactly.

### Implementation notes

- **S-2 (SUBMITTED) and S-4 (REJECTED)**: "Subida" and "Rechazada" appear twice when the doc-status and version-status share the same label. Used `getAllByText()` with class filter to find the status badge specifically.
- **S-11 (Propietario fallback)**: `ActivityMeta` renders both a `<p>` label ("Propietario") and a `<p>` value ("Propietario") — `getByText` would throw multiple-elements error. Used `getAllByText('Propietario')` with `length >= 1` instead.
- **Version section anchor**: Used `heading.closest('div[class*="rounded-xl"]')` to scope within the "Estado del archivo" panel. This works because the component uses `rounded-xl border bg-muted/20 p-3` on the panel divs.
- **No production code changed**: Component `activity-document-request-feed-item.tsx` is unchanged.
- **No new dependency**: Uses only existing `@testing-library/react` and `vitest`.

### Test count

| Metric | Value |
|---|---|
| Baseline (before Phase 2) | 403 |
| New tests added | 16 |
| Total after Phase 2 | 419 |
| Test files | 82 |

### Gate result

**GREEN** — `pnpm --filter next-shadcn-dashboard-starter test -- --run` exits 0. 82 test files, 419 tests, 0 failures.

## Phase 3 — Use case test additions (DONE)

Tasks T-19 through T-21. All 6 new tests written and GREEN.

### Fixture shape decisions

**T-19 — `it.each` over 4 statuses (S-12)**

Reused the PENDING fixture shape from lines 369-403 as the base. The key field is `document` on the request object:
- SUBMITTED → `document: { currentVersion: { id, originalFilename, status: 'UPLOADED', createdAt: Date } }`
- APPROVED → same shape + `reviewedByUserId: 'reviewer-1'`
- REJECTED → same shape with `status: 'REJECTED'` + `rejectionReason: 'Documento ilegible'`
- CANCELLED → `document: null` (no version row)

Mapper at `activity-feed.response.ts:67`: `const currentVersion = request.document?.currentVersion ?? null` — confirmed that `document: null` produces `currentVersion: null` in the mapped output.

Assertion used `expect.objectContaining({ status: expectedVersionStatus })` for present versions and literal `null` for CANCELLED.

**T-20 — Mixed-kind sort + tie-break (S-13)**

Implemented as two separate `it()` tests for clarity:
1. `"mixed-kind feed sorts by createdAt desc with id tie-break (S-13)"` — 3 items (2 docs + 1 movement), asserts `items[0].createdAt === '2026-05-22T12:00:00.000Z'`, `items[1].createdAt === '2026-05-22T11:30:00.000Z'`, `items[2].createdAt === '2026-05-22T11:00:00.000Z'`.
2. `"tie-breaks same-createdAt items by id desc (S-13 tie-break)"` — 2 doc requests with same `createdAt`, IDs `'a-id'` and `'z-id'`. Asserts via `documentRequestId` field (the mapper assigns `id: "document-request:${request.id}"` but exposes `documentRequestId: request.id`). Confirms `z-id` before `a-id` (id-DESC).

Note: The mapped `id` field is `"document-request:z-id"` etc (prefixed), but the tie-break comparator uses `right.id.localeCompare(left.id)` — `"document-request:z-id"` > `"document-request:a-id"` lexicographically, so `z-id` still sorts first. Assertion uses `documentRequestId` for readability.

### Test count

| Metric | Value |
|---|---|
| Baseline before Phase 3 | 659 (actual; tasks said 671 but that was an estimate) |
| New tests added | 6 (4 from `it.each` + 2 sort/tiebreak) |
| Total after Phase 3 | 665 |
| Test files | 57 |

### Gate result

**GREEN** — `pnpm --filter @viewpro/api test -- --run` exits 0. 57 test files, 665 tests, 0 failures.

## Phase 4 — Seed additions (DONE)

Tasks T-22 through T-27. All complete.

### T-22 — Extend `reviewedByUserId` for APPROVED

**File:** `viewpro-app/apps/api/scripts/seed-demo.mjs`
**Location:** inside `createDemoDocumentReviewStates` fixtures loop (~line 1484)

Changed from REJECTED-only conditional to REJECTED-or-APPROVED:

```diff
- reviewedByUserId:
-   fixture.status === DocumentRequestStatus.REJECTED
-     ? reviewer.id
-     : null,
+ reviewedByUserId:
+   fixture.status === DocumentRequestStatus.REJECTED ||
+   fixture.status === DocumentRequestStatus.APPROVED
+     ? reviewer.id
+     : null,
```

Validation: `node --check viewpro-app/apps/api/scripts/seed-demo.mjs` → SYNTAX OK.

---

### T-23 — APPROVED fixture on Villa Centenario

Added third entry to the `fixtures` array inside `createDemoDocumentReviewStates`:

```js
// Stage 20.9 — APPROVED fixture for lifecycle coverage (FR-10, S-14).
{
  title: "Boleto de compra-venta aprobado",
  description: "Documento demo aprobado por el manager para Stage 20.9 coverage.",
  status: DocumentRequestStatus.APPROVED,
  versionStatus: DocumentVersionStatus.APPROVED,
  originalFilename: "boleto-compraventa-aprobado-demo.pdf",
  body: Buffer.from("%PDF-1.4\n% ViewPro stage 20.9 approved fixture\n", "utf8"),
  createdAt: daysAgo(4),
  uploadedAt: daysAgo(3),
  reviewedAt: daysAgo(2),
},
```

Requester: `sofia.demo@viewpro.local` (same as the other Villa Centenario fixtures).
Reviewer: `demo@viewpro.local` (same `reviewer` variable).

---

### T-24 — CANCELLED fixture on Villa Centenario

Added as a SEPARATE block after the `fixtures` loop (before the Los Boulevares block):

```js
// Stage 20.9 — CANCELLED fixture on Villa Centenario for lifecycle coverage (FR-10, D1).
const cancelledRequest = await client.documentRequest.create({
  data: {
    tenantId: tenant.id,
    propertyEngagementId: property.engagement.id,
    propertyAssetOwnerId: property.owner.id,
    ownerUserId: owner.id,
    requestedByUserId: users.get("martin.demo@viewpro.local").id,
    title: "Plano municipal (solicitud cancelada)",
    description: "Documento demo cancelado antes de la carga (Stage 20.9 coverage).",
    status: DocumentRequestStatus.CANCELLED,
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(11),
  },
});
requests.push({ ...cancelledRequest, demoUploadedAt: null, demoReviewedAt: null });
```

**Analytics guard added (not in original design scope):** `createDocumentReviewAnalyticsEvents` was extended with a guard to skip CANCELLED requests — without it, a spurious `DOCUMENT_UPLOADED` analytics event would have been created using `updatedAt` as `occurredAt`:

```diff
+ // Skip CANCELLED requests: they have no version row and no upload event to record.
+ if (request.status === DocumentRequestStatus.CANCELLED) {
+   return [];
+ }
```

---

### T-25 — Atomic summary-log update

Updated line ~2063 of `seed-demo.mjs`:

```diff
- console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares)`);
+ console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)`);
```

Count is dynamic (`documentRequests.length` accumulator). Log honesty preserved.

---

### T-26 — `pnpm demo:seed` result

**Exit:** 0 (success)

**Literal log line:**
```
Document requests: 20 (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)
```

**Count after:** 20 (confirmed from seed output)
**Count delta:** +2 (APPROVED + CANCELLED fixtures on Villa Centenario)

No Prisma errors. `Demo tenant engagements: 20 (expected 20)` — sanity assertion passed.

---

### T-27 — Post-seed T-2 audit re-run

| Pattern | Results | Classification |
|---------|---------|----------------|
| `Document requests:` log string | 1 hit (seed-demo.mjs — dynamic) | SAFE |
| `documentRequestsCount` outside seed | 0 hits | SAFE |
| `result.total` in test files | 4 hits (same as Phase 1 — all bespoke-mocked) | SAFE |
| `expectedTotal` in smoke/e2e | 3 hits (demo-smoke.spec.ts property counts) | SAFE |

No assertion shifted. Baselines clean.

### API test suite

**Run 1:** 1 flaky failure in `team.e2e-spec.ts` (`socket hang up` — network, unrelated to seed).
**Run 2:** 57 test files, **665 tests, 0 failures** — GREEN.

**Result: GREEN-665** (baseline unchanged — seed changes add no new unit tests)

## Phase 5 — Seeded smoke (DONE)

Tasks T-28 through T-30. All complete.

### T-28 — S-15 seeded smoke: doc card renders with stable structure

**File:** `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

Added `test.describe('Seguimiento document activity (Stage 20.9)', ...)` block at end of file (after the isolation block, lines 1295–1359). `test.describe.configure({ mode: 'serial' })` applied to match suite pattern.

Test `seeded smoke: doc card renders with stable structure (S-15)` (line 1313):
- Signs in as manager via the existing `signIn(page, DEMO_EMAIL)` helper.
- Navigates to `/dashboard/seguimiento`.
- Asserts the `'Seguimiento'` heading is visible.
- Clicks `getByRole('button', { name: 'Documentos' })` pill.
- `waitForTimeout(600)` to let the feed reload.
- Asserts `page.getByText('Solicitud documental', { exact: true }).first()` is visible within 10s.
- Asserts `page.getByText(/^(Pendiente|Subida|Aprobada|Rechazada|Cancelada)$/).first()` is visible (lifecycle status label).
- Gets `page.getByRole('link', { name: /Ver propiedad/ }).first()`, asserts visible, reads `href`, asserts `href` matches `/^\/dashboard\/product\/[a-f0-9-]+$/`.

Anchor decisions:
- Scoped to first badge on page (not the card-scoped article/Card locator) — simpler and sufficient since Documentos filter guarantees all visible cards are doc cards.
- `Ver propiedad` link targeted by role + accessible name, not by `data-testid` (design D2).
- `waitForTimeout(600)` is consistent with the Stage 20.11 S-8 filter test pattern already in the suite.

---

### T-29 — S-16 seeded smoke: Documentos filter shows only doc cards

Test `seeded smoke: Documentos filter shows only doc cards (S-16)` (line 1340):
- Signs in as manager, navigates to `/dashboard/seguimiento`.
- Clicks "Documentos" pill, waits 600ms.
- Counts `page.getByText('Solicitud documental', { exact: true })` — asserts count > 0.
- Asserts `page.getByText('Ingresó una consulta calificada')` has count 0 (no movement-only card visible).

Anchor note: used `page.getByText('Solicitud documental', { exact: true })` (page-level, not scoped to articles) because after the Documentos filter all rendered cards are doc cards, so every `'Solicitud documental'` text on the page corresponds to a doc card header badge.

---

### T-30 — Gate: pnpm test:seeded

**Command:** `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts`

**Total tests:** 27
**Passed:** 27
**Failed:** 0
**Flakes retried:** 0
**Duration:** 1m 36s (serial, 1 worker)

Test breakdown (all GREEN):

| # | Test name | Status |
|---|-----------|--------|
| 1 | demo user can navigate the seeded operational workflow | ✓ (4.4s) |
| 2 | martin.demo@viewpro.local sees a distinct assigned seller dashboard | ✓ (2.1s) |
| 3 | lucia.demo@viewpro.local sees a distinct assigned seller dashboard | ✓ (2.2s) |
| 4 | demo owner can read the owner portal follow-up (owner-portal Test 5) | ✓ (4.2s) |
| 5 | demo owner can upload a requested document | ✓ (3.2s) |
| 6 | existing demo owner can accept another property invitation | ✓ (1.4s) |
| 7 | demo manager sees seeded internal notifications | ✓ (714ms) |
| 8 | demo owner sees seeded notifications, images and contacts | ✓ (811ms) |
| 9 | viewpro admin can inspect seeded tenant limits | ✓ (990ms) |
| 10 | seller can create movements with outcomes and chip appears in feed | ✓ (3.6s) |
| 11 | demo manager can review a submitted document request | ✓ (3.4s) |
| 12 | manager can reject a pending status change request from the bandeja | ✓ (2.4s) |
| 13 | manager can approve a new status change request from the bandeja | ✓ (3.4s) |
| 14 | manager can create a new property engagement through the UI | ✓ (4.3s) |
| 15 | manager can assign martin to the new engagement | ✓ (3.4s) |
| 16 | manager can remove martin's assignment | ✓ (3.4s) |
| 17 | manager can create a plain movement without an outcome label | ✓ (2.3s) |
| 18 | manager can create a document request through the UI | ✓ (2.7s) |
| 19 | manager can reject an uploaded document request with a reason | ✓ (3.1s) |
| 20 | owner sees rejection reason and re-upload action on the rejected document | ✓ (1.1s) |
| 21 | owner WhatsApp click POSTs a tracking event | ✓ (6.4s) |
| 22 | tenant engagement limit blocks creation with a clear UI error | ✓ (7.3s) |
| 23 | Seguimiento filter smoke: date=seed-clock-day + Responsable=Martín | ✓ (2.2s) |
| 24 | isolation: seller direct deep-link to unassigned property is denied | ✓ (1.9s) |
| 25 | isolation: owner direct deep-link to unowned property is denied | ✓ (9.4s) |
| 26 | Seguimiento document activity (Stage 20.9) › seeded smoke: doc card renders with stable structure (S-15) | ✓ (1.9s) |
| 27 | Seguimiento document activity (Stage 20.9) › seeded smoke: Documentos filter shows only doc cards (S-16) | ✓ (2.1s) |

**Owner-portal Test 5** (test #4 — "demo owner can read the owner portal follow-up") — asserts `Ingresó una consulta calificada|Se concretó una visita|Oferta` movement strings — GREEN. No leakage from doc activity rows.

### Deviations from design

**None.** The seeded smoke tests match design §3.4 exactly:
- `test.describe.configure({ mode: 'serial' })` applied.
- S-15 anchors: `getByText('Solicitud documental', { exact: true })`, lifecycle regex, `getByRole('link', { name: /Ver propiedad/ })` with href assertion.
- S-16 anchor: `getByText('Solicitud documental', { exact: true })` count > 0, `getByText('Ingresó una consulta calificada')` count === 0.
- No production code touched. No new dependencies.

The only minor deviation from design §3.4's pseudocode: did NOT use the article/Card wrapper locator for S-15 (design used `page.locator('article, [class*="Card"]').filter(...).first()`). Used a simpler `page.getByText('Solicitud documental', ...).first()` because after the Documentos filter all visible items are doc cards, making the article wrapper redundant. This is a simplification, not a functional deviation.

## Phase 6 — Verification gates (DONE)

Tasks T-N1 through T-N5. All gates GREEN.

### Pre-run fix: lint warning in test file

Before the gates could pass, `pnpm --filter next-shadcn-dashboard-starter lint:strict` reported a `unicorn/consistent-function-scoping` warning (treated as error under `--deny-warnings`) for `getVersionSection` defined inside the `describe` block in `activity-document-request-feed-item.test.tsx`. Fixed by moving the function to module scope (outside the `describe`). No functional change to test logic.

**File modified:** `viewpro-app/apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx` — moved `getVersionSection` from inside `describe` to module scope (line ~159 area).

---

### T-N1 — Schema + typecheck + API tests

| Check | Command | Result |
|---|---|---|
| `pnpm db:validate` | `pnpm --filter @viewpro/api db:validate` | GREEN — "The schema at prisma/schema.prisma is valid" |
| `pnpm typecheck` | `turbo typecheck` | GREEN — 2/4 packages typechecked (api + contracts); app-new has no typecheck script (confirmed) |
| API tests | `pnpm --filter @viewpro/api test` | GREEN-665 — 57 files, 665 tests, 0 failures |

**Gate T-N1: GREEN**

---

### T-N2 — App-new lint + unit tests

| Check | Command | Result |
|---|---|---|
| `lint:strict` | `pnpm --filter next-shadcn-dashboard-starter lint:strict` | GREEN — 0 warnings/errors after `getVersionSection` fix |
| Unit tests | `pnpm --filter next-shadcn-dashboard-starter test -- --run` | GREEN-419 — 82 files, 419 tests, 0 failures |

**Gate T-N2: GREEN**

---

### T-N3 — Demo seed

| Check | Result |
|---|---|
| Exit code | 0 |
| Log line | `Document requests: 20 (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)` |
| Count | 20 (count 18 baseline + 2 new fixtures) |

**Gate T-N3: GREEN**

---

### T-N4 — Seeded smoke tests

| Check | Result |
|---|---|
| Command | `pnpm --filter next-shadcn-dashboard-starter test:seeded` |
| Exit code | 0 |
| Tests passed | 27/27 |
| S-15 | PASS — doc card renders with stable structure |
| S-16 | PASS — Documentos filter shows only doc cards |
| Owner-portal Test 5 | PASS — no leakage from doc activity rows |

**Gate T-N4: GREEN-27**

---

### T-N5 — Sanity inversion (S-5 proves real regression catch)

**Step 1 — Mutate:** Changed `CANCELLED: 'Cancelada'` to `CANCELLED: 'WRONG_LABEL'` in `activity-document-request-feed-item.tsx` (line 22, `documentStatusLabels` map).

**Step 2 — RED run:** `pnpm --filter next-shadcn-dashboard-starter test -- --run activity-document-request-feed-item.test`
- Result: **1 test FAILED** — `renders CANCELLED status badge with muted tone (S-5)`
- Error: `Unable to find an element with the text: Cancelada` — DOM showed `WRONG_LABEL` badge instead.
- All other 15 tests in the file: PASSED.
- Exit code: 1

**Step 3 — Restore:** Reverted `CANCELLED: 'WRONG_LABEL'` back to `CANCELLED: 'Cancelada'`.

**Step 4 — GREEN run:** Same command.
- Result: 82 files, 419 tests, 0 failures. Exit code: 0.

**Verification:** File read confirms `'Cancelada'` is restored at line 22.

**Gate T-N5: CONFIRMED (RED-then-GREEN)**

---

### Phase 6 summary

| Gate | Result |
|---|---|
| `db:validate` | GREEN |
| `typecheck` | GREEN |
| API tests | GREEN-665 |
| `lint:strict` (app-new) | GREEN (after test file scope fix) |
| App-new unit tests | GREEN-419 |
| `demo:seed` | GREEN |
| Seeded smoke tests | GREEN-27 |
| Sanity inversion T-N5 | CONFIRMED (RED-then-GREEN) |

**Stage 20.9 ready for PR — all gates GREEN**

---

## TDD Cycle Evidence

Not applicable for Phase 1 (audit-only — no code written).
