# Tasks: Seller Property Proposals

## Execution contract

The controlled four-PR planning chain—exploration+proposal → all specs → design+interface → all task artifacts—is merged. The user explicitly authorized source/apply from a fresh implementation worktree based on `origin/develop`; commit, push, PR, and merge remain separately gated. Strict TDD applies to every production-bearing unit: RED, smallest GREEN, TRIANGULATE, REFACTOR, focused verification, and `finally` cleanup. U12 and U22A/U22B are verification-only and own no first RED or production fix. Use only local PostgreSQL `viewpro_test` (or another clearly marked local `*_test` URL), named worker connections, bounded timeouts, and the repository's offline frozen install. No Neon, providers, or external services are authorized. Exact paths, ranges, group arithmetic, and commands are in the companions.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 7,757–9,558 strict implementation/test lines: 6,962–8,613 production-bearing and 795–945 verification-only; parent gate 0. |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Selected controlled source chain C1 → C20, each group max ≤650; selected controlled four-PR planning chain. |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-develop |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-develop
400-line budget risk: High

Unit counts: 30 production-bearing; verification-only units are U12/U22A/U22B (3); and 1 parent/verify gate with no source-unit estimate. The selected source topology is the controlled C1 → C2A → C2B1 → C2B2 → C3 … C20 chain with exactly 22 dependency-ordered groups, each max ≤650. C1 is U1; C2A atomically contains U2A, the U2B core migration contract, and U2C tenant registry; C2B1 contains only U2B S39 migration/index/lock/integrity hardening; and C2B2 contains the reusable cleanup helper plus its exhaustive direct matrix. C2B2 is mandatory before C3, so C3 remains unchecked and blocked until C2B2 lands. Schema, migration, and tenant registry remain atomic in C2A so generated-client, database, and isolation consistency are never broken. No blanket exception applies. Strict400 remains rejected forecast/history only, not an active plan.

## Scenario linkage

The evidence matrix preserves exactly 49 rows. Task coverage links them as follows: U1 S34,S43–S45; U2B S39; U4A S24,S35; U4B S40–S42; U5A S02; U5B S01,S03; U6 S04,S06; U7 S05,S08–S10; U8 S11,S14–S15; U9 S13,S17–S19,S31–S32; U10A S20–S23,S27,S29; U10B S37–S38; U11A S25–S26; U11B S30,S33; U13 S07,S12,S28; U14 S16; U17 S47,S49; U18A S36; U18B S46; U20B S48; U22A/U22B final evidence for the remaining journeys. Matrix RED ownership remains authoritative.

## Ordered implementation units

### U1 — Contract and permission foundation (S34, S43–S45)

Manifest: `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `apps/api/src/common/filters/global-exception.filter.spec.ts`, `apps/api/src/permissions/permissions.constants.ts`, `apps/api/src/permissions/role-permissions.ts`, `apps/api/src/permissions/property-proposals-role-permissions.spec.ts`.

- [x] Run RED for the exact catalog, role mapping, forged-capability, seller canonical-create denial, unchanged manager `engagements.create`, and `GlobalExceptionFilter` tests for enabled known-code passthrough, unknown/missing fallback, and the exact three-key envelope; then add the smallest GREEN and TRIANGULATE before REFACTOR. <!-- sdd-owner: implementation -->
- [x] Verify the listed contract/permission tests and API typecheck; remove temporary fixtures. <!-- sdd-owner: implementation -->

### U2A — Prisma schema contract

Manifest: `apps/api/prisma/schema.prisma`, `apps/api/test/property-proposal-schema.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR proposal, round, decision, source-link, enum, index, and check definitions against the tenant and deletion invariants. <!-- sdd-owner: implementation -->
- [x] Run the manifest-scoped schema test, `db:validate`, and API typecheck without leaving database state. <!-- sdd-owner: implementation -->

### U2B — Additive migration and migration evidence (S39)

C2A manifest: `apps/api/prisma/migrations/20260902120000_add_property_proposals/migration.sql`, `apps/api/test/property-proposal-migration.spec.ts`, `apps/api/test/restore-schema-parity.spec.ts`.

