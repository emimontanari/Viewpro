# Tasks — Stage 20.13 Movement Outcomes and Custom Tenant Labels

One-line summary: ship a thin, additive outcome layer on top of `movements` across schema → API → BFF → UI → tests, split into two chained PRs to stay under the 400-line review budget.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | 810–1 060 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 — schema + API + unit/integration tests; PR 2 — BFF + UI + seed + smoke |
| Chain strategy | `stacked-to-main` |
| PR 1 target branch | `main` |
| PR 2 base | PR 1 merged (or rebased from `main` + PR 1 commits) |
| Decision needed before apply | No — strategy captured here; `sdd-apply` follows it |

---

## Phase 0 — Pre-implementation patches (blocking)

> These tasks patch artifacts ONLY. No source code changes. All implementation tasks depend on T-1 being done.

### T-1 — Patch spec/proposal: align role vocabulary with `TenantRole` enum

**Depends on:** nothing  
**Blocks:** all implementation tasks  
**Estimated lines:** 0 (artifact edit only)

- [ ] Read `viewpro-app/apps/api/prisma/schema.prisma` and confirm `TenantRole = { PRINCIPAL_MANAGER, MANAGER, AGENT }` with no `OWNER` variant.
- [ ] In `spec.md` and `proposal.md`, replace every occurrence of "seller" with `AGENT`, "manager" with `MANAGER / PRINCIPAL_MANAGER`, and clarify that "owner" in FR-22 / S-9 refers to users with no `TenantMembership` (e.g. `PropertyAssetOwner` via invitation) or global `VIEWPRO_ADMIN`, not a `TenantRole`.
- [ ] Update FR-12 to read: "Only users with `TenantRole.AGENT`, `MANAGER`, or `PRINCIPAL_MANAGER` are authorized."
- [ ] Update FR-22 to read: "The `+ Add label` action is hidden for sessions where the user holds no tenant membership or holds only global `VIEWPRO_ADMIN` with no `TenantMembership`."
- [ ] Update S-9 accordingly.
- [ ] Definition of done: `spec.md` contains no raw "seller" / "owner" / "manager" strings outside of quoted UI copy.

### T-2 — Add spec delta: `newStatus + outcome` mutual exclusion

**Depends on:** T-1  
**Blocks:** T-6 (DTO task)  
**Estimated lines:** 0 (artifact edit only)

- [ ] Add FR-30 to `spec.md`: "A `CreateMovement` request MUST NOT carry both `outcome` and `newStatus` simultaneously. When both are present, the API MUST reject the request with 422 (`OUTCOME_BOTH_PROVIDED`)."
- [ ] Update the error-codes table in `design.md` to confirm `OUTCOME_BOTH_PROVIDED → 422`.
- [ ] Definition of done: `spec.md` contains FR-30 and references the custom validator in `CreateMovementDto`.

### T-3 — Add spec/design delta: HTTP 400 vs 422 convention

**Depends on:** T-1  
**Blocks:** T-6, T-8, T-9  
**Estimated lines:** 0 (artifact edit only)

- [ ] Append a "HTTP error code convention" section to `design.md`: format/syntax errors from `class-validator` → 400; semantic/domain errors (cross-tenant FK, built-in collision, `OUTCOME_BOTH_PROVIDED`) → 422.
- [ ] Confirm existing error codes table in `design.md` maps accordingly: `LABEL_NAME_TOO_LONG` → 400 (DTO), `LABEL_COLOR_INVALID` → 400 (DTO), all semantic codes → 422.
- [ ] Definition of done: `design.md` has a clear table mapping each `errorCode` to its HTTP status and which layer produces it.

---

## PR 1 — Schema + API + unit/integration tests

> Target branch: `main`. Estimated: ~490–570 changed lines.

### T-4 — Prisma schema: add enum, table, and Movement columns

**Depends on:** T-1  
**TDD cycle:** RED → run `pnpm --filter @viewpro/api db:validate` and expect type errors; GREEN → schema compiles; REFACTOR → verify migration is additive  
**Estimated lines:** ~80

