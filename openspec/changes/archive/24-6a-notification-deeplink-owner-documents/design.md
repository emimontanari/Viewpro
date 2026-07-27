# Design — Stage 24.6a Notification Deep-Linking: Owner Document Notifications

## Status

Draft — 2026-06-22. Companion to:

- Proposal: `openspec/changes/24-6a-notification-deeplink-owner-documents/proposal.md`
- Engram: `sdd/24-6a-notification-deeplink-owner-documents/proposal`, `.../design`

## Scope recap

Owner DOCUMENT notifications (DOCUMENT_REQUESTED/APPROVED/REJECTED) deep-link to the exact
document request on the owner property page. Backend (producer + sanitizer) + frontend (read `doc`,
scroll/highlight). No schema migration. Out of scope: internal DOCUMENT_UPLOADED (B),
PROPERTY_STATUS_CHANGED (C), manager bandeja, MOVEMENT_CREATED, internal sanitizer, frontend href
guard.

## Grounding facts (confirmed against source)

- **Producer** (`notification-producer.service.ts:264`): all 3 owner doc types route through
  `createDocumentOwnerNotification`, hardcoding `linkHref: /owner/properties/${propertyAssetId}`.
  `input.documentRequestId` already in scope (line 267, persisted column). One-line template change.
- **Sanitizer** (`notification-link.helper.ts:33-56`): `sanitizeOwnerNotificationLink` exact-string
  equality at line 51. Mapper (`notification-response.mapper.ts:27-30`) calls it with
  `propertyAssetId = notification.propertyAssetId` — the **trusted DB column**, NOT a link-derived
  value. The expected path is built from that trusted column; the stored `linkHref` must match it.
- **Frontend href guard** (`notification-center.tsx:333`): `getSafeRelativeHref` returns
  `${url.pathname}${url.search}${url.hash}` — already forwards query+hash. R4 confirmed: NO change.
- **Tab activation** (`owner-property-detail.tsx:29-34`): `tab` via `useQueryState(parseAsString,
  {history:'replace', scroll:false, shallow:true})`. `?tab=documents` auto-activates (existing test
  `owner-property-detail.test.tsx:216` proves it).
- **List + item** (`owner-document-requests.tsx`): parent `<ul>` maps `request.id` (line 230); each
  item renders a bare `<li>` (line 313) with no ref/anchor. `OwnerDocumentRequest.id` (`types.ts:140`)
  is the SAME id space as the backend `documentRequestId`. Page size 20, single page (no pagination
  controls).
- **API tests = vitest + supertest** (`notifications.e2e-spec.ts:4`). No dedicated unit spec exists
  for `notification-link.helper.ts` today — it is only exercised via e2e + the mapper.

## Decisions

### D1 — Sanitizer: parse with `URL` against a fixed base, assert exact pathname, enforce a CLOSED `{tab,doc}` name allowlist (SECURITY BOUNDARY)

**Chosen.** Widen `sanitizeOwnerNotificationLink` to:
1. Reject if `!linkHref` or `!linkHref.startsWith("/")` (unchanged guard — kills protocol-relative
   `//host` and absolute `http://` up front, same posture as `getSafeRelativeHref:322`).
2. Keep `linkHref === "/owner"` and param-less `/owner/properties/{propertyAssetId}` fast-paths.
3. Otherwise `new URL(linkHref, "https://viewpro.local")`; reject on throw or if
   `url.origin !== "https://viewpro.local"` (catches `//host`, `/\evil`, backslash tricks that slip
   the prefix check).
4. Assert `url.pathname === /owner/properties/${propertyAssetId}` **exact** (the expected path is
   built from the trusted `propertyAssetId` column, so a tampered assetId in the link cannot match).
5. Iterate `url.searchParams` keys: reject if ANY key ∉ `{tab, doc}` (closed allowlist, NO
   passthrough). Reject duplicate keys (`getAll(k).length > 1`). Require `tab === "documents"`.
   `doc` is optional but if present must be a non-empty string with no further structural constraint
   beyond being a single value (it is echoed only into a client-side equality check, never a query).