- [x] C2A: Retain the earlier U2 RED → GREEN → TRIANGULATE → REFACTOR chronology for the additive migration, nullable direct source, same-tenant source success, and cross-tenant/duplicate source rejection. <!-- sdd-owner: implementation -->
- [x] C2A: Run the readable core migration contract, repository restore-schema parity, and migrated-client smoke with safe fixture cleanup, `db:validate`, pristine deploy, and API Turbo typecheck. <!-- sdd-owner: implementation -->

C2B1 manifest: `apps/api/test/property-proposal-migration-hardening.spec.ts` only. It is only S39 migration, index, and lock hardening; it does not add `property-proposal-cleanup.ts`, its direct spec, or a C2B1 diff to the retained C2A migration smoke.

- [x] C2B1: Extend the earlier U2B evidence with broad decision/check, planner/index, deletion/update, duplicate title/address, and production-shaped actual-DDL lock coverage. <!-- sdd-owner: implementation -->

C2B2 manifest: `apps/api/test/property-proposal-cleanup.ts`, exhaustive direct `apps/api/test/property-proposal-cleanup.spec.ts`, and the retained C2A `apps/api/test/property-proposal-migration.spec.ts` teardown retrofit to use the reusable helper with bounded failure-preserving teardown. C2B2 owns the helper's exhaustive direct matrix and remains mandatory before C3.

- [x] C2B2: Add reusable dependency-ordered cleanup support, prove its exhaustive direct matrix, retrofit the retained C2A migration smoke to use its bounded failure-preserving teardown, and rerun the deferred helper spec. <!-- sdd-owner: implementation -->

### U2C — Tenant registry

Manifest: `apps/api/src/database/tenant-isolation.extension.ts`, `apps/api/src/database/tenant-isolation.registry.spec.ts`.

- [x] C2A: Retain the earlier U2C RED → GREEN → TRIANGULATE → REFACTOR registry parity and register all three direct-tenant proposal models. <!-- sdd-owner: implementation -->
- [x] C2A: Run the registry parity test and API Turbo typecheck without reusable cleanup support. <!-- sdd-owner: implementation -->

### U3 — Pure lifecycle and replay primitives

C3 remains unchecked and blocked until C2B2 merges.

Manifest: `apps/api/src/property-proposals/domain/normalization.ts`, `state-machine.ts`, `replay-identity.ts`, and their three colocated specs.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR normalization, title/six-field validation, four-state transitions, immutable snapshots, and actor/outcome/reason replay identity without Prisma, HTTP, or UI dependencies. <!-- sdd-owner: implementation -->
- [ ] Run only the three manifest domain specs and API typecheck; leave no generated or database state. <!-- sdd-owner: implementation -->

### U4A — Shared capacity and direct-path compatibility (S24, S35)

Manifest: `apps/api/src/property-engagements/active-property-engagement-capacity.ts`, `prisma-property-engagements.repository.ts`, `property-engagements.module.ts`, `active-property-engagement-capacity.spec.ts`, `apps/api/test/property-engagements.e2e-spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the tenant lock/active-count lease and direct create/restore compatibility, including manager direct-create availability and unchanged existing quota errors. <!-- sdd-owner: implementation -->
- [ ] Run the manifest API tests and typecheck with a local `_test` URL; restore limits and remove canonical fixtures in `finally`. <!-- sdd-owner: implementation -->

### U4B — Materializer and primary compatibility (S40–S42)

Manifest: `apps/api/src/property-engagements/canonical-property-materializer.ts`, `apps/api/src/property-engagements/canonical-property-materializer.spec.ts`, `apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts`, `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR materialization, null-currency defaulting, explicit `isPrimary=false`, and separate explicit primary set/change/clear behavior; the primary tests are first added here, not in U12. <!-- sdd-owner: implementation -->
- [ ] Run all manifest materializer/primary tests and API typecheck; capture source engagements before orphan assets and close clients in `finally`. <!-- sdd-owner: implementation -->

### U5A — Seller repository and scoped reads (S02)

