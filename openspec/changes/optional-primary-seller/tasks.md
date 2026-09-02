# Tasks: Optional Primary Seller

Implement each work unit from the then-current `origin/develop` after its predecessor lands; the planning exploration began at `d6e5ffea8c9141b503d6f8952c041373b3d88f79`, but that historical SHA is not an implementation base. All implementation paths below are relative to `viewpro-app/`; the task artifact is relative to the workspace root. The existing `PropertyAgent` assignment model, any-assignee authorization/visibility, owner-contact response shape, and seller-management surface remain the seams.

## Session Preflight

| Field | Value |
|-------|-------|
| Execution mode | auto |
| Artifact store | OpenSpec |
| Delivery strategy | auto-chain |
| Review budget | 400 changed lines per work unit |
| Branch base | fresh worktree/branch from then-current `origin/develop` for every work unit |
| PR target | `develop`, unless a later approved chain strategy changes it |
| TDD mode | strict TDD from `openspec/config.yaml` |
| Database safety | API tests use the existing test setup and a clearly marked `viewpro_test`/worker test database; never a development or production database |

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Approximately 1,950–2,440 across seven work units, including implementation, tests, migration, fixtures, and contract/UI updates |
| 400-line budget risk | High overall; each proposed work unit is capped below 400, with Units 2 and 7 closest to the limit |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main, user-approved as sequential delivery to `develop` |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

For this repository, the approved `stacked-to-main` strategy uses `develop` as the integration branch: each work-unit PR targets and lands on `develop` before the next fresh worktree is created. The overall change crosses the 400-line review budget because it spans a migration, transactional repository behavior, real-Postgres race coverage, API contracts and authorization, owner reads, BFF/service adapters, and an existing UI with tests. Estimates include tests, fixtures, migration SQL, and contract/type changes; tests and docs are not hidden behind implementation-only counts. Each PR is one rollback-capable behavior unit and later work units must be rebased onto the then-current `origin/develop` rather than relying on an unmerged local stack.

| Unit / PR | Boundary and dependency | Estimated changed lines | Unit budget risk |
|---|---|---:|---|
| PR 1 | Schema, migration, generated model contract, and no-primary persistence fixtures; independent starting point | 180–240 | Low |
| PR 2 | Repository set/change/clear/remove behavior and unit-level SQL/result tests; depends on PR 1 | 330–390 | Medium; stop before 400 |
| PR 3 | Real-Postgres fixed-order locking hardening and barrier-controlled race tests; depends on PR 2 | 260–340 | Low |
| PR 4 | API DTOs, public error codes, mapper, use cases, guarded controller/module, authorization/e2e coverage; depends on PR 3 | 300–380 | Medium |
| PR 5 | Owner timeline primary-only query/resolution and contact regression coverage; depends on PR 1 and should follow PR 4 contract shape | 300–370 | Medium |
| PR 6 | App New scoped types, BFF proxy routes, service methods, error passthrough, route/service tests; depends on PR 4 | 240–320 | Low |
| PR 7 | Existing seller-management UI state/actions/cache reconciliation and component tests; depends on PR 6 and PR 5 response behavior | 350–395 | Medium; stop before 400 |

### Proposed PR boundaries and dependency diagram

```text
PR 1 Schema/persistence substrate
  ├── PR 2 Repository atomic mutations
  │     └── PR 3 Real-Postgres concurrency proof
  │           └── PR 4 API/use-case/controller boundary
  │                 ├── PR 5 Owner primary-only read path
  │                 └── PR 6 App New BFF/service/types
  │                       └── PR 7 Existing seller-management UI
```

Each PR must contain only its listed boundary, its RED/GREEN/TRIANGULATE/REFACTOR evidence, and the tests or fixtures that prove that boundary. If a unit approaches 400 changed lines, split that unit before adding unrelated cleanup; do not defer its tests or documentation to a later PR.

## Implementation Work Units

### PR 1 — Add durable optional designation without selection

**Start:** fresh worktree/branch from then-current `origin/develop`; no `isPrimary` column.
**Finish:** the schema can represent zero-or-one primary rows, existing rows remain false, and assignment fixtures/types can express the additive state without changing shared dashboard/activity `ProductAgent`.
**Rollback:** revert the additive migration and schema/fixture changes before any later unit is applied.
**Follow-up:** PR 2 owns mutation behavior; no API/UI behavior belongs here.

#### Slice 1A — Additive schema and partial-index invariant