6. Reject any URL fragment (`url.hash !== ""`) — not in the allowlist.
7. Return `${url.pathname}${url.search}` on success (canonical, param order from searchParams).

**Why it cannot be bypassed.** The pathname is compared against a string built from a server-trusted
column, not parsed from attacker input — so no path-traversal/encoded-segment can produce a false
match (`URL` already normalizes `.`/`..`/`%2e`). The param check is an **enumerated NAME allowlist
with rejection on the first unknown key**, so an injected `?redirect=//evil` or
`?next=/dashboard` yields `null`. Origin assertion + leading-`/` guard close protocol-relative and
absolute inputs. This is the same two-layer pattern already trusted in `getSafeRelativeHref`,
narrowed to one path.

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Regex on the raw string | Brittle; encoded chars / param-order / `;`-params bypass | Rejected |
| `startsWith(expectedPath)` + allow trailing | `/owner/properties/Xevil` and open query passthrough | Rejected |
| `URL` parse + closed `{tab,doc}` name allowlist | Normalizes input; closed set; testable in isolation | **Chosen** |

### D2 — `doc` survives navigation: read it via read-only `useQueryState(parseAsString)` registered on the page, threaded as a prop (NOT `useSearchParams`)

**Chosen.** Register `doc` as its own nuqs param on `owner-property-detail.tsx` —
`const [highlightDocId] = useQueryState('doc', parseAsString)` (read-only; never written here).
Thread `highlightDocId` down to `<OwnerDocumentRequests highlightDocId={...} />` only in the
`documents` TabsContent. nuqs serializes ALL registered params together on any single `setX`, so the
existing `tab` writer (`setTabQueryValue`, line 117) preserves `doc` automatically — there is no
clobber because nuqs reads the live URL and re-emits the full known-param set, not a per-key replace.

**Effect ordering.** URL arrives `?tab=documents&doc=<id>` → both nuqs reads resolve synchronously on
first render → `tab` activates `documents` TabsContent → `OwnerDocumentRequests` mounts and fires its
`documentRequestsQuery` → on data resolve, the scroll/highlight effect (D3) runs keyed by
`highlightDocId`. The `tab` writer only fires on a user tab click (never on mount), so `doc` is never
stripped during the deep-link path.

**Why not `useSearchParams` (read-only).** It would work and avoid registering a second nuqs param,
BUT the existing unit test (`owner-property-detail.test.tsx:24-36`) mocks `nuqs` only; adding a
`useSearchParams` read forces a parallel `next/navigation` mock and a second source of URL truth.
Registering `doc` as a sibling `useQueryState` keeps ONE URL abstraction (nuqs) and a uniform mock
surface, and guarantees the tab writer's serialization includes `doc`. Note: the existing mock's
`useQueryState` returns `React.useState(default)` for every key — the test (D5) must extend that mock
to key off the param name so `tab` and `doc` resolve independently.

### D3 — Scroll/highlight seam: `data-request-id` on the `<li>`, a `useEffect` in `OwnerDocumentRequests` that scrolls + applies a transient highlight, gated on render + query-resolved

**Chosen.** `OwnerDocumentRequests` accepts optional `highlightDocId?: string`. Add
`data-request-id={request.id}` to the `<li>` in `OwnerDocumentRequestItem` (line 313). In
`OwnerDocumentRequests`, after `documentRequestsQuery` resolves, a `useEffect` keyed on
`[highlightDocId, documentRequestsQuery.data]`:
1. No-op if `!highlightDocId` or query not yet `isSuccess`.
2. Look the item up in `documentRequestsQuery.data.items` by `id === highlightDocId`. If absent
   (deleted / paginated-out / wrong id) → no-op, no throw (R3 graceful degrade; tab still active).