Manifest: `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, list/get use cases, and `prisma-property-proposals.repository.spec.ts` at the exact paths in the delivery manifest.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR tenant-plus-proposer predicates, safe identical absence, own list/detail reads. <!-- sdd-owner: implementation -->
- [ ] Run the manifest repository/read specs and API typecheck; delete proposal/history fixtures without touching canonical rows. <!-- sdd-owner: implementation -->

### U5B — Seller draft creation and identity (S01, S03)

Manifest: `apps/api/src/property-proposals/property-proposals.module.ts`, `create-property-proposal.use-case.ts`, and `create-property-proposal.use-case.spec.ts` at the exact paths in the delivery manifest.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR trusted tenant/proposer derivation, title-minimum draft creation, exact active `AGENT` eligibility, proposal-identity idempotency, duplicate title/address allowance, and no transport exposure. <!-- sdd-owner: implementation -->
- [ ] Run the manifest create spec and API typecheck; remove proposal/history fixtures in `finally`. <!-- sdd-owner: implementation -->

### U6 — Seller update and editable states (S04, S06)

Manifest: `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.ts`, `apps/api/src/property-proposals/helpers/lock-property-proposal.ts`, `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts`, `apps/api/test/property-proposal-eligibility-race.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR normalized expected-version patches, title-only saves, BORRADOR/RECHAZADA editability, locked-state conflicts, and inactive/role-changed seller races. <!-- sdd-owner: implementation -->
- [ ] Run the manifest specs and API typecheck; close worker transactions and clean proposals in every `finally`. <!-- sdd-owner: implementation -->

### U7 — Submit, resubmit, and immutable rounds (S05, S08–S10)

Manifest: `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.ts`, `apps/api/src/property-proposals/helpers/map-property-proposal.ts`, `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.spec.ts`, `apps/api/src/property-proposals/use-cases/submit-property-proposal.replay.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR six-field submission, locked-row snapshotting, round numbering, retained history, rejected-edit versus explicit resubmit, and replay identity. <!-- sdd-owner: implementation -->
- [ ] Run the manifest submit specs and API typecheck; delete rounds before proposals in `finally`. <!-- sdd-owner: implementation -->

### U8 — Reviewer inbox and detail reads (S11, S14–S15)

Manifest: reviewer list/detail use cases, `review-filter-builder.ts` and spec, repository filter changes, `apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts` for the later S15 filter RED, and `list-property-proposal-review.use-case.spec.ts` at the exact delivery paths.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR both reviewer roles, tenant-scoped all-state reads, pending/newest defaults, state/history AND filters, pagination limits, safe result visibility, and search rejection boundary; add S15's repository EXISTS/AND RED only after U5A's scoped-read edit. <!-- sdd-owner: implementation -->
- [ ] Run the manifest reviewer-read specs and API typecheck; clear query fixtures and reviewer rows. <!-- sdd-owner: implementation -->

### U9 — Rejection, replay, and transition conflicts (S13, S17–S19, S31–S32)

Manifest: rejection use case, `review-transition-conflict.ts` and specs, plus `reject-property-proposal.use-case.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR direct-invocation reason validation, durable rejection without materialization, replay actor/reason identity, self-review/former-reviewer denial, explicit resubmit boundary, and stable 409 races. <!-- sdd-owner: implementation -->
- [ ] Run the manifest rejection/conflict specs and API typecheck; delete decisions, rounds, proposals, and assets in dependency order. <!-- sdd-owner: implementation -->

### U10A — Approval materialization core (S20–S23, S27, S29)

Manifest: `approve-property-proposal.use-case.ts`, repository additions, `approve-property-proposal.use-case.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR one-transaction approval, CAPTURE, creator/reviewer attribution, source link, ordinary non-primary assignment, owner-reference exclusion, side-effect exclusion, and generic rollback. <!-- sdd-owner: implementation -->
- [ ] Run the manifest approval spec and API typecheck; delete source engagements before captured orphan assets in `finally`. <!-- sdd-owner: implementation -->

### U10B — Result-link response safety (S37–S38)

Manifest: `apps/api/src/property-proposals/responses/property-proposal.response.ts`, `apps/api/src/property-proposals/responses/property-proposal.response.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR fresh viewer-specific same-tenant result visibility, assignment/capability checks, and omission for missing, cross-tenant, inactive, or lost-capability links. <!-- sdd-owner: implementation -->
- [ ] Run the manifest response spec and API typecheck; remove test assignments and canonical fixtures in `finally`. <!-- sdd-owner: implementation -->

### U11A — Approval quota and proposer eligibility (S25–S26)

