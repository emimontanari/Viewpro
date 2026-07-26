# Spec — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Status

Draft — 2026-06-22.

## Origin

Proposal: `openspec/changes/24-6b-notification-deeplink-internal-documents/proposal.md`
Sibling format reference: `openspec/changes/24-6a-notification-deeplink-owner-documents/spec.md`

---

## Functional Requirements

### Group P — Producer: linkHref deep-link shape

**FR-P1. The internal `DOCUMENT_UPLOADED` notification MUST encode `documentRequestId` into `linkHref`.**
`notifyDocumentUploaded` in `notification-producer.service.ts` MUST emit
`linkHref = /dashboard/product/${propertyEngagementId}?doc=${documentRequestId}`
for every internal `DOCUMENT_UPLOADED` notification.

**FR-P2. The deep-link shape is exact — no variation is allowed.**
The emitted string MUST be exactly `/dashboard/product/${propertyEngagementId}?doc=${documentRequestId}`.
No trailing slash, no URL-encoding of the literal template segments, no additional query params,
no `tab` param (the internal page is not tabbed). `propertyEngagementId` and `documentRequestId`
are the string values already present in `DocumentUploadedInternalNotificationInput`.

**FR-P3. No producer signature change.**
The `notifyDocumentUploaded` method signature is unchanged. `documentRequestId` is already
present in the input type and is already persisted to the DB column at line 115; the only
change is the `linkHref` string template at line 112.

**FR-P4. All other internal notification types are unaffected.**
Any internal notification type other than `DOCUMENT_UPLOADED` retains its current `linkHref`
value. Owner notifications and the `sanitizeOwnerNotificationLink` function are NOT modified.

---

### Group S — Sanitizer: `sanitizeInternalNotificationLink` allowlist (SECURITY-CRITICAL)

**FR-S1. The sanitizer MUST use URL parsing, not string equality, for the parameterised product path.**
`sanitizeInternalNotificationLink` MUST parse the stored `linkHref` as a URL (using a fixed
base `https://viewpro.local`) and separately validate `pathname` and `searchParams` for any
link that carries query params. The pre-existing product-path branch (line 26, exact-string
equality) is replaced by the pathname-plus-allowlist check described in FR-S2 through FR-S9.

**FR-S2. `SAFE_INTERNAL_LINKS` static set is preserved unchanged.**
Links whose string value is exactly a member of `SAFE_INTERNAL_LINKS`
(`/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`, `/dashboard/status-change-requests`)
MUST pass directly through without URL parsing and return the original string unchanged.
This fast-path runs BEFORE the URL-parse branch and is byte-for-byte identical to the existing code.

**FR-S3. The param-less product path is still accepted (preserved).**
A `linkHref` of `/dashboard/product/{propertyEngagementId}` with NO query params MUST be
accepted and returned unchanged. `propertyEngagementId` is treated as any non-empty path
segment; no UUID format validation is required. This preserves historical notifications
(pre-24.6b) that carry the bare product path.

**FR-S4. The document deep-link is accepted ONLY when `doc` is the sole query param and it is non-empty.**
A `linkHref` of `/dashboard/product/{propertyEngagementId}?doc={documentRequestId}` MUST
be accepted when:
- `pathname === /dashboard/product/{propertyEngagementId}` (exact, non-empty `propertyEngagementId` segment),
- exactly the key `{doc}` (and no other key) appears in `searchParams`,
- `doc` value is non-empty.
The accepted return value MUST be the full string including the query param:
`/dashboard/product/${propertyEngagementId}?doc=${documentRequestId}`.

**FR-S5. The internal `ALLOWED_INTERNAL_QUERY_PARAM_NAMES` allowlist is `{doc}` only — no `tab`.**
The internal product page is not tabbed; `tab` is NOT a valid internal query param. Any key
in `searchParams` that is not `doc` MUST cause the sanitizer to return `null`. This is an
enumerated allowlist. Unknown params are rejected, not silently dropped.

**FR-S6. An empty `doc` value causes the sanitizer to return `null`.**
If the `doc` key is present but its value is an empty string (`?doc=`), the sanitizer MUST
return `null`. A non-empty `doc` is required for the deep-link to be accepted.

