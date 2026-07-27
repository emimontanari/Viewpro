# Spec — Stage 24.6c Notification Deep-Linking: Owner PROPERTY_STATUS_CHANGED (Movement Timeline)

## Status

Draft — 2026-06-23.

## Origin

Proposal: `openspec/changes/24-6c-notification-deeplink-owner-movement/proposal.md`
Sibling format reference: `openspec/changes/24-6b-notification-deeplink-internal-documents/spec.md`

---

## Functional Requirements

### Group P — Producer: linkHref deep-link shape

**FR-P1. The owner `PROPERTY_STATUS_CHANGED` notification MUST encode `movementId` into `linkHref`.**
`notifyPropertyStatusChanged` in `notification-producer.service.ts` MUST emit
`linkHref = /owner/properties/${propertyAssetId}?tab=tracking&movement=${movementId}`
for every owner `PROPERTY_STATUS_CHANGED` notification.

**FR-P2. The deep-link shape is exact — no variation is allowed.**
The emitted string MUST be exactly `/owner/properties/${propertyAssetId}?tab=tracking&movement=${movementId}`.
No trailing slash, no URL-encoding of the literal template segments, no additional query params,
no reordering of the two params. `propertyAssetId` and `movementId` are the string values
already present in the input at the fire site (line 144 and line 147 in the pre-change file).

**FR-P3. No producer signature change.**
The `notifyPropertyStatusChanged` method signature is unchanged. `movementId` is already
present in the input object and already plumbed to `createOwner` (line 147) and persisted to
`refs.movementId`. The only change is the `linkHref` string template at line 144.

**FR-P4. The same `linkHref` is used for every fanned-out recipient.**
`notifyPropertyStatusChanged` fans out via `Promise.all` across deduplicated owner recipients
(using `new Set`, line 129). All recipients receive IDENTICAL `linkHref` values. The
`movementId` is NOT per-recipient data; it is uniform.

**FR-P5. All other owner and internal notification types are unaffected.**
Any notification type other than owner `PROPERTY_STATUS_CHANGED` retains its current
`linkHref` value. `sanitizeInternalNotificationLink` and all internal notification producers
are NOT modified.

---

### Group S — Sanitizer: `sanitizeOwnerNotificationLink` two-tab dispatch (SECURITY-CRITICAL)

**FR-S1. `ALLOWED_OWNER_QUERY_PARAM_NAMES` MUST be widened to `{tab, doc, movement}`.**
The set currently at line 94 of `notification-link.helper.ts` holds `{'tab', 'doc'}`. It MUST
be extended to `{'tab', 'doc', 'movement'}`. Any query param key NOT in this set MUST cause
the sanitizer to return `null` (enumerated allowlist — no passthrough, no silent drop).

**FR-S2. The single `tab === 'documents'` guard MUST be replaced with a TWO-TAB DISPATCH.**
The block at lines 154-162 that currently accepts only `tab=documents` + non-empty `doc` MUST
be replaced with a closed dispatch that evaluates `tab` and routes to exactly two ACCEPT shapes:
- `tab === 'documents'`: require non-empty `doc` AND absent `movement` → ACCEPT.
- `tab === 'tracking'`: require non-empty `movement` AND absent `doc` → ACCEPT.
- Any other value of `tab`, or any violation of the secondary-param requirements → REJECT (`null`).

**FR-S3. The two ACCEPT shapes are CLOSED and EXCLUSIVE — no mixing of secondary params.**
Exactly one secondary param (`doc` OR `movement`) MUST be present per accepted link, determined
by the `tab` value. The presence of BOTH `doc` AND `movement` at the same time MUST cause
rejection regardless of `tab`. The presence of NEITHER secondary (only `tab`) MUST cause
rejection regardless of `tab`.

**FR-S4. The `tab=documents` + non-empty `doc` accept path (24.6a) MUST survive byte-for-byte.**
A `linkHref` of `/owner/properties/{propertyAssetId}?tab=documents&doc={documentRequestId}`
with non-empty `doc` and absent `movement` MUST be accepted and returned unchanged. This is a
mandatory 24.6a regression invariant. The new dispatch MUST NOT break this path.

