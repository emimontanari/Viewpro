# Tasks: Platform Audit Log (vision D3 — governance sub-slice)

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions A1–A11 (design.md) are LOCKED — do not reopen.

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| Q1 — actor.label sourcing | `label = actor id` (no cross-DB lookup) now; threading a real display label from the operator session is an additive follow-up, out of scope |
| Q2 — mirror landing | Confirmed: `AUDIT_LOGGED` is W2-skipped from `platform_mirror_events` by the EXISTING guard — zero `MirrorRepository` code change |
| Q3 — tenantId filter | NOT added — `GET /operators/audit` stays global-only, no per-tenant filter param |
| Q4 — action vocabulary | Free string `action` (`'TENANT_STATUS_CHANGED'` \| `'TENANT_LIMITS_UPDATED'`); FE label map `{TENANT_STATUS_CHANGED:'Estado', TENANT_LIMITS_UPDATED:'Límites'}`, es-AR copy, unmapped values render raw |
| Q5 — `toAuditActor` placement | Shared `apps/api/src/admin/audit-actor.ts` helper (mirrors `admin-actor.ts` co-location) — both emit sites import the same mapper, keeping status/limits identical |
| `platform_audit_log.id` column | `String @id @default(uuid())` — mirrors `PlatformMirrorEvent.id` exactly |
| `platform_audit_log.seqNo` type | `BigInt` — mirrors `platform_mirror_events.seqNo` (W1 pattern); converted to `Number()` at the JSON boundary in `AuditService`, same as `PrismaOutboxRepository.findSince` |
| `AuditLogRepository` dedup strategy | `upsert({where:{sourceEventId}, update:{}, create:{...}})` — mirrors `MirrorRepository.upsertEvent` exactly (A8) |
| `IngestService` wiring | `AuditLogRepository` injected as a 4th constructor param alongside `mirrorRepo`/`cursorRepo`/`tenantRepo`; no new module import needed on the InmoView side — `admin.module.ts` already imports `PlatformDataModule` (exports `PlatformOutboxWriter`), so injecting the writer into `PrismaAdminTenantLimitsRepository`'s constructor requires **zero module wiring change** (A4, confirmed by reading `admin.module.ts` / `platform-data.module.ts`) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1 450–1 750 (contract package, 3 apps — `apps/api`, `apps/viewpro-api`, `apps/viewpro-web` — new model, migration, endpoint, FE feature, tests) |
| 400-line budget risk | High (WU-2 and WU-3 individually exceed 400 lines with tests) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1, InmoView contract + emit sites) → PR 2 (WU-2, viewpro-api projection + endpoint) → PR 3 (WU-3, viewpro-web feed + final verification) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Est. lines | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|-----------|----------------------|-----------------|-------------------|
| WU-1 | platform-contract `AUDIT_LOGGED` union + `AuditActor`/`AuditLoggedPayload` + writer union widen + shared `toAuditActor` + status-repo 2nd emit + limits-repo 1st emit (writer injection) | PR 1 (base: `feat/platform-foundation`) | ~350–450 | `pnpm --filter @viewpro/api test` (admin + platform-data specs) | `PATCH /admin/tenants/:id/status` → 2 outbox rows (`TENANT_STATUS_CHANGED` + `AUDIT_LOGGED`) on test DB; `PATCH /admin/tenants/:id/limits` → 1 outbox row (`AUDIT_LOGGED`, first-ever) | Revert 2nd emit in `PrismaAdminTenantStatusRepository`; revert writer injection + emit in `PrismaAdminTenantLimitsRepository`; revert contract union + writer union widen; delete `audit-actor.ts` |
| WU-2 | viewpro-api `platform_audit_log` migration + `AuditLogRepository` + ingest routing case + `AuditController`/`AuditService` (`GET /operators/audit`) + module wiring + mirror/metrics regression guards | PR 2 (base: PR 1 branch) | ~600–700 | `pnpm --filter @viewpro/platform-api test` (platform-data spec) | `GET /operators/audit` after ingest of an `AUDIT_LOGGED` event → row returned newest-first; `platform_mirror_events` row count unchanged by that event | Drop `platform_audit_log` migration; revert `AUDIT_LOGGED` branch in `IngestService.routeToTenantProjection`; revert `AuditController`/`AuditService` registration in `PlatformDataModule` |
| WU-3 | viewpro-web `features/audit` (api layer + components) + route + nav entry + final verification | PR 3 (base: PR 2 branch) | ~500–600 | `pnpm --filter viewpro-web test` (audit feature spec) | Manual: `/dashboard/audit` renders a paginated feed against a running viewpro-api | Delete `features/audit/`, `app/dashboard/audit/`; revert `nav-config.ts` entry — no DB impact |

---

## Dependency Graph

```
T-01 (contract: AuditActor + AuditLoggedPayload + widen eventType/payload union)
  └── T-02 (RED: compile-time assertions — AUDIT_LOGGED union coverage + payload shape)
        └── T-03 (GREEN: type assertions wired)
              └── T-04 (RED: writer unit tests — accepts AUDIT_LOGGED 3rd input arm)
                    └── T-05 (GREEN: widen PlatformOutboxWriter OutboxEventInput union)
                          └── T-06 (RED: toAuditActor unit tests — operator/user mapping, label=id)
                                └── T-07 (GREEN: shared audit-actor.ts helper)
                                      └── T-08 (RED: status-repo 2nd AUDIT_LOGGED emit + rollback ⇒ neither event)
                                            └── T-09 (GREEN: status repo 2nd emit)
                                                  └── T-10 (RED: limits-repo 1st AUDIT_LOGGED emit + rollback ⇒ no event)
                                                        └── T-11 (GREEN: inject writer + limits repo 1st emit)
                                                              └── T-12 (RED: platform_audit_log migration invariant)
                                                                    └── T-13 (GREEN: PlatformAuditLog model + additive migration)
                                                                          └── T-14 (RED: AuditLogRepository.appendFromEvent — idempotent upsert)
                                                                                └── T-15 (GREEN: AuditLogRepository)
                                                                                      └── T-16 (RED: ingest routing — AUDIT_LOGGED→platform_audit_log only; guards a/b/d)
                                                                                            └── T-17 (GREEN: routeToTenantProjection AUDIT_LOGGED branch + wire AuditLogRepository)
                                                                                                  └── T-18 (RED: AuditController/AuditService — pagination, auth, isolation)
                                                                                                        └── T-19 (GREEN: AuditController + AuditService + module wiring)
                                                                                                              └── T-20 (RED: integration regression — mirror uncorrupted, metrics uncorrupted, tx atomicity, re-delivery)
                                                                                                                    └── T-21 (GREEN: confirm regression suite passes)
                                                                                                                          └── T-22 (RED: features/audit api layer — zod defensive parse, renderValue)
                                                                                                                                └── T-23 (GREEN: features/audit api/{types,schemas,service,queries}.ts)
                                                                                                                                      └── T-24 (RED: audit feed components — table/pager/empty-state/loading/error)
                                                                                                                                            └── T-25 (GREEN: audit-feed-page + audit-table + audit-pager + audit-empty-state)
                                                                                                                                                  └── T-26 (GREEN: route app/dashboard/audit/page.tsx + nav-config.ts entry)
                                                                                                                                                        └── T-27 (coordinated-deploy doc + final verification)
```

