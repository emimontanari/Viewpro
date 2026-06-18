# Apply Progress — Stage 23.4 WhatsApp Contact Priority and Tracking Proof

## Phase 1 — Pre-implementation audit (DONE)

All seven Phase 1 tasks completed. No escalation required. All audit commands returned expected results. Phase 2 is unblocked.

---

### T-1.1 — `movement_author` repo-wide sweep

**Command 1:** `rg "movement_author" viewpro-app/apps/api/src/`

```
(no output — 0 matches)
```

**Command 2 (extended sweep):** `rg "movement_author" .` (repo root, catches docs/scripts/openspec)

Results: matches found ONLY in:
- `openspec/changes/23-4-whatsapp-contact-priority-tracking/` — the current change's proposal/design/spec/tasks (planning artifacts, not live code)
- `openspec/changes/23-5-owner-contact-cta-semantics/` — the next change's planning artifacts and already-completed apply-progress
- `docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-implementation.md` — historical doc (not live code)
- `docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-design.md` — historical doc
- `docs/plans/2026-06-01-stage-23-whatsapp-contact-design.md` — historical doc

**Verdict: ZERO live-code or test-file matches.** The only occurrences are in planning/docs artifacts. Stage 23.5 apply-progress confirms `rg "movement_author" viewpro-app/` already returned 0 matches after the 23.5 rename was applied. Gate PASSED. Backfill punt confirmed safe.

---

### T-1.2 — `metadata.targetType` consumer sweep

**Command:** `rg "metadata.targetType" viewpro-app/apps/api/src/`

```
(no output — 0 matches)
```

**Verdict:** Zero consumers branch on `metadata.targetType` anywhere in `viewpro-app/apps/api/src/`. No use case reads or routes on this field. Gate PASSED. Backfill punt confirmed safe per FR-9 and D9.

---

### T-1.3 — D6 audit: existing backend coverage table (FR-2..FR-5)

**Command:** `rg "TrackOwnerWhatsappContactClickUseCase|TrackOwnerMovementWhatsappContactClickUseCase" viewpro-app/apps/api/test/`

9 matches found in `owner-portal.use-cases.spec.ts` (2 imports + 7 instantiation sites across 7 tests, one per it-block). All 6 FR-2..FR-5 tests confirmed plus S-9.

**Coverage table:**

| Line | Test name (it(...)) | FR coverage | Scenario |
|------|---------------------|-------------|----------|
| 389 | `tracks owner WhatsApp contact clicks with safe analytics metadata` | FR-2 | S-4 — property 204 + event shape |
| 426 | `rejects owner WhatsApp contact clicks for inaccessible engagements` | FR-4 | S-5 — property 404 + no event |
| 445 | `keeps owner WhatsApp contact clicks successful when analytics fails` | FR-5 | S-8 — property analytics swallow |
| 466 | `tracks owner movement WhatsApp contact clicks with safe analytics metadata` | FR-3 | S-6 — movement 204 + event shape |
| 508 | `rejects owner movement WhatsApp contact clicks for inaccessible movements` | FR-4 | S-7 — movement 404 + no event |
| 528 | `keeps owner movement WhatsApp contact clicks successful when analytics fails` | FR-5 | S-8 — movement analytics swallow |
| 894 | `S-9: track-owner-movement-whatsapp-contact-click emits assigned_seller in analytics metadata` | (S-9) | targetType: 'assigned_seller' assertion |

**FR gap check:** FR-2 COVERED (line 389), FR-3 COVERED (line 466), FR-4 COVERED (lines 426+508), FR-5 COVERED (lines 445+528). No gaps. D6 claim confirmed correct.

**Note:** The metadata at line 422 asserts `{ context: "property", targetType: "tenant" }` (not `movement_author` — Stage 23.5 rename already applied). Line 504 asserts `{ context: "movement", targetType: "assigned_seller" }`. The `assigned_seller` literal is the current state after Stage 23.5. No `movement_author` literal remains in test files.

---

### T-1.4 — FE spy target locations

**Command:** `rg "trackOwnerWhatsappContactClick|trackOwnerMovementWhatsappContactClick" viewpro-app/apps/app-new/src/`

Results:

