# Spec — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

## Status

Draft — 2026-06-22.

## Origin

Proposal: `openspec/changes/24-6a-notification-deeplink-owner-documents/proposal.md`
Sibling format reference: `openspec/changes/24-5-notification-routing-e2e/spec.md`

---

## Functional Requirements

### Group P — Producer: linkHref deep-link shape

**FR-P1. All three owner document notification types encode the documentRequestId into linkHref.**
`createDocumentOwnerNotification` in `notification-producer.service.ts` MUST emit
`linkHref = /owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`
for every call that produces a `DOCUMENT_REQUESTED`, `DOCUMENT_APPROVED`, or `DOCUMENT_REJECTED`
notification. All three types flow through the same private method; no per-type branching is needed.

**FR-P2. The deep-link shape is exact — no variation is allowed.**
The emitted string MUST be exactly `/owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`.
No trailing slash, no URL-encoding of the literal template segments, no additional query params.
`propertyAssetId` and `documentRequestId` are the string values already present in the producer input.

**FR-P3. No producer signature change.**
The `createDocumentOwnerNotification` method signature is unchanged. `documentRequestId` is already
present in the input type and persisted; the only change is the `linkHref` string template.

**FR-P4. Other notification types are unaffected.**
Notification types outside `{DOCUMENT_REQUESTED, DOCUMENT_APPROVED, DOCUMENT_REJECTED}` retain
their current `linkHref` values. Internal notifications and any other owner notification type
are NOT modified.

---

### Group S — Sanitizer: `sanitizeOwnerNotificationLink` allowlist (SECURITY-CRITICAL)

**FR-S1. The sanitizer MUST use URL parsing, not string equality, for the deep-link path.**
`sanitizeOwnerNotificationLink` MUST parse the stored `linkHref` as a URL and separately validate
`pathname` and `searchParams`. The pre-existing exact-string equality test (line ~51) is replaced
by the pathname-plus-allowlist check described in FR-S2 through FR-S5.

**FR-S2. The `/owner` root path is still accepted (preserved).**
A `linkHref` of exactly `/owner` (no trailing slash, no query params) MUST return `/owner` unchanged.
This rule is unchanged from the existing allowlist.

**FR-S3. The param-less property path is still accepted (preserved).**
A `linkHref` of `/owner/properties/{propertyAssetId}` with NO query params MUST be accepted and
returned unchanged. `propertyAssetId` is treated as any non-empty segment; no UUID format
validation is required. This rule preserves the behavior required for historical notifications.

**FR-S4. The document deep-link is accepted ONLY when both whitelisted params are present and no extra params exist.**
A `linkHref` of `/owner/properties/{propertyAssetId}?tab=documents&doc={documentRequestId}` MUST
be accepted when:
- `pathname === /owner/properties/{propertyAssetId}` (exact, non-empty assetId segment),
- exactly the keys `{tab, doc}` (and no other key) appear in `searchParams`,
- `tab` value is exactly `documents`.
The accepted return value MUST be the full string including query params:
`/owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`.

**FR-S5. Any non-whitelisted query param causes the sanitizer to return null.**
If `searchParams` contains ANY key that is not in `{tab, doc}`, the sanitizer MUST return `null`.
This is an enumerated allowlist — unknown params are rejected, not silently dropped.

**FR-S6. A tab value other than `documents` on a property path with a doc param causes the sanitizer to return null.**
If the `tab` param value is not `documents` (e.g. `tab=tracking`, `tab=summary`), the sanitizer
MUST return `null`. (A param-less property path with no `tab` is covered by FR-S3 and is accepted.)

**FR-S7. A protocol-relative or absolute URL causes the sanitizer to return null.**
A `linkHref` beginning with `//` (protocol-relative) or containing `://` (absolute URL with scheme)
MUST return `null`. The sanitizer MUST NOT pass any value that could resolve to an external origin.

**FR-S8. A pathname that does not begin with `/owner` causes the sanitizer to return null.**
Any `linkHref` whose pathname does not start with `/owner` (e.g. `/dashboard/…`, `/admin/…`)
MUST return `null`.