---

## WU-1 — platform-contract union + shared actor helper + InmoView emit sites

### [x] T-01 — Widen `platform-contract` data/ with `AuditActor` + `AuditLoggedPayload`
**Type**: impl
**Spec**: platform-data-lane delta — AUDIT_LOGGED Event Type
**WU**: WU-1, commit 1
**Depends on**: nothing

- In `packages/platform-contract/src/data/platform-outbox-event.ts`:
  - Add `export type AuditActor = { id: string; type: 'operator' | 'user'; label: string }`
  - Add `export type AuditLoggedPayload = { action: string; previousValue: unknown; newValue: unknown; actor: AuditActor }` — `tenantId`/`occurredAt` stay on the envelope, NOT duplicated inside the payload (per spec)
  - Widen `PlatformOutboxEvent.eventType` to `'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED' | 'AUDIT_LOGGED'`
  - Widen `PlatformOutboxEvent.payload` to `TenantStatusChangedPayload | TenantRegisteredPayload | AuditLoggedPayload`
- Export `AuditActor` and `AuditLoggedPayload` from `packages/platform-contract/src/data/index.ts`

**Exit**: `pnpm --filter @viewpro/platform-contract typecheck` passes; new types importable from both apps.
**Commit**: `feat(platform-contract): widen eventType union + AuditActor/AuditLoggedPayload types`

---

### [x] T-02 — RED: compile-time assertions — AUDIT_LOGGED union coverage + payload shape
**Type**: test (RED)
**Spec**: platform-data-lane delta — Contract accepts AUDIT_LOGGED as a valid eventType (both scenarios)
**WU**: WU-1, commit 2
**Depends on**: T-01

- In `apps/api/src/platform-data/type-assertions.ts`, add type-level assertions (mirrors the existing `_AssertTenantRegisteredInUnion` pattern):
  - `AUDIT_LOGGED` is assignable to `PlatformOutboxEvent['eventType']` (positive)
  - `TENANT_STATUS_CHANGED` and `TENANT_REGISTERED` remain assignable (backward-compat regression)
  - `AuditLoggedPayload` is assignable to `PlatformOutboxEvent['payload']` (positive) with `action`/`previousValue`/`newValue`/`actor` present
  - `AuditActor['type']` is `'operator' | 'user'` — a literal `'admin'` is NOT assignable (negative via `@ts-expect-error`)

All RED until T-03 implements the assertions.
**Exit**: test file exists; `tsc --noEmit` fails on the negative case without `@ts-expect-error`.
**Commit**: `test(api): RED — compile-time assertions AUDIT_LOGGED union + AuditLoggedPayload shape`

---

### [x] T-03 — GREEN: implement compile-time assertions; confirm typecheck
**Type**: impl
**Spec**: platform-data-lane delta — Contract continues to accept the existing event types
**WU**: WU-1, commit 3
**Depends on**: T-02

- Complete assertions in `apps/api/src/platform-data/type-assertions.ts` so all checks pass
- `pnpm --filter @viewpro/api typecheck` and `pnpm --filter @viewpro/platform-api typecheck` must both pass

**Exit**: typecheck GREEN; assertion file compiles with no errors.
**Commit**: `feat(api): GREEN — compile-time type assertions AUDIT_LOGGED union + payload shape`

---

### [x] T-04 — RED: unit tests — `PlatformOutboxWriter` accepts the `AUDIT_LOGGED` input arm
**Type**: test (RED)
**Spec**: platform-data-lane delta — writer accepts AUDIT_LOGGED alongside the existing two event types
**WU**: WU-1, commit 4
**Depends on**: T-03

- `apps/api/src/platform-data/__tests__/platform-outbox-writer.spec.ts` — add:
  - `emit(tx, { eventType: 'AUDIT_LOGGED', tenantId, payload: AuditLoggedPayload, occurredAt })` calls `tx.platformOutboxEvent.create` with correct fields
  - `emit(tx, {...TENANT_STATUS_CHANGED...})` and `emit(tx, {...TENANT_REGISTERED...})` still accepted (regression)
  - All three calls still acquire `pg_advisory_xact_lock(OUTBOX_LOCK_KEY)` (lock assertion, regression)

All RED until T-05.
**Exit**: test file exists; new assertions fail.
**Commit**: `test(api): RED — PlatformOutboxWriter accepts AUDIT_LOGGED input arm`

---

### [x] T-05 — GREEN: widen `PlatformOutboxWriter.OutboxEventInput` union with a 3rd arm
**Type**: impl
**Spec**: platform-data-lane delta — writer union
**WU**: WU-1, commit 5
**Depends on**: T-04

- In `apps/api/src/platform-data/platform-outbox-writer.ts`:
  - Import `AuditLoggedPayload` alongside `TenantRegisteredPayload`
  - Add a 3rd `OutboxEventInput` union member: `{ eventType: 'AUDIT_LOGGED'; tenantId: string; payload: AuditLoggedPayload; occurredAt: Date }`
  - `emit` body unchanged (lock + create)
- Confirm T-04 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-04 GREEN; prior writer tests still GREEN.
**Commit**: `feat(api): widen PlatformOutboxWriter OutboxEventInput with AUDIT_LOGGED arm`

---