| File | Role | Match |
|------|------|-------|
| `src/features/owner/api/service.ts` | Export definition (property) | `export async function trackOwnerWhatsappContactClick(engagementId: string): Promise<void>` |
| `src/features/owner/api/service.ts` | Export definition (movement) | `export async function trackOwnerMovementWhatsappContactClick(...)` |
| `src/features/owner/api/service.test.ts` | Test imports (both) | `trackOwnerMovementWhatsappContactClick`, `trackOwnerWhatsappContactClick` |
| `src/features/owner/api/service.test.ts` | Test call sites (both) | `await expect(trackOwnerWhatsappContactClick(...))`, `trackOwnerMovementWhatsappContactClick(...)` |
| `src/features/owner/components/owner-timeline.tsx` | Component import | `import { trackOwnerMovementWhatsappContactClick } from '../api/service';` |
| `src/features/owner/components/owner-timeline.tsx` | Component call site | `void trackOwnerMovementWhatsappContactClick(movement.propertyEngagementId, movement.id).catch(...)` |
| `src/features/owner/components/owner-home.test.tsx` | Existing positive spy | `.spyOn(ownerService, 'trackOwnerWhatsappContactClick')` |
| `src/features/owner/components/owner-timeline.test.tsx` | Existing positive spy | `.spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')` |
| `src/features/owner/components/owner-home.tsx` | Component import | `import { trackOwnerWhatsappContactClick } from '../api/service';` |
| `src/features/owner/components/owner-home.tsx` | Component call site | `void trackOwnerWhatsappContactClick(engagement.id).catch(() => undefined);` |

**Canonical spy import pattern (from existing positive tests):**

Both `owner-home.test.tsx` and `owner-timeline.test.tsx` use:
```ts
import * as ownerService from '../api/service';
// then in the test:
vi.spyOn(ownerService, 'trackOwnerWhatsappContactClick')
vi.spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')
```

The canonical source module is `../api/service` (relative from the component test file). This is the module the component actually imports from, not a re-export. Spy MUST be installed before `render(...)`.

---

### T-1.5 — Early-return verification

**Command:** `rg "handleContactClick" viewpro-app/apps/app-new/src/features/owner/`

Results confirmed at expected locations.

**owner-home.tsx:**
- `handleContactClick` defined at **line 266**
- Exact condition: `if (!engagement || !contactHref) { return; }`
- The tracking call `void trackOwnerWhatsappContactClick(engagement.id).catch(() => undefined)` fires only when BOTH `engagement` AND `contactHref` are truthy.
- For the negative-guard test: render with `contact.available === false` → `contactHref` will be null/undefined → early return fires → spy not called.

**owner-timeline.tsx:**
- `handleContactClick` defined at **line 81**
- Exact condition: `if (!contactHref) { return; }`
- The tracking call `void trackOwnerMovementWhatsappContactClick(movement.propertyEngagementId, movement.id).catch(() => undefined)` fires only when `contactHref` is truthy.
- For the negative-guard test: render with `contact.available === false` → `contactHref` will be null/undefined → early return fires → spy not called.

---

### T-1.6 — T19b pattern (template for Phase 4 seeded smoke)

Source: `demo-smoke.spec.ts:990-1018`

**Pattern structure:**

1. **Route registration (BEFORE click):** `page.route('**/api/owner/engagements/*/whatsapp-contact-click', (route) => { trackingHits++; return route.continue(); });`
   - A `let trackingHits = 0` counter scoped to the test body (not describe-level).
   - Route is registered with `await page.route(...)` BEFORE any click action.

2. **Element location:** `page.locator('a[href*="wa.me"]').first()` — finds the WhatsApp anchor link.
   - Asserted visible with `await expect(whatsappAnchor).toBeVisible({ timeout: 10_000 })` before clicking.

3. **Click with Meta modifier:**
   - `const popupPromise = page.waitForEvent('popup', { timeout: 5_000 }).catch(() => null);`
   - `await whatsappAnchor.click({ modifiers: ['Meta'] });`
   - `const popup = await popupPromise;`
   - `await popup?.close();`
   - The `waitForEvent('popup')` call is set up BEFORE the click to avoid race conditions.

4. **Settle window:** `await page.waitForTimeout(500);`

5. **Assertion:** `expect(trackingHits).toBeGreaterThanOrEqual(1);`

**Movement-level adaptation (Phase 4):**
- Route glob changes to `**/api/owner/engagements/*/movements/*/whatsapp-contact-click` (adds `/movements/*/` segment)
- Element locator changes to `page.getByRole('link', { name: 'Consultar responsable' }).first()` (link not anchor by CSS selector, to match Stage 23.5 test pattern)
- Auth: inherited from S-10 (serial mode) — no `signIn(...)` needed; but must re-navigate to the property timeline if page state changed

