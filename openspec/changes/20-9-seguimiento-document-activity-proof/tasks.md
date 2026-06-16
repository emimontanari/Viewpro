# Tasks — Stage 20.9 Seguimiento Document Activity Proof

**Spec:** 13 FRs, 16 scenarios.
**Design:** single-PR, size:exception (~530 LOC additive). APPROVED + CANCELLED seed included per D1.

---

## Review Workload Forecast

| Dimension | Value |
|---|---|
| Estimated changed lines | ~530 |
| Files touched | 4 (1 new, 3 extended) |
| Chained PRs recommended | No |
| 400-line budget risk | High — single cohesive proof slice |
| Suggested split | single-pr-with-size-exception |
| Decision needed before apply | No — design resolved: `size:exception` |

---

## Phase 1 — Pre-implementation audit (sequential, must complete before Phase 2–5)

**[x] T-1** — Read `compareActivityItems` (or the sort comparator) in `list-activity-feed.use-case.ts`; confirm tie-break direction (id desc vs asc). If the implementation uses id-asc, scope S-13 to the actual behavior and flag as a verify-phase finding. Done-when: tie-break direction is documented in apply-progress.
- Satisfies: FR-9 risk mitigation (design §10, risk 2).
- Depends on: nothing.

**[x] T-2** — `rg` for count-coupled literals: search for `Document requests:`, `documentRequestsCount`, `result.total`, `expectedTotal` across `apps/api/test/` and `apps/app-new/tests/`. Confirm no assertion ties to a hardcoded doc-request total that will shift with the APPROVED/CANCELLED seed additions. Document findings in apply-progress. Done-when: list is empty or each hit is confirmed safe.
- Satisfies: spec §Non-Functional Notes (pre-audit), FR-11 risk.
- Depends on: nothing.

**[x] T-3** — Open `apps/app-new/src/features/activity/components/` and find an existing test that imports `next/link` (e.g. `activity-feed.test.tsx`, `activity-filters.test.tsx`). Confirm `next/link` compiles and renders a real `<a>` in JSDOM with no extra vitest config. If no sibling uses `next/link`, add a minimal `mock('next/link', ...)` passthrough at the top of the new test file plan. Done-when: the approach for `next/link` in JSDOM is confirmed and documented in apply-progress.
- Satisfies: design §3.1 No mock requirements, risk 1.
- Depends on: nothing.

---

## Phase 2 — Component test (single commit, after Phase 1 completes)

**[x] T-4** — Create `apps/app-new/src/features/activity/components/activity-document-request-feed-item.test.tsx`. Add imports and define the `buildDocumentRequestItem` typed fixture helper (default: PENDING status, UPLOADED version, non-null owner and requester). Done-when: file compiles with no TS errors.
- Satisfies: FR-1 through FR-6 setup.
- Depends on: T-1, T-2, T-3.

**[x] T-5** — Write S-1: `renders PENDING status badge with amber tone`. Override: none (default). Assert badge text "Pendiente" and `className` matches `/bg-amber-50/`. Done-when: test passes.
- Satisfies: FR-1, FR-2.
- Depends on: T-4.

**[x] T-6** — Write S-2: `renders SUBMITTED status badge with sky tone`. Override: `documentRequest.status: 'SUBMITTED'`. Assert "Subida" + `/bg-sky-50/`. Done-when: test passes.
- Satisfies: FR-1, FR-2.
- Depends on: T-4.

**[x] T-7** — Write S-3: `renders APPROVED status badge with emerald tone`. Override: `documentRequest.status: 'APPROVED'`. Assert "Aprobada" + `/bg-emerald-50/`. Done-when: test passes.
- Satisfies: FR-1, FR-2.
- Depends on: T-4.

**[x] T-8** — Write S-4: `renders REJECTED status badge with red tone`. Override: `documentRequest.status: 'REJECTED'`. Assert "Rechazada" + `/bg-red-50/`. Done-when: test passes.
- Satisfies: FR-1, FR-2.
- Depends on: T-4.

**[x] T-9** — Write S-5: `renders CANCELLED status badge with muted tone`. Override: `documentRequest.status: 'CANCELLED'`. Assert "Cancelada" + `/bg-muted\/50/`. Done-when: test passes.
- Satisfies: FR-1, FR-2.
- Depends on: T-4.

