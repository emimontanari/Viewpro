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

## Phase 2 — Component test (pending)

Tasks T-4 through T-18. Not started.

## Phase 3 — Use case test additions (pending)

Tasks T-19 through T-21. Not started.

## Phase 4 — Seed additions (pending)

Tasks T-22 through T-27. Not started.

## Phase 5 — Seeded smoke (pending)

Tasks T-28 through T-30. Not started.

## Phase 6 — Verification gates (pending)

Tasks T-N1 through T-N5. Not started.

---

## TDD Cycle Evidence

Not applicable for Phase 1 (audit-only — no code written).
