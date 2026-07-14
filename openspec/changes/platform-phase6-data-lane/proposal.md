# Proposal: Platform Phase 6 — DATA LANE + cross-tenant metrics (first slice, backend-only)

**Change id**: `platform-phase6-data-lane`
**Store**: `openspec/changes/platform-phase6-data-lane/proposal.md` (+ Engram `sdd/platform-phase6-data-lane/proposal`)
**Phase**: 6 of the platform-split (the LAST phase). Follows Phase 5 (control lane, shipped).
**Grounded in**: explore #5787, decisions #5788, Phase 5 proposal #5756; blueprint §2.2 (data lane).

---

## 1. Intent

### Problem / why now
ViewPro (the platform control plane) needs **cross-tenant operational metrics** (e.g. how many
tenants exist and their status breakdown) to run the business. Today the only way to get those
numbers is the three deferred `/admin` READ endpoints in `apps/api` (InmoView), which query
InmoView's operational DB directly through `GlobalAdminGuard`. That violates the **Design B golden
rule**: ViewPro must NEVER read InmoView's operational DB directly. Phase 5 migrated the WRITE
commands over the control lane but explicitly left the READs on InmoView. Phase 6 closes that gap by
standing up the **data lane**: InmoView publishes domain events, ViewPro ingests them into its own
read store, and metrics are served entirely from `viewpro_platform`.

### What success looks like
A tenant status change in InmoView flows — **transactionally, at-least-once, and exactly-once on
ingest** — into ViewPro's own DB, and an operator-only metrics endpoint returns tenant count + status
breakdown computed **with zero reads of InmoView's DB**. This proves the full pipe end-to-end for one
event type; later phases extend it to more events and pre-aggregated projections.

### First slice = ONE event end-to-end
`TENANT_STATUS_CHANGED` only. It is already written transactionally in
`PrismaAdminTenantStatusRepository.updateTenantStatus` (the `analyticsEvent.create` inside the same
`$transaction` as the `tenant.update` — schema/code confirmed). The outbox write for this slice lands
in that exact transaction.

---

## 2. Scope

### In scope
1. **InmoView (`apps/api`) — dedicated outbox table.** New `platform_outbox_events` model +
   **additive** migration on the LIVE InmoView DB. Append-only. Composite-cursor-friendly
   (`occurredAt` + monotonic `seqNo`/`id`). See §5 for the migration approach and §6 R1.
2. **InmoView — transactional outbox write.** Inside the EXISTING `$transaction` in
   `PrismaAdminTenantStatusRepository`, write one `platform_outbox_events` row alongside the existing
   `tenant.update` + `analyticsEvent.create`. Guaranteed delivery: if the domain change commits, the
   outbox row commits with it; if it rolls back, no event is emitted.
3. **InmoView — internal change-feed endpoint.** `GET /internal/platform/changes?since=<cursor>`
   behind the EXISTING `PlatformControlGuard` (Phase 5 service-token trust — reused, not reinvented).
   Returns a **batch** of events after the cursor + the **next cursor**, with a server-enforced batch
   limit. Lives in the existing `PlatformControlModule` (or a sibling data module — a design detail).
4. **ViewPro (`apps/viewpro-api`) — mirror read store.** New raw append-only event mirror table in
   `viewpro_platform` + migration. **Idempotent ingest** via a UNIQUE constraint on the source event
   id (dedup). A persisted ingest cursor (last consumed `occurredAt`+`seqNo`). Pre-aggregated
   projections are DEFERRED.
5. **ViewPro — polling ingest job.** A lightweight interval-driven poller that mints a control-lane
   service token, calls the change-feed, upserts events into the mirror (dedup on source id), and
   advances the persisted cursor. Basic `setInterval`-style loop is fine for slice 1 — **no
   `@nestjs/schedule`, no BullMQ, no cron infra.**
6. **ViewPro — metrics endpoint.** `GET /operators/metrics/summary` behind the operator `AuthGuard`
   (Phase 4). Returns tenant count + status breakdown, computed **entirely from `viewpro_platform`**
   (the mirror), never touching InmoView.
7. **platform-contract — new `data/` lane namespace.** Currently only `control/` exists. Add
   `data/` with the event + change-feed types (e.g. `PlatformOutboxEvent`, `ChangeFeedResponse`,
   `ChangeFeedCursor`, the `TENANT_STATUS_CHANGED` payload shape). Wire it as a consumer in both apps.
   Follow the existing `control/` layout (own unions, never import `@prisma/client`).
8. **ViewPro config/env.** Reuse `INMOVIEW_API_INTERNAL_URL` + `PLATFORM_CONTROL_SECRET` (already
   present in `env.schema.ts`); add poll-interval + batch-limit knobs.

### Out of scope (explicit non-goals)
- **Frontend (viewpro-web).** No UI in this slice; backend metrics endpoint only.
- **More event types.** Only `TENANT_STATUS_CHANGED`. `MOVEMENT_CREATED`, `PROPERTY_STATUS_CHANGED`,
  `DOCUMENT_*`, etc. are LATER.
