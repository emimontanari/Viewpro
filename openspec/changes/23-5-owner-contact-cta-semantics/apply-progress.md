# Apply Progress — Stage 23.5: Owner Contact CTA Semantics and Priority Proof

## Phase 1 — Pre-implementation audit (DONE)

All 7 audit tasks completed. No blockers. One additional discovery noted in T-1.6.

---

### T-1.1 — `movement_author` literal sweep

Total occurrences: **18** across **9 files** — matches design expectation exactly.

| File | Line | Classification |
|------|------|----------------|
| `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` | 12 | type (TS type literal in `OwnerMovementContactResponse`) |
| `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` | 53 | source (return value in `mapMovementAuthorWhatsappContact`) |
| `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` | 70 | source (return value in `unavailableMovementAuthorContact`) |
| `viewpro-app/apps/api/src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts` | 8 | analytics (metadata payload constant `MOVEMENT_WHATSAPP_CONTACT_METADATA`) |
| `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts` | 388 | test (assertion in e2e timeline response) |
| `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts` | 473 | test (assertion in e2e timeline response) |
| `viewpro-app/apps/api/test/owner-portal.repository.spec.ts` | 350 | test (assertion on mapper output) |
| `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` | 284 | test (fixture assertion) |
| `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` | 327 | test (assertion on contact response) |
| `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` | 377 | test (assertion on contact response) |
| `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` | 498 | analytics (test assertion on `metadata.targetType`) |
| `viewpro-app/apps/app-new/src/features/owner/api/types.ts` | 49 | type (TS union literal in `OwnerMovementContact.targetType`) |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` | 61 | test (fixture object) |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` | 126 | test (fixture object) |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx` | 134 | test (fixture object) |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` | 19 | test (fixture object) |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` | 115 | test (assertion on `targetType`) |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` | 127 | test (assertion on `targetType`) |

Count: 18 total. Gate: PASSED.

---

### T-1.2 — `createdBy.whatsappPhone` consumers

Command: `rg "createdBy\.whatsappPhone" viewpro-app/apps/api/src/`

| File | Line | Content |
|------|------|---------|
| `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts` | 25 | `contact: mapMovementAuthorWhatsappContact(movement.createdBy.whatsappPhone)` |

Result: **1 occurrence** — exactly as expected. Gate: PASSED.

---

### T-1.3 — Prisma includes single-source

Command: `rg "ownerMovementInclude|ownerEngagementInclude" viewpro-app/apps/api/src/`

**`ownerEngagementInclude`:**
| File | Line | Role |
|------|------|------|
| `prisma-owner-portal.repository.ts` | 20 | Declaration (`const ownerEngagementInclude = { ... } satisfies Prisma.PropertyEngagementInclude`) |
| `prisma-owner-portal.repository.ts` | 63 | Usage — `findEngagementsForOwnerProperty` |
| `prisma-owner-portal.repository.ts` | 80 | Usage — `findEngagementTimelineForOwner` (engagement query) |

**`ownerMovementInclude`:**
| File | Line | Role |
|------|------|------|
| `prisma-owner-portal.repository.ts` | 25 | Declaration (`const ownerMovementInclude = { ... } satisfies Prisma.MovementInclude`) |
| `prisma-owner-portal.repository.ts` | 91 | Usage — `findEngagementTimelineForOwner` (movement paginated query) |

Both includes are declared once in `prisma-owner-portal.repository.ts` and used only within that same file. Gate: PASSED.

---

### T-1.4 — `mapMovementAuthorWhatsappContact` callers

Command: `rg "mapMovementAuthorWhatsappContact" viewpro-app/`

| File | Line | Role |
|------|------|------|
| `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` | 38 | Declaration (exported function) |
| `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts` | 2 | Import |
| `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts` | 25 | Call site |

Rename blast radius: **1 call site** + **1 import**. All in `owner-movement.response.ts`. Gate: PASSED.

---

### T-1.5 — Current shapes documentation

#### `owner-whatsapp-contact.ts` (full file, 74 lines)

- **Line 1**: `import { MIN_WHATSAPP_DIGITS } from "../common/whatsapp/whatsapp-phone.utils"`
  - Import path: `../common/whatsapp/whatsapp-phone.utils`
- **Lines 10-15**: `OwnerMovementContactResponse` type:
  ```ts
  export type OwnerMovementContactResponse = {
    available: boolean;
    targetType: "movement_author";
    displayLabel: string;
    whatsappPhone?: string;
  };
  ```
