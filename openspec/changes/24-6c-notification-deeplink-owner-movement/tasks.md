# Tasks — Stage 24.6c Notification Deep-Linking: Owner PROPERTY_STATUS_CHANGED (Movement Timeline)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~259 (design D9 breakdown) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (~259 LOC < 400; sanitizer is a security boundary → fresh-context review required before PR) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 — Audit | Run pre-impl audit commands (A1–A8) and confirm all grounding facts | pre-PR | Mandatory gate; blocks ALL implementation |
| 2 — Sanitizer tests (failing) | Write the full two-tab dispatch matrix for `sanitizeOwnerNotificationLink` — ACCEPT S-S1..S-S4, REJECT S-S5..S-S29, fast-paths S-S30..S-S31 | PR 1 | Security-critical; tests MUST be RED first; 24.6a regression embedded |
| 3 — Sanitizer impl | Replace single `tab==='documents'` guard with two-tab dispatch; add `'movement'` to allowlist; all unit tests green | PR 1 | Security boundary; implement after tests are red |
| 4 — Producer | One-line `linkHref` template change in `notifyPropertyStatusChanged`; update producer unit tests | PR 1 | Depends on sanitizer done; 1-line change |
| 5 — Frontend | `movement` nuqs read; thread `highlightMovementId` through engagement card; timeline infra (containerRef, data-movement-id, state, effect, section fallback, pageSize 25) + FE unit tests | PR 1 | Depends on audit; test-first within each sub-step |
| 6 — E2E extension | Extend `owner-notifications.e2e-spec.ts` with `PROPERTY_STATUS_CHANGED` round-trip + regression cases | PR 1 | Depends on Phase 3 + 4 green |
| 7 — Verification gates | api vitest, app-new vitest, oxlint, seeded smoke note | PR 1 | All gates must be green before tagging done |

---

## Phase 1 — Pre-implementation audit

Run ALL commands before writing any code. Paste verbatim output into the apply-progress audit section.
**Any unexpected result blocks apply.**

- [x] 1.1 **(A1 — producer shape)** `rg -n "linkHref:|notifyPropertyStatusChanged|movementId" viewpro-app/apps/api/src/notifications/notification-producer.service.ts`
      Expected: `notifyPropertyStatusChanged` declared at ~:126; `linkHref: \`/owner/properties/${input.propertyAssetId}\`` at ~:144; `input.movementId` present in scope and forwarded to `createOwner` at ~:147. If `movementId` is NOT in scope on that path, STOP — assumption FR-P3 fails and the slice needs re-scoping.

- [x] 1.2 **(A2 — sanitizer shape + dispatch replacement site)** `rg -n "ALLOWED_OWNER_QUERY_PARAM_NAMES|sanitizeOwnerNotificationLink|tab === 'documents'|getAll\(" viewpro-app/apps/api/src/notifications/notification-link.helper.ts`
      Expected: `ALLOWED_OWNER_QUERY_PARAM_NAMES = new Set(['tab','doc'])` at ~:94; sanitizer starts ~:96; `/owner` fast-path ~:108; bare `/owner/properties/{id}` fast-path ~:118; generic key loop + per-key dup loop ~:142-151; single `tab === 'documents'` guard ~:154 + non-empty `doc` ~:159; fragment reject ~:165. The lines 154-162 block is the **dispatch replacement site** for Phase 3. Record actual line numbers in apply-progress.

