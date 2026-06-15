# Apply Progress — Stage 20.13 PR 1 (Schema + API + Tests)

**Branch:** `feat/stage-20-13-pr-1-schema-api-tests`
**Status:** complete
**Last updated:** 2026-06-15

## Tasks

- [x] **T-1** — Spec/proposal vocabulary patch: replaced `seller`/`owner`/`manager` with `AGENT`/`MANAGER / PRINCIPAL_MANAGER`/no-TenantMembership in `spec.md` and `proposal.md`.
- [x] **T-2** — Added FR-30 (newStatus + outcome mutual exclusion, HTTP 422 OUTCOME_BOTH_PROVIDED) to `spec.md`.
- [x] **T-3** — Added HTTP 400 vs 422 convention table to `design.md`. 400 = format/ValidationPipe; 422 = semantic/domain.
- [x] **T-4** — Added `MovementBuiltInOutcome` enum (10 values), `TenantMovementOutcomeLabel` model, and 2 nullable columns on `Movement` to `schema.prisma`. DB validate passes.
- [x] **T-5** — Migration `20260615003659_add_movement_outcomes` generated. Partial unique index `tenant_movement_outcome_labels_active_tenant_label_key` appended as raw SQL with comment block. Applied to both `viewpro` and `viewpro_test` databases.
- [x] **T-6** — Extended `CreateMovementDto` with `outcome?: MovementOutcome` and custom `@IsMutuallyExclusiveOutcome()` validator enforcing FR-30. Unit tests GREEN (6 cases). Also added `MOVEMENTS_OUTCOME_LABELS_MANAGE` permission to `permissions.constants.ts` and granted to `AGENT`, `MANAGER`, `PRINCIPAL_MANAGER` in `role-permissions.ts`.
- [x] **T-7** — Pure builder `buildMovementCreatePayload` at `src/movements/use-cases/build-movement-create-payload.ts`. Unit tests GREEN (5 cases asserting FR-11 invariant: no status mutation when outcome is set).
- [x] **T-8** — Full `movement-outcome-labels` module: module, controller, repository port + Prisma adapter (P2002/R2 idempotency), use cases (create/list/delete), DTOs, response mapper, constants. Module registered in `app.module.ts`. Unit tests GREEN (14 cases).
- [x] **T-9** — Extended `CreateMovementUseCase` to use builder (R1), validate cross-tenant FK (FR-10), and inject `MovementOutcomeLabelsRepository`. Extended `MovementsRepository` types and `PrismaMovementsRepository` to include outcome fields and `customOutcomeLabel` include. Updated `movement.response.ts` to include outcome fields. Updated `movements.module.ts` to import `MovementOutcomeLabelsModule`. Updated existing use-case tests (16 cases, GREEN).
- [x] **T-10** — Integration tests (`movement-outcome-labels.e2e-spec.ts`): 10 tests covering S-1/S-2/S-3/S-5/S-6/S-7/S-8/S-9/S-12/S-14/S-15. All GREEN. Also added `errorCode` passthrough to `GlobalExceptionFilter`.
- [x] **T-17** — Validation gate: `db:validate` ✓, `typecheck` ✓, full `pnpm --filter @viewpro/api test` ✓ (50 files / 575 tests). Partial unique index confirmed present in `pg_indexes`.

## Key files

