# Proposal: Platform Audit Log (vision D3 — governance sub-slice)

**Change id**: `platform-audit-log`
**Store**: `openspec/changes/platform-audit-log/proposal.md` (+ Engram `sdd/platform-audit-log/proposal`)
**Phase**: platform back-office governance sub-slice (builds on Phases 4-7: outbox → ingest → projection data-lane + operator console).
**Grounded in**: explore #5878; tenant-registry slice (`platform-phase7-tenant-registry`); code read of the outbox/mirror/ingest/emit paths.

---

## 1. Intent

**Problem / why now.** Vision D3 mandates that every platform mutation record **who / what / when / old→new**, and that the operator SEE this trail as a global chronological feed. Today no audit trail crosses the isolation boundary: `TENANT_STATUS_CHANGED` carries old→new but **no actor**; **no limits event exists at all** (limits changes never leave `apps/api`). The only actor+delta record (`analytics_events`) lives inside InmoView's DB — on the wrong side of the Design B boundary, so viewpro-web can never read it. The operator has no way to answer "who changed this tenant, and from what to what".

**Success.** A status change AND a limits change each emit exactly one `AUDIT_LOGGED` outbox event in the same transaction as the mutation; viewpro-api ingests it into an append-only `platform_audit_log` projection; `GET /operators/audit` returns a newest-first paginated feed; and viewpro-web renders a global chronological audit feed across all tenants — all from `viewpro_platform`, zero InmoView DB reads.

---

## 2. Scope

### In scope
1. **platform-contract (`data/`).** Add a single generic `AUDIT_LOGGED` event type to the `PlatformOutboxEvent.eventType` union. Payload: `{ action, previousValue, newValue, actor, tenantId, occurredAt }` — `previousValue`/`newValue` as loose JSON (display-only trail); `actor` = `{ type:'operator', operatorId } | { type:'user', userId }` (records WHICH identity). This ONE type covers status + limits now and future cancel/role/plan mutations with no further contract migration.
2. **InmoView (`apps/api`) — emit `AUDIT_LOGGED`.** At the two existing emit sites — `PrismaAdminTenantStatusRepository.updateTenantStatus` and `PrismaAdminTenantLimitsRepository.updateTenantLimits` — emit one `AUDIT_LOGGED` via `PlatformOutboxWriter.emit()` inside the SAME `$transaction` as the mutation. Both sites already have the `CommandActor` and the old→new delta in scope. Status keeps its existing `TENANT_STATUS_CHANGED` emit (tenant-registry depends on it); limits gains its first outbox emit.
3. **viewpro-api — `platform_audit_log` projection.** New append-only model in `viewpro_platform` (`sourceEventId (unique), action, tenantId, actor Json, previousValue Json, newValue Json, occurredAt, seqNo`) + additive migration. Insert is idempotent on `sourceEventId` (re-delivery safe).
4. **viewpro-api — ingest routing.** Add an explicit `AUDIT_LOGGED` case to `IngestService.routeToTenantProjection` (which silently skips unknown types) that appends to `platform_audit_log`. Existing `platform_mirror_events` append + cursor/seqNo semantics stay intact.
5. **viewpro-api — `GET /operators/audit`.** Operator `AuthGuard`, offset/limit (cap 200), newest-first, returns `{ total, items: [{ action, actor, tenantId, previousValue, newValue, occurredAt }] }` from `platform_audit_log` only.
6. **viewpro-web — `features/audit`.** New feature following the established `api/{types,schemas,service,queries}.ts` + components split (mirrors `features/tenants` / `features/metrics`): a single global, paginated, chronological audit feed (actor, action, target tenant, timestamp, old→new), zod defensive parse, `AuthGuard`-gated.

### Out of scope
- Per-tenant audit history / any tenant-detail route (the existing `GET /operators/tenants` list stays as-is; no `:id` route added).
- Retention limit / purge (projection is unbounded, like `platform_mirror_events`).
- Reading `analytics_events` cross-DB (Design B forbids it — we EMIT, not read).
- New mutation *types* (only status + limits are audited now; the generic event is forward-compatible for future cancel/role/plan without new work here).
- Per-type outbox events (rejected — one generic `AUDIT_LOGGED` covers all).
- Adding an actor column to `platform_command_log` (idempotency ledger, not operator-read — left untouched).

## Capabilities

### New Capabilities
- `platform-audit-log`: the generic `AUDIT_LOGGED` event, the append-only `platform_audit_log` projection, its ingest routing case, `GET /operators/audit`, and the viewpro-web global audit feed.

### Modified Capabilities
- `platform-data-lane`: `PlatformOutboxEvent.eventType` union gains `AUDIT_LOGGED`; `IngestService.routeToTenantProjection` gains an explicit routing case for it.

## 3. Approach & rationale