- [x] 1.3 **(A3 — owner-property-detail threading)** `rg -n "OWNER_DETAIL_TAB_VALUES|useQueryState|highlightDocId|engagements\.map" viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
      Expected: `tracking` in `OWNER_DETAIL_TAB_VALUES` at ~:24; `tab` synced via `useQueryState` at ~:29; `doc` read at ~:35 (the sibling `movement` read goes here in Phase 5); all engagements mapped at ~:139. Confirms D3/D4 insertion points.

- [ ] 1.4 **(A4 — engagement card pass-through)** `rg -n "OwnerTimeline|engagement\.id|engagementId=|property=" viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx`
      Expected: `<OwnerTimeline engagementId property />` at ~:59 — currently NO `highlightMovementId` prop. Confirms Phase 5 forward-prop insertion point.

- [ ] 1.5 **(A5 — timeline component baseline)** `rg -n "DEFAULT_TIMELINE_FILTERS|pageSize|space-y-3|<Card|movement\.id|OwnerTimelineItem" viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx`
      Expected: `DEFAULT_TIMELINE_FILTERS.pageSize = 10` at ~:21; div wrapper with `className='space-y-3'` at ~:60; `<Card>` root at ~:92; keyed by `movement.id` at ~:62. Confirm NO `containerRef`, NO `data-*`, NO `highlightedId` state, NO `useEffect` for scrolling. This is the net-new infra baseline.

- [ ] 1.6 **(A6 — pageSize uniqueness scope)** `rg -rn "DEFAULT_TIMELINE_FILTERS" viewpro-app/apps/app-new/src`
      Expected: ONLY `owner-timeline.tsx` appears. Confirms D7: the bump is scoped to this file only; no sibling component regresses.

- [ ] 1.7 **(A7 — movement id uniqueness premise)** `rg -n "id: string|propertyEngagementId" viewpro-app/apps/app-new/src/features/owner/api/types.ts`
      Expected: `OwnerMovement.id: string` and `OwnerMovement.propertyEngagementId: string` at ~:70-72. If `id` is NOT unique-keyed globally (e.g. is actually a per-engagement sequence), stop and re-evaluate D4 before Phase 5.

- [ ] 1.8 **(A8 — CRITICAL file existence)** `rg -n "sanitizeOwnerNotificationLink|scrollIntoView|data-movement-id" viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`
      Expected: `notification-link.helper.spec.ts` EXISTS (created in 24.6a) with existing owner sanitizer test cases — Phase 2 EXTENDS this file. `owner-timeline.test.tsx` may or may not exist — record the finding. If the spec file is absent, STOP (24.6a prerequisite missing). If the test file is absent, Phase 5 CREATES it.

- [ ] 1.9 **(A6 cont. — API pageSize cap)** Inspect the timeline query handler or API route for `GET /owner/properties/:id/timeline` (or equivalent) for any `pageSize` cap. Expected: no hard cap below 25, or a cap ≥ 25. If a hard cap of 10 or 20 exists, STOP — spec assumption A6 fails and the pageSize bump needs a backend change.

---

## Phase 2 — Sanitizer unit tests (FAILING first — SECURITY-CRITICAL)

Depends on: Phase 1 complete, no blockers.
**Tests MUST be written and verified RED before Phase 3 touches `notification-link.helper.ts`.**

File: `viewpro-app/apps/api/src/notifications/notification-link.helper.spec.ts`
Action: EXTEND the existing `describe('sanitizeOwnerNotificationLink', ...)` block (or add a clearly labeled sub-describe for 24.6c). Do NOT create a new file. Do NOT modify any existing 24.6a or 24.6b test.

### 2a — ACCEPT cases (S-S1..S-S4) — must be RED until Phase 3 dispatch is in place

- [ ] 2.1 **S-S1 (24.6a regression — ACCEPT)** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?tab=documents&doc=req-123")` → `"/owner/properties/asset-abc?tab=documents&doc=req-123"`. (FR-S4. This is the mandatory 24.6a regression guard — it MUST still ACCEPT after the dispatch rewrite.)

- [ ] 2.2 **S-S2 (24.6a UUID format — ACCEPT)** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?tab=documents&doc=550e8400-e29b-41d4-a716-446655440000")` → returns the full link including UUID doc value. (FR-S4 format guard.)

- [ ] 2.3 **S-S3 (new 24.6c tracking path — ACCEPT)** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?tab=tracking&movement=mov-123")` → `"/owner/properties/asset-abc?tab=tracking&movement=mov-123"`. (FR-S5. PRIMARY new acceptance case.)

- [ ] 2.4 **S-S4 (24.6c UUID movement — ACCEPT)** `sanitizeOwnerNotificationLink("/owner/properties/asset-abc?tab=tracking&movement=550e8400-e29b-41d4-a716-446655440000")` → returns the full link including UUID movement value. (FR-S5. Real-world id format.)

### 2b — REJECT: per-tab missing secondary (S-S5..S-S6)

- [ ] 2.5 **S-S5** `"/owner/properties/asset-abc?tab=documents"` → `null`. (FR-S2, FR-S3. `tab=documents` without `doc` is rejected — the secondary is mandatory.)

- [ ] 2.6 **S-S6** `"/owner/properties/asset-abc?tab=tracking"` → `null`. (FR-S2, FR-S3. `tab=tracking` without `movement` is rejected — the secondary is mandatory.)

### 2c — REJECT: empty secondary value (S-S7..S-S8)

- [ ] 2.7 **S-S7** `"/owner/properties/asset-abc?tab=documents&doc="` → `null`. (FR-S6. Empty `doc` value is not a valid deep-link anchor.)

- [ ] 2.8 **S-S8** `"/owner/properties/asset-abc?tab=tracking&movement="` → `null`. (FR-S6. Empty `movement` value is rejected.)

### 2d — REJECT: cross-tab contamination (S-S9..S-S10)

- [ ] 2.9 **S-S9** `"/owner/properties/asset-abc?tab=documents&movement=mov-123"` (no `doc`) → `null`. (FR-S2, FR-S3. `movement` is not a valid secondary for the documents tab.)

- [ ] 2.10 **S-S10** `"/owner/properties/asset-abc?tab=tracking&doc=req-123"` (no `movement`) → `null`. (FR-S2, FR-S3. `doc` is not a valid secondary for the tracking tab.)

