# Design: Platform Phase 6 — DATA LANE (transactional outbox + poll ingest + operator metrics)

Stand up the reverse (read) lane: InmoView (`apps/api`) writes a `platform_outbox_events` row inside the EXISTING `PrismaAdminTenantStatusRepository.updateTenantStatus` `$transaction`; ViewPro (`apps/viewpro-api`) POLLS `GET /internal/platform/changes?since=<seqNo>` (reusing Phase 5 `PlatformControlGuard`), ingests idempotently into its own `viewpro_platform` mirror, and serves `GET /operators/metrics/summary` from the mirror ONLY. Isolation is structural: viewpro-api never imports InmoView's Prisma client and talks to InmoView solely over the HTTP change-feed. Paths below are under `viewpro-app/`.

## Technical Approach

Transactional-outbox + cursor-pull (proposal §3). One event type: `TENANT_STATUS_CHANGED`. A tiny `PlatformOutboxWriter.emit(tx, event)` helper is called from inside the repo's existing `run(client)` closure, so the outbox row commits iff the tenant/analytics writes commit. InmoView exposes a read-only feed route; viewpro-api adds a distinct poll/change-feed client (the P5 client is POST-only) plus a `setInterval` ingest loop. Contract gains a `data/` namespace mirroring `control/`.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Cursor encoding | Raw `seqNo` BIGSERIAL int in `?since=`; `nextCursor` = max seqNo in batch | opaque base64 `occurredAt:seqNo`; `occurredAt`+`id` tiebreak | BIGSERIAL is a single monotonic total order — no ms-collision skip, no tuple compare. `occurredAt` kept as data, NOT the cursor key |
| D2 | Feed module placement | Sibling `PlatformDataModule` in `apps/api`, reuses `PlatformControlGuard` | extend `PlatformControlModule` | Control (write/command) vs data (read/feed) are separate concerns; guard is shared by import, not module merge |
| D3 | Outbox producer seam | `PlatformOutboxWriter.emit(tx, {...})` called in the SAME `run(client)` closure, only on the `updated` branch | fire-and-forget after tx; reuse AnalyticsEvent | Delivery ⇔ commit; dedicated table generalizes to future events and owns the `seqNo` cursor field |
| D4 | No-op transition | `unchanged` branch emits NO outbox event; only real `updated` transitions emit | emit always | Consistent with repo's `updated`/`unchanged` result split (repo:36-44); a no-op is not a state change — nothing for metrics to reflect |
| D5 | Mirror shape | Normalized columns: `sourceEventId @unique`, `eventType`, `tenantId`, `newStatus`, `occurredAt`, `seqNo`, `ingestedAt` + raw `payload` JSONB | pure raw JSONB | Normalized `tenantId`+`newStatus` makes the summary query index-friendly now; `payload` kept for forward-compat/future events |
| D6 | Current-status derivation | Latest-event-wins: per `tenantId`, the row with MAX `seqNo`; group-by `newStatus` for the breakdown | maintained tenant-status projection table | Slice-1 volume is tiny; a `DISTINCT ON (tenantId) ... ORDER BY seqNo DESC` (or window) is exact and needs no second write path. Projection is a documented LATER optimization |
| D7 | Cursor persistence + advance | Single-row `platform_ingest_cursor` table; advance cursor ONLY after the mirror upserts commit | column on a config row; advance-then-write | Advance-after-durable-ingest = crash-safe at-least-once; a crash before advance re-polls the same batch, dedup absorbs it (no skips, no dups) |
| D8 | Ingest idempotency | `upsert`/`ON CONFLICT DO NOTHING` keyed on `sourceEventId @unique` | check-then-insert | Redelivery after crash is expected; UNIQUE dedup makes replay a no-op → effectively-once in the mirror |
| D9 | Poll lifecycle | `OnModuleInit` starts `setInterval`; boolean overlap guard (skip tick if a poll is in flight); `OnModuleDestroy` clears timer + awaits in-flight | `@nestjs/schedule`/BullMQ/cron | Proposal locks "no scheduler infra". Overlap guard prevents pile-up; graceful shutdown avoids torn batches |

