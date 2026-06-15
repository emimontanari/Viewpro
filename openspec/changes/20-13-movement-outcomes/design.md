# Design — Stage 20.13 Movement Outcomes and Custom Tenant Labels

**Status:** draft
**Inputs:** `proposal.md`, `spec.md` (29 FRs, 15 scenarios)
**Skill loaded:** `cognitive-doc-design`
**Engram references:** observation #4102 (two-layer model; Layer 3 rejected)

---

## TL;DR

Add a thin, additive surface to today's `movements` module so a seller can attach an `outcome` to any movement — either a built-in enum value or a per-tenant custom label — without touching `PropertyEngagement.status`. The slice ships:

- One new Prisma enum (`MovementBuiltInOutcome`).
- One new table (`TenantMovementOutcomeLabel`), soft-deletable, unique `(tenantId, label)`.
- Two nullable columns on `Movement` (`builtInOutcome`, `customOutcomeLabelId`).
- One new Nest module (`movement-outcome-labels`) for the label CRUD.
- One extended use case (`CreateMovementUseCase`) that **never** writes status.
- Two new BFF route folders and one extended movement form/feed in `features/products`.

Risks R1 / R2 / R3 are resolved with: a pure payload builder for the no-status invariant, a `P2002`-catch + re-query idempotency strategy with explicit soft-delete rule, and dual-layer color validation (BFF + API).

---

## Architecture decisions

### Module layout

```
viewpro-app/apps/api/src/
  movements/                         # extended
    dto/create-movement.dto.ts       # add outcome field
    use-cases/create-movement.use-case.ts
    use-cases/build-movement-create-payload.ts   # NEW — pure function (R1)
    prisma-movements.repository.ts   # accept outcome fields
    responses/movement.response.ts   # surface outcome
  movement-outcome-labels/           # NEW module
    movement-outcome-labels.module.ts
    movement-outcome-labels.controller.ts
    dto/create-label.dto.ts
    dto/list-labels.query.ts
    movement-outcome-labels.repository.ts          # port (interface + symbol)
    prisma-movement-outcome-labels.repository.ts   # adapter
    use-cases/create-label.use-case.ts             # idempotent (R2)
    use-cases/list-labels.use-case.ts
    use-cases/delete-label.use-case.ts
    responses/movement-outcome-label.response.ts
    constants/built-in-outcome-names.ts            # set of forbidden names

viewpro-app/apps/app-new/src/
  app/api/products/[id]/movements/route.ts        # extended POST (R3 BFF guard)
  app/api/tenants/me/movement-outcome-labels/     # NEW
    route.ts                                       # GET, POST (BFF color guard)
    [labelId]/route.ts                             # DELETE
  features/products/
    components/create-property-movement-dialog.tsx        # add outcome combobox
    components/movement-outcome-combobox.tsx              # NEW
    components/movement-outcome-create-label-form.tsx     # NEW (inline)
    components/property-movement-history.tsx              # render chip
    components/movement-outcome-chip.tsx                  # NEW (chip)
    api/types.ts                                          # add outcome types
    api/service.ts                                        # add label client
    api/queries.ts                                        # TanStack keys
    constants/movement-outcome-options.ts                 # built-in labels (es)
    schemas/movement.ts                                   # extend zod with outcome
```

### Layering rule

| Layer | Responsibility | Allowed deps |
|---|---|---|
| Controller | HTTP IO, DTO validation, auth guards | Use cases, DTOs |
| Use case | Business rule (auth check, idempotency, invariant) | Repository port, services |
| Repository port | Pure TypeScript interface + DI symbol | — |
| Repository adapter | Prisma-only IO | Prisma client |
| Pure builder | Deterministic Prisma payload shape | — (tested in isolation) |

### Reuse vs. new

- **Reuse** `CreateMovementUseCase`, `MovementsController`, existing `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard`, `PERMISSIONS.MOVEMENTS_CREATE`.
- **New** `MovementOutcomeLabelsModule` and a new permission constant `MOVEMENTS_OUTCOME_LABELS_MANAGE` (added to `MANAGER`, `PRINCIPAL_MANAGER`, and `AGENT` role grants — see Spec deltas required).

