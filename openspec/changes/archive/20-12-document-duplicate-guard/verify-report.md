# Verification Report — Stage 20.12 Document Duplicate Guard

## Meta

- **Change**: 20-12-document-duplicate-guard
- **Branch**: feat/stage-20-12-document-duplicate-guard
- **Artifact store**: hybrid (this file + Engram `sdd/20-12-document-duplicate-guard/verify-report`)
- **Mode**: Strict TDD verify (active)
- **Date**: 2026-06-23
- **Verdict**: **PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 2 SUGGESTION)

---

## Executive Summary

The duplicate guard is correctly implemented, server-side, inside a per-engagement
`SELECT ... FOR UPDATE` transaction. The taxonomy resolver is pure, collision-free (30 synonyms →
30 unique normalized forms), and covers all 9 canonical types + `otro` fallback. All 18 spec
scenarios are mapped to real passing tests. A mutation test proved the guard tests genuinely fail
when the guard is neutralized. All gates green: 22/22 taxonomy unit, 28/28 documents e2e (15
pre-existing + 13 new), 25/25 FE component, API typecheck clean, oxlint clean, no schema change, no
migration. Warnings are non-blocking: a stale audit claim in apply-progress (seed file path), a
large test-LOC overrun vs forecast (quality-positive), and a known FE-test stub for the create
dialog (production 409→toast path confirmed real and uncovered behavior is acceptable).

---

## Completeness — Tasks

All 68 tasks across 9 phases are checked complete in `tasks.md`. Code state matches:

| Phase | Tasks | State |
|-------|-------|-------|
| 1 — Pre-impl audit | 1.1–1.9 | Complete (one stale finding, see W1) |
| 2 — Taxonomy unit tests (RED) | 2.1–2.23 | Complete — 22 tests exist and pass |
| 3 — Taxonomy module (GREEN) | 3.1–3.6 | Complete — module exists, typechecks |
| 4 — Repo port + Prisma impl | 4.1–4.6 | Complete — port + impl in `$transaction` |
| 5 — Use-case wiring | 5.1–5.6 | Complete — otro bypass + guarded path + 409 map |
| 6 — API integration tests | 6.1–6.16 | Complete — 13 new tests pass |
| 7 — FE 409 surfacing | 7.1–7.4 | Complete — toast test passes |
| 8 — Regression coverage | 8.1–8.4 | Complete (one stale finding, see W1) |
| 9 — Verification gates | 9.1–9.7 | Complete — all gates re-run green here |

No unchecked implementation tasks. Diff scope (7 files) matches the Phase 9.5 allowlist exactly.

---

## Build / Tests / Coverage Evidence

| Gate | Command | Result |
|------|---------|--------|
| Taxonomy unit | `pnpm --filter @viewpro/api test document-taxonomy` | **22/22 PASS** (178ms) |
| Documents e2e | `pnpm --filter @viewpro/api test documents.e2e` | **28/28 PASS** (15 pre-existing + 13 new, 2 files, 7.3s) |
| FE component | `pnpm --filter next-shadcn-dashboard-starter test property-document-requests` | **25/25 PASS** (incl. 409 toast, 3.7s) |
| API typecheck | `pnpm --filter @viewpro/api typecheck` | **0 errors** |
| FE lint | `pnpm --filter next-shadcn-dashboard-starter lint` (oxlint) | **0 warnings / 0 errors** |
| Schema | `git diff … schema.prisma` (slice commits) | **UNCHANGED** |
| Migrations | `git diff --name-only … prisma/migrations` | **NONE added** |

Coverage tool: not run as a dedicated gate (the project does not configure a coverage threshold for
these packages). Coverage analysis skipped — informational only, not blocking.

---

## Spec Compliance Matrix (18 scenarios — all runtime-verified)

