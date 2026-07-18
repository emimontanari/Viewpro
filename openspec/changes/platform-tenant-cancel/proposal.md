# Proposal: Tenant CANCELLED lifecycle (vision D6)

**Change id**: `platform-tenant-cancel`
**Store**: `openspec/changes/platform-tenant-cancel/proposal.md` (+ Engram `sdd/platform-tenant-cancel/proposal`)
**Grounded in**: explore #5889 (verified against `platform-foundation` worktree, `viewpro-app/`); vision decision D6.

---

## 1. Intent

**Problem / why now.** Vision D6 draws a hard line: **SUSPENDED ≠ CANCELLED**. Suspend = access cut, data kept, reversible. Cancel = terminal ("leaves for good"), data archived/deleted eventually. Today the operator console only does `ACTIVE ⇄ SUSPENDED`; the status write path rejects `CANCELLED` with 400, so an operator has **no way to end a tenant's lifecycle**. Real workflows need it: a tenant explicitly leaves, or an abandoned/spam trial must be closed out.

**Success.** An operator cancels any non-terminal tenant (ACTIVE, SUSPENDED, TRIAL) from the viewpro-web console → 200, `platform_tenants.latestStatus = CANCELLED`, access is cut, the action is audited. CANCELLED becomes a **real server-side terminal state** — any `CANCELLED → *` transition is rejected 400.

---

## 2. Scope

### In scope
1. **Domain gate + terminality (`apps/api`).** `AdminTenantStatusService` — the single authoritative gate shared by both InmoView-side controllers (`/admin/tenants/:id/status` + `/internal/platform/tenants/:id/status`). Add `CANCELLED` to `ALLOWED_TARGET_STATUSES`, AND add a **current-status pre-check**: if the tenant is already `CANCELLED`, reject with `BadRequestException` (terminality — genuinely new behavior; today only the target is validated, never the current status).
2. **viewpro-api control lane.** Widen `set-tenant-status.dto.ts` `@IsIn(['ACTIVE','SUSPENDED'])` → include `CANCELLED`; update its docstring.
3. **viewpro-web FE.** Widen `TenantStatusAction` type (`api/types.ts`); add a `CANCELLED` action for non-cancelled rows in `getTenantAction()`; render a **distinct destructive Cancel confirmation** (stronger, "cannot be undone" framing) separate from the lighter suspend copy; CANCELLED rows show **zero** status actions.

### Out of scope (explicitly deferred)
- **Data archival / deletion / PII retention.** D6's "eventually archived/deleted" has zero existing machinery. This slice is status transition + access-cut + audit only. **Flagged as a required follow-up.**
- **Step-up re-auth for destructive actions (vision A3).** A separate hardening slice. Cancel ships without it for now — known deferred reinforcement.
- **Legacy `apps/app-new/src/app/admin` console.** Stays capped at ACTIVE/SUSPENDED — dead-end safe (its DTOs already reject CANCELLED via the shared service gate). The platform-split exists to migrate `/admin` out of InmoView; touching it is throwaway.

### No change needed (verified)
- **Access-cut** — `tenant-membership.guard.ts` already blocks SUSPENDED and CANCELLED identically ("Tenant is not active"); enforcement was built ahead of the write path.
- **Audit/outbox** — cancel reuses the existing status-change transaction, auto-emitting `TENANT_STATUS_CHANGED` (→ projection) and `AUDIT_LOGGED` (`action=TENANT_STATUS_CHANGED`, `previous→CANCELLED`) with zero extra code.
- **Data lane / metrics** — `routeToTenantProjection` and `byStatus` handle any status string; CANCELLED flows through untouched.
- InmoView-side DTOs (`@IsEnum(TenantStatus)`) already accept CANCELLED.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `admin-tenant-status` (`apps/api`): allowed target statuses gain `CANCELLED`; new terminality invariant — any transition FROM `CANCELLED` is rejected 400.
- `platform-control-lane-outbound` (`viewpro-api`): operator status DTO accepts `CANCELLED` as a target.
- `operator-tenant-management-ui` (`viewpro-web`): destructive Cancel action + distinct confirmation for non-terminal tenants; no status actions for CANCELLED tenants.

## 3. Approach & rationale

Mostly a **backend-domain widen + a small FE add**, reusing the audit/outbox path entirely. The natural extension point for terminality is a repo/service-level current-status pre-check right next to `ALLOWED_TARGET_STATUSES` — FE button-hiding is not a security gate (`GlobalAdminGuard`/`PlatformControlGuard` are the only real boundaries), so the invariant MUST live server-side. Source states allowed to reach CANCELLED: **any non-terminal state** (ACTIVE, SUSPENDED, TRIAL) — no forced suspend-first step.

## 4. Acceptance criteria

1. Operator cancels an ACTIVE / SUSPENDED / TRIAL tenant → **200**; `platform_tenants.latestStatus` becomes `CANCELLED` in the projection.
2. Access is cut for that tenant's members (existing `tenant-membership.guard.ts`, no change).
3. The cancel is audited: `AUDIT_LOGGED` with `action=TENANT_STATUS_CHANGED`, `previous → CANCELLED`.
4. **Terminality**: `CANCELLED → ACTIVE` (and `→ SUSPENDED`, any target) is rejected **400 server-side**, paired with a **regression test**.
5. FE shows a **distinct destructive Cancel confirmation** (stronger than suspend) for non-cancelled tenants; a CANCELLED tenant shows **no further status actions**.
6. Legacy `apps/app-new` admin console is unchanged and still safely capped at ACTIVE/SUSPENDED.
7. **No data is archived or deleted.**

## 5. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — terminality is genuinely NEW behavior (no transition validation exists today) | Med | Server-side current-status pre-check + a regression test asserting `CANCELLED → ACTIVE` now returns 400. |
| R2 — duplicate console surfaces (`app-new/admin` vs `viewpro-web/tenants`) could drift | Low | Accepted: viewpro-web only; app-new stays capped, zero-risk via shared service gate. |
| R3 — destructive action ships without step-up re-auth (vision A3) | Med | Deferred to a dedicated hardening slice; flagged, not silently dropped. |
| R4 — metrics `byStatus` bucket / projection mishandle CANCELLED | Low | Verified generic (no special-casing); no code change needed. |
| R5 — PII/data-retention obligation left unmet by "cancel" | Med | Explicitly out of scope; surfaced as a required follow-up slice. |

## 6. Rollback

Revert the three widen sites (`ALLOWED_TARGET_STATUSES` + terminality pre-check, viewpro-api DTO, viewpro-web type/action/dialog). All additive and reversible; no migration, no data mutation (projection is derived). CANCELLED simply returns to being rejected at the write path.

## 7. Dependencies

- None new. Reuses the shipped status-change transaction, audit/outbox path, membership guard, and data-lane projection.

## 8. Delivery note

Likely small. Best split as **1–2 chained PRs**: (1) backend gate widen + terminality invariant + regression test; (2) viewpro-web cancel action + distinct destructive confirmation. Decide the final split at `sdd-tasks`.

## 9. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