- **Lines 38-57**: `mapMovementAuthorWhatsappContact` signature:
  ```ts
  export function mapMovementAuthorWhatsappContact(
    whatsappPhone: string | null,
  ): OwnerMovementContactResponse
  ```
  - Takes a single `string | null` — the author's raw phone.
  - Validates digits length against `MIN_WHATSAPP_DIGITS`.
  - Returns `{ available: true, targetType: "movement_author", displayLabel: "Consultar responsable", whatsappPhone }` on success.
- **Lines 67-73**: `unavailableMovementAuthorContact()` — private function:
  ```ts
  function unavailableMovementAuthorContact(): OwnerMovementContactResponse {
    return {
      available: false,
      targetType: "movement_author",
      displayLabel: "Contacto no configurado",
    };
  }
  ```

#### `responses/owner-movement.response.ts` (28 lines)

- **Line 2**: `import { mapMovementAuthorWhatsappContact } from "../owner-whatsapp-contact"`
- **Line 4**: `export type OwnerMovementResponse = ReturnType<typeof mapOwnerMovement>`
- **Line 6**: `export function mapOwnerMovement(movement: OwnerMovementRecord)`
- **Line 25**: `contact: mapMovementAuthorWhatsappContact(movement.createdBy.whatsappPhone)`
  - At this point `movement` is typed as `OwnerMovementRecord` (imported from `../owner-portal.repository`).
  - The relevant field accessed: `movement.createdBy.whatsappPhone` (a `string | null`).

After Phase 2, this line will change to:
`contact: mapAssignedSellerWhatsappContact(movement.propertyEngagement.agents)`

#### `prisma-owner-portal.repository.ts` — include shapes

**`ownerEngagementInclude` (lines 20-23):**
```ts
const ownerEngagementInclude = {
  tenant: { select: { id: true, name: true, whatsappPhone: true } },
  agents: { select: { agentUserId: true, agentUser: { select: { firstName: true, email: true } } } },
} satisfies Prisma.PropertyEngagementInclude
```
Note: `agentUser.select` currently has `firstName` and `email` only — no `whatsappPhone`. Phase 2 T-2.5 will add `whatsappPhone: true`.

**`ownerMovementInclude` (lines 25-27):**
```ts
const ownerMovementInclude = {
  createdBy: { select: { id: true, email: true, firstName: true, whatsappPhone: true } },
} satisfies Prisma.MovementInclude
```
Phase 2 T-2.4 will add a `propertyEngagement` branch with agents + orderBy.

**Prisma relation name — `Movement → PropertyEngagement`:**
Confirmed at `schema.prisma:489`:
```prisma
propertyEngagement  PropertyEngagement  @relation(fields: [propertyEngagementId], references: [id], onDelete: Cascade)
```
Relation name is **`propertyEngagement`** (not `engagement`). Design D3 risk resolved: `movement.propertyEngagement.agents` is correct.

#### `track-owner-movement-whatsapp-contact-click.use-case.ts` — analytics payload

**Lines 6-9** — the analytics metadata constant:
```ts
const MOVEMENT_WHATSAPP_CONTACT_METADATA = {
  context: 'movement',
  targetType: 'movement_author',
} as const
```
This is the `targetType` literal at line 8. Phase 2 T-2.7 will change it to `'assigned_seller'`.

---

### T-1.6 — Seed mutation safety

**Sofia definition:**
- File: `viewpro-app/apps/api/scripts/seed-demo.mjs`
- Lines: 79-84
  ```js
  {
    email: "sofia.demo@viewpro.local",
    firstName: "Sofía",
    lastName: "Demo",
    role: TenantRole.MANAGER,
  }
  ```
- `whatsappPhone` is NOT set (absent from the object). Confirmed: no collision with martin or tenant.

**Phone uniqueness:**
| Phone | User | Source line |
|-------|------|-------------|
| `+5493510000000` | DEMO_TENANT_WHATSAPP_PHONE | seed-demo.mjs:55 (env default) |
| `+5493511111111` | martin.demo | seed-demo.mjs:90 |
| `+5493512222222` | sofia.demo (proposed) | not yet in codebase |

`rg "5493512222222"` across entire repo returned **0 results** — no collision. Gate: PASSED.

