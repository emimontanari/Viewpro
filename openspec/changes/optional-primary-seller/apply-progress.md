# Apply Progress: optional-primary-seller — S1 schema persistence

## Scope and status
- Work unit `s1-ci-lint-remediation` (PR1/S1 only); adds only `candidateReplayFailure` as the AggregateError cause in `property-agent-primary-schema.spec.ts`; no PR2–PR7, production schema, migration, fixtures, cleanup helper, or test behavior changed.
- Native OpenSpec status consumed: `applyState: ready`, `nextRecommended: apply`, repo-local root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/optional-primary-seller-s1-schema`, no warnings; parent retains the active attempt token.
- Persisted S1 Slice 1A/1B implementation rows at `tasks.md:72-75,79-82` remain visibly checked: 8/8; all PR2+ and seven parent lifecycle rows remain untouched.
- First attempt was blocked solely by 449 changed lines (441 additions + 8 deletions), bound to failed evidence `sha256:188ebe0ff2cd972f631af35caaab60e616af93ff5066a2b1f753788926df7ebb`.

## TDD Cycle Evidence
| Slice | RED → GREEN | TRIANGULATE → REFACTOR |
|---|---|---|
| 1A schema/migration | RED removed named index: `primaryIndex` undefined (1F/2P); GREEN restored exact bytes, 3/3. | Replay seeds two legacy rows, proves false/zero, permits one true, rejects second with `23505`; additive/no-backfill retained. |
| 1B fixture | RED/GREEN adds only narrow-fixture `isPrimary: false`; focused use case remains 1 file/37 passed. | Scoped fixture only; no shared `ProductAgent`, auto-selection, or parallel entity. |
| Cleanup + CI lint | RED missing `cleanup-steps`; GREEN aggregate-and-continue 1/1; CI lint RED `preserve-caught-error` at schema spec:96. | Ordered all-success 2/2; lint GREEN after `AggregateError` ErrorOptions causes the caught replay failure to be preserved. |
- Fault injection appended `THIS_INTENTIONALLY_BREAKS_CANDIDATE_MIGRATION;`: replay failed as expected, then independent fallback restored `isPrimary` non-null/default false and named index; candidate bytes were immediately restored.
- Dependency remediation: identical-lock frozen `pnpm@10.13.1` temporary-store install ignored Prisma build scripts, so explicit `db:generate` and `@viewpro/contracts build` were required; generated links, `node_modules`, and contract `dist` were removed after checks.

## Final verification
- RED: `pnpm --filter @viewpro/api lint` — FAIL only `eslint(preserve-caught-error)` at `test/property-agent-primary-schema.spec.ts:96`; GREEN rerun after the cause change — PASS.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api exec vitest run test/cleanup-steps.spec.ts test/property-agent-primary-schema.spec.ts` — PASS, 2 files/5 tests.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api db:validate` — PASS.
- `VIEWPRO_TEST_BASE_DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public DATABASE_URL=$VIEWPRO_TEST_BASE_DATABASE_URL DIRECT_URL=$VIEWPRO_TEST_BASE_DATABASE_URL pnpm --filter @viewpro/api typecheck` — PASS.
- `git diff --no-ext-diff --check` — PASS; `--no-ext-diff` bypasses this worktree's configured `/bin/false` external diff.
- Every database command used only local `viewpro_test` and derived `viewpro_test_w1`–`w4`; no Neon, development `viewpro`, production, or other database was accessed.

## Candidate budget and boundary
- Corrected full-candidate accounting, including docs/tasks: `git diff --no-ext-diff --numstat HEAD^` = 390 additions + 8 deletions; total = 398 changed lines (<=400).
- The 398-line candidate includes progress 30, migration 8, cleanup spec 57, cleanup helper 22, schema spec 262, and docs/tasks; no generated dependency artifacts remain.
- Residual risk: Prisma cannot declare the partial unique index; the named raw migration and automated live PostgreSQL replay remain its contract.
- `auto-chain` boundary is S1 only; PR2 owns transaction/eligibility/error mapping and begins only from refreshed landed `develop`; next action is `parent-lifecycle`.

## S2 repository mutations (PR2)

### Scope and status
- Native authority consumed: `applyState: ready`, clean base `d6504ea23ff6e88233dbf7e5f5f973b3cf66f1b2`, `auto-chain` delivery path, and allowed S2 rows only (`tasks.md:93-96,100-103`); action-context warning: none supplied, and all edits stayed in the authoritative worktree; parent retains the attempt token.
- Completed and visibly checked all eight S2 implementation rows. Parent-owned lifecycle rows and every PR3+ row remain unchanged.
- Added typed set/clear inputs and stable `updated | engagementNotFound | candidateInvalid | stateConflict` results. The required `expectedPrimaryAgentId: string | null` compares null explicitly.
- Set/change, clear, and removal use one interactive transaction with a tenant-scoped `property_engagements FOR UPDATE` serialization seam. Candidate eligibility and full engagement read stay in that transaction; replacement clears before it sets, rejected candidates make no flag writes, and removal deletes the primary naturally without promotion.
- Deviation intentionally retained for PR3: only the minimal engagement serialization seam is present. Separate assignment/user/membership `FOR NO KEY UPDATE` helpers, named P2002 hardening, real-Postgres races, and final lock-order proof are not implemented here.

### TDD Cycle Evidence
| Tasks | Test file / layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| 2A (93–96) | `property-engagements.repository.spec.ts` / mock repository | 29/29 passed | 14 new behavior cases failed (missing methods) | 44/44 passed | Eligible replace, idempotent set/clear, null/stale state, and five invalid categories exercised | Extracted engagement lock, current-primary, and locked-read helpers; 44/44 remained green |
| 2B (100–103) | `property-engagements.repository.spec.ts` / mock repository | included above | Primary/non-primary removal mocks failed because deletion was not transactional | 44/44 passed | Primary/non-primary and missing engagement/assignment paths require `$queryRaw` transaction mocks | Reused the engagement lock helper without touching authorization or response behavior |

### Verification and boundary
- PASS: `pnpm --filter @viewpro/api exec vitest run test/property-engagements.repository.spec.ts` (44 tests).
- PASS: `pnpm --filter @viewpro/api typecheck` after a temporary `pnpm --filter @viewpro/contracts build` prerequisite.
- PASS: `pnpm --filter @viewpro/api lint` and `git diff --no-ext-diff --check`.
- No database command was needed; no Neon, development, production, or non-local database was accessed.
- Temporary frozen-lock dependencies, Prisma client generation, contracts build output, and the temporary pnpm store are removed before handoff. No unchecked S2 task remains; remaining implementation tasks are PR3–PR7 and apply-owned broader gates.

### S2 P2 review remediation — removal proof
- Native continuation authenticated as `proceed` for `s2-review-remediation`; `auto-chain` S2 boundary remains in effect, action context is repo-local with the repository as its allowed root, and no task checkbox changed.
- Replaced equivalent parameter mocks with stateful assignment rows: primary deletion leaves the non-primary row false with no primary, while non-primary deletion preserves the primary; both retain the exact id/tenant/engagement delete filter.
- The stateful mock fails if delete starts before the engagement lock, and a deferred-lock barrier keeps delete uncalled until `$queryRaw` resolves; this is mocked ordering evidence only, not PR3's real-PostgreSQL race/row-lock proof.
- RED: temporarily reversed `removeAgent` to delete before `lockTenantEngagement`; focused suite failed 4/45 (both ordering cases, unresolved-lock barrier, and missing-engagement no-delete). The original production file was restored byte-for-byte before GREEN.
- GREEN: focused repository suite passed 45/45; API typecheck and lint passed; `git diff --no-ext-diff --check` passed.
- Full candidate from `d6504ea` is 368 additions + 17 deletions = 385 changed lines (<=400); final production file equals `HEAD` and no production change is staged.

## S3 PostgreSQL concurrency (PR3) — final verification remediation
- Status: authoritative OpenSpec `ready/apply`, repo-local allowed root, no warnings; parent-owned `proceed`, `auto-chain` PR3 boundary.
- Prior test-only remediation preserved: failed evidence `sha256:a2766c0acefe741e5cf61c14ed89cd3d7abde3223b14b92a4638bc278d62ad5f` now settles invalidation-first and proves lock sequencing; real DB was 11/11, combined 60/60, observed `Lock`, and cleaned all fixtures/connections.
### TDD Cycle Evidence
| Task | Safety net | RED | GREEN / TRIANGULATE / REFACTOR |
|---|---|---|---|
| S3 P2 P2002 guard | repository unit 48/48 | real named `meta.constraint` P2002 escaped: 1/51 failed | local guard now matches `constraint` or exact target array; other/missing P2002 and P2025 propagate, 51/51; no refactor needed. |
- P2 verification: `pnpm --filter @viewpro/api exec vitest run --config vitest.unit.config.ts test/property-engagements.repository.spec.ts` 51/51; API typecheck and strict lint pass; no DB used because lock SQL/barrier is unchanged.
- Production lock SQL/barrier hash before P2: `0b44f3626c3e5aca91d380e8cc98ecd7ef75c938e4bec7f9f831c54a775e6c69`; temporary dependencies/build artifacts are removed.
- S3 rows 114–117 and 121–124 remain checked; parent rows untouched. Remaining exact unchecked line: `- [ ] **RED** — Add failing runtime-contract and use-case tests in `viewpro-app/packages/contracts/test/runtime-contract.spec.ts` and `viewpro-app/apps/api/test/property-engagements.use-cases.spec.ts` for `PRIMARY_AGENT_CANDIDATE_INVALID` (400), `PRIMARY_AGENT_STATE_CONFLICT` (409), required-but-nullable expected fields, complete response shape, and generic operator-safe messages. <!-- sdd-owner: implementation -->`.
- Workload: PR3-only candidate remains <=400; PR5 owner-contact remains untouched.

## S4 API exposure (PR4)

- Native authority: `ready/apply`, `proceed`, `auto-chain`, `s4-api-routes-localhost`; all edits are in the authorized worktree with no action-context warning.
- Completed and checked Slice 4B tasks 142–145. Added only guarded API wiring and compact existing-harness e2e coverage; no schema, owner, BFF, UI, or permission change.
- Routes: `PUT /property-engagements/:id/agents/primary` and `POST /property-engagements/:id/agents/primary/clear`, both `ENGAGEMENTS_CREATE`, existing auth/tenant/permission guards, `CurrentTenant`, normal response, HTTP 200.

### TDD Cycle Evidence
| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| 4B routes | e2e | 35/35 | both routes absent: 404 instead of 200/403 | 37/37 | set/clear flags, 403-before-write, tenant 404, cross-tenant 400, non-primary list access | table-driven rejection cases; focused suite and lint green |

### Verification and safety
- PASS: endpoint e2e 37/37; use cases 40/40; contracts 5/5; contracts build/typecheck; API typecheck and strict lint.
- Local preflight used only `postgresql://viewpro:viewpro@localhost:5432/viewpro_test`; the existing harness alone created test-only local worker databases. No external, development, staging, or production database was accessed.
- No design deviations. Remaining unchecked implementation work is PR5–PR7 and the existing apply-owned gates; parent-owned lifecycle rows are unchanged.

### Workload and cleanup
- PR boundary: PR4/API exposure only; exact S4 candidate accounting including untracked files is 320 additions + 11 deletions = 331 changed lines (<=400).
- Files added to Slice 4B: controller, module, and property-engagement e2e test only; temporary node_modules, contract dist, Prisma output, build info, clients, and uploads are absent.
