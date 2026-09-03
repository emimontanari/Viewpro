# Technical Design: Seller Property Proposals

## Scope and companion

This design implements the approved 19-requirement/49-scenario change as a tenant-owned staging aggregate beside the canonical property aggregate. Approval alone materializes a canonical `PropertyAsset`/`PropertyEngagement`; manager direct creation remains unchanged and agents never gain `engagements.create`.

REST, public errors, BFF behavior, App New access/navigation/cache, interface tests, and interface edit surfaces are normative in [interface-design.md](./interface-design.md). This file is normative for data, state, authorization, transactions, concurrency, cleanup, and rollout.

No product decision is reopened. V1 still excludes withdrawal, deletion, images, owner links/invitations/access, notifications, analytics, search, manager drafting, and automatic primary assignment.

## Data model and tenant invariants

Add `PropertyProposal`, immutable `PropertyProposalReviewRound`, append-only `PropertyProposalReviewDecision`, and the fixed status/outcome enums described by the specs. Each table carries `tenantId`, is registered in `TENANT_OWNED_MODELS`, and is covered by registry/schema parity tests.

Key relations and constraints:

- `PropertyProposal`: direct tenant FK with `onDelete: Cascade`; proposer user FK; `@@unique([id, tenantId])`; own-seller and manager-inbox indexes.
- `PropertyProposalReviewRound`: composite `(proposalId, tenantId) -> PropertyProposal(id, tenantId)` with cascade; unique `(proposalId, roundNumber)` and `(id, tenantId)`.
- `PropertyProposalReviewDecision`: composite `(reviewRoundId, tenantId) -> PropertyProposalReviewRound(id, tenantId)` with cascade; unique `reviewRoundId`; reviewer user FK.
- `PropertyEngagement` gains nullable `sourceProposalId`. `(sourceProposalId, tenantId)` is a composite FK to `PropertyProposal(id, tenantId)` with explicit `ON DELETE NO ACTION ON UPDATE RESTRICT`; `sourceProposalId` alone is unique. Direct-created engagements retain `NULL`.
- Proposal/round typed columns mirror canonical scalar fields. Round snapshots are copied from the locked proposal, never request data; approval reads only the locked round.
- SQL checks enforce title/string/numeric/version/round bounds and decision consistency. Rejected reasons are nonblank and at most 1000 characters; approved reasons are null. No title/address uniqueness exists.

The composite source FK makes a cross-tenant canonical result impossible at persistence level. Migration tests inspect `pg_constraint` and indexes, prove same-tenant insertion succeeds, cross-tenant insertion fails, duplicate source fails, proposal deletion is blocked while sourced, and engagement deletion is allowed.

### Canonical result disclosure

The relation is durable but response mapping is viewer-specific. `canonicalEngagementId` is emitted only after a fresh same-tenant visibility query:

- reviewer response: active same-tenant reviewer currently has `ENGAGEMENTS_VIEW_ALL`;
- seller response: active same-tenant seller currently has a `PropertyAgent` row for the result.

Proposer identity alone is insufficient. Missing engagement, mismatched tenant, removed assignment, inactive membership/user, or lost capability omits the field without revealing an ID. Following any emitted link still reauthorizes through the canonical detail use case.

## State machine and replay identity

Every command against an existing proposal runs in a transaction, locks the tenant-scoped proposal row, then reloads authoritative state. Create-draft has no proposal row to lock: one transaction locks and re-reads the acting `User`, then locks and re-reads the exact `(userId, tenantId)` `TenantMembership`, verifies active exact-`AGENT` eligibility, and only then inserts the `BORRADOR` proposal.

| Command | Allowed state and write | Exact replay | Conflict |
|---|---|---|---|
| create | none; create `BORRADOR`, version 1 | none | n/a |
| update | `BORRADOR`/`RECHAZADA`; normalized patch, version +1 | expected prior version plus identical normalized patch | stale/locked state is 409 |
| submit | editable; validate six fields, insert next round, set `EN_REVISION` | expected prior version plus current snapshot equality | stale/nonmatching state is 409 |
| reject | current `EN_REVISION` round; insert decision, set `RECHAZADA` | same round, same reviewer user ID, `REJECTED`, same normalized reason | every other decided/stale case is 409 |
| approve | current `EN_REVISION` round; atomic canonical write and `APROBADA` | same round, same reviewer user ID, `APPROVED`, one source engagement | every other decided/stale case is 409 |

