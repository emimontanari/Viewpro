# Exploration — Seller Property Proposals (#306)

## Exploration frame

- **Change:** `seller-property-proposals`
- **Issue:** approved feature #306, `feat(properties): permitir propuestas de vendedores con aprobación`
- **Baseline:** branch `docs/property-proposals-plan` points to `02cd0bb88fac8186eb448bbb70827144a939269c`, matching the supplied base.
- **Mode/store:** read-only exploration, OpenSpec artifact store, strict TDD required for later source work, `ask-on-risk`, 400 changed-line review budget.
- **Product states fixed for V1:** `BORRADOR`, `EN_REVISION` (UI copy may render `EN_REVISIÓN`), `APROBADA`, `RECHAZADA`.
- **Fixed authority:** sellers draft/edit/submit only inside their tenant; authorized account managers review/reject/approve; seller self-approval and API bypass are forbidden; approval creates exactly one canonical property with attribution/audit; rejected proposals can be edited and resubmitted; manager direct property creation remains unchanged; #304 does not authorize automatic primary assignment.
- No tests, provider access, Git/GitHub mutation, or source edits were performed.

## Current domain shape

### Canonical property is a two-record aggregate

`viewpro-app/apps/api/prisma/schema.prisma` separates:

- `PropertyAsset`: physical and owner-reference fields (`title`, address, type, areas, rooms, `ownerName`, `ownerEmail`) plus `createdByUserId`. It has **no `tenantId`** and is class-B/relationally scoped.
- `PropertyEngagement`: tenant/commercial lifecycle (`tenantId`, `propertyAssetId`, operation, price, currency, `PropertyEngagementStatus`, creator, archive data).
- `PropertyAgent`: same-tenant seller assignments, including optional `isPrimary`.
- Owner links, images, movements, documents, notifications, and status-change requests hang from the canonical asset or engagement.

`PropertyEngagementStatus` is the operational lifecycle (`CAPTURE` through `CLOSED`/`CANCELLED`). It is not an approval lifecycle and none of the four proposal states exists today.

### Existing manager creation flow

Actual symbols and path:

1. `PropertyEngagementsController.create()` at `apps/api/src/property-engagements/property-engagements.controller.ts` exposes `POST /property-engagements` and requires `PERMISSIONS.ENGAGEMENTS_CREATE`.
2. `ROLE_PERMISSIONS` grants that permission to `MANAGER` and `PRINCIPAL_MANAGER`, not `AGENT`.
3. `CreatePropertyEngagementDto` requires the canonical minimum fields immediately and validates the full create payload.
4. `CreatePropertyEngagementUseCase.execute()` maps the DTO to `createWithAsset()`.
5. `PrismaPropertyEngagementsRepository.createWithAsset()` locks/checks tenant active-engagement capacity, then creates one `PropertyAsset` and one `PropertyEngagement` atomically. The engagement defaults to `CAPTURE`; no seller assignment is created.
6. `mapPropertyEngagement()` returns the complete canonical aggregate.

The direct manager route is therefore already cleanly permission-bound and can remain unchanged. `apps/api/test/property-engagements.e2e-spec.ts` proves manager creation, atomic asset/engagement creation, quota enforcement, missing-tenant rejection, cross-tenant not-found behavior, manager updates, assigned-only seller lists, and explicit rejection of direct creation by an agent.

### Canonical update and visibility

- `UpdatePropertyEngagementUseCase` and `PrismaPropertyEngagementsRepository.updateForTenant()` update asset and engagement fields in one transaction after a tenant/visibility lookup.
- Managers use `ENGAGEMENTS_VIEW_ALL`; agents use `ENGAGEMENTS_VIEW_ASSIGNED`.
- `buildTenantVisibilityWhere()` always adds `tenantId`; when `canViewAll` is false it additionally requires a matching `PropertyAgent` assignment.
- Sellers therefore cannot see a canonical engagement merely because they created some data. They see it only if assigned.
- Manager-facing list/detail/update surfaces currently treat every returned engagement as canonical and operational.

### Tenant and permission boundaries