**FR-S5. The `tab=tracking` + non-empty `movement` path is the new ACCEPT case.**
A `linkHref` of `/owner/properties/{propertyAssetId}?tab=tracking&movement={movementId}`
with non-empty `movement` and absent `doc` MUST be accepted and returned unchanged — including
both query params in the returned string.

**FR-S6. Empty `doc` or `movement` value causes rejection → null.**
If `doc` or `movement` is present as a query param key but its value is an empty string (e.g.
`?tab=documents&doc=` or `?tab=tracking&movement=`), the sanitizer MUST return `null`. Non-empty
secondary param values are required for acceptance.

**FR-S7. A `tab` value other than `documents` or `tracking` causes rejection → null.**
`tab=summary`, `tab=info`, or any other unrecognized tab value MUST cause rejection. Only
`documents` and `tracking` are valid tab deep-link targets.

**FR-S8. A secondary param without its paired `tab` causes rejection → null.**
A `linkHref` carrying `doc=` or `movement=` without `tab` (or with the wrong `tab`) MUST
be rejected. `tab` is always required alongside the secondary param.

**FR-S9. Duplicate query param keys cause rejection → null.**
If `tab`, `doc`, or `movement` appears more than once in the query string, the sanitizer MUST
return `null`. Duplicate params are a rejection signal (HTTP parameter pollution guard).

**FR-S10. The `/owner` fast-path is preserved.**
A `linkHref` of exactly `/owner` MUST pass through unchanged without URL parsing.
This fast-path runs BEFORE the URL-parse branch and is unmodified.

**FR-S11. The bare `/owner/properties/{propertyAssetId}` fast-path is preserved.**
A `linkHref` of `/owner/properties/{propertyAssetId}` with NO query params MUST be accepted
and returned unchanged. Historical notifications (pre-24.6c) that carry the bare path continue
to work without modification.

**FR-S12. The fixed-base parse, origin assertion, exact pathname match, and fragment reject are preserved.**
All pre-existing structural guards in `sanitizeOwnerNotificationLink` — the `new URL(linkHref,
'https://viewpro.local')` parse, the `url.origin === 'https://viewpro.local'` assertion, the
pathname check against `/owner/properties/{non-empty-segment}`, and the `url.hash` fragment
reject — MUST run unchanged around the new two-tab dispatch. None of these are modified.

**FR-S13. A protocol-relative or absolute URL causes rejection → null.**
A `linkHref` beginning with `//` (protocol-relative) or containing `://` (absolute URL with
scheme) MUST return `null`. The origin assertion enforces this; the structural guards predate
this slice and are not modified.

**FR-S14. A pathname traversal or invalid structure causes rejection → null.**
A `linkHref` whose pathname does not match `/owner/properties/{non-empty-segment}` exactly
MUST return `null`. This includes trailing-slash variants, bare `/owner/properties`, and
path-traversal attempts (e.g. `/owner/properties/../etc/passwd`).

**FR-S15. A URL fragment causes rejection → null.**
If the URL contains a `#` fragment, the sanitizer MUST return `null`. The `url.hash` check
enforces this. Fragments are rejected as tampered input on this surface.

**FR-S16. `sanitizeInternalNotificationLink` (24.6b) is completely untouched.**
The internal sanitizer, its `{doc}` allowlist, its entire logic, and all 24.6b test coverage
are NOT modified by this slice. No cross-contamination between sanitizer codepaths.

---

### Group F — Frontend: movement param read, tab activation, and timeline scroll/highlight

**FR-F1. The `movement` query param MUST be read in `owner-property-detail.tsx`.**
`owner-property-detail.tsx` MUST add `useQueryState('movement', parseAsString)` parallel to the
existing `doc` nuqs param. The read MUST be safe (returns `null` when absent). Both `doc` and
`movement` coexist in the same component. The `movement` value is threaded down the
tracking-tab render path as `highlightMovementId`.

