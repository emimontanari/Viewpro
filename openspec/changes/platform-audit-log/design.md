# Design: Platform Audit Log (vision D3 — governance sub-slice)

Add one generic `AUDIT_LOGGED` data-lane event carrying **who / what / when / old→new**, emitted by InmoView (`apps/api`) **inside the existing status- and limits-mutation `$transaction`s**, ingested by viewpro-api (`apps/viewpro-api`) into an append-only `platform_audit_log` projection in `viewpro_platform`, and rendered by viewpro-web (`apps/viewpro-web`) as a single global, newest-first, paginated feed. Reuses the Phase 6 / tenant-registry pipe unchanged (`PlatformOutboxWriter`, `PlatformDataPollJob`, `IngestService.routeToTenantProjection`, cursor); only the payload vocabulary widens and the consumer learns to route the new type. Design B isolation is absolute: the actor + delta reach viewpro-web ONLY through the emitted event — never a cross-DB read of `analytics_events`. Paths below are under `viewpro-app/`.

## Technical Approach

Event-driven projection, no new pull endpoint. `AUDIT_LOGGED` is a third arm on the existing discriminated union (`eventType` + `payload`), emitted from the two admin repos' `$transaction` closures via the already-existing `PlatformOutboxWriter.emit(tx, event)` — so the audit row commits iff the domain mutation commits (rollback ⇒ no event). The status site keeps its existing `TENANT_STATUS_CHANGED` emit (tenant-registry depends on it) and gains a **second** emit; the limits site — which today emits NO outbox event — injects the writer and gains its **first** emit. On the read side a new `platform_audit_log` table is appended by a new explicit `AUDIT_LOGGED` branch in `routeToTenantProjection`, idempotent on `sourceEventId`. The mirror + cursor are left byte-for-byte unchanged (see A5). `GET /operators/audit` serves the feed newest-first by `seqNo DESC` from that projection only. `previousValue`/`newValue` are stored as loose JSON (display-only trail); the FE zod-parses defensively and renders old→new as text.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| A1 | Event granularity | ONE generic `AUDIT_LOGGED` (locked) | per-type events (`STATUS_AUDITED`, `LIMITS_AUDITED`) | One type audits status + limits now and future cancel/role/plan with zero further contract migration; the delta is display-only so loose JSON is acceptable |
| A2 | Payload shape | `{ action:string, previousValue:Json, newValue:Json, actor:{id,type,label} }`; `tenantId`/`occurredAt` on the envelope | typed per-action payloads | Free-string `action` (`TENANT_STATUS_CHANGED` / `TENANT_LIMITS_UPDATED`) + loose old→new keeps the single type forward-compatible; FE maps `action`→label |
| A3 | Actor label sourcing | `actor.label` = the actor id (operatorId/userId) as a **no-lookup** default; `id`/`type` mapped directly from the in-scope `CommandActor` | cross-DB lookup of operator email/user name | Locked "actor label in-payload, no cross-DB lookup". Only `CommandActor` (`{type, operatorId\|userId}`) is in scope at both emit sites; id is a stable label. Threading a real display label from the session is an additive follow-up (Open Q1) |
| A4 | Limits emit site enablement | Inject `PlatformOutboxWriter` into `PrismaAdminTenantLimitsRepository` (constructor); emit inside the existing `run(client)` `$transaction` on the `updated` branch only | emit in the use-case (owns no tx); a DB trigger | The repo owns the `$transaction`; `admin.module` already imports `PlatformDataModule` (which provides the writer — status repo already injects it), so NO module change — just add the ctor param |
| A5 | Mirror behavior for audit events | Leave `MirrorRepository.upsertEvent` UNCHANGED; its W2 guard (`newStatus===''`) skips `AUDIT_LOGGED` (it has no `newStatus`) → no mirror row, cursor still advances | add an `AUDIT_LOGGED` exemption to the mirror | Locked "mirror-append + cursor unchanged". The audit projection is the durable trail; the mirror feeds metrics only. Skipping audit from the mirror is harmless and touches zero existing metrics code (Open Q2 confirms vs proposal #9 parenthetical) |
| A6 | Projection W2 exemption | The new `AUDIT_LOGGED` branch in `routeToTenantProjection` runs BEFORE the `TENANT_*` `newStatus` early-return guards and does NOT apply them | reuse the `!payload.newStatus` guard | `AUDIT_LOGGED` has no `newStatus`; applying the guard would silently drop every audit row. The explicit branch appends unconditionally, then returns |
| A7 | `platform_audit_log` shape | Append-only; `sourceEventId @unique`, `seqNo BigInt`, `action`, `tenantId`, `actor Json`, `previousValue Json?`, `newValue Json?`, `occurredAt`, `createdAt` | typed actor columns; typed delta columns | `actor`/delta are display-only and shape-varying across actions; Json keeps the single generic event forward-compatible without migrations. `sourceEventId` unique = idempotency; `seqNo` = deterministic newest-first order |
| A8 | Idempotent append | `upsert({ where:{sourceEventId}, update:{}, create:{…} })` (mirrors `MirrorRepository`) | `create` + catch unique violation; `createMany skipDuplicates` | Re-delivery is a no-op; matches the proven mirror dedup pattern; no exception control-flow |
| A9 | Feed sort key | `ORDER BY seqNo DESC` (locked) | `occurredAt DESC` | `seqNo` is the outbox total order (advisory-lock serialized) → a stable, tie-break-free newest-first even under same-`occurredAt` events |
| A10 | Read route placement | New `AuditController` (`GET /operators/audit`, `AuthGuard`) + `AuditService` in `PlatformDataModule`; reads `platform_audit_log` only; offset/limit (default 50, cap 200), `{total,items}` | add to an existing controller; per-tenant filter | Data-lane read; mirrors `TenantRegistryController`/`Service` exactly (offset/limit/total, 200 cap). Feed is global — no `tenantId` filter (Open Q3) |
| A11 | FE feature | New `features/audit` mirroring `features/tenants` (`api/{types,schemas,service,queries}.ts` + components); single global paginated feed; zod defensive parse | extend `features/tenants` | Distinct surface/route; reuse of the established feature split keeps convention parity |

## Data Flow

    InmoView status change (existing tx — enriched with a 2nd emit)
      PrismaAdminTenantStatusRepository.updateTenantStatus.run(client)
        SELECT … FOR UPDATE → tenant.update → analyticsEvent.create
        outboxWriter.emit(client, { TENANT_STATUS_CHANGED, … })            ← unchanged
        outboxWriter.emit(client, { AUDIT_LOGGED, payload:{                 ← NEW (A4)
            action:'TENANT_STATUS_CHANGED',
            previousValue:{ status:tenant.status },
            newValue:{ status:input.targetStatus },
            actor:toAuditActor(input.actor) }, occurredAt:input.now })
      ⇒ commit together   (rollback ⇒ neither event)

    InmoView limits change (existing tx — first-ever emit)
      PrismaAdminTenantLimitsRepository.updateTenantLimits.run(client)   [inject writer — A4]
        SELECT … FOR UPDATE → tenant.update → analyticsEvent.create
        outboxWriter.emit(client, { AUDIT_LOGGED, payload:{               ← NEW first emit
            action:'TENANT_LIMITS_UPDATED',
            previousValue:previousLimits, newValue:updatedLimits,
            actor:toAuditActor(input.actor) }, occurredAt:input.now })
      ⇒ commit together

    ViewPro poll (unchanged: interval, overlap-guarded, cursor after commit)
      GET /internal/platform/changes?since=<seqNo> → { events:[…mixed…], nextCursor }
      IngestService.ingestBatch(events):
        for each event:
          MirrorRepository.upsertEvent(event)   ← UNCHANGED; W2 skips AUDIT_LOGGED (A5)
          routeToTenantProjection(event):
            AUDIT_LOGGED          → AuditLogRepository.appendFromEvent(event)  [no W2 guard — A6]
            TENANT_REGISTERED     → platform_tenants upsert   (unchanged)
            TENANT_STATUS_CHANGED → platform_tenants upsert   (unchanged)
        advance cursor to max(seqNo) AFTER all upserts commit (D7)

    Operator → GET /operators/audit?offset&limit  (AuthGuard — A10)
      SELECT … FROM platform_audit_log ORDER BY seqNo DESC OFFSET ? LIMIT ?  + COUNT(*)
      ⇒ { total, items:[{ action, actor, tenantId, previousValue, newValue, occurredAt }] }

    viewpro-web features/audit → getAuditFeed → zod parse → audit-table renders old→new

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/platform-contract/src/data/platform-outbox-event.ts` | Modify | Add `AuditActor` + `AuditLoggedPayload`; widen `eventType` union with `'AUDIT_LOGGED'`; widen `payload` union with `AuditLoggedPayload` |
| `apps/api/src/platform-data/platform-outbox-writer.ts` | Modify | Add a third `OutboxEventInput` arm `{ eventType:'AUDIT_LOGGED', tenantId, payload:AuditLoggedPayload, occurredAt:Date }`; `emit` body unchanged |
| `apps/api/src/platform-data/platform-outbox.repository.ts` | Verify | `eventType`/`payload` casts already generic over the union — no change |
| `apps/api/src/admin/prisma-admin-tenant-status.repository.ts` | Modify | After the existing `TENANT_STATUS_CHANGED` emit, add a second `AUDIT_LOGGED` emit inside the SAME tx (A4); add `toAuditActor` helper |
| `apps/api/src/admin/prisma-admin-tenant-limits.repository.ts` | Modify | Inject `PlatformOutboxWriter`; on the `updated` branch emit `AUDIT_LOGGED` inside the SAME tx (first-ever emit, A4) |
| `apps/api/src/admin/audit-actor.ts` | Create (optional) | `toAuditActor(actor:CommandActor):AuditActor` — shared mapper (or inline in each repo) |
| `apps/viewpro-api/prisma/schema.prisma` | Modify | Add `PlatformAuditLog` model mapped to `platform_audit_log` (A7) |
| `apps/viewpro-api/prisma/migrations/*` | Create | Additive `CREATE TABLE platform_audit_log` on `viewpro_platform`; rollback = drop |
| `apps/viewpro-api/src/platform-data/audit-log.repository.ts` | Create | `AuditLogRepository.appendFromEvent(event)` — idempotent upsert on `sourceEventId` (A8) |
| `apps/viewpro-api/src/platform-data/ingest.service.ts` | Modify | Add explicit `AUDIT_LOGGED` branch in `routeToTenantProjection` (before the `TENANT_*` guards, W2-exempt — A6); inject `AuditLogRepository` |
| `apps/viewpro-api/src/platform-data/audit.controller.ts` | Create | `GET /operators/audit` behind `AuthGuard`; offset/limit sanitize (mirror `tenant-registry.controller`) |
| `apps/viewpro-api/src/platform-data/audit.service.ts` | Create | `listAudit(offset, limit)` → `findMany({orderBy:{seqNo:'desc'}, skip, take})` + `count()`, cap 200 (A9/A10) |
| `apps/viewpro-api/src/platform-data/platform-data.module.ts` | Modify | Register `AuditLogRepository`, `AuditService`, `AuditController` |
| `apps/viewpro-web/src/features/audit/api/types.ts` | Create | `AuditActor`, `AuditLogItem`, `AuditFeedResponse` |
| `apps/viewpro-web/src/features/audit/api/schemas.ts` | Create | zod feed schema; `previousValue`/`newValue` = `z.unknown()`; safeParse → normalized `ApiError` on failure |
| `apps/viewpro-web/src/features/audit/api/service.ts` | Create | `getAuditFeed(offset, limit)` → `apiRequest('/operators/audit?…')` then zod parse |
| `apps/viewpro-web/src/features/audit/api/queries.ts` | Create | `auditKeys` + `auditFeedOptions(offset, limit)` |
| `apps/viewpro-web/src/features/audit/components/{audit-feed-page,audit-table,audit-pager,audit-empty-state}.tsx` | Create | Feed page + table (renders actor/action/tenant/timestamp/old→new), pager (mirror `tenants-pager`), empty state |
| `apps/viewpro-web/src/app/dashboard/audit/page.tsx` | Create | Thin route → `AuditFeedPage` inside `PageContainer` (es-AR copy) |
| `apps/viewpro-web/src/config/nav-config.ts` | Modify | Add `Auditoría` nav item → `/dashboard/audit` |

## Interfaces / Contracts

    // packages/platform-contract data/ (own unions, never import @prisma/client)
    export type AuditActor = { id: string; type: 'operator' | 'user'; label: string }
    export type AuditLoggedPayload = {
      action: string                 // 'TENANT_STATUS_CHANGED' | 'TENANT_LIMITS_UPDATED' | …future
      previousValue: unknown         // loose JSON — display-only old→new trail
      newValue: unknown
      actor: AuditActor
    }
    export type PlatformOutboxEvent = {
      id: string; seqNo: number
      eventType: 'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED' | 'AUDIT_LOGGED'
      tenantId: string
      payload: TenantStatusChangedPayload | TenantRegisteredPayload | AuditLoggedPayload
      occurredAt: string
    }

    // apps/api emit-site mapper (no cross-DB lookup — A3)
    function toAuditActor(a: CommandActor): AuditActor {
      return a.type === 'operator'
        ? { id: a.operatorId, type: 'operator', label: a.operatorId }
        : { id: a.userId,     type: 'user',     label: a.userId }
    }

    // ViewPro operator audit feed (AuthGuard — A10)
    GET /operators/audit?offset=<n>&limit=<n>
      → { total: number; items: Array<{ action, actor:AuditActor, tenantId,
            previousValue: unknown, newValue: unknown, occurredAt: string }> }
      defaults: offset=0, limit=50 (cap 200); ORDER BY seqNo DESC

    // viewpro-web defensive parse — previous/new never throw on unexpected shape
    const actorSchema = z.object({ id:z.string(), type:z.string(), label:z.string() })
    const itemSchema  = z.object({ action:z.string(), actor:actorSchema, tenantId:z.string(),
                                   previousValue:z.unknown(), newValue:z.unknown(),
                                   occurredAt:z.string() })
    // renderValue(v): null/undefined → '—'; object → key: value lines; else String(v)

## Isolation Proof

1. viewpro-api's `platform-data/` (including `AuditController`, `AuditService`, `AuditLogRepository`) imports NOTHING from `@prisma/client`; it uses only its own generated client (`src/generated/prisma`) against `viewpro_platform`.
2. `GET /operators/audit` reads `platform_audit_log` exclusively — a regression test asserts zero outbound HTTP and no InmoView-client import on that request path.
3. The actor + delta cross the boundary ONLY inside the emitted event; `analytics_events` is never read by viewpro-api or viewpro-web.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Contract: `AUDIT_LOGGED` discriminates on `eventType`; `AuditLoggedPayload` carries `action`/`actor`/old→new | tsc type-assertion |
| Unit | Writer accepts the `AUDIT_LOGGED` input arm; `emit` acquires lock then creates | vitest, mocked tx |
| Unit | Status repo emits BOTH `TENANT_STATUS_CHANGED` and `AUDIT_LOGGED` in the tx; rollback ⇒ neither (acc #1) | vitest, mocked tx |
| Unit | Limits repo emits `AUDIT_LOGGED` in the tx on `updated`; `unchanged`/`notFound` emit nothing (acc #2) | vitest, mocked tx |
| Unit | `toAuditActor`: operator→`{type:'operator'}`, user→`{type:'user'}`, label=id (acc #3) | vitest |
| Unit | Ingest routing: `AUDIT_LOGGED`→`appendFromEvent`; branch is W2-exempt (no `newStatus`); does NOT touch `platform_tenants` (A6) | vitest, mocked repos |
| Unit | `AuditLogRepository.appendFromEvent` upserts on `sourceEventId`; re-delivery is a no-op (acc #4) | vitest |
| Unit | Audit list: `seqNo DESC`, offset/limit, 200 cap, `{total,items}` (A9/A10) | vitest, mocked repo |
| Unit | FE zod parse tolerates absent/malformed `previousValue`; `renderValue` renders old→new without throwing (R4) | vitest |
| Integration | Status/limits mutation writes an `AUDIT_LOGGED` outbox row in the SAME tx; rollback ⇒ no row | supertest + test DB |
| Integration | Poll ingests `AUDIT_LOGGED` → one `platform_audit_log` row; re-delivery idempotent; `platform_tenants` untouched (acc #4) | supertest, both DBs |
| Integration | `GET /operators/audit` newest-first paginated from `platform_audit_log` only; 401 without operator session (acc #5/#6) | supertest |
| Isolation | Audit path never imports InmoView Prisma client; no cross-DB read | static + supertest |
| E2E | viewpro-web renders a global paginated feed (actor/action/tenant/timestamp/old→new) (acc #7) | Playwright/component |

## Threat Matrix

Process-integration boundary (server-to-server HTTP via the existing feed) + two live write-path emits; no new endpoint, shell, subprocess, or VCS automation.

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Replay / duplicate delivery | Applicable | Re-delivered `AUDIT_LOGGED` → `upsert(sourceEventId)` no-op; exactly one row (A8) |
| Mutation-path failure isolation (R5) | Applicable | Emit is inside the existing `$transaction`; any emit error rolls back the whole status/limits mutation — no partial mutation, no orphan event |
| Advisory-lock contention | Applicable | `pg_advisory_xact_lock` xact-scoped; limits now also takes it; low admin volume → negligible, documented |
| Malformed / absent delta | Applicable | `previousValue`/`newValue` Json-nullable server-side; FE `z.unknown()` + `renderValue` degrade to `—`, never throw (R4) |
| Actor confusion (operator vs admin user) | Applicable | `actor.type` recorded explicitly from `CommandActor`; feed shows WHICH identity acted (R3) |
| Cross-tenant exposure | Applicable | `platform_audit_log` is operator-only (`AuthGuard`); no tenant-scoped route reads it |
| Cross-DB / `analytics_events` read | N/A → asserted forbidden | Isolation test proves no InmoView client import / DB read on the audit path |
| SSRF / shell / subprocess / VCS | N/A | No user-supplied URLs, no shell, no VCS automation in this change |

## Migration / Rollout

**InmoView**: NO schema migration — `platform_outbox_events` already exists; `AUDIT_LOGGED` is only new rows. Only change is two additive emits (+ writer injection on the limits repo).

**viewpro-api** (`viewpro_platform`): additive `CREATE TABLE platform_audit_log` — low risk; rollback = drop. `platform_mirror_events`/`platform_ingest_cursor`/`platform_tenants` untouched.

**Coordinated deploy (ordered — R1).** Ingest MUST tolerate `AUDIT_LOGGED` before InmoView emits it:
1. Ship platform-contract union member `AUDIT_LOGGED` + `AuditLoggedPayload`.
2. Deploy viewpro-api: `platform_audit_log` migration + explicit `AUDIT_LOGGED` ingest branch (tolerant) + `GET /operators/audit`. No audit events exist yet — the feed is empty, which is acceptable.
3. Deploy InmoView: `AUDIT_LOGGED` emit at both the status and limits sites.
4. FE `features/audit` is additive and ships last / independently.

**Rollback**: revert both InmoView emits (stops new events); revert the ingest `AUDIT_LOGGED` branch (falls back to unknown-type skip — mirror/cursor unaffected); drop `platform_audit_log`; drop `features/audit`. Contract union revert is additive-safe. No data loss — the projection is derived from the outbox.

## Open Questions (for tasks phase)

- [ ] **Q1 (actor.label):** default `label = actor id` (no lookup) now; optionally thread a real display label from the operator session by adding an additive optional field to `UpdateAdminTenant{Status,Limits}Input` (still no cross-DB lookup). Recommend id-default for this slice.
- [ ] **Q2 (mirror landing):** confirm the spec accepts that `AUDIT_LOGGED` is W2-skipped from `platform_mirror_events` (A5) — the locked "mirror unchanged" reading — vs proposal acc #9's parenthetical "it still lands in the raw mirror". Recommend leaving the mirror unchanged (projection is the durable trail).
- [ ] **Q3 (tenantId filter):** feed is global with no per-tenant filter param now; a filter is cheap to add later (out of scope per locked decisions).
- [ ] **Q4 (action vocabulary):** free string `action` with an FE label map (`TENANT_STATUS_CHANGED`→"Estado", `TENANT_LIMITS_UPDATED`→"Límites"); confirm es-AR copy in tasks.
- [ ] **Q5 (`toAuditActor` placement):** shared `apps/api/src/admin/audit-actor.ts` helper vs inline per repo — recommend shared to keep both emit sites identical.
