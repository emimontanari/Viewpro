# Tasks — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~269 (design D8 breakdown) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (~269 LOC < 400; sanitizer is a security boundary → fresh-context review required before PR) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 — Audit | Run pre-impl audit commands (A1–A9) | pre-PR | Mandatory gate; blocks all implementation |
| 2 — Sanitizer tests (failing) | Write all internal sanitizer unit tests (S-S1..S-S25 + accept/regression cases) in the EXISTING `notification-link.helper.spec.ts` (extend) | PR 1 | Security-critical; tests MUST fail first; file already exists from 24.6a |
| 3 — Sanitizer impl | Add internal URL-parse branch to `sanitizeInternalNotificationLink`; all unit tests green | PR 1 | Security boundary; {doc}-only allowlist; implement after tests are red |
| 4 — Producer | Update `notifyDocumentUploaded` linkHref template; update producer unit tests | PR 1 | 1-line change; tests update to new shape |
| 5 — Frontend | `doc` nuqs param read; one-shot filter reset; controlled resolved Collapsible (D4); data-request-id + containerRef; scroll/highlight effect; FE unit tests | PR 1 | Depends on sanitizer done |
| 6 — E2E extension | Extend `notifications.e2e-spec.ts` with deep-link round-trip assertions | PR 1 | Confirms backend round-trip end-to-end; confirm correct spec file first (A-pre) |
| 7 — Verification gates | api vitest, app-new vitest, oxlint, seeded smoke note | PR 1 | All gates must be green before tag |

---

## Phase 1 — Pre-implementation audit

Run ALL commands before writing any code. Paste verbatim output into apply-progress audit section.
**Any unexpected result blocks apply.**

- [x] 1.1 **(A1)** `rg -n "linkHref:|notifyDocumentUploaded|documentRequestId" viewpro-app/apps/api/src/notifications/notification-producer.service.ts`
      Expected: `notifyDocumentUploaded` at ~:98, hardcoded `linkHref: /dashboard/product/${input.propertyEngagementId}` at ~:112, `documentRequestId` persisted at ~:115. If `documentRequestId` is NOT in scope on this path, STOP.
- [x] 1.2 **(A2)** `rg -n "sanitizeInternalNotificationLink|SAFE_INTERNAL_LINKS|expectedProductLink|ALLOWED_OWNER" viewpro-app/apps/api/src/notifications/notification-link.helper.ts`
      Expected: internal sanitizer at ~:8-31 (static set `.has` at ~:17, engagement guard at ~:21, exact equality at ~:25-28), owner sanitizer at ~:33-110, `ALLOWED_OWNER_QUERY_PARAM_NAMES` set at ~:33. Confirms D1 starting shape and order-of-checks; if the ordering differs, record the actual lines and adjust task 3.1 accordingly.
- [x] 1.3 **(A3)** `rg -n "sanitizeInternalNotificationLink|propertyEngagementId" viewpro-app/apps/api/src/notifications/notification-response.mapper.ts`
      Expected: mapper passes `notification.propertyEngagementId` (trusted DB column) at ~:15-18. Confirms D1 premise — pathname comparison uses the server column, NOT a link-derived value. If absent or different, STOP.
- [x] 1.4 **(A4)** `rg -n "documentos|setDocumentFilter|withDefault|handleFilterChange|history: 'replace'" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
      Expected: `documentos` nuqs param declared at ~:110-115 with `history: 'replace', scroll: false, shallow: true, withDefault: 'all'`; `handleFilterChange` writes `null` for `'all'` at ~:204-206. Confirms D5 one-shot reset writes `null` (not the string `'all'`) and matches the param's convention.
- [x] 1.5 **(A5)** `rg -n "Collapsible|defaultOpen|group.key|document-request-results" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
      Expected: `resolved` group rendered with `<Collapsible defaultOpen={false}>` at ~:458; `data-testid="document-request-results"` outer container at ~:258-261. Confirm this is the correct attachment point for `containerRef` (D6). If no outer container data-testid exists, record actual attribute and adjust task 5.5 anchor.
