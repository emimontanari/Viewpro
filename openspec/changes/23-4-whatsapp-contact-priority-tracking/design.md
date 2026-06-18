# Design — Stage 23.4 WhatsApp Contact Priority and Tracking Proof

## Status

Draft — 2026-06-18.

## Source artifacts

- Proposal: `openspec/changes/23-4-whatsapp-contact-priority-tracking/proposal.md`
- Spec: `openspec/changes/23-4-whatsapp-contact-priority-tracking/spec.md`

## Scope recap

Test-only slice that closes the WhatsApp contact-click evidence gaps surfaced by the Stage 26.0
MVP audit (slice B-5). It adds frontend negative guards on the disabled-button paths, a wa.me
URL builder null/undefined-phone guard, and one seeded smoke proving the movement-level click
tracking endpoint is exercised end-to-end. The backfill of historical `'movement_author'`
analytics events is intentionally NOT performed; the design captures the audit gate that must
re-confirm zero consumers before apply.

---

## Pre-flight discovery (CRITICAL — reshapes the slice)

The proposal and spec both claim "No backend use-case unit specs for either tracking endpoint"
(`proposal.md:42-43`, `spec.md:22-40`). That claim is **stale**.

Audit of `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` shows the following tests
are **already implemented inside the shared owner-portal use-cases spec**:

| Spec scenario                  | Existing test                                                   | File:line                              |
|--------------------------------|-----------------------------------------------------------------|----------------------------------------|
| FR-2 / S-4 property 204 + shape| `tracks owner WhatsApp contact clicks with safe analytics ...`  | `owner-portal.use-cases.spec.ts:389`   |
| FR-4 / S-5 property 404        | `rejects owner WhatsApp contact clicks for inaccessible ...`    | `owner-portal.use-cases.spec.ts:426`   |
| FR-5 / S-8 property swallow    | `keeps owner WhatsApp contact clicks successful when ...`       | `owner-portal.use-cases.spec.ts:445`   |
| FR-3 / S-6 movement 204 + shape| `tracks owner movement WhatsApp contact clicks with ...`        | `owner-portal.use-cases.spec.ts:466`   |
| FR-4 / S-7 movement 404        | `rejects owner movement WhatsApp contact clicks for ...`        | `owner-portal.use-cases.spec.ts:508`   |
| FR-5 / S-8 movement swallow    | `keeps owner movement WhatsApp contact clicks successful ...`   | `owner-portal.use-cases.spec.ts:528`   |
| S-9-style targetType assertion | `S-9: track-owner-movement-whatsapp-contact-click emits ...`    | `owner-portal.use-cases.spec.ts:894`   |

**Implication.** The two NEW use-case spec files the proposal asked for are unnecessary —
duplicating them would violate the project convention (one shared `owner-portal.use-cases.spec.ts`
covering all owner-portal use cases — see same file lines `12`, `156`, `197`, `296`) and
inflate the suite. The design therefore drops the "new use-case spec files" line item entirely
and replaces it with an **inline audit-only step** confirming these tests already enforce the
required behavior. The remaining real gaps (FE negative guards, wa.me null/undefined, movement
seeded smoke, backfill audit) are what this slice actually delivers.

---

## Decisions

### D1 — Use-case unit spec test runner

**Chosen.** Pure vitest + hand-rolled mocks (no Nest `TestingModule`).
**Rejected.** vitest + Nest `TestingModule`.
**Why.** `owner-portal.use-cases.spec.ts:1-11` constructs use cases directly with hand-rolled
repository mocks (`makeRepository(...)`) and an inline `analyticsService = { track: vi.fn() }`.
Every owner-portal use-case test in the file follows the same pattern (e.g. lines `400-403`,
`431-434`, `478-481`). The project convention is established; introducing `TestingModule` here
would deviate from 16+ existing tests for no benefit.
**Applies to.** Audit step only — the existing tests already follow this pattern.

### D2 — Swallow test mocking strategy

**Chosen.** Mock the injected `AnalyticsService.track` to reject; keep the repository mock
returning a real engagement/movement.
**Rejected.** Mocking the underlying `AnalyticsRepository` one layer deeper.
**Why.** The use cases inject `AnalyticsService` directly
(`track-owner-whatsapp-contact-click.use-case.ts:16-17` and
`track-owner-movement-whatsapp-contact-click.use-case.ts:16-17`). The `try/catch` wraps
`this.analyticsService.track(...)` at lines `27-39` and `27-40` respectively. Rejecting at the
service boundary exercises the exact same catch path with the simplest mock surface. The
existing tests at `owner-portal.use-cases.spec.ts:445-464` and `:528-552` already follow this
strategy — design confirms it as the standing convention.
**Applies to.** Audit verification only.

### D3 — FE negative guard spy strategy

