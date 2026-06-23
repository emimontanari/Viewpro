# Design — Stage 20.12 Document Duplicate Guard

## Status

Draft — 2026-06-23. Companion to:

- Proposal: `openspec/changes/20-12-document-duplicate-guard/proposal.md` · Engram `sdd/20-12-document-duplicate-guard/proposal`
- Spec: `openspec/changes/20-12-document-duplicate-guard/spec.md` · Engram `sdd/20-12-document-duplicate-guard/spec`
- Format mirror: `openspec/changes/24-6c-notification-deeplink-owner-movement/design.md`

## Scope recap

Server-side guard in the create-document-request path: reject a CREATE only when an `APPROVED`
request of the **same canonical type** already exists on the **same engagement**. A new pure
taxonomy module resolves `title → canonicalKey | 'otro'`; `otro` bypasses the guard. No DTO field,
no schema change, no migration. Out of scope (do NOT design): OCR/scanning, storage adapter,
panel redesign, owner taxonomy editor, agency-custom types, semantic/substring matching, seller
visibility (R3 — already enforced, untouched).

## Grounding facts (confirmed against source)

- **Create use case** `create-document-request.use-case.ts:24-70`: validates permission, owner link,
  loads engagement (`findTenantEngagementForDocumentRequest`), then `createRequest(...)` at :49.
  The guard slots **between** the engagement load (:47) and `createRequest` (:49).
- **Repository port** `documents.repository.ts:147-199`: `createRequest(input)` + list methods.
  No existing "find approved by type" method — A1 needs a new port method.
- **Prisma impl** `prisma-documents.repository.ts`: `createRequest` :177-191 is a bare
  `prisma.documentRequest.create` (no tx). Precedent for serialized writes already exists:
  `createPendingVersion` :284-317 and `markVersionUploaded` :319-341 use `prisma.$transaction`,
  and `lockTenantRow` :59-65 does `SELECT ... FOR UPDATE` to serialize a check-then-write. This is
  the project's established TOCTOU pattern — we reuse its shape.
- **Error convention** (decisive for D4): `ConflictException` (409) is used for **state conflicts**
  (`prisma-documents.repository.ts:55` — storage limit already persisted). `BadRequestException`
  (400) is used for **input validation** (MIME, missing reason). A duplicate APPROVED row is a
  state conflict → 409. Sibling `create-status-change-request.use-case.ts:130` maps its duplicate
  to `ConflictException` with `{ errorCode, message }` — exact convention to mirror.
- **Frontend normalization** `owner-document-requests.tsx:761-766`: `normalizeSearchText` =
  `NFD → strip /[̀-ͯ]/g → toLowerCase`. Display-only, in `app-new`. The backend gets its
  OWN copy (no cross-app import); spec T2 adds an explicit `trim()` step the FE lacks.
- **DocumentRequestStatus** enum (`schema.prisma:140-146`): PENDING, SUBMITTED, APPROVED, REJECTED,
  CANCELLED. `DocumentRequest.title` is free text (`schema.prisma:507`), no type column.
- **Sibling proven pattern** `status-change-requests`: partial unique index + `isPartialUniqueViolation`
  helper (`helpers/is-partial-unique-violation.ts`) + `constants/db.ts` constant + P2002→409. This is
  the bar a DB-level guard would have to clear — see D3 for why we do NOT take it here.

## Decisions

### D1 — Taxonomy as a pure backend module `documents/taxonomy/document-taxonomy.ts` (A1)

**Chosen.** A standalone, I/O-free module exporting the canonical table, the normalizer, and the
resolver. Pure ⇒ unit-testable against every taxonomy row with no DB (spec NF "Normalization is pure").