- [x] 1.6 **(A6)** `rg -n "<li>|request\.id|DocumentRequestList|DocumentRequestItem|groupDocumentRequests" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
      Expected: bare `<li>` at ~:590 with NO `data-request-id` (this slice adds it); `<ul>` at ~:545; `groupDocumentRequests` at ~:819-833 producing EXACTLY three buckets (`pending`, `review`, `resolved`). Verify NO `CANCELLED` bucket — CANCELLED items are never rendered (D6 R5 no-op confirmed). If a CANCELLED bucket exists, STOP — R5 no-op assumption is wrong.
- [x] 1.7 **(A7 — CRITICAL for D7 nuqs mock)** `rg -n "vi\.mock\('nuqs'\|useQueryState\|getProductDocumentRequestsMock\|scrollIntoView" viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`
      Expected: `nuqs` mock at ~:38-51 returning `React.useState(parser.defaultValue)` for ALL keys (no key discrimination); no `scrollIntoView` mock present yet. Record the exact mock shape in apply-progress before modifying the file — this is the baseline to extend.
- [x] 1.8 **(A8 — CRITICAL file existence)** `rg -n "sanitizeOwnerNotificationLink|sanitizeInternalNotificationLink" viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts`
      Expected: file EXISTS (created in 24.6a) and contains ONLY owner-side test cases today. This slice EXTENDS it with an internal `describe` block. If the file is absent, STOP and re-scope — the 24.6a task was not completed.
- [x] 1.9 **(A9 — confirms no-tab premise)** `rg -n "PropertyDocumentRequests" viewpro-app/apps/app-new/src/features/products/components/product-form.tsx`
      Expected: `<PropertyDocumentRequests>` mounted INLINE at ~:562 (NOT inside a `?tab=` TabsContent switch). This confirms the internal page is not tabbed, which is why the internal sanitizer allowlist is `{doc}` ONLY with NO `tab` param. If it IS behind a tab, STOP — allowlist decision D1 must be reconsidered.
- [x] 1.10 **(A-pre — e2e spec file confirm)** `fd notifications.e2e-spec.ts viewpro-app/apps/api/test` and `fd internal-notifications.e2e-spec.ts viewpro-app/apps/api/test`
      Expected: `notifications.e2e-spec.ts` exists. If an `internal-notifications.e2e-spec.ts` ALSO exists, use the more specific one for Phase 6. Record which file to extend before Phase 6 starts. If NEITHER exists, STOP.

---

## Phase 2 — Sanitizer unit tests (FAILING first — SECURITY-CRITICAL)

Depends on: Phase 1 complete, no blockers.
**Tests MUST be written and verified RED before Phase 3 touches `notification-link.helper.ts`.**

File: `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts`
Action: EXTEND with a new `describe('sanitizeInternalNotificationLink', ...)` block. Do NOT create a new file. Do NOT modify any existing owner test.

### 2a — SAFE_INTERNAL_LINKS regression (S-S1..S-S4) — acceptance, fail until Phase 3 widening

- [x] 2.1 **S-S1** `sanitizeInternalNotificationLink("/dashboard", null_or_empty_engId)` → `"/dashboard"`. (FR-S2: `SAFE_INTERNAL_LINKS` fast-path must accept all four members unchanged.)
- [x] 2.2 **S-S2** `sanitizeInternalNotificationLink("/dashboard/seguimiento", null_or_empty_engId)` → `"/dashboard/seguimiento"`. (FR-S2 regression.)
- [x] 2.3 **S-S3** `sanitizeInternalNotificationLink("/dashboard/users", null_or_empty_engId)` → `"/dashboard/users"`. (FR-S2 regression.)
- [x] 2.4 **S-S4** `sanitizeInternalNotificationLink("/dashboard/status-change-requests", null_or_empty_engId)` → `"/dashboard/status-change-requests"`. (FR-S2 regression.)

### 2b — Param-less product path acceptance (S-S5) — regression guard

- [x] 2.5 **S-S5** `sanitizeInternalNotificationLink("/dashboard/product/eng-abc", "eng-abc")` → `"/dashboard/product/eng-abc"`. (FR-S3: historical notifications with no query params must still pass.)

### 2c — Deep-link acceptance (S-S6, S-S7) — core new acceptance cases

- [x] 2.6 **S-S6** `sanitizeInternalNotificationLink("/dashboard/product/eng-abc?doc=req-123", "eng-abc")` → `"/dashboard/product/eng-abc?doc=req-123"`. (FR-S4: full deep-link accepted.)
- [x] 2.7 **S-S7** `sanitizeInternalNotificationLink("/dashboard/product/eng-abc?doc=550e8400-e29b-41d4-a716-446655440000", "eng-abc")` → full link including the UUID doc value. (FR-S4: UUID-format doc id.)

### 2d — Rejection cases (S-S8..S-S25) — SECURITY-CRITICAL; ALL must be RED before Phase 3

- [x] 2.8 **S-S8** `"/dashboard/product/eng-abc?doc=req-123&evil=x"` → `null`. (FR-S5: unknown param rejected via closed allowlist.)
- [x] 2.9 **S-S9** `"/dashboard/product/eng-abc?doc=req-123&tab=documentos"` → `null`. (FR-S5 CRITICAL: `tab` is NOT in the internal allowlist. This is the KEY divergence from the owner sanitizer. Must be an explicit test case.)
- [x] 2.10 **S-S10** `"/dashboard/product/eng-abc?tab=documentos"` → `null`. (FR-S5: `tab` alone, no `doc`, also rejected — NO `tab` variant accepted on the internal surface.)
- [x] 2.11 **S-S11** `"/dashboard/product/eng-abc?redirect=http://evil.com"` → `null`. (FR-S5: single unknown param open redirect attempt.)
- [x] 2.12 **S-S12** `"/dashboard/product/eng-abc?doc="` → `null`. (FR-S6: empty `doc` value is not a valid deep-link anchor.)
- [x] 2.13 **S-S13** `"/dashboard/product/eng-abc?doc=req-1&doc=req-2"` → `null`. (FR-S7: duplicate `doc` param — HTTP param pollution guard.)
- [x] 2.14 **S-S14** `"//evil.example.com/dashboard/product/eng-abc"` → `null`. (FR-S8: protocol-relative URL bypass attempt.)
- [x] 2.15 **S-S15** `"https://evil.example.com/dashboard/product/eng-abc"` → `null`. (FR-S8, FR-S11: absolute URL — origin assertion fails.)
- [x] 2.16 **S-S16** `"https://evil.example.com/dashboard/product/eng-abc?doc=req-123"` → `null`. (FR-S8, FR-S11: deep-link via absolute URL — must not pass origin guard.)
- [x] 2.17 **S-S17** `"/dashboard/product/"` → `null`. (FR-S9: trailing slash, empty `propertyEngagementId` segment.)
- [x] 2.18 **S-S18** `"/dashboard/product"` → `null`. (FR-S9: no `propertyEngagementId` segment at all — malformed path.)
- [x] 2.19 **S-S19** `"/dashboard/product/../etc/passwd"` → `null`. (FR-S9: path-traversal — `URL()` normalizes `..` then pathname fails exact match.)
- [x] 2.20 **S-S20** `"/dashboard/seguimiento?doc=req-123"` with any `propertyEngagementId` → `null`. (FR-S9: a `SAFE_INTERNAL_LINKS` member with a query param is NOT matched by the static set fast-path; falls through to parse branch; pathname `/dashboard/seguimiento` ≠ `/dashboard/product/{engId}` → rejected. Proves order: the fast-path only fires on the bare exact string, not on parameterized variants.)
- [x] 2.21 **S-S21** `"/dashboard/product/eng-abc?doc=req-123#section"` → `null`. (FR-S10: fragment rejected.)
- [x] 2.22 **S-S22** `"/dashboard/product/eng-abc#section"` → `null`. (FR-S10: bare fragment on the product path — fragment check must run even on the param-less path; confirm A5 assumption.)
- [x] 2.23 **S-S23** `""` → `null`. (Empty string — `startsWith("/")` guard fires first.)
- [x] 2.24 **S-S24 (null)** `null` → `null`, no thrown exception. (FR: null guard.)
      **S-S24 (undefined)** `undefined` → `null`, no thrown exception. (FR: undefined guard.)
- [x] 2.25 **S-S25** `"/owner/properties/asset-abc?tab=documents&doc=req-123"` → `null`. (FR-S9, FR-R3: cross-surface link — owner path must not pass the internal sanitizer. Surface isolation guard.)
- [x] 2.26 Run `pnpm --filter @viewpro/api test notification-link` — confirm ALL new internal tests are **RED** (expected failures, not import errors). The pre-existing 24.6a owner-side tests MUST stay **GREEN** (do not break the existing describe block). Any import error means a scaffolding problem to fix before Phase 3.

---

## Phase 3 — Sanitizer implementation

Depends on: Phase 2 complete (all new tests red, existing owner tests green, no import errors).

File: `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`

- [x] 3.1 Add `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = new Set(["doc"])` near `ALLOWED_OWNER_QUERY_PARAM_NAMES` (or equivalent placement that makes it clear this is strictly {doc}-only). Do NOT reuse or alias the owner set.
- [x] 3.2 Widen `sanitizeInternalNotificationLink` per D1. The order is LOAD-BEARING — the following steps replace or extend the existing function body:
      (a) **(unchanged)** Reject if `!linkHref || !linkHref.startsWith("/")` — kills protocol-relative `//host` and absolute URLs up front.
      (b) **(unchanged)** `if (SAFE_INTERNAL_LINKS.has(linkHref)) return linkHref;` — exact-string fast-path for the four static dashboard links. MUST run BEFORE the parse branch.
      (c) **(unchanged)** `if (!input.propertyEngagementId) return null;` — no engagement context, reject.
      (d) **(unchanged, FAST-PATH)** Build `expectedProductLink = /dashboard/product/${propertyEngagementId}`; `if (linkHref === expectedProductLink) return linkHref;` — param-less product path (historical, FR-S3). MUST run BEFORE the parse branch.
      (e) **(NEW — parse branch; only reached by a link with a query or fragment):**
          i. `let url: URL; try { url = new URL(linkHref, "https://viewpro.local"); } catch { return null; }`
          ii. Origin assert: `if (url.origin !== "https://viewpro.local") return null;` — catches any absolute URL that slipped the prefix check.
          iii. Pathname exact match against trusted column: `if (url.pathname !== expectedProductLink) return null;` — `URL()` normalizes `./../%2e` so no traversal/encoded segment can forge a match.
          iv. Closed NAME allowlist: iterate `url.searchParams.keys()`; `if (!ALLOWED_INTERNAL_QUERY_PARAM_NAMES.has(key)) return null;` — first unknown key rejects. **`tab` is NOT in the set.**
          v. Reject duplicate `doc`: `if (url.searchParams.getAll("doc").length > 1) return null;`
          vi. Require non-empty `doc`: `const docValue = url.searchParams.get("doc"); if (!docValue) return null;`
          vii. Reject any fragment: `if (url.hash !== "") return null;`
          viii. Return `${url.pathname}${url.search}` — canonical form, no fragment.
