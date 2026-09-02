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

## S5 owner contact (PR5)
- Native status consumed: authoritative OpenSpec `ready/apply`; repo-local allowed root was this S5 worktree, `auto-chain` resolved the High-risk workload, and no action-context warnings/blockers were supplied. S5 rows 156–159 and 163–166 are now visibly checked.
- One owner-authorized engagement lookup precedes a fixed `Promise.all` of movement page, count, and exactly one `propertyAgent.findFirst`; the candidate requires matching tenant/engagement, `isPrimary`, active user, active same-tenant exact `AGENT` membership, and selects only assignment/user identity plus phone.
- Movement records no longer carry assignment arrays. The shared candidate is passed to every movement mapper; null, missing, or unusable phone preserves the existing unavailable assigned-seller response without agency/other-seller fallback. Owner click analytics and property-level tenant contact were unchanged.

### TDD Cycle Evidence
| Slice | Safety net | RED | GREEN | TRIANGULATE / REFACTOR |
|---|---|---|---|---|
| 5A/5B | 39 focused tests passed | 3/34 failed: missing candidate result/query and candidate mapper flow | 34/34 passed after minimal repository/mapper/use-case changes | 40/40 validates fixed query count, hidden-owner no-query path, all conjunctive filters, explicit primary/no-primary, bad/null phone, labels, and shared mapping; removed order/fallback branches. |

### Verification and boundary
- PASS: focused API owner repository/use-case suite, 40/40; owner portal e2e suite, 10/10; API typecheck and strict lint; App New unchanged suite, 112 files/703 tests; `git diff --no-ext-diff --check`.
- All API test commands used only `postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public`; no non-local database was accessed. PR5 remains the `auto-chain` boundary; no design deviation, mutation/API/BFF/UI, auth, or click-flow change.
- Remaining implementation rows are PR6/PR7 and apply-owned verification gates; parent-owned lifecycle actions remain deferred and byte-for-byte untouched in `tasks.md`.