- [x] **RED** — Add a focused migration/schema contract check in `viewpro-app/apps/api/test/` that expects `PropertyAgent.isPrimary` to default false, the named partial unique index `property_agents_one_primary_per_engagement`, and no automatic winner for existing assignments; capture the failing result before changing `schema.prisma` or the migration. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Update `viewpro-app/apps/api/prisma/schema.prisma` and add `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_property_agent_primary/migration.sql` with the non-null false default and PostgreSQL partial unique index using the repository's emitted table/column names; add the adjacent raw-SQL invariant comment. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Verify the migration contract against generated Prisma metadata and a marked test database, including zero, one, and attempted two-primary states, and confirm migration initialization does not choose an assigned seller. Record the direct database index/default evidence with the focused test result. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Keep the migration additive and reversible, preserve the existing `(propertyEngagementId, agentUserId)` assignment uniqueness, and remove any unnecessary schema/type churn outside `PropertyAgent.isPrimary`. <!-- sdd-owner: implementation -->

#### Slice 1B — Scoped response/fixture foundation

- [x] **RED** — Update the narrow property-assignment fixture/type assertions under `viewpro-app/apps/api/test/` to require a boolean primary state on property-agent response records while proving unrelated dashboard/activity fixtures still use base `ProductAgent`; capture the expected failures before implementation. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Add `isPrimary: false` to property-assignment fixture builders and generated-model consumers needed by later repository work, without changing shared dashboard/activity producers or auto-selecting a sole/oldest assignment. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run the focused property-engagement repository/fixture tests and inspect a migrated existing engagement with assigned sellers to confirm every row is false and no primary is inferred. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Centralize only the new property-assignment default/fixture helper and document the no-backfill assumption in the migration test; do not introduce a parallel primary entity. <!-- sdd-owner: implementation -->

### PR 2 — Implement compare-and-set repository mutations

**Start:** PR 1 is landed on `develop`; repository has no primary mutation methods.
**Finish:** repository set/change/clear and assignment removal are transactional, compare-and-set operations with explicit result unions; unit tests prove invalid candidates do not mutate assignments or the current primary.
**Rollback:** revert repository implementation and its tests while retaining PR 1's additive schema.
**Follow-up:** PR 3 hardens and proves row-lock ordering against real PostgreSQL; PR 4 exposes the methods through HTTP.

#### Slice 2A — Set/change and clear result protocol

- [x] **RED** — Extend `viewpro-app/apps/api/test/property-engagements.repository.spec.ts` with failing tests for `updated`, `engagementNotFound`, `candidateInvalid`, and `stateConflict`, required `expectedPrimaryAgentId`, no-primary `null` comparison, eligible set/change, idempotent set, idempotent clear, and stale clear; assert assignment rows are unchanged on rejected candidates. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Extend `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts` and `prisma-property-engagements.repository.ts` with explicit inputs/results and interactive-transaction set/change/clear operations, tenant and engagement predicates, current-primary compare-and-set, eligibility checks, false-then-true replacement, and complete transaction-confirmed engagement reads. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Exercise the focused repository suite for active same-tenant exact `AGENT`, inactive user, inactive membership, non-`AGENT`, stale/unassigned, cross-tenant, current-primary, null-primary, and uniqueness-conflict paths; verify no Prisma metadata or candidate identifiers escape the result union. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Extract small repository helpers for current-primary lookup, tenant scoping, and result mapping while keeping eligibility checks in one transaction and preserving the required precondition semantics. <!-- sdd-owner: implementation -->

#### Slice 2B — Transactional assignment removal

- [x] **RED** — Add failing repository tests for removing a primary assignment, removing a non-primary assignment, missing assignment, and concurrent-operation ordering; assert removal leaves no primary and never promotes another assigned row. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Move `removeAgent` in `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts` into an interactive transaction that locks the tenant-scoped engagement before deleting by assignment, tenant, and engagement. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Verify repository mocks implement `$queryRaw` rather than bypassing production locking, and inspect post-operation rows for unchanged non-primary assignments and zero primary after primary deletion. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Reuse the common engagement-lock transaction helper without changing existing assignment authorization, visibility, or assignment response behavior. <!-- sdd-owner: implementation -->

### PR 3 — Prove fixed-order PostgreSQL concurrency behavior

