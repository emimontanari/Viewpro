# Design: Native optional primary seller

## Decision summary

Store the designation on the existing `PropertyAgent` row as a non-null `isPrimary` boolean, defaulting to `false`, and enforce one true row per engagement with a PostgreSQL partial unique index. Primary writes reuse the existing property-assignment controller, permission, repository, response mapper, BFF, query cache, and management dialog. They do not introduce a second assignment entity or change any-assignee access.

Every set/change and clear is compare-and-set against the primary assignment the client last read. The repository serializes set, clear, and assignment removal by locking the tenant-scoped `property_engagements` row. A set then acquires explicit PostgreSQL `FOR NO KEY UPDATE` locks on the candidate assignment, user, and same-tenant membership in that order before replacing the flag. Those locks conflict with assignment deletion and with ordinary updates to `users.status`, `tenant_memberships.status`, or `tenant_memberships.role`, so selection is eligible at its commit boundary. This makes stale concurrent requests conflict rather than allowing an earlier response to claim a losing requested value.

Owner movement contact is computed once per timeline request from a filtered, currently valid primary assignment and reused for every returned movement. No primary, an invalid designation, or an unusable phone produces the existing unavailable contact; there is no oldest-assignment, agency, creator, or other-seller fallback.

## Goals and boundaries

- Preserve `PropertyAgent` as the only seller-to-engagement assignment model.
- Preserve all `agents.some(...)` and equivalent any-assignee visibility/authorization predicates.
- Permit an intentional zero-primary state indefinitely.
- Make set/change/clear/remove deterministic under concurrency and database-enforced.
- Revalidate contact eligibility at read time without a query per movement.
- Integrate in the existing App New seller-management surface without optimistic primary state.
- Leave automatic selection, backfill, invalidation cleanup, phone editing, and permission redesign out of scope.

## Persistence model

### Prisma and SQL
Change `viewpro-app/apps/api/prisma/schema.prisma`, model `PropertyAgent`:

```prisma
model PropertyAgent {
  // existing fields
  isPrimary Boolean @default(false)
}
```

The migration adds:

```sql
ALTER TABLE "property_agents"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX "property_agents_one_primary_per_engagement"
  ON "property_agents" ("propertyEngagementId")
  WHERE "isPrimary" = TRUE;
```

Use the repository's actual mapped camel-case column names as emitted by Prisma; the migration must match the generated table definition exactly. Prisma cannot express a partial unique index, so add a schema comment next to `isPrimary` naming the raw-SQL invariant, as the schema already does for other partial indexes.

This representation is durable because the primary is intrinsically a current assignment: deleting the `PropertyAgent` row deletes the designation in the same statement. The existing unique key `(propertyEngagementId, agentUserId)` still prevents duplicate assignments, while the new partial index prevents two primary assignment rows even if an application path bypasses the normal transaction.

All existing rows receive `false`; this is schema initialization, not selection or backfill. There is no data scan that chooses a seller.

### Invariants
1. An engagement has zero or one `PropertyAgent.isPrimary = true` row.
2. A primary row cannot survive deletion of that assignment.
3. `isPrimary` has no effect on assignment visibility or authorization.
4. Eligibility is required when writing and independently rechecked when owner contact is read.
5. User or membership invalidation does not rewrite or transfer the flag.

The existing application-level tenant checks remain necessary because the current `PropertyAgent.tenantId` schema does not have a compound foreign key proving equality with `PropertyEngagement.tenantId`. Every primary query therefore constrains both `tenantId` and `propertyEngagementId`.

## Concurrent mutation protocol

### Client precondition
Both set/change and clear carry `expectedPrimaryAgentId: string | null`, taken from the last server response. The field is required, and `null` explicitly means that the client observed no primary. This is not an optional field whose omission means null.

This compare-and-set token is preferable to last-write-wins. If two managers start from the same state, one commits and the other receives a stable conflict, then refreshes to the winner. A successful response is the complete engagement read produced by the committing transaction; the UI never paints the requested assignment before that response.

### Locking and transaction algorithm
Implement the atomic operations in `PrismaPropertyEngagementsRepository`; do not split eligibility checks across a membership repository and a later write.

For **set/change**:

