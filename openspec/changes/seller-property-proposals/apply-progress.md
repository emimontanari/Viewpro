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

## C4 / U4B + U5A correction
- **Status/scope:** native OpenSpec was `ready`/`apply` with repo-local root and no action-context warnings; the resolved `auto-chain` C4 boundary permits only these corrections, not C5+, lifecycle, Git, review, receipt, commit, push, PR, or merge work.
- **Corrections:** fixture assignment A is created and captured before B is created and captured, preserving data and `hasPrimary`; U5A retains the highest-safe page-50 case and adds `maxSafePageAtFifty + 1` → page 1/pageSize 50/skip 0.
- **Checkboxes:** persisted U4B and U5A implementation rows remain visibly `[x]`; all later implementation rows and parent-owned lifecycle rows are unchanged.
- **TDD:** retained materializer RED before its GREEN behavior and pagination RED (invalid `NaN`/`Infinity`, 1/4 failed) before GREEN (4/4); the fixture refactor used the 4-file suite as its approval safety net.
- **GREEN/TRIANGULATE:** retained prior pagination guard-mutant triangulation (each 1/4 failed); highest-safe and first-unsafe adjacent inputs now prove both page-50 overflow branches, and the new coverage passes without production-code changes.
- **Verification:** guarded local `viewpro_test`/matching `DIRECT_URL`: C4 4 files/22 tests passed after GREEN and again as the final repeat; C3A+C3B+C4 combined 9 files/92 tests passed; forced `pnpm exec turbo run typecheck --filter=@viewpro/api --force` passed 6/6 uncached; API lint passed; retained fresh full API evidence is 1499/1499.
- **Cleanup/postchecks:** fixtures cleaned in `finally`; `viewpro_test` and w1–w4 have zero proposal/canonical fixture rows and nondefault limits, and no non-idle test connections remain; generated/dependency/build/test residue is removed while `.gitkeep` remains.
- **Arithmetic:** 626 additions + 23 deletions = **649 changed lines** (≤650); no design deviation.
- **C5 blocker/risk:** C5 (U5B+U6) remains deferred to its 390–485-line slice after C4 lifecycle handling; exact unchecked rows: - [ ] RED → GREEN → TRIANGULATE → REFACTOR trusted tenant/proposer derivation, title-minimum draft creation, exact active `AGENT` eligibility, proposal-identity idempotency, duplicate title/address allowance, and no transport exposure. <!-- sdd-owner: implementation -->; - [ ] Run the manifest create spec and API typecheck; remove proposal/history fixtures in `finally`.; - [ ] RED → GREEN → TRIANGULATE → REFACTOR normalized expected-version patches, title-only saves, BORRADOR/RECHAZADA editability, locked-state conflicts, and inactive/role-changed seller races. <!-- sdd-owner: implementation -->; - [ ] Run the manifest specs and API typecheck; close worker transactions and clean proposals in every `finally`. The materializer intentionally remains unwired until U10A.