- [x] 3.3 Verify that the closing `return null` (else branch) is present after the parse branch so any uncovered path returns null, not undefined.
- [x] 3.4 Run `pnpm --filter @viewpro/api test notification-link` — ALL new internal tests from Phase 2 MUST be **GREEN**. All pre-existing 24.6a owner tests MUST stay **GREEN**. Any red is a bug, not a TDD skip.
- [x] 3.5 Run `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors in modified file.

---

## Phase 4 — Producer: update linkHref template + unit tests

Depends on: Phase 3 green (sanitizer proven). Can proceed in parallel with Phase 5 frontend work.

File: `viewpro-app/apps/api/src/notifications/notification-producer.service.ts`

- [x] 4.1 Locate the `notifyDocumentUploaded` method (at ~:98). Confirm `linkHref` is at ~:112 and `input.documentRequestId` is in scope at ~:115 per audit A1.
- [x] 4.2 Write failing tests FIRST: in the existing producer unit spec, add/update assertions that `notifyDocumentUploaded` produces a notification with `linkHref: "/dashboard/product/${propertyEngagementId}?doc=${documentRequestId}"` for `DOCUMENT_UPLOADED`. Run — confirm **RED** (the old template `/dashboard/product/${propertyEngagementId}` no longer matches).
      Also add assertion for S-P3: any other internal notification type's `linkHref` is NOT changed by this slice — confirm existing assertions for other types are still green.
- [x] 4.3 Change the template string on ~:112 from:
      `linkHref: \`/dashboard/product/${input.propertyEngagementId}\``
      to:
      `linkHref: \`/dashboard/product/${input.propertyEngagementId}?doc=${input.documentRequestId}\``
      No conditional — `documentRequestId` is always set on this call path. No `tab` param.
