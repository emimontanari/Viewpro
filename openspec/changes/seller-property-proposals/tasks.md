# Tasks: Seller Property Proposals

## Execution contract

The controlled four-PR planning chain—exploration+proposal → all specs → design+interface → all task artifacts—is merged. The user explicitly authorized source/apply from a fresh implementation worktree based on `origin/develop`; commit, push, PR, and merge remain separately gated. Strict TDD applies to every production-bearing unit: RED, smallest GREEN, TRIANGULATE, REFACTOR, focused verification, and `finally` cleanup. U12 and U22A/U22B are verification-only and own no first RED or production fix. Use only local PostgreSQL `viewpro_test` (or another clearly marked local `*_test` URL), named worker connections, bounded timeouts, and the repository's offline frozen install. No Neon, providers, or external services are authorized. Exact paths, ranges, group arithmetic, and commands are in the companions.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 7,654–9,507 strict implementation/test lines: 7,082–8,813 production-bearing and 572–694 verification-only; parent gate 0. U12 is forecast at 87–119 source/test lines plus its existing exploration note. |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Selected controlled source chain C1 → C2A → C2B1 → C2B2 → C3A → C3B → C4 → C5A → C5B1 → C5B2 → C6A → C6B → C7A1 → C7A2 → C7B → C8A → C8B → C9 … C20, each group max ≤650; selected controlled four-PR planning chain. |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-develop |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-develop
400-line budget risk: High

Unit counts: 30 production-bearing; verification-only units are U12/U22A/U22B (3); and 1 parent/verify gate with no source-unit estimate. The selected source topology is the controlled C1 → C2A → C2B1 → C2B2 → C3A → C3B → C4 → C5A → C5B1 → C5B2 → C6A → C6B → C7A1 → C7A2 → C7B → C8A → C8B → C9 … C20 chain with exactly 31 dependency-ordered groups, each max ≤650. C5A is U5B and must merge before C5B1/U6; C5B2 remains blocked pending the C5B1 merge. C1 is U1; C2A atomically contains U2A, the U2B core migration contract, and U2C tenant registry; C2B1 contains only U2B S39 migration/index/lock/integrity hardening; C2B2 contains the reusable cleanup helper plus its exhaustive direct matrix; C3A contains U3; and C3B contains U4A. C2B2 is mandatory before C3A, and C3B is mandatory before C4/U4B. Schema, migration, and tenant registry remain atomic in C2A so generated-client, database, and isolation consistency are never broken. No blanket exception applies. Strict400 remains rejected forecast/history only, not an active plan.

## Scenario linkage

The evidence matrix preserves exactly 49 rows. Task coverage links them as follows: U1 S34,S43–S45; U2B S39; U4A S24,S35; U4B S40–S42; U5A S02; U5B S01,S03; U6 S04,S06; C6A S05,S08; C6B S09–S10; C7A1 S15 RED; C7A2 S15 GREEN; C7B S11,S14; U9 S13,S17–S19,S31–S32; U10A S20–S23,S27,S29; U10B S37–S38; U11A S25–S26; U11B S30,S33; U13 S07,S12,S28; U14 S16; U17 S47,S49; U18A S36; U18B S46; U20B S48; U22A/U22B final evidence for the remaining journeys. Matrix RED ownership remains authoritative.

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

### C3A / U3 — Pure lifecycle and replay primitives

C3A is complete after mandatory C2B2; C3B/U4A completes locally in this candidate, and C4/U4B cannot begin until C3B merges.

Manifest: `apps/api/src/property-proposals/domain/normalization.ts`, `state-machine.ts`, `replay-identity.ts`, and their three colocated specs.

- [x] RED → GREEN → TRIANGULATE → REFACTOR normalization, title/six-field validation, four-state transitions, immutable snapshots, and actor/outcome/reason replay identity without Prisma, HTTP, or UI dependencies. <!-- sdd-owner: implementation -->
- [x] Run only the three manifest domain specs and API typecheck; leave no generated or database state. <!-- sdd-owner: implementation -->

### C3B / U4A — Shared capacity and direct-path compatibility (S24, S35)

C3B completes locally here; C4/U4B cannot begin until C3B merges.