**FR-F2. `?tab=tracking` activates the tracking tab with zero code change to tab routing.**
`owner-property-detail.tsx` already declares `tracking` in `OWNER_DETAIL_TAB_VALUES` and syncs
tab via `useQueryState`. Arriving with `?tab=tracking` activates the tracking tab without any
modification to the tab routing logic. No change here — this is a preservation invariant.

**FR-F3. `highlightMovementId` MUST be threaded through `owner-engagement-card.tsx` to `owner-timeline.tsx`.**
`owner-engagement-card.tsx` MUST accept `highlightMovementId: string | null` as a prop and
forward it unchanged to the `OwnerTimeline` component it renders. This component is the
engagement-scoped boundary: `highlightMovementId` flows only into the `OwnerTimeline` of the
engagement the notification targets.

**FR-F4. `highlightMovementId` MUST be scoped to only the targeted engagement's timeline.**
When the owner detail page renders multiple `OwnerEngagementCard` instances, `highlightMovementId`
MUST be passed only to the card that corresponds to the engagement the notification targets.
Other cards MUST receive `null` for `highlightMovementId`. This prevents sibling engagements
from incorrectly highlighting movements.

**FR-F5. `owner-timeline.tsx` MUST accept a `highlightMovementId` prop.**
`OwnerTimeline` MUST add `highlightMovementId: string | null` to its props interface. When
`null`, no scroll/highlight behavior fires.

**FR-F6. `data-movement-id` MUST be added to every `OwnerTimelineItem` root element.**
Each rendered movement item in the timeline MUST carry `data-movement-id={movement.id}` on its
root DOM element. This is the selector anchor for the scroll/highlight effect (mirrors the
`data-request-id` pattern in `owner-document-requests.tsx`).

**FR-F7. A `containerRef` MUST be attached to the timeline `<ul>` (or equivalent wrapper).**
The element that wraps the timeline item list MUST carry a `ref` (`containerRef`). The
scroll/highlight effect uses this ref as the selector root, scoping `[data-movement-id]` queries
to the correct subtree. This prevents cross-component DOM leakage.

**FR-F8. When `highlightMovementId` matches a rendered item, scroll and highlight MUST fire.**
After the timeline query resolves and the matching item is in the loaded list, the component MUST:
1. Query `containerRef.current` for `[data-movement-id="${CSS.escape(highlightMovementId)}"]`.
2. If found, call `scrollIntoView({ block: 'center' })` on the matched element.
3. Apply a transient visual highlight (e.g. `ring-2 ring-primary` Tailwind classes) to the
   element via a timed callback that removes the highlight after a defined duration (e.g. 2 s).

**FR-F9. The scroll/highlight effect MUST fire after the timeline query resolves, not only on mount.**
The `useEffect` that triggers scroll/highlight MUST depend on query resolution state (e.g.
`isSuccess`, the resolved items array) so that it fires correctly when data arrives after the
initial render. It MUST NOT attempt to scroll while the query is still loading.

**FR-F10. The scroll-to-section fallback MUST fire when the target movement is NOT in the loaded items.**
When `highlightMovementId` is non-null but no matching `data-movement-id` element is found in
`containerRef.current` after the query resolves:
1. The timeline mount point (or a stable section ref) MUST scroll into view.
2. NO highlight ring is applied (the movement is not present; a stale or unloaded target must not
   be highlighted).
3. This MUST NOT be a silent no-op — the user's viewport MUST move to the timeline section.

**FR-F11. `DEFAULT_TIMELINE_FILTERS.pageSize` MUST be bumped from 10 to 25.**
`owner-timeline.tsx` MUST use `pageSize: 25` when fetching the timeline. This reduces the
probability of the target movement being off-page to near zero (status-changed movements are
by definition the most recent events in the timeline).

**FR-F12. Graceful degrade when `highlightMovementId` is absent, not found, or deleted.**
- When `highlightMovementId` is `null`: no scroll fires, no highlight applied, no fallback fires.
- When `highlightMovementId` is non-null but no matching item is rendered after query success:
  the scroll-to-section fallback (FR-F10) fires; no highlight; no thrown error; no unhandled
  promise rejection; no console error from the component.

