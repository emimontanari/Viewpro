# Verification Report — Stage 24.6b Notification Deep-Linking: Internal Document-Uploaded Notifications

## Change
`24-6b-notification-deeplink-internal-documents` — deep-link the internal `DOCUMENT_UPLOADED`
notification to the exact document request on the internal product page
`/dashboard/product/{propertyEngagementId}?doc={documentRequestId}`.

## Mode
Artifact store: **hybrid** (openspec file + engram). Strict TDD active (RED→GREEN→REFACTOR,
evidence in apply-progress). Full artifact set present (spec, design, tasks, apply-progress) →
all dimensions verified: completeness, correctness, design coherence.

## Final Verdict: **PASS**

Executive summary: **0 CRITICAL, 1 WARNING, 2 SUGGESTION.** Every spec FR maps to a passing
runtime assertion. The internal sanitizer security boundary (closed `{doc}`-only allowlist) is
correct and proven against 22 rejection/acceptance scenarios incl. the JD Round-1 hardening
(S-S26 tampered-engId, S-S27/S-S28 backslash-host, S-S29 percent-encoded key). The JD Round-2
remediation is confirmed in source: Effect B deps exclude `documentFilter`, `setHighlightedId`
is behind `if (!element) return`, and a test pins scroll does not re-fire on a later filter
toggle. All scope/regression invariants hold (owner sanitizer byte-identical, `getSafeRelativeHref`
and `seed-demo.mjs` untouched, no DB schema change).

---

## Completeness — task checklist

| Phase | Tasks | State |
|-------|-------|-------|
| 1 — Pre-impl audit (1.1–1.10) | 10 | All checked; audit findings recorded in apply-progress |
| 2 — Sanitizer tests RED (2.1–2.26) | 26 | All checked |
| 3 — Sanitizer impl (3.1–3.5) | 5 | All checked |
| 4 — Producer (4.1–4.6) | 6 | All checked |
| 5 — Frontend (5.1–5.13) | 13 | All checked |
| 6 — E2E extension (6.1–6.6) | 6 | All checked |
| 7 — Conditional regression (7.1–7.4) | 4 | All checked (NOT triggered — no seeded linkHref assertions) |
| 8 — Verification gates (8.1–8.10) | 10 | All checked |

No unchecked implementation tasks. Acceptance checklist (spec scenarios) maps every S-* scenario
to a phase/task; only S-R6 (seeded smoke) is marked `pending (requires seeded server)` — confirmed
green this session via the launch context (full `pnpm test:seeded` 32/32 exit 0, no re-run needed).

---

## Build / Tests / Lint evidence (verbatim, this session)

### API sanitizer + producer unit specs
`cd viewpro-app/apps/api && pnpm vitest run src/notifications/notification-link.helper.spec.ts test/notification-producer.service.spec.ts`
```
 Test Files  2 passed (2)
      Tests  59 passed (59)
   Duration  512ms
```
(`notification-link.helper.spec.ts` = 51 incl. internal S-S1..S-S29 + owner block; `notification-producer.service.spec.ts` = 8.)
The `[Nest] WARN ... notifications unavailable` lines are the producer catch-path log assertions firing in mocked tests — expected, not failures.

### API internal notifications e2e (DB available this session)
`cd viewpro-app/apps/api && pnpm vitest run test/notifications.e2e-spec.ts`
```
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  2.99s
```
DB WAS available — the e2e suite ran fully green (S-P1/S-P2 round-trip, S-R1 param-less, S-R2 SAFE_INTERNAL_LINKS + 6 pre-existing). The Nest `LOG ... Mapped route` lines are bootstrap output.

### Frontend property-document-requests spec
`cd viewpro-app/apps/app-new && pnpm vitest run src/features/products/components/property-document-requests.test.tsx`
```
 Test Files  1 passed (1)
      Tests  24 passed (24)
   Duration  3.90s
```
(16 pre-existing + 8 new deep-link cases incl. JD Round-1 `D7 (e)` which is also the Round-2 regression pin.)

### Lint (oxlint on all 7 changed files)
`./viewpro-app/apps/app-new/node_modules/.bin/oxlint <7 files>` → `OXLINT_EXIT=0` (no output, zero findings).

### Seeded Playwright
Per launch context: full `pnpm test:seeded` → 32/32 exit 0 confirmed THIS session (no regression from the new internal producer linkHref). Not re-run (network/server gated); stated as confirmed.

