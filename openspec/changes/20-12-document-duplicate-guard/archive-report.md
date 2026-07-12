# Archive Report — Stage 20.12 Document Duplicate Guard

## Status

Archived — 2026-06-23.

---

## Change Summary

**Change**: `20-12-document-duplicate-guard`  
**Scope**: Server-side duplicate guard on document-request creation. Rejects CREATE only when an APPROVED request of the same canonical type exists on the same engagement. New pure taxonomy module resolves titles to canonical types; `otro` fallback bypasses guard. No schema change, no migration.  
**Outcome**: MERGED to develop (PR #180, commit cf81c7a) — verified PASS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)  
**Archive Type**: In-place (no move — repo convention keeps all changes in `openspec/changes/`)

---

## Artifacts — Engram Observation IDs (Traceability)

| Artifact | Observation ID | Topic Key | State |
|----------|---|---|---|
| Proposal | (not found in Engram) | `sdd/20-12-document-duplicate-guard/proposal` | file only |
| Spec | #4461 | `sdd/20-12-document-duplicate-guard/spec` | active |
| Design | #4465 | `sdd/20-12-document-duplicate-guard/design` | active |
| Tasks | #4467 | `sdd/20-12-document-duplicate-guard/tasks` | active |
| Apply Progress | #4469 | `sdd/20-12-document-duplicate-guard/apply-progress` | active |
| Verify Report | #4472 | `sdd/20-12-document-duplicate-guard/verify-report` | active |

---

## Filesystem Artifacts — OpenSpec (Hybrid Mode)

```
openspec/changes/20-12-document-duplicate-guard/
├── proposal.md             ✅ complete
├── spec.md                 ✅ complete
├── design.md               ✅ complete
├── tasks.md                ✅ complete (all phases [x])
├── apply-progress.md       ✅ complete
├── verify-report.md        ✅ complete
└── archive-report.md       ✅ this file

Production code (MERGED to develop, PR #180, commit cf81c7a):
├── viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.ts (NEW, 35 LOC)
├── viewpro-app/apps/api/src/documents/taxonomy/document-taxonomy.spec.ts (NEW, 171 LOC)
├── viewpro-app/apps/api/src/documents/documents.repository.ts (MODIFIED, +30/-1 LOC)
├── viewpro-app/apps/api/src/documents/prisma-documents.repository.ts (MODIFIED, +37/-1 LOC)
├── viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts (MODIFIED, +20/-1 LOC)
├── viewpro-app/apps/api/test/documents.e2e-spec.ts (MODIFIED, +437/-2 LOC)
└── viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx (MODIFIED, +31 LOC)

Total: ~786 insertions / 5 deletions. Production logic: 165 LOC. Test expansion: 621 LOC (quality positive, see W2).
```

---

## Canonical Specs Store

**Status**: NO canonical specs store exists in this repo.

Investigation: `openspec/specs/` directory does not exist. Configuration (`openspec/config.yaml`) declares `specs_dir: openspec/specs` but the directory is not present and no specs are stored there.

**Decision**: Merge step SKIPPED — no canonical specs to sync with delta specs. The delta spec remains archived in `openspec/changes/20-12-document-duplicate-guard/spec.md` for reference.

---

## Archive Folder Convention

**Status**: NO archive folder convention in use.

Investigation:
- No `openspec/changes/archive/` directory exists.
- Prior completed changes (24-6c, 24-6b, 24-6a, 24-5, etc.) remain in `openspec/changes/` unchanged.
- No archive metadata or state files found.

**Decision**: Change is archived IN-PLACE in `openspec/changes/20-12-document-duplicate-guard/` following the established repo pattern. No folder move performed.

---

## Task Completion Gate — PASS

All 9 phases complete; all 68 tasks checked; all verification gates green.

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Pre-implementation audit | 1.1–1.9 | All [x] |
| Phase 2 — Taxonomy unit tests (RED first) | 2.1–2.23 | All [x]; 22 tests exist, RED confirmed before Phase 3 |
| Phase 3 — Taxonomy module implementation | 3.1–3.6 | All [x]; module created, 22 tests GREEN, typecheck clean |
| Phase 4 — Repository port + Prisma impl | 4.1–4.6 | All [x]; port method + impl in `$transaction` with `FOR UPDATE` lock |
| Phase 5 — Use-case wiring | 5.1–5.6 | All [x]; `resolveCanonicalType` imported, branching wired, 409 error map complete |
| Phase 6 — API integration tests | 6.1–6.16 | All [x]; 13 new guard tests RED first, then GREEN after Phase 5 |
| Phase 7 — Frontend 409 surfacing | 7.1–7.4 | All [x]; 409→toast path confirmed real (no new FE production code needed); 409 toast test GREEN |
| Phase 8 — Regression coverage | 8.1–8.4 | All [x]; R2 review flow untouched, R3 seller visibility untouched, R1 free-text stored as-is confirmed, seed-demo concern resolved (see W1 note below) |
| Phase 9 — Verification gates | 9.1–9.7 | All [x]; API 856/856 GREEN, FE 456/456 GREEN, typecheck clean, oxlint clean, schema unchanged, 7-file diff scope exact |

**Gate Verdict**: PASS — all implementation tasks checked. No unchecked implementation tasks block archive.

---

## Verification Summary

**Verify Report Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)

