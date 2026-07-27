# Design — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Status

Draft — 2026-06-22. Companion to:

- Proposal: `openspec/changes/24-6b-notification-deeplink-internal-documents/proposal.md`
- Engram: `sdd/24-6b-notification-deeplink-internal-documents/proposal`, `.../design`
- Mirrors shipped sibling: `openspec/changes/24-6a-notification-deeplink-owner-documents/design.md`

## Scope recap

Internal `DOCUMENT_UPLOADED` notification (sent to the requesting manager) deep-links to the exact
document request on the internal product page `/dashboard/product/{propertyEngagementId}`. Backend
(producer + sanitizer) + frontend (read `doc`, reset filter, open the resolved Collapsible if needed,
scroll/highlight). No schema migration. Out of scope: sub-slice C (`PROPERTY_STATUS_CHANGED` owner
movement/timeline), `STATUS_CHANGE_REQUESTED` manager bandeja (unchanged), owner-side links (24.6a,
unchanged), `MOVEMENT_CREATED` (dead type). The owner sanitizer and the `SAFE_INTERNAL_LINKS` static
set and bare product-path fast-path are PRESERVED, not modified.

## Grounding facts (confirmed against source)

- **Producer** (`notification-producer.service.ts:98-124`): `notifyDocumentUploaded` hardcodes
  `linkHref: /dashboard/product/${input.propertyEngagementId}` at :112. `input.documentRequestId` is
  already in scope and persisted at :115 (`DocumentUploadedInternalNotificationInput`). One-line
  template change, no signature change.
- **Sanitizer** (`notification-link.helper.ts:8-31`): `sanitizeInternalNotificationLink` today has
  THREE accept paths in order — (1) `SAFE_INTERNAL_LINKS.has(linkHref)` static set (:17), (2) reject
  if `!propertyEngagementId` (:21), (3) exact-string equality `linkHref === /dashboard/product/{id}`
  (:25-28), else `null`. The owner sanitizer below it (:33-110) is the exact widening pattern to
  mirror: `URL` parse against `https://viewpro.local`, origin assert, exact pathname match, closed
  name allowlist, duplicate/empty/fragment rejection.
- **Mapper** (`notification-response.mapper.ts:15-18`): calls `sanitizeInternalNotificationLink({
  linkHref: notification.linkHref, propertyEngagementId: notification.propertyEngagementId })` — the
  `propertyEngagementId` is the **trusted DB column**, NOT a link-derived value. Same write→read guard
  posture as the owner side; the D1 trusted-column premise holds.
- **Unit spec already exists**: `notification-link.helper.spec.ts` ships from 24.6a covering
  `sanitizeOwnerNotificationLink` (S-S1..S-S16 + fragment/dup/tamper). This slice EXTENDS it with an
  internal `describe` block; it does NOT create the file.
- **Frontend mount** (`product-form.tsx:562-569`): `PropertyDocumentRequests` is rendered **inline**
  on the product detail page — it is NOT behind a `?tab=` switch (unlike the owner page). This is the
  reason the internal allowlist is `{doc}` ONLY, with NO `tab` param.
- **Filter param** (`property-document-requests.tsx:110-115`): `documentos` is a nuqs param,
  `parseAsString.withOptions({ history: 'replace', scroll: false, shallow: true }).withDefault('all')`.
  Writer `setDocumentFilter` at :110; `handleFilterChange` writes `null` for `'all'` (:204-206),
  collapsing to the default and dropping the param from the URL.
- **Grouping** (`property-document-requests.tsx:819-833`): `groupDocumentRequests` produces exactly
  three buckets — `pending` (PENDING), `review` (SUBMITTED), `resolved` (APPROVED **or** REJECTED).
  **`CANCELLED` is in NONE of the three buckets and has no separate render path** — a CANCELLED
  request is NEVER rendered, in any filter including `'all'`. (Correction to the proposal, which said
  CANCELLED "renders under all"; it does not. See R5.)
- **Resolved Collapsible** (`property-document-requests.tsx:456-490`): the `resolved` group renders
  inside `<Collapsible defaultOpen={false}>` (Radix), with `CollapsibleTrigger`/`CollapsibleContent`.
  The other two groups (`review`, `pending`) render as plain `<section>` — always open.