## C5A / U5B seller draft creation
- **Status/scope/tasks:** authoritative OpenSpec was `ready`/`apply`, repo-local with no action-context warning; selected stacked-to-`develop` C5A/U5B stays ≤325, both U5B rows remain `[x]`, and the next exact unchecked U6 rows are `- [ ] RED → GREEN → TRIANGULATE → REFACTOR normalized expected-version patches, title-only saves, BORRADOR/RECHAZADA editability, locked-state conflicts, and inactive/role-changed seller races. <!-- sdd-owner: implementation -->` and `- [ ] Run the manifest specs and API typecheck; close worker transactions and clean proposals in every finally. <!-- sdd-owner: implementation -->`; U6/C5B remains pending merge and parent-owned lifecycle rows are byte-for-byte unchanged.
<table><caption>TDD Cycle Evidence — clean redo selected by user</caption><thead><tr><th>RED</th><th>GREEN</th><th>TRIANGULATE</th><th>REFACTOR</th></tr></thead><tbody><tr><td>Final repository spec on clean C4: 4 read tests passed; 6 C5A assertions failed (concrete token and absent <code>createDraft</code>). Create spec first collected 0 from the missing module (collection-only, not behavior), then the compile-only skeleton collected 4 and failed all 4 behavior assertions.</td><td>Final backed candidate: focused 2 files/14 passed; C4+C5A 5/32; focused repeat 2/14.</td><td>MANAGER-predicate mutant: 1/10 failed (9 passed); reviewed final bytes restored.</td><td>No refactor planned; restore reviewed final bytes.</td></tr></tbody></table>
- **Chronological redo/verification:** this supersedes the earlier reconstructed-RED language; it is an actual clean strict-TDD redo, not a waiver. Offline frozen dependencies and generated Prisma client supported the clean C4 RED; final focused/regression/repeat passed 14/32/14, forced typecheck passed 6/6, lint passed, and full API passed 1,509/1,509 tests across 154 files. Guarded base+w1–w4 postchecks found zero proposal rows and zero non-idle connections; residue was cleaned. Candidate arithmetic is 301 additions + 23 deletions = 324 changed lines (≤325). Before deleting the ephemeral backup, the executor verified 9/9 non-progress candidate files byte-identical; their ordered final checksum-manifest digest is `sha256:bfda7c731774089e4e7dcc42415a7181ca40110e17ccb7755fffe3c937b059ef`. No C5B, commit, push, PR, merge, review, receipt, or delivery action occurred.

## C5B1 / U6 update, replay, and locks
Status consumed: authoritative `openspec`, `ready`/`apply`; repo-local target is the supplied C5B1 worktree and all edits are within its allowed roots, with no action-context warning.
```yaml
artifactStore: openspec
changeName: seller-property-proposals
applyState: ready
actionContext: { mode: repo-local, workspaceRoot: seller-property-proposals-c5b-updates-race }
delivery: auto-chain / stacked-to-develop, C5B1 372 changed lines (<400)
```
Completed and checked: C5B1’s update/lock/replay and focused-verification rows are `[x]`; repository owns one outer transaction, retains proposal → authoritative read → user → membership locking, maps safe absence/ineligible/conflict, and writes no rounds or canonical records.
Files: helper, update use case/spec, repository port/adapter/spec, module, and the four scoped OpenSpec artifacts; C5A retains its established user→membership path because refactoring its callback timing was not coherent in this bounded slice; no barrier/race implementation occurred.
Verification: offline frozen install and guarded matching localhost `_test` URLs; baseline repository 10/10; GREEN/repeat update+repository 34/34; C5A+C5B1 38/38; C4–C5 69/69; forced Turbo API typecheck 6/6 uncached; lint and full API 1533/1533 passed.
| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
| C5B1 | Missing use-case import collected 0; final repository behavior had 14 failures; skeleton behavior had 10 failures. | 34/34. | version increment 1 failed, replay equality 3 failed, tenant predicate 1 failed, role predicate 1 failed; restoration 34/34. | Extracted merged-title validation; focused suite stayed green. |
Original combined C5B objective was interrupted with zero final drift when the user selected this split; C5B2 has no claimed real-DB race evidence.
Remaining exact unchecked rows: `- [ ] C5B2: Add bounded barriers and prove inactive/role-changed seller create/update eligibility races with real PostgreSQL locks. <!-- sdd-owner: implementation -->`
`- [ ] C5B2: Run the guarded real-PostgreSQL race command repeatedly; close worker transactions, barriers, clients, and proposals in every \`finally\`. <!-- sdd-owner: implementation -->`
Workload boundary: C5B1 is the assigned 372-line slice (<400); C5B2 is blocked until C5B1 merges, and C6+ is unchanged. Cleanup and postchecks follow before handoff; no commit, push, PR, merge, review, receipt, C5B2, or C6 action occurred.