### [x] T-06 — RED: unit tests — shared `toAuditActor` mapper (operator/user, label=id)
**Type**: test (RED)
**Spec**: platform-audit-log — Audit Actor Identity Carries a Display Label In-Payload (both actor-type scenarios)
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/api/src/admin/__tests__/audit-actor.spec.ts`:
  - `toAuditActor({ type: 'operator', operatorId: 'op-1' })` → `{ id: 'op-1', type: 'operator', label: 'op-1' }`
  - `toAuditActor({ type: 'user', userId: 'usr-1' })` → `{ id: 'usr-1', type: 'user', label: 'usr-1' }`
  - Never performs any I/O (pure function, no imports beyond `CommandActor`)

All RED until T-07.
**Exit**: test file exists; both assertions fail (module does not exist yet).
**Commit**: `test(api): RED — toAuditActor operator/user mapping, label=id (Q1/Q5)`

---

### [x] T-07 — GREEN: shared `audit-actor.ts` helper (Q5)
**Type**: impl
**Spec**: platform-audit-log — Audit Actor Identity Carries a Display Label In-Payload; Q5
**WU**: WU-1, commit 7
**Depends on**: T-06

- Create `apps/api/src/admin/audit-actor.ts`:
  ```ts
  import type { AuditActor } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
  import type { CommandActor } from './admin-actor'

  // Q1/Q5: label = actor id, no cross-DB lookup — both emit sites share this mapper
  // so status/limits produce byte-identical actor shapes.
  export function toAuditActor(actor: CommandActor): AuditActor {
    return actor.type === 'operator'
      ? { id: actor.operatorId, type: 'operator', label: actor.operatorId }
      : { id: actor.userId, type: 'user', label: actor.userId }
  }
  ```
- Confirm T-06 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-06 GREEN.
**Commit**: `feat(api): shared toAuditActor helper (Q1/Q5)`

---

### [x] T-08 — RED: unit/integration tests — status repo emits `AUDIT_LOGGED` as a 2nd emit in-tx; rollback ⇒ neither event (regression guard b)
**Type**: test (RED)
**Spec**: platform-audit-log — Status Change Audit Event — Transactional Emit (all 3 scenarios)
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/api/src/admin/__tests__/admin-tenant-status.service.spec.ts` or a new `prisma-admin-tenant-status.repository.spec.ts` (vitest, mocked tx client):
  - After a status change on the `updated` branch: `outboxWriter.emit` called TWICE — once with `eventType='TENANT_STATUS_CHANGED'` (unchanged shape, regression), once with `eventType='AUDIT_LOGGED'`, `payload.action='TENANT_STATUS_CHANGED'`, `payload.previousValue` reflecting the prior status, `payload.newValue` reflecting the target status, `payload.actor` from `toAuditActor(input.actor)`
  - `unchanged`/`notFound` branches: `outboxWriter.emit` NOT called for either event type (regression, D4 invariant)
- `apps/api/src/platform-data/__tests__/outbox-write-integration.spec.ts` — add:
  - Full app + test DB: successful status PATCH → exactly one `platform_outbox_events` row with `eventType=TENANT_STATUS_CHANGED` AND exactly one row with `eventType=AUDIT_LOGGED` (spec scenario 1 + regression guard b)
  - Forced rollback (constraint violation): zero `AUDIT_LOGGED` rows persist (spec scenario 3)

All RED until T-09.
**Exit**: test files exist; all new assertions fail.
**Commit**: `test(api): RED — status repo 2nd AUDIT_LOGGED emit in-tx; rollback ⇒ neither event`

---

### [x] T-09 — GREEN: status repo emits `AUDIT_LOGGED` as a 2nd emit (in the same tx)
**Type**: impl
**Spec**: platform-audit-log — Status Change Audit Event — Transactional Emit
**WU**: WU-1, commit 9
**Depends on**: T-08

- In `apps/api/src/admin/prisma-admin-tenant-status.repository.ts`:
  - Import `toAuditActor` from `./audit-actor`
  - Immediately after the existing `TENANT_STATUS_CHANGED` `outboxWriter.emit(...)` call (still inside `run(client)`, same tx), add:
    ```ts
    await this.outboxWriter.emit(client, {
      eventType: 'AUDIT_LOGGED',
      tenantId: tenant.id,
      payload: {
        action: 'TENANT_STATUS_CHANGED',
        previousValue: { status: tenant.status },
        newValue: { status: input.targetStatus },
        actor: toAuditActor(input.actor),
      },
      occurredAt: input.now,
    })
    ```
- Confirm T-08 GREEN; full admin suite GREEN (regression)

**Exit**: `pnpm --filter @viewpro/api test` — T-08 GREEN; all prior tests GREEN.
**Commit**: `feat(api): status repo emits AUDIT_LOGGED as 2nd emit in-tx`

---

### [x] T-10 — RED: unit/integration tests — limits repo emits its first-ever `AUDIT_LOGGED`; rollback ⇒ no event (regression guard c)
**Type**: test (RED)
**Spec**: platform-audit-log — Limits Change Audit Event — Transactional Emit (both scenarios)
**WU**: WU-1, commit 10
**Depends on**: T-09

- `apps/api/src/admin/__tests__/admin-tenant-limits.service.spec.ts` or a new `prisma-admin-tenant-limits.repository.spec.ts` (vitest, mocked tx + mocked `PlatformOutboxWriter`):
  - After a limits change on the `updated` branch: `outboxWriter.emit` called ONCE with `eventType='AUDIT_LOGGED'`, `payload.action='TENANT_LIMITS_UPDATED'`, `payload.previousValue` = prior limits, `payload.newValue` = updated limits, `payload.actor` from `toAuditActor(input.actor)`
  - `unchanged`/`notFound` branches: `outboxWriter.emit` NOT called (regression guard c, mirrors D4)
- `apps/api/src/platform-data/__tests__/outbox-write-integration.spec.ts` — add:
  - Full app + test DB: successful limits PATCH → exactly one `platform_outbox_events` row with `eventType=AUDIT_LOGGED` (first-ever emit from this site)
  - Forced rollback: zero `AUDIT_LOGGED` rows persist for the attempt (regression guard c — "limits emit is inside the tx, rollback ⇒ no event")

All RED until T-11.
**Exit**: test files exist; all new assertions fail.
**Commit**: `test(api): RED — limits repo first-ever AUDIT_LOGGED emit in-tx; rollback ⇒ no event`

---

### [x] T-11 — GREEN: inject `PlatformOutboxWriter` into limits repo; emit `AUDIT_LOGGED` on `updated`
**Type**: impl
**Spec**: platform-audit-log — Limits Change Audit Event — Transactional Emit; A4
**WU**: WU-1, commit 11
**Depends on**: T-10

- In `apps/api/src/admin/prisma-admin-tenant-limits.repository.ts`:
  - Add `private readonly outboxWriter: PlatformOutboxWriter` to the constructor (2nd param, mirrors the status repo)
  - Import `toAuditActor` from `./audit-actor`
  - Inside `run(client)`, on the `updated` branch (after `client.analyticsEvent.create`, same tx), add:
    ```ts
    await this.outboxWriter.emit(client, {
      eventType: 'AUDIT_LOGGED',
      tenantId: tenant.id,
      payload: {
        action: 'TENANT_LIMITS_UPDATED',
        previousValue: previousLimits,
        newValue: updatedLimits,
        actor: toAuditActor(input.actor),
      },
      occurredAt: input.now,
    })
    ```