Manifest: approval use-case quota changes, `helpers/approval-lock-order.ts`, `approve-property-proposal.quota.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR proposer eligibility, protected final-slot quota behavior, retry after restored capacity, and atomic rollback with stable public outcomes. <!-- sdd-owner: implementation -->
- [ ] Run the manifest quota spec and API typecheck; restore limits, close transactions, and remove assets in `finally`. <!-- sdd-owner: implementation -->

### U11B — Approval replay and race proof (S30, S33)

Manifest: `helpers/approval-replay.ts`, `approve-property-proposal.replay.spec.ts`, `test/property-proposal-approval-race.spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR actor-specific approval replay and competing approval/rejection/final-slot race outcomes without duplicate aggregates. <!-- sdd-owner: implementation -->
- [ ] Run the manifest replay/race specs repeatedly with bounded named connections and clean barriers, clients, limits, and assets in `finally`. <!-- sdd-owner: implementation -->

### U12 — Repeated PostgreSQL concurrency matrix (verification-only)

Manifest: `apps/api/test/property-proposal-concurrency-matrix.e2e-spec.ts`, `property-proposal-concurrency-fixtures.ts`, `property-agent-primary-concurrency.e2e-spec.ts`.

- [ ] Repeat only already-green eligibility, reviewer, approval, quota, direct-path, primary, and cleanup behavior; observe `pg_stat_activity`/`pg_blocking_pids` with bounded timeouts rather than unsettled promises. <!-- sdd-owner: implementation -->
- [ ] Record observed outcomes only; do not add a first RED or production fix, and always release barriers, clients, transactions, fixtures, orphan assets, and limits. <!-- sdd-owner: implementation -->

### U13 — Seller REST transport and first module mount (S07, S12, S28)

Manifest: seller controller/DTOs, response/module/app mount paths, `apps/api/src/property-proposals/property-proposals.controller.spec.ts`, and `apps/api/test/property-proposals.e2e-spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR seller routes, permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, current-role checks, and absent withdraw/delete/image routes; mount only here. <!-- sdd-owner: implementation -->
- [ ] Run the manifest controller/E2E tests and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->

### U14 — Reviewer REST transport and static route precedence (S16)

Manifest: reviewer additions to `property-proposals.controller.ts`, reviewer DTOs, `apps/api/src/property-proposals/dto/list-property-proposal-review.query.spec.ts`, and reviewer additions to `apps/api/test/property-proposals.e2e-spec.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR static `review` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->
- [ ] Run the manifest query/controller E2E tests and API typecheck; clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->

### U15A — Seller BFF routes

Manifest: seller `route.ts` files and colocated `route.test.ts` files for collection, `[proposalId]`, and `[proposalId]/submit`, plus `src/lib/bff-api.ts` and `bff-api.test.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR method/path/body/query forwarding, selected-tenant behavior, passthrough status/body, request-ID filtering, malformed/no-body, and timeout handling through the real BFF helpers. <!-- sdd-owner: implementation -->
- [ ] Run only the listed seller route tests and App typecheck; clear mock responses, timers, and request context. <!-- sdd-owner: implementation -->

### U15B — Reviewer BFF routes

Manifest: reviewer collection, detail, reject, and approve `route.ts` files with their exact colocated `route.test.ts` files.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR each reviewer route independently; never accept a body-controlled tenant override or a nonexistent consolidated route test. <!-- sdd-owner: implementation -->
- [ ] Run all four listed reviewer route tests and App typecheck; clear mocks, timers, and request context. <!-- sdd-owner: implementation -->

### U16A — Browser service and safe BFF error boundary

Manifest: feature `api/types.ts`, `api/service.ts`, `src/lib/bff-client.ts`, `bff-client.spec.ts`, and `api/service.test.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR typed service calls through `bffRequest`, `BffError`, canonical UUIDv4 capture, hostile-prose removal, local code mapping, and timeout behavior. <!-- sdd-owner: implementation -->
- [ ] Run the manifest service/client specs, App typecheck, and strict lint; reset query clients and mock servers. <!-- sdd-owner: implementation -->

### U16B — Query key and invalidation contracts