Manifest: `apps/api/src/property-engagements/active-property-engagement-capacity.ts`, `prisma-property-engagements.repository.ts`, `property-engagements.module.ts`, `active-property-engagement-capacity.spec.ts`, `apps/api/test/property-engagements.e2e-spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR the tenant lock/active-count lease and direct create/restore compatibility, including manager direct-create availability and unchanged existing quota errors. <!-- sdd-owner: implementation -->
- [x] Run the manifest API tests and typecheck with a local `_test` URL; restore limits and remove canonical fixtures in `finally`. <!-- sdd-owner: implementation -->

### U4B — Materializer and primary compatibility (S40–S42)

Manifest: `apps/api/src/property-engagements/canonical-property-materializer.ts`, `apps/api/src/property-engagements/canonical-property-materializer.spec.ts`, `apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts`, `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR materialization, null-currency defaulting, explicit `isPrimary=false`, and separate explicit primary set/change/clear behavior; the primary tests are first added here, not in U12. <!-- sdd-owner: implementation -->
- [x] Run all manifest materializer/primary tests and API typecheck; capture source engagements before orphan assets and close clients in `finally`. <!-- sdd-owner: implementation -->

### U5A — Seller repository and scoped reads (S02)

Manifest: `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, list/get use cases, and `prisma-property-proposals.repository.spec.ts` at the exact paths in the delivery manifest.

- [x] RED → GREEN → TRIANGULATE → REFACTOR tenant-plus-proposer predicates, safe identical absence, own list/detail reads. <!-- sdd-owner: implementation -->
- [x] Run the manifest repository/read specs and API typecheck; delete proposal/history fixtures without touching canonical rows. <!-- sdd-owner: implementation -->

### U5B — Seller draft creation and identity (S01, S03)

Manifest: `apps/api/src/property-proposals/property-proposals.module.ts`, `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, `prisma-property-proposals.repository.spec.ts`, `create-property-proposal.use-case.ts`, and `create-property-proposal.use-case.spec.ts` at the exact paths in the delivery manifest.

- [x] RED → GREEN → TRIANGULATE → REFACTOR trusted tenant/proposer derivation, title-minimum draft creation, exact active `AGENT` eligibility, proposal-identity idempotency, duplicate title/address allowance, and no transport exposure. <!-- sdd-owner: implementation -->
- [x] Run the manifest create/repository specs and API typecheck; remove proposal/history fixtures in `finally`. <!-- sdd-owner: implementation -->

### U6 / C5B1 — Seller update, replay, and locks (S04, S06)

C5B1 is complete after C5A; C5B2 remains blocked until C5B1 merges. C5B1 manifest: `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.ts`, `apps/api/src/property-proposals/helpers/lock-property-proposal.ts`, `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts`, and focused repository coverage.

- [x] C5B1: RED → GREEN → TRIANGULATE → REFACTOR normalized expected-version patches, title-only saves, BORRADOR/RECHAZADA editability, locked-state conflicts, replay, and transaction-bound active-AGENT locks. <!-- sdd-owner: implementation -->
- [x] C5B1: Run the focused update/repository specs, C5A and C4–C5 regressions, API typecheck, and lint; clean local generated/test residue. <!-- sdd-owner: implementation -->

### U6 / C5B2 — Seller eligibility barrier and PostgreSQL races (S04, S06)

Blocked until C5B1 merges. C5B2 manifest: `apps/api/test/property-proposal-eligibility-race.spec.ts`.

- [x] C5B2: Add bounded barriers and prove inactive/role-changed seller create/update eligibility races with real PostgreSQL locks. <!-- sdd-owner: implementation -->
- [x] C5B2: Run the guarded real-PostgreSQL race command repeatedly; close worker transactions, barriers, clients, and proposals in every `finally`. <!-- sdd-owner: implementation -->

### U7 / C6A — Initial BORRADOR submission and immutable round one (S05,S08)