- **No module change required**: `admin.module.ts` already imports `PlatformDataModule`, which exports `PlatformOutboxWriter` — Nest DI resolves the new constructor param automatically (confirmed by reading both modules in the tasks-phase; A4)
- Confirm T-10 GREEN; full admin suite GREEN (regression)

**Exit**: `pnpm --filter @viewpro/api test` — T-10 GREEN; all prior tests GREEN; `pnpm --filter @viewpro/api typecheck` passes.
**Commit**: `feat(api): inject PlatformOutboxWriter + limits repo first-ever AUDIT_LOGGED emit (A4)`

---

## WU-2 — viewpro-api `platform_audit_log` migration + ingest routing + operator feed endpoint

### [x] T-12 — RED: `platform_audit_log` model + additive migration invariant
**Type**: test (RED)
**Spec**: platform-audit-log — platform_audit_log Append-Only Projection (schema requirement)
**WU**: WU-2, commit 1
**Depends on**: T-11

- `apps/viewpro-api/src/platform-data/__tests__/migration-invariant.spec.ts` — add:
  - `platform_audit_log` table exists in test DB with columns `id`, `sourceEventId` (unique), `seqNo`, `action`, `tenantId`, `actor`, `previousValue`, `newValue`, `occurredAt`, `createdAt`
  - Existing `platform_mirror_events`, `platform_ingest_cursor`, and `platform_tenants` rows survive (additive invariant, regression)

All RED until T-13.
**Exit**: test file exists; assertions fail before migration.
**Commit**: `test(platform-api): RED — platform_audit_log migration additive invariant`

---

### [x] T-13 — GREEN: `PlatformAuditLog` Prisma model + generate additive migration (A7)
**Type**: impl
**Spec**: platform-audit-log — platform_audit_log Append-Only Projection; A7
**WU**: WU-2, commit 2
**Depends on**: T-12

- In `apps/viewpro-api/prisma/schema.prisma`, add:
  ```prisma
  /// Append-only audit trail projection for AUDIT_LOGGED events (vision D3).
  /// sourceEventId's own unique constraint is the SOLE dedup mechanism for this
  /// event type — AUDIT_LOGGED is never written to platform_mirror_events (A5/A6).
  model PlatformAuditLog {
    id            String   @id @default(uuid())
    sourceEventId String   @unique
    seqNo         BigInt
    action        String
    tenantId      String
    actor         Json
    previousValue Json?
    newValue      Json?
    occurredAt    DateTime
    createdAt     DateTime @default(now())

    @@index([seqNo])
    @@map("platform_audit_log")
  }
  ```
- Run `pnpm --filter @viewpro/platform-api exec prisma migrate dev --name add_platform_audit_log` against the viewpro test DB
- Commit generated migration SQL; run `pnpm --filter @viewpro/platform-api exec prisma generate`
- Confirm T-12 GREEN

**Rollback**: `DROP TABLE platform_audit_log` — additive only; `platform_mirror_events`/`platform_ingest_cursor`/`platform_tenants` untouched.
**Exit**: `pnpm --filter @viewpro/platform-api exec prisma validate` passes; T-12 GREEN.
**Commit**: `feat(platform-api): additive migration + PlatformAuditLog model (A7)`

---

### [x] T-14 — RED: `AuditLogRepository.appendFromEvent` — idempotent upsert on `sourceEventId` (regression guard d)
**Type**: test (RED)
**Spec**: platform-audit-log — platform_audit_log Append-Only Projection (both scenarios); A8
**WU**: WU-2, commit 3
**Depends on**: T-13

- `apps/viewpro-api/src/platform-data/__tests__/audit-log.repository.spec.ts` (vitest + test DB):
  - `appendFromEvent(event)` with a fresh `sourceEventId` → exactly one `platform_audit_log` row with `action`, `tenantId`, `actor`, `previousValue`, `newValue`, `occurredAt`, `seqNo` populated from the event
  - Re-invoking `appendFromEvent` with the SAME `sourceEventId` → still exactly one row, no error (idempotent, regression guard d)
  - `seqNo` is stored as `BigInt` (W1 pattern, mirrors `MirrorRepository`)

