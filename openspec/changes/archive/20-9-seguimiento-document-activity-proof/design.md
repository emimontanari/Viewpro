# Design — Stage 20.9 Seguimiento Document Activity Proof

**Status:** ready for `sdd-tasks`.
**Phase:** SDD design. Architecture decisions for the test-only proof slice scoped by `spec.md` (13 FRs, 16 scenarios).
**Scope guard:** no production code edits. Only test files, additive seed fixtures, and a seed-summary log line update.

---

## 1. Architecture overview

The slice produces **four artifact buckets**, all additive:

| Bucket | Purpose | File(s) |
|---|---|---|
| Component test | Proves `ActivityDocumentRequestFeedItem` renders correctly for every doc status, every version status, and every fallback path | `apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx` (new) |
| Use case test additions | Proves `ListActivityFeedUseCase` mapper output is correct for all 5 doc statuses and the mixed-kind sort | `apps/api/test/analytics.use-cases.spec.ts` (extended) |
| Seed fixtures | Adds APPROVED doc request to lifecycle coverage; optional CANCELLED gated by audit | `apps/api/scripts/seed-demo.mjs` (additive) |
| Seeded Playwright smoke | Proves the document card renders in production-like data and the `Documentos` pill filter scopes correctly | `apps/app-new/tests/seeded/demo-smoke.spec.ts` (extended) |

The data flow proven by the slice (already exists, this slice only ADDS evidence):

```
Prisma → PrismaDocumentsRepository.listActivityRequests
       → ListActivityFeedUseCase (mapper + merge sort)
       → /api/seguimiento/feed
       → ActivityFeed (kind dispatcher)
       → ActivityDocumentRequestFeedItem
```

Component test covers the leaf; use case test covers the mapper; seed + smoke cover the integrated lane.

---

## 2. Design decisions (ADR-style)

### D1 — CANCELLED seed fixture decision

**Question:** add a CANCELLED doc request to the seed, or document as TODO and rely on component test only?

**Audit performed (this phase):**
- `Document requests:` log line in `seed-demo.mjs:2063` reports `result.documentRequestsCount` directly. Adding 1 more fixture increases the printed count by 1; no hardcoded literal exists.
- No `expectedTotal` in `demo-smoke.spec.ts` is tied to document-request counts. Both `SELLER_SCENARIOS.expectedTotal` values (8, 6) are **property** counts (`assignedProducts.total`), not doc counts.
- No `result.total` literal in `analytics.use-cases.spec.ts` asserts a count tied to seeded doc-request volume. The two `.toBe(1)` and `.toBe(2)` assertions on lines 432/346/293 are scoped to bespoke mocked repositories, not the seed.
- No e2e or unit test asserts `Document requests: N` text from the seed summary.
- Manager-assigned property must own the fixture so seller scenarios under `SELLER_SCENARIOS` are not affected. Use **Villa Centenario** (index 0) for APPROVED and **Los Boulevares** (index 1) for CANCELLED if added — both already host fixtures in `createDemoDocumentReviewStates`.
- The existing Test 8 (`demo owner sees seeded notifications, images and contacts`) asserts on notifications including `Document requested` and `Document rejected`. Adding APPROVED / CANCELLED records does NOT remove those notification rows; the existing assertions use `arrayContaining`, so additive rows are safe.

**Decision: include APPROVED, include CANCELLED.**

- **APPROVED**: required by FR-10 and S-14. Owned by Villa Centenario, requester `sofia.demo@viewpro.local`, reviewer `demo@viewpro.local`, version status `APPROVED`, deterministic filename `escritura-firmada-aprobada-demo.pdf`, anchored at `DEMO_NOW - 4 days`.
- **CANCELLED**: audit shows no breakage risk; cost is ~25 LOC. Owned by Villa Centenario as well (same `propertyAssetOwner` already wired). Requester `martin.demo@viewpro.local`. No version row (cancellation predates upload — matches a realistic workflow). Anchored at `DEMO_NOW - 12 days`.
- Component test for CANCELLED is independent of seed and runs regardless (S-5). Seed coverage gives smoke depth without breaking baselines.

**Rejected alternative:** "seed only APPROVED, document CANCELLED as TODO." Cost reduction is marginal (~25 LOC); audit shows zero collateral risk. The 20.11 lesson is to keep the seed summary log honest, which is trivially satisfied by an additive count.

### D2 — Test-id anchors decision

