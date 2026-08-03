# Proposal — Stage 24.6c Notification Deep-Linking: Owner PROPERTY_STATUS_CHANGED (Movement Timeline)

## Status

Draft — proposed 2026-06-23.

## Origin

- `sdd/24-6c-notification-deeplink-owner-movement/explore` (Engram #4447) — exploration mapping all 3 layers (producer, sanitizer, frontend) for the owner `PROPERTY_STATUS_CHANGED` path, confirming `movementId` availability at fire time and that `OwnerTimeline` has zero scroll/highlight infrastructure today.
- Stage 24.6a (`openspec/changes/24-6a-notification-deeplink-owner-documents/`, PR #177) — owner document deep-linking, SHIPPED. Established `sanitizeOwnerNotificationLink` + the `{tab, doc}` allowlist + the scroll/highlight effect pattern.
- Stage 24.6b (`openspec/changes/24-6b-notification-deeplink-internal-documents/`, PR #178) — internal document deep-linking, SHIPPED. C mirrors A/B's three-layer pattern.
- `docs/plans/CURRENT_MVP_EXECUTION.md`.

## Slice contract

```txt
Stage: 24
Slice: 24.6c — Owner PROPERTY_STATUS_CHANGED notification deep-links to the exact movement in the
  owner timeline (/owner/properties/{propertyAssetId}?tab=tracking&movement={movementId}).
Objective: encode the target movementId into the stored linkHref for the owner PROPERTY_STATUS_CHANGED
  notification; widen sanitizeOwnerNotificationLink from a single tab=documents guard to a TWO-TAB
  dispatch over a CLOSED {tab, doc, movement} allowlist (security boundary); and add scroll/highlight
  infrastructure to OwnerTimeline so ?tab=tracking&movement={id} activates the tracking tab and
  scrolls-to / highlights the matching movement.
Scope: PRODUCTION feature (backend + frontend). Sub-slice C — the LAST of the 3-part bundle
  (A = owner docs shipped #177; B = internal docs shipped #178).
Do not touch: owner docs (24.6a) and internal docs (24.6b) shipped paths; STATUS_CHANGE_REQUESTED
  manager bandeja (deferred); MOVEMENT_CREATED (dead type); any schema migration; the /owner and bare
  /owner/properties/{assetId} fast-paths; no timeline "load more"/full pagination UI.
Done: clicking the owner PROPERTY_STATUS_CHANGED notification lands on the tracking tab with the target
  movement scrolled into view and highlighted; the sanitizer accepts only the two valid tab+secondary
  combinations and rejects every other shape; if the movement is not in the loaded page the timeline
  section scrolls into view (no highlight) instead of a silent no-op; existing baselines green.
Next slice: none — closes the 24.6 deep-linking bundle.
```

## Investigation summary (2026-06-23)

Grounded in the exploration artifact (#4447) and confirmed against source.

**Three layers, one stored source of truth.** The `linkHref` on the Notification row is the single source of truth for navigation; the frontend href guard already forwards `${pathname}${search}${hash}`, so no frontend sanitizer change is needed (same as 24.6a/b).

**Producer — the id is already at the fire site.** `notifyPropertyStatusChanged` in `notification-producer.service.ts:126-158` builds the param-less `linkHref: /owner/properties/${input.propertyAssetId}` (line 144). `input.movementId` is ALREADY passed to `createOwner` (line 147) and persisted to the DB `refs.movementId`. The method fans out via `Promise.all` across deduplicated owner recipients (`new Set`, line 129); each gets the SAME `linkHref`, so appending `?tab=tracking&movement=${movementId}` is uniform and safe. No signature change.

**Sanitizer is the security bottleneck (single-tab guard today).** `sanitizeOwnerNotificationLink` (`notification-link.helper.ts:96-171`) uses `ALLOWED_OWNER_QUERY_PARAM_NAMES = {'tab', 'doc'}` (line 94), hardcodes `tab === 'documents'` (line 154), and requires a non-empty `doc` (lines 159-161). A `tab=tracking&movement=<id>` link sanitizes to `null` today. Widening adds `'movement'` to the allowlist and replaces the single guard with a two-tab dispatch — keeping the closed-allowlist contract (no passthrough).

**Frontend — tracking tab routes already; timeline has zero highlight infra.** `owner-property-detail.tsx` already has `tracking` in `OWNER_DETAIL_TAB_VALUES` and syncs `tab` via `useQueryState`, so `?tab=tracking` activates the tab with zero change. `doc` is already read and passed as `highlightDocId`. But `owner-timeline.tsx` has NO containerRef, NO `data-movement-id`, NO highlightedId state, NO scroll effect — all of it is net-new (the doc-requests pattern must be ported). Timeline loads only page 1 with `pageSize: 10` and has no "load more" UI: if the target movement is older than the 10 most recent it is not loaded, so a naive port silently no-ops.

## Scope

This is a **production feature** (backend + frontend), sub-slice C — the LAST of the 3-part bundle.

### In Scope

1. **Producer (`notification-producer.service.ts`)** — for the owner `PROPERTY_STATUS_CHANGED` type, emit `linkHref = /owner/properties/${propertyAssetId}?tab=tracking&movement=${movementId}` (line 144). `movementId` already in input and already plumbed to `createOwner`; no signature change. Same link for all fanned-out recipients.
2. **Sanitizer (`notification-link.helper.ts`)** — extend `sanitizeOwnerNotificationLink`: add `'movement'` to `ALLOWED_OWNER_QUERY_PARAM_NAMES` (now `{tab, doc, movement}`) and REPLACE the single `tab === 'documents'` guard (lines 154-162) with a TWO-TAB DISPATCH per the accept/reject matrix below. Preserve the `/owner` and bare `/owner/properties/{assetId}` fast-paths, the fixed-base parse, origin assertion, exact pathname match, duplicate-key check, and fragment reject — all untouched.
3. **Frontend (`owner-property-detail.tsx`)** — add `useQueryState('movement', parseAsString)` parallel to `doc`; thread the value down the tracking-tab render path as `highlightMovementId`.
4. **Frontend (`owner-engagement-card.tsx`)** — accept and pass `highlightMovementId` through to `OwnerTimeline`.
5. **Frontend (`owner-timeline.tsx`)** — add `highlightMovementId` prop, a `containerRef`, `highlightedId` state + cleanup timer, `data-movement-id={movement.id}` on each `OwnerTimelineItem` root, an `isHighlighted` ring style, and the scroll/highlight `useEffect` (port from `owner-document-requests.tsx`). Bump `DEFAULT_TIMELINE_FILTERS.pageSize` from 10 to 25. Add a SCROLL-TO-SECTION FALLBACK: when the target movement is not in the loaded items, scroll the timeline mount point into view (no highlight) instead of a silent no-op.

### Two-tab accept/reject matrix (sanitizer)

| `linkHref` params | Verdict | Reason |
|---|---|---|
| `tab=documents` + non-empty `doc` | ACCEPT | Existing 24.6a path (no `movement`) |
| `tab=tracking` + non-empty `movement` | ACCEPT | New 24.6c path (no `doc`) |
| `tab=documents` alone | REJECT | `doc` required with documents tab |
| `tab=tracking` alone | REJECT | `movement` required with tracking tab |
| `tab=documents` + `movement` | REJECT | cross-tab contamination |
| `tab=tracking` + `doc` | REJECT | cross-tab contamination |
| both `doc` AND `movement` present | REJECT | ambiguous |
| any other `tab` value | REJECT | not a deep-link target |
| secondary param without its `tab` | REJECT | tab always required |
| `/owner`, bare `/owner/properties/{assetId}` | FAST-PATH | preserved |

### Out of Scope (explicit non-goals)

- **Owner docs (24.6a, #177)** — SHIPPED; the `tab=documents` + `doc` accept path stays byte-for-byte under the new dispatch.
- **Internal docs (24.6b, #178)** — SHIPPED; `sanitizeInternalNotificationLink` UNCHANGED.
- **`STATUS_CHANGE_REQUESTED`** manager bandeja — DEFERRED, unchanged.
- **`MOVEMENT_CREATED`** — dead type; no producer method emits it. Ignore.
- **No DB schema change** — `linkHref` is a stored string; `movementId` already exists in input, in `createOwner`, and in `refs.movementId`.
- **No timeline pagination UI** — no "load more" / full pagination; only the `pageSize` 10→25 bump and the scroll-to-section fallback.
- **Frontend href guard** (`getSafeRelativeHref`) — untouched; already forwards query+hash.
- The `/owner` and bare `/owner/properties/{assetId}` fast-paths — preserved.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `notifications`: the owner `PROPERTY_STATUS_CHANGED` `linkHref` gains a deep-link query string (`?tab=tracking&movement={movementId}`); `sanitizeOwnerNotificationLink` widens from a single `tab=documents` guard to a two-tab dispatch over a CLOSED `{tab, doc, movement}` allowlist.
- `owner` (frontend): the owner property page reads a `movement` query param; `OwnerTimeline` gains scroll/highlight infrastructure (containerRef, `data-movement-id`, highlight state, scroll effect), a `pageSize` bump to 25, and a scroll-to-section fallback when the target is not loaded.

## Approach

**Encode-in-linkHref, single source of truth (mirror 24.6a/b).** The target `movementId` is encoded into the stored `linkHref` at fire time (already in producer input), so the navigation target is fully described by the persisted string. No new DTO field, no producer argument, no schema change.

**Sanitizer as a CLOSED two-tab dispatch, not a passthrough.** Add `'movement'` to the allowlist and replace the single guard with: read `tab`; if `'documents'` require non-empty `doc` AND absent `movement`; if `'tracking'` require non-empty `movement` AND absent `doc`; any other `tab` → `null`. The existing fixed-base parse, origin assertion, exact pathname match, duplicate-key loop, and fragment reject all run unchanged around the new dispatch. Enumerate every shape — no escape hatch.

**Frontend reveal-then-scroll, ported one-shot.** Read `movement` via `useQueryState('movement', parseAsString)`; thread `highlightMovementId` through `owner-engagement-card.tsx` into `owner-timeline.tsx`. `?tab=tracking` already activates the tab. In `OwnerTimeline`, on query success: if the movement exists in the loaded items, `scrollIntoView` + transient `ring-2 ring-primary` highlight on the `[data-movement-id]` match within `containerRef`; if it is NOT loaded, scroll the timeline mount point into view (no highlight). Bump `pageSize` to 25 so a status-changed movement (by definition recent) is virtually always loaded. Multi-engagement care: thread `highlightMovementId` only into the timeline of the engagement the notification targets — never highlight a sibling engagement's timeline.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-app/apps/api/src/notifications/notification-producer.service.ts` | Modified | `notifyPropertyStatusChanged` `linkHref` template → append `?tab=tracking&movement=${input.movementId}` (line 144). |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.ts` | Modified | Add `'movement'` to `ALLOWED_OWNER_QUERY_PARAM_NAMES` (line 94); replace the `tab === 'documents'` guard (lines 154-162) with the two-tab dispatch. Fast-paths, parse, origin/pathname asserts, duplicate-key loop, fragment reject untouched. Internal sanitizer untouched. |
| `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts` | Modified/New | Cover the matrix: accept `tab=tracking`+`movement`; accept `tab=documents`+`doc` (regression); reject every cross-tab / missing-secondary / both-secondary / other-tab / param-without-tab shape; preserve fast-paths; reject traversal/absolute/protocol-relative/duplicate/fragment. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx` | Modified | Add `useQueryState('movement', parseAsString)`; thread `highlightMovementId` down the tracking-tab path. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx` | Modified | Accept + forward `highlightMovementId` to `OwnerTimeline`. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx` | Modified | `highlightMovementId` prop; `containerRef`; `highlightedId` state + timer; `data-movement-id` on `OwnerTimelineItem`; `isHighlighted` ring; scroll/highlight effect; `pageSize` 10→25; scroll-to-section fallback. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` | Modified/New | Cover movement-param read, scroll/highlight on hit, scroll-to-section fallback on miss, and graceful no-throw. |
| `openspec/changes/24-6c-notification-deeplink-owner-movement/` | New | This folder. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 — Sanitizer two-tab widening weakens the security boundary.** Replacing the single `tab=documents` guard with a two-tab dispatch risks accepting cross-tab combos (`tab=documents`+`movement`, `tab=tracking`+`doc`), both secondaries at once, or a `tab`-less secondary param. | High | Enumerate the full accept/reject matrix in the dispatch — exactly two ACCEPT shapes, everything else `null`. Keep the closed `{tab, doc, movement}` allowlist, the fixed-base parse, origin assertion, exact pathname match, duplicate-key loop, and fragment reject. Unit-test every matrix row INCLUDING the 24.6a regression (`tab=documents`+`doc` still accepted, `tab=documents`+`movement` now rejected). Treat the helper as a hot path. |
| **R2 — Timeline pagination tail-risk: target movement not in the loaded page.** Timeline loads only page 1 (`pageSize: 10`) with no "load more"; an older target would not be in `items`, so a naive port silently no-ops and the user sees the tracking tab with no highlight. | Med | `PROPERTY_STATUS_CHANGED` movements are by definition the most recent events, so they almost always sit in the first page. Bump `pageSize` to 25 to push miss probability near zero, AND add the scroll-to-section fallback (scroll the timeline mount point into view, no highlight) so a miss still lands the user on the relevant section instead of doing nothing. No pagination UI needed. Test the miss path asserts the section scroll, not a no-op. |
| **R3 — Multi-engagement threading: highlighting the wrong engagement's timeline.** The owner detail page can render multiple `OwnerEngagementCard`/`OwnerTimeline` instances; passing `highlightMovementId` to all of them could highlight a sibling engagement that happens to share the movement render path. | Med | Thread `highlightMovementId` only into the timeline of the engagement the notification targets (scope by the engagement/asset the link resolves to). The scroll effect matches on `data-movement-id` within that timeline's own `containerRef`, so a sibling timeline never reacts. Verify the threading is engagement-scoped in design and add a test with two engagements asserting only the targeted timeline highlights. |
| **R4 — Target movement absent / not yet fetched / deleted.** The matching `movement.id` may be missing if the timeline query is still loading or the movement was removed. | Low | Run scroll/highlight only when the item exists in the loaded list; otherwise the scroll-to-section fallback (R2) applies. Re-run the effect on query success. Never throw. |
| **R5 — Stored historical notifications keep the param-less `linkHref`.** Pre-existing `PROPERTY_STATUS_CHANGED` notifications still point at `/owner/properties/{assetId}`. | Low | Acceptable: old notifications land on the property page (current behavior) via the preserved bare fast-path. No backfill; only future events deep-link. |

## Rollback Plan

Revert: the `linkHref` template change in `notifyPropertyStatusChanged`, the `'movement'` allowlist entry + two-tab dispatch in `sanitizeOwnerNotificationLink`, the `movement`-param read in `owner-property-detail.tsx`, the prop threading in `owner-engagement-card.tsx`, the timeline scroll/highlight + `pageSize` bump + fallback in `owner-timeline.tsx`, the added tests, and this OpenSpec folder. No schema migration to roll back. Owner docs (24.6a), internal docs/sanitizer (24.6b), the `/owner` and bare product fast-paths, the frontend href guard, and all 24.5/24.6a/24.6b baselines remain intact. Reverting restores the param-less owner status-changed link and the single-tab owner sanitizer guard.

## Dependencies

- None new. `movementId` is already in producer input, plumbed to `createOwner`, and persisted to `refs.movementId`; the shipped owner sanitizer (24.6a) and the `owner-document-requests.tsx` scroll/highlight effect provide the exact patterns to mirror; the frontend href guard already forwards query+hash; `?tab=tracking` routing already works.

## Success Criteria

- [ ] The owner `PROPERTY_STATUS_CHANGED` notification stores `linkHref = /owner/properties/${propertyAssetId}?tab=tracking&movement=${movementId}` (same link for all fanned-out recipients).
- [ ] `sanitizeOwnerNotificationLink` accepts exactly `tab=documents`+non-empty `doc` and `tab=tracking`+non-empty `movement`, rejects every other matrix shape (cross-tab, missing secondary, both secondaries, other tab, tab-less secondary), and still preserves the fast-paths and rejects traversal/absolute/protocol-relative/duplicate/fragment inputs.
- [ ] Clicking the owner `PROPERTY_STATUS_CHANGED` notification lands on the tracking tab with the target movement scrolled into view and highlighted.
- [ ] When the target movement is not in the loaded timeline page, the timeline section scrolls into view (no highlight) — never a silent no-op.
- [ ] With multiple engagements rendered, only the targeted engagement's timeline highlights.
- [ ] Target-not-found / deleted degrades gracefully (no throw).
- [ ] All pre-existing test baselines (24.5, 24.6a, 24.6b) remain green.

## Next phases

Proceed to `sdd-spec` and `sdd-design` (can run in parallel — design resolves the two-tab sanitizer dispatch (R1), the engagement-scoped `highlightMovementId` threading (R3), the `pageSize`-25 + scroll-to-section fallback seam (R2), and the `OwnerTimeline` scroll/highlight infrastructure port).
