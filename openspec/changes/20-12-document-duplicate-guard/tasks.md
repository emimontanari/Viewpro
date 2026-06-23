# Tasks — Stage 20.12 Document Duplicate Guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~283 (design D5 breakdown: taxonomy module ~45, taxonomy spec ~70, repo port ~20, prisma impl ~40, use-case wiring ~18, e2e extension ~90) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (~283 LOC < 400; no security-boundary file; standard pre-PR readability review) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Notes |
|------|------|-------|
| 1 — Pre-impl audit | Confirm grounding facts from design before touching any file | Mandatory gate; blocks ALL implementation |
| 2 — Taxonomy unit tests (FAILING) | Write `document-taxonomy.spec.ts` covering every canonical row and all T2 edge cases | RED first; pure vitest, no DB |
| 3 — Taxonomy module implementation | Create `document-taxonomy.ts` to make all unit tests GREEN | Depends on unit 2 fully red |
| 4 — Repository port method | Add `runCreateWithDuplicateGuard` to port + Prisma impl (lock + fetch + resolve + insert in `$transaction`) | Depends on unit 3 green |
| 5 — Use-case wiring | Thread `resolveCanonicalType` + guarded path into `create-document-request.use-case.ts`; map `DuplicateApprovedDocumentError` → `ConflictException` | Depends on unit 4 |
| 6 — API integration tests | Extend `documents.e2e-spec.ts` with 18 spec scenarios; write FAILING first, then verify GREEN after units 4–5 | Depends on unit 5 |
| 7 — Frontend 409 surfacing | Verify existing `onError` toast in `property-document-requests.tsx` surfaces the 409 message correctly; add/update FE test if needed | Depends on unit 5; likely read-only confirm |
| 8 — Regression coverage | Confirm R2-a (review flow) and R3-a (seller visibility) via targeted test assertions | Depends on unit 6 |
| 9 — Verification gates | All suites green, typecheck clean, oxlint clean | Final gate before PR |

---

## Phase 1 — Pre-implementation audit

Run ALL commands before writing any code. Paste verbatim output into the apply-progress audit section.
**Any unexpected result blocks apply.**

- [x] 1.1 **(A1 — create use-case slot)** `rg -n "findTenantEngagementForDocumentRequest|createRequest|ConflictException" viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts`
      Expected: `findTenantEngagementForDocumentRequest` at :38; `createRequest` at :49 (the guard slots between these two). No existing `ConflictException` import (this slice adds it). If `createRequest` is ALREADY inside a transaction, record for D3 implementation note.

- [x] 1.2 **(A2 — repository port shape)** `rg -n "runCreateWithDuplicateGuard|findApprovedRequestTitles|DocumentsRepository" viewpro-app/apps/api/src/documents/documents.repository.ts`
      Expected: `runCreateWithDuplicateGuard` NOT yet present (slice will add it). `DocumentsRepository` type is the interface the new method will be added to. Record exact line where `createRequest` is declared (expected ~:154).

- [x] 1.3 **(A3 — Prisma impl baseline)** `rg -n "createRequest|lockTenantRow|\\\$transaction|FOR UPDATE|documentRequestInclude" viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
      Expected: `createRequest` as a bare `prisma.documentRequest.create` (~:187). `lockTenantRow` pattern with raw `FOR UPDATE` (~:59-65). `$transaction` usages at `createPendingVersion` and `markVersionUploaded`. `documentRequestInclude` is the include shape to reuse in the new method. Record actual line numbers.

- [x] 1.4 **(A4 — DuplicateApprovedDocumentError pattern)** `rg -n "DuplicateApprovedDocumentError\|ConflictException\|errorCode.*DUPLICATE\|create-status-change-request" viewpro-app/apps/api/src/status-change-requests/use-cases/create-status-change-request.use-case.ts`
      Expected: `ConflictException` imported from `@nestjs/common`; `{ errorCode: '...', message: '...' }` payload shape at ~:130. This is the exact mirror convention for D4. Record the `errorCode` string used.

- [x] 1.5 **(A5 — DocumentRequestStatus enum)** `rg -n "DocumentRequestStatus|APPROVED|PENDING|SUBMITTED|REJECTED|CANCELLED" viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
      Expected: `DocumentRequestStatus` imported from `@prisma/client`; all five statuses present. Confirm `APPROVED` is used as a filter value (not a string literal) for the guard query.