**Question:** how do component and smoke tests anchor on doc-card structure without coupling to copy?

**Options weighed:**
- (a) Add `data-testid` to status badge, document title, owner, requester, link. Most reliable. **Cost:** introduces test-only attributes in a production component — fails the spec's "no UI component change" preserve list.
- (b) Use `getByRole('link', { name: /Ver propiedad/ })`, `getByRole('img')` for icons, role-based queries for badges where possible. Natural for screen readers, no production-code cost.
- (c) Keep `getByText` with stable short labels (`Aprobada`, `Pendiente`, `Cancelada`) — already in the spec's behavior contract.

**Decision: (b) primary + (c) fallback. Never (a).**

Concrete anchor map:

| Element | Component test query | Smoke query |
|---|---|---|
| "Ver propiedad" CTA | `getByRole('link', { name: /Ver propiedad/ })` | same |
| Doc status badge | `getByText(/^Aprobada$/)` etc. with `{ exact: true }` and `.closest('[class*="border-emerald"]')` for tone | `getByText(/^Aprobada$/)` |
| "Solicitud documental" header badge | `getByText('Solicitud documental')` | same — anchor for smoke's "doc card exists" assertion |
| Document title | scoped under `getByText('Documento solicitado').closest('div')` then `.getByText(documentRequest.title)` | use seeded fixture title (`Escritura firmada aprobada`) |
| Version filename | scoped under `getByText('Estado del archivo').closest('div')` then `.getByText(currentVersion.originalFilename)` | not asserted in smoke (brittle to filename changes) |
| Version status label | scoped under `getByText('Estado del archivo').closest('div')` then `.getByText(/^Subida$/)` | not asserted in smoke |
| Owner display | scoped under `getByText('Propietario').closest('div')` then `.getByText(ownerDisplayName)` | not asserted in smoke (relies on stable seed user names) |
| Requester display | scoped under `getByText('Solicitado por').closest('div')` then `.getByText(requesterDisplayName)` | not asserted in smoke |
| "Sin archivo cargado" fallback | `getByText('Sin archivo cargado')` (label is unique per spec) | n/a |

Rationale: `Solicitud documental` and the status labels (`Aprobada`, `Pendiente`, `Subida`, `Rechazada`, `Cancelada`) are explicit elements of the behavior contract in `spec.md`. They will not change without a spec amendment — they are the contract surface, not incidental copy.

---

## 3. Component-level designs

### 3.1 Component test file

**Path:** `viewpro-app/apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx`

**Runner:** `vitest` + `@testing-library/react`. JSDOM. No Radix Select / Popover interactions (none in this component).

**Imports required:**
- `render`, `screen` from `@testing-library/react`.
- `describe`, `it`, `expect` from `vitest`.
- `ActivityDocumentRequestFeedItem` from `./activity-document-request-feed-item`.
- `ActivityDocumentRequestItem` type from `../api/types`.

**No mock requirements:** the component depends only on:
- `@/components/icons` (static SVG components) — no mock.
- `@/components/ui/badge`, `card`, `button` (pure shadcn primitives, SSR-safe) — no mock.
- `next/link` — works in JSDOM via the default Next config used by other component tests in the workspace. If the workspace lacks a vitest Next stub, the import is `Link` from `next/link` which exposes a normal `<a>` element by default in tests; check existing siblings (e.g. `activity-feed.test.tsx`) for the configured pattern and reuse.
- `getOperationTone`, `getOperationTypeLabel`, `getStatusLabel`, `getStatusTone` from `@/features/products/components/product-tables/columns` — pure functions, no mock.
- `formatDateTime` — pure function, no mock.

**Fixture builder (top of file):**

```ts
function buildDocumentRequestItem(overrides: Partial<...> = {}): ActivityDocumentRequestItem {
  return {
    kind: 'document_request',
    id: 'doc-feed-item-1',
    tenantId: 'tenant-1',
    propertyEngagementId: 'engagement-42',
    documentRequestId: 'doc-request-1',
    createdAt: '2026-06-01T12:00:00.000Z',
    property: {
      title: 'Casa demo',
      engagementId: 'engagement-42',
      // ...other ActivityPropertySummary fields (read from api/types.ts ActivityPropertySummary)
    },
    owner: {
      id: 'owner-1',
      email: 'owner@example.com',
      firstName: 'Juana',
      lastName: 'Perez',
      ownerFirstName: 'Juana',
      ownerLastName: 'Perez',
      accessStatus: 'INVITED',
    },
    requestedBy: { id: 'seller-1', email: 'seller@example.com', firstName: 'Sofía' },
    documentRequest: {
      title: 'DNI del propietario',
      description: 'Frente y dorso.',
      status: 'PENDING',
      currentVersion: {
        id: 'version-1',
        originalFilename: 'dni-frente.pdf',
        status: 'UPLOADED',
        createdAt: '2026-06-01T12:00:00.000Z',
      },
    },
    ...overrides,
  };
}
```