| File | Change |
|---|---|
| `openspec/changes/20-13-movement-outcomes/spec.md` | FR vocab patch, FR-30 added |
| `openspec/changes/20-13-movement-outcomes/proposal.md` | Role vocab patch |
| `openspec/changes/20-13-movement-outcomes/design.md` | HTTP 400/422 table added |
| `viewpro-app/apps/api/prisma/schema.prisma` | New enum, model, Movement columns |
| `viewpro-app/apps/api/prisma/migrations/20260615003659_add_movement_outcomes/migration.sql` | Migration + partial unique index |
| `viewpro-app/apps/api/src/permissions/permissions.constants.ts` | MOVEMENTS_OUTCOME_LABELS_MANAGE added |
| `viewpro-app/apps/api/src/permissions/role-permissions.ts` | New permission granted to AGENT/MANAGER/PM |
| `viewpro-app/apps/api/src/movements/dto/create-movement.dto.ts` | outcome field + mutual exclusion validator |
| `viewpro-app/apps/api/src/movements/use-cases/build-movement-create-payload.ts` | NEW pure builder (R1) |
| `viewpro-app/apps/api/src/movements/use-cases/create-movement.use-case.ts` | Integrated builder, cross-tenant FK check |
| `viewpro-app/apps/api/src/movements/movements.repository.ts` | CreateMovementInput + types extended |
| `viewpro-app/apps/api/src/movements/prisma-movements.repository.ts` | outcome fields in create/include |
| `viewpro-app/apps/api/src/movements/responses/movement.response.ts` | builtInOutcome + customOutcomeLabel |
| `viewpro-app/apps/api/src/movements/movements.module.ts` | Imports MovementOutcomeLabelsModule |
| `viewpro-app/apps/api/src/movement-outcome-labels/` | NEW module (11 files) |
| `viewpro-app/apps/api/src/app.module.ts` | MovementOutcomeLabelsModule registered |
| `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts` | errorCode passthrough |
| `viewpro-app/apps/api/src/common/errors/api-error-response.ts` | errorCode field added |
| `viewpro-app/apps/api/test/build-movement-create-payload.spec.ts` | NEW — 5 unit tests |
| `viewpro-app/apps/api/test/create-movement-dto.spec.ts` | NEW — 6 unit tests |
| `viewpro-app/apps/api/test/movement-outcome-labels.use-cases.spec.ts` | NEW — 14 unit tests |
| `viewpro-app/apps/api/test/movement-outcome-labels.e2e-spec.ts` | NEW — 10 integration tests |
| `viewpro-app/apps/api/test/movements.use-cases.spec.ts` | Updated — +3 new tests (16 total) |

## Learned / Gotchas

1. **Partial unique index via raw SQL:** Prisma cannot express partial unique indexes. The plain `@@unique` was intentionally omitted from the schema; the migration SQL has the raw `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL` appended manually. Future `prisma migrate dev` runs will NOT drop this index (Prisma only manages indexes it tracks). Applied manually to test DB since `migrate deploy` picked it up from the SQL.
2. **P2002 idempotency is in the Prisma adapter, not the use case:** The `P2002` catch + re-query lives in `PrismaMovementOutcomeLabelsRepository.create`, not the use case. Unit tests for the use case should mock the adapter returning the existing row directly.
3. **TenantRole real values:** `{ PRINCIPAL_MANAGER, MANAGER, AGENT }`. No `OWNER` tenant role. "owner" in spec means `PropertyAssetOwner` (external, no TenantMembership).
4. **GlobalExceptionFilter errorCode passthrough:** The filter strips `errorCode` from exception bodies by default. Added explicit passthrough so `OUTCOME_LABEL_NOT_FOUND`, `OUTCOME_BOTH_PROVIDED`, etc. appear in API responses.
5. **`CreateMovementUseCase` now has 5 constructor args** (added `MovementOutcomeLabelsRepository`). All unit tests updated to pass `mockLabelsRepository as never`.
6. **Movement.customOutcomeLabel relation** requires `customOutcomeLabel: true` in all Prisma `include` objects in `prisma-movements.repository.ts` (both `movementInclude` and `activityMovementInclude`).
7. **`@IsMutuallyExclusiveOutcome` validator decorates the `outcome` field** with `@ValidateIf` to trigger only when `outcome` or `newStatus` is present, avoiding false positives on plain movements.

## PR 2 dependency notes

- BFF routes (`/api/products/[id]/movements` POST, `/api/tenants/me/movement-outcome-labels/*`) depend on these API endpoints being live.
- `MovementBuiltInOutcome` enum values and their es-AR display labels for `constants/movement-outcome-options.ts` in the UI.
- The chip component (FR-23/FR-24/FR-25) needs `builtInOutcome` and `customOutcomeLabel` from the movement response — both now surfaced.