**FR-S7. A duplicate `doc` param causes the sanitizer to return `null`.**
If `doc` appears more than once in the query string (e.g. `?doc=a&doc=b`), the sanitizer
MUST return `null`. Duplicate params are a rejection signal.

**FR-S8. A protocol-relative or absolute URL causes the sanitizer to return `null`.**
A `linkHref` beginning with `//` (protocol-relative) or containing `://` (absolute URL with
scheme) MUST return `null`. The sanitizer MUST NOT pass any value that could resolve to an
external origin.

**FR-S9. A pathname that is not the exact product path causes the sanitizer to return `null`.**
Any `linkHref` whose pathname does not match `/dashboard/product/{non-empty-segment}` exactly
MUST return `null`. This includes:
- `/dashboard/product/` (trailing slash, empty segment),
- `/dashboard/product` (no trailing slash, no segment),
- `/dashboard/product/../etc/passwd` (path traversal),
- Any other pathname (e.g. `/dashboard/seguimiento/…`, `/owner/…`).

**FR-S10. A URL fragment causes the sanitizer to return `null`.**
If the URL contains a `#` fragment (e.g. `?doc=req-123#section`), the sanitizer MUST return
`null`. The fixed-base URL parse plus `url.hash` check enforces this. Fragments are not
meaningful in this surface and are rejected as tampered input.

**FR-S11. The origin of the parsed URL is asserted against the fixed base `https://viewpro.local`.**
After parsing with `new URL(linkHref, 'https://viewpro.local')`, the sanitizer MUST assert
`url.origin === 'https://viewpro.local'`. An origin mismatch (caused by an absolute URL or
protocol-relative input bypassing the base) MUST cause the sanitizer to return `null`.

**FR-S12. `sanitizeOwnerNotificationLink` (24.6a) and its `{tab, doc}` allowlist are completely untouched.**
The owner sanitizer, its entire logic, its existing test coverage, and its `{tab, doc}`
allowlist are NOT modified by this slice. No cross-contamination between the internal and
owner sanitizer codepaths.

---

### Group F — Frontend: `doc` param read, filter reset, Collapsible, scroll, and highlight

**FR-F1. The `doc` query param is read in `property-document-requests.tsx`.**
`PropertyDocumentRequests` MUST read the `doc` query param via `useQueryState('doc', parseAsString)`.
The read MUST be safe (returns `null` when the param is absent). Reading is additive alongside
the existing `documentos` filter nuqs param; both coexist.

**FR-F2. On arrival with a `doc` param, the `documentos` filter MUST be forced to `'all'` exactly once.**
When `doc` is non-null on the component's first render with a non-null doc param, the
`documentos` filter MUST be reset to `'all'` (`setDocumentFilter(null)`) via a `useRef`-guarded
one-shot effect. The guard fires ONCE per component mount and then never re-runs, so subsequent
user-initiated filter changes are NOT clobbered.

**FR-F3. The one-shot guard MUST NOT re-fire after the initial deep-link arrival.**
After the `useRef` flag is flipped, any change to the `documentos` param driven by the user
(selecting a different filter) MUST be allowed to persist without the one-shot reset interfering.

**FR-F4. The resolved Collapsible group MUST be open when the target document is in the resolved group.**
The `resolved` group (APPROVED + REJECTED requests) renders behind a `Collapsible` with
`defaultOpen={false}`. When `doc` is non-null and the query has resolved with data, the
component MUST detect whether the target `documentRequestId` belongs to the resolved group
and open the Collapsible accordingly. Because `defaultOpen` is a one-time init prop and the
query resolves post-mount (R1 — timing risk), the implementation MUST use either a controlled
`open` prop or re-key the Collapsible on resolved-target presence so it re-mounts with the
correct initial state. The exact mechanism is a design decision; the spec only requires that
the Collapsible IS open when the user arrives.

