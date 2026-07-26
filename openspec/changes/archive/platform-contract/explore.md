# Exploration: platform-contract (Phase 3)

> SDD explore artifact for change `platform-contract` (Phase 3 of the
> ViewPro/InmoView platform-foundation initiative). Companion engram topic:
> `sdd/platform-contract/explore`. North-star: `docs/architecture/platform-foundation-blueprint.md`.

## Current State

The monorepo (`viewpro-app/`) has two existing packages under `packages/` — neither is imported by any app today.

- **`@viewpro/contracts`** — pure stub with a single placeholder export. README already encodes the right rules (no Prisma, no React, no business logic) and uses a **source-first pattern**: `"main": "./src/index.ts"`, `"types": "./src/index.ts"`, `"build": "tsc --noEmit"` — no emitted JS, no dist. This is the canonical pattern for the new package.
- **`@viewpro/config`** — tsconfig-sharing package only (`tsconfig/base.json`), extended by both apps.

The `/admin` domain already has concrete types for both control-lane operations (tenant status change, limits change). The data lane has no outbox infrastructure at all. `GlobalAdminGuard` has a hard DI coupling to `UsersRepository` that the control lane will eventually displace (Phase 5).

## Affected Areas

- `viewpro-app/packages/contracts/` — existing stub; new `platform-contract` is a sibling
- `viewpro-app/packages/config/tsconfig/base.json` — shared base the new package extends
- `viewpro-app/pnpm-workspace.yaml` — auto-picks up `packages/platform-contract/`, no change needed
- `viewpro-app/turbo.json` — no change needed; participates via standard `^build` DAG
- `viewpro-app/apps/api/src/admin/guards/global-admin.guard.ts` — DI-coupling point the control lane replaces (Phase 5)
- `viewpro-app/apps/api/src/admin/admin.module.ts` — imports `UsersModule` for the guard
- `viewpro-app/apps/api/prisma/schema.prisma` — canonical `TenantStatus` enum (20-25) + `Tenant` limits fields (219-221)
- `viewpro-app/apps/api/src/admin/admin-tenant-limits.repository.ts` — `AdminTenantLimits` shape (5-9)
- `viewpro-app/apps/api/src/admin/admin-tenant-status.repository.ts` — `UpdateAdminTenantStatusResult` discriminated union

## Finding 1 — Package conventions (exact shape for a new types-only package)

```
packages/platform-contract/
  package.json       # "type": "module", "main": "./src/index.ts", "types": "./src/index.ts"
  tsconfig.json      # extends "../config/tsconfig/base.json", module ESNext, noEmit: true
  src/
    index.ts         # all exported types
  README.md
```

`package.json` minimum:
```json
{
  "name": "@viewpro/platform-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "build": "tsc --noEmit", "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "6.0.3" }
}
```