Manifest: feature `api/queries.ts` and `api/queries.test.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR tenant-plus-audience list/detail keys, mutation invalidation, 409 authoritative refresh, canonical invalidation, and tenant-switch cancellation. <!-- sdd-owner: implementation -->
- [ ] Run the manifest query spec, App typecheck, and strict lint; clear query caches and tenant fixtures. <!-- sdd-owner: implementation -->

### U17 — Shared access policy and fail-closed boundaries (S47, S49)

Manifest: `src/lib/property-proposal-access.ts`, `navigation-access.ts`, `hooks/use-nav.ts`, their exact tests, and `src/test/navigation-access-fixtures.ts`; do not expose a destination yet.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR deeply immutable policy reuse, unresolved/loading suppression, inactive/wrong-role/missing-capability fail-closed behavior, and query enablement without a landed destination. <!-- sdd-owner: implementation -->
- [ ] Run the manifest access/navigation specs, App typecheck, and strict lint; clear router/query/tenant-switch fixtures. <!-- sdd-owner: implementation -->

### U18A — Working seller form and status label (S36)

Manifest: seller schema/form/new/list support paths, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/new/page.test.tsx` T11–15, `property-proposal-status-label.tsx`, `property-proposal-status-label.test.tsx`, and `property-proposal-form.test.tsx`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the direct seller-new page boundary in `apps/app-new/src/app/dashboard/property-proposals/new/page.test.tsx` alongside title-only save, six-field submit validation, separate save/submit mutations, persisted `EN_REVISION` rendering as `EN_REVISIÓN`, no images, and no canonical-create call. <!-- sdd-owner: implementation -->
- [ ] Run the manifest seller component tests, App typecheck, and strict lint; reset form, router, and query state. <!-- sdd-owner: implementation -->

### U18B — Working seller list and seller exposure (S46)

Manifest: `apps/app-new/src/features/property-proposals/components/property-proposal-list.tsx`, `apps/app-new/src/features/property-proposals/components/property-proposal-list.test.tsx`, `apps/app-new/src/app/dashboard/property-proposals/page.tsx`, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/page.test.tsx` T11–15, `apps/app-new/src/config/nav-config.ts`, `apps/app-new/src/config/nav-config.test.ts`, `apps/app-new/src/components/layout/app-sidebar.tsx`, `apps/app-new/src/components/kbar/palette.tsx`, `apps/app-new/src/components/layout/app-sidebar.test.tsx`, and `apps/app-new/src/components/kbar/palette.test.ts`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the direct seller-list/root page boundary in `apps/app-new/src/app/dashboard/property-proposals/page.test.tsx` with seller list/page loading, empty/error/data behavior and the authorized seller destination only after the working seller page exists; preserve no reviewer/direct-create destination and exact loading parity. <!-- sdd-owner: implementation -->
- [ ] Run the manifest list/page, nav-config, Sidebar, and KBar tests, App typecheck, and strict lint; clear router/query fixtures. <!-- sdd-owner: implementation -->

### U19 — Seller detail, history, links, and cache

Manifest: seller detail/history/page, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/[proposalId]/page.test.tsx` T11–15, `property-proposal-detail.test.tsx`, and `property-proposal-cache.test.tsx`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the direct seller-detail page boundary in `apps/app-new/src/app/dashboard/property-proposals/[proposalId]/page.test.tsx` with detail/history, rejected edit/resubmit context, optional safe canonical link, 409 refetch, audience/tenant invalidation, and old-tenant cleanup. <!-- sdd-owner: implementation -->
- [ ] Run the manifest detail/cache tests, App typecheck, and strict lint; clear caches, mutation state, and tenant fixtures. <!-- sdd-owner: implementation -->

### U20A — Working reviewer inbox and filters (no navigation exposure)