**Chosen.** Spy on the imported service helper module
(`vi.spyOn(ownerService, 'trackOwnerWhatsappContactClick')` and
`vi.spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')`).
**Rejected.** Spying on the React Query mutation hook.
**Why.** Both components invoke the helper directly inside the early-return guarded callback:
`owner-home.tsx:266-272` calls `trackOwnerWhatsappContactClick(engagement.id)` only when
`engagement && contactHref` are both truthy; `owner-timeline.tsx:81-89` calls
`trackOwnerMovementWhatsappContactClick(...)` only when `contactHref` is truthy. There is no
React Query mutation in this path — the helper is a plain service function. The existing
positive tests at `owner-home.test.tsx:172-174` and `owner-timeline.test.tsx:80-82` already
spy on `ownerService.*` — the negative-guard tests must mirror that surface for consistency.
**Applies to.** Two new test cases — one extending `owner-home.test.tsx` at line `197` and one
extending `owner-timeline.test.tsx` at line `117`.

### D4 — Seeded smoke route interception pattern

**Chosen.** Mirror T19b at `demo-smoke.spec.ts:990-1018` verbatim — same intercept-before-click
sequencing, same `modifiers: ['Meta']` click modifier, same `waitForEvent('popup')` absorption,
same `waitForTimeout(500)` settle window, same `toBeGreaterThanOrEqual(1)` hit assertion.
**Rejected.** Using `page.evaluate(() => window.open = () => null)` to suppress the popup.
**Why.** T19b at `:990` proves the Meta-modifier pattern works on macOS CI and on local runs;
introducing a different popup-suppression strategy here would create two parallel patterns and
double the maintenance surface. The route pattern changes from
`**/api/owner/engagements/*/whatsapp-contact-click` (property) to
`**/api/owner/engagements/*/movements/*/whatsapp-contact-click` (movement); the rest of the
scaffolding is identical.
**Applies to.** One new test inside the Stage 23.5 describe block at
`demo-smoke.spec.ts:1438-1480`.

### D5 — Wa.me URL null/undefined guard placement

**Chosen.** Add two `it(...)` blocks to `owner-whatsapp-contact.test.ts` immediately after the
existing "returns null when property contact is unavailable or invalid" case at line `46`.
**Rejected.** A new spec file dedicated to edge cases.
**Why.** The file already enumerates wa.me URL edge cases (short phone, `'+54'` only) at lines
`46-69`. Adding `null` and `undefined` next to those keeps the negative-guard cluster together
and avoids splitting one helper's coverage across two files. Aligns with the existing convention
of one spec file per util module.
**Applies to.** Two new `it(...)` blocks in `owner-whatsapp-contact.test.ts`.

### D6 — Two use-case unit specs OR one shared spec?

**Chosen.** **Neither.** Drop the "two new spec files" line item. The required behaviors are
already covered inline in the shared `owner-portal.use-cases.spec.ts` (see Pre-flight discovery
table). Instead, the apply phase performs an **audit-only step**: re-read the seven existing
tests and confirm they enforce FR-2..FR-5 verbatim. Document the audit result in apply-progress.
**Rejected.** Creating two new spec files duplicating existing coverage.
**Rejected.** Creating one shared spec at a new path.
**Why.** The project convention (single shared spec per feature area — see
`owner-portal.use-cases.spec.ts:12` describe scope) is already met. Duplicating the tests would:
(a) violate the "preserve unchanged" baseline at `proposal.md:74-75` (no test-count regressions
allowed but ALSO no doubled assertions); (b) add maintenance burden when the use-case behavior
shifts; (c) provide zero new evidence. The proposal's stated gap is wrong.
**Applies to.** Slice scope reduction — backend test work is now an audit, not new files.

### D7 — Use case spec fixture shape

**Chosen.** N/A — no new fixtures because no new use-case specs are written (see D6).
**Audit reference.** The existing fixtures at `owner-portal.use-cases.spec.ts:390-403` (success),
`:427-434` (404), `:446-459` (swallow) define the shape the spec requires and the audit step
validates.

### D8 — Movement-level smoke placement

**Chosen.** Add as a SECOND `test(...)` inside the existing
`test.describe('Stage 23.5 — owner timeline resolves contact to assigned seller', ...)`
block at `demo-smoke.spec.ts:1438-1480`. The describe block already declares
`test.describe.configure({ mode: 'serial' })` at line `1439`, so the new test inherits the
signed-in `propietario.demo` state established by the S-10 test at lines `1441-1479`.
**Rejected.** A new top-level test next to T19b at line `990`.
**Why.** Serial-mode inheritance avoids a second `signIn(...)` round-trip and shares the
property navigation. Adding next to T19b would require its own sign-in (T19b at `:993` runs its
own `signIn(...)`), bloating wall-clock time without benefit. The proposal explicitly calls for
placement at `:1438` (proposal.md:57). The new test must NOT depend on the S-10 test
side-effecting page state — it should re-navigate to the property timeline from `/owner` if
needed, but inherits authentication.
**Applies to.** One new test inside the existing serial describe block.