---

## Spec compliance matrix (FR → evidence)

### Group P — Producer
- **FR-P1/P2/P3** — `notification-producer.service.ts:112` emits exactly
  `/dashboard/product/${input.propertyEngagementId}?doc=${input.documentRequestId}`; signature unchanged; `documentRequestId` already persisted (:115). Proven by `notification-producer.service.spec.ts` S-P1/S-P2 (asserts `/dashboard/product/engagement-1?doc=request-1`). **PASS**
- **FR-P4** — Owner producer assertions (spec lines 19/40/51/127/138) unchanged; only `DOCUMENT_UPLOADED` template touched. **PASS**

### Group S — Sanitizer (SECURITY-CRITICAL)
- **FR-S1..S11** — `notification-link.helper.ts:13-92`. Order is load-bearing and correct: (1) leading-slash guard, (2) `SAFE_INTERNAL_LINKS.has` fast-path, (3) engagement guard, (4) param-less product fast-path, (5) URL-parse branch (origin assert → trusted-column pathname exact match → closed `{doc}` NAME allowlist iterate-and-reject-first-unknown → dup-doc reject → non-empty doc → fragment reject → canonical `${pathname}${search}` return). Proven by S-S1..S-S25 + S-S26..S-S29. **PASS**
- **FR-S5 (`{doc}`-only, NO `tab`)** — `ALLOWED_INTERNAL_QUERY_PARAM_NAMES = new Set(["doc"])` (:11). `tab` absent; S-S9/S-S10 assert `?tab=...` → null. **PASS**
- **FR-S12 / FR-R3 (owner sanitizer untouched)** — `git diff b23d8f1` (24.6a commit): the ONLY removed line in `helper.ts` is the single old `return null;` that moved; `sanitizeOwnerNotificationLink` + `ALLOWED_OWNER_QUERY_PARAM_NAMES` are byte-identical. **PASS**
- **JD Round-1 hardening** — S-S26 (tampered engId path eng-OTHER vs trusted eng-abc → null), S-S27/S-S28 (backslash-host open redirect `/\evil.com` → origin `https://evil.com` → step-5b origin assert → null), S-S29 (percent-encoded key `%64oc` decodes to `doc`, accepted, canonical return preserves encoded form) — all present and passing. Independently re-derived via `node:url`: backslash-host yields `origin: https://evil.com` (correctly rejected); `%64oc` yields decoded key `doc` (allowlist operates on decoded names — no name-smuggling bypass). **PASS**

### Group F — Frontend
- **FR-F1** — `useQueryState('doc', parseAsString)` read-only sibling (:117). **PASS**
- **FR-F2/F3** — One-shot `useRef` guard (`didResetFilterRef`) effect keyed `[highlightDocId, setDocumentFilter]` calls `setDocumentFilter(null)` once (:198-204). Proven by S-F7 (called exactly once) and D7(e) (1 null call + later user 'pending' sticks). **PASS**
- **FR-F4** — Controlled `<Collapsible open={resolvedOpen} onOpenChange={onResolvedOpenChange}>` for resolved group (:571); `didOpenResolvedRef` one-shot open in Effect A (:223-229). R1 split-effect path used (documented deviation). Proven by S-F2. **PASS**
- **FR-F5** — `data-request-id={request.id}` on every `<li>` (:713). Proven by S-F1/S-F2 querySelector. **PASS**
- **FR-F6** — `containerRef` attached to `data-testid='document-request-results'` outer `<div>` (:360-364). **PASS**
- **FR-F7** — `scrollIntoView({ behavior: 'smooth', block: 'start' })` (:259) + `ring-2 ring-primary rounded-xl` (:714) + 2s transient timer (:262-269). Proven by S-F1. **PASS**
- **FR-F8** — Effects keyed on `documentRequestsQuery.isSuccess`/`.data`; no-op while loading. Proven by S-F8 (no scroll while loading, fires after resolve). **PASS**
- **FR-F9** — Absent doc (S-F3), not-found (S-F4), CANCELLED (S-F5) all no-op without throw. `groupDocumentRequests` (:951-957) has NO CANCELLED bucket — R5 no-op premise confirmed. **PASS**
- **FR-F10** — `notification-center.tsx` unchanged (git diff clean). **PASS**

