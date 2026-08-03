# Tasks — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~257 (design D6 breakdown) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (~257 LOC < 400; sanitizer is a security boundary → fresh-context review required before PR) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 — Audit | Run pre-impl audit commands (A1–A8) | pre-PR | Mandatory gate; blocks all implementation |
| 2 — Sanitizer tests (failing) | Write all S-S1..S-S16 unit tests in NEW `notification-link.helper.spec.ts` | PR 1 | Security-critical; tests MUST fail first |
| 3 — Sanitizer impl | Widen `sanitizeOwnerNotificationLink` to pass all S-S tests | PR 1 | Security boundary — implement after tests are red |
| 4 — Producer | Update `createDocumentOwnerNotification` linkHref template; update producer unit tests | PR 1 | 1-line change; tests update to new shape |
| 5 — Frontend | `doc` nuqs param (owner-property-detail); scroll/highlight (owner-document-requests); FE unit tests | PR 1 | Depends on sanitizer done |
| 6 — E2E extension | Extend `owner-notifications.e2e-spec.ts` with deep-link round-trip assertions | PR 1 | Confirms backend round-trip end-to-end |
| 7 — Verification gates | api vitest, app-new vitest, oxlint, seeded smoke note | PR 1 | All gates must be green before tag |

---

## Phase 1 — Pre-implementation audit

Run ALL commands before writing any code. Paste verbatim output into apply-progress audit section.
**Any unexpected result blocks apply.**

- [x] 1.1 `rg -n "linkHref:" viewpro-app/apps/api/src/notifications/notification-producer.service.ts`
      Expected: owner doc template at line ~264, `documentRequestId` in scope at ~:267. If either is absent, STOP.
- [x] 1.2 `rg -n "sanitizeOwnerNotificationLink|expectedPropertyLink|=== \"/owner\"" viewpro-app/apps/api/src/notifications/notification-link.helper.ts`
      Expected: exact-string equality at ~:51, `/owner` fast-path at ~:42, `propertyAssetId` guard at ~:46. Confirms D1 starting shape.
- [x] 1.3 `rg -n "propertyAssetId|sanitizeOwnerNotificationLink" viewpro-app/apps/api/src/notifications/notification-response.mapper.ts`
      Expected: mapper passes `notification.propertyAssetId` (trusted DB column) at ~:29. Confirms D1 premise — pathname comparison uses server column, NOT link-derived value.
- [x] 1.4 `rg -n "getSafeRelativeHref|url\.search|url\.hash" viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx`
      Expected: `${pathname}${search}${hash}` forward at ~:333. Confirms R4: NO frontend guard change needed.
- [x] 1.5 `rg -n "useQueryState|parseAsString|setTabQueryValue|OwnerDocumentRequests" viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
      Expected: `tab` nuqs at ~:29-34, writer at ~:117, `<OwnerDocumentRequests>` render at ~:163-167.
- [x] 1.6 `rg -n "<li>|request\.id|data-request-id|querySelector" viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx`
      Expected: bare `<li>` at ~:313, NO `data-request-id` present (this slice adds it), `items.map` at ~:230.
- [x] 1.7 **(A7 — CRITICAL for D5)** `rg -n "vi\.mock\('nuqs'\|useQueryState\|initialTab" viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`
      Expected: nuqs mock at ~:24-36 that returns `React.useState(default)` for ALL keys (no key discrimination). Confirms D5 requirement: mock MUST be extended to key by param name so `tab` and `doc` resolve independently. Record the current mock shape in apply-progress before touching the file.
- [x] 1.8 `fd notification-link.helper.spec.ts viewpro-app/apps/api/src/notifications`
      Expected: NO match (file does not exist yet). If match found, STOP and re-scope — a colliding spec already exists.

---

## Phase 2 — Sanitizer unit tests (FAILING first — SECURITY-CRITICAL)

Depends on: Phase 1 complete, no blockers. Tests MUST be written before the implementation changes.

Create **NEW** `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts` (~70 LOC).

All tests in this phase MUST be run (and fail on the acceptance/rejection outcomes) before Phase 3 touches `notification-link.helper.ts`. Strict TDD order is mandatory here.

### 2a — Acceptance cases (S-S1..S-S4) — these fail because the widen hasn't happened yet

- [x] 2.1 **S-S1** `sanitizeOwnerNotificationLink("/owner", "asset-abc")` → `"/owner"`. (FR-S2 regression guard.)
- [x] 2.2 **S-S2** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc", "asset-abc")` → `"/owner/properties/asset-abc"`. (FR-S3 regression guard — param-less path.)
- [x] 2.3 **S-S3** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?tab=documents&doc=req-123", "asset-abc")` → `"/owner/properties/asset-abc?tab=documents&doc=req-123"`. (FR-S4 core new acceptance case.)
- [x] 2.4 **S-S4** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?doc=req-123&tab=documents", "asset-abc")` → non-null containing both `tab=documents` and `doc=req-123`. (FR-S4, param order MUST NOT matter — D1 step 5.)