Manifest: `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.ts`, `apps/api/src/property-proposals/helpers/map-property-proposal.ts`, `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, `prisma-property-proposals.repository.spec.ts`, `property-proposals.module.ts`, `helpers/lock-property-proposal.ts`, and `submit-property-proposal.use-case.spec.ts`.

- [x] C6A: RED → GREEN → TRIANGULATE → REFACTOR BORRADOR-only six-field locked-data submission, exact seller locks, immutable full round-one snapshot, same timestamp, and one version increment. <!-- sdd-owner: implementation -->
- [x] C6A: Run focused submit/repository coverage, C5+C6 regression, forced API typecheck, lint, and cleanup/postchecks. <!-- sdd-owner: implementation -->

### U7 / C6B — Rejected resubmission, history, and exact replay (S09–S10)

Blocked until C6A merges. Manifest: `submit-property-proposal.use-case.ts`, `submit-property-proposal.replay.spec.ts`, and the required repository/mapper coverage.

- [x] C6B: RED → GREEN → TRIANGULATE → REFACTOR RECHAZADA-only explicit resubmit, retained prior history, next-round numbering, and exact replay. <!-- sdd-owner: implementation -->
- [x] C6B: Run the replay/history command and API typecheck; delete rounds before proposals in `finally`. <!-- sdd-owner: implementation -->

### C7A1 — Reviewer filter builder (S15 RED)

Manifest: `review-filter-builder.ts` and `review-filter-builder.spec.ts` only. It owns the pure, tenant-correlated filter primitives and pagination normalization; it does not consume a repository, add a port/Prisma predicate, wire a module, or add a use case.

- [x] RED → GREEN → TRIANGULATE → REFACTOR `NONE|PENDING|REJECTED|APPROVED`, default `EN_REVISION`, safe page/pageSize/skip bounds, state+history AND, and tenant-correlated Prisma/raw filter predicates. Exact reviewer ordering is not C7A1 work; S15's repository integration remains GREEN-owned by C7A2. <!-- sdd-owner: implementation -->
- [x] Run the focused builder spec, forced uncached API typecheck, lint, repeat, and bounded guarded-localhost full API retry-0 for the filter/pagination boundary; remove residue and verify base+w1–w4 cleanup. <!-- sdd-owner: implementation -->

### C7A2 — Reviewer repository predicates (S15 GREEN)

Manifest: `property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, and `prisma-property-proposals.repository.spec.ts`. It consumes C7A1's filter-builder contract for tenant-scoped list/count/detail and raw hydration/order; no use case or module wiring.

- [x] GREEN → TRIANGULATE → REFACTOR C7A1's S15 repository port/Prisma list-count-detail, matching count/raw predicate, tenant absence, bindings, exact `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC` ordering, and ordered hydration. <!-- sdd-owner: implementation -->
- [x] Run the C7A2 repository spec and API typecheck, including exact reviewer-order evidence; clear query fixtures and reviewer rows. <!-- sdd-owner: implementation -->

### C7B — Reviewer read use cases and role boundary (S11, S14)

Manifest: reviewer list/detail use cases and their specs only. It consumes C7A2's repository contract and owns both reviewer roles, reviewer-result mapping, and the pending/newest use-case boundary; no repository/filter redo.

- [x] RED → GREEN → TRIANGULATE → REFACTOR both reviewer roles, tenant-scoped all-state use-case reads, pending/newest defaults, and safe result visibility. <!-- sdd-owner: implementation -->
- [x] Run the C7B reviewer-use-case specs and API typecheck; clear query fixtures and reviewer rows. <!-- sdd-owner: implementation -->

### U9 — Rejection, replay, and transition conflicts (S13, S17–S19, S31–S32)

Manifest: rejection use case, `review-transition-conflict.ts` and specs, plus `reject-property-proposal.use-case.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR direct-invocation reason validation, durable rejection without materialization, replay actor/reason identity, self-review/former-reviewer denial, explicit resubmit boundary, and stable 409 races. <!-- sdd-owner: implementation -->
- [x] Run the manifest rejection/conflict specs and API typecheck; delete decisions, rounds, proposals, and assets in dependency order. <!-- sdd-owner: implementation -->

### U10A — Approval materialization core (S20–S23, S27, S29)

Manifest: `approve-property-proposal.use-case.ts`, repository additions, `approve-property-proposal.use-case.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR one-transaction approval, CAPTURE, creator/reviewer attribution, source link, ordinary non-primary assignment, owner-reference exclusion, side-effect exclusion, and generic rollback. <!-- sdd-owner: implementation -->
- [x] Run the manifest approval spec and API typecheck; delete source engagements before captured orphan assets in `finally`. <!-- sdd-owner: implementation -->

