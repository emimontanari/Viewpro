# Proposal — Stage 20.13 Movement Outcomes and Custom Tenant Labels

**Status:** proposed, ready to enter SDD `sdd-spec` after acceptance.
**Origin:** product alignment 2026-06-14 — split between "official property state" (governance, low-frequency) and "movement outcome" (operational, high-frequency labelling by sellers).
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md` — new sub-slice in Phase B; runs before `20.10` (state change request workflow) so the manager has richer per-movement context when approving state changes.

## Slice contract

```txt
Stage: 20
Slice: 20.13 — Movement outcomes and custom tenant labels
Objective: let sellers label every movement they record with an outcome that describes the operational status of that activity, without affecting the official property state.
Evidence needed: API/BFF/UI/tests for choosing a built-in outcome, creating a custom tenant-scoped label, listing movements with their outcome, and confirming the property official state does not move.
Do not touch: PropertyEngagementStatus enum, status mutation guards, the 20.10 approval workflow, or any seed/migration outside this slice.
Done: a seller can mark every new movement with a built-in or tenant-custom outcome; the manager sees those outcomes in the movement feed; the property official state never changes as a side effect.
Next slice: 20.10 — State change request workflow.
```

## Problem

Today `MovementType` carries both the activity family (visit, inquiry, offer) and an implicit lifecycle hint (`VISIT_SCHEDULED` vs `VISIT_COMPLETED`), but the lifecycle is fragmented across types and there is no way to record the seller's narrative about the work-in-progress state of a property without changing its official status.

The product decision is to separate two clearly different responsibilities:

1. **Official property state** (`PropertyEngagementStatus`) — formal, low-frequency, gated by Cuenta Madre approval (delivered in `20.10`).
2. **Movement outcome** — high-frequency, freely chosen by the seller when they record an activity, never moves the property state.

This slice ships the second responsibility.

## Scope

- New enum `MovementBuiltInOutcome` with values that mirror the property states as labels (not as state mutations):
  - `EN_CAPTACION`
  - `DOCUMENTACION_PENDIENTE`
  - `PREPARANDO_PUBLICACION`
  - `PUBLICACION_ACTIVA`
  - `CONSULTAS_Y_VISITAS`
  - `NEGOCIACION_OFERTA`
  - `RESERVA_INICIADA`
  - `DOCUMENTACION_FINAL`
  - `CERRADO`
  - `CANCELADO`
- New table `TenantMovementOutcomeLabel` for per-tenant custom labels: `id, tenantId, label, color?, createdByUserId, createdAt, deletedAt`. Soft-deletable so historical movements keep a stable reference. Unique `(tenantId, label)` index. Index on `(tenantId, deletedAt)`.
- New nullable columns on `Movement`: `builtInOutcome` (`MovementBuiltInOutcome?`) and `customOutcomeLabelId` (FK to `TenantMovementOutcomeLabel?`). A movement may have neither, one, or — by convention enforced in the use case — never both.
- Use-case rule: setting an outcome **never** writes to `PropertyEngagement.status` and **never** creates a `Movement` with `type = STATUS_CHANGE`.
- API:
  - Extend the existing create-movement endpoint to accept `outcome` (`{ builtIn: enum }` or `{ customLabelId: uuid }`).
  - New `POST /tenants/me/movement-outcome-labels` to create a custom label (open to any tenant member with the seller role or higher; not gated on Cuenta Madre).
  - New `GET /tenants/me/movement-outcome-labels?activeOnly=true` to list active custom labels for the dropdown.
  - New `DELETE /tenants/me/movement-outcome-labels/:id` for soft delete (only the creating user or a manager).
- BFF:
  - `apps/app-new/src/app/api/products/[id]/movements` POST accepts the outcome payload.
  - `apps/app-new/src/app/api/tenants/me/movement-outcome-labels/` CRUD-lite for labels.
- UI:
  - Movement creation form (seller side) gets an `Outcome` field after the type selector, presented as a combobox: built-in outcomes first, custom labels next, a final `+ Agregar etiqueta` option that opens a small inline form (label text + optional color hex). Submitting creates the label and selects it for the current movement.
  - Movement feed entries render the outcome as a coloured chip next to the existing type label.
  - Manager view inherits the same chip; no new manager-side workflow in this slice.

## Custom-label rules

- **Who can create:** any user with `TenantRole.AGENT`, `MANAGER`, or `PRINCIPAL_MANAGER` on the tenant. Users with no `TenantMembership` (e.g. `PropertyAssetOwner` via invitation) and the global `VIEWPRO_ADMIN` without a `TenantMembership` cannot create labels.
- **Scope:** per tenant. Labels are shared across the inmobiliaria; sellers see every active label of their tenant.
- **Naming:** label string trimmed, max length 40 characters, must not collide with the built-in enum names (case-insensitive) and must be unique per tenant.
- **Color:** optional CSS hex (`#RRGGBB`); ignored on the API side beyond storage and validated on the BFF.
- **Soft delete:** when a label is deleted, existing movements keep the FK reference. The deleted label no longer appears in the dropdown. A label cannot be hard-deleted while referenced.