Default values cover the "happy path" (PENDING + UPLOADED version). Each test overrides only the field under test, then asserts on it. This avoids 16 hand-built fixtures and keeps each test ~6–10 lines.

**Test catalogue (16 tests, ~250 LOC total):**

| # | Scenario | Test name | Override | Assertion |
|---|---|---|---|---|
| 1 | S-1 | `renders PENDING status badge with amber tone` | none | badge text "Pendiente" + class contains `bg-amber-50` |
| 2 | S-2 | `renders SUBMITTED status badge with sky tone` | `documentRequest.status: 'SUBMITTED'` | "Subida" + `bg-sky-50` |
| 3 | S-3 | `renders APPROVED status badge with emerald tone` | `documentRequest.status: 'APPROVED'` | "Aprobada" + `bg-emerald-50` |
| 4 | S-4 | `renders REJECTED status badge with red tone` | `documentRequest.status: 'REJECTED'` | "Rechazada" + `bg-red-50` |
| 5 | S-5 | `renders CANCELLED status badge with muted tone` | `documentRequest.status: 'CANCELLED'` | "Cancelada" + class contains `bg-muted/50` |
| 6 | S-6 | `renders PENDING_UPLOAD version label` | `currentVersion.status: 'PENDING_UPLOAD'` | "Pendiente de carga" |
| 7 | S-7 | `renders UPLOADED version label` | default | "Subida" inside the "Estado del archivo" section |
| 8 | S-8 | `renders APPROVED version label` | `currentVersion.status: 'APPROVED'` | "Aprobada" inside the version section |
| 9 | S-9 | `renders REJECTED version label` | `currentVersion.status: 'REJECTED'` | "Rechazada" inside the version section |
| 10 | S-10 | `renders "Sin archivo cargado" when currentVersion is null` | `documentRequest.currentVersion: null` | `getByText('Sin archivo cargado')`; absence of any `*.pdf` filename text |
| 11 | S-11 | `renders fallback strings and correct link target` | `owner: null`, `requestedBy: { firstName: null, email: '' }` | scoped "Propietario" fallback + "Solicitante no disponible" + link `href === '/dashboard/product/engagement-42'` |
| 12 | new (no-document-request edge) | `renders "Solicitud no disponible" when documentRequest is null/undefined` | `documentRequest` cast as undefined via type assertion | badge `'Solicitud no disponible'` |
| 13 | new (no property title) | `renders "Propiedad sin título" when property.title is blank` | `property.title: ''` | `getByText('Propiedad sin título')` |
| 14 | new (uses ownerFirstName/Last snapshot) | `prefers owner snapshot names over user names` | owner with snapshot present + linked-user names different | renders snapshot |
| 15 | new (uses user firstName fallback) | `falls back to user name when owner snapshot is blank` | owner with blank snapshot + linked-user firstName set | renders user firstName |
| 16 | new (email fallback) | `falls back to owner email when both names are blank` | owner with blank snapshot + null/blank user names + email set | renders email |

S-6 through S-9 share the same "scope under 'Estado del archivo' section" anchor.

#### Verifying tone classes

Spec requires the badge to carry tone classes. Use the unique label text to find the badge element, then assert on its className:

```ts
const badge = screen.getByText('Aprobada');
expect(badge.className).toMatch(/bg-emerald-50/);
```

The badge's `<Badge>` primitive (shadcn) renders a `<div>` whose text is the label; `screen.getByText('Aprobada')` returns that element directly. No `closest()` needed.

For CANCELLED the tone is `bg-muted/50` — assert with a regex `/bg-muted\/50/` (escape forward slash if needed: `/bg-muted\\/50/`).

#### Link href assertion (S-11, FR-6)

```ts
const link = screen.getByRole('link', { name: /Ver propiedad/ });
expect(link).toHaveAttribute('href', '/dashboard/product/engagement-42');
```

