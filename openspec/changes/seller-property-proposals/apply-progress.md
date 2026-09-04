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

C1 is complete within its selected `auto-chain` sequential stacked-to-`develop` C1 → C2A → C2B → C3 … C20 boundary: U1 is forecast at 230–288 changed lines and is the current C1 slice targeting `develop`. The current candidate is cohesive and within the 650-line limit. No commit, push, PR, merge, review, or receipt action was performed.

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

The selected strategy is **sequential stacked-to-`develop` C1 → C2A → C2B → C3 … C20**, not feature-branch-chain. This corrective rerun is C1 only and remains within the 650-line C1 boundary. Current candidate accounting after the parent metadata correction is 49 tracked additions, 15 tracked deletions, and 233 untracked lines: 297 changed lines total. Remaining implementation work is unchanged and begins with these exact unchecked U2A lines:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR proposal, round, decision, source-link, enum, index, and check definitions against the tenant and deletion invariants. <!-- sdd-owner: implementation -->
- [ ] Run the manifest-scoped schema test, `db:validate`, and API typecheck without leaving database state. <!-- sdd-owner: implementation -->

Deferred lifecycle actions are the three parent-owned task rows, which were preserved byte-for-byte. No review, receipt, commit, push, PR, merge, or delivery gate action was started.

## Risks

- The exact-array test intentionally includes a narrow source-level non-derivation guard because current catalog values alone cannot demonstrate that a future seller-only permission would not be inherited; the three public role arrays remain exact behavioral assertions.
- Parent-owned lifecycle and review handling remain deferred; this executor did not start or approve review work.

## C2A Atomic Persistence Contract (corrective pass)
- **Status/tasks/TDD:** authoritative repo-local OpenSpec is `ready`; C1 → C2A → C2B → C3 is `auto-chain`, C2B precedes C3, no action-context warning occurred, U2A/U2B-core/U2C C2A rows remain `- [x]`, C2B rows remain `- [ ]`, and parent rows are unchanged. Retained truthful earlier U2 RED evidence; restore-schema parity was RED (2 failed/24 passed), GREEN (26/26), then TRIANGULATE failed when `property_proposals` was omitted and passed after restoration; no production behavior or refactor was needed.
### TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| C2A restore-schema parity | 2 failed/24 passed | 26/26 passed | Omitting `property_proposals` failed; restored 26/26 | None needed |
- **Verification/cleanup/paths:** clean-output offline install; `pnpm exec turbo run typecheck --filter=@viewpro/api --force` ran 6 tasks with 0 cached and generated Prisma; guarded `db:validate` and 4-file/32-test Vitest passed; pristine `viewpro_test_worker_c2a_pristine` applied all 32 migrations then dropped. Migrated-client `finally` removes source/direct engagements, asset, proposal, tenants, and user before disconnecting; fixture counts, non-idle `viewpro_test*` connections, and the dropped worker database were all zero. C2A paths are schema, additive migration, schema/migration/restore-schema-parity/registry specs, tenant registry, and five topology artifacts; no design deviation or C2B implementation occurred.
- **C2B/workload/risk:** pending exact rows are `- [ ] C2B: Extend the earlier U2B evidence with broad decision/check, planner/index, deletion/update, duplicate title/address, and production-shaped actual-DDL lock coverage.` and `- [ ] C2B: Add reusable dependency-ordered cleanup support, prove failure cleanup, and rerun the hardened migration/registry commands.` C2B owns S39/reusable cleanup and its actual-DDL lock risk; C2A is 611 additions + 38 deletions = 649 changed lines (649 target; 650 hard cap), with no commit, push, PR, merge, review, receipt, C2B, or C3 action.

## C2B1 S39 migration hardening

