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

## C7A2 / #306 reviewer repository

### Status, scope, and completion

- Consumed native status for `seller-property-proposals`: OpenSpec `applyState: ready`, `next: apply`, `31/79`, exact workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7a2-reviewer-repository`, and repo-local allowed root with no warning.
- Added only the C7A2 reviewer port, Prisma list/detail adapter, and repository spec. Both C7A2 implementation-owned task rows are visibly `[x]`; C7B and all parent-owned rows are unchanged.
- `listForReviewer` normalizes once, shares `buildReviewerWhere` with count, binds tenant/state/history/skip/limit through `Prisma.sql`, uses the exact fallback/tie order, hydrates with tenant plus IDs, restores raw order, and omits an ID deleted before hydration. `findForReviewer` scopes only tenant plus ID and returns identical `null` absence.

### TDD Cycle Evidence

| Cycle | Exact observed evidence |
|---|---|
| Safety net | `pnpm install --offline --frozen-lockfile`; `pnpm --filter @viewpro/api db:generate`; guarded `_test` focused repository command: **40/40 passed**. |
| RED | Test-first reviewer cases initially collected and failed **6/46** only because methods were absent. After the compiling empty skeleton, the same command failed **6/46** on concrete empty-result, missing count/raw calls, and unscoped-detail assertions. |
| GREEN | Smallest port/adapter implementation passed guarded focused repository coverage: **46/46**. |
| TRIANGULATE | Restored mutants failed as required: outer raw tenant **1/46**, divergent count tenant **5/46**, fallback/tie ordering **1/46**, and scrambled hydration order **1/46**. The final matrix covers `NONE`, `PENDING`, `REJECTED`, `APPROVED`, default and page-2/50 pagination, exact bindings, all tenant correlations, count parity, deletion omission, and detail absence. |
| REFACTOR | Replaced a conditional Vitest assertion after lint rejected it; focused coverage, lint, and the repeat all passed with behavior unchanged. |

### Verification and cleanup

- PASS — guarded `_test` focused repository spec retry-0: **46/46** (GREEN, refactor, and repeat).
- PASS — `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: **6/6 uncached**.
- PASS — `pnpm --filter @viewpro/api lint`; the prior combined run stopped at the temporary test-only `no-conditional-expect` violation, then passed after its refactor.
- PASS — guarded bounded full API `vitest run --retry=0`: **159 files / 1623 tests**.
- Postcheck: `viewpro_test` plus `_w1`–`_w4` each had `0/0/0` proposal/round/decision rows; `pg_stat_activity` had zero non-idle test connections. No query fixture rows required deletion.

### Workload, arithmetic, and remaining work

- Assigned boundary is C7A2 / `C7A2-reviewer-repository-prisma`, `auto-chain` / stacked-to-develop, maximum **400** changed lines. No design deviation, relation include, mapping, actor/role input, command, C7B, transport, schema, Git, review, or delivery action occurred.
- Before artifact closure: 121 tracked additions plus the already-created 98-line exploration artifact = 219 changed lines. Final arithmetic is recorded after residue cleanup; it includes the C7A2 task/progress closure and that exploration artifact.
- Next implementation work is C7B only: `- [ ] RED → GREEN → TRIANGULATE → REFACTOR both reviewer roles, tenant-scoped all-state use-case reads, pending/newest defaults, and safe result visibility. <!-- sdd-owner: implementation -->` and `- [ ] Run the C7B reviewer-use-case specs and API typecheck; clear query fixtures and reviewer rows. <!-- sdd-owner: implementation -->`.
- Chronological commands/results: `pnpm install --offline --frozen-lockfile` PASS; `pnpm --filter @viewpro/api db:generate` PASS; guarded `pnpm --filter @viewpro/api exec vitest run src/property-proposals/prisma-property-proposals.repository.spec.ts --retry=0` was 40/40 baseline, 6/46 absent-method pre-RED, 6/46 behavioral-skeleton RED, then 46/46 GREEN; its four restored mutants were 1/46, 5/46, 1/46, and 1/46 failures; final focused run was 46/46; forced Turbo typecheck was 6/6; lint first failed only `no-conditional-expect`, then focused/lint/repeat were 46/46/PASS/46/46; guarded `pnpm --filter @viewpro/api exec vitest run --retry=0` was 159 files/1623 tests.
- Final candidate arithmetic after cleanup is 157 tracked additions + 2 tracked deletions + 98-line already-created exploration artifact = **257 changed lines**, within C7A2's 400-line maximum.

## C7B / #306 reviewer read use cases

### Status, scope, and completion

- Consumed native `gentle-ai sdd-status seller-property-proposals`: OpenSpec `applyState: ready`, `next: apply`, `33/79` complete, exact repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c7b-reviewer-use-cases`, and that workspace as the sole allowed edit root; no action-context warnings.
- Added only the four C7B manifest files. The exploration artifact `explore-c7b-reviewer-use-cases.md` was read as authoritative C7B planning input and is included in the candidate arithmetic.
- Both implementation-owned C7B task rows are now visibly `[x]`; no parent-owned row was changed. Status is consequently `35/79` complete.

### Completed behavior

- Each injected repository use case explicitly allows only `MANAGER` or `PRINCIPAL_MANAGER` with `PROPERTY_PROPOSALS_REVIEW`; AGENT, unsupported, role-only, and forged-capability contexts throw `new ForbiddenException('Insufficient permissions')` before either read.
- List passes trusted `tenant.tenantId` and the original filter object to `listForReviewer`, returns repository item order unchanged, and uses `normalizeReviewerRead` only for response `page`/`pageSize` metadata.
- Detail reads all states through `findForReviewer({ tenantId, proposalId })`; both missing and cross-tenant null results produce the exact coded `PROPERTY_PROPOSAL_NOT_FOUND` 404.
- No self-review denial, writes, repository/filter/module changes, canonical-result/source mapping, transport, route, DTO, BFF, UI, schema, migration, or C8+ work was introduced.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| C7B list/detail reads | Specs were authored first; after a minimal importable skeleton, collected behavioral assertions failed **16/16** on absent authorization, trusted repository calls, order/page metadata, and coded absence (not missing-import or zero-collection failure). | Smallest repository-DI implementation passed focused **2 files / 16 tests**. | Restored mutants failed: principal role removal **2/16**, role/capability conjunction **3/16**, tenant propagation **8/16**, local list reverse/page rewrite **4/16**, and 404 mapping/result leakage **4/16**. | No refactor was needed; the two short local explicit allowlists preserve the four-file boundary. |

### Verification, cleanup, and arithmetic

- PASS — offline frozen install and Prisma generation; guarded localhost `viewpro_test` focused C7B tests retry-0: **2 files / 16 tests**, then repeated **16/16**.
- PASS — forced uncached `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: **6/6**; the first forced pass exposed only an inferred `Set` type mismatch, corrected to `Set<TenantRole>` before the successful run.
- PASS — `pnpm --filter @viewpro/api lint`; guarded bounded full API `vitest run --retry=0`: **161 files / 1639 tests**.
- Postchecks: `viewpro_test` and `_w1`–`_w4` each report `0/0/0` proposal/round/decision rows and `pg_stat_activity` reports zero non-idle test connections; query fixtures and reviewer rows required no deletion.
- Recursive cleanup removed dependency/generated/build/report/upload/cache residue, `.turbo`, coverage, and `*.tsbuildinfo`; `packages/contracts/src/generated/.gitkeep` remains. `git diff --check` passes.
- Final candidate arithmetic after cleanup is **37 tracked additions + 2 tracked deletions + 292 untracked lines = 331 changed lines**; it remains bounded by the active C7B **400-line** work-unit cap, with no size exception, compression, commit, rebase, push, PR, merge, review, receipt, provider, staging, or production action.

### Remaining work and boundary

- C7B is complete within the parent-selected `auto-chain` / stacked-to-`develop` C7B slice. The next implementation-owned rows are the U9 rejection/replay rows; parent lifecycle rows remain deferred and byte-for-byte unchanged.
- Residual risk: this use-case boundary intentionally does not wire a module or transport and intentionally defers durable self-review denial to U9 and viewer-specific canonical-result disclosure to U10B.

## C8A / U9 rejection, replay, and transition conflicts

### Status and delivery boundary

```yaml
artifactStore: openspec
changeName: seller-property-proposals
applyState: ready
nextRecommended: apply
status: native 35/79 before C8A; exact repo-local workspace seller-property-proposals-c8a-rejection
allowedEditRoots: user-supplied C8A source/spec and OpenSpec paths
workUnit: C8A/U9 only; auto-chain / stacked-to-develop; max 400 changed lines
```

- The native status command confirmed this worktree and `apply: ready`; the two U9 rows are now visibly `[x]` after all required gates. C8B/U10A and every parent-owned row remain unchanged.
- Added only the rejection use case, pure transition helper, and their colocated specs. There is no repository, schema, module, controller, DTO, approval/materializer, canonical, notification, analytics, or UI change.
- Rejection validates unknown direct input before the transaction, locks the tenant-scoped proposal then sorted users and sorted exact memberships with `FOR NO KEY UPDATE`, checks current reviewer authority and durable self-review before replay, appends one normalized `REJECTED` decision, then moves the proposal to `RECHAZADA` with one version increment.

### TDD Cycle Evidence

| Task | Safety net / RED | GREEN | TRIANGULATE and mutation evidence | REFACTOR |
|---|---|---|---|---|
| U9 rejection and conflict helper | New specs first failed to import (0 collected); a compiling skeleton then produced **12/12 collected behavioral failures**. | Focused specs passed **2 files / 12 tests**. | Authority-before-replay, durable self-review, user-lock order, reason normalization, exact replay, competing conflict, and decision-before-proposal-update rollback mutants each failed and were restored. | Removed an unused test helper; focused specs remained green. |

### Verification, cleanup, and arithmetic

- PASS — offline frozen install, Prisma generation, guarded localhost `_test` focused specs retry-0: **2 files / 12 tests**, then repeated **12/12**.
- PASS — forced uncached `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: **6/6**; `pnpm --filter @viewpro/api lint`; bounded guarded-localhost `pnpm --filter @viewpro/api exec vitest run --retry=0`: **163 files / 1651 tests**.
- Cleanup deleted decisions → rounds → proposals in `viewpro_test` and `viewpro_test_w1`–`viewpro_test_w4`; each reports `0|0|0`, and `pg_stat_activity` reports zero non-idle test connections. The operation creates no canonical rows, so no asset cleanup was needed.
- Topology truth is now 29 groups: C8A is U9 rejection/replay/conflicts and C8B is future U10A approval materialization; C9–C20 names are unchanged.
- Initial physical arithmetic is **268 changed lines**: 47 tracked additions + 9 tracked deletions, 22 exploration lines, and 190 source/test lines. The former 282 figure falsely counted a 36-line exploration allocation instead of the actual 22-line file; the independent correction below records the final physical total. Recursive dependency/generated/build/report/upload/cache, `.turbo`, coverage, and `*.tsbuildinfo` cleanup follows; the tracked generated `.gitkeep` is preserved.

### Remaining work and risks

- C8B/U10A is the next unchecked implementation boundary; U9 does not wire the future transport/module surface or alter C6 explicit resubmission behavior.
- The pre-correction fake was not stateful and did not prove rollback durability; the independent correction below replaces that claim with a staged, rollback-capable fake. The later verification work owns broader real-PostgreSQL competing-transition race evidence.

## C8A / U9 independent evidence correction

### Scope and strict TDD chronology

- Consumed native OpenSpec status: `seller-property-proposals`, `applyState: ready`, `nextRecommended: apply`, 37/79 completed, with this C8A worktree as the repo-local allowed edit root. The acquired correction attempt and `auto-chain` C8A boundary leave at most 154 lines before the 400-line cap; no task, topology, delivery-plan, commit, rebase, push, PR, merge, review, or receipt action was taken.
- Expanded only the allowed U9 specs and this progress artifact. The rejection/conflict production bytes remain unchanged because no newly added assertion exposed a production contract defect.

| Cycle | Truthful evidence |
|---|---|
| RED | Assertions and the rollback fake were added first. The first focused run failed 3 tests: an `undefined` default in the new test helper hid invalid input, raw lock bindings were read from template strings rather than mock arguments, and former-reviewer denial was incorrectly expected to carry a conflict code. These were test-harness expectation errors, not production defects. |
| GREEN | After correcting the test helper and bindings, the focused U9 command passed 2 files / 15 tests without production changes. The former-reviewer case now uses a durable exact replay shape plus lost `AGENT` authority and proves 403 denial/no writes before replay. |
| TRIANGULATE | Mutating `> 1000` to `>= 1000` failed the exactly-1000 acceptance assertion; mutating exact reviewer identity `===` to `!==` failed both pure and use-case exact-replay assertions. Both mutations were restored. |
| REFACTOR | Replaced the prior non-stateful rollback assertion with a transaction fake that stages a decision, restores durable decisions and proposal state on update failure, and asserts no durable decision or state change. |

### Corrected evidence

- Exact coded outcomes are asserted for self-review 403 `PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN`, missing and cross-tenant proposal-lock absence 404 `PROPERTY_PROPOSAL_NOT_FOUND`, and actor/reason/outcome/state/missing-round competing variants 409 `PROPERTY_PROPOSAL_STATE_CONFLICT`.
- The lock test now asserts proposal and tenant bindings, sorted reviewer-plus-proposer user bindings, and exact-tenant sorted membership bindings from raw-call arguments; it no longer relies on SQL text alone.
- Reason coverage proves trimmed 1000 normalized characters are accepted and persisted, while 1001 is rejected before a transaction. Rejection remains non-materializing in the focused fake.
### Verification, cleanup, and final arithmetic

- PASS — guarded localhost U9 retry-0: 2 files / 15 tests; final repeat also 2 files / 15 tests.
- PASS — `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: 6/6 uncached tasks.
- PASS — `pnpm --filter @viewpro/api lint`.
- FAIL (unrelated) — guarded full API retry-0: 162 files / 1653 tests passed; `src/feedback/__tests__/feedback-rate-limit.repository.spec.ts` failed its sixth concurrent reservation with Prisma transaction-start timeout. It is outside the C8A edit surface.
- Guarded cleanup deleted decisions → rounds → proposals and postchecked 0/0/0 proposal/round/decision rows and zero non-idle `viewpro_test*` connections; recursive dependency/build residue was removed.
- No production code changed: all C8A production hashes remain as recorded after cleanup.
- **Final physical arithmetic: 76 tracked additions + 9 tracked deletions + 22 exploration lines + 256 source/test lines = 363 changed lines; correction delta is 95 lines from the actual initial 268, leaving 37 lines below 400.**

## C8A authority-matrix CHANGES_REQUIRED correction

| TDD Cycle Evidence | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U9 authority matrix | Baseline focused U9 was 15/15; test-first authority cases passed because production already met the contract. | Final focused U9 is 2 files/22 tests. | Principal, active-user-status, and review-capability mutants failed 1, 1, and 2 tests respectively. | Removed conditional expectations after lint; no production refactor. |