3. If present, resolve the node via `containerRef.current?.querySelector([data-request-id="..."])`
   (escape the value for the selector) and call `scrollIntoView({ behavior: 'smooth', block:
   'start' })`, then set a transient highlight (a `highlightedId` state cleared by a `setTimeout`
   ~2s, stored in a ref-tracked timer so unmount clears it). Highlight = a conditional ring class on
   the `<li>` via `cn(...)`.

**Why query a DOM node instead of a ref map.** Items are rendered in a `.map`; a per-item `ref`
callback into a parent `Map` is the React-idiomatic alternative, but `querySelector` on a stable
`data-request-id` is simpler, avoids threading ref-setters through the item props, and is the same
"attribute selector" seam the repo already uses for `data-testid`. Effect re-runs on data resolve so
a late-arriving query still scrolls (R3). Use `block: 'start'` so the targeted card lands near the
top, not center, given variable card heights.

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Per-item `ref` into parent `Map` | More wiring through item props; ref cleanup on reorder | Rejected |
| CSS `:target` + `#id` hash | Couples to URL hash; conflicts with href-guard hash handling; collides with element ids | Rejected |
| `data-request-id` + `querySelector` in effect | Minimal props, repo-consistent attribute seam, testable | **Chosen** |

### D4 — Producer: append `?tab=documents&doc=${documentRequestId}` to the existing template; no signature change

**Chosen.** Change line 264 to
`linkHref: /owner/properties/${input.propertyAssetId}?tab=documents&doc=${input.documentRequestId}`.
`documentRequestId` is always set on this producer path (it is the document-request lifecycle event),
so no conditional. All 3 owner doc types inherit it through the shared private method. If a future
caller ever passes a nullish `documentRequestId`, the sanitizer simply drops the `doc` param shape —
but D4 keeps it unconditional because the call sites always supply it.

### D5 — Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit (API) | `sanitizeOwnerNotificationLink` allowlist | NEW `notification-link.helper.spec.ts` (vitest): accept `?tab=documents&doc=X`; accept `/owner` + param-less property path; reject unknown param (`?redirect=//evil`), reject `tab !== documents`, reject duplicate `doc`, reject tampered pathname (`/owner/properties/OTHER`), reject `//host`, reject fragment. |
| Unit (FE) | `doc` read + thread + scroll/highlight | Extend `owner-property-detail.test.tsx` nuqs mock to key by param name; assert `highlightDocId` reaches `OwnerDocumentRequests`. NEW/extended `owner-document-requests.test.tsx`: `scrollIntoView` mock asserted called for matching `request.id`; no-op + no throw when id absent. |
| E2E (API) | linkHref shape + round-trip | Extend `owner-notifications.e2e-spec.ts`: a DOCUMENT_REQUESTED record stores and returns the deep-link verbatim (sanitizer accepts). Assert current `/owner` + param-less paths still pass (no regression). |

### D6 — Workload forecast: single PR

| Surface | Est. LOC |
|---|---|
| `notification-producer.service.ts` (1-line template) | ~1 |
| `notification-link.helper.ts` (widen owner sanitizer) | ~30 |
| `notification-link.helper.spec.ts` (NEW) | ~70 |
| `owner-property-detail.tsx` (read `doc`, thread) | ~6 |
| `owner-document-requests.tsx` (`highlightDocId`, `data-request-id`, scroll effect, highlight) | ~45 |
| FE tests (extend 1, add/extend 1) | ~80 |
| `owner-notifications.e2e-spec.ts` (extend) | ~25 |
| **Total** | **~257** |

`single_pr_recommended: true`, `size_exception_required: false` (~257 < 400). Touches notification
sanitizer (security boundary) — run a fresh-context review on the diff before PR.

## Component / data-flow sketch