- [ ] Add `MovementBuiltInOutcome` enum (10 values from FR-1) to `schema.prisma`.
- [ ] Add `TenantMovementOutcomeLabel` model with columns from FR-4: `id`, `tenantId`, `label`, `color?`, `createdByUserId`, `createdAt`, `deletedAt`.
- [ ] Add relations: `Tenant`, `User (createdBy)`, `Movement[] @relation("MovementCustomOutcomeLabel")`.
- [ ] Add `@@index([tenantId, deletedAt])` and `@@index([createdByUserId])`.
- [ ] Do NOT add `@@unique([tenantId, label])` here — the partial unique index replaces it (see T-5).
- [ ] Add `builtInOutcome MovementBuiltInOutcome?` and `customOutcomeLabelId String?` nullable columns to `Movement`.
- [ ] Add `customOutcomeLabel TenantMovementOutcomeLabel? @relation(...)` and `@@index([customOutcomeLabelId])` to `Movement`.
- [ ] Run `pnpm --filter @viewpro/api db:validate` to confirm schema compiles.
- [ ] Definition of done: `db:validate` passes and `prisma generate` produces types for both new columns.

### T-5 — Migration: generate + add partial unique index with comment block

**Depends on:** T-4  
**TDD cycle:** RED → migration missing; GREEN → `prisma migrate dev` succeeds  
**Estimated lines:** ~30 (migration file)

- [ ] Run `pnpm --filter @viewpro/api prisma migrate dev --name add_movement_outcomes` to generate the migration SQL.
- [ ] Open the generated migration file and append a raw SQL block that drops the auto-generated plain unique (if Prisma added one) and creates the partial unique: `CREATE UNIQUE INDEX tenant_movement_outcome_labels_active_tenant_label_key ON tenant_movement_outcome_labels ("tenantId", "label") WHERE "deletedAt" IS NULL;`
- [ ] Add a comment block directly above the raw SQL explaining: purpose (allow same label name after soft-delete), why Prisma cannot express this natively, and that future `migrate dev` runs must NOT drop this index.
- [ ] Run `db:validate` again post-migration; confirm the partial index survives.
- [ ] Definition of done: migration file contains the partial index raw SQL with comment; `db:validate` passes.

### T-6 — API: extend `CreateMovementDto` with `outcome` field and mutual-exclusion validator

**Depends on:** T-2, T-3  
**TDD cycle:** RED → unit test fails (FR-30, validator absent); GREEN → validator in place  
**Estimated lines:** ~40

- [ ] Add `outcome?: { builtIn: MovementBuiltInOutcome } | { customLabelId: string }` to `CreateMovementDto` in `viewpro-app/apps/api/src/movements/dto/create-movement.dto.ts`.
- [ ] Add `@ValidateIf` or a custom `@ValidateOutcomeMutualExclusion()` class-validator decorator that returns 422 (`OUTCOME_BOTH_PROVIDED`) when both `builtIn` and `customLabelId` are present simultaneously.
- [ ] Add `@ValidateIf` enforcing that `newStatus` and `outcome` cannot coexist (FR-30).
- [ ] Write RED unit test `create-movement.dto.spec.ts`: assert validator rejects `{ outcome: { builtIn: ..., customLabelId: ... } }` with errorCode `OUTCOME_BOTH_PROVIDED`.
- [ ] Definition of done: unit test GREEN; `typecheck` passes.

### T-7 — API: pure builder `buildMovementCreatePayload`

**Depends on:** T-4  
**TDD cycle:** RED → builder absent, tests fail; GREEN → builder implemented  
**Estimated lines:** ~60

- [ ] Create `viewpro-app/apps/api/src/movements/use-cases/build-movement-create-payload.ts` with the signature from design.md R1 strategy.
- [ ] Write RED unit tests in `build-movement-create-payload.spec.ts`:
  - [ ] `outcome: { builtIn }` → payload has `builtInOutcome`, `customOutcomeLabelId = null`, `statusUpdate = null` (FR-11).
  - [ ] `outcome: { customLabelId }` → payload has `customOutcomeLabelId`, `builtInOutcome = null`, `statusUpdate = null`.
  - [ ] No outcome → both fields null.
  - [ ] `newStatus` path → `statusUpdate` is non-null and neither outcome field is present.
