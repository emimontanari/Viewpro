# Tasks — Stage 23.4 WhatsApp Contact Priority and Tracking Proof

## Status

Ready for apply — 2026-06-18.

## Source artifacts

- Spec: `openspec/changes/23-4-whatsapp-contact-priority-tracking/spec.md`
- Design: `openspec/changes/23-4-whatsapp-contact-priority-tracking/design.md`

## Delivery shape

| Dimension | Value |
|---|---|
| Estimated LOC | ~100 |
| Files touched | 5 (3 FE test files extended, 1 seeded smoke extended, 1 apply-progress prose) |
| Chained PRs | No |
| Suggested split | single-pr, no size:exception |
| Backend spec files created | 0 (audit-only — existing tests cover FR-2..FR-5) |

---

## Execution order

Phases 1–6 are SEQUENTIAL. Within each phase, tasks may run in parallel where noted.

---

## Phase 1 — Pre-flight audit (R-D3, FR-9, D6, D9)

> All five commands MUST be run BEFORE any new test is written.
> Capture each command's verbatim output in apply-progress.
> If any command returns an unexpected result, STOP and escalate.

**[x] T-1.1** — Backfill consumer audit — `movement_author`
- Command: `rg "movement_author" viewpro-app/apps/api/src/`
- Expected: 0 matches.
- Result: 0 matches in live code. Matches only in docs/ and openspec/ planning artifacts. Gate PASSED.
- Satisfies: FR-9, D9.

**[x] T-1.2** — Backfill consumer audit — `targetType` branch
- Command: `rg "metadata.targetType" viewpro-app/apps/api/src/`
- Expected: 0 matches outside the two use-case implementation files.
- Result: 0 matches. Gate PASSED.
- Satisfies: FR-9, D9.

**[x] T-1.3** — D6 audit: confirm existing backend coverage (FR-2..FR-5)
- Command: `rg "TrackOwnerWhatsappContactClickUseCase|TrackOwnerMovementWhatsappContactClickUseCase" viewpro-app/apps/api/test/`
- Expected: 6+ matches in `owner-portal.use-cases.spec.ts`.
- Result: 9 matches (2 imports + 7 instantiation sites). All 6 FR-2..FR-5 tests confirmed + S-9 at line 894.
- Read lines 389–552 and line 894. Document each `it(...)` mapping to FR-2..FR-5.
  - Line 389 → FR-2 / S-4 (property 204 + shape) — CONFIRMED
  - Line 426 → FR-4 / S-5 (property 404 + no event) — CONFIRMED
  - Line 445 → FR-5 / S-8 (property analytics swallow) — CONFIRMED
  - Line 466 → FR-3 / S-6 (movement 204 + shape) — CONFIRMED
  - Line 508 → FR-4 / S-7 (movement 404 + no event) — CONFIRMED
  - Line 528 → FR-5 / S-8 (movement analytics swallow) — CONFIRMED
  - Line 894 → S-9 (movement targetType 'assigned_seller' assertion) — CONFIRMED
- Flag any FR gap found: NONE.
- Satisfies: FR-2, FR-3, FR-4, FR-5, D6.

**[x] T-1.4** — Locate spy targets
- Command: `rg "trackOwnerWhatsappContactClick|trackOwnerMovementWhatsappContactClick" viewpro-app/apps/app-new/src/`
- Expected: exactly the two service definitions + two component call sites.
- Result: confirmed — service.ts (2 definitions), owner-home.tsx (import + call), owner-timeline.tsx (import + call), plus existing spy calls in owner-home.test.tsx and owner-timeline.test.tsx.
- Canonical import: `import * as ownerService from '../api/service';` (relative from component test file).
- Satisfies: D3.

**[x] T-1.5** — Locate early-return locations
- Command: `rg "handleContactClick" viewpro-app/apps/app-new/src/features/owner/`
- Expected: `owner-home.tsx:266` and `owner-timeline.tsx:81`.
- Result: CONFIRMED at exact lines.
  - owner-home.tsx:266 — condition: `if (!engagement || !contactHref) { return; }`
  - owner-timeline.tsx:81 — condition: `if (!contactHref) { return; }`
- Satisfies: D3, FR-1.

