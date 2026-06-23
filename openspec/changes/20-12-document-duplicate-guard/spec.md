# Spec — Stage 20.12 Document Duplicate Guard

## Status

Draft — 2026-06-23.

## Origin

Proposal: `openspec/changes/20-12-document-duplicate-guard/proposal.md`

---

## Scope Note — Seller Visibility

The slice contract's "unrelated sellers do not see seller-specific requests" clause refers to the
existing `canViewAll` / `buildAssignedDocumentEngagementWhere` enforcement already present in
`prisma-documents.repository.ts` list queries. That enforcement is NOT new to this slice and
requires no change here. It is a preservation invariant (see Group R), not a new requirement.

---

## Group T — Taxonomy and Normalization

### Requirement T1: Canonical document-type taxonomy

The system MUST maintain a canonical document-type taxonomy of 9 fixed entries plus one free-text
fallback. Each entry is immutable — no owner-facing editor, no agency-defined custom types.

| Key | Label | Normalized synonyms |
|---|---|---|
| `escritura` | Escritura | escritura, escritura firmada, título, título de propiedad |
| `dni` | DNI del propietario | dni, documento de identidad, dni del propietario, cédula |
| `plano` | Plano municipal | plano, plano municipal, plano de mensura, planos |
| `impuesto_municipal` | Impuesto municipal | impuesto municipal, abl, tasa municipal, impuesto inmobiliario |
| `reglamento_copropiedad` | Reglamento de copropiedad | reglamento, reglamento de copropiedad, propiedad horizontal |
| `expensas` | Estado de expensas | expensas, estado de expensas, libre deuda de expensas |
| `boleto_compraventa` | Boleto de compra-venta | boleto, boleto de compraventa, boleto de compra-venta |
| `constancia_servicios` | Comprobante de servicios | servicios, comprobante de servicios, constancia de servicios |
| `informe_dominio` | Informe de dominio | informe de dominio, dominio |
| `otro` | Otro (free text) | *(no synonyms — fallback when no canonical match)* |

#### Scenario T1-a: Exact synonym match resolves to canonical key

- GIVEN a title whose normalized form is an exact synonym of a canonical entry
- WHEN the taxonomy resolver is invoked
- THEN it returns that entry's canonical key

#### Scenario T1-b: Unmatched title resolves to `otro`

- GIVEN a title whose normalized form matches none of the synonym sets
- WHEN the taxonomy resolver is invoked
- THEN it returns `otro`

---

### Requirement T2: Normalization rule

The system MUST normalize a document-request title before taxonomy lookup by applying, in order:
(1) Unicode NFD decomposition, (2) diacritic-codepoint strip (`̀–ͯ`), (3) lowercase,
(4) trim. The result is then matched against the synonym set using exact equality.

#### Scenario T2-a: Case-insensitive match

- GIVEN a title `"Escritura"` (mixed case)
- WHEN the taxonomy resolver is invoked
- THEN it returns `escritura`

#### Scenario T2-b: Accent-insensitive match

- GIVEN a title `"título de propiedad"` (accented)
- WHEN the taxonomy resolver is invoked
- THEN it returns `escritura`

#### Scenario T2-c: Leading/trailing whitespace stripped

- GIVEN a title `"  DNI del propietario  "` (padded)
- WHEN the taxonomy resolver is invoked
- THEN it returns `dni`

#### Scenario T2-d: Accent + case combined

- GIVEN a title `"TÍTULO"` (uppercase + accent)
- WHEN the taxonomy resolver is invoked
- THEN it returns `escritura`

#### Scenario T2-e: Synonym with accent normalization — `cédula`

- GIVEN a title `"Cédula"` (accented, capital C)
- WHEN the taxonomy resolver is invoked
- THEN it returns `dni`

#### Scenario T2-f: Synonym with accent normalization — `planos`

- GIVEN a title `"Planos"` (capital P)
- WHEN the taxonomy resolver is invoked
- THEN it returns `plano`