### Group R — Regression invariants
- **FR-R1/R2** — Param-less + SAFE_INTERNAL_LINKS pass-through proven by sanitizer S-S1..S-S5 and e2e S-R1/S-R2. **PASS**
- **FR-R3** — Owner sanitizer byte-identical (above). **PASS**
- **FR-R4** — API e2e 9/9, FE 24/24, owner suite is part of the same passing helper spec; seed-demo.mjs git diff clean; seeded smoke 32/32 confirmed this session. **PASS**

---

## Design coherence

- **D1 (sanitizer order + closed allowlist)** — implemented exactly as designed; order preserved. **COHERENT**
- **D2 (producer one-line, no conditional)** — `:112` matches. **COHERENT**
- **D3 (sibling nuqs `doc` read)** — `:117` matches. **COHERENT**
- **D4 (controlled resolved Collapsible)** — implemented; R1 split-effect fallback used (Effect A opens, Effect B scrolls keyed on `resolvedOpen`). Documented deviation in apply-progress. The design.md "Radix note" was corrected this session (Presence/unmount semantics). **COHERENT**
- **D5 (one-shot `useRef` filter reset)** — `:198-204` matches. **COHERENT**
- **D6 (data-request-id + containerRef + querySelector)** — matches; containerRef typed `HTMLDivElement` (documented deviation, matches actual `<div>` anchor). **COHERENT**
- **D7 (testing strategy)** — nuqs mock keyed by param name, scrollIntoView mock, all cases present. **COHERENT**
- **D8 (single PR ~269 LOC)** — within 400-line budget; 7 files (2 prod + 5 test). **COHERENT**

---

## Issues

### CRITICAL
None.

### WARNING
- **W1 — apply-progress artifact is stale vs. shipped source on JD FIX 1.** The apply-progress
  doc (`## Judgment Day — Round 1`, FIX 1) states `documentFilter` was ADDED to Effect B's
  dependency array. The shipped source has the OPPOSITE: Effect B deps (`property-document-requests.tsx:270-275`)
  are `[highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data, resolvedOpen]`
  — `documentFilter` is absent. This reflects the JD Round-2 regression remediation (the
  documentFilter dep caused scroll to re-fire on filter toggle and was removed; the highlight is
  now guarded by `if (!element) return`). The SOURCE is correct and the Round-2 pin test passes
  (D7(e) lines 745-747 assert exactly one scroll after a later filter toggle). This is a
  documentation-vs-code drift in the apply-progress artifact only — no code defect. Recommend the
  apply-progress doc be amended (or noted in the archive) to record Round-2 superseding FIX 1.

### SUGGESTION
- **S1 — S-S29 percent-encoded-key acceptance is a deliberate but subtle contract.** Accepting
  `?%64oc=req-1` (decodes to `doc`) and returning the encoded form verbatim is correct and safe
  (the allowlist operates on URL-decoded names, so no param-name smuggling is possible), but it is
  a non-obvious behavior. Consider a one-line inline comment at the canonical return (:91) noting
  that the allowlist matches decoded keys and the encoded form is forwarded losslessly, for the
  next maintainer.
- **S2 — Producer null-`documentRequestId` degrade is implicit.** Design D2 notes that a future
  caller passing a nullish `documentRequestId` would emit `?doc=undefined`/`?doc=` and the
  sanitizer would reject it (link resolves to null, notification still delivered). This is an
  acceptable degrade and the current call path always supplies the id, but it is not asserted by a
  test. Low priority; out of current scope.

---

## Out-of-scope respected
- Sub-slice C (`PROPERTY_STATUS_CHANGED` movement/timeline), `STATUS_CHANGE_REQUESTED` manager
  bandeja, owner side (24.6a), `MOVEMENT_CREATED` (dead type) — none touched.
- No DB schema change / no migration (`linkHref` stored text, `documentRequestId` already persisted).
- `getSafeRelativeHref` (`notification-center.tsx`) and `seed-demo.mjs` — git diff clean.
- Slice touches exactly 7 files: 2 production (`notification-link.helper.ts`,
  `notification-producer.service.ts`, `property-document-requests.tsx`) + tests
  (`notification-link.helper.spec.ts`, `notification-producer.service.spec.ts`,
  `notifications.e2e-spec.ts`, `property-document-requests.test.tsx`).

## Recommendation
Proceed to **sdd-archive**. No CRITICAL issues block archive. Address W1 (amend apply-progress
to record the Round-2 remediation superseding FIX 1) during or before archive so the persisted
trail is internally consistent.