- Status: native OpenSpec `ready`/`apply`, 37/79, repo-local sole allowed root, no action-context warnings; C8A remains the auto-chain under-400 slice.
- Independent gate was `CHANGES_REQUIRED`: the prior authority assertion was tautological; the correction is a parameterized active manager/principal success and generic-403 no-write matrix for inactive user/membership, AGENT, and manager/principal capability loss.
- Production defect: none; `reject-property-proposal.use-case.ts` remains byte-identical and former-AGENT replay denial remains covered.
- PASS: uncached API Turbo typecheck 6/6, API lint, and focused U9 retry-0 repeat 2 files/22 tests.
- FAIL (unrelated): full API retry-0 was 162/163 files and 1660/1661 tests; `test/analytics.e2e-spec.ts` timed out at 5s outside this edit surface.
- Guarded localhost cleanup produced zero proposal/round/decision rows and zero non-idle test connections; recursive dependency/build residue cleanup followed.
- Final physical arithmetic: 92 additions + 9 deletions + 299 untracked lines = **400 changed lines** (at cap); no compression or size exception.
- Hashes: production `85c0f76b70610b9a797982dda3361b3b36dcd2e6548dc9c94f6bd1ce5c295fe6`; authority spec `927f1fef21da7f27ea1153a099165a69fcefcae01640d7944274ac0c9462af59`.
- Persisted U9 implementation task rows remain visibly `[x]`; C8B and parent-owned lifecycle work remain deferred.

## C8B / U10A approval materialization

### Status and boundary

- Consumed the parent-supplied authoritative `gentle-ai sdd-status seller-property-proposals --cwd /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c8b-approval`: OpenSpec `apply: ready`, repo-local requested C8B workspace, 37/79 native (36/76 implementation), no warnings, runtime token `sha256:13461973338bb43606e8df972b3b6ba0cd2a11d4b5d64351e0332644df3f5e4b`.
- C8B is the selected `auto-chain` / stacked-to-develop U10A-only slice, capped at 400 physical changed lines. U11A tenant/capacity and proposer eligibility, U11B replay/races, and U13 registration remain deferred.

### Completed behavior and persisted tasks

- Added an unmounted `ApprovePropertyProposalUseCase`. One outer transaction locks the proposal first, then sorted user and membership rows; this preserves the insertion point for U11A's tenant lock before those identity locks.
- It rereads active manager/principal reviewer authority and durable self-review, requires the exact latest `EN_REVISION` round with no decision, materializes only immutable round values through `CanonicalPropertyMaterializer.createInTransaction`, appends `APPROVED`, and changes the proposal to `APROBADA` with one version increment.
- Materializer input sets proposer creator/source/ordinary assignment and reviewer assigner; the existing materializer supplies CAPTURE, explicit non-primary, and null-currency omission. No module, transport, owner/image, notification, analytics, quota, proposer-eligibility, replay, or race surface was added.
- Both U10A implementation rows in `tasks.md` are visibly `[x]`; parent-owned rows are unchanged.

### TDD Cycle Evidence

| Cycle | Evidence |
|---|---|
| RED | The test file first failed to import the absent use case; after the inert compiling skeleton, behavioral RED was 14 failed / 1 passed of 15. |
| GREEN | The smallest transaction use case passed the focused approval spec: 15/15. |
| TRIANGULATE | Mutating the `EN_REVISION` guard made 7/15 fail; restored source passed 15/15. |
| REFACTOR | A test-only capability-spy type narrowing correction was followed by focused 15/15, forced typecheck 6/6, and lint pass. |

### Verification, cleanup, and arithmetic

- PASS: offline frozen install; guarded-localhost focused spec final repeat 15/15; forced `pnpm exec turbo run typecheck --filter=@viewpro/api --force` 6/6 uncached; API lint; bounded guarded-localhost full API retry-0 164 files / 1676 tests.
- The stateful fake proves materializer, decision, and proposal-update failures each roll back staged canonical/decision/proposal state. Owner/image/event exclusion is proved through the use-case's only two collaborator contracts, not no-call mocks.
- Guarded postchecks for base plus `viewpro_test_w1`–`w4` were each `0|0|0|0` for proposals/rounds/decisions/source engagements, with zero non-idle connections. No fixture, limit, or worker state remains.
- Pre-correction arithmetic was 37 tracked additions + 2 tracked deletions + 288 untracked source/test lines = 327; the audited final arithmetic is recorded below.

### Remaining work and risks

- Next exact unchecked U10B rows: `- [ ] RED → GREEN → TRIANGULATE → REFACTOR fresh viewer-specific same-tenant result visibility, assignment/capability checks, and omission for missing, cross-tenant, inactive, or lost-capability links. <!-- sdd-owner: implementation -->` and `- [ ] Run the manifest response spec and API typecheck; remove test assignments and canonical fixtures in \`finally\`. <!-- sdd-owner: implementation -->`.
- C8B intentionally provides neither tenant/capacity locking nor proposer eligibility (U11A), and neither approval replay nor real PostgreSQL approval races (U11B); DI/module mounting remains U13.

### C8B audited corrective reset

- Consumed corrective token `sha256:93ed2c440151bf0611c5dc22f34cf08ebd146cfdc7c8c6c7c4976fc8ca5de10a`; a later passing settlement must remediate `sha256:15a193bee4e6fd8a241918b8e6be061a4cd095ee551c1f432e69cbb6009bd0bb`.
- Test-only correction adds exact proposal/tenant and sorted identity-lock bindings, deterministic SQL order, coded missing/cross-tenant 404, exact generic 403, direct no-write conflicts, exact success shape without a canonical ID, and one outer transaction.
- Corrective test-first baseline was 17/17, confirming no production defect. Mutating sorted IDs failed 1/17; mutating the proposal tenant binding failed 3/17; restored source passed focused 17/17 twice, forced typecheck 6/6, lint, and guarded full API retry-0 164 files/1678 tests.
- Cleanup/postcheck again left base plus w1–w4 at `0|0|0|0` and zero non-idle connections; dependencies, generated/build/cache/test residue, and `*.tsbuildinfo` were removed with `.gitkeep` retained. Final arithmetic: 44 additions + 2 deletions + 312 untracked lines = 358 (<400). No production or task bytes changed in this correction.

## C9A / U10B result-visibility response boundary

### Status, scope, and completion

- Consumed parent-authoritative OpenSpec status: `seller-property-proposals`, `apply: ready`, repo-local C9A workspace, no action-context warnings; attempt token `sha256:8b9860ab2af8fd6a08e6f86372833cb1208d003affb97fa066e259949c1797d7` and 400-line cap.
- Updated the exploration decision first: C9A owns an unmounted response-local resolver plus optional mapper; U13 still owns fresh lookup orchestration and transport mounting. The revised forecast was 342 lines.
- Added the response-local `resolveCanonicalEngagementId` and `mapPropertyProposalResultLink`. The resolver accepts only a freshly loaded viewer snapshot and fail-closes unless the approved canonical candidate is source-linked and same-tenant, the viewer and exact membership are active, and current role/capability plus seller assignment or reviewer authority permits it.
- Both U10B implementation-owned rows are visibly `[x]` in `tasks.md`; parent-owned rows were not changed.

### TDD Cycle Evidence

| Cycle | Truthful evidence |
|---|---|
| RED | A compiling no-behavior response seam was added before the spec; the prescribed focused command then failed 3/12 behavioral assertions because all eligible seller/reviewer resolutions returned `undefined`. |
| GREEN | The smallest resolver and omission mapper passed the focused response spec: 12/12. |
| TRIANGULATE | Removing the source-proposal match failed 1/12 (unlinked canonical ID leaked); replacing current role permissions with all permissions failed 1/12 (lost-capability ID leaked). Both mutants were restored. |
| REFACTOR | The capability spy now restores in `finally`; the final focused repeat remained 12/12. |

### Verification, cleanup, and boundary

- PASS — `pnpm --filter @viewpro/api exec vitest run src/property-proposals/responses/property-proposal.response.spec.ts` — 12/12 after GREEN and again after refactor.
- PASS — `pnpm --filter @viewpro/api typecheck`; its first attempt was blocked only by the existing missing generated `@viewpro/contracts` output, then `pnpm --filter @viewpro/contracts build` restored that local prerequisite and the exact API command passed.
- PASS — `pnpm --filter @viewpro/api lint`; PASS — `git diff --check`.
- No design deviation or database, fixture, canonical record, assignment, provider, service, controller, DTO, BFF, UI, schema, migration, owner, image, event, or result side effect was created. The sole mocked capability override is restored in `finally`.
- Changed only `apps/api/src/property-proposals/responses/property-proposal.response.ts`, its focused spec, `explore-c9a-result-visibility.md`, these two U10B checkboxes, and this cumulative progress artifact. The response resolver is deliberately unmounted.
- Workload/PR boundary: C9A-U10B only, auto-chain / stacked-to-develop; 249 physical changed lines, below the 400-line cap. U11A quota/proposer eligibility, U11B approval replay/races, and U13 wiring remain excluded.

### Remaining tasks and risk

- Next exact unchecked implementation rows are `- [ ] RED → GREEN → TRIANGULATE → REFACTOR proposer eligibility, protected final-slot quota behavior, retry after restored capacity, and atomic rollback with stable public outcomes. <!-- sdd-owner: implementation -->` and `- [ ] Run the manifest quota spec and API typecheck; restore limits, close transactions, and remove assets in `finally`. <!-- sdd-owner: implementation -->`.
- Residual risk: this unmounted C9A boundary proves fail-closed resolution of a fresh input snapshot, not the U13 live query/batching or canonical detail reauthorization; no fresh request path exists yet.

## C9A / U10B maintainer-authorized test-only evidence correction

### Status, scope, and task preservation

- Consumed the parent-supplied authoritative OpenSpec status: `seller-property-proposals`, `applyState: ready`, repo-local workspace `seller-property-proposals-c9a-result-visibility`, and only the response spec plus this progress artifact as edit roots. Runtime token: `sha256:180d1e377b7db1d0ee7d4d08300357ba6c05ee060386f3fe72adb3d2d210b327`; it remediates failed evidence `sha256:e9757a332fb5ea8415a9b887523b02f30612bc309e6d118ab56a3a5b3506b272`.
- Expanded only `property-proposal.response.spec.ts`; `property-proposal.response.ts` had no defect and its final SHA-256 is the pre-mutation value `2f03d37071090f7d902e0bfd0a9d5a87ae8e7942b55de81e976486f492af1066`. The already-complete U10B task rows remain visibly `[x]`; `tasks.md` was not edited.
- The parameterized denial matrix asserts exact `{}` output, not merely an absent property, for wrong assignment tenant/engagement/agent; missing viewer/membership; membership user/tenant mismatch; non-proposer viewer; all non-`APROBADA` states; otherwise-positive wrong role; and each seller/reviewer capability loss.

### TDD Cycle Evidence

| Cycle | Truthful correction evidence |
|---|---|
| Safety net / GREEN-on-arrival | Offline frozen install plus local Prisma generation completed; the pre-edit focused response suite passed **12/12**. The expanded behavior passed **24/24** without production changes, so this was not a new RED. |
| TRIANGULATE mutation | Temporary independent source mutants failed the focused suite and were restored from one byte backup: state **3 failed/21 passed**; membership, proposer, role, capability, and assignment each **1 failed/23 passed**. |
| REFACTOR | Extracted `reviewer`, result-link, exact-omission, and capability-removal helpers in the spec only; no implementation-text assertion or source refactor was added. |

### Final verification, cleanup, and accounting

- PASS — focused response command twice: **24/24** on each run; forced uncached `pnpm exec turbo run typecheck --filter=@viewpro/api --force`: **6/6**; API lint; bounded local `vitest run --retry=0`: **165 files / 1702 tests**.
- PASS — `git diff --check`; postcheck found zero non-idle local `viewpro_test*` connections. The test uses no fixtures or external/provider/staging/production access.
- Removed offline dependency/generated/build/cache/report/upload/Turbo/coverage/`*.tsbuildinfo` residue while retaining tracked `.gitkeep`. Test-candidate digest (response source plus response spec, path-delimited SHA-256): `sha256:339cfa3db04b2a4a3144ccc96869cd25652415f69909b3dbc9d23d419b88cb8f`; final physical accounting: `57 tracked additions + 2 tracked deletions + 251 untracked lines = 310` changed lines (cap: 400).
- No source behavior change, task edit, exploration edit, U11/U13 surface, commit, push, PR, merge, rebase, review, or receipt action occurred. C9A remains the bounded `auto-chain` / stacked-to-`develop` work-unit; parent lifecycle is deferred.

## C9A / U10B final seller-role isolation correction

### Status and scope

- Consumed the parent-authoritative OpenSpec status: `seller-property-proposals`, `applyState: ready`, repo-local workspace `seller-property-proposals-c9a-result-visibility`, with only the response spec and this progress artifact allowed for edits. Runtime correction token: `sha256:28ad7912c2dfe695649ffcb15619915826e459bd1348eecb890c3e41a8315364`; remediates failed evidence `sha256:bc94adb05695c3ab6e84c8eda344b7a2d25c0617ab2ef54a85691d05fd67ad26`.
- Added one test-only seller-role isolation case. It retains an active same-tenant durable proposer, matching active membership, valid canonical source link, exact assignment, and both mocked seller capabilities; its `MANAGER` role has no reviewer capabilities, so reviewer denial does not rely on proposer or assignment mismatch. The exact `{}` result therefore isolates the seller `membership.role === 'AGENT'` predicate.
- `property-proposal.response.ts` was restored byte-for-byte after the temporary mutant; its final SHA-256 is `2f03d37071090f7d902e0bfd0a9d5a87ae8e7942b55de81e976486f492af1066`. `tasks.md` and exploration remain unchanged; both already-complete U10B implementation rows remain visibly `[x]`.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN-on-arrival | TRIANGULATE / role mutant | REFACTOR |
|---|---|---|---|---|---|---|
| C9A/U10B seller-role isolation | Unit | Focused response spec: 24/24 before the test edit | None: the authorized correction adds evidence for already-correct production behavior; no RED was fabricated. | New 25th assertion passed 25/25 without production changes. | Removing only `membership.role === 'AGENT'` made exactly the new test fail: 1 failed/24 passed; source was restored, then final focused run passed 25/25. | No refactor needed; production source remains byte-identical. |

### Verification, cleanup, and accounting

- PASS — offline `pnpm install --offline --frozen-lockfile` and local Prisma generation; focused response spec passed 24/24 before the edit, then 25/25 after it and 25/25 after mutant restoration.
- PASS — local contracts build supplied the existing generated-contract prerequisite, then API `typecheck` and `lint` passed. The first direct API typecheck was blocked only because `@viewpro/contracts` output was absent.
- PASS — `git diff --check`; this mock-only suite created no fixtures. Post-cleanup residue, non-idle localhost connection, candidate accounting, and path-delimited digest are recorded below.
- Final physical candidate accounting: `79` tracked additions + `2` tracked deletions + `267` untracked lines = **348 changed lines** (cap: 400). The response-only path-delimited SHA-256 digest (source path + NUL + source SHA-256, then spec path + NUL + spec SHA-256) is `sha256:1ecceae733ac19e46c868721cb63caf91a3381605551c45ef96527f73a202aa4`.
- No design deviation, source behavior change, task change, database fixture, external access, commit, push, PR, merge, rebase, review, receipt, or lifecycle action occurred. C9A remains within the parent-selected `auto-chain` / stacked-to-`develop` work-unit; U11A and parent lifecycle remain deferred.

## C9B / U11A approval quota and proposer eligibility

### Status, scope, and workload

- Consumed parent-authoritative OpenSpec status: `seller-property-proposals`, `apply: ready`, repo-local exact C9B workspace, no action-context warnings, and the `auto-chain` / stacked-to-`develop` C9B-only delivery path.
- The exploration's 193–228-line estimate omitted the approval-fixture adaptation and artifact closure. Before edits, the honest forecast was 337–377 physical lines; final accounting below is within the 400-line cap.
- Implemented only the approved use case, its existing fixture, the U11A quota spec, the lock-order helper, exploration, and required OpenSpec artifacts. U11B replay/races, U13 wiring, modules, transport, and external services remain excluded.