### U10B — Result-link response safety (S37–S38)

Manifest: `apps/api/src/property-proposals/responses/property-proposal.response.ts`, `apps/api/src/property-proposals/responses/property-proposal.response.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR fresh viewer-specific same-tenant result visibility, assignment/capability checks, and omission for missing, cross-tenant, inactive, or lost-capability links. <!-- sdd-owner: implementation -->
- [x] Run the manifest response spec and API typecheck; remove test assignments and canonical fixtures in `finally`. <!-- sdd-owner: implementation -->

### U11A — Approval quota and proposer eligibility (S25–S26)

Manifest: approval use-case quota changes, `helpers/approval-lock-order.ts`, `approve-property-proposal.quota.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR proposer eligibility, protected final-slot quota behavior, retry after restored capacity, and atomic rollback with stable public outcomes. <!-- sdd-owner: implementation -->
- [x] Run the manifest quota spec and API typecheck; restore limits, close transactions, and remove assets in `finally`. <!-- sdd-owner: implementation -->

### U11B — Approval replay and race proof (S30, S33)

U11B is split to stay within the 400-line review budget. U11B1 owns replay ordering/source invariants; U11B2 owns same-proposal approval/rejection races; U11B3 owns final-slot races. U12 remains verification-only.

- [x] U11B1: RED → GREEN → TRIANGULATE → REFACTOR same-reviewer approval replay after active reviewer/self-review authorization, requiring exact round/approved actor outcome and one same-tenant source engagement; apply proposer eligibility and quota only to new approval. <!-- sdd-owner: implementation -->
- [x] U11B1: Run focused replay, approval, and quota specs twice plus forced API typecheck and lint; no barriers, race clients, or transport wiring. <!-- sdd-owner: implementation -->
- [x] U11B2: RED → GREEN → TRIANGULATE → REFACTOR bounded same-proposal approval/approval and approval/rejection PostgreSQL lock races without duplicate aggregates. <!-- sdd-owner: implementation -->
- [x] U11B3: RED → GREEN → TRIANGULATE → REFACTOR bounded final-slot approval/approval and approval/direct-create/restore races with failure-continuing cleanup. <!-- sdd-owner: implementation -->

### U12 — Repeated PostgreSQL concurrency matrix (verification-only)

Manifest: `apps/api/test/property-proposal-concurrency-matrix.e2e-spec.ts`, `property-agent-primary-concurrency.e2e-spec.ts`. No `property-proposal-concurrency-fixtures.ts` is created: the import-only matrix reuses the already-green suites and their fixture ownership without duplicating a harness.

- [x] Repeat only already-green eligibility, reviewer, approval, quota, direct-path, primary, and cleanup behavior; observe `pg_stat_activity`/`pg_blocking_pids` with bounded timeouts rather than unsettled promises. <!-- sdd-owner: implementation -->
- [x] Record observed outcomes only; do not add a first RED or production fix, and always release barriers, clients, transactions, fixtures, orphan assets, and limits. <!-- sdd-owner: implementation -->

### U13 — Seller REST transport and first module mount (S07, S12, S28)

The approved under-400 delivery split is U13A → U13B → U13C. The two original U13 completion rows remain the aggregate seller-route outcome and are not complete until U13C.

#### U13A — DTO/projection split

U13A1 is DTO-only; U13A2 retains the pure projection. Neither mounts a controller or module, adds an endpoint/query/role check, or edits C9A response sources.

- [x] U13A1: RED → GREEN → TRIANGULATE → REFACTOR whitelisted seller DTO validation: required/nullable fields, versions, pagination, UUIDs, body/query conversion, and unknown-key rejection. <!-- sdd-owner: implementation -->
- [x] U13A1: Run the guarded DTO spec twice, API typecheck and lint; remove local generated/build/cache residue and record final arithmetic. <!-- sdd-owner: implementation -->
- [x] U13A2: RED → GREEN → TRIANGULATE → REFACTOR the literal-allowlisted transport projection and raw-relation exclusion. <!-- sdd-owner: implementation -->
- [x] U13A2: Run its focused projection evidence, API typecheck, and lint. <!-- sdd-owner: implementation -->