1. Begin a Prisma interactive transaction.
2. Execute a mandatory parameterized raw query:
   `SELECT id FROM property_engagements WHERE id = $engagementId AND tenantId = $tenantId FOR UPDATE`.
   A missing row returns `engagementNotFound`. This row is the serialization lock for all primary and removal mutations on the engagement.
3. Read the current primary assignment under the transaction, constrained by `tenantId`, `propertyEngagementId`, and `isPrimary = true`.
4. Compare its assignment id (or `null`) with `expectedPrimaryAgentId`. On mismatch, return `stateConflict` without writing.
5. Acquire and validate candidate rows with three mandatory parameterized raw queries in this exact order; do not collapse them into a planner-dependent joined locking query:
   1. Lock the `property_agents` candidate by assignment id, engagement id, and tenant id using `FOR NO KEY UPDATE`. A missing row is `candidateInvalid`. This lock conflicts with deletion of that assignment.
   2. Lock the referenced `users` row by `agentUserId` with `status = ACTIVE` using `FOR NO KEY UPDATE`. A missing/inactive row is `candidateInvalid`.
   3. Lock the unique `tenant_memberships` row by `userId = agentUserId` and `tenantId = input.tenantId`, with `status = ACTIVE` and exact `role = AGENT`, using `FOR NO KEY UPDATE`. A missing/ineligible row is `candidateInvalid`.
   The complete lock order is therefore engagement, assignment, user, membership. `FOR NO KEY UPDATE` is deliberate: unlike `FOR KEY SHARE`, it conflicts with PostgreSQL row locks taken by updates to `users.status`, `tenant_memberships.status`, and `tenant_memberships.role`, while avoiding the extra foreign-key-reference blocking of `FOR UPDATE`. Hold every lock through commit. Together, the three predicates validate the same assignment/user/same-tenant-membership eligibility rule inside one transaction; any failure returns the same non-disclosing `candidateInvalid` result for stale, unassigned, inactive, wrong-role, or cross-tenant candidates.
6. If the requested row is already the expected primary, treat the operation as an idempotent success only after all three eligibility locks and validations succeed, then read the response state.
7. Otherwise update the current true row(s) to false, still constrained by tenant and engagement, then update exactly the validated candidate row to true. Clearing first is safe because the transaction rolls back on any later failure.
8. Read the complete tenant-scoped engagement using `propertyEngagementInclude`, commit, and return it. Map only after the transaction commits.
9. Translate a `P2002` for `property_agents_one_primary_per_engagement` into `stateConflict`; do not expose Prisma metadata. The index is the final safety boundary even though the lock protocol should prevent this on cooperating paths.

For **clear**:

1. Lock the same tenant-scoped engagement row `FOR UPDATE`.
2. compare the current primary assignment id with the required `expectedPrimaryAgentId`;
3. on match, update all true rows for that tenant and engagement to false, read the complete engagement, and commit;
4. on mismatch, return `stateConflict` without writing. Clearing when both expected and current are null is an idempotent success.

For **assignment removal** in `removeAgent`:

1. Move the existing delete into an interactive transaction.
2. Lock the same tenant-scoped engagement row first.
3. Delete the assignment by id, tenant, and engagement.
4. Return not found when no row was deleted.

Deleting a primary row atomically leaves no primary; deleting another row leaves the primary unchanged. Because set, clear, and remove all acquire the engagement lock first, their order is well-defined and deadlock risk is bounded. Examples:

- set commits before removal: removal deletes the new primary and leaves none;
- removal commits before set: set sees a stale candidate and changes nothing;
- two sets with the same expected id: the first commits, the second sees a precondition mismatch and conflicts;
- clear versus set from the same expected id: exactly one commits and the other conflicts.

User and membership invalidation paths do not need the engagement lock: their `UPDATE` statements necessarily take a conflicting row lock on the same user or membership row. The ordering guarantee is precise:

- If a user-status, membership-status, or membership-role update commits before selection obtains that row's `FOR NO KEY UPDATE` lock, PostgreSQL's `READ COMMITTED` locking read follows the committed row version, rechecks its eligibility predicate, and selection returns `candidateInvalid` without changing the primary.
- If selection obtains all eligibility locks first, a concurrent invalidating update to any locked user/membership row waits. Selection may commit the designation because it was eligible at that commit boundary; the invalidation then proceeds and, once committed, makes the stored designation unusable.
- If the invalidating transaction rolls back, selection resumes against the still-eligible row and may proceed. PostgreSQL deadlock/transaction failures remain failures and are never treated as successful selection.