## C5B1 correction: locked replay state ordering
- Corrected `sha256:4eb92f7e5d3fbe4e0ab0d13a8cc8b78574b60a1629d550b47f0b95b79bf8d9b0`: editability now follows the scoped authoritative reread and seller eligibility lock, before replay classification.
- Strict TDD: the new EN_REVISION expected+1 empty-patch regression was RED at 1 failed/24 passed (`replayed` received), then GREEN at 25/25 after the reorder; final repository coverage is 28/28.
| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
| C5B1 locked-state correction | 1 failed/24 passed (`replayed`) | 25/25 passed after reorder | 3/28 failed, then 28/28 restored | None needed |
- TRIANGULATE: negating replay equality failed 3/28 (exact/empty replays became conflicts and a different patch replayed); restored equality passed 28/28.
- Coverage proves APROBADA and EN_REVISION replay-shaped conflicts/no writes, RECHAZADA preservation, current-version empty updates, exact SQL bindings, deferred lock chronology, and no review-round/canonical writes.
- Verification passed: focused update/repository 38/38 twice, C5A+C5B1 42/42, C4-C5 regression 60/60, forced uncached typecheck 6/6, and lint; full API remains deferred to independent re-gate.
- Corrected C5B1 candidate arithmetic is 248 additions + 15 deletions + 109 untracked source/test lines = **372 changed lines** (<400); C5B2/tasks/topology remain unchanged, and no `size:exception` is required.

## C5B2 / U6 final #306 remediation — maintainer-approved under-400 candidate

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c5b2-eligibility-races
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-proposal-eligibility-race.spec.ts
    - viewpro-app/apps/api/src/property-proposals/helpers/lock-property-proposal.ts
    - viewpro-app/apps/api/src/property-proposals/prisma-property-proposals.repository.ts
    - viewpro-app/apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
    - openspec/changes/seller-property-proposals/task-delivery-plan.md
    - openspec/changes/seller-property-proposals/task-verification-commands.md
  warnings:
    - Native status command was unavailable; this authoritative OpenSpec status was reconstructed from the supplied change and readable artifacts.
```

The delivery path is the explicitly selected `auto-chain` / `stacked-to-develop` C5B2 slice. The maintainer approved expansion of this cohesive boundary from 250 to `<400`, so no `size:exception` is needed. C6+ and parent-owned lifecycle rows remain deferred. The prior rejected-at-250 evidence digest was `sha256:f7b1262fc633b422366d005fc1e622ad4a72115f0512506172e8ad5a295951d8`.

### Mandatory clean-redo chronology

1. Copied all eight C5B2 candidate paths to an ephemeral `/tmp/c5b2-rejected-306.*` backup, restored the seven tracked paths to clean C5B1 base `0e422fea`, and removed the untracked race spec before dependency installation or any C5B2 test/source edit.
2. Ran `pnpm install --offline --frozen-lockfile`, `pnpm --filter @viewpro/api db:generate`, the guarded local `_test` check, and the C5A+C5B1 safety net before the first C5B2 edit: 3 files / **42 passed (42)**.
3. Added the corrected race spec first. The missing runtime export made all eight parameterized cases and `afterAll` fail with `TypeError: setEligibleSellerLockBarrierForTest is not a function`; this was setter-collection/harness failure, not behavior RED.
4. Added only a compile/no-op setter and ran one command-lock-first case. It failed in **55 ms** (`operation command fulfilled before eligibility barrier arrival`), rather than waiting for Vitest's timeout; the full command elapsed 2.426 s including startup.
5. Added the production barrier implementation and shared create/update eligibility path, then ran race GREEN twice at 8/8. The barrier-before-membership mutant failed the bounded command-lock-first case in **2.051 s** with `invalidation PID 23547 did not block on operation PID 23545`; restoring the membership-lock-first barrier returned GREEN.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| C5B2 eligibility races | Clean C5A+C5B1 local safety net: **3 files / 42 passed** before any C5B2 test/source edit. | Missing setter was harness-only; the no-op setter then produced concrete behavior RED: one command-lock-first case failed in 55 ms because the command fulfilled before barrier arrival. | Race matrix passed 8/8 on two GREEN runs and a final rerun; focused C5A+C5B1+C5B2 passed 4 files / 50 tests; C4–C5 independently passed 7 files / **68 tests**. | Moving the barrier before the exact active-AGENT membership lock failed a bounded case after 2.051 s because the invalidation PID did not block on the operation PID; restoration passed. | The corrected test races barrier arrival against command settlement and a 2 s deadline, precomputes cleanable identities before protected setup, and preserves primary, settlement, and cleanup failures without masking. |

### Final verification evidence

- PASS — guarded local `_test` race matrix: 8/8, run three times after production implementation/restoration.
- PASS — focused C5A+C5B1+C5B2: 4 files / 50 tests.
- PASS — C4–C5 regression: 7 files / **68 tests**.
- PASS — `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: 6/6 uncached tasks.
- PASS — `pnpm --filter @viewpro/api lint`.
- PASS — bounded full local API suite: 156 files / 1545 tests.