#### U13B — Safe seller reads and current/history visibility

- [x] U13B: Resolve the current-round/history public-field contract, then RED → GREEN → TRIANGULATE → REFACTOR safe seller read shaping and fresh current visibility without controller or module mounting. <!-- sdd-owner: implementation -->
- [x] U13B: Run its approved focused read/visibility evidence and API typecheck; clean fixtures and document the resolved response contract. <!-- sdd-owner: implementation -->
- [x] U13B1: RED → GREEN → TRIANGULATE → REFACTOR seller list summaries with the literal public allowlist, one tenant-scoped current-round batch, and fresh result visibility batches only. <!-- sdd-owner: implementation -->
- [x] U13B1: Run focused seller-read/list/transport/C9A evidence twice, then API typecheck and lint; no database fixtures, controller, module, detail, or history work. <!-- sdd-owner: implementation -->
- [x] U13B2: Resolve seller detail/history shaping and retain equivalent fresh visibility without changing U13B1 list summaries. <!-- sdd-owner: implementation -->

#### U13C — Seller endpoints, module mount, and transport integration

U13C is split under 400 lines: U13C1 owns the controller contract and first mount; U13C2 retains HTTP/E2E transport integration. The aggregate U13C and U13 rows remain incomplete until U13C2.

- [x] U13C1: RED → GREEN → TRIANGULATE → REFACTOR the five seller controller routes, exact guard/permission metadata, trusted context wiring, safe mutation rereads, and absent forbidden handlers; mount the controller and module only here. <!-- sdd-owner: implementation -->
- [x] U13C1: Run the focused controller contract twice, API typecheck, and lint; normal runner P1001 may use a temporary no-global-setup unit fallback only. <!-- sdd-owner: implementation -->
- [x] U13C2: RED → GREEN → TRIANGULATE → REFACTOR HTTP transport integration for permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, and current-role checks. <!-- sdd-owner: implementation -->
- [x] U13C2: Run controller/E2E transport evidence and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->

- [x] U13C: RED → GREEN → TRIANGULATE → REFACTOR seller routes, permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, current-role checks, and absent withdraw/delete/image routes; mount only here. <!-- sdd-owner: implementation -->
- [x] U13C: Run the approved controller/E2E transport tests and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->

- [x] RED → GREEN → TRIANGULATE → REFACTOR seller routes, permission-before-lookup, own/tenant 404 equivalence, unknown-key rejection, current-role checks, and absent withdraw/delete/image routes; mount only here. <!-- sdd-owner: implementation -->
- [x] Run the manifest controller/E2E tests and API typecheck; clean seeded rows/assets in `finally`. <!-- sdd-owner: implementation -->

### U14 — Reviewer REST transport and static route precedence (S16)

Manifest: U14A1 is list-only: reviewer repository port/Prisma adapter, reviewer list use case/spec, literal summary transport/spec, and reviewer-read repository spec. U14A2 owns detail/history; U14B owns controller/DTO/module; U14C owns HTTP E2E.

#### U14A1 — Reviewer list-only projection
- [x] RED → GREEN → TRIANGULATE → REFACTOR a literal reviewer list summary behind the existing reviewer role/capability gate, preserving every C7 list test/filter/order/pagination boundary; batch tenant-scoped rounds, result rows, and proposers once per page without N+1 or direct-source output, and never drop a row because its proposer lacks current membership. <!-- sdd-owner: implementation -->
- [x] Run the focused list repository/use-case/transport evidence twice, API typecheck, and lint; record the normal-runner P1001 and use only a no-global unit fallback. <!-- sdd-owner: implementation -->
#### U14A2 — Reviewer detail/history projection
- [x] RED → GREEN → TRIANGULATE → REFACTOR reviewer detail/history shaping and coded absence without changing U14A1 list behavior. <!-- sdd-owner: implementation -->
#### U14B — DTO/controller/module contract
- [x] RED → GREEN → TRIANGULATE → REFACTOR reviewer DTO/controller/module/provider wiring, static `review` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->
#### U14C — Reviewer HTTP E2E
- [x] Run guarded reviewer query/controller HTTP evidence and API typecheck; return any discovered product defect to U14A2/U14B and clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->