| Scenario | Group | Covering test (layer) | Status |
|----------|-------|------------------------|--------|
| T1-a exact synonym → canonical | T | `document-taxonomy.spec.ts` resolver rows (unit) | PASS |
| T1-b unmatched → otro | T | spec.ts "falls through to otro" (unit) | PASS |
| T2-a case-insensitive | T | spec.ts T2-a (unit) | PASS |
| T2-b accent-insensitive | T | spec.ts T2-b (unit) | PASS |
| T2-c whitespace trimmed | T | spec.ts T2-c (unit) | PASS |
| T2-d accent + case | T | spec.ts T2-d (unit) | PASS |
| T2-e `cédula` → dni | T | spec.ts T2-e (unit) | PASS |
| T2-f `Planos` → plano | T | spec.ts T2-f (unit) | PASS |
| G1-a APPROVED conflict blocked (409, no row) | G | e2e "rejects creation when an APPROVED…" (e2e) | PASS |
| G1-b PENDING allows | G | e2e "allows … PENDING" (e2e) | PASS |
| G1-c SUBMITTED allows | G | e2e "allows … SUBMITTED" (e2e) | PASS |
| G1-d REJECTED allows | G | e2e "allows … REJECTED" (e2e) | PASS |
| G1-e CANCELLED allows | G | e2e "allows … CANCELLED" (e2e) | PASS |
| G2-a different engagement allows | G | e2e "allows creation on engagement B…" (e2e) | PASS |
| G3-a otro always allowed | G | e2e "allows … any free-text (otro)…" (e2e) | PASS |
| G3-b typo → otro allowed | G | e2e "near-typo (not a synonym)…" (e2e) | PASS |
| G4-a direct API blocked (4xx) | G | e2e "direct API call … returns 409" (e2e) | PASS |
| R1-a free-text creates, stored as-is | R | e2e "allows any valid title… stored as-is" (e2e) | PASS |
| R1-b 200-char not rejected | R | e2e "does not reject … 200 characters" (e2e) | PASS |
| R2-a review still succeeds, guard not invoked | R | e2e "review-document-request still succeeds" (e2e) | PASS |
| R3-a seller visibility unchanged | R | e2e "seller without canViewAll…" (e2e) | PASS |

(21 rows = 18 spec scenarios; the spec enumerates 8 T + 10 G + 3 R = 21 numbered scenarios. The
"18" framing in the brief collapses some; every numbered scenario is mapped and green.)

---

## Adversarial Correctness Findings

### 1. Taxonomy correctness — PASS
- 9 canonical types + `otro` fallback, union type matches spec T1 exactly.
- `normalizeDocumentTitle`: NFD → diacritic strip (`/[̀-ͯ]/g`) → lowercase → trim, in that order
  (`document-taxonomy.ts:31-37`). Matches spec T2.
- **No synonym collisions**: verified programmatically — 30 synonyms across 9 keys produce 30
  unique normalized forms. Every stored synonym is already pre-normalized. No normalized synonym
  maps to two canonical keys.
- Per-key counts match spec T1: escritura 4, dni 4, plano 4, impuesto_municipal 4,
  reglamento_copropiedad 3, expensas 3, boleto_compraventa 3, constancia_servicios 3,
  informe_dominio 2.

### 2. Guard correctness — PASS
- Block fires ONLY when an APPROVED request of the same canonical key exists on the SAME engagement
  (`prisma-documents.repository.ts:205-219`): `findMany WHERE propertyEngagementId AND status =
  APPROVED`, then `some(resolveCanonicalType(title) === canonicalKey)`.
- PENDING / SUBMITTED / REJECTED / CANCELLED do NOT block (status filter is `APPROVED` only; e2e
  G1-b..e confirm 201 at runtime).
- `otro` NEVER reaches the guard: use-case branches to plain `createRequest` when
  `canonicalKey === 'otro'` (`create-document-request.use-case.ts:63-65`).
- **TOCTOU**: the check is INSIDE the transaction. `runCreateWithDuplicateGuard` opens
  `prisma.$transaction`, takes `SELECT id FROM property_engagements WHERE id = … FOR UPDATE`
  FIRST (`prisma-documents.repository.ts:197-202`), THEN reads APPROVED titles, THEN inserts —
  all atomic per engagement. No check-outside-lock hole.

### 3. Test integrity — PASS (mutation-proven)
- Mutation test: neutralized the guard (`const hasConflict = false && …`) and re-ran the e2e
  suite. Result: **exactly the 2 block tests failed** (G1-a and G4-a: "expected 409, got 201");
  the other 26 stayed green. This proves the block tests are not tautological and would catch a
  removed or inverted guard. File restored afterward.
- The G1-a test produces a REAL APPROVED row by seeding SUBMITTED then calling the real
  `POST /approve` endpoint (not a direct DB write), then asserts 409 + `errorCode` +
  `count(PENDING) === 0`. Genuine end-to-end assertion.