### 2b — Rejection cases (S-S5..S-S16) — SECURITY-CRITICAL; all must fail red before Phase 3

- [x] 2.5 **S-S5** `"/owner/properties/asset-abc?tab=documents&doc=req-123&evil=x"` → `null`. (FR-S5 — unknown param rejection.)
- [x] 2.6 **S-S6** `"/owner/properties/asset-abc?redirect=http://evil.com"` → `null`. (FR-S5 — open redirect attempt.)
- [x] 2.7 **S-S7** `"/owner/properties/asset-abc?tab=tracking&doc=req-123"` → `null`. (FR-S6 — wrong `tab` value.)
- [x] 2.8 **S-S8** `"/owner/properties/asset-abc?doc=req-123"` → `null`. (FR-S10 — `doc` alone without `tab`.)
- [x] 2.9 **S-S9** `"//evil.example.com/owner/properties/asset-abc"` → `null`. (FR-S7 — protocol-relative bypass.)
- [x] 2.10 **S-S10** `"https://evil.example.com/owner/properties/asset-abc"` → `null`. (FR-S7 — absolute URL bypass.)
- [x] 2.11 **S-S11** `"/dashboard/product/engagement-id"` → `null`. (FR-S8 — non-owner pathname.)
- [x] 2.12 **S-S12** `"/owner/properties/"` → `null`. (FR-S9 — empty assetId segment.)
- [x] 2.13 **S-S13** `"/owner/properties/../etc/passwd"` → `null`. (FR-S9 — path-traversal attempt.)
- [x] 2.14 **S-S14** `""` → `null`. (Empty string.)
- [x] 2.15 **S-S15 (null)** `null` → `null`, no thrown exception. (FR null/undefined guard.)
- [x] 2.16 **S-S15 (undefined)** `undefined` → `null`, no thrown exception. (FR null/undefined guard.)
- [x] 2.17 **S-S16** `"/owner/properties/asset-abc?tab=documents"` → `null`. (FR-S10 — `tab` alone without `doc` is invalid; param-less path is FR-S3, not this case.)
- [x] 2.18 **Fragment rejection** `"/owner/properties/asset-abc?tab=documents&doc=req-123#evil"` → `null`. (D1 step 6 — any hash rejects.)
- [x] 2.19 **Duplicate `doc` param** `"/owner/properties/asset-abc?tab=documents&doc=req-123&doc=req-456"` → `null`. (D1 step 5 — duplicate key rejection.)
- [x] 2.20 **Tampered assetId in link** `"/owner/properties/OTHER-ASSET?tab=documents&doc=req-123"` with `propertyAssetId = "asset-abc"` → `null`. (D1 step 4 — exact pathname match from trusted column.)
- [x] 2.21 Run `pnpm --filter @viewpro/api test notification-link` — confirm ALL tests are **RED** (expected failures, not import errors). Any import error means a scaffolding problem that must be fixed before Phase 3.

---

## Phase 3 — Sanitizer implementation

Depends on: Phase 2 complete (all tests red, no import errors).

File: `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`

