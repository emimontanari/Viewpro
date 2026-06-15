# Spec — Stage 20.13 Movement Outcomes and Custom Tenant Labels

**Status:** draft  
**Input artifact:** `openspec/changes/20-13-movement-outcomes/proposal.md`  
**Accepted design points:** Engram observation #4102 (2-layer model, Layer 3 rejected)

---

## Slice Contract

| Field | Value |
|---|---|
| Stage | 20 |
| Slice | 20.13 — Movement outcomes and custom tenant labels |
| Objective | Let sellers label every movement with an outcome that describes the operational status of that activity, without affecting the official property state. |
| Evidence needed | API/BFF/UI/tests for built-in outcome, custom label creation, movement feed with outcome chip, and proof that `PropertyEngagement.status` never mutates. |
| Do not touch | `PropertyEngagementStatus` enum, existing status mutation guards, the 20.10 approval workflow, any seed/migration outside this slice. |
| Done | A seller can mark any new movement with a built-in or custom outcome; the manager sees outcome chips in the feed; the property official state never changes as a side effect. |
| Next slice | 20.10 — State change request workflow |

---

## Functional Requirements

### Area 1 — Built-In Outcomes

**FR-1** The system MUST expose a `MovementBuiltInOutcome` enum with exactly 10 values:
`EN_CAPTACION`, `DOCUMENTACION_PENDIENTE`, `PREPARANDO_PUBLICACION`, `PUBLICACION_ACTIVA`,
`CONSULTAS_Y_VISITAS`, `NEGOCIACION_OFERTA`, `RESERVA_INICIADA`, `DOCUMENTACION_FINAL`,
`CERRADO`, `CANCELADO`.
*Trace: proposal § Scope — new enum*

**FR-2** The `Movement` model MUST gain a nullable column `builtInOutcome: MovementBuiltInOutcome?`.
*Trace: proposal § Scope — Movement columns*

**FR-3** A movement MAY have one built-in outcome, one custom label, or neither. It MUST NOT carry both simultaneously. This constraint is enforced at the use-case layer.
*Trace: proposal § Scope — convention enforced in the use case*

### Area 2 — Custom Tenant Labels

**FR-4** A new table `TenantMovementOutcomeLabel` MUST have columns: `id (uuid)`, `tenantId`, `label (string, max 40 chars)`, `color (string?, CSS hex #RRGGBB)`, `createdByUserId`, `createdAt`, `deletedAt (nullable)`.
*Trace: proposal § Scope — new table*

**FR-5** The table MUST have a unique index on `(tenantId, label)` and a non-unique index on `(tenantId, deletedAt)`.
*Trace: proposal § Scope — indexes*

**FR-6** The `Movement` model MUST gain a nullable FK column `customOutcomeLabelId` referencing `TenantMovementOutcomeLabel`.
*Trace: proposal § Scope — Movement columns*

**FR-7** A label's `label` value MUST be trimmed, at most 40 characters, unique per tenant (case-insensitive), and MUST NOT equal any `MovementBuiltInOutcome` value (case-insensitive).
*Trace: proposal § Custom-label rules — Naming*

**FR-8** A label's `color` field, when present, MUST match the pattern `^#[0-9A-Fa-f]{6}$`. Validation occurs in the BFF; the API stores the raw value.
*Trace: proposal § Custom-label rules — Color*

### Area 3 — Movement Creation with Outcome

**FR-9** The create-movement API endpoint MUST accept an optional `outcome` field: either `{ builtIn: MovementBuiltInOutcome }` or `{ customLabelId: uuid }`. When absent, the movement is created with no outcome.
*Trace: proposal § Scope — API extend create-movement*

**FR-10** When `customLabelId` is provided and the referenced label is soft-deleted or belongs to a different tenant, the API MUST reject the request with 422 Unprocessable Entity.
*Trace: proposal § Safety constraints — tenant isolation*

**FR-11** The create-movement use case MUST NOT write to `PropertyEngagement.status` and MUST NOT create a movement of type `STATUS_CHANGE` as a side effect of setting an outcome. This constraint MUST be asserted by a dedicated unit test.
*Trace: proposal § Safety constraints — critical invariant; Engram #4102 — hard rule*

