# Proposal: Platform Phase 7 Slice 2 — Sub-slice A — Tenant Registry (backend)

**Change id**: `platform-phase7-tenant-registry`
**Store**: `openspec/changes/platform-phase7-tenant-registry/proposal.md` (+ Engram `sdd/platform-phase7-tenant-registry/proposal`)
**Phase**: 7, slice 2, sub-slice A (backend prerequisite for the operator tenant-management UI in Sub-slice B).
**Grounded in**: explore #5833; Phase 6 data-lane proposal (`platform-phase6-data-lane`); code read of the outbox/mirror/ingest/registration paths.

---

## 1. Intent

**Problem / why now.** The operator console (viewpro-web) needs a **complete tenant list** with name, slug, status and limits, served from `viewpro_platform` with zero reads of InmoView's DB (Design B). Today the mirror only ingests `TENANT_STATUS_CHANGED`, so tenants that never changed status are invisible, and no name/slug/limits are stored. There is no `GET /operators/tenants`. Sub-slice B (the UI) cannot be built until this registry exists.

**Success.** Registering a tenant in InmoView produces a `platform_tenants` row in viewpro-api (via a new event in the same tx); a status change updates it; existing tenants are backfilled once; and `GET /operators/tenants` (operator-only) returns the full paginated list — all from `viewpro_platform`.

---

## 2. Scope

### In scope
1. **platform-contract (`data/`).** Add `TENANT_REGISTERED` event type; widen `PlatformOutboxEvent.eventType` to the union of both types. Enrich `TenantStatusChangedPayload` with additive `name` + `slug`. `TENANT_REGISTERED` payload: `{ id, name, slug, newStatus (=initial status, e.g. TRIAL), limits }`. `newStatus` is REQUIRED so it passes the existing MirrorRepository **W2 guard** (skips empty `newStatus`). `limits` = `{ maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb }` (InmoView stores these as 3 flat `Int?` columns, not a Json blob).
2. **InmoView (`apps/api`) — emit `TENANT_REGISTERED`.** In `PrismaAuthRegistrationRepository.registerTenant` (the `$transaction` that creates user+tenant+membership — NOT the use-case, which owns no tx), emit the event carrying the new tenant's id/name/slug/initial status/limits. Widen `PlatformOutboxWriter` `OutboxEventInput` to the union of both event types.
3. **InmoView — enrich `TENANT_STATUS_CHANGED`.** Expand the `SELECT ... FOR UPDATE` in `PrismaAdminTenantStatusRepository` (currently `id, status, updatedAt`) to also read `name, slug`, and pass them into the outbox emit payload (additive).
4. **viewpro-api — `PlatformTenant` projection.** New model in `viewpro_platform` (`id, name, slug, latestStatus, limits Json?, updatedAt`) + additive migration. Idempotent upsert on `id`.
5. **viewpro-api — ingest routing.** `mirror.repository.ts` / `ingest.service.ts` branch on `eventType`: on `TENANT_REGISTERED` upsert full identity + limits; on `TENANT_STATUS_CHANGED` update `latestStatus` (+ name/slug when present). Keep the existing `platform_mirror_events` append (metrics) intact.
6. **viewpro-api — `GET /operators/tenants`.** Operator `AuthGuard`, paginated, returns `{ total, items: [{ id, name, slug, status, limits }] }` from `platform_tenants`.
7. **Backfill (one-time, idempotent).** See §5.

### Out of scope
- FE tenant-management UI (Sub-slice B).
- `TENANT_LIMITS_CHANGED` event. Limits reflect last registration; the FE refreshes them optimistically after a confirmed limits `PATCH`.
- Retiring `/admin` reads; new event types beyond the two above.

## Capabilities

### New Capabilities
- `tenant-registry`: the `TENANT_REGISTERED` event, the `platform_tenants` projection, event-routed ingest, and the operator-only `GET /operators/tenants` list.

### Modified Capabilities
- `platform-data-lane`: `TENANT_STATUS_CHANGED` payload gains additive `name`/`slug`; ingest routes by `eventType`.

## 3. Approach & rationale

**Option B (event-driven + backfill)** delivers a COMPLETE list. `TENANT_REGISTERED` in the registration tx guarantees every future tenant appears; a one-time backfill covers pre-existing tenants. The change-feed producer (`findSince` by `seqNo`) is event-type-agnostic — no producer-endpoint change; only ingest must learn to route the new type. Widening `eventType` to a union and adding additive payload fields is backward-compatible (JSON payload); the only hard requirement is that viewpro-api can **ingest `TENANT_REGISTERED` before/when InmoView first emits it** → coordinated deploy (§6 R2).