`tsconfig.json`:
```json
{
  "extends": "../config/tsconfig/base.json",
  "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler", "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

Consumers add `"@viewpro/platform-contract": "workspace:*"` and get types via pnpm symlinks — no turbo change.

## Finding 2 — Domain types the two lanes must align with (file:line evidence)

**Control lane — Tenant status:**
- `TenantStatus` enum: `schema.prisma:20-25` — `TRIAL | ACTIVE | SUSPENDED | CANCELLED`
- Admin allows only `ACTIVE`/`SUSPENDED` as writable targets: `admin-tenant-status.service.ts:12`
- Command today: `{ tenantId; targetStatus; actorUserId }` (`admin-tenant-status.repository.ts:7-11`)
- Response today: `{ tenantId, previousStatus, currentStatus, updatedAt }` discriminated by `"updated" | "unchanged" | "notFound"` (`admin-tenant-status.repository.ts:14-29`)

**Control lane — Tenant limits:**
- `AdminTenantLimits` (`admin-tenant-limits.repository.ts:5-9`): `{ maxUsers; maxActivePropertyEngagements; maxDocumentsStorageMb }` (each `number | null`)
- Map to `Tenant.maxUsers`, `Tenant.maxActivePropertyEngagements`, `Tenant.maxDocumentsStorageMb` (`schema.prisma:219-221`)

**Control lane — missing: idempotency key.** Blueprint §2.1 requires it on commands. Current DTOs have none (`update-admin-tenant-status.dto.ts:1-7`, `update-admin-tenant-limits.dto.ts:1-17`). The contract must introduce it.

**Control lane — missing: plan.** Blueprint §2.1 mentions "change plan" but there is NO `Plan` model anywhere in `schema.prisma` (all 650 lines checked). Limits are the enforcement mechanism. See Open Questions.

**Data lane — tenant read model shape:** `AdminTenantRecord` (`admin-read-models.repository.ts:12-31`): id, name, slug, status, three limits, createdAt, updatedAt, plus counts.

**Data lane — outbox event types:** `AnalyticsEventName` includes `TENANT_STATUS_CHANGED`/`TENANT_LIMITS_UPDATED` (`schema.prisma:161-173`) but `AnalyticsEvent` is a read model, NOT an outbox. `PlatformOutboxEvent` does not exist yet.

## Finding 3 — GlobalAdminGuard coupling (concrete)

`apps/api/src/admin/guards/global-admin.guard.ts:1-25`:
- Constructor injects `USERS_REPOSITORY`
- Per-request `usersRepository.findById(request.user.id)` — live query into product `users` table
- Checks `status === ACTIVE && globalRole === VIEWPRO_ADMIN`

Coupling chain: `AdminModule → UsersModule → PrismaUsersRepository → Prisma → product DB`. The control lane's `PlatformControlGuard` (Phase 5) validates a service token instead, removing this chain from `/internal/platform/` routes. **No migration in Phase 3 — types only.**

## Finding 4 — Outbox / Events: confirmed absent

- `schema.prisma` (650 lines): no `outbox_events`/`domain_events` table
- `AnalyticsEvent` (`schema.prisma:602-620`): read model, no cursor/consumer tracking
- Migration `20260604190000_add_tenant_status_changed_event`: adds an enum value, not a table
- No Redis/NATS/SQS/Kafka dep in `apps/api/package.json`
- Grep `outbox|OutboxEvent|message.*queue|event.*bus`: no matches in API source

Data lane (Phase 6) starts from zero.

## Approaches

### Package build strategy
| Approach | Pros | Cons |
|----------|------|------|
| **A. Source-first, `noEmit: true`** (mirror `@viewpro/contracts`) | Zero build; consistent; immediate workspace resolution | Node16 ESM `.js`-extension expectation — moot, no runtime code | 
| B. Emit `.d.ts` | Explicit artifacts; Node16-clean | Build step; turbo `dist/**`; overkill |
| C. Source-first + `exports` map | Future-proofs Node16 `exports` resolution; cheap | Slightly more package.json |

Recommendation: **A** as base, **C** as a free additive. B unnecessary.

### TenantStatus strategy in the seam
| Approach | Pros | Cons |
|----------|------|------|
| **Own string union** | No Prisma import; clean seam; ViewPro-api uses without product Prisma | Two sources of truth; manual sync |
| Import from `@prisma/client` | Single source | Breaks the seam; violates Design B |
| Opaque `string` | Maximally decoupled | Loses cross-seam compile-time safety |

Recommendation: **Own string union** — matches the `@viewpro/contracts` no-Prisma rule. The sync obligation is the correct, explicit seam cost.

## Open Questions for Proposal Phase

1. **TenantStatus: own union vs. opaque string?** Compile-time safety vs. second source of truth.
2. **Plan concept**: no `Plan` model exists. Introduce `PlatformPlanId: string` preset? Flat `PlatformTenantLimits` only? Both? Determines whether Phase 4 needs a plan-preset table.
3. **Data lane types in Phase 3 or Phase 6?** Define speculative `PlatformOutboxEvent` early to anchor the seam, or defer to avoid premature lock-in? Decides whether Phase 3 is control-lane-only or both lanes.

## Recommendation

Phase 3 is well-scoped, no blockers. Control-lane types are directly derivable from existing admin DTOs/repositories. Create `packages/platform-contract/` (Option A + C), answer the three open questions in the proposal, proceed.

**Ready for Proposal: Yes.**