- `TenantMembershipGuard` resolves `x-tenant-id` against an active membership and active user, rejects suspended/cancelled tenants, and installs the trusted tenant in request-local storage.
- `PermissionGuard` enforces controller metadata from `@RequirePermissions`.
- `TENANT_OWNED_MODELS` in `database/tenant-isolation.extension.ts` registers every class-A Prisma model with a direct `tenantId`; its tests compare the registry to the schema. A new tenant-owned proposal model must be registered or the isolation registry gate should fail.
- `PropertyAsset` is intentionally excluded because it lacks `tenantId`. Using a bare asset as proposal staging would lose the direct class-A tenant backstop and force all isolation through relationships that do not yet exist.
- Tenant-scoped reads conventionally return not-found/no rows for cross-tenant records rather than disclose existence.

## Reusable approval workflow pattern

`apps/api/src/status-change-requests/` is the closest reusable pattern, but not a reusable data model.

Reusable behavior and symbols:

- Separate durable request model with `tenantId`, requester, state snapshot, resolver, resolution comment, timestamps, and a raw-SQL partial unique invariant.
- `StatusChangeRequestsController` separates seller submission/history, manager inbox, and manager approve/reject commands.
- `CreateStatusChangeRequestUseCase` verifies seller assignment server-side, handles duplicate pending requests, and notifies active `MANAGER`/`PRINCIPAL_MANAGER` members excluding the requester.
- `ApproveStatusChangeRequestUseCase` locks the request row with `FOR UPDATE`, scopes the lock by tenant, checks identity-based self-approval, detects already-resolved/stale state, performs all canonical mutations in one transaction, then runs best-effort analytics/notifications.
- `RejectStatusChangeRequestUseCase` uses the same lock and identity checks, requires a comment, mutates no canonical engagement, and notifies after commit.
- `status-change-requests.e2e-spec.ts` already demonstrates the desired test vocabulary: normal submit/approve/reject, required rejection comment, duplicate pending request, dual-role self-approval, stale state, concurrent approval, cross-tenant access, missing membership, and notification failure isolation.

Limits of reuse:

- `StatusChangeRequestStatus` has only `PENDING`/`RESOLVED`, cannot represent draft/edit/reject/resubmit, and points to an already-canonical engagement.
- Its approval changes one field on an existing engagement; #306 approval must materialize an asset/engagement exactly once.
- Its seller eligibility is assignment-based. A property proposal exists before any canonical engagement or assignment, so proposal ownership must be based on stored proposer identity plus active same-tenant seller membership, not `PropertyAgent`.
- Existing logger calls are operational logs, not a complete durable approval audit by themselves.

## Staging decision: canonical state cannot safely represent a transient proposal

A proposal requires **separate durable staging**. Reusing `PropertyAsset`, `PropertyEngagement`, or `CAPTURE` as the draft/review state is unsafe for these concrete reasons:

1. **Semantic mismatch:** `CAPTURE` is the first canonical business stage, while the four fixed proposal states are an approval state machine. Adding proposal values to `PropertyEngagementStatus` would mix two independent lifecycles across status filters, movements, status-change requests, UI labels, and analytics.
2. **Premature canonical creation:** the fixed outcome says approval yields exactly one canonical property. Creating asset/engagement rows at draft time means approval no longer creates the canonical aggregate and makes rejected drafts canonical records.
3. **Visibility leakage:** any draft engagement would enter manager `ENGAGEMENTS_VIEW_ALL` lists immediately. If assigned to the proposer to make it seller-visible, it would also enter existing seller property lists and downstream movement/document/status-change surfaces before approval.
4. **Authorization bypass:** existing manager canonical endpoints can update, archive/restore, assign sellers, link owners, upload images, and create related operational data. Hiding a draft in App New would not stop those API paths.
5. **Quota distortion:** `createWithAsset()` counts every unarchived non-closed engagement against `maxActivePropertyEngagements`. Drafts and rejected proposals should not consume canonical active-property capacity unless product explicitly decides otherwise.
6. **Owner exposure risk:** `PropertyAssetOwner` active access drives owner property visibility, and owner engagement queries do not filter on a proposal concept. Linking an owner to a staged canonical asset could expose unapproved data.
7. **Tenant safety:** a bare `PropertyAsset` has no direct tenant key and is excluded from the isolation extension. It is a poor proposal root.
8. **Exactly-once concurrency:** approval needs a locked proposal and a durable link to the single created canonical aggregate. The current canonical models have no proposal identity or approval idempotency invariant.
9. **Audit preservation:** rejected/editable/resubmitted history and proposer/reviewer attribution cannot be reconstructed reliably from mutable canonical fields and process logs.

