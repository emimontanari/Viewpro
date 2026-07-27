# Proposal: Platform Phase 5 — /admin WRITE commands over the CONTROL lane (backend-only)

Route tenant WRITE commands (status + limits) from `viewpro-api` to InmoView (`apps/api`) over the two-lane **control** seam: a signed service token, a new `PlatformControlGuard`, idempotent internal endpoints, and the operator (not a User) recorded as the audit actor. Operator triggers via `viewpro-api` HTTP for now — **no `viewpro-web` console**.

## Locked decisions (do NOT re-open)

- **Backend only.** No `viewpro-web`, no visual console. Operator calls `viewpro-api` HTTP endpoints directly.
- **WRITE-only migration.** Only tenant **status** + **limits** move to the control lane. READs (summary/tenants/activity) stay on `AdminController` → Phase 6. So `GlobalAdminGuard` only PARTIALLY retires.
- **Service trust ≠ user auth.** HS256 short-lived JWT signed by `viewpro-api` with `PLATFORM_CONTROL_SECRET`, verified by a NEW `PlatformControlGuard` in `apps/api`. MUST NOT share the user-JWT secret; populates `request.platformCaller` (`PlatformServiceIdentity`), never `request.user`.
- **Reuse contract + services.** Reuse `SetTenantStatusCommand`/`SetTenantLimitsCommand` from `@viewpro/platform-contract` (wire it as a dependency in both apps — first consumers). Reuse `AdminTenantStatusService` + `AdminTenantLimitsService` behind the new endpoints. Synchronous HTTP (NOT outbox). Operator authz is **binary** (any ACTIVE operator can command).

## Intent

Today `/admin` WRITEs run inside InmoView guarded by `GlobalAdminGuard`, DI-coupled to the product's `UsersRepository`, and stamp `AnalyticsEvent.actorUserId` with a product User. Under Design B, ViewPro must command tenant access from OUTSIDE the product DB, as a service, with the **operator** as the audit actor. Phase 5 replaces "reach into the product DB" with "call the product's own guarded internal endpoint" for these two commands.

## Scope

### In Scope
- `apps/api`: `PlatformControlModule` + `PlatformControlGuard` + two internal endpoints `POST /internal/platform/tenants/:id/status` and `.../limits`, mapping contract commands → existing services.
- `apps/api`: idempotency store (new table, e.g. `platform_command_log`) keyed on `idempotencyKey`; duplicate command rejected/short-circuited.
- `apps/api`: **additive live-DB migration** — nullable `AnalyticsEvent.actorOperatorId String?` (keep `actorUserId` + semantics intact); new `AnalyticsActorType.PLATFORM_OPERATOR`; both repos stamp the operator on control-lane writes.
- `viewpro-api`: control-lane HTTP client (mints the service token) + operator-facing endpoints (behind Phase 4 `AuthGuard`); new env `INMOVIEW_API_INTERNAL_URL`, `PLATFORM_CONTROL_SECRET`.
- Wire `@viewpro/platform-contract` as a dependency in both apps.
- Fold-in hardening (small): add `/admin` to `proxy.ts` `isProtectedAppPath`; viewpro-api auth JD follow-ups — throttler tracker keying + `trust proxy`, and force cookie `secure=true` when `NODE_ENV==='production'`.

### Out of Scope (defer)
- `viewpro-web` operator console (Phase 5+, deferred).
- Migrating `/admin` READs off `AdminController`; fully retiring `GlobalAdminGuard`; deleting the public `/admin` write routes → Phase 6.
- Platform-side audit record in ViewPro's OWN DB (blueprint §2.1 who/what/when) — InmoView records the applied change now; platform audit is Phase 6 data-lane scope.
- Outbox / data lane / metrics (Phase 6). Operator roles (binary authz only now).

## Capabilities

### New Capabilities
- `platform-control-lane-inbound` (`apps/api`): service-token-guarded internal WRITE endpoints + idempotency store; operator recorded as audit actor.
- `platform-control-lane-outbound` (`viewpro-api`): operator endpoints + control-lane client that mints the service token and calls InmoView.

### Modified Capabilities
- `admin-tenant-status` / `admin-tenant-limits` (`apps/api`): audit actor may now be an operator (`actorOperatorId`); write path reachable via the control lane in addition to `/admin`.

## Approach