### Exact remaining implementation rows
- [ ] **RED** — Add failing App New service/type tests under `viewpro-app/apps/app-new/src/features/products/` for required `expectedPrimaryAgentId: string | null`, set/change and clear payloads, `PropertyAssignedAgent`, `PropertyEngagement.agents`, and unchanged dashboard/activity `ProductAgent` producers. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Update `features/products/api/types.ts` with the scoped `PropertyAssignedAgent` and payload types and `features/products/api/service.ts` with `setPrimaryProductAgent` and `clearPrimaryProductAgent`, both returning `PropertyEngagement` and preserving existing query key/tenant conventions. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the focused App New type/service tests plus the package typecheck to prove property responses require primary state while dashboard/activity contracts remain compatible without fabricated fields. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Keep `ProductAgent` broadly unchanged, avoid a parallel management service, and centralize only safe code-based primary mutation messages in `features/products/error-messages.ts`. <!-- sdd-owner: implementation -->
- [ ] **RED** — Add failing adjacent route tests for `src/app/api/products/[id]/agents/primary/route.ts` and `.../clear/route.ts` covering method/path/body forwarding, selected tenant header, 400/409 body and `x-request-id` passthrough, timeout, and transport failure. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Implement the PUT and POST product BFF routes using existing `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse` conventions; forward auth cookies/selected tenant and backend error bodies unchanged. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the two focused route test paths and inspect that no optimistic/UI state is introduced in the adapter, request ids survive error responses, and unknown transport failures use the established safe proxy response. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Match neighboring product route structure and keep route code limited to proxy adaptation, with no duplicated authorization or candidate validation. <!-- sdd-owner: implementation -->
- [ ] **RED** — Extend `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.test.tsx` with failing cases for required `Principal` badges, `Sin vendedor principal`, exact-`AGENT` action gating from loaded assignable members, persisted-but-ineligible primary supporting copy, non-primary access, archived state, and unauthorized state. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Update `property-agents-section.tsx` and `manage-property-agents-dialog.tsx` to derive `primaryAgentId` from `isPrimary`, render selected/no-primary/ineligible states, expose `Marcar como principal` only for assigned exact-`AGENT` users, expose separate `Quitar principal`, and retain existing assignment removal as a separate action. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the focused component test and inspect accessible labels/action visibility for no-primary, selected, stale/ineligible, archived, and unauthorized states; confirm primary status grants no additional assignment access. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Keep changes inside the existing seller-management surface, avoid automatic selection or optimistic badge changes, and preserve `product-form.tsx` prop flow and unrelated assignment controls. <!-- sdd-owner: implementation -->
- [ ] **RED** — Add failing component tests for set/change/clear payload preconditions, no `onMutate` primary edit, successful returned-engagement cache replacement, product invalidation, conflict-triggered detail refetch, candidate-invalid refetch, safe error copy, and primary removal yielding no primary without promotion. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Wire the UI mutations to the PR 6 service methods, capture the derived current `expectedPrimaryAgentId` including explicit null, install only the returned `PropertyEngagement` into `productKeys.detail(productId, tenantId)`, invalidate product queries, refetch before conflict/invalid feedback, and disable assign/set/change/clear/remove while any seller mutation is pending. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the focused component tests plus the App New typecheck and strict lint; verify the requested losing seller is never painted before a successful server response and the refreshed durable winner/no-primary state is rendered after conflict. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Consolidate mutation error handling through code-based safe local copy, preserve last server state on generic failures, and do not alter WhatsApp/contact behavior or add a second query/cache authority. <!-- sdd-owner: implementation -->
- [ ] Run API schema validation with `pnpm --filter @viewpro/api db:validate` after PR 1 and after any Prisma change; record output and test-database safety. <!-- sdd-owner: implementation -->
- [ ] Run focused API tests with `pnpm --filter @viewpro/api exec vitest run test/property-engagements.repository.spec.ts`, `pnpm --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts`, `pnpm --filter @viewpro/api exec vitest run test/owner-portal.repository.spec.ts`, and `pnpm --filter @viewpro/api exec vitest run test/owner-portal.use-cases.spec.ts` as each seam lands; include the barrier-controlled real-Postgres tests in the applicable e2e path. <!-- sdd-owner: implementation -->
- [ ] Run focused App New tests with `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-agents-section.test.tsx` and the two new product-agent primary route test paths after PR 6/7. <!-- sdd-owner: implementation -->
- [ ] Run the broader configured checks before delivery: `pnpm --filter @viewpro/api db:validate`, `pnpm --filter @viewpro/api typecheck`, `pnpm --filter @viewpro/api test`, `pnpm --filter next-shadcn-dashboard-starter test`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `pnpm --filter next-shadcn-dashboard-starter test:seeded`, and `pnpm --filter @viewpro/contracts test`; use the API test database required by `openspec/config.yaml`. <!-- sdd-owner: implementation -->
- [ ] Run repository documentation-only checks `git status --short` and `git diff --check` from the configured `viewpro-app` cwd, and confirm only the intended work-unit files are present before each PR. <!-- sdd-owner: implementation -->

## S5 proof-gap correction
- Native OpenSpec status: `ready/apply`, repo-local authorized root, `auto-chain` PR5; the parent supplied the same-token `proceed` continuation.
- Replaced the tied-primary e2e case with two usable, non-primary assigned sellers that return unavailable contact with no phone.
- S-2 retains a usable alternate seller while the returned primary phone is null; the mapper signature now requires an explicit candidate and its repository test passes `null`.
- No task checkbox changed; completed S5 rows and the prior PR6/PR7 and gate backlog remain unchanged.
### TDD Cycle Evidence
| Scope | RED | GREEN / TRIANGULATE / REFACTOR |
| --- | --- | --- |
| S5 proof | Signature guard failed while the default was present; corrected behavior cases passed immediately because production semantics were already correct. | Repository 12/12, use cases 28/28, E2E 10/10; no refactor. |
### Verification
- API typecheck and lint pass; localhost worker configuration has one prepared database per worker.
- `git diff --check` passes; this corrective PR5 boundary remains within the 400-line budget.

