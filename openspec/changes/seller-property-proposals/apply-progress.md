# Apply Progress: seller-property-proposals / C1

## Status consumed

```yaml
artifactStore: openspec
proposal/spec/design/tasks: done
dependencies.apply: ready
nextRecommended: apply
applyState: ready
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c1-foundation
  allowedEditRoots: supplied U1 manifest and OpenSpec artifacts
workUnit: C1-contract-permissions
```

No action-context warning was raised: every source edit is within the supplied U1 manifest, and the pre-existing grouping correction in `task-delivery-plan.md` was not edited.

## Completed implementation tasks

- [x] `U1`: Added the ordered seven-code property-proposal catalog suffix, proposal seller/reviewer permissions, role mapping boundaries, and contract/filter/mapping coverage.
- [x] `U1`: Ran contract coverage, no-DB focused API unit coverage, and API typecheck.
- Persisted checkbox updates: both U1 implementation-owned rows in `tasks.md` now visibly use `- [x]`.

## Files changed

- `viewpro-app/packages/contracts/src/index.ts`
- `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`
- `viewpro-app/apps/api/src/common/filters/global-exception.filter.spec.ts`
- `viewpro-app/apps/api/src/permissions/permissions.constants.ts`
- `viewpro-app/apps/api/src/permissions/role-permissions.ts`
- `viewpro-app/apps/api/src/permissions/property-proposals-role-permissions.spec.ts`
- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

## TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U1 catalog / S43–S45 | Runtime contract | `pnpm --filter @viewpro/contracts test`: 5/5 before edits | After test-first expected 37-tuple update, the command failed 2/5 because runtime emitted only 30 entries. | Same command passed 5/5 after the ordered seven-code suffix. | Changed `PROPERTY_PROPOSAL_STATE_CONFLICT` to `PROPERTY_PROPOSAL_STATE_CONFLICT_FORGED`; the contract command failed 2/5 on exact tuple mismatch; restored it and reran 5/5 GREEN. | No refactor needed; the append-only tuple remains direct and ordered. |
| U1 permissions / S34 | API unit | New spec file | Tests were written before production edits; the prescribed API command was blocked by its unconditional PostgreSQL global setup (P1001), not by an assertion. | No-DB focused Vitest configuration passed 4/4 permission assertions, including agent denial of `engagements.create` and manager retention. | Manager and principal review coverage plus agent seller-only denial exercise each distinct role branch. | No refactor needed; principal manager filters only the seller-only capability from the pre-existing all-permissions set. |
| U1 filter / S43–S45 | API unit | New spec file | Tests were written before production edits; the prescribed API command was blocked by its unconditional PostgreSQL global setup (P1001). The no-DB focused run observed known-code fallback while the built contract still had 30 codes. | After rebuilding contracts, no-DB focused Vitest passed 3/3 filter assertions for new-code passthrough, unknown/missing fallback, and exact envelope keys. | Known, unknown, and missing producer code inputs cover both guard branches. | No refactor needed; the existing filter already delegates membership and emits the required three-key payload. |

## Verification

- PASS — `pnpm --filter @viewpro/contracts test` — 5 tests passed.
- PASS — `pnpm exec vitest run --config /tmp/viewpro-c1-vitest-no-db.mjs src/common/filters/global-exception.filter.spec.ts src/permissions/property-proposals-role-permissions.spec.ts` — 7 tests passed. The temporary external config was removed immediately; it disabled the repository global setup only because these units require no database.
- PASS — `pnpm --filter @viewpro/api typecheck`.
- BLOCKED INFRASTRUCTURE — prescribed `pnpm --filter @viewpro/api exec vitest run src/common/filters/global-exception.filter.spec.ts src/permissions/property-proposals-role-permissions.spec.ts` invokes `test/global-setup.ts`, which runs `prisma migrate deploy` and failed `P1001` because local PostgreSQL is unavailable. This command did not execute either selected test despite the unit-only scope.

## Deviations and cleanup

- No design deviation: `GlobalExceptionFilter` needed no source change because it already uses the contract membership guard and exact envelope implementation.
- `pnpm install --offline --frozen-lockfile` was used because dependencies were absent; Prisma Client was generated only in `node_modules` to allow typecheck/test loading. Temporary Vitest configuration, dependency directories, generated contract `dist`, and generated client artifacts are removed during final cleanup.
- No database, provider, network, migration, route, DTO, schema, UI, or C2 work was performed.

## Remaining tasks and delivery boundary

C1 is complete within its selected `auto-chain` sequential stacked-to-`develop` C1 → C20 boundary: U1 is forecast at 230–288 changed lines and is the current C1 slice targeting `develop`. The current candidate is cohesive and within the 650-line limit. No commit, push, PR, merge, review, or receipt action was performed.