This protocol does not promise that eligibility remains true forever after selection commits. Independent owner-contact read-time validation remains mandatory after every commit and fails closed as soon as a committed invalidation is visible. No invalidation path clears the flag or promotes another assignment.

## Backend API and contracts

### Routes and authorization
Add these actions to `PropertyEngagementsController` under its existing guards:

| Method and path | Body | Meaning |
|---|---|---|
| `PUT /property-engagements/:id/agents/primary` | `{ agentId: string, expectedPrimaryAgentId: string | null }` | Set or change to an existing assignment. |
| `POST /property-engagements/:id/agents/primary/clear` | `{ expectedPrimaryAgentId: string | null }` | Explicitly clear. |

Both use `@RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)`, exactly like assign/remove. `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard`, and `CurrentTenant` remain the authorization and tenant boundary. Primary status creates no permission. A cross-tenant engagement is indistinguishable from a missing engagement; a cross-tenant candidate is the same invalid-candidate result as any stale assignment.

Add `SetPrimaryPropertyAgentDto` and `ClearPrimaryPropertyAgentDto` under `property-engagements/dto/`. Validation must require the expected field while allowing null, reject malformed ids through the normal validation envelope, and never accept an omitted precondition.

Add `SetPrimaryPropertyAgentUseCase` and `ClearPrimaryPropertyAgentUseCase`. Each delegates the atomic decision to the repository and maps results to Nest exceptions. Register both in `property-engagements.module.ts`; no new module or repository token is needed.

### Success response
Both operations return the normal `PropertyEngagementResponse` (HTTP 200), not an invented parallel assignment shape. Extend `mapPropertyEngagement` so every item in `agents` includes required `isPrimary: boolean`. Reads therefore represent no-primary as all false and a durable designation as exactly one true row. Assignment creation remains unchanged and naturally returns a non-primary assignment.

Returning the complete engagement lets App New replace its detail cache with transaction-confirmed state. List/detail responses use the same mapper, so refreshes cannot infer state from assignment order.

### Stable failure outcomes
Add the following public codes to `viewpro-app/packages/contracts/src/index.ts` and its runtime contract test:

| Status | `errorCode` | Use |
|---|---|---|
| 400 | `PRIMARY_AGENT_CANDIDATE_INVALID` | Candidate is stale, unassigned, inactive, cross-tenant, lacks an active same-tenant membership, or is not exact `AGENT`. |
| 409 | `PRIMARY_AGENT_STATE_CONFLICT` | The expected primary no longer matches, or the database uniqueness backstop rejects the write. |

Use generic operator-safe messages inside the Nest exceptions; production exposes only `statusCode`, catalogued `errorCode`, and `requestId` through `GlobalExceptionFilter`. Do not put user ids, tenant ids, membership status, phone values, SQL, or Prisma metadata in messages or logs. Missing/cross-tenant engagements retain the existing 404 behavior. Unauthorized requests retain the guard's existing 403 behavior.

Repository result unions should be explicit (`updated`, `engagementNotFound`, `candidateInvalid`, `stateConflict`) so use cases do not parse database exception prose.

## Read-time validity and owner movement contact

### Validity rule
A contact candidate is valid only if one row simultaneously satisfies:

- `PropertyAgent.isPrimary = true`;
- `PropertyAgent.tenantId` and `propertyEngagementId` match the owner-authorized engagement;
- the assignment row still exists;
- `agentUser.status = ACTIVE`;
- `agentUser.memberships.some` has the engagement tenant, `status = ACTIVE`, and exact `role = AGENT`.

The query selects only `agentUser.whatsappPhone`. `mapAssignedSellerWhatsappContact` continues to apply the shared `isValidWhatsappPhone` utility with the existing explicit null guard. Phone loss or invalid formatting therefore fails closed without changing persisted primary state.

### Query shape without per-movement N+1
Refactor `OwnerMovementRecord` so it no longer includes `movement.propertyEngagement.agents`. Add an `OwnerPrimarySellerContactCandidate` (`{ agentUserId, agentUser: { whatsappPhone } }`) and return `primarySellerContact` once alongside `engagement`, `items`, and `total` from `findEngagementTimelineForOwner`.