- [ ] Implement builder to make tests GREEN.
- [ ] Definition of done: all four unit tests pass; `statusUpdate` and `movementData` shapes verified by assertion.

### T-8 — API: `movement-outcome-labels` module (create + list + delete)

**Depends on:** T-4, T-5, T-3  
**TDD cycle:** RED per use case → GREEN per use case  
**Estimated lines:** ~250

- [ ] Create `viewpro-app/apps/api/src/movement-outcome-labels/` folder with:
  - `movement-outcome-labels.module.ts`
  - `movement-outcome-labels.controller.ts` (POST, GET, DELETE endpoints per design.md endpoint catalog)
  - `dto/create-label.dto.ts` — `@Transform` trim, `@Length(1, 40)`, `@IsOptional @Matches(/^#[0-9A-Fa-f]{6}$/)` (R3; 400 on format error)
  - `dto/list-labels.query.ts` — `activeOnly?: boolean`
  - `movement-outcome-labels.repository.ts` — pure interface + DI symbol
  - `prisma-movement-outcome-labels.repository.ts` — Prisma adapter with `P2002` catch + re-query (R2)
  - `use-cases/create-label.use-case.ts` — idempotency logic, case-insensitive collision check, forbidden-built-in-name check (FR-7), 422 on collision with built-in
  - `use-cases/list-labels.use-case.ts` — returns active-only or all per query param (FR-14)
  - `use-cases/delete-label.use-case.ts` — authorization check (creator OR MANAGER/PRINCIPAL_MANAGER), soft-delete, 409 if already deleted (FR-15, S-14, S-15)
  - `responses/movement-outcome-label.response.ts`
  - `constants/built-in-outcome-names.ts` — `Set<string>` of all 10 enum values (lowercased)
- [ ] Add new permission constant `MOVEMENTS_OUTCOME_LABELS_MANAGE` and grant to `AGENT`, `MANAGER`, `PRINCIPAL_MANAGER` role grants (locate the role-grant constants file in the API).
- [ ] Wire `MovementOutcomeLabelsModule` into the app root module.
- [ ] Write RED unit tests:
  - `create-label.use-case.spec.ts`: label name collision with built-in → 422; length > 40 → 400; idempotent → returns existing; P2002 + re-query → returns row; soft-deleted same name → new row created (S-3, S-10, S-11, S-12).
  - `delete-label.use-case.spec.ts`: non-creator non-manager → 403; already deleted → 409; manager can delete any → 204 (S-14, S-15).
  - `list-labels.use-case.spec.ts`: soft-deleted label excluded from `activeOnly=true` list (S-5).
- [ ] Definition of done: all unit tests GREEN; `typecheck` passes.

### T-9 — API: extend `CreateMovementUseCase` + `PrismaMovementsRepository`

**Depends on:** T-6, T-7  
**TDD cycle:** RED → cross-tenant + no-status tests fail; GREEN → use case updated  
**Estimated lines:** ~80

- [ ] Integrate `buildMovementCreatePayload` into `CreateMovementUseCase.execute` — replace inline payload construction.
- [ ] Add cross-tenant FK validation: before calling repository, verify `customLabelId` belongs to `tenantId` and is not soft-deleted; throw 422 `OUTCOME_LABEL_NOT_FOUND` otherwise (FR-10, S-8).
- [ ] Update `prisma-movements.repository.ts` to pass `builtInOutcome` and `customOutcomeLabelId` in the `prisma.movement.create` call; include `customOutcomeLabel` in the response select.
- [ ] Update `movement.response.ts` to include `builtInOutcome` and `customOutcomeLabel` fields.
- [ ] Write RED use-case unit tests: cross-tenant `customLabelId` → 422; soft-deleted label → 422; no outcome → movement created with null fields (FR-9, FR-10, S-1, S-6, S-8).
- [ ] Definition of done: unit tests GREEN; `typecheck` passes.

### T-10 — Integration tests: label CRUD + idempotency + cross-tenant wire

**Depends on:** T-8, T-9  
**TDD cycle:** RED integration → GREEN  
**Estimated lines:** ~80