**Seed log lines affected by the change:**
- `seed-demo.mjs:2108` — `Document requests: ...` — numeric count unchanged (no new rows).
- `seed-demo.mjs:2107` — `Movements: ...` — numeric count unchanged (no new rows).
- `seed-demo.mjs:2113-2115` — `"Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía no-config movement contact"` — **this string will be stale** after Phase 5 adds sofia's phone. Phase 5 MUST update this log string to something like `"Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía assigned-seller WhatsApp"`.

**Count assertion safety:** No log line prints a User count; the only logged numeric counts are properties, images, movements, document requests, status change requests, notifications, admin events, and custom outcome labels. Adding `whatsappPhone` to sofia does NOT shift any of those. Gate: PASSED.

**Additional discovery (T-1.6-D):** The seed summary string at line 2114 documents the old intent ("Sofía no-config movement contact"). Phase 5 must update this string as part of `seed-demo.mjs` changes.

---

### T-1.7 — Frontend `targetType` consumers

**`OwnerMovementContact.targetType` type literal:**
- File: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`
- Line: 49 — `targetType: 'movement_author';`

**Frontend test files asserting `'movement_author'`:**

| File | Line(s) | Role |
|------|---------|------|
| `viewpro-app/apps/app-new/src/features/owner/api/types.ts` | 49 | Type definition (union member) |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` | 61, 126 | Test fixture objects |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx` | 134 | Test fixture object |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` | 19, 115, 127 | Fixture + assertions |

Total: **7 occurrences** in 4 frontend files, confirmed covered by T-1.1 sweep. Cross-check: the T-1.1 sweep found exactly these lines. Gate: PASSED.

---

### Decisions for Phase 2+

| Decision | Value |
|----------|-------|
| Prisma relation name on `Movement` | `propertyEngagement` (confirmed — use `movement.propertyEngagement.agents`) |
| `ownerMovementInclude` extension | add `propertyEngagement: { select: { agents: { orderBy: [{assignedAt:'asc'},{agentUserId:'asc'}], select: { agentUserId:true, assignedAt:true, agentUser:{ select:{ whatsappPhone:true } } } } } }` |
| `ownerEngagementInclude` extension | add `whatsappPhone: true` to existing `agents.agentUser.select` |
| Rename: function | `mapMovementAuthorWhatsappContact` → `mapAssignedSellerWhatsappContact` |
| Rename: unavailable helper | `unavailableMovementAuthorContact` → `unavailableAssignedSellerContact` |
| Rename: type literal | `"movement_author"` → `"assigned_seller"` in `OwnerMovementContactResponse.targetType` |
| Analytics metadata | `targetType: 'movement_author'` → `'assigned_seller'` in `MOVEMENT_WHATSAPP_CONTACT_METADATA` |
| New function input | `agents: Array<{ agentUserId: string; assignedAt: Date; agentUser: { whatsappPhone: string \| null } }>` |
| Seed: sofia.demo phone | `+5493512222222` (unique — no collision) |
| Seed: log string update | Line 2114: update "Sofía no-config movement contact" → "Sofía assigned-seller WhatsApp" |
| `rg "createdBy.whatsappPhone" viewpro-app/apps/api/src/` after Phase 2 | Must return 0 |
| `rg "movement_author" viewpro-app/apps/api/src/` after Phase 2+3 | Must return 0 |
| `rg "movement_author" viewpro-app/apps/app-new/src/` after Phase 4 | Must return 0 |
| TDD mode | Strict TDD — RED → GREEN → REFACTOR for all new tests |

---

## Phase 2 — Backend (DONE)

All 8 tasks completed. Typecheck gate GREEN. No blockers.

### File:line summaries