```ts
export type CanonicalDocumentType =
  | 'escritura' | 'dni' | 'plano' | 'impuesto_municipal' | 'reglamento_copropiedad'
  | 'expensas' | 'boleto_compraventa' | 'constancia_servicios' | 'informe_dominio' | 'otro';

// Synonyms stored ALREADY-normalized (lowercase, no diacritics) — domain data in Spanish.
const SYNONYMS: Record<Exclude<CanonicalDocumentType, 'otro'>, readonly string[]> = { /* spec T1 */ };

export function normalizeDocumentTitle(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function resolveCanonicalType(title: string): CanonicalDocumentType {
  const n = normalizeDocumentTitle(title);
  for (const [key, syns] of Object.entries(SYNONYMS)) if (syns.includes(n)) return key as CanonicalDocumentType;
  return 'otro';
}
```

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Import FE `normalizeSearchText` into API | Cross-app coupling api↔app-new; FE lacks `trim`; build/boundary smell | Rejected |
| Inline the map inside the use case | Not unit-testable in isolation; violates spec NF "pure resolver" | Rejected |
| Shared `packages/*` lib consumed by both apps | Over-engineered for one slice; new package + build wiring | Rejected (note for future) |
| Pure module in `documents/taxonomy/`, FE keeps its own copy | Isolated, testable per row, zero cross-app import, mirrors FE rule | **Chosen** |

### D2 — Guard mechanism: COMPUTE-ON-READ inside a serialized transaction (A1)

**Chosen.** No schema change. In the create path, **inside a `prisma.$transaction`**:
(1) resolve the incoming title → `canonicalKey`; if `otro`, skip the guard entirely (G3);
(2) fetch existing `APPROVED` requests for `propertyEngagementId` (new port method
`findApprovedRequestTitlesForEngagement` returning `{ title }[]`), resolve each title, and
check `some(t => resolveCanonicalType(t.title) === canonicalKey)`; (3) on collision throw the
domain conflict; else `createRequest(...)` in the SAME transaction.

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| (a) Compute-on-read, no schema change | Resolves titles in app code; small N (approved docs per engagement is tiny); zero migration risk; reuses pure resolver | **Chosen** |
| (b) Stored `canonicalType` column + indexed lookup + backfill | Migration + backfill of all existing rows; couples DB to taxonomy (every taxonomy edit needs a re-backfill); enables a partial unique index — but see D3 why that index is WRONG for this spec | Rejected |

**Why (a) over (b).** This is one small slice; (b) adds a migration, a backfill, and a permanent
DB/taxonomy coupling for a guard that fires on a tiny row set (APPROVED docs per engagement number
in single digits). The proposal/spec explicitly state "No DB schema change". The only argument for
(b) is an indexed lookup or a DB-enforced unique index — and D3 shows the unique index is unsound
for THIS spec, removing (b)'s sole correctness advantage. Compute-on-read keeps the canonical
authority in the pure resolver (one source of truth), which the FE already mirrors.

### D3 — TOCTOU (A4, flagged HIGH): row-lock the engagement; reject a partial unique index (downgrade A4 → Medium, justified)

**Real-window analysis.** The guard fires ONLY against `APPROVED`. Every CREATE inserts `PENDING`
(`prisma-documents.repository.ts:187`). Therefore:

- **CREATE vs CREATE (both same type, same engagement):** both insert `PENDING`. Neither sees an
  APPROVED row. Result = two PENDING of the same type — which **G1-b explicitly ALLOWS**. NOT a
  violation. So the "two concurrent creates" framing in A4 is a non-race against this spec.
- **CREATE vs APPROVE:** to APPROVE, a request must already be `SUBMITTED` (`review-document-request.ts:33`),
  i.e. it already exists. The narrow window is: CREATE reads "no APPROVED" → an unrelated same-type
  request flips to APPROVED concurrently → CREATE inserts PENDING. Resulting state = one APPROVED +
  one PENDING of the same type — again a state **G1-b ALLOWS** in other interleavings. The invariant
  "block a CREATE while an APPROVED already exists" is only momentarily bypassed; no duplicate-APPROVED
  is ever produced (only `reviewRequest` creates APPROVED, and it operates on a single existing row).