- [ ] Write Supertest integration test `movement-outcome-labels.controller.spec.ts`:
  - [ ] POST create label → 201; GET list → label present (S-2).
  - [ ] POST same label twice (HTTP client, real DB) → second call returns 200 + same record (S-3, S-12).
  - [ ] DELETE label → 200; GET list with `activeOnly=true` → label absent (S-5).
  - [ ] GET list from different tenant session → Tenant B labels never present (S-7).
  - [ ] POST create-movement with `customLabelId` from other tenant → 422 (S-8).
  - [ ] POST create-label as `VIEWPRO_ADMIN` with no tenant membership → 403 (S-9).
- [ ] Write Supertest test `movements.controller.spec.ts` extension:
  - [ ] POST create-movement with `builtIn: CONSULTAS_Y_VISITAS` → 201, verify `PropertyEngagement.status` unchanged (S-6).
  - [ ] GET movement returns `builtInOutcome` field (S-4 partial).
- [ ] Definition of done: all integration tests GREEN with `viewpro_test` DB; `pnpm --filter @viewpro/api test` passes.

---

## PR 2 — BFF + UI + seed + smoke

> Base: PR 1 merged. Target: `main`. Estimated: ~320–490 changed lines.

### T-11 — BFF: extend create-movement route + new label routes

**Depends on:** T-1 (for role vocabulary in session type guards), PR 1 merged  
**TDD cycle:** RED → BFF route tests fail; GREEN → routes implemented  
**Estimated lines:** ~120

- [x] Extend `viewpro-app/apps/app-new/src/app/api/products/[id]/movements/route.ts` POST handler: parse `outcome` from request body, validate `color` via `labelColorSchema` if `outcome.color` appears (defensive), forward to API via `bffFetch`.
- [x] Create `viewpro-app/apps/app-new/src/app/api/tenants/me/movement-outcome-labels/route.ts`:
  - `GET` — passthrough; forward `activeOnly` query param.
  - `POST` — validate `color` with `labelColorSchema` (zod, R3 BFF guard) before forwarding; return upstream status.
- [x] Create `viewpro-app/apps/app-new/src/app/api/tenants/me/movement-outcome-labels/[labelId]/route.ts`:
  - `DELETE` — thin passthrough.
- [x] Export `labelColorSchema` from `viewpro-app/apps/app-new/src/features/products/schemas/movement.ts`.
- [x] Write BFF route unit tests (mock `bffFetch`): color validation rejects invalid hex (R3); valid payload forwards; DELETE passes `labelId`.
- [x] Add TanStack Query keys `movementOutcomeLabelsKeys` to `viewpro-app/apps/app-new/src/features/products/api/queries.ts`.
- [x] Add `createLabel`, `listLabels`, `deleteLabel` client functions to `viewpro-app/apps/app-new/src/features/products/api/service.ts`.
- [x] Extend `viewpro-app/apps/app-new/src/features/products/api/types.ts` with `MovementOutcomeLabelDto`, `CreateLabelPayload`, outcome fields on `MovementDto`.
- [x] Definition of done: BFF unit tests GREEN; `typecheck` passes; `lint:strict` passes.

### T-12 — UI: `MovementOutcomeCombobox` + `MovementOutcomeCreateLabelForm`

**Depends on:** T-11  
**TDD cycle:** RED RTL → GREEN  
**Estimated lines:** ~120

- [x] Create `viewpro-app/apps/app-new/src/features/products/components/movement-outcome-combobox.tsx`:
  - Built-in section (from `constants/movement-outcome-options.ts` — new file with es-AR display labels for all 10 values).
  - Custom labels section from `listLabels` query.
  - Trailing `+ Agregar etiqueta` action item (hidden when user has no `TenantMembership` or is `VIEWPRO_ADMIN` without membership — FR-22, S-9).
  - `role="combobox"`, `aria-expanded`, `aria-controls`, keyboard navigation (Up/Down/Enter/Esc), `aria-label="Resultado del movimiento"` (NFR accessibility).
- [x] Create `viewpro-app/apps/app-new/src/features/products/components/movement-outcome-create-label-form.tsx`:
  - Text input (max 40 chars), optional color picker.
  - On submit: call `createLabel` mutation → on success push to cache via `setQueryData`, set combobox value, collapse inline form.
  - On collision (HTTP 200 idempotent path): dedupe by id.
  - On error: keep form open with error message.
  - Focus returns to `+ Agregar etiqueta` on cancel (NFR accessibility).
