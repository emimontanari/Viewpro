# Proposal: platform-contract (Phase 3) — CONTROL lane as types

> Phase 3 of the ViewPro/InmoView platform-foundation initiative.
> North-star: `docs/architecture/platform-foundation-blueprint.md` §1, §2.1, §4.
> Inputs: explore `sdd/platform-contract/explore`; resolutions `sdd/platform-contract/resolutions`.

## Intent

ViewPro (the company control plane) must govern InmoView (the product) WITHOUT reaching into the product DB — Design B. Today the seam does not exist: `/admin` operations live inside the product and `GlobalAdminGuard` is DI-coupled to `UsersRepository` (blueprint §2.1). Phase 3 declares the **control lane** (ViewPro→InmoView commands) as a shared, types-only contract so later phases (P4 console, P5 `/admin` migration) build against a stable seam instead of inventing one. Build once for InmoView, design for N products.

## Scope

### In Scope
- New package `packages/platform-contract` (`@viewpro/platform-contract`) — source-first, `noEmit: true`, mirror `@viewpro/contracts` (+ optional `exports` map).
- Control-lane TypeScript types only (no runtime, no framework, no infra).
- `PlatformTenantStatus` own string union (NOT `@prisma/client`).
- README stating seam rules (no Prisma, no React, no business logic).

### Out of Scope
- DATA lane (outbox / cursor / change-feed types) → deferred to Phase 6.
- Plan concept / `PlatformPlanId` / plan-preset abstraction → limits ARE the mechanism.
- Runtime guards (`PlatformControlGuard`), transport, idempotency storage → Phase 5.
- `/admin` migration and removing the `UsersRepository` coupling → Phase 5.
- Consumer wiring into `apps/api` / `apps/app-new` → see Approach (deferred to P5).
- App-directory renames (`app-new`→`inmoview-web`) → cosmetic, deferred.

## Capabilities

### New Capabilities
- `platform-control-contract`: the ViewPro→InmoView control lane as shared types — tenant-status command, tenant-limits command, their discriminated results, idempotency key, service caller identity, and the platform tenant-status union.

### Modified Capabilities
- None.

## Approach

Scaffold `packages/platform-contract/` exactly as the explore locked it (Option A + C). Declare types only; `tsc --noEmit` is the sole gate. Proposed surface (derived from existing `/admin` evidence, idempotency added per §2.1):

| Type | Shape | Evidence |
|------|-------|----------|
| `PlatformTenantStatus` | `'TRIAL'\|'ACTIVE'\|'SUSPENDED'\|'CANCELLED'` | `schema.prisma:20-25` |
| `IdempotencyKey` | branded/opaque `string` | §2.1 (new) |
| `PlatformServiceIdentity` | caller = SERVICE (ViewPro), e.g. `{ callerId; tokenId }` — separate from user auth | §2.1 |
| `SetTenantStatusCommand` | `{ tenantId; targetStatus: PlatformTenantStatus; idempotencyKey: IdempotencyKey }` | `admin-tenant-status.repository.ts:7-11` |
| `SetTenantStatusResult` | `updated \| unchanged \| notFound` (prev/current status, updatedAt) | `admin-tenant-status.repository.ts:14-29` |
| `PlatformTenantLimits` | `{ maxUsers; maxActivePropertyEngagements; maxDocumentsStorageMb }` (each `number\|null`) | `admin-tenant-limits.repository.ts:5-9` |
| `SetTenantLimitsCommand` | `{ tenantId; limits: PlatformTenantLimits; idempotencyKey }` | `admin-tenant-limits.repository.ts:11-16` |
| `SetTenantLimitsResult` | `updated \| unchanged \| notFound` (prev/new limits, updatedAt) | `admin-tenant-limits.repository.ts:18-33` |

**Consumer-wiring decision (recommended): do NOT wire the dep into apps now.** The package compiles and typechecks standalone, exactly like the unconsumed `@viewpro/contracts` stub. Wiring `@viewpro/platform-contract` into `apps/api`/`app-new` before P5 adds a dead dependency on types nothing uses yet — speculative coupling that the seam-discipline guardrail forbids. Consumption lands in Phase 5 when `/admin` actually migrates over the control lane. Minimal-but-useful = ship the typed seam, defer consumption.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-app/packages/platform-contract/` | New | Package scaffold + `src/` type files + README |
| `viewpro-app/pnpm-workspace.yaml` | None | Auto-globs `packages/*` |
| `viewpro-app/turbo.json` | None | Standard `^build` DAG; `noEmit` package |
| `apps/api`, `apps/app-new` | None (this phase) | No dep added until P5 |

## Guardrails

- **Seam-only discipline (bites here):** types, not infra. No runtime, no framework, no transport, no guard. Do not build for products that don't exist.
- **No-Prisma seam:** `PlatformTenantStatus` is an own union; never `import type { TenantStatus } from "@prisma/client"`. Manual sync with `schema.prisma:20-25` is the accepted, explicit seam cost.
- **Caller is a SERVICE, not a user:** `PlatformServiceIdentity` is separate from user auth — never reuse user JWT/cookies (§2.1).
- **G2 preview (informational only for P3):** P4 will own its cookie names + own DB; never inherit `viewpro_access_token`. No action this phase — flagged so the seam anticipates it.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `PlatformTenantStatus` drifts from Prisma `TenantStatus` | Med | README notes the sync obligation + `schema.prisma:20-25` citation; revisit when the enum changes |
| Over-engineering the seam (building data lane / plan / guards early) | Med | Scope OUT is explicit; resolutions lock control-lane-only, limits-only |
| Idempotency-key type shape premature | Low | Keep it an opaque `string` brand; storage/validation semantics defined in P5, not now |
| Unused package perceived as dead code | Low | Mirrors the accepted `@viewpro/contracts` precedent; consumed in P5 |

## Rollback Plan

Delete `packages/platform-contract/` and run `pnpm install`. No app imports it, no migrations, no runtime — removal is a clean, zero-impact revert.

## Dependencies

- Phase 2 complete (stable brand names) — satisfied (commit `772c1c5`).
- `@viewpro/config` `tsconfig/base.json` (extended by the new package).

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

New isolated package: `package.json`, `tsconfig.json`, `README.md`, and ~5 small type files (one capability, ~8 types). No app edits this phase. Estimated changed lines well under 200, additive only.

## Success Criteria

- [ ] `packages/platform-contract` exists, source-first, `noEmit: true`, mirrors `@viewpro/contracts`.
- [ ] All eight control-lane types exported from `src/index.ts`; `pnpm --filter @viewpro/platform-contract typecheck` passes.
- [ ] No `@prisma/client` import; `PlatformTenantStatus` is an own union.
- [ ] No runtime code, no framework, no transport, no consumer wiring.
- [ ] Commands carry an idempotency key; caller identity is a service, not a user.