**[x] T-1.6** — Read T19b pattern (template for seeded smoke)
- Read `demo-smoke.spec.ts:990-1018`. Documented: intercept-before-click, `modifiers: ['Meta']`, `waitForEvent('popup')` set up before click, `waitForTimeout(500)` settle, `toBeGreaterThanOrEqual(1)` assertion.
- Movement URL glob: `**/api/owner/engagements/*/movements/*/whatsapp-contact-click`.
- Satisfies: D4, FR-6.

**[x] T-1.7** — Confirm Stage 23.5 describe placement
- Read `demo-smoke.spec.ts:1438-1480`. Confirmed `test.describe.configure({ mode: 'serial' })` at line 1439. Exactly 1 test inside (S-10). T-4.1 inserts after line 1479 before line 1480.
- Satisfies: D8, FR-6.

> T-1.1, T-1.2, T-1.3, T-1.4, T-1.5 can run in PARALLEL.
> T-1.6 and T-1.7 can run in PARALLEL with each other after T-1.3 confirms placement.
> ALL of Phase 1 MUST complete before Phase 2 begins.

---

## Phase 2 — FE negative guards (FR-1, S-1, S-2)

**[x] T-2.1** — Extend `owner-home.test.tsx` — property-level disabled-button guard
- File: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`
- Insertion: after the existing disabled-state test at line 197.
- Arrange: install `vi.spyOn(ownerService, 'trackOwnerWhatsappContactClick')` BEFORE `render(...)`. Render with a fixture where `contact.available === false`.
- Act: simulate a click on the disabled "Contactar inmobiliaria" button.
- Assert: `expect(spy).not.toHaveBeenCalled()`.
- Satisfies: FR-1, S-1.
- Result: DONE. Test added, spy installed before render, assertion passes.

**[x] T-2.2** — Extend `owner-timeline.test.tsx` — movement-level disabled-button guard
- File: `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`
- Insertion: after the existing disabled-state test at line 117.
- Arrange: install `vi.spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')` BEFORE `render(...)`. Render with a fixture where `contact.available === false`.
- Act: simulate a click on the disabled "Consultar responsable" button.
- Assert: `expect(spy).not.toHaveBeenCalled()`.
- Satisfies: FR-1, S-2.
- Result: DONE. Test added, spy installed before render, assertion passes.

> T-2.1 and T-2.2 can run in PARALLEL.

**[x] T-2.3** — Gate: Phase 2
- Run: `pnpm --filter @viewpro-app/app-new lint:strict && tsc --noEmit && vitest run`
- Expected: all tests GREEN, test count ≥ 428 (baseline 426 + 2 new).
- Block Phase 3 if this gate fails.
- Result: GREEN — 428 tests passed (83 files). Lint exit 0. TypeScript exit 0.

---

## Phase 3 — Wa.me null/undefined guard (FR-7, S-10, S-11)

**[x] T-3.1** — Extend `owner-whatsapp-contact.test.ts` — null phone
- File: `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`
- Insertion: immediately after the existing "returns null when property contact is unavailable or invalid" case at line 46.
- Arrange: call `buildOwnerPropertyWhatsappHref({ whatsappPhone: null, ... })`.
- Assert: return value is `null`.
- Satisfies: FR-7, S-10.
- Result: DONE. Test added, assertion passes.

**[x] T-3.2** — Extend `owner-whatsapp-contact.test.ts` — undefined phone
- Same file, same cluster (after T-3.1).
- Arrange: call `buildOwnerPropertyWhatsappHref({ whatsappPhone: undefined, ... })` (or omit the key entirely).
- Assert: return value is `null`, never `'wa.me//?text=...'` or any non-null string.
- Satisfies: FR-7, S-11.
- Result: DONE. Key omitted from fixture (type permits it). Assertion passes.

> T-3.1 and T-3.2 can run in PARALLEL.

**[x] T-3.3** — Gate: Phase 3
- Run: `pnpm --filter @viewpro-app/app-new vitest run`
- Expected: test count ≥ 430 (baseline 426 + 4 new). All tests GREEN.
- Block Phase 4 if this gate fails.
- Result: GREEN — 430 tests passed (83 files).

---

## Phase 4 — Movement-level seeded smoke (FR-6, S-9)