### Area 4 — Label Management API

**FR-12** `POST /tenants/me/movement-outcome-labels` creates a custom label. Only users with role `seller` or `manager` on the tenant are authorized. `owner` and `viewpro_admin` receive 403.
*Trace: proposal § Custom-label rules — Who can create; proposal § Scope — API*

**FR-13** Creating a label with a name that already exists for the same tenant (case-insensitive) MUST return the existing active record (HTTP 200) instead of an error. If the matching record is soft-deleted, a new record MUST be created.
*Trace: proposal § Safety constraints — Idempotency*

**FR-14** `GET /tenants/me/movement-outcome-labels?activeOnly=true` returns only non-deleted labels for the authenticated user's tenant, ordered by `label` ascending.
*Trace: proposal § Scope — API list*

**FR-15** `DELETE /tenants/me/movement-outcome-labels/:id` performs a soft delete (`deletedAt = now()`). Only the creating user or a manager of the tenant may call this endpoint. A 404 is returned for labels not belonging to the tenant.
*Trace: proposal § Scope — API soft delete*

**FR-16** A label MUST NOT be hard-deleted at any point through this slice's API surface.
*Trace: proposal § Custom-label rules — Soft delete*

### Area 5 — BFF

**FR-17** `POST apps/app-new/src/app/api/products/[id]/movements` MUST proxy the `outcome` field to the API transparently, validating `color` format before forwarding.
*Trace: proposal § Scope — BFF*

**FR-18** BFF endpoints under `apps/app-new/src/app/api/tenants/me/movement-outcome-labels/` MUST implement the create, list, and soft-delete operations as thin passthroughs plus BFF-side color validation (FR-8).
*Trace: proposal § Scope — BFF*

### Area 6 — UI (Movement Form)

**FR-19** The movement creation form MUST include an `Outcome` field rendered as a combobox, appearing after the `MovementType` selector.
*Trace: proposal § Scope — UI*

**FR-20** The combobox MUST list built-in outcomes first, followed by active custom labels for the tenant, followed by a `+ Add label` action item. The field is optional; the form is valid without an outcome.
*Trace: proposal § Scope — UI dropdown*

**FR-21** Selecting `+ Add label` MUST open an inline form (within the same modal/panel) with a text input (max 40 chars) and an optional color picker. Submitting the inline form calls the create-label endpoint, then selects the new label and closes the inline form without closing the movement form.
*Trace: proposal § Scope — UI inline creation*

**FR-22** The `+ Add label` inline form MUST NOT be accessible to `owner` or `viewpro_admin` roles. For those roles the combobox still shows built-in outcomes and existing custom labels (read-only list), but the add-label action is hidden.
*Trace: proposal § Custom-label rules — Who can create*

### Area 7 — Movement Feed UI

**FR-23** Each movement feed entry MUST render the outcome (built-in or custom label) as a coloured chip positioned next to the existing `MovementType` label. When no outcome is set, no chip is rendered.
*Trace: proposal § Scope — movement feed chip*

**FR-24** The chip for a soft-deleted custom label MUST still render with the label's stored text and color so historical movements remain informative.
*Trace: proposal § Custom-label rules — Soft delete*

**FR-25** The outcome chip MUST NOT be styled identically to the `PropertyEngagementStatus` badge (different visual design to avoid confusion).
*Trace: proposal § Risks — confusion between outcome and official state*

### Area 8 — Authorization and Tenant Isolation

**FR-26** All label endpoints enforce the authenticated user's `tenantId` from session. Cross-tenant label reads or mutations MUST return 404.
*Trace: proposal § Safety constraints — Tenant isolation*

**FR-27** The create-movement endpoint already enforces tenant membership (existing guard, not changed); this slice does not loosen that guard.
*Trace: proposal § Scope — API note*

### Area 9 — Backwards Compatibility

**FR-28** `outcome` is optional everywhere. Existing movements without an outcome continue to render without a chip and remain valid.
*Trace: proposal § Safety constraints — Backwards compatibility*