## S6 App New BFF — resolved
- Native status: authoritative `ready/apply`; repo-local root/allowed edit root, `auto-chain` PR6 boundary, parent continuation token, and no action-context warning.
- Completed and checked S6 rows 175–178 and 183–186. `PropertyEngagement` is detail-strict, `ProductListItem` safely narrows list agents, and exactly five list-consumer annotations/imports changed.
- PUT/POST BFF adapters forward JSON through default `bffFetch` cookie/tenant context and preserve backend 400/409 bodies/request IDs; shared errors yield 504 abort or 502 transport responses.
- Files: product types/service/error messages and focused tests; two routes/tests; five authorized list-only consumer surfaces. No runtime/render/action/cache or S7 change.
- PASS: focused service/error/two-route/helper/operational-homepage/product-table tests, 29/29; composed BFF helper 3/3; App New typecheck, strict lint, and full test 116 files/722 tests.
- RED: missing service/error exports and route modules failed; GREEN and triangulation cover change/null CAS payloads, detail/list compile boundaries, 400/409, request IDs, abort, and transport.
- No design deviation. Remaining unchecked implementation rows are PR7 plus apply-owned gates in `tasks.md`; parent lifecycle rows remain deferred.

### TDD Cycle Evidence
| Tasks | Safety net | RED | GREEN / TRIANGULATE / REFACTOR |
|---|---|---|---|
| 175–178 | 16 focused baseline | missing exports | 20/20; CAS/type/error cases; clean |
| 183–186 | new routes; helper 3/3 | absent modules | 20/20; proxy/error cases; clean |