| File | Change |
|------|--------|
| `src/owner-portal/owner-whatsapp-contact.ts:10-15` | `OwnerMovementContactResponse.targetType` renamed from `"movement_author"` to `"assigned_seller"` |
| `src/owner-portal/owner-whatsapp-contact.ts:17-21` | New exported type `AssignedSellerAgent` added |
| `src/owner-portal/owner-whatsapp-contact.ts:44-74` | `mapMovementAuthorWhatsappContact(whatsappPhone: string | null)` replaced by `mapAssignedSellerWhatsappContact(agents: AssignedSellerAgent[])` with picker logic |
| `src/owner-portal/owner-whatsapp-contact.ts:84-90` | `unavailableMovementAuthorContact` renamed to `unavailableAssignedSellerContact`; emits `targetType: "assigned_seller"` |
| `src/owner-portal/prisma-owner-portal.repository.ts:20-23` | `ownerEngagementInclude.agents.agentUser.select` extended with `whatsappPhone: true` (T-2.5) |
| `src/owner-portal/prisma-owner-portal.repository.ts:25-37` | `ownerMovementInclude` extended with `propertyEngagement.agents` ordered by `[assignedAt asc, agentUserId asc]` (T-2.4) |
| `src/owner-portal/owner-portal.repository.ts:9-19` | `OwnerEngagementRecord` type extended with `whatsappPhone: true` in `agents.agentUser.select` |
| `src/owner-portal/owner-portal.repository.ts:34-51` | `OwnerMovementRecord` type extended with `propertyEngagement.agents` include shape matching the new include |
| `src/owner-portal/responses/owner-movement.response.ts:2` | Import updated: `mapMovementAuthorWhatsappContact` → `mapAssignedSellerWhatsappContact` |
| `src/owner-portal/responses/owner-movement.response.ts:25` | Call site rewired: `mapMovementAuthorWhatsappContact(movement.createdBy.whatsappPhone)` → `mapAssignedSellerWhatsappContact(movement.propertyEngagement.agents)` |
| `src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts:8` | Analytics `MOVEMENT_WHATSAPP_CONTACT_METADATA.targetType` changed from `'movement_author'` to `'assigned_seller'` |

### Input shape change

`mapAssignedSellerWhatsappContact` now accepts `agents: AssignedSellerAgent[]` (array of `{ agentUserId: string; assignedAt: Date; agentUser: { whatsappPhone: string | null } }`) instead of a flat `whatsappPhone: string | null`.

### Post-rewire audit

- `rg "createdBy\.whatsappPhone" viewpro-app/apps/api/src/` → **0 matches** (gate PASSED)
- `rg "movement_author" viewpro-app/apps/api/src/` → **0 matches** (gate PASSED)

### Deviation from design

One additional guard `if (!seller)` was added after `agents[0]` assignment (line 54). TypeScript strict mode requires it because array indexing always returns `T | undefined`. The length check at line 47 already prevents this branch from ever executing at runtime, but the guard is necessary to satisfy the type checker. This is a no-op at runtime and does not change observable behavior.

### Typecheck gate

`pnpm --filter @viewpro/api typecheck` → **GREEN** (exit 0).

---

## Phase 3 — API tests (DONE)

All 5 tasks completed (T-3.1 through T-3.5). Gate GREEN at 713 tests. No blockers.

### Tests touched (existing — migrated)

| File | Change |
|------|--------|
| `test/owner-portal.use-cases.spec.ts` | `makeMovement` default now includes `propertyEngagement: { agents: [] }` |
| `test/owner-portal.use-cases.spec.ts` | Test "returns mapped owner engagement timeline pagination" — contact assertion updated: `movement_author` → `assigned_seller` |
| `test/owner-portal.use-cases.spec.ts` | Test "maps movement author WhatsApp contact..." — renamed to "maps assigned seller WhatsApp contact..."; fixture migrated from `createdBy.whatsappPhone` to `propertyEngagement.agents[0].agentUser.whatsappPhone` |
| `test/owner-portal.use-cases.spec.ts` | Test "does not fallback to tenant contact for unavailable movement author WhatsApp" — renamed; fixture migrated from short `createdBy.whatsappPhone` to `agents[0]` with `whatsappPhone: null` |
| `test/owner-portal.use-cases.spec.ts` | Analytics test — `metadata.targetType: "movement_author"` → `"assigned_seller"` |
| `test/owner-portal.repository.spec.ts` | `makeMovement` default now includes `propertyEngagement: { agents: [] }` |
| `test/owner-portal.repository.spec.ts` | `mapOwnerMovement` timeline assertion — `targetType: "movement_author"` → `"assigned_seller"` |
| `test/owner-portal.e2e-spec.ts` | Analytics metadata assertion — `targetType: "movement_author"` → `"assigned_seller"` |
| `test/owner-portal.e2e-spec.ts` | Timeline contact assertion — migrated from `available: true / movement_author / creator's phone` to `available: false / assigned_seller / no phone` (correct: test engagement has no PropertyAgent rows) |

### Tests added (new — S-1 through S-9)

