# Design: Platform Phase 7 Slice 2 — Sub-slice A — TENANT REGISTRY (backend)

Complete the operator-facing tenant list served entirely from `viewpro_platform` (Design B, zero InmoView DB reads). Add a second data-lane event `TENANT_REGISTERED`, emitted by InmoView (`apps/api`) **inside the existing tenant-creation `$transaction`** (`PrismaAuthRegistrationRepository.registerTenant`), so every future tenant appears in the mirror. viewpro-api (`apps/viewpro-api`) grows a `platform_tenants` projection, event-type-routed ingest, an operator-only `GET /operators/tenants` list, and a one-time idempotent backfill seed that pulls pre-existing tenants over a new InmoView internal endpoint (`GET /internal/platform/tenants`, `PlatformControlGuard`). The change-feed producer (`findSince` by `seqNo`) is event-type-agnostic — no producer-endpoint change. Paths below are under `viewpro-app/`.

## Technical Approach

Event-driven projection + one-time backfill (proposal §3, Option B). The existing transactional-outbox + cursor-pull pipe (Phase 6) is reused unchanged; only its **payload vocabulary widens** (union of two `eventType`s, additive `name`/`slug` fields) and the **consumer learns to route by `eventType`**. `TENANT_REGISTERED` is emitted from the registration repo's `$transaction` closure via the already-existing `PlatformOutboxWriter.emit(tx, event)` — so the outbox row commits iff user+tenant+membership commit. On the read side, a new `platform_tenants` projection table (keyed by tenant `id`) is upserted by an event-routed ingest branch; `platform_mirror_events` (metrics) is left fully intact and continues to be appended for both event types. The operator list is served from `platform_tenants` only. Pre-existing tenants (registered before this slice) are seeded once via a signed pull from InmoView reusing the Phase 5 control-lane trust.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| A1 | Second event type placement | Widen `PlatformOutboxEvent.eventType` to `'TENANT_STATUS_CHANGED' \| 'TENANT_REGISTERED'`; `payload` becomes the union `TenantStatusChangedPayload \| TenantRegisteredPayload` | separate `PlatformOutboxEvent` per type; a generic `payload: unknown` | Single row shape keeps the feed/producer/cursor untouched; a discriminated union on `eventType` gives the consumer a type-safe branch. JSON payload column already stores arbitrary shape |
| A2 | `TENANT_REGISTERED` payload | `{ id, name, slug, newStatus, limits:{maxUsers,maxActivePropertyEngagements,maxDocumentsStorageMb} }`; `newStatus` = initial status (e.g. `TRIAL`) | `status` field name; omit status | `newStatus` (not `status`) is REQUIRED so the payload passes MirrorRepository's **W2 guard** (skips events with empty `newStatus`) unchanged — the registry event flows through the SAME mirror append path with no W2 edit |
| A3 | `TENANT_STATUS_CHANGED` enrichment | Add additive OPTIONAL `name?`, `slug?` to `TenantStatusChangedPayload` | new event; required fields | Additive/optional keeps old rows valid and is backward-compatible over JSON; lets a status change refresh identity on the projection when present, without a contract-breaking change |
| A4 | InmoView emit site | Inside `PrismaAuthRegistrationRepository.registerTenant`'s `$transaction`, after `tenant.create`, using the created row's `id/name/slug/status/maxUsers/…` | emit in `RegisterTenantUseCase` (owns no tx); a DB trigger | The use-case owns NO `$transaction`; only the repo does. Emitting there guarantees delivery⇔commit (rollback ⇒ no event). Mirrors the Phase 6 `PrismaAdminTenantStatusRepository` pattern (D3/D4) |
| A5 | Widen writer input union | `PlatformOutboxWriter.OutboxEventInput` becomes the union of both event input shapes (`TENANT_STATUS_CHANGED` \| `TENANT_REGISTERED`) | overload/generic per type; a second writer method | One `emit(tx, event)` already serializes seqNo via `pg_advisory_xact_lock(OUTBOX_LOCK_KEY)`; widening the input union reuses that exact seam and lock, so the registry path inherits the seqNo-gap fix for free |
| A6 | Advisory-lock contention on registration | Accept `pg_advisory_xact_lock(OUTBOX_LOCK_KEY)` now also held on the registration path (previously admin-status-only) | separate lock key per event type; no lock on registration | The lock is xact-scoped (auto-released at commit) and registration volume is low; a separate key would break the single-total-order guarantee the poller relies on. Contention is negligible and explicitly accepted (R2) |
| A7 | `platform_tenants` column shape | Typed columns mirroring `PlatformTenantLimits`: `maxUsers Int?`, `maxActivePropertyEngagements Int?`, `maxDocumentsStorageMb Int?` (NOT a Json blob) + `id @id`, `name`, `slug`, `latestStatus`, `updatedAt` | single `limits Json?` column | Typed columns are queryable/indexable, match the exact InmoView source shape, and let `GET /operators/tenants` project limits without JSON parsing. A Json blob would defer validation to read time and lose column typing |
| A8 | Ingest event routing | `IngestService`/`MirrorRepository` branch on `event.eventType`: keep the existing `platform_mirror_events` append for BOTH types (W2 still applies), then additionally upsert `platform_tenants` — full identity+limits on `TENANT_REGISTERED`, `latestStatus` (+name/slug if present) on `TENANT_STATUS_CHANGED` | replace the mirror append; route only registry events | Metrics must keep working unchanged (accept #8). The projection upsert is an ADDITIVE second write inside the same batch; both writes are idempotent on their unique keys |
| A9 | Status-change for not-yet-registered tenant | `TENANT_STATUS_CHANGED` upserts `platform_tenants` create-if-missing (id + latestStatus, name/slug when present) | update-only (drop if row absent) | During the deploy/backfill window a status change may arrive before the tenant's registry row exists (tenant predates registry, backfill not yet run). Upsert-create-from-status guarantees no tenant is lost; name/slug fill in later from enrichment or backfill |
| A10 | Operator list route placement | New `TenantRegistryController` (`GET /operators/tenants`) in `PlatformDataModule` (`AuthGuard`), reads `platform_tenants` only | add the GET to the existing `PlatformControlController` (`@Controller('operators/tenants')`, PATCH) | The list is a DATA-lane read (mirror), not a control-lane outbound POST. Nest allows two controllers on the same base path with distinct methods; keeping the read in the data module preserves the read/write lane separation established in Phase 6 (D2) |
| A11 | Pagination contract | `offset`/`limit` (default `limit=50`, cap `200`; `offset=0`) + `total`; sorted by `name ASC` | cursor pagination; sort by `updatedAt` | Tenant count is small and the operator UI wants stable alphabetical paging with a visible total; offset/limit + total is the simplest correct contract for a bounded list. Cursor paging is unnecessary at this volume (revisit if it grows) |
| A12 | Backfill mechanism | viewpro-api one-time seed script mints a service token (reuse the `ChangeFeedClient` token-minting claims) and pulls `GET /internal/platform/tenants` (`PlatformControlGuard`), then idempotent-upserts `platform_tenants` | viewpro-api DB migration reading InmoView's DB; raw cross-DB SQL insert | A viewpro-api migration cannot read InmoView's DB (Design B violation). Reusing the control-lane trust keeps the DB seam intact, the seed one-time and safely re-runnable (idempotent upsert on id) (proposal §5) |
| A13 | Internal registry endpoint shape | `GET /internal/platform/tenants` returns a bounded batch `{ tenants: [{ id, name, slug, status, limits }] }` behind `PlatformControlGuard` | streaming; cursor/paged | Tenant count is small; a single bounded batch is simpler and the guard/trust is already established. Read-only, never mutates. If the count ever exceeds a safe batch, add paging then |
| A14 | Backfill run-once enforcement | Idempotency by upsert (re-run is a no-op); NO explicit run-once guard row | a `backfill_completed` flag/lock table | Upsert-on-id makes re-runs harmless and correct; an explicit guard adds a failure mode (stuck flag) for no benefit. Document "safe to re-run" instead of gating |

## Data Flow

    InmoView tenant registration (same $transaction — A4)
      PrismaAuthRegistrationRepository.registerTenant.$transaction(tx)
        user.create → tenant.create → tenantMembership.create
        PlatformOutboxWriter.emit(tx, { eventType:'TENANT_REGISTERED', tenantId:tenant.id,
            payload:{ id, name, slug, newStatus:tenant.status, limits:{…3 cols} }, occurredAt })
              └─ pg_advisory_xact_lock(OUTBOX_LOCK_KEY) → seqNo INSERT   (A5/A6)
      ⇒ commit together   (rollback ⇒ no outbox row)

    InmoView status change (unchanged Phase 6 path, now enriched — A3)
      PrismaAdminTenantStatusRepository.updateTenantStatus.run(client)
        SELECT id,status,updatedAt,name,slug FROM tenants FOR UPDATE   ← SELECT widened
        tenant.update → analyticsEvent.create → emit({TENANT_STATUS_CHANGED,
            payload:{ previousStatus, newStatus, name, slug }})

    ViewPro poll (unchanged: setInterval, overlap-guarded, cursor after commit)
      GET /internal/platform/changes?since=<seqNo>  → { events:[…mixed types…], nextCursor }
      IngestService.ingestBatch(events):
        for each event:
          MirrorRepository.upsertEvent(event)      ← platform_mirror_events (W2, metrics — intact)
          route on event.eventType (A8):
            TENANT_REGISTERED      → platform_tenants.upsert(id, name, slug, latestStatus, limits)  [full]
            TENANT_STATUS_CHANGED  → platform_tenants.upsert(id, latestStatus, [name/slug if present]) [create-if-missing A9]
        advance cursor to max(seqNo) AFTER all upserts commit (D7)

    Operator → GET /operators/tenants?offset&limit  (Phase 4 AuthGuard — A10/A11)
      SELECT … FROM platform_tenants ORDER BY name ASC OFFSET ? LIMIT ?  + COUNT(*)
      ⇒ { total, items:[{ id, name, slug, status, limits }] }   [platform_tenants ONLY]

    One-time backfill (A12/A14)
      seed script → mint service token (ChangeFeedClient claims) →
        GET /internal/platform/tenants (PlatformControlGuard) → { tenants:[…] }
        for each → platform_tenants.upsert(id, …)   ← idempotent, safe to re-run

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/platform-contract/src/data/platform-outbox-event.ts` | Modify | Widen `eventType` union; add `TenantRegisteredPayload` + `PlatformTenantRegistryLimits`; make `payload` the discriminated union; add optional `name?`/`slug?` to `TenantStatusChangedPayload` |
| `packages/platform-contract/src/data/index.ts` | Verify | Already `export *` — new types flow through; no change if same file |
| `apps/api/src/platform-data/platform-outbox-writer.ts` | Modify | Widen `OutboxEventInput` to the union of both event input shapes (A5); `emit` body unchanged (lock + create) |
| `apps/api/src/platform-data/type-assertions.ts` | Modify | Add compile-time assertion that the contract `eventType` union matches the set of emitted types, and that `PlatformTenantRegistryLimits` fields mirror `Tenant.{maxUsers,maxActivePropertyEngagements,maxDocumentsStorageMb}` |
| `apps/api/src/platform-data/platform-outbox.repository.ts` | Modify | Loosen the `eventType` cast to the union; `payload` cast to `PlatformOutboxEvent['payload']` (already generic — verify) |
| `apps/api/src/auth/repositories/prisma-auth-registration.repository.ts` | Modify | Inject `PlatformOutboxWriter`; after `tenant.create`, `emit(tx, {TENANT_REGISTERED,…})` inside the existing `$transaction` (A4) |
| `apps/api/src/auth/auth.module.ts` | Modify | Import `PlatformDataModule` (exports `PlatformOutboxWriter`) so the registration repo can inject it (mirrors `admin.module.ts`) |
| `apps/api/src/platform-data/platform-data.controller.ts` | Modify | Add `GET /internal/platform/tenants` behind `PlatformControlGuard`; read-only bounded batch (A13) |
| `apps/api/src/platform-data/platform-outbox.repository.ts` (or a new `platform-tenants.repository.ts`) | Create/Modify | Read all tenants (`id,name,slug,status,maxUsers,maxActivePropertyEngagements,maxDocumentsStorageMb`) for the internal endpoint — read-only |
| `apps/api/prisma/schema.prisma` | Verify | NO migration — `Tenant` already has name/slug/status/limits; `platform_outbox_events` already exists (accept #7) |
| `apps/viewpro-api/prisma/schema.prisma` | Modify | Add `PlatformTenant` model (`id @id`, `name`, `slug`, `latestStatus`, 3 limit `Int?` cols, `updatedAt`) mapped to `platform_tenants` (A7) |
| `apps/viewpro-api/prisma/migrations/*` | Create | Additive `CREATE TABLE platform_tenants` on `viewpro_platform` (own DB, low risk; rollback = drop) |
| `apps/viewpro-api/src/platform-data/mirror.repository.ts` | Modify (or split) | Keep `upsertEvent` (mirror append + W2) intact; add `platform_tenants` upsert helpers (`upsertFromRegistered`, `upsertFromStatusChange`) — or a new `PlatformTenantRepository` |
| `apps/viewpro-api/src/platform-data/ingest.service.ts` | Modify | After the mirror upsert, branch on `event.eventType` and call the projection upsert (A8/A9); both writes before cursor advance |
| `apps/viewpro-api/src/platform-data/tenant-registry.controller.ts` | Create | `GET /operators/tenants` behind `AuthGuard`; offset/limit + total; sorted by name (A10/A11) |
| `apps/viewpro-api/src/platform-data/tenant-registry.service.ts` | Create | Paginated read from `platform_tenants` (count + page) |
| `apps/viewpro-api/src/platform-data/platform-data.module.ts` | Modify | Register `TenantRegistryController` + service + `PlatformTenantRepository` |
| `apps/viewpro-api/src/platform-data/change-feed.client.ts` (or new `registry-backfill.client.ts`) | Modify/Create | Add `fetchAllTenants()` — mints a token (reuse `mintIngestToken` claims), `GET /internal/platform/tenants` |
| `apps/viewpro-api/src/scripts/backfill-platform-tenants.ts` (or a Nest standalone command) | Create | One-time seed: pull all tenants, idempotent-upsert into `platform_tenants` (A12/A14) |

## Interfaces / Contracts

    // packages/platform-contract data/ (own unions, never import @prisma/client)
    type PlatformTenantRegistryLimits = {
      maxUsers: number | null
      maxActivePropertyEngagements: number | null
      maxDocumentsStorageMb: number | null
    }
    type TenantRegisteredPayload = {
      id: string; name: string; slug: string
      newStatus: PlatformTenantStatus          // initial status — REQUIRED (passes W2, A2)
      limits: PlatformTenantRegistryLimits
    }
    type TenantStatusChangedPayload = {
      previousStatus: PlatformTenantStatus
      newStatus: PlatformTenantStatus
      name?: string; slug?: string             // additive, optional (A3)
    }
    type PlatformOutboxEvent = {
      id: string; seqNo: number
      eventType: 'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED'
      tenantId: string
      payload: TenantStatusChangedPayload | TenantRegisteredPayload
      occurredAt: string
    }

    // InmoView internal registry endpoint (read-only, PlatformControlGuard)  A13
    GET /internal/platform/tenants
      → { tenants: Array<{ id, name, slug, status: PlatformTenantStatus, limits: PlatformTenantRegistryLimits }> }

    // ViewPro operator tenant list (AuthGuard)  A10/A11
    GET /operators/tenants?offset=<n>&limit=<n>
      → { total: number; items: Array<{ id, name, slug, status: PlatformTenantStatus, limits: PlatformTenantRegistryLimits }> }
      defaults: offset=0, limit=50 (cap 200); ORDER BY name ASC

## Isolation Proof

1. viewpro-api's `platform-data/` (including the new `TenantRegistryController`, service, and `PlatformTenant` repo) imports NOTHING from `@prisma/client` (InmoView's client); it uses only its own generated client (`src/generated/prisma`) against `viewpro_platform`.
2. The ONLY InmoView touchpoints remain HTTP: the poll `change-feed.client` and the new backfill pull to `GET /internal/platform/tenants`. No InmoView `DATABASE_URL` is loaded in the viewpro-api process.
3. `GET /operators/tenants` reads `platform_tenants` exclusively — a regression test asserts zero outbound HTTP and no InmoView-client import on that request path (mirrors the Phase 6 metrics isolation test).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Contract: `TENANT_REGISTERED` payload carries `newStatus`; union discriminates on `eventType` | tsc type-assertion file |
| Unit | Writer accepts both event input shapes; `emit` acquires lock then creates (A5) | vitest, mocked tx client |
| Unit | Registration repo emits `TENANT_REGISTERED` inside the tx after `tenant.create`; rollback ⇒ no emit (A4) | vitest, mocked tx |
| Unit | Ingest routing: `TENANT_REGISTERED` → full upsert; `TENANT_STATUS_CHANGED` → status upsert (A8); create-if-missing on status for absent tenant (A9) | vitest, mocked repos |
| Unit | Mirror append still runs for both types; W2 still skips empty `newStatus` (accept #8) | vitest |
| Unit | Registry list: pagination (offset/limit/total), sort by name (A11) | vitest, mocked repo |
| Integration | Registration writes an outbox `TENANT_REGISTERED` row in the SAME tx; rollback ⇒ no row (accept #1) | supertest + test DB |
| Integration | Poll ingests a `TENANT_REGISTERED` → `platform_tenants` row; re-delivery idempotent (accept #2) | supertest, both test DBs |
| Integration | Status change updates `latestStatus` (+name/slug) on the same row (accept #3) | supertest |
| Integration | `GET /operators/tenants` lists tenant with name/slug/status/limits, paginated, from mirror only; 401 without operator session (accept #4/#5) | supertest |
| Integration | `GET /internal/platform/tenants` 401 on missing/invalid service token; read-only | supertest, forged tokens |
| Integration | Backfill seed populates all pre-existing tenants once; re-run is a no-op (accept #6) | supertest, seed invocation twice |
| Isolation | Registry list path never imports InmoView Prisma client; user cookie rejected by the internal guard | static + supertest |

## Threat Matrix

Process-integration boundary (server-to-server HTTP + reused service-token trust); adds one new internal read endpoint and one live write-path emit:

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Cross-service token forgery (registry pull) | Applicable | Wrong secret/iss/aud/expired → 401 on `GET /internal/platform/tenants`; guard never sets `request.user` |
| Token confusion (user↔service) | Applicable | Operator cookie/user JWT lacks `aud=inmoview-control` → internal endpoint 401; service token has no cookie → `GET /operators/tenants` `AuthGuard` 401 |
| Replay / duplicate delivery | Applicable | Redelivered `TENANT_REGISTERED`/`TENANT_STATUS_CHANGED` → upsert-on-id no-op; mirror UNIQUE(sourceEventId) dedup unchanged |
| Registration-path failure isolation (R1) | Applicable | Emit is inside the existing `$transaction`; any emit error rolls back the whole registration — no partial tenant, no orphan event |
| Advisory-lock contention (R2) | Applicable | `pg_advisory_xact_lock` is xact-scoped; a slow registration holds it briefly; low volume → negligible; documented, not mitigated further |
| Internal endpoint exposure | Applicable | `/internal/platform/tenants` not publicly routable (infra); guard is defense-in-depth; read-only |
| Cross-tenant data exposure | Applicable | `platform_tenants` is operator-only (`AuthGuard`); no tenant-scoped route reads it; payload is tenant identity/limits (operator-appropriate) |
| SSRF via `INMOVIEW_API_INTERNAL_URL` | N/A | Fixed env-configured base URL, not user-supplied |
| Shell/subprocess/VCS automation | N/A | The backfill seed is an app-context script (Prisma + fetch), no shell/VCS |

## Migration / Rollout

**InmoView**: NO schema migration — `Tenant` already carries name/slug/status/limits and `platform_outbox_events` already exists (accept #7). Only new outbox rows + a widened SELECT + a new read-only internal endpoint.

**viewpro-api** (`viewpro_platform`): additive `CREATE TABLE platform_tenants` — low risk; rollback = drop. `platform_mirror_events`/`platform_ingest_cursor` untouched.

**Coordinated deploy (ordered — R3).** Ingest MUST tolerate `TENANT_REGISTERED` before InmoView emits it:
1. Ship platform-contract union + additive fields.
2. Deploy viewpro-api: `platform_tenants` migration + event-routed ingest (tolerant of the new type) + `GET /operators/tenants`. At this point no registry events exist yet — the list is empty/partial, which is acceptable.
3. Deploy InmoView: registration emit of `TENANT_REGISTERED` + enriched `TENANT_STATUS_CHANGED` + the internal `GET /internal/platform/tenants` endpoint.
4. Run the backfill seed once to populate pre-existing tenants.

**Rollback**: revert InmoView emit (stops new events) and the internal endpoint; drop `platform_tenants` on viewpro-api; revert ingest routing (falls back to status-only mirror). The contract union revert is additive-safe. No data loss — the projection is derived and rebuildable from the feed + backfill.

## Open Questions (for tasks phase)

- [ ] Backfill lifecycle: standalone `ts-node`/`tsx` script vs a Nest standalone application command (`NestFactory.createApplicationContext`). Recommend a Nest standalone command so it reuses DI (`PlatformTenantRepository`, config, token minting) — confirm the app's existing script-runner convention.
- [ ] `latestStatus` column type in `platform_tenants`: `String` (mirror `platform_mirror_events.newStatus`) vs a Prisma enum. Recommend `String` for consistency with the existing mirror and to avoid an enum migration; the contract union guards values.
- [ ] Whether `GET /operators/tenants` should expose `updatedAt`/`latestStatus`-as-`status` naming exactly, and whether limits are nested (`{ limits:{…} }`) or flattened in the item — recommend nested `limits` to mirror the contract type.
- [ ] `GET /internal/platform/tenants` bounded-batch cap (A13): pick a safe LIMIT (recommend none/`ALL` for slice-1 tenant counts, or a high cap e.g. 1000 with a documented follow-up to page if exceeded).
- [ ] Should the backfill also emit/repair `platform_mirror_events` for pre-existing tenants (for metrics parity), or ONLY populate `platform_tenants`? Recommend `platform_tenants` only — metrics already derive from status-change events and are out of this slice's scope (accept #8).
- [ ] Exact placement of the tenant-read for the internal endpoint: extend `PrismaOutboxRepository` vs a new `PlatformTenantsReadRepository` in `apps/api`. Recommend a small dedicated read repo to keep the outbox repo single-purpose.
- [ ] Confirm `auth.module.ts` importing `PlatformDataModule` introduces no circular module dependency (PlatformDataModule imports only the guard + writer + outbox repo; it does not import AuthModule on the InmoView side — verify).