```text
PRODUCER (api)                       SANITIZER (api, write→read guard)        FRONTEND (app-new)
createDocumentOwnerNotification      mapOwnerNotificationResponse             notification-center
  linkHref =                           → sanitizeOwnerNotificationLink({        getSafeRelativeHref
  /owner/properties/{assetId}              linkHref, propertyAssetId })           → ${path}${search}${hash}
    ?tab=documents&doc={docReqId}        ├ pathname === /owner/properties/{assetId}   (UNCHANGED, fwd)
        │  (D4)                          ├ keys ⊆ {tab,doc}; tab===documents          │ router push
        ▼                                ├ reject unknown/dup/fragment/origin          ▼
   Notification.linkHref (DB) ──────────►└ return path+search (D1) ─────────────► /owner/properties/{id}
                                                                                   ?tab=documents&doc={id}
                                                                                        │
   owner-property-detail.tsx: useQueryState('tab') activates Documentos             ◄──┘
                              useQueryState('doc') → highlightDocId  (D2)
                                        │ prop
                                        ▼
   owner-document-requests.tsx: query items → effect [highlightDocId, data]
        find item by id===highlightDocId → querySelector([data-request-id]) (D3)
        → scrollIntoView + transient highlight ; absent ⇒ no-op (R3)
```

## Pre-implementation audit (tasks/apply MUST run before code)

```text
A1) rg -n "linkHref:" viewpro-app/apps/api/src/notifications/notification-producer.service.ts
    Expect: owner doc template at :264. Confirm documentRequestId in scope at :267.
A2) rg -n "sanitizeOwnerNotificationLink|expectedPropertyLink|=== \"/owner\"" \
       viewpro-app/apps/api/src/notifications/notification-link.helper.ts
    Expect: exact-string equality at :51, /owner fast-path at :42, propertyAssetId guard at :46.
A3) rg -n "propertyAssetId|sanitizeOwnerNotificationLink" \
       viewpro-app/apps/api/src/notifications/notification-response.mapper.ts
    Expect: mapper passes notification.propertyAssetId (trusted column) at :29. Confirms D1 premise.
A4) rg -n "getSafeRelativeHref|url.search|url.hash" \
       viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx
    Expect: forwards ${pathname}${search}${hash} at :333. Confirms R4 (no FE guard change).
A5) rg -n "useQueryState|parseAsString|setTabQueryValue|OwnerDocumentRequests" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx
    Expect: tab nuqs at :29-34, writer at :117, OwnerDocumentRequests render at :163-167.
A6) rg -n "<li>|request.id|data-request-id|querySelector" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx
    Expect: bare <li> at :313, no data-request-id yet (this slice adds it). items.map at :230.
A7) rg -n "vi.mock\('nuqs'|useQueryState|initialTab" \
       viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx
    Expect: nuqs mock at :24-36 returns useState for ALL keys — D5 must extend it to key by name.
A8) fd notification-link.helper.spec.ts viewpro-app/apps/api/src/notifications
    Expect: NO match (unit spec is new). If exists, STOP — re-scope.
```

## Risks

- **R1 (security) — sanitizer widening.** Mitigated by D1: `URL` parse + exact trusted-column
  pathname + closed `{tab,doc}` name allowlist + origin/leading-slash/fragment rejection. Unit spec
  (D5) proves unknown-param, duplicate, tampered-path, `//host`, fragment all → null. Hot path; fresh
  review on diff.
- **R2 — `doc` clobbered by `tab` writer.** Mitigated by D2: `doc` is a sibling registered nuqs param;
  nuqs serializes the full known-param set on any write, and the `tab` writer only fires on user
  click, never on the deep-link mount. Test persistence.
- **R3 — target not loaded / deleted / paginated-out.** Mitigated by D3: effect no-ops when the id is
  absent from resolved items; tab stays active, no throw; re-runs on data resolve.
- **R4 — FE href guard regression.** None: `getSafeRelativeHref` already forwards query+hash
  (A4). No guard change.
- **R5 — historical param-less notifications.** Accepted: land on the property page (current
  behavior). Param-less path still passes the sanitizer (D1 step 2). No backfill (out of scope).

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (~257 LOC < 400; security-boundary diff → fresh review before PR)`