- [x] RED → GREEN → TRIANGULATE → REFACTOR static `review` precedence, both reviewer roles, permission-before-lookup, self-review, direct rejection validation, replay/conflict/quota mappings, and unsupported search rejection. <!-- sdd-owner: implementation -->
- [x] Run the manifest query/controller E2E tests and API typecheck; clean decisions, rounds, proposals, and assets. <!-- sdd-owner: implementation -->

### U15A — Seller BFF routes (aggregate)

Manifest: seller `route.ts` files and colocated `route.test.ts` files for collection, `[proposalId]`, and `[proposalId]/submit`, plus `src/lib/bff-api.ts` and `bff-api.test.ts`.

#### U15A1 — Shared helper and seller collection

- [x] RED → GREEN → TRIANGULATE → REFACTOR trusted selected-tenant forwarding, canonical request-ID filtering, status/body passthrough, malformed/no-body, timeout/network handling, and collection GET/POST query/raw-body forwarding through `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`; JSON tenant/proposer fields never override trusted context. <!-- sdd-owner: implementation -->
- [x] Run `bff-api.test.ts` and collection `route.test.ts`, App typecheck, and lint; reset fetch/header mocks, timers, responses, and request context. <!-- sdd-owner: implementation -->

#### U15A2 — Seller detail and submit routes

- [x] RED → GREEN → TRIANGULATE → REFACTOR detail and submit method/path/body forwarding, selected-tenant behavior, passthrough status/body, request-ID filtering, malformed/no-body, and timeout handling only through the real shared BFF helpers. <!-- sdd-owner: implementation -->
- [x] Run only the detail and submit route tests, App typecheck, and lint; clear mock responses, timers, and request context. <!-- sdd-owner: implementation -->

- [x] U15A aggregate: complete both U15A1 and U15A2 seller BFF slices without route-local helper duplication. <!-- sdd-owner: implementation -->

### U15B — Reviewer BFF routes (aggregate)

Manifest: reviewer collection, detail, reject, and approve `route.ts` files with their exact colocated `route.test.ts` files. The user-approved U15B1 → U15B2 split keeps reviewer reads and decisions independently reviewable under 400 lines.

#### U15B1 — Reviewer reads: collection and detail

- [x] RED → GREEN → TRIANGULATE → REFACTOR reviewer collection and detail GET routes through only `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`; preserve raw collection query bytes, encode async detail params exactly once, and retain backend-owned tenant/auth/query validation. <!-- sdd-owner: implementation -->
- [x] Run the two U15B1 reviewer-read route tests twice, App typecheck, and lint; clear mocked `bffFetch` state and generated residue. <!-- sdd-owner: implementation -->

#### U15B2 — Reviewer decisions: reject and approve

- [x] RED → GREEN → TRIANGULATE → REFACTOR reviewer reject and approve routes independently; forward only the authorized method/path/raw body through the shared BFF helpers without tenant or decision logic. <!-- sdd-owner: implementation -->
- [x] Run the two U15B2 reviewer-decision route tests, App typecheck, and lint; clear mocks, timers, and request context. <!-- sdd-owner: implementation -->

- [x] U15B aggregate: complete U15B1 reviewer reads and U15B2 reviewer decisions without a consolidated route test or route-local BFF helper behavior. <!-- sdd-owner: implementation -->

### U16A — Browser service and safe BFF error boundary (aggregate)

#### U16A1 — BFF error boundary

Manifest: `src/lib/bff-client.ts`, `src/lib/__tests__/bff-client.spec.ts`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR `BffError`, canonical UUIDv4 capture, hostile-prose removal, and timeout/network behavior. <!-- sdd-owner: implementation -->
- [x] Run the focused BFF client spec twice, App typecheck, and strict lint; reset fetch, timers, and browser-memory state. <!-- sdd-owner: implementation -->

#### U16A2 — Typed proposal service

Manifest: feature `api/types.ts`, `api/service.ts`, and `api/service.test.ts`; depends on U16A1.

- [x] RED → GREEN → TRIANGULATE → REFACTOR typed seller/reviewer service calls through `bffRequest`, local code mapping, signals, and timeout behavior. <!-- sdd-owner: implementation -->
- [x] Run the focused service spec, App typecheck, and strict lint; reset mocks and query state. <!-- sdd-owner: implementation -->