After the owner-authorized engagement is found, execute these in one `Promise.all`:

1. paginated movement query with only `createdBy` included;
2. movement count;
3. one `propertyAgent.findFirst` for the valid primary filter above, selecting only id/user id/phone.

The partial unique index guarantees at most one result. This is a fixed number of queries per timeline page, not one query or repeated nested payload per movement. The use case passes the same candidate to `mapOwnerMovement(movement, primarySellerContact)` for each item.

Change `mapAssignedSellerWhatsappContact` to accept one candidate or null rather than an ordered array. Keep the response exactly:

- available: `{ available: true, targetType: 'assigned_seller', displayLabel: 'Consultar responsable', whatsappPhone }`;
- unavailable: `{ available: false, targetType: 'assigned_seller', displayLabel: 'Contacto no configurado' }`.

Do not change owner BFF timeline routes, WhatsApp URL/message construction, tenant/property contact mapping, `TrackOwnerMovementWhatsappContactClickUseCase`, analytics event names/metadata, or click behavior. Those consumers receive the same contact shape; only candidate resolution changes.

## App New integration

### BFF and service
Add product-named proxy routes, matching current adapter conventions:

- `apps/app-new/src/app/api/products/[id]/agents/primary/route.ts`: `PUT` proxies set;
- `apps/app-new/src/app/api/products/[id]/agents/primary/clear/route.ts`: `POST` proxies clear.

Use `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse`; forward the selected tenant header and catalogued backend error body unchanged. Add focused route tests for method/path/body forwarding, 400/409 passthrough, request-id passthrough, timeout, and transport failure.

In `features/products/api/service.ts`, add `setPrimaryProductAgent(productId, payload)` and `clearPrimaryProductAgent(productId, payload)`, both returning `PropertyEngagement`. Add payload types with the required expected id.

### Shared frontend types
Do not add a required `isPrimary` member to the broadly shared `ProductAgent` type. Dashboard and activity contracts import that type, but their independent API producers do not currently emit primary state.

Instead add:

```ts
export type PropertyAssignedAgent = ProductAgent & { isPrimary: boolean };
```

Use `PropertyAssignedAgent[]` only for `PropertyEngagement.agents` and the seller-management component props. Keep dashboard/activity `ProductAgent[]` unchanged unless their backend contracts independently start emitting the field. This prevents unrelated dashboard/activity fixtures and producers from breaking while making primary state required where the property API guarantees it.

### Query cache and UI behavior
Extend `PropertyAgentsSection` and `ManagePropertyAgentsDialog` in place:

- derive `primaryAgentId` only from `assignedAgents.find(agent => agent.isPrimary)?.id ?? null`;
- show a `Principal` badge in the panel and assigned list, and clear copy such as `Sin vendedor principal` when none is selected;
- expose `Marcar como principal` only for currently assigned users present in the loaded assignable-members response with exact role `AGENT`; backend validation remains authoritative;
- expose `Quitar principal` as a separate action; removing the assignment remains a separate existing action;
- show a persisted-but-currently-ineligible primary as principal with unavailable/ineligible supporting copy rather than hiding it or selecting another seller;
- retain archived and `canManageAgents` disabling behavior for all new controls.

Each mutation captures the current derived `primaryAgentId` as `expectedPrimaryAgentId`. There is no `onMutate` cache edit for primary state. On success, replace the exact `productKeys.detail(productId, tenantId)` cache with the returned `PropertyEngagement`, then invalidate product queries to reconcile list consumers. On `PRIMARY_AGENT_STATE_CONFLICT`, refetch the detail before showing conflict copy so the durable winner/no-primary state is rendered. On candidate-invalid, also refetch because membership or assignment state may have changed. Generic failures use safe local copy and leave the last server state visible.

Locally disable set/clear/remove/assign controls while any seller mutation is pending to reduce accidental overlap, but do not rely on this for correctness. A removal success is followed by the existing product invalidation; if it removed the primary, the refreshed server response shows no primary and never promotes another row.

`product-form.tsx` continues to pass `propertyEngagement.agents`, tenant id, archive state, and permission into the same section. No second management screen is added.

## Data flow