**Start:** PR 2 is landed on `develop`; repository mutations exist but real row-lock race proof and final lock strength/order are incomplete.
**Finish:** set/change, clear, and removal serialize on the engagement; candidate assignment, user, and membership locks use exact `FOR NO KEY UPDATE` order; deterministic real-database races prove invariant and fail-closed outcomes.
**Rollback:** revert only the locking hardening and integration tests, leaving the PR 2 transactional API available for follow-up repair.
**Follow-up:** PR 4 may rely on repository results and concurrency guarantees.

#### Slice 3A — Fixed lock order and strength

- [x] **RED** — Add failing repository query-construction assertions for the mandatory order `property_engagements FOR UPDATE` → candidate `property_agents FOR NO KEY UPDATE` → `users FOR NO KEY UPDATE` → same-tenant `tenant_memberships FOR NO KEY UPDATE`, including tenant/engagement/status/role predicates and no planner-dependent joined locking query. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the separate parameterized raw locking queries in `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`, hold all locks through commit, translate the named partial-index `P2002` to `stateConflict`, and preserve generic candidate-invalid behavior. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run focused repository tests for exact SQL fragments, fixed call order, rollback after each failed eligibility step, uniqueness translation, and engagement-lock use by set, clear, and remove; record RED/GREEN results separately. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Keep raw SQL parameterized, isolate lock helpers by row type, avoid logging ids/status/phone/Prisma payloads, and preserve `READ COMMITTED` predicate recheck semantics. <!-- sdd-owner: implementation -->

#### Slice 3B — Barrier-controlled real-Postgres races

- [x] **RED** — Add barrier-controlled tests in the existing API e2e/integration harness (not timing-only mocks) that initially expose missing proof for different-candidate set/set, set/clear, set/removal, and clear/removal races, with two independent database connections and direct durable-state assertions. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Add a test-only barrier at the repository lock seam without replacing SQL, then cover both commit orders for set/set, set-versus-clear, set-versus-removal, and clear-versus-removal; assert one success plus conflict/invalid/not-found as appropriate, at most one true row, and no unintended assignment-set mutation. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Extend the same real-database harness for user status, membership status, and role invalidation in both orders: invalidation-first must return `candidateInvalid` and preserve the previous primary; selection-first must block the invalidating update until selection commits, then make a fresh owner-contact read unavailable after invalidation commits. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Make barriers deterministic and cleaned up in `finally` paths, use isolated seeded records/connections, and ensure tests prove partial-index behavior, lock waits, rollback, `READ COMMITTED` rechecks, and no transfer to another seller. <!-- sdd-owner: implementation -->

### PR 4 — Expose primary operations through the existing API boundary

**Start:** PR 3 is landed on `develop`; repository behavior is authoritative but not reachable through the property-assignment API.
**Finish:** guarded set/change/clear endpoints return the normal complete engagement response, stable public errors, required `agents[].isPrimary`, and unchanged any-assignee authorization/visibility.
**Rollback:** revert DTOs, contract codes, mapper, use cases, controller/module registration, and their tests without removing the persisted column/index.
**Follow-up:** PR 5 and PR 6 consume these backend contracts.

#### Slice 4A — Contract, response, and use-case mapping

- [x] **RED** — Add failing runtime-contract and use-case tests in `viewpro-app/packages/contracts/test/runtime-contract.spec.ts` and `viewpro-app/apps/api/test/property-engagements.use-cases.spec.ts` for `PRIMARY_AGENT_CANDIDATE_INVALID` (400), `PRIMARY_AGENT_STATE_CONFLICT` (409), required-but-nullable expected fields, complete response shape, and generic operator-safe messages. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Add the two public error codes to `viewpro-app/packages/contracts/src/index.ts`; add `set-primary-property-agent.dto.ts`, `clear-primary-property-agent.dto.ts`, both use cases, and required `isPrimary` mapping in `property-engagement.response.ts`, translating explicit repository results to stable Nest exceptions. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run focused contract and use-case tests for eligible success, all candidate-invalid categories, stale expected state, idempotent null clear, omitted/malformed precondition, and response no-primary/one-primary shapes; inspect that no ids, tenant details, SQL, phone, or Prisma metadata enter errors. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Keep DTO validation aligned with existing id/envelope conventions, reuse normal response mapping, and avoid changing unrelated shared contract types or assignment operations. <!-- sdd-owner: implementation -->

#### Slice 4B — Routes and authorization/tenant isolation