### Critical Issues
None.

### Warnings

**W1 — Stale audit claim in apply-progress (seed file path — CORRECTED IN ARCHIVE).**

The apply-progress audit A8 and task 8.4 recorded: "`seed-demo.mjs does not exist → no seed concern`". 

**FACT**: The file DOES exist at `viewpro-app/apps/api/scripts/seed-demo.mjs`. The audit searched under `viewpro-app/scripts/` (missing `apps/api/` path). 

**IMPACT**: Benign. The seed creates exactly ONE APPROVED request per engagement (`"Boleto de compra-venta aprobado"` on property 0) via direct `prisma.documentRequest.create(...)` without a title query lookup. The guard only fires on CREATE-path title resolution; the seeded APPROVED row is never checked against itself during seed, so no collision is possible. The **CONCLUSION (no seed change needed) is correct**; only the path/justification was incomplete. 

**ARCHIVE NOTE**: The seed-demo.mjs file exists at the correct path. One APPROVED request is seeded per engagement via direct creation (not through the guard path), so no blocking occurs.

**W2 — Test LOC far exceeds forecast.**

Total slice diff is ~786 insertions / 5 deletions (~791 changed lines) vs the ~283 forecast. Production code is 165 lines (on budget); overrun is entirely test code (621 lines), driven by `documents.e2e-spec.ts` adding 437 lines vs ~90 forecast. **More tests is a quality positive, not a defect.** Forecast was off, but the change still sits within a single reviewable PR because the bulk is repetitive seed-and-assert e2e blocks; no security-boundary file is touched.

**W3 — FE create-dialog stubbed in the 409 test.**

`property-document-requests.test.tsx` replaces `CreateDocumentRequestDialog` with a direct-call button to avoid Radix Select jsdom limitations. The dialog's own field rendering/validation is not exercised by the 409 test. **The PRODUCTION 409→toast path IS real and verified**: `service.ts` `parseJsonResponse` extracts `body.message` for non-ok responses and throws `Error(message)`; the component `onError` calls `toast.error(error.message)`. The stub only bypasses dialog UI, not error surfacing. Acceptable for this slice; dialog UI is covered by other tests.

### Suggestions

**S1 — Coverage threshold not enforced.**

No per-file coverage gate configured for these packages. Behavior coverage is strong (all 21 spec scenarios mapped to real tests); a future hardening pass could add a coverage threshold for the documents module.

**S2 — A2 gap (two identical `otro` free-text titles) intentionally open.**

Per spec A2, the guard does not dedupe two semantically-identical `otro` titles (no match = no guard applies). This is by design (closing it needs semantic matching, out of scope). Noted so archive does not mistake it for a defect.

### Test Evidence (verbatim, session 2026-06-23)

**Taxonomy unit spec**:
```
Test Files  1 passed (1)
     Tests  22 passed (22)
```
(All canonical rows + normalization edge cases + `otro` bypass covered.)

**Documents e2e integration**:
```
Test Files  1 passed (1)
     Tests  28 passed (28)
```
(15 pre-existing + 13 new guard cases: G1-a..e APPROVED/PENDING/SUBMITTED/REJECTED/CANCELLED, G2-a cross-engagement, G3-a/b `otro` bypass, G4-a direct API, R1-a/b free-text, R2-a review unchanged, R3-a seller visibility unchanged.)

**Frontend component spec**:
```
Test Files  1 passed (1)
     Tests  25 passed (25)
```
(1 new 409 toast test + 24 pre-existing.)

**Typecheck**: 0 errors (both API and FE packages).

**Lint**: oxlint 0 warnings / 0 errors.

**Schema**: `git diff schema.prisma` → empty (no DB changes).

**Mutation test**: Guard-disabled run (`const hasConflict = false && ...`) failed exactly G1-a and G4-a tests (expected 409, got 201); all other 26 tests stayed green. Proves block tests are not tautological.

---

## Preservation Invariants — ALL PASS