- **Historical backfill.** Metrics START FRESH from Phase 6 onward — they reflect events emitted
  after this slice ships. Backfilling past `AnalyticsEvent`/tenant state is a documented LATER
  decision (see §6 risk), NOT in scope. **Consequence: the metrics endpoint returns empty/partial
  numbers until events accumulate — this is expected and must be stated in acceptance.**
- **Pre-aggregated projections / rollups.** Slice 1 serves metrics by querying the raw mirror.
- **Retiring the three `/admin` READ endpoints + `GlobalAdminGuard`.** They keep working against
  InmoView's DB for now; migrating/retiring them is follow-up once the data lane is proven and covers
  enough events.
- **Production scheduler/queue/broker infra.** Deferred; a basic interval poller is the slice-1
  transport.
- **Backpressure/dead-letter/replay tooling** beyond at-least-once + idempotent dedup.

---

## 3. Approach (with rationale)

**Transactional outbox + cursor-pull ingest** (blueprint Option A). Rationale, per locked decisions:

- **Dedicated `platform_outbox_events`, NOT AnalyticsEvent reuse.** Most `AnalyticsEvent` writes are
  fire-and-forget (non-transactional), so reusing it would lose events under failure. A dedicated
  table lets producers write the event in the SAME `$transaction` as the domain change → guaranteed
  delivery, no loss. (For `TENANT_STATUS_CHANGED` the analytics write already IS transactional, but
  the dedicated table generalizes to future events and gives us a clean cursor field.)
- **Poll-over-HTTP behind `PlatformControlGuard`, NOT a broker.** No queue/broker exists in either
  app; introducing one is unjustified for slice 1. Polling reuses the Phase 5 service-token trust
  seam verbatim (same secret/issuer/audience machinery), so no new auth surface.
- **Composite cursor (`occurredAt` + `seqNo`/`id`), NOT `occurredAt` alone.** Millisecond collisions
  on `occurredAt` alone would silently skip events sharing a timestamp. A monotonic `seqNo` (or
  `occurredAt`+`id` tiebreak) gives a total order and a resumable, drift-free cursor.
- **Raw append-only mirror + UNIQUE(source event id), NOT projections yet.** At-least-once delivery
  means the poller can re-deliver a batch after a crash; a UNIQUE constraint on the source event id
  makes ingest idempotent (dedup) so replays are safe. Aggregation is cheap at slice-1 volume and can
  be materialized later without re-modeling ingest.
- **Direction note.** The Phase 5 control lane is ViewPro→InmoView (commands). The data lane is the
  REVERSE read direction: ViewPro POLLS InmoView. The service-token trust is reused, but the
  `PlatformControlClient` is a POST client — slice 1 adds a distinct **poll/change-feed client** on
  the ViewPro side.

### End-to-end flow (slice 1)
```
InmoView tenant status change
  └─ PrismaAdminTenantStatusRepository.updateTenantStatus  [same $transaction]
       ├─ tenant.update(...)
       ├─ analyticsEvent.create(...)              (existing)
       └─ platformOutboxEvent.create(...)         (NEW — TENANT_STATUS_CHANGED)
  ⇒ committed together

ViewPro poll job (interval)
  └─ GET /internal/platform/changes?since=<cursor>   (PlatformControlGuard, service token)
       ⇒ { events: [...], nextCursor }
  └─ upsert into viewpro_platform mirror  (UNIQUE source_event_id ⇒ dedup)
  └─ persist nextCursor

Operator
  └─ GET /operators/metrics/summary   (Phase 4 AuthGuard)
       ⇒ { tenants, byStatus: { TRIAL, ACTIVE, SUSPENDED, CANCELLED } }   [from mirror ONLY]
```

---

## 4. Acceptance criteria

1. A tenant status change writes a `platform_outbox_events` row **in the same `$transaction`** as the
   `tenant.update`. If the transaction rolls back, no outbox row exists (delivery ⇔ commit).
2. `GET /internal/platform/changes?since=<cursor>` behind `PlatformControlGuard` returns that event
   in a batch **after** the given cursor, plus a `nextCursor`; a missing/invalid service token is
   rejected (401). A subsequent call with `nextCursor` does not re-return the same event.
3. The ViewPro poll job ingests the event into the `viewpro_platform` mirror **exactly once**:
   replaying the same batch (at-least-once redelivery) inserts no duplicate rows (UNIQUE source id).
4. `GET /operators/metrics/summary` reflects that event (updated status breakdown) computed
   **entirely from `viewpro_platform`** — with **ZERO reads of InmoView's DB** in the request path.
5. `GET /operators/metrics/summary` requires the operator `AuthGuard`: a request without a valid
   operator session is rejected (401); no tenant/product user can reach it.
6. The batch endpoint enforces a **server-side batch limit** (bounded response size) and the cursor
   is a **composite** (`occurredAt`+`seqNo`/`id`) — two events sharing an `occurredAt` are both
   delivered, none skipped.
7. Before any events accumulate, the metrics endpoint returns a well-formed **empty/zero** result
   (start-fresh, no backfill) rather than erroring.

---

## 5. Live-DB migration approach (InmoView `platform_outbox_events`)

