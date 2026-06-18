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