### Completed implementation and TDD evidence

- Approval now has one outer transaction with proposal → tenant capacity lease → sorted user → sorted membership → round/decision ordering. It requires an active exact-`AGENT` proposer, maps coded quota/ineligible 409 outcomes, asserts capacity before canonical writes, and rolls failures back to retryable `EN_REVISION`.
- Persisted completion: both U11A implementation-owned rows in `tasks.md` are visibly `[x]`; parent-owned rows were preserved.

| Task | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U11A quota and eligibility | Existing approval spec passed 17/17 before edits. Test-first quota suite produced 6 behavioral failures while the approval suite stayed 17/17. | Focused quota plus approval suites passed 23/23. | Moving capacity assertion after materialization failed 1/6; reversing the exact-`AGENT` predicate failed 4/6. Both were restored. | Removed an unused test import after lint; focused suite stayed 23/23. |

### Verification and cleanup

- PASS — offline `pnpm install --offline --frozen-lockfile`; local Prisma generation; guarded localhost `viewpro_test` focused command twice, 2 files / 23 tests.
- PASS — forced `pnpm exec turbo run typecheck --filter=@viewpro/api --force`, 6/6 uncached; API lint; guarded full API `vitest run --retry=0`, 166 files / 1709 tests.
- All commands used only guarded matching local `DATABASE_URL` and `DIRECT_URL`. These stateful fakes created no database rows; capacity/rollback tests retain no assets, limits, or transactions.

### Remaining work, boundary, and risks

- Exact next unchecked implementation rows: `- [ ] RED → GREEN → TRIANGULATE → REFACTOR actor-specific approval replay and competing approval/rejection/final-slot race outcomes without duplicate aggregates. <!-- sdd-owner: implementation -->` and `- [ ] Run the manifest replay/race specs repeatedly with bounded named connections and clean barriers, clients, limits, and assets in \`finally\`. <!-- sdd-owner: implementation -->`.
- Final physical accounting is 85 tracked additions + 41 tracked deletions + 170 untracked lines = **296 changed lines** (≤400). Cleanup removed dependency/generated/build/cache/test residue while preserving `packages/contracts/src/generated/.gitkeep`; base plus w1–w4 rows are each `0/0/0/0` (proposal/round/decision/source-engagement) and non-idle connections are zero.
- Source/test SHA-256: use case `c914dbfc81d6235cac9a14fee927417cb796f8a9e6a83e2ea79b0d73ee7b5fa4`, existing approval spec `2335821b5f5458cb9b5ddb5587b00166491c5b699e849d255010355d40874f5b`, lock helper `699fbcb7c0edf6c338d252c5adfaaa70893399a0eb9f265b040c6a95ad09bb92`, quota spec `3eb1bfd5ce02b066c9c52eaac39516c11c0c4c2a214c1eead1dff732817a5fc3`; path-delimited combined digest `60761e8ef4e005bc669fef5c64a936ae16d0a51091278a5e49e645a5f3a64ff8`.
- No design deviation, commit, push, PR, merge, review, receipt, or parent-lifecycle action occurred.

## C9B test-only correction

- **Status/scope:** consumed the parent-resolved `seller-property-proposals` OpenSpec apply-ready status for the exact C9B worktree. Only `approve-property-proposal.quota.spec.ts` and this cumulative progress artifact changed; U11A rows were already visibly `[x]`, so `tasks.md` was preserved.
- **Correction:** the restored-capacity retry uses one fake transaction/durable store and changes only its capacity flag. The rejected attempt proves zero materializer, decision, and proposal-update calls; the retry proves exactly one aggregate, decision, and transition. Each inactive/deactivated/non-AGENT proposer case now also proves those three write collaborators received zero calls.
- **TDD evidence:** safety-net focused quota+approval specs were green on arrival at 23/23. This is a test-correction cycle, not a fabricated product RED; the corrected focused command passed 23/23 twice. A first corrected run exposed the fake's per-transaction query cursor rather than production behavior; resetting that cursor in the test fake restored the same-store retry scenario.
- **Verification:** guarded matching localhost `DATABASE_URL`/`DIRECT_URL` to `viewpro_test`; focused quota+approval specs passed twice (2 files/23 tests), API typecheck passed after the required local contracts build, and API lint passed. No database fixtures were created.
- **Source identity:** `approve-property-proposal.use-case.ts` remains `sha256:c914dbfc81d6235cac9a14fee927417cb796f8a9e6a83e2ea79b0d73ee7b5fa4`, identical to the C9B record before this test-only correction. No source mutation was performed because that file is outside the authorized edit roots; the zero-call eligibility assertions are mutation-sensitive to eligibility moving after materialization.
- **Boundary/cleanup:** candidate accounting remains below the 400-line cap; no source behavior, task, delivery, review, or external-service action occurred.

## C10A / U11B1 approval replay ordering and source invariant

### Status and decision

```yaml
artifactStore: openspec
changeName: seller-property-proposals
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u11b-replay-races
  allowedEditRoots: parent-supplied U11B1 paths
  warnings: []
```

- Consumed the parent-selected U11B1 status for fresh `develop` `2d0db052`; the injected ambient status was not used. The parent-approved decision was persisted first in the capability spec, design, split delivery/tasks/commands, and exploration.
- Exact same-reviewer approval replay now revalidates reviewer authority and self-review before classifying the approved round and same-tenant source engagement. Only new approval evaluates proposer eligibility and quota. Canonical result visibility remains unchanged.
- Both U11B1 implementation rows are visibly `[x]` in `tasks.md`; U11B2/U11B3 races, U12, and parent lifecycle rows remain unchecked and unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U11B1 replay ordering/source invariant | Unit | Existing approval+quota specs: 23/23 | New replay behavior failed 2/32: full quota returned state conflict and inactive proposer returned proposer-ineligible conflict. | Three focused specs passed 33/33. | Added full-quota/ineligible-proposer, actor/round/outcome/source mismatch, authority/self-review, no-write, and exact source/tenant binding cases; negating the source predicate failed 4/9. | Extracted the pure replay classifier; focused specs stayed green. |

### Verification and boundary

- PASS — offline frozen install and local Prisma generation; guarded focused command passed twice: 3 files / 33 tests.
- PASS — forced uncached API typecheck: 6/6 tasks; API lint; guarded full API `vitest run --retry=0`: 167 files / 1719 tests.
- The first forced typecheck failed only `TS2322` at approval replay `requestedRoundId` because the validated input narrowed across the transaction callback as `unknown`; binding the validated string before the callback fixed it. A post-cleanup full run initially failed 33 suites because `@viewpro/contracts` `dist` had been removed; the required forced typecheck rebuilt it and the retried full run passed. No source-related failure remains.
- Forecast before source edits was 195 physical changed lines excluding this progress closure, leaving 205 lines for progress; final accounting and residue postcheck follow below. No design deviation, transport/result mapping, race barrier, schema, external service, commit, push, PR, merge, review, receipt, or token persistence occurred.

### Remaining implementation work

- [ ] U11B2: RED → GREEN → TRIANGULATE → REFACTOR bounded same-proposal approval/approval and approval/rejection PostgreSQL lock races without duplicate aggregates. <!-- sdd-owner: implementation -->
- [ ] U11B3: RED → GREEN → TRIANGULATE → REFACTOR bounded final-slot approval/approval and approval/direct-create/restore races with failure-continuing cleanup. <!-- sdd-owner: implementation -->

### Accounting and cleanup

- Final candidate: 83 tracked additions + 17 tracked deletions + 135 untracked physical lines = **235 total physical changed lines**, within the 400-line U11B1 cap. `git diff --check` passed; guarded localhost postcheck found zero non-idle `viewpro_test`/w1–w4 connections; node modules, generated build output, `.turbo`, and `*.tsbuildinfo` were removed while `packages/contracts/src/generated/.gitkeep` remains. Offline dependency/generated/build/cache outputs are removed after final postchecks.

## C10A / U11B1 corrective replay ordering

### Status and scope

- Consumed the parent-selected authoritative status: `seller-property-proposals`, OpenSpec `apply: ready`, repo-local exact target `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u11b-replay-races`, runtime `e17bc8acac3c012cc51fe8fff88a565c26eb056df6800dc3dc35dafe48616732`, and no action-context warnings. The ambient status was not used.
- This corrective C10A/U11B1 slice is authorized under `auto-chain` / stacked-to-develop and remains below 400 changed lines. No race, transport, provider, publication, review, or parent lifecycle action was performed.

### Completed correction and persisted tasks

- After unsuccessful replay classification, approval now rejects a non-new state, round, or decision with `PROPERTY_PROPOSAL_STATE_CONFLICT` before checking proposer eligibility; new approval alone evaluates proposer eligibility and quota.
- The replay fake now performs an actual `EN_REVISION` approval and replays against that same durable transition. It proves one source query bound to the proposal and tenant, no additional quota assertion or writes after changed proposer role/inactive membership, and 403 before replay lookup for reviewer status, membership, role, capability, or self-review loss.
- The invalid replay matrix combines proposer inactivity with wrong actor, stale round, rejected/missing decision, missing source, and cross-tenant source; every case returns the exact state conflict with no writes.
- `tasks.md` was reread: both completed U11B1 implementation-owned rows remain visibly `- [x]`; U11B2/U11B3 and parent-owned lifecycle rows remain unchanged. Current topology claims in `tasks.md` and `task-delivery-plan.md` now state 31 displayed groups; historical evidence was not edited.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U11B1 corrective ordering | New behavioral replay matrix failed 6/13: all invalid approved replay cases returned `PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE`. | Reordering state conflict before proposer eligibility passed focused replay/approval/quota coverage at 36/36. | Restoring the old order failed the same 6/13 cases; restoration passed 36/36. | Replaced fabricated approved-store fixtures with one stateful durable fake and explicit no-additional-write assertions. |

### Verification, hashes, and remaining work

- PASS — offline `pnpm install --offline --frozen-lockfile`, local Prisma generation, and guarded localhost `viewpro_test` only.
- PASS — focused replay/approval/quota command: 3 files / 36 tests, run twice after GREEN and again after the final assertion; forced API Turbo typecheck: 6/6 uncached; API lint; guarded full API `vitest run --retry=0`: 167 files / 1722 tests.
- Final source SHA-256: `approve-property-proposal.use-case.ts` `48eb99d42c4045f50e6604bf2972af3df58ffa9a7c85b37c008f0bc75f76f517`; replay spec `233ab98f9efce9796d35afc7d89b26b43cf4c8fae2d063611efd6464a7acd7d5`.
- Remaining exact implementation rows: `- [ ] U11B2: RED → GREEN → TRIANGULATE → REFACTOR bounded same-proposal approval/approval and approval/rejection PostgreSQL lock races without duplicate aggregates. <!-- sdd-owner: implementation -->`; `- [ ] U11B3: RED → GREEN → TRIANGULATE → REFACTOR bounded final-slot approval/approval and approval/direct-create/restore races with failure-continuing cleanup. <!-- sdd-owner: implementation -->`.
- No design deviation. Final candidate: 115 tracked additions + 21 tracked deletions + 157 untracked physical lines = **293 changed lines** (≤400). `git diff --check` passed; postcheck found proposals=0, rounds=0, decisions=0, nonidle=0; dependencies, generated/build/cache/test residue were removed while `packages/contracts/src/generated/.gitkeep` remains. `next_recommended: parent-lifecycle`.

## C10B / U11B2 same-proposal PostgreSQL races

### Status and completion
- Consumed parent-native selection: OpenSpec `seller-property-proposals`, apply ready, repo-local exact U11B2 target at `f234ad60`; no action-context warning.
- Scope is only the approval-race test and allowed OpenSpec artifacts; U11B3, U12, source behavior, providers, schema, transport, UI, and settlement lifecycle remain excluded.
- Persisted `tasks.md` now visibly marks the sole U11B2 implementation-owned row `- [x]`; parent-owned rows remain untouched.

### Completed evidence
- Three named guarded-localhost Prisma clients run real approve/reject use cases; a winner-only transaction proxy pauses after the actual proposal `FOR UPDATE` and records its backend PID.
- Four cases cover both approval reviewer orders plus approval/rejection winner orders; every loser is coded 409, every winner gives one durable decision/outcome, and approval gives exactly one CAPTURE source, asset, ordinary non-primary assignment, and result link.
- Bounded observer evidence requires `wait_event_type='Lock'` and `pg_blocking_pids(loserPid) === [winnerPid]`; finally releases/settles work, captures sources/assets before ordered deletion, and all three connections disconnect via `allSettled`.

### TDD Cycle Evidence
| Task | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| U11B2 | PostgreSQL integration | Test-local unimplemented lock-observer seam failed 1/1; no production defect was claimed. | Real harness passed 4/4 twice. | `winnerPid + 1` exact-blocker mutant failed 4/4 in 210ms and was restored. | Resolved proxy/PID sequencing and lint findings; source remained unchanged. |

### Verification, budget, and remaining work
- PASS: guarded U11B2 race command twice, 4/4 each; relevant approval/rejection regression, 6 files/62 tests; forced Turbo API typecheck 6/6; API lint.
- PASS: guarded full API `vitest run --retry=0`, 168 files/1726 tests; all fixture rows and named non-idle connections are checked and cleaned before final residue cleanup.
- Candidate accounting: test 214 + exploration 23 + progress 24 + checkbox replacement 2 = **263 changed lines**, within the C10B/U11B2 400-line boundary; no design deviation.
- Remaining implementation task: `- [ ] U11B3: RED → GREEN → TRIANGULATE → REFACTOR bounded final-slot approval/approval and approval/direct-create/restore races with failure-continuing cleanup. <!-- sdd-owner: implementation -->`.
- Risk: this slice proves only same-proposal row-lock races; final-slot capacity races remain U11B3, and parent owns lifecycle settlement.

### C10B / U11B2 bounded correction

- **Status consumed:** parent-native `seller-property-proposals` / OpenSpec apply-ready / repo-local target override, runtime `proceed1e82e0a986f5a78b4006c82011670f3d0617d68477043261c563f41e6c7c51c9`; no action-context warnings. Delivery remains the selected `auto-chain` / stacked-to-develop U11B2 slice, capped at 400 lines.
- **Correction:** assertions independently count every tenant engagement and every asset created by the fixture proposer; the exact source link is then checked separately. They now require the exact proposal/tenant identities and decision round, reviewer, tenant, and outcome, while rejection requires zero assets and engagements.
- **Cleanup:** captures and deletes all tenant engagements and all fixture-owned assets, including source-unlinked orphan assets; each cleanup verifies zero engagements, assets, proposal, tenant, and users. All named-client disconnects have a 5-second deadline inside failure-preserving `Promise.allSettled` aggregation.
- **TDD Cycle Evidence:** this test-only static-gate correction was GREEN on arrival, so no RED was claimed or fabricated; the corrected real-PostgreSQL race suite passed 4/4 on each of four post-edit executions. The existing exact-blocker PID mutant remains the meaningful behavioral fail proof; no production source/schema change was required.
- **Verification:** offline frozen install and Prisma generation; guarded localhost `viewpro_test` race suite 4/4 twice standalone (and again in regression/full API); approval/rejection regression 6 files/62 tests; forced API Turbo typecheck 6/6; API lint; full API retry-0 168 files/1726 tests.
- **Postchecks:** base and `viewpro_test_w1`–`w4` each reported `0|0|0|0|0|0|0` fixture user/tenant/proposal/round/decision/source/asset rows and zero named non-idle connections. Dependencies, generated outputs, caches, test residue, and build residue are removed after this record while the tracked generated `.gitkeep` remains.
- **Persisted tasks:** re-read `tasks.md`; completed U11B2 remains visibly `- [x]`, U11B3 remains exactly `- [ ] U11B3: RED → GREEN → TRIANGULATE → REFACTOR bounded final-slot approval/approval and approval/direct-create/restore races with failure-continuing cleanup. <!-- sdd-owner: implementation -->`, and every parent-owned row is unchanged.
- **Boundary:** no design deviation, source/schema broadening, transport/UI/provider work, review, receipt, commit, push, PR, merge, or publication occurred. Final physical candidate accounting: **310** changed lines (cap 400); `next_recommended: parent-lifecycle`.