- **Status/scope:** C2B1 is ready and its task is `[x]`; its sole changed test is `apps/api/test/property-proposal-migration-hardening.spec.ts`. The unchanged C2A migration smoke remains regression evidence. C2B2 owns the reusable cleanup helper, exhaustive direct matrix, and migration-smoke teardown retrofit; C2B2 and C3 remain blocked.
- **RED/GREEN/TRIANGULATE:** the 40,000-row assertion first failed against the one-row candidate; 2 files/4 tests then passed. A wrong expected blocker PID failed before restoration; the hardening repeat passed 2/2. The lifecycle gate also rejected unbounded setup/polling/settlement before those paths were corrected.
- **Bounds:** URL options apply 8s normal, 30s builder, and 500ms observer statement timeouts; transactions, the 2s polling deadline, barriers, and final disconnects are bounded. Released writer/builder operations settle before sequential server-bounded drops, then disconnect.
- **DDL evidence:** the test parses the four actual ordinary source-index and `NOT VALID`/`VALIDATE` FK statements. A 40,000-row synthetic snapshot has 39,999 null sources and one linked source; the builder PID was observed waiting on the exact writer PID. Repeated full-DDL timings were 130.1ms, 127.4ms, and 150.3ms, below 30,000ms.
- **Verification:** offline frozen install; forced Turbo API typecheck 6/6 uncached; `db:validate`; exact two-file tests 4/4; API lint; hardening repeat 2/2, using only guarded localhost `viewpro_test`.
- **Postconditions:** scratch tables, `c2b-*` fixtures, `_test_worker_*` databases, and retained non-idle test connections were all zero. Dependencies, generated/build/test outputs, `.turbo`, and `*.tsbuildinfo` were removed.
- **Workload/risk:** 34 tracked additions + 17 deletions + 529 new test lines = 580 changed lines, within the 635 cap. The synthetic snapshot is bounded local evidence, not a production-cardinality or writer-continuity guarantee. No commit, push, PR, merge, C2B2, or C3 action occurred.

## C2B2 reusable cleanup helper and migration-smoke retrofit

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c2b2-cleanup
  allowedEditRoots: the eight user-supplied C2B2 paths