- [x] 4.4 Assert FR-P4 / S-P3: scan the producer for all OTHER notification types (`MOVEMENT_CREATED`, etc.) and confirm their `linkHref` templates are unmodified. Owner notifications must also be untouched (a diff check is sufficient).
- [x] 4.5 Run producer unit tests — all **GREEN**. `pnpm --filter @viewpro/api test notification-producer` (or the appropriate filter name from audit A1 output).
- [x] 4.6 Run `pnpm --filter @viewpro/api typecheck` — zero errors in modified file.

---

## Phase 5 — Frontend: `doc` param read, filter reset, Collapsible, and scroll/highlight

Depends on: Phase 1 audit (A5–A7 outcomes recorded). The sanitizer being done (Phase 3) is NOT required to start the FE unit tests, but the sanitizer shape must be understood before writing the e2e (Phase 6).

Files:
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`

### 5a — Tests first (failing, before any implementation in this phase)

- [x] 5.1 **(D7 nuqs mock extension — prerequisite for all FE tests)** Extend the `nuqs` mock in `property-document-requests.test.tsx` (~:38-51) to key by param name. Change it so:
      - `useQueryState('documentos', ...)` returns `React.useState(parser.defaultValue)` (existing behavior preserved).
      - `useQueryState('doc', ...)` returns `[null, vi.fn()]` by default (null when absent).
      This allows FE tests to set `doc` to a specific string for individual test cases without affecting the `documentos` param. Record the original mock in apply-progress before modifying.
- [x] 5.2 Mock `Element.prototype.scrollIntoView = vi.fn()` in a `beforeEach` or test setup. Restore in `afterEach`. (Required for scroll/highlight assertions.)
- [x] 5.3 Write the following failing tests BEFORE implementing anything in the component:
      - **S-F6 (data-request-id present)**: Render with any items; assert each `<li>` has `data-request-id={item.id}` in the DOM. Run — confirm **RED** (attribute not yet present).
      - **S-F1 (pending target — scroll + highlight)**: `doc = "req-123"`, query resolves with a `PENDING` item `{id: "req-123"}`. Assert `scrollIntoView` called once on the matching element. Assert the matching `<li>` has the highlight class (`ring-2 ring-primary` or equivalent). Run — **RED**.
      - **S-F2 (resolved target — Collapsible + scroll)**: `doc = "req-resolved"`, query resolves with an `APPROVED` item `{id: "req-resolved"}`. Assert the `resolved` Collapsible group is open (its content is visible/not hidden). Assert `scrollIntoView` called. Run — **RED**.
      - **S-F3 (doc absent — no side effects)**: `doc = null`. Assert `scrollIntoView` NOT called. Assert `documentos` filter unchanged (no reset). Assert resolved Collapsible stays closed. Run — **RED** (or GREEN if graceful; note which).
      - **S-F4 (not-found degrade)**: `doc = "req-deleted"`, query resolves with NO matching item. Assert `scrollIntoView` NOT called. Assert no thrown error. Run — **RED**.
      - **S-F5 (CANCELLED no-op)**: `doc = "req-cancelled"`, query resolves; no item in any group has `id = "req-cancelled"` (CANCELLED is NOT in any group — confirmed A6). Assert `scrollIntoView` NOT called, no throw. Run — **RED** (should be similar to S-F4).
      - **S-F7 (one-shot filter reset — fires once)**: `doc = "req-123"` and `documentos = "resolved"` at arrival. Assert after mount that `setDocumentFilter(null)` was called once (filter forced to `'all'`). Assert calling `handleFilterChange('pending')` afterward does NOT re-trigger the reset. Run — **RED**.
      - **S-F8 (query-loading guard)**: `doc = "req-123"`, query status is `loading` (isSuccess = false). Assert `scrollIntoView` NOT called. Then simulate query resolving — assert `scrollIntoView` IS called. Run — **RED**.
- [x] 5.4 Run ALL new FE tests — confirm they are **RED** (not import errors). Fix scaffolding issues before Phase 5b.

### 5b — Implementation

- [x] 5.5 **(D3)** Add `const [highlightDocId] = useQueryState('doc', parseAsString)` to `PropertyDocumentRequests`, after the existing `documentos` declaration (~:110-115). Import `parseAsString` from `nuqs` if not already imported. Read-only — never written.
- [x] 5.6 **(D5 — one-shot filter reset)** Add `const didResetFilterRef = useRef(false)`.
      Add a `useEffect` keyed `[highlightDocId]`:
      - On first run where `highlightDocId` is truthy AND `!didResetFilterRef.current`: set `didResetFilterRef.current = true`, call `setDocumentFilter(null)`.
      - Short-circuit for every subsequent run (ref is already true).
      This ensures the `'all'` reset fires ONCE per mount with a non-null `doc`. Writes with `history: 'replace'` per the param's existing options. The `doc` sibling param is NOT affected (nuqs re-emits the full known-param set).
- [x] 5.7 **(D4 — controlled resolved Collapsible)** Add `const [resolvedOpen, setResolvedOpen] = useState(false)` to `PropertyDocumentRequests`. Convert the `resolved` group's `<Collapsible defaultOpen={false}>` to a controlled `<Collapsible open={resolvedOpen} onOpenChange={setResolvedOpen}>`. Thread `open={resolvedOpen}` + `onOpenChange={setResolvedOpen}` through to `DocumentRequestSection` (or wherever the Collapsible is rendered — follow the component tree per audit A5). The `review`/`pending` groups are plain `<section>` elements — do NOT change them.
      Add a one-shot ref guard `const didOpenResolvedRef = useRef(false)` so the D4 force-open effect fires ONCE and does not fight a later user collapse.
- [x] 5.8 **(D6 — data-request-id + containerRef)** Add `data-request-id={request.id}` to the `<li>` in `DocumentRequestItem` (at ~:590). No other structural change to the item.
      Add `const containerRef = useRef<HTMLElement>(null)` (or `HTMLDivElement` matching the actual outer container type per audit A5) to `PropertyDocumentRequests`; attach `ref={containerRef}` to the `data-testid="document-request-results"` outer container element (or the equivalent anchor confirmed in audit A5).
- [x] 5.9 **(D6 — highlight state + cleanup)** Add:
      - `const [highlightedId, setHighlightedId] = useState<string | null>(null)`
      - `const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
      - A cleanup effect (`[]`) that clears `highlightTimerRef.current` on unmount (avoids setState-after-unmount).
