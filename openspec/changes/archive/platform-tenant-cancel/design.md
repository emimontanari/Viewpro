# Design: Tenant CANCELLED lifecycle (vision D6)

Widen the single authoritative status gate (`AdminTenantStatusService.ALLOWED_TARGET_STATUSES`) to accept `CANCELLED`, add a genuinely new **terminality invariant** (any transition FROM `CANCELLED` → 400) enforced atomically inside the existing row-locked repository transaction, widen the viewpro-api operator DTO, and extend the viewpro-web console with a distinct destructive Cancel confirmation. No new events, no contract change, no migration. Paths under `viewpro-app/`.

## Technical Approach

Reuse the shipped status-change pipeline end to end. The only new behavior is the terminality check, which must read the current status **atomically** — so it lives in `PrismaAdminTenantStatusRepository` right after the `SELECT … FOR UPDATE` fetch, expressed as a new result variant (`terminal`) that the service maps to `BadRequestException`, mirroring the existing `notFound → NotFoundException` convention. Audit (`AUDIT_LOGGED`), registry (`TENANT_STATUS_CHANGED`), projection, and metrics all flow unchanged because `CANCELLED` is just another status string to them (verified, D4).

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Terminality placement | Repository: after the `FOR UPDATE` fetch, `if (tenant.status === 'CANCELLED') return { status: 'terminal', … }`; service maps it to `BadRequestException('Cancelled tenant cannot change status')` | (a) service pre-read of current status; (b) repo throwing the HTTP exception directly | (a) needs an extra non-locked query — TOCTOU race with a concurrent cancel. (b) breaks the layer convention: the repo returns discriminated results (`notFound`/`unchanged`/`updated`), the SERVICE owns HTTP mapping. The locked row gives atomic read-check-write for free |
| D2 | Check ordering | `terminal` check BEFORE the `unchanged` check | keep `unchanged` first | `CANCELLED → CANCELLED` must be 400 (terminal beats `unchanged: true`) — a terminal tenant produces no 200 of any kind |
| D3 | 400 propagation | No code needed — verified chain: service 400 → `applyWithIdempotency` rolls back the tx (idempotency key NOT burned) and rethrows non-P2002 → Nest filter emits 400 JSON → `PlatformControlClient.post` throws `HttpException(safeBody, response.status)` preserving 400 (client lines 126–141) → viewpro-api filter → operator 400 → FE `ApiError{status:400, message}` toasted via `getApiErrorMessage` | trusting it blindly | Each hop was read and confirmed; the client comment explicitly exists to avoid collapsing downstream statuses to 500 |
| D4 | Contract/outbox/projection/metrics | ZERO change | widening contract types | Verified: `PlatformTenantStatus` already includes `CANCELLED`; outbox payloads carry plain status strings; `metrics.service.ts` `byStatus` is a generic `Record<string, number>` keyed by `newStatus`; projection upsert is status-agnostic; W2 guard only checks non-empty `newStatus` |
| D5 | Operator DTO widen | `@IsIn(['ACTIVE','SUSPENDED','CANCELLED'])` + docstring update in viewpro-api `set-tenant-status.dto.ts` | `@IsEnum` | Keep the explicit allow-list style; `TRIAL` remains rejected locally as a write target |
| D6 | FE action mapping | Refactor `getTenantAction` → `getTenantActions(item): TenantAction[]` — `[toggle, cancel]` for TRIAL/ACTIVE/SUSPENDED, `[]` for CANCELLED | separate `getTenantCancelAction()` helper | One function stays the single source of truth for "CANCELLED has zero actions"; the table maps the array to buttons |
| D7 | Confirm dialog | Reuse-with-variant: `TenantStatusConfirmDialog` gains a `variant: 'suspend' \| 'cancel'` prop driving a copy map + destructive action styling for cancel (es-AR, permanent framing: "no se puede deshacer") | new `TenantCancelConfirmDialog` | The dialogs differ only in copy/styling; a variant keeps the Escape/pending in-flight gating single-sourced and the container keeps ONE pending state, widened to `{ tenant, targetStatus }` |
| D8 | Legacy `/admin` side effect | Accept: InmoView's legacy `PATCH /admin/tenants/:id/status` (DTO `@IsEnum(TenantStatus)`) implicitly gains cancel once the shared gate widens; the app-new FE has no cancel button and is untouched | special-casing the legacy lane | Same authoritative gate + `GlobalAdminGuard`-trusted callers; special-casing would fork the invariant the platform-split is retiring |