This works because Next.js `Link` renders a real `<a>` in JSDOM.

### 3.2 Use case test additions

**Path:** `viewpro-app/apps/api/test/analytics.use-cases.spec.ts`

**Reuse the existing PENDING fixture pattern at line 369.** Add 4 new tests (or one parameterized test with `it.each`) covering SUBMITTED, APPROVED, REJECTED, CANCELLED. The mapper produces an `ActivityDocumentRequestItem` with `documentRequest.status` and `currentVersion.status` derived from the source Prisma row.

**Fixture variants (~30 LOC each, ~150 LOC total):**

For each status:
- Base on the existing PENDING fixture (line 369–403).
- Override `status` and add a `document` + `documents` relation if the status implies an uploaded version:
  - SUBMITTED → `document` present with `currentVersion.status = 'UPLOADED'`
  - APPROVED → `document` present with `currentVersion.status = 'APPROVED'` and `reviewedByUserId`, `reviewedAt` set
  - REJECTED → `document` present with `currentVersion.status = 'REJECTED'` and `rejectionReason` set
  - CANCELLED → `document` null (no version)
- Assertion shape:

```ts
expect(result.items[0]).toMatchObject({
  kind: 'document_request',
  documentRequest: {
    status: expectedDocStatus,
    currentVersion: expectedVersion === null ? null : expect.objectContaining({ status: expectedVersionStatus }),
  },
});
```

Use `it.each([['SUBMITTED', 'UPLOADED'], ['APPROVED', 'APPROVED'], ['REJECTED', 'REJECTED'], ['CANCELLED', null]])` to parameterize; existing PENDING test stays standalone to keep the diff minimal.

**Mixed-kind sort test (S-13, FR-9):**

Add one test in the existing `describe('ListActivityFeedUseCase', ...)` block:
- Mock movements repository to return one movement at `2026-05-22T11:30:00Z`.
- Mock documents repository to return one doc request at `2026-05-22T11:00:00Z` and another at `2026-05-22T12:00:00Z`.
- Call `execute` with `kind: 'all'`.
- Assert `result.items[0].createdAt === '2026-05-22T12:00:00Z'` (doc), `result.items[1].createdAt === '2026-05-22T11:30:00Z'` (movement), `result.items[2].createdAt === '2026-05-22T11:00:00Z'` (doc).

Tie-break by id descending: add 2 items with identical `createdAt` but distinct IDs (`'a-id'` and `'z-id'`); assert `z-id` sorts before `a-id`. Read `ListActivityFeedUseCase` source to confirm the tiebreak rule before writing the assertion — if the implementation uses ascending id tiebreak, follow that and update spec FR-9 in a separate slice (out of scope here).

### 3.3 Seed additions

