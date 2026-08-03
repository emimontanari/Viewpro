# Design: Platform Phase 5 — /admin WRITE commands over the CONTROL lane

Route tenant status + limits WRITEs from `viewpro-api` (operator, Phase 4 `AuthGuard`) to InmoView (`apps/api`) over a signed service-token seam. A new `PlatformControlModule` in `apps/api` exposes idempotent internal endpoints guarded by a NEW `PlatformControlGuard`, reuses the existing `AdminTenantStatusService`/`AdminTenantLimitsService`, and stamps the OPERATOR (not a User) as the audit actor. All paths below are under `viewpro-app/`.

## Technical Approach

`viewpro-api` operator endpoints → `PlatformControlClient` mints a short-lived HS256 JWT (`PLATFORM_CONTROL_SECRET`, distinct issuer/audience, `sub`=operatorId) → `POST INMOVIEW_API_INTERNAL_URL/internal/platform/tenants/:id/{status,limits}` with the `@viewpro/platform-contract` command + `idempotencyKey`. In `apps/api`, `PlatformControlGuard` verifies the Bearer token, sets `request.platformCaller` (never `request.user`), the controller records the key in `platform_command_log` (replay short-circuit), then delegates to the unchanged services passing an operator actor. Repos stamp `actorOperatorId` + `PLATFORM_OPERATOR`. Sync HTTP, no outbox; binary operator authz.

## Architecture Decisions

### Service token (isolation of trust)

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Alg / secret | HS256, `PLATFORM_CONTROL_SECRET` — SEPARATE from `ACCESS_TOKEN_SECRET` in BOTH apps | A user cookie JWT and a service JWT are cryptographically non-interchangeable; leaking one grants nothing on the other lane |
| Claims | `iss:"viewpro-api"`, `aud:"inmoview-control"`, `sub`=operatorId (=`callerId`), `jti`=tokenId, short `exp` | `aud`/`iss` pinned so a user token (no such claims) can never satisfy the guard; `sub` carries per-operator attribution |
| TTL | 120s (clock-skew tolerance 30s) | Minted per request, server-to-server; short window limits replay if intercepted |
| Transport | `Authorization: Bearer <jwt>` | Standard; never a cookie, never logged |
| Populates | `request.platformCaller: PlatformServiceIdentity`, NEVER `request.user` | Guard cannot accidentally grant product-user authorization |

**Alternatives**: shared user secret (rejected — token confusion); custom header (rejected — Bearer is conventional); long-lived key (rejected — leak = standing tenant control).

### Per-operator audit actor — additive live-DB migration (R1, HIGH)

**Choice**: nullable `AnalyticsEvent.actorOperatorId String?` (NO FK — operator lives in the `viewpro_platform` DB, cross-DB FK impossible) + new enum value `AnalyticsActorType.PLATFORM_OPERATOR`. `actorUserId` stays null for control-lane events; existing rows/semantics untouched. **Alternatives**: reuse `actorUserId` with a synthetic User (rejected — pollutes User table, breaks FK meaning); soft-ref validation table (rejected — operator identity is not authoritative in this DB). **Rationale**: additive + nullable tolerates old and new writers; rollback = drop column, zero data loss.

### Idempotency store + replay

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Table | new `platform_command_log` in `apps/api` | Local to the DB where the effect lands; atomic with the write txn |
| Key scope | UNIQUE on `idempotencyKey` (global, not per-command-type) | Contract keys are opaque/unique; simplest correct scope |
| Replay | return the STORED original result with **200** (not 409, not double-apply) | Retries are expected; caller wants the effect's outcome, not an error |
| Insert order | INSERT key first inside the service txn; on unique conflict, return stored result | Insert-first closes the concurrent-duplicate race |
| Retention | store `result` JSON + `createdAt`; TTL cleanup (e.g. 30d) is an ops follow-up, not runtime-critical | Log is an idempotency ledger, not audit-of-record |

### Reuse services with an operator actor