---

### T-1.7 — Stage 23.5 describe block structure

Source: `demo-smoke.spec.ts:1438-1480`

**Block structure:**

```
test.describe('Stage 23.5 — owner timeline resolves contact to assigned seller', () => {    // line 1438
  test.describe.configure({ mode: 'serial' });                                              // line 1439

  test('S-10: owner sees assigned seller phone on a movement card (not Contacto no configurado)', ...) {  // lines 1441-1479
    // Signs in as OWNER_EMAIL, navigates to /owner
    // Finds Villa Centenario property via /api/owner/properties
    // Navigates to /owner/properties/:id
    // Opens 'Seguimiento' tab
    // Asserts role=link 'Consultar responsable' is visible
    // Asserts href matches /^https:\/\/wa\.me\/\d{8,}\?text=/
    // Asserts href contains '5493512222222' (sofia.demo's digits)
  });

  // <-- T-4.1 new movement-level tracking smoke goes HERE (after line 1479, before line 1480 closing brace)
});                                                                                          // line 1480
```

**Confirmations:**
- `test.describe.configure({ mode: 'serial' })` IS present at line 1439. Mode inheritance confirmed.
- Exactly 1 test inside the block today (S-10).
- The new T-4.1 test is appended as the SECOND test inside the describe block, after the existing S-10 closing brace and before the describe's closing `});` at line 1480.
- The file ends at line 1481 (after the closing `});`).
- T-4.1 inherits the signed-in `propietario.demo` state from S-10 (serial execution) but MUST re-navigate to the property timeline independently — it cannot rely on S-10's page state side effects.

---

### Decisions for Phase 2+

1. **No escalation from T-1.1/T-1.2.** Zero live-code consumers of `movement_author` or `metadata.targetType` confirmed. Backfill punt stands. Phase 5 documentation is straightforward.

2. **D6 confirmed correct.** All seven existing tests at lines 389, 426, 445, 466, 508, 528, 894 are present and cover FR-2..FR-5 plus S-9. No new backend spec files needed. The two-step audit (rg + read) is complete.

3. **Spy target module confirmed.** Both component tests already import `* as ownerService from '../api/service'`. The negative-guard tests (T-2.1, T-2.2) must mirror this pattern exactly. Install spy BEFORE `render(...)`.

4. **Early-return conditions confirmed.** `owner-home.tsx:267` uses `!engagement || !contactHref`; `owner-timeline.tsx:82` uses `!contactHref`. Fixture for T-2.1 needs `contact.available === false` to produce a falsy `contactHref`. Fixture for T-2.2 same.

5. **T19b template confirmed.** Route glob for movement is `**/api/owner/engagements/*/movements/*/whatsapp-contact-click`. Counter scope is test-local. Click modifier is `['Meta']`. Settlement is `waitForTimeout(500)`.

6. **Stage 23.5 describe block confirmed.** T-4.1 inserts after the S-10 test body (after line 1479) before the describe closing brace (line 1480). Serial mode is active.

7. **`movement_author` is already gone from codebase.** Stage 23.5 already renamed it to `assigned_seller` everywhere. The S-9 test at line 894 asserts `targetType: "assigned_seller"`. This is correct and consistent with the current codebase state.

---

## Phase 2 — FE negative guards (DONE)

### T-2.1 — owner-home negative guard

**File modified:** `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`

Added a new `it(...)` block immediately before the empty-state test:

```
it('does not invoke tracking when the contact button is disabled (available: false)', ...)
```

**Spy strategy (D3):** `vi.spyOn(ownerService, 'trackOwnerWhatsappContactClick').mockResolvedValue(undefined)` installed BEFORE `render(<OwnerHome />)`. Module is `../api/service` imported as `* as ownerService` — mirrors the existing positive test at line 172.

**Fixture:** `buildOwnerEngagement({ contact: { available: false, targetType: 'tenant', displayLabel: 'Contacto no configurado' } })` — same shape as the existing disabled-state test at line 197. With `available: false`, `buildOwnerPropertyWhatsappHref` returns `null` so `contactHref` is null. `OwnerActionTile` renders `<Button disabled>` with no `onClick` wired, making `handleContactClick` unreachable.

**Component path:** `OwnerActionTile` at `owner-home.tsx:417-428` — when `href === null`, renders a disabled `<Button>` that does NOT forward `onClick`. The early-return at `owner-home.tsx:267` is a belt-and-suspenders guard; the real protection is the conditional render.