**Conclusion.** The genuinely harmful end-state — two `APPROVED` requests of the same canonical type
on one engagement — is **not reachable by concurrent CREATEs** at all; it would require two
independent APPROVE transitions, which is the reviewer flow (R2, out of scope, unchanged). The CREATE
guard's only job is the read-check, and its worst concurrent outcome is a state the spec already
permits. A4 is therefore **Medium, not High**.

**Minimum sound mechanism — chosen:** wrap the read-check + insert in a single `prisma.$transaction`
and take a `SELECT id FROM property_engagements WHERE id = ${engagementId} FOR UPDATE` row lock at the
top (port method `runCreateWithDuplicateGuard`, mirroring `lockTenantRow` :59-65). This serializes
concurrent CREATEs on the same engagement so the read-check and insert are atomic per engagement —
identical posture to the storage-capacity guard. Cheap, no schema change, reuses an in-repo idiom.

**Rejected: filtered/partial unique index** `(propertyEngagementId, canonicalType) WHERE status='APPROVED'`.
Two disqualifiers: (1) it requires a stored `canonicalType` column (D2-b) — Postgres partial unique
indexes cannot index a computed expression over `title`; (2) even with the column it would forbid
legitimate states — e.g. an old REJECTED→re-SUBMITTED→APPROVED cycle, or any future flow that needs
two APPROVED of the same type — and the spec's harmful end-state is unreachable from CREATE anyway, so
a hard DB constraint over-constrains beyond what the spec asks. The status-change sibling uses a partial
index because its invariant ("≤1 PENDING per engagement") IS a true insert-time uniqueness rule; ours
is a conditional read-check, a different shape. Mechanism matched to the actual invariant.

### D4 — Error contract: `ConflictException` (409) with `{ errorCode, message }` (matches sibling)

**Chosen.** Throw `ConflictException({ errorCode: 'DOCUMENT_DUPLICATE_APPROVED', message: 'An approved
document of this type already exists for this property.' })` from the create use case when the guard
fires. 409 (not 400) because the rejection is driven by **persisted state** (an APPROVED row exists),
matching `prisma-documents.repository.ts:55` (storage-limit 409) and
`create-status-change-request.use-case.ts:130` (duplicate 409 with `{errorCode,message}`). Satisfies
spec G4-a "API returns a 4xx error". No new row persisted (throw precedes/aborts the tx insert).

### D5 — Layer breakdown + LOC (single PR)

| File | Action | Description | Est. LOC |
|---|---|---|---|
| `documents/taxonomy/document-taxonomy.ts` | Create | Pure: canonical table, `normalizeDocumentTitle`, `resolveCanonicalType` (D1) | ~45 |
| `documents/taxonomy/document-taxonomy.spec.ts` | Create | Unit: every row, T1-a/b, T2-a..f, G3-b typo→otro | ~70 |
| `documents/documents.repository.ts` | Modify | Add port method `runCreateWithDuplicateGuard(input)` (lock + read approved titles + insert) returning `DocumentRequestRecord`; add `DuplicateApprovedDocumentError` sentinel OR return-shape (D2/D3) | ~20 |
| `documents/prisma-documents.repository.ts` | Modify | Implement `runCreateWithDuplicateGuard`: `$transaction` + `FOR UPDATE` lock + fetch APPROVED `{title}` + resolve + collision throw + `create` (reuse `documentRequestInclude`) | ~40 |
| `documents/use-cases/create-document-request.use-case.ts` | Modify | Resolve title; if `otro` keep current `createRequest`; else call guarded path; map duplicate → `ConflictException` (D4) | ~18 |
| `test/documents.e2e-spec.ts` | Modify | Integration G1-a..e, G2-a, G3-a/b, G4-a, R1-a/b, R2-a (guard not invoked on review) | ~90 |
| **Total** | | | **~283** |

`single_pr_recommended: true`, `size_exception_required: false` (~283 < 400). No security-boundary
file (no auth/sanitizer); standard pre-PR readability review.

## Data flow

