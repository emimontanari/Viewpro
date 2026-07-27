# Design: platform-contract (Phase 3) — CONTROL lane as types

## Technical Approach

Scaffold `viewpro-app/packages/platform-contract/` (`@viewpro/platform-contract`) as a types-only, source-first package mirroring `@viewpro/contracts`. `tsc --noEmit` is the only gate. Eight control-lane types are declared from verified `/admin` evidence, organized under a `src/control/` submodule (anticipating the deferred `src/data/` lane) and re-exported through `src/index.ts`. No runtime, no framework, no Prisma, no consumer wiring (P5).

## File Layout

```
packages/platform-contract/
  package.json          # source-first, devDep typescript only
  tsconfig.json         # extends ../config/tsconfig/base.json, noEmit
  README.md             # seam rules + TenantStatus sync obligation
  src/
    index.ts            # re-export * from ./control
    control/
      index.ts          # barrel: status, limits, identity
      identity.ts       # IdempotencyKey, PlatformServiceIdentity
      tenant-status.ts  # PlatformTenantStatus, SetTenantStatus{Command,Result}
      tenant-limits.ts  # PlatformTenantLimits, SetTenantLimits{Command,Result}
```

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Build strategy | Source-first `noEmit:true` | Emit `.d.ts` | Mirrors canonical `@viewpro/contracts`; zero build; types-only |
| `exports` map | **None** (mirror sibling) | Add `exports` map (explore "C") | `moduleResolution: Bundler` + no runtime makes it inert; divergence from the canonical sibling for zero P3 benefit violates consistency and "don't build for what doesn't exist" |
| Module layout | `src/control/` submodule | One flat `index.ts` | Blueprint has two lanes; P6 adds `src/data/` with no restructure. Cost is near-zero (barrels), no speculative data types created |
| `TenantStatus` source | Own string union | Import `@prisma/client`; opaque `string` | No-Prisma seam (Design B); keeps compile-time safety; manual sync is the accepted explicit cost |
| Command naming | `SetTenant{Status,Limits}Command` | `ChangeTenant…`/`Update…` | "Set" = declarative desired-state, pairs naturally with idempotency-key semantics |
| Result discriminant | `status: "updated"\|"unchanged"\|"notFound"` | rename to `outcome` | Mirrors existing repo result field-for-field → P5 adapter is a trivial structural pass-through |
| Caller placement | `PlatformServiceIdentity` standalone (NOT a command field) | embed `caller` in each command | In P5 identity is derived from the service token/context, not the body; embedding would duplicate/conflict |
| Dropped fields | omit `now: Date`, `actorUserId` | keep them | `now` is clock-injection infra; `actorUserId` is user auth — replaced by service identity |

## Interfaces / Contracts (complete surface)

`src/control/identity.ts`
```ts
// Opaque brand: storage/validation semantics defined in P5.
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

// Caller is a SERVICE (ViewPro), never a product user. Supplied by the
// authenticated service context in P5 — not carried in command bodies.
export type PlatformServiceIdentity = {
  readonly kind: "service";
  callerId: string; // ViewPro service principal id
  tokenId: string;  // id of the service token presented
};
```

`src/control/tenant-status.ts`
```ts
// Own union — keep in sync with prisma TenantStatus (schema.prisma:20-25).
// Never import from "@prisma/client" (Design B no-Prisma seam).
export type PlatformTenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

import type { IdempotencyKey } from "./identity";

// Writable-target policy (today ACTIVE|SUSPENDED) is a P5 runtime concern,
// intentionally not narrowed here. Ref: admin-tenant-status.repository.ts:7-11
export type SetTenantStatusCommand = {
  tenantId: string;
  targetStatus: PlatformTenantStatus;
  idempotencyKey: IdempotencyKey;
};

// Mirrors UpdateAdminTenantStatusResult (admin-tenant-status.repository.ts:14-29).
export type SetTenantStatusResult =
  | {
      status: "updated";
      tenantId: string;
      previousStatus: PlatformTenantStatus;
      currentStatus: PlatformTenantStatus;
      updatedAt: Date;
    }
  | {
      status: "unchanged";
      tenantId: string;
      previousStatus: PlatformTenantStatus;
      currentStatus: PlatformTenantStatus;
      updatedAt: Date;
    }
  | { status: "notFound" };
```

`src/control/tenant-limits.ts`
```ts
import type { IdempotencyKey } from "./identity";

// Maps Tenant.maxUsers / maxActivePropertyEngagements / maxDocumentsStorageMb
// (schema.prisma:219-221, all Int?). Ref: admin-tenant-limits.repository.ts:5-9
export type PlatformTenantLimits = {
  maxUsers: number | null;
  maxActivePropertyEngagements: number | null;
  maxDocumentsStorageMb: number | null;
};

export type SetTenantLimitsCommand = {
  tenantId: string;
  limits: PlatformTenantLimits;
  idempotencyKey: IdempotencyKey;
};

// Mirrors UpdateAdminTenantLimitsResult (admin-tenant-limits.repository.ts:18-33).
export type SetTenantLimitsResult =
  | {
      status: "updated";
      tenantId: string;
      previousLimits: PlatformTenantLimits;
      limits: PlatformTenantLimits;
      updatedAt: Date;
    }
  | {
      status: "unchanged";
      tenantId: string;
      previousLimits: PlatformTenantLimits;
      limits: PlatformTenantLimits;
      updatedAt: Date;
    }
  | { status: "notFound" };
```

`src/control/index.ts` → `export * from "./identity"; export * from "./tenant-status"; export * from "./tenant-limits";`
`src/index.ts` → `export * from "./control";`

### package.json
```json
{
  "name": "@viewpro/platform-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "build": "tsc --noEmit", "lint": "echo 'platform-contract lint not configured yet'", "typecheck": "tsc --noEmit", "test": "echo 'platform-contract tests not configured yet'" },
  "devDependencies": { "typescript": "6.0.3" }
}
```

### tsconfig.json
```json
{
  "extends": "../config/tsconfig/base.json",
  "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler", "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

## Seam Discipline Checks

- **No runtime dep**: `dependencies` absent; only `devDependencies.typescript`. Pure `export type`, zero `const`/runtime values.
- **No Prisma**: grep the package for `@prisma/client` must return zero. `PlatformTenantStatus` / `PlatformTenantLimits` are own declarations.
- **No framework/transport**: no Nest, no HTTP, no React. `Date` is a TS global (allowed), not an import.
- **No consumer wiring**: no app adds the dep this phase; package typechecks standalone like `@viewpro/contracts`.

## TenantStatus Drift Mitigation

- Inline comment in `tenant-status.ts` citing `schema.prisma:20-25` + README sync obligation note.
- A type-level equality assertion (`PlatformTenantStatus` ↔ Prisma `TenantStatus`) **cannot** live here without importing Prisma — that would break the seam. Recommendation: defer the optional automated guard to P5/apps/api, where Prisma is already a dependency, as a non-emitting type assert. Adding it to this package is over-built for P3 and seam-violating.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Compile | Whole surface | `pnpm --filter @viewpro/platform-contract typecheck` (`tsc --noEmit`) is the sole gate |
| Unit/Integration/E2E | n/a | No runtime to test this phase |

## Migration / Rollout

No migration. Additive new package. Rollback = delete the directory + `pnpm install`.

## Open Questions

- [ ] README language: recommend **English** to match platform-foundation docs (blueprint, ADR 0001); sibling `@viewpro/contracts` README is Spanish — minor, accepted inconsistency.