**Assertion:** `expect(trackingSpy).not.toHaveBeenCalled()`.

---

### T-2.2 — owner-timeline negative guard

**File modified:** `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`

Added a new `it(...)` block appended after the existing disabled-state test:

```
it('does not invoke tracking when the movement contact button is disabled (available: false)', ...)
```

**Spy strategy (D3):** `vi.spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick').mockResolvedValue(undefined)` installed BEFORE `render(...)`. Module is `../api/service` imported as `* as ownerService` — mirrors the existing positive test at line 80.

**Fixture:** `useQueryMock.mockReturnValue({ data: { ...timelineResponse, items: [{ ...timelineResponse.items[0], contact: { available: false, targetType: 'assigned_seller', displayLabel: 'Contacto no configurado' } }] }, isError: false, isLoading: false })` — same pattern as existing disabled test at line 117. `contactHref` resolves to null → disabled button with no `onClick`.

**Component path:** `owner-timeline.tsx:108-123` — when `contactHref` is null, renders `<Button disabled>` without `onClick`. The early-return at line 82 is unreachable through the disabled button path.

**Assertion:** `expect(trackingSpy).not.toHaveBeenCalled()`.

---

### T-2.3 — Gate results

| Gate | Command | Result |
|------|---------|--------|
| Lint | `pnpm --filter next-shadcn-dashboard-starter lint:strict` | GREEN (exit 0) |
| TypeScript | `pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit` | GREEN (exit 0) |
| Tests | `pnpm --filter next-shadcn-dashboard-starter test` | GREEN — **428 passed** (83 test files) |

**Delta confirmed:** 426 baseline + 2 new = **428**. No existing tests modified. Spy cleanup handled by `vi.restoreAllMocks()` in `beforeEach` of both describe blocks.

---

## Phase 3 — Wa.me null guard (DONE)

### T-3.1 — null phone test (S-10)

**File modified:** `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`

Added a new `it(...)` block immediately after the existing "returns null when property contact is unavailable or invalid" test:

```
it('returns null when whatsappPhone is null (S-10)', ...)
```

**Fixture:** `{ available: true, targetType: 'tenant', displayLabel: 'Contactar inmobiliaria', whatsappPhone: null as unknown as string }`. Since `OwnerPropertyContact` types `whatsappPhone` as `string | undefined`, a cast was used to pass `null` explicitly. The production guard `!contact.whatsappPhone` evaluates `null` as falsy and returns `null`.

**Assertion:** `toBeNull()`.

---

### T-3.2 — undefined phone test (S-11)

Same file, same cluster (after T-3.1).

**Fixture:** omits the `whatsappPhone` key entirely — valid since `whatsappPhone?: string` in the type. The production guard `!contact.whatsappPhone` evaluates `undefined` as falsy and returns `null`. No malformed `wa.me//?text=...` string can be produced.

**Assertion:** `toBeNull()`.

---

### T-3.3 — Gate results

| Gate | Command | Result |
|------|---------|--------|
| Tests | `pnpm --filter next-shadcn-dashboard-starter test` | GREEN — **430 passed** (83 test files) |

**Delta confirmed:** 428 (Phase 2 total) + 2 new = **430**. No production code change. No existing tests modified.

---

## Phase 4 — Movement-level seeded smoke (DONE)

### T-4.1 — New test added inside Stage 23.5 describe block