### Set/change
1. Manager opens the existing dialog from a server-read engagement.
2. UI sends assignment id plus the primary id it observed to the product BFF.
3. BFF forwards auth cookies and selected tenant to Nest.
4. Existing guards authorize `ENGAGEMENTS_CREATE` in the active tenant.
5. Repository locks the engagement, checks the expected state, then locks assignment, user, and membership in that fixed order with `FOR NO KEY UPDATE`; only after all eligibility predicates pass does it flip flags and read the engagement.
6. Partial unique index guarantees at most one true row.
7. API returns mapped engagement; UI installs that response and then invalidates/refetches.
8. A stale concurrent request receives `PRIMARY_AGENT_STATE_CONFLICT` and refreshes instead of showing its requested seller.

### Owner timeline
1. Existing owner access predicate authorizes the engagement.
2. Repository fetches movements/count and one valid-primary contact candidate in parallel.
3. Mapper validates the candidate phone using existing rules and applies the same resulting contact to each movement in the page.
4. Owner UI, link formatting, and click tracking consume their unchanged response contract.

## Exact file and symbol plan

### Database and backend
- `viewpro-app/apps/api/prisma/schema.prisma` — `PropertyAgent.isPrimary` and partial-index comment.
- `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_property_agent_primary/migration.sql` — column and `property_agents_one_primary_per_engagement` index.
- `viewpro-app/apps/api/src/property-engagements/dto/set-primary-property-agent.dto.ts` — set/change DTO.
- `viewpro-app/apps/api/src/property-engagements/dto/clear-primary-property-agent.dto.ts` — clear DTO.
- `viewpro-app/apps/api/src/property-engagements/property-engagements.repository.ts` — atomic result/input types and `setPrimaryAgent`/`clearPrimaryAgent` contracts; keep `removeAgent` contract but make implementation transactional.
- `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts` — engagement lock helper; separate assignment, user, and membership `FOR NO KEY UPDATE` helpers in fixed order; compare-and-set implementations; transactional removal; uniqueness error translation.
- `viewpro-app/apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.ts` — result-to-HTTP mapping.
- `viewpro-app/apps/api/src/property-engagements/use-cases/clear-primary-property-agent.use-case.ts` — result-to-HTTP mapping.
- `viewpro-app/apps/api/src/property-engagements/responses/property-engagement.response.ts` — required `agents[].isPrimary`.
- `viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts` — two guarded routes and Swagger DTO registration.
- `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts` — use-case providers/exports.
- `viewpro-app/packages/contracts/src/index.ts` and `viewpro-app/packages/contracts/test/runtime-contract.spec.ts` — public error codes.

### Owner portal
- `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts` — movement/contact record contracts and timeline result.
- `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts` — remove ordered-agent movement include; add one filtered primary query per timeline page.
- `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` — map one primary candidate/null, preserving response text and phone utility.
- `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts` — accept the engagement-level primary candidate.
- `viewpro-app/apps/api/src/owner-portal/use-cases/get-owner-engagement-timeline.use-case.ts` — pass candidate to every movement mapper.

### App New
- `viewpro-app/apps/app-new/src/app/api/products/[id]/agents/primary/route.ts` — set proxy.
- `viewpro-app/apps/app-new/src/app/api/products/[id]/agents/primary/clear/route.ts` — clear proxy.
- `viewpro-app/apps/app-new/src/features/products/api/types.ts` — scoped `PropertyAssignedAgent`, payloads, and property response typing.
- `viewpro-app/apps/app-new/src/features/products/api/service.ts` — set/clear calls.
- `viewpro-app/apps/app-new/src/features/products/components/property-agents-section.tsx` — mutations, cache reconciliation, and conflict handling.
- `viewpro-app/apps/app-new/src/features/products/components/manage-property-agents-dialog.tsx` — badges, no-primary state, eligibility-aware actions.
- `viewpro-app/apps/app-new/src/features/products/error-messages.ts` — code-based safe primary mutation copy.
- `viewpro-app/apps/app-new/src/features/products/components/product-form.tsx` — no structural change expected beyond any narrowed prop type inference.

## Test seams

### Database/repository
Extend `apps/api/test/property-engagements.repository.spec.ts` for the exact engagement → assignment → user → membership lock-before-write call order, the exact `FOR NO KEY UPDATE` strength on all three candidate rows, expected-state comparisons, atomic flag replacement, idempotent set/clear, invalid candidate, tenant constraints, P2002 translation, and remove-primary deletion in one transaction. Existing transaction mocks must implement `$queryRaw`; production locking must never be skipped merely because a mock lacks it. These unit assertions document query construction but do not count as concurrency proof.