- [x] 5.10 **(D4+D6 — single combined effect)** Add a `useEffect` keyed `[highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data]`:
      1. No-op if `!highlightDocId` or `!documentRequestsQuery.isSuccess`.
      2. Find item by `id === highlightDocId` in `documentRequestsQuery.data.items`. If absent (deleted, CANCELLED-not-rendered, wrong id) → no-op, no throw. (FR-F9, R5.)
      3. If item found AND `status ∈ {APPROVED, REJECTED}` AND `!didOpenResolvedRef.current`: set `didOpenResolvedRef.current = true`, call `setResolvedOpen(true)`. (D4, FR-F4.)
      4. Resolve DOM node: `containerRef.current?.querySelector(\`[data-request-id="${CSS.escape(highlightDocId)}"]\`)`. Call `element?.scrollIntoView({ behavior: 'smooth', block: 'start' })`. (FR-F7.)
      5. Call `setHighlightedId(highlightDocId)`. Clear any prior timer in `highlightTimerRef`. Set `highlightTimerRef.current = setTimeout(() => { setHighlightedId(null); highlightTimerRef.current = null; }, 2000)`. (FR-F7 transient highlight.)
      **If a single-tick race is observed (scrollIntoView fires before the Collapsible is visually open):** fall back to splitting into two effects — one on `[highlightDocId, isSuccess, data]` that only calls `setResolvedOpen(true)`, and a second on `[resolvedOpen, highlightDocId, isSuccess]` that runs the scroll after `resolvedOpen` is true. Document which path was used in apply-progress.