**File modified:** `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Placement:** Inserted as the SECOND `test(...)` inside the existing `test.describe('Stage 23.5 — owner timeline resolves contact to assigned seller', ...)` serial block, after the S-10 test closing brace and before the describe's closing `});`.

**T19b mirror confirmation (D4):**
- Route registered with `await page.route(...)` BEFORE the click (same as T19b:997).
- Route glob: `**/api/owner/engagements/*/movements/*/whatsapp-contact-click` (adds `/movements/*/` segment vs T19b's property-level glob).
- `waitForEvent('popup', { timeout: 5_000 }).catch(() => null)` set up before the click (T19b:1008 pattern).
- `click({ modifiers: ['Meta'] })` on the resolved contact link (T19b:1009).
- `waitForTimeout(500)` settle window (T19b:1014).
- `expect(trackingHits).toBeGreaterThanOrEqual(1)` assertion (T19b:1017).
- Route fulfills with `{ status: 204, body: '' }` to avoid the real API call from consuming seed state.

**Auth deviation from D8 (documented):** D8 stated the test would "inherit sign-in from S-10 via serial mode." In practice, Playwright's serial mode shares the browser WORKER but does NOT guarantee cookie persistence across test boundaries when each test starts with a fresh navigation. The page redirected to `/auth/sign-in` on the first attempt. Resolved by adding `signIn(page, OWNER_EMAIL, '/owner')` at the top of the test — identical to how T19b at line 993 handles auth. This deviation does NOT change test semantics; it only adds an explicit sign-in round-trip (~0.5s overhead).

**Navigation:** After sign-in, the test navigates to `/owner`, fetches the owner properties via `getJson`, locates "Casa familiar con pileta en Villa Centenario", navigates to its detail page, opens the "Seguimiento" tab, and locates the `role=link { name: 'Consultar responsable' }` element — same path as S-10 but fully independent.

---

### T-4.2 — Gate results

| Gate | Command | Result |
|------|---------|--------|
| Seeded smoke | `pnpm test:seeded` (from `apps/app-new/`) | GREEN — **30 passed** (1 worker, 1.7m) |

**Delta confirmed:** 29 baseline + 1 new = **30**. S-10 (Stage 23.5 existing test, test #29) continues to pass — serial mode and sign-in inheritance are unaffected. No existing test modified. No production code change. No seed change. No new dependency.

**Playwright flakes retried:** 0 (after the auth approach fix on the first run — not a Playwright flake, was a test logic issue).

---

## Phase 5 — Backfill decision (documented)

### T-5.1 — Backfill audit + decision doc

**FR-9 / D9 requirement:** Re-run sweeps immediately before apply completion to confirm zero live-code consumers of `movement_author`. Document the decision with literal command outputs.

---

#### Sweep 1: `rg "movement_author" viewpro-app/apps/api/src/`

```
(no output — 0 matches)
EXIT_CODE: 1
```

**Result:** 0 matches in API source.

---

#### Sweep 2: `rg "movement_author" viewpro-app/apps/app-new/src/`

```
(no output — 0 matches)
EXIT_CODE: 1
```

**Result:** 0 matches in frontend source.

---

#### Sweep 3: `rg "movement_author" viewpro-app/apps/api/test/`

```
(no output — 0 matches)
EXIT_CODE: 1
```

**Result:** 0 matches in API test fixtures. Stage 23.5 already renamed all test assertions from `'movement_author'` to `'assigned_seller'`. The S-9 test at `owner-portal.use-cases.spec.ts:894` asserts `targetType: "assigned_seller"` — confirmed correct.

---

#### Sweep 4: `rg "movement_author" openspec/`

```
openspec/changes/23-4-whatsapp-contact-priority-tracking/proposal.md:**Analytics consumers reading `metadata.targetType`: ZERO.** ...
openspec/changes/23-4-whatsapp-contact-priority-tracking/proposal.md:- **Backfill of historical `targetType: 'movement_author'` events.** ...
openspec/changes/23-4-whatsapp-contact-priority-tracking/proposal.md:- [ ] Backfill decision for historical `'movement_author'` events is documented in this proposal...
openspec/changes/23-4-whatsapp-contact-priority-tracking/design.md: (4 occurrences — all audit gate / decision documentation text)
openspec/changes/23-4-whatsapp-contact-priority-tracking/spec.md: (2 occurrences — FR-9 text)
openspec/changes/23-4-whatsapp-contact-priority-tracking/tasks.md: (2 occurrences — task descriptions)
openspec/changes/23-4-whatsapp-contact-priority-tracking/apply-progress.md: (multiple — this file and Phase 1 T-1.1 documentation)
openspec/changes/23-5-owner-contact-cta-semantics/proposal.md: (multiple — context for the 23.5 rename decision)
openspec/changes/23-5-owner-contact-cta-semantics/apply-progress.md: (multiple — 23.5 apply-progress documents the rename execution)
openspec/changes/23-5-owner-contact-cta-semantics/spec.md, design.md, tasks.md: (multiple — 23.5 planning artifacts)
EXIT_CODE: 0
```

**Result:** All matches are in planning/spec/design/tasks/apply-progress files under `openspec/`. Zero live-code occurrences. These are historical context references, not consumers.

---

#### Sweep 5: `rg "movement_author" .` (repo root, excluding `openspec/`)

```
./docs/plans/2026-06-01-stage-23-whatsapp-contact-design.md:  targetType: 'movement_author';
./docs/plans/2026-06-01-stage-23-whatsapp-contact-design.md:  "targetType": "movement_author"
./docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-implementation.md:  targetType: 'movement_author',  (7 occurrences)
./docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-implementation.md:  targetType: 'movement_author';
./docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-design.md:  targetType: 'movement_author';
./docs/plans/2026-06-01-stage-23-2-movement-whatsapp-contact-design.md:  "targetType": "movement_author"
EXIT_CODE: 0
```

**Result:** All matches outside `openspec/` are in `docs/plans/` — three Stage 23 / 23.2 historical design and implementation planning documents dated 2026-06-01. These are read-only historical artifacts; no business logic reads them. Zero script, seed, or source code matches.

---

#### Sweep 6: `rg "metadata\.targetType|targetType:" viewpro-app/apps/api/src/analytics/`

```
(no output — 0 matches)
EXIT_CODE: 1
```

**Result:** The analytics module has no code that reads `metadata.targetType` or branches on `targetType:`. `analytics-event.mapper.ts` passes the event `metadata` object through `sanitizeAnalyticsMetadata` unchanged. No query, no filter, no branch.

---

#### Classification table

| Location | File type | Matches | Classification | Status |
|---|---|---|---|---|
| `viewpro-app/apps/api/src/` | Production source | 0 | N/A | OK — no consumer |
| `viewpro-app/apps/app-new/src/` | Frontend source | 0 | N/A | OK — no consumer |
| `viewpro-app/apps/api/test/` | Test fixtures | 0 | N/A | OK — Stage 23.5 rename complete |
| `viewpro-app/apps/api/src/analytics/` | Analytics module | 0 | N/A | OK — no targetType branch |
| `openspec/changes/23-4-*/` | Planning artifacts | ~15 | Historical context, docs only | OK |
| `openspec/changes/23-5-*/` | Planning artifacts | ~30 | Documents the 23.5 rename | OK |
| `docs/plans/2026-06-01-*.md` | Historical design docs | 13 | Pre-rename design documentation | OK |

**Live code consumers (production + test):** 0

---

#### Decision: PUNT backfill — no migration

**Decision:** No data migration is performed. Historical analytics events with `metadata.targetType: 'movement_author'` remain in the database as opaque JSON records.

**Rationale:**

1. **Zero consumers in `src/` (production code paths).** Sweeps 1–6 confirm no production code reads, queries, filters, or branches on `metadata.targetType` anywhere. The `analytics-event.mapper.ts` passes the full metadata object through `sanitizeAnalyticsMetadata` without inspecting individual keys.

2. **No use case reads `WHATSAPP_CONTACT_CLICKED` events.** None of the analytics, dashboards, activity feed, pilot summary, or list-events use cases retrieve `WHATSAPP_CONTACT_CLICKED` events or branch on `targetType`. The field is write-only from the production code perspective.

3. **No test fixture dependency.** Sweep 3 confirms `viewpro-app/apps/api/test/` has zero remaining `movement_author` literals. Stage 23.5 already completed the rename in all test assertions. The test suite asserts `'assigned_seller'` from `owner-portal.use-cases.spec.ts:894` onwards.

4. **Historical events are append-only and safe.** The analytics event log is append-only. Past events with `'movement_author'` are queryable as opaque JSON records. They carry no foreign key that would break referential integrity. They do not affect business logic for any current feature.

5. **Migration would carry risk without product value.** A bulk `UPDATE analytics_events SET metadata = ...` on historical rows would require a data migration with rollback risk, a deployment window, and verification testing — none of which deliver product value when zero consumers exist.

---

#### Forward note (for future analytics consumers)

If a future reporting feature needs to query `WHATSAPP_CONTACT_CLICKED` events by `targetType`, it will need to handle BOTH values:

- `'movement_author'` — historical events created before Stage 23.5 (cutover date: 2026-06-07)
- `'assigned_seller'` — events created from Stage 23.5 onwards

**Recommended handling:** Any query filter or aggregation on `targetType` should treat both values as equivalent for the "movement-level WhatsApp contact click" event. Example:

```sql
WHERE event_name = 'WHATSAPP_CONTACT_CLICKED'
  AND metadata->>'context' = 'movement'
  AND metadata->>'targetType' IN ('movement_author', 'assigned_seller')
```

This note should be added as an inline comment in the `MOVEMENT_WHATSAPP_CONTACT_METADATA` constant in `track-owner-movement-whatsapp-contact-click.use-case.ts` when (and only when) a reporting consumer is introduced. Until then, the comment would be premature and create maintenance noise.