**FR-F13. `getSafeRelativeHref` is NOT modified.**
The frontend href guard in `notification-center.tsx` already returns
`${url.pathname}${url.search}${url.hash}`. It is NOT modified in this slice. A sanitized
deep-link `linkHref` passes through verbatim by the existing guard.

---

### Group R — Regression preservation invariants

**FR-R1. Historical param-less owner `PROPERTY_STATUS_CHANGED` notifications continue to work.**
A stored `linkHref` of `/owner/properties/{propertyAssetId}` (no query params, produced before
24.6c) MUST still sanitize through via the preserved bare fast-path and navigate to the
property page. No scroll/highlight fires (no `movement` param). No backfill of historical records.

**FR-R2. The `/owner` fast-path is unaffected.**
A `linkHref` of exactly `/owner` MUST still pass `sanitizeOwnerNotificationLink` unchanged.

**FR-R3. The owner document deep-link (24.6a, `tab=documents`+`doc`) is unchanged.**
A stored `linkHref` of `/owner/properties/{propertyAssetId}?tab=documents&doc={documentRequestId}`
MUST still be accepted and returned unchanged by `sanitizeOwnerNotificationLink`. The 24.6a
scroll/highlight in `owner-document-requests.tsx` is unaffected.

**FR-R4. `sanitizeInternalNotificationLink` (24.6b) is completely unaffected.**
All internal notification sanitizer logic, the `{doc}` allowlist, and all 24.6b test coverage
are unchanged.

**FR-R5. Pre-existing test baselines remain green.**
- `owner-notifications.e2e-spec.ts` — all existing cases pass unchanged.
- `notifications.e2e-spec.ts` — all existing cases pass unchanged.
- `demo-smoke.spec.ts` T07, T08, T17, T18a, T19b — all pass unchanged.
- Stage 26.2 deterministic seed contract — unchanged.

---

## Acceptance Scenarios

### P — Producer

**S-P1 — Owner `PROPERTY_STATUS_CHANGED` stores the exact deep-link `linkHref`.**
Given: `notifyPropertyStatusChanged` is called with `propertyAssetId = "asset-abc"` and
`movementId = "mov-123"`.
When: the notification is persisted.
Then: the stored `linkHref` is exactly `/owner/properties/asset-abc?tab=tracking&movement=mov-123`.
(Covers FR-P1, FR-P2.)

**S-P2 — The deep-link has the exact shape — no trailing slash, no extra params, no reordering.**
Given: `propertyAssetId = "asset-xyz"` and `movementId = "mov-456"`.
When: the notification is persisted.
Then: `linkHref = /owner/properties/asset-xyz?tab=tracking&movement=mov-456` — no `doc`, no
trailing slash, no additional params, `tab` comes before `movement`.
(Covers FR-P2.)

**S-P3 — All fanned-out recipients receive the same `linkHref`.**
Given: `notifyPropertyStatusChanged` is called for a property with three distinct owner recipients.
When: the notification is persisted.
Then: all three stored notification rows have identical `linkHref` values.
(Covers FR-P4.)

**S-P4 — Other notification types retain their current `linkHref`.**
Given: any notification type other than owner `PROPERTY_STATUS_CHANGED` is produced.
When: persisted.
Then: `linkHref` matches the pre-existing template for that type. No change from this slice.
(Covers FR-P5.)

---

### S — Sanitizer (SECURITY-CRITICAL TWO-TAB DISPATCH)

> The matrix below is the security-critical core. Every row MUST have a corresponding unit test.
> Exactly two ACCEPT shapes exist. All other shapes MUST return `null`.

#### Acceptance cases (2 shapes)

**S-S1 — `tab=documents`+non-empty `doc` (24.6a regression) — ACCEPT.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc?tab=documents&doc=req-123"`.
(Covers FR-S4. 24.6a regression guard — this MUST still pass after the dispatch rewrite.)

**S-S2 — `tab=documents`+UUID-format `doc` — ACCEPT.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=550e8400-e29b-41d4-a716-446655440000"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns the full link including the UUID doc value.
(Covers FR-S4. Real-world id format regression guard.)