- [x] U16A aggregate: complete U16A1 and U16A2 without feature routes, queries, UI, backend, or contract changes. <!-- sdd-owner: implementation -->

### U16B — Query key and invalidation contracts

Manifest: feature `api/queries.ts` and `api/queries.test.ts`.

#### U16B1 — Tenant-scoped query reads

- [x] RED → GREEN → TRIANGULATE → REFACTOR tenant-plus-audience list/detail keys, normalized seller/reviewer read filters, signal propagation, and cancel-before-remove old-tenant cleanup. <!-- sdd-owner: implementation -->
- [x] Run the focused query-read spec twice, App typecheck, and strict lint; clear query caches and tenant fixtures. <!-- sdd-owner: implementation -->

#### U16B2 — Mutation invalidation and authoritative refresh

- [x] RED → GREEN → TRIANGULATE → REFACTOR five closure-bound mutations, both-audience invalidation, 409 authoritative refresh, canonical product invalidation, and no optimistic cache writes. <!-- sdd-owner: implementation -->
- [x] Run the focused mutation query spec, App typecheck, and strict lint; clear mutation/query caches and tenant fixtures. <!-- sdd-owner: implementation -->

- [x] U16B aggregate: complete U16B1 and U16B2 query contracts without route, UI, backend, or contract changes. <!-- sdd-owner: implementation -->

### U17 — Shared access policy and fail-closed boundaries (S47, S49)

Manifest: `src/lib/property-proposal-access.ts`, `navigation-access.ts`, `hooks/use-nav.ts`, their exact tests, and `src/test/navigation-access-fixtures.ts`; do not expose a destination yet.

- [x] RED → GREEN → TRIANGULATE → REFACTOR deeply immutable policy reuse, unresolved/loading suppression, inactive/wrong-role/missing-capability fail-closed behavior, and query enablement without a landed destination. <!-- sdd-owner: implementation -->
- [x] Run the manifest access/navigation specs, App typecheck, and strict lint; clear router/query/tenant-switch fixtures. <!-- sdd-owner: implementation -->

### U18A — Working seller form and status label (S36)

Manifest: seller schema/form/new/list support paths, direct page boundary `apps/app-new/src/app/dashboard/property-proposals/new/page.test.tsx` T11–15, `property-proposal-status-label.tsx`, `property-proposal-status-label.test.tsx`, and `property-proposal-form.test.tsx`.

- [x] RED → GREEN → TRIANGULATE → REFACTOR the direct seller-new page boundary in `apps/app-new/src/app/dashboard/property-proposals/new/page.test.tsx` alongside title-only save, six-field submit validation, separate save/submit mutations, persisted `EN_REVISION` rendering as `EN_REVISIÓN`, no images, and no canonical-create call. <!-- sdd-owner: implementation -->
- [x] Run the manifest seller component tests, App typecheck, and strict lint; reset form, router, and query state. <!-- sdd-owner: implementation -->

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
- [x] After planning-chain acceptance and any separately authorized merges, require fresh explicit source/apply authorization and a fresh `origin/develop` implementation worktree before beginning the controlled C1→C2A→C2B1→C2B2→C3A→C3B→C4…C20 source chain. <!-- sdd-owner: parent -->
- [ ] Run the final read-only `git diff --check` gate and reconcile all 49 matrix rows, commands, skips, blockers, and residual risks; Git mutation, delivery, push, merge, and archive remain forbidden here. <!-- sdd-owner: parent -->

## Arithmetic check

The delivery companion contains the read-only worksheet. Corrected strict-unit totals are recomputed mechanically from every listed path range: production-bearing `7,082–8,813`, verification-only `572–694`, parent gate `0`, strict implementation/test total `7,654–9,507`; every strict unit maximum is ≤400 and every controlled group maximum is ≤650; the 31-group topology separates C3A/U3, C3B/U4A, C5A/U5B, C5B1/U6 update locks, C5B2/U6 races, C6A/U7 initial submission, C6B/U7 resubmission/history, C7A1 filter RED, C7A2 repository GREEN, and C7B use cases; C8A/U9 rejection and C8B/U10A approval materialization; C2A current candidate is capped at 649; C2B1 and C2B2 are each capped at ≤635.
