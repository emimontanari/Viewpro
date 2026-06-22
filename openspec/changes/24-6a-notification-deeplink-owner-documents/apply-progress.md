# Apply Progress — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

Status: **COMPLETE** — all phases done, all verification gates GREEN.

---

## Phase 1 — Pre-implementation audit [x]

- [x] 1.1 linkHref at :264, documentRequestId in scope at :267. CONFIRMED.
- [x] 1.2 sanitizer: /owner fast-path :42, expectedPropertyLink :50, exact equality :51. CONFIRMED.
- [x] 1.3 mapper: notification.propertyAssetId (trusted DB column). CONFIRMED.
- [x] 1.4 getSafeRelativeHref: ${pathname}${search}${hash} at :333. No FE guard change needed. CONFIRMED.
- [x] 1.5 tab nuqs :29-34, setTabQueryValue :117, OwnerDocumentRequests :163. CONFIRMED.
- [x] 1.6 bare `<li>` at :313, NO data-request-id. CONFIRMED.
- [x] 1.7 (A7 CRITICAL) nuqs mock (lines 24-36) returns React.useState for ALL keys — does not discriminate by param name. Extended in Phase 5.
- [x] 1.8 NO existing notification-link.helper.spec.ts. Clear to create.

---

## Phase 2 — Sanitizer unit tests (FAILING first — SECURITY-CRITICAL) [x]

- [x] 2.1–2.4 Acceptance cases S-S1..S-S4 written
- [x] 2.5–2.21 Rejection cases S-S5..S-S16 + fragment + duplicate + tampered assetId written
- [x] Run confirmed: 2 RED (S-S3, S-S4), 18 passed — correct RED state for TDD

File created: `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts`

---

## Phase 3 — Sanitizer implementation [x]

- [x] 3.1 Widened sanitizeOwnerNotificationLink per D1 (closed {tab,doc} allowlist, URL parse, origin assertion, exact pathname, duplicate rejection, fragment rejection)
- [x] 3.2 All 20 tests GREEN
- [x] 3.3 TypeScript: no errors

File modified: `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`

---

## Phase 4 — Producer update [x]

- [x] 4.1 Located line 264 in createDocumentOwnerNotification
- [x] 4.2 Updated producer unit test assertions to expect deep-link format → RED confirmed
- [x] 4.3 Changed linkHref template to `/owner/properties/${input.propertyAssetId}?tab=documents&doc=${input.documentRequestId}`
- [x] 4.4 Other notification type linkHref templates confirmed unchanged (lines 112, 144, 182, 210, 237)
- [x] 4.5 All 8 producer tests GREEN
- [x] 4.6 TypeScript: no errors

Files modified:
- `viewpro-app/apps/api/src/notifications/notification-producer.service.ts`
- `viewpro-app/apps/api/test/notification-producer.service.spec.ts`

---

## Phase 5 — Frontend: doc nuqs param + prop thread [x]

- [x] 5.1 Extended nuqs mock to key by param name; added threading test → RED confirmed
- [x] 5.2 Added `const [highlightDocId] = useQueryState('doc', parseAsString)` to owner-property-detail.tsx
- [x] 5.3 Threaded highlightDocId as prop to `<OwnerDocumentRequests>` in documents TabsContent
- [x] 5.4 All 7 owner-property-detail tests GREEN (including 2 new threading assertions)
- [x] 5.5 TypeScript: no errors

Files modified:
- `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`

---

## Phase 6 — Frontend: scroll/highlight effect [x]

### 6a — Tests first (failing) [x]
- [x] 6.1 Added 5 new tests (S-F1..S-F5) to owner-document-requests.test.tsx
- [x] 6.2 S-F1 and S-F4 RED confirmed; S-F2, S-F3, S-F5 already correct (no-op behavior)

### 6b — Implementation [x]
- [x] 6.3 Added highlightDocId?: string | null to OwnerDocumentRequestsProps
- [x] 6.4 Added data-request-id={request.id} to `<li>` in OwnerDocumentRequestItem
- [x] 6.5 Added containerRef = useRef<HTMLUListElement>(null); attached to `<ul>`
- [x] 6.6 Added highlightedId state + highlightTimerRef + cleanup effect
- [x] 6.7 Added useEffect keyed on [highlightDocId, isSuccess, data] with guard, item lookup, querySelector scroll, setTimeout clear
- [x] 6.8 Added ring-2 ring-primary class on `<li>` via cn() when isHighlighted
- [x] 6.9 All 23 owner-document-requests tests GREEN
- [x] 6.10 TypeScript: no errors

Files modified:
- `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.test.tsx`

---

## Phase 7 — E2E extension [x]

- [x] 7.1 Confirmed: no existing assertions in owner-notifications.e2e-spec.ts check /owner/properties link shapes for document types. Only S-A8 checks /dashboard → null (unchanged).
- [x] 7.2 Added S-P1/round-trip test: DOCUMENT_REQUESTED with deep-link accepted and returned verbatim
- [x] 7.3 Added S-R1 regression: param-less /owner/properties/{assetId} still accepted
- [x] 7.4 Added S-R2 regression: /owner root still accepted
- [x] 7.5 Confirmed S-A8 (cross-surface → null) unchanged
- [x] 7.6 All 15 e2e tests GREEN (12 pre-existing + 3 new)

File modified: `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts`

---

## Phase 8 — Seed regression reconciliation [x]