| Test | File | Scenario |
|------|------|----------|
| S-1: resolves contact from assigned seller when creator has no phone | `use-cases.spec.ts` | S-1 |
| S-2: does not use creator phone when assigned seller has no phone | `use-cases.spec.ts` | S-2 |
| S-3: picks the seller with the earliest assignedAt when two sellers exist | `use-cases.spec.ts` | S-3 |
| S-4: breaks assignedAt tie by agentUserId ascending | `use-cases.spec.ts` | S-4 |
| S-5: returns unavailable contact when no sellers are assigned | `use-cases.spec.ts` | S-5 |
| S-6: returns unavailable contact when assigned seller phone has fewer than 8 digits | `use-cases.spec.ts` | S-6 |
| S-7: resolves correct targetType and displayLabel for valid assigned seller phone | `use-cases.spec.ts` | S-7 |
| S-8: property-level tenant contact resolves via mapTenantWhatsappContact with targetType tenant | `use-cases.spec.ts` | S-8 |
| S-9: track-owner-movement-whatsapp-contact-click emits assigned_seller in analytics metadata | `use-cases.spec.ts` | S-9 (dedicated test) |
| mapOwnerMovement resolves assigned seller contact from agents[0] | `repository.spec.ts` | S-7 (mapper level) |
| mapOwnerMovement picks lower agentUserId when assignedAt is identical | `repository.spec.ts` | S-4 (mapper level) |

### Counts

| Metric | Value |
|--------|-------|
| Existing tests updated | 9 (5 in use-cases.spec.ts, 2 in repository.spec.ts, 2 in e2e-spec.ts) |
| New tests added | 11 (9 in use-cases.spec.ts, 2 in repository.spec.ts) |
| Total API tests | 713 |

### Gate result

`pnpm --filter @viewpro/api test` → **GREEN-713** (exit 0). One `ECONNRESET` flake in `property-engagement-images.e2e-spec.ts` observed on first run (unrelated to owner portal); second run clean at 713/713.

### Spec ↔ implementation gap

- **E2E test semantic update**: The e2e timeline test previously set `manager.whatsappPhone` and expected it to drive the movement contact. After Phase 2 rewire, the mapper reads `propertyEngagement.agents`, not `createdBy.whatsappPhone`. Since the e2e fixture creates an engagement with no `PropertyAgent` rows, the correct expected contact is now `available: false`. Updated accordingly — this is a spec-correct change, not a gap.
- No other deviations from design.

---

## Phase 4 — Frontend rename (DONE)

All 6 tasks completed (T-4.1 through T-4.6). All gates GREEN. No blockers.

### Files touched

| File | Change |
|------|--------|
| `viewpro-app/apps/app-new/src/features/owner/api/types.ts:49` | `OwnerMovementContact.targetType` literal changed from `'movement_author'` to `'assigned_seller'` |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx:61,126` | Two fixture `targetType` literals swapped to `'assigned_seller'` |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx:134` | One fixture `targetType` literal swapped to `'assigned_seller'` |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts:19,115,127` | Three fixture/assertion `targetType` literals swapped to `'assigned_seller'` |

### Verification sweep (T-4.3)

`rg "movement_author" viewpro-app/apps/app-new/src/` → **0 matches** (gate PASSED).
`rg "movement_author" viewpro-app/` (repo-wide) → **0 matches** (gate PASSED — combined with Phase 2/3 removals, zero occurrences remain anywhere in the repo).

### Cross-verify with API rename (T-4.5)

- `owner-whatsapp-contact.ts`: `OwnerMovementContactResponse.targetType` → `"assigned_seller"` ✓
- `track-owner-movement-whatsapp-contact-click.use-case.ts`: `MOVEMENT_WHATSAPP_CONTACT_METADATA.targetType` → `'assigned_seller'` ✓
- Frontend `OwnerMovementContact.targetType` → `'assigned_seller'` ✓
- Contract match confirmed. No mismatch.

### Gate results (T-4.6)

| Gate | Result |
|------|--------|
| `pnpm --filter next-shadcn-dashboard-starter lint:strict` | GREEN (exit 0) |
| `pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit` | GREEN (exit 0) |
| `pnpm --filter next-shadcn-dashboard-starter test -- --run` | GREEN-426 (426/426 passed) |

### Deviations from design

None. Pure literal rename with no behavior change.

---

## Phase 5 — Seed (DONE)

All 3 tasks completed (T-5.1 through T-5.3). Seed exits 0. No blockers.

### T-5.1 — sofia.demo whatsappPhone added

- File: `viewpro-app/apps/api/scripts/seed-demo.mjs`
- Lines 79-85 (after edit): `whatsappPhone: "+5493512222222"` added to sofia.demo object, matching martin.demo key order and quoting style.
- Collision check: tenant `+5493510000000`, martín `+5493511111111`, sofia `+5493512222222` — each appears exactly once. No duplicates.

### T-5.2 — Stale comment updated

- Decision: **update** (not remove — the line still adds value as a fixture inventory summary).
- Old string (line 2114): `"Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía no-config movement contact"`
- New string: `"Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía assigned-seller WhatsApp (Stage 23.5)"`
- `Document requests:` line is unchanged: `Document requests: 20 (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)` — no numeric shift.

### T-5.3 — Seed run result

- Syntax check: `node --check seed-demo.mjs` → exit 0.
- `pnpm demo:seed` → **exit 0**.
- Literal `Document requests:` log line from output:
  ```
  Document requests: 20 (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)
  ```
- Count unchanged vs. pre-apply baseline. Gate: PASSED.

### Phone sweep (post-apply)

`rg "5493512222222|5493511111111|5493510000000" seed-demo.mjs` output:
```
process.env.VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? "+5493510000000";
  whatsappPhone: "+5493512222222",
  whatsappPhone: "+5493511111111",