```text
POST create-document-request (CreateDocumentRequestDto: title free text, unchanged R1)
        │
        ▼
CreateDocumentRequestUseCase.execute
  permission + owner-link guards (unchanged)
  findTenantEngagementForDocumentRequest (unchanged)
        │  title
        ▼
  resolveCanonicalType(title)  ── 'otro' ──►  createRequest(...)  (no guard, G3)  ──► PENDING row
        │ canonicalKey ≠ 'otro'
        ▼
  repo.runCreateWithDuplicateGuard({ engagementId, canonicalKey, ...createInput })
        │  (one $transaction)
        ├ 1. SELECT id FROM property_engagements WHERE id=? FOR UPDATE   (serialize per engagement, D3)
        ├ 2. fetch APPROVED requests {title} WHERE propertyEngagementId=? AND status='APPROVED'
        ├ 3. some(resolveCanonicalType(t.title) === canonicalKey)?
        │        ├ yes → throw DuplicateApprovedDocumentError ──► use case → 409 (D4); NO row
        │        └ no  → documentRequest.create(... status PENDING) ──► PENDING row
        ▼
  analytics + notification (unchanged, best-effort)
```

## Interfaces / Contracts

```ts
// documents.repository.ts — new port method (the guard lives here so the lock + read + write are atomic)
type RunCreateWithDuplicateGuardInput = CreateDocumentRequestInput & { canonicalKey: CanonicalDocumentType };
runCreateWithDuplicateGuard(input: RunCreateWithDuplicateGuardInput): Promise<DocumentRequestRecord>;
// throws DuplicateApprovedDocumentError (in-repo sentinel) on collision; use case maps to ConflictException.
```

Resolution authority is the pure resolver (D1); the repo passes existing APPROVED titles back through
it — never duplicates the synonym logic.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `resolveCanonicalType` / `normalizeDocumentTitle` | `document-taxonomy.spec.ts` (vitest, like `is-partial-unique-violation.spec.ts`): every canonical row resolves from each synonym; T2-a..f (case/accent/whitespace incl. `cédula`,`planos`,`TÍTULO`); T1-b + G3-b (`escrituraa`→`otro`) |
| Integration | Guard end-to-end through the use case / API | EXTEND `test/documents.e2e-spec.ts`: G1-a APPROVED same-type→409 + no new row; G1-b..e PENDING/SUBMITTED/REJECTED/CANCELLED allow; G2-a different engagement allows; G3-a/b `otro` always allows; G4-a direct API call blocked (4xx, no row); R1-a/b free-text + 200-char unchanged; R2-a review still works, guard NOT invoked |
| E2E | (covered by the API integration suite above) | — |

TDD order (strict mode): write `document-taxonomy.spec.ts` first (pure, fast) and make it green;
then write failing e2e guard scenarios; then implement repo method + use-case wiring to green.

## Migration / Rollout

No migration required. No schema change, no backfill, no feature flag. Pure additive guard on the
create path; existing rows and the review flow are untouched.

## Open Questions

- [ ] None blocking. (Confirmed in D2/D3: compute-on-read + per-engagement row lock is sufficient;
  no column, no partial index.)

## Risks

- **A1 (Med→Low) — taxonomy/resolver correctness.** Mitigated by D1 pure module + exhaustive unit
  tests over every row and every T2 edge case. Single source of truth; FE mirrors the same rule.
- **A4 (downgraded High→Med) — TOCTOU.** D3: the harmful two-APPROVED end-state is unreachable from
  concurrent CREATEs (every CREATE inserts PENDING; double-PENDING and PENDING+APPROVED are
  spec-ALLOWED states). Per-engagement `FOR UPDATE` lock serializes the read-check+insert, matching
  the in-repo `lockTenantRow` idiom. Partial unique index rejected (needs a column; over-constrains).
- **A3 (Med) — exact-match only.** Accepted per spec: `"escritura de 1980"`→`otro`. No substring
  matching (out of scope). Documented in resolver behavior + G3-b test.
- **A2 (Low) — two `otro` requests with identical free text.** Accepted gap per spec; closing it
  needs semantic matching (out of scope).

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (~283 LOC < 400; no security-boundary file)`
```