### Strict TDD ergonomics

The pure builder pattern (R1) and the port-style label repository (R2) make every FR testable without booting Nest or hitting the DB:

| FR | Test surface |
|---|---|
| FR-3, FR-11 | `buildMovementCreatePayload` pure unit |
| FR-7 | `validateLabelName` pure unit |
| FR-10 | `CreateMovementUseCase.execute` with mocked repo port |
| FR-13 | `CreateLabelUseCase.execute` with mocked repo + `P2002` simulator |
| FR-15 | `DeleteLabelUseCase.execute` with mocked repo, no DB |
| FR-23..25 | RTL component test on `MovementOutcomeChip` |

Integration tests (Supertest + Postgres) still run for the wire-level FRs (S-1, S-8, S-12, S-15) but every invariant test is a fast unit test.

---

## Database design

### Prisma deltas (additive only)

```prisma
enum MovementBuiltInOutcome {
  EN_CAPTACION
  DOCUMENTACION_PENDIENTE
  PREPARANDO_PUBLICACION
  PUBLICACION_ACTIVA
  CONSULTAS_Y_VISITAS
  NEGOCIACION_OFERTA
  RESERVA_INICIADA
  DOCUMENTACION_FINAL
  CERRADO
  CANCELADO
}

model TenantMovementOutcomeLabel {
  id              String    @id @default(uuid())
  tenantId        String
  label           String    // trimmed, max 40 chars (app-level)
  color           String?   // CSS hex #RRGGBB, validated app-side
  createdByUserId String
  createdAt       DateTime  @default(now())
  deletedAt       DateTime?

  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdBy User       @relation(fields: [createdByUserId], references: [id])
  movements Movement[] @relation("MovementCustomOutcomeLabel")

  @@unique([tenantId, label], map: "tenant_movement_outcome_labels_tenant_label_key")
  @@index([tenantId, deletedAt])
  @@index([createdByUserId])
  @@map("tenant_movement_outcome_labels")
}

model Movement {
  // ... existing fields ...
  builtInOutcome        MovementBuiltInOutcome?
  customOutcomeLabelId  String?

  customOutcomeLabel    TenantMovementOutcomeLabel? @relation("MovementCustomOutcomeLabel", fields: [customOutcomeLabelId], references: [id], onDelete: Restrict)

  @@index([tenantId, propertyEngagementId, createdAt])  // existing
  @@index([customOutcomeLabelId])                       // NEW
}
```

### Indexes catalog

| Table | Index | Purpose | FR |
|---|---|---|---|
| `tenant_movement_outcome_labels` | unique `(tenantId, label)` | Idempotency + collision | FR-5, FR-13 |
| `tenant_movement_outcome_labels` | `(tenantId, deletedAt)` | Fast active-only list | FR-5, FR-14, NFR perf |
| `tenant_movement_outcome_labels` | `(createdByUserId)` | Delete-by-creator authorization | FR-15 |
| `movements` | `(customOutcomeLabelId)` | FK lookup for `onDelete: Restrict` | FR-16 |

### Case-insensitive uniqueness

Postgres unique indexes are case-sensitive. To enforce FR-7's case-insensitive collision rule we add an app-side lower-case lookup before insert (`findFirst where label mode insensitive`). The DB unique index is the safety net for exact-case races; the app lookup handles the casing rule. Migrating to a functional unique index `LOWER(label)` is out of scope for this slice.

### Migration order

1. `prisma migrate dev --name add_movement_outcomes` generates:
   - `CREATE TYPE "MovementBuiltInOutcome"`
   - `CREATE TABLE "tenant_movement_outcome_labels"` + indexes
   - `ALTER TABLE "movements" ADD COLUMN "builtInOutcome"`, `"customOutcomeLabelId"`
   - FK + new index on `movements`.
2. Reversible: a single `migrate resolve --rolled-back` reverts because all changes are additive and nullable. No data back-fill is required (FR-29).

---

## API design

### Endpoint catalog