### 2e — REJECT: both secondary params present (S-S11..S-S12)

- [ ] 2.11 **S-S11** `"/owner/properties/asset-abc?tab=documents&doc=req-123&movement=mov-456"` → `null`. (FR-S1, FR-S3. Both secondaries simultaneously is always rejected — cross-tab ambiguity. Also validates the `movement !== null` guard inside the documents branch.)

- [ ] 2.12 **S-S12** `"/owner/properties/asset-abc?tab=tracking&movement=mov-123&doc=req-456"` → `null`. (FR-S1, FR-S3. Both secondaries rejected regardless of which tab.)

### 2f — REJECT: secondary without paired tab (S-S13..S-S14)

- [ ] 2.13 **S-S13** `"/owner/properties/asset-abc?doc=req-123"` (no `tab`) → `null`. (FR-S8. `tab` is always required alongside the secondary param — `else → null` in the dispatch catches this.)

- [ ] 2.14 **S-S14** `"/owner/properties/asset-abc?movement=mov-123"` (no `tab`) → `null`. (FR-S8. `movement` alone without `tab` is rejected.)

### 2g — REJECT: unrecognized tab value (S-S15..S-S16)

- [ ] 2.15 **S-S15** `"/owner/properties/asset-abc?tab=summary"` → `null`. (FR-S7. Only `documents` and `tracking` are valid tab deep-link targets.)

- [ ] 2.16 **S-S16** `"/owner/properties/asset-abc?tab=info"` → `null`. (FR-S7. Unrecognized tab value.)

### 2h — REJECT: non-allowlisted param (S-S17..S-S18)

- [ ] 2.17 **S-S17** `"/owner/properties/asset-abc?tab=tracking&movement=mov-123&evil=x"` → `null`. (FR-S1. Unknown param — enumerated allowlist `{tab, doc, movement}` rejects the first unknown key.)

- [ ] 2.18 **S-S18** `"/owner/properties/asset-abc?tab=tracking&movement=mov-123&redirect=http://evil.com"` → `null`. (FR-S1. Open redirect attempt via unknown param.)

### 2i — REJECT: existing structural guards — unchanged (S-S19..S-S29)

- [ ] 2.19 **S-S19** `"//evil.example.com/owner/properties/asset-abc"` → `null`. (FR-S13. Protocol-relative — origin assertion fails.)

- [ ] 2.20 **S-S20** `"https://evil.example.com/owner/properties/asset-abc?tab=tracking&movement=mov-1"` → `null`. (FR-S13. Absolute URL bypass attempt.)

- [ ] 2.21 **S-S21** `"/owner/properties/../etc/passwd"` → `null`. (FR-S14. Path traversal — `URL()` normalizes `..` then pathname exact-match fails.)

- [ ] 2.22 **S-S22** `"/owner/properties/"` → `null`. (FR-S14. Trailing slash / empty `propertyAssetId` segment.)

- [ ] 2.23 **S-S23** `"/owner/properties"` → `null`. (FR-S14. No `propertyAssetId` segment — malformed path.)

- [ ] 2.24 **S-S24** `"/owner/properties/asset-abc?tab=tracking&movement=mov-1&movement=mov-2"` → `null`. (FR-S9. Duplicate `movement` param — HTTP parameter pollution guard. The per-key dup loop at :147-151 covers this after allowlist check.)

- [ ] 2.25 **S-S25** `"/owner/properties/asset-abc?tab=tracking&movement=mov-123#section"` → `null`. (FR-S15. Fragment causes rejection.)

- [ ] 2.26 **S-S26** `"/owner/properties/asset-abc#section"` → `null`. (FR-S15. Bare fragment on the properties path — fragment check must run even when no query params are present.)

- [ ] 2.27 **S-S27** `""` → `null`. (Empty string — `startsWith("/")` guard fires first.)

- [ ] 2.28 **S-S28** `null` → `null`, no thrown exception. `undefined` → `null`, no thrown exception. (FR: null/undefined guard — both sub-cases as separate `it` or via parameterized test.)

- [ ] 2.29 **S-S29** `"/dashboard/product/eng-abc?doc=req-123"` → `null`. (FR-S14. Cross-surface: internal path must not pass the owner sanitizer. Surface isolation guard.)

### 2j — Fast-path preservation (S-S30..S-S31)

- [ ] 2.30 **S-S30** `"/owner"` → `"/owner"`. (FR-S10. `/owner` fast-path runs BEFORE URL-parse branch — unchanged.)

- [ ] 2.31 **S-S31** `"/owner/properties/asset-abc"` (bare, no params) → `"/owner/properties/asset-abc"`. (FR-S11. Historical notifications regression guard — bare fast-path unchanged.)

### 2k — Red-confirm gate