**Path:** `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Location:** inside `createDemoDocumentReviewStates`, after the existing Villa Centenario fixtures array (line ~1455), before the Boulevares SUBMITTED block (line ~1517).

**APPROVED fixture (~25 LOC):**

```js
{
  title: 'Boleto de compra-venta aprobado',
  description: 'Documento demo aprobado por el manager para Stage 20.9 coverage.',
  status: DocumentRequestStatus.APPROVED,
  versionStatus: DocumentVersionStatus.APPROVED,
  originalFilename: 'boleto-compraventa-aprobado-demo.pdf',
  body: Buffer.from('%PDF-1.4\n% ViewPro stage 20.9 approved fixture\n', 'utf8'),
  createdAt: daysAgo(4),
  uploadedAt: daysAgo(3),
  reviewedAt: daysAgo(2),
},
```

Add to the existing `fixtures` array on Villa Centenario. The loop already handles uploaded + reviewed timestamps (line 1474 `reviewedAt`). The `reviewedByUserId` is set when status is REJECTED (line 1470); extend the conditional to also set it for APPROVED:

```diff
- reviewedByUserId: fixture.status === DocumentRequestStatus.REJECTED ? reviewer.id : null,
+ reviewedByUserId:
+   fixture.status === DocumentRequestStatus.REJECTED ||
+   fixture.status === DocumentRequestStatus.APPROVED
+     ? reviewer.id
+     : null,
```

**CANCELLED fixture (~25 LOC):**

Add as a SEPARATE block after the fixtures loop because there is no version row:

```js
// Stage 20.9 — CANCELLED fixture on Villa Centenario for lifecycle coverage.
const cancelledRequest = await client.documentRequest.create({
  data: {
    tenantId: tenant.id,
    propertyEngagementId: property.engagement.id,
    propertyAssetOwnerId: property.owner.id,
    ownerUserId: owner.id,
    requestedByUserId: users.get('martin.demo@viewpro.local').id,
    title: 'Plano municipal (solicitud cancelada)',
    description: 'Documento demo cancelado antes de la carga (Stage 20.9 coverage).',
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

**Summary log update (line 2063):**

```diff
- console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares)`);
+ console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)`);
```

**Pre-mutation audit (already performed in D1):** no count literal needs updating.

### 3.4 Seeded smoke additions

**Path:** `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Structure:** new `test.describe('Seguimiento document activity (Stage 20.9)', ...)` block at the end of the file (after the isolation block). `test.describe.configure({ mode: 'serial' })` to match the rest of the suite.

**Test 1 (S-15, FR-12) — `seeded smoke: doc card renders with stable structure`:**

```ts
test('seeded smoke: doc card renders with stable structure (S-15)', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/seguimiento');
  await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();

  // Apply Documentos pill so we are guaranteed a doc card on the first page.
  await page.getByRole('button', { name: 'Documentos' }).click();
  await page.waitForTimeout(600);

  // At least one doc card must render with the header badge.
  const docCard = page.locator('article, [class*="Card"]').filter({
    has: page.getByText('Solicitud documental', { exact: true })
  }).first();
  await expect(docCard).toBeVisible({ timeout: 10_000 });

  // At least one of the lifecycle status labels must appear.
  await expect(
    docCard.getByText(/^(Pendiente|Subida|Aprobada|Rechazada|Cancelada)$/).first()
  ).toBeVisible();

  // "Ver propiedad" link points to /dashboard/product/<engagementId>.
  const verPropiedadLink = docCard.getByRole('link', { name: /Ver propiedad/ });
  await expect(verPropiedadLink).toBeVisible();
  const href = await verPropiedadLink.getAttribute('href');
  expect(href).toMatch(/^\/dashboard\/product\/[a-f0-9-]+$/);
});
```

**Test 2 (S-16, FR-13) — `seeded smoke: Documentos filter shows only doc cards`:**

```ts
test('seeded smoke: Documentos filter shows only doc cards (S-16)', async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  await page.goto('/dashboard/seguimiento');
  await expect(page.getByRole('heading', { name: 'Seguimiento' })).toBeVisible();

  await page.getByRole('button', { name: 'Documentos' }).click();
  await page.waitForTimeout(600);

  // Every visible card must carry the doc-card header badge.
  const allHeaderBadges = page.locator('article, [class*="Card"]').locator('text=Solicitud documental');
  const docBadgeCount = await allHeaderBadges.count();
  expect(docBadgeCount).toBeGreaterThan(0);

  // No movement-only label may be visible — assert that movement outcome chip
  // texts seeded by the demo do not appear in the filtered list.
  // Spec uses 'Solicitud documental' as the differentiator; assert that
  // common movement-only strings ('Consulta', 'Visita', 'Oferta') are absent.
  // These come from the existing seeded movements but never from doc cards.
  await expect(page.getByText('Ingresó una consulta calificada')).toHaveCount(0);
});
```

Total ~80 LOC for 2 tests.

---

## 4. Stable element anchors table

Consolidated reference for the apply phase.

| Doc-card element | Anchor strategy | Query |
|---|---|---|
| Doc card header badge | text-stable | `getByText('Solicitud documental', { exact: true })` |
| Doc status badge | text + class regex | `getByText(/^Aprobada$/)` then assert `className` matches `/bg-emerald-50/` |
| Property operation badge | inherited tone class | not asserted (would require inverse coupling to columns.tsx) |
| Property engagement-status badge | inherited tone class | not asserted |
| Property title (h3) | text via fixture | `getByText(fixture.property.title)` or `getByRole('heading', { level: 3 })` |
| "Documento solicitado" section header | text-stable, used as scope anchor | `getByText('Documento solicitado')` then `.closest('div')` |
| Document request title | scoped inside section | `within(documentSection).getByText(documentRequest.title)` |
| "Estado del archivo" section header | text-stable, used as scope anchor | `getByText('Estado del archivo')` then `.closest('div')` |
| Version filename | scoped inside section | `within(versionSection).getByText(currentVersion.originalFilename)` |
| Version status label | scoped inside section, regex | `within(versionSection).getByText(/^(Aprobada|Subida|Rechazada|Pendiente de carga)$/)` |
| "Sin archivo cargado" fallback | text-stable | `getByText('Sin archivo cargado')` |
| "Propietario" meta label | text-stable, used as scope anchor for owner value | `getByText('Propietario')` |
| "Solicitado por" meta label | text-stable, used as scope anchor for requester value | `getByText('Solicitado por')` |
| "Solicitante no disponible" fallback | text-stable | `getByText('Solicitante no disponible')` |
| "Ver propiedad" CTA | role + accessible name | `getByRole('link', { name: /Ver propiedad/ })` |
| Time element | role | `getByRole('time')` if needed |

Rule: never use `getByText` for any string that is not in the spec's behavior contract.

---

## 5. Fallback path component-test fixture shapes

Explicit per-test overrides for the fallback tests so the apply phase does not guess shape:

| Test | Override |
|---|---|
| No `documentRequest` (test 12) | `{ documentRequest: undefined as never as ActivityDocumentRequestItem['documentRequest'] }` (or cast through `unknown`) |
| No `currentVersion` (S-10) | `{ documentRequest: { ...defaults, currentVersion: null } }` |
| Blank `property.title` (test 13) | `{ property: { ...defaults, title: '   ' } }` (whitespace triggers `.trim() \|\| fallback`) |
| Null `owner` (S-11) | `{ owner: null }` |
| Requester with no firstName + no email (S-11) | `{ requestedBy: { id: 'r-1', firstName: null, email: '' } as never }` |
| Owner snapshot preferred (test 14) | `owner: { ownerFirstName: 'Snap', ownerLastName: 'Name', firstName: 'User', lastName: 'Name', ... }` → asserts on `"Snap Name"` |
| Owner user-name fallback (test 15) | `owner: { ownerFirstName: '', ownerLastName: '', firstName: 'User', lastName: 'Name', ... }` → asserts on `"User Name"` |
| Owner email fallback (test 16) | `owner: { ownerFirstName: '', ownerLastName: '', firstName: null, lastName: null, email: 'fb@x.io', ... }` → asserts on `"fb@x.io"` |

---

## 6. Test catalogue (master table)

| Scenario | File | Test name | Fixture | Duration target |
|---|---|---|---|---|
| S-1 | `activity-document-request-feed-item.test.tsx` | renders PENDING status badge with amber tone | default | <50ms |
| S-2 | same | renders SUBMITTED status badge with sky tone | `status: 'SUBMITTED'` | <50ms |
| S-3 | same | renders APPROVED status badge with emerald tone | `status: 'APPROVED'` | <50ms |
| S-4 | same | renders REJECTED status badge with red tone | `status: 'REJECTED'` | <50ms |
| S-5 | same | renders CANCELLED status badge with muted tone | `status: 'CANCELLED'` | <50ms |
| S-6 | same | renders PENDING_UPLOAD version label | `currentVersion.status: 'PENDING_UPLOAD'` | <50ms |
| S-7 | same | renders UPLOADED version label | default | <50ms |
| S-8 | same | renders APPROVED version label | `currentVersion.status: 'APPROVED'` | <50ms |
| S-9 | same | renders REJECTED version label | `currentVersion.status: 'REJECTED'` | <50ms |
| S-10 | same | renders "Sin archivo cargado" when currentVersion is null | `currentVersion: null` | <50ms |
| S-11 | same | renders fallback strings and correct link target | null owner + blank requester | <50ms |
| (12–16) | same | edge fallback variants (5 extra) | varied | <50ms each |
| S-12 | `analytics.use-cases.spec.ts` | maps document_request items for all 5 doc statuses (`it.each`) | 4 new fixtures + reuse PENDING | <150ms |
| S-13 | same | mixed-kind feed sorts by createdAt desc with id tiebreak | 1 movement + 2 docs | <100ms |
| S-14 | (verified via S-15 smoke) | — | seed fixtures | n/a |
| S-15 | `demo-smoke.spec.ts` | seeded smoke: doc card renders with stable structure | seeded APPROVED on Villa Centenario | ~6s |
| S-16 | `demo-smoke.spec.ts` | seeded smoke: Documentos filter shows only doc cards | same | ~6s |

---

## 7. Spec deltas required

**None.** The spec phase produced complete FRs and scenarios. The component test file adds 5 edge tests beyond the 11 spec scenarios; these are additive coverage tightly aligned to FR-5 (`fallback strings`) and the existing behavior contract. They do not require new FRs because they prove paths already covered by FR-5 with finer granularity.

If apply phase discovers that `ListActivityFeedUseCase` does NOT have an id-desc tiebreak, that's an implementation discovery — flag it as a verify-phase finding and leave FR-9 as the desired contract.

---

## 8. Non-goals (inherited from proposal §"Out of scope")

- Refactoring `ActivityDocumentRequestFeedItem` or `ActivityFeed`.
- Changing the document repository, use case, or DTO contract.
- Adding new filter dimensions, sort options, or pagination behavior.
- Re-designing the document panel on the property detail page.
- Document storage, signed URLs, or upload workflow.
- Any change to the 26.2 seed contract beyond the additive APPROVED/CANCELLED fixtures.
- Per-tenant configuration of document types or taxonomies (that's 20.12).

---

## 9. Rollout & rollback

**Rollout:** single PR, ~530 LOC. The slice is cohesive — splitting component-test from seed from smoke would create three PRs each with weak standalone value (component test passes without seed, but smoke test depends on seed, and use-case test is fully independent). Single PR with `size:exception` is correct for this proof slice.

Sequence within the PR (apply phase order):
1. Component test file (no dependencies).
2. Use case test additions (no dependencies).
3. Seed additions (APPROVED + CANCELLED + log update).
4. Seeded smoke additions (depends on seed; run `pnpm demo:seed` locally before running smoke).

**Rollback:**
- Delete `activity-document-request-feed-item.test.tsx`.
- Revert the `it.each` block and mixed-kind sort test in `analytics.use-cases.spec.ts`.
- Revert the APPROVED fixture entry, the `reviewedByUserId` conditional extension, the CANCELLED block, and the summary-log line in `seed-demo.mjs`.
- Revert the Stage 20.9 `describe` block in `demo-smoke.spec.ts`.

All pre-existing baselines (671 API tests + 403 app-new unit tests + 25/25 seeded smoke) remain intact post-rollback because the change is purely additive.

---

## 10. Risks (handoff to sdd-tasks)

| Risk | Severity | Mitigation |
|---|---|---|
| `next/link` rendering in JSDOM might require a vitest config tweak | low | Check existing sibling tests (`activity-feed.test.tsx`, `activity-filters.test.tsx`) for the configured pattern; reuse exactly. If none exists, fallback to mocking `next/link` to a passthrough `<a>` at the top of the test file. |
| Tie-break order in `ListActivityFeedUseCase` may differ from FR-9 | low | Read the use-case source in T-1 of apply phase. If different, scope to current behavior and surface as a verify finding. |
| Seed mutation summary-log accuracy (R-D3 from 20.11) | low | Audit performed in §D1; no count assertion depends on doc-request total. Update log atomically with fixture additions. |
| Smoke test brittleness around the `Documentos` pill label | low | Anchor uses `getByRole('button', { name: 'Documentos' })`. The label is in the behavior contract via `ActivityFilters` constant (`activity-filters.tsx:27`). |
| `propietario.demo` not linked to Villa Centenario for CANCELLED owner reference | low | The CANCELLED fixture reuses `property.owner.id` (the primary `propertyAssetOwner`) and `owner.id` (the linked user via `users.get(DEMO_OWNER_EMAIL)`) — same pattern as the existing fixtures on Villa Centenario. |
| Owner-portal Test 5 (`demo owner can read the owner portal follow-up`) might see new doc activity strings | low | Test 5 asserts on movement strings (`Ingresó una consulta calificada\|Se concretó una visita\|Oferta`) via `arrayContaining`-equivalent regex. Adding doc-request rows does not break it. |

---

## 11. Estimation

| Bucket | Approximate LOC |
|---|---|
| Component test (16 tests + fixture builder + imports) | ~250 |
| Use case test additions (it.each + sort test) | ~150 |
| Seed additions (APPROVED + CANCELLED + log + conditional fix) | ~50 |
| Seeded smoke (2 tests + describe block) | ~80 |
| **Total** | **~530** |

Over the 400-line soft budget. Single PR with `size:exception` recommended because the slice is cohesive proof — splitting weakens standalone value of each PR and inflates review overhead.