### Final completion and candidate arithmetic

The source/test diff remains **19 additions + 19 deletions + 256 untracked race-test lines = 294 changed lines** against `0e422fea`. Every OpenSpec line is included in the final **374 changed-line** candidate: 66 additions in this progress artifact, 2 additions + 2 deletions in `tasks.md`, 4 additions + 4 deletions in `task-delivery-plan.md`, and 1 addition + 1 deletion in `task-verification-commands.md`. The normal `<400` budget is met without code golf or a size exception.
The docs-only closure preserved all four C5B2 source/test file SHA-256 values before and after its OpenSpec edits.

Persisted completion: both implementation-owned C5B2 rows are visibly `[x]`; C6 is blocked pending parent lifecycle and its exact unchecked U7 rows remain `- [ ] RED → GREEN → TRIANGULATE → REFACTOR six-field submission, locked-row snapshotting, round numbering, retained history, rejected-edit versus explicit resubmit, and replay identity. <!-- sdd-owner: implementation -->` and `- [ ] Run the manifest submit specs and API typecheck; delete rounds before proposals in every \`finally\`. <!-- sdd-owner: implementation -->`; all parent-owned lifecycle rows are unchanged.

The two previous failure outcomes are superseded/remediated by this final candidate: the setter-collection/no-op-barrier failure that exposed early command settlement was fixed by the exported post-membership-lock hook, and the former 250-line budget rejection is resolved by the maintainer-approved `<400` boundary. The deliberate barrier-before-membership mutant still fails bounded lock observation and was restored before final GREEN.

No design deviation was made. No commit, push, PR, merge, review, receipt, C6+, or parent lifecycle action occurred.

### Postchecks and residue

The explicit base plus `viewpro_test_w1`–`viewpro_test_w4` PostgreSQL postcheck reported `proposal=0,membership=0,user=0,tenant=0` and `non_idle_c5b2=0` for every database. Cleanup released/reset barriers and settled command/invalidation promises before idempotent `deleteMany` cleanup; the suite `afterAll` disconnects every named client through failure-continuing `Promise.allSettled`. The ephemeral backup was removed after the current checksum manifest was recorded. Recursive dependency/build residue cleanup removed all `node_modules`, `.turbo`, and `*.tsbuildinfo`; `packages/contracts/src/generated/.gitkeep` remains.

## C6A / U7 initial BORRADOR submission

### Status and delivery
```yaml
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext: { mode: repo-local, workspaceRoot: seller-property-proposals-c6-submission, warnings: [] }
delivery: auto-chain / stacked-to-develop; C6A only
```
C6A is complete: its two persisted implementation rows are `[x]`; C6B remains blocked until C6A merges.

### TDD Cycle Evidence
| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| C6A submit/snapshot | C5 create/update/repository/race: 50/50 | Missing module collected 0; skeleton behavior RED 11/11 and repository RED 11/39 failures. | Focused submit/repository 50/50. | `increment: 0` failed 1/50; restored 50/50. | No further refactor needed. |

### Verification and scope
- PASS: C5+C6 72/72; C4-C6 90/90; forced uncached typecheck 6/6; lint; focused repeat 50/50; full API 157 files/1567 tests; final independent gate passed focused C6A 51/51, C5+C6A 73/73, C4-C6A 91/91, forced typecheck 6/6, lint, focused repeat 51/51, and full API 157 files/1568 tests; regressions prove durable version 1 against expected version 2 conflicts with no round/update and round creation precedes proposal update; final arithmetic is 203 tracked additions + 22 tracked deletions + 91 untracked lines = 316 changed lines (≤325).
- Changed allowed C6A use-case, mapper, port, adapter, module, seller-lock helper, focused tests, and topology/tasks/commands/progress artifacts; no controller, DTO, AppModule, BFF, UI, canonical, decision, or replay work.
- The transaction locks scoped proposal → reread → user → exact active AGENT membership, validates locked normalized data, then writes exactly one round/update with one timestamp and version +1; generic write failures remain transactional.