- [x] 5.11 **(D6 — highlight class)** Thread `isHighlighted={highlightedId === request.id}` through `DocumentRequestSection` → `DocumentRequestList` → `DocumentRequestItem` (add an optional `highlightedId?: string | null` prop at each intermediate level; default to `undefined` so existing call paths without this prop are unaffected). Apply `cn(isHighlighted && 'ring-2 ring-primary rounded-xl')` (or the Tailwind token the codebase uses for the 24.6a highlight ring) conditionally on the `<li>`. Keep the structure minimal — no extra wrapper elements.
- [x] 5.12 Run `pnpm --filter next-shadcn-dashboard-starter test property-document-requests` (or the correct vitest filter for `app-new`). All 8 new tests from task 5.3 MUST be **GREEN**. Any red after implementation is a bug, not a TDD skip.
- [x] 5.13 Run `pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in all modified files.

---

## Phase 6 — E2E extension: internal notifications spec

Depends on: Phase 3 (sanitizer green) and Phase 4 (producer green). Covers the full backend round-trip.

File: the spec confirmed in audit task 1.10 (expected: `viewpro-app/apps/api/test/notifications.e2e-spec.ts`).

- [x] 6.1 **(FR-R4 baseline check)** Before adding new tests: `rg -n "linkHref\|\/dashboard\/product" viewpro-app/apps/api/test/notifications.e2e-spec.ts` — record all existing linkHref assertions. If any test asserts the old param-less `/dashboard/product/{engId}` shape for a seeded `DOCUMENT_UPLOADED` record, note it — it may need updating (or confirming it is a seeded fixture, which carries the old format, and remains correct).
- [x] 6.2 **(S-P1/S-P2 round-trip)** Add `it('DOCUMENT_UPLOADED notification stores and returns deep-link linkHref')`: seed a `PropertyEngagement`, a manager user, and one `Notification` with `type = DOCUMENT_UPLOADED` and `linkHref = "/dashboard/product/${engId}?doc=${docReqId}"`. Fetch the internal notifications endpoint. Assert: the item's `linkHref` in the response equals `/dashboard/product/${engId}?doc=${docReqId}` (sanitizer accepts and returns it verbatim). (FR-P1, FR-P2, FR-S4.)
- [x] 6.3 **(S-R1 regression)** Add or confirm `it('param-less /dashboard/product/{engId} linkHref still accepted')`: seed a notification with `linkHref = "/dashboard/product/${engId}"` (no query params). Fetch → `linkHref` in response equals `/dashboard/product/${engId}`. (FR-R1, FR-S3.)
- [x] 6.4 **(S-R2 regression — SAFE_INTERNAL_LINKS)** Add or confirm `it('SAFE_INTERNAL_LINKS members pass unchanged')`: seed notifications with `/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`, `/dashboard/status-change-requests`. Fetch → each returns the original string. (FR-R2.)
- [x] 6.5 **(FR-R3 cross-surface)** Confirm that any existing test in `owner-notifications.e2e-spec.ts` that checks a dashboard link → null is still present and unchanged. Do NOT modify it. (24.6a regression guard — the owner sanitizer is untouched.)
- [x] 6.6 Run `pnpm --filter @viewpro/api test notifications` (or the correct e2e filter) — all pre-existing cases plus new Phase 6 cases **GREEN**.

---

## Phase 7 — Regression: seeded linkHref format reconciliation (CONDITIONAL)

Execute ONLY if Phase 6.1 or manual inspection reveals that the e2e spec or `demo-smoke.spec.ts` have assertions checking the shape of seeded `DOCUMENT_UPLOADED` notification `linkHref` values.

- [x] 7.1 `rg -n "DOCUMENT_UPLOADED\|linkHref.*dashboard.*product\|doc=" viewpro-app/apps/api/test/notifications.e2e-spec.ts viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — list ALL linkHref assertions in both files.
- [x] 7.2 Determine the seed state: `rg -n "DOCUMENT_UPLOADED\|linkHref.*dashboard.*product" viewpro-app/scripts/seed-demo.mjs` — does the seed hardcode the old format (param-less) or call the producer (new format)?
      - Seed is **hardcoded** to old format: seeded records carry `/dashboard/product/{id}` (no params). Assertions on these records MUST assert the OLD format. No test update needed.
      - Seed **calls the producer**: seeded records carry the new deep-link format. Test assertions that check the seeded record's shape must be updated to match. `seed-demo.mjs` itself MUST NOT change (FR-R4 seed contract invariant).