**FR-29** The migration adds nullable columns; no back-fill is required for historical rows.
*Trace: proposal § Rollback*

---

## Acceptance Scenarios

| # | Scenario | Given | When | Then |
|---|---|---|---|---|
| S-1 | Seller picks built-in outcome | Auth'd seller on a tenant with an active engagement | POST create-movement with `outcome: { builtIn: "CONSULTAS_Y_VISITAS" }` | 201, movement has `builtInOutcome = CONSULTAS_Y_VISITAS`, `customOutcomeLabelId = null`, `PropertyEngagement.status` unchanged |
| S-2 | Seller creates custom label inline | Seller with no prior custom labels | POST `/tenants/me/movement-outcome-labels` with `{ label: "Esperando documentos", color: "#FF5733" }` | 200/201, label stored with `deletedAt = null`; label appears in GET list |
| S-3 | Two sellers create same label simultaneously | Two sellers on same tenant, no existing label "Esperando doc" | Both POST the same label at the same time | Exactly one DB row is created; both responses return that row with HTTP 200 |
| S-4 | Manager sees outcome chip in feed | Movement with `builtInOutcome = EN_CAPTACION` exists | Manager fetches movement feed for a property | Feed entry includes an outcome chip labelled "EN_CAPTACION" |
| S-5 | Soft-deleted label not in dropdown | Custom label "Old tag" is soft-deleted | Seller opens the outcome combobox | "Old tag" does not appear in the active list; but existing movements that reference it still display the chip with "Old tag" text |
| S-6 | Outcome never moves property status | Engagement with status `CAPTURE` | POST create-movement with any `outcome` value | `PropertyEngagement.status` remains `CAPTURE`; no `STATUS_CHANGE` movement is created |
| S-7 | Cross-tenant label access denied | Seller belongs to Tenant A | GET `/tenants/me/movement-outcome-labels` with session of Tenant A | Only Tenant A labels returned; Tenant B labels are never present |
| S-8 | Cross-tenant label FK rejected | Seller on Tenant A | POST create-movement with `customLabelId` belonging to Tenant B | 422 Unprocessable Entity |
| S-9 | Owner cannot create label | Auth'd owner visiting the movement form | Submits `+ Add label` inline form (UI hidden, but also tested at API) | UI hides the action; direct POST to API returns 403 |
| S-10 | 40-char label cap enforced | Seller | POST create-label with `label` length 41 | 422 with validation error |
| S-11 | Label name collision with built-in | Seller | POST create-label with `label = "EN_CAPTACION"` (any casing) | 422 — name collides with a built-in outcome |
| S-12 | Duplicate label returns existing | Label "Espera doc" active for tenant | POST create-label with `label = "Espera doc"` | HTTP 200 + same record returned; no duplicate row |
| S-13 | Movement without outcome backwards compat | Legacy movement (no outcome columns set) | GET movement feed | Entry renders without a chip; no error |
| S-14 | Soft-delete by non-owner, non-manager | Seller A created label; Seller B tries to delete it | DELETE `/tenants/me/movement-outcome-labels/:id` by Seller B (not manager) | 403 |
| S-15 | Manager can delete any tenant label | Manager role on tenant | DELETE any label in the tenant | 200; label `deletedAt` set; label absent from future GET list |

---

## Non-Functional Notes

| Area | Requirement |
|---|---|
| Performance | The label list endpoint (`GET ?activeOnly=true`) must use the `(tenantId, deletedAt)` index; no full-table scans. Expected label count per tenant is small (< 200) so no pagination is required for MVP. |
| Observability | The create-label and create-movement-with-outcome use cases MUST emit their existing analytics events without modification; no new analytics events in this slice. |
| Accessibility | The outcome combobox MUST be keyboard-navigable and announce the selected outcome via `aria-label`. The inline add-label form MUST trap focus while open and return focus to the trigger on close. |
| Visual distinction | The outcome chip MUST use a distinct design token (e.g. outlined style) compared to the filled `PropertyEngagementStatus` badge to prevent seller/manager confusion. |

---

## Open Questions

None. All design decisions were resolved in the product alignment session on 2026-06-14 and recorded in Engram observation #4102.
