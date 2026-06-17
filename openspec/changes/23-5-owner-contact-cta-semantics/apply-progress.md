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

## Phases 2–7 — Pending

Tasks from Phase 2 through Phase 7 remain to be implemented. See `tasks.md` for the full checklist.