```
Each phone present exactly once. Gate: PASSED.

---

## Phase 6 — Seeded smoke (DONE)

Both tasks completed (T-6.1, T-6.2). Gate GREEN at 29/29. No blockers.

### T-6.1 — S-10 test block added

- File: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`
- New describe block appended at EOF: `test.describe('Stage 23.5 — owner timeline resolves contact to assigned seller', ...)`
- `test.describe.configure({ mode: 'serial' })` applied inside.
- Single test: S-10 — signs in as `propietario.demo@viewpro.local`, fetches `/api/owner/properties` to locate Villa Centenario, navigates to `/owner/properties/{id}`, clicks the "Seguimiento" tab, finds `getByRole('link', { name: 'Consultar responsable' }).first()`, asserts text is not 'Contacto no configurado', asserts href matches `/^https:\/\/wa\.me\/\d{8,}\?text=/` and contains `5493512222222`.
- No click, no analytics assertion (23.4 boundary respected).

### Regression fix applied alongside T-6.1

Line 275 of the existing test "demo owner sees seeded notifications, images and contacts" was checking `item.contact.whatsappPhone === '+5493511111111'` (martin's phone). After Phase 2, the resolver uses the engagement's assigned seller (sofia, `+5493512222222` for index-0/Villa Centenario). Updated:
- Old: `expect(ownerTimeline.items.some((item) => item.contact.whatsappPhone === '+5493511111111')).toBe(true)`
- New: `expect(ownerTimeline.items.some((item) => item.contact.whatsappPhone === '+5493512222222')).toBe(true)`

Line 278 updated similarly: `some((item) => !item.contact.available)` → `some((item) => item.contact.available)` (sofia has a valid phone; all movements on this engagement are now available).

### Anchor strategy used

- Primary selector: `page.getByRole('link', { name: 'Consultar responsable' }).first()`
- Why `role=link`: `owner-timeline.tsx` renders `<Button asChild><a href={contactHref}>...</a></Button>` when the contact is resolved. The `asChild` pattern forwards all props to the `<a>` element, which has role=link in the accessibility tree.
- href assertions: `.toMatch(/^https:\/\/wa\.me\/\d{8,}\?text=/)` + `.toContain('5493512222222')`.

### T-6.2 — Gate result

- Run 1: 1 FAILED (pre-existing "Smoke test label" flake on test 10 — test-state race when custom label already exists in DB from prior run), 19 did not run.
- Run 2 (retry 1): **29/29 GREEN** — exit 0. All 28 baseline tests GREEN. S-10 GREEN.
- Playwright flakes retried: 1.

### Counts

| Metric | Value |
|--------|-------|
| New seeded smoke tests added | 1 (S-10) |
| Existing tests updated for regression | 1 (line 275–278 phone/available fix) |
| Total seeded smoke tests | 29 |
| Gate | GREEN-29/29 |

---

## Phase 7 — Pending

Verification gates remain to be run. See `tasks.md` Phase 7 for the full checklist.