---

## Group G — Duplicate Guard (core behavior)

### Requirement G1: Guard triggers only on APPROVED same-type same-engagement conflict

When a create-document-request operation is requested, the system MUST check whether the
engagement already holds an `APPROVED` document request whose title resolves to the same canonical
key as the incoming title. If such a conflict exists, the system MUST reject the create with a
domain error. `PENDING`, `SUBMITTED`, `REJECTED`, and `CANCELLED` existing requests of the same
canonical type MUST NOT block creation.

#### Scenario G1-a: APPROVED conflict — creation blocked

- GIVEN engagement E has an `APPROVED` document request with title `"Escritura"` (resolves to `escritura`)
- WHEN a new create-document-request is attempted for engagement E with title `"escritura firmada"`
  (also resolves to `escritura`)
- THEN the system rejects the request with a duplicate-guard error
- AND no new `DocumentRequest` row is persisted

#### Scenario G1-b: PENDING existing — creation allowed

- GIVEN engagement E has a `PENDING` document request with title `"Escritura"` (resolves to `escritura`)
- WHEN a new create-document-request is attempted for engagement E with title `"escritura"`
- THEN the system allows the creation
- AND a new `DocumentRequest` row is persisted

#### Scenario G1-c: SUBMITTED existing — creation allowed

- GIVEN engagement E has a `SUBMITTED` document request resolving to `dni`
- WHEN a new create-document-request for engagement E resolving to `dni` is attempted
- THEN the system allows the creation

#### Scenario G1-d: REJECTED existing — creation allowed

- GIVEN engagement E has a `REJECTED` document request resolving to `plano`
- WHEN a new create-document-request for engagement E resolving to `plano` is attempted
- THEN the system allows the creation

#### Scenario G1-e: CANCELLED existing — creation allowed

- GIVEN engagement E has a `CANCELLED` document request resolving to `expensas`
- WHEN a new create-document-request for engagement E resolving to `expensas` is attempted
- THEN the system allows the creation

---

### Requirement G2: Guard is scoped to the same engagement

The duplicate check MUST be scoped to the `propertyEngagementId` of the incoming request.
An APPROVED request of the same canonical type on a DIFFERENT engagement MUST NOT block creation.

#### Scenario G2-a: APPROVED on different engagement — creation allowed

- GIVEN engagement A has an `APPROVED` document request resolving to `dni`
- AND engagement B has NO `APPROVED` document request resolving to `dni`
- WHEN a new create-document-request is attempted for engagement B resolving to `dni`
- THEN the system allows the creation

---

### Requirement G3: `otro` title bypasses the guard entirely

A title that resolves to `otro` (no canonical match) MUST be accepted without a duplicate check,
regardless of any existing requests on the engagement.

#### Scenario G3-a: `otro` title always allowed — even when APPROVED `otro` exists

- GIVEN engagement E has an `APPROVED` document request with an unmatched free-text title
- WHEN a new create-document-request is attempted for engagement E with any other unmatched title
- THEN the system allows the creation with no guard applied

#### Scenario G3-b: Slightly-off synonym not matched — treated as `otro`

- GIVEN a title `"escrituraa"` (typo, not a synonym of any canonical type)
- WHEN a create-document-request is attempted for engagement E where `escritura` is APPROVED
- THEN the system resolves the title to `otro` and allows the creation

---

### Requirement G4: Guard executes server-side only

The duplicate check MUST be performed server-side in the create-document-request use case,
before the `DocumentRequest` row is written. Client-side normalization or display helpers MUST
NOT be the sole enforcement point.

#### Scenario G4-a: Direct API call respects the guard

- GIVEN engagement E has an `APPROVED` request resolving to `dni`
- WHEN a create-document-request API call is made directly (bypassing any frontend guard)
  with a title resolving to `dni` for engagement E
- THEN the API returns a 4xx error and no row is persisted

---

## Group R — Regression Preservation