**FR-F5. `data-request-id` attribute MUST be added to every request `<li>` element.**
Each document request item in the list MUST carry a `data-request-id={request.id}` attribute.
This is the DOM selector anchor for the scroll/highlight effect. (The owner component already
carries this attribute; this ports the same pattern to the internal component.)

**FR-F6. A `containerRef` MUST be attached to the requests `<ul>` element.**
The `<ul>` that wraps the document request items MUST carry a `ref` (e.g. `containerRef`).
The scroll/highlight effect uses this container ref as the selector root, scoping the
`[data-request-id]` query to the correct subtree.

**FR-F7. When `doc` matches a rendered item, `scrollIntoView()` MUST be called on that item.**
After the documents query resolves and the `documentos` filter is `'all'`, the component MUST:
1. Query `containerRef.current` for `[data-request-id="${CSS.escape(doc)}"]`.
2. If found, call `scrollIntoView({ block: 'center' })` on the element.
3. Apply a transient visual highlight (e.g. `ring-2 ring-primary` Tailwind classes) to the
   element via a timed callback that removes the highlight after a defined duration (e.g. 2 s).

**FR-F8. The scroll/highlight effect MUST run after the documents query resolves, not only on mount.**
The `useEffect` that triggers scroll/highlight MUST depend on query resolution state (e.g.
`isSuccess`, the resolved data array) so that it fires correctly when data arrives after the
initial render. It MUST NOT fire while the query is still loading.

**FR-F9. Graceful degrade when `doc` is absent, not found, or deleted.**
When `doc` is `null` (param absent): no filter reset, no Collapsible override, no scroll, no highlight.
When `doc` is non-null but no item with matching `request.id` is rendered (deleted, loading):
the filter is still forced to `'all'` (one-shot) and the Collapsible state is unchanged, but
no scroll and no highlight fire. No thrown error, no unhandled promise rejection, no console error
from the component.

**FR-F10. `getSafeRelativeHref` is NOT modified.**
The frontend href guard in `notification-center.tsx` already returns
`${url.pathname}${url.search}${url.hash}`. It is NOT modified in this slice. A deep-link
`linkHref` that passes the backend sanitizer is forwarded verbatim by the frontend guard.

---

### Group R — Regression preservation invariants

**FR-R1. Historical notifications with param-less `linkHref` continue to work.**
A stored `linkHref` of `/dashboard/product/{propertyEngagementId}` (no query params) MUST
still sanitize through and navigate to the product page. No filter override, no scroll, no
highlight fires (no `doc` param). No backfill of historical records.

**FR-R2. `SAFE_INTERNAL_LINKS` static set members are unaffected.**
Notifications with `linkHref` in `{/dashboard, /dashboard/seguimiento, /dashboard/users,
/dashboard/status-change-requests}` MUST still pass `sanitizeInternalNotificationLink`
unchanged.

**FR-R3. The owner sanitizer and owner product page (24.6a) are completely unaffected.**
`sanitizeOwnerNotificationLink`, its `{tab, doc}` allowlist, the owner property detail page,
and all 24.6a test coverage are NOT changed or broken by this slice.

**FR-R4. Pre-existing test baselines remain green.**
- `notifications.e2e-spec.ts` (internal e2e) — all existing cases pass unchanged.
- `owner-notifications.e2e-spec.ts` (24.5/24.6a e2e) — all existing cases pass unchanged.
- `demo-smoke.spec.ts` T07, T08, T17, T18a — all pass unchanged.
- Stage 26.2 deterministic seed contract — unchanged.

---

## Acceptance Scenarios

### P — Producer

**S-P1 — Internal `DOCUMENT_UPLOADED` notification stores the deep-link `linkHref`.**
Given: `notifyDocumentUploaded` is called with `propertyEngagementId = "eng-abc"` and
`documentRequestId = "req-123"`.
When: the notification is persisted.
Then: the stored `linkHref` is exactly `/dashboard/product/eng-abc?doc=req-123`.
(Covers FR-P1, FR-P2.)

**S-P2 — The deep-link `linkHref` has the exact shape — no trailing slash, no extra params.**
Given: `propertyEngagementId = "eng-xyz"` and `documentRequestId = "req-456"`.
When: the notification is persisted.
Then: `linkHref = /dashboard/product/eng-xyz?doc=req-456` — no `tab`, no trailing slash,
no URL-encoding of the literal template segments.
(Covers FR-P2.)