- [x] **RED** — Add failing property-engagement e2e/controller tests in `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts` for `PUT /property-engagements/:id/agents/primary` and `POST /property-engagements/:id/agents/primary/clear`, existing permission 403, tenant-safe 404, cross-tenant candidate 400, and unchanged non-primary any-assignee access. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Register the guarded routes in `property-engagements.controller.ts`, use `@RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)` with existing auth/tenant guards and `CurrentTenant`, register both use cases in `property-engagements.module.ts`, and return normal `PropertyEngagementResponse` HTTP 200 results. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run focused e2e/controller tests and verify guard rejection occurs before mutation, cross-tenant identifiers disclose only the generic candidate-invalid outcome, and list/detail assignment responses retain any-assignment visibility while exposing primary flags. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Match existing controller Swagger/route conventions, keep primary status out of permission predicates, and avoid parallel assignment endpoints or authorization policy. <!-- sdd-owner: implementation -->

### PR 5 — Resolve owner movement contact from valid primary only

**Start:** PR 1 is landed and PR 4 has established the primary response/error contract; owner timeline still selects the oldest assignment.
**Finish:** each owner timeline page performs one filtered valid-primary candidate query, reuses that candidate for every movement, and fails closed for every invalid or unusable primary without fallback.
**Rollback:** revert owner repository/mapper/use-case changes and tests; retain primary storage/API and do not restore oldest-assignment behavior in a rollback.
**Follow-up:** PR 7 relies on unchanged owner contact response/UI semantics.

#### Slice 5A — Repository query and timeline data flow

- [x] **RED** — Update failing tests in `viewpro-app/apps/api/test/owner-portal.repository.spec.ts` for no ordered-agent include, one engagement-level primary query per timeline page, tenant/status/role/assignment/`isPrimary` filters, and query count independent of movement count; replace oldest/tie-break expectations. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Update `owner-portal.repository.ts` and `prisma-owner-portal.repository.ts` so `OwnerMovementRecord` no longer carries assignment arrays and `findEngagementTimelineForOwner` returns one `primarySellerContact` candidate alongside `engagement`, `items`, and `total`, fetched in the existing `Promise.all`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run the focused repository suite for valid active same-tenant exact `AGENT`, no primary, inactive user/membership, role mismatch, removed/stale assignment, and property-level tenant contact; assert exactly one candidate query and no per-movement N+1 payload. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Select only agent id/user id/WhatsApp phone, keep owner authorization predicates intact, and preserve unrelated property-level agency-contact query behavior. <!-- sdd-owner: implementation -->

#### Slice 5B — Fail-closed contact mapping and regressions

- [x] **RED** — Add failing `owner-whatsapp-contact.ts` and `owner-portal.use-cases.spec.ts` cases for valid primary, no primary, invalid primary, unusable/null primary phone with another usable seller, unchanged unavailable labels, and unchanged click analytics metadata. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Change `mapAssignedSellerWhatsappContact` to accept one candidate or null, retain `isValidWhatsappPhone` and the existing available/unavailable shapes, and pass the same candidate to every `mapOwnerMovement` call in `get-owner-engagement-timeline.use-case.ts` and `owner-movement.response.ts`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run focused owner repository/use-case tests and the existing owner timeline/click route tests; verify WhatsApp URL/message, target type, labels, event names/metadata, click tracking, and property-level contact remain unchanged except for seller-resolution source. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Remove all oldest-assignment/fallback branches from movement contact resolution, keep read-time validation fail closed, and do not auto-clear or promote persisted designations. <!-- sdd-owner: implementation -->

### PR 6 — Add App New BFF, service, and scoped property types

**Start:** PR 4 is landed on `develop`; App New has no primary routes or typed mutations.
**Finish:** product-named BFF routes forward the exact body/tenant/auth context and pass through catalogued errors/request ids; service methods return `PropertyEngagement`; only property assignment agents require `isPrimary`.
**Rollback:** revert the two routes, scoped types, service methods, and their tests; no UI changes belong in this unit.
**Follow-up:** PR 7 consumes these methods and cache contracts.

#### Slice 6A — Scoped types and service methods

- [x] **RED** — Add failing App New service/type tests under `viewpro-app/apps/app-new/src/features/products/` for required `expectedPrimaryAgentId: string | null`, set/change and clear payloads, `PropertyAssignedAgent`, `PropertyEngagement.agents`, and unchanged dashboard/activity `ProductAgent` producers. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Update `features/products/api/types.ts` with the scoped `PropertyAssignedAgent` and payload types and `features/products/api/service.ts` with `setPrimaryProductAgent` and `clearPrimaryProductAgent`, both returning `PropertyEngagement` and preserving existing query key/tenant conventions. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run the focused App New type/service tests plus the package typecheck to prove property responses require primary state while dashboard/activity contracts remain compatible without fabricated fields. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Keep `ProductAgent` broadly unchanged, avoid a parallel management service, and centralize only safe code-based primary mutation messages in `features/products/error-messages.ts`. <!-- sdd-owner: implementation -->