- [ ] 2.32 Run `pnpm --filter @viewpro/api test notification-link` — confirm ALL new tests from tasks 2.1–2.31 are **RED** (expected failures, not import errors). The pre-existing 24.6a owner tests in the `describe` block MUST stay **GREEN** (do not break existing cases). Any import error means a scaffolding problem; fix before Phase 3.

---

## Phase 3 — Sanitizer implementation

Depends on: Phase 2 complete (all new tests red, pre-existing tests green, no import errors).

File: `viewpro-app/apps/api/src/notifications/notification-link.helper.ts`

- [ ] 3.1 Add `'movement'` to `ALLOWED_OWNER_QUERY_PARAM_NAMES` at ~:94.
      Before: `new Set(['tab', 'doc'])`
      After: `new Set(['tab', 'doc', 'movement'])`
      Do NOT rename the constant. Do NOT alias it to the internal sanitizer's allowlist.

- [ ] 3.2 Replace the single `tab === 'documents'` guard block (lines ~154-162) with the two-tab dispatch. The replacement is atomic — remove the old block completely and insert:
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
      ```
      The dispatch sits AFTER the unknown-key loop (:142-146), the dup loop (:147-151), and BEFORE the fragment reject (:165). All other guards remain exactly in place — no re-ordering.

- [ ] 3.3 Verify that the closing fallback `return null` after the URL-parse branch is still present and covers any uncovered exit path. No implicit `undefined` returns.

- [ ] 3.4 Run `pnpm --filter @viewpro/api test notification-link` — ALL 31 matrix tests from Phase 2 MUST be **GREEN**. All pre-existing 24.6a owner tests MUST stay **GREEN**. Any red is a bug; do not skip.

- [ ] 3.5 Run `pnpm --filter @viewpro/api typecheck` — zero TypeScript errors in the modified file.

---

## Phase 4 — Producer: `linkHref` template + unit tests

Depends on: Phase 3 green (sanitizer proven). Can proceed in parallel with Phase 5 frontend work once Phase 3 is done.

File: `viewpro-app/apps/api/src/notifications/notification-producer.service.ts`

- [ ] 4.1 Confirm `linkHref` at ~:144 and `input.movementId` in scope (per audit A1 output). No surprises → proceed.

- [ ] 4.2 Write failing tests FIRST: in the existing producer unit spec, add/update assertions that `notifyPropertyStatusChanged` produces a notification with `linkHref` equal to `/owner/properties/${propertyAssetId}?tab=tracking&movement=${movementId}`. Run — confirm **RED** (old template `/owner/properties/${propertyAssetId}` no longer matches).
      Also assert S-P3/S-P4: any other notification type's `linkHref` is NOT changed by this slice — those existing assertions must remain green.

- [ ] 4.3 Change the template string at ~:144 from:
      `linkHref: \`/owner/properties/${input.propertyAssetId}\``
      to:
      `linkHref: \`/owner/properties/${input.propertyAssetId}?tab=tracking&movement=${input.movementId}\``
      No conditional. `movementId` is always set on this lifecycle event (confirmed at audit A1). No extra params.

- [ ] 4.4 Confirm FR-P4 fan-out: `notifyPropertyStatusChanged` uses `Promise.all` over a `new Set` of recipient ids (all receiving the same `linkHref`). This is a read-only assertion — no code change needed; document the finding in apply-progress.

- [ ] 4.5 Confirm FR-P5: scan the producer for all other notification types (`DOCUMENT_UPLOADED`, `MOVEMENT_CREATED`, any others). Their `linkHref` templates are unmodified. A `git diff` check on unrelated sections is sufficient.

- [ ] 4.6 Run producer unit tests — all **GREEN**. Use the vitest filter for the producer service spec.

- [ ] 4.7 Run `pnpm --filter @viewpro/api typecheck` — zero errors in the modified file.

---

## Phase 5 — Frontend: movement param, engagement threading, and timeline scroll/highlight

Depends on: Phase 1 audit (A3–A8 findings recorded). Phase 3 sanitizer shape must be understood before writing the e2e (Phase 6), but frontend unit tests can start as soon as audit is done.

Files:
- `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` (extend or create)

### 5a — Tests first (FAILING before any implementation)

- [ ] 5.1 **(A8 resolution)** Determine if `owner-timeline.test.tsx` exists from audit 1.8. If absent, create the file with the standard vitest + testing-library scaffold, import the `OwnerTimeline` component, mock `Element.prototype.scrollIntoView = vi.fn()` in `beforeEach`/`afterEach`, and use fake timers (`vi.useFakeTimers()`) for highlight-clear assertions. If the file exists, note its existing mock structure before modifying.

- [ ] 5.2 **Mock setup** Mock `nuqs` `useQueryState` so that `useQueryState('movement', ...)` can be set per-test (to a string or null). Also mock `useOwnerTimeline` (or the query hook the component uses) to return controlled `isSuccess`/`data` states. Record the mock shape from the existing file (or establish one if creating from scratch).