- [x] 1.6 **(A6 — FE mutation error handling)** `rg -n "onError|toast\.error|parseJsonResponse|getErrorMessage" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx viewpro-app/apps/app-new/src/features/products/api/service.ts`
      Expected: `createDocumentRequestMutation.onError` in `property-document-requests.tsx` calls `toast.error(error instanceof Error ? error.message : ...)` (~:151-153). `parseJsonResponse` in `service.ts` calls `getErrorMessage(body, ...)` which extracts `body.message` for any non-ok status. This means the 409's `message` field surfaces automatically — NO new FE code required for basic error display. Record this finding explicitly in apply-progress.

- [x] 1.7 **(A7 — existing e2e spec helpers)** `rg -n "registerTenantSession\|createEngagement\|grantOwnerAccess\|DocumentRequestStatus" viewpro-app/apps/api/test/documents.e2e-spec.ts`
      Expected: helper functions (`registerTenantSession`, `createEngagement`, `grantOwnerAccess`, etc.) defined in the file's bottom section. Confirm these are available for reuse in the new guard test cases. Record the helper signatures.

- [x] 1.8 **(A8 — seed smoke relevance)** `rg -n "document-request\|DocumentRequest\|createRequest\|APPROVED" viewpro-app/scripts/seed-demo.mjs`
      Expected: determine whether the seed script creates any document requests with `APPROVED` status. If YES — a seeded APPROVED row exists and the guard must not break the seed. If NO — no seed change required. Record finding.

- [x] 1.9 **(A9 — property-document-requests test file)** `rg -n "createDocumentRequest\|DOCUMENT_DUPLICATE\|ConflictException\|toast" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`
      Expected: existing test file covers success and generic error toasts for the create mutation. Confirm no existing test hardcodes the "No se pudo solicitar el documento" fallback string for a 409 scenario. Record test structure so Phase 7 can extend minimally.

---

## Phase 2 — Taxonomy module unit tests (FAILING first — TDD RED)

Depends on: Phase 1 complete, no blockers.
**Tests MUST be written and verified RED before Phase 3 creates the implementation.**

File to create: `viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.spec.ts`

This is a pure vitest spec — no DB, no NestJS context. Mirror the structure of `src/status-change-requests/helpers/is-partial-unique-violation.spec.ts`.

### 2a — Taxonomy resolver: canonical row coverage (T1-a, one test per row)

Write one `it` per canonical key verifying that at least one listed synonym resolves to that key. Use the exact synonym strings from the spec T1 table. Each test must be RED until Phase 3 creates the module.

- [x] 2.1 **`escritura` row** — `resolveCanonicalType('escritura')` → `'escritura'`; `resolveCanonicalType('escritura firmada')` → `'escritura'`; `resolveCanonicalType('titulo')` → `'escritura'`; `resolveCanonicalType('titulo de propiedad')` → `'escritura'`. (T1-a: exact synonym match.)

- [x] 2.2 **`dni` row** — `resolveCanonicalType('dni')` → `'dni'`; `resolveCanonicalType('documento de identidad')` → `'dni'`; `resolveCanonicalType('dni del propietario')` → `'dni'`; `resolveCanonicalType('cedula')` → `'dni'`. (Note: synonyms stored pre-normalized — no diacritics.)

- [x] 2.3 **`plano` row** — `resolveCanonicalType('plano')` → `'plano'`; `resolveCanonicalType('plano municipal')` → `'plano'`; `resolveCanonicalType('plano de mensura')` → `'plano'`; `resolveCanonicalType('planos')` → `'plano'`.

