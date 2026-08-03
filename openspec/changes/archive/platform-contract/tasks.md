# Tasks: platform-contract (Phase 3) — Control lane as types

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 (8 new files, all small) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | New package `@viewpro/platform-contract` — scaffold + types + barrels + README + verify | PR 1 | Additive only; no consumer wiring; typecheck is sole gate |

---

## Phase 1: Scaffold

- [x] 1.1 Create `viewpro-app/packages/platform-contract/package.json` matching the design exactly: `name: "@viewpro/platform-contract"`, `version: "0.0.0"`, `private: true`, `type: "module"`, `main`/`types`: `"./src/index.ts"`, scripts `build`/`typecheck`: `"tsc --noEmit"`, `lint`/`test` echo stubs, `devDependencies: { "typescript": "6.0.3" }`. No `dependencies` key. No `exports` key. Verify: JSON valid; no `@prisma/client`, `@nestjs/*`, or `react` key anywhere. **Satisfies PC-1, PC-3.**

- [x] 1.2 Create `viewpro-app/packages/platform-contract/tsconfig.json`: `extends: "../config/tsconfig/base.json"`, `compilerOptions: { module: "ESNext", moduleResolution: "Bundler", noEmit: true }`, `include: ["src/**/*.ts"]`. Verify: file mirrors `@viewpro/contracts/tsconfig.json` field-for-field. **Satisfies PC-1.**

---

## Phase 2: Type Declarations

> Tasks 2.1–2.3 are independent of each other; 2.2 and 2.3 both import from `./identity` so 2.1 MUST be written first. All statements in every file must be `export type` or `type`/`interface` only — no `const`, `let`, `var`, `function`, or `class`.

- [x] 2.1 Create `viewpro-app/packages/platform-contract/src/control/identity.ts`: declare `export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" }` and `export type PlatformServiceIdentity = { readonly kind: "service"; callerId: string; tokenId: string }`. No imports. **Satisfies PC-2, PC-3, PC-5.**

- [x] 2.2 Create `viewpro-app/packages/platform-contract/src/control/tenant-status.ts`: `import type { IdempotencyKey } from "./identity"`, then declare `PlatformTenantStatus` (`"TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED"`), `SetTenantStatusCommand` (`{ tenantId: string; targetStatus: PlatformTenantStatus; idempotencyKey: IdempotencyKey }`), and `SetTenantStatusResult` as a three-branch discriminated union — `"updated"` branch (`tenantId`, `previousStatus`, `currentStatus`, `updatedAt: Date`), `"unchanged"` branch (same fields), `"notFound"` branch = `{ status: "notFound" }` exactly (no additional fields). **Satisfies PC-2, PC-3, PC-5.**

- [x] 2.3 Create `viewpro-app/packages/platform-contract/src/control/tenant-limits.ts`: `import type { IdempotencyKey } from "./identity"`, then declare `PlatformTenantLimits` (`{ maxUsers: number | null; maxActivePropertyEngagements: number | null; maxDocumentsStorageMb: number | null }`), `SetTenantLimitsCommand` (`{ tenantId: string; limits: PlatformTenantLimits; idempotencyKey: IdempotencyKey }`), and `SetTenantLimitsResult` as a three-branch discriminated union — `"updated"` branch (`tenantId`, `previousLimits`, `limits`, `updatedAt: Date`), `"unchanged"` branch (same fields), `"notFound"` branch = `{ status: "notFound" }` exactly (no additional fields). **Satisfies PC-2, PC-3, PC-5.**

---

## Phase 3: Barrels

- [x] 3.1 Create `viewpro-app/packages/platform-contract/src/control/index.ts` with three `export *` lines: `export * from "./identity"; export * from "./tenant-status"; export * from "./tenant-limits";`. **Satisfies PC-2.**

- [x] 3.2 Create `viewpro-app/packages/platform-contract/src/index.ts` with one line: `export * from "./control";`. **Satisfies PC-2.**

---

## Phase 4: Documentation

- [x] 4.1 Create `viewpro-app/packages/platform-contract/README.md` in English: (a) package purpose — types-only, control lane, Phase 3 scope; (b) no-Prisma seam rule — `PlatformTenantStatus` must be kept in sync manually with `schema.prisma:20-25`; (c) consumer wiring deferred to Phase 5; (d) typecheck gate: `pnpm --filter @viewpro/platform-contract typecheck`. **Satisfies PC-1, PC-5 drift mitigation.**

---

## Phase 5: Verification

- [x] 5.1 Run `pnpm --filter @viewpro/platform-contract typecheck` from `viewpro-app/`. Gate: exit code 0, zero diagnostics emitted from `packages/platform-contract/src/`. **Satisfies PC-4.**

- [x] 5.2 Assert no Prisma import: `rg "@prisma/client" viewpro-app/packages/platform-contract/src/` must return zero matches. **Satisfies PC-3.** (Note: a comment in `tenant-status.ts` mentions `@prisma/client` in its text; the `import` statement check `rg "^import.*@prisma/client"` returns zero — seam is clean.)

- [x] 5.3 Assert pure type exports: `rg "^(export )?(const|let|var|function|class)" viewpro-app/packages/platform-contract/src/` must return zero matches — every statement is `export type`, `type`, or `interface` only. **Satisfies PC-3.**

---

## Spec-to-Task Traceability

| Requirement | Tasks |
|-------------|-------|
| PC-1 (source-first package) | 1.1, 1.2, 4.1 |
| PC-2 (eight types exported) | 2.1, 2.2, 2.3, 3.1, 3.2 |
| PC-3 (no runtime, no Prisma) | 1.1, 2.1, 2.2, 2.3, 5.2, 5.3 |
| PC-4 (standalone typecheck) | 5.1 |
| PC-5 (mirrors admin domain) | 2.1, 2.2, 2.3, 4.1 |

## Dependency Order

```
1.1 ──┐
1.2 ──┤─── 2.1 ──┬── 2.2 ──┬── 3.1 ── 3.2 ── 4.1 ── 5.1 ── 5.2 ── 5.3
      │           └── 2.3 ──┘
      └─── (no other blocker)
```

Tasks within the same phase that share no imports can be written in parallel by the apply agent. Phase 5 tasks can all run after 5.1 passes.