**FR-S9. A pathname that starts with `/owner/properties/` but has a tampered or missing assetId segment causes the sanitizer to return null.**
A `linkHref` of `/owner/properties/` (empty trailing segment), `/owner/properties` (no trailing slash),
or `/owner/properties/../etc` MUST return `null`. The assetId segment MUST be non-empty and must
not contain path-traversal sequences.

**FR-S10. The `doc` param alone (without `tab=documents`) causes the sanitizer to return null.**
A `linkHref` of `/owner/properties/{assetId}?doc={id}` (missing `tab` or `tab != documents`) MUST
return `null`. Both `tab=documents` and `doc` MUST be present together for the deep-link to be accepted.

**FR-S11. The internal sanitizer (`sanitizeInternalNotificationLink`) is untouched.**
Only `sanitizeOwnerNotificationLink` is modified. The internal allowlist, its logic, and all its
existing tests remain unchanged.

---

### Group F — Frontend: doc param read, scroll, and highlight

**FR-F1. The `doc` query param is read on the owner property detail page.**
`owner-property-detail.tsx` MUST read the `doc` query param from the URL and pass it as a prop
(`highlightDocId`) to the `OwnerDocumentRequests` component. The read MUST be safe (undefined/null
when absent). `owner-property-detail.tsx` MUST NOT act on `doc` itself — it is an opaque forwarder.

**FR-F2. The `doc` param survives tab activation without being stripped.**
The `tab` nuqs param uses `{ history: 'replace', scroll: false, shallow: true }`. After
`router.push(safeHref)` fires with a deep-link URL, the `doc` value MUST still be readable at the
time the scroll/highlight effect runs in `OwnerDocumentRequests`. The implementation MUST ensure
`doc` is not lost when `tab` is written (e.g. by reading `doc` via `useSearchParams` as a
read-only param, or by registering it as its own nuqs param).

**FR-F3. When `highlightDocId` matches a rendered item, that item is scrolled into view and highlighted.**
`owner-document-requests.tsx` MUST attach a `ref` to each `OwnerDocumentRequestItem`, keyed by
`request.id`. When `highlightDocId` is non-null and an item with a matching `request.id` is present
in the rendered list, the component MUST call `scrollIntoView()` on that item's element and apply
a transient visual highlight (e.g. a timed CSS class or style that clears after a defined duration).
The effect MUST re-run when the documents query resolves (i.e. it fires after data is loaded,
not only on mount).

**FR-F4. When `highlightDocId` is absent or null, the component behaves as today.**
No scroll, no highlight, no error. Landing on the documents tab without a `doc` param is the
unchanged nominal path.

**FR-F5. When `highlightDocId` is present but no rendered item matches, the component degrades gracefully.**
If `highlightDocId` is non-null but no item with a matching `request.id` is in the rendered list
(item paginated out, deleted, or not yet loaded), the component MUST NOT throw, crash, or log
an unhandled error. The documents tab remains active and the list renders normally. No scroll fires.

**FR-F6. The scroll/highlight effect does not fire while the documents query is in a loading state.**
The effect MUST guard on query loading state. Attempting `scrollIntoView` on a ref that is not yet
mounted (query still loading) MUST NOT cause a runtime error.

**FR-F7. The `tab` param and existing tab activation are unchanged.**
The `tab=documents` activation path via nuqs (`owner-property-detail.tsx:29-34`) is preserved as-is.
No change to how `tab` is written or read. The `doc` param does not change tab selection logic.

**FR-F8. `getSafeRelativeHref` forwards query params and hash unchanged — no modification.**
The frontend href guard (`notification-center.tsx:321-337`) already returns
`${url.pathname}${url.search}${url.hash}`. It is NOT modified in this slice. A deep-link
`linkHref` that passes the backend sanitizer is forwarded verbatim by the frontend guard.

---

### Group R — Regression preservation invariants

**FR-R1. Historical notifications with param-less linkHref continue to work.**
A stored `linkHref` of `/owner/properties/{assetId}` (no query params) MUST still sanitize
through and navigate to the property page (Documentos tab NOT auto-activated, consistent with
current behavior). No backfill of historical records.