Review replay is actor-specific. After any decision, a different actor receives stable `409 PROPERTY_PROPOSAL_STATE_CONFLICT`, even when requesting the same outcome. Rejection replay additionally requires exact equality of the normalized reason. Same-actor duplicates return authoritative detail with 200 and perform no write.

Active reviewer role/capability and identity-based self-review checks happen before replay can succeed. A former reviewer cannot use replay after deactivation or role loss, and the durable proposer can never review after acquiring a manager role.

Normalization trims strings and stores omitted/blank optional fields as null. Draft save requires a nonblank title. Submission validates title, address, city, province, property type, and operation under lock. The rejection use case is the sole rejection verdict owner: it accepts unknown direct input, requires a string, trims it, and enforces length 1..1000 before state classification; details are in the companion contract.

## Transaction components and lock order

Extract two transaction-level providers under `property-engagements`:

1. `ActivePropertyEngagementCapacity.acquire(tx, tenantId)` locks the tenant row and returns a transaction-bound lease. `lease.assertAvailable()` reads `maxActivePropertyEngagements` and counts `archivedAt IS NULL` engagements excluding exactly `CLOSED` and `CANCELLED`. Neither method opens a transaction; assertion raises `ActivePropertyCapacityExceededError`, a shared domain outcome with no HTTP dependency.
2. `CanonicalPropertyMaterializer.createInTransaction(tx, input)` inserts the asset, engagement, and optional ordinary assignment. It opens no transaction and does not check quota.

Direct create opens its existing outer transaction, acquires/asserts capacity, then materializes with no source/assignment. Restore opens its existing transaction and acquires/asserts through the same component only when restoring an active status. Approval owns one outer transaction, acquires the lease in global lock order, validates identities/replay, then asserts only for a new approval before materializing. There is no nested `$transaction`.

Direct create/restore catch the shared capacity outcome outside the transaction and preserve their current message-only `ConflictException` response. Proposal approval maps it to `TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED` with 409. Thus one quota rule has caller-specific public compatibility.

Proposal approval passes proposer as asset/engagement creator, `CAPTURE`, `sourceProposalId`, and one assignment with proposer as agent, reviewer as assigner, and `isPrimary=false`. It omits `currency` from engagement insert data when round currency is null, allowing the existing Prisma default `ARS`; it never passes null.

### Eligibility and race safety

Seller update/submit transactions first lock the existing proposal, then re-read and lock the acting `User` and exact `(userId, tenantId)` `TenantMembership`, requiring `UserStatus.ACTIVE`, membership `ACTIVE`, and role exactly `AGENT`. Create-draft follows its separate user-then-exact-membership transaction order before insert. Guard/session data is not the mutation-time verdict.

Review transactions lock and re-read reviewer and proposer user/membership rows with `FOR NO KEY UPDATE`, which conflicts with current role/status/deactivation updates. Reviewer must remain active and exactly `MANAGER` or `PRINCIPAL_MANAGER`; approval additionally requires the proposer remain active and exactly `AGENT`. Rejection retains history without requiring proposer eligibility.

The global acquisition order for commands against an existing proposal is:

1. tenant-scoped proposal row `FOR UPDATE`;
2. tenant row `FOR UPDATE` for every approval attempt (including replay) and for canonical direct create/active restore;
3. involved user rows by ascending user ID, `FOR NO KEY UPDATE`;
4. corresponding membership rows by ascending membership ID, `FOR NO KEY UPDATE`;
5. round/decision reads and writes, then canonical inserts.

No existing-proposal path may acquire a user/membership lock before its proposal and any required tenant lock. Create-draft is the explicit no-proposal-row case: it acquires only the acting user and exact membership locks, in that order, before insert. Canonical direct create and restore only acquire the tenant lock, so they remain compatible. Membership role updates already use `FOR UPDATE`; deactivation/status updates conflict with these row locks. Tests race deactivation and role changes against seller creates/saves/submits and review approval/rejection to prove the commit order determines a valid outcome, never a post-deactivation mutation.

Approval writes one asset, one engagement, one non-primary assignment, one decision, and the proposal transition in one transaction. Quota failure or any insert failure rolls all of them back and leaves `EN_REVISION` retryable.

## Deterministic concurrency evidence

Real PostgreSQL tests mirror the established primary-agent concurrency precedent: two independently named operation connections plus a separately named observer connection, bounded transaction/statement timeouts, and test-only barriers removed in `finally`.