- [x] 7.3 Based on 7.2: update ONLY the test assertion strings where confirmed. Do NOT change production code, the seed script, or unrelated assertions.
- [x] 7.4 Re-run all affected suites — all **GREEN**.

---

## Phase 8 — Verification gates

Depends on: Phases 2–6 complete (and Phase 7 if triggered). ALL gates MUST be GREEN before tagging done.

- [x] 8.1 `pnpm --filter @viewpro/api test` — all API vitest suites green.
      - `notification-link.helper.spec.ts` — internal describe block (phases 2–3): all green. Owner describe block: unchanged and green.
      - `notification-producer.service.spec.ts` — producer linkHref shape tests (S-P1/P2/P3): green.
      - `notifications.e2e-spec.ts` — all pre-existing cases + new phase 6 tests: green.
      - `owner-notifications.e2e-spec.ts` — all pre-existing 24.5/24.6a tests: UNCHANGED, all green. (FR-R3, FR-R4.)
- [x] 8.2 `pnpm --filter next-shadcn-dashboard-starter test` — all FE vitest suites green.
      - `property-document-requests.test.tsx` — 8 new tests (phase 5): green.
- [x] 8.3 `pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in both packages.
- [x] 8.4 `pnpm oxlint` (or equivalent lint command) — zero new lint errors.
- [x] 8.5 **(manual / CI — note only)** `pnpm --filter next-shadcn-dashboard-starter test:seeded` — requires a running seeded Playwright environment. Cannot be verified in the automated gate. Confirm T07, T08, T17, T18a pass unchanged. (FR-R4, S-R6.) Flag as pending if server is unavailable.
- [x] 8.6 Confirm `seed-demo.mjs` is UNCHANGED: `git diff viewpro-app/scripts/seed-demo.mjs` → empty or absent from diff.
- [x] 8.7 Confirm `notification-center.tsx` (`getSafeRelativeHref`) is UNCHANGED: `git diff viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx` → empty. (FR-F10 — no guard change in scope.)
- [x] 8.8 Confirm `sanitizeOwnerNotificationLink` is UNCHANGED: `git diff` shows NO edits to the owner sanitizer block in `notification-link.helper.ts`. (FR-S12, FR-R3.)
- [x] 8.9 Security boundary self-check: all 18 rejection scenarios S-S8..S-S25 (including `tab`, unknown param, empty doc, dup doc, `//host`, absolute URL x2, empty segment, no segment, traversal, seguimiento+param, fragment x2, empty string, null/undefined, cross-surface) have a passing unit test. Reviewer MUST verify the closed `{doc}`-ONLY allowlist — an enumerated iteration that rejects on first unknown key, NOT an `if/else` chain. `tab` explicitly absent from the set.
- [x] 8.10 Request fresh-context review on the diff (security boundary per design D1/D8 delivery flag) before opening PR.

---

## Acceptance checklist — spec scenarios