warnings: []
```

C2B2 was the selected `auto-chain` / `stacked-to-develop` work-unit after C2B1. Its implementation checkbox is now visibly `[x]`; C3 remains unchecked and blocked until C2B2 merges. Parent-owned lifecycle rows were not edited.

### Completed work and strict TDD evidence

- Added `test/property-proposal-cleanup.ts`, which creates its client inside the protected boundary, uses `runCleanupSteps`, deletes source engagements → captured orphan assets → proposals → tenants → users, and makes one final 5s-deadline disconnect.
- Added the direct 3-bit matrix in `test/property-proposal-cleanup.spec.ts`: all 8 work/cleanup/disconnect outcomes assert result or recursively flattened original error identities, exact call order, and one call per cleanup/disconnect; a 20ms never-settling-disconnect test passed in 22ms.
- Retrofitted the unchanged retained migration smoke to construct a URL with `connect_timeout=3`, `connection_limit=1`, and `options=-c statement_timeout=8000 -c lock_timeout=5000` before Prisma construction, then pass exact fixture IDs to the helper.

| Cycle | Evidence |
|---|---|
| RED | Authored the direct spec and migration import before the helper existed; after offline install and Prisma generation, both suites failed to import `./property-proposal-cleanup` with 0 tests collected. |
| GREEN | Forced Turbo API typecheck/generation passed 6/6 uncached; `db:validate` passed; cleanup direct + migration smoke + C2B1 hardening passed 3 files / 13 tests; API lint and the repeated direct spec passed 9/9. |
| TRIANGULATE | Temporarily reversed captured-orphan-asset and proposal cleanup; the matrix failed 8/9, all on exact call order, then passed again after restoration. |
| REFACTOR | Replaced conditional assertions with result/error-array comparisons for lint-readable matrix coverage; final focused suite and lint passed. |

### Verification, postchecks, and residue

- Used only guarded `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public` with matching `DIRECT_URL`, and only `pnpm install --offline --frozen-lockfile`.
- Exact C2B2 command set passed: forced uncached typecheck/generation; `db:validate`; three-file cleanup/migration/hardening suite; API lint; repeated cleanup spec.
- Postchecks returned `c2b_rows=0`, `proposal_fixture_rows=0`, `scratch_tables=0`, `worker_databases=0`, and `non_idle_test_connections=0`.
- Candidate arithmetic: 269 additions + 49 deletions = 318 changed lines, within the C2B2 hard cap of 635. Removed root/package `node_modules`, generated clients/dist, `.turbo`, caches, reports, uploads/test outputs, and `*.tsbuildinfo`; tracked `packages/contracts/src/generated/.gitkeep` remains.
- Residual risk: the helper's deadline bounds JavaScript settlement only; server-side cleanup statement bounds depend on each caller's URL options, which the migrated smoke now supplies before client construction. No commit, push, PR, merge, review, receipt, C3, runtime source, schema, migration, registry, or route action occurred.

## C3A / U3 corrective replay pass
- **Status/task:** authoritative OpenSpec was `ready` with repo-local allowed roots; both U3 rows remain visibly `[x]`, C3B/U4A was then unchecked and mandatory before C4, and parent rows were untouched.
| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U3 corrective pass | Matcher/enum-invalid tests: 7/27 failed, 20 passed. | Implementation: 27/27 passed. | Update-version bypass: 1/27 failed, 26 passed; restoration: 27/27 passed. | No further refactor was needed. |
- **Verification:** guarded matching localhost `DATABASE_URL`/`DIRECT_URL` used offline frozen install; full U3 passed 3 files/27 tests, forced `pnpm exec turbo run typecheck --filter=@viewpro/api --force` passed 6/6 uncached, API lint passed, and the U3 repeat passed 3/27.
- **Domain contract:** pure exported literals exactly mirror schema `PropertyType` (`HOUSE|APARTMENT|LAND|COMMERCIAL|OTHER`) and `PropertyOperationType` (`SALE|RENT`); blank enums normalize to null, unsupported nonblank enums throw, update replay snapshots only its explicit allowlist, and matchers deny version/patch, version/snapshot, and round/reviewer/outcome/reason differences while approved reasons canonicalize to null.
- **Postcheck/residue:** retained `viewpro_test_w1`–`w4` intentionally remain present, each has zero `property_proposals` rows, and zero non-idle test connections were observed; dependencies, generated/build/test residue, `.turbo`, and `*.tsbuildinfo` were removed while the generated `.gitkeep` remains.
- **Scope/budget/risk:** the six C3A domain files plus `tasks.md`, `task-delivery-plan.md`, `task-verification-commands.md`, and this progress artifact changed; no Prisma, HTTP, UI, capacity, C3B, commit, push, PR, or merge action occurred. The exact candidate is 522 additions + 15 deletions = **537 changed lines**, within the maintainer-approved 650-line C3A cap; these pure primitives still do not prove persistence, authorization, or capacity behavior.

## C3B / U4A shared capacity and direct-path compatibility
- **Status/scope:** authoritative repo-local OpenSpec is ready; C3B/U4A is complete, and this corrective pass formats only the capacity spec, restore callback, and progress artifact.
### TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| C3B/U4A | Capacity-spec import initially failed; compatible E2E remained regression evidence. | U4A passed **2 files / 43 tests**. | `notIn: []` failed the `CLOSED`/`CANCELLED` predicate **1/3**, then passed restored. | Readability-only formatting preserves transaction, outside catch, error mapping, and assertions. |
- **Verification:** offline frozen install and generated client; forced API Turbo typecheck passed **6/6 uncached**; U4A passed twice at **2/43**, C3A passed **3/27**, combined C3A+C3B passed **5/70**, and API lint passed.
- **Cleanup/postchecks:** guarded matching localhost `DATABASE_URL`/`DIRECT_URL` used only `viewpro_test`; fixtures, tenant limits, retained worker rows, and non-idle test connections were zero, then dependency/build/test residue was removed while `.gitkeep` remains.
- **Budget:** the full candidate is **288 additions + 72 deletions = 360 changed lines**, within the C3B **≤400** cap; readability uses recovered documentation budget, not code golf.
- **Blocker:** C4/U4B cannot begin until C3B merges; its next unchecked rows remain unchanged.
- **Risk:** movement-schema drift can break cleanup if movements stop referencing engagements compatibly; no C4, commit, push, PR, merge, review, or receipt action occurred.
- **CI fixture TDD:** exact repository RED was 2 failed/49 passed (`undefined.acquire`); typed resettable lease GREEN is 51/51, and temporary lease rejection triangulated direct create/active restore at 2 failed/49 passed before restoration.
- **Correction verification:** guarded matching localhost `DATABASE_URL`/`DIRECT_URL` passed U4A 2 files/43 tests, C3A+C3B 5/70, forced API Turbo typecheck 6/6 uncached, and API lint; only the repository fixture changed, with no design deviation.
- **Correction arithmetic:** this delta is 22 additions + 7 deletions = 29 changed lines (≤40); against `909ba5c7`, candidate total is 310 + 79 = 389 (≤400), C4 stays blocked, and C3B's `[x]` tasks remain unchanged.