**S-S3 — `tab=tracking`+non-empty `movement` — ACCEPT (new 24.6c path).**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc?tab=tracking&movement=mov-123"`.
(Covers FR-S5. This is the primary new acceptance case.)

**S-S4 — `tab=tracking`+UUID-format `movement` — ACCEPT.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=550e8400-e29b-41d4-a716-446655440000"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns the full link including the UUID movement value.
(Covers FR-S5. Real-world id format.)

#### Rejection cases — per-tab missing secondary

**S-S5 — `tab=documents` alone (no `doc`) — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S2, FR-S3. `doc` is required with the documents tab.)

**S-S6 — `tab=tracking` alone (no `movement`) — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S2, FR-S3. `movement` is required with the tracking tab.)

#### Rejection cases — empty secondary value

**S-S7 — `tab=documents`+empty `doc` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc="`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S6. Empty secondary param is not a valid deep-link anchor.)

**S-S8 — `tab=tracking`+empty `movement` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement="`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S6. Empty movement value is rejected.)

#### Rejection cases — cross-tab contamination

**S-S9 — `tab=documents`+`movement` (no `doc`) — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&movement=mov-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S2, FR-S3. `movement` is not a valid secondary for the documents tab.)

**S-S10 — `tab=tracking`+`doc` (no `movement`) — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S2, FR-S3. `doc` is not a valid secondary for the tracking tab.)

#### Rejection cases — both secondary params present

**S-S11 — `tab=documents`+`doc`+`movement` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123&movement=mov-456"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S1, FR-S3. Both secondaries simultaneously is always rejected — cross-tab ambiguity.)

**S-S12 — `tab=tracking`+`movement`+`doc` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123&doc=req-456"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S1, FR-S3. Both secondaries simultaneously is rejected regardless of which tab.)

#### Rejection cases — secondary param without its paired tab

**S-S13 — `doc` only, no `tab` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8. `tab` is always required alongside the secondary param.)

**S-S14 — `movement` only, no `tab` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?movement=mov-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S8. `tab` is required for the movement param to be valid.)

#### Rejection cases — unrecognized tab value

**S-S15 — `tab=summary` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=summary"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S7. `summary` is not a valid deep-link tab target.)

**S-S16 — `tab=info` — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=info"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S7. `info` is not a valid deep-link tab target.)

#### Rejection cases — non-allowlisted param

**S-S17 — Unknown param alongside valid combo — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123&evil=x"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S1. Enumerated allowlist — any param not in `{tab, doc, movement}` is a security rejection.)

**S-S18 — Open redirect attempt via unknown param — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123&redirect=http://evil.com"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S1. Open redirect attempt via unknown param.)

#### Rejection cases — existing class (structural guards, unchanged)

**S-S19 — Protocol-relative URL — REJECT → null.**
Given: `linkHref = "//evil.example.com/owner/properties/asset-abc"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S13. Protocol-relative bypass attempt — origin assertion fails.)

**S-S20 — Absolute URL with scheme — REJECT → null.**
Given: `linkHref = "https://evil.example.com/owner/properties/asset-abc?tab=tracking&movement=mov-1"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S13. Absolute URL bypass attempt — origin assertion fails.)

**S-S21 — Path traversal in pathname — REJECT → null.**
Given: `linkHref = "/owner/properties/../etc/passwd"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S14. Path traversal attempt in the properties segment.)

**S-S22 — Empty `propertyAssetId` segment (trailing slash) — REJECT → null.**
Given: `linkHref = "/owner/properties/"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S14. Trailing slash with empty segment is not a valid properties path.)

**S-S23 — Bare `/owner/properties` (no segment) — REJECT → null.**
Given: `linkHref = "/owner/properties"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S14. No `propertyAssetId` segment — malformed path that does not match the fast-path
or the parameterised check.)

**S-S24 — Duplicate query param key — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-1&movement=mov-2"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S9. Duplicate params are a rejection signal — HTTP parameter pollution guard.)

**S-S25 — Fragment causes rejection → null.**
Given: `linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123#section"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S15. Fragments are not meaningful here and are rejected as tampered input.)