Reuse the exact Phase 6 / tenant-registry data lane — `PlatformOutboxWriter`, `PlatformDataPollJob`, `IngestService.routeToTenantProjection`, `MirrorRepository`, the service-token + operator `AuthGuard` patterns — with **no new pull endpoint**. The change-feed producer (`findSince` by `seqNo`) is event-type-agnostic, so only ingest must learn to route the new type. One generic `AUDIT_LOGGED` event (vs. per-type events) is the locked choice: it audits status + limits today and future mutations with zero further contract migrations, and loose-JSON `previousValue`/`newValue` is acceptable for a display-only trail. Widening `eventType` to include `AUDIT_LOGGED` and appending a new projection is additive and backward-compatible; the only hard requirement is that viewpro-api can **ingest `AUDIT_LOGGED` before InmoView first emits it** → coordinated deploy (§6). Design B isolation is preserved absolutely — the actor+delta reach viewpro-web only through the emitted event, never through a cross-DB read of `analytics_events`.

## 4. Acceptance criteria

1. A status change emits exactly one `AUDIT_LOGGED` event **in the same `$transaction`** as the mutation (rollback ⇒ no audit row — matches the `TENANT_REGISTERED` atomicity precedent). Its existing `TENANT_STATUS_CHANGED` emit is unaffected.
2. A limits change emits exactly one `AUDIT_LOGGED` event **in the same `$transaction`** as the mutation (limits' first-ever outbox emit).
3. Each event carries `actor` (operator vs user — WHICH), `tenantId`, `action`, and `previousValue`/`newValue` (old→new).
4. viewpro-api ingest appends one `platform_audit_log` row per event; re-delivery is idempotent (unique `sourceEventId`).
5. `GET /operators/audit` returns the feed newest-first, offset/limit paginated (cap 200), shape `{ total, items }`, from `viewpro_platform` only.
6. `GET /operators/audit` is operator-only: 401 without a valid operator session.
7. viewpro-web renders a single global, paginated, chronological audit feed (actor, action, target tenant, timestamp, old→new).
8. Isolation preserved: no InmoView DB / `analytics_events` read anywhere in viewpro-api or viewpro-web.
9. `platform_mirror_events` append + cursor/seqNo semantics are unchanged for the new event type (it still lands in the raw mirror).
10. **No InmoView schema migration** (only new outbox rows — `platform_outbox_events` already exists). Only migration is `platform_audit_log` on `viewpro_platform`.

## 5. Migrations & deploy

- **viewpro-api** (`viewpro_platform`): additive `CREATE TABLE platform_audit_log` — low risk; rollback = drop.
- **InmoView**: NO schema migration — `platform_outbox_events` already exists; `AUDIT_LOGGED` is only new rows.
- **Coordinated deploy (ordered).** (1) ship platform-contract union member `AUDIT_LOGGED`; (2) deploy viewpro-api tolerant ingest (explicit `AUDIT_LOGGED` case) + `platform_audit_log` migration; (3) deploy InmoView emit at both status + limits sites. Ingest MUST tolerate the new type before InmoView emits it. FE (`features/audit`) is additive and ships last / independently.

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — contract rollout ordering: producer (`apps/api`) and consumer (`viewpro-api`) share the `platform-contract` union | Med | Union addition + new event are additive/backward-compatible; deploy consumer-tolerant ingest before producer emit (§5). |
| R2 — `IngestService.routeToTenantProjection` silently skips unknown types | Med | Add an explicit `AUDIT_LOGGED` case or events mirror-only and never project; covered by acceptance #4/#9. |
| R3 — actor identity shape (operator vs InmoView-admin `user`) | Med | Audit records `actor.type` + id explicitly so the feed shows WHICH identity acted; both sites already hold the `CommandActor`. |
| R4 — loose JSON `previousValue`/`newValue` typing | Low | Display-only trail; JSON columns store the delta verbatim; FE zod-parses defensively and renders as old→new text. |
| R5 — live mutation-path touch: emit inside the status + limits txns | Med | Additive emit inside the existing `$transaction`; rollback ⇒ no event; outbox table already exists. |

## 7. Rollback

Revert InmoView emit at both sites (stops new events); revert the ingest `AUDIT_LOGGED` case (falls back to unknown-type skip — events still land in `platform_mirror_events`); drop `platform_audit_log` in viewpro-api; drop `features/audit` in viewpro-web. platform-contract union revert is additive-safe. No data loss (projection is derived from the outbox/mirror).

## 8. Likely chained-PR split

Mirrors the tenant-registry slice, additive-safe at each step:
1. **PR1 — contract + emit**: `AUDIT_LOGGED` union member + both InmoView emit sites (status enriched-emit + limits first-emit).
2. **PR2 — viewpro-api projection + endpoint**: `platform_audit_log` migration, ingest routing case, `GET /operators/audit`.
3. **PR3 — viewpro-web feed**: `features/audit` global paginated feed.

## 9. Open sub-questions for spec/design

1. `action` value vocabulary — enum (`TENANT_STATUS_CHANGED` / `TENANT_LIMITS_UPDATED`) vs free string; how the FE labels each.
2. `platform_audit_log` sort key for newest-first — `occurredAt` vs `seqNo` (tie-break/ordering guarantee under same-timestamp events).
3. Whether `AUDIT_LOGGED` also passes/needs the MirrorRepository W2 (`newStatus`) guard or is exempt (it has no `newStatus`).
4. Exact `actor` JSON shape and how viewpro-web resolves operator/user ids to a display label (id-only vs enriched).
5. Pagination default page size and whether a `tenantId` filter param is added now (feed is global, but a filter is cheap to allow).

## 10. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