- **List + item** (`property-document-requests.tsx:544-560` / `563-691`): `DocumentRequestList`
  renders a `<ul>` (:545) mapping `request.id` (:548); each `DocumentRequestItem` renders a bare
  `<li>` (:590) with no ref/anchor/`data-request-id`. `ProductDocumentRequest.id` is the same id space
  as the backend `documentRequestId`.
- **FE href guard**: the notification-center `getSafeRelativeHref` already forwards
  `${pathname}${search}${hash}` (confirmed in 24.6a R4). No change here.
- **Test mock** (`property-document-requests.test.tsx:38-51`): the `nuqs` mock's `useQueryState`
  returns `React.useState(parser.defaultValue)` for EVERY key. D7 must extend it to key off the param
  name so `documentos` and `doc` resolve independently.

## Decisions

### D1 — Internal sanitizer: add ONE `URL`-parse branch for the product path, AFTER the static set and the bare-product fast-path, with a CLOSED `{doc}`-only allowlist (SECURITY BOUNDARY)

**Chosen.** Widen `sanitizeInternalNotificationLink` (`notification-link.helper.ts:8-31`). The order is
load-bearing and MUST be preserved exactly:

1. **(unchanged)** Reject if `!linkHref || !linkHref.startsWith("/")` — kills protocol-relative
   `//host` and absolute `http://` up front.
2. **(unchanged)** `if (SAFE_INTERNAL_LINKS.has(linkHref)) return linkHref;` — the static dashboard
   links (`/dashboard`, `/dashboard/seguimiento`, `/dashboard/users`,
   `/dashboard/status-change-requests`) must still pass verbatim BEFORE any parsing. These are
   exact-string, query-less, so they can never reach the parse branch.
3. **(unchanged)** `if (!input.propertyEngagementId) return null;` — no engagement context ⇒ the only
   remaining accept paths are impossible, reject.
4. **(unchanged, FAST-PATH)** Build `expectedProductLink = /dashboard/product/${propertyEngagementId}`
   and `if (linkHref === expectedProductLink) return linkHref;` — param-less product path (historical
   notifications, FR-S3 analogue) still passes via cheap exact-string equality, BEFORE parsing.
5. **(NEW, parse branch — only the deep-link with a query reaches here)**:
   a. `let url: URL; try { url = new URL(linkHref, "https://viewpro.local"); } catch { return null; }`
   b. Origin assert: `if (url.origin !== "https://viewpro.local") return null;` — catches `//host`,
      backslash tricks, any absolute URL that slipped the prefix check.
   c. Pathname exact match against the trusted column:
      `if (url.pathname !== expectedProductLink) return null;` — `expectedProductLink` is built from
      the server-trusted `propertyEngagementId`, NOT parsed from attacker input, and `URL()`
      normalizes `.`/`..`/`%2e`, so no traversal/encoded segment can forge a match.
   d. Closed NAME allowlist `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = new Set(["doc"])`. Iterate
      `url.searchParams.keys()`; `if (!ALLOWED_INTERNAL_QUERY_PARAM_NAMES.has(key)) return null;` —
      reject on the FIRST unknown key. **`tab` is NOT in the set** (internal page is not tabbed), so
      `?tab=...` is rejected like any other unknown param.
   e. Reject duplicate `doc`: `if (url.searchParams.getAll("doc").length > 1) return null;`.
   f. Require a non-empty `doc`: `const docValue = url.searchParams.get("doc"); if (!docValue) return
      null;` — rejects `?doc=` (blank) and the no-`doc` case (a parse branch with only-unknown params
      already died at (d); a query with zero params cannot reach here because the param-less path was
      caught by the fast-path at step 4).
   g. Reject any fragment: `if (url.hash !== "") return null;`.
   h. Return canonical `${url.pathname}${url.search}` (param order from `searchParams`, no fragment).

**Why the order matters (the crux of D1).** Steps 2 and 4 are exact-string fast-paths that MUST run
and return BEFORE the parse branch. If the parse branch ran first it would still be safe (those links
have no query and exact-match the pathname), but the static set entries (`/dashboard/seguimiento`
etc.) do NOT match `expectedProductLink`, so they would fall through to a `null` — a REGRESSION.
Keeping `SAFE_INTERNAL_LINKS.has` first preserves them. The parse branch is reached ONLY by a
`/dashboard/product/{id}?...` input that failed the exact param-less equality, i.e. a string with a
query (or trailing fragment) — exactly the deep-link shape we are widening for.