- [x] 3.1 Widen `sanitizeOwnerNotificationLink` per D1:
      (a) Keep existing guard: reject if `!linkHref` or `!linkHref.startsWith("/")`.
      (b) Keep `/owner` fast-path (exact string equality, return `"/owner"`).
      (c) Keep param-less `/owner/properties/{assetId}` fast-path — build `expectedParamlessPath = /owner/properties/${propertyAssetId}`; if `linkHref === expectedParamlessPath`, return `linkHref`.
      (d) Attempt `new URL(linkHref, "https://viewpro.local")`; catch throws → `null`. Assert `url.origin === "https://viewpro.local"` → else `null`.
      (e) Build `expectedPathname = /owner/properties/${propertyAssetId}`; assert `url.pathname === expectedPathname` → else `null`.
      (f) Iterate `url.searchParams` keys: any key NOT in `{"tab", "doc"}` → return `null`. Any key with `getAll(key).length > 1` (duplicate) → return `null`.
      (g) Assert `url.searchParams.get("tab") === "documents"` → else `null`.
      (h) Assert `url.hash === ""` → else `null`.
      (i) Return `${url.pathname}${url.search}` on success.
- [x] 3.2 Run `pnpm --filter @viewpro/api test notification-link` — all 21 tests in Phase 2 MUST be **GREEN**. Any red after implementation is a bug, not a TDD skip.
- [x] 3.3 Run `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors in modified file.

---

## Phase 4 — Producer: update linkHref template + producer unit tests

Depends on: Phase 3 green (sanitizer proven). Can proceed while frontend phases are in progress.

File: `viewpro-app/apps/api/src/notifications/notification-producer.service.ts`

- [x] 4.1 Locate line ~264 in `createDocumentOwnerNotification` private method where `linkHref` is set.
- [x] 4.2 Write a failing test first: in the existing producer unit spec, add assertions that `DOCUMENT_REQUESTED`, `DOCUMENT_APPROVED`, and `DOCUMENT_REJECTED` notification create calls receive `linkHref: /owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`. Run — confirm RED.
- [x] 4.3 Change the template string to: `` `linkHref: `/owner/properties/${input.propertyAssetId}?tab=documents&doc=${input.documentRequestId}`` `` (FR-P1, FR-P2, D4). No conditional — `documentRequestId` is always set on this path.
- [x] 4.4 Assert FR-P4: locate any other owner or internal notification type in the producer and confirm their `linkHref` templates are untouched.
- [x] 4.5 Run producer unit tests — all GREEN. Run `pnpm --filter @viewpro/api test notification-producer` (or the appropriate filter) — confirm green.
- [x] 4.6 Run `pnpm --filter @viewpro/api typecheck` — zero errors.

---

## Phase 5 — Frontend: `doc` nuqs param read + prop thread (owner-property-detail)

Depends on: Phase 1 audit (A7 outcome recorded). Can proceed in parallel with Phase 4.

File: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`