**[x] T-10** — Write S-6: `renders PENDING_UPLOAD version label`. Override: `currentVersion.status: 'PENDING_UPLOAD'`. Assert "Pendiente de carga" scoped under "Estado del archivo" section. Done-when: test passes.
- Satisfies: FR-3.
- Depends on: T-4.

**[x] T-11** — Write S-7: `renders UPLOADED version label`. Override: none (default). Assert "Subida" scoped under version section. Done-when: test passes.
- Satisfies: FR-3.
- Depends on: T-4.

**[x] T-12** — Write S-8: `renders APPROVED version label`. Override: `currentVersion.status: 'APPROVED'`. Assert "Aprobada" scoped under version section. Done-when: test passes.
- Satisfies: FR-3.
- Depends on: T-4.

**[x] T-13** — Write S-9: `renders REJECTED version label`. Override: `currentVersion.status: 'REJECTED'`. Assert "Rechazada" scoped under version section. Done-when: test passes.
- Satisfies: FR-3.
- Depends on: T-4.

**[x] T-14** — Write S-10: `renders "Sin archivo cargado" when currentVersion is null`. Override: `documentRequest.currentVersion: null`. Assert `getByText('Sin archivo cargado')` present; assert no `.pdf` filename text rendered. Done-when: test passes.
- Satisfies: FR-4.
- Depends on: T-4.

**[x] T-15** — Write S-11: `renders fallback strings and correct link target`. Override: `owner: null`, `requestedBy: { id: 'r-1', firstName: null, email: '' }`. Assert "Propietario" text visible, "Solicitante no disponible" visible, and link `href === '/dashboard/product/engagement-42'`. Done-when: test passes.
- Satisfies: FR-5, FR-6.
- Depends on: T-4.

**[x] T-16** — Write edge tests 12–13: (12) `renders "Solicitud no disponible" when documentRequest is null` — override `documentRequest: undefined`, assert badge text "Solicitud no disponible". (13) `renders "Propiedad sin título" when property.title is blank` — override `property.title: '   '`, assert `getByText('Propiedad sin título')`. Done-when: both tests pass.
- Satisfies: FR-5.
- Depends on: T-4.

**[x] T-17** — Write owner-name fallback edge tests 14–16: (14) snapshot names preferred over user names; (15) user firstName fallback when snapshot is blank; (16) email fallback when both name sources are blank. Use override shapes from design §5. Done-when: all three pass.
- Satisfies: FR-5.
- Depends on: T-4.

**[x] T-18** — Run `pnpm app-new test` (or the workspace equivalent) and confirm all app-new unit tests GREEN (baseline 403+ tests + 16 new). Done-when: exit 0 with no failures.
- Satisfies: quality gate before commit.
- Depends on: T-5 through T-17.

---

## Phase 3 — Use case test additions (single commit, parallel with Phase 2 after T-1 completes)

**[x] T-19** — In `apps/api/test/analytics.use-cases.spec.ts`, add an `it.each` test block covering SUBMITTED, APPROVED, REJECTED, and CANCELLED doc statuses (PENDING already exists at line ~369). For each status, construct a fixture overriding `status` and the `document`/`documents` relation per design §3.2 (SUBMITTED→UPLOADED version, APPROVED→APPROVED version + `reviewedByUserId`, REJECTED→REJECTED version + `rejectionReason`, CANCELLED→null document). Assert mapped shape: `kind: 'document_request'`, `documentRequest.status`, `currentVersion.status` (or null). Done-when: `it.each` 4 cases all GREEN.
- Satisfies: FR-7, FR-8, S-12.
- Depends on: T-1 (to confirm sort behavior before writing sort test).