`viewpro-api` exposes operator endpoints (Phase 4 `AuthGuard`); a control-lane client mints a short-lived HS256 JWT (`PLATFORM_CONTROL_SECRET`, distinct issuer/audience) and POSTs the contract command + `idempotencyKey` to InmoView's `/internal/platform/...`. `PlatformControlGuard` verifies the token, sets `request.platformCaller`, and never `request.user`. The endpoint records the `idempotencyKey` (reject duplicates), then delegates to the unchanged `AdminTenantStatusService`/`AdminTenantLimitsService`, passing operator identity so the repos stamp `actorOperatorId` + `PLATFORM_OPERATOR`. Services keep their existing `FOR UPDATE` transactional semantics.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/platform-control/**` | New | Module, guard, controller, idempotency store |
| `apps/api/prisma/schema.prisma` + migration | Modified (live DB) | Nullable `actorOperatorId`, new actor enum, idempotency table |
| `apps/api/src/admin/prisma-admin-tenant-*.repository.ts` | Modified | Stamp operator actor on control-lane writes |
| `apps/api/src/admin/*.service.ts` | Modified | Accept operator actor context |
| `apps/viewpro-api/src/platform-control/**` | New | Operator endpoints + control-lane client |
| `apps/viewpro-api/src/config/env.schema.ts` | Modified | `INMOVIEW_API_INTERNAL_URL`, `PLATFORM_CONTROL_SECRET` |
| both `package.json` | Modified | Add `@viewpro/platform-contract` |
| `apps/app-new/src/proxy.ts` | Modified | Guard `/admin` server-side |
| viewpro-api auth (throttler/create-app) | Modified | JD follow-ups: tracker keying, trust-proxy, prod cookie secure |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 (HIGH) live InmoView DB migration** — `AnalyticsEvent.actorUserId` FKs User; operator has no User row | High | ADDITIVE only: nullable `actorOperatorId` (no FK to User), keep `actorUserId` + rows untouched; deploy migration before app code; rollback = drop nullable column (no data loss) |
| Service-token leakage = full tenant-control access | Med | Short TTL, distinct secret/issuer/audience, never logged, transported server-to-server only; not a user cookie |
| Cookie/trust-model correctness (proxy IP, prod cookie) | Med | Fold-in JD hardening: trust-proxy + tracker keying + `secure=true` in prod |
| Live-DB migration ordering (code before column) | Med | Migration-first deploy; nullable column tolerates old + new writers |
| platform-contract type drift vs Prisma (`PlatformTenantStatus` ↔ `TenantStatus`) | Med | Add compile-time equality assertion in `apps/api` (Prisma dep present); guard writable-target set at runtime |
| Idempotency race (concurrent duplicate keys) | Low | Unique constraint on `idempotencyKey` + insert-first / conflict path |

## Rollback Plan

Additive across both apps. Rollback: revert `viewpro-api` operator endpoints + client (nothing dispatched), remove `PlatformControlModule` from `apps/api`, drop the idempotency table + nullable `actorOperatorId` column (no existing rows changed), remove the new enum value. Existing `/admin` write routes remain fully functional throughout — they are NOT removed this phase, so there is always a working fallback.

## Dependencies

- Phase 4 `viewpro-api` (`AuthGuard`, operator identity, env/config) — present.
- Phase 3 `@viewpro/platform-contract` — present, wired here (first consumers).
- Infra: `PLATFORM_CONTROL_SECRET` provisioned on both apps; `INMOVIEW_API_INTERNAL_URL` reachable server-to-server; InmoView `/internal/platform/*` NOT publicly routable.

## Success Criteria (acceptance)

- [ ] Operator calls `viewpro-api` (Phase 4 auth) → command reaches InmoView `/internal/platform/tenants/:id/{status,limits}` via a valid service token.
- [ ] Tenant status/limits mutate on the InmoView DB with existing transactional semantics.
- [ ] `AnalyticsEvent` records the **operator** actor (`actorOperatorId` + `PLATFORM_OPERATOR`); `actorUserId` stays null for these events.
- [ ] Duplicate `idempotencyKey` is rejected / does not double-apply.
- [ ] Invalid/missing/expired service token → 401/403; `request.user` never populated by `PlatformControlGuard`.
- [ ] The public `/admin` status + limits write routes are no longer NEEDED for these two actions (kept as fallback, not removed).
- [ ] `/admin` is guarded server-side by `proxy.ts`; viewpro-api prod cookie `secure=true`; throttler keys correctly behind proxy.

## Open sub-questions (deferred to spec/design)

1. **Idempotency scope/response**: is a key global or per-command-type? On duplicate, replay the stored prior result or return 409? TTL/retention of `platform_command_log`?
2. **Operator identity across the boundary**: does the token carry `operatorId` in `PlatformServiceIdentity.callerId`, so `actorOperatorId` = the real operator — or a single ViewPro service principal (losing per-operator attribution)? R1 audit fidelity depends on this.
3. **`actorOperatorId` referential integrity**: plain nullable String (operator lives in another DB, no FK) vs. soft reference + validation. Confirm no cross-DB FK.
4. **Writable-target policy location**: keep `ACTIVE|SUSPENDED` allow-set in the service, or also assert in the guard/endpoint? Contract intentionally does not narrow it.
5. **Token transport**: `Authorization: Bearer` vs. a custom header; issuer/audience claim values; clock-skew tolerance for short TTL.
6. **Endpoint verb**: internal `POST` (command) vs. mirror `/admin` `PATCH`. Proposal assumes `POST` per blueprint §2.1.
