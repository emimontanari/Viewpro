# @viewpro/platform-contract

Types-only workspace package for the ViewPro → InmoView platform control lane (Phase 3 of the platform-foundation series).

## Purpose

This package declares the shared control-lane contract between ViewPro (the operator platform) and InmoView (the tenant application). It contains **no runtime code** — every export is a TypeScript `type` or `interface`. The package typechecks via `tsc --noEmit` and is consumed by Phase 5 adapter code in `apps/api`.

## Exports

All eight control-lane types are exported from the package root:

| Type | Description |
|------|-------------|
| `IdempotencyKey` | Branded opaque string. Storage and validation semantics are defined in Phase 5. |
| `PlatformServiceIdentity` | Identifies the calling ViewPro service (never a product user). Derived from the service token context in Phase 5, not carried in command bodies. |
| `PlatformTenantStatus` | `"TRIAL" \| "ACTIVE" \| "SUSPENDED" \| "CANCELLED"` |
| `SetTenantStatusCommand` | Command to set a tenant's status. Carries `idempotencyKey`; does not carry `actorUserId`. |
| `SetTenantStatusResult` | Discriminated union on `status`: `"updated" \| "unchanged" \| "notFound"`. |
| `PlatformTenantLimits` | `{ maxUsers, maxActivePropertyEngagements, maxDocumentsStorageMb }` — all `number \| null`. |
| `SetTenantLimitsCommand` | Command to set a tenant's resource limits. Carries `idempotencyKey`. |
| `SetTenantLimitsResult` | Discriminated union on `status`: `"updated" \| "unchanged" \| "notFound"`. |

## Seam rules

### No-Prisma seam

`@prisma/client` MUST NOT appear anywhere in this package. `PlatformTenantStatus` is declared as its own string union — it is NOT imported from Prisma.

**Drift obligation**: `PlatformTenantStatus` MUST be kept in sync with the `TenantStatus` enum in `schema.prisma:20-25` manually. If a new tenant status is added to the Prisma schema, update this package's union accordingly. A compile-time equality assertion (`PlatformTenantStatus` ↔ Prisma `TenantStatus`) can be added in `apps/api` (where Prisma is already a dependency) once Phase 5 is in place.

### No consumer wiring (Phase 3)

`apps/api` and `apps/app-new` do NOT declare `@viewpro/platform-contract` as a dependency yet. Consumer wiring is deferred to Phase 5. This package typechecks standalone.

## Typecheck gate

```bash
# Run from viewpro-app/
pnpm --filter @viewpro/platform-contract typecheck
```

Exit code 0 with zero diagnostics is the sole verification gate for this phase.

## Package conventions

Follows the same package conventions as `@viewpro/contracts`:

- `main` and `types` both resolve to `./src/index.ts` (source-first, no build step)
- `build` and `typecheck` both invoke `tsc --noEmit`
- Only `devDependency`: `typescript`
- No `exports` map (consistent with the canonical sibling)