### Remaining, cleanup, and risk
- [ ] C6B: RED → GREEN → TRIANGULATE → REFACTOR RECHAZADA-only explicit resubmit, retained prior history, next-round numbering, and exact replay. <!-- sdd-owner: implementation -->
- [ ] C6B: Run the replay/history command and API typecheck; delete rounds before proposals in `finally`. <!-- sdd-owner: implementation -->
- C6A/C6B split updates the source topology from 25 to 26 groups; C6B is the mandatory post-merge blocker. No design deviation, commit, push, PR, merge, receipt, or review action occurred.

## C6B / U7 rejected resubmission, history, and exact replay

### Status consumed and delivery
```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
dependencies: { apply: ready }
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c6b-resubmission
  allowedEditRoots: user-supplied C6B source/test and OpenSpec paths
  warnings: []
nextRecommended: apply
```
The parent-selected delivery path is `auto-chain` / `stacked-to-develop`; this is the C6B-only work-unit after merged C6A. Both C6B implementation rows are visibly `[x]`; C7+ and all parent-owned rows remain unchanged.

### Completed behavior and strict TDD evidence

| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| C6B resubmit/history/replay | Clean C5+C6A: 4 files / 65 tests passed before edits. | New behavioral repository tests failed 3/7: `RECHAZADA` returned conflict, exact replay returned conflict, and a forced round failure never reached the insert. | C6B replay/history plus repository coverage passed 2 files / 48 tests. | Mutating next-round calculation to reuse the prior durable number failed 1/7; restoration passed. | Reused the existing immutable snapshot/replay primitives; no further refactor was needed. |

- `RECHAZADA` is now the only added explicit submission state; `BORRADOR` remains C6A's round-one path.
- The transaction retains proposal → reread → user → exact active-`AGENT` membership locks, snapshots all 18 normalized staged scalars from the locked proposal, appends `latestRound.roundNumber + 1`, uses one timestamp for round/proposal, transitions to `EN_REVISION`, and increments version once.
- Exact replay requires `EN_REVISION`, durable version `expectedVersion + 1`, and equality between the locked staged snapshot and latest durable round; it returns the durable proposal/round with no create/update. Stale, future, snapshot-near-match, approved, scoped-absence, ineligible, and incomplete outcomes remain conflict/safe as applicable.
- Round and proposal-update failures reject through the outer transaction; no decision, canonical, controller, DTO, BFF, UI, or C7 code was changed.

### Verification and cleanup

- PASS — guarded local `viewpro_test` C6B command: replay/history and repository coverage, 2 files / 48 tests.
- PASS — forced API Turbo typecheck: 6/6 uncached tasks; direct API typecheck initially exposed the existing generated-contract prerequisite, so the normative C6B command now uses Turbo generation.
- PASS — API lint.
- PASS — C5+C6 regression: 5 files / 73 tests.
- No database fixtures, rounds, or proposal rows were created by the mock-focused suites; postchecks and recursive generated/dependency/build cleanup are recorded with final candidate arithmetic below.

### Remaining work, boundary, and risks

- Exact next unchecked implementation row: `- [ ] RED → GREEN → TRIANGULATE → REFACTOR both reviewer roles, tenant-scoped all-state reads, pending/newest defaults, state/history AND filters, pagination limits, safe result visibility, and search rejection boundary; add S15's repository EXISTS/AND RED only after U5A's scoped-read edit. <!-- sdd-owner: implementation -->`
- Candidate arithmetic is 96 tracked additions + 28 tracked deletions + 92 untracked replay-test lines = 216 changed lines, within the 400-line C6B boundary in the retained 26-group topology. No code golf or size exception was used; parent lifecycle, review, receipt, commit, push, PR, merge, transport/UI, external services, and C7+ are deferred.
- Residual risk: no real PostgreSQL resubmission race is claimed here; C6B's proposal row lock plus durable history query are unit-proven, while later verification owns broader integration/concurrency evidence.