#### Slice 6B — BFF set/clear proxies

- [x] **RED** — Add failing adjacent route tests for `src/app/api/products/[id]/agents/primary/route.ts` and `.../clear/route.ts` covering method/path/body forwarding, selected tenant header, 400/409 body and `x-request-id` passthrough, timeout, and transport failure. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Implement the PUT and POST product BFF routes using existing `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse` conventions; forward auth cookies/selected tenant and backend error bodies unchanged. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run the two focused route test paths and inspect that no optimistic/UI state is introduced in the adapter, request ids survive error responses, and unknown transport failures use the established safe proxy response. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Match neighboring product route structure and keep route code limited to proxy adaptation, with no duplicated authorization or candidate validation. <!-- sdd-owner: implementation -->

### PR 7 — Integrate explicit primary controls into the existing seller UI

**Start:** PR 6 is landed on `develop`; the existing `PropertyAgentsSection`/`ManagePropertyAgentsDialog` only manage assignments.
**Finish:** assignment managers can set/change/clear primary explicitly, no-primary and persisted-ineligible states are clear, mutations use compare-and-set and server-confirmed cache state, and existing archived/permission/access behavior remains intact.
**Rollback:** revert only UI/type integration and component tests; backend storage and owner fail-closed behavior remain safe.
**Follow-up:** parent performs final chained review and broader verification; no second management screen is created.

#### Slice 7A — Render persisted primary server state

- [x] **RED** — Extend `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.test.tsx` with failing cases for `Principal` badges on persisted `agents[].isPrimary`, exact `Sin vendedor principal` when every flag is false, persisted-but-currently-ineligible supporting copy after assignable members load, and unchanged archived/unauthorized management visibility. <!-- sdd-owner: implementation -->
- [x] **GREEN** — Update `property-agents-section.tsx` and `manage-property-agents-dialog.tsx` to derive `primaryAgentId` exclusively from `agents[].isPrimary`, render selected/no-primary/ineligible server states in the existing surface, and retain existing assignment controls without primary mutation callbacks or cache edits. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE** — Run the focused component test plus App New typecheck and strict lint; inspect selected, no-primary, persisted-ineligible, archived, and unauthorized rendering, confirming primary status grants no additional assignment access. <!-- sdd-owner: implementation -->
- [x] **REFACTOR** — Keep rendering inside the existing seller-management surface, avoid inference, promotion, optimistic badge changes, and primary action controls, and preserve `product-form.tsx` prop flow and unrelated assignment controls. <!-- sdd-owner: implementation -->

#### Slice 7B — Primary actions, preconditions, and authoritative cache reconciliation

- [ ] **RED** — Add failing component tests for exact-`AGENT` set/change action gating from loaded assignable members, separate clear action, set/change/clear payload preconditions, no `onMutate` primary edit, successful returned-engagement cache replacement, product invalidation, conflict-triggered detail refetch, candidate-invalid refetch, safe error copy, and primary removal yielding no primary without promotion. <!-- sdd-owner: implementation -->
- [ ] **GREEN** — Wire explicit set/change/clear UI actions to the PR 6 service methods, capture the derived current `expectedPrimaryAgentId` including explicit null, install only the returned `PropertyEngagement` into `productKeys.detail(productId, tenantId)`, invalidate product queries, refetch before conflict/invalid feedback, and disable assign/set/change/clear/remove while any seller mutation is pending. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE** — Run the focused component tests plus the App New typecheck and strict lint; verify exact-`AGENT` action visibility, no action for an ineligible persisted primary, no pre-success paint, and refreshed durable winner/no-primary rendering after conflict. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR** — Consolidate mutation error handling through code-based safe local copy, preserve last server state on generic failures, and do not alter WhatsApp/contact behavior or add a second query/cache authority. <!-- sdd-owner: implementation -->

## Apply-Owned Verification Gates

These are implementation-owned checks performed after each relevant work unit; they are not a substitute for the RED/GREEN evidence in that unit.