All RED until T-15.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — AuditLogRepository.appendFromEvent idempotent upsert (A8)`

---

### [x] T-15 — GREEN: `AuditLogRepository` (A8)
**Type**: impl
**Spec**: platform-audit-log — platform_audit_log Append-Only Projection; A8
**WU**: WU-2, commit 4
**Depends on**: T-14

- Create `apps/viewpro-api/src/platform-data/audit-log.repository.ts`:
  ```ts
  import { Injectable } from '@nestjs/common'
  import { PrismaService } from '../database/prisma.service'
  import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

  @Injectable()
  export class AuditLogRepository {
    constructor(private readonly prisma: PrismaService) {}

    async appendFromEvent(event: PlatformOutboxEvent): Promise<void> {
      const payload = event.payload as {
        action: string
        previousValue?: unknown
        newValue?: unknown
        actor: unknown
      }

      await this.prisma.platformAuditLog.upsert({
        where: { sourceEventId: event.id },
        update: {}, // no-op on conflict — idempotent (A8, mirrors MirrorRepository)
        create: {
          sourceEventId: event.id,
          seqNo: BigInt(event.seqNo),
          action: payload.action,
          tenantId: event.tenantId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actor: payload.actor as any,
          previousValue: payload.previousValue as any,
          newValue: payload.newValue as any,
          occurredAt: new Date(event.occurredAt),
        },
      })
    }
  }
  ```
- Confirm T-14 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-14 GREEN.
**Commit**: `feat(platform-api): AuditLogRepository.appendFromEvent (A8)`

---

### [x] T-16 — RED: ingest routing — `AUDIT_LOGGED` → `platform_audit_log` ONLY (regression guards a/b/d)
**Type**: test (RED)
**Spec**: platform-data-lane delta — Ingest Routing for AUDIT_LOGGED (all 4 scenarios); Mirror Append — W2 Guard (all 3 scenarios)
**WU**: WU-2, commit 5
**Depends on**: T-15

- `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts` — add:
  - `AUDIT_LOGGED` event → `AuditLogRepository.appendFromEvent` called once; `PlatformTenantRepository.upsertFromRegistered`/`upsertFromStatusChange` NOT called (routing isolation)
  - `AUDIT_LOGGED` event ingested alongside one `TENANT_REGISTERED` and one `TENANT_STATUS_CHANGED` event in the same batch → `platform_tenants` reflects registration/status routing EXACTLY as before this change (regression guard b, unregressed)
  - Re-delivery of the same `AUDIT_LOGGED` `sourceEventId` → `AuditLogRepository.appendFromEvent` called again but the DB layer dedups (integration-level, via T-14's idempotent upsert) — no error (regression guard d)
  - `ingestBatch` advances the cursor to `seqNo=N` after processing a batch containing only one `AUDIT_LOGGED` event (non-stalling)
- `apps/viewpro-api/src/platform-data/__tests__/migration-invariant.spec.ts` or a new `mirror.repository.spec.ts` — add (regression guard a, confirms A5/A6 with ZERO `MirrorRepository` code change):
  - `MirrorRepository.upsertEvent` on an `AUDIT_LOGGED` event (no `newStatus` in payload) → no `platform_mirror_events` row created; existing `[W2]` skip-warning path exercised (regression — same guard, no new code path)
  - `TENANT_STATUS_CHANGED` with missing `newStatus` is STILL skipped (regression, unmodified guard)

All RED until T-17.
**Exit**: test files exist; all new assertions fail.
**Commit**: `test(platform-api): RED — ingest routing AUDIT_LOGGED→platform_audit_log only; mirror/tenants unregressed`

---

### [x] T-17 — GREEN: `AUDIT_LOGGED` branch in `routeToTenantProjection` + wire `AuditLogRepository` into `IngestService`
**Type**: impl
**Spec**: platform-data-lane delta — Ingest Routing for AUDIT_LOGGED; A6
**WU**: WU-2, commit 6
**Depends on**: T-16

- In `apps/viewpro-api/src/platform-data/ingest.service.ts`:
  - Add `AuditLogRepository` as a 4th constructor param
  - In `routeToTenantProjection(event)`, add a branch for `event.eventType === 'AUDIT_LOGGED'` BEFORE the existing `TENANT_*` `newStatus`-guarded branches (A6 — `AUDIT_LOGGED` has no `newStatus`; it must NOT go through that guard):
    ```ts
    if (event.eventType === 'AUDIT_LOGGED') {
      await this.auditLogRepo.appendFromEvent(event)
      return
    }
    ```
  - No change to `MirrorRepository` (A5, confirmed by T-16's passing regression tests — the existing W2 guard already excludes `AUDIT_LOGGED`)
- Confirm T-16 GREEN; prior ingest/cursor/tenant-projection tests GREEN (regression)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-16 GREEN; all prior tests GREEN.
**Commit**: `feat(platform-api): AUDIT_LOGGED ingest routing branch, W2-exempt (A6)`

---

### [x] T-18 — RED: `AuditController`/`AuditService` — pagination, auth, isolation (A9/A10)
**Type**: test (RED)
**Spec**: platform-audit-log — Operator Audit Feed Endpoint (all 5 scenarios)
**WU**: WU-2, commit 7
**Depends on**: T-17

- `apps/viewpro-api/src/platform-data/__tests__/audit.controller.spec.ts` (vitest + supertest, test DB):
  - Authenticated operator + 3 seeded `platform_audit_log` rows with increasing `seqNo` → 200 + `items` ordered `seqNo` DESC; each item has `id, action, tenantId, actor, previousValue, newValue, occurredAt, seqNo`
  - No `limit` query param → at most 50 items returned (default)
  - `?limit=1000` → capped at 200 (A9)
  - No `viewpro_platform_access_token` cookie → 401 (spec: unauthenticated rejected)
  - Empty `platform_audit_log` → 200 + `{ total: 0, items: [] }`
  - Endpoint accepts NO `tenantId` query param — passing one has no filtering effect (Q3/spec invariant: global-only)
  - Isolation: `AuditService` imports no `@prisma/client` from InmoView — only `src/generated/prisma` (isolation invariant, static check)
  - `GET /operators/audit` with InmoView's DB address unreachable (mocked/simulated) still returns 200 from `platform_audit_log` only (spec scenario: zero InmoView DB reads)

All RED until T-19.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — AuditController (pagination, auth, empty-state, isolation)`

---

### [x] T-19 — GREEN: `AuditController` + `AuditService` + module wiring (A9/A10)
**Type**: impl
**Spec**: platform-audit-log — Operator Audit Feed Endpoint; A9; A10
**WU**: WU-2, commit 8
**Depends on**: T-18

- Create `apps/viewpro-api/src/platform-data/audit.service.ts`:
  - `listAudit(offset: number, limit: number): Promise<{ total: number; items: [...] }>` — `prisma.platformAuditLog.findMany({ skip: offset, take: Math.min(limit, 200), orderBy: { seqNo: 'desc' } })` + `prisma.platformAuditLog.count()`; converts `seqNo` `BigInt → Number()` at the JSON boundary (mirrors `PrismaOutboxRepository.findSince`); never touches InmoView DB
- Create `apps/viewpro-api/src/platform-data/audit.controller.ts`:
  - `@Controller('operators/audit') @UseGuards(AuthGuard)` — `@Get() list(@Query('offset') offset?, @Query('limit') limit?)` using the same `sanitizeOffset`/`sanitizeLimit` pattern as `TenantRegistryController` (default 50, cap enforced in the service)
- In `apps/viewpro-api/src/platform-data/platform-data.module.ts`:
  - Register `AuditLogRepository`, `AuditService` in `providers`; `AuditController` in `controllers`
  - Pass `AuditLogRepository` into the `IngestService` provider wiring
- Confirm T-18 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-18 GREEN; `pnpm --filter @viewpro/platform-api typecheck` passes.
**Commit**: `feat(platform-api): AuditController + AuditService — GET /operators/audit (A9/A10)`

---

### [x] T-20 — RED: integration regression suite — mirror uncorrupted, metrics uncorrupted, tx atomicity end-to-end (regression guards a/b/c/d, full pipeline)
**Type**: test (RED)
**Spec**: platform-data-lane delta — Tenant status metrics are not corrupted by AUDIT_LOGGED events; platform-audit-log — all transactional-emit and idempotency scenarios (full-pipeline confirmation)
**WU**: WU-2, commit 9
**Depends on**: T-19