**FR-R2. The `/owner` root link is unaffected.**
A notification with `linkHref = /owner` MUST still pass the sanitizer and navigate to the owner root.

**FR-R3. Pre-existing test baselines remain green.**
- `notifications.e2e-spec.ts` (internal e2e) — all cases pass unchanged.
- `owner-notifications.e2e-spec.ts` (24.5 e2e) — all cases pass unchanged, including the
  existing link-sanitization assertions for `/dashboard/…` → null.
- `demo-smoke.spec.ts` T07, T08, T17, T18a — all pass unchanged.
- Stage 26.2 deterministic seed contract — unchanged.

**FR-R4. The Stage 24.5 link destination assertions in `owner-notifications.e2e-spec.ts` are preserved.**
Any existing assertion that checks `linkHref` for the seeded demo notification records
MUST be updated to reflect the new deep-link shape (`?tab=documents&doc=…`) for the three owner
document types, OR the seeded records must reflect the new format. The 24.5 spec asserted the
then-current format; 24.6a changes that format for NEW notifications. If the seed is unchanged
(as required), the e2e assertions against seeded data MUST reflect whatever format the seeded data
carries. The exact behavior depends on whether the seed records were produced before or after this
change — this is noted as a spec-level assumption. (See Risks.)

---

## Acceptance Scenarios

### P — Producer

**S-P1 — DOCUMENT_REQUESTED notification stores the deep-link linkHref.**
Given: `createDocumentOwnerNotification` is called with `propertyAssetId = "asset-abc"` and
`documentRequestId = "req-123"`, producing a `DOCUMENT_REQUESTED` notification.
When: the notification is persisted.
Then: the stored `linkHref` is exactly `/owner/properties/asset-abc?tab=documents&doc=req-123`.

**S-P2 — DOCUMENT_APPROVED notification stores the deep-link linkHref.**
Given: same call with `propertyAssetId = "asset-abc"`, `documentRequestId = "req-456"`,
producing a `DOCUMENT_APPROVED` notification.
When: persisted.
Then: `linkHref = /owner/properties/asset-abc?tab=documents&doc=req-456`.

**S-P3 — DOCUMENT_REJECTED notification stores the deep-link linkHref.**
Given: same call, producing a `DOCUMENT_REJECTED` notification.
When: persisted.
Then: `linkHref = /owner/properties/asset-abc?tab=documents&doc=req-456`.

**S-P4 — Non-document owner notification types retain their current linkHref.**
Given: any notification type other than the three owner document types is produced.
When: persisted.
Then: `linkHref` matches the pre-existing template for that type. No change from this slice.

---

### S — Sanitizer (SECURITY-CRITICAL)

#### Acceptance cases

**S-S1 — `/owner` root is accepted unchanged.**
Given: `linkHref = "/owner"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner"`.
(Covers FR-S2. Regression guard.)

**S-S2 — Param-less property path is accepted unchanged.**
Given: `linkHref = "/owner/properties/asset-abc"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc"`.
(Covers FR-S3. Regression guard.)

**S-S3 — Full deep-link with `tab=documents` and `doc` is accepted.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc?tab=documents&doc=req-123"`.
(Covers FR-S4. Core new acceptance case.)

**S-S4 — Deep-link with `doc` and `tab` in reversed param order is accepted.**
Given: `linkHref = "/owner/properties/asset-abc?doc=req-123&tab=documents"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns a non-null string containing both `tab=documents` and `doc=req-123`.
(URL param order MUST NOT affect acceptance.)

#### Rejection cases (SECURITY-CRITICAL)

**S-S5 — Unknown query param causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123&evil=x"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. Enumerated allowlist — any unknown param is a security rejection.)

**S-S6 — Single unknown query param with no doc or tab causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?redirect=http://evil.com"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. Open redirect attempt via unknown param.)

**S-S7 — `tab` value other than `documents` causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S6. Unexpected tab value.)

**S-S8 — `doc` param alone (missing `tab`) causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S10. Incomplete deep-link is treated as invalid.)

**S-S9 — Protocol-relative URL causes rejection → null.**
Given: `linkHref = "//evil.example.com/owner/properties/asset-abc"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S7. Protocol-relative bypass attempt.)

