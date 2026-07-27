# Platform-Control-Contract Specification

## Purpose

Define what MUST be true after Phase 3 (`platform-contract`) is delivered: the `@viewpro/platform-contract` package exists as a types-only, source-first workspace package that exports the complete ViewPro→InmoView control lane, passes a standalone typecheck, contains no runtime code and no Prisma dependency, and whose type fields mirror the existing admin domain exactly.

---

## Scope boundary (Phase 3 only)

| Boundary | Decision |
|----------|----------|
| Package kind | Types-only; no emitted JS |
| Lanes included | Control lane only (status command + limits command) |
| Data lane | EXCLUDED — Phase 6 |
| Plan / PlatformPlanId | EXCLUDED — limits are the mechanism |
| Consumer wiring into apps | EXCLUDED — Phase 5 |
| Runtime guards / transport | EXCLUDED — Phase 5 |

---

## Requirements

### Requirement PC-1: Package exists with source-first conventions

The package `@viewpro/platform-contract` MUST exist at `packages/platform-contract/` and MUST mirror `@viewpro/contracts` exactly: `package.json` fields `"main"` and `"types"` MUST both resolve to `"./src/index.ts"`; scripts `"build"` and `"typecheck"` MUST both invoke `tsc --noEmit`; `tsconfig.json` MUST extend `"../config/tsconfig/base.json"` and set `"noEmit": true`.

#### Scenario: package.json has correct source-first fields

- GIVEN the repository after Phase 3 is applied
- WHEN `packages/platform-contract/package.json` is inspected
- THEN `"main"` equals `"./src/index.ts"` AND `"types"` equals `"./src/index.ts"`
- AND both `"build"` and `"typecheck"` scripts execute `tsc --noEmit`
- AND no `dist/` directory or emitted artifact is present

#### Scenario: tsconfig.json extends the shared base and disables emit

- GIVEN `packages/platform-contract/tsconfig.json`
- WHEN its contents are read
- THEN `"extends"` resolves to `"../config/tsconfig/base.json"`
- AND `"noEmit"` is `true` in `compilerOptions`

---

### Requirement PC-2: All eight control-lane types are exported from `src/index.ts`

`src/index.ts` MUST export the following types with the shapes specified:

| Export | Required shape |
|--------|---------------|
| `PlatformTenantStatus` | `'TRIAL' \| 'ACTIVE' \| 'SUSPENDED' \| 'CANCELLED'` |
| `IdempotencyKey` | Branded/opaque `string` |
| `PlatformServiceIdentity` | `{ callerId: string; tokenId: string }` |
| `SetTenantStatusCommand` | `{ tenantId: string; targetStatus: PlatformTenantStatus; idempotencyKey: IdempotencyKey }` |
| `SetTenantStatusResult` | Discriminated union on `status`: `'updated' \| 'unchanged' \| 'notFound'` |
| `PlatformTenantLimits` | `{ maxUsers: number \| null; maxActivePropertyEngagements: number \| null; maxDocumentsStorageMb: number \| null }` |
| `SetTenantLimitsCommand` | `{ tenantId: string; limits: PlatformTenantLimits; idempotencyKey: IdempotencyKey }` |
| `SetTenantLimitsResult` | Discriminated union on `status`: `'updated' \| 'unchanged' \| 'notFound'` |

#### Scenario: All eight types are importable

- GIVEN a TypeScript file that imports from `@viewpro/platform-contract`
- WHEN the import references all eight type names
- THEN the TypeScript compiler resolves every import without error
- AND no `any` or `unknown` is required to satisfy the type constraints

#### Scenario: Result types are exhaustively discriminated

- GIVEN `SetTenantStatusResult` (or `SetTenantLimitsResult`)
- WHEN a `switch` on `status` covers `'updated'`, `'unchanged'`, and `'notFound'`
- THEN TypeScript narrows each branch to its concrete shape without a fallthrough
- AND the `'updated'` and `'unchanged'` branches expose `previousStatus`/`previousLimits` and `updatedAt`

---

### Requirement PC-3: Package is purely structural — no runtime code, no Prisma, no framework

The package MUST NOT contain any runtime JavaScript logic. `@prisma/client` MUST NOT appear in any `import` or `require` statement inside `src/`. No NestJS, React, or HTTP framework package MUST appear as a `dependency` or `devDependency`. Every statement in `src/` MUST be a `type`, `interface`, or `export type` declaration.

#### Scenario: Dependency audit finds no forbidden deps