- [x] Create `constants/movement-outcome-options.ts` with `{ value: MovementBuiltInOutcome; label: string }[]` (10 es-AR display strings).
- [x] Write RTL tests in `movement-outcome-combobox.test.tsx`:
  - Renders built-in outcomes; custom labels appear after fetch; `+ Agregar etiqueta` hidden when role check fails (S-9).
- [x] Definition of done: RTL tests GREEN; `typecheck` passes.

### T-13 — UI: `MovementOutcomeChip` with autocontrast helper + unit test

**Depends on:** T-11  
**TDD cycle:** RED Vitest unit → GREEN → REFACTOR (aria labels)  
**Estimated lines:** ~60

- [x] Create `viewpro-app/apps/app-new/src/features/products/components/movement-outcome-chip.tsx`:
  - `Badge variant="outline"` to visually distinguish from filled status badge (FR-25).
  - When `color` is set, compute YIQ luminance; pick white or black text based on WCAG AA threshold (luminance ≥ 128 → black text, < 128 → white text).
  - Soft-deleted custom labels: render with `aria-label="Etiqueta archivada"` and italic/strikethrough style (FR-24).
  - When no outcome is set, render nothing (FR-28).
- [x] Write Vitest unit tests in `movement-outcome-chip.test.tsx`:
  - Light color (#FFFFFF) → black text chosen.
  - Dark color (#000000) → white text chosen.
  - Mid-range (≥ threshold) → falls back cleanly.
  - `deletedAt` set → aria label present.
  - No outcome → renders null / empty.
- [x] Definition of done: 11 unit tests GREEN; Badge variant='outline'; no `PropertyEngagementStatus` badge styles reused.

### T-14 — UI: integrate combobox into `CreatePropertyMovementDialog` + feed chip

**Depends on:** T-12, T-13  
**TDD cycle:** RED RTL → GREEN  
**Estimated lines:** ~70

- [x] In `viewpro-app/apps/app-new/src/features/products/components/create-property-movement-dialog.tsx`:
  - Import and mount `MovementOutcomeCombobox` after the `MovementTypeSelect`.
  - Wire combobox value into the form state; include `outcome` in the submit payload.
  - When `outcome` is set, disable `StatusSelect` if present (FR-11 UI guard; design.md note).
  - Extend movement zod schema (`schemas/movement.ts`) with `outcome` field validation + `decodeOutcome` helper.
- [x] In `viewpro-app/apps/app-new/src/features/products/components/property-movement-history.tsx`:
  - Render `MovementOutcomeChip` next to the `MovementType` badge for each movement (FR-23, FR-24, FR-25).
  - When `builtInOutcome` is set, pass the es-AR display label from `movement-outcome-options.ts`; when `customOutcomeLabel` is set, pass its `label` and `color`.
- [x] Write RTL test extension for `create-property-movement-dialog.test.tsx`:
  - Outcome combobox visible.
  - Selecting built-in outcome includes it in the submit payload.
- [x] Definition of done: 4 RTL tests GREEN; `lint:strict` passes; 383 total unit tests passing.

### T-15 — Seed: add 3 demo custom labels to `seed-demo.mjs`

**Depends on:** T-5 (migration applied in test env)  
**Estimated lines:** ~30

- [x] In `viewpro-app/apps/api/scripts/seed-demo.mjs`, add after the tenant is created:
  - `{ label: "Esperando documentos", color: "#3B82F6" }` — demo blue
  - `{ label: "En negociación avanzada", color: "#F59E0B" }` — demo amber
  - `{ label: "Propietario no responde", color: "#EF4444" }` — demo red
- [x] Use upsert by deterministic id so seed is idempotent on re-run.
- [x] Associate `createdByUserId` with the `martin.demo@viewpro.local` (AGENT) user.
- [x] resetDemoTenant cleans tenantMovementOutcomeLabel before re-seeding.
- [x] Definition of done: seed runs without error; prints "Custom outcome labels: 3".

### T-16 — Playwright smoke: extend seeded smoke test

**Depends on:** T-14, T-15  
**Estimated lines:** ~80

- [x] In `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`, added new test block:
  - Log in as `martin.demo@viewpro.local`.
  - Navigate to first assigned product's detail page.
  - Select built-in outcome `CONSULTAS_Y_VISITAS`, fill observation, submit → assert "Consultas y visitas" chip visible in feed.
  - Open dialog again → click `+ Agregar etiqueta` → create label "Smoke test label" with color `#10B981` → submit → assert chip visible.
- [x] FR-11 gate: GET `/api/products/:id` before and after, assert `status` unchanged.
- [x] Definition of done: test added; seeded E2E will validate on next run with live servers.

---

## T-17 — Gate: `db:validate` smoke after migration

**Depends on:** T-5  
**Sequencing:** run after T-5, before any PR 1 merge

- [ ] Run `pnpm --filter @viewpro/api db:validate` against `viewpro_test`.
- [ ] Confirm the partial unique index `tenant_movement_outcome_labels_active_tenant_label_key` is present in `pg_indexes` (can be verified via a quick `psql` query or in a one-off integration test).
- [ ] If a subsequent `prisma migrate dev --name anything` is simulated, confirm the partial index is NOT dropped (Prisma should not manage raw indexes it did not create).
- [ ] Definition of done: smoke assertions pass; the check is recorded in the PR 1 description.

---

## Acceptance Checklist

Maps each acceptance scenario from `spec.md` to the task that proves it. All items must be checked before marking this change `done`.

| Scenario | Scenario title | Proved by |
|---|---|---|
| S-1 | Seller picks built-in outcome | T-9 unit + T-10 integration |
| S-2 | Seller creates custom label inline | T-8 unit + T-10 integration |
| S-3 | Two sellers create same label simultaneously | T-8 unit (P2002 mock) + T-10 integration |
| S-4 | Manager sees outcome chip in feed | T-10 integration + T-16 smoke |
| S-5 | Soft-deleted label not in dropdown | T-8 unit (list use case) + T-10 integration |
| S-6 | Outcome never moves property status | T-7 unit (pure builder) + T-10 integration + T-16 smoke (status invariant check) |
| S-7 | Cross-tenant label access denied | T-10 integration |
| S-8 | Cross-tenant label FK rejected | T-9 unit + T-10 integration |
| S-9 | Non-tenant user cannot create label | T-8 unit + T-10 integration + T-12 RTL (UI gate) |
| S-10 | 40-char label cap enforced | T-8 unit (create use case) |
| S-11 | Label name collision with built-in | T-8 unit (create use case) |
| S-12 | Duplicate label returns existing | T-8 unit + T-10 integration |
| S-13 | Movement without outcome backwards compat | T-13 unit (chip null branch) + T-16 smoke (legacy movements) |
| S-14 | Soft-delete by non-creator non-manager | T-8 unit (delete use case) |
| S-15 | Manager can delete any tenant label | T-8 unit (delete use case) + T-10 integration |
| — | No spec drift: FR vocabulary uses `TenantRole` enum values | T-1 patch |
| — | `newStatus + outcome` mutual exclusion stated in spec | T-2 patch |
| — | HTTP 400/422 convention documented | T-3 patch |
| — | Partial unique index survives future migrations | T-5 + T-17 |
| — | Chip WCAG AA contrast | T-13 unit |

---

## Dependency graph

```
T-1 ──┬──────────────────────────────── T-4 ── T-5 ── T-17
      │                                  │
      ├── T-2 ──────────────────────┬── T-6 ── T-9 ──┐
      │                             │                  ├── T-10
      └── T-3 ──────────────────────┘  T-7 ──────────┘
                                        T-8 ──────────┘
                                   [PR 1 merged]
                                        │
                        ┌───────────────┼──────────────┐
                        T-11            T-15            │
                        │                               │
                    ┌───┴────┐                          │
                   T-12    T-13                         │
                    └───┬────┘                          │
                        T-14 ─────────── T-16 ─────────┘
```

Tasks T-6, T-7, T-8, and T-9 can proceed in parallel once T-1–T-3 and T-4 are done. T-11, T-12, T-13 can proceed in parallel after PR 1 merges. T-15 requires the migration to be applied; it is independent of the UI tasks.