- [x] 2.4 **`impuesto_municipal` row** — `resolveCanonicalType('impuesto municipal')` → `'impuesto_municipal'`; `resolveCanonicalType('abl')` → `'impuesto_municipal'`; `resolveCanonicalType('tasa municipal')` → `'impuesto_municipal'`; `resolveCanonicalType('impuesto inmobiliario')` → `'impuesto_municipal'`.

- [x] 2.5 **`reglamento_copropiedad` row** — `resolveCanonicalType('reglamento')` → `'reglamento_copropiedad'`; `resolveCanonicalType('reglamento de copropiedad')` → `'reglamento_copropiedad'`; `resolveCanonicalType('propiedad horizontal')` → `'reglamento_copropiedad'`.

- [x] 2.6 **`expensas` row** — `resolveCanonicalType('expensas')` → `'expensas'`; `resolveCanonicalType('estado de expensas')` → `'expensas'`; `resolveCanonicalType('libre deuda de expensas')` → `'expensas'`.

- [x] 2.7 **`boleto_compraventa` row** — `resolveCanonicalType('boleto')` → `'boleto_compraventa'`; `resolveCanonicalType('boleto de compraventa')` → `'boleto_compraventa'`; `resolveCanonicalType('boleto de compra-venta')` → `'boleto_compraventa'`.

- [x] 2.8 **`constancia_servicios` row** — `resolveCanonicalType('servicios')` → `'constancia_servicios'`; `resolveCanonicalType('comprobante de servicios')` → `'constancia_servicios'`; `resolveCanonicalType('constancia de servicios')` → `'constancia_servicios'`.

- [x] 2.9 **`informe_dominio` row** — `resolveCanonicalType('informe de dominio')` → `'informe_dominio'`; `resolveCanonicalType('dominio')` → `'informe_dominio'`.

- [x] 2.10 **`otro` fallback (T1-b)** — `resolveCanonicalType('factura de luz')` → `'otro'`; `resolveCanonicalType('')` → `'otro'`; `resolveCanonicalType('algo completamente diferente')` → `'otro'`.

### 2b — Normalization edge cases (T2-a through T2-f)

- [x] 2.11 **T2-a: case-insensitive** — `resolveCanonicalType('Escritura')` → `'escritura'`. Input has mixed case; must normalize before lookup.

- [x] 2.12 **T2-b: accent-insensitive** — `resolveCanonicalType('título de propiedad')` → `'escritura'`. Accented `í` must be stripped via NFD + diacritic strip.

- [x] 2.13 **T2-c: whitespace trimmed** — `resolveCanonicalType('  DNI del propietario  ')` → `'dni'`. Leading and trailing whitespace must be trimmed before lookup.

- [x] 2.14 **T2-d: accent + case combined** — `resolveCanonicalType('TÍTULO')` → `'escritura'`. Uppercase AND accented.

- [x] 2.15 **T2-e: `cédula` → `dni`** — `resolveCanonicalType('Cédula')` → `'dni'`. Capital C + accented é.

- [x] 2.16 **T2-f: `planos` → `plano`** — `resolveCanonicalType('Planos')` → `'plano'`. Capital P.

### 2c — `otro` bypass edge cases (G3-b)

- [x] 2.17 **G3-b: typo not matched** — `resolveCanonicalType('escrituraa')` → `'otro'`. One extra character — not a synonym of any canonical type.

- [x] 2.18 **G3-b: substring not matched** — `resolveCanonicalType('escritura de 1980')` → `'otro'`. Partial match is NOT in scope (A3 per spec).

### 2d — `normalizeDocumentTitle` unit tests (direct function coverage)

- [x] 2.19 **NFD + diacritic strip** — `normalizeDocumentTitle('título')` → `'titulo'`; `normalizeDocumentTitle('cédula')` → `'cedula'`.

- [x] 2.20 **Lowercase** — `normalizeDocumentTitle('ESCRITURA')` → `'escritura'`.

- [x] 2.21 **Trim** — `normalizeDocumentTitle('  dni  ')` → `'dni'`.