Manifest: `apps/app-new/src/features/property-proposals/components/property-proposal-review-inbox.tsx`, `apps/app-new/src/app/dashboard/property-proposals/review/page.tsx`, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/review/page.test.tsx` T11–15, `apps/app-new/src/features/property-proposals/components/property-proposal-review-inbox.test.tsx`, and `apps/app-new/src/features/property-proposals/components/property-proposal-review-filters.test.tsx`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the direct reviewer-inbox boundary with pending-first inbox, state/history AND filters, pagination, proposer display, and bounded loading/empty/error states; do not expose a reviewer destination in navigation. <!-- sdd-owner: implementation -->
- [ ] Run the manifest inbox/filter/page tests, App typecheck, and strict lint; clear reviewer router/query state. <!-- sdd-owner: implementation -->

### U20B — Atomic reviewer Sidebar/KBar parity exposure (S48)

Manifest: `apps/app-new/src/config/nav-config.ts`, `apps/app-new/src/config/nav-config.test.ts`, `apps/app-new/src/components/layout/app-sidebar.tsx`, `apps/app-new/src/components/layout/app-sidebar.test.tsx`, `apps/app-new/src/components/kbar/palette.tsx`, and `apps/app-new/src/components/kbar/palette.test.ts`.

- [ ] After U20A's working inbox is green, run RED for the authorized manager reviewer destination in nav-config, Sidebar, and KBar, then GREEN → TRIANGULATE → REFACTOR all three consumers atomically through the immutable policy; do not leave an intermediate Sidebar/KBar parity violation. <!-- sdd-owner: implementation -->
- [ ] Run the exact nav-config, Sidebar, and KBar parity command from the verification companion, App typecheck, and strict lint; clear navigation/router/query fixtures. <!-- sdd-owner: implementation -->

### U21A — Reviewer detail and decision cache

Manifest: reviewer detail/reject-dialog/page, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/review/[proposalId]/page.test.tsx` T11–15, `property-proposal-review-detail.test.tsx`, and `property-proposal-review-cache.test.tsx`.

- [ ] RED → GREEN → TRIANGULATE → REFACTOR the direct reviewer-detail page boundary in `apps/app-new/src/app/dashboard/property-proposals/review/[proposalId]/page.test.tsx` with current-round approve/reject, bounded reason UI, pending lockout, safe copy, no optimistic success, 409 refresh, and canonical invalidation. <!-- sdd-owner: implementation -->
- [ ] Run the manifest reviewer detail/cache tests, App typecheck, and strict lint; clear mutation/query/router fixtures. <!-- sdd-owner: implementation -->

### U22A — API seeded integration (verification-only)

Manifest: `apps/api/test/property-proposals.e2e-spec.ts`, `property-proposal-fixtures.ts`, and `property-engagements.e2e-spec.ts`.

- [ ] Execute approve, reject/edit/resubmit, isolation, result visibility, quota retry, owner/image/side-effect exclusion, seller denial, manager direct-create, and canonical compatibility journeys only after their behavior units are green. <!-- sdd-owner: implementation -->
- [ ] Report exact observed outcomes, skips, blockers, and cleanup; do not introduce a new RED or production fix in this integration unit. <!-- sdd-owner: implementation -->

### U22B — Seeded App integration (verification-only)

Manifest: `apps/app-new/tests/seeded/property-proposals.spec.ts`, `property-proposals.helpers.ts`.

- [ ] Execute the approve and reject/edit/resubmit browser journeys, role/route boundaries, localized labels, result navigation, and cleanup with run-scoped local fixtures only. <!-- sdd-owner: implementation -->
- [ ] Report exact observed outcomes, skips, blockers, and cleanup; do not add product behavior or claim provider/external evidence. <!-- sdd-owner: implementation -->

## Parent review and lifecycle gates

- [ ] Start or reuse one bounded review after apply, checking unit boundaries, TDD order, cleanup/rollback, isolation, race evidence, exact manifests, and budgets. <!-- sdd-owner: parent -->
- [x] After planning-chain acceptance and any separately authorized merges, require fresh explicit source/apply authorization and a fresh `origin/develop` implementation worktree before beginning the controlled C1→C2A→C2B1→C2B2→C3…C20 source chain. <!-- sdd-owner: parent -->
- [ ] Run the final read-only `git diff --check` gate and reconcile all 49 matrix rows, commands, skips, blockers, and residual risks; Git mutation, delivery, push, merge, and archive remain forbidden here. <!-- sdd-owner: parent -->

## Arithmetic check

The delivery companion contains the read-only worksheet. Corrected strict-unit totals are recomputed mechanically from every listed path range: production-bearing `6,962–8,613`, verification-only `795–945`, parent gate `0`, strict implementation/test total `7,757–9,558`; every strict unit maximum is ≤400 and every controlled group maximum is ≤650; C2A current candidate is capped at 649; C2B1 and C2B2 are each capped at ≤635.