- `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts` or a new `audit-pipeline-integration.spec.ts` (vitest + test DB):
  - **Regression guard (a)**: seed a `TENANT_STATUS_CHANGED` mirror row for tenant X with `newStatus=ACTIVE`, then ingest a subsequent `AUDIT_LOGGED` event for the same tenant (e.g. a limits change) → `MetricsService.getSummary().byStatus` still counts tenant X under `ACTIVE`; `platform_mirror_events` row count for that tenant is unchanged (the `AUDIT_LOGGED` event never entered the mirror, so it cannot become the "latest" row)
  - **Regression guard (b)**: ingest one `TENANT_STATUS_CHANGED` and one `AUDIT_LOGGED` event in the same batch → `platform_tenants.latestStatus` reflects the status-change routing exactly as before this change; `platform_audit_log` gains exactly one row (for the `AUDIT_LOGGED` event only)
  - **Regression guard (c)**: via the full app (`apps/api`) — a limits PATCH whose `$transaction` is forced to roll back (simulated constraint violation) leaves zero `AUDIT_LOGGED` rows in `platform_outbox_events`
  - **Regression guard (d)**: re-deliver the identical `AUDIT_LOGGED` event (same `sourceEventId`) through `ingestBatch` twice → `platform_audit_log` still contains exactly one row for that `sourceEventId`; no error

All RED until T-21.
**Exit**: test file(s) exist; all 4 regression-guard assertions fail before any fix is needed (should mostly already pass if T-09/T-11/T-15/T-17 are correct — this task PROVES the guards, no new production code expected).
**Commit**: `test(both): RED — full-pipeline regression: mirror/metrics uncorrupted, tx atomicity, re-delivery idempotency`

---

### [x] T-21 — GREEN: confirm regression suite passes (no new production code expected)
**Type**: impl
**Spec**: All regression guards a/b/c/d; platform-data-lane delta invariants
**WU**: WU-2, commit 10
**Depends on**: T-20

- Run `pnpm --filter @viewpro/api test` and `pnpm --filter @viewpro/platform-api test`; fix any wiring gaps found (structural only — T-20 is expected to pass given T-09/T-11/T-15/T-17 are correctly implemented)
- Confirm isolation: `rg '@prisma/client' apps/viewpro-api/src/platform-data/` → zero InmoView Prisma client imports

**Exit**: all T-20 regression assertions GREEN; isolation confirmed.
**Commit**: `test(both): GREEN — full-pipeline regression confirmed (mirror/metrics/tx/idempotency)`

---

## WU-3 — viewpro-web `features/audit` global feed + route + final verification

### [ ] T-22 — RED: `features/audit` api layer — zod defensive parse, `renderValue` degrades safely
**Type**: test (RED)
**Spec**: platform-audit-log — viewpro-web Global Audit Feed (feed-renders scenario, implicitly); design Testing Strategy — FE zod parse tolerates absent/malformed previousValue (R4)
**WU**: WU-3, commit 1
**Depends on**: T-21

- `apps/viewpro-web/src/features/audit/api/__tests__/audit-api.spec.ts` (mirrors `tenants-api.spec.ts`):
  - `getAuditFeed(offset, limit)` calls `apiRequest('/operators/audit?offset=<n>&limit=<n>')` and zod-parses the response into `AuditFeedResponse`
  - Malformed/absent `previousValue`/`newValue` (missing, `null`, non-object) does NOT throw during zod parse (`z.unknown()`); a well-formed `total`/`items[]` still parses
  - Malformed top-level response (missing `items`) → throws a normalized `ApiError`-shaped error (mirrors `PARSE_ERROR` pattern in `tenants/api/schemas.ts`)
- `apps/viewpro-web/src/features/audit/components/__tests__/render-value.spec.ts`:
  - `renderValue(null)` / `renderValue(undefined)` → `'—'`
  - `renderValue({ status: 'ACTIVE' })` → renders `status: ACTIVE`-style key:value line(s)
  - `renderValue('ACTIVE')` / `renderValue(42)` → `String(v)`, never throws

All RED until T-23.
**Exit**: test files exist; all assertions fail (modules do not exist yet).
**Commit**: `test(viewpro-web): RED — features/audit api layer zod parse + renderValue defensive rendering (R4)`

---

### [ ] T-23 — GREEN: `features/audit/api/{types,schemas,service,queries}.ts` + `renderValue` helper
**Type**: impl
**Spec**: platform-audit-log — viewpro-web Global Audit Feed; A11
**WU**: WU-3, commit 2
**Depends on**: T-22

- Create `apps/viewpro-web/src/features/audit/api/types.ts`:
  - `AuditActor = { id: string; type: string; label: string }`
  - `AuditLogItem = { id: string; action: string; tenantId: string; actor: AuditActor; previousValue: unknown; newValue: unknown; occurredAt: string; seqNo: number }`
  - `AuditFeedResponse = { total: number; items: AuditLogItem[] }`
- Create `apps/viewpro-web/src/features/audit/api/schemas.ts`:
  - `actorSchema = z.object({ id: z.string(), type: z.string(), label: z.string() })`
  - `itemSchema = z.object({ id: z.string(), action: z.string(), tenantId: z.string(), actor: actorSchema, previousValue: z.unknown(), newValue: z.unknown(), occurredAt: z.string(), seqNo: z.number() })`
  - `feedSchema = z.object({ total: z.number(), items: z.array(itemSchema) })`; `safeParse` → normalized `ApiError` on failure (mirrors `PARSE_ERROR` pattern)
- Create `apps/viewpro-web/src/features/audit/api/service.ts`:
  - `getAuditFeed(offset: number, limit: number): Promise<AuditFeedResponse>` → `apiRequest('/operators/audit?offset=...&limit=...')` then zod-parse
- Create `apps/viewpro-web/src/features/audit/api/queries.ts`:
  - `auditKeys = { all: ['audit'], list: (offset, limit) => [...] }`
  - `auditFeedOptions(offset, limit)` → `queryOptions({ queryKey: auditKeys.list(offset, limit), queryFn: () => getAuditFeed(offset, limit) })`
- Create `apps/viewpro-web/src/features/audit/components/render-value.ts` (or `.tsx` if JSX-returning):
  - `renderValue(v: unknown)`: `null`/`undefined` → `'—'`; plain object → key:value lines; else → `String(v)`
  - Action label map: `{ TENANT_STATUS_CHANGED: 'Estado', TENANT_LIMITS_UPDATED: 'Límites' }` with raw-string fallback (Q4)
- Confirm T-22 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-22 GREEN.
**Commit**: `feat(viewpro-web): features/audit api layer + renderValue helper (A11/Q4)`

---

### [ ] T-24 — RED: audit feed components — table/pager/empty-state/loading/error (all 5 spec scenarios)
**Type**: test (RED)
**Spec**: platform-audit-log — viewpro-web Global Audit Feed (all 5 scenarios)
**WU**: WU-3, commit 3
**Depends on**: T-23