**S-P3 — Other internal notification types retain their current `linkHref`.**
Given: any internal notification type other than `DOCUMENT_UPLOADED` is produced.
When: persisted.
Then: `linkHref` matches the pre-existing template for that type. No change from this slice.
(Covers FR-P4.)

---

### S — Sanitizer (SECURITY-CRITICAL)

#### Acceptance cases

**S-S1 — `/dashboard` static link is accepted unchanged.**
Given: `linkHref = "/dashboard"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard"`.
(Covers FR-S2. `SAFE_INTERNAL_LINKS` fast-path regression guard.)

**S-S2 — `/dashboard/seguimiento` is accepted unchanged.**
Given: `linkHref = "/dashboard/seguimiento"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard/seguimiento"`.
(Covers FR-S2. Regression guard.)

**S-S3 — `/dashboard/users` is accepted unchanged.**
Given: `linkHref = "/dashboard/users"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard/users"`.
(Covers FR-S2. Regression guard.)

**S-S4 — `/dashboard/status-change-requests` is accepted unchanged.**
Given: `linkHref = "/dashboard/status-change-requests"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard/status-change-requests"`.
(Covers FR-S2. Regression guard.)

**S-S5 — Param-less product path is accepted unchanged.**
Given: `linkHref = "/dashboard/product/eng-abc"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard/product/eng-abc"`.
(Covers FR-S3. Historical notification regression guard.)

**S-S6 — Full deep-link with `doc` param is accepted.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-123"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `"/dashboard/product/eng-abc?doc=req-123"`.
(Covers FR-S4. Core new acceptance case.)

**S-S7 — Deep-link with a UUID-format `doc` value is accepted.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=550e8400-e29b-41d4-a716-446655440000"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns the full link including the UUID doc value.
(Covers FR-S4. Real-world id format.)

#### Rejection cases (SECURITY-CRITICAL)

**S-S8 — Unknown query param causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-123&evil=x"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. Enumerated allowlist — any unknown param is a security rejection.)

**S-S9 — `tab` param causes rejection → null (internal page is NOT tabbed).**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-123&tab=documentos"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. `tab` is explicitly excluded from the internal allowlist — this is a key
divergence from the owner sanitizer's `{tab, doc}` allowlist and a CRITICAL security guard.)

**S-S10 — `tab` param alone (no `doc`) causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?tab=documentos"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. No `tab` variant is accepted on the internal surface.)

**S-S11 — Open redirect attempt via unknown param causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?redirect=http://evil.com"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S5. Single unknown param open redirect attempt.)

**S-S12 — Empty `doc` value causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?doc="`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S6. Empty doc is not a valid deep-link anchor.)

**S-S13 — Duplicate `doc` param causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-1&doc=req-2"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S7. Duplicate params are a rejection signal — HTTP param pollution guard.)

**S-S14 — Protocol-relative URL causes rejection → null.**
Given: `linkHref = "//evil.example.com/dashboard/product/eng-abc"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8. Protocol-relative bypass attempt.)

**S-S15 — Absolute URL with scheme causes rejection → null.**
Given: `linkHref = "https://evil.example.com/dashboard/product/eng-abc"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8, FR-S11. Absolute URL bypass attempt — origin assertion fails.)

**S-S16 — Absolute URL with `doc` param causes rejection → null.**
Given: `linkHref = "https://evil.example.com/dashboard/product/eng-abc?doc=req-123"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8, FR-S11. Deep-link attempt via absolute URL — must not pass origin guard.)

**S-S17 — Empty assetId segment in product path causes rejection → null.**
Given: `linkHref = "/dashboard/product/"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Trailing slash with empty segment is not a valid product path.)

**S-S18 — Product path with no trailing segment causes rejection → null.**
Given: `linkHref = "/dashboard/product"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. No `propertyEngagementId` segment — malformed path.)

**S-S19 — Path-traversal in pathname causes rejection → null.**
Given: `linkHref = "/dashboard/product/../etc/passwd"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Path-traversal attempt in the product segment.)