- FE 409 test uses a stub for `CreateDocumentRequestDialog` to bypass Radix Select in jsdom — see
  W3; the production 409→toast path is confirmed real and the residual uncovered behavior
  (the dialog's own field UI) is acceptable for this slice.
- Assertion Quality Audit: no tautologies, no ghost loops, no orphan empty-array checks, no
  assertion-without-production-call. All assertions exercise real code paths.

### 4. Error contract — PASS
- `DuplicateApprovedDocumentError` is a pure domain sentinel (`documents.repository.ts:15-22`, no
  NestJS dependency). The use case maps it to `ConflictException` (409) with
  `{ errorCode: 'DOCUMENT_DUPLICATE_APPROVED', message: … }`
  (`create-document-request.use-case.ts:72-79`), mirroring the documents-module 409 convention
  (`prisma-documents.repository.ts:58` storage-limit) and the status-change sibling.

### 5. Scope / schema — PASS
- Production code: **165 insertions, 4 deletions** across 4 files (well within budget).
- No `schema.prisma` change, no migration added (verified against slice commits 651c142^..fc15a33).
- 7 changed files exactly match the Phase 9.5 allowlist. No unrelated files.

### 6. Gates re-run independently — PASS (see Build/Tests table above).

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress documents RED→GREEN per phase, 3 commits |
| All tasks have tests | ✅ | taxonomy unit (22) + e2e (13 new) + FE (1) |
| RED confirmed (tests exist) | ✅ | both test files present and exercised |
| GREEN confirmed (tests pass) | ✅ | 22/22 + 28/28 + 25/25 on independent re-run |
| Triangulation adequate | ✅ | every canonical row has ≥1 synonym test; all 5 statuses + cross-engagement + otro + typo |
| Mutation resistance | ✅ | guard-disabled run fails exactly the 2 block tests |

**TDD Compliance: 6/6 checks passed.**

---

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 22 | 1 (`document-taxonomy.spec.ts`) | vitest |
| Integration / E2E (HTTP) | 13 new (28 total in file) | 1 (`documents.e2e-spec.ts`) | vitest + supertest + real Postgres |
| Component (DOM) | 1 new (25 total in file) | 1 (`property-document-requests.test.tsx`) | vitest + testing-library |

---

## Issues

### CRITICAL — none (0)

### WARNING (3)

- **W1 — Stale audit claim in apply-progress (seed file).** Audit A8 / task 8.4 recorded
  "`seed-demo.mjs` does not exist → no seed concern". The file DOES exist at
  `viewpro-app/apps/api/scripts/seed-demo.mjs` (the audit looked under `viewpro-app/scripts/`).
  Impact is benign: the seed seeds exactly ONE APPROVED request per engagement
  ("Boleto de compra-venta aprobado" on property 0) via direct `client.documentRequest.create`,
  which never invokes the guard, so no seed collision is possible. The CONCLUSION (no seed change
  needed) is correct; only the path/justification was wrong. Recommend correcting the audit note
  before archive for an honest record.

- **W2 — Test LOC far exceeds forecast.** Total slice diff is 786 insertions / 5 deletions ≈ 791
  changed lines vs the ~283 forecast. Production code is only 165 lines (on budget); the overrun
  is entirely test code (621 lines), driven by the e2e file adding 437 lines vs the ~90 forecast.
  More tests is a quality positive, not a defect, but the forecast was materially off. For PR-size
  budgeting this still sits within a single reviewable PR because the bulk is repetitive
  seed-and-assert e2e blocks; no security-boundary file is touched.

- **W3 — FE create-dialog is stubbed in the 409 test.** `property-document-requests.test.tsx:34-50`
  replaces `CreateDocumentRequestDialog` with a button that calls `onSubmit` directly, to avoid
  Radix Select limitations in jsdom. This means the dialog's own field rendering/validation is not
  exercised by the 409 test. The PRODUCTION 409→toast path IS real and verified: `service.ts`
  `parseJsonResponse` extracts `body.message` and throws `Error(message)` for non-ok responses, and
  the component `onError` calls `toast.error(error.message)`. The stub only bypasses the dialog UI,
  not the error-surfacing chain. Acceptable for this slice; the dialog UI is covered by other tests
  in the same file.

### SUGGESTION (2)

- **S1 — Coverage threshold not enforced.** No per-file coverage gate is configured for these
  packages, so changed-file coverage was not measured. Behavior coverage is strong via the matrix
  above; a future hardening pass could add a coverage threshold for the documents module.

- **S2 — A2 gap (two identical `otro` free-text titles) is intentionally open.** Per spec A2 the
  guard does not dedupe two semantically-identical `otro` titles. This is by design (closing it
  needs semantic matching, out of scope). Noted so archive does not mistake it for a defect.

---

## Design Coherence

| Design decision | Implementation | Coherent? |
|---|---|---|
| D1 pure taxonomy module | `document-taxonomy.ts` pure, no I/O | ✅ |
| D2 compute-on-read, no schema | guard reads APPROVED titles, resolves in app code | ✅ |
| D3 per-engagement `FOR UPDATE` in `$transaction` | `prisma-documents.repository.ts:197-202` | ✅ |
| D4 409 `{errorCode,message}` | use-case maps sentinel → ConflictException | ✅ |
| D5 single PR, ~283 LOC | production on budget; tests over (W2) | ⚠️ (W2) |
| No migration / no flag | confirmed unchanged | ✅ |

---

## Final Verdict

**PASS WITH WARNINGS** — 0 CRITICAL, 3 WARNING, 2 SUGGESTION. Cleared for PR. The 3 warnings are
documentation/forecast/test-shape notes, none of which block archive. Recommend correcting the W1
audit note for an honest archive record.

**Next recommended**: sdd-archive.
