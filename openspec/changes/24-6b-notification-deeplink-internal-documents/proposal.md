# Proposal — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Status

Draft — proposed 2026-06-22.

## Origin

- `sdd/24-6b-notification-deeplink-internal-documents/explore` (Engram #4436) — exploration mapping all 3 layers (producer, sanitizer, frontend) for the internal `DOCUMENT_UPLOADED` path and confirming `documentRequestId` availability at fire time.
- Stage 24.6a (`openspec/changes/24-6a-notification-deeplink-owner-documents/`) — owner-side document deep-linking, already shipped. B mirrors A's three-layer pattern on the internal product page.
- `docs/plans/CURRENT_MVP_EXECUTION.md`.

## Slice contract

```txt
Stage: 24
Slice: 24.6b — Internal DOCUMENT_UPLOADED notification deep-links to the exact document on the
  internal product page (/dashboard/product/{propertyEngagementId}).
Objective: encode the target documentRequestId into the stored linkHref for the internal
  DOCUMENT_UPLOADED notification, widen the internal-link sanitizer from exact-string to
  pathname + a CLOSED {doc} query-param allowlist (security boundary), and make the internal
  product page force the documentos filter to 'all', open the resolved Collapsible when the
  target is in it, and scroll-to / highlight the matching document request from a `doc` param.
Scope: PRODUCTION feature (backend + frontend). Sub-slice B of a planned 3-part bundle
  (A = owner docs shipped; C = owner movement/status FUTURE).
Do not touch: sub-slice C (PROPERTY_STATUS_CHANGED owner movement/timeline), STATUS_CHANGE_REQUESTED
  manager bandeja, MOVEMENT_CREATED (dead), the shipped owner sanitizer/links (24.6a), any schema
  migration, the SAFE_INTERNAL_LINKS static set, the bare product-path fast-path.
Done: clicking the internal DOCUMENT_UPLOADED notification lands on
  /dashboard/product/{propertyEngagementId} with the documentos filter forced to 'all', the resolved
  group open if the target is resolved, and the target document request scrolled into view and
  highlighted; the sanitizer rejects any non-whitelisted query param; existing baselines green.
Next slice: 24.6c — internal/owner movement deep-link (PROPERTY_STATUS_CHANGED).
```

## Investigation summary (2026-06-22)

Grounded in the exploration artifact (#4436) and confirmed against source.

**Three layers, one stored source of truth.** The `linkHref` persisted on the Notification row is the single source of truth for navigation. The backend sanitizer guards write/read; the frontend href guard (`getSafeRelativeHref`) already forwards `${pathname}${search}${hash}`, so no frontend sanitizer change is needed (same as 24.6a).

**Producer — the id is already at the fire site.** `notifyDocumentUploaded` in `viewpro-app/apps/api/src/notifications/notification-producer.service.ts:98-124` hardcodes `linkHref: /dashboard/product/${input.propertyEngagementId}` (line 112). `input.documentRequestId` is ALREADY in the `DocumentUploadedInternalNotificationInput` type and is explicitly persisted to the DB column at line 115 — VERIFIED. No producer signature change, no id plumbing; only the `linkHref` template gains `?doc=${input.documentRequestId}`.

**Sanitizer is the security bottleneck (exact-string today).** `sanitizeInternalNotificationLink` in `viewpro-app/apps/api/src/notifications/notification-link.helper.ts:8-31` accepts a static `SAFE_INTERNAL_LINKS` set (`/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`, `/dashboard/status-change-requests`) and the bare product path `/dashboard/product/${propertyEngagementId}` via string equality (line 26). A link carrying `?doc=<id>` currently sanitizes to `null`. Widening must mirror the SHIPPED `sanitizeOwnerNotificationLink` (lines 33-110 in the same file): URL-parse branch with a fixed base, origin assertion, exact pathname match, and a CLOSED query-param NAME allowlist.

**Internal allowlist is `{doc}` only — NOT `{tab, doc}`.** Unlike the owner page, the internal product page is NOT tabbed: `PropertyEngagementDetails` renders the document section in a flat `CardContent` (always mounted). So the internal sanitizer needs only `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = {doc}` — no `tab`.

**Frontend — flat section, but a filter and a Collapsible.** The document section is always mounted (no tab to force). But `PropertyDocumentRequests` (`viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx:110-115`) holds a `documentos` nuqs filter (`'all' | 'pending' | 'review' | 'resolved'`, default `'all'`, `history: 'replace'`). When the active filter hides the target's group, the deep-link target is not visible. APPROVED/REJECTED requests land in the `resolved` group, which renders behind a `Collapsible` with `defaultOpen={false}`. `CANCELLED` requests have NO named filter group (only visible under `all`). Internal items also lack a `data-request-id` anchor (the owner items have it) and the list lacks a `containerRef`.

## Scope

This is a **production feature** (backend + frontend), sub-slice B of a planned 3-part bundle.

### In Scope

1. **Producer (`notification-producer.service.ts`)** — for the internal `DOCUMENT_UPLOADED` type, emit `linkHref = /dashboard/product/${propertyEngagementId}?doc=${documentRequestId}` (one-line change at line 112). `documentRequestId` already in input; no signature change.
2. **Sanitizer (`notification-link.helper.ts`)** — widen `sanitizeInternalNotificationLink` with a URL-parse branch mirroring the shipped owner sanitizer: parse with fixed base `https://viewpro.local`, assert `origin`, require `pathname === /dashboard/product/${propertyEngagementId}`, enforce a CLOSED `{doc}` query-param NAME allowlist (no `tab`), reject non-whitelisted params, duplicate params, empty `doc`, and any fragment. Return `${pathname}${search}`.
3. **Frontend (`property-document-requests.tsx`)** — read the `doc` param; force the `documentos` filter to `'all'` once on arrival (one-shot `useRef` guard so it does not fight later user filter changes); open the `resolved` Collapsible group when the target item is in it; add `data-request-id={request.id}` to the request `<li>` and a `containerRef` on the `<ul>`; scroll-to / highlight the matching item (port the 24.6a effect: `useEffect` on query success, `CSS.escape` selector, transient highlight via `setTimeout`); degrade gracefully when the doc is absent / not-found / deleted.

### Force-to-`'all'` decision (and rationale)

The owner side forces `tab=documents` open because its document section lives behind a tab. The internal section is always mounted, so the equivalent reveal action is resetting the `documentos` filter to `'all'`. We force `'all'` rather than computing the target's group because:

- **`CANCELLED` documents have no filter group.** Per-group jumping (mapping the target's status to a filter key) silently FAILS for cancelled items — they only render under `'all'`. Forcing `'all'` guarantees every status is visible.
- A manager arriving from a notification wants the document IN CONTEXT; `'all'` is the natural landing view and reveals every status the page can show.
- A one-shot `useRef`-guarded effect resets the filter once on arrival and then never re-runs, so subsequent user-initiated filter changes are NOT clobbered.

### Out of Scope (explicit non-goals)

- **Sub-slice C** — `PROPERTY_STATUS_CHANGED` owner movement/timeline deep-link. FUTURE.
- **`STATUS_CHANGE_REQUESTED`** manager bandeja — DEFERRED, stays linking to `/dashboard/status-change-requests` unchanged (no per-item anchor).
- **Owner-side links (24.6a)** — already shipped; `sanitizeOwnerNotificationLink`, the owner property page, and the `{tab, doc}` allowlist are UNCHANGED.
- **`MOVEMENT_CREATED`** — dead type; no producer method emits it. Ignore.
- **No DB schema change** — `linkHref` is a stored string; the `documentRequestId` column already exists and is already populated.
- **`SAFE_INTERNAL_LINKS` static set and the bare product-path fast-path** — preserved untouched; other internal branches unchanged.
- **Frontend href guard** (`getSafeRelativeHref`) — untouched; it already forwards query+hash.

## Preserve unchanged

- The static `SAFE_INTERNAL_LINKS` set (`/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`, `/dashboard/status-change-requests`).
- The bare product-path fast-path `/dashboard/product/${propertyEngagementId}` (param-less; existing/historical notifications).
- All other branches of `sanitizeInternalNotificationLink` and the entire `sanitizeOwnerNotificationLink` (24.6a) and its `{tab, doc}` allowlist.
- The frontend href guard `getSafeRelativeHref` and its `${pathname}${search}${hash}` forwarding.
- The `documentos` nuqs param contract (`all | pending | review | resolved`) for normal user-driven filtering.
- The 24.5 owner + internal notification e2e baselines, the 24.6a baselines, and the Stage 26.2 deterministic seed contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `notifications`: the internal `DOCUMENT_UPLOADED` notification `linkHref` gains a deep-link query string (`?doc={documentRequestId}`); `sanitizeInternalNotificationLink` widens from exact-string match to pathname + a CLOSED `{doc}` query-param allowlist.
- `products` (frontend): the internal product page reads a `doc` query param, forces the `documentos` filter to `'all'` once, opens the resolved Collapsible when the target is in it, and scrolls-to / highlights the matching document request item.

## Approach

**Encode-in-linkHref, single source of truth (mirror 24.6a).** The target document id is encoded into the stored `linkHref` at fire time (already available in producer input), so the navigation target is fully described by the persisted string. No new DTO field, no new producer argument, no schema change.

**Sanitizer as a CLOSED allowlist, not a passthrough.** Add a URL-parse branch to `sanitizeInternalNotificationLink` structurally identical to the shipped owner sanitizer: `new URL(linkHref, 'https://viewpro.local')`, assert `url.origin === 'https://viewpro.local'`, assert `url.pathname === expectedProductLink`, iterate `searchParams.keys()` and reject any key outside `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = {doc}`, reject duplicate `doc`, reject empty `doc`, reject any fragment, then return `${url.pathname}${url.search}`. The fast-path and `SAFE_INTERNAL_LINKS` checks run BEFORE the parse branch and stay byte-for-byte. The internal allowlist is strictly narrower than owner's `{tab, doc}` — internal needs no `tab`.

**Frontend reveal-then-scroll, one-shot.** Read `doc` via `useQueryState('doc', parseAsString)`. On query success, if `doc` is set, run a `useRef`-guarded one-shot effect: reset the filter to `'all'` (`setDocumentFilter(null)`), open the resolved Collapsible when the target item is in the resolved group, then `scrollIntoView` + apply a transient `ring-2 ring-primary` highlight to the `[data-request-id]` match within `containerRef`. Add `data-request-id={request.id}` to each item `<li>` and a `containerRef` on the list `<ul>` (direct port from the owner component). Degrade gracefully (no scroll, no error) when the target item is absent.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` | Modified | `notifyDocumentUploaded` `linkHref` template → append `?doc=${input.documentRequestId}` (line 112). |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` | Modified | Add a URL-parse branch + `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = {doc}` to `sanitizeInternalNotificationLink` (lines 8-31). Owner sanitizer, `SAFE_INTERNAL_LINKS`, and the bare product fast-path untouched. |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts` | Modified/New | Cover the new internal allowlist (accept `?doc={id}`; reject unknown param, duplicate `doc`, empty `doc`, fragment, traversal/absolute/protocol-relative; preserve `SAFE_INTERNAL_LINKS` and the bare product path). |
| `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx` | Modified | Read `doc` param; one-shot force `documentos='all'`; resolved-group Collapsible `defaultOpen` logic; `data-request-id` on items; `containerRef` on the list; highlight state + timer; scroll/highlight effect. |
| `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx` | Modified/New | Cover `doc` param read, force-to-`'all'`, resolved-group open, scroll/highlight, and graceful degrade. |
| `openspec/changes/24-6b-notification-deeplink-internal-documents/` | New | This folder. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 — Resolved-group Collapsible `defaultOpen` timing.** `defaultOpen` is a one-time initialization prop. The documents query resolves AFTER first render, so the target's resolved status is unknown at the Collapsible's initial mount; Radix may not re-honor `defaultOpen` once the query resolves post-mount, leaving the group closed and the target unscrollable. | Med | Verify in design whether Radix re-reads `defaultOpen` after the query resolves. If it does not, drive the open state with a controlled `open` prop OR key the resolved Collapsible on the resolved-target presence (e.g. `key={hasResolvedTarget ? 'open' : 'closed'}`) so it re-mounts with the correct default. Add a test that deep-links to a RESOLVED document and asserts the group is open and the item is scrolled-to. |
| **R2 — Sanitizer widening weakens the security boundary.** Moving the product branch from exact-string to URL parsing risks an open passthrough (accepting any `searchParams`, a `//host`, a path-traversal pathname, a `tab` param, or a fragment). | High | Mirror the shipped owner sanitizer exactly: fixed-base parse, `origin` assertion, exact `pathname` match, CLOSED `{doc}` allowlist (reject any other key including `tab`), reject duplicate `doc`, reject empty `doc`, reject any fragment. Run the fast-path and `SAFE_INTERNAL_LINKS` checks BEFORE the parse branch. Unit-test rejection of an unknown param, a `tab` param, a second `doc`, an empty `doc`, a tampered pathname, a `//host`, and a fragment. Treat the helper as a hot path. |
| **R3 — One-shot filter reset fights user-driven filter changes.** Forcing `documentos='all'` on arrival could re-fire and clobber a filter the manager picks afterward. | Med | Guard the reset with a `useRef` that flips once on the first successful deep-link arrival and never re-runs. After the one-shot, the `documentos` param is fully user-owned. Add a test asserting a later user filter change is NOT reverted. |
| **R4 — Target document not in the loaded page / not yet fetched / deleted.** The matching `request.id` may be absent if the documents query is still loading or the request was deleted. | Med | Scroll/highlight/open only when the item exists in the resolved list; degrade gracefully (filter forced to `'all'`, no scroll, no error) otherwise. Re-run the effect when the query resolves. Do not throw. |
| **R5 — `CANCELLED` items have no filter group.** Per-group jumping would silently fail for cancelled documents. | Low | The force-to-`'all'` strategy handles this by design — cancelled items render under `'all'`. This is the primary reason force-to-`'all'` was chosen over compute-the-group. |
| **R6 — Stored historical notifications keep the param-less `linkHref`.** Pre-existing `DOCUMENT_UPLOADED` notifications still point at the bare product page. | Low | Acceptable: old notifications land on the product page (current behavior) via the preserved fast-path. No backfill; only future events get the deep-link. |

## Rollback Plan

Revert: the `linkHref` template change in `notifyDocumentUploaded`, the `sanitizeInternalNotificationLink` URL-parse branch + `ALLOWED_INTERNAL_QUERY_PARAM_NAMES`, the `doc`-param read / force-to-`'all'` / Collapsible / scroll-highlight in `property-document-requests.tsx`, the added tests, and this OpenSpec folder. No schema migration to roll back. The owner sanitizer/links (24.6a), `SAFE_INTERNAL_LINKS`, the bare product fast-path, the frontend href guard, and all 24.5/24.6a baselines remain intact. Reverting restores the param-less `/dashboard/product/{propertyEngagementId}` link and the exact-string internal sanitizer.

## Dependencies

- None new. `documentRequestId` is already in producer input and persisted; the shipped owner sanitizer provides the exact pattern to mirror; the frontend href guard already forwards query+hash.

## Success Criteria

- [ ] The internal `DOCUMENT_UPLOADED` notification stores `linkHref = /dashboard/product/${propertyEngagementId}?doc=${documentRequestId}`.
- [ ] `sanitizeInternalNotificationLink` accepts the deep-link (pathname + `{doc}` only), rejects any non-whitelisted query param (including `tab`), duplicate `doc`, empty `doc`, fragments, and traversal/absolute/protocol-relative inputs, and still passes `SAFE_INTERNAL_LINKS` and the bare product path.
- [ ] Clicking the internal `DOCUMENT_UPLOADED` notification lands on the product page with the `documentos` filter forced to `'all'`, the resolved Collapsible open when the target is resolved, and the target document request scrolled into view and highlighted.
- [ ] The one-shot filter reset does not revert a later user-initiated filter change.
- [ ] Target-not-found / cancelled / deleted degrades gracefully (filter `'all'`, no scroll, no error).
- [ ] All pre-existing test baselines remain green.

## Next phases

Proceed to `sdd-spec` and `sdd-design` (can run in parallel — design resolves the Collapsible `defaultOpen` re-honor mechanism (R1), the internal `{doc}`-only sanitizer allowlist, the one-shot filter-reset guard, and the scroll/highlight seam).