## 4. Acceptance criteria

1. Registering a tenant in InmoView emits `TENANT_REGISTERED` **in the same tx** as user+tenant+membership creation (rollback ⇒ no event).
2. viewpro-api ingest upserts a `platform_tenants` row from that event (id/name/slug/latestStatus/limits); re-delivery is idempotent (upsert on id).
3. A status change updates `latestStatus` (+ name/slug when present) on the same row.
4. `GET /operators/tenants` lists the tenant with name/slug/status/limits, paginated (`{ total, items }`), from `viewpro_platform` only.
5. `GET /operators/tenants` is operator-only: 401 without a valid operator session.
6. Backfill populates all pre-existing tenants **once**, idempotently.
7. **No InmoView schema migration** (only new outbox rows — the `platform_outbox_events` table already exists). Only migration is `platform_tenants` on `viewpro_platform`.
8. Existing metrics (`platform_mirror_events` / `GET /operators/metrics/summary`) and `/admin` are unaffected.

## 5. Backfill approach (chosen)

**Chosen: viewpro-api seed script calling a new InmoView internal endpoint** — least-invasive and correct.
- Add `GET /internal/platform/tenants` in InmoView behind the existing `PlatformControlGuard` (Phase 5 service-token trust, reused) that streams all tenants (id/name/slug/status/limits).
- A viewpro-api seed script mints a service token, pulls the list once, and upserts into `platform_tenants` (idempotent on id).
- **Rejected: direct-DB migration** — a viewpro-api migration cannot read InmoView's DB (Design B violation); a raw cross-DB SQL insert would couple the two databases and bypass the trust seam. The seed reuses the existing control-lane trust, stays one-time, and is safely re-runnable.

## 6. Migrations & deploy

- **viewpro-api** (`viewpro_platform`): additive `CREATE TABLE platform_tenants` — low risk; rollback = drop.
- **InmoView**: NO schema migration — confirmed. `platform_outbox_events` already exists; `TENANT_REGISTERED` is only new rows.
- **Coordinated deploy (ordered).** (1) ship platform-contract union + additive fields; (2) deploy viewpro-api ingest routing (can handle `TENANT_REGISTERED` — unknown-type-safe) + `platform_tenants` migration; (3) deploy InmoView emit of `TENANT_REGISTERED`/enriched payload; (4) run the backfill seed once. Ingest MUST tolerate the new type before InmoView emits it.

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — live registration-path touch: emit in the tenant-creation tx | Med | Additive emit inside the existing `$transaction`; rollback ⇒ no event; guarded by the outbox table already existing. |
| R2 — `pg_advisory_xact_lock(OUTBOX_LOCK_KEY)` contention now on the registration path (previously admin-only) | Low | Acceptable at low registration volume; lock is xact-scoped, auto-released at commit. Call out explicitly. |
| R3 — coordinated deploy ordering | Med | Deploy ingest (unknown-type-safe) before InmoView emit; §6 sequence. |
| R4 — backfill correctness / double-run | Low | Idempotent upsert on id; one-time seed; safe to re-run. |
| R5 — W2 guard / event routing regression | Med | `TENANT_REGISTERED` carries `newStatus` (=initial status) so it passes W2; branch on `eventType`; keep `platform_mirror_events` append intact. |

## 8. Rollback

Revert InmoView emit (stops new events) and the internal tenants endpoint; drop `platform_tenants` in viewpro-api; revert ingest routing (falls back to status-only mirror). platform-contract union revert is additive-safe. No data loss (projection is derived).

## 9. Open sub-questions for spec/design

1. Pagination contract: offset/limit vs cursor; default page size; sort order (name vs updatedAt).
2. `PlatformTenant.limits` shape in Json — mirror the 3 flat fields exactly, or a normalized `{ maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb }` object.
3. Should `TENANT_STATUS_CHANGED` upsert create a `platform_tenants` row if missing (for tenants that predate registry but change status before backfill), or only update?
4. Exact `eventType` union placement in the contract and the compile-time equality assertion vs the Prisma outbox column.
5. Backfill seed lifecycle: standalone script vs Nest command; how "run once" is enforced (idempotent upsert makes re-runs harmless — is an explicit guard needed?).
6. Internal `GET /internal/platform/tenants` shape/pagination and whether it streams or returns a bounded batch.

## 10. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