Add PostgreSQL-backed focused concurrency tests in the existing API e2e/integration harness, using two independent database connections and deterministic transaction barriers rather than timing-only overlap. Race:

- different candidates from the same expected primary;
- set versus clear;
- set versus removal of that candidate;
- clear versus removal of the current primary;
- set versus `users.status` invalidation;
- set versus `tenant_memberships.status` invalidation;
- set versus `tenant_memberships.role` changing away from `AGENT`.

For each eligibility field, exercise both commit orders through the real repository paths. In the invalidation-first case, hold the invalidating transaction after its `UPDATE`, start selection, then commit invalidation; assert selection returns `candidateInvalid` and leaves the previous primary unchanged. In the selection-first case, pause selection after all three eligibility locks, start the invalidating update on the second connection, and verify it cannot complete before selection releases its transaction; then commit selection, allow invalidation to commit, and assert a fresh owner-contact read is unavailable. The integration harness may expose a test-only transaction barrier at the repository lock seam, but it must not replace either SQL operation with a mock.

For primary/removal races, assert one success plus one conflict/invalid/not-found as appropriate, at most one true row by direct database read, and no mutation of the assignment set except the requested removal. For every invalidation race, assert the stored flag is never transferred to another seller and read-time validation fails closed after invalidation commits. The real-database seam is mandatory because query-shape mocks cannot prove row-lock conflicts, wait ordering, `READ COMMITTED` predicate rechecks, or partial-index behavior.

### Use case/controller and authorization
Extend `apps/api/test/property-engagements.use-cases.spec.ts` and the property-engagement e2e seam for:

- eligible active same-tenant exact `AGENT` success;
- inactive user, inactive membership, `MANAGER`/`PRINCIPAL_MANAGER`, stale assignment, and cross-tenant candidate all returning the same 400 code;
- omitted/malformed precondition validation;
- 403 through existing permission guard and tenant-safe 404;
- stale expected id returning 409 without changing current primary;
- list/detail response no-primary and one-primary shapes;
- non-primary assigned seller retaining existing any-assignee reads.

Use existing local `makeRepository`/record helpers and property-agent seed builders; add `isPrimary: false` defaults to property response fixtures only. Do not rewrite unrelated dashboard/activity fixtures because their type remains `ProductAgent`.

### Owner portal
Update `apps/api/test/owner-portal.repository.spec.ts` and `owner-portal.use-cases.spec.ts` to replace oldest/tie-break expectations with:

- one filtered primary query for the whole timeline page, regardless of movement count;
- valid active same-tenant `AGENT` primary with usable phone;
- no primary;
- inactive user or membership;
- role mismatch;
- stale/removed assignment;
- unusable/null phone while another seller has a usable phone;
- property-level tenant phone present but not used;
- unchanged response labels/target type and click analytics metadata.

A query-shape assertion should verify the movement query no longer includes assignment arrays and the contact query contains tenant, status, role, and primary filters.

### App New
Extend `property-agents-section.test.tsx` for required primary badges, explicit no-primary state, exact-`AGENT` action gating, set/change/clear payload preconditions, no optimistic badge, successful server response cache state, conflict-triggered refetch, primary removal yielding none, archived/unauthorized controls, and safe error copy.

Add tests adjacent to the two new BFF routes. Keep dashboard/activity type tests unchanged; a compile/typecheck proves their producers remain compatible with base `ProductAgent`.

## Migration, rollout, and rollback

### Rollout order
1. Deploy the additive column and partial unique index. Existing rows are all false and require no backfill.
2. Deploy backend response support and primary write endpoints, including concurrency and tenant-isolation tests. Old clients ignore the additive `agents[].isPrimary` field.
3. Deploy owner contact read change only after the schema is present. From that point, existing engagements intentionally produce unavailable movement contact until a primary is selected.
4. Deploy App New BFF/service/UI controls.
5. Observe catalogued 400/409 rates and owner-contact availability aggregates without logging ids, membership details, or phone values.

The behavior change from oldest assignment to fail-closed contact is intentional. It should not be deployed before the schema-aware backend, and no temporary fallback is permitted during rollout.