**[x] T-20** — Add mixed-kind sort test S-13 in `analytics.use-cases.spec.ts`: 1 movement at `2026-05-22T11:30:00Z` + 1 doc at `2026-05-22T11:00:00Z` + 1 doc at `2026-05-22T12:00:00Z`. Call `execute` with `kind: 'all'`. Assert `result.items[0].createdAt === '2026-05-22T12:00:00Z'`, `[1].createdAt === '2026-05-22T11:30:00Z'`, `[2].createdAt === '2026-05-22T11:00:00Z'`. Add tie-break sub-case (two items, same `createdAt`, IDs `'a-id'` and `'z-id'`) asserting order matches the direction confirmed in T-1. Done-when: test passes.
- Satisfies: FR-9, S-13.
- Depends on: T-1.

**[x] T-21** — Run `pnpm @viewpro/api test` and confirm API tests GREEN (baseline 671+ + 2 new). Done-when: exit 0.
- Satisfies: quality gate before commit.
- Depends on: T-19, T-20.

---

## Phase 4 — Seed additions (single commit, after Phase 3 quality gate)

**[x] T-22** — In `apps/api/scripts/seed-demo.mjs`, extend the `reviewedByUserId` conditional inside `createDemoDocumentReviewStates` from REJECTED-only to REJECTED-or-APPROVED per design §3.3 diff. Done-when: conditional updated; file compiles (`node --check`).
- Satisfies: design D1 APPROVED fixture requirement (risk 3 mitigation).
- Depends on: T-21.

**[x] T-23** — Add APPROVED doc fixture to the Villa Centenario fixtures array inside `createDemoDocumentReviewStates`: title `'Boleto de compra-venta aprobado'`, status `APPROVED`, version `APPROVED`, filename `boleto-compraventa-aprobado-demo.pdf`, anchored at `daysAgo(4)` / `daysAgo(3)` / `daysAgo(2)`. Done-when: fixture block added; no syntax errors.
- Satisfies: FR-10, S-14.
- Depends on: T-22.

**[x] T-24** — Add CANCELLED doc fixture as a separate `client.documentRequest.create` block after the fixtures loop on Villa Centenario: title `'Plano municipal (solicitud cancelada)'`, status `CANCELLED`, no version row, requester `martin.demo@viewpro.local`, anchored at `daysAgo(12)`. Done-when: block added; no syntax errors.
- Satisfies: FR-10 (lifecycle coverage), design D1.
- Depends on: T-22.

**[x] T-25** — Update the seed summary log line at ~line 2063 atomically: append `+ Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario` to the existing comment string. Done-when: log line updated; count is driven by `result.documentRequestsCount` (dynamic, not hardcoded).
- Satisfies: FR-11, design D1 seed-log honesty.
- Depends on: T-23, T-24.

**[x] T-26** — Run `pnpm demo:seed` and confirm: exit 0, the `Document requests:` log line prints the new total, no unexpected Prisma errors. Done-when: seed log output is accurate.
- Satisfies: FR-11, S-14.
- Depends on: T-25.

**[x] T-27** — Re-run T-2 audit assertions post-seed: confirm no count assertions shifted unexpectedly. If any test assertion now references a stale count, update it atomically in this commit. Done-when: T-2 hit list re-confirmed clean, or updated tests re-run GREEN.
- Satisfies: spec §Non-Functional Notes pre-audit contract.
- Depends on: T-26.

---

## Phase 5 — Seeded smoke (single commit, after Phase 4)

**[x] T-28** — In `apps/app-new/tests/seeded/demo-smoke.spec.ts`, add a new `test.describe('Seguimiento document activity (Stage 20.9)', ...)` block with `test.describe.configure({ mode: 'serial' })`. Write S-15: sign in as manager, navigate to `/dashboard/seguimiento`, click "Documentos" pill, assert a card with `'Solicitud documental'` header badge is visible, assert a lifecycle status label is visible, assert `'Ver propiedad'` link `href` matches `/^\/dashboard\/product\/[a-f0-9-]+$/`. Done-when: test written; structure matches design §3.4.
- Satisfies: FR-12, S-15.
- Depends on: T-26.

**[x] T-29** — Write S-16 in the same describe block: sign in as manager, navigate to `/dashboard/seguimiento`, click "Documentos" pill, assert `allHeaderBadges.count() > 0` (all visible cards carry `'Solicitud documental'`), assert `page.getByText('Ingresó una consulta calificada')` has count 0 (no movement-only cards visible). Done-when: test written.
- Satisfies: FR-13, S-16.
- Depends on: T-28.