The exploration does not prescribe table layout, but the proposal must be a tenant-owned durable aggregate with its own state, proposer/reviewer audit, editable staged property data, and an approval result link. Approval should be the sole transaction that checks the still-reviewable state, enforces canonical quota, creates one asset and one engagement, records the canonical identity, and marks the proposal approved. A database-level uniqueness/idempotency invariant and row lock are warranted because application checks alone cannot guarantee “exactly one” under concurrent approvals.

## App New and BFF surface

### Current property UI

- `features/products/api/types.ts` owns handwritten canonical property contracts; `@viewpro/contracts` is not generated and currently only exports the public error catalog.
- `features/products/api/service.ts` calls same-origin `/api/products`; BFF routes proxy to Nest `/property-engagements`.
- `features/products/schemas/product.ts`, `product-form-mappers.ts`, and `product-form.tsx` implement full canonical create/edit validation and orchestration, including post-create image uploads.
- `ProductPageHeaderAction`, product table mobile/empty CTAs, and dashboard homepage show “Nueva propiedad” only when `canManagePropertyEngagements()` sees `engagements.create`.
- `ProductViewPage` routes `productId === 'new'` to canonical create; direct route rendering also fails closed in `ProductForm` for agents.
- Existing seeded tests explicitly assert that sellers have no “Nueva propiedad” CTA and no edit/status controls.

The seller proposal entry therefore cannot simply grant `ENGAGEMENTS_CREATE` or reuse `/dashboard/product/new`: doing so would authorize direct canonical creation and expose manager controls. It needs a separately named permission/capability and proposal-specific route/service/BFF/query/UI boundaries. Shared field presentation/mappers may be reusable only after proposal validation semantics are fixed; the canonical submit mutation must remain unchanged for managers.

### Existing review inbox pattern

`features/status-change-requests/` provides reusable UI organization:

- typed service and query keys;
- tenant manager inbox;
- pending rows with approve/reject actions;
- route-level navigation protected by `engagements.view_all`;
- invalidation/rollback after mutations.

It should inform, not absorb, the proposal UI. Proposal reviewers need proposal-specific fields, fixed V1 state labels, detail/compare/rejection context, and canonical approval result. The existing inbox currently displays requester IDs rather than resolved names, a weakness not worth copying.

### Navigation

`config/nav-config.ts` plus `lib/navigation-access.ts` is the canonical fail-closed Sidebar/KBar policy. `seller-navigation-scope` requires exact rendered navigation parity for AGENT, MANAGER, PRINCIPAL_MANAGER, and loading states. A new proposal destination or review inbox changes that exact matrix and must update the consolidated capability spec and both navigation consumers/tests together. A product-page-local seller CTA could reduce navigation expansion, but the intended discoverability remains a product decision.

## Owner and canonical-list impact

- Owner property visibility is rooted in active `PropertyAssetOwner` links via `activeOwnerAccess()`.
- `PrismaOwnerPortalRepository.findEngagementsForOwnerProperty()` returns all engagements for an owner-visible asset and owner-home specs require one card per owner-visible canonical engagement.
- Separate staging with no owner link and no canonical engagement naturally keeps proposals out of owner surfaces.
- On approval, creating the canonical asset/engagement does not itself create an active owner account link. The existing `ownerName`/`ownerEmail` fields are references only; `PropertyAssetOwner` and invitation flows are separate manager actions.
- Proposal approval must not silently create owner access unless explicitly decided, because that would add invitation, notification, and owner visibility behavior beyond the stated issue.

