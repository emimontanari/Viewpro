# Proposal — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

## Status

Draft — proposed 2026-06-22.

## Origin

- `sdd/24-6-notification-deep-linking/explore` (Engram #4422) — exploration mapping all 3 layers (producer, sanitizer, frontend) and per-type id availability. Sub-slice A is named the cheapest, highest-UX-value cut.
- Stage 24.5 close-out — `24.5 — notification routing E2E` proved current property/engagement-level link destinations against a real DB and explicitly named `24.6 — notification deep-linking precision (document/movement-level targets)` as the next slice. 24.5 asserted today's destinations; 24.6 changes them.
- `docs/plans/CURRENT_MVP_EXECUTION.md`.

## Slice contract

```txt
Stage: 24
Slice: 24.6a — Owner DOCUMENT notifications deep-link to the exact document on the owner property page
Objective: encode the target documentRequestId into the stored linkHref for the three OWNER document
  notification types, widen the owner-link sanitizer from exact-string to pathname + whitelisted
  query params (security boundary), and make the owner property page scroll-to / highlight the
  matching document request from a `doc` query param.
Scope: PRODUCTION feature (backend + frontend), not test-only. Sub-slice A of a planned 3-part bundle.
Do not touch: sub-slice B (internal DOCUMENT_UPLOADED deep-link), sub-slice C (PROPERTY_STATUS_CHANGED
  owner movement/timeline deep-link), STATUS_CHANGE_REQUESTED manager bandeja, MOVEMENT_CREATED (dead),
  any schema migration, the frontend href sanitizer (getSafeRelativeHref already forwards query+hash).
Done: clicking an owner DOCUMENT_REQUESTED / DOCUMENT_APPROVED / DOCUMENT_REJECTED notification lands
  on /owner/properties/{assetId} with the Documentos tab active AND the target document scrolled into
  view and highlighted; the sanitizer rejects any non-whitelisted query param; existing baselines green.
Next slice: 24.6b — internal DOCUMENT_UPLOADED deep-link (/dashboard/product/...).
```

## Investigation summary (2026-06-22)

Grounded in the exploration artifact and confirmed against source.

**Three layers, one stored source of truth.** The `linkHref` persisted on the Notification row is the single source of truth for navigation. Both the backend sanitizer (write/read guard) and the frontend href guard read it.

**Producer (the only id-plumbing-free path).** `createDocumentOwnerNotification` in `viewpro-app/apps/api/src/notifications/notification-producer.service.ts:249-276` hardcodes `linkHref: /owner/properties/${input.propertyAssetId}` (line 264). The `documentRequestId` is ALREADY in `input` (line 267, persisted to the DB column). All three owner document types (`DOCUMENT_REQUESTED`, `DOCUMENT_APPROVED`, `DOCUMENT_REJECTED`) flow through this one private method. No producer signature change, no id plumbing — only the `linkHref` template changes.

**Sanitizer is the security bottleneck (exact-string today).** `sanitizeOwnerNotificationLink` in `viewpro-app/apps/api/src/notifications/notification-link.helper.ts:33-56` accepts `/owner` (line 42) and exactly `/owner/properties/${propertyAssetId}` via string equality (line 51). A link carrying `?tab=documents&doc=<id>` currently sanitizes to `null`. Widening must validate **pathname equals the allowed owner path AND only whitelisted query params `{tab, doc}` are present** — any non-whitelisted param ⇒ `null`. Enumerate allowed param names; NO arbitrary passthrough.

**Frontend href guard already forwards query+hash.** `getSafeRelativeHref` in `viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx:321-337` returns `${url.pathname}${url.search}${url.hash}` (line 333). Once the BACKEND sanitizer allows the query params, the frontend forwards them verbatim. **No frontend sanitizer change needed.**

**Tab activation already works; per-item anchor is the only new UI.** `owner-property-detail.tsx:29-34` reads `tab` via `useQueryState('tab', ...)` with `{ history: 'replace', scroll: false, shallow: true }`. `?tab=documents` auto-activates the Documentos tab. `OwnerDocumentRequestItem` (`owner-document-requests.tsx:261`) renders each request inside a `<li>` with NO ref/anchor keyed by `request.id`. Reading the `doc` param and scrolling-to / highlighting the matching item is the new frontend work.

## Scope

This is a **production feature** (backend + frontend), sub-slice A of a planned 3-part bundle.

### In Scope

1. **Producer (`notification-producer.service.ts`)** — for the three OWNER document types, emit `linkHref = /owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`. Single source of truth in the stored `linkHref`. No signature change.
2. **Sanitizer (`notification-link.helper.ts`)** — widen `sanitizeOwnerNotificationLink`: parse the URL, require `pathname === /owner/properties/${propertyAssetId}` AND every query param ∈ `{tab, doc}` (enumerated allowlist; any other param ⇒ `null`). Preserve existing allowed links (`/owner`, `/owner/properties/${propertyAssetId}` with no params) unchanged.
3. **Frontend (owner property page)** — `owner-property-detail.tsx` reads a `doc` query param and passes it down; `owner-document-requests.tsx` scrolls-to / highlights the `OwnerDocumentRequestItem` whose `request.id` matches `doc`. Tab activation via the existing `tab` param is unchanged.

### Out of Scope (explicit non-goals)

- **Sub-slice B** — internal `DOCUMENT_UPLOADED` deep-link (`/dashboard/product/...`). FUTURE.
- **Sub-slice C** — `PROPERTY_STATUS_CHANGED` owner movement/timeline deep-link. FUTURE.
- **`STATUS_CHANGE_REQUESTED`** manager bandeja — DEFERRED, stays linking to `/dashboard/status-change-requests` unchanged (no per-item anchor; manager reviews the whole list).
- **`MOVEMENT_CREATED`** — dead type, no producer method emits it. Ignore.
- **Internal sanitizer** (`sanitizeInternalNotificationLink`) — untouched (no internal deep-link in this slice).
- **Frontend href guard** (`getSafeRelativeHref`) — untouched; it already forwards query+hash.
- **No DB schema change** — `linkHref` is a stored string; `documentRequestId` column already exists.

## Preserve unchanged

- Existing allowed owner links: `/owner` and `/owner/properties/${propertyAssetId}` with no params must still sanitize through.
- The frontend href guard `getSafeRelativeHref` and its `${pathname}${search}${hash}` forwarding.
- The `tab` nuqs param contract on the owner property page (`summary | tracking | documents`).
- `OwnerNotificationCenter` mark-read-then-`router.push(safeHref)` flow (`notification-center.tsx:70-84`).
- The 24.5 owner + internal notification e2e baselines and T07/T08/T17/T18a seeded smokes.
- The Stage 26.2 deterministic seed contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `notifications`: owner DOCUMENT notification `linkHref` gains a deep-link query string (`?tab=documents&doc={documentRequestId}`); `sanitizeOwnerNotificationLink` widens from exact-string match to pathname + enumerated query-param allowlist `{tab, doc}`.
- `owner-portal` (frontend): the owner property page reads a `doc` query param and scrolls-to / highlights the matching document request item.

## Approach

**Encode-in-linkHref, single source of truth.** The target document id is encoded into the stored `linkHref` at fire time (already available in producer input), so the navigation target is fully described by the persisted string. No new DTO field, no new producer argument, no schema change.

**Sanitizer as an enumerated allowlist, not a passthrough.** Parse the `linkHref` with the `URL` API, compare `pathname` against the allowed owner path, then iterate `searchParams` keys and reject if any key is outside `{tab, doc}`. This keeps the sanitizer a closed security boundary — adding a future param is a deliberate code change, never an open door.

**Frontend reads `doc`, scrolls + highlights.** Add a `doc` nuqs read (or `useSearchParams`) on the owner property page, thread it to `OwnerDocumentRequests`, attach a `ref` keyed by `request.id`, and on mount/param-change `scrollIntoView` + apply a transient highlight to the matching item. Tab activation is already handled by the existing `tab` param.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` | Modified | `createDocumentOwnerNotification` `linkHref` template → append `?tab=documents&doc=${documentRequestId}` (line ~264). |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` | Modified | Widen `sanitizeOwnerNotificationLink` to pathname + `{tab, doc}` allowlist (lines 33-56). Internal sanitizer untouched. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx` | Modified | Read `doc` query param, thread it to `OwnerDocumentRequests`. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx` | Modified | Accept `highlightDocId`, attach `ref` keyed by `request.id`, scroll-to + highlight the match. |
| API tests (`notification-link.helper` unit + owner notification specs) | Modified/New | Cover the new sanitizer allowlist (accept `{tab, doc}`; reject extra params; preserve no-param paths) and the new `linkHref` shape. |
| app-new tests (owner property/document component) | Modified/New | Cover `doc` param read + scroll/highlight. |
| `openspec/changes/24-6a-notification-deeplink-owner-documents/` | New | This folder. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 — Sanitizer widening weakens the security boundary.** Moving from exact-string to URL parsing risks an open passthrough (e.g. accepting any `searchParams`, a `//` host, or a path-traversal pathname). | High | Enumerate allowed params `{tab, doc}` explicitly; reject if ANY param is outside the set. Reuse the `URL` parse + origin/pathname guard pattern already in `getSafeRelativeHref`. Unit-test the rejection of an unknown param, a second copy of `doc`, and a tampered pathname. Treat the helper as a hot path. |
| **R2 — nuqs `history: 'replace'` on `tab` may clobber the `doc` param before the scroll effect fires.** The owner page activates `tab` via `useQueryState(... history: 'replace', shallow: true)`; if that replace rewrites the URL it could drop the unrelated `doc` param before the scroll-to effect reads it. | Med | Verify in design that `doc` survives from `router.push(safeHref)` until the scroll effect runs. Read `doc` from `useSearchParams` (read-only, not a managed nuqs writer) OR register `doc` as its own nuqs param so the `tab` writer never strips it. Add a test asserting `doc` persists after the tab activates. |
| **R3 — Target document not in the loaded page / not yet fetched.** The matching `request.id` may not be present if the documents query is still loading, paginated out, or the request was deleted. | Med | Scroll/highlight only when the item exists in the rendered list; degrade gracefully (tab activates, no scroll) otherwise. Re-run the effect when the documents query resolves. Do not throw. |
| **R4 — `router.push(safeHref)` from the owner notification center already strips unsafe links.** A regression in the frontend guard could drop the now-allowed query params. | Low | `getSafeRelativeHref` already forwards `${pathname}${search}${hash}`; assert in a test that a deep-link `linkHref` round-trips through the owner guard with its query intact. No guard change. |
| **R5 — Stored historical notifications keep the old param-less `linkHref`.** Pre-existing owner document notifications still point at the bare property page. | Low | Acceptable: old notifications land on the property page (current behavior). No backfill; document as out-of-scope. Only future events get the deep-link. |

## Rollback Plan

Revert: the `linkHref` template change in `createDocumentOwnerNotification`, the `sanitizeOwnerNotificationLink` widening, the `doc`-param read in `owner-property-detail.tsx`, the scroll/highlight in `owner-document-requests.tsx`, the added tests, and this OpenSpec folder. No schema migration to roll back. Pre-existing baselines (24.5 owner + internal notification e2e, T07/T08/T17/T18a seeded smokes, the 26.2 deterministic seed contract, both link allowlists, the frontend href guard) remain intact. Reverting restores the param-less `/owner/properties/{assetId}` link and the exact-string sanitizer.

## Dependencies

- None new. `documentRequestId` is already in producer input and persisted; the `tab` param activation already works; the frontend href guard already forwards query+hash.

## Success Criteria

- [ ] The three owner document notification types store `linkHref = /owner/properties/${propertyAssetId}?tab=documents&doc=${documentRequestId}`.
- [ ] `sanitizeOwnerNotificationLink` accepts the deep-link (pathname + `{tab, doc}` only), rejects any non-whitelisted query param, and still passes `/owner` and the param-less property path.
- [ ] Clicking an owner document notification lands on the property page with the Documentos tab active AND the target document request scrolled into view and highlighted.
- [ ] The `doc` param survives from navigation until the scroll effect fires (no nuqs `tab` replace clobber).
- [ ] Target-not-found degrades gracefully (tab active, no scroll, no error).
- [ ] All pre-existing test baselines remain green.

## Next phases

Proceed to `sdd-spec` and `sdd-design` (can run in parallel — design resolves the sanitizer allowlist mechanism, the nuqs `doc`-vs-`tab` interaction, and the scroll/highlight seam).