- [ ] 5.3 Write the following failing tests BEFORE implementing anything:

      **(S-F6 — data-movement-id attribute present)** Render `<OwnerTimeline>` with a resolved query returning N movements; assert each timeline item's root element carries `data-movement-id={movement.id}`. Run — confirm **RED** (attribute not yet added).

      **(S-F1 — hit: scrollIntoView + ring applied then cleared)** `highlightMovementId = "mov-123"`, query resolves with `items` including `{id: "mov-123"}`. Assert `scrollIntoView` called once on the element with `data-movement-id="mov-123"`. Assert the `ring-2 ring-primary` class (or equivalent) is present on that element. Advance fake timers past 2000 ms; assert highlight is cleared (no ring class). Run — **RED**.

      **(S-F2 — miss: section scrollIntoView fires, no ring)** `highlightMovementId = "mov-old"`, query resolves with items NOT containing that id. Assert `containerRef.current.scrollIntoView` (or the section scroll) WAS called. Assert NO `ring-2 ring-primary` class on any element. Run — **RED**.

      **(S-F3 — absent id: no-op, no throw)** `highlightMovementId = null`. Assert `scrollIntoView` NOT called. Assert no thrown error. Run — **RED** (or GREEN if graceful — record which).

      **(S-F4 — query still loading: no scroll on mount, fires on resolve)** `highlightMovementId = "mov-123"`, query is in loading state on first render. Assert `scrollIntoView` NOT called. Simulate query resolving to items containing `"mov-123"`. Assert `scrollIntoView` IS called. Run — **RED**.

      **(S-F7 — two-engagement isolation — D4 PROOF)** Render a page with TWO `OwnerEngagementCard` instances — engagement A (owns `movement.id = "mov-A-123"`) and engagement B. Page loads with `movement = "mov-A-123"`. Assert: only engagement A's `OwnerTimeline` calls `scrollIntoView` and applies the ring. Assert engagement B's timeline is inert (no scroll, no ring, no error). Run — **RED**. This is the R3 correctness proof.

      **(S-F8 — pageSize = 25)** Mount `OwnerTimeline`. Assert that the timeline query is called with `pageSize: 25`. Run — **RED** (still 10).

- [ ] 5.4 Run ALL new FE tests — confirm they are **RED** (not import errors). Fix scaffolding issues before Phase 5b.

### 5b — Implementation

- [ ] 5.5 **(D3 — movement read in owner-property-detail.tsx)** Add `const [highlightMovementId] = useQueryState('movement', parseAsString)` immediately after the existing `doc` read at ~:35. Read-only — never written from this component. Import `parseAsString` from `nuqs` if not already imported.

- [ ] 5.6 **(D4 — thread highlightMovementId to EVERY engagement card)** In the `engagements.map(...)` call at ~:139, pass `highlightMovementId={highlightMovementId}` to each `<OwnerEngagementCard>`. Every card receives the same value; the uniqueness of `movement.id` ensures only one timeline's items match. This is the correct design choice per D4.

- [ ] 5.7 **(D4 — engagement card forward-prop)** In `owner-engagement-card.tsx`, add `highlightMovementId: string | null` as an optional prop (default `null`) and forward it to `<OwnerTimeline highlightMovementId={highlightMovementId} />` at ~:59. No logic — pure pass-through.

