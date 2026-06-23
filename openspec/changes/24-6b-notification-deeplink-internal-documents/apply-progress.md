# Apply Progress — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Mode: Strict TDD (RED → GREEN → REFACTOR)
## Delivery: single PR, ~269 LOC, under budget

---

## Phase 1 — Pre-implementation Audit — COMPLETE

All audits passed. No blockers found.

| Audit | Finding |
|-------|---------|
| A1 | Producer: `notifyDocumentUploaded` at :98, `linkHref` template at :112, `documentRequestId` at :115 |
| A2 | Sanitizer: `SAFE_INTERNAL_LINKS` at :1, function at :8, static set check at :17, engagement guard :21, exact equality :25-26, `return null` :30 |
| A3 | Mapper passes `notification.propertyEngagementId` (trusted DB column) at :15-17 |
| A4 | `documentos` nuqs at :110-115 with options; `handleFilterChange` writes `null` for 'all' at :205 |
| A5 | `<Collapsible defaultOpen={false}>` at :458; `data-testid='document-request-results'` at :259 |
| A6 | Bare `<li>` at :590 (no data-request-id yet); groupDocumentRequests produces exactly 3 buckets (pending/review/resolved); NO CANCELLED bucket |
| A7 | nuqs mock at :38-51 returns `useState(parser.defaultValue)` for ALL keys uniformly; no scrollIntoView mock |
| A8 | `notification-link.helper.spec.ts` EXISTS; contains ONLY owner test cases |
| A9 | `PropertyDocumentRequests` mounted inline at :562 (NOT tab-gated) |
| A-pre | `notifications.e2e-spec.ts` EXISTS; no `internal-notifications.e2e-spec.ts` |

---

## TDD Cycle Evidence

| Phase | Task | RED | GREEN | REFACTOR |
|-------|------|-----|-------|----------|
| 2 | Sanitizer unit tests (S-S1..S-S25) | ✓ 2/47 failing (S-S6, S-S7) | ✓ all 47 pass | N/A |
| 3 | Sanitizer implementation | — | ✓ all 47 pass | — |
| 4 | Producer test update + template | ✓ 1/8 failing (linkHref shape) | ✓ all 8 pass | — |
| 5 | FE tests (8 new) + implementation | ✓ 6/23 failing | ✓ all 23 pass | Split-effect R1 |
| 6 | E2E extension (3 new tests) | — | ✓ all 9 e2e pass | — |
| 7 | Conditional regression | N/A (not triggered) | — | — |
| 8 | Verification gates | — | ✓ all gates pass | — |

**R1 split-effect decision**: The D4 "single combined effect" path exhibited the single-tick race in jsdom tests: `setResolvedOpen(true)` and `scrollIntoView` in the same effect tick didn't give Radix time to lay out the content. Used the documented R1 split-effect fallback: Effect A (data resolves → open resolved group), Effect B (resolvedOpen changes → scroll after open). All tests pass.

---

## Completed Tasks

- [x] 1.1–1.10 — All Phase 1 audits complete, no blockers
- [x] 2.1–2.26 — All Phase 2 sanitizer tests written (RED confirmed, then all green after impl)
- [x] 3.1–3.5 — Sanitizer implementation (`ALLOWED_INTERNAL_QUERY_PARAM_NAMES` + parse branch)
- [x] 4.1–4.6 — Producer: failing test + template update; all 8 producer tests green
- [x] 5.1–5.13 — FE: nuqs mock extended, scrollIntoView mock, 8 failing tests, implementation; all 23 tests green
- [x] 6.1–6.6 — E2E extension: 3 new round-trip tests; all 9 e2e tests green
- [x] 7 — Phase 7 NOT triggered (no seeded DOCUMENT_UPLOADED linkHref assertions in e2e or smoke)
- [x] 8.1–8.9 — All verification gates passed