**Why it cannot be bypassed.** Same two-layer argument as 24.6a D1: trusted-column pathname comparison
(no traversal forge) + enumerated NAME allowlist with first-unknown-key rejection (no
`?redirect=//evil` passthrough) + origin/leading-slash/fragment rejection (no protocol-relative or
absolute). The allowlist is STRICTLY SMALLER than the owner one (`{doc}` vs `{tab,doc}`), so the
attack surface is narrower, not wider.

**Alternatives considered.**

| Option | Tradeoff | Decision |
|---|---|---|
| Reuse `ALLOWED_OWNER_QUERY_PARAM_NAMES` ({tab,doc}) | Accepts `?tab=x` on a non-tabbed page → dead/confusing param, looser than needed | Rejected |
| `startsWith(expectedProductLink)` + allow trailing query | `/dashboard/product/Xevil` + open query passthrough | Rejected |
| Regex on the raw string | Encoded chars / param-order / `;`-params bypass; brittle | Rejected |
| Run parse branch BEFORE the static set | Drops `/dashboard/seguimiento` etc. → regression | Rejected |
| `URL` parse after fast-paths + closed `{doc}` allowlist | Narrowest surface, mirrors shipped owner pattern, testable in isolation | **Chosen** |

### D2 — Producer: append `?doc=${documentRequestId}` to the existing template; no signature change, no conditional

**Chosen.** Change `notification-producer.service.ts:112` from
`linkHref: /dashboard/product/${input.propertyEngagementId}` to
`linkHref: /dashboard/product/${input.propertyEngagementId}?doc=${input.documentRequestId}`.
`documentRequestId` is always set on this producer path — it is the document-upload lifecycle event
(`DocumentUploadedInternalNotificationInput`, persisted at :115) — so no conditional is needed. NO
`tab` param (internal page is not tabbed). If a future caller ever passed a nullish
`documentRequestId`, the sanitizer would reject the malformed `?doc=` and the link would resolve to
`null` (notification still delivered, just non-clickable-deep) — acceptable degrade, but the current
call site always supplies it.

### D3 — `doc` read: register a read-only sibling nuqs param `useQueryState('doc', parseAsString)` inside `PropertyDocumentRequests`, NOT `useSearchParams`

**Chosen.** Inside `PropertyDocumentRequests` add
`const [highlightDocId] = useQueryState('doc', parseAsString)` (read-only; never written). This is a
LOCAL read in the same component that owns the `documentos` filter and the documents query, so unlike
24.6a there is no prop-threading from a parent page — the deep-link target component reads its own
param. Keeping ONE URL abstraction (nuqs) means the existing test mock surface (D7) stays uniform.
`doc` and `documentos` are independent params; nuqs serializes the full known-param set on any write,
so the `setDocumentFilter` writer (D5) preserves `doc` automatically (it reads the live URL and
re-emits all known params, never a per-key wipe).

**Why not `useSearchParams` (read-only).** It would work but forces a parallel `next/navigation` mock
alongside the existing `nuqs` mock and a second source of URL truth. Registering `doc` as a sibling
`useQueryState` keeps one abstraction and one mock surface, exactly as 24.6a D2 concluded.

### D4 — Reveal mechanism for a `resolved` target: drive a CONTROLLED `open` on the `resolved` Collapsible, derived from `highlightDocId` + loaded data (the R1 hard one)

**Problem.** The documents query resolves AFTER first render. When the `resolved` group's
`<Collapsible defaultOpen={false}>` first mounts, the target's group membership is unknown, and
`defaultOpen` is a Radix UNCONTROLLED one-time init — Radix does NOT re-read `defaultOpen` after mount.
So a resolved-status target sitting in a collapsed group would be in the DOM (Radix
`CollapsibleContent` mounts its children) but visually hidden, and `scrollIntoView` on a hidden
ancestor is a no-op/incorrect. We must OPEN that group before scrolling.

**Chosen.** Convert the `resolved` group to a CONTROLLED Collapsible:
`<Collapsible open={resolvedOpen} onOpenChange={setResolvedOpen}>`, with a single piece of derived
state owned by `PropertyDocumentRequests` and threaded to `DocumentRequestSection`. Compute the
target's group ONCE on data resolve and force `resolvedOpen = true` when the target is a resolved
(APPROVED/REJECTED) item; otherwise it stays user-controlled (default closed). Concretely:

- `PropertyDocumentRequests` owns `const [resolvedOpen, setResolvedOpen] = useState(false)`.
- An effect keyed `[highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data]`
  (the SAME effect that does the scroll/highlight in D6, single pass) computes the target item by
  `id === highlightDocId`; if found AND its status is `APPROVED || REJECTED`, call
  `setResolvedOpen(true)` BEFORE the scroll step. (A one-shot ref guard, like D5, prevents this from
  fighting a later user collapse — it only forces-open once on arrival.)
- `DocumentRequestSection` accepts `open?: boolean` + `onOpenChange?` and, for the `resolved` branch,
  renders `<Collapsible open={open} onOpenChange={onOpenChange}>` instead of `defaultOpen={false}`.
  The `review`/`pending` branches are unchanged (always-open `<section>`).

**Effect ordering (single effect, R1):**
data resolves (`isSuccess`) → look up item by `id === highlightDocId` → if absent, no-op (R5) → if
present: if status∈{APPROVED,REJECTED} `setResolvedOpen(true)` → (the open state flips synchronously
in React's commit, Radix renders the content visible) → in the same effect tick, query the node via
`containerRef.current?.querySelector([data-request-id])` and `scrollIntoView` + set transient
highlight. Because `setResolvedOpen(true)` and the scroll happen in one effect run, the content is
already mounted (Radix mounts `CollapsibleContent` children even when closed) and the open flip makes
it laid-out before the browser paints; `scrollIntoView` reads layout after the synchronous state
flush. If a single-tick race is observed in practice, the fallback is to split into two effects keyed
on `resolvedOpen` (open first, then scroll once `resolvedOpen` is true) — documented as the R1
fallback, not the default.

**Why controlled over the alternatives.**

| Option | Tradeoff | Decision |
|---|---|---|
| Keep `defaultOpen`, mutate it | Radix ignores `defaultOpen` after mount; does nothing | Rejected |
| `key={...}` the Collapsible to force remount when data resolves | Remount loses any user-toggle state, flickers, and still needs the open value computed — same work, worse UX | Rejected |
| Controlled `open` derived from target group + one-shot ref | Honors Radix semantics, single source of truth, no remount/flicker, force-open exactly once | **Chosen** |

**Radix note.** `CollapsibleContent` wraps its children in `<Presence present={open}>`, so while the
group is collapsed the `<li>` is genuinely UNMOUNTED — `querySelector` returns null until the
controlled `open` flips to `true`. This is exactly why the scroll effect (Effect B) is keyed on
`resolvedOpen`: Effect A force-opens the group, Radix mounts the content in that commit, then Effect B
re-runs post-commit, finds the now-mounted node, and scrolls. The `if (!element) return` guard makes a
still-collapsed (or filtered-out) target a safe no-op rather than a crash.

### D5 — One-shot `documentos` → `'all'` reset on arrival via a `useRef` guard (R3)

**Chosen.** On deep-link arrival, force the `documentos` filter to `'all'` exactly once so the target
is in the visible set regardless of which filter the user (or a persisted URL) last had. Mechanism:

- `const didResetFilterRef = useRef(false)`.
- An effect keyed `[highlightDocId]` (NOT on filter state): on the first run where `highlightDocId` is
  truthy AND `!didResetFilterRef.current`, set `didResetFilterRef.current = true` and call
  `setDocumentFilter(null)` (writing `null` collapses to the `withDefault('all')` and drops the
  `documentos` param from the URL, consistent with `handleFilterChange`'s `'all'` path).
- The ref guard ensures it fires ONCE: later user filter clicks (`handleFilterChange`) are never
  clobbered because the effect's body short-circuits on `didResetFilterRef.current` and the effect's
  dependency (`highlightDocId`) does not change on filter clicks.

**Interaction with `history: 'replace'`.** `setDocumentFilter(null)` writes with the param's existing
options (`history: 'replace', scroll: false, shallow: true`), so the reset does not push a history
entry and does not scroll — the only scroll is the deliberate `scrollIntoView` in D6. nuqs preserves
the sibling `doc` param across this write (D3), so `highlightDocId` survives the filter reset and the
D4/D6 effect still sees it.

**Why force-to-'all' over compute-and-jump-to-the-target-group.** A target whose group is collapsed or
filtered-out would be invisible; resetting to `'all'` renders all three groups so the target is
present (subject to D4 opening the `resolved` group). It is also the natural landing view for a
manager. CANCELLED targets are the lone exception — they render in NO group (R5) — and no filter value
can reveal them, so force-to-'all' is strictly the best available and the effect simply no-ops for
CANCELLED.

### D6 — Scroll/highlight seam: `data-request-id` on the `<li>`, `containerRef` on the outer results container, single effect on query success (ported from 24.6a D3)

**Chosen.** Port the exact 24.6a `owner-document-requests.tsx` mechanism, adapted to the grouped
layout:

- `PropertyDocumentRequests` accepts the local `highlightDocId` (D3) and owns
  `const [highlightedId, setHighlightedId] = useState<string | null>(null)`, a
  `containerRef`, and `const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
- Attach `containerRef` to the **outer** `data-testid="document-request-results"` container
  (`property-document-requests.tsx:258-261`), NOT a single `<ul>` — because the internal layout has
  multiple `<ul>`s (one per group) and the target may be in any of them. `querySelector` from the
  outer container finds the `<li>` across all groups.
- Add `data-request-id={request.id}` to the `<li>` in `DocumentRequestItem` (:590) and a conditional
  highlight class via `cn(isHighlighted && 'ring-2 ring-primary rounded-xl')` (same visual as 24.6a).
  Thread `isHighlighted={highlightedId === request.id}` down through
  `DocumentRequestSection` → `DocumentRequestList` → `DocumentRequestItem` (add an optional
  `highlightedId?: string | null` prop at each level; default omitted so other call paths are
  unaffected).
- The SINGLE effect (shared with D4's open logic), keyed
  `[highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data]`:
  1. No-op if `!highlightDocId` or not `isSuccess`.
  2. Find the item by `id === highlightDocId` in `documentRequestsQuery.data.items`. If absent
     (deleted, CANCELLED-not-rendered, wrong id) → no-op, no throw (R5).
  3. If status∈{APPROVED,REJECTED}, `setResolvedOpen(true)` (D4).
  4. Resolve the node: `containerRef.current?.querySelector([data-request-id="${CSS.escape(highlightDocId)}"])`;
     `element?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
  5. `setHighlightedId(highlightDocId)`; clear any prior timer; set a `setTimeout(~2000ms)` that
     resets `highlightedId` to `null` and nulls the timer ref.
- A separate cleanup effect (`[]`) clears `highlightTimerRef.current` on unmount (avoids
  setState-after-unmount), identical to `owner-document-requests.tsx:114-121`.

**Why query the DOM instead of a ref map.** Same as 24.6a D3: a per-item ref into a parent `Map`
would require threading ref-setters through three component layers (`Section`→`List`→`Item`) across
multiple groups; a stable `data-request-id` + `querySelector` from the outer container is the repo's
existing attribute-selector seam, minimal props, testable. `block: 'start'` lands the card near the
top given variable card heights.

### D7 — Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit (API) | `sanitizeInternalNotificationLink` `{doc}` allowlist | EXTEND existing `notification-link.helper.spec.ts` with an internal `describe`: ACCEPT `/dashboard/product/{id}?doc=req-1`; ACCEPT each `SAFE_INTERNAL_LINKS` entry verbatim (regression); ACCEPT param-less `/dashboard/product/{id}` (regression); REJECT `?tab=documents&doc=x` (tab now unknown for internal), REJECT unknown param (`?redirect=//evil`), REJECT duplicate `doc`, REJECT empty `doc=`, REJECT tampered pathname (`/dashboard/product/OTHER`), REJECT `//host`, REJECT absolute URL, REJECT fragment, REJECT null/undefined/empty. Verify owner-side tests still pass unchanged. |
| Unit (FE) | `doc` read + filter reset + collapsible open + scroll/highlight | EXTEND `property-document-requests.test.tsx`: extend the `nuqs` mock to key `useQueryState` by param name (so `documentos` and `doc` resolve independently — mirrors 24.6a D5). Cases: (a) `doc` matching a PENDING/SUBMITTED item → `scrollIntoView` mock asserted called, `data-request-id` present, highlight ring applied then cleared; (b) `doc` matching a RESOLVED (APPROVED/REJECTED) item → the `resolved` Collapsible content is revealed (controlled `open`) before scroll; (c) `doc` matching a CANCELLED item → no scroll, no throw (R5); (d) `doc` for an absent id → no-op, no throw; (e) arriving with `documentos=resolved` in the URL → filter reset to `'all'` once; later manual filter click is NOT reverted (R3). Use `vi.fn()` for `Element.prototype.scrollIntoView`. |
| E2E (API) | linkHref shape + round-trip | EXTEND the internal notifications e2e (`notifications.e2e-spec.ts` or the internal-specific spec): a `DOCUMENT_UPLOADED` record stores and returns `/dashboard/product/{id}?doc={reqId}` verbatim (sanitizer accepts). Assert `SAFE_INTERNAL_LINKS` and param-less product paths still pass (no regression). |

### D8 — Workload forecast: single PR

| Surface | Est. LOC |
|---|---|
| `notification-producer.service.ts` (1-line template) | ~1 |
| `notification-link.helper.ts` (add internal parse branch + `ALLOWED_INTERNAL_QUERY_PARAM_NAMES`) | ~28 |
| `notification-link.helper.spec.ts` (EXTEND — internal describe) | ~55 |
| `property-document-requests.tsx` (`doc` read, filter-reset ref, controlled resolved Collapsible, `data-request-id`, scroll/highlight effect, prop threading) | ~70 |
| FE test (`property-document-requests.test.tsx` extend mock + cases) | ~90 |
| API e2e (extend) | ~25 |
| **Total** | **~269** |

`single_pr_recommended: true`, `size_exception_required: false` (~269 < 400). Touches the notification
sanitizer (security boundary) — run a fresh-context review on the diff before PR.

## Component / data-flow sketch

```text
PRODUCER (api)                          SANITIZER (api, write→read guard)              FRONTEND (app-new)
notifyDocumentUploaded (D2)             mapInternalNotificationResponse                notification-center
  linkHref =                              → sanitizeInternalNotificationLink({           getSafeRelativeHref
  /dashboard/product/{engId}                  linkHref, propertyEngagementId })            → ${path}${search}${hash}
    ?doc={docReqId}                         1 startsWith("/")?                              (UNCHANGED, fwd)
        │                                   2 SAFE_INTERNAL_LINKS.has? (verbatim)            │ router push
        ▼                                   3 propertyEngagementId present?                  ▼
   Notification.linkHref (DB) ────────────► 4 === /dashboard/product/{engId}? (param-less)  /dashboard/product/{engId}
                                            5 NEW parse branch (only ?query reaches):          ?doc={docReqId}
                                              ├ URL(base) + origin assert                       │ (inline page, NOT tabbed)
                                              ├ pathname === /dashboard/product/{engId}          ▼
                                              ├ keys ⊆ {doc}; NO tab; dup/empty/fragment reject
                                              └ return path+search ──────────────────────► PropertyDocumentRequests
                                                                                              useQueryState('doc') → highlightDocId  (D3)
                                                                                                    │
                          one-shot useRef → setDocumentFilter(null) → 'all'  (D5) ◄──────────────┤
                                                                                                    ▼
                          query items → SINGLE effect [highlightDocId, isSuccess, data]:
                            find item by id===highlightDocId
                              ├ absent / CANCELLED ⇒ no-op (R5)
                              ├ status∈{APPROVED,REJECTED} ⇒ setResolvedOpen(true) (D4, controlled Collapsible)
                              └ querySelector([data-request-id]) → scrollIntoView + transient ring (D6)
```

## Pre-implementation audit (tasks/apply MUST run before code)

```text
A1) rg -n "linkHref:|notifyDocumentUploaded|documentRequestId" \
       viewpro-app/apps/api/src/notifications/notification-producer.service.ts
    Expect: notifyDocumentUploaded at :98, hardcoded linkHref at :112, documentRequestId persisted :115.
A2) rg -n "sanitizeInternalNotificationLink|SAFE_INTERNAL_LINKS|expectedProductLink|ALLOWED_OWNER" \
       viewpro-app/apps/api/src/notifications/notification-link.helper.ts
    Expect: internal sanitizer :8-31 (static set :17, engagement guard :21, exact equality :25-28),
            owner sanitizer pattern :33-110, ALLOWED_OWNER_QUERY_PARAM_NAMES :33. Add internal {doc} set.
A3) rg -n "sanitizeInternalNotificationLink|propertyEngagementId" \
       viewpro-app/apps/api/src/notifications/notification-response.mapper.ts
    Expect: mapper passes notification.propertyEngagementId (trusted column) at :15-18. Confirms D1 premise.
A4) rg -n "documentos|setDocumentFilter|withDefault|handleFilterChange|history: 'replace'" \
       viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx
    Expect: documentos nuqs :110-115, handleFilterChange writes null for 'all' :204-206.
A5) rg -n "Collapsible|defaultOpen|group.key === 'resolved'|data-testid=\"document-request-results\"" \
       viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx
    Expect: resolved Collapsible defaultOpen={false} :458, results container :258-261. Confirm controlled-open conversion site.
A6) rg -n "<li>|request.id|DocumentRequestList|DocumentRequestItem|groupDocumentRequests" \
       viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx
    Expect: bare <li> :590, <ul> :545, grouping :819-833 (NO CANCELLED bucket → confirms R5).
A7) rg -n "vi.mock\('nuqs'|useQueryState|getProductDocumentRequestsMock|scrollIntoView" \
       viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx
    Expect: nuqs mock :38-51 returns useState for ALL keys — D7 must extend it to key by param name.
            No scrollIntoView mock yet (this slice adds it).
A8) rg -n "sanitizeOwnerNotificationLink|sanitizeInternalNotificationLink" \
       viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts
    Expect: ONLY owner cases today. This slice EXTENDS with an internal describe block (file already exists).
A9) rg -n "PropertyDocumentRequests" \
       viewpro-app/apps/app-new/src/features/products/components/product-form.tsx
    Expect: mounted inline at :562 (NOT tab-gated) — confirms NO tab param in the internal allowlist (D1/D2).
```

## Risks

- **R1 (Med) — Collapsible reveal timing.** Mitigated by D4: controlled `open` on the `resolved`
  Collapsible, force-open computed in the same effect that scrolls, before `scrollIntoView`. Radix
  keeps `CollapsibleContent` children mounted so the node is always queryable; the synchronous open
  flip lays it out before paint. Fallback (split into two effects keyed on `resolvedOpen`) documented
  if a single-tick race is observed. FE test case (b) proves a resolved target is revealed.
- **R2 (High) — sanitizer security widening.** Mitigated by D1: `URL` parse + trusted-column pathname
  + CLOSED `{doc}`-ONLY allowlist (smaller than owner) + duplicate/empty/fragment/origin rejection,
  reached ONLY after the static set + param-less fast-path (order preserved). Unit spec (D7) proves
  `?tab=...`, unknown param, dup, empty, tampered path, `//host`, absolute, fragment all → null, and
  the static/param-less paths still pass. Hot path; fresh review on diff.
- **R3 (Med) — one-shot filter reset clobbering user changes.** Mitigated by D5: `useRef` guard fires
  the `'all'` reset exactly once on first truthy `highlightDocId`; effect keyed on `highlightDocId`
  (not filter state), so later `handleFilterChange` clicks are untouched. FE test case (e) proves it.
- **R4 — `doc` clobbered by `setDocumentFilter`.** None: `doc` and `documentos` are sibling nuqs
  params; nuqs re-emits the full known-param set on any write, and the filter writer fires on the
  one-shot reset / user click only, never wiping `doc` (D3/D5). FE test persistence.
- **R5 (Med, sharper than proposal) — target not rendered.** `CANCELLED` requests are filtered into
  NO group by `groupDocumentRequests` and have NO render path — a CANCELLED target is NEVER on screen,
  and no filter or open-state can reveal it. Also covers deleted / wrong-id targets. Mitigated by D6
  step 2: the effect no-ops when the id is absent from the rendered set; the page stays usable, no
  throw, re-runs on data resolve. FE test case (c)/(d) prove no-op + no throw.
- **R6 — FE href guard regression.** None: `getSafeRelativeHref` already forwards query+hash (24.6a
  R4). No guard change.
- **R7 — historical param-less internal notifications.** Accepted: land on the bare product page
  (current behavior). The param-less path still passes the sanitizer (D1 step 4). No backfill (out of
  scope).

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (~269 LOC < 400; security-boundary diff → fresh review before PR)`
```