| Method | Path | Auth | Roles | Body / Query | Response | Error codes |
|---|---|---|---|---|---|---|
| POST | `/property-engagements/:engagementId/movements` (extended) | Auth + TenantMembership + Permission `MOVEMENTS_CREATE` | AGENT, MANAGER, PRINCIPAL_MANAGER | `CreateMovementDto` (adds `outcome`) | `MovementResponse` (adds `builtInOutcome`, `customOutcomeLabel`) | 400 invalid DTO; 403 missing perm; 404 engagement not found; 422 invalid/cross-tenant label |
| POST | `/tenants/me/movement-outcome-labels` | Auth + TenantMembership + Permission `MOVEMENTS_OUTCOME_LABELS_MANAGE` | AGENT, MANAGER, PRINCIPAL_MANAGER | `CreateLabelDto { label: string; color?: string }` | `MovementOutcomeLabelResponse` | 400 invalid DTO; 403 missing perm; 422 collides with built-in / max-length / invalid color |
| GET | `/tenants/me/movement-outcome-labels?activeOnly=true` | Auth + TenantMembership + Permission `TENANT_VIEW` | All tenant roles | `ListLabelsQuery { activeOnly?: boolean }` | `MovementOutcomeLabelResponse[]` | 403 missing perm |
| DELETE | `/tenants/me/movement-outcome-labels/:labelId` | Auth + TenantMembership + Permission `MOVEMENTS_OUTCOME_LABELS_MANAGE` | Creator or MANAGER/PRINCIPAL_MANAGER (checked in use case) | — | 204 No Content | 403 not creator and not manager; 404 not found in tenant; 409 already deleted |

### Request shapes

```ts
// CreateMovementDto (extended)
{
  type: MovementType
  observation: string                  // existing
  nextStep?: string                    // existing
  // NEW — exactly-one or absent:
  outcome?:
    | { builtIn: MovementBuiltInOutcome }
    | { customLabelId: string }        // uuid
  // No newStatus here for outcome-only path — see FR-11.
  // newStatus stays in the DTO for the existing STATUS_CHANGE flow but is mutually
  // exclusive with `outcome` (enforced in DTO with a custom validator).
}

// CreateLabelDto
{
  label: string         // trimmed before validation, 1..40
  color?: string        // /^#[0-9A-Fa-f]{6}$/ (R3)
}
```

### Response shape (extended movement)

```ts
{
  id, tenantId, propertyEngagementId, type, observation, nextStep,
  previousStatus, newStatus, source, interestCount, visitCount,
  offerAmountCents, interestLevel,
  builtInOutcome: MovementBuiltInOutcome | null,
  customOutcomeLabel: {
    id: string
    label: string
    color: string | null
    deletedAt: string | null      // ISO if soft-deleted (FR-24)
  } | null,
  createdBy: { id, email, firstName },
  createdAt: string
}
```

### Error envelope

All errors keep the existing Nest exception filter shape `{ statusCode, message, errorCode? }`. New `errorCode` literals:

| Code | Mapped HTTP | Meaning |
|---|---|---|
| `OUTCOME_BOTH_PROVIDED` | 422 | Both `builtIn` and `customLabelId` provided |
| `OUTCOME_LABEL_NOT_FOUND` | 422 | Label missing, deleted, or cross-tenant |
| `LABEL_NAME_COLLIDES_BUILTIN` | 422 | FR-7 collision |
| `LABEL_NAME_TOO_LONG` | 422 | FR-7 length |
| `LABEL_COLOR_INVALID` | 422 | R3 invalid hex |
| `LABEL_ALREADY_DELETED` | 409 | DELETE on already soft-deleted row |

---

## BFF design

### Route files

| File | Method | Behavior |
|---|---|---|
| `app/api/products/[id]/movements/route.ts` | POST (extended) | Validate `outcome.color` if present (defensive — BFF posts `outcome` but the color lives on the label, not the movement; this guard catches a future regression where the form sends color in the outcome payload). Forward via `bffFetch`. |
| `app/api/tenants/me/movement-outcome-labels/route.ts` | GET, POST | Thin passthrough + zod-validated `color` on POST (R3). |
| `app/api/tenants/me/movement-outcome-labels/[labelId]/route.ts` | DELETE | Thin passthrough. |

### Validation library

`zod` (already used across BFF; see `features/products/schemas/movement.ts`). The shared schema:

```ts
export const labelColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex.')
```

### Error normalization

The BFF translates upstream non-2xx into the existing `proxyJsonResponse(response)` envelope and falls back to a Spanish user message on network errors (matches today's `'No se pudo agregar la actualización de la propiedad.'` pattern).

### TanStack Query keys

```ts
export const movementOutcomeLabelsKeys = {
  all: ['movement-outcome-labels'] as const,
  list: (params: { activeOnly: boolean }) =>
    [...movementOutcomeLabelsKeys.all, 'list', params] as const,
}
```

Mutations (`createLabel`, `deleteLabel`) invalidate `movementOutcomeLabelsKeys.all` and the engagement-scoped movements query key.

---

## UI design

### Component composition

```
CreatePropertyMovementDialog
 ├─ MovementTypeSelect (existing)
 ├─ MovementOutcomeCombobox (NEW)
 │    ├─ Section "Sugeridos" — built-in outcomes (always first)
 │    ├─ Section "De tu inmobiliaria" — active custom labels
 │    └─ Action "+ Agregar etiqueta" → opens inline form (gated by role)
 │
 ├─ MovementOutcomeCreateLabelForm (NEW, inline; appears under combobox)
 │    ├─ Input "Nombre" (max 40)
 │    ├─ Color picker (optional)
 │    ├─ Buttons "Cancelar" | "Crear etiqueta"
 │
 ├─ ObservationTextarea (existing)
 ├─ NextStepTextarea (existing)
 └─ StatusSelect (existing, MUST stay disabled when outcome is set — see Spec deltas)
```

### Combobox order (FR-20)

1. Built-in outcomes (es-AR translated labels in `constants/movement-outcome-options.ts`).
2. Active custom labels ordered by `label` ascending.
3. Trailing action `+ Agregar etiqueta` (hidden for owners and `viewpro_admin`; here "owners" maps to `PropertyAssetOwner`, not a tenant role — see Spec deltas).

### Optimistic update strategy (label creation)

On submit of the inline form:

1. Call `createLabel` mutation.
2. On success, push the new label into the TanStack `list` cache via `setQueryData`, set the combobox value to that label's id, and collapse the inline form.
3. On collision (HTTP 200, idempotent path), API returns the existing record; cache writer dedupes by id.
4. On error, keep the inline form open with the error message; do not close the movement dialog.

The movement form itself does not use optimistic UI for the create-movement call (matches today's `isSubmitting` pattern; explicit feedback is preferred over silent rollback).

### Accessibility

| Element | Requirement |
|---|---|
| Combobox | `role="combobox"`, `aria-expanded`, `aria-controls`, keyboard nav (Up/Down/Enter/Esc), `aria-label="Resultado del movimiento"`. |
| Inline form | Focus trap while open, focus returns to `+ Agregar etiqueta` action on close. |
| Chip | Color contrast guard: when `color` is set, compute YIQ luminance; if contrast against the chip background fails WCAG AA, fall back to neutral chip background and render the color as a left-border accent. Implemented in `movement-outcome-chip.tsx`. |
| Chip styling | Outlined variant (`Badge variant='outline'`) to enforce FR-25 visual distinction from filled status badge. |

### Feed chip (FR-23, FR-24, FR-25)

- Renders next to the `MovementType` badge in `MovementHistoryItem`.
- Built-in outcomes use a label dictionary; custom labels render `label.label` and apply `label.color` via the contrast-guarded chip.
- Soft-deleted labels render the same chip with a subtle strikethrough or italic style and `aria-label="Etiqueta archivada"` for screen readers.

---

## R1 strategy — Pure builder for the no-status invariant

**Decision: option (c)** — extract a thin pure function `buildMovementCreatePayload` that produces the exact Prisma `data` object the repository will pass to `prisma.movement.create`. Assert directly that the returned payload contains no `newStatus`, no `previousStatus`, and no nested `propertyEngagement.update`.

### File and signature

```ts
// viewpro-app/apps/api/src/movements/use-cases/build-movement-create-payload.ts
import type { Prisma } from '@prisma/client'
import type { CreateMovementDto } from '../dto/create-movement.dto'

export type BuildMovementCreatePayloadInput = {
  tenantId: string
  propertyEngagementId: string
  createdByUserId: string
  engagementCurrentStatus: PropertyEngagementStatus
  dto: CreateMovementDto
}

export type BuildMovementCreatePayloadResult = {
  movementData: Prisma.MovementUncheckedCreateInput
  statusUpdate: { newStatus: PropertyEngagementStatus } | null
}

export function buildMovementCreatePayload(
  input: BuildMovementCreatePayloadInput,
): BuildMovementCreatePayloadResult
```

### Why this option

| Option | Tradeoff | Verdict |
|---|---|---|
| (a) Port-style repo + mock | Already partially exists, but mocking the entire repo to assert "no status mutation" still requires a stub for `prisma.propertyEngagement.update`. Indirect. | rejected |
| (b) Integration with real DB snapshot | Slow, requires DB up, couples invariant to migration state. Useful for one happy-path integration test (S-6), but not for the focused unit test FR-11 demands. | rejected as primary |
| (c) Pure payload builder | Zero IO, deterministic, asserts the invariant by static inspection of the produced shape. Aligns with strict-TDD. | chosen |

### Test sketch (FR-11)

```ts
it('never produces a status update when outcome is set', () => {
  const result = buildMovementCreatePayload({
    /* ...,*/
    dto: { type: 'GENERAL_UPDATE', observation: 'x', outcome: { builtIn: 'EN_CAPTACION' } },
  })
  expect(result.statusUpdate).toBeNull()
  expect(result.movementData.newStatus).toBeUndefined()
  expect(result.movementData.previousStatus).toBeUndefined()
})
```

A complementary integration test (S-6) confirms the wire path stays clean against a real DB.

---

## R2 strategy — Idempotency under races + soft-delete edge

### Decision

1. **Race handling:** Catch Prisma error code `P2002` on `prisma.tenantMovementOutcomeLabel.create`, then re-query `findFirst({ where: { tenantId, label: { equals, mode: 'insensitive' }, deletedAt: null } })` and return that row.
2. **Retry budget:** **No retry.** A single `P2002` + re-query is sufficient because the unique index is `(tenantId, label)` and the deleted-row case is excluded from the active-only re-query.
3. **HTTP envelope:** API always returns **HTTP 200** with the active row (matches FR-13). The BFF passes the upstream status through. No 409 in the happy path; 409 is reserved for the DELETE-on-already-deleted case.
4. **Soft-delete same-name edge:** If a soft-deleted label with the same name exists (`deletedAt != null`), **create a new row** rather than restoring. Justification:
   - The unique index is `(tenantId, label)`; allowing two rows with the same `label` (one active, one deleted) requires the unique to be **partial** on `deletedAt IS NULL`.
   - **Partial unique index addition:** `@@unique([tenantId, label])` is replaced with a raw migration step that drops the plain unique and creates a partial unique:
     `CREATE UNIQUE INDEX tenant_movement_outcome_labels_active_tenant_label_key ON tenant_movement_outcome_labels (tenantId, label) WHERE deletedAt IS NULL;`
   - Prisma does not natively express partial indexes; the migration uses a raw SQL block right after `prisma migrate` generates the plain unique.
   - This makes "restore" semantically wrong: a deleted label is archival; the new row gets a fresh `id`, `createdAt`, and `createdByUserId`.

### Pseudocode

```ts
async create(input): Promise<Label> {
  validate(input)  // name length, collision with built-ins
  try {
    return await prisma.tenantMovementOutcomeLabel.create({ data: { ... } })
  } catch (e) {
    if (isPrismaP2002(e, target: 'tenant_movement_outcome_labels_active_tenant_label_key')) {
      const existing = await prisma.tenantMovementOutcomeLabel.findFirst({
        where: { tenantId, label: { equals: input.label, mode: 'insensitive' }, deletedAt: null },
      })
      if (existing) return existing
    }
    throw e  // any other error bubbles
  }
}
```

### Test sketch (FR-13, S-3, S-12)

Mock the repo's `create` to throw `P2002` on first call; assert use case re-queries and returns the existing row with no second `create` attempt.

---

## R3 strategy — Color validation on both BFF and API

### Decision

**Both layers validate.** The API does not trust the BFF because direct API consumers exist (Postman, Supertest integration tests, future native mobile client).

### Implementation

| Layer | Library | Constraint |
|---|---|---|
| BFF | `zod` `.regex(/^#[0-9A-Fa-f]{6}$/)` | Rejects with 400 before forwarding |
| API DTO | `class-validator` `@Matches(/^#[0-9A-Fa-f]{6}$/)` | Rejects with 400 from the global ValidationPipe |

`class-validator`'s built-in `@IsHexColor()` accepts `#RGB`, `#RRGGBB`, and `#RRGGBBAA`. The spec mandates exactly `#RRGGBB` (FR-8, FR-4), so we use `@Matches` with the explicit regex instead of `@IsHexColor`. Justification: tighter spec, no surprise 4-digit or 8-digit colors leaking into the DB.

```ts
// dto/create-label.dto.ts
export class CreateLabelDto {
  @IsString() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Length(1, 40)
  label!: string

  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string
}
```

---

## Authorization rules

| Operation | Permission | Notes |
|---|---|---|
| Create movement with outcome | `MOVEMENTS_CREATE` | unchanged; outcome is an additive field |
| Create label | `MOVEMENTS_OUTCOME_LABELS_MANAGE` (NEW) | granted to AGENT, MANAGER, PRINCIPAL_MANAGER |
| List labels | `TENANT_VIEW` | all tenant roles |
| Delete label | `MOVEMENTS_OUTCOME_LABELS_MANAGE` + creator or MANAGER+ | use case checks `label.createdByUserId === currentUser.id OR role in (MANAGER, PRINCIPAL_MANAGER)` |

Cross-tenant rejection (FR-26, S-7, S-8): every repo method takes `tenantId` from `TenantContext` and filters at the query level. Cross-tenant attempts return `404` (not 403) to avoid leaking existence.

---

## Spec deltas required

The proposal/spec use product vocabulary that does not match the codebase. Flagging here for `sdd-tasks` to fold into a spec patch before implementation:

1. **Role names:** spec says "seller" and "owner". Codebase enum is `TenantRole = { PRINCIPAL_MANAGER, MANAGER, AGENT }`. Mapping:
   - "seller" → `AGENT`
   - "manager" → `MANAGER` or `PRINCIPAL_MANAGER`
   - "owner" — there is NO `OWNER` `TenantRole`. The proposal's "owner" likely means `PropertyAssetOwner` (the external property owner, accessed via `OwnerInvitation`), who has no movement-creation surface. FR-22 and S-9 need rewording to say "users without a tenant membership (external property owners) cannot reach this UI" or "users whose only role is `viewpro_admin` (global) and have no `TenantMembership` cannot reach this UI".
2. **`newStatus` + `outcome` mutual exclusion:** FR-11 says the outcome path never writes status, but the existing DTO retains `newStatus`. The design enforces that `outcome` and `newStatus` cannot coexist on the same request. Spec should state this explicitly as a new FR or extend FR-11.
3. **HTTP code for invalid label color:** spec implies 422; class-validator defaults to 400. Choose 400 (standard Nest default) and document.
4. **HTTP code for cross-tenant FK:** FR-10 mandates 422; design honors this via a use-case-level check (not class-validator).

These deltas are blocking only insofar as the tasks file should reference them; they do not change the architecture.

---

## Non-goals

Inherited from proposal § Out of scope, plus:

- No label management screen, no bulk edit, no analytics on outcomes.
- No mutation of `MovementType`, `PropertyEngagementStatus`, or any enum value.
- No back-fill of historical movements with default outcomes.
- No retry-with-backoff on label creation races (single re-query is enough).
- No partial unique index migration to functional `LOWER(label)`; case-insensitive collision is handled app-side (cheaper for MVP).
- No optimistic UI on movement creation itself.
- No real-time push of new labels to other sellers' open dropdowns (a TanStack stale-while-revalidate refetch is sufficient).
- No localization beyond es-AR for built-in outcome display labels.

---

## Rollout & rollback

### Rollout order

1. Apply Prisma migration (`add_movement_outcomes`) on `viewpro_test`, run `pnpm --filter @viewpro/api db:validate`.
2. Apply the partial unique index via raw SQL migration step (still inside the same `migrate dev` invocation).
3. Deploy API change (additive DTO, new module, extended use case).
4. Deploy BFF + UI in the same release because the form expects the new field.
5. Optionally seed a handful of demo custom labels via `scripts/seed-demo.mjs` (out of scope for this slice's required evidence, but allowed).

### Offline vs. manual

| Step | Mode |
|---|---|
| Prisma migration | offline, idempotent, fast |
| Partial unique index | offline, part of the migration |
| API/BFF/UI deploy | standard CI |
| Seed update | optional, manual via existing seed script |

### Rollback

The migration is fully reversible because every change is additive. Drop order: `Movement.customOutcomeLabelId` FK → `Movement.builtInOutcome` column → `tenant_movement_outcome_labels` table → `MovementBuiltInOutcome` enum. Existing movements without outcomes remain untouched. No data migration needed.

Reference: proposal § Rollback.

---

## Risks

| # | Risk | Mitigation | Owner phase |
|---|---|---|---|
| D-1 | Partial unique index requires raw SQL outside Prisma schema; future Prisma diffs may try to re-create the plain unique. | Add a comment in the migration file and a check in `db:validate` script to skip the affected index. | tasks/apply |
| D-2 | `@Matches` regex on color in DTO will return HTTP 400, but spec scenarios may assume 422. | Standardize on 400 for format errors and 422 for semantic errors (cross-tenant FK, collisions). Document in OpenAPI. | tasks |
| D-3 | Combobox + inline form accessibility regression in `CreatePropertyMovementDialog`. | RTL test for focus trap and Esc behavior in `create-property-movement-dialog.test.tsx`. | apply |
| D-4 | Chip color contrast may render unreadable text for badly chosen seller colors. | Contrast guard with WCAG AA fallback in `movement-outcome-chip.tsx`. | apply |
| D-5 | Proposal/spec vocabulary mismatch with codebase (`seller`, `owner`). | Spec deltas section above; `sdd-tasks` writes a spec patch task at the top. | tasks |
| D-6 | Soft-delete + same-name creation could surprise sellers expecting "restore" semantics. | UX copy on the inline form: "Si ya existía una etiqueta con ese nombre, se reactivará." replaced with "Si ya existía y fue archivada, se creará una nueva." | apply |

---

## Verification mapping

| FR | Test type | File hint |
|---|---|---|
| FR-1 to FR-6 | Prisma schema snapshot + `db:validate` | `prisma/schema.prisma`, CI |
| FR-7 | Unit (pure) | `movement-outcome-labels/use-cases/validate-label-name.spec.ts` |
| FR-8 | Unit (DTO) + BFF zod | DTO spec + BFF route spec |
| FR-9, FR-10 | Use-case unit with mocked repo | `create-movement.use-case.spec.ts` |
| FR-11 | Pure builder unit | `build-movement-create-payload.spec.ts` |
| FR-12, FR-15 | Use-case unit | `create-label.use-case.spec.ts`, `delete-label.use-case.spec.ts` |
| FR-13 | Use-case unit + Supertest | covers S-3, S-12 |
| FR-14 | Supertest integration | label list endpoint |
| FR-16 | Repo unit + FK constraint | `prisma-movement-outcome-labels.repository.spec.ts` |
| FR-17, FR-18 | BFF route spec | new route specs |
| FR-19 to FR-22 | RTL on dialog | `create-property-movement-dialog.test.tsx` (extend) |
| FR-23 to FR-25 | RTL on history + chip | `movement-outcome-chip.test.tsx`, history spec |
| FR-26, FR-27 | Supertest cross-tenant | `movement-outcome-labels.controller.spec.ts` |
| FR-28, FR-29 | Supertest backwards compat + migration snapshot | API test + Prisma migrate |
| S-1..S-15 | Mix of unit/integration/Playwright seeded | per scenario in tasks |

---

## Open questions

None. Spec deltas above are flagged for resolution at `sdd-tasks` time, not blocking.