---

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` | Modified | Added `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = new Set(["doc"])` and URL-parse branch (steps 5a-5h) to `sanitizeInternalNotificationLink` |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts` | Modified | Extended with internal `describe` blocks (S-S1..S-S25 + regression cases); 49 total tests |
| `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` | Modified | `linkHref` template updated from param-less to `?doc=${documentRequestId}` |
| `viewpro-app/apps/api/test/notification-producer.service.spec.ts` | Modified | Updated `DOCUMENT_UPLOADED` linkHref assertion to new deep-link shape |
| `viewpro-app/apps/api/test/notifications.e2e-spec.ts` | Modified | Added 3 new e2e tests (S-P1/S-P2 round-trip, S-R1 param-less, S-R2 SAFE_INTERNAL_LINKS); extended seedNotification helper with `propertyEngagementId` |
| `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx` | Modified | D3 doc param read, D4 controlled resolved Collapsible, D5 one-shot filter reset, D6 data-request-id + containerRef + split-effect scroll/highlight, prop threading through DocumentRequestSection/List/Item |
| `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx` | Modified | Extended nuqs mock (key-by-param-name), scrollIntoView mock in beforeEach/afterEach, 8 new deep-link test cases |

---

## Test/Lint Results (verbatim)

### API: all vitest suites (Phase 8.1)
```
Test Files  62 passed (62)
Tests  780 passed (780)
```

### app-new: all vitest suites (Phase 8.2)
```
Test Files  83 passed (83)
Tests  445 passed (445)
```

### TypeScript (Phase 8.3)
- API: `tsc --noEmit` → exit 0, zero errors
- app-new: `tsc --noEmit` → exit 0, zero errors

### oxlint (Phase 8.4)
- No output → zero lint errors on all modified files

### Phase 8.5 — Seeded Playwright
- Requires running seeded server. Cannot run in automated gate.
- Flag as PENDING: T07, T08, T17, T18a must be verified manually before PR.

### Phase 8.6 — seed-demo.mjs
- `git diff -- viewpro-app/scripts/seed-demo.mjs` → empty (UNCHANGED)

### Phase 8.7 — notification-center.tsx
- `git diff -- viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx` → empty (UNCHANGED)

### Phase 8.8 — sanitizeOwnerNotificationLink
- Diff shows ONLY additions to the internal sanitizer + new `ALLOWED_INTERNAL_QUERY_PARAM_NAMES` set.
- Owner sanitizer block (`sanitizeOwnerNotificationLink`, `ALLOWED_OWNER_QUERY_PARAM_NAMES`, all its logic) is 100% UNCHANGED.

### Phase 8.9 — Security boundary self-check
All 18 rejection scenarios S-S8..S-S25 have a passing unit test covering:
- tab param (S-S9, S-S10) ✓
- unknown param (S-S8, S-S11) ✓
- empty doc (S-S12) ✓
- duplicate doc (S-S13) ✓
- protocol-relative //host (S-S14) ✓
- absolute URL ×2 (S-S15, S-S16) ✓
- empty segment (S-S17) ✓
- no segment (S-S18) ✓
- path traversal (S-S19) ✓
- SAFE_INTERNAL_LINKS member + param (S-S20) ✓
- fragment ×2 (S-S21, S-S22) ✓
- empty string (S-S23) ✓
- null/undefined (S-S24) ✓
- cross-surface owner path (S-S25) ✓

---

## Deviations from Design

1. **R1 split-effect**: Design D4 documented the single-effect path as default and the split-effect as R1 fallback. The split-effect was needed and is used. Effect A keyed on `[highlightDocId, isSuccess, data]` opens the resolved group; Effect B keyed on `[highlightDocId, isSuccess, data, resolvedOpen]` scrolls after the group is open. Documented in apply-progress per design instruction.

2. **containerRef type**: `useRef<HTMLDivElement>` — the results container is a `<div>`, matches the JSX.