**S-S20 — Non-product internal path with query param causes rejection → null.**
Given: `linkHref = "/dashboard/seguimiento?doc=req-123"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. A `SAFE_INTERNAL_LINKS` member carrying a query param is NOT a valid product
deep-link and MUST be rejected — the fast-path exact-string check for SAFE_INTERNAL_LINKS does
not match because the query string makes the full string differ from the static set member.
The URL-parse branch then rejects it because the pathname is not the product path.)

**S-S21 — Fragment causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-123#section"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S10. Fragments are not meaningful here and are rejected as tampered input.)

**S-S22 — Fragment without query param causes rejection → null.**
Given: `linkHref = "/dashboard/product/eng-abc#section"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S10. Bare fragment on the product path is also rejected.)

**S-S23 — Empty string causes rejection → null.**
Given: `linkHref = ""`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.

**S-S24 — Null or undefined input causes rejection → null, no thrown exception.**
Given: `linkHref` is `null` or `undefined`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`. No exception is thrown.

**S-S25 — Cross-surface link (owner path) causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Owner paths must not pass the internal sanitizer. Enforces surface isolation.)

---

### F — Frontend

**S-F1 — Navigating to the product page with `?doc=req-123` (pending item) forces filter to `'all'`,
scrolls to, and highlights the matching item.**
Given: the internal product page is loaded with `?doc=req-123`.
And: the `documentos` filter is `'pending'` (or any non-`'all'` value) at arrival time.
And: the documents query has resolved and includes a pending document request with `id = "req-123"`.
When: `PropertyDocumentRequests` renders and the one-shot guard fires.
Then: `documentos` filter is set to `'all'` (so the pending item is visible).
And: `scrollIntoView()` is called on the `<li>` element with `data-request-id="req-123"`.
And: a transient highlight is applied to that element.
And: no error is thrown.
(Covers FR-F1, FR-F2, FR-F5, FR-F6, FR-F7, FR-F8.)

**S-F2 — Navigating with a `doc` referencing a resolved (APPROVED/REJECTED) item opens the Collapsible.**
Given: the product page is loaded with `?doc=req-resolved`.
And: the documents query resolves with a APPROVED request with `id = "req-resolved"` in the resolved group.
And: the resolved Collapsible is initially closed (`defaultOpen={false}`).
When: `PropertyDocumentRequests` renders and the deep-link effect fires.
Then: the resolved Collapsible group is open.
And: `scrollIntoView()` is called on the `<li>` with `data-request-id="req-resolved"`.
And: the transient highlight is applied.
(Covers FR-F4. Collapsible is open BEFORE scroll fires so the element is measurable.)

**S-F3 — `doc` param is absent — no filter reset, no Collapsible override, no scroll, no highlight.**
Given: the product page is loaded with no `doc` param (or `?doc=` empty).
When: `PropertyDocumentRequests` renders.
Then: the `documentos` filter is unchanged from its default or current value.
And: the resolved Collapsible is closed per its `defaultOpen={false}` default.
And: no `scrollIntoView()` call fires. No highlight applied. No error.
(Covers FR-F9 — absent-doc path.)

**S-F4 — `doc` param references a non-existent item — degrades gracefully.**
Given: the product page is loaded with `?doc=req-deleted`.
And: no document request with `id = "req-deleted"` is present in the resolved query data.
When: `PropertyDocumentRequests` renders.
Then: `documentos` filter is still forced to `'all'` (one-shot fires).
And: no `scrollIntoView()` call. No highlight. No thrown error. No unhandled console error
from the component.
(Covers FR-F9 — not-found degrade.)

**S-F5 — The one-shot filter reset does NOT clobber a later user-initiated filter change.**
Given: the product page is loaded with `?doc=req-123` and the one-shot filter reset has already
fired (setting `documentos='all'`).
When: the user manually selects the `'pending'` filter afterward.
Then: `documentos` becomes `'pending'` and stays `'pending'`. The one-shot guard does NOT
re-run. The filter is fully user-owned after the initial reset.
(Covers FR-F3.)

**S-F6 — Scroll/highlight effect fires after query resolves, not only on initial mount.**
Given: the documents query is still loading when the component first mounts.
And: `doc = "req-123"` is present.
When: the query resolves and the matching item is now rendered.
Then: `scrollIntoView()` fires on the matching item's element.
And: no attempt is made to call `scrollIntoView()` on an unmounted element while loading.
(Covers FR-F8. Effect is data-driven.)

**S-F7 — `data-request-id` attribute is present on every rendered request item.**
Given: the product page renders a list of document requests.
When: `PropertyDocumentRequests` renders.
Then: each `<li>` in the list carries `data-request-id="{request.id}"`.
(Covers FR-F5. Selector anchor for scroll/highlight.)

**S-F8 — `getSafeRelativeHref` round-trips the deep-link URL with `doc` param intact.**
Given: `getSafeRelativeHref` is called with `"/dashboard/product/eng-abc?doc=req-123"`.
When: the function processes the href.
Then: the return value is `"/dashboard/product/eng-abc?doc=req-123"`.
(Covers FR-F10. The frontend guard is not modified — this is a regression assertion that its
existing `pathname + search + hash` forwarding covers the new deep-link format without change.)

**S-F9 — Navigating to the product page with a `doc` referencing a CANCELLED item shows it under `'all'`.**
Given: the product page is loaded with `?doc=req-cancelled`.
And: the documents query includes a CANCELLED request with `id = "req-cancelled"`.
When: `PropertyDocumentRequests` renders and the one-shot guard fires.
Then: `documentos` is forced to `'all'` (CANCELLED items have no filter group; only `'all'` shows them).
And: `scrollIntoView()` fires on the matching item.
(Covers the cancelled-doc rationale for force-to-`'all'` from the proposal.)

---

### R — Regression preservation

**S-R1 — Historical param-less product notification navigates to the product page with no effect.**
Given: a stored notification with `linkHref = "/dashboard/product/eng-abc"` (no query params,
produced before 24.6b).
When: a manager clicks the notification.
Then: `sanitizeInternalNotificationLink` returns `"/dashboard/product/eng-abc"`.
And: the product page loads with no `doc` param, no filter override, no scroll, no highlight.
(Covers FR-R1, FR-S3.)

**S-R2 — `SAFE_INTERNAL_LINKS` members pass through unchanged.**
Given: stored notifications with each of `/dashboard`, `/dashboard/seguimiento`,
`/dashboard/users`, `/dashboard/status-change-requests`.
When: `sanitizeInternalNotificationLink` is called for each.
Then: each returns the original string unchanged.
(Covers FR-R2.)

**S-R3 — Owner sanitizer rejects an internal path (cross-surface isolation — 24.6a side).**
Given: a notification with `surface = OWNER` and `linkHref = "/dashboard/product/eng-id"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(24.6a regression guard — the internal path must not pass the owner sanitizer.
The owner sanitizer code is NOT modified by this slice.)