## C10C / U11B3 final-slot capacity races

### Status, scope, and persisted completion

- Consumed parent-native OpenSpec selection: `seller-property-proposals`, apply ready (46/81), repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u11b3-capacity-races`, exact target edit root, and no action-context warning. Delivery is the authorized `auto-chain`/stacked-to-develop U11B3 slice under the 400-line budget.
- Changed only the allowed real-PostgreSQL race harness and its three allowed OpenSpec artifacts; no production, schema, transport, UI, provider, Git, review, receipt, commit, push, PR, merge, or publication work occurred.
- Persisted `tasks.md` now visibly marks U11B3 `[x]`. Parent-owned lifecycle rows remain byte-for-byte unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U11B3 final-slot races | PostgreSQL integration | U11B2 harness: 4/4 passed before edits. | New tenant-lock observer seam failed 1/5 because `pauseAfterTenantLock` was absent; after adding it, the same-proposal trial failed with its real `PROPERTY_PROPOSAL_STATE_CONFLICT`, proving it was not a capacity race. | Six distinct-proposal/direct/restore final-slot cases passed, then the combined harness passed 10/10. | The exact-blocker PID mutant (`winnerPid + 1`) failed all 10 cases and was restored; direct and restore loser response shapes were separately asserted. | Kept a test-local proxy only; no production refactor was needed. |

### Verification, cleanup, and boundary

- PASS — guarded localhost `viewpro_test` U11B3 command ran 10 consecutive times: 10/10 each; approval/rejection/capacity regression: 6 files / 69 tests; forced API Turbo typecheck: 6/6 uncached; API lint; full API `vitest run --retry=0`: 168 files / 1732 tests.
- Winner pauses only after the actual tenant `FOR UPDATE` has returned; the observer saw the named loser backend with `wait_event_type='Lock'` and exact singleton blocker PID. Each final-slot race has cap 1, exactly one active engagement, independently counted tenant engagements and actor assets, exact approval decision/round/actor/source/CAPTURE/non-primary assignment checks, losing approval quota code/EN_REVISION no-write checks, direct/restore message-only 409 checks, and restore archive-state checks.
- Cleanup releases barriers, settles both operations, captures all tenant engagements and all fixture-actor assets before dependency-ordered deletion, and deadline-disconnects named clients. Postcheck for base and `viewpro_test_w1`–`w4` reported `0|0|0|0|0` for U11B3 fixture users/tenants/proposals/engagements/non-idle named connections.
- No design deviation. Workload remains one U11B3 auto-chain slice; final candidate arithmetic is 207 physical changed lines (181 tracked additions/deletions plus 26 untracked exploration lines), below 400. The next exact unchecked implementation rows are `- [ ] Repeat only already-green eligibility, reviewer, approval, quota, direct-path, primary, and cleanup behavior; observe \`pg_stat_activity\`/\`pg_blocking_pids\` with bounded timeouts rather than unsettled promises. <!-- sdd-owner: implementation -->` and `- [ ] Record observed outcomes only; do not add a first RED or production fix, and always release barriers, clients, transactions, fixtures, orphan assets, and limits. <!-- sdd-owner: implementation -->`.
- Deferred lifecycle actions: all parent-owned rows remain unchanged. `next_recommended: parent-lifecycle`.

## C10C / U11B3 static evidence correction

### Status, scope, and persisted task state

- Consumed the parent-native `seller-property-proposals` OpenSpec repo-local apply-ready status for this exact worktree; the parent owns token and settlement. `auto-chain`/stacked-to-develop remains the resolved delivery path, the 400-line budget was current at 207 physical lines, and no action-context warning was supplied.
- Only the allowed race test plus this progress artifact and `explore-u11b3-capacity-races.md` changed. No production, schema, transport, review, receipt, Git, or publication work occurred.
- Re-read `tasks.md`: U11B3 remains visibly `[x]`; no checkbox was changed because this bounded correction remediates already-completed test evidence. Parent-owned rows remain byte-for-byte deferred.

### Static failure and corrected evidence

- The first check was a static source audit, not a fabricated TDD RED. It exited 1 because the final-slot branch lacked a winner `reviewRoundId`, restore `RESTORED` audit assertions, and failure-continuing cleanup discovery.
- The corrected audit passed after adding exact winning-round, creator/source, direct-create identity/source, losing-approval version/snapshot/round-absence, restore archive-cleared-or-preserved, and `RESTORED` movement assertions.
- Cleanup now uses independent `Promise.allSettled` discoveries, aggregates both original discovery failures, retains known restore IDs, and uses tenant- and fixture-actor-scoped deletion fallbacks before the existing dependency-ordered cleanup.
- The first post-edit race run exposed one matcher defect in the new direct-create assertion (`toEqual` against an `ObjectContaining` array); it did not indicate production failure. The assertion now proves one active direct engagement and then matches its exact identity/source fields.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U11B3 static evidence correction | PostgreSQL integration test | Original final-slot suite had prior green evidence; this correction introduced no production behavior. | No RED claimed: the initial failure was the static audit above, not an unimplemented production behavior. | Guarded race suite passed 10/10 twice after the corrected assertions. | The six final-slot operation orders plus the six-file approval/rejection/capacity regression passed 69/69. | Narrowed the direct-create matcher to a non-archived singleton before matching its durable fields; no production refactor. |

### Verification, cleanup, and boundary

- PASS — offline `pnpm install --offline --frozen-lockfile`; local Prisma generation; guarded localhost `viewpro_test` only.
- PASS — `pnpm --filter @viewpro/api exec vitest run --retry=0 test/property-proposal-approval-race.spec.ts`: 10/10 twice.
- PASS — six-file approval/rejection/capacity regression: 69/69; forced `pnpm exec turbo run typecheck --filter=@viewpro/api --force`; API lint; full API `vitest run --retry=0`: 168 files / 1732 tests.
- Postcheck: `viewpro_test` and `viewpro_test_w1`–`w4` each reported `0|0|0|0|0` U11B3 tenant/proposal/round/decision/engagement fixtures, and named non-idle connections were zero.
- Removed installed dependencies, generated output, `.turbo`, and `*.tsbuildinfo`; the tracked `packages/contracts/src/generated/.gitkeep` remains. No design deviation; final physical candidate accounting is 273 changed lines, below 400. Remaining implementation tasks begin exactly:
  - [ ] Repeat only already-green eligibility, reviewer, approval, quota, direct-path, primary, and cleanup behavior; observe `pg_stat_activity`/`pg_blocking_pids` with bounded timeouts rather than unsettled promises. <!-- sdd-owner: implementation -->
  - [ ] Record observed outcomes only; do not add a first RED or production fix, and always release barriers, clients, transactions, fixtures, orphan assets, and limits. <!-- sdd-owner: implementation -->
      `next_recommended: parent-lifecycle`.

## U12 verification-only concurrency matrix

### Status and delivery boundary

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
workUnit: U12-verification-only
progress: 47/81 before U12
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u12-verification
  allowedEditRoots: parent-supplied U12 test and OpenSpec paths
  warnings:
    - Ambient working directory differed; every command explicitly targeted workspaceRoot.
delivery: auto-chain / stacked-to-develop; U12 only
```

- Consumed the parent-selected U12 status. The global verify block is not a U12 apply blocker.
- U12 remains verification-only: no production, schema, transport, UI, provider, or first-RED work was introduced.

### Completed work and persisted task state

- Added the import-only matrix that registers the existing 8-case eligibility and 10-case approval PostgreSQL suites without duplicating their fixtures.
- Hardened the existing 14-case primary concurrency harness with guarded localhost `_test` URLs, connection/statement/lock timeouts, bounded barrier/observation waits, exact `pg_blocking_pids` winner-PID checks, and deadline-bounded failure-preserving disconnect cleanup.
- Removed the unused planned `property-proposal-concurrency-fixtures.ts` manifest entry: the existing suites remain fixture owners.
- Re-read `tasks.md`: both U12 implementation-owned rows are visibly `- [x]`; parent-owned rows are unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U12 repeated evidence | PostgreSQL integration | Existing primary harness: 14/14 before edits | Not applicable: U12 is repeat-only and owns no first RED. | Exact U12 command passed 32/32 twice. | Existing eligibility 8, approval 10, and primary 14 cases exercise distinct already-green paths. | Test-only bounded observation and cleanup hardening; no production refactor. |

### Verification and cleanup

- PASS — normative guarded command, default Vitest retry configuration retained (no retries observed): **2 files / 32 tests**.
- PASS — exact repeat of the same normative command: **2 files / 32 tests**.
- PASS — API typecheck after the generated-contract prerequisite and API lint. The first direct typecheck was blocked only because the workspace contract output was absent; forced Turbo generation/typecheck passed 6/6, after which direct typecheck passed.
- The first post-edit U12 command exposed an omitted expected winner PID in two pre-existing primary invalidation observation calls; this was a test-harness assertion defect, not a product failure or a claimed RED. After passing the PID explicitly, both final normative executions passed.
- Postcheck across `viewpro_test` and `viewpro_test_w1`–`w4` returned `0|0|0|0|0|0` for U12 fixture users, tenants, proposals, engagements, orphan assets, and named non-idle connections. The databases were retained.
- Full API was intentionally not run: the import-only matrix already re-executes the existing eligibility/approval race suites, so a full API run would confound U12's repeated-test counters without adding this unit's required evidence.

### Workload, deviations, and remaining work

- No design deviation. The U12 source/test forecast is 87–119 lines plus the retained exploration note; the actual candidate remains below 400 lines.
- No commit, push, PR, merge, review, receipt, or delivery gate action occurred.
- Remaining implementation rows begin with U13 and are out of scope. Deferred lifecycle actions are the parent-owned rows, preserved byte-for-byte.
- `next_recommended: parent-lifecycle`.

## U12 bounded correction — invalidation signal lifecycle

### Status, scope, and persisted tasks

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
workUnit: U12 bounded correction
progress: 47/81 at parent selection
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u12-verification
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-agent-primary-concurrency.e2e-spec.ts
    - openspec/changes/seller-property-proposals/apply-progress.md
    - openspec/changes/seller-property-proposals/explore-u12-verification.md
  warnings:
    - The ambient change selection was ignored in favor of the parent-provided exact U12 repo-local override.
delivery: auto-chain / stacked-to-develop; U12 correction only; current candidate 181 lines before this correction
```

- This correction is limited to test-harness cleanup reliability. It does not change business behavior, production code, schema, transport, UI, task delivery topology, or fixture ownership.
- Both U12 implementation-owned rows were already visibly `- [x]`; this correction does not alter `tasks.md`. Parent-owned rows remain byte-for-byte unchanged.

### Correction and failure-path reasoning

- The two held invalidation transactions no longer await `updatedWait` without a bound. `waitForInvalidationSignal` races the lock signal against transaction fulfillment, transaction rejection, and the existing two-second observation deadline.
- Each fixture setup is inside its corresponding `try` block. Every `finally` releases the held transaction/barrier, waits for all launched promises, then cleans its fixture.
- Cleanup aggregates the primary failure, unexpected promise rejections, and cleanup failure so an assertion or pre-signal transaction failure is preserved rather than masked. The deliberate rollback is ignored only after its expected rejection assertion has passed.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U12 lifecycle correction | Not applicable: U12 is verification-only and must not add a first RED or production behavior. | The exact 32-test guarded U12 command passed twice after the correction. | Transaction fulfillment, rejection, and deadline are distinct races, so a missing signal cannot be treated as a merely unsettled operation. | The shared finalizer avoids duplicated release/settlement/cleanup paths while preserving each failure source. |

### Verification and cleanup

- PASS — `DATABASE_URL` and matching `DIRECT_URL` were guarded localhost `viewpro_test` URLs for both exact normative executions: `pnpm --filter @viewpro/api exec vitest run test/property-proposal-concurrency-matrix.e2e-spec.ts test/property-agent-primary-concurrency.e2e-spec.ts` — **2 files / 32 tests** on each run.
- PASS — `pnpm --filter @viewpro/contracts build && pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api lint`.
- The first direct API typecheck was blocked only because the generated `@viewpro/contracts` `dist` output was absent; after the required local contract build, typecheck and lint passed. This was a generated-artifact prerequisite, not a product or test failure.
- PASS — postcheck for `viewpro_test` and `viewpro_test_w1`–`viewpro_test_w4`: each reported `0|0|0|0` for this harness's users, tenants, engagements, and named non-idle primary-concurrency connections.
- Dependencies were installed only with `pnpm install --offline --frozen-lockfile`; Prisma was generated locally for test execution. Workspace dependencies, generated output, caches, and test/build residue were removed before handoff; tracked `.gitkeep` files remain.

### Remaining work and boundary

    - The final physical working-tree delta is 264 additions plus 60 deletions (**324 changed lines**, including the two retained untracked U12 files), below the 400-line review budget and inside the parent-selected U12 work-unit boundary. No commit, push, PR, merge, review, receipt, full-suite run, or delivery gate action occurred.
    - Remaining implementation rows are out of scope and begin:
      - [ ] RED → GREEN → TRIANGULATE → REFACTOR seller routes, permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, current-role checks, and absent withdraw/delete/image routes; mount only here. <!-- sdd-owner: implementation -->
      - [ ] Run the manifest controller/E2E tests and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->
    - `next_recommended: parent-lifecycle`.

## U13A discarded prototype and approved rescope

- The DTO/projection prototype measured **575 physical lines** and was removed rather than exceed the 400-line cap, code-golf, or omit coverage; no source/test delivery or checkbox completion was claimed.
- The user approved U13A1 as DTO-only. U13A2 retains pure projection; U13B remains safe reads/history/current visibility; U13C remains endpoints and mounting.
- U13A1 must stay within final working diff ≤400 and native new delta ≤313; no commit, push, PR, merge, review, receipt, or lifecycle action occurred.

## U13A1 DTO-only apply

- **Status:** parent-selected `seller-property-proposals`, OpenSpec `ready`/`apply`, repo-local target and supplied DTO/OpenSpec roots; no action-context warning. The approved `auto-chain` boundary is U13A1 only.
- **Completed:** six DTO contracts and one DTO transport spec; both persisted U13A1 implementation rows are `[x]`. U13A2 projection, U13B/C, aggregate U13, and parent rows remain unchecked.
- **Files:** six `apps/api/src/property-proposals/dto/*.ts` paths, `property-proposal-transport.spec.ts`, and the allowed U13 OpenSpec artifacts. No controller, module, endpoint, query, response, or projection file changed.

| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U13A1 DTO contracts | Compiling skeleton collected 7 behavioral tests: 5 failed/2 passed. | Explicit decorators passed 7/7. | All-field matrix passed 7/7; `@Min(-1)` mutant failed 2/7, then restoration passed. | Kept explicit decorators; no compressed refactor. |

- **Verification:** guarded localhost `viewpro_test` focused DTO command passed twice (7/7); API typecheck and lint passed. The first skeleton typecheck needed the local contracts build prerequisite; no test/database failure occurred.
- **Cleanup/risk:** offline frozen install and local Prisma generation only; dependency/generated/build/cache residue was removed and `.gitkeep` retained. Full arithmetic is 137 source + 147 test + 91 docs = **375**; native cumulative 87 leaves **288** new lines (both limits met). DTO validation leaves trimming, blank-title, normalization, and submission completeness to domain/use cases.
- **Remaining:** `- [ ] U13A2: RED → GREEN → TRIANGULATE → REFACTOR the literal-allowlisted transport projection and raw-relation exclusion. <!-- sdd-owner: implementation -->`; `- [ ] U13A2: Run its focused projection evidence, API typecheck, and lint. <!-- sdd-owner: implementation -->`.

## U13A2 pure transport projection

- **Status:** parent-provided native status was consumed: `seller-property-proposals`, OpenSpec `ready`/`apply`, repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u13a2-projection`, and the supplied U13A2 edit roots. `auto-chain` selects this U13A2-only slice; no action-context warning occurred.
- **Completed:** added a pure literal transport projector and focused transport spec. It returns only public proposal scalars/timestamps, omits tenant/proposer/relation/assignment/membership/user and injected enumerable values, and copies only a supplied `canonicalEngagementId`; absent links are omitted. `property-proposal.response.ts` remains byte-identical (SHA-256 `2f03d37071090f7d902e0bfd0a9d5a87ae8e7942b55de81e976486f492af1066`).
- **Persisted tasks:** both U13A2 implementation rows now visibly use `- [x]`; U13B/C, aggregate U13, and parent-owned rows remain unchanged.

| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U13A2 projection | Test-first missing-module RED was followed by a compiling `{}` skeleton with 3 behavioral failures/25 response regressions passed. | Literal projector passed 28/28 selected tests. | A currency-to-owner-email mutant failed 1/28; restored projector passed 28/28 twice, including null/date, omission, raw-relation, extra-key, and no-mutation cases. | No refactor beyond direct literal allowlisting. |

- **Verification:** the guarded exact two-spec command was attempted but global setup could not reach local PostgreSQL (`P1001`) before test collection. The same two-spec command under a temporary no-global-setup Vitest config passed twice (2 files/28 tests); API typecheck passed after the required local contracts build; API lint passed.
- **Scope/cleanup:** only `responses/property-proposal.transport.ts`, its spec, `tasks.md`, and this progress artifact changed. Offline frozen install and local Prisma generation were used; no query, snapshot, controller, module, endpoint, schema, relation resolver, or response-source edit occurred. Temporary configuration and generated/dependency/build residue are removed before handoff.
- **Boundary/risk:** final arithmetic is 18 tracked + 206 untracked = **224 changed lines**, under the U13A2 400-line limit; no commit, push, PR, merge, review, receipt, or lifecycle action occurred. U13B still must resolve current/history public fields before response integration.

## U13A2 audited-reset bounded correction

- **Status/scope:** consumed the parent-selected `seller-property-proposals` repo-local apply scope (runtime `proceed63242...`; parent settlement/remediation `c53b...`) after the user-authorized audited reset; the supplied roots are the transport source/spec and this progress artifact. No ambient status was run or reconstructed. The completed U13A2 checkboxes remain visibly `[x]` and were not edited.
- **Correction:** a hostile runtime `null` `canonicalEngagementId` now omits the optional property through an explicit nonempty-string guard. The result metadata test now proves `tenantId` and `sourceProposalId` are each absent while retaining the hostile-extra assertion. Public proposal scalar mapping is unchanged, and C9A `property-proposal.response.ts` remains SHA-256 `2f03d37071090f7d902e0bfd0a9d5a87ae8e7942b55de81e976486f492af1066`.

| TDD Cycle Evidence | Safety net | RED | GREEN | TRIANGULATE / mutation | REFACTOR |
|---|---|---|---|---|---|
| U13A2 hostile result-link correction | Configured normal runner was attempted first with guarded local `viewpro_test` URLs but global setup stopped at local PostgreSQL `P1001`; the documented temporary no-global-setup config then passed 2 files / 28 tests. | New dedicated hostile-null test failed: 1 failed / 28 passed because output contained `canonicalEngagementId: null`. | Explicit string guard passed 2 files / 29 tests twice. | Removing the null guard failed 1 / 29; selectively copying `tenantId` failed its exact absence assertion 1 / 29; selectively copying `sourceProposalId` failed its exact absence assertion 1 / 29. Each mutant was restored. | No refactor beyond the minimal explicit guard. |

- **Verification:** offline `pnpm install --offline --frozen-lockfile` and local `db:generate` completed. Pure focused runs used the temporary no-global-setup config only after the normal runner P1001 and passed 29/29 twice. Direct API typecheck first exposed the existing local contracts-build prerequisite; after `pnpm --filter @viewpro/contracts build`, API typecheck and lint passed. No database was provisioned, queried, or connected by the pure test fallback.
- **Boundary/cleanup:** no controller, query, history/current-read, response-source, schema, module, or C9A edit occurred. No commit, push, PR, review, receipt, or lifecycle action occurred. Offline dependencies, generated output, dist, caches, reports, uploads, and `*.tsbuildinfo` were removed; the generated `.gitkeep` remains. Final candidate arithmetic is 28 tracked additions + 2 tracked deletions + 217 untracked source/test lines = **247 changed lines** (≤400); U13B remains deferred pending its response-contract decision.

## U13B1 seller list summaries and fresh result visibility

- **Status/scope:** consumed the parent-native `seller-property-proposals` OpenSpec repo-local apply-ready status (53/89), U13B1 root, and fresh `develop` `ff2d04ac`; no ambient status was run or reconstructed and no action-context warning was supplied. The two new U13B1 rows are visibly `[x]`; aggregate U13/U13B, U13B2, U13C, and parent rows remain unchanged.
- **Completed:** retained `{ items, total, page, pageSize }` and `updatedAt DESC, id DESC`; list items now use a literal summary allowlist with optional `currentReviewRoundId` and C9A-authorized `canonicalEngagementId` only. The repository retains the original raw seller read port, then loads viewer/exact membership once, rounds once, source engagements once, and matching assignments once for the complete page before resolving every optional link.

| TDD Cycle Evidence | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U13B1 seller summaries | Existing repository/transport/C9A safety net passed 75/75 via the meaningful no-DB unit fallback. New list evidence failed on raw tenant/proposer/relation fields with missing round/result data; new repository evidence failed because the batch reader was absent. | Seller-read/list/transport/C9A focus passed 4 files / 32 tests. | Direct-source-ID, dropped-proposer-predicate, dropped-assignment-tenant, and per-item assignment lookup mutants each failed; restored focus passed twice. | Explicit summary types/map preserve earlier raw read consumers; final focused refactor run passed 32/32. |

- **Verification:** guarded normal focus stopped in global Prisma migration setup at local PostgreSQL `P1001`, so no database was provisioned. The temporary no-global-setup focus passed 32/32 twice; forced API Turbo typecheck passed 6/6; API lint passed. Offline frozen install and local Prisma generation were used; cleanup removes dependency/generated/build/cache residue.
- **Boundary/risk:** no controller/module/endpoint, detail/history, schema, BFF, UI, or U14 work occurred. Final arithmetic is 184 tracked additions + 9 deletions + 104 untracked test lines = **297 changed lines**, under 400 without an exception; the resolved list contract is in `explore-u13-api.md`. Remaining exact rows include `- [ ] U13B: Resolve the current-round/history public-field contract, then RED → GREEN → TRIANGULATE → REFACTOR safe seller read shaping and fresh current visibility without controller or module mounting. <!-- sdd-owner: implementation -->` and `- [ ] U13B2: Resolve seller detail/history shaping and retain equivalent fresh visibility without changing U13B1 list summaries. <!-- sdd-owner: implementation -->`. No commit, push, PR, review, receipt, or lifecycle action occurred.

## U13B2 seller detail/history shaping

### Status consumed

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
workUnit: U13B2
base: d39bb9a3
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u13b2-detail
  allowedEditRoots: parent-supplied U13B2 source/test and OpenSpec paths
  warnings: []
delivery: auto-chain / stacked-to-develop; U13B2 only, under 400 lines
```

- **Resolved contract:** seller detail returns literal proposal staged fields, optional `currentReviewRoundId`, and newest-first immutable `history`. Each history entry contains its ID, round number, submitted date, snapshot, submitter `{ id, firstName, lastName }`, and either `decision: null` or outcome, decided date, nullable rejection reason, and reviewer `{ id, firstName, lastName }`. No email, status, membership, tenant ID, or raw relation is emitted.
- **Completed:** tenant-plus-proposer detail reads now return the identical coded `PROPERTY_PROPOSAL_NOT_FOUND` 404 for absence. The repository batches rounds, decisions, participating users, source engagements, and assignments, then uses the fresh C9A visibility resolver; it does not change U13B1 list summaries.
- **Persisted completion:** the two aggregate U13B rows and U13B2 row are visibly `[x]` in `tasks.md`. Aggregate U13, U13C, and every parent-owned lifecycle row remain unchecked and unchanged.

### TDD Cycle Evidence

| Task | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U13B2 detail/history | Normal focused runner was blocked before collection by local PostgreSQL `P1001`; the no-global-setup fallback then produced 6 failures: missing detail mapper/repository method and legacy raw detail path. | Focused repository/use-case/transport/C9A suite passed 83/83. | Reversing newest-first round order failed 1/2; copying the raw submitter failed 1/6. Existing C9A cross-tenant/untrusted relation and null-decision cases ran in both focused passes. | Kept explicit public-person literals and batched reads; no further refactor was needed. |

### Verification and cleanup

- PASS — no-global-setup focused command for seller read/detail, transport, repository regression, and C9A: 5 files / 83 tests; repeated: 5 files / 83 tests.
- PASS — `pnpm --filter @viewpro/contracts build && pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api lint`.
- BLOCKED INFRASTRUCTURE — the normal focused Vitest command invoked global Prisma migration setup and failed `P1001` before collection; no database was provisioned. The pure fallback was meaningful because all selected tests use mocks and the C9A resolver is pure.
- Removed the temporary fallback config. No fixtures, database connections, controller/module/endpoint, schema, BFF/UI, U14, commit, push, PR, review, receipt, or lifecycle action occurred.

### Workload and remaining work

- Current source/test delta is 201 tracked additions + 14 deletions plus 31 untracked test lines. The full candidate is 248 tracked additions + 17 deletions plus 31 untracked lines = 296 physical changed lines, below the 400-line U13B2 boundary. No design deviation or size exception was used.
- Remaining exact unchecked implementation rows begin:
  - [ ] U13C: RED → GREEN → TRIANGULATE → REFACTOR seller routes, permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, current-role checks, and absent withdraw/delete/image routes; mount only here. <!-- sdd-owner: implementation -->
  - [ ] U13C: Run the approved controller/E2E transport tests and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->
- Deferred lifecycle actions are all parent-owned task rows, preserved byte-for-byte. `next_recommended: parent-lifecycle`.

## U13B2 d9e7 bounded correction

- **Status:** parent exact `seller-property-proposals/runtime proceed1afa`; remediation `d9e7`; OpenSpec target and listed edit roots only; no ambient status used.
- **Corrections:** detail port is required and the use case has no raw fallback; snapshot reuse normalizes the explicit staged-field allowlist; C9A receives the loaded source ID; history actors require tenant membership.
- **TDD:** RED was 2/40 failures (snapshot and actor predicate); GREEN was 40/40. Raw-reader, snapshot-spread, source-ID substitution, and actor-scope mutants failed (4/4, 1/6, 1/5, 1/5) and were restored.
- **Verification:** normal runner first stopped before collection at local PostgreSQL `P1001`; meaningful no-global-setup focused runs passed 40/40 twice; typecheck and lint passed.
- **Superseded blocker:** the five-file fallback had one legacy raw-reader fake outside the former roots; the parent expanded that root and adapted it to the required safe-detail port, after which the 86-test fallback passed twice.
- **Tasks/cleanup:** existing U13B2 checkbox remains `[x]`; `tasks.md` was not edited. The temporary fallback config was removed; no DB, Git, review, or lifecycle action occurred.

## U13B2 d9e7 verification closure

- **Status:** parent expanded only the legacy repository spec root; no ambient status was used.
- **Parent adaptation:** its safe-detail fake returns a shaped detail and asserts `findDetailForSeller`; no source behavior or task state changed here.
- **Verification:** local `db:generate` passed; the exact five-file no-global-setup fallback passed **86/86** twice; API typecheck and lint passed.
- **Cleanup:** temporary config and generated/dependency/build/cache residue were removed; no database was contacted.
- **Arithmetic:** 285 tracked additions + 18 deletions + 31 untracked lines = **334** physical changed lines, below 400.

## U13C1 seller controller contract and first mount

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u13c-endpoints
  allowedEditRoots: parent-supplied U13C1 controller, module, AppModule, and OpenSpec paths
  warnings: []
delivery: auto-chain / stacked-to-develop; U13C1 only, under 400 lines
```

- **Completed:** added only the five seller routes (`POST /`, `GET /`, `GET /:proposalId`, `PATCH /:proposalId`, `POST /:proposalId/submit`) with the exact class guard order and seller permission. Create/update/submit use their mutation result ID only to reread through `GetPropertyProposalUseCase`; list/detail call safe read use cases directly.
- **Files/mount:** added `property-proposals.controller.ts` and its spec; updated `property-proposals.module.ts`, `app.module.ts`, `tasks.md`, `task-delivery-plan.md`, and this progress artifact. `PropertyProposalsModule` now imports `AuthModule`, `PermissionsModule`, and `TenantContextModule`, registers the controller while preserving providers/exports, and `AppModule` imports the module once without another `DatabaseModule` mount.
- **Persisted tasks:** only the two U13C1 implementation rows are visibly `- [x]`; U13C2 and aggregate U13C/U13 rows remain `- [ ]`. No E2E, reviewer, approval/rejection, BFF, UI, schema, or database work occurred.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U13C1 controller contract/mount | Unit metadata and direct wiring | New controller/spec | Controller import failed before production code; normal runner was blocked by local PostgreSQL `P1001`. | Temporary no-global-setup unit run passed 3/3 after the controller and mount. | Removing a guard, changing permission, returning a raw create result, changing submit to 201, and adding withdraw each failed; restored. | Type-only DTO-to-use-case parameter assertions keep the controller boundary explicit; focused run stayed green. |

### Verification and remaining work

- PASS — focused temporary no-global-setup controller spec: 3/3, repeated twice after GREEN; this pure unit fallback was used only after two normal focused commands stopped in global Prisma setup with local `P1001` before collection.
- PASS — `pnpm --filter @viewpro/contracts build && pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api lint`.
- BLOCKED INFRASTRUCTURE — normal focused Vitest invoked `prisma migrate deploy` and could not reach local PostgreSQL; no database was connected or seeded.
- Remaining exact U13C rows: `- [ ] U13C2: RED → GREEN → TRIANGULATE → REFACTOR HTTP transport integration for permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, and current-role checks. <!-- sdd-owner: implementation -->`; `- [ ] U13C2: Run controller/E2E transport evidence and API typecheck; clean seeded rows/assets in finally. <!-- sdd-owner: implementation -->`; aggregate U13C/U13 rows remain unchecked.
- Workload boundary: U13C1 is **271 additions + 2 deletions = 273 physical changed lines**, under 400; U13C2 owns HTTP/E2E transport integration. Temporary config, dependencies, generated contract/build output, caches, reports, uploads, and `*.tsbuildinfo` were removed while `.gitkeep` was retained. No design deviation, commit, push, PR, merge, review, receipt, or lifecycle action occurred.

## U13C2 HTTP/E2E transport integration — runtime blocked

### Status and boundary consumed

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u13c2-e2e
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-proposals.e2e-spec.ts
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
warnings: []
delivery: auto-chain / stacked-to-develop; U13C2 only
```