### Requirement R1: Free-text title behavior is unchanged for non-conflicting requests

The existing create-document-request flow for titles that do not conflict with any APPROVED
canonical type MUST continue to work without modification. `title` remains free text (max 200
chars at DTO); no new required field is added to the DTO.

#### Scenario R1-a: Novel free-text title creates without error

- GIVEN engagement E has no `APPROVED` requests
- WHEN a create-document-request is attempted with any valid title string
- THEN the system allows the creation
- AND the `DocumentRequest` row is persisted with the original (non-normalized) title

#### Scenario R1-b: Title max-length constraint is unchanged

- GIVEN a title string of exactly 200 characters
- WHEN a create-document-request is attempted
- THEN the system does not reject the request due to length

---

### Requirement R2: Approval (review) flow is unaffected

The `review-document-request` use case MUST continue to require `SUBMITTED` status and remain
unchanged by this slice.

#### Scenario R2-a: Reviewing a SUBMITTED request still succeeds

- GIVEN a document request with status `SUBMITTED`
- WHEN a review action with `APPROVED` or `REJECTED` outcome is applied
- THEN the request status transitions correctly
- AND the duplicate guard is NOT invoked during review

---

### Requirement R3: Seller-scoped visibility is unchanged

The existing `canViewAll` / `buildAssignedDocumentEngagementWhere` enforcement for list queries
MUST remain intact. This slice MUST NOT relax or modify visibility scoping.

#### Scenario R3-a: Seller without canViewAll does not receive other sellers' requests

- GIVEN a list-document-requests call for a seller who does not have `canViewAll`
- WHEN the query executes
- THEN only document requests tied to engagements where that seller is assigned are returned
- AND this behavior is identical to pre-20.12 behavior

---

## Non-Functional Notes

- **No DB schema change.** The guard reads existing `DocumentRequest` rows filtered by
  `propertyEngagementId` and `status = APPROVED`. No new columns, no new Prisma model.
- **Normalization is pure.** The taxonomy resolver is a pure function with no I/O — testable
  in isolation without DB access.
- **Guard lookup MUST be inside the same transaction (or use a serializable read)** as the
  insert to prevent TOCTOU races. Design phase must confirm the isolation strategy.
- **TDD requirement.** All taxonomy, normalization, and guard logic MUST have unit tests before
  implementation. The normalization function is a pure function and MUST be unit-tested against
  every row in the taxonomy table and every edge case scenario above. Guard scenarios G1-a through
  G4-a MUST be covered by integration tests against the API use-case layer.

---

## Out of Scope

- OCR/scanning of document bytes
- Storage adapter changes
- Document panel redesign
- Owner-facing taxonomy editor
- Agency-defined custom document types
- Seller visibility changes (already enforced — see R3)

---

## Risks / Spec-Level Assumptions

| # | Assumption / Risk | Impact |
|---|-------------------|--------|
| A1 | Guard lookup executes inside (or immediately before) the create use-case, using `propertyEngagementId` + `status = APPROVED` + resolved canonical key. Design must decide whether a dedicated repository method is added or the existing `listInternalRequests` is reused with filters. | Medium |
| A2 | The `otro` bypass (G3) applies to ALL free-text titles with no canonical match — including cases where two `otro` requests on the same engagement have semantically identical free text. The spec intentionally leaves this gap open; closing it would require semantic similarity matching, which is out of scope. | Low |
| A3 | The proposal normalization rule uses exact synonym equality after NFD + diacritic strip + lowercase + trim. Partial/substring matching is NOT in scope. Titles like `"escritura de 1980"` will NOT match `escritura` and will resolve to `otro`. This is intentional — partial matching would require a separate approved spec change. | Medium |
| A4 | TOCTOU: two concurrent create requests for the same canonical type on the same engagement could both pass the guard if issued simultaneously. Design must specify isolation (e.g. advisory lock, serializable transaction, or unique-index on `propertyEngagementId + canonicalKey` filtered by APPROVED). | High |