- GIVEN `packages/platform-contract/package.json`
- WHEN `dependencies` and `devDependencies` are listed
- THEN neither `@prisma/client`, `@nestjs/*`, `react`, nor any HTTP-framework package appears
- AND `typescript` is the only `devDependency`

#### Scenario: Source files contain no runtime logic

- GIVEN all files under `packages/platform-contract/src/`
- WHEN each file is read
- THEN every statement is a `type`, `interface`, or `export type` — no function body, class, or variable assignment is present
- AND no `import` from `@prisma/client` appears anywhere in `src/`

---

### Requirement PC-4: Standalone typecheck passes

Running `pnpm --filter @viewpro/platform-contract typecheck` MUST exit with code `0` and produce no TypeScript diagnostic errors from the package's own files.

#### Scenario: typecheck exits zero

- GIVEN the monorepo after Phase 3 is applied
- WHEN `pnpm --filter @viewpro/platform-contract typecheck` is executed in the workspace root
- THEN the process exits with code `0`
- AND no diagnostic errors or warnings from `packages/platform-contract/src/` are emitted

---

### Requirement PC-5: Type fields mirror the admin domain without divergence

Control-lane types MUST align field-for-field with the existing admin domain evidence and MUST NOT introduce additional fields in this phase.

`PlatformTenantStatus` values MUST exactly match `schema.prisma:20-25` (`TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`). `PlatformTenantLimits` fields MUST exactly match `admin-tenant-limits.repository.ts:5-9` (three fields, each `number | null`). `SetTenantStatusResult` discriminant values and per-branch shapes MUST mirror `admin-tenant-status.repository.ts:14-29`.

Commands MUST carry `idempotencyKey: IdempotencyKey` (present in the contract, absent in the existing admin input types — the seam adds it). Commands MUST NOT carry `actorUserId` (user-auth coupling); caller identity is conveyed via `PlatformServiceIdentity` instead.

#### Scenario: PlatformTenantStatus has exactly four members

- GIVEN `PlatformTenantStatus` in `src/index.ts`
- WHEN its members are enumerated
- THEN they are exactly `'TRIAL'`, `'ACTIVE'`, `'SUSPENDED'`, `'CANCELLED'`
- AND no member is added or removed relative to `schema.prisma:20-25`

#### Scenario: PlatformTenantLimits mirrors the admin limits shape

- GIVEN `PlatformTenantLimits` in `src/index.ts`
- WHEN its properties are compared to `AdminTenantLimits` (`admin-tenant-limits.repository.ts:5-9`)
- THEN both types expose exactly `maxUsers`, `maxActivePropertyEngagements`, and `maxDocumentsStorageMb`, each typed `number | null`
- AND no field is added, removed, or retyped

#### Scenario: Commands carry idempotencyKey and omit actorUserId

- GIVEN `SetTenantStatusCommand` in `src/index.ts`
- WHEN its fields are listed
- THEN `idempotencyKey: IdempotencyKey` is present (addition over `UpdateAdminTenantStatusInput`)
- AND `actorUserId` is absent (caller identity is expressed via `PlatformServiceIdentity`, not a user field)

---

## Non-goals (explicit — do not validate against these)

- Data lane types (`PlatformOutboxEvent`, cursor, change-feed) — Phase 6.
- `PlatformPlanId` or plan-preset abstraction — limits are the mechanism.
- `PlatformControlGuard`, service-token validation, or any runtime guard — Phase 5.
- Consumer wiring into `apps/api` or `apps/app-new` — Phase 5.
- Any migration, database change, or runtime behavior change.

---

## Success checklist

- [ ] PC-1: `main` and `types` → `"./src/index.ts"` in `package.json`
- [ ] PC-1: `build` and `typecheck` → `tsc --noEmit` in `package.json`
- [ ] PC-1: `tsconfig.json` extends `../config/tsconfig/base.json`, `noEmit: true`
- [ ] PC-2: All eight types exported from `src/index.ts`
- [ ] PC-2: `SetTenantStatusResult` and `SetTenantLimitsResult` are exhaustively discriminated unions
- [ ] PC-3: No `@prisma/client`, `@nestjs/*`, or framework dep in `package.json`
- [ ] PC-3: No runtime JS logic in `src/` — type/interface/export-type declarations only
- [ ] PC-4: `pnpm --filter @viewpro/platform-contract typecheck` exits 0
- [ ] PC-5: `PlatformTenantStatus` is exactly `'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'`
- [ ] PC-5: `PlatformTenantLimits` three fields match `admin-tenant-limits.repository.ts:5-9`
- [ ] PC-5: Commands carry `idempotencyKey`; `actorUserId` is absent from all commands