- [x] 2.22 **Combined** — `normalizeDocumentTitle('  TÍTULO DE PROPIEDAD  ')` → `'titulo de propiedad'`.

### 2e — Red-confirm gate

- [x] 2.23 Run `pnpm --filter @viewpro/api test document-taxonomy` — confirm ALL tests from tasks 2.1–2.22 are **RED** (import/module-not-found errors count as red; runtime assertion failures are also acceptable; fix any scaffolding issues before Phase 3).

---

## Phase 3 — Taxonomy module implementation

Depends on: Phase 2 complete (all tests red, no scaffolding errors).

File to create: `viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.ts`

- [x] 3.1 **Define `CanonicalDocumentType`** — export the union type with all 9 named keys plus `'otro'`, exactly matching the spec T1 table:
      `'escritura' | 'dni' | 'plano' | 'impuesto_municipal' | 'reglamento_copropiedad' | 'expensas' | 'boleto_compraventa' | 'constancia_servicios' | 'informe_dominio' | 'otro'`

- [x] 3.2 **Define `SYNONYMS` table** — a `Record<Exclude<CanonicalDocumentType, 'otro'>, readonly string[]>` where every synonym string is stored PRE-NORMALIZED (already lowercase, diacritics stripped). Domain data values stay in Spanish (e.g., `'cedula'`, `'titulo de propiedad'`). Use the exact synonym lists from spec T1.

- [x] 3.3 **Export `normalizeDocumentTitle(value: string): string`** — applies: (1) `value.normalize('NFD')`, (2) `.replace(/[̀-ͯ]/g, '')` (diacritic strip), (3) `.toLowerCase()`, (4) `.trim()`. Pure function — no I/O.

- [x] 3.4 **Export `resolveCanonicalType(title: string): CanonicalDocumentType`** — normalizes the input, iterates `Object.entries(SYNONYMS)`, returns the key whose synonym array `includes` the normalized value. Falls through to `'otro'` when no match is found.

- [x] 3.5 Run `pnpm --filter @viewpro/api test document-taxonomy` — ALL 22 tests from Phase 2 MUST be **GREEN**. Any red is a bug; do not proceed to Phase 4.

- [x] 3.6 Run `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors in `document-taxonomy.ts`.

---

## Phase 4 — Repository port + Prisma implementation

Depends on: Phase 3 green (taxonomy module proven).

### 4a — Domain sentinel error

File: `viewpro-app/apps/api/src/documents/documents.repository.ts`

- [x] 4.1 **Add `DuplicateApprovedDocumentError`** — export a plain Error subclass (or a tagged object class) that signals a duplicate-approved collision. Mirrors the in-repo error sentinel pattern. Name it `DuplicateApprovedDocumentError`. No NestJS dependency — this is a domain error, not an HTTP exception.

### 4b — Port method

File: `viewpro-app/apps/api/src/documents/documents.repository.ts`

- [x] 4.2 **Add `RunCreateWithDuplicateGuardInput` type** — `CreateDocumentRequestInput & { canonicalKey: CanonicalDocumentType }`. Import `CanonicalDocumentType` from `./taxonomy/document-taxonomy`.

- [x] 4.3 **Add `runCreateWithDuplicateGuard(input: RunCreateWithDuplicateGuardInput): Promise<DocumentRequestRecord>`** to the `DocumentsRepository` type. Documents that this method: (1) locks the engagement row, (2) fetches APPROVED titles, (3) resolves each via `resolveCanonicalType`, (4) throws `DuplicateApprovedDocumentError` on collision, (5) inserts and returns the new `DocumentRequest` on no collision. The lock + read + write MUST be inside a single `$transaction`.

### 4c — Prisma implementation

File: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`