**S-S26 — Fragment without query param — REJECT → null.**
Given: `linkHref = "/owner/properties/asset-abc#section"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(Covers FR-S15. Bare fragment on the properties path is also rejected.)

**S-S27 — Empty string — REJECT → null.**
Given: `linkHref = ""`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.

**S-S28 — Null or undefined input — REJECT → null, no thrown exception.**
Given: `linkHref` is `null` or `undefined`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`. No exception is thrown.

**S-S29 — Cross-surface link (internal product path) — REJECT → null.**
Given: `linkHref = "/dashboard/product/eng-abc?doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `null`.
(FR-S14. Internal paths must not pass the owner sanitizer. Enforces surface isolation.)

#### Fast-path preservation cases

**S-S30 — `/owner` fast-path — ACCEPT unchanged.**
Given: `linkHref = "/owner"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner"`.
(Covers FR-S10. Fast-path runs before URL-parse branch.)

**S-S31 — Bare `/owner/properties/{assetId}` fast-path — ACCEPT unchanged.**
Given: `linkHref = "/owner/properties/asset-abc"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc"`.
(Covers FR-S11. Historical notifications regression guard.)

---

### F — Frontend

**S-F1 — Navigating with `?tab=tracking&movement=mov-123` scrolls to and highlights the matching movement.**
Given: the owner property page is loaded with `?tab=tracking&movement=mov-123`.
And: the timeline query has resolved and includes a movement with `id = "mov-123"`.
When: `OwnerTimeline` renders and the scroll/highlight effect fires.
Then: the tracking tab is active (zero code change required — already routes via existing `useQueryState`).
And: `scrollIntoView({ block: 'center' })` is called on the element with `data-movement-id="mov-123"`.
And: a transient highlight (`ring-2 ring-primary` or equivalent) is applied to that element.
And: no error is thrown.
(Covers FR-F1, FR-F2, FR-F5, FR-F6, FR-F7, FR-F8, FR-F9.)

**S-F2 — When the target movement is NOT in the loaded items, the section scrolls into view (no highlight).**
Given: the page is loaded with `?tab=tracking&movement=mov-old` (movement not in the loaded page).
And: the timeline query has resolved with `pageSize = 25` results, none with `id = "mov-old"`.
When: `OwnerTimeline` renders and the scroll effect fires.
Then: the timeline section (or mount point) scrolls into view.
And: NO highlight ring is applied (movement not rendered).
And: this is NOT a silent no-op — viewport movement is observable.
And: no thrown error. No unhandled promise rejection.
(Covers FR-F10. Scroll-to-section fallback is mandatory when target is not loaded.)

**S-F3 — `highlightMovementId` is null — no scroll, no highlight, no fallback fires.**
Given: the page is loaded with no `movement` param (or the param is absent/empty).
When: `OwnerTimeline` renders.
Then: no `scrollIntoView()` call fires. No highlight applied. No fallback. No error.
(Covers FR-F5, FR-F12. Absent-param path.)

**S-F4 — Target movement deleted / not found — degrades gracefully without highlight.**
Given: the page is loaded with `?tab=tracking&movement=mov-deleted`.
And: the timeline query resolves but no movement with `id = "mov-deleted"` is rendered.
When: `OwnerTimeline` renders.
Then: the scroll-to-section fallback fires (viewport moves to the timeline section).
And: no highlight is applied. No thrown error. No unhandled console error from the component.
(Covers FR-F10, FR-F12. Not-found degrade — fallback still fires.)

**S-F5 — Scroll/highlight effect fires after the timeline query resolves, not only on mount.**
Given: the timeline query is still loading when the component first mounts.
And: `highlightMovementId = "mov-123"` is non-null.
When: the query resolves and the matching item is now rendered.
Then: `scrollIntoView()` fires on the matching element.
And: no attempt is made to call `scrollIntoView()` on a loading/unmounted element.
(Covers FR-F9. Effect is data-driven, not mount-driven.)

**S-F6 — `data-movement-id` attribute is present on every rendered timeline item.**
Given: the timeline query resolves with N movement items.
When: `OwnerTimeline` renders.
Then: each timeline item's root element carries `data-movement-id="{movement.id}"`.
(Covers FR-F6. DOM selector anchor for scroll/highlight.)