- [ ] 5.8 **(D5 — timeline prop + hook declarations)** In `owner-timeline.tsx`, add `highlightMovementId: string | null` to the component props interface (default `null`). Declare ALL hooks at the TOP of the component, BEFORE the loading/error/empty early returns:
      - `const [highlightedId, setHighlightedId] = useState<string | null>(null)`
      - `const containerRef = useRef<HTMLDivElement>(null)` — `HTMLDivElement` because the wrapper is `<div className='space-y-3'>` (:60)
      - `const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
      This placement is load-bearing: hooks must run unconditionally; the effect no-ops while `isSuccess` is false.

- [ ] 5.9 **(D5 — cleanup effect)** Add a `useEffect` keyed `[]` that clears `highlightTimerRef.current` on unmount (avoids setState-after-unmount):
      ```ts
      useEffect(() => {
        return () => {
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        };
      }, []);
      ```

- [ ] 5.10 **(D5 + D6 — scroll/highlight + section fallback effect)** Add a `useEffect` keyed `[highlightMovementId, timelineQuery.isSuccess, timelineQuery.data]`:
      1. No-op if `!highlightMovementId` or `!timelineQuery.isSuccess`.
      2. `const itemExists = movements.some(m => m.id === highlightMovementId)`.
      3. If `itemExists`:
         - `const el = containerRef.current?.querySelector(\`[data-movement-id="${CSS.escape(highlightMovementId)}"]\`)`;
         - `el?.scrollIntoView({ behavior: 'smooth', block: 'start' })`;
         - `setHighlightedId(highlightMovementId)`;
         - Clear any existing timer; set `highlightTimerRef.current = setTimeout(() => { setHighlightedId(null); highlightTimerRef.current = null; }, 2000)`.
      4. If `!itemExists` (D6 section fallback):
         - `containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`;
         - NO `setHighlightedId` call (no ring), NO timer.
         - This is NOT a silent no-op.

- [ ] 5.11 **(D5 — containerRef attachment)** Attach `ref={containerRef}` to the `<div className='space-y-3'>` wrapper at ~:60. This is the `HTMLDivElement` the queries are scoped to.

- [ ] 5.12 **(D5 — data-movement-id on each item)** Add `data-movement-id={movement.id}` to the `<Card>` root at ~:92 for each `OwnerTimelineItem`. Thread `isHighlighted={highlightedId === movement.id}` from `OwnerTimeline` into each item. Apply `cn(isHighlighted && 'ring-2 ring-primary')` conditionally on the `<Card>` root (import `cn` from `@/lib/utils` if not already imported).

- [ ] 5.13 **(D7 — pageSize bump)** Change `DEFAULT_TIMELINE_FILTERS.pageSize` from `10` to `25` at ~:21. Scoped to this file only (confirmed by audit A6).

- [ ] 5.14 Run `pnpm --filter next-shadcn-dashboard-starter test owner-timeline` (or the correct vitest filter). ALL 7 new tests from task 5.3 MUST be **GREEN**. Any red is a bug, not a TDD skip.

- [ ] 5.15 Run `pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in all three modified files.

---

## Phase 6 — E2E extension: owner notifications spec

Depends on: Phase 3 (sanitizer green) and Phase 4 (producer green). Covers the full backend round-trip.

File: `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` (confirm path from audit A8 output; if a different file name was found, use that).

- [ ] 6.1 **(Baseline check)** Before adding new tests: `rg -n "linkHref|\/owner\/properties|tab=tracking|movement=" viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` — record all existing `linkHref` assertions. Confirm no existing test hardcodes the old `PROPERTY_STATUS_CHANGED` bare-path shape for a seeded record that the producer now modifies. If found, note it for 6.2.

- [ ] 6.2 **(S-P1/S-P2 round-trip)** Add `it('PROPERTY_STATUS_CHANGED notification stores and returns deep-link linkHref')`: seed an asset, a `PropertyMovement`, and an owner user; trigger or seed a notification with `type = PROPERTY_STATUS_CHANGED` and `linkHref = "/owner/properties/${assetId}?tab=tracking&movement=${movementId}"`. Fetch the owner notifications endpoint. Assert the item's `linkHref` equals `/owner/properties/${assetId}?tab=tracking&movement=${movementId}` verbatim. (FR-P1, FR-P2, FR-S5.)

- [ ] 6.3 **(S-R1 regression — bare path)** Add or confirm `it('historical param-less PROPERTY_STATUS_CHANGED linkHref still passes through')`: seed a notification with `linkHref = "/owner/properties/${assetId}"` (no params, historical). Fetch → `linkHref` in response equals `/owner/properties/${assetId}`. (FR-S11, FR-R1.)

- [ ] 6.4 **(S-R2 regression — /owner fast-path)** Add or confirm `it('/owner linkHref fast-path passes unchanged')`: seed a notification with `linkHref = "/owner"`. Fetch → `linkHref` equals `"/owner"`. (FR-S10, FR-R2.)

- [ ] 6.5 **(S-R3 — 24.6a documents path regression)** Add or confirm `it('24.6a tab=documents+doc linkHref still accepted')`: seed a notification with `linkHref = "/owner/properties/${assetId}?tab=documents&doc=${docId}"`. Fetch → returns the link verbatim. (FR-S4, FR-R3.)

- [ ] 6.6 **(FR-R4 cross-surface check)** Confirm that any existing test in `notifications.e2e-spec.ts` checking a cross-surface or internal link → null is still present and unchanged. Do NOT modify it.

- [ ] 6.7 Run `pnpm --filter @viewpro/api test owner-notifications` (or the correct e2e filter) — all pre-existing cases plus new Phase 6 cases **GREEN**.

---

## Phase 7 — Regression: seeded linkHref format reconciliation (CONDITIONAL)

Execute ONLY if Phase 6.1 or manual inspection reveals that `owner-notifications.e2e-spec.ts` or `demo-smoke.spec.ts` have assertions checking the bare `PROPERTY_STATUS_CHANGED` `linkHref` shape for seeded records (pre-24.6c format).

- [ ] 7.1 `rg -n "PROPERTY_STATUS_CHANGED|linkHref.*owner.*properties|tab=tracking|movement=" viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — list ALL linkHref assertions in both files.

- [ ] 7.2 Determine seed state: `rg -n "PROPERTY_STATUS_CHANGED|linkHref.*owner.*properties" viewpro-app/scripts/seed-demo.mjs` — does the seed hardcode the old bare format or call the producer?
      - **Seed hardcodes old format**: seeded records carry `/owner/properties/{id}` (no params). Assertions on those records MUST assert the OLD format. No test update needed.
      - **Seed calls the producer**: seeded records carry the new deep-link format. Test assertions must be updated to match. `seed-demo.mjs` itself MUST NOT change (FR-R5 seed contract).

- [ ] 7.3 Based on 7.2: update ONLY the affected test assertion strings where confirmed necessary. Do NOT change production code, the seed script, or unrelated assertions.

- [ ] 7.4 Re-run all affected suites — all **GREEN**.

---

## Phase 8 — Verification gates

Depends on: Phases 2–6 complete (and Phase 7 if triggered). ALL gates MUST be GREEN before tagging done.

- [ ] 8.1 `pnpm --filter @viewpro/api test` — all API vitest suites green.
      - `notification-link.helper.spec.ts` — all 31 new matrix rows (phases 2–3): green. Pre-existing 24.6a owner describe block: unchanged and green. 24.6b internal describe block: unchanged and green.
      - `notification-producer.service.spec.ts` — `notifyPropertyStatusChanged` `linkHref` shape tests (S-P1/P2/P3): green.
      - `owner-notifications.e2e-spec.ts` — all pre-existing cases + new Phase 6 tests: green.
      - `notifications.e2e-spec.ts` — all pre-existing 24.6b cases: UNCHANGED, all green. (FR-R4.)

- [ ] 8.2 `pnpm --filter next-shadcn-dashboard-starter test` — all FE vitest suites green.
      - `owner-timeline.test.tsx` — 7 new tests (phase 5): green.
      - `owner-document-requests.test.tsx` — pre-existing 24.6b tests: UNCHANGED, all green. (FR-R3.)

- [ ] 8.3 `pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck` — zero TypeScript errors in both packages.

- [ ] 8.4 `pnpm oxlint` (or equivalent lint command) — zero new lint errors.

- [ ] 8.5 **(manual / CI — note only)** `pnpm --filter next-shadcn-dashboard-starter test:seeded` — requires a running seeded Playwright environment. Cannot be verified in the automated gate. Confirm T07, T08, T17, T18a, T19b pass unchanged. (FR-R5.) Flag as pending if server is unavailable.

- [ ] 8.6 Confirm `seed-demo.mjs` is UNCHANGED: `git diff viewpro-app/scripts/seed-demo.mjs` → empty or absent from diff.

- [ ] 8.7 Confirm `getSafeRelativeHref` / `notification-center.tsx` is UNCHANGED: `git diff viewpro-app/apps/app-new/src/features/notifications/components/notification-center.tsx` → empty. (FR-F13 — no guard change in scope.)

- [ ] 8.8 Confirm `sanitizeInternalNotificationLink` is UNCHANGED: `git diff` shows NO edits to the internal sanitizer block in `notification-link.helper.ts`. (FR-S16, FR-R4.) The internal `{doc}`-only allowlist and all 24.6b test coverage are untouched.

- [ ] 8.9 Confirm `owner-document-requests.tsx` is UNCHANGED: `git diff viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx` → empty. (FR-R3 — 24.6a scroll/highlight behavior is unaffected by this slice.)

- [ ] 8.10 Security boundary self-check: all 31 matrix rows (S-S1..S-S31) have a passing unit test. The unknown-key loop is an enumerated iteration that rejects on the first key not in `{tab, doc, movement}` — NOT an if/else chain. The dispatch is `tab`-keyed with exactly two arms; any other value or absent `tab` falls to `else → null`. Reviewer MUST verify the closed-set posture. `movement` is now in the allowlist; no other key was added.

- [ ] 8.11 Request fresh-context review on the diff (security boundary per design D2/D9 delivery flag) before opening PR.

---

## Acceptance checklist — spec scenarios

| Scenario | Phase | Task(s) | Status |
|----------|-------|---------|--------|
| S-P1 — PROPERTY_STATUS_CHANGED stores exact deep-link linkHref | 4 | 4.2, 4.3 | — |
| S-P2 — Deep-link has exact shape (no trailing slash, tab before movement) | 4 | 4.2, 4.3 | — |
| S-P3 — All fanned-out recipients receive same linkHref | 4 | 4.4 | — |
| S-P4 — Other notification types retain their current linkHref | 4 | 4.5 | — |
| S-S1 — tab=documents+doc ACCEPT (24.6a regression) | 2 + 3 | 2.1, 3.2 | — |
| S-S2 — tab=documents+UUID doc ACCEPT | 2 + 3 | 2.2, 3.2 | — |
| S-S3 — tab=tracking+movement ACCEPT (24.6c primary) | 2 + 3 | 2.3, 3.2 | — |
| S-S4 — tab=tracking+UUID movement ACCEPT | 2 + 3 | 2.4, 3.2 | — |
| S-S5 — tab=documents alone → null | 2 + 3 | 2.5, 3.2 | — |
| S-S6 — tab=tracking alone → null | 2 + 3 | 2.6, 3.2 | — |
| S-S7 — tab=documents+empty doc → null | 2 + 3 | 2.7, 3.2 | — |
| S-S8 — tab=tracking+empty movement → null | 2 + 3 | 2.8, 3.2 | — |
| S-S9 — tab=documents+movement (no doc) → null | 2 + 3 | 2.9, 3.2 | — |
| S-S10 — tab=tracking+doc (no movement) → null | 2 + 3 | 2.10, 3.2 | — |
| S-S11 — tab=documents+doc+movement → null | 2 + 3 | 2.11, 3.2 | — |
| S-S12 — tab=tracking+movement+doc → null | 2 + 3 | 2.12, 3.2 | — |
| S-S13 — doc only no tab → null | 2 + 3 | 2.13, 3.2 | — |
| S-S14 — movement only no tab → null | 2 + 3 | 2.14, 3.2 | — |
| S-S15 — tab=summary → null | 2 + 3 | 2.15, 3.2 | — |
| S-S16 — tab=info → null | 2 + 3 | 2.16, 3.2 | — |
| S-S17 — unknown param (evil=x) → null | 2 + 3 | 2.17, 3.1, 3.2 | — |
| S-S18 — open redirect param → null | 2 + 3 | 2.18, 3.1, 3.2 | — |
| S-S19 — protocol-relative → null | 2 + 3 | 2.19, 3.2 | — |
| S-S20 — absolute URL → null | 2 + 3 | 2.20, 3.2 | — |
| S-S21 — path traversal → null | 2 + 3 | 2.21, 3.2 | — |
| S-S22 — trailing slash empty segment → null | 2 + 3 | 2.22, 3.2 | — |
| S-S23 — bare /owner/properties → null | 2 + 3 | 2.23, 3.2 | — |
| S-S24 — duplicate movement param → null | 2 + 3 | 2.24, 3.2 | — |
| S-S25 — fragment + query → null | 2 + 3 | 2.25, 3.2 | — |
| S-S26 — bare fragment → null | 2 + 3 | 2.26, 3.2 | — |
| S-S27 — empty string → null | 2 + 3 | 2.27, 3.2 | — |
| S-S28 — null/undefined → null no throw | 2 + 3 | 2.28, 3.2 | — |
| S-S29 — cross-surface internal path → null | 2 + 3 | 2.29, 3.2 | — |
| S-S30 — /owner fast-path preserved | 2 + 3 | 2.30, 3.2 | — |
| S-S31 — bare /owner/properties/{id} fast-path preserved | 2 + 3 | 2.31, 3.2 | — |
| S-F1 — scroll+highlight fires on matching movement (hit path) | 5 | 5.3, 5.10–5.12 | — |
| S-F2 — section scrolls when movement not in loaded items (miss/fallback) | 5 | 5.3, 5.10 | — |
| S-F3 — highlightMovementId null → no-op | 5 | 5.3, 5.10 | — |
| S-F4 — target not found → degrades gracefully, section fallback, no throw | 5 | 5.3, 5.10 | — |
| S-F5 — scroll fires after query resolves, not on mount (loading guard) | 5 | 5.3, 5.10 | — |
| S-F6 — data-movement-id on every rendered timeline item | 5 | 5.3, 5.12 | — |
| S-F7 — two engagements: only targeted timeline highlights (R3 proof) | 5 | 5.3, 5.6–5.7 | — |
| S-F8 — pageSize = 25 in timeline query | 5 | 5.3, 5.13 | — |
| S-F9 — getSafeRelativeHref round-trips tracking+movement params intact | 8 | 8.7 (no-op confirm) | — |
| S-R1 — Historical bare linkHref accepted, no scroll/highlight | 3 + 6 | 3.2, 6.3 | — |
| S-R2 — /owner fast-path unaffected | 3 + 6 | 3.2, 6.4 | — |
| S-R3 — 24.6a tab=documents+doc accepted unchanged | 3 + 6 | 2.1, 3.2, 6.5 | — |
| S-R4 — sanitizeInternalNotificationLink unaffected (24.6b) | 8 | 8.8 (no-op confirm) | — |
| S-R5 — owner-notifications.e2e-spec.ts baseline green | 6 + 8 | 6.7, 8.1 | — |
| S-R6 — seeded smoke T07/T08/T17/T18a/T19b green | 8 | 8.5 | pending (requires seeded server) |