### D9 — Backfill decision documentation

**Chosen.** No migration. Document the audit gate in apply-progress per `spec.md:FR-9`.
**Audit gate (must run immediately before apply).**
- `rg "movement_author" viewpro-app/apps/api/src/` → MUST return 0 hits.
- `rg "metadata.targetType|targetType.*movement_author" viewpro-app/apps/api/src/` → MUST
  return 0 hits.
- If either returns >0, STOP the apply and escalate to a follow-up slice.
**Why.** The investigation note at `proposal.md:46-47` documents zero consumers today. The
analytics event log is append-only and no use case branches on `metadata.targetType`. A
migration would carry data-modification risk without product value. The risk pattern (R4 in
proposal) is that a NEW consumer could land between proposal time and apply time; the audit
gate catches that.
**Applies to.** apply-progress section "Backfill audit results".

### D10 — Workload forecast

**Chosen.** Single-PR, no `size:exception`.
| Area                | New LOC          | Files touched                                      |
|---------------------|------------------|----------------------------------------------------|
| Backend use-case    | 0 (audit only)   | none (verify existing tests at `owner-portal.use-cases.spec.ts:389-552`) |
| FE component guards | ~30              | `owner-home.test.tsx`, `owner-timeline.test.tsx`   |
| Wa.me URL edges     | ~15              | `owner-whatsapp-contact.test.ts`                   |
| Seeded smoke        | ~40              | `demo-smoke.spec.ts` (inside existing describe)    |
| apply-progress doc  | ~15 (prose)      | OpenSpec folder only                               |
| **Total**           | **~100 LOC**     | 4 test files + 1 prose section                     |
**Why.** Removing the two new use-case spec files (D6) drops the workload from ~260 LOC to
~100 LOC. Single-PR is comfortable; chained PRs unnecessary; `size:exception` not required.

---

## Test architecture

```
                       owner-portal.use-cases.spec.ts (UNTOUCHED — already complete)
                        └── 6 existing tests at lines 389, 426, 445, 466, 508, 528 + S-9 at 894
                            └── Audit step in apply-progress confirms FR-2..FR-5 coverage.

owner-home.test.tsx                         owner-timeline.test.tsx
└── existing positive at :171               └── existing positive at :79
└── existing disabled-state at :197         └── existing disabled-state at :117
    └── EXTEND: spy on                          └── EXTEND: spy on
        ownerService.trackOwnerWhatsapp...          ownerService.trackOwnerMovementWhatsapp...
        click the disabled button,                   click the disabled button,
        assert spy.not.toHaveBeenCalled().            assert spy.not.toHaveBeenCalled().

owner-whatsapp-contact.test.ts
└── existing positive at :37
└── existing null-on-invalid at :46
    └── EXTEND (after :46): null-phone (whatsappPhone: null) returns null.
    └── EXTEND (after :46): undefined-phone (whatsappPhone: undefined) returns null.

demo-smoke.spec.ts
└── T19b at :990 (property-level tracking smoke — unchanged template)
└── Stage 23.5 describe at :1438 (serial mode)
    ├── existing S-10 (visible-link assertion) at :1441
    └── NEW (this slice): movement-level tracking smoke
            - inherits sign-in from S-10 (serial mode)
            - intercepts **/api/owner/engagements/*/movements/*/whatsapp-contact-click
            - clicks "Consultar responsable" with modifiers: ['Meta']
            - asserts trackingHits >= 1
```

---

## Mock surface table

| Test                               | Mocked                                       | Real                          | Asserts                                                  |
|------------------------------------|----------------------------------------------|-------------------------------|----------------------------------------------------------|
| Property negative guard            | `ownerService.trackOwnerWhatsappContactClick`| React render, user-event click| Spy `not.toHaveBeenCalled()` after click on disabled btn |
| Movement negative guard            | `ownerService.trackOwnerMovementWhatsappContactClick` | React render, user-event click| Spy `not.toHaveBeenCalled()` after click on disabled btn |
| Wa.me null phone                   | none                                         | `buildOwnerPropertyWhatsappHref` | Returns `null` (never a string)                          |
| Wa.me undefined phone              | none                                         | `buildOwnerPropertyWhatsappHref` | Returns `null` (never `'wa.me//?text=...'`)              |
| Movement smoke                     | Playwright route on movement endpoint        | Demo seed, real auth, real nav| `trackingHits >= 1`                                      |
| Backend audit (D6)                 | already covered — N/A                        | existing test file            | Audit log entry in apply-progress                        |

