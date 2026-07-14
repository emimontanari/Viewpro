# Tasks: Platform Phase 6 — DATA LANE (transactional outbox + poll ingest + operator metrics)

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions D1–D9 are LOCKED — do not reopen.

---

## Open Questions — resolved inline (tasks phase)

| Question | Decision |
|----------|----------|
| `PLATFORM_POLL_INTERVAL_MS` default | 5 000 ms (env-configurable; safe for prod) |
| `PLATFORM_DATA_BATCH_SIZE` default | 100 events per poll tick |
| `seqNo` type | `number` in slice 1 (note: risk at 2^53; log a TODO for BigInt migration) |
| Feed-error handling | Log-and-skip; retry next tick (no exponential backoff in slice 1) |
| Cursor bootstrap | Migration seeds `platform_ingest_cursor` with `seqNo = 0`; no upsert-on-first-poll |
| Cursor concurrency | Single overlap-guarded poller → no DB lock needed (note FOR UPDATE if 2nd poller added later) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1 200 (new modules × 2 apps, contract package, 3 migrations, tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → contract data/ + InmoView outbox migration + transactional writer / PR 2 → PlatformDataModule change-feed endpoint (apps/api) / PR 3 → viewpro-api mirror + cursor + poller + metrics endpoint |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | platform-contract `data/` namespace + InmoView additive migration + `PlatformOutboxWriter` wired in existing `$transaction` | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/api test` (outbox + migration suite) | `PATCH /admin/tenants/:id/status` still commits one outbox row on test DB | Drop `platform_outbox_events` table; revert outbox writer call in repo; revert contract `data/` exports |
| WU-2 | `PlatformDataModule` — change-feed endpoint behind `PlatformControlGuard` | PR 2 (base: PR 1 branch) | `pnpm --filter @viewpro/api test` (platform-data spec files) | `GET /internal/platform/changes?since=0` with valid service token → events returned | Delete `apps/api/src/platform-data/`; remove module import from `app.module.ts` |
| WU-3 | viewpro-api mirror DB + cursor + poll ingest job + operator metrics endpoint | PR 3 (base: PR 2 branch) | `pnpm --filter @viewpro/platform-api test` (platform-data spec) | `GET /operators/metrics/summary` after manual ingest → returns counts from mirror | Revert `apps/viewpro-api/src/platform-data/`; drop mirror + cursor tables; revert env schema + app.config |

---

## Dependency Graph

```
T-01 (platform-contract data/ namespace — both apps)
  └── T-02 (RED: compile-time type assertion test)
        └── T-03 (GREEN: type assertion + index re-export)
              └── T-04 (R1 LIVE-DB migration — platform_outbox_events HIGHEST RISK)
                    └── T-05 (RED: migration additive-invariant test)
                          └── T-06 (GREEN: migration invariant confirmed)
                                └── T-07 (RED: PlatformOutboxWriter unit tests)
                                      └── T-08 (GREEN: PlatformOutboxWriter impl)
                                            └── T-09 (RED: outbox-write integration test in repo $transaction)
                                                  └── T-10 (GREEN: wire writer into PrismaAdminTenantStatusRepository)
                                                        ├── T-11 (RED: change-feed controller unit tests)
                                                        │     └── T-12 (GREEN: PlatformDataController + PlatformDataModule)
                                                        │           └── T-13 (RED: cursor/pagination edge-case tests)
                                                        │                 └── T-14 (GREEN: edge cases confirmed)
                                                        │                       └── T-15 (RED: viewpro-api env + change-feed client tests)
                                                        │                             └── T-16 (GREEN: ChangeFeedClient)
                                                        │                                   └── T-17 (R2 + R3 migrations — viewpro_platform mirror + cursor)
                                                        │                                         └── T-18 (RED: mirror ingest + cursor unit tests)
                                                        │                                               └── T-19 (GREEN: IngestService + repos)
                                                        │                                                     └── T-20 (RED: poll-job lifecycle tests)
                                                        │                                                           └── T-21 (GREEN: PlatformDataPollJob)
                                                        │                                                                 └── T-22 (RED: metrics endpoint tests)
                                                        │                                                                       └── T-23 (GREEN: MetricsController + PlatformDataModule viewpro)
                                                        │                                                                             └── T-24 (final verification)
                                                        └── T-11 ↑
```

T-11 may begin in parallel with T-11 note above — sequential within WU-2 chain.

---

## WU-1 — platform-contract `data/` + InmoView outbox migration + transactional writer

### [x] T-01 — Add `packages/platform-contract/src/data/` namespace skeleton
**Type**: impl
**Spec**: platform-data-lane-outbox — Change-Feed Endpoint; proposal §in-scope item 7
**WU**: WU-1, commit 1
**Depends on**: nothing

- Create `packages/platform-contract/src/data/platform-outbox-event.ts`: export `type PlatformOutboxEvent = { id: string; seqNo: number; eventType: 'TENANT_STATUS_CHANGED'; tenantId: string; payload: TenantStatusChangedPayload; occurredAt: string }` and `type TenantStatusChangedPayload = { previousStatus: string; newStatus: string }`
- Create `packages/platform-contract/src/data/change-feed-response.ts`: export `type ChangeFeedCursor = number` and `type ChangeFeedResponse = { events: PlatformOutboxEvent[]; nextCursor: ChangeFeedCursor }`
- Create `packages/platform-contract/src/data/index.ts` re-exporting both files
- Re-export from `packages/platform-contract/src/index.ts` under `data/` barrel
- Add `"@viewpro/platform-contract": "workspace:*"` to `apps/api/package.json` if not already present (Phase 5 may have added it); confirm for `apps/viewpro-api/package.json`
- Run `pnpm install` from workspace root

**Exit**: `pnpm --filter @viewpro/platform-contract typecheck` passes; contract types importable from both apps.
**Commit**: `feat(platform-contract): data/ namespace — PlatformOutboxEvent, ChangeFeedResponse`

---

### [x] T-02 — RED: compile-time type-equality assertion test
**Type**: test (RED)
**Spec**: proposal R7 — contract vs Prisma drift
**WU**: WU-1, commit 2
**Depends on**: T-01

- `packages/platform-contract/src/data/__tests__/type-assertions.spec.ts` (vitest)
  - Assert `type _Assert = [PlatformTenantStatus] extends [TenantStatus] ? [TenantStatus] extends [PlatformTenantStatus] ? true : never : never` resolves to `true` at compile time
  - Assert `type _BadAssert = ...` with mismatched type resolves to `never` (negative test via `@ts-expect-error`)
- Add `apps/api/src/platform-data/type-assertions.ts` stub (empty) so import fails at runtime; tests RED

All RED until assertion is wired.
**Exit**: test file exists; type assertions compile-fail until T-03.
**Commit**: `test(platform-contract): RED — compile-time type equality assertion PlatformTenantStatus ↔ TenantStatus`

---

### [x] T-03 — GREEN: wire type assertion; export from contract
**Type**: impl
**Spec**: proposal R7
**WU**: WU-1, commit 3
**Depends on**: T-02

- In `packages/platform-contract/src/data/type-assertions.ts`, add the compile-time assertion importing from `@prisma/client` (apps/api Prisma types) — use a path alias or import from the apps/api Prisma output if accessible; alternatively place assertion in `apps/api/src/platform-data/type-assertions.ts` importing both
- Confirm T-02 GREEN; `pnpm --filter @viewpro/api typecheck` and `pnpm --filter @viewpro/platform-api typecheck` both pass

**Exit**: typecheck passes; assertion test GREEN.
**Commit**: `feat(platform-contract): compile-time type assertion PlatformTenantStatus ↔ TenantStatus`

---

### [x] T-04 — R1 LIVE-DB MIGRATION — additive `platform_outbox_events` on InmoView (HIGHEST RISK)
**Type**: impl
**Spec**: platform-data-lane-outbox — Outbox Schema requirement (both scenarios)
**WU**: WU-1, commit 4
**Depends on**: T-03

**ORDER: deploy this migration BEFORE deploying any app code that writes or reads `platform_outbox_events`.**

- In `apps/api/prisma/schema.prisma`, add model:
  ```
  model PlatformOutboxEvent {
    id          String   @id @default(uuid())
    seqNo       BigInt   @default(autoincrement())
    eventType   String
    tenantId    String
    payload     Json
    occurredAt  DateTime
    @@index([seqNo])
    @@index([occurredAt, seqNo])
    @@map("platform_outbox_events")
  }
  ```
- Run `pnpm --filter @viewpro/api exec prisma migrate dev --name add_platform_outbox_events` against test DB
- Commit generated `apps/api/prisma/migrations/*/migration.sql`
- Run `pnpm --filter @viewpro/api exec prisma generate`

**Rollback**: `DROP TABLE platform_outbox_events` — zero impact on existing rows (additive only).
**Exit**: `pnpm --filter @viewpro/api exec prisma validate` passes; `prisma migrate status` shows up-to-date.
**Commit**: `feat(api): R1 additive migration — platform_outbox_events (seqNo BIGSERIAL + payload JSONB)`

---

### [x] T-05 — RED: migration additive-invariant test
**Type**: test (RED)
**Spec**: platform-data-lane-outbox — Outbox Schema — Scenario: Migration is additive; seqNo total order
**WU**: WU-1, commit 5
**Depends on**: T-04

- `apps/api/src/platform-data/__tests__/migration-invariant.spec.ts` (vitest + test DB)
  - Existing `Tenant` rows are intact after migration (count unchanged)
  - `PlatformOutboxEvent` model exists in Prisma DMMF
  - Two inserted rows with identical `occurredAt` receive distinct monotonically increasing `seqNo` values

All RED until migration applied and client generated.
**Exit**: test file exists; assertions fail before migration is applied.
**Commit**: `test(api): RED — platform_outbox_events migration additive invariant + seqNo total order`

---

### [x] T-06 — GREEN: confirm migration invariant test passes
**Type**: impl
**Spec**: platform-data-lane-outbox — Outbox Schema
**WU**: WU-1, commit 6
**Depends on**: T-05

- Wire test environment to test DB; run `pnpm --filter @viewpro/api test` — T-05 must go GREEN
- Confirm full admin + platform-control suite still GREEN (regression)

**Exit**: T-05 GREEN; full api suite GREEN.
**Commit**: `test(api): GREEN — outbox migration invariant confirmed on test DB`

---

### [x] T-07 — RED: unit tests for `PlatformOutboxWriter`
**Type**: test (RED)
**Spec**: platform-data-lane-outbox — Transactional Outbox Write requirement (both scenarios)
**WU**: WU-1, commit 7
**Depends on**: T-06

- `apps/api/src/platform-data/__tests__/platform-outbox-writer.spec.ts` (vitest, mocked Prisma tx client)
  - `emit(tx, event)` calls `tx.platformOutboxEvent.create(...)` with correct `eventType`, `tenantId`, `payload`, `occurredAt`
  - If `tx.platformOutboxEvent.create` throws, the error propagates (no swallowing)
  - `emit` is called with the SAME transaction client passed in — never opens a new connection

All RED until writer exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — PlatformOutboxWriter unit tests (emit in tx, error propagation)`

---

### [x] T-08 — GREEN: implement `PlatformOutboxWriter`
**Type**: impl
**Spec**: platform-data-lane-outbox — Transactional Outbox Write
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/api/src/platform-data/platform-outbox-writer.ts` — `@Injectable() class PlatformOutboxWriter { emit(tx: Prisma.TransactionClient, event: Omit<PlatformOutboxEvent, 'id' | 'seqNo'>): Promise<void> }` — calls `tx.platformOutboxEvent.create({ data: event })`; no catch block
- Confirm T-07 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-07 GREEN.
**Commit**: `feat(api): PlatformOutboxWriter — emit event inside caller transaction`

---

### [x] T-09 — RED: integration test — outbox write inside repo `$transaction` (D3)
**Type**: test (RED)
**Spec**: platform-data-lane-outbox — Scenario: Status change commits outbox row in same transaction; Scenario: Rolled-back domain transaction leaves no outbox row
**WU**: WU-1, commit 9
**Depends on**: T-08

- `apps/api/src/platform-data/__tests__/outbox-write-integration.spec.ts` (supertest + test DB)
  - After a successful `updateTenantStatus` call: exactly one `platform_outbox_events` row exists with `eventType=TENANT_STATUS_CHANGED`, correct `tenantId`, `payload.newStatus`
  - After a forced rollback (e.g. constraint violation): zero `platform_outbox_events` rows persist for that attempt
  - D4 invariant: calling `updateTenantStatus` with no actual change (no-op/unchanged branch) emits NO outbox row

All RED until writer is wired into the repo.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — outbox-write integration: commit⇔row, rollback⇔no-row, unchanged⇔no-emit`

---

### [x] T-10 — GREEN: wire `PlatformOutboxWriter` into `PrismaAdminTenantStatusRepository`
**Type**: impl
**Spec**: platform-data-lane-outbox — Transactional Outbox Write; Invariants (outbox in same $transaction)
**WU**: WU-1, commit 10
**Depends on**: T-09

- Inject `PlatformOutboxWriter` into `apps/api/src/admin/prisma-admin-tenant-status.repository.ts`
- Inside the `updated` branch of the `run(client)` closure in `$transaction`, call `await this.outboxWriter.emit(client, { eventType: 'TENANT_STATUS_CHANGED', tenantId, payload: { previousStatus, newStatus }, occurredAt: new Date() })`
- `unchanged` branch: emit nothing (D4)
- Register `PlatformOutboxWriter` as a provider in `AdminModule` (or `PlatformDataModule` exported and imported by `AdminModule`)
- Confirm T-09 GREEN; confirm existing admin test suite GREEN (regression)

**Exit**: `pnpm --filter @viewpro/api test` — T-09 GREEN; all prior tests GREEN.
**Commit**: `feat(api): wire PlatformOutboxWriter into updateTenantStatus $transaction (D3)`

---

## WU-2 — `PlatformDataModule` change-feed endpoint (apps/api)

### [ ] T-11 — RED: unit tests for `PlatformDataController` change-feed
**Type**: test (RED)
**Spec**: platform-data-lane-outbox — Change-Feed Endpoint (all 6 scenarios); Change-Feed Environment Configuration
**WU**: WU-2, commit 1
**Depends on**: T-10

- `apps/api/src/platform-data/__tests__/platform-data.controller.spec.ts` (vitest + supertest, test DB)
  - **Valid token + since=0 returns events ordered by seqNo ASC; nextCursor = max seqNo** (spec scenario 1)
  - **since=2 with events 1,2,3 returns only event 3; nextCursor=3** (spec scenario 2)
  - **No new events: empty array; nextCursor = supplied cursor** (spec scenario 3)
  - **Batch bounded: more events than limit → at most batchSize; nextCursor < max seqNo in table** (spec scenario 4)
  - **Missing/invalid service token → 401** (spec scenario 5, threat-matrix: token forgery)
  - **Ms-collision events (same occurredAt, distinct seqNo N and N+1) both returned when since=N-1** (spec scenario 6)
  - **`PLATFORM_DATA_BATCH_LIMIT` env var respected** (spec: env config scenario)

All RED until controller + module exist.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — PlatformDataController change-feed (all 6 scenarios + batch limit)`

---

### [ ] T-12 — GREEN: implement `PlatformDataController` + `PlatformDataModule`
**Type**: impl
**Spec**: platform-data-lane-outbox — Change-Feed Endpoint; Change-Feed Environment Configuration
**WU**: WU-2, commit 2
**Depends on**: T-11

- `apps/api/src/platform-data/platform-data.controller.ts` — `@Controller('internal/platform') @UseGuards(PlatformControlGuard)`:
  - `@Get('changes') getChanges(@Query('since') since: string)` — parses `since` as `Number` (default 0); queries `prisma.platformOutboxEvent.findMany({ where: { seqNo: { gt: cursor } }, orderBy: { seqNo: 'asc' }, take: batchSize })`; returns `ChangeFeedResponse`; `nextCursor = events.length ? max(events.map(e => e.seqNo)) : cursor`
  - Endpoint is READ-ONLY — no mutation
- `apps/api/src/platform-data/platform-outbox.repository.ts` — `PrismaOutboxRepository` injectable with `findSince(cursor: number, limit: number): Promise<PlatformOutboxEvent[]>`
- `apps/api/src/platform-data/platform-data.module.ts` — imports `PlatformControlModule` (to reuse guard by import; D2), provides repository + controller
- Add `PLATFORM_DATA_BATCH_LIMIT` (optional `IsInt`, default 100) to `apps/api/src/config/env.schema.ts`
- Wire `PlatformDataModule` into `apps/api/src/app.module.ts`
- Confirm T-11 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-11 GREEN; all prior tests GREEN.
**Commit**: `feat(api): PlatformDataModule — change-feed endpoint GET /internal/platform/changes (D1, D2)`

---

### [ ] T-13 — RED: cursor/pagination edge-case + trust-isolation tests
**Type**: test (RED)
**Spec**: platform-data-lane-outbox — Invariants: read-only endpoint; secret not logged; token confusion threat
**WU**: WU-2, commit 3
**Depends on**: T-12

- `apps/api/src/platform-data/__tests__/feed-isolation.spec.ts` (supertest + test DB)
  - **User JWT sent to `/internal/platform/changes` → 401** (token confusion; threat-matrix)
  - **Service token sent to an `/admin` route → 401** (reverse confusion; threat-matrix)
  - **`PLATFORM_CONTROL_SECRET` must not appear in any response body** (scan response JSON; invariant)
  - **GET /internal/platform/changes with valid token does NOT mutate any outbox row** (count before = count after)

All RED.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — change-feed trust-isolation + read-only + secret-not-logged invariants`

---

### [ ] T-14 — GREEN: confirm edge-case + trust-isolation tests pass
**Type**: impl
**Spec**: platform-data-lane-outbox — Invariants
**WU**: WU-2, commit 4
**Depends on**: T-13

- No code changes expected (structural isolation); if any wiring gap found, fix it
- `pnpm --filter @viewpro/api test` — T-13 GREEN; full suite GREEN

**Exit**: T-13 GREEN; full api suite GREEN.
**Commit**: `test(api): GREEN — change-feed trust-isolation + read-only confirmed`

---

## WU-3 — viewpro-api mirror + cursor + poll ingest + metrics endpoint

### [ ] T-15 — RED: unit tests for `ChangeFeedClient` (viewpro-api)
**Type**: test (RED)
**Spec**: platform-data-lane-ingest-metrics — Interval Poll Job (env config + overlap guard scenarios); poller uses persisted cursor
**WU**: WU-3, commit 1
**Depends on**: T-14

- `apps/viewpro-api/src/platform-data/__tests__/change-feed.client.spec.ts` (vitest)
  - `fetchChanges(since)` calls `GET INMOVIEW_API_INTERNAL_URL/internal/platform/changes?since=<cursor>` with valid service token `Authorization: Bearer <HS256 jwt>`
  - Token decodes with `PLATFORM_CONTROL_SECRET`; contains `iss=viewpro-api`, `aud=inmoview-control`; verifies fails with wrong secret
  - Missing `PLATFORM_CONTROL_SECRET` env var → startup validation error

All RED until client exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — ChangeFeedClient (token mint + INMOVIEW_API_INTERNAL_URL + env validation)`

---

### [ ] T-16 — GREEN: implement `ChangeFeedClient`
**Type**: impl
**Spec**: platform-data-lane-ingest-metrics — Data-Lane Environment Configuration; Interval Poll Job
**WU**: WU-3, commit 2
**Depends on**: T-15

- Add `PLATFORM_POLL_INTERVAL_MS` (optional `IsInt`, default 5000) and `PLATFORM_DATA_BATCH_LIMIT` (optional `IsInt`, default 100) to `apps/viewpro-api/src/config/env.schema.ts`; confirm `INMOVIEW_API_INTERNAL_URL` and `PLATFORM_CONTROL_SECRET` already required (Phase 5); if not, add them
- Update `apps/viewpro-api/src/config/app.config.ts` to expose new poll vars
- `apps/viewpro-api/src/platform-data/change-feed.client.ts` — `@Injectable() class ChangeFeedClient { fetchChanges(since: number): Promise<ChangeFeedResponse> }` — mints HS256 JWT (`iss=viewpro-api`, `aud=inmoview-control`, `exp=now+120s`, signed with `PLATFORM_CONTROL_SECRET`); calls `GET .../internal/platform/changes?since=<since>` with `Authorization: Bearer`; never logs token
- Confirm T-15 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-15 GREEN; env validation test GREEN.
**Commit**: `feat(platform-api): ChangeFeedClient — mint service token + poll change-feed endpoint`

---

### [ ] T-17 — R2 + R3 migrations — `viewpro_platform` mirror table + cursor (low risk, own DB)
**Type**: impl
**Spec**: platform-data-lane-ingest-metrics — Idempotent Mirror Ingest; Durable Cursor Advance
**WU**: WU-3, commit 3
**Depends on**: T-16

- In `apps/viewpro-api/prisma/schema.prisma`, add:
  ```
  model PlatformMirrorEvent {
    id             String   @id @default(uuid())
    sourceEventId  String   @unique
    eventType      String
    tenantId       String
    newStatus      String
    occurredAt     DateTime
    seqNo          Int
    ingestedAt     DateTime @default(now())
    payload        Json
    @@index([tenantId, seqNo])
    @@map("platform_mirror_events")
  }

  model PlatformIngestCursor {
    id    Int  @id @default(1)
    seqNo Int  @default(0)
    @@map("platform_ingest_cursor")
  }
  ```
- Run `pnpm --filter @viewpro/platform-api exec prisma migrate dev --name add_platform_mirror_and_cursor` against viewpro test DB
- Seed migration inserts one `platform_ingest_cursor` row with `seqNo = 0` (D7 bootstrap)
- Commit generated migration SQL
- Run `pnpm --filter @viewpro/platform-api exec prisma generate`

**Exit**: `pnpm --filter @viewpro/platform-api exec prisma validate` passes; migrate status up-to-date; `UNIQUE(sourceEventId)` confirmed in SQL.
**Commit**: `feat(platform-api): R2+R3 viewpro_platform mirror + cursor migrations (seqNo=0 seed)`

---

### [ ] T-18 — RED: unit tests for mirror ingest + cursor persistence
**Type**: test (RED)
**Spec**: platform-data-lane-ingest-metrics — Idempotent Mirror Ingest (both scenarios); Durable Cursor Advance (all 3 scenarios)
**WU**: WU-3, commit 4
**Depends on**: T-17

- `apps/viewpro-api/src/platform-data/__tests__/ingest.service.spec.ts` (vitest + test DB)
  - **First ingest of `evt-abc` → exactly one mirror row** (spec scenario 1)
  - **Re-delivered `evt-abc` → still one row, no error** (spec scenario 2; D8 ON CONFLICT DO NOTHING)
  - **Cursor advances from 5 to 7 after ingesting seqNo 6 and 7** (spec cursor scenario 1)
  - **Cursor does NOT advance if ingest write fails** — mock mirror write to throw; assert cursor remains 5 (spec cursor scenario 2)
  - **Restart resumes from persisted cursor** — read cursor row after restart simulation; assert it equals last written value (spec cursor scenario 3)

All RED until `IngestService` + repos exist.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — IngestService idempotent mirror + cursor advance (all scenarios)`

---

### [ ] T-19 — GREEN: implement `IngestService` + `MirrorRepository` + `CursorRepository`
**Type**: impl
**Spec**: platform-data-lane-ingest-metrics — Idempotent Mirror Ingest; Durable Cursor Advance
**WU**: WU-3, commit 5
**Depends on**: T-18

- `apps/viewpro-api/src/platform-data/mirror.repository.ts` — `upsertEvent(event: PlatformOutboxEvent): Promise<void>` — `prisma.platformMirrorEvent.upsert({ where: { sourceEventId: event.id }, update: {}, create: { ... } })` (D8 ON CONFLICT DO NOTHING semantic via Prisma upsert)
- `apps/viewpro-api/src/platform-data/cursor.repository.ts` — `getCursor(): Promise<number>` (reads single row id=1); `advanceCursor(seqNo: number): Promise<void>` (updates row id=1 seqNo; only called after mirror upserts commit; D7)
- `apps/viewpro-api/src/platform-data/ingest.service.ts` — `ingestBatch(events: PlatformOutboxEvent[]): Promise<void>` — for each event calls `mirrorRepo.upsertEvent(event)`; on full success calls `cursorRepo.advanceCursor(maxSeqNo)`; on any mirror error: logs + skips batch (D7 advance-after-commit)
- Confirm T-18 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-18 GREEN.
**Commit**: `feat(platform-api): IngestService + MirrorRepository + CursorRepository (D7, D8)`

---

### [ ] T-20 — RED: poll-job lifecycle tests (OnModuleInit + overlap guard + OnModuleDestroy)
**Type**: test (RED)
**Spec**: platform-data-lane-ingest-metrics — Interval Poll Job (all 3 scenarios: cursor used per tick, overlap skipped, interval configurable)
**WU**: WU-3, commit 6
**Depends on**: T-19

- `apps/viewpro-api/src/platform-data/__tests__/platform-data-poll-job.spec.ts` (vitest, mocked ChangeFeedClient + IngestService)
  - **Poller reads cursor and calls `fetchChanges(cursor)` on each tick** (spec: poller uses persisted cursor)
  - **In-flight poll blocks next tick** — mock `fetchChanges` to hang; fire two ticks; assert `fetchChanges` called exactly once (spec: overlapping poll skipped; D9)
  - **Destroy stops interval** — `OnModuleDestroy` called; no further `fetchChanges` calls after that
  - **Feed error (fetchChanges throws) is logged and does NOT advance cursor** (log-and-skip decision)
  - **Interval defaults to 5000 ms when env var absent; respects `PLATFORM_POLL_INTERVAL_MS`** (spec: poll interval configurable)

All RED until `PlatformDataPollJob` exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — PlatformDataPollJob lifecycle (cursor, overlap-guard, destroy, error, interval)`

---

### [ ] T-21 — GREEN: implement `PlatformDataPollJob`
**Type**: impl
**Spec**: platform-data-lane-ingest-metrics — Interval Poll Job; D9
**WU**: WU-3, commit 7
**Depends on**: T-20

- `apps/viewpro-api/src/platform-data/platform-data-poll-job.ts` — `@Injectable() class PlatformDataPollJob implements OnModuleInit, OnModuleDestroy`:
  - `private isPolling = false; private intervalHandle: NodeJS.Timeout | null = null`
  - `onModuleInit()` — `setInterval(this.tick.bind(this), PLATFORM_POLL_INTERVAL_MS)`
  - `private async tick()` — if `this.isPolling` return; `this.isPolling = true; try { cursor = await cursorRepo.getCursor(); response = await feedClient.fetchChanges(cursor); await ingestService.ingestBatch(response.events) } catch (e) { logger.error('poll error', e) } finally { this.isPolling = false }`
  - `onModuleDestroy()` — `clearInterval(this.intervalHandle)`
- Confirm T-20 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-20 GREEN; all prior tests GREEN.
**Commit**: `feat(platform-api): PlatformDataPollJob — OnModuleInit setInterval + overlap guard + destroy (D9)`

---

### [ ] T-22 — RED: operator metrics endpoint tests
**Type**: test (RED)
**Spec**: platform-data-lane-ingest-metrics — Metrics Endpoint — Operator-Only Access (all 4 scenarios); Empty-State Metrics
**WU**: WU-3, commit 8
**Depends on**: T-21

- `apps/viewpro-api/src/platform-data/__tests__/metrics.controller.spec.ts` (supertest + test DB)
  - **Authenticated operator → 200 + well-formed `{ tenants, byStatus, generatedAt }` body** (spec scenario 1)
  - **No token → 401** (spec scenario 2)
  - **Empty mirror table → 200 with zeroed counts** (spec: empty-state scenario)
  - **After ingesting `TENANT_STATUS_CHANGED newStatus=SUSPENDED` for `t-1` → `byStatus.SUSPENDED >= 1`** (spec scenario 3)
  - **InmoView DB unreachable — metrics still 200 from viewpro_platform only** (spec scenario 4; D6 mirror-only query — just assert no cross-DB query in service code via mock check)

All RED until metrics controller + service exist.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — MetricsController (operator-only auth, empty-state, DISTINCT ON, isolation)`

---

### [ ] T-23 — GREEN: implement `MetricsService` + `MetricsController` + `PlatformDataModule` (viewpro-api)
**Type**: impl
**Spec**: platform-data-lane-ingest-metrics — Metrics Endpoint; D5; D6
**WU**: WU-3, commit 9
**Depends on**: T-22

- `apps/viewpro-api/src/platform-data/metrics.service.ts` — `getSummary()` — queries `viewpro_platform` mirror using `DISTINCT ON (tenantId) ORDER BY seqNo DESC` (D6) to get latest status per tenant; groups and counts by status; returns `{ tenants: number; byStatus: Record<string, number>; generatedAt: string }`; NEVER queries InmoView DB
- `apps/viewpro-api/src/platform-data/metrics.controller.ts` — `@Controller('operators/metrics') @UseGuards(AuthGuard)`:
  - `@Get('summary') getSummary()` → calls `MetricsService.getSummary()`
- `apps/viewpro-api/src/platform-data/platform-data.module.ts` — provides `ChangeFeedClient`, `IngestService`, `MirrorRepository`, `CursorRepository`, `PlatformDataPollJob`, `MetricsService`, `MetricsController`; imports `AuthModule`, `PrismaModule`, `ConfigModule`
- Wire `PlatformDataModule` into `apps/viewpro-api/src/app.module.ts`
- Confirm T-22 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-22 GREEN; all tests GREEN.
**Commit**: `feat(platform-api): MetricsService + MetricsController + PlatformDataModule (D5, D6, mirror-only)`

---

### [ ] T-24 — Final verification + invariant check
**Type**: verify
**Spec**: All invariants; proposal acceptance criteria (items 1–7)
**WU**: WU-3, commit 10
**Depends on**: T-23

1. `pnpm --filter @viewpro/api test` — all GREEN (admin suite unchanged; outbox + platform-data GREEN)
2. `pnpm --filter @viewpro/platform-api test` — all GREEN
3. `pnpm --filter @viewpro/api typecheck` — passes (including type-equality assertion)
4. `pnpm --filter @viewpro/platform-api typecheck` — passes
5. `rg 'PLATFORM_CONTROL_SECRET' apps/api/src/platform-data/` — zero hits in response paths
6. `rg 'prisma' apps/viewpro-api/src/platform-data/metrics.service.ts` — only references `viewpro_platform` tables (no InmoView Prisma client)
7. `git diff HEAD -- apps/api/test/admin.e2e-spec.ts` — no regressions
8. Confirm `platform_outbox_events` table and `UNIQUE(sourceEventId)` on `platform_mirror_events` exist in test DB schemas
9. Confirm cursor row `seqNo=0` exists in `platform_ingest_cursor` after migration
10. Leave a deploy-sequencing comment in `apps/api/prisma/migrations/*/migration.sql`: `-- R1: deploy this migration BEFORE updating app code to write/read platform_outbox_events`
11. Leave a TODO comment in `ChangeFeedCursor` type: `// TODO: migrate to BigInt/string when seqNo > 2^53 events accumulate`

**Exit**: all 11 checks pass; no regressions; InmoView DB isolation confirmed; empty-state metrics confirmed.
**Commit**: `chore(platform-phase6): final verification — data lane, isolation, invariants, migration sequencing`

---

## Summary Table

| Task | Type | WU | Parallel group | Spec requirement | Depends on |
|------|------|-----|---------------|-----------------|------------|
| T-01 platform-contract data/ namespace | impl | WU-1 | — | Proposal §7; ChangeFeedResponse | — |
| T-02 RED: type-equality assertion | test | WU-1 | — | Proposal R7 | T-01 |
| T-03 GREEN: type assertion wired | impl | WU-1 | — | Proposal R7 | T-02 |
| T-04 R1 live-DB migration platform_outbox_events | impl | WU-1 | — | Outbox Schema; HIGHEST RISK | T-03 |
| T-05 RED: migration additive invariant | test | WU-1 | — | Outbox Schema scenarios | T-04 |
| T-06 GREEN: migration invariant confirmed | impl | WU-1 | — | Outbox Schema | T-05 |
| T-07 RED: PlatformOutboxWriter unit tests | test | WU-1 | — | Transactional Outbox Write | T-06 |
| T-08 GREEN: PlatformOutboxWriter impl | impl | WU-1 | — | Transactional Outbox Write | T-07 |
| T-09 RED: outbox-write integration test | test | WU-1 | — | Outbox Write + D3/D4 | T-08 |
| T-10 GREEN: wire writer into repo $transaction | impl | WU-1 | — | Transactional Outbox Write; D3; D4 | T-09 |
| T-11 RED: change-feed controller tests | test | WU-2 | — | Change-Feed Endpoint (6 scenarios) | T-10 |
| T-12 GREEN: PlatformDataController + module | impl | WU-2 | — | Change-Feed Endpoint; D1; D2 | T-11 |
| T-13 RED: trust-isolation + read-only tests | test | WU-2 | — | Invariants; threat-matrix | T-12 |
| T-14 GREEN: isolation confirmed | impl | WU-2 | — | Invariants | T-13 |
| T-15 RED: ChangeFeedClient tests | test | WU-3 | — | Poll Job + env config | T-14 |
| T-16 GREEN: ChangeFeedClient impl | impl | WU-3 | — | Poll Job; Data-Lane Env Config | T-15 |
| T-17 R2+R3 migrations mirror + cursor | impl | WU-3 | — | Idempotent Ingest; Durable Cursor; D5; D7 | T-16 |
| T-18 RED: IngestService + cursor unit tests | test | WU-3 | — | Idempotent Mirror Ingest; Durable Cursor (all scenarios) | T-17 |
| T-19 GREEN: IngestService + repos | impl | WU-3 | — | Idempotent Ingest; Durable Cursor; D7; D8 | T-18 |
| T-20 RED: poll-job lifecycle tests | test | WU-3 | — | Interval Poll Job (all scenarios); D9 | T-19 |
| T-21 GREEN: PlatformDataPollJob | impl | WU-3 | — | Interval Poll Job; D9 | T-20 |
| T-22 RED: metrics endpoint tests | test | WU-3 | — | Metrics Endpoint (4 scenarios + empty-state) | T-21 |
| T-23 GREEN: MetricsService + controller + module | impl | WU-3 | — | Metrics Endpoint; D5; D6 | T-22 |
| T-24 Final verification | verify | WU-3 | — | All invariants + acceptance criteria | T-23 |

---

## Success Checklist (maps to spec acceptance)

- [x] Status change commits exactly one `platform_outbox_events` row in same `$transaction` (T-09, T-10)
- [x] Rolled-back transaction leaves zero outbox rows (T-09)
- [x] No-op/unchanged transition emits NO outbox row (D4; T-09)
- [ ] `GET /internal/platform/changes?since=N` returns events seqNo > N, ordered ASC, nextCursor = max seqNo (T-11, T-12)
- [ ] Empty batch returns nextCursor = supplied cursor (T-11, T-12)
- [ ] Batch bounded by `PLATFORM_DATA_BATCH_LIMIT`; ms-collision events both delivered (T-11, T-12)
- [ ] Invalid/missing service token → 401; read-only — no outbox mutation (T-11, T-13)
- [ ] User JWT rejected by change-feed endpoint; service token rejected by AuthGuard (T-13)
- [ ] `evt-abc` re-delivered → still one mirror row, no error (D8; T-18, T-19)
- [ ] Cursor advances to max seqNo after successful ingest; does NOT advance on ingest failure (D7; T-18, T-19)
- [ ] Restart resumes from persisted cursor (T-18, T-19)
- [ ] Overlap guard prevents concurrent polls (D9; T-20, T-21)
- [ ] `GET /operators/metrics/summary` returns 200 + correct counts for authenticated operator (T-22, T-23)
- [ ] Unauthenticated metrics request → 401 (T-22)
- [ ] Empty mirror → 200 with zeroed counts (T-22)
- [ ] Metrics served from `viewpro_platform` ONLY — no InmoView DB reads (D6; T-22, T-23)
- [x] Type-equality assertion `PlatformTenantStatus ↔ TenantStatus` compile-time enforced (T-02, T-03)
- [x] R1 migration deployed BEFORE app code writing outbox rows (operational sequencing; T-04 note)
- [ ] `PLATFORM_CONTROL_SECRET` never in response body or logs (T-13, invariant check)