## Out of scope

- The state change request workflow (lives in `20.10`).
- Mutating `MovementType`, `PropertyEngagementStatus`, or any existing enum value.
- Tenant-wide settings UI for managing labels in a dedicated admin screen. The MVP only ships in-context creation from the movement form and soft-delete via API. A management screen can come later.
- Outcomes for owner-side actions, document uploads, or system-generated movements; only seller-authored manual movements get outcomes.
- Analytics dashboards based on outcomes.

## Affected areas

- `viewpro-app/apps/api/prisma/schema.prisma` (enum + table + Movement columns + migration).
- `viewpro-app/apps/api/src/movements/` (use case, controller, DTO updates).
- `viewpro-app/apps/api/src/tenants/` or `viewpro-app/apps/api/src/movement-outcome-labels/` (new module).
- `viewpro-app/apps/app-new/src/app/api/products/[id]/movements/` (BFF passthrough).
- `viewpro-app/apps/app-new/src/app/api/tenants/me/movement-outcome-labels/` (new BFF).
- `viewpro-app/apps/app-new/src/features/products/` movement form + feed component.
- `viewpro-app/apps/api/scripts/seed-demo.mjs` (seed a handful of example custom labels for the demo tenant, optional).
- Unit + integration + Playwright seeded smoke updates.

## Safety and integrity constraints

- The use case must never write to `PropertyEngagement.status` as a side effect of setting an outcome. A focused unit test asserts this directly.
- Authorization at the API: only seller or manager of the tenant can create/delete labels; the create-movement endpoint already enforces tenant membership.
- Tenant isolation: every label query filters by `tenantId` from the authenticated session; cross-tenant reads must 404.
- Idempotency: creating a duplicate label (case-insensitive, same tenant) returns the existing record instead of erroring loudly.
- Backwards compatibility: outcome is **optional**. Existing movements without an outcome continue to render (no chip).

## Risks

- Label proliferation. Mitigation: 40-character cap, unique per-tenant index, and a soft-delete path. If proliferation becomes a real problem in pilot, a future slice adds a label management screen.
- Confusion between outcome and official state. Mitigation: the proposal makes the separation explicit; the UI never shows the outcome chip styled like a state badge.
- Migration of historical movements. None required — the new columns are nullable; existing rows keep working.
- Concurrent label creation across sellers. Mitigation: unique constraint + idempotency on create.

## Rollback

Revert the schema migration (drop the new columns and table, drop the enum), revert API/BFF/UI changes, revert seeded labels. No production data depends on this slice yet, so rollback is safe. Existing movements without outcomes remain untouched.

## Success criteria

- A seller can record a movement and pick a built-in outcome from a dropdown.
- A seller can create a custom label inline from the same dropdown and have it stick for that tenant.
- The manager sees movements with the outcome chip in the feed.
- Property official state never changes as a side effect of outcome selection (asserted by test).
- Existing seeded smoke remains green; a new seeded scenario covers create-label + create-movement-with-custom-label + read-back.
- API rejects label creation from non-seller roles, cross-tenant reads, and duplicate names.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted.