## C6B #306 independent-review corrective cycle

### Status, scope, and persisted tasks

Manual authoritative OpenSpec status was consumed because no parent status was supplied: `seller-property-proposals`, `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`, `mode: repo-local`, workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c6b-resubmission`, with the user-supplied C6B roots only and no action-context warning. The `auto-chain` / `stacked-to-develop` C6B slice is explicitly authorized. Both C6B implementation rows remain visibly `[x]`; C7+ and all parent-owned rows remain unchanged.

### Corrective chronology and TDD Cycle Evidence

| Task | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| C6B uniqueness, replay, ordering, and rollback correction | Offline frozen install, generated client, and C6A/C6B safety net passed 3 files / 59 tests. Test-first corrective matrix then failed exactly 1 of 65: Prisma P2002 `target: ['proposalId','roundNumber']` escaped instead of reaching the stable use-case conflict; all 18 mismatch, order, and stateful-fake behaviors already exercised existing code. | Added only a narrow P2002 predicate around `submitForSeller`; focused C6A+C6B/repository/use-case coverage passed 3 files / 82 tests. | Replacing the narrow predicate with all P2002 failed exactly 1 of 31 replay tests because an unrelated `['tenantId','id']` P2002 became `{kind:'conflict'}`; restored predicate passed 82 focused tests. | Restored retained C6B stale/future/approved, round-failure, and update-failure tests; no production refactor beyond the narrow error mapping. |

- The adapter maps only `PrismaClientKnownRequestError` P2002 metadata identifying the `(proposalId, roundNumber)` constraint (field pair or its generated constraint name) to `{kind:'conflict'}`; other failures propagate. The composed repository/use-case test proves `PROPERTY_PROPOSAL_STATE_CONFLICT` / 409.
- The parameterized replay matrix rejects mismatch of every 18 staged snapshot fields, including nullable numeric/string values and distinct `PropertyType` / `PropertyOperationType` enum values, with no new round or proposal update.
- An explicit event trace proves proposal lock → authoritative reread → active-user lock → exact active-AGENT membership lock → latest-round read → round create → proposal update. A stateful transactional fake commits only on successful callback completion; both injected round and update failures leave the full prior round snapshot and `REJECTED` decision/reason unchanged. This is transaction-contract evidence, not a claim of PostgreSQL resubmission integration coverage.

### Verification, blockers, and accounting

- PASS: guarded localhost `viewpro_test` C5+C6 including C5B2 race, 6 files / 104 tests; corrected C4-C6 repeat, 9 files / 122 tests; C6 focused repeat, 3 files / 82 tests; forced uncached API Turbo typecheck, 6/6; API lint.
- The first C4-C6 run had one 5s timeout in the unmodified primary-concurrency test; its isolated rerun passed 14/14 and the complete 9-file rerun passed 122/122.
- BLOCKED (unrelated): fresh guarded full API `vitest run --retry=0` completed 157/158 files and 1598/1599 tests, failing only `test/restore-schema-parity.spec.ts` SIGTERM/SIGINT forwarding. It is outside C6B edit roots and was not changed.
- Prior arithmetic is corrected: source/test `159` plus OpenSpec `57` was `216` before correction. Final candidate is **136 tracked additions + 29 tracked deletions + 147 untracked lines = 312 changed lines**, within the 400-line C6B boundary; topology remains 26 groups and the evidence matrix remains 49 scenarios.
- No design deviation, PostgreSQL resubmission test, commit, rebase, push, PR, merge, C7, transport/UI, provider, or external-service work occurred. Postchecks found `0|0|0` proposal/round/decision rows in `viewpro_test` and w1–w4 plus zero non-idle test connections; node_modules, `.turbo`, and `*.tsbuildinfo` were removed, while tracked `packages/contracts/src/generated/.gitkeep` remains. The only residual risk is the explicitly unclaimed real-PostgreSQL resubmission-race proof; the stateful fake proves rollback semantics for the repository transaction contract.

## C7A1 reviewer-filter isolation

### Status and scope

- Consumed authoritative native status: `seller-property-proposals`, OpenSpec, `applyState: ready`, 31/77, repo-local workspace and sole allowed root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7-reviewer-reads`; no action-context warnings.
- C7A1 only: retained `review-filter-builder.ts` and its spec; reverted the C7A2 repository port/Prisma/spec delta to `7190f997`, removed four zero-byte C7B use-case placeholders, and confirmed no module or use-case wiring. C7A2 and C7B remain unchecked.
- OpenSpec now orders C7A1 → C7A2 → C7B in 28 groups: S15 RED is C7A1, repository GREEN is C7A2, and S11/S14 stay C7B.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| C7A1 pure builder / S15 RED | Clean redo evidence retained; initial current-builder run passed 18/18. | Observed clean redo skeleton failed 6/6 behavior assertions before the builder implementation; the later PENDING correction had 3 failed/70 passed before restoration. No new RED was fabricated. | Focused builder passed 18/18 before and after verification. | Retained mutations of outcome, round/decision tenant correlation, and highest-safe offset failed and were restored. | Defaults/constants remain explicit; no refactor beyond the retained pure builder. |