- Consumed the parent-supplied authoritative status exactly; no ambient/native status was run or reconstructed.
- Added the new 243-line HTTP E2E evidence file only. It covers authenticated active-agent create `201` → list/detail → update/submit `200`; public-response key allowlists and recursive exclusion of tenant/proposer/source/membership/raw-relation keys; unknown create/update/submit bodies and list query rejection; same-tenant manager `403` on a valid absent UUID; same-code `PROPERTY_PROPOSAL_NOT_FOUND` `404` for absent, wrong seller, and another active tenant; persisted role change followed by the same cookie's next-request denial; and absent delete/withdraw/image routes. It adds no reviewer behavior, fixtures helper, or production source change.
- Cleanup in the E2E file is dependency ordered: decisions → rounds → proposals → refresh tokens → memberships → tenants → users, with a zero-proposal postcondition. The runner stopped in global setup before app creation or fixture seeding, so no test rows, assets, worker databases, or app-owned connections were created; existing `_test` worker databases were not changed.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U13C2 HTTP transport | HTTP E2E | N/A — new test file | Not fabricated: the mounted controller behavior already exists and this slice has no production edit. | Blocked before collection by the normal guarded runner's Prisma global setup (`P1001` at `localhost:5432`). | The test cases independently cover lifecycle, validation, authorization-before-lookup, 404 equivalence, role refresh, and absent-route branches, but could not execute without local PostgreSQL. | No production refactor; the lint-only cleanup assertion was converted to an explicit thrown cleanup failure. |

### Verification, cleanup, and remaining tasks

- PASS — `pnpm install --offline --frozen-lockfile`; `pnpm --filter @viewpro/api db:generate`; `pnpm --filter @viewpro/contracts build`; `pnpm --filter @viewpro/api typecheck`; and `pnpm --filter @viewpro/api lint`.
- BLOCKED INFRASTRUCTURE — after the localhost `_test` URL guard, `DATABASE_URL`/`DIRECT_URL` pointed at `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public`; `pnpm --filter @viewpro/api exec vitest run --retry=0 test/property-proposals.e2e-spec.ts` stopped in `test/global-setup.ts` at `prisma migrate deploy` with `P1001` before test collection. No local database was provisioned and no fallback was used because this is HTTP E2E evidence.
- Removed offline dependency directories, generated Prisma/client dependencies, contract `dist`, `.turbo`, and `*.tsbuildinfo`; no cache, report, or upload directory remained. The E2E source file is 243 physical lines, under the 400-line U13C2 budget.
- Persisted task checkboxes were reread and deliberately remain unchecked: `- [ ] U13C2: RED → GREEN → TRIANGULATE → REFACTOR HTTP transport integration for permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, and current-role checks. <!-- sdd-owner: implementation -->`; `- [ ] U13C2: Run controller/E2E transport evidence and API typecheck; clean seeded rows/assets in \`finally\`. <!-- sdd-owner: implementation -->`; the aggregate U13C and U13 rows remain unchecked as required. Parent-owned lifecycle rows are unchanged.
- Remaining blocker: make guarded local PostgreSQL available and rerun the exact U13C2 E2E command; if it exposes a product defect, stop on that exact failure without expanding into U14. No commit, push, PR, merge, review, receipt, or lifecycle action occurred.

## U13C2 bounded static correction after audited reset

### Status and scope consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u13c2-e2e
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-proposals.e2e-spec.ts
    - openspec/changes/seller-property-proposals/apply-progress.md
  warnings: []
delivery: auto-chain / stacked-to-develop; bounded U13C2 correction
```

The parent supplied the exact change/runtime authorization (`proceede643`, remediation `remediates8c5a`) and target worktree; no ambient status was consumed. Proposal, consolidated property-proposals specification, design/interface design, tasks, prior progress, execution ledger, and strict-TDD config were read. The U13C2 checkbox rows remain deliberately unchecked because HTTP evidence did not collect; parent-owned rows were untouched.

### Completed correction

- Enabled the public error envelope for this isolated E2E app and restored its prior environment value during shutdown.
- Replaced loose status-only assertions with exact public envelopes for manager `403`, all unknown body/query `400`s, persisted-role `403`, and absent delete/withdraw/images `404`s. The stable existing fallback is `REQUEST_FAILED`; scoped proposal absence retains `PROPERTY_PROPOSAL_NOT_FOUND`.
- Made the manager permission-test email run-unique. Before the other-active-tenant switch, the test explicitly writes the seller's second tenant to `TenantStatus.ACTIVE` and asserts the persisted ID/status pair.
- Replaced the recursive denylist-only response helper with literal nested allowlists for history rounds, snapshots, submitters, decisions, and reviewers. It recursively rejects `proposedBy`, identity/FK fields, tenant/membership, and raw-relation fields, and explicitly fails when `history` is not an array.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U13C2 static E2E correction | No production source was changed; HTTP execution stopped in global Prisma setup before collection with local `P1001`, so no runtime RED is claimed. | TypeScript parsing/typecheck and lint passed after the test correction. | Assertion reasoning covers wrong fallback code/status, forbidden nested fields, missing history array, and non-ACTIVE tenant setup; each would fail the strengthened test after runtime collection. | Helpers remain small and test-only; no production refactor or route behavior change occurred. |

### Verification and cleanup

- PASS — offline frozen install, Prisma client generation, `pnpm --filter @viewpro/contracts build`, `pnpm --filter @viewpro/api typecheck`, and `pnpm --filter @viewpro/api lint`.
- BLOCKED INFRASTRUCTURE — guarded local `DATABASE_URL`/`DIRECT_URL` E2E invocation reached `test/global-setup.ts` but `prisma migrate deploy` failed `P1001` at `localhost:5432` before collection; no database was provisioned or seeded.
- Removed `node_modules`, generated contract output, Prisma generated/dependency output, `.turbo`, and `*.tsbuildinfo` after verification. No temporary test configuration, cache, report, upload, database fixture, commit, push, PR, review, receipt, or lifecycle action was created.

### CI runtime closure and boundary

- PASS — PR #595 exact head `a1a96bab0239d6e1b8389c89ba15338f1d7c956f` ran the normal API `Test` job: 120 files / 815 tests in its API group, including the new property-proposals HTTP E2E; the complete job passed.
- PASS — one non-candidate Seeded E2E reload-assumption failure was isolated outside this two-file candidate; the single failed-job rerun passed and all exact-head checks became green.
- COMPLETE — both U13C2 rows, both aggregate U13C rows, and both original aggregate U13 rows are now checked. U14 and parent-owned lifecycle rows remain unchanged.

The final E2E candidate remains within the requested 400-line cap. No design deviation or production-source change was made.

## U14A — safe reviewer reads

### Status and completion
```yaml
change: seller-property-proposals
applyState: ready; actionContext: repo-local
workspace: seller-property-proposals-u14-review-api
allowedRoots: supplied U14A paths; warnings: []
delivery: auto-chain / U14A (<400)
```
- Replaced reviewer use-case raw returns with tenant-scoped shaped reads and literal transport output; C9A alone resolves optional result visibility.
- Batched list rounds/proposers/reviewer/membership/results and detail rounds/decisions/actors; preserved C7 filtering/order/pagination, both reviewer roles, and coded scoped absence.
- Persisted only the two U14A task rows as `[x]`; aggregate U14 and U14B/C remain unchecked, and parent rows are unchanged.

### TDD Cycle Evidence
| Task | RED | GREEN | TRIANGULATE / REFACTOR |
|---|---|---|---|
| U14A safe reads | 4 files/7 behavioral failures: missing transport and safe methods/raw reads. | Focused 4 files/13 passed. | Raw-spread, tenant-drop, filter/order, direct-source/capability, and N+1 mutants failed then restored; literal projector refactor stayed green. |

### Verification and boundary
- Normal guarded focus stopped in Prisma global setup with local `P1001`; the pure no-global fallback passed focused 5 files/60 tests twice.
- PASS — contracts build, API typecheck, and API lint. No database, route/controller/module/DTO/materializer/command/E2E/BFF/UI work occurred.
- Remaining: `- [ ] U14B — DTO/controller/module contract`; `- [ ] U14C — Reviewer HTTP E2E`; aggregate U14 remains deferred.
- Final arithmetic is 153 additions + 137 deletions + 107 untracked lines = 397, within the 400-line U14A boundary. No design deviation, commit, push, PR, review, or receipt occurred.

## U14A1 list-only corrective retry

- **Status:** consumed parent authority `seller-property-proposals`, OpenSpec apply-ready, workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u14-review-api`, runtime `proceed904c`, remediation `remediates6147`; all edits stayed in the supplied roots, with no action-context warning.
- **Scope:** reset the combined candidate, restored `get-property-proposal-review` source/spec exactly to `HEAD`, and removed reviewer detail/history types, methods, projectors, and tests. U14A1 now owns only safe list reads; U14A2/B/C remain unchecked.
- **Completed:** preserved every C7 list test while adapting its fixture to the safe port; added a literal list-summary projector and two-row repository evidence. Reviewer role/capability rejection occurs before the repository call; the adapter keeps C7 filters/order/pagination, batches rounds/results/proposers once per page, keeps former-proposer rows, and emits no raw tenant, proposer FK, owner, or source field.

| TDD task | RED | GREEN | TRIANGULATE / REFACTOR |
|---|---|---|---|
| U14A1 reviewer list | New transport import failed; safe-port assertions failed 6/10. | Focused no-global unit suite: 3 files/12 tests passed twice. | Adding proposer membership filtering failed 1/2 repository tests; restored. No further refactor. |

- **Verification:** normal guarded focused Vitest stopped in global Prisma setup with local `P1001`; the safe no-global fallback passed twice (12/12). API typecheck and lint passed. No database fixture, controller, DTO, module, route, E2E, detail/history, commit, push, PR, review, or receipt action occurred.
- **Persisted tasks:** only U14A1's two implementation rows are visibly `[x]`; U14A2, U14B, U14C, and parent-owned lifecycle rows are unchecked and unchanged.
- **Boundary/risk:** final candidate arithmetic is 167 tracked additions + 11 tracked deletions + 126 untracked lines = **304**, within 400. The user batch is keyed by already tenant-scoped proposal identities so former proposers remain visible; missing durable user FKs raise rather than silently drop a row.

## U14A2 reviewer detail/history

### Status and scope consumed

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u14a2-detail
  allowedEditRoots: parent-supplied U14A2 repository, use-case, transport, focused-spec, tasks, and progress paths
  warnings: []
delivery: auto-chain / stacked-to-develop; U14A2 only
```

The parent supplied this authoritative corrective retry context; no ambient status was run or reconstructed. This slice stays below 400 changed source/test lines and does not add controllers, routes, DTOs, module wiring, E2E, or U14B/C work.

### Completed work and persisted task state

- Added a tenant-scoped reviewer detail port, Prisma hydration, literal detail/history mapper, and reviewer use-case mapping while retaining the C7-compatible raw-read seam only for its existing focused fake; the production Prisma adapter always uses the shaped detail port.
- Detail lookup scopes the proposal, rounds, decisions, source engagement, assignments, and current reviewer membership to the tenant. It batches each relation once, keeps rounds newest-first, maps staged snapshots and minimal person fields literally, and emits nullable decisions.
- Durable history actor lookup is driven solely by already tenant-scoped round/decision IDs without a current-membership predicate. Missing proposer or history user data throws an integrity error rather than silently omitting durable history.
- The fresh C9A resolver receives tenant-scoped source, assignment, active reviewer, and current membership data, so `canonicalEngagementId` remains optional and is never directly exposed from a raw relation.
- Updated the U14A2 implementation row to `[x]` immediately after completion. The task artifact has no separate U14A aggregate checkbox; U14B, U14C, aggregate U14, and every parent-owned lifecycle row remain unchecked and unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U14A2 reviewer detail/history | Focused mocked repository/use-case/transport unit tests | Normal focused runner stopped in global Prisma migration setup with local `P1001`; the pre-edit no-global fallback passed 3 files / 12 tests. | Test-first detail port/projector/use-case coverage failed 9 of 21 assertions: missing detail adapter/projector and raw return/absence behavior. | Focused no-global fallback passed 3 files / 21 tests. | Mutating newest order to ascending failed 1/6 reviewer repository tests; removing the fresh C9A result mapping failed 1/10 repository/transport tests. Both were restored. | No further refactor was needed; explicit literal mapping keeps response allowlists auditable. |

### Verification and cleanup

- BLOCKED INFRASTRUCTURE — guarded normal focused Vitest reached global Prisma setup and stopped at local PostgreSQL `P1001` before test collection; no database fixture or connection was created.
- PASS — temporary no-global focused fallback ran twice after the final restoration: 3 files / 21 tests each time.
- PASS — `pnpm --filter @viewpro/contracts build`, `pnpm --filter @viewpro/api typecheck`, and `pnpm --filter @viewpro/api lint`.
- PASS — `git diff --check`; the configured external diff command prevented a later ordinary `git diff` display only and did not affect the whitespace check.
- No design deviation, database use, commit, push, PR, review, receipt, parent lifecycle action, or U14B/C implementation occurred. Temporary fallback configuration and generated/dependency/build residue are removed during final cleanup.

### Remaining tasks and PR boundary

The U14A2 source/test delta is 309 additions and 6 deletions across seven allowed API files, under the 400-line U14A2 review budget without test deletion or code golf. The remaining implementation-owned rows are:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR reviewer DTO/controller/module/provider wiring, static `review` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->
- [ ] Run guarded reviewer query/controller HTTP evidence and API typecheck; return any discovered product defect to U14A2/U14B and clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->
- [ ] RED → GREEN → TRIANGULATE → REFACTOR static `review` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->
- [ ] Run the manifest query/controller E2E tests and API typecheck; clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->

The assigned PR boundary is U14A2 only; return to parent lifecycle for the next controlled slice. Parent-owned lifecycle actions remain deferred byte-for-byte.

## U14B — reviewer DTO/controller/module contract

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u14b-routes
  allowedEditRoots: parent-supplied U14B DTO/controller/module/OpenSpec paths
  warnings: []
delivery: auto-chain / stacked-to-develop; U14B only, under 400 lines
```

The parent supplied the exact target, apply-ready status, and runtime `proceed a122`; no ambient status was used. The proposal, specifications, design/interface, tasks, U14 exploration, prior progress, ledger, and strict-TDD configuration were read before editing.

### Completed work