---

## Pre-implementation audit (R-D3)

The tasks phase MUST schedule and the apply phase MUST execute these commands BEFORE writing
new tests. Capture each output verbatim in apply-progress.

| Command                                                                                                | Expected result                            | Purpose                                                       |
|--------------------------------------------------------------------------------------------------------|--------------------------------------------|---------------------------------------------------------------|
| `rg "movement_author" viewpro-app/apps/api/src/`                                                       | 0 matches                                  | Confirms backfill punt (FR-9, R4)                              |
| `rg "metadata.targetType" viewpro-app/apps/api/src/`                                                   | 0 matches outside the two use-case files   | Confirms no consumer branches on `targetType`                 |
| `rg "trackOwnerWhatsappContactClick\|trackOwnerMovementWhatsappContactClick" viewpro-app/apps/app-new/src/` | Exactly the two service+two component sites| Confirms spy strategy (D3) targets all callers                |
| `rg "handleContactClick" viewpro-app/apps/app-new/src/features/owner/`                                 | `owner-home.tsx:266`, `owner-timeline.tsx:81` | Confirms early-return location for negative-guard tests       |
| `rg "TrackOwnerWhatsappContactClickUseCase\|TrackOwnerMovementWhatsappContactClickUseCase" viewpro-app/apps/api/test/` | 6+ matches in `owner-portal.use-cases.spec.ts` | Confirms D6 audit — existing coverage IS in place             |

If any audit command returns an unexpected result the apply phase MUST stop and escalate.

---

## Risks

**R1 — Movement-level seeded smoke route interception flakiness.** If the click handler fires
before the `page.route(...)` handler is registered, the interception will miss. Mitigation:
mirror T19b at `demo-smoke.spec.ts:990` exactly — register the route BEFORE the click, use
`waitForEvent('popup')` to absorb the new-tab open, settle with `waitForTimeout(500)` before
asserting. Confirm the route glob is
`**/api/owner/engagements/*/movements/*/whatsapp-contact-click` (note the `/movements/*/`
segment — easy to omit).

**R2 — Backend swallow test "throws out of the test" antipattern.** If a future contributor
revisits these tests and rewrites the mock so the rejection escapes the use case's `try/catch`
(e.g. by switching to `mockImplementation` that throws synchronously before the await), the
swallow assertion silently becomes a propagation assertion. Mitigation: the existing tests at
`owner-portal.use-cases.spec.ts:453-454` and `:537-538` use `mockRejectedValue(new Error(...))`
which produces a rejected promise — keep that pattern when auditing.

**R3 — FE spy installed AFTER component render.** If `vi.spyOn(...)` is called after
`render(<OwnerHome />)` / `render(<OwnerTimeline ...>)`, the helper reference in the rendered
tree is the original, and the spy never observes the call. Mitigation: install the spy in the
arrange step BEFORE `render(...)`, mirroring the positive tests at `owner-home.test.tsx:172-174`
and `owner-timeline.test.tsx:80-82`. Reset spies in `beforeEach` (already done via
`vi.restoreAllMocks()` at `owner-timeline.test.tsx:76`).

**R4 — Backfill punt assumes no external dashboard consumer.** The decision rests on a
`rg "movement_author"` sweep that returns 0 today. If a new consumer lands (analytics dashboard,
external BI export) between this design and the apply phase, the punt is no longer safe.
Mitigation: D9 audit gate re-runs the sweep at apply time and STOPS the apply if any consumer
is found.

**R5 — Test count baseline drift.** Proposal baseline is 715 API tests, 426 app-new tests,
29 seeded smoke tests. After this slice the expected deltas are: API +0 (audit only), app-new
+4 (two negative guards + two wa.me edges), seeded smoke +1 (movement). Expected totals: 715 API
(unchanged), 430 app-new, 30 seeded smoke. If apply produces a different delta the verify phase
MUST investigate before merging.

**R6 — Proposal/spec drift discovered late.** Both the proposal (lines 42-43) and the spec
(FR-2..FR-5 framing) describe two new use-case spec files. The design phase audit reveals these
tests already exist. If the tasks/apply phases trust the proposal blindly they will write
duplicate specs and bloat the suite. Mitigation: D6 explicitly drops the line item; tasks phase
MUST read D6 before scoping work.

---

## Delivery shape

`single_pr_recommended: true`
`size_exception_required: false`
Estimated changed lines: ~100 (all test code + apply-progress prose).
No chained PRs. No exceptions. Verify gates: `pnpm --filter @viewpro-app/api test` (unchanged),
`pnpm --filter @viewpro-app/app-new test` (+4 tests), `pnpm --filter @viewpro-app/app-new test:seeded`
(+1 test). All three suites must remain green.