### Verification, cleanup, and boundary

- PASS: offline frozen install; Prisma generation; focused builder 18/18; forced uncached API Turbo typecheck 6/6; API lint; focused repeat 18/18; guarded localhost `viewpro_test` full API retry-0 159 files/1617 tests.
- Cleanup/postcheck: base plus `viewpro_test_w1`–`w4` each reported `0|0|0` proposal/round/decision rows and zero non-idle connections. Dependency, generated, build, and cache residue is removed after this record.
- No repository consumption, role/use case, U10B result, write, transport, UI, search, C7A2, C7B, C8, external, commit, rebase, push, PR, merge, review, or receipt work occurred. Final arithmetic is **188 untracked source + 58 tracked additions + 18 tracked deletions = 264 changed lines (≤400)**.

## C7A1 evidence-ownership correction and independent recheck

### Status and gate result

- Consumed native `gentle-ai sdd-status seller-property-proposals`: OpenSpec `applyState: ready`, `next: apply`, `31/79` tasks complete, repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7-reviewer-reads`, and that workspace as the sole allowed edit root.
- The independent gate returned `CHANGES_REQUIRED`: C7A1 falsely claimed exact reviewer ordering even though the selected sequence is C7A1 filter/pagination → C7A2 repository/Prisma → C7B use cases.
- Failed runtime evidence supplied by that gate is `sha256:68a0a26a4af8a22553fffb517c5db4aaa328c09a0e3b7bf68605e5c058162d37`.

### Corrected ownership and verification state

- C7A1 remains checked and owns only the approved byte-identical filter primitives and pagination; it no longer claims `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC`.
- C7A2's unchecked repository GREEN task now explicitly owns that exact ordering and its repository/order evidence remains pending; C7B remains the unchecked S11/S14 use-case boundary.
- The correction changed no production or test bytes. Its independent recheck passed metadata consistency, fresh offline install, forced uncached typecheck 6/6, focused builder 18/18, `git diff --check`, guarded-localhost database postchecks, and recursive residue cleanup.
- Canonical tracked-plus-untracked candidate digest `sha256:a7674772e447d7a47b7e72dd7ad0d25692616367e33fae75cfe3fe840af2869e` reproduced after cleanup. Runtime evidence `sha256:7c2a4d9cadd9e9e212cc731155522c3b392d58d9e1e166420a128f9f1c679f31` settled C7A1 passed and remediated the failed gate.

### Byte preservation and arithmetic

- Builder bytes remain `review-filter-builder.ts` `sha256:9bc112b23dc654bef7244b983cd0ed21f96930c9e7c59df9e5c837997893e4dd` and `review-filter-builder.spec.ts` `sha256:fdb272fd36995420971b0298d0765ca0774b27f9f0548c4369c3138c5886e46b`; the three repository files remain byte-identical to base `7190f997`.
- Exact current-candidate arithmetic is `188` untracked builder/source-test lines + `78` tracked metadata additions + `18` tracked metadata deletions = **284 changed lines** (≤400). No source/test arithmetic is reassigned from C7A1 to C7A2; the 20-line metadata increase over the prior 264-line record is this evidence correction.