## Data Flow

    InmoView status change (same $transaction)
      PrismaAdminTenantStatusRepository.updateTenantStatus.run(client)
        tenant.update → analyticsEvent.create → PlatformOutboxWriter.emit(client,{TENANT_STATUS_CHANGED, seqNo auto})
      ⇒ commit together   (rollback ⇒ no outbox row)

    ViewPro poll (setInterval, overlap-guarded)
      cursor = platform_ingest_cursor.seqNo
      GET /api/internal/platform/changes?since=<seqNo>   (PlatformControlGuard, minted service token)
        ⇒ { events:[...], nextCursor }   (seqNo>since, ORDER BY seqNo, LIMIT batchSize)
      upsert events into mirror  (ON CONFLICT(sourceEventId) DO NOTHING)   ← commits FIRST
      platform_ingest_cursor.seqNo = nextCursor                            ← advances AFTER

    Operator → GET /operators/metrics/summary  (Phase 4 AuthGuard)
      DISTINCT ON (tenantId) newStatus ORDER BY seqNo DESC → group/count
      ⇒ { tenants, byStatus:{TRIAL,ACTIVE,SUSPENDED,CANCELLED}, generatedAt }   [mirror ONLY]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | `platform_outbox_events` model (uuid id, `seqNo BigInt @default(autoincrement()) @unique`, eventType, tenantId, payload Json, occurredAt) + `@@index([seqNo])` |
| `apps/api/prisma/migrations/*` | Create | Additive `CREATE TABLE` only (R1) |
| `apps/api/src/platform-data/platform-outbox.writer.ts` | Create | `emit(tx, event)` — one `platformOutboxEvent.create` on the tx client |
| `apps/api/src/admin/prisma-admin-tenant-status.repository.ts` | Modify | Call `PlatformOutboxWriter.emit(client, …)` in `run()`, `updated` branch only |
| `apps/api/src/platform-data/platform-data.controller.ts` | Create | `GET /internal/platform/changes` behind `PlatformControlGuard`; range scan + nextCursor |
| `apps/api/src/platform-data/platform-data.{module,repository}.ts` | Create | Wire controller + reader; import guard |
| `apps/api/src/platform-data/type-assertions.ts` | Create | Compile-time equality `PlatformTenantStatus` ↔ Prisma `TenantStatus` (R7) |
| `apps/api/src/app.module.ts` | Modify | Register `PlatformDataModule` |
| `apps/viewpro-api/prisma/schema.prisma` | Modify | `PlatformEventMirror` (+ `sourceEventId @unique`) + `PlatformIngestCursor` (single row) |
| `apps/viewpro-api/prisma/migrations/*` | Create | Mirror + cursor tables (own DB, low risk) |
| `apps/viewpro-api/src/platform-data/change-feed.client.ts` | Create | Mints service token (reuse P5 claims), `GET …/changes?since=` |
| `apps/viewpro-api/src/platform-data/ingest.job.ts` | Create | `OnModuleInit` setInterval + overlap guard + `OnModuleDestroy` |
| `apps/viewpro-api/src/platform-data/ingest.service.ts` + mirror/cursor repos | Create | Upsert batch (dedup), advance cursor after commit |
| `apps/viewpro-api/src/platform-data/metrics.controller.ts` | Create | `GET /operators/metrics/summary` behind `AuthGuard` |
| `apps/viewpro-api/src/platform-data/metrics.service.ts` | Create | Latest-event-wins aggregate from mirror |
| `apps/viewpro-api/src/platform-data/platform-data.module.ts` | Create | Wire client, job, ingest, metrics; import `AuthModule` |
| `apps/viewpro-api/src/app.module.ts` | Modify | Register `PlatformDataModule` |
| `apps/viewpro-api/src/config/{env.schema,app.config}.ts` | Modify | Add `PLATFORM_POLL_INTERVAL_MS`, `PLATFORM_POLL_BATCH_SIZE`; reuse `INMOVIEW_API_INTERNAL_URL` + `PLATFORM_CONTROL_SECRET` |
| `apps/viewpro-api/src/database/test-database-url.guard.ts` | Verify | `viewpro_platform` already guarded |
| `packages/platform-contract/src/data/{index,change-feed,tenant-event}.ts` + `src/index.ts` | Create/Modify | `PlatformOutboxEvent`, `ChangeFeedResponse`, `ChangeFeedCursor`, `TenantStatusChangedPayload`; export `./data/index.js` |

## Interfaces / Contracts

    // packages/platform-contract data/ (own unions, never import @prisma/client)
    type ChangeFeedCursor = number            // seqNo; 0 = start
    type PlatformOutboxEvent = { id:string; seqNo:number; eventType:'TENANT_STATUS_CHANGED';
      tenantId:string; payload:TenantStatusChangedPayload; occurredAt:string }
    type TenantStatusChangedPayload = { previousStatus:PlatformTenantStatus; newStatus:PlatformTenantStatus }
    type ChangeFeedResponse = { events: PlatformOutboxEvent[]; nextCursor: ChangeFeedCursor }

    // InmoView feed (read-only, PlatformControlGuard)
    GET /internal/platform/changes?since=<seqNo>  → ChangeFeedResponse   (seqNo>since, ORDER BY seqNo ASC, LIMIT batchSize)

    // ViewPro operator metrics (AuthGuard)
    GET /operators/metrics/summary → { tenants:number; byStatus:Record<PlatformTenantStatus,number>; generatedAt:string }