- [x] 4.4 **Implement `runCreateWithDuplicateGuard`** inside a `prisma.$transaction` callback:
      1. `SELECT id FROM property_engagements WHERE id = ${engagementId} FOR UPDATE` — raw query, mirroring `lockTenantRow` pattern at ~:59-65.
      2. `prisma.documentRequest.findMany({ where: { propertyEngagementId: input.propertyEngagementId, status: DocumentRequestStatus.APPROVED }, select: { title: true } })` — fetch only `title` to minimize data transfer.
      3. Iterate fetched titles: `resolveCanonicalType(t.title) === input.canonicalKey` for any → throw `DuplicateApprovedDocumentError`.
      4. `prisma.documentRequest.create({ data: { ...}, include: documentRequestInclude })` — reuse the same `documentRequestInclude` shape already used by `createRequest`. Status is `PENDING` (Prisma default per schema).
      5. Return the created record.

- [x] 4.5 Confirm the raw `FOR UPDATE` query uses the correct Prisma raw API (either `prisma.$queryRaw` or `prisma.$executeRaw`) consistent with the `lockTenantRow` pattern found in audit 1.3. Use the exact same approach.

- [x] 4.6 Run `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors in both repository files.

---

## Phase 5 — Use-case wiring

Depends on: Phase 4 complete (repository implementation compiles and typechecks).

File: `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts`

- [x] 5.1 **Import `resolveCanonicalType`** from `../taxonomy/document-taxonomy`. Import `ConflictException` from `@nestjs/common` (add to existing import). Import `DuplicateApprovedDocumentError` from `../documents.repository`.

- [x] 5.2 **Resolve canonical key after engagement load** — immediately after `engagement` is confirmed not null (line :47 in the current source), add:
      ```ts
      const canonicalKey = resolveCanonicalType(input.title);
      ```

- [x] 5.3 **Branch on `otro`** — if `canonicalKey === 'otro'`, proceed with the existing `this.documentsRepository.createRequest(...)` call unchanged (G3 bypass). This preserves all free-text behavior (R1).

- [x] 5.4 **Call guarded path for canonical types** — if `canonicalKey !== 'otro'`, call `this.documentsRepository.runCreateWithDuplicateGuard({ ...createInput, canonicalKey })` instead of `createRequest`.

- [x] 5.5 **Map `DuplicateApprovedDocumentError` → `ConflictException`** — wrap the `runCreateWithDuplicateGuard` call in a try/catch. On `DuplicateApprovedDocumentError`, throw:
      ```ts
      throw new ConflictException({
        errorCode: 'DOCUMENT_DUPLICATE_APPROVED',
        message: 'An approved document of this type already exists for this property.',
      });
      ```
      All other errors propagate normally.

- [x] 5.6 Run `pnpm --filter @viewpro/api typecheck` — zero errors in the use-case file.

---

## Phase 6 — API integration tests (FAILING first, then GREEN)

Depends on: Phase 5 complete (use-case wiring compiles).

**Write all new test cases FIRST (RED), then verify they turn GREEN after Phase 5 is wired in. Do NOT skip the red step.**

File: `viewpro-app/apps/api/test/documents.e2e-spec.ts`
Action: EXTEND the existing `describe` block. Reuse existing helper functions (`registerTenantSession`, `createEngagement`, `grantOwnerAccess`, etc.) from the file's bottom section (confirmed in audit 1.7). Do NOT create a new spec file.

### 6a — Write new failing tests (RED phase)

- [x] 6.1 Run existing suite baseline BEFORE adding any new tests: `pnpm --filter @viewpro/api test documents.e2e` — all existing cases GREEN. Record count.

Write each test as RED first (implement test body; confirm it fails before Phase 5 wiring makes it green):

**G1-a: APPROVED conflict — creation blocked (409)**

- [x] 6.2 `it('rejects creation when an APPROVED request of the same canonical type already exists on the engagement')`:
      Seed manager + owner + engagement. Create a document request with title `'Escritura'`, advance its status to `APPROVED` (via the review path). Attempt to create a new request with title `'escritura firmada'` (same canonical type). Assert HTTP 409. Assert `response.body.errorCode === 'DOCUMENT_DUPLICATE_APPROVED'`. Assert `prisma.documentRequest.count({ where: { propertyEngagementId, status: 'PENDING' } })` equals 0 after the failed attempt. (G1-a, G4-a: direct API call blocked + no row persisted.)

**G1-b through G1-e: Non-APPROVED statuses do not block**

- [x] 6.3 `it('allows creation when the same-type request is PENDING')`:
      Seed engagement + PENDING request for `'Escritura'`. Attempt new request with title `'escritura'`. Assert HTTP 201. Assert `prisma.documentRequest.count({ where: { propertyEngagementId } })` equals 2. (G1-b.)

- [x] 6.4 `it('allows creation when the same-type request is SUBMITTED')`:
      Seed engagement + SUBMITTED request for `'dni'`. Attempt new request with title `'DNI del propietario'`. Assert HTTP 201. (G1-c.)

- [x] 6.5 `it('allows creation when the same-type request is REJECTED')`:
      Seed engagement + REJECTED request for `'plano'`. Attempt new request with title `'Plano municipal'`. Assert HTTP 201. (G1-d.)

- [x] 6.6 `it('allows creation when the same-type request is CANCELLED')`:
      Seed engagement + CANCELLED request for `'expensas'`. Attempt new request with title `'Expensas'`. Assert HTTP 201. (G1-e.)

**G2-a: Cross-engagement isolation**

- [x] 6.7 `it('allows creation on engagement B when APPROVED same-type exists only on engagement A')`:
      Seed two engagements (A and B) under the same tenant. Seed APPROVED `'dni'` request on engagement A. Attempt to create `'DNI del propietario'` on engagement B. Assert HTTP 201. (G2-a.)

**G3-a, G3-b: `otro` bypass**

- [x] 6.8 `it('allows creation of any free-text (otro) title even when an APPROVED otro request exists')`:
      Seed APPROVED request with unmatched title `'factura de gas'`. Attempt new request with `'recibo de medianera'` (also unmatched). Assert HTTP 201. Two `otro` requests coexist. (G3-a.)

- [x] 6.9 `it('allows creation when the title is a near-typo (not a synonym) of a canonical type')`:
      Seed APPROVED request for `'Escritura'`. Attempt new request with `'escrituraa'` (typo, resolves to `otro`). Assert HTTP 201. (G3-b.)

**G4-a: Direct API call respects guard**

- [x] 6.10 `it('direct API call without frontend guard still returns 409 on duplicate APPROVED')`:
      Seed APPROVED `'dni'` request. POST directly to the API endpoint with `'documento de identidad'` (synonym → `dni`). Assert HTTP 409. (This is the G4-a spec scenario; G1-a test above already covers this behavior — use this task to verify the `errorCode` field specifically.)

**R1-a, R1-b: Free-text regression**

- [x] 6.11 `it('allows any valid title string when no APPROVED requests exist')`:
      Fresh engagement with no existing requests. POST with an arbitrary title. Assert HTTP 201. Row persisted with the ORIGINAL (non-normalized) title. (R1-a.)

- [x] 6.12 `it('does not reject a title of exactly 200 characters due to the guard')`:
      Construct a 200-char title that resolves to `otro` (unmatched long string). POST. Assert HTTP 201. (R1-b — max-length unchanged.)

**R2-a: Review flow unaffected**

- [x] 6.13 `it('review-document-request still succeeds and does not invoke the duplicate guard')`:
      Seed a SUBMITTED request. Call the review endpoint to APPROVE it. Assert HTTP 200 (or the appropriate success status). Assert the response status is `APPROVED`. Confirm the guard is NOT invoked on the review path (no `DuplicateApprovedDocumentError` possible here since review does not call `createRequest` or `runCreateWithDuplicateGuard`). (R2-a.)

**R3-a: Seller visibility regression**

- [x] 6.14 `it('seller without canViewAll does not receive other sellers document requests')`:
      Seed two sellers (seller A assigned to engagement, seller B not assigned). Create a document request via seller A's context. List document requests as seller B. Assert the list does not include the request from seller A's engagement. (R3-a: seller-scoped visibility preservation — guard code path must not touch the list query filters.)

### 6b — RED confirm gate

- [x] 6.15 Run `pnpm --filter @viewpro/api test documents.e2e` — the 13 new test cases (6.2–6.14) MUST be **RED** (expected: 409s return 201, 201s return 500 or wrong status). Pre-existing tests MUST stay **GREEN**. Any import error is a scaffolding problem; fix before proceeding.

### 6c — GREEN gate (post Phase 5)

- [x] 6.16 After Phase 5 wiring is complete, run `pnpm --filter @viewpro/api test documents.e2e` again. ALL 13 new tests MUST be **GREEN**. Any red is a bug in the implementation, not a test issue; do not skip.

---

## Phase 7 — Frontend 409 surfacing verification

Depends on: Phase 5 complete. This phase is likely a read-only confirm with a minimal test extension.

Files:
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx` (read-only confirm)
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx` (extend if needed)

- [x] 7.1 **(Confirm existing behavior — no code change expected)** Verify that `createDocumentRequestMutation.onError` at ~:151-153 in `property-document-requests.tsx` calls `toast.error(error instanceof Error ? error.message : 'No se pudo solicitar el documento')`. Verify that `parseJsonResponse` in `service.ts` extracts `body.message` for non-ok responses (including 409) and throws it as an `Error`. Conclusion: the 409's `message` field (`'An approved document of this type already exists for this property.'`) already propagates through the error toast chain with NO new production code required. Document this as a confirmed finding in apply-progress.

- [x] 7.2 **(Write failing test — if not already covered)** In `property-document-requests.test.tsx`, add:
      `it('shows a toast error with the API message when createDocumentRequest returns 409')`:
      Mock `createProductDocumentRequest` to reject with `new Error('An approved document of this type already exists for this property.')`. Trigger the submit flow. Assert `toast.error` was called with that exact message string. Run — confirm **RED** if not already green.

- [x] 7.3 After verifying (or implementing the minimal mock), run `pnpm --filter next-shadcn-dashboard-starter test property-document-requests` — test from 7.2 MUST be **GREEN**.

- [x] 7.4 Run `pnpm --filter next-shadcn-dashboard-starter typecheck` — zero errors in the components directory.

---

## Phase 8 — Regression coverage

Depends on: Phases 6 and 7 complete.

- [x] 8.1 **(R2 regression — review flow not changed)** Confirm task 6.13 is green. Additionally, `rg -n "reviewRequest\|review-document-request\|runCreateWithDuplicateGuard" viewpro-app/apps/api/src/documents/use-cases/review-document-request.ts` — assert `runCreateWithDuplicateGuard` does NOT appear in the review use case file (guard is not wired there). Record the finding.

- [x] 8.2 **(R3 regression — seller visibility)** Confirm task 6.14 is green. Additionally, `rg -n "canViewAll\|buildAssignedDocumentEngagementWhere" viewpro-app/apps/api/src/documents/prisma-documents.repository.ts` — assert these symbols are UNCHANGED by the slice (guard code only adds `runCreateWithDuplicateGuard`; no list query filter is touched). Record the diff scope.

- [x] 8.3 **(R1 regression — free-text title stored as-is)** Confirm task 6.11 is green and assert the `DocumentRequest.title` in the response body equals the original un-normalized input string (normalization is for lookup only; the stored value must be the raw user input).

- [x] 8.4 **(Seed smoke)** `rg -n "document\|DocumentRequest\|APPROVED" viewpro-app/scripts/seed-demo.mjs` — confirm finding from audit 1.8. If no APPROVED document requests are seeded, no seed update is needed and the seeded smoke (if available) is unaffected. If APPROVED requests ARE seeded and the guard would block the seed path, the seed script must be updated to avoid creating a conflicting second APPROVED request of the same canonical type on the same engagement. Record result.

---

## Phase 9 — Verification gates

Depends on: Phases 2–8 complete. ALL gates MUST be GREEN before tagging done.

- [x] 9.1 `pnpm --filter @viewpro/api test` — all API vitest suites green.
      - `document-taxonomy.spec.ts` — all 22 unit tests (phases 2–3) GREEN.
      - `documents.e2e-spec.ts` — all pre-existing cases UNCHANGED and GREEN; 13 new guard cases GREEN.

- [x] 9.2 `pnpm --filter next-shadcn-dashboard-starter test` — all FE vitest suites green.
      - `property-document-requests.test.tsx` — 409 toast test (phase 7) GREEN.
      - All pre-existing document-requests tests UNCHANGED and GREEN.

- [x] 9.3 `pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in both packages.