- `apps/viewpro-web/src/features/audit/components/__tests__/audit-feed-page.spec.tsx` (mirrors `tenants-management-page.spec.tsx`):
  - 3 fetched items → 3 rows rendered, each showing actor label, action label, target tenant, timestamp, and old→new values (via `renderValue`)
  - Pagination: triggering the next-page control issues a request for the next `offset`; returned rows replace the displayed list
  - Loading state: request not yet resolved → loading indicator shown, no table
  - Empty state: `{ total: 0, items: [] }` → empty-state message shown, no table
  - Error state: fetch fails (network error / non-2xx) → error message shown, no unhandled exception thrown
- `apps/viewpro-web/src/features/audit/components/__tests__/audit-table.spec.tsx` + `audit-pager.spec.tsx` + `audit-empty-state.spec.tsx` (unit-level, mirror the `tenants-table`/`tenants-pager`/`tenants-empty-state` spec files 1:1)

All RED until T-25.
**Exit**: test files exist; all assertions fail.
**Commit**: `test(viewpro-web): RED — audit-feed-page/audit-table/audit-pager/audit-empty-state (all 5 scenarios)`

---

### [ ] T-25 — GREEN: `audit-feed-page` + `audit-table` + `audit-pager` + `audit-empty-state`
**Type**: impl
**Spec**: platform-audit-log — viewpro-web Global Audit Feed
**WU**: WU-3, commit 4
**Depends on**: T-24

- Create `apps/viewpro-web/src/features/audit/components/audit-empty-state.tsx` — mirrors `tenants-empty-state.tsx` (es-AR copy: "Todavía no hay eventos de auditoría")
- Create `apps/viewpro-web/src/features/audit/components/audit-pager.tsx` — mirrors `tenants-pager.tsx` exactly (offset/limit, "Mostrando X–Y de Z", Anterior/Siguiente)
- Create `apps/viewpro-web/src/features/audit/components/audit-table.tsx` — columns: Actor (label), Acción (via action label map, Q4), Inquilino (tenantId), Fecha (formatted `occurredAt`), Cambio (old→new via `renderValue`)
- Create `apps/viewpro-web/src/features/audit/components/audit-feed-page.tsx` — container (mirrors `tenants-management-page.tsx` structure minus mutations: owns the list query + offset state only, read-only feed, no dialogs/mutations)
- Confirm T-24 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-24 GREEN.
**Commit**: `feat(viewpro-web): audit-feed-page + audit-table + audit-pager + audit-empty-state`

---

### [ ] T-26 — GREEN: route `app/dashboard/audit/page.tsx` + nav-config.ts entry
**Type**: impl
**Spec**: platform-audit-log — viewpro-web Global Audit Feed (route gated behind authentication)
**WU**: WU-3, commit 5
**Depends on**: T-25

- Create `apps/viewpro-web/src/app/dashboard/audit/page.tsx` — thin route (mirrors `app/dashboard/tenants/page.tsx`):
  ```tsx
  'use client';
  import PageContainer from '@/components/layout/page-container';
  import { AuditFeedPage } from '@/features/audit/components/audit-feed-page';

  export default function AuditPage() {
    return (
      <PageContainer pageTitle='Auditoría' pageDescription='Historial global de cambios en la plataforma ViewPro.'>
        <AuditFeedPage />
      </PageContainer>
    );
  }
  ```
- In `apps/viewpro-web/src/config/nav-config.ts`: add `{ title: 'Auditoría', url: '/dashboard/audit', icon: '<pick an existing icon>', isActive: false, items: [] }` to the `Operaciones` group
- Add `apps/viewpro-web/src/app/dashboard/audit/__tests__/page.spec.tsx` (mirrors `app/dashboard/tenants/__tests__/page.spec.tsx`) — smoke-renders `AuditPage` inside `PageContainer`

**Exit**: `pnpm --filter viewpro-web test` all GREEN; `pnpm --filter viewpro-web typecheck` passes; `/dashboard/audit` reachable via nav.
**Commit**: `feat(viewpro-web): route app/dashboard/audit + nav-config.ts Auditoría entry`

---

### [ ] T-27 — Coordinated deploy documentation + final verification
**Type**: verify
**Spec**: All invariants; proposal acceptance criteria 1–10; coordinated deploy §5 / design Migration-Rollout
**WU**: WU-3, commit 6
**Depends on**: T-26

**Add deploy-sequence comment** to the viewpro-api migration SQL (`apps/viewpro-api/prisma/migrations/*_add_platform_audit_log/migration.sql`):
```sql
-- DEPLOY ORDER (platform-audit-log, R1):
-- Step 1: ship platform-contract union member AUDIT_LOGGED + AuditLoggedPayload (WU-1, PR 1 merged to main).
-- Step 2: deploy viewpro-api — platform_audit_log migration + explicit AUDIT_LOGGED ingest branch (tolerant)
--         + GET /operators/audit. No audit events exist yet — the feed is empty, which is acceptable.
-- Step 3: deploy InmoView — AUDIT_LOGGED emit at both the status and limits sites.
-- Step 4: features/audit (viewpro-web) is additive and ships last / independently.
```

**Final verification checklist**:
1. `pnpm --filter @viewpro/api test` — all GREEN (auth/admin/platform-data suites)
2. `pnpm --filter @viewpro/platform-api test` — all GREEN
3. `pnpm --filter @viewpro/api typecheck` — passes (compile-time assertions)
4. `pnpm --filter @viewpro/platform-api typecheck` — passes
5. `pnpm --filter viewpro-web test` — all GREEN
6. `pnpm --filter viewpro-web typecheck` — passes
7. `pnpm --filter viewpro-web build` — succeeds
8. `rg '@prisma/client' apps/viewpro-api/src/platform-data/` — zero InmoView Prisma client imports
9. `rg 'analytics_events' apps/viewpro-api/src apps/viewpro-web/src` — zero InmoView-analytics reads on the audit path (isolation)
10. `rg 'INMOVIEW_DB|DATABASE_URL' apps/viewpro-api/src/platform-data/` — zero InmoView DB refs
11. `git diff HEAD -- apps/api/src/admin/` — no unintended admin regressions beyond the two emit sites + `audit-actor.ts`
12. `git diff HEAD -- apps/viewpro-api/src/platform-data/mirror.repository.ts` — EMPTY (zero-diff confirmation of A5 — no mirror code change)
13. `git diff HEAD -- apps/viewpro-api/src/platform-data/metrics.service.ts` — EMPTY (zero-diff confirmation — no metrics regressions)
14. Confirm `platform_audit_log` migration SQL exists with deploy-order comment; `platform_mirror_events`/`platform_ingest_cursor`/`platform_tenants` untouched
15. Confirm re-running T-20's re-delivery test twice in the test harness leaves `platform_audit_log` row count unchanged on the second run
16. Confirm `GET /operators/audit` response shape matches spec exactly: `{ total, items: [{ id, action, tenantId, actor, previousValue, newValue, occurredAt, seqNo }] }`, `seqNo` DESC