Approved proposals should enter existing canonical manager lists exactly as normal newly created engagements. Whether the proposer then sees the approved canonical property depends on the unresolved ordinary-assignment decision below. The `property-primary-seller` spec is explicit that no assignment may infer or auto-select a primary; #304 supplies no authority for automatic primary assignment.

## Model and contract conflicts to account for

1. Current canonical DTOs require title/address/city/province/type/operation at create time; `BORRADOR` likely needs weaker validation than approval/submit.
2. `PropertyAsset` has no tenant id, while proposal ownership must be direct and tenant-safe.
3. `PropertyEngagementStatus` cannot carry proposal states without lifecycle contamination.
4. `StatusChangeRequestStatus` cannot carry the four fixed states or edit/resubmit history.
5. `ENGAGEMENTS_CREATE` is deliberately manager-only; giving it to sellers violates the no-bypass constraint.
6. Existing property responses expose no proposal attribution or source link.
7. Active-property quota is enforced only inside canonical `createWithAsset()` and restore. Approval must use equivalent serialized enforcement; drafts must not bypass or pre-consume it accidentally.
8. The public error contract is append-only in `packages/contracts/src/index.ts` with exact-order/count tests. Stable proposal errors would require coordinated contract work.
9. Isolation registry tests require every new direct-tenant model to be classified.
10. Existing analytics/notification enums have status-change events but no proposal events; adding product events is optional only if the product decision requires them.
11. Image upload currently requires a canonical engagement and asset, so images cannot accompany a proposal without a distinct staging/storage lifecycle.
12. Current BFF/type contracts are handwritten and product-named legacy adapters; proposal work should not expand the naming migration scope.

## Confirmed V1 decisions

1. **Draft completeness:** a title is required to save; the six canonical fields are required to submit.
2. **Rejection reason:** every rejection requires a non-empty reason of at most 1000 characters, retained and visible in history.
3. **Revision history:** each proposal remains one editable aggregate, with an immutable review-round snapshot created for every submission.
4. **Editability by state:** `BORRADOR` and `RECHAZADA` are editable; `EN_REVISION` and `APROBADA` are locked; V1 has no withdrawal or deletion.
5. **Review authority:** exactly `MANAGER` and `PRINCIPAL_MANAGER` review under a new proposal-specific permission.
6. **Proposal visibility:** sellers see only their own proposals; managers may see proposals in every state.
7. **Review ordering/filtering:** the default inbox is `EN_REVISION`, newest first, with state and history filters but no search.
8. **Resubmission semantics:** after editing a rejected proposal, the seller must explicitly resubmit; that submission creates the next immutable round while retaining all prior rounds, reviewers, and reasons.
9. **Approval attribution:** the proposing seller is `createdBy` on both canonical asset and engagement; the approving manager remains the durable reviewer.
10. **Ordinary seller assignment after approval:** approval creates an ordinary `PropertyAgent` assignment for the proposer with the reviewer as `assignedBy` and `isPrimary=false`.
11. **Canonical initial state:** an approved proposal materializes its canonical engagement in `CAPTURE`.
12. **Quota failure:** a failed approval caused by active-property quota leaves the proposal in `EN_REVISION` for retry.
13. **Images:** proposal images and image promotion are excluded from V1.
14. **Owner data/access:** optional owner name/email remain references only; owner linking and invitation are excluded from V1.
15. **Duplicate proposals:** duplicate address/title proposals are allowed; exactly-once behavior is keyed by proposal identity.
16. **Notifications and analytics:** both are excluded from V1.
17. **Approved-result navigation:** approved proposal detail may link to the canonical property because the proposer is assigned on approval.
18. **API idempotency:** repeating the same command in the same state returns the idempotent current result; a competing transition returns a stable `409`.
19. **Localization contract:** persist enum symbol `EN_REVISION` and render UI label `EN_REVISIÓN`.
20. **Direct-manager separation:** managers continue using direct canonical creation and do not draft proposals in V1.

Optional research was not selected. All V1 decision slots are resolved and the proposal gate is ready.

## Test seams and evidence forecast

Strict TDD should begin with focused failures at each behavior boundary rather than one late E2E suite.

### API/database