**S-S10 — Absolute URL with scheme causes rejection → null.**
Given: `linkHref = "https://evil.example.com/owner/properties/asset-abc"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S7. Absolute URL bypass attempt.)

**S-S11 — Non-owner pathname causes rejection → null.**
Given: `linkHref = "/dashboard/product/engagement-id"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8. Cross-surface link must not pass the owner sanitizer.)

**S-S12 — Empty assetId segment in property path causes rejection → null.**
Given: `linkHref = "/owner/properties/"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Malformed property path.)

**S-S13 — Path-traversal in pathname causes rejection → null.**
Given: `linkHref = "/owner/properties/../etc/passwd"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Path-traversal attempt.)

**S-S14 — Empty string causes rejection → null.**
Given: `linkHref = ""`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.

**S-S15 — Null or undefined input causes rejection → null.**
Given: `linkHref` is `null` or `undefined`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`. No thrown exception.

**S-S16 — `tab` alone (without `doc`) with correct value is rejected → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S10. `tab=documents` alone is not a valid deep-link; `doc` MUST accompany it.
Note: the param-less path `/owner/properties/asset-abc` is accepted under FR-S3 via S-S2.)

---

### F — Frontend

**S-F1 — Navigating to the owner property page with `?doc=req-123` scrolls and highlights the matching item.**
Given: the owner property page is loaded with `?tab=documents&doc=req-123`.
And: the documents query has resolved and includes a document request with `id = "req-123"`.
When: the `OwnerDocumentRequests` component mounts and `highlightDocId = "req-123"`.
Then: the item with `request.id = "req-123"` has `scrollIntoView()` called on its element.
And: a transient highlight style or class is applied to that item.
And: no error is thrown.

**S-F2 — `doc` param is absent → no scroll, no highlight, no error.**
Given: the owner property page is loaded with `?tab=documents` (no `doc` param).
When: `OwnerDocumentRequests` renders.
Then: no item is scrolled or highlighted. The component renders normally.

**S-F3 — `doc` param references an item not in the rendered list → tab active, no scroll, no error.**
Given: `?tab=documents&doc=req-deleted` but no document request with `id = "req-deleted"` is rendered.
When: `OwnerDocumentRequests` renders with `highlightDocId = "req-deleted"`.
Then: the documents tab is active. No `scrollIntoView()` call. No thrown error. No console error thrown by the component.

**S-F4 — The scroll effect fires after the documents query resolves, not only on initial mount.**
Given: the documents query is loading when the component first mounts.
And: `highlightDocId` is set.
When: the query resolves and the matching item is now rendered.
Then: `scrollIntoView()` fires on the matching item's element.
(No precondition on mount timing — the effect is data-driven.)

**S-F5 — `doc` param survives `tab` nuqs replace.**
Given: the owner property page is navigated to with `?tab=documents&doc=req-123`.
And: the `tab` nuqs param is written (or the existing `tab=documents` is confirmed via `history: 'replace'`).
When: the `useEffect` / scroll effect reads `doc`.
Then: `doc` value is still `"req-123"` (not stripped by the tab replace).

**S-F6 — Deep-link `linkHref` round-trips through `getSafeRelativeHref` with query intact.**
Given: `getSafeRelativeHref` is called with `"/owner/properties/asset-abc?tab=documents&doc=req-123"`.
When: the function processes the href.
Then: the return value is `"/owner/properties/asset-abc?tab=documents&doc=req-123"`.
(The frontend guard is not modified — this is a regression assertion that its existing forwarding
of `pathname + search + hash` covers the new deep-link format without change.)

---

### R — Regression preservation

**S-R1 — Historical param-less owner property notification navigates to property page (no tab activation).**
Given: a stored notification with `linkHref = "/owner/properties/asset-abc"` (no query params).
When: the owner clicks the notification.
Then: the sanitizer returns `"/owner/properties/asset-abc"`.
And: the owner property page loads without auto-activating any specific tab via a `tab` param.
And: no scroll/highlight effect fires (no `doc` param).

**S-R2 — `/owner` root link navigates to owner root.**
Given: a stored notification with `linkHref = "/owner"`.
When: clicked.
Then: the sanitizer returns `"/owner"` and navigation goes to the owner root.

**S-R3 — Cross-surface link sanitization remains blocked for OWNER-surface records.**
Given: a notification with `surface = OWNER` and `linkHref = "/dashboard/product/some-id"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`. The list response for that record returns `linkHref: null`.
(Preserved from 24.5 FR-A8 / S-A8.)

**S-R4 — Internal e2e baseline: `notifications.e2e-spec.ts` remains green.**
Given: all changes from this slice are applied.
When: the internal notification e2e suite runs.
Then: all existing cases pass with no modification.

**S-R5 — Owner notification e2e baseline: `owner-notifications.e2e-spec.ts` remains green.**
Given: all changes from this slice are applied.
When: the owner notification e2e suite runs.
Then: all existing cases pass. (If seeded demo records now carry the deep-link format, link-shape
assertions in that suite must be updated to match the new format — see Risks.)

**S-R6 — Seeded smoke tests T07, T08, T17, T18a remain green.**
Given: all changes from this slice are applied.
When: the full seeded smoke suite runs.
Then: T07, T08, T17, T18a all pass with no modification to the test code.

---

## Non-Functional Notes

- **Sanitizer is a security boundary.** `sanitizeOwnerNotificationLink` is a write/read guard
  on stored data that reaches the browser. Any widening MUST use an enumerated allowlist.
  Passthrough or substring matching is not acceptable. The rejection cases in Group S (FR-S5
  through FR-S11) are security guards, not optional edge cases.

- **No DB schema change.** `linkHref` is a stored text column. `documentRequestId` is already
  persisted. No migration is required.

- **No producer signature change.** Input type is unchanged; `documentRequestId` is already
  present in the input object passed to `createDocumentOwnerNotification`.

- **`getSafeRelativeHref` is untouched.** The frontend href guard already returns
  `${url.pathname}${url.search}${url.hash}`. No modification to `notification-center.tsx`
  for the guard function is in scope.

- **Tab activation is unchanged.** The nuqs `tab` param and how `owner-property-detail.tsx`
  activates the documents tab are not modified. `doc` is additive alongside `tab`.

- **Historical notifications.** Pre-existing owner document notification records carry
  `/owner/properties/{assetId}` with no deep-link params. They continue to work (FR-R1).
  No backfill is in scope.

- **TDD requirement.** All modified logic (producer linkHref template, sanitizer allowlist,
  frontend `doc` read + scroll/highlight) MUST be covered by unit and/or integration tests
  before the implementation is considered complete. Tests for rejection scenarios (S-S5 through
  S-S16) are mandatory, not optional.

---

## Risks / Spec-Level Assumptions

| # | Assumption / Risk | Impact |
|---|-------------------|--------|
| A1 | The seeded demo data (`seed-demo.mjs`) is unchanged per the proposal. If the seeded owner document notifications were produced before this change (param-less `linkHref`), the 24.5 e2e assertions checking link shape against seeded records must reflect the OLD format — not the new deep-link. If those assertions currently check for the param-less format, they remain correct and need no update. If the seed is re-run after this change applies, seeded records would carry the new format and those assertions would need updating. Design phase must clarify which state is authoritative. | Medium |
| A2 | FR-S10 assumes `tab=documents` alone (without `doc`) is rejected. If a future use case needs `tab=documents` without a doc highlight, the allowlist must be explicitly widened. This spec defines the current narrowest safe shape. | Low |
| A3 | FR-F5 assumes nuqs `tab` replace does not strip unregistered params. This must be verified in design. If nuqs strips unknown params during replace, `doc` MUST be registered as its own nuqs param. | Medium |
| A4 | S-S4 asserts param order independence. The implementation must not rely on param order when iterating `searchParams`. | Low |