### Rollback
- First disable/remove UI controls and write endpoints while retaining the column and index.
- Keep owner movement contact fail-closed; do not restore oldest-assignment resolution as an application rollback.
- Retain stored flags through application rollback so a later redeploy recovers manager intent.
- Drop the index and column only in a separately reviewed migration after writes are disabled and retained designations are explicitly declared disposable.
- If schema removal is ultimately required, deploy code that does not read the column first, then drop index and column. No reverse backfill is performed.

## Observability and operational safety

- Expected 400/409 outcomes are client errors and should not be captured as server exceptions by the existing filter.
- Metrics may count `PRIMARY_AGENT_CANDIDATE_INVALID`, `PRIMARY_AGENT_STATE_CONFLICT`, primary set/clear success, and owner contact available/unavailable by reason category, but labels must be bounded and contain no ids or phones.
- Unexpected uniqueness violations are translated to the conflict code and may increment a bounded invariant-backstop counter; do not log Prisma payloads.
- Preserve `x-request-id` through BFF routes so support can correlate failures without exposing internal state to the UI.

## Compatibility and risk controls

| Risk | Control |
|---|---|
| Partial unique index is absent from Prisma's declarative constraints | Named raw migration, adjacent schema comment, migration test/direct index assertion, and P2002 mapping by constraint name. |
| Application checks race with removal or another set | Shared engagement row lock plus required compare-and-set precondition. |
| Eligibility changes races with selection | Fixed-order `FOR NO KEY UPDATE` locks on assignment, user, and membership serialize deletion/status/role changes through the selection commit; full read-time revalidation fails closed after a later invalidation commits. |
| Cross-tenant identifiers disclose state | Tenant predicates at engagement and candidate queries and one generic invalid-candidate code. |
| UI reports a losing requested seller | No optimistic primary edits; success installs server response; conflicts refetch before rendering resolution. |
| Owner timeline grows with movement count | One engagement-level primary query, not nested assignment data per movement. |
| Shared `ProductAgent` change breaks dashboard/activity producers | New required subtype only for property engagement responses. |
| Old clients encounter additive response fields | JSON field is additive and old clients ignore it; write endpoints are new. |
| Removal silently promotes another seller | Primary is a flag on the removed row; deletion leaves all remaining rows false. |

## Alternatives rejected

### Nullable `primaryAgentId` on `PropertyEngagement`
A foreign key to `PropertyAgent.id` appears direct, but PostgreSQL cannot express through that simple FK that the assignment belongs to the same engagement/tenant. It also requires explicit clearing before assignment deletion and introduces two sources of assignment truth. The row flag keeps designation and assignment lifecycle together; the partial unique index supplies the missing cardinality constraint.

### Separate `PropertyPrimaryAgent` table
A one-row table could enforce one primary per engagement, but it is a parallel assignment model with duplicated tenant/engagement/agent relationships and more lifecycle joins. It violates the requested extension of existing `PropertyAgent` assignments without adding useful history requirements.

### Application-only `updateMany(false)` then `update(true)`
Without a partial unique index and shared lock, concurrent transactions can leave two winners or overwrite one another while both report success. Database enforcement and compare-and-set are required.

### Last-write-wins under only a row lock
A row lock preserves at-most-one but lets both same-baseline requests succeed sequentially, so the first client's success can immediately contradict the durable race winner. The expected-primary precondition gives the loser a stable conflict and forces authoritative refresh.

### Auto-clearing on user or membership invalidation
This couples team lifecycle writes to every engagement and erases manager intent. Read-time validation already prevents exposure, while no automatic replacement is allowed. Only assignment deletion removes the designation because the designation is that assignment row.

### Oldest or first valid assignment fallback
Any fallback silently transfers owner-facing responsibility and reproduces the current defect. No-primary and invalid-primary states remain unavailable by design.

### Primary field required on shared `ProductAgent`
Dashboard and activity APIs independently produce `ProductAgent` values and are not part of primary management. A scoped property-assignment subtype gives strict typing where guaranteed without forcing unrelated producers to fabricate state.

## Review decomposition constraint

Implementation should be split along the database/repository, API contract, owner-read, BFF/service, and UI/test seams above so each review unit remains under the 400 changed-line budget. This document intentionally does not assign exact tasks, PR count, or line forecasts; `sdd-tasks` owns that plan.