| Scenario | Phase | Task(s) | Status |
|----------|-------|---------|--------|
| S-P1 — DOCUMENT_UPLOADED stores deep-link linkHref (eng-abc/req-123) | 4 | 4.2, 4.3 | — |
| S-P2 — Deep-link shape is exact — no trailing slash, no extra params | 4 | 4.2, 4.3 | — |
| S-P3 — Other internal types retain current linkHref | 4 | 4.4 | — |
| S-S1 — /dashboard accepted unchanged (SAFE_INTERNAL_LINKS) | 2 + 3 | 2.1, 3.2b | — |
| S-S2 — /dashboard/seguimiento accepted unchanged | 2 + 3 | 2.2, 3.2b | — |
| S-S3 — /dashboard/users accepted unchanged | 2 + 3 | 2.3, 3.2b | — |
| S-S4 — /dashboard/status-change-requests accepted unchanged | 2 + 3 | 2.4, 3.2b | — |
| S-S5 — Param-less product path accepted (historical regression) | 2 + 3 | 2.5, 3.2d | — |
| S-S6 — Full deep-link ?doc=req-123 accepted | 2 + 3 | 2.6, 3.2e | — |
| S-S7 — UUID doc value accepted | 2 + 3 | 2.7, 3.2e | — |
| S-S8 — Unknown param → null | 2 + 3 | 2.8, 3.2e-iv | — |
| S-S9 — tab param → null (CRITICAL: not in internal allowlist) | 2 + 3 | 2.9, 3.2e-iv | — |
| S-S10 — tab alone → null | 2 + 3 | 2.10, 3.2e-iv | — |
| S-S11 — redirect param → null | 2 + 3 | 2.11, 3.2e-iv | — |
| S-S12 — Empty doc value → null | 2 + 3 | 2.12, 3.2e-vi | — |
| S-S13 — Duplicate doc → null | 2 + 3 | 2.13, 3.2e-v | — |
| S-S14 — Protocol-relative → null | 2 + 3 | 2.14, 3.2a | — |
| S-S15 — Absolute URL → null | 2 + 3 | 2.15, 3.2e-ii | — |
| S-S16 — Absolute URL + doc → null | 2 + 3 | 2.16, 3.2e-ii | — |
| S-S17 — Empty segment → null | 2 + 3 | 2.17, 3.2e-iii | — |
| S-S18 — No segment → null | 2 + 3 | 2.18, 3.2e-iii | — |
| S-S19 — Path-traversal → null | 2 + 3 | 2.19, 3.2e-iii | — |
| S-S20 — SAFE_INTERNAL_LINKS member + param → null | 2 + 3 | 2.20, 3.2b+3.2e | — |
| S-S21 — Fragment + doc → null | 2 + 3 | 2.21, 3.2e-vii | — |
| S-S22 — Bare fragment → null | 2 + 3 | 2.22, 3.2e-vii | — |
| S-S23 — Empty string → null | 2 + 3 | 2.23, 3.2a | — |
| S-S24 — null/undefined → null, no throw | 2 + 3 | 2.24, 3.2a | — |
| S-S25 — Cross-surface owner path → null | 2 + 3 | 2.25, 3.2e-iii | — |
| S-F1 — Deep-link scrolls + highlights pending item | 5 | 5.3, 5.8–5.11 | — |
| S-F2 — Resolved target opens Collapsible + scrolls | 5 | 5.3, 5.7, 5.10 | — |
| S-F3 — doc absent → no side effects | 5 | 5.3, 5.5–5.10 | — |
| S-F4 — doc not in list → degrades gracefully | 5 | 5.3, 5.10 | — |
| S-F5 — One-shot reset does NOT clobber later user filter change | 5 | 5.3, 5.6 | — |
| S-F6 — Scroll fires after query resolves, not on mount | 5 | 5.3, 5.10 | — |
| S-F7 — data-request-id on every rendered item | 5 | 5.3, 5.8 | — |
| S-F8 — getSafeRelativeHref round-trips doc param intact | 8 | 8.7 (no-op confirm) | — |
| S-F9 — CANCELLED doc → force-to-'all' fires, no scroll, no throw | 5 | 5.3, 5.10 (no-op) | — |
| S-R1 — Historical param-less notifications work | 3 + 6 | 3.2d, 6.3 | — |
| S-R2 — SAFE_INTERNAL_LINKS members unaffected | 3 + 6 | 3.2b, 6.4 | — |
| S-R3 — Owner sanitizer rejects internal path (cross-surface) | 8 | 8.8 (no-op confirm) | — |
| S-R4 — notifications.e2e-spec.ts baseline green | 6 + 8 | 6.6, 8.1 | — |
| S-R5 — owner-notifications.e2e-spec.ts baseline green | 8 | 8.1 | — |
| S-R6 — Seeded smoke T07, T08, T17, T18a green | 8 | 8.5 | pending (requires seeded server) |