- Proposal races pause the winner immediately after it owns the proposal lock, signal that ownership, and start the loser. Before releasing the winner, the observer polls `pg_stat_activity` for the loser's connection until `wait_event_type = 'Lock'` and/or verifies the winner appears in `pg_blocking_pids(loser_pid)`. Polling has a bounded timeout whose expiry fails the test; merely observing that the loser promise remains unsettled is insufficient.
- Same actor/same approval yields one commit and one 200 replay; same actor/same normalized rejection does likewise.
- Different reviewer approval/approval and approval/rejection races yield one committed actor-specific outcome and one 409, never two successes.
- Final-slot races cover approval/approval and approval/direct-create/restore through the shared tenant lock. Exactly one capacity-consuming operation succeeds; losers receive their caller-specific quota behavior.
- Durable assertions count source engagement, asset, assignment, decision, proposal state, and active capacity. Timeout failures are explicit test failures, not accepted outcomes.
- Every suite releases barriers, restores tenant limits, rolls back/ends open transactions, disconnects clients, and removes fixtures in `finally`, including assertion failure paths.

## Cleanup, migration, and rollback semantics

The additive migration creates proposal tables/enums and the nullable engagement column/FK/index; it does not backfill or rewrite existing rows. Validate deploy and index-lock duration against a production-shaped snapshot.

Deletion semantics are intentionally asymmetric:

- tenant deletion cascades proposal/history and canonical tenant rows;
- the source FK blocks deleting a proposal while a source engagement exists; it does not block deleting the engagement;
- deleting an engagement cascades assignments and engagement children but does not delete its `PropertyAsset`;
- deleting an asset cascades its images/owner links and engagements, with existing owner-invitation `SetNull` behavior;
- proposer/submitter/reviewer and canonical creator/assigner user references can block user deletion; agent-user assignment rows retain their existing cascade semantics.

Approval fixtures capture every created canonical asset ID before teardown. Cleanup deletes source engagements first, then deletes the captured now-orphaned assets, then deletes proposals (which cascade rounds/decisions) and the tenant when applicable, and deletes users last. Deleting the tenant directly is not sufficient cleanup because an engagement deletion path can leave its `PropertyAsset`; tests must explicitly remove captured orphan assets and must not weaken FKs to simplify cleanup.

There is no new feature flag. Coordinated rollout order is: additive migration/generated client/isolation and contracts; backend permissions/lifecycle/materialization; BFF/routes; then frontend navigation and entry points only after backend availability is verified. Rollback removes UI/navigation and App routes first. Backend rollback follows only to a binary compatible with persisted schema/contracts; otherwise keep backend read compatibility and disable exposure operationally. Preserve proposal history, source links, canonical assets/engagements, and assignments; destructive retirement is a separate migration.

## Verification and likely core edit surfaces

Strict RED/GREEN coverage includes schema/FK behavior, tenant registry, pure lifecycle/replay identity, authorization, eligibility races, quota/materializer regressions, and real database concurrency. Separately regression-test direct create and restore lock/count/inactive-status/error behavior; do not infer preservation solely from approval tests.

Likely core surfaces:

- `viewpro-app/apps/api/prisma/schema.prisma`
- `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_property_proposals/migration.sql`
- `viewpro-app/apps/api/src/database/tenant-isolation.extension.ts`
- `viewpro-app/apps/api/src/database/tenant-isolation.registry.spec.ts`
- `viewpro-app/apps/api/src/property-proposals/**`
- `viewpro-app/apps/api/src/property-engagements/active-property-engagement-capacity.ts`
- `viewpro-app/apps/api/src/property-engagements/canonical-property-materializer.ts`
- `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts`
- focused API migration, quota, cleanup, use-case, E2E, and concurrency tests

Seeded paths previously called reserved are released after the landed develop baseline. Any apply phase must start from a fresh `origin/develop` that contains the current seeded invariants; it must not rely on this planning worktree's old reservation notes or frozen line positions.

## Risks

| Risk | Control |
|---|---|
| Source ID leaks after assignment/capability change | Fresh viewer-specific canonical visibility before mapping |
| Replay lets another reviewer claim success | Round + actor + outcome + normalized-reason identity |
| Eligibility changes race a command | Conflicting row locks and transactional re-read |
| Quota implementations drift | One transaction-level component shared by create, restore, approval |
| Deadlock across proposal/quota/identity rows | Fixed proposal → tenant → sorted users → sorted memberships order |
| Rollback destroys audit or canonical data | Additive schema and UI-first, compatibility-checked rollback |

## Threat matrix

N/A — this design adds application routes but no shell commands, subprocesses, VCS/PR automation, executable-file classification, or external process-integration boundary.