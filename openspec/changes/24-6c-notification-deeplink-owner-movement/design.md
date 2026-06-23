# Design — Stage 24.6c Notification Deep-Linking: Owner PROPERTY_STATUS_CHANGED (Movement Timeline)

## Status

Draft — 2026-06-23. Companion to:

- Proposal: `openspec/changes/24-6c-notification-deeplink-owner-movement/proposal.md` · Engram `sdd/24-6c-notification-deeplink-owner-movement/proposal`
- Mirrors shipped siblings: 24.6a (owner docs, PR #177) and 24.6b internal docs design `openspec/changes/24-6b-notification-deeplink-internal-documents/design.md`.

## Scope recap

Owner `PROPERTY_STATUS_CHANGED` deep-links to `/owner/properties/{assetId}?tab=tracking&movement={id}`. Backend (producer one-liner + sanitizer two-tab dispatch) + frontend (read `movement`, thread to the right timeline, scroll/highlight + section fallback, pageSize 25). No schema change. Out of scope: 24.6a/b shipped paths, manager bandeja, `MOVEMENT_CREATED`, full pagination UI, the `/owner` + bare product fast-paths (preserved).

## Grounding facts (confirmed against source)

- **Producer** `notifyPropertyStatusChanged` (`notification-producer.service.ts:126-158`): `linkHref: /owner/properties/${input.propertyAssetId}` at :144; `input.movementId` already in input and passed to `createOwner` at :147. Same link for all deduped recipients. One-line change.
- **Sanitizer** `sanitizeOwnerNotificationLink` (`notification-link.helper.ts:96-171`): `ALLOWED_OWNER_QUERY_PARAM_NAMES={'tab','doc'}` at :94; fast-paths `/owner` (:108) and bare `/owner/properties/{assetId}` (:118); the generic key/duplicate guards at :142-151; then the single `tab==='documents'` guard (:154) + non-empty `doc` (:159). Fragment reject :165. `sanitizeInternalNotificationLink` is untouched.
- **Property page** `owner-property-detail.tsx`: `tracking` already in `OWNER_DETAIL_TAB_VALUES` (:24); `tab` synced via `useQueryState` (:29); `doc` read at :35 and passed only to the documents-tab `OwnerDocumentRequests` (:167). The tracking tab maps **ALL** engagements: `engagements.map(...)` at :139.
- **Engagement card** `owner-engagement-card.tsx`: pass-through; renders `<OwnerTimeline engagementId property />` at :59. No highlight prop today.
- **Timeline** `owner-timeline.tsx`: `DEFAULT_TIMELINE_FILTERS.pageSize=10` (:18-22); wrapper is `<div className='space-y-3'>` (:60), item is `<Card>` (:92), keyed by `movement.id`. NO containerRef, NO `data-*`, NO highlight state/effect — all net-new.
- **Type** `OwnerMovement.id: string` and `OwnerMovement.propertyEngagementId: string` (`api/types.ts:70-72`). Movement ids are globally unique, so a given id appears in exactly one engagement's timeline query — the crux of the R3 safety argument.
- **FE href guard** `getSafeRelativeHref` already forwards `${pathname}${search}${hash}` (24.6a/b). No change.

## Decisions

### D1 — Producer: append `?tab=tracking&movement=${movementId}` to the existing template (no signature change)

**Chosen.** `notification-producer.service.ts:144` →
`linkHref: \`/owner/properties/${input.propertyAssetId}?tab=tracking&movement=${input.movementId}\``.
`movementId` is always set on this lifecycle event (already plumbed to `createOwner` at :147), so no conditional. Same link for every fanned-out recipient.

### D2 — Sanitizer: CLOSED two-tab dispatch over `{tab, doc, movement}` (SECURITY BOUNDARY, R1)

**Chosen.** Add `'movement'` to `ALLOWED_OWNER_QUERY_PARAM_NAMES` (now `{tab, doc, movement}`) and REPLACE the single `tab==='documents'`+`doc` block (:154-162) with the dispatch below. Everything else runs **unchanged**: leading-slash reject, `/owner` fast-path, `propertyAssetId` guard, bare-product fast-path, fixed-base `URL` parse, origin assert, exact pathname match, the generic unknown-key loop, the per-key duplicate loop, and the fragment reject. The dispatch is reached ONLY by a `/owner/properties/{assetId}?...` input that already passed all of those.

```ts
const tab = url.searchParams.get('tab');
const docValue = url.searchParams.get('doc');
const movementValue = url.searchParams.get('movement');

if (tab === 'documents') {
  // 24.6a path: require non-empty doc AND movement absent.
  if (!docValue || movementValue !== null) return null;
} else if (tab === 'tracking') {
  // 24.6c path: require non-empty movement AND doc absent.
  if (!movementValue || docValue !== null) return null;
} else {
  // any other tab value, or tab absent → reject.
  return null;
}
// fragment reject + canonical return unchanged below.
```

**Why exactly two ACCEPT shapes, no bypass.** The branch key is `tab`, an exact-string compare against a closed pair (`documents`/`tracking`); any other value or absent `tab` falls to the `else → null`, so a secondary param can never be accepted without its tab. Inside each branch the OTHER secondary must be `=== null` (absent), which kills cross-tab contamination (`tab=documents&movement`, `tab=tracking&doc`) and the both-secondaries case. Empty values (`?doc=`, `?movement=`) fail the `!value` checks. The duplicate loop at :147-151 (now iterating the 3-key set) still rejects `?movement=a&movement=b`. Because the unknown-key loop at :142-146 already rejected any key outside `{tab,doc,movement}`, no extra param survives to the dispatch. Pathname is built from the trusted `propertyAssetId`, not parsed input, and `URL()` normalizes traversal — no forged match. Net: the matrix collapses to precisely `{documents+doc}` and `{tracking+movement}`; the 24.6a accept path is byte-for-byte preserved (only addition: it now also requires `movement` absent, which historical 24.6a links already satisfy).

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Keep single `tab==='documents'` guard, add a parallel `if (tab==='tracking')` after it | Two independent guards drift; easy to forget the cross-tab `=== null` exclusion → bypass | Rejected |
| Boolean truth-table over `(hasDoc,hasMovement)` ignoring `tab` | Accepts `tab=summary&doc=x`; decouples tab from secondary → looser | Rejected |
| `movement` passthrough (allow when present) | No closed contract; cross-tab contamination | Rejected |
| `tab`-keyed dispatch, each branch requires its secondary AND excludes the other | Exactly 2 shapes, mirrors shipped closed-allowlist posture, unit-testable per row | **Chosen** |

### D3 — `movement` read: sibling `useQueryState('movement', parseAsString)` in `owner-property-detail.tsx`, parallel to `doc`

**Chosen.** Add `const [highlightMovementId] = useQueryState('movement', parseAsString)` next to the existing `doc` read (:35) — read-only, never written. `?tab=tracking` already activates the tab via the existing `tab` sync; no router work. Keeps ONE URL abstraction (nuqs), matching 24.6a/b.

### D4 — Engagement-scoped threading: pass `highlightMovementId` to EVERY rendered timeline, rely on globally-unique movement ids for correctness (R3)

**Chosen.** The tracking tab maps all engagements (`engagements.map` at :139). Thread `highlightMovementId` from `owner-property-detail.tsx` → `owner-engagement-card.tsx` (new optional prop) → `owner-timeline.tsx` for **each** card. The link does NOT carry an engagement id, and it does not need to: each `OwnerTimeline` queries only its own engagement, and a `movement.id` is globally unique, so **at most one** timeline's loaded `items` contains a matching id. The scroll/highlight effect (D5) only fires when `items.some(m => m.id === highlightMovementId)` is true within that timeline's own `containerRef` — sibling timelines compute `false` and stay inert. Passing the prop to all cards is therefore safe AND avoids inventing a fragile "primary engagement" heuristic that could target the wrong engagement.

**Safety argument (the R3 crux).** Uniqueness of `movement.id` ⇒ exactly one timeline matches ⇒ exactly one highlights. The miss path (id not in any loaded page) degrades to the per-timeline section fallback (D6), which fires once per timeline; the targeted engagement is the relevant section, and since status-changed movements are recent (pageSize 25), the hit path dominates. Test with two engagements asserts only the timeline owning the id highlights.

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Pass only to `primaryEngagement` (`engagements[0]`) | Wrong engagement if the target is a non-primary engagement → silent mis-target | Rejected |
| Add engagement id to the link + sanitizer + match by engagement | New param, wider sanitizer surface, schema-ish; unnecessary given id uniqueness | Rejected |
| Pass to all; match by globally-unique id within each timeline's items | Correct by construction, no link/sanitizer change, no heuristic | **Chosen** |

### D5 — OwnerTimeline scroll/highlight infra: port `owner-document-requests.tsx` adapted from `<ul>/<li>` to `<div>/<Card>` (R4)

**Chosen.** Net-new infra inside `OwnerTimeline`, ported one-shot from the shipped doc-requests pattern (`owner-document-requests.tsx:107-146`):

- `const [highlightedId, setHighlightedId] = useState<string | null>(null)`.
- `const containerRef = useRef<HTMLDivElement>(null)` — **`HTMLDivElement`**, not `HTMLUListElement`, because the timeline wrapper is `<div className='space-y-3'>` (:60). Attach `ref={containerRef}` to that wrapper div.
- `const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
- Cleanup effect keyed `[]` clears `highlightTimerRef.current` on unmount (avoids setState-after-unmount), identical to doc-requests :115-121.
- On `OwnerTimelineItem`: add `data-movement-id={movement.id}` to the `<Card>` root (:92) and a conditional highlight via `cn(isHighlighted && 'ring-2 ring-primary')` (import `cn` from `@/lib/utils`). Thread `isHighlighted={highlightedId === movement.id}` from `OwnerTimeline` into each `OwnerTimelineItem`.
- Scroll/highlight effect keyed `[highlightMovementId, timelineQuery.isSuccess, timelineQuery.data]`:
  1. No-op if `!highlightMovementId` or not `isSuccess`.
  2. `const itemExists = movements.some(m => m.id === highlightMovementId)`.
  3. If `itemExists`: `const el = containerRef.current?.querySelector(\`[data-movement-id="${CSS.escape(highlightMovementId)}"]\`)`; `el?.scrollIntoView({ behavior: 'smooth', block: 'start' })`; `setHighlightedId(highlightMovementId)`; clear+set a `setTimeout(~2000ms)` that nulls `highlightedId` and the timer ref.
  4. Else (not loaded): SECTION FALLBACK (D6) — no highlight.

Note: the early returns at the top of `OwnerTimeline` (loading / error / empty) sit BEFORE the JSX. Hooks must run unconditionally, so `useState`/`useRef`/`useEffect` are declared at the top of the component, before those guards — the effect simply no-ops while `isSuccess` is false.

### D6 — Scroll-to-section fallback when the movement is not in the loaded page (R2)

**Chosen.** When `highlightMovementId` is set, the query is `isSuccess`, but `!itemExists` (target older than the loaded page, or deleted), scroll the timeline mount into view with NO highlight, instead of a silent no-op. Seam: reuse `containerRef` — `containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`. Exact condition: `highlightMovementId && isSuccess && !itemExists`. This branch sets no `highlightedId` (nothing to ring) and starts no timer. Per-timeline, so only the targeted engagement's section scrolls (the others don't match and stay put; in the common single-engagement case there is exactly one section). Combined with the pageSize bump (D7), misses are near-zero, but the fallback guarantees the user always lands on the relevant section.

### D7 — pageSize 10→25: scoped to this timeline only

**Chosen.** Bump `DEFAULT_TIMELINE_FILTERS.pageSize` from `10` to `25` in `owner-timeline.tsx:21`. This constant is module-local to `owner-timeline.tsx` (declared at :18, consumed only at :34) — `rg` confirms no other consumer. The bump is therefore **scoped to OwnerTimeline**; no sibling regresses. Status-changed movements are by definition the most recent events, so 25 makes the tail-miss probability negligible while the fallback (D6) covers the residue. No pagination UI.

### D8 — Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit (API) | `sanitizeOwnerNotificationLink` two-tab dispatch | EXTEND `notification-link.helper.spec.ts`. ACCEPT `?tab=tracking&movement=m1`; ACCEPT `?tab=documents&doc=d1` (24.6a regression). REJECT each matrix row: `tab=tracking` alone, `tab=documents` alone, `tab=documents&movement=x`, `tab=tracking&doc=x`, both `doc`+`movement`, any other tab (`?tab=summary&movement=x`), secondary without tab (`?movement=x`, `?doc=x`), empty (`?tab=tracking&movement=`). REJECT traversal/absolute/`//host`/duplicate (`?tab=tracking&movement=a&movement=b`)/fragment. Preserve `/owner` and bare product fast-paths. |
| Unit (FE) | movement read + scroll/highlight hit + section fallback + multi-engagement | EXTEND `owner-timeline.test.tsx`: (a) `highlightMovementId` matching a loaded movement → `scrollIntoView` called on the `[data-movement-id]` node, ring applied then cleared after timer; (b) miss (id not in items) → `containerRef` section `scrollIntoView` called, NO ring (D6); (c) absent/empty id → no-op, no throw (R4); (d) **two engagements**, id belongs to engagement B → only B's timeline highlights, A inert (R3). `vi.fn()` for `Element.prototype.scrollIntoView`; fake timers for the highlight clear. |
| E2E (API) | linkHref round-trip | EXTEND owner notifications e2e: a `PROPERTY_STATUS_CHANGED` record stores+returns `/owner/properties/{id}?tab=tracking&movement={mId}` verbatim; bare product + `/owner` still pass (no regression). |

### D9 — Workload forecast: single PR

| Surface | Est. LOC |
|---|---|
| `notification-producer.service.ts` (1-line template) | ~1 |
| `notification-link.helper.ts` (allowlist + two-tab dispatch) | ~16 |
| `notification-link.helper.spec.ts` (matrix EXTEND) | ~60 |
| `owner-property-detail.tsx` (movement read + thread) | ~6 |
| `owner-engagement-card.tsx` (forward prop) | ~6 |
| `owner-timeline.tsx` (infra + pageSize + fallback + `data-movement-id` + ring) | ~55 |
| `owner-timeline.test.tsx` (extend/new) | ~95 |
| API e2e (extend) | ~20 |
| **Total** | **~259** |

`single_pr_recommended: true`, `size_exception_required: false` (~259 < 400). Touches the notification sanitizer (security boundary) → fresh-context review on the diff before PR.

## Component / data-flow sketch

```text
PRODUCER (api)                       SANITIZER (api, write→read guard)            FRONTEND (app-new)
notifyPropertyStatusChanged (D1)     mapOwnerNotificationResponse                 notification-center
  linkHref =                           → sanitizeOwnerNotificationLink({            getSafeRelativeHref → ${path}${search}${hash}
  /owner/properties/{assetId}              linkHref, propertyAssetId })               (UNCHANGED, fwd)
    ?tab=tracking&movement={mId}        1 startsWith("/")?                            │ router push
        │                               2 /owner fast-path                            ▼
        ▼                               3 propertyAssetId present?                    /owner/properties/{assetId}?tab=tracking&movement={mId}
   Notification.linkHref (DB) ────────► 4 bare /owner/properties/{id}? (param-less)      │ ?tab=tracking activates tab (existing)
                                        5 URL(base)+origin+pathname exact               ▼
                                        6 keys ⊆ {tab,doc,movement}; dup reject     owner-property-detail
                                        7 TWO-TAB DISPATCH (D2):                       useQueryState('movement') → highlightMovementId (D3)
                                            documents → doc set, movement absent          │ thread to EVERY engagement card (D4)
                                            tracking  → movement set, doc absent           ▼
                                            else → null                                owner-engagement-card → OwnerTimeline (per engagement)
                                        8 fragment reject; return path+search ──────►   query items[pageSize 25] (D7)
                                                                                          effect [highlightMovementId, isSuccess, data]:
                                                                                            items.some(id===highlightMovementId)?
                                                                                              ├ hit  → querySelector([data-movement-id]) scrollIntoView + ring (D5)
                                                                                              └ miss → containerRef.scrollIntoView (section fallback, no ring) (D6)
                                                                                          (unique id ⇒ only the owning timeline reacts — R3)
```

## Pre-implementation audit (tasks/apply MUST run before code)

```text
A1) rg -n "linkHref:|notifyPropertyStatusChanged|movementId" \
       viewpro-app/apps/api/src/notifications/notification-producer.service.ts
    Expect: method :126, hardcoded linkHref :144, movementId in input + createOwner :147.
A2) rg -n "ALLOWED_OWNER_QUERY_PARAM_NAMES|sanitizeOwnerNotificationLink|tab === 'documents'|getAll\(" \
       viewpro-app/apps/api/src/notifications/notification-link.helper.ts
    Expect: allowlist :94, owner sanitizer :96, fast-paths :108/:118, key+dup loops :142-151,
            single tab guard :154-162, fragment :165. Confirm dispatch replacement site.
A3) rg -n "OWNER_DETAIL_TAB_VALUES|useQueryState|highlightDocId|engagements.map" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx
    Expect: tracking in tab values :24, tab sync :29, doc read :35, all engagements mapped :139.
A4) rg -n "OwnerTimeline|engagement.id|engagement=|property=" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx
    Expect: pass-through renders OwnerTimeline :59 — add highlightMovementId forward.
A5) rg -n "DEFAULT_TIMELINE_FILTERS|pageSize|space-y-3|<Card|movement.id|OwnerTimelineItem" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx
    Expect: pageSize 10 :21, wrapper div :60, Card root :92, keyed movement.id :62. NO ref/data-/state.
A6) rg -rn "DEFAULT_TIMELINE_FILTERS" viewpro-app/apps/app-new/src
    Expect: ONLY owner-timeline.tsx (confirms pageSize bump is scoped, D7).
A7) rg -n "id: string|propertyEngagementId" \
       viewpro-app/apps/app-new/src/features/owner/api/types.ts
    Expect: OwnerMovement.id + propertyEngagementId :70-72 (D4 uniqueness premise).
A8) rg -n "sanitizeOwnerNotificationLink|scrollIntoView|data-movement-id" \
       viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts \
       viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx
    Expect: owner sanitizer cases exist (extend with matrix); timeline test may not exist yet (create/extend).
```

## Risks

- **R1 (High) — sanitizer two-tab widening.** Mitigated by D2: `tab`-keyed dispatch, each branch requires its secondary AND excludes the other, `else→null`; closed `{tab,doc,movement}` allowlist + unknown-key/duplicate/origin/pathname/fragment guards unchanged. Matrix unit-tested incl. 24.6a regression. Hot path; fresh review on diff.
- **R2 (Med) — pagination tail-miss.** Mitigated by D7 (pageSize 25) + D6 (per-timeline section fallback). Miss test asserts section scroll, not no-op.
- **R3 (Med) — wrong-engagement highlight.** Mitigated by D4: globally-unique `movement.id` ⇒ at most one timeline matches; effect matches within each timeline's own `containerRef`. Two-engagement test proves only the owner highlights.
- **R4 (Low) — target absent/loading/deleted.** Mitigated by D5/D6: scroll/highlight only when `itemExists`; else section fallback; effect re-runs on `isSuccess`; never throws.
- **R5 (Low) — historical param-less notifications.** Accepted: land on the property page via the preserved bare fast-path. No backfill.

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (~259 LOC < 400; security-boundary diff → fresh review before PR)`
```