- Schema/migration tests: four-state enum, direct `tenantId`, requester/reviewer/canonical foreign keys, approval uniqueness/idempotency, indexes, and isolation-registry classification.
- Repository tests: own-tenant seller reads/writes, manager inbox scope, state-conditioned updates/transitions, durable audit, rejection/resubmission, and no canonical writes before approval.
- Use-case tests: active exact seller membership, authorized reviewer roles/permission, identity-based self-approval even under role changes, forbidden transitions, required validation, and quota failure preservation.
- Transaction/concurrency tests against test Postgres: concurrent approvals create exactly one asset and one engagement; losing action returns the chosen stable outcome; rejection/approval races do not partially materialize.
- E2E: missing tenant, wrong tenant, seller reads another seller proposal, seller calls approval, manager direct create regression, API bypass attempts, canonical owner/list invisibility before approval, and approved canonical visibility after approval.
- Side effects, if selected: notification failure must not roll back committed transitions; proposal events must not leak tenant/user data.

### App New/BFF

- Route proxy tests for every proposal read/mutation and exact backend method/path/body/error forwarding.
- Schema/form tests for draft-vs-submit validation and rejected edit/resubmit behavior.
- Seller UI tests for own-state rendering, no review actions, and no accidental canonical create call.
- Manager inbox/detail tests for review permissions, loading/empty/error states, rejection reason, disabled in-flight actions, and authoritative refresh after conflicts.
- Navigation parity tests if destinations are added.
- Seeded E2E with at least seller draft → submit → manager review → approve → exactly one canonical property, plus reject → edit → resubmit. Preserve existing assertions that sellers lack the canonical “Nueva propiedad” action.

No tests were run during this exploration because the delegated task explicitly prohibited running tests.

## Implementation domains and review-sized slices

This feature crosses enough durable boundaries that one honest PR is very unlikely to fit the 400-line budget. The forecast is intentionally behavioral rather than file-by-file design:

1. **Durable proposal state and isolation** — Prisma model/migration, tenant registry classification, schema invariants, and database-focused tests.
2. **Seller proposal lifecycle API** — create draft, own list/detail, edit, submit/resubmit, validation, authorization, and focused tests.
3. **Manager review API** — tenant inbox/detail, reject, self-review prevention, state/race handling, and focused tests.
4. **Atomic approval materialization** — canonical asset/engagement creation, quota enforcement, attribution, exactly-once concurrency evidence, and direct-manager regression.
5. **Public contracts/BFF** — stable public errors if required, App New types/services/query keys, BFF routes, and proxy tests.
6. **Seller UI** — proposal entry/list/form/detail/state feedback with draft and rejected resubmission tests.
7. **Manager UI** — inbox/detail/reject/approve behavior and permission/navigation tests.
8. **End-to-end proof and selected side effects** — seeded flows, notifications/analytics only if explicitly in scope, and consolidated capability-spec synchronization in the same user-visible work unit where practical.

These slices are candidates, not a code design. Tasks should re-estimate after the product decisions. Risk is **high** because schema, authorization, concurrency, canonical creation, two role surfaces, and seeded E2E all change. Under `ask-on-risk`, the later task forecast should ask before selecting a multi-PR chain; forcing this into one 400-line review would hide necessary tests rather than reduce scope.

## Related-session check (#134)

Repository evidence shows the separate worktree `/Users/emimontanari/Work/Apps/Viewpro-worktrees/mvp-evidence-audit-readonly` is detached at the same baseline `02cd0bb88fac8186eb448bbb70827144a939269c`. Its declared worktree purpose is read-only MVP evidence audit, and its visible areas are existing plans/OpenSpec evidence rather than a `seller-property-proposals` change or proposal/property source branch. No `#134` or seller-proposal artifact/symbol occurs in that worktree or this baseline search. On the available repository evidence, the #134 session is read-only and has no product overlap with #306; process activity itself was not mutated or introspected beyond worktree metadata.

## Readiness

Exploration is complete and ready for proposal. All 20 V1 product decisions are confirmed; optional research was not selected. The architectural conclusion remains firm: unapproved proposals require separate tenant-owned durable staging, and only approval may create the canonical property aggregate.