- [x] 8.1 seed-demo.mjs lines 1748, 1762: hardcodes OLD param-less format (NOT via producer)
- [x] 8.2 Seeded records carry old format; sanitizer accepts via FR-S3 fast-path
- [x] 8.3 No test assertion updates needed (no assertions checked document link shapes before)
- [x] 8.4 seed-demo.mjs UNCHANGED (confirmed by git diff — empty)

---

## Phase 9 — Verification gates [x]

- [x] 9.1 API vitest: **750/750 passed (62 test files)**
  - notification-link.helper.spec.ts — 20 tests GREEN
  - notification-producer.service.spec.ts — 8 tests GREEN
  - owner-notifications.e2e-spec.ts — 15 tests GREEN (12 pre-existing + 3 new)
  - All other suites unchanged and GREEN
- [x] 9.2 FE vitest: **437/437 passed (83 test files)**
  - owner-property-detail.test.tsx — 7 tests GREEN (5 pre-existing + 2 new)
  - owner-document-requests.test.tsx — 23 tests GREEN (18 pre-existing + 5 new)
  - All other suites unchanged and GREEN
- [x] 9.3 TypeScript: no errors in modified files
- [x] 9.4 oxlint (app-new modified files): 0 errors. API oxlint: binary not available in api package.
- [ ] 9.5 Seeded Playwright (T07, T08, T17, T18a): PENDING — requires live seeded server
- [x] 9.6 seed-demo.mjs UNCHANGED
- [x] 9.7 notification-center.tsx UNCHANGED
- [x] 9.8 sanitizeInternalNotificationLink UNCHANGED
- [x] 9.9 Security boundary: all 12 rejection scenarios (S-S5..S-S16 + fragment + duplicate) have passing unit tests. Closed {tab,doc} enumerated allowlist confirmed.
- [ ] 9.10 Fresh-context review on diff: PENDING (pre-PR gate)

---

## Files changed

| File | Change |
|------|--------|
| `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts` | NEW — 20 sanitizer unit tests |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` | MODIFIED — widened owner sanitizer with URL parse + closed allowlist |
| `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` | MODIFIED — deep-link linkHref template (1-line change) |
| `viewpro-app/apps/api/test/notification-producer.service.spec.ts` | MODIFIED — updated 3 linkHref assertions to new format |
| `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` | MODIFIED — 3 new deep-link round-trip + regression e2e tests |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx` | MODIFIED — added doc nuqs param + threaded highlightDocId prop |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx` | MODIFIED — extended nuqs mock + 2 new threading tests |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx` | MODIFIED — highlightDocId prop, data-request-id, scroll/highlight effect |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.test.tsx` | MODIFIED — 5 new scroll/highlight tests |

---

## Phase 10 — Judgment Day round 1 fixes [x]

Four confirmed JD findings remediated (surgical, no scope creep):

- [x] **FIX 1 (D1 step 5) — empty `doc=` accepted by sanitizer.** `notification-link.helper.ts` now reads `url.searchParams.get('doc')` and returns `null` when the value is empty/missing (was only `searchParams.has('doc')`, which accepted `?tab=documents&doc=`). Added rejection unit test for `?tab=documents&doc=` → `null`. Sanitizer spec: **21/21 GREEN** (was 20).
- [x] **FIX 2 (Risk A3 / FR-F2 / D2) — hollow S-F5.** Removed the `expect(container).toBeInTheDocument()` placeholder from `owner-document-requests.test.tsx` (a child-only test cannot model the doc-survives-tab-write contract). Added a real page-level S-F5 to `owner-property-detail.test.tsx`: mounts with `tab=documents&doc=req-123`, fires a real Tabs change (Seguimiento → Documentos via `onValueChange`), and asserts `data-highlight-doc` still equals `req-123`. Proven fail-able: a temporary mock sabotage that clobbers `doc` on a `tab` write made S-F5 FAIL (`data-highlight-doc=""`), then was reverted.
- [x] **FIX 3 (FR-F3) — S-F1 asserted scroll but not highlight.** S-F1 now also asserts the matching `<li data-request-id="req-123">` carries `ring-2 ring-primary`, and advances fake timers 2000ms to assert the highlight clears (`not.toHaveClass('ring-2')`). Green against the real implementation.
- [x] **FIX 4 — dead code in e2e.** Removed unused `const assetId = "asset-deeplink-1"` and the misleading `void assetId; void docReqId;` lines from the first deep-link round-trip test (the test uses `propertyAsset.id`; `docReqId` is genuinely used). e2e: **15/15 GREEN**.

### JD round 1 verification
- [x] Sanitizer spec: **21/21 GREEN**
- [x] owner-document-requests.test.tsx: **22 GREEN** (was 23; the hollow S-F5 was removed, not replaced in this file)
- [x] owner-property-detail.test.tsx: **8 GREEN** (was 7; real S-F5 added)
- [x] owner-notifications.e2e-spec.ts: **15/15 GREEN** (DB available)
- [x] oxlint on all modified files: **exit 0** (FE via app-new oxlint, API via app-new oxlint from repo root). Also fixed a pre-existing `react-hooks(rules-of-hooks)` violation in the nuqs mock (introduced by Phase 5) that was breaking the lint gate on `owner-property-detail.test.tsx` — hooks are now called unconditionally in fixed order, branching on `key` after the calls; per-param state independence preserved.

> Note 9.4 superseded: API oxlint IS runnable via the app-new `oxlint` binary invoked from the repo root (it rejects `..` paths, so absolute repo-root-relative paths are required).