## Isolation Proof

1. viewpro-api's `platform-data/` imports NOTHING from `@prisma/client` (that alias is InmoView's client); it uses its own generated client at `src/generated/prisma` for mirror/cursor only.
2. The ONLY InmoView touchpoint is `change-feed.client.ts` HTTP `fetch` to `INMOVIEW_API_INTERNAL_URL`. No `DATABASE_URL` of InmoView is loaded in this process.
3. `metrics.service` queries the mirror exclusively — a regression test asserts zero outbound HTTP and no InmoView-client import in the metrics request path.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `emit` only on `updated` branch; `unchanged`/`notFound` emit nothing (D4) | vitest, mocked tx client |
| Unit | change-feed reader: `seqNo>since`, ordered, `LIMIT batchSize`, `nextCursor`=max | vitest |
| Unit | ingest dedup: replay same batch → no dup rows; cursor advances only post-commit (D7/D8) | vitest, mocked repos |
| Unit | overlap guard skips a tick while a poll is in flight; shutdown clears timer (D9) | vitest fake timers |
| Unit | metrics latest-event-wins per tenant by seqNo (D6); empty mirror → zeros (accept #7) | vitest |
| Integration | status change writes outbox row in same tx; rollback ⇒ no row (accept #1) | supertest + test DB |
| Integration | feed 401 on missing/invalid token; nextCursor does not re-return (accept #2) | supertest, forged tokens |
| Integration | poll ingests once, metrics reflect it from mirror, ZERO InmoView reads (accept #3/#4) | supertest, both test DBs |
| Isolation | metrics/ingest never import InmoView Prisma client; user cookie rejected by feed guard | static + supertest |

## Threat Matrix

Process-integration boundary (server-to-server HTTP + reused service-token trust), read direction:

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Cross-service token forgery | Applicable | Wrong secret/iss/aud/expired → 401; guard never sets `request.user` |
| Token confusion (user↔service) | Applicable | Operator cookie/user JWT lacks `aud=inmoview-control` → feed 401; service token has no cookie → operator `AuthGuard` 401 |
| Replay / duplicate delivery | Applicable | At-least-once redelivery → UNIQUE `sourceEventId` dedup → single mirror row (accept #3) |
| Internal endpoint exposure | Applicable | `/internal/platform/changes` not publicly routable (infra); guard is defense-in-depth; feed is read-only |
| SSRF via `INMOVIEW_API_INTERNAL_URL` | N/A | Fixed env-configured base URL, not user-supplied |
| Cross-tenant data exposure (R4) | Applicable | Mirror is operator-only (`AuthGuard`); no tenant-scoped route reads it; payload minimal (tenantId+status) |
| Shell/subprocess/VCS automation | N/A | None in this change |

## Migration / Rollout

R1 HIGH — live InmoView DB. **Order**: (1) deploy additive `CREATE TABLE platform_outbox_events` FIRST (table must exist before the producer writes and before the feed reads); (2) deploy producer + feed code. **Rollback**: `DROP TABLE platform_outbox_events`; append-only + isolated, zero existing-row impact; reverting producer code stops emission. ViewPro mirror/cursor migration is on `viewpro_platform` (own DB, low risk; rollback = drop). No backfill — metrics start empty (accept #7).

## Open Questions (for tasks phase)

- [ ] Poll defaults: `PLATFORM_POLL_INTERVAL_MS` (propose 5000) and `PLATFORM_POLL_BATCH_SIZE` (propose 100) — confirm conservative values with infra (R3).
- [ ] `seqNo` crosses the JS-safe-int boundary only past 2^53; slice-1 volume is negligible — confirm `number` in the contract is acceptable vs `string` for BigInt (recommend `number` now, revisit if volume grows).
- [ ] Repeated feed-error behavior: simple skip-until-next-tick vs exponential backoff — recommend log-and-skip for slice 1 (interval already bounds retry rate).
- [ ] Single-row cursor table bootstrap: seed `seqNo=0` via migration vs upsert-on-first-poll (recommend migration seed for a deterministic start).
- [ ] `PlatformIngestCursor` concurrency: single poller (overlap-guarded) means no lock needed now; note a `FOR UPDATE` guard if a second poller is ever added.