**S-R4 — Internal e2e baseline: `notifications.e2e-spec.ts` remains green.**
Given: all changes from this slice are applied.
When: the internal notification e2e suite runs.
Then: all existing cases pass with no modification.
(Covers FR-R4.)

**S-R5 — Owner notification e2e baseline: `owner-notifications.e2e-spec.ts` remains green.**
Given: all changes from this slice are applied.
When: the owner notification e2e suite runs.
Then: all existing cases pass unchanged.
(Covers FR-R4. The owner sanitizer and producer are NOT modified by 24.6b.)

**S-R6 — Seeded smoke tests T07, T08, T17, T18a remain green.**
Given: all changes from this slice are applied.
When: the full seeded smoke suite runs.
Then: T07, T08, T17, T18a all pass with no modification to the test code.
(Covers FR-R4, Stage 26.2 deterministic seed contract.)

---

## Non-Functional Notes

- **Sanitizer is a security boundary.** `sanitizeInternalNotificationLink` is a write/read
  guard on stored data that reaches the browser. Any widening MUST use an enumerated allowlist.
  Passthrough or substring matching is not acceptable. The rejection cases in Group S (FR-S5
  through FR-S12 and all S-S8 through S-S25 scenarios) are security guards, not optional edge cases.

- **`ALLOWED_INTERNAL_QUERY_PARAM_NAMES = {doc}` — the internal allowlist is strictly narrower
  than the owner allowlist `{tab, doc}`.** `tab` is explicitly excluded. This is INTENTIONAL and
  MUST NOT be widened without a separate spec change.