**Choice**: widen the service input actor from `actorUserId: string` to a discriminated `actor: { type:'user'; userId } | { type:'operator'; operatorId }`, threaded to the repo which stamps `actorType` + the matching id column. `/admin` controller passes `{type:'user'}`; control endpoints pass `{type:'operator'}`. **Alternatives**: second service method (rejected — duplicates txn/`FOR UPDATE` logic); keep `actorUserId` + add `actorOperatorId` param (rejected — two nullable params invite illegal states). **Rationale**: one txn path, illegal actor states unrepresentable, existing behavior preserved.

### platform-contract wiring + type drift

**Choice**: add `"@viewpro/platform-contract":"workspace:*"` to BOTH apps' `package.json` (first consumers); pnpm workspace + turbo task-globs pick it up (verify only). In `apps/api`, add a compile-time equality assertion `PlatformTenantStatus` ↔ Prisma `TenantStatus`, and validate the writable-target set (`ACTIVE|SUSPENDED`) at runtime in the service (already present). **Rationale**: contract deliberately does not narrow status; product owns the runtime allow-set.

## Data Flow

    Operator ──(viewpro_platform_access_token cookie, AuthGuard)──▶ viewpro-api
       PATCH /operators/tenants/:id/{status,limits}
          │
       PlatformControlClient.signToken({iss,aud,sub=operatorId,jti,exp+120s})
          │  Authorization: Bearer <jwt>  +  { command, idempotencyKey }
          ▼
    apps/api  POST /internal/platform/tenants/:id/{status,limits}
       PlatformControlGuard.verify → request.platformCaller {callerId=operatorId, tokenId=jti}
          │
       PlatformControlController → platform_command_log INSERT (key) ──conflict──▶ 200 stored result
          │ (new)
       AdminTenantStatusService / AdminTenantLimitsService  (unchanged logic)
          │  actor = { type:'operator', operatorId: platformCaller.callerId }
       Prisma repo  (FOR UPDATE txn) → tenant.update + AnalyticsEvent
          {actorOperatorId, actorType: PLATFORM_OPERATOR, actorUserId: null}

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/platform-control/platform-control.module.ts` | Create | Wires guard, controller, idempotency store; imports AdminModule providers/services |
| `apps/api/src/platform-control/platform-control.guard.ts` | Create | Verify HS256 service JWT (own secret, iss/aud/exp); set `request.platformCaller` |
| `apps/api/src/platform-control/platform-control.controller.ts` | Create | `POST /internal/platform/tenants/:id/{status,limits}`; maps contract command → service |
| `apps/api/src/platform-control/idempotency.{repository,ts}` + prisma impl | Create | Insert-first key check; store/return result |
| `apps/api/src/platform-control/service-token.verifier.ts` | Create | Jwt verify wrapper (JwtModule with PLATFORM_CONTROL_SECRET) |
| `apps/api/prisma/schema.prisma` | Modify | `actorOperatorId String?`, enum `PLATFORM_OPERATOR`, `platform_command_log` model + index |
| `apps/api/prisma/migrations/*` | Create | Additive migration (see Migration section) |
| `apps/api/src/admin/admin-tenant-{status,limits}.{service,repository}.ts` + prisma repos | Modify | Accept `actor` discriminated union; stamp operator |
| `apps/api/src/admin/admin.controller.ts` | Modify | Pass `{type:'user', userId}` |
| `apps/api/src/config/{env.schema,app.config}.ts` | Modify | Add `PLATFORM_CONTROL_SECRET` (required, MinLength 16) |
| `apps/viewpro-api/src/platform-control/platform-control.module.ts` | Create | Operator controller + client |
| `apps/viewpro-api/src/platform-control/platform-control.controller.ts` | Create | `PATCH /operators/tenants/:id/{status,limits}` behind `AuthGuard` |
| `apps/viewpro-api/src/platform-control/platform-control.client.ts` | Create | Mint token + POST to InmoView internal URL |
| `apps/viewpro-api/src/config/{env.schema,app.config}.ts` | Modify | Add `INMOVIEW_API_INTERNAL_URL`, `PLATFORM_CONTROL_SECRET` |
| both `package.json` | Modify | Add `@viewpro/platform-contract` dep |
| `apps/app-new/src/proxy.ts` | Modify | `isProtectedAppPath` includes `/admin` |
| `apps/viewpro-api/src/auth/guards/auth-throttler.guard.ts` | Modify | Tracker keyed per-IP only (drop email from key) |
| `apps/viewpro-api/src/bootstrap/create-app.ts` | Modify | `app.set('trust proxy', …)`; cookie `secure=true` forced when prod |

## Interfaces / Contracts

    // apps/api guard output
    request.platformCaller: PlatformServiceIdentity  // {kind:'service', callerId=operatorId, tokenId=jti}

    // widened service actor (both status + limits services)
    type CommandActor = { type:'user'; userId:string } | { type:'operator'; operatorId:string }

    // internal endpoints (POST — command semantics per blueprint §2.1)
    POST /internal/platform/tenants/:tenantId/status  { targetStatus, idempotencyKey }  → SetTenantStatusResult
    POST /internal/platform/tenants/:tenantId/limits  { limits, idempotencyKey }         → SetTenantLimitsResult

    // viewpro-api operator endpoints (AuthGuard; PATCH mirrors /admin ergonomics)
    PATCH /operators/tenants/:tenantId/status  { status }   ; PATCH .../limits { ...limits }

    // platform_command_log
    model PlatformCommandLog { id, idempotencyKey @unique, tenantId, commandType, result Json, createdAt }

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Guard: reject missing/expired/wrong-aud/wrong-secret → 401; sets platformCaller, never user | vitest, forged tokens |
| Unit | Service actor union → repo stamps correct actorType/id column | vitest, mocked repo |
| Unit | Client mints token with iss/aud/sub/exp; throttler tracker = IP only | vitest |
| Integration | Duplicate idempotencyKey → single effect, 200 replay of stored result | supertest + test DB |
| Integration | Control write → AnalyticsEvent `PLATFORM_OPERATOR`, actorUserId null; `/admin` still stamps user | supertest |
| Integration | Migration additive: old-shape writer + new writer both succeed | prisma migrate on test DB |
| Isolation | User cookie token rejected by PlatformControlGuard; service token rejected by AuthGuard | supertest |

## Threat Matrix

Process-integration boundary (server-to-server HTTP + token trust) — matrix rows:

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Cross-service token forgery | Applicable | Wrong secret/iss/aud/expired → 401; guard never sets `request.user` |
| Token confusion (user↔service) | Applicable | User JWT lacks `aud=inmoview-control` → 401; service JWT lacks cookie → AuthGuard 401 |
| Replay / duplicate command | Applicable | `platform_command_log` unique key → single apply, 200 replay |
| Internal endpoint exposure | Applicable | `/internal/platform/*` not publicly routable (infra); guard is defense-in-depth |
| SSRF via `INMOVIEW_API_INTERNAL_URL` | N/A | Fixed env-configured base URL, not user-supplied |
| Shell/subprocess/VCS automation | N/A | None in this change |

## Migration / Rollout

R1 HIGH — live InmoView DB. **Order**: (1) deploy the additive migration FIRST (nullable `actorOperatorId`, new enum value, `platform_command_log`) — nullable column + new enum value tolerate the still-running old app code; (2) deploy app code that stamps the operator. Never reverse. **Rollback**: drop `platform_command_log`, drop `actorOperatorId` column, remove enum value; no existing rows changed (all had `actorUserId`, `INTERNAL_USER`). `/admin` write routes remain live throughout as fallback.

## Open Questions (for tasks phase)

- [ ] Confirm `PLATFORM_CONTROL_SECRET` provisioning on both app processes + `INMOVIEW_API_INTERNAL_URL` reachable server-to-server, not public.
- [ ] `trust proxy` value: `1` (single known proxy) vs. specific subnet — depends on deploy topology; pick per infra.
- [ ] `platform_command_log` retention/TTL cleanup mechanism (cron vs. manual) — deferred ops task, not runtime-blocking.
- [ ] JwtModule instance in `apps/api`: separate named provider vs. verify-only helper to avoid colliding with any future user JwtModule (apps/api currently has no JwtModule; standalone verifier recommended).
- [ ] Removing email from throttler key weakens per-account login throttling — confirm per-IP-only is acceptable (JD follow-up says yes).