The remaining units are out of scope for C1. The next exact unchecked implementation rows begin:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR proposal, round, decision, source-link, enum, index, and check definitions against the tenant and deletion invariants. <!-- sdd-owner: implementation -->
- [ ] Run the manifest-scoped schema test, `db:validate`, and API typecheck without leaving database state. <!-- sdd-owner: implementation -->

Deferred lifecycle actions are all parent-owned rows in `tasks.md`; they remain byte-for-byte unchanged.

## C1 Permission Remediation (allowed corrective rerun)

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c1-foundation
  allowedEditRoots:
    - viewpro-app/apps/api/src/permissions/role-permissions.ts
    - viewpro-app/apps/api/src/permissions/property-proposals-role-permissions.spec.ts
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
warnings: []
```

The required proposal, specification companion, design, tasks, and prior progress artifacts were read. This rerun remained limited to C1/U1 and its four supplied edit surfaces; no C2, schema, route, UI, provider, Git, or non-test database work occurred.

### Completed corrective work

- Replaced the principal-manager catalog filter with its complete, explicit ordered permission array. It preserves every prior principal-manager permission, includes `PROPERTY_PROPOSALS_REVIEW`, excludes `PROPERTY_PROPOSALS_SELLER`, and cannot silently inherit a future seller-only catalog entry.
- Replaced containment-only permission coverage with exact ordered arrays for `PRINCIPAL_MANAGER`, `MANAGER`, and `AGENT`; the arrays prove both manager roles retain `ENGAGEMENTS_CREATE`, both manager roles receive review, and only the agent receives seller.
- Re-read `tasks.md`: both U1 implementation-owned checkbox lines remain visibly `- [x]`. The verification row is now substantiated by the prescribed API command passing in this rerun; no checkbox text was altered because its persisted completed state was already correct after that pass.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U1 permission remediation | API unit | Prescribed contract test: 5/5; prescribed API focused test: 7/7; API typecheck passed before corrective edits. | Exact arrays plus the non-derivation guard were added before mapping code; prescribed API run failed exactly 1/7 (`Object.values(PERMISSIONS)` present), with 6 passing. | Replaced the filter with the explicit principal array; prescribed API run passed 7/7. | Temporarily removed principal `ENGAGEMENTS_CREATE`; the exact-array test failed exactly 1/7, with 6 passing; restored the permission. | No production refactor was needed beyond the direct explicit array. Replaced `import.meta` with CommonJS-safe `__dirname` in the test helper; prescribed API run passed 7/7 after restoration. |

### Prescribed verification and cleanup

- PASS — `pnpm --filter @viewpro/contracts test`: 1 file, 5 tests passed.
- PASS — `DATABASE_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public' DIRECT_URL="$DATABASE_URL" pnpm --filter @viewpro/api exec vitest run src/common/filters/global-exception.filter.spec.ts src/permissions/property-proposals-role-permissions.spec.ts` (executed with both variables exported to that identical local `_test` URL): 2 files, 7 tests passed.
- PASS — `pnpm --filter @viewpro/api typecheck`.
- Used only `viewpro_test`; a post-test and post-cleanup local `pg_stat_activity` check reported zero non-idle connections across `viewpro_test` and `viewpro_test_w1`–`viewpro_test_w4`.
- Performed `pnpm install --offline --frozen-lockfile`, then `pnpm --filter @viewpro/api db:generate` before testing. Removed all workspace `node_modules`, generated contract `dist`, generated Prisma client with those dependency directories, caches, reports, uploads, and build metadata afterward; retained the local `_test` databases.

### Corrected delivery boundary and remaining work

The selected strategy is **sequential stacked-to-`develop` C1 → C20**, not feature-branch-chain. This corrective rerun is C1 only and remains within the 650-line C1 boundary. Current candidate accounting after the parent metadata correction is 49 tracked additions, 15 tracked deletions, and 233 untracked lines: 297 changed lines total. Remaining implementation work is unchanged and begins with these exact unchecked U2A lines:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR proposal, round, decision, source-link, enum, index, and check definitions against the tenant and deletion invariants. <!-- sdd-owner: implementation -->
- [ ] Run the manifest-scoped schema test, `db:validate`, and API typecheck without leaving database state. <!-- sdd-owner: implementation -->

Deferred lifecycle actions are the three parent-owned task rows, which were preserved byte-for-byte. No review, receipt, commit, push, PR, merge, or delivery gate action was started.

## Risks

- The exact-array test intentionally includes a narrow source-level non-derivation guard because current catalog values alone cannot demonstrate that a future seller-only permission would not be inherited; the three public role arrays remain exact behavioral assertions.
- Parent-owned lifecycle and review handling remain deferred; this executor did not start or approve review work.