- [x] 5.1 **(D5 prerequisite)** Extend the nuqs mock in `owner-property-detail.test.tsx` to key by param name. The mock at ~:24-36 currently returns `React.useState(default)` for every `useQueryState` call. Change it so that:
      - `useQueryState('tab', ...)` returns `["documents", vi.fn()]` (or whatever the existing test default is, preserving test 216's behavior).
      - `useQueryState('doc', ...)` returns `[null, vi.fn()]` initially (null when absent).
      Write a new test asserting that when `useQueryState('doc')` returns `"req-123"`, the `highlightDocId` prop reaches `<OwnerDocumentRequests>`. Run — confirm RED.
- [x] 5.2 Add `const [highlightDocId] = useQueryState('doc', parseAsString)` to `owner-property-detail.tsx` after the existing `tab` param declaration (~:29-34). Read-only; never written. (D2, FR-F1.)
- [x] 5.3 Thread `highlightDocId` as a prop to `<OwnerDocumentRequests>` inside the `documents` TabsContent only (~:163-167). (FR-F1, D2.)
- [x] 5.4 Run `pnpm --filter next-shadcn-dashboard-starter test owner-property-detail` — all tests GREEN including the new threading assertion (5.1).
- [x] 5.5 Run `pnpm --filter next-shadcn-dashboard-starter typecheck` — zero errors.

---

## Phase 6 — Frontend: `doc` scroll/highlight effect (owner-document-requests)

Depends on: Phase 5 complete (`highlightDocId` prop available on `OwnerDocumentRequests`).

Files:
- `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.test.tsx` (new or existing)

### 6a — Tests first (failing)

- [x] 6.1 Add/create `owner-document-requests.test.tsx`. Mock `scrollIntoView` on `Element.prototype`. Write the following failing tests before any implementation in this phase:
      - **S-F1**: `highlightDocId = "req-123"`, query resolves with item `{id: "req-123", ...}` in `data.items` → `scrollIntoView` called once on the matching element.
      - **S-F2**: `highlightDocId = null` (absent) → `scrollIntoView` NOT called.
      - **S-F3**: `highlightDocId = "req-deleted"`, item absent from `data.items` → `scrollIntoView` NOT called, no error thrown, no console.error.
      - **S-F4**: `highlightDocId = "req-123"`, query initially loading → `scrollIntoView` NOT called; then query resolves → `scrollIntoView` IS called.
      - **S-F5** (D2 doc-survival, FE unit): nuqs mock returns `"req-123"` for `doc` param; after mock tab writer fires, `highlightDocId` prop retains `"req-123"`.
- [x] 6.2 Run — confirm ALL 5 new tests are **RED**.

### 6b — Implementation

- [x] 6.3 Add optional prop `highlightDocId?: string | null` to `OwnerDocumentRequests` component signature. (FR-F1.)
- [x] 6.4 Add `data-request-id={request.id}` attribute to the `<li>` in `OwnerDocumentRequestItem` (line ~313). No other structural change to the item. (D3, FR-F3.)
- [x] 6.5 Add a `containerRef = useRef<HTMLUListElement>(null)` to `OwnerDocumentRequests`; attach to the `<ul>` wrapper. (D3 — needed for `querySelector`.)
- [x] 6.6 Add `highlightedId` state: `const [highlightedId, setHighlightedId] = useState<string | null>(null)`. Add a timer ref: `const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`. Clear the timer on unmount in a cleanup effect.
- [x] 6.7 Add `useEffect` keyed on `[highlightDocId, documentRequestsQuery.data]`:
      - Guard: no-op if `!highlightDocId` or `!documentRequestsQuery.isSuccess`. (FR-F6.)
      - Look up item in `documentRequestsQuery.data.items` by `id === highlightDocId`; if absent → no-op. (FR-F5.)
      - If present: call `containerRef.current?.querySelector(`[data-request-id="${CSS.escape(highlightDocId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`. Set `setHighlightedId(highlightDocId)`. After `~2000 ms` clear via `setTimeout` stored in `highlightTimerRef`. (FR-F3, D3.)
- [x] 6.8 Apply transient highlight: where the `<li>` is rendered in the item, add conditional class `cn(..., highlightedId === request.id && 'ring-2 ring-primary')` (or equivalent token). Pass `isHighlighted={highlightedId === request.id}` as a prop to `OwnerDocumentRequestItem` if needed. (FR-F3, D3.)
- [x] 6.9 Run `pnpm --filter next-shadcn-dashboard-starter test owner-document-requests` — all 5 tests GREEN.
- [x] 6.10 Run `pnpm --filter next-shadcn-dashboard-starter typecheck` — zero errors.

---

## Phase 7 — E2E extension: owner-notifications.e2e-spec.ts

Depends on: Phase 3 (sanitizer green) and Phase 4 (producer green). Tests cover the full backend round-trip.

File: `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts`

- [x] 7.1 **(FR-R4 baseline check)** Before adding any new tests: `rg -n "linkHref\|\/owner\/properties" viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` — record the current link-shape assertions (e.g. S-A8 checking `/dashboard/` → null). If any assertion checks for the old param-less `/owner/properties/{assetId}` format for seeded document notification records, note it. These may need to be updated (or confirmed no change needed) based on whether the seeded records carry the old or new format.
- [x] 7.2 **S-P1/S-P2/S-P3 round-trip** — add `it('DOCUMENT_REQUESTED notification stores and returns deep-link linkHref')`: seed a `PropertyAsset`, `PropertyAssetOwner` (ACTIVE), and one `Notification` with `type = DOCUMENT_REQUESTED` and `linkHref = "/owner/properties/${assetId}?tab=documents&doc=${docReqId}"`. Fetch `GET /api/owner/notifications`. Assert: the item's `linkHref` in the response equals `/owner/properties/${assetId}?tab=documents&doc=${docReqId}` (sanitizer accepts and forwards it verbatim). (FR-P1, FR-P2, FR-S3, FR-S4, D5 E2E layer.)
- [x] 7.3 **S-R1 regression** — add or confirm `it('param-less /owner/properties/{assetId} linkHref still accepted')`: seed a notification with `linkHref = "/owner/properties/${assetId}"` (no query params, ACTIVE access). Fetch → `linkHref` in response equals `/owner/properties/${assetId}`. (FR-R1, FR-S3 regression.)
- [x] 7.4 **S-R2 regression** — add or confirm `it('/owner root linkHref still accepted')`: seed a notification with `linkHref = "/owner"` (ACTIVE access or null FK). Fetch → `linkHref = "/owner"`. (FR-R2.)
- [x] 7.5 **S-R3 cross-surface** — confirm the existing S-A8 case (dashboard link → null) is still present and unchanged. Do NOT modify it.
- [x] 7.6 Run `pnpm --filter @viewpro/api test owner-notifications` — all cases GREEN (including pre-existing 24.5 tests).

---

## Phase 8 — Regression: seeded linkHref format reconciliation

Depends on: Phase 4 complete. This phase is CONDITIONAL — execute only if Phase 7.1 or manual inspection reveals that `owner-notifications.e2e-spec.ts` or `demo-smoke.spec.ts` have assertions checking the shape of seeded DOCUMENT_REQUESTED/APPROVED/REJECTED notification `linkHref` values.

- [x] 8.1 `rg -n "linkHref\|owner.*properties\|documents.*doc" viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — list ALL linkHref assertions in both files.
- [x] 8.2 Determine the seed state: `rg -n "DOCUMENT_REQUESTED\|linkHref.*owner.*properties" viewpro-app/scripts/seed-demo.mjs` — does the seed hardcode the old format (param-less) or does it call the producer (which now emits the new format)?
      - If the seed is **hardcoded** to the old format: seeded records carry `/owner/properties/{id}` (no params). E2E assertions checking link shape for these seeded records MUST assert the OLD format. No update to test assertions needed.
      - If the seed **calls the producer**: seeded records carry the new deep-link format. Assertions must be updated to match. `seed-demo.mjs` itself MUST NOT be changed (FR-R3 invariant).
- [x] 8.3 Based on 8.2: update ONLY the test assertion strings where the seed format was confirmed. Do NOT change any production code, the seed script, or unrelated assertions.
- [x] 8.4 Re-run `pnpm --filter @viewpro/api test` — all green.

---

## Phase 9 — Verification gates

Depends on: Phases 2–7 complete (and Phase 8 if triggered). All gates MUST be GREEN before tagging done.

- [x] 9.1 `pnpm --filter @viewpro/api test` — all API vitest suites green.
      - `notification-link.helper.spec.ts` — 21 tests (phases 2–3): all green.
      - `notification-producer.service.spec.ts` — producer linkHref shape tests: all green.
      - `owner-notifications.e2e-spec.ts` — all pre-existing 24.5 tests + new phase 7 tests: all green.
      - `notifications.e2e-spec.ts` — all pre-existing 24.5 internal tests: UNCHANGED, all green. (FR-R4, S-R4.)
- [x] 9.2 `pnpm --filter next-shadcn-dashboard-starter test` — all FE vitest suites green.
      - `owner-property-detail.test.tsx` — including new threading assertion (5.1): green.
      - `owner-document-requests.test.tsx` — 5 new scroll/highlight tests (6.1): green.
- [x] 9.3 `pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in both packages.
- [x] 9.4 `pnpm oxlint` (or equivalent lint command) — zero new lint errors.
- [x] 9.5 **(manual / CI — note only)** `pnpm --filter next-shadcn-dashboard-starter test:seeded` — requires a running seeded Playwright environment. Cannot be verified in the automated gate. Confirm T07, T08, T17, T18a pass unchanged. (FR-R3, S-R6.) Flag as pending if server is unavailable.
- [x] 9.6 Confirm `seed-demo.mjs` is UNCHANGED: `git diff viewpro-app/scripts/seed-demo.mjs` → empty or absent from diff.
- [x] 9.7 Confirm `notification-center.tsx` (the `getSafeRelativeHref` function) is UNCHANGED: `git diff viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx` → empty. (FR-F8, S-F6 — no guard change in scope.)
- [x] 9.8 Confirm `sanitizeInternalNotificationLink` in `notification-link.helper.ts` is UNCHANGED: `git diff` shows no edits to the internal sanitizer block. (FR-S11.)
- [x] 9.9 Security boundary self-check: all 12 rejection scenarios S-S5..S-S16 (plus fragment and duplicate) have a passing unit test. Reviewer MUST verify the closed `{tab, doc}` allowlist — no `if/else` chain, an enumerated iteration that rejects on first unknown key.
- [x] 9.10 Request fresh-context review on the diff (security boundary per design D6 delivery flag) before opening PR.

---

## Acceptance checklist — spec scenarios

| Scenario | Phase | Task(s) | Status |
|----------|-------|---------|--------|
| S-P1 — DOCUMENT_REQUESTED stores deep-link linkHref | 4 | 4.2, 4.3 | done |
| S-P2 — DOCUMENT_APPROVED stores deep-link linkHref | 4 | 4.2, 4.3 | done |
| S-P3 — DOCUMENT_REJECTED stores deep-link linkHref | 4 | 4.2, 4.3 | done |
| S-P4 — Other types retain current linkHref | 4 | 4.4 | done |
| S-S1 — /owner root accepted unchanged | 2 + 3 | 2.1, 3.1 | done |
| S-S2 — Param-less property path accepted | 2 + 3 | 2.2, 3.1 | done |
| S-S3 — Full deep-link accepted | 2 + 3 | 2.3, 3.1 | done |
| S-S4 — Param-order independent | 2 + 3 | 2.4, 3.1 | done |
| S-S5 — Unknown param → null | 2 + 3 | 2.5, 3.1 | done |
| S-S6 — Redirect param → null | 2 + 3 | 2.6, 3.1 | done |
| S-S7 — Wrong tab value → null | 2 + 3 | 2.7, 3.1 | done |
| S-S8 — doc alone → null | 2 + 3 | 2.8, 3.1 | done |
| S-S9 — Protocol-relative → null | 2 + 3 | 2.9, 3.1 | done |
| S-S10 — Absolute URL → null | 2 + 3 | 2.10, 3.1 | done |
| S-S11 — Non-owner pathname → null | 2 + 3 | 2.11, 3.1 | done |
| S-S12 — Empty assetId → null | 2 + 3 | 2.12, 3.1 | done |
| S-S13 — Path-traversal → null | 2 + 3 | 2.13, 3.1 | done |
| S-S14 — Empty string → null | 2 + 3 | 2.14, 3.1 | done |
| S-S15 — null/undefined → null | 2 + 3 | 2.15, 2.16, 3.1 | done |
| S-S16 — tab alone → null | 2 + 3 | 2.17, 3.1 | done |
| S-F1 — Deep-link scrolls + highlights matching item | 6 | 6.1, 6.3–6.8 | done |
| S-F2 — doc absent → no scroll, no error | 6 | 6.1, 6.3–6.8 | done |
| S-F3 — doc not in list → no scroll, no error | 6 | 6.1, 6.3–6.8 | done |
| S-F4 — Scroll fires after query resolves | 6 | 6.1, 6.7 | done |
| S-F5 — doc survives tab nuqs replace | 5 + 6 | 5.1, 6.1 | done |
| S-F6 — getSafeRelativeHref forwards query intact | 9 | 9.7 (no-op confirm) | done |
| S-R1 — Historical param-less notifications work | 3 + 7 | 3.1c, 7.3 | done |
| S-R2 — /owner root link unaffected | 3 + 7 | 3.1b, 7.4 | done |
| S-R3 — Cross-surface link blocked for OWNER surface | 3 + 7 | 3.1, 7.5 | done |
| S-R4 — notifications.e2e-spec.ts green | 9 | 9.1 | done |
| S-R5 — owner-notifications.e2e-spec.ts green | 7 + 9 | 7.6, 9.1 | done |
| S-R6 — Seeded smoke T07,T08,T17,T18a green | 9 | 9.5 | pending (requires seeded server) |