- Added whitelist-safe reviewer DTOs: list supports only state/history/page/pageSize with pagination conversion; UUID `reviewRoundId` is required for commands; rejection deliberately admits `unknown` reason for the existing use case's coded direct-validation verdict.
- Added the four static reviewer routes before seller `:proposalId`; each uses the existing controller guards, `PROPERTY_PROPOSALS_REVIEW`, trusted tenant/user context, and safe reviewer rereads after commands.
- Registered reviewer reads/commands and imported `PropertyEngagementsModule`. It provides/exports `CanonicalPropertyMaterializer` once, with no duplicate engagements-repository binding or circular import.
- Marked only the U14B implementation checkbox `[x]`; U14C and aggregate U14 rows remain unchecked.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U14B DTO/controller/module | no-global API unit | Existing seller controller contract: 3/3 passed. | DTO imports were absent and controller contract failed 3/3 for absent handlers/module import. | DTO/controller contract: 2 files/6 passed. | Missing guard, wrong permission, raw command result, absent materializer export, accepted `search`, and static-after-dynamic mutants each failed and were restored. | Literal DTO allowlists and direct provider wiring needed no further refactor. |

### Verification and boundary

- PASS — focused no-global DTO/controller fallback twice: 2 files / 6 tests each; contracts build, API typecheck, API lint, and `git diff --check` passed.
- BLOCKED INFRASTRUCTURE — normal guarded focused Vitest stopped during Prisma global migration setup with local PostgreSQL `P1001` before collection; the permitted no-global fallback created no DB fixture or connection.
- The U14B source/test delta is 253 lines; including tasks and this progress entry it is 296 changed lines, within the approved 400-line boundary. No U14C/E2E, schema, BFF, UI, seller-access change, database cleanup, commit, push, PR, review, receipt, or lifecycle work occurred.
- Remaining exact unchecked rows: `- [ ] Run guarded reviewer query/controller HTTP evidence and API typecheck; return any discovered product defect to U14A2/U14B and clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->`; `- [ ] RED → GREEN → TRIANGULATE → REFACTOR static \`review\` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->`; `- [ ] Run the manifest query/controller E2E tests and API typecheck; clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->`.
- Residual risk: controller metadata/unit coverage proves declarations, guards, permissions, DTO whitelist behavior, context wiring, safe rereads, and provider graph; U14C owns real HTTP authorization/status and cleanup evidence.

## U14B audited static-gate correction

- **Status:** parent supplied the same exact target and U14B objective under runtime `proceed b62d`; no ambient status was queried. Allowed edits were limited to this controller spec and cumulative progress artifact.
- **Safety/TDD:** the pre-edit no-global controller contract passed 3/3. Restored direct assertions for seller create/list/get/update/submit trusted tenant/user, proposal ID, body/query forwarding, and the four safe-detail rereads. The strengthened static module contract now proves each reviewer provider and `PropertyEngagementsModule` import occurs exactly once, materializer export occurs exactly once, and proposal providers neither duplicate the materializer nor bind `PROPERTY_ENGAGEMENTS_REPOSITORY`.
- **Verification:** focused pure controller test passed twice (3/3); contracts build, API typecheck, API lint, and `git diff --check` passed. The test is metadata evidence only: this constrained correction does not instantiate the Nest runtime graph; CI/U14C retains runtime HTTP/graph evidence.
- **Mutants:** production mutations (dropping seller args, duplicating provider, or rebinding the engagements token) were not made because they are outside this correction's allowed edit surface; the new assertions are specifically constructed to fail those states.
- **Arithmetic/cleanup:** the candidate is now 312 changed lines including this correction record and remains under 400. Offline dependencies, generated outputs, caches, and the temporary no-global Vitest config are removed; no database work, task-checkbox change, commit, push, PR, review, receipt, or lifecycle action occurred.

## U14C reviewer HTTP E2E — runtime-blocked attempt

### Status consumed

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
runtime: proceed-c534
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u14c-e2e
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-proposals.e2e-spec.ts
    - viewpro-app/apps/api/test/property-proposal-cleanup.ts (not changed)
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
warnings: []
delivery: auto-chain / stacked-to-develop; U14C only; maintainer-approved under 400
```

The parent supplied this exact status and workspace; no ambient/native status query was made. The authoritative proposal, change specification, design/interface, task/verification companions, U14 exploration, prior progress, execution ledger, and strict-TDD guidance were read before editing.

### Work performed

- Added compact HTTP E2E cases to the existing seller suite for unauthenticated and forged-capability denial, static `/review` routing, unsupported/over-limit query rejection, both reviewer roles, tenant list/detail scope and uniform coded 404s, recursive literal safe-response allowlists, and GET write-count invariance.
- Added rejection evidence for coded invalid reasons, normalized durable reason/history reread, stale-round 409, and durable self-review 403.
- Added approval evidence through the mounted real materializer: safe reread/replay, one same-tenant `CAPTURE` source engagement, proposer/reviewer attribution, explicit non-primary assignment, and no owner/image/notification/analytics side effects.
- Extended this suite's dependency-ordered `finally` cleanup to discover and remove proposal-source engagements and captured orphan assets before proposal history, tenant memberships, tenants, and users. No reusable cleanup helper change was needed.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U14C reviewer HTTP evidence | HTTP E2E | Existing seller suite command was attempted after the localhost `_test` guard. | Test-first reviewer cases initially referenced missing test helpers; normal Vitest did not collect because global Prisma migration stopped at local `P1001`. | Static API typecheck and lint passed after helpers/cleanup were added; runtime GREEN is not claimed. | The cases independently cover distinct authorization, validation, tenant, safety, mutation, replay, and side-effect branches; runtime execution remains blocked. | Kept the additions in the existing fixture suite and used the existing cleanup runner; no production refactor occurred. |

### Verification and remaining work

- PASS — local URL guard for `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public`.
- PASS — `pnpm install --offline --frozen-lockfile`, `pnpm --filter @viewpro/api db:generate`, `pnpm --filter @viewpro/contracts build`, `pnpm --filter @viewpro/api typecheck`, `pnpm --filter @viewpro/api lint`, and `git diff --check`.
- BLOCKED INFRASTRUCTURE — `DATABASE_URL="$database_url" DIRECT_URL="$database_url" pnpm --filter @viewpro/api exec vitest run --retry=0 test/property-proposals.e2e-spec.ts` reached `test/global-setup.ts` and failed `prisma migrate deploy` with local `P1001` before test collection, app creation, fixture seeding, writes, cleanup, or mutant execution.
- The updated E2E source is 387 physical lines. The candidate remains within the approved U14C review boundary; no production or non-allowed test file changed.
- Persisted U14C and aggregate-U14 checkboxes remain unchecked because the required HTTP evidence did not execute. Exact remaining implementation rows are `- [ ] Run guarded reviewer query/controller HTTP evidence and API typecheck; return any discovered product defect to U14A2/U14B and clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->` and `- [ ] RED → GREEN → TRIANGULATE → REFACTOR static \`review\` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->`.
- No product defects were observed because the runtime suite did not collect. Required guard/cross-tenant/projection/status/materializer/reason-validation mutants were not attempted: changing production is outside the authorized edit roots and no runtime safety net was available.

## U14C audited static correction

### Status and boundary consumed

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
runtime: proceed-89db
remediation: remediates-40e6
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u14c-e2e
  allowedEditRoots:
    - viewpro-app/apps/api/test/property-proposals.e2e-spec.ts
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
warnings: []
delivery: U14C corrective slice; maximum 400 changed lines
```

No ambient/native status was queried. This corrective pass is test-only: no production source, reusable cleanup helper, other test, lifecycle task, Git delivery, or subagent action occurred.

### Corrected evidence and cleanup

- The initial registration membership is explicitly changed to current `MANAGER` for a real successful review request, then to `PRINCIPAL_MANAGER` for the retained second success.
- The inbox now contains the current-tenant submitted proposal and explicitly excludes a separately submitted active-other-tenant proposal. Forged seller review commands against missing UUIDs return 403 before lookup; unauthenticated 401, static route, and query 400 coverage remain.
- Rejection now covers blank/whitespace/non-string/1001 rejection, accepted 1000-character reason, same-reviewer 200 replay, and stale/different-reviewer 409 outcomes. Approval asserts exactly one asset, source engagement, decision, and assignment, and replay returns the same canonical engagement ID.
- GET snapshots only proposal/round/decision/engagement/assignment counts plus assets created by the fixture seller and tenant-scoped notification, analytics, and platform-outbox counts; it makes no claim about unrelated durable rows.
- Cleanup discovers source engagements inside `try` and removes their captured assets before proposal history. It also deletes tenant-scoped `PlatformOutboxEvent` registration artifacts before tenant/user deletion; `finally` clears run-scoped IDs even if discovery fails.

### TDD and verification

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| U14C static correction | The prior normal HTTP runner is already blocked before collection by localhost Prisma `P1001`; corrective assertions were added before test helper changes. | `pnpm --filter @viewpro/api typecheck` and `pnpm --filter @viewpro/api lint` passed. | Manager/principal, own/other tenant, same/different reviewer, and first/replay approval inputs exercise distinct runtime branches once PostgreSQL is available. | Count scopes and cleanup ordering were tightened without production changes. |

- PASS — API typecheck, API lint, and `git diff --check`.
- NOT RERUN — the HTTP E2E requires unavailable local PostgreSQL and the prior guarded attempt already recorded `P1001` before collection; no runtime pass or task completion is claimed.
- Current candidate arithmetic is 139 additions and 21 deletions in the E2E plus 87 progress additions: 247 physical changed lines, below the 400-line maximum. U14C and aggregate-U14 checkboxes remain unchecked until the guarded HTTP command executes; U15 and all parent-owned rows are unchanged.

## U14C approval-replay count correction

- The first approval response and same-reviewer replay must both return the discovered source engagement ID. A shared bounded count helper snapshots exactly one asset, engagement, decision, and assignment plus zero owner/image rows and unchanged tenant-scoped notification, analytics, and platform-outbox counts; replay must match that complete snapshot.
- This is test-first static evidence for the mounted real approval/materializer/response path. API typecheck, lint, and `git diff --check` pass; the local database remains unavailable, so no HTTP execution or task checkbox completion is claimed.
- U14C intentionally does **not** duplicate stale-approval, quota, or proposer-ineligible HTTP matrices. Those mappings remain explicitly covered by `approve-property-proposal.use-case.spec.ts`, `approve-property-proposal.quota.spec.ts`, and `approve-property-proposal.replay.spec.ts`; the aggregate U14 task remains unchecked pending CI/runtime evidence.
- Current candidate arithmetic is 150 E2E additions + 21 deletions + 87 prior progress additions, before this concise record, and remains below 400 changed lines. No other file changed.

## U14C CI reconciliation

### GREEN and cleanup evidence

- Immutable CI evidence: PR #601 head `72fa5a2e0e4ca079f15213f342d7ba9a69f56925`, run `34496401481` attempt 1, and API Test job `102936624541` all succeeded; `property-proposals.e2e-spec.ts` passed 8/8 in 6875ms, including the three named U14C reviewer scenarios.
- Seeded, typecheck, lint, audit, cutover, and Vercel checks also passed. CI executed the suite's dependency-ordered cleanup; prior local `P1001` and static typecheck/lint chronology remain retained as historical evidence.

### Completion and arithmetic

- Marked exactly the U14C-specific execution row and the two aggregate U14 rows `[x]`; U15+ and parent-owned lifecycle rows remain unchanged.
- Final physical PR arithmetic is the supplied prior 265 lines plus 6 task-checkbox replacement lines and 12 CI-progress lines = **283 changed lines**, within the 400-line boundary. No commit, push, PR, or source/test edit occurred.

## U15A1 shared BFF helper and seller collection

### Status consumed

```yaml
artifactStore: openspec
changeName: seller-property-proposals
applyState: ready
nextRecommended: apply
workUnit: U15A1-helper-and-collection
base: 77ec9d76
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u15a-bff
  allowedEditRoots: user-supplied U15A1 source, tests, and OpenSpec artifacts
warnings:
  - The ambient native status named another worktree and had ambiguous change selection; the parent supplied this exact target, change, base, delivery path, and allowed roots.
```

The parent-authorized delivery is `auto-chain` / `stacked-to-develop`, split as U15A1 then U15A2. The delivery plan and verification companion now formalize both subunits; only U15A1 is complete. The aggregate U15A, U15A2, U15B+, and parent-owned lifecycle rows remain unchecked.

### Completed work

- Added the seller collection BFF route. GET preserves the incoming query string byte-for-byte; POST forwards the raw body and incoming content type without parsing body identity fields. Both paths use only `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`.
- Expanded the shared helper evidence for forwarded session/auth headers, trusted header tenant precedence with cookie fallback, raw JSON identity non-override, `credentials: include`, `cache: no-store`, abort signal and timer cleanup, canonical lowercase UUIDv4 request IDs, JSON/error status passthrough, malformed/empty responses, abort 504, and network 502.
- Hardened timeout classification for DOM `AbortError` objects, which are not always `instanceof Error` in the route test environment.
- Persisted U15A1's two implementation-owned checkboxes as `[x]`; U15A2 and aggregate-U15A checkboxes are visibly `[ ]`.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U15A1 shared BFF helper | Unit | Existing helper spec: 3/3 passed | New abort classification expectation failed: DOM `AbortError` returned 502 rather than 504. | Helper suite passed 13/13 after structural abort-name recognition. | Tenant-precedence, request-ID version/variant, passthrough-status, and 10s-timeout mutants each failed; all were restored. | Reset mocks/timers between tests and made the fake-timer signal assertion explicit; 13/13 remained green. |
| U15A1 seller collection | Route unit | New route; shared helper green | Collection spec first failed to resolve missing `./route`; the raw-body parse and query-allowlist mutants then failed representative malformed/empty or duplicate/encoding assertions. | Collection plus helper passed 19/19 after the minimal shared-helper route implementation. | Valid, malformed, and empty POST bodies plus duplicate encoded GET parameters exercise distinct forwarding paths; every mutant was restored. | No route-local helper was added; mock reset avoids queued-response leakage. |

### Verification and cleanup

- PASS — `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/bff-api.test.ts src/app/api/property-proposals/route.test.ts` — 2 files / 19 tests.
- PASS — `pnpm --filter @viewpro/contracts build`, then `pnpm --filter next-shadcn-dashboard-starter typecheck`.
- PASS — `pnpm --filter next-shadcn-dashboard-starter lint`.
- The first App typecheck was blocked only because the fresh worktree lacked generated `@viewpro/contracts/dist`; the offline frozen install and local contracts build supplied that prerequisite. No network, database, provider, Git, commit, push, PR, review, receipt, or delivery gate action occurred.

### Files changed and remaining work

- `viewpro-app/apps/app-new/src/lib/bff-api.ts`
- `viewpro-app/apps/app-new/src/lib/bff-api.test.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/route.test.ts`
- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/task-delivery-plan.md`
- `openspec/changes/seller-property-proposals/task-verification-commands.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

U15A1 is the assigned under-400 helper-plus-collection PR boundary. The immediate exact unchecked implementation rows are:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR detail and submit method/path/body forwarding, selected-tenant behavior, passthrough status/body, request-ID filtering, malformed/no-body, and timeout handling only through the real shared BFF helpers. <!-- sdd-owner: implementation -->
- [ ] Run only the detail and submit route tests, App typecheck, and lint; clear mock responses, timers, and request context. <!-- sdd-owner: implementation -->
- [ ] U15A aggregate: complete both U15A1 and U15A2 seller BFF slices without route-local helper duplication. <!-- sdd-owner: implementation -->

No design deviation occurred. The residual risk is limited to U15A2's unimplemented detail and submit routes; helper coverage is intentionally shared rather than duplicated there.

## U15A2 seller detail and submit BFF routes

### Status consumed

```yaml
schemaName: gentle-pi.sdd-status
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
workUnit: U15A2-detail-and-submit
base: develop50bd490e
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u15a2-bff
  allowedEditRoots: supplied U15A2 route, test, and OpenSpec paths