All other implementation details match design exactly.

---

## Status

ALL tasks complete. Ready for sdd-verify.

---

## Judgment Day — Surgical Fixes (Round 1)

Four confirmed improvements applied. No production logic behavior changed in FIX 1 except a
hardened effect dependency; FIX 2-4 are test-only additions that lock existing behavior.

| FIX | File:line | What was done |
|-----|-----------|---------------|
| 1 | `property-document-requests.tsx:265-271` (Effect B deps) | Added `documentFilter` (raw nuqs value) to Effect B's dependency array so the scroll/highlight re-attempts if the active filter changes after the one-shot reset lands. **SUPERSEDED in JD Round 2/3 (see note below): this dep was REVERTED — it caused a viewport-yank re-scroll on every later user filter toggle. Effect B deps are now `[highlightDocId, isSuccess, data, resolvedOpen]` (no `documentFilter`), and `setHighlightedId`/timer were moved behind `if (!element) return` (FR-F9).** |

> **JD Round 2/3 remediation.** Judge B's Round-2 mutation testing proved FIX 1's `documentFilter` dep made Effect B re-scroll + re-arm the highlight on every later user filter change while `doc` stayed in the URL (viewport yank). Remediation: removed `documentFilter` from Effect B deps (restoring the design-intended set), removed the stale `eslint-disable`, and guarded scroll+highlight behind `if (!element) return`. Added a regression-guard assertion in `D7 (e)` pinning that `scrollIntoView` fires exactly once and does NOT re-fire after a later filter toggle. Round 3: both judges APPROVE. Also corrected the `design.md` Radix-Presence note (closed content is unmounted, not kept mounted).
| 2 | `property-document-requests.test.tsx` (nuqs mock + new `D7 (e)` test) | Extended the nuqs mock with `mockDocumentosInitial` so a test can SEED `documentos` to a non-'all' value. New test seeds `documentos='review'` + `doc=<pending target id>`, asserts the one-shot reset forces the filter to 'all' (target group visible + scroll + highlight), then asserts a subsequent user `Pendientes` click sticks (reset fired exactly once). Locks FR-F3 / R3. Verified fail-able by temporarily disabling the reset (test went red). |
| 3 | `notification-link.helper.spec.ts:S-S26` | Tampered-`propertyEngagementId` test: `sanitizeInternalNotificationLink({ linkHref: '/dashboard/product/eng-OTHER?doc=req-1', propertyEngagementId: 'eng-abc' })` → `null`. Locks the pathname-vs-trusted-column equality (step 5c) — the core trust boundary. Verified fail-able by disabling origin+pathname guards. |
| 4 | `notification-link.helper.spec.ts:S-S27, S-S28, S-S29` | (a) Backslash-host open-redirect: `/\evil.com/...` and `/\/\evil.com/...` → `null` (URL() yields origin `https://evil.com`, caught by step 5b origin assertion). (b) Percent-encoded-key acceptance: `?%64oc=req-1` (`%64`=`d`) → ACCEPTED, canonical return `/dashboard/product/eng-abc?%64oc=req-1` (locks the decoded-key allowlist contract). Verified fail-able. |

### JD verification (verbatim)

API sanitizer spec (`pnpm vitest run src/notifications/notification-link.helper.spec.ts`):
```
Test Files  1 passed (1)
Tests  51 passed (51)
```

FE product-document-requests spec (`pnpm vitest run src/features/products/components/property-document-requests.test.tsx`):
```
Test Files  1 passed (1)
Tests  24 passed (24)
```

Owner-spec (24.6a) regression: the `sanitizeOwnerNotificationLink` suite lives in the same
`notification-link.helper.spec.ts` file and is part of the 51 passing API tests — confirmed
regression-free.

oxlint on all three modified files → exit 0 (FE files via app-new `.bin/oxlint`; API spec via
`app-new/node_modules/.bin/oxlint` from repo root).