**[x] T-30** — Run `pnpm test:seeded` (or workspace equivalent). Confirm ≥27 GREEN (25 baseline + 2 new: S-15, S-16). Confirm owner-portal Test 5 still GREEN (no movement strings leaked from doc activity). Done-when: all ≥27 tests pass, no regression.
- Satisfies: quality gate; risk 5 mitigation (owner-portal Test 5).
- Depends on: T-28, T-29.

---

## Phase 6 — Verification gates (after all phases, before PR)

**[x] T-N1** — Run `pnpm db:validate` + `pnpm typecheck` + `pnpm @viewpro/api test`. All exit 0. Done-when: no type or schema errors; API test count ≥ 673.
- Depends on: T-27.

**[x] T-N2** — Run `pnpm app-new lint:strict` + `pnpm app-new test`. All exit 0. App-new test count ≥ 419 (403 baseline + 16 new). Done-when: no lint errors, no test failures.
- Depends on: T-18.

**[x] T-N3** — Run `pnpm demo:seed`. Confirm exit 0 and log output includes `APPROVED and CANCELLED fixtures on Villa Centenario`. Done-when: log is accurate and human-readable.
- Depends on: T-26.

**[x] T-N4** — Run `pnpm test:seeded`. Confirm ≥27/27 GREEN. Done-when: exit 0 with ≥27 passed.
- Depends on: T-30.

**[x] T-N5** — Sanity inversion: temporarily change `documentStatusLabels.CANCELLED` to `'WRONG_LABEL'` in the source; run S-5 test; confirm it FAILS. Restore the original value; confirm GREEN. Done-when: failure confirmed then restored and GREEN.
- Satisfies: test integrity verification; proves tests catch real regressions.
- Depends on: T-9.

---

## Acceptance checklist

| Item | Task | Done |
|---|---|---|
| S-1 PENDING badge with amber tone | T-5 | [x] |
| S-2 SUBMITTED badge with sky tone | T-6 | [x] |
| S-3 APPROVED badge with emerald tone | T-7 | [x] |
| S-4 REJECTED badge with red tone | T-8 | [x] |
| S-5 CANCELLED badge with muted tone | T-9 | [x] |
| S-6 PENDING_UPLOAD version label | T-10 | [x] |
| S-7 UPLOADED version label | T-11 | [x] |
| S-8 APPROVED version label | T-12 | [x] |
| S-9 REJECTED version label | T-13 | [x] |
| S-10 null version fallback | T-14 | [x] |
| S-11 fallback strings + link href | T-15 | [x] |
| Edge: null documentRequest | T-16 | [x] |
| Edge: blank property.title | T-16 | [x] |
| Edge: owner name precedence (3 cases) | T-17 | [x] |
| S-12 mapper shape for all 5 doc statuses | T-19 | [x] |
| S-13 mixed-kind sort + id tie-break | T-20 | [x] |
| S-14 APPROVED seed fixture present | T-23 | [x] |
| CANCELLED seed fixture present | T-24 | [x] |
| Seed log accurate | T-25 | [x] |
| S-15 doc card renders in smoke | T-28 | [x] |
| S-16 Documentos filter scopes to doc cards | T-29 | [x] |
| No new dependency introduced | all | [x] |
| No UI production component changed | all | [x] |
| Seed log honesty preserved | T-25 | [x] |

---

## Task dependency summary

```
T-1, T-2, T-3 (parallel)
       │
       ▼
T-4 → T-5..T-17 (parallel after T-4)
       │
       ▼
T-18 (gate: app-new GREEN)
       │
       ▼
T-19, T-20 (parallel, both need T-1 for sort direction)
       │
       ▼
T-21 (gate: API tests GREEN)
       │
       ▼
T-22 → T-23 → T-25
T-22 → T-24 → T-25
              │
              ▼
             T-26 → T-27 (gate: seed clean + count audit)
                    │
                    ▼
             T-28 → T-29 → T-30 (gate: seeded smoke ≥27 GREEN)
                           │
                           ▼
              T-N1, T-N2, T-N3, T-N4, T-N5 (final gates)
```