warnings:
  - Parent supplied the exact selected status and prohibited ambient/native status lookup.
delivery: auto-chain / stacked-to-develop, C13B; user-approved A1/A2 split under 400
```

### Completed work

- Added GET/PATCH detail and POST submit routes using only `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`.
- Awaited async route params, encoded `proposalId` exactly once, and forwarded PATCH/submit raw text with the incoming content type without body parsing or route-local tenant/auth logic.
- Added focused route tests for encoded slash/space/Unicode IDs, exact methods/paths/raw bodies/content types, success/error passthrough, request-ID filtering, malformed/no-body handling, and representative network/timeout delegation.
- Marked both U15A2 rows and the U15A aggregate row `[x]` in `tasks.md`; U15B+ and every parent-owned row remain unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U15A2 detail/submit routes | Route unit | New route files; U15A1 helper/collection contract was read and its prior 19-test evidence retained. | Both new test files failed to resolve missing `./route` modules before production files existed. | Minimal routes initially passed 10/12; NextRequest supplied `text/plain;charset=UTF-8` for an empty string body, so the test was corrected to assert the actual incoming content type. Focused suite then passed 12/12. | Omitting encoding failed 1/8; parsing PATCH JSON failed 2/8; submit `PATCH` method failed 3/4; forced 200 status failed 3/8; swallowed network error failed 1/8. All mutants were restored. | No production refactor needed; clarified the malformed/no-body test title and reran both route files twice at 12/12. |

### Verification and cleanup

- PASS — focused detail/submit Vitest command twice: 2 files / 12 tests.
- PASS — `pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter next-shadcn-dashboard-starter lint`.
- The initial App typecheck was blocked by the fresh worktree's absent generated `@viewpro/contracts` output; after the local contracts build, typecheck and lint passed.
- No database, provider, shared BFF helper/collection, API/backend, Git, commit, push, PR, review, receipt, or lifecycle action occurred. Dependency, generated, and cache residue is removed after the final postcheck.

### Files, boundary, and remaining work

- `viewpro-app/apps/app-new/src/app/api/property-proposals/[proposalId]/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/[proposalId]/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/[proposalId]/submit/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/[proposalId]/submit/route.test.ts`
- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

This completes the user-approved C13B/U15A2 work-unit and aggregate U15A: 305 additions plus 3 deletions = 308 changed lines, within its under-400-line boundary. Remaining implementation begins with the U15B reviewer BFF rows; parent-owned lifecycle actions remain deferred. No design deviation is recorded.

## U15A2 PATCH encoded-ID test correction

### Status and boundary

The parent supplied exact ready status `proceed3034` / remediation `f1b0` for the existing U15A2 candidate and prohibited ambient status lookup. This correction changes only the detail-route test and this cumulative progress artifact; `route.ts` was authorized only for a temporary mutant and was restored byte-for-byte before final verification.

### TDD correction evidence

| Task | Safety net | Strengthened contract | Mutant RED | Final GREEN |
|---|---|---|---|---|
| U15A2 PATCH forwarding | Focused detail/submit routes: 2 files / 12 tests passed before the test edit. | All valid, malformed, and empty PATCH body cases now use `proposal/con espacio-ñ` and assert `/property-proposals/proposal%2Fcon%20espacio-%C3%B1`. | Removing PATCH `encodeURIComponent` failed 3/12 (one failure for each representative body); it was restored. | Focused two-file command passed twice at 12/12; contracts build, App typecheck, App lint, and `git diff --check` passed. |

### Restoration and accounting

- The pre-mutant and restored `route.ts` Git blob hash is `c691bd0e73a5b9e9f67ed7d09953e900021f0fa0`; its untracked preexisting-candidate status is unchanged.
- No production change, task checkbox, shared helper, other test, commit, push, PR, review, or lifecycle action occurred.
- Final physical total is 326 additions plus 3 deletions = 329 changed lines, within the user-approved 400-line boundary.

## U15B1 reviewer BFF reads: collection and detail

### Status consumed

```yaml
schemaName: gentle-pi.sdd-status
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
taskProgress: 78/104 before this U15B1 work-unit
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u15b-bff
  allowedEditRoots: supplied U15B1 collection/detail routes, colocated tests, and four OpenSpec artifacts
  warnings: []
delivery: auto-chain / stacked-to-develop; user-approved U15B1 reads then U15B2 decisions split under 400
```

The parent supplied this exact authoritative status and explicitly prohibited ambient/native status lookup. The change-local `spec.md` is absent in this candidate; the approved proposal, design, and normative `interface-design.md` were read directly with the required task artifacts before implementation.

### Completed work

- Added reviewer collection GET and reviewer detail GET BFF routes only. They delegate tenant selection, cookies/auth, request-ID filtering, JSON passthrough, malformed/no-body handling, and network/timeout mapping to `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`.
- Collection forwards `request.nextUrl.search` unchanged, preserving duplicate keys, order, percent encoding, and backend-owned unsupported-filter validation. Detail awaits route params and applies `encodeURIComponent` once to the proposal ID.
- Added two colocated route-test files that partially mock only `bffFetch`; the real proxy helpers cover success/error status and JSON, malformed/no-body empty responses, network 502, and AbortError 504. Each test resets the mock state and asserts the route supplies only the BFF path, leaving selected tenant/auth to the shared helper.
- Formalized U15B1 reviewer reads and U15B2 reviewer decisions in tasks, delivery arithmetic, and verification commands. Both U15B1 implementation rows are visibly `[x]`; U15B2 and the U15B aggregate remain `[ ]`.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U15B1 collection/detail GET routes | Route unit | N/A — new route and test files | The new test files failed to resolve their missing `./route` modules; no tests were collected. | Minimal helper-only routes passed 2 files / 12 tests. | Dropping the raw query failed 1/6; dropping detail encoding failed 1/6; forcing a 200 proxy status failed 3/6; swallowing detail fetch errors failed 2/6. Each mutant was restored. | No refactor needed; small route constants and direct helper delegation are already the minimal readable form. |

### Verification and cleanup

- PASS — focused U15B1 Vitest command: 2 files / 12 tests.
- PASS — repeated focused U15B1 Vitest command: 2 files / 12 tests.
- PASS — `pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter next-shadcn-dashboard-starter lint`.
- The first App typecheck attempt was blocked only by the fresh worktree lacking generated `@viewpro/contracts` output; after the local contracts build, typecheck and lint passed.
- Installed dependencies exclusively with `pnpm install --offline --frozen-lockfile`. No database, provider, API/backend, shared BFF helper, seller route, decision route, commit, push, PR, review, receipt, or lifecycle action occurred.

### Files, boundary, and remaining work

- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.test.ts`
- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/task-delivery-plan.md`
- `openspec/changes/seller-property-proposals/task-verification-commands.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

U15B1 is the completed reviewer-read boundary. Exact remaining implementation-owned lines are:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR reviewer reject and approve routes independently; forward only the authorized method/path/raw body through the shared BFF helpers without tenant or decision logic. <!-- sdd-owner: implementation -->
- [ ] Run the two U15B2 reviewer-decision route tests, App typecheck, and lint; clear mocks, timers, and request context. <!-- sdd-owner: implementation -->
- [ ] U15B aggregate: complete U15B1 reviewer reads and U15B2 reviewer decisions without a consolidated route test or route-local BFF helper behavior. <!-- sdd-owner: implementation -->

The U15B1 candidate is 201 untracked source/test lines plus 80 tracked additions and 8 tracked deletions across its OpenSpec closure: 289 changed lines, below the user-approved 400-line boundary. U15B2 is a separate later reviewer-decision work-unit. Parent-owned lifecycle rows are preserved byte-for-byte. No design deviation is recorded.

## U15B2 reviewer BFF decisions: reject and approve

### Status consumed

```yaml
schemaName: spec-driven
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
nextRecommended: apply
taskProgress: 80/107 before; 83/107 after this work-unit
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u15b2-bff
  allowedEditRoots:
    - reviewer reject/approve routes and colocated tests
    - openspec/changes/seller-property-proposals/tasks.md
    - openspec/changes/seller-property-proposals/apply-progress.md
  warnings: []
delivery: user-approved auto-chain / stacked-to-develop U15B2 under 400 lines
```

The parent supplied this authoritative status and parent-held runtime continuation; no ambient/native status lookup or additional runtime-attempt operation was performed. Required proposal, specification, design, interface design, tasks, and prior cumulative progress were read. All task ownership markers are valid; only the three U15B2/U15B implementation-owned rows were changed.

### Completed work

- Added reject and approve POST routes that await `proposalId`, encode it exactly once, forward raw bodies and incoming content types unchanged, and delegate trusted tenant/auth selection, JSON/status/request-ID passthrough, and BFF failures to the shared helpers.
- Added partial-`bffFetch` route tests with real proxy helpers for exact POST paths, raw valid/malformed/empty bodies, content types, success/error JSON status, canonical/invalid request IDs, malformed/no-body backend responses, network 502, AbortError 504, and mock reset hygiene.
- Persisted `[x]` updates immediately for both U15B2 rows and the U15B aggregate row. U16+ and parent-owned lifecycle rows remain byte-for-byte unchanged.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U15B2 reject/approve BFF routes | Route unit | N/A — all four routes/tests are new. | After offline install, both test files failed to resolve missing `./route` modules; no tests collected. | Minimal helper-only routes passed 2 files / 10 tests. | Mutants failed and were restored: missing encoding 1/5, JSON parsing 2/5, wrong path 4/5, wrong method 4/5, forced status 4/5, and swallowed network error 1/5. Raw valid, malformed, and empty body cases cover distinct forwarding paths. | No production refactor was needed; clarified parameterized test titles and reran both files twice at 10/10. |

### Verification and cleanup

- PASS — focused U15B2 Vitest command twice: 2 files / 10 tests.
- PASS — `pnpm exec turbo run typecheck --filter=next-shadcn-dashboard-starter --force`: 3/3 tasks, including the required contracts build.
- PASS — `pnpm --filter next-shadcn-dashboard-starter lint`.
- The direct App typecheck initially could not resolve the fresh worktree's generated `@viewpro/contracts` output; the dependency-aware Turbo typecheck generated it and passed without source changes.
- `pnpm install --offline --frozen-lockfile` was used only for verification. No shared helper/read/seller/backend/docs-plan files, database, provider, commit, push, PR, review, receipt, or lifecycle action was performed.

### Files, boundary, and remaining work

- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.test.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.ts`
- `viewpro-app/apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.test.ts`
- `openspec/changes/seller-property-proposals/tasks.md`
- `openspec/changes/seller-property-proposals/apply-progress.md`

This is the user-approved U15B2 decision slice and completes the U15B aggregate: 288 additions plus 3 deletions = 291 changed lines, within the approved 400-line boundary. Dependency, generated-contract, `.turbo`, `.next`, and `*.tsbuildinfo` residue was removed; `git diff --check` passed. Exact next unchecked implementation-owned rows begin with U16A:

- [ ] RED → GREEN → TRIANGULATE → REFACTOR typed service calls through `bffRequest`, `BffError`, canonical UUIDv4 capture, hostile-prose removal, local code mapping, and timeout behavior. <!-- sdd-owner: implementation -->
- [ ] Run the manifest service/client specs, App typecheck, and strict lint; reset query clients and mock servers. <!-- sdd-owner: implementation -->

No design deviation is recorded, and all parent-owned lifecycle actions remain deferred.

## U16A1 BFF error boundary

### Status and delivery boundary

```yaml
changeName: seller-property-proposals
artifactStore: openspec
applyState: ready
runtime: proceed2fc9
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u16a1-bff-error
  allowedEditRoots: supplied U16A1 BFF and OpenSpec paths
warnings: []
```

The parent supplied status directly; no ambient/native status lookup was performed. The approved split replaces the oversized U16A candidate with U16A1 (this BFF boundary) and dependent U16A2 (typed proposal service). U16A1 is complete and visibly checked; U16A2 and aggregate U16A remain unchecked.

### Completed work

- `BffError` now exposes only safe status, known catalog code, generic message, and optional canonical lowercase UUIDv4 `requestId`.
- Canonical header IDs win body IDs; invalid or absent headers fall back only to canonical body IDs. Browser memory capture and SSR isolation remain intact.
- Abort failures map to 408; non-abort fetch failures map to generic safe 502; returned HTTP 504 remains unchanged.
- Updated task, delivery-plan, and verification-command artifacts to formalize U16A1 → U16A2.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| U16A1 BFF boundary | Unit | Existing client spec passed 20/20 after offline dependency install and contracts build. | Added request-ID and network assertions first; 4/24 failed because `BffError` lacked request IDs and network errors leaked. | Focused client spec passed 24/24 twice. | Reversed header precedence, leaked `TypeError`, accepted uppercase UUIDs, and admitted unknown codes; the focused spec failed 4/24 and was restored. | Extracted canonical-ID parsing so response capture and `BffError` use the same boundary. |

### Verification and cleanup

- PASS — focused U16A1 client spec twice: 24/24 each run.
- PASS — App typecheck.
- PASS — App strict lint.
- Mutants failed then restored for header precedence, network leakage, UUID case validation, and unknown-code admission.
- Offline frozen installation and generated contracts were used only for verification; no route, feature service/type, query, UI, backend, or contract source changed.

### Remaining work

- [ ] RED → GREEN → TRIANGULATE → REFACTOR typed seller/reviewer service calls through `bffRequest`, local code mapping, signals, and timeout behavior. <!-- sdd-owner: implementation -->
- [ ] Run the focused service spec, App typecheck, and strict lint; reset mocks and query state. <!-- sdd-owner: implementation -->
- [ ] U16A aggregate: complete U16A1 and U16A2 without feature routes, queries, UI, backend, or contract changes. <!-- sdd-owner: implementation -->

Parent-owned lifecycle rows were preserved byte-for-byte. No commit, push, PR, review, receipt, or delivery action occurred.

## U16A1 request-ID boundary correction

Status consumed: parent-directed `seller-property-proposals` U16A1 corrective pass, runtime `proceed3baf`, remediation `df6c`, repo-local target with only the supplied BFF and progress roots; no ambient/native status lookup occurred.

- `BffError` canonicalizes its exported constructor argument, so invalid IDs cannot be retained.
- `toBffError` canonicalizes a supplied ID before applying the existing response-header then response-body fallback order.
- Added direct constructor/fallback tests and a real `bffRequest` HTTP 504 assertion proving the returned response remains status 504 with only safe code/message/request-ID fields.

| TDD cycle | Evidence |
|---|---|
| Safety net | Pre-correction focused client spec passed 24/24. |
| RED | New constructor and supplied-ID fallback tests failed 7/32 because invalid IDs were retained/prioritized. |
| GREEN | Focused spec passed 32/32. |
| TRIANGULATE | Constructor-validation bypass, invalid-supplied-ID priority, and 504→502 mutants failed 11/32; restoration passed. |
| REFACTOR | Reused the existing canonical-ID helper for every exported and internal error boundary. |

Verification: focused client spec passed twice at 32/32; App typecheck and strict lint passed; `git diff --check` passed. Offline dependencies/generated contracts were used only for verification and will be removed during cleanup. U16A1 checkboxes remain visibly `[x]`; U16A2 and aggregate U16A remain unchecked. No design deviation, route, service/type, UI, backend, contract, commit, push, PR, review, or receipt action occurred.