**S-F7 — Only the targeted engagement's timeline highlights; sibling timelines are unaffected.**
Given: the owner property page renders two `OwnerEngagementCard` instances (engagement A and engagement B).
And: the notification targets engagement A, movement `mov-A-123`.
When: the page loads with `?tab=tracking&movement=mov-A-123`.
Then: `highlightMovementId = "mov-A-123"` is passed only to the `OwnerTimeline` inside engagement A's card.
And: `highlightMovementId = null` is passed to the `OwnerTimeline` inside engagement B's card.
And: only the element with `data-movement-id="mov-A-123"` inside engagement A's containerRef gets the highlight ring.
And: no element inside engagement B's timeline receives a highlight.
(Covers FR-F3, FR-F4. Multi-engagement isolation — CRITICAL correctness requirement.)

**S-F8 — `pageSize` is 25 in the timeline query.**
Given: `OwnerTimeline` mounts with any `highlightMovementId` value.
When: it issues the timeline data fetch.
Then: `pageSize = 25` is used in the query parameters.
(Covers FR-F11. Was 10; must be 25.)

**S-F9 — `getSafeRelativeHref` round-trips the deep-link URL with both params intact.**
Given: `getSafeRelativeHref` is called with `"/owner/properties/asset-abc?tab=tracking&movement=mov-123"`.
When: the function processes the href.
Then: the return value is `"/owner/properties/asset-abc?tab=tracking&movement=mov-123"`.
(Covers FR-F13. The frontend guard is not modified — this is a regression assertion that its
existing `pathname + search + hash` forwarding covers the new deep-link format without change.)

---

### R — Regression preservation

**S-R1 — Historical param-less owner `PROPERTY_STATUS_CHANGED` notification navigates to the property page.**
Given: a stored notification with `linkHref = "/owner/properties/asset-abc"` (no query params,
produced before 24.6c).
When: an owner clicks the notification.
Then: `sanitizeOwnerNotificationLink` returns `"/owner/properties/asset-abc"`.
And: the property page loads with no `movement` param, no scroll, no highlight, no fallback.
(Covers FR-S11, FR-R1.)

**S-R2 — Owner document deep-link (24.6a) passes through unchanged.**
Given: a stored notification with `linkHref = "/owner/properties/asset-abc?tab=documents&doc=req-123"`.
When: `sanitizeOwnerNotificationLink` is called.
Then: returns `"/owner/properties/asset-abc?tab=documents&doc=req-123"`.
And: the 24.6a `owner-document-requests.tsx` scroll/highlight behavior is unaffected.
(Covers FR-S4, FR-R3. 24.6a mandatory regression guard.)

**S-R3 — Internal sanitizer rejects an owner path (cross-surface isolation — 24.6b side).**
Given: a notification with surface `INTERNAL` and
`linkHref = "/owner/properties/asset-abc?tab=tracking&movement=mov-123"`.
When: `sanitizeInternalNotificationLink` is called.
Then: returns `null`.
(24.6b regression guard — owner paths must not pass the internal sanitizer. The internal
sanitizer code is NOT modified by this slice.)

**S-R4 — Owner notifications e2e baseline remains green.**
Given: all changes from this slice are applied.
When: `owner-notifications.e2e-spec.ts` runs.
Then: all existing cases pass with no modification.
(Covers FR-R5.)

**S-R5 — Internal notifications e2e baseline remains green.**
Given: all changes from this slice are applied.
When: `notifications.e2e-spec.ts` runs.
Then: all existing cases pass unchanged.
(Covers FR-R5.)

**S-R6 — Seeded smoke tests remain green.**
Given: all changes from this slice are applied.
When: the full seeded smoke suite runs.
Then: T07, T08, T17, T18a, T19b all pass with no modification to the test code.
(Covers FR-R5, Stage 26.2 deterministic seed contract.)

---

## Non-Functional Notes