- [x] 9.4 `pnpm oxlint` (or equivalent lint command from workspace root) — zero new lint errors.

- [x] 9.5 **(Diff scope assertion)** Run `git diff --stat`. Confirm changed files are ONLY:
      - `viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.ts` (new)
      - `viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.spec.ts` (new)
      - `viewpro-app/apps/api/src/documents/documents.repository.ts` (modified — port method + error class)
      - `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts` (modified — impl)
      - `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts` (modified — wiring)
      - `viewpro-app/apps/api/test/documents.e2e-spec.ts` (modified — new guard tests)
      - `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx` (modified — 409 toast test)
      Any unexpected file in the diff must be explained in apply-progress before opening PR.

- [x] 9.6 Confirm `schema.prisma` is UNCHANGED: `git diff viewpro-app/apps/api/prisma/schema.prisma` → empty. (No schema change per design D2.)

- [x] 9.7 Request fresh-context readability review on the diff before opening PR (standard pre-PR gate per delivery flags; no security boundary file touched).

---

## Acceptance checklist — spec scenarios

| Scenario | Phase | Task(s) | Status |
|----------|-------|---------|--------|
| T1-a: Exact synonym match resolves to canonical key | 2+3 | 2.1–2.9, 3.2 | ✅ |
| T1-b: Unmatched title resolves to `otro` | 2+3 | 2.10, 3.4 | ✅ |
| T2-a: Case-insensitive match | 2+3 | 2.11, 3.3 | ✅ |
| T2-b: Accent-insensitive match | 2+3 | 2.12, 3.3 | ✅ |
| T2-c: Leading/trailing whitespace stripped | 2+3 | 2.13, 3.3 | ✅ |
| T2-d: Accent + case combined | 2+3 | 2.14, 3.3 | ✅ |
| T2-e: `cédula` → `dni` | 2+3 | 2.15, 3.2 | ✅ |
| T2-f: `planos` → `plano` | 2+3 | 2.16, 3.2 | ✅ |
| G1-a: APPROVED conflict — creation blocked | 5+6 | 5.3–5.5, 6.2 | ✅ |
| G1-b: PENDING existing — creation allowed | 5+6 | 5.3–5.5, 6.3 | ✅ |
| G1-c: SUBMITTED existing — creation allowed | 5+6 | 5.3–5.5, 6.4 | ✅ |
| G1-d: REJECTED existing — creation allowed | 5+6 | 5.3–5.5, 6.5 | ✅ |
| G1-e: CANCELLED existing — creation allowed | 5+6 | 5.3–5.5, 6.6 | ✅ |
| G2-a: APPROVED on different engagement — creation allowed | 5+6 | 5.3–5.5, 6.7 | ✅ |
| G3-a: `otro` title always allowed | 5+6 | 5.3–5.4, 6.8 | ✅ |
| G3-b: Typo not matched — treated as `otro` | 2+3+5+6 | 2.17, 3.4, 5.3, 6.9 | ✅ |
| G4-a: Direct API call respects guard (4xx, no row) | 5+6 | 5.5, 6.2, 6.10 | ✅ |
| R1-a: Novel free-text title creates without error | 5+6 | 5.3, 6.11 | ✅ |
| R1-b: Title max-length constraint unchanged | 6 | 6.12 | ✅ |
| R2-a: Reviewing a SUBMITTED request still succeeds | 6+8 | 6.13, 8.1 | ✅ |
| R3-a: Seller without canViewAll does not receive other sellers' requests | 6+8 | 6.14, 8.2 | ✅ |