- **Additive-only.** `CREATE TABLE platform_outbox_events` + its indexes. No column drop, no type
  change, no alteration of existing tables. Same low-risk class as Phase 5 R1 (which added a nullable
  column + enum value).
- **Shape (to be finalized in spec/design):** `id` (uuid PK), a **monotonic `seqNo`** (BIGSERIAL /
  `@default(autoincrement())`) for the cursor total-order, `eventType` (String — slice 1 only ever
  `TENANT_STATUS_CHANGED`), `tenantId`, `payload` (JSONB — e.g. `{ previousStatus, newStatus }`),
  `occurredAt` (Timestamp). Index on `(occurredAt, seqNo)` and/or `(seqNo)` to serve
  `?since=<cursor>` range scans efficiently.
- **Deploy ordering:** migration-first (table exists before the producer code writes to it, and
  before the change-feed endpoint reads it).
- **Rollback:** `DROP TABLE platform_outbox_events` — no data loss to existing InmoView data
  (append-only, isolated). The producer write is additive inside the tx; reverting the producer code
  stops emission.
- **ViewPro mirror migration** is on `viewpro_platform` (its own DB, low risk): `CREATE TABLE` for the
  mirror + a small ingest-cursor row/table; UNIQUE on source event id. Rollback = drop.

---

## 6. Risks

- **R1 — Outbox migration on the LIVE InmoView DB (HIGH).** Additive `CREATE TABLE` only; migration
  before code; rollback = drop, no data loss. Same risk class as Phase 5 R1. Mitigation: additive
  migration deployed first, producer write behind the table's existence.
- **R2 — Cursor drift / lost or duplicated events.** `occurredAt`-only cursors skip ms-collision
  events; poller crashes cause at-least-once redelivery. Mitigation: composite/monotonic cursor for
  total order + UNIQUE(source event id) for idempotent dedup on ingest + persist cursor only after a
  batch is durably ingested.
- **R3 — Publisher load (poll interval + batch limit).** Too-frequent polls or unbounded batches
  strain InmoView. Mitigation: configurable poll interval (conservative default) + server-enforced
  batch limit; range-scan-friendly index on the cursor columns.
- **R4 — Cross-tenant data in the aggregate store.** The mirror mixes events from ALL tenants in
  ViewPro's DB by design (that is the point of cross-tenant metrics). Mitigation: operator-only access
  to the store/endpoints (Phase 4 `AuthGuard`), no tenant-scoped exposure, document the data-residency
  implication; no PII beyond tenant id + status in slice 1.
- **R5 — No backfill ⇒ metrics start empty.** Numbers reflect only post-Phase-6 events; the endpoint
  returns partial/zero data until events accumulate. Mitigation: state this explicitly in acceptance
  (#7) and as a documented LATER decision (historical backfill of past state) — NOT slice 1.
- **R6 — Service-token trust reuse.** Reusing `PLATFORM_CONTROL_SECRET` for the read lane means a
  leaked token grants both control writes and change-feed reads. Mitigation: same short-TTL /
  distinct-audience discipline as Phase 5; the change-feed is read-only; never log tokens.
- **R7 — Contract vs Prisma type drift.** `data/` types are hand-written unions (Design B no-Prisma
  seam) and can drift from the outbox schema. Mitigation: compile-time equality assertion (as Phase 5
  did for the control lane) and keep the payload minimal in slice 1.

---

## 7. Open sub-questions for spec/design

1. **Cursor encoding.** Opaque string (base64 `occurredAt:seqNo`) vs raw `seqNo` int in `?since=`?
   And is `seqNo` a `BIGSERIAL` or do we tiebreak `occurredAt`+`id`?
2. **Change-feed module placement.** Extend `PlatformControlModule` with the GET route, or a new
   sibling `PlatformDataModule` sharing `PlatformControlGuard`? (Trust seam is shared either way.)
3. **Poll job lifecycle.** `OnModuleInit` + `setInterval` vs a minimal custom scheduler; overlap
   guard (skip if a poll is still running); shutdown cleanup; what to do on repeated feed errors
   (backoff?).
4. **Cursor persistence in ViewPro.** Dedicated single-row cursor table vs a column on a
   config/state row; transaction boundary between "insert mirror rows" and "advance cursor"
   (advance only after rows committed).
5. **Mirror table shape.** Store the raw outbox payload verbatim (JSONB) or normalize
   `tenantId`+`status` columns for the metrics query? (Affects the summary query and future events.)
6. **Metrics response shape.** Exact fields of `GET /operators/metrics/summary` — mirror
   `AdminSummaryResponse.totals` subset (`tenants`, `activeTenants`, per-status counts) but derived
   from events, and how to compute "current status per tenant" from an append-only event log
   (latest-event-wins vs a small tenant-status projection).
7. **Idempotent producer.** Is one outbox row per status change guaranteed unique by the event id,
   and does an `unchanged` status transition emit an event or not (mirrors the repo's `unchanged`
   result branch)?
8. **Batch limit + poll interval defaults** and whether they are env-configurable in slice 1.

---

## 8. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