## S7A UI primary server-state rendering — resolved
- Authoritative OpenSpec status consumed: `ready/apply`; the parent supplied same-token `proceed`, `auto-chain`, the S7A allowed roots, and no action-context warnings.
- The requested target-local frozen offline install passed with no network: `COREPACK_ENABLE_NETWORK=0 /opt/homebrew/bin/pnpm install --offline --frozen-lockfile --ignore-scripts`.
- The first focused run was infrastructure-blocked by unbuilt `@viewpro/contracts`; a local contracts build enabled the runner without changing candidate sources.
- RED then found one candidate-test defect: its single `Principal` query was ambiguous because the panel and dialog correctly render two badges.
- GREEN changed that assertion to require both badges; the focused component suite passed 9/9, and App New typecheck plus strict lint passed.
- Commands: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-agents-section.test.tsx`, `pnpm --filter next-shadcn-dashboard-starter typecheck`, and `pnpm --filter next-shadcn-dashboard-starter lint:strict`.
- Files changed: `property-agents-section.test.tsx`, `property-agents-section.tsx`, `manage-property-agents-dialog.tsx`, `tasks.md`, and this progress record; no design deviation.
- Checked only S7A rows 198–201 after the rendering-only split; all S7B action/gating/CAS/cache rows remain unchecked.
- `primaryAgentId` is derived only from `agents[].isPrimary`; selected, no-primary, persisted-ineligible, archived, and unauthorized states are covered.
- Diff inspection found no primary mutation service import/call, action control, primary-specific `onMutate`, cache edit, or changed assignment access behavior.

### TDD Cycle Evidence
| Slice | RED | GREEN / TRIANGULATE / REFACTOR |
|---|---|---|
| S7A rendering | Existing focused suite ran after offline dependencies; one behavioral assertion failed 8/9. | Corrected test expectation; 9/9, typecheck, and strict lint pass; no production refactor required. |

### Verification and cleanup
- PASS: focused Vitest, App New typecheck, strict lint, and `git diff --check`.
- Candidate boundary: five allowed files only; under the 400-line S7A budget; no files staged.
- Removed target `node_modules`, contracts `dist`, builds, reports, `next-env.d.ts`, and `*.tsbuildinfo`; restored generated tsconfig paths.

### Remaining implementation rows
- [ ] **RED** — Add failing component tests for exact-`AGENT` set/change action gating from loaded assignable members, separate clear action, set/change/clear payload preconditions, no `onMutate` primary edit, successful returned-engagement cache replacement, product invalidation, conflict-triggered detail refetch, candidate-invalid refetch, safe error copy, and primary removal yielding no primary without promotion. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Wire explicit set/change/clear UI actions to the PR 6 service methods, capture the derived current `expectedPrimaryAgentId` including explicit null, install only the returned `PropertyEngagement` into `productKeys.detail(productId, tenantId)`, invalidate product queries, refetch before conflict/invalid feedback, and disable assign/set/change/clear/remove while any seller mutation is pending. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the focused component tests plus the App New typecheck and strict lint; verify exact-`AGENT` action visibility, no action for an ineligible persisted primary, no pre-success paint, and refreshed durable winner/no-primary rendering after conflict. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Consolidate mutation error handling through code-based safe local copy, preserve last server state on generic failures, and do not alter WhatsApp/contact behavior or add a second query/cache authority. <!-- sdd-owner: implementation -->

## S7B UI primary actions and cache reconciliation — corrected
- Parent-supplied authoritative OpenSpec status consumed: `optional-primary-seller`, `ready/apply`, repo-local five-file allowed root, and parent-retained same-token `proceed`; no action-context warnings.
- Maintainer authorized this one-time cohesive S7B size exception at 650 changed lines; the five-file candidate stays within that boundary, with no split, compression, network, database, commit, or lifecycle action.
- S7B rows 205–208 and focused App New gate 216 were unchecked during correction and are now visibly checked after GREEN; parent-owned rows and API/broader/final gates remain untouched.
- Both primary `onError` callbacks return the shared handler promise, so pending spans reconciliation; conflict awaits only exact detail refresh, while candidate-invalid then force-refetches the active exact assignable-members query before safe feedback.
- Role negatives observe loaded non-`AGENT` and rendered error states before action absence, loading remains distinct, and a pending change disables every remove, clear, set, assign, and assign-all control without painting the requested winner.
- Primary-assignment removal proof remains DELETE-only with no primary endpoint request; this component harness has no active parent detail query, so it makes no post-refetch promotion claim.

### TDD Cycle Evidence
| Tasks | Safety net | RED | GREEN / TRIANGULATE / REFACTOR |
|---|---|---|---|
| 205–208 | focused component baseline: 24/24 | New fresh-cache parameterized candidate-invalid regression failed 1/24: detail reconciled and toasted without a second assignable request. | GREEN 24/24: detail resolves first while toast is absent and seller controls remain disabled; deferred empty eligibility then removes `Marcar como principal` and permits toast, while conflict makes exactly one assignable request. |

### Verification and boundary
- PASS: focused component 24/24; service/error and primary/clear route tests 4 files/15; App New typecheck; strict lint; `git diff --no-ext-diff --check`.
- Workload: one-time maintainer-authorized cohesive exception, five-file PR boundary preserved, final candidate: 562 additions + 88 deletions = 650 changed lines; no design deviation or generated artifact retained.

### Remaining implementation work
- Pending unchanged: API schema validation; focused API tests; broader configured delivery checks; documentation-only cleanliness confirmation.

## Final verification gates (tasks 214, 215, 217, 218)
- Native authoritative OpenSpec status consumed before execution: `optional-primary-seller`, `applyState: ready`, `nextRecommended: apply`, repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/optional-primary-seller-final-verify`, allowed root confirmed; parent retained the native `proceed` token. Delivery path is the already-approved `auto-chain` / `stacked-to-main`; this final verification documentation slice remains within the normal 400-line budget.
- Exact head was `1499d1c071bdc4c71520d6725ff3776c8621ace8`, matching merged PR #485. Read-only `gh pr view` corroborated PR #485 as merged at that SHA, with first-party CI Build/Typecheck/Lint, Production cutover contracts, Dependency audit, Test, and Seeded E2E all `SUCCESS`; no GitHub mutation occurred.
- Offline prerequisite passed exactly: `COREPACK_ENABLE_NETWORK=0 /opt/homebrew/bin/pnpm install --offline --frozen-lockfile --ignore-scripts` (959 packages, `downloaded 0`). Local-only prerequisites also passed: contracts build and `pnpm --filter @viewpro/api db:generate`.
- Task 214 PASS: `pnpm --filter @viewpro/api db:validate` reported a valid Prisma schema.
- Task 215 PASS with explicit local `DATABASE_URL`, `DIRECT_URL`, and `VIEWPRO_TEST_BASE_DATABASE_URL` set to `postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public`: property-engagement repository 51/51, property-engagement e2e 37/37, real-Postgres barrier suite 12/12, owner repository 12/12, and owner use-cases 28/28.
- Task 217 PASS: API typecheck; full API 140 files/1,426 tests; contracts runtime contract 1 file/5 tests; focused App New S7B plus S6 service/error/primary-route safety 5 files/39 tests; full App New 116 files/742 tests; App New typecheck and strict lint; seeded local E2E 32 passed (2.5m).
- Seeded E2E ran through the existing harness with `CI=1`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and the pre-existing local Playwright browser cache; no browser installation or download was invoked. Its API seed/server inherited only the explicit local test DSNs and local document-storage root.
- Database safety held before and after every database-bearing command: only `viewpro_test` plus worker databases `viewpro_test_w1`–`viewpro_test_w4` existed (worker inventory 4→4), and active connections were 0 after each command and cleanup. No Neon, development, staging, production, or unrecognized DSN was accessed; intentional worker databases were preserved.
- Task 218 PASS before OpenSpec updates: `git status --short` was clean and `git diff --no-ext-diff --check` passed. After this documentation update, the only worktree changes are the intended `openspec/changes/optional-primary-seller/tasks.md` and `openspec/changes/optional-primary-seller/apply-progress.md`; no secrets, dumps, or document bytes were created.
- Cleanup removed verification-only `node_modules`, contracts `dist`, Prisma dependency output, API/App builds, `.document-storage-seeded`, Playwright reports/results, `next-env.d.ts`, and `*.tsbuildinfo`; ports 3001/3100 have no listeners and no verification process remains. No design deviation and no product/source/test change.

### TDD Cycle Evidence
| Tasks | Scope | Evidence | RED/GREEN/TRIANGULATE/REFACTOR |
|---|---|---|---|
| 214, 215, 217, 218 | Verification/documentation only; no source or test edits | All configured checks passed with the counts above. | Not applicable: no production or test code was written; final cleanup and documentation-only diff checks passed. |

### Persisted completion and remaining work
- Marked and re-read as checked: tasks 214, 215, 217, and 218. All 61 implementation-owned rows are now `[x]`.
- Parent confirmed the first six lifecycle actions complete: each implementation PR used a fresh current-develop worktree, remained sequential and issue-linked, carried review/rollback evidence, landed before its successor, and passed bounded review with no secret, dump, or document-byte drift. S7B alone used the explicit maintainer-approved `size:exception`; all other units remained within 400 lines.
- Final parent confirmation PASS: after every implementation unit landed, authoritative verification reported 61/61 implementation-owned tasks, 9/9 requirements, and 21/21 scenarios complete. No implementation checkbox was pre-completed during planning.
- Workload / PR boundary: final verification documentation only, three authorized OpenSpec files, no product/source/test changes. Next action is spec synchronization.