## Data Flow

    viewpro-web: getTenantActions → cancel button → confirm dialog (variant='cancel')
      statusMutation { status:'CANCELLED' }
    → PATCH /operators/tenants/:id/status  (viewpro-api, DTO @IsIn widened — D5)
    → PlatformControlClient.postTenantStatus → POST /api/internal/platform/tenants/:id/status
    → PlatformControlController.applyWithIdempotency ($transaction)
    → AdminTenantStatusService: ALLOWED_TARGET_STATUSES (now incl. CANCELLED)
    → PrismaAdminTenantStatusRepository (same tx):
        SELECT … FOR UPDATE
        status === CANCELLED → return 'terminal'   ← NEW (D1/D2, before 'unchanged')
        else update → analyticsEvent → emit TENANT_STATUS_CHANGED → emit AUDIT_LOGGED
    ← 'terminal' → BadRequestException → tx rollback → 400 → HttpException(400) → FE toast (D3)
    ← 'updated' → 200 → projection latestStatus=CANCELLED → membership guard cuts access (no change)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/admin/admin-tenant-status.repository.ts` | Modify | Add `terminal` variant to `UpdateAdminTenantStatusResult` |
| `apps/api/src/admin/prisma-admin-tenant-status.repository.ts` | Modify | Terminal check after `FOR UPDATE` fetch, before `unchanged` (D1/D2) |
| `apps/api/src/admin/admin-tenant-status.service.ts` | Modify | `ALLOWED_TARGET_STATUSES` += `TenantStatus.CANCELLED`; map `terminal` → `BadRequestException` |
| `apps/viewpro-api/src/platform-control/dto/set-tenant-status.dto.ts` | Modify | `@IsIn` + type + docstring gain `CANCELLED` (D5) |
| `apps/viewpro-web/src/features/tenants/api/types.ts` | Modify | `TenantStatusAction` += `'CANCELLED'`; comment update |
| `apps/viewpro-web/src/features/tenants/components/tenants-table.tsx` | Modify | `getTenantActions()` array (D6); render cancel button (destructive) per non-CANCELLED row |
| `apps/viewpro-web/src/features/tenants/components/tenant-status-confirm-dialog.tsx` | Modify | `variant` prop + cancel copy map (D7) |
| `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx` | Modify | Pending state → `{ tenant, targetStatus }`; gate SUSPENDED and CANCELLED behind the dialog; mutation input widened |

Legacy `apps/app-new` untouched (D8). No InmoView internal DTO change (`@IsEnum` already accepts CANCELLED).

## Interfaces / Contracts

No contract-package, outbox, projection, or metrics change (D4). Only widened literal unions above.

## Testing Strategy

| Layer | What (spec scenario) | Approach |
|-------|----------------------|----------|
| Unit (api) | Service: CANCELLED accepted as target; `terminal` result → 400 | vitest, repo stub |
| Unit (api) | Repo: CANCELLED row → `terminal` before `unchanged` (CANCELLED→CANCELLED = terminal, not unchanged) | vitest, mocked tx |
| Unit (api) | AUDIT_LOGGED `previousValue.status` = real prior status (from locked row) on cancel | vitest, emit spy |
| Integration (api) | `POST /internal/platform/tenants/:id/status` CANCELLED from ACTIVE/SUSPENDED/TRIAL → 200; `CANCELLED → *` → 400 (regression, R1); idempotency row rolled back on 400 | supertest + test DB |
| Unit (viewpro-api) | DTO accepts CANCELLED, still rejects TRIAL; downstream 400 passthrough stays 400 | vitest/supertest |
| Unit (web) | `getTenantActions`: cancel action for TRIAL/ACTIVE/SUSPENDED; `[]` for CANCELLED; cancel gated behind variant='cancel' dialog; 400 message surfaced as toast | vitest + RTL |
| Regression | Membership guard still 403s CANCELLED tenants; metrics `byStatus` includes `CANCELLED` bucket | existing suites + one assertion each |

## Threat Matrix

N/A — no new routing, shell, subprocess, VCS/PR automation, or process-integration boundary. The change widens values on an existing guarded lane; token trust and endpoints are untouched.

## Migration / Rollout

No migration. Deploy order: backend PR first (`apps/api` gate + terminality + `viewpro-api` DTO), then viewpro-web PR — the FE cancel button 400s without the DTO widen. Rollback: revert the three widen sites; CANCELLED returns to being rejected at the write path; no data mutation.

## Open Questions

- [ ] Final es-AR cancel copy — button label should avoid colliding with the dialog's dismiss "Cancelar" (suggest button "Cancelar inquilino", confirm action "Cancelar definitivamente").
- [ ] Whether the `terminal` result variant should carry `currentStatus`/`updatedAt` for logging parity with `unchanged` (recommend yes, cheap and symmetric).