| Invariant | Check | Result |
|-----------|-------|--------|
| Review flow unchanged | `git diff approve-document-request.use-case.ts` | PASS (no changes; guard NOT invoked on review path) |
| Seller visibility unchanged | `git diff` canViewAll / buildAssignedDocumentEngagementWhere in `prisma-documents.repository.ts` | PASS (list queries untouched; guard only on create path) |
| Free-text title stored as-is | Test 6.11 response body `title` equals original un-normalized input | PASS (normalization is lookup-only; stored value is raw user input) |
| Seed compatibility | Seed creates one APPROVED via direct `prisma.create` (not through guard path) | PASS (benign; guard never runs on seeded creation) |
| No schema / no migration | `git diff schema.prisma` and `git diff --name-only prisma/migrations` | PASS (empty diffs) |
| Error convention matched | 409 ConflictException with `{ errorCode, message }` mirrors storage-limit + status-change siblings | PASS (error contract coherent) |

---

## Design Decisions Archived (Design Decisions D1–D5)

All design decisions executed as documented:

- **D1**: Taxonomy as pure backend module `documents/taxonomy/document-taxonomy.ts` — I/O-free, unit-testable against every row ✅
- **D2**: Guard mechanism compute-on-read (no schema change) inside `prisma.$transaction` with `FOR UPDATE` lock per engagement ✅
- **D3**: TOCTOU downgraded High→Medium — per-engagement row lock serializes the read-check+insert; harmful two-APPROVED end-state unreachable from concurrent CREATEs (every CREATE inserts PENDING; spec allows PENDING+APPROVED coexist) ✅
- **D4**: Error contract 409 `ConflictException({ errorCode: 'DOCUMENT_DUPLICATE_APPROVED', message: '...' })` matches siblings ✅
- **D5**: Single PR (~283 forecast, actual ~791 with test overrun); production on budget (165 LOC), test quality-positive (621 LOC) ✅

---

## Product Decision Archived (D5 from Proposal)

A canonical document-type taxonomy was required before this slice. Approved taxonomy in proposal:

| Key | Label | Normalized Synonyms |
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
| `otro` | Otro (free text) | (no guard applies) |

Normalization: lowercase + NFD diacritics strip + trim, then exact equality match against synonym set.

Guard rule: Block CREATE only when an APPROVED request of the same canonical type already exists on the same engagement. `PENDING`/`SUBMITTED`/`REJECTED`/`CANCELLED` do not block. `otro` (no match) bypasses guard entirely.

All scenarios tested and passing. Taxonomy collision-free (30 synonyms → 30 unique normalized forms).

---

## Risks Resolved

| Risk | Mitigation | Outcome |
|------|-----------|---------|
| A1 (Med→Low) — Taxonomy correctness | D1 pure module + exhaustive unit tests over every row and all edge cases | RESOLVED: no synonym collisions; 30 unique normalized forms |
| A4 (High→Med) — TOCTOU race | D3: per-engagement `FOR UPDATE` row lock inside `$transaction` serializes read-check+insert | RESOLVED: harmful two-APPROVED end-state unreachable from concurrent CREATEs |
| R2 (Med) — Review flow regression | No call to guard in review-document-request path; R2-a test proves review still succeeds | RESOLVED: review unchanged, guard not invoked |
| R3 (Med) — Seller visibility regression | `canViewAll` / `buildAssignedDocumentEngagementWhere` unchanged in list queries | RESOLVED: seller-scoped visibility preserved |
| R1 (Low) — Free-text behavior regression | `otro` bypass preserves all non-conflicting titles; stored as original input (not normalized) | RESOLVED: free-text flow untouched; R1-a/b tests prove it |

---

## Next Slice

**Deferred from proposal**: Stage 23.3/23.4 or next confirmed P0 (pending MVP prioritization). This slice completes the foundational duplicate-guard layer for document requests. Future work may include:
- Owner-facing taxonomy display (not UI editor, just informational labeling)
- OCR/scanning integration (out of scope per original contract)
- Document panel redesign (out of scope per original contract)

---

## Archive Metadata

- **Change Name**: `20-12-document-duplicate-guard`
- **Archive Date**: 2026-06-23
- **Archive Type**: In-place (no folder move)
- **Merged Commit**: cf81c7a (PR #180 → develop)
- **Verify Verdict**: PASS (0 CRITICAL, 3 WARNING, 2 SUGGESTION)
- **Canonical Specs**: Not merged (no canonical spec store in repo)
- **Archive Folder**: N/A (repo convention: changes remain in-place)
- **Warnings Summary**: W1 (seed path corrected in archive), W2 (test LOC overrun, quality-positive), W3 (dialog stub, production path verified real)

---

## Traceability Note

This archive report records all SDD artifacts (proposal, spec, design, tasks, apply-progress, verify-report) via Engram observation IDs (#4461–#4472) and filesystem paths for cross-session recovery. Both backends (Engram + OpenSpec files) are synchronized as of 2026-06-23.

The SDD cycle for Stage 20.12 is **COMPLETE and CLOSED**.

**Ready for the next change.**