- **Fast-path ordering is mandatory.** The `SAFE_INTERNAL_LINKS` exact-string check and the
  bare product-path check (FR-S2, FR-S3) MUST run BEFORE the URL-parse branch. Reordering these
  checks is not acceptable.

- **No DB schema change.** `linkHref` is a stored text column. `documentRequestId` is already
  persisted. No migration is required.

- **No producer signature change.** `DocumentUploadedInternalNotificationInput` is unchanged;
  `documentRequestId` is already present in the input object passed to `notifyDocumentUploaded`.

- **`getSafeRelativeHref` is untouched.** The frontend href guard already returns
  `${url.pathname}${url.search}${url.hash}`. No modification to `notification-center.tsx`
  is in scope for this slice.

- **One-shot filter reset.** The `useRef`-guarded one-shot is the ONLY mechanism that forces
  `documentos='all'`. It fires exactly once per component mount with a non-null `doc` param.
  It is NOT a persistent or reactive sync — user-owned state after that point.

- **Historical notifications.** Pre-existing `DOCUMENT_UPLOADED` records carry
  `/dashboard/product/{propertyEngagementId}` with no deep-link params. They continue to work
  via FR-S3. No backfill is in scope.

- **TDD requirement.** All modified logic (producer `linkHref` template, sanitizer allowlist,
  frontend `doc` read + filter reset + Collapsible + scroll/highlight) MUST be covered by unit
  and/or integration tests before the implementation is considered complete. Tests for all
  sanitizer rejection scenarios (S-S8 through S-S25) are mandatory, not optional.

- **Collapsible timing (R1).** The exact mechanism for ensuring the resolved Collapsible is open
  (controlled `open` prop vs. re-key) is deferred to the design phase. The spec only asserts
  the observable outcome (Collapsible is open when the target is in the resolved group).

---

## Risks / Spec-Level Assumptions

| # | Assumption / Risk | Impact |
|---|-------------------|--------|
| A1 | FR-F4 requires the resolved Collapsible to be open on arrival. The exact mechanism (controlled `open` prop vs. Collapsible re-key) is left to design (R1 from the proposal). The spec asserts only the observable outcome: the Collapsible IS open. Design must pick the implementation and verify that Radix Collapsible either re-honors `defaultOpen` after query resolution or adopts the controlled pattern. | Medium |
| A2 | FR-F8 requires the scroll effect to be data-driven (fires after query resolves). This assumes the `useEffect` dependency array includes query data/status — the exact dependency array is a design detail. | Low |
| A3 | S-F5 (one-shot guard) assumes a `useRef` flag (flip once) is sufficient to prevent re-firing. If the component unmounts and remounts (e.g. route navigation), the ref resets and the one-shot fires again. This is acceptable behavior (re-arriving at the page with the same `doc` param is a fresh arrival). | Low |
| A4 | S-S20 assumes the `SAFE_INTERNAL_LINKS` fast-path uses exact-string equality (not prefix match). A link like `/dashboard/seguimiento?doc=req-123` does NOT match any `SAFE_INTERNAL_LINKS` member because the full string differs; it then falls through to the URL-parse branch and is rejected by the pathname check. Design must verify the existing fast-path is truly exact-string. | Low |
| A5 | S-S22 (bare fragment on product path) assumes the fragment check happens in the URL-parse branch. If the product path has no query params and the sanitizer short-circuits at the param-less fast-path, the fragment may not be checked. Design must ensure the fragment guard runs even for the param-less product path if fragments are a realistic threat vector. This is spec-level coverage that design may need to add the check. | Low |