- **Sanitizer is a security boundary.** `sanitizeOwnerNotificationLink` guards stored data that
  reaches the browser. The two-tab dispatch is a CLOSED enumeration — exactly two ACCEPT shapes,
  everything else `null`. Passthrough, substring matching, or unknown-param silencing are not
  acceptable. Every row of the matrix (S-S1 through S-S31) MUST have a corresponding unit test.
  The rejection cases are security guards, not optional edge cases.

- **`ALLOWED_OWNER_QUERY_PARAM_NAMES = {tab, doc, movement}` — three keys, closed.**
  This allowlist does NOT grow beyond these three without a separate spec change. No other param
  is implicitly tolerated.

- **Two-tab dispatch replaces the single guard atomically.**
  The replacement at lines 154-162 is an atomic swap to the two-arm dispatch. The fast-path
  ordering (FR-S10, FR-S11) MUST be preserved: `/owner` and bare property fast-paths run BEFORE
  the URL-parse branch. Reordering is not acceptable.

- **Multi-engagement threading is a correctness requirement, not an optimization.**
  Passing `highlightMovementId` to more than one engagement card is incorrect behavior, not a
  performance issue. The prop MUST be engagement-scoped before reaching the timeline component.

- **`pageSize` bump (10→25) is part of the spec, not just an optimization.**
  Without the bump, the scroll-to-section fallback (FR-F10) fires for recent status-changed
  movements that happen to fall outside the first 10 items. At `pageSize=25`, this miss
  probability approaches zero while still being bounded. The fallback remains for true misses.

- **No DB schema change.** `linkHref` is a stored text column. `movementId` is already persisted
  to `refs.movementId`. No migration is required.

- **No producer signature change.** The method signature and input type are unchanged.

- **`getSafeRelativeHref` is untouched.** No modification to `notification-center.tsx` is in scope.

- **TDD requirement.** All modified logic — producer `linkHref` template, sanitizer two-tab
  dispatch, frontend `movement` param read, prop threading, timeline scroll/highlight + fallback
  + pageSize — MUST be covered by unit and/or integration tests before the implementation is
  considered complete. All sanitizer matrix rows (S-S1 through S-S31) are mandatory test cases,
  not optional.

- **Historical notifications.** Pre-existing `PROPERTY_STATUS_CHANGED` records carry the bare
  `/owner/properties/{propertyAssetId}` path. They continue to work via FR-S11. No backfill.

---

## Risks / Spec-Level Assumptions

| # | Assumption / Risk | Impact |
|---|-------------------|--------|
| A1 | The two-tab dispatch replaces lines 154-162 atomically. The spec assumes the existing fast-path checks at lines 96-153 (fixed-base parse, origin assert, `/owner` fast-path, bare property fast-path, exact pathname match, duplicate-key loop, fragment reject) are preserved byte-for-byte before and around the new dispatch. Design must verify no existing guard is displaced. | High |
| A2 | The engagement-scoped threading (FR-F4) assumes that the caller of `OwnerEngagementCard` can determine which engagement the notification targets and pass `highlightMovementId` only to that card. The exact mechanism for identifying the target engagement (e.g. matching `propertyEngagementId` embedded in the URL or in the notification metadata) is left to the design phase. | Medium |
| A3 | The scroll-to-section fallback (FR-F10) requires a stable "timeline section" ref or mount point. The exact DOM anchor (a wrapping `<section>`, a heading ref, or the container element) is a design detail. The spec only asserts the observable outcome: the viewport moves to the timeline section. | Low |
| A4 | FR-F9 (effect fires after query resolves) assumes the `useEffect` dependency array includes query data or status. The exact dependency array is a design detail — the spec only asserts that the effect does not fire while loading. | Low |
| A5 | S-S26 (bare fragment on the property path) assumes the fragment check runs in the URL-parse branch for the fast-path property cases too. If the existing fast-path short-circuits before the fragment check, fragments on bare property paths may not be caught. Design must verify whether this is a realistic threat vector and ensure the guard runs on all code paths. | Low |
| A6 | `pageSize = 25` is specified as the bump target. If the underlying API query has a hard maximum below 25 this assumption fails. Design must confirm the API supports at least `pageSize = 25`. | Low |