- [ ] Run API schema validation with `pnpm --filter @viewpro/api db:validate` after PR 1 and after any Prisma change; record output and test-database safety. <!-- sdd-owner: implementation -->
- [ ] Run focused API tests with `pnpm --filter @viewpro/api exec vitest run test/property-engagements.repository.spec.ts`, `pnpm --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts`, `pnpm --filter @viewpro/api exec vitest run test/owner-portal.repository.spec.ts`, and `pnpm --filter @viewpro/api exec vitest run test/owner-portal.use-cases.spec.ts` as each seam lands; include the barrier-controlled real-Postgres tests in the applicable e2e path. <!-- sdd-owner: implementation -->
- [ ] Run focused App New tests with `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-agents-section.test.tsx` and the two new product-agent primary route test paths after PR 6/7. <!-- sdd-owner: implementation -->
- [ ] Run the broader configured checks before delivery: `pnpm --filter @viewpro/api db:validate`, `pnpm --filter @viewpro/api typecheck`, `pnpm --filter @viewpro/api test`, `pnpm --filter next-shadcn-dashboard-starter test`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `pnpm --filter next-shadcn-dashboard-starter test:seeded`, and `pnpm --filter @viewpro/contracts test`; use the API test database required by `openspec/config.yaml`. <!-- sdd-owner: implementation -->
- [ ] Run repository documentation-only checks `git status --short` and `git diff --check` from the configured `viewpro-app` cwd, and confirm only the intended work-unit files are present before each PR. <!-- sdd-owner: implementation -->

## Parent-Owned Delivery and Review Actions

The parent/orchestrator owns lifecycle actions below. Implementation must not mark them complete in advance.

- [ ] Create one fresh worktree and branch per PR from the then-current `origin/develop`, enforce one active writer, and keep each branch limited to its stated work-unit boundary. <!-- sdd-owner: parent -->
- [ ] Track issue #304 and the optional-primary-seller change in the parent delivery record, linking each bounded PR and its dependency/rollback boundary without mutating product scope. <!-- sdd-owner: parent -->
- [ ] Open or update each PR in order against `develop`, include the work-unit start state, finish state, dependency diagram with the current PR marked `📍`, verification evidence, rollback scope, and explicit out-of-scope follow-up. <!-- sdd-owner: parent -->
- [ ] Before moving to the next unit, merge or otherwise land the current reviewed PR on `develop`, refresh `origin/develop`, and create the next fresh worktree/branch; do not stack unmerged local work or reuse a polluted diff. <!-- sdd-owner: parent -->
- [ ] Keep every PR at or below the 400 changed-line budget; if a unit cannot fit without hiding tests/docs, stop and obtain the approved size-exception or split the unit before apply. <!-- sdd-owner: parent -->
- [ ] Run the bounded review/lifecycle gate for each landed unit, confirm no secrets/database dumps/document bytes were changed, and record residual risks including the intentional fail-closed owner-contact rollout. <!-- sdd-owner: parent -->
- [ ] After all units land, confirm the final status authority reports tasks applied/complete only after implementation and verification evidence exists; do not mark any implementation checkbox complete during planning. <!-- sdd-owner: parent -->

## Verification Command Reference

Commands below are the exact repository-configured package scripts or focused invocations of those configured Vitest scripts; they are planning references and were not run during task generation.

| Scope | Command |
|---|---|
| API schema | `pnpm --filter @viewpro/api db:validate` |
| API focused repository | `pnpm --filter @viewpro/api exec vitest run test/property-engagements.repository.spec.ts` |
| API focused property e2e/controller | `pnpm --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts` |
| API focused owner repository | `pnpm --filter @viewpro/api exec vitest run test/owner-portal.repository.spec.ts` |
| API focused owner use cases | `pnpm --filter @viewpro/api exec vitest run test/owner-portal.use-cases.spec.ts` |
| App New focused component | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-agents-section.test.tsx` |
| App New focused BFF routes | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/app/api/products/[id]/agents/primary/route.test.ts src/app/api/products/[id]/agents/primary/clear/route.test.ts` |
| Contracts | `pnpm --filter @viewpro/contracts test` |
| API typecheck | `pnpm --filter @viewpro/api typecheck` |
| API full test | `pnpm --filter @viewpro/api test` |
| App New full test | `pnpm --filter next-shadcn-dashboard-starter test` |
| App New strict lint | `pnpm --filter next-shadcn-dashboard-starter lint:strict` |
| App New seeded E2E | `pnpm --filter next-shadcn-dashboard-starter test:seeded` |
| Docs-only cleanliness | `git status --short` and `git diff --check` |

No package manager, test, database, Git, branch, worktree, or GitHub mutation was performed while creating this plan.
