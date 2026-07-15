# Tasks: Platform Phase 7 Slice 2 Sub-slice A — TENANT REGISTRY (backend)

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions A2–A14 are LOCKED — do not reopen.

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| Backfill lifecycle | Nest standalone command (`NestFactory.createApplicationContext`) — reuses DI (`PlatformTenantRepository`, config, token minting); more reliable than a raw ts-node script |
| `latestStatus` column type | `String` — consistent with `platform_mirror_events.newStatus`; avoids an enum migration; contract union enforces valid values |
| `GET /operators/tenants` item shape | Nested `limits` object `{ maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb }` — mirrors `PlatformTenantRegistryLimits` contract type |
| Internal endpoint batch cap | No hard cap; return all tenants (A13: count is small). Add a `// TODO: add paging if tenant count exceeds 1 000` comment. Document clearly |
| Backfill effect on metrics | `platform_tenants` ONLY — no `platform_mirror_events` backfill; metrics derive from live status-change events (accept #8) |
| `auth.module.ts` → `PlatformDataModule` circularity | Safe: InmoView `PlatformDataModule` imports no `AuthModule`. `auth.module.ts` imports `PlatformDataModule` (exports `PlatformOutboxWriter`) exactly as `admin.module.ts` already does |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850–1 100 (contract package, 2 apps, new models, migration, seed command, tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1, InmoView side) → PR 2 (WU-2, viewpro-api side) → PR 3 (WU-3, backfill + deploy) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | platform-contract union + type assertions + InmoView emit sites + internal GET /internal/platform/tenants endpoint | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/api test` (platform-data spec) | `POST /auth/register` → one `TENANT_REGISTERED` outbox row on test DB; `GET /internal/platform/tenants` valid token → tenant list | Revert emit call in `PrismaAuthRegistrationRepository`; revert contract union; revert internal endpoint; revert SELECT widening in status repo |
| WU-2 | viewpro-api `platform_tenants` migration + ingest event routing + `GET /operators/tenants` | PR 2 (base: PR 1 branch) | `pnpm --filter @viewpro/platform-api test` (platform-data spec) | `GET /operators/tenants` after ingest of `TENANT_REGISTERED` → row returned | Drop `platform_tenants` migration; revert ingest routing; revert `TenantRegistryController` registration |
| WU-3 | Backfill Nest command + coordinated-deploy doc + final verification | PR 3 (base: PR 2 branch) | `pnpm --filter @viewpro/platform-api exec ts-node src/scripts/backfill-platform-tenants.ts` (or nest command invocation) twice → idempotent | Manual run against staging: tenant count before = count after second run | Delete `src/scripts/backfill-platform-tenants.ts`; no DB impact (upsert is a no-op to undo) |

---

## Dependency Graph

```
T-01 (contract: widen eventType union + TenantRegisteredPayload + limits type)
  └── T-02 (RED: compile-time assertions — union, limits fields)
        └── T-03 (GREEN: type assertions in type-assertions.ts)
              └── T-04 (RED: writer unit tests — accepts both input shapes)
                    └── T-05 (GREEN: widen PlatformOutboxWriter OutboxEventInput union)
                          └── T-06 (RED: status-repo SELECT widening + enriched emit unit test)
                                └── T-07 (GREEN: widen SELECT + pass name/slug in TENANT_STATUS_CHANGED emit)
                                      └── T-08 (RED: registration-repo emit unit test — in-tx, rollback)
                                            └── T-09 (GREEN: inject writer into PrismaAuthRegistrationRepository + auth.module.ts import)
                                                  └── T-10 (RED: internal GET /internal/platform/tenants controller tests)
                                                        └── T-11 (GREEN: PlatformTenantsReadRepository + add endpoint to PlatformDataController)
                                                              └── T-12 (RED: platform_tenants migration + model)
                                                                    └── T-13 (GREEN: viewpro-api Prisma schema + additive migration)
                                                                          └── T-14 (RED: ingest routing unit tests — REGISTERED full upsert, STATUS upsert-create-if-missing, unknown skip)
                                                                                └── T-15 (GREEN: MirrorRepository + IngestService event-type branch)
                                                                                      └── T-16 (RED: TenantRegistryController tests — pagination, auth, isolation)
                                                                                            └── T-17 (GREEN: TenantRegistryController + TenantRegistryService + PlatformTenantRepository)
                                                                                                  └── T-18 (GREEN: register in PlatformDataModule + wire platform-data.module.ts)
                                                                                                        └── T-19 (RED: threat-matrix RED tests — token forgery, token confusion, replay, cross-tenant)
                                                                                                              └── T-20 (GREEN: confirm threat mitigations pass)
                                                                                                                    └── T-21 (RED: backfill seed — pull + upsert + idempotent re-run test)
                                                                                                                          └── T-22 (GREEN: Nest backfill standalone command)
                                                                                                                                └── T-23 (coordinated-deploy doc + final verification)
```

---

## WU-1 — platform-contract union + InmoView emit sites + internal tenants endpoint

### [x] T-01 — Widen `platform-contract` data/ with `TENANT_REGISTERED` type union
**Type**: impl
**Spec**: platform-data-lane delta — TENANT_REGISTERED Event Type; tenant-registry — Registration Event
**WU**: WU-1, commit 1
**Depends on**: nothing

- In `packages/platform-contract/src/data/platform-outbox-event.ts`:
  - Add `type PlatformTenantRegistryLimits = { maxUsers: number | null; maxActivePropertyEngagements: number | null; maxDocumentsStorageMb: number | null }`
  - Add `type TenantRegisteredPayload = { id: string; name: string; slug: string; newStatus: PlatformTenantStatus; limits: PlatformTenantRegistryLimits }`
  - Add optional `name?: string; slug?: string` to `TenantStatusChangedPayload` (additive, A3)
  - Widen `PlatformOutboxEvent.eventType` to `'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED'`
  - Widen `PlatformOutboxEvent.payload` to `TenantStatusChangedPayload | TenantRegisteredPayload`
- Export all new types from `packages/platform-contract/src/data/index.ts`

**Exit**: `pnpm --filter @viewpro/platform-contract typecheck` passes; new types importable from both apps.
**Commit**: `feat(platform-contract): widen eventType union + TenantRegisteredPayload + limits type`

---

### [x] T-02 — RED: compile-time assertions — union coverage + limits field mirror
**Type**: test (RED)
**Spec**: platform-data-lane delta — Contract accepts TENANT_REGISTERED as valid eventType; tenant-registry — Registration Event Transactional Emit
**WU**: WU-1, commit 2
**Depends on**: T-01

- In `apps/api/src/platform-data/type-assertions.ts`, add type-level assertions (vitest `expectTypeOf` or `@ts-expect-error`):
  - `TENANT_REGISTERED` is assignable to `PlatformOutboxEvent['eventType']` (positive)
  - `TENANT_STATUS_CHANGED` remains assignable (backward-compat; A3)
  - `PlatformTenantRegistryLimits.maxUsers` ↔ `Tenant.maxUsers` (both `number | null`) — compile check
  - A literal `'UNKNOWN_TYPE'` is NOT assignable (negative via `@ts-expect-error`)

All RED until T-03 implements the assertions.
**Exit**: test file exists; `tsc --noEmit` fails on the negative case without `@ts-expect-error`.
**Commit**: `test(api): RED — compile-time assertions TENANT_REGISTERED union + limits field mirror`

---

### [x] T-03 — GREEN: implement compile-time assertions; confirm typecheck
**Type**: impl
**Spec**: platform-data-lane delta — Contract backward compatibility
**WU**: WU-1, commit 3
**Depends on**: T-02

- Complete assertions in `apps/api/src/platform-data/type-assertions.ts` so all checks pass
- `pnpm --filter @viewpro/api typecheck` and `pnpm --filter @viewpro/platform-api typecheck` must both pass

**Exit**: typecheck GREEN; assertion file compiles with no errors.
**Commit**: `feat(api): GREEN — compile-time type assertions TENANT_REGISTERED union + limits`

---

### [x] T-04 — RED: unit tests — `PlatformOutboxWriter` accepts both input shapes (A5)
**Type**: test (RED)
**Spec**: platform-data-lane delta — TENANT_REGISTERED Event Type; writer union
**WU**: WU-1, commit 4
**Depends on**: T-03

- `apps/api/src/platform-data/__tests__/platform-outbox-writer.spec.ts` (vitest, mocked tx client)
  - `emit(tx, { eventType: 'TENANT_REGISTERED', ... })` calls `tx.platformOutboxEvent.create` with correct fields
  - `emit(tx, { eventType: 'TENANT_STATUS_CHANGED', ... })` still accepted (regression)
  - Both calls still acquire `pg_advisory_xact_lock(OUTBOX_LOCK_KEY)` (lock assertion)

All RED until T-05.
**Exit**: test file exists; all new assertions fail.
**Commit**: `test(api): RED — PlatformOutboxWriter accepts TENANT_REGISTERED + TENANT_STATUS_CHANGED union`

---

### [x] T-05 — GREEN: widen `PlatformOutboxWriter.OutboxEventInput` union (A5)
**Type**: impl
**Spec**: platform-data-lane delta — TENANT_REGISTERED Event Type; A5
**WU**: WU-1, commit 5
**Depends on**: T-04

- In `apps/api/src/platform-data/platform-outbox-writer.ts`:
  - Widen `OutboxEventInput` to `{ eventType: 'TENANT_STATUS_CHANGED'; ... } | { eventType: 'TENANT_REGISTERED'; tenantId: string; payload: TenantRegisteredPayload; occurredAt: string }`
  - `emit` body unchanged (lock + create)
- Confirm T-04 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-04 GREEN; prior writer tests still GREEN.
**Commit**: `feat(api): widen PlatformOutboxWriter OutboxEventInput to union (A5)`

---

### [x] T-06 — RED: unit test — status-repo SELECT widened to name/slug + enriched emit (A3)
**Type**: test (RED)
**Spec**: platform-data-lane delta — Modified Transactional Outbox Write; name and slug read in same tx
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/api/src/platform-data/__tests__/outbox-write-integration.spec.ts` — add assertions:
  - After `updateTenantStatus` → `TENANT_STATUS_CHANGED` outbox row `payload` contains `name` and `slug` matching the tenant's DB values
  - `payload.previousStatus` and `payload.newStatus` are still present (regression)

All RED until T-07.
**Exit**: new assertions fail; prior assertions unchanged.
**Commit**: `test(api): RED — TENANT_STATUS_CHANGED payload enriched with name/slug`

---

### [x] T-07 — GREEN: widen SELECT + pass name/slug in `TENANT_STATUS_CHANGED` emit
**Type**: impl
**Spec**: platform-data-lane delta — Modified Transactional Outbox Write; A3
**WU**: WU-1, commit 7
**Depends on**: T-06

- In `apps/api/src/admin/prisma-admin-tenant-status.repository.ts`:
  - Expand `SELECT ... FOR UPDATE` to also read `name, slug` from the `tenants` table
  - Pass `name` and `slug` into the `PlatformOutboxWriter.emit(...)` payload for `TENANT_STATUS_CHANGED`
- Confirm T-06 GREEN; full admin suite GREEN (regression)

**Exit**: `pnpm --filter @viewpro/api test` — T-06 GREEN; all prior tests GREEN.
**Commit**: `feat(api): widen tenant SELECT + enrich TENANT_STATUS_CHANGED payload with name/slug (A3)`

---

### [x] T-08 — RED: unit test — `PrismaAuthRegistrationRepository` emits `TENANT_REGISTERED` inside tx; rollback ⇒ no emit (A4)
**Type**: test (RED)
**Spec**: tenant-registry — Registration Event Transactional Emit (both scenarios)
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/api/src/auth/__tests__/prisma-auth-registration.repository.spec.ts` (vitest, mocked tx):
  - After successful `registerTenant` tx: `outboxWriter.emit` called once with `eventType='TENANT_REGISTERED'`, correct `tenantId`, full payload fields
  - After rolled-back tx (mock `tenant.create` to throw): `outboxWriter.emit` NOT called

All RED until T-09.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — registration repo emits TENANT_REGISTERED in-tx; rollback ⇒ no emit (A4)`

---

### [x] T-09 — GREEN: inject `PlatformOutboxWriter` into `PrismaAuthRegistrationRepository` + wire `auth.module.ts` (A4)
**Type**: impl
**Spec**: tenant-registry — Registration Event; A4; auth.module.ts import
**WU**: WU-1, commit 9
**Depends on**: T-08

- In `apps/api/src/auth/repositories/prisma-auth-registration.repository.ts`:
  - Inject `PlatformOutboxWriter`; inside the `$transaction` after `tenant.create`, call `await this.outboxWriter.emit(tx, { eventType: 'TENANT_REGISTERED', tenantId: tenant.id, payload: { id: tenant.id, name: tenant.name, slug: tenant.slug, newStatus: tenant.status, limits: { maxUsers: tenant.maxUsers, maxActivePropertyEngagements: tenant.maxActivePropertyEngagements, maxDocumentsStorageMb: tenant.maxDocumentsStorageMb } }, occurredAt: new Date().toISOString() })`
- In `apps/api/src/auth/auth.module.ts`: import `PlatformDataModule` (mirrors `admin.module.ts` pattern)
- Confirm T-08 GREEN; confirm full auth + admin suites GREEN (regression)

**Exit**: `pnpm --filter @viewpro/api test` — T-08 GREEN; all prior tests GREEN.
**Commit**: `feat(api): emit TENANT_REGISTERED in registerTenant $transaction + auth.module.ts import (A4)`

---

### [x] T-10 — RED: controller tests — `GET /internal/platform/tenants` (A13)
**Type**: test (RED)
**Spec**: tenant-registry — Backfill InmoView Internal Tenants Endpoint (both scenarios)
**WU**: WU-1, commit 10
**Depends on**: T-09

- `apps/api/src/platform-data/__tests__/platform-data.controller.spec.ts` — add assertions:
  - Valid service token + `GET /internal/platform/tenants` → 200 with `{ tenants: [{ id, name, slug, status, limits }] }` for all tenants in test DB
  - Missing / invalid service token → 401
  - Endpoint is read-only: no `platform_outbox_events` rows written

All RED until T-11.
**Exit**: new assertions fail; existing change-feed tests unchanged.
**Commit**: `test(api): RED — GET /internal/platform/tenants (valid token returns tenants; 401 on invalid)`

---

### [x] T-11 — GREEN: `PlatformTenantsReadRepository` + add endpoint to `PlatformDataController`
**Type**: impl
**Spec**: tenant-registry — Backfill InmoView Internal Tenants Endpoint; A13
**WU**: WU-1, commit 11
**Depends on**: T-10

- Create `apps/api/src/platform-data/platform-tenants-read.repository.ts`: `@Injectable() PlatformTenantsReadRepository` — `findAll()` reads all tenants (`id, name, slug, status, maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb`) from `prisma.tenant.findMany()`; read-only. Add a `// TODO: add paging if tenant count exceeds 1 000` comment.
- In `apps/api/src/platform-data/platform-data.controller.ts`: add `@Get('tenants') @UseGuards(PlatformControlGuard) getTenants()` returning `{ tenants: [...] }` shaped to `PlatformTenantRegistryLimits`
- Register `PlatformTenantsReadRepository` in `apps/api/src/platform-data/platform-data.module.ts`
- Confirm T-10 GREEN; full api suite GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-10 GREEN; all prior tests GREEN.
**Commit**: `feat(api): GET /internal/platform/tenants — PlatformTenantsReadRepository + controller (A13)`

---

## WU-2 — viewpro-api `platform_tenants` migration + ingest routing + operator list endpoint

### [x] T-12 — RED: `platform_tenants` model + additive migration
**Type**: test (RED)
**Spec**: tenant-registry — platform_tenants Projection (schema requirement)
**WU**: WU-2, commit 1
**Depends on**: T-11

- `apps/viewpro-api/src/platform-data/__tests__/migration-invariant.spec.ts` — add:
  - `platform_tenants` table exists in test DB with columns `id`, `name`, `slug`, `latestStatus`, `maxUsers`, `maxActivePropertyEngagements`, `maxDocumentsStorageMb`, `updatedAt`
  - Existing `platform_mirror_events` and `platform_ingest_cursor` rows survive (additive invariant)

All RED until T-13.
**Exit**: test file exists; assertions fail before migration.
**Commit**: `test(platform-api): RED — platform_tenants migration additive invariant`

---

### [x] T-13 — GREEN: add `PlatformTenant` Prisma model + generate additive migration (A7)
**Type**: impl
**Spec**: tenant-registry — platform_tenants Projection; A7
**WU**: WU-2, commit 2
**Depends on**: T-12

- In `apps/viewpro-api/prisma/schema.prisma`, add:
  ```
  model PlatformTenant {
    id                             String   @id
    name                           String
    slug                           String
    latestStatus                   String
    maxUsers                       Int?
    maxActivePropertyEngagements   Int?
    maxDocumentsStorageMb          Int?
    updatedAt                      DateTime @updatedAt
    @@map("platform_tenants")
  }
  ```
- Run `pnpm --filter @viewpro/platform-api exec prisma migrate dev --name add_platform_tenants` against viewpro test DB
- Commit generated migration SQL; run `pnpm --filter @viewpro/platform-api exec prisma generate`
- Confirm T-12 GREEN

**Rollback**: `DROP TABLE platform_tenants` — additive only.
**Exit**: `pnpm --filter @viewpro/platform-api exec prisma validate` passes; T-12 GREEN.
**Commit**: `feat(platform-api): additive migration + PlatformTenant model — platform_tenants (A7)`

---

### [x] T-14 — RED: ingest routing unit tests — REGISTERED full upsert, STATUS upsert-create-if-missing, unknown skip (A8/A9)
**Type**: test (RED)
**Spec**: tenant-registry — platform_tenants Projection (ingest scenarios); platform-data-lane delta — Ingest Event-Type Routing (all 3 scenarios)
**WU**: WU-2, commit 3
**Depends on**: T-13

- `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts` (vitest + test DB) — add:
  - `TENANT_REGISTERED` event for new tenant → one `platform_tenants` row with all fields (spec: ingest upserts full row)
  - Re-delivery of same `TENANT_REGISTERED` event → still one row, no error (idempotent)
  - `TENANT_STATUS_CHANGED` for existing tenant → `latestStatus` updated; `name`/`slug` updated when present (spec: update latestStatus)
  - `TENANT_STATUS_CHANGED` for absent tenant → row created with `id + latestStatus` (A9, create-if-missing)
  - Unknown `eventType` event → no `platform_tenants` write; cursor advances; no error (spec: unknown skip)
  - BOTH `TENANT_REGISTERED` and `TENANT_STATUS_CHANGED` each append a row to `platform_mirror_events` (platform-data-lane delta: both types append)

All RED until T-15.
**Exit**: test file exists; all new assertions fail.
**Commit**: `test(platform-api): RED — ingest routing REGISTERED/STATUS upsert + unknown skip + mirror append (A8/A9)`

---

### [x] T-15 — GREEN: `PlatformTenantRepository` + ingest event-type branch in `IngestService` (A8/A9)
**Type**: impl
**Spec**: tenant-registry — platform_tenants Projection; platform-data-lane delta — Ingest Event-Type Routing; A8; A9
**WU**: WU-2, commit 4
**Depends on**: T-14

- Create `apps/viewpro-api/src/platform-data/platform-tenant.repository.ts`:
  - `upsertFromRegistered(event: TenantRegisteredPayload)` — `prisma.platformTenant.upsert({ where: { id }, create: { id, name, slug, latestStatus: event.newStatus, ...limits }, update: { name, slug, latestStatus: event.newStatus, ...limits } })`
  - `upsertFromStatusChange(tenantId, payload: TenantStatusChangedPayload)` — upsert on `id`; update `latestStatus = payload.newStatus`; update `name`/`slug` when present in payload (create-if-missing: `create: { id: tenantId, name: payload.name ?? '', slug: payload.slug ?? '', latestStatus: payload.newStatus }`)
- In `apps/viewpro-api/src/platform-data/ingest.service.ts`, after `mirrorRepo.upsertEvent(event)`, add routing:
  ```
  if (event.eventType === 'TENANT_REGISTERED') { await tenantRepo.upsertFromRegistered(event.payload) }
  else if (event.eventType === 'TENANT_STATUS_CHANGED') { await tenantRepo.upsertFromStatusChange(event.tenantId, event.payload) }
  // else: skip unknown type — cursor still advances
  ```
- Confirm T-14 GREEN; prior ingest/cursor tests GREEN (regression)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-14 GREEN; all prior tests GREEN.
**Commit**: `feat(platform-api): PlatformTenantRepository + ingest event-type routing (A8/A9)`

---

### [x] T-16 — RED: `TenantRegistryController` tests — pagination, auth, isolation (A10/A11)
**Type**: test (RED)
**Spec**: tenant-registry — Operator Tenant List Endpoint (all 4 scenarios); isolation invariant
**WU**: WU-2, commit 5
**Depends on**: T-15

- `apps/viewpro-api/src/platform-data/__tests__/tenant-registry.controller.spec.ts` (vitest + supertest, test DB):
  - Authenticated operator → 200 + `{ total: 3, items: [{ id, name, slug, status, limits }] }` sorted by name ASC (spec: authenticated operator receives list)
  - `?offset=1&limit=1` → `total` still reflects full count, `items` has 1 entry (pagination)
  - `?limit=201` → capped at 200 (A11 cap)
  - No `viewpro_platform_access_token` cookie → 401 (spec: unauthenticated rejected)
  - Empty `platform_tenants` → 200 + `{ total: 0, items: [] }` (spec: empty registry)
  - Static check: `TenantRegistryService` imports no `@prisma/client` from InmoView — only `src/generated/prisma` (isolation invariant)

All RED until T-17.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — TenantRegistryController (pagination, auth, empty-state, isolation)`

---

### [x] T-17 — GREEN: `TenantRegistryController` + `TenantRegistryService` (A10/A11)
**Type**: impl
**Spec**: tenant-registry — Operator Tenant List Endpoint; A10; A11
**WU**: WU-2, commit 6
**Depends on**: T-16

- Create `apps/viewpro-api/src/platform-data/tenant-registry.service.ts`:
  - `listTenants(offset: number, limit: number): Promise<{ total: number; items: [...] }>` — `prisma.platformTenant.findMany({ skip: offset, take: Math.min(limit, 200), orderBy: { name: 'asc' } })` + `prisma.platformTenant.count()`; never touches InmoView DB
- Create `apps/viewpro-api/src/platform-data/tenant-registry.controller.ts`:
  - `@Controller('operators/tenants') @UseGuards(AuthGuard)` — `@Get() list(@Query('offset') offset=0, @Query('limit') limit=50)` → calls service; returns `{ total, items }` with nested `limits` object
- Confirm T-16 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-16 GREEN.
**Commit**: `feat(platform-api): TenantRegistryController + TenantRegistryService (A10/A11)`

---

### [x] T-18 — GREEN: register all new providers in `PlatformDataModule` (viewpro-api)
**Type**: impl
**Spec**: tenant-registry — Operator Tenant List Endpoint; platform-data.module.ts wiring
**WU**: WU-2, commit 7
**Depends on**: T-17

- In `apps/viewpro-api/src/platform-data/platform-data.module.ts`:
  - Add `PlatformTenantRepository`, `TenantRegistryService`, `TenantRegistryController` to providers/controllers arrays
- Confirm full platform-api suite GREEN (regression)

**Exit**: `pnpm --filter @viewpro/platform-api test` — all GREEN; `pnpm --filter @viewpro/platform-api typecheck` passes.
**Commit**: `feat(platform-api): register PlatformTenantRepository + TenantRegistryController in PlatformDataModule`

---

## WU-3 — Threat-matrix RED tests + backfill seed + deploy doc + final verification

### [x] T-19 — RED: threat-matrix RED tests — token forgery, token confusion, replay, cross-tenant (A12/A13/threat-matrix)
**Type**: test (RED)
**Spec**: tenant-registry — threat-matrix applicable rows; A10/A13
**WU**: WU-3, commit 1
**Depends on**: T-18

- `apps/api/src/platform-data/__tests__/feed-isolation.spec.ts` — add:
  - Wrong secret/iss/aud → `GET /internal/platform/tenants` → 401 (cross-service token forgery)
  - Operator cookie sent to `GET /internal/platform/tenants` → 401 (token confusion — user↔service)
  - Service token sent to `GET /operators/tenants` (viewpro-api) → 401 (reverse confusion; `AuthGuard` rejects it)
- `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts` — add:
  - Re-deliver same `TENANT_REGISTERED` event id → `platform_tenants` count unchanged (replay dedup)
  - `UNIQUE(sourceEventId)` on `platform_mirror_events` still enforced for both event types (replay mirror dedup)

All RED until T-20.
**Exit**: test files exist; all threat assertions fail.
**Commit**: `test(both): RED — threat-matrix: token forgery/confusion, replay dedup, cross-tenant isolation`

---

### [x] T-20 — GREEN: confirm threat mitigations pass (no code changes expected)
**Type**: impl
**Spec**: tenant-registry — threat-matrix; isolation invariant
**WU**: WU-3, commit 2
**Depends on**: T-19

- Run `pnpm --filter @viewpro/api test` and `pnpm --filter @viewpro/platform-api test`; fix any wiring gaps found (structural only — no new logic expected)
- Confirm isolation: `rg '@prisma/client' apps/viewpro-api/src/platform-data/` → zero InmoView Prisma client imports

**Exit**: all threat-matrix assertions GREEN; isolation confirmed.
**Commit**: `test(both): GREEN — threat-matrix mitigations confirmed`

---

### [x] T-21 — RED: backfill seed tests — first run populates; re-run is idempotent (A12/A14)
**Type**: test (RED)
**Spec**: tenant-registry — Backfill Idempotent Seed (both scenarios)
**WU**: WU-3, commit 3
**Depends on**: T-20

- `apps/viewpro-api/src/platform-data/__tests__/backfill.spec.ts` (vitest + test DB + mocked `fetchAllTenants`):
  - First invocation: `platform_tenants` starts empty; after run → two rows (spec: first run populates)
  - Second invocation: still exactly two rows, no error (spec: re-run is idempotent; A14)
  - `fetchAllTenants` mocked to return two tenants; upsert called with each `id`

All RED until T-22.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — backfill seed first-run + idempotent re-run (A12/A14)`

---

### [ ] T-22 — GREEN: implement Nest standalone backfill command + `fetchAllTenants` in `ChangeFeedClient`
**Type**: impl
**Spec**: tenant-registry — Backfill Idempotent Seed; A12; A14
**WU**: WU-3, commit 4
**Depends on**: T-21

- In `apps/viewpro-api/src/platform-data/change-feed.client.ts`: add `fetchAllTenants(): Promise<{ tenants: [...] }>` — mints service token (same `mintIngestToken` claims), calls `GET INMOVIEW_API_INTERNAL_URL/internal/platform/tenants`; returns parsed body
- Create `apps/viewpro-api/src/scripts/backfill-platform-tenants.ts` — Nest standalone app (`NestFactory.createApplicationContext(AppModule)`); resolves `PlatformTenantRepository` and `ChangeFeedClient`; calls `fetchAllTenants()`; for each tenant calls `tenantRepo.upsertFromRegistered()`; exits; re-run safe (upsert is idempotent)
- Add `// NOTE: safe to re-run — all writes are idempotent upserts on platform_tenants.id` comment at top
- Confirm T-21 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-21 GREEN; backfill runs without error in test harness.
**Commit**: `feat(platform-api): backfill standalone command + ChangeFeedClient.fetchAllTenants (A12/A14)`

---

### [ ] T-23 — Coordinated deploy documentation + final verification
**Type**: verify
**Spec**: All invariants; proposal acceptance criteria 1–8; coordinated deploy §6 / R3
**WU**: WU-3, commit 5
**Depends on**: T-22

**Add deploy-sequence comment** to the viewpro-api migration SQL:
```sql
-- DEPLOY ORDER (platform-phase7-tenant-registry, R3):
-- Step 1: ship platform-contract union + additive payload fields (WU-1, PR 1 merged to main).
-- Step 2: deploy viewpro-api — platform_tenants migration + event-routed ingest + GET /operators/tenants.
--         (Ingest is tolerant of TENANT_REGISTERED before InmoView emits it — list may be empty.)
-- Step 3: deploy InmoView — TENANT_REGISTERED emit + enriched TENANT_STATUS_CHANGED + GET /internal/platform/tenants.
-- Step 4: run backfill seed once: pnpm --filter @viewpro/platform-api exec ts-node src/scripts/backfill-platform-tenants.ts
--         (Safe to re-run; all writes are idempotent upserts.)
```

**Final verification checklist**:
1. `pnpm --filter @viewpro/api test` — all GREEN (auth/admin/platform-data suites)
2. `pnpm --filter @viewpro/platform-api test` — all GREEN
3. `pnpm --filter @viewpro/api typecheck` — passes (compile-time assertions)
4. `pnpm --filter @viewpro/platform-api typecheck` — passes
5. `rg '@prisma/client' apps/viewpro-api/src/platform-data/` — zero InmoView Prisma client imports
6. `rg 'INMOVIEW_DB\|DATABASE_URL' apps/viewpro-api/src/platform-data/` — zero InmoView DB refs
7. `git diff HEAD -- apps/api/src/admin/` — no unintended admin regressions
8. `git diff HEAD -- apps/viewpro-api/src/platform-data/metrics.service.ts` — no metrics regressions
9. Confirm `platform_tenants` migration SQL exists with deploy-order comment; `platform_mirror_events` and `platform_ingest_cursor` untouched
10. Confirm `TENANT_REGISTERED` outbox row includes `newStatus` (W2 guard passes)
11. Confirm `GET /operators/tenants` returns `status` (not `latestStatus`) in JSON shape per contract; nested `limits` object
12. Run backfill seed twice in test harness; assert row count unchanged on second run

**Exit**: all 12 checks pass; no regressions.
**Commit**: `chore(platform-phase7-tenant-registry): coordinated deploy note + final verification`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-01 widen contract union + payload types | impl | WU-1 | platform-data-lane delta — TENANT_REGISTERED Event Type; A1/A2/A3 | — |
| T-02 RED: compile-time assertions | test | WU-1 | Contract type coverage; A2 | T-01 |
| T-03 GREEN: assertions wired | impl | WU-1 | Contract backward compat | T-02 |
| T-04 RED: writer accepts both input shapes | test | WU-1 | platform-data-lane delta — writer union; A5 | T-03 |
| T-05 GREEN: widen OutboxEventInput union | impl | WU-1 | A5 | T-04 |
| T-06 RED: STATUS enriched emit tests | test | WU-1 | platform-data-lane delta — Modified Transactional Outbox Write; A3 | T-05 |
| T-07 GREEN: widen SELECT + pass name/slug | impl | WU-1 | A3 | T-06 |
| T-08 RED: registration repo emit in-tx + rollback | test | WU-1 | tenant-registry — Registration Event (both scenarios); A4 | T-07 |
| T-09 GREEN: wire emit in registerTenant + auth.module.ts | impl | WU-1 | A4 | T-08 |
| T-10 RED: internal GET /internal/platform/tenants tests | test | WU-1 | tenant-registry — Backfill Internal Endpoint (both scenarios); A13 | T-09 |
| T-11 GREEN: PlatformTenantsReadRepository + endpoint | impl | WU-1 | A13 | T-10 |
| T-12 RED: platform_tenants migration invariant | test | WU-2 | tenant-registry — platform_tenants Projection (schema) | T-11 |
| T-13 GREEN: PlatformTenant model + migration | impl | WU-2 | A7 | T-12 |
| T-14 RED: ingest routing unit tests | test | WU-2 | tenant-registry — Projection ingest scenarios; platform-data-lane delta — routing; A8/A9 | T-13 |
| T-15 GREEN: PlatformTenantRepository + IngestService branch | impl | WU-2 | A8/A9 | T-14 |
| T-16 RED: TenantRegistryController tests | test | WU-2 | tenant-registry — Operator Tenant List (all 4 scenarios) + isolation | T-15 |
| T-17 GREEN: TenantRegistryController + Service | impl | WU-2 | A10/A11 | T-16 |
| T-18 GREEN: register in PlatformDataModule | impl | WU-2 | Module wiring | T-17 |
| T-19 RED: threat-matrix assertions | test | WU-3 | Threat matrix: token forgery/confusion, replay, cross-tenant | T-18 |
| T-20 GREEN: threat mitigations confirmed | impl | WU-3 | Threat matrix | T-19 |
| T-21 RED: backfill seed tests | test | WU-3 | tenant-registry — Backfill Idempotent Seed (both scenarios); A12/A14 | T-20 |
| T-22 GREEN: backfill standalone command + fetchAllTenants | impl | WU-3 | A12/A14 | T-21 |
| T-23 Deploy doc + final verification | verify | WU-3 | All invariants + acceptance criteria 1–8; R3 deploy ordering | T-22 |

---

## Success Checklist (maps to spec acceptance criteria)

- [ ] Registering a tenant → one `TENANT_REGISTERED` outbox row in same `$transaction`; rollback ⇒ no row (T-08, T-09)
- [ ] Rolled-back registration leaves zero outbox rows (T-08, T-09)
- [ ] No InmoView schema migration required — only new outbox rows + widened SELECT (T-13 migration is viewpro-api only)
- [ ] `TENANT_STATUS_CHANGED` payload includes `name` and `slug` (T-06, T-07)
- [ ] viewpro-api ingest upserts `platform_tenants` from `TENANT_REGISTERED` (id/name/slug/latestStatus/limits); re-delivery idempotent (T-14, T-15)
- [ ] Status-change updates `latestStatus` (+ name/slug when present); creates row if missing (T-14, T-15)
- [ ] `platform_mirror_events` append still runs for both event types; metrics unaffected (T-14)
- [ ] Unknown `eventType` skipped; cursor advances; no error (T-14)
- [ ] `GET /operators/tenants` → 200 + `{ total, items }` paginated, sorted name ASC, from `viewpro_platform` only; 401 without operator session (T-16, T-17)
- [ ] `GET /operators/tenants` makes zero InmoView DB reads (T-16 isolation check)
- [ ] `GET /internal/platform/tenants` 401 on missing/invalid service token; read-only (T-10, T-11)
- [ ] Backfill seed populates all pre-existing tenants once; re-run is a no-op (T-21, T-22)
- [ ] Operator cookie rejected by `PlatformControlGuard`; service token rejected by `AuthGuard` (T-19, T-20)
- [ ] Coordinated deploy ordering documented in migration SQL (T-23)