**[x] T-4.1** — Write movement-level tracking smoke test
- File: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`
- Insertion: as a SECOND `test(...)` block inside the existing `test.describe('Stage 23.5 ...')` serial block at line 1438, after the existing S-10 test.
- Pattern: mirror T19b at lines 990–1018 exactly —
  1. Register `page.route('**/api/owner/engagements/*/movements/*/whatsapp-contact-click', ...)` before click, counting POST hits.
  2. Locate the "Consultar responsable" link for a movement with an assigned seller. Navigate to the engagement timeline if not already there (inherit auth, re-navigate if needed).
  3. Click with `modifiers: ['Meta']`.
  4. `waitForEvent('popup')` to absorb the new-tab open.
  5. `waitForTimeout(500)` settle window.
  6. Assert `trackingHits >= 1`.
- Satisfies: FR-6, S-9.
- Result: DONE. Test added, explicit sign-in added (serial mode does not guarantee session persistence across tests — mirrors T19b which also calls signIn). Gate: 30/30 GREEN.

**[x] T-4.2** — Gate: Phase 4
- Run: `pnpm --filter @viewpro-app/app-new test:seeded`
- Expected: test count ≥ 30 (baseline 29 + 1 new). All tests GREEN.
- Block Phase 5 if this gate fails.
- Result: GREEN — 30 tests passed. All existing tests preserved. S-9 and S-10 both pass.

---

## Phase 5 — Backfill audit documentation (FR-9, D9)

**[x] T-5.1** — Record backfill decision in apply-progress
- File: `openspec/changes/23-4-whatsapp-contact-priority-tracking/apply-progress.md`
- Append section: `## Backfill audit results`.
- Content: verbatim output of T-1.1 and T-1.2. Decision: PUNT — zero consumers confirmed, no migration performed, risk documented per FR-9 and D9.
- Satisfies: FR-9.

---

## Phase 6 — Final verification gates

**T-N1** — API suite unchanged
- Run: `pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api test`
- Expected: 715 tests GREEN, +0 delta (no backend changes in this slice).

**T-N2** — App-new full suite
- Run: `pnpm --filter @viewpro-app/app-new lint:strict && tsc --noEmit && pnpm --filter @viewpro-app/app-new test`
- Expected: ≥ 430 tests GREEN (+4 delta from baseline 426).

**T-N3** — Seed health check
- Run: `pnpm --filter @viewpro/api demo:seed` (or equivalent)
- Expected: exits 0. No seed changes in this slice.

**T-N4** — Seeded smoke suite
- Run: `pnpm --filter @viewpro-app/app-new test:seeded`
- Expected: ≥ 30 tests GREEN (+1 delta from baseline 29).

> T-N1, T-N2, T-N3, T-N4 can run in PARALLEL.

---

## Scenario-to-task coverage matrix

| Scenario | Status | Satisfied by |
|---|---|---|
| S-1 — property disabled button: tracking not called | New test | T-2.1 |
| S-2 — movement disabled button: tracking not called | New test | T-2.2 |
| S-3 — non-owner 403 regression guard | Existing e2e auth guard | (no new test — regression note only) |
| S-4 — property 204 + event shape | Existing test | T-1.3 audit → `owner-portal.use-cases.spec.ts:389` |
| S-5 — property 404 + no event | Existing test | T-1.3 audit → `owner-portal.use-cases.spec.ts:426` |
| S-6 — movement 204 + event shape | Existing test | T-1.3 audit → `owner-portal.use-cases.spec.ts:466` |
| S-7 — movement 404 + no event | Existing test | T-1.3 audit → `owner-portal.use-cases.spec.ts:508` |
| S-8 — analytics swallow → 204 | Existing tests (x2) | T-1.3 audit → `owner-portal.use-cases.spec.ts:445,528` |
| S-9 — movement tracking endpoint hit (seeded smoke) | New test | T-4.1 |
| S-10 — wa.me null phone returns null | New test | T-3.1 |
| S-11 — wa.me undefined phone returns null | New test | T-3.2 |

---

## Notes for apply phase

- Read D6 before touching any backend test file. The two new use-case spec files originally listed in the proposal are NOT created — existing tests at `owner-portal.use-cases.spec.ts:389–552` cover FR-2..FR-5.
- Install FE spies BEFORE `render(...)` in T-2.1 and T-2.2 (see R3 in design).
- Register the Playwright route BEFORE the click in T-4.1 (see R1 in design). Route glob is `**/api/owner/engagements/*/movements/*/whatsapp-contact-click` — note the `/movements/*/` segment.
- The Stage 23.5 describe block uses `test.describe.configure({ mode: 'serial' })`. The new test inherits auth state but MUST NOT depend on S-10 side-effecting page state.