**Exit**: all 16 checks pass; no regressions.
**Commit**: `chore(platform-audit-log): coordinated deploy note + final verification`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-01 widen contract — AuditActor + AuditLoggedPayload | impl | WU-1 | platform-data-lane delta — AUDIT_LOGGED Event Type | — |
| T-02 RED: compile-time assertions | test | WU-1 | Contract accepts AUDIT_LOGGED (both scenarios) | T-01 |
| T-03 GREEN: assertions wired | impl | WU-1 | Contract backward compat | T-02 |
| T-04 RED: writer accepts AUDIT_LOGGED arm | test | WU-1 | platform-data-lane delta — writer union | T-03 |
| T-05 GREEN: widen OutboxEventInput union | impl | WU-1 | writer union | T-04 |
| T-06 RED: toAuditActor mapper tests | test | WU-1 | Audit Actor Identity (both actor-type scenarios); Q1/Q5 | T-05 |
| T-07 GREEN: shared audit-actor.ts | impl | WU-1 | Q1/Q5 | T-06 |
| T-08 RED: status repo 2nd emit + rollback guard (b) | test | WU-1 | Status Change Audit Event (all 3 scenarios) | T-07 |
| T-09 GREEN: status repo 2nd emit | impl | WU-1 | Status Change Audit Event | T-08 |
| T-10 RED: limits repo 1st emit + rollback guard (c) | test | WU-1 | Limits Change Audit Event (both scenarios) | T-09 |
| T-11 GREEN: inject writer + limits repo 1st emit | impl | WU-1 | Limits Change Audit Event; A4 | T-10 |
| T-12 RED: platform_audit_log migration invariant | test | WU-2 | platform_audit_log Append-Only Projection (schema) | T-11 |
| T-13 GREEN: PlatformAuditLog model + migration | impl | WU-2 | A7 | T-12 |
| T-14 RED: AuditLogRepository idempotent upsert guard (d) | test | WU-2 | platform_audit_log Append-Only Projection (both scenarios); A8 | T-13 |
| T-15 GREEN: AuditLogRepository | impl | WU-2 | A8 | T-14 |
| T-16 RED: ingest routing — audit-only + mirror/tenants regression guards (a/b/d) | test | WU-2 | Ingest Routing for AUDIT_LOGGED (all 4); Mirror Append W2 Guard (all 3) | T-15 |
| T-17 GREEN: routeToTenantProjection AUDIT_LOGGED branch | impl | WU-2 | A6 | T-16 |
| T-18 RED: AuditController/AuditService tests | test | WU-2 | Operator Audit Feed Endpoint (all 5 scenarios) | T-17 |
| T-19 GREEN: AuditController + AuditService + module wiring | impl | WU-2 | A9/A10 | T-18 |
| T-20 RED: full-pipeline regression (guards a/b/c/d) | test | WU-2 | Metrics uncorrupted; all transactional/idempotency scenarios | T-19 |
| T-21 GREEN: confirm regression suite passes | impl | WU-2 | Regression guards a/b/c/d | T-20 |
| T-22 RED: features/audit api layer — zod + renderValue | test | WU-3 | viewpro-web Global Audit Feed (implicit); R4 | T-21 |
| T-23 GREEN: features/audit api layer + renderValue | impl | WU-3 | A11; Q4 | T-22 |
| T-24 RED: audit feed components (all 5 scenarios) | test | WU-3 | viewpro-web Global Audit Feed (all 5 scenarios) | T-23 |
| T-25 GREEN: audit-feed-page + table + pager + empty-state | impl | WU-3 | viewpro-web Global Audit Feed | T-24 |
| T-26 GREEN: route + nav entry | impl | WU-3 | Route gated behind authentication | T-25 |
| T-27 Deploy doc + final verification | verify | WU-3 | All invariants + acceptance criteria 1–10; R1 deploy ordering | T-26 |

---

## Success Checklist (maps to spec acceptance criteria)

- [x] A status change emits exactly one `AUDIT_LOGGED` event in the same `$transaction`; existing `TENANT_STATUS_CHANGED` emit unaffected (T-08, T-09 — acceptance #1)
- [x] A limits change emits exactly one `AUDIT_LOGGED` event in the same `$transaction` (limits' first-ever outbox emit) (T-10, T-11 — acceptance #2)
- [x] Each event carries `actor` (WHICH identity), `tenantId`, `action`, `previousValue`/`newValue` (T-06, T-07, T-09, T-11 — acceptance #3)
- [x] viewpro-api ingest appends one `platform_audit_log` row per event; re-delivery idempotent on `sourceEventId` (T-14, T-15, T-16, T-20 — acceptance #4)
- [x] `GET /operators/audit` returns newest-first (`seqNo` DESC), offset/limit paginated (cap 200), `{total, items}`, from `viewpro_platform` only (T-18, T-19 — acceptance #5)
- [x] `GET /operators/audit` is operator-only: 401 without a valid operator session (T-18 — acceptance #6)
- [ ] viewpro-web renders a single global, paginated, chronological audit feed (actor/action/tenant/timestamp/old→new) (T-22–T-26 — acceptance #7)
- [x] Isolation preserved (viewpro-api half): no InmoView DB / `analytics_events` read anywhere in viewpro-api (T-18 isolation check — acceptance #8; viewpro-web half deferred to WU-3/T-27)
- [x] `platform_mirror_events` append + cursor/seqNo semantics unchanged; `AUDIT_LOGGED` correctly W2-skipped (T-16, T-20 — final T-27 checklist #12 zero-diff confirmation deferred to WU-3)
- [x] No InmoView schema migration — only new outbox rows; only migration is `platform_audit_log` on `viewpro_platform` (T-13 — acceptance #10)
- [x] Regression guard (a): `AUDIT_LOGGED` never in `platform_mirror_events`; metrics status breakdown uncorrupted (T-16, T-20)
- [x] Regression guard (b): `TENANT_STATUS_CHANGED` still emits + still projects to `platform_tenants`, unregressed (T-08, T-09, T-16, T-20)
- [x] Regression guard (c): limits emit is inside the tx — rollback ⇒ no event (T-10, T-11 — proven by WU-1's existing apps/api suite, reverified GREEN in T-21)
- [x] Regression guard (d): re-delivery idempotency via `platform_audit_log.sourceEventId` (T-14, T-20)
- [ ] Coordinated deploy ordering documented in migration SQL (T-27)
