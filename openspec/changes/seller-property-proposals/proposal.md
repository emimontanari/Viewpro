# Proposal: Seller Property Proposals

## Decision

Introduce a separate, tenant-owned property-proposal workflow for sellers. Sellers can stage, edit, and submit their own proposals without receiving permission to create canonical properties directly. An authorized manager reviews each immutable submission round and may reject it with a reason or approve it. Approval is the only proposal transition that materializes a canonical property, and it must create exactly one canonical property aggregate.

Managers continue to create canonical properties directly through the existing manager flow. Proposal approval creates the canonical engagement in `CAPTURE`, attributes canonical creation to the proposing seller, records the approving manager as reviewer, and assigns the proposer as an ordinary non-primary seller with the reviewer as assigner.

## Problem and Current-State Gap

ViewPro currently has no safe workflow for a seller to suggest a new property for manager approval:

- Sellers cannot use the canonical property-create capability, and granting it would bypass review.
- Canonical property state cannot safely represent an unapproved draft without exposing it to operational property workflows, quota accounting, owner-related surfaces, and manager canonical lists.
- The existing status-change request workflow applies to an already-canonical engagement and cannot represent editable drafts, repeated immutable review rounds, or approval that creates a canonical aggregate.
- A seller-created staging record needs direct tenant ownership and proposer ownership before any canonical engagement or seller assignment exists.
- Existing canonical models do not provide the proposal identity, review history, or concurrency guarantees needed to prove that approval creates exactly one property.

Without a dedicated capability, sellers must communicate proposals outside the product or managers must re-enter them manually, making review status, attribution, rejection feedback, resubmission history, and approval outcomes difficult to track consistently.

## Intent and Product Outcome

Give sellers a clear in-product path to prepare and submit property proposals while preserving manager control over canonical inventory. After this change:

1. a seller can save and revisit an incomplete proposal once it has a title;
2. the seller can submit only when the six canonical submission fields are complete;
3. each submission creates an immutable review-round snapshot;
4. either manager role can review tenant proposals without being able to approve their own proposal;
5. rejection returns a durable, bounded explanation and allows an explicit edit-and-resubmit cycle;
6. approval atomically creates one canonical property, leaves a durable link to that result, and gives the proposer ordinary assigned access; and
7. managers retain their current direct canonical creation workflow without being routed through proposals.

The experience must keep the proposal lifecycle distinct from the canonical property lifecycle. Persisted state uses `BORRADOR`, `EN_REVISION`, `APROBADA`, and `RECHAZADA`; the UI localizes `EN_REVISION` as `EN_REVISIÓN`.

## V1 Product Rules

### Ownership, roles, and visibility

- A proposal is directly owned by one tenant and one proposing seller.
- Sellers can create, list, view, edit, submit, and resubmit only their own proposals in the active tenant.
- `MANAGER` and `PRINCIPAL_MANAGER` can review proposals in their active tenant through a new proposal-specific review permission.
- Managers can see proposals in every state; seller ownership does not broaden to team-wide visibility.
- Authorization is enforced server-side. UI hiding is not an authorization boundary.
- A user may never approve or reject their own proposal, including if their role or memberships change after proposing.
- Cross-tenant records must not be disclosed through reads, commands, errors, review history, canonical result links, or filters.

### Drafting and submission

- A non-empty title is the minimum required to save a proposal.
- Submission requires the six canonical fields: title, address, city, province, property type, and operation.
- Optional owner name and owner email are reference data only.
- Duplicate titles and addresses are allowed; proposal identity, not field similarity, defines uniqueness and idempotency.
- `BORRADOR` and `RECHAZADA` proposals are editable.
- `EN_REVISION` and `APROBADA` proposals are locked.
- Editing a rejected proposal does not resubmit it. The seller must issue an explicit resubmit command.
- V1 has no proposal withdrawal or deletion.

### Review rounds and rejection

- Every submit or resubmit creates a new immutable review-round snapshot of the submitted proposal data.
- Prior rounds, reviewers, outcomes, and rejection reasons remain durable and visible in history.
- Rejection requires a non-empty reason no longer than 1000 characters.
- Rejection does not create or mutate a canonical property.
- A rejected proposal returns to an editable lifecycle while retaining the rejected round as immutable history.

### Manager inbox

- The manager inbox defaults to `EN_REVISION`, ordered newest first.
- Managers can filter by proposal state and review history.
- V1 provides no proposal search.
- Manager proposal review is separate from direct manager canonical property creation; managers do not create proposal drafts in V1.

### Approval and canonical materialization

- Approval is the sole proposal operation that creates the canonical property aggregate.
- Approval creates exactly one canonical property asset and exactly one canonical engagement for the proposal.
- The canonical engagement begins in `CAPTURE`.
- The proposing seller is the canonical creator for both the asset and engagement; the approving manager remains the durable proposal reviewer.
- Approval creates an ordinary seller assignment for the proposer, with the approving reviewer recorded as assigner and `isPrimary=false`.
- This assignment must preserve issue #304 semantics: no primary seller is inferred, selected, promoted, or backfilled.
- The approved proposal retains a durable result reference so its detail can link to the canonical property.
- Proposal drafts and reviews do not consume active-property quota. Approval enforces the canonical active-property quota in the same protected transaction as materialization.
- A quota failure creates no partial canonical records and leaves the proposal in `EN_REVISION` for a later retry.
- Optional owner references do not create an owner link, invitation, account access, or owner-visible proposal.

### Commands, races, and idempotency

- Replaying the same command after that command has already produced the current state returns the idempotent current result rather than duplicating work.
- A competing transition against the same reviewable state returns a stable `409` conflict.
- Concurrent approval attempts must still produce at most one canonical asset, one canonical engagement, and one proposal result link.
- Approval, canonical creation, assignment, reviewer attribution, and proposal transition succeed or fail as one atomic business operation.

## Scope

### Proposal lifecycle

- Tenant-safe seller draft creation with title-minimum validation.
- Seller own-only list, detail, editing, submission, rejected revision, and explicit resubmission.
- Four-state lifecycle with state-conditioned edit and command rules.
- Immutable review-round history for every submit or resubmit.

### Manager review

- Tenant manager inbox and proposal detail for both manager roles.
- Default pending/newest ordering plus state and history filters.
- Approval and rejection under proposal-specific authorization.
- Required rejection reasons, durable reviewer attribution, self-review prevention, idempotent replays, and stable transition conflicts.

### Canonical integration

- Atomic approval materialization into the existing canonical property aggregate.
- Canonical `CAPTURE` initial state, seller creator attribution, approval-result linkage, and a non-primary ordinary assignment for the proposer.
- Existing active-property quota enforcement at approval time without charging draft or rejected proposals.
- Approved canonical properties participate in existing property behavior as ordinary canonical records after materialization.

### App New experience

- Proposal-specific seller entry, list, form, detail, lifecycle feedback, rejection context, and approved-result navigation.
- Proposal-specific manager inbox, detail, history, approve, and reject experience.
- Fail-closed capability and route behavior that never exposes direct canonical creation to sellers.
- Localized state labels, including persisted `EN_REVISION` rendered as `EN_REVISIÓN`.

### Verification expectations

- Strict-TDD evidence for tenant isolation, role and ownership boundaries, validation by lifecycle state, immutable rounds, self-review prevention, idempotency, conflicting transitions, quota failure, and exactly-once approval.
- End-to-end evidence for approve and reject/edit/resubmit paths, while preserving the direct-manager path and canonical compatibility.

## Explicit Non-Goals

- No reuse of canonical property records as proposal staging.
- No seller access to direct canonical property creation.
- No manager proposal drafting or replacement of the manager direct-create flow.
- No withdrawal, deletion, or reopening of approved proposals.
- No proposal images, image staging, or image promotion.
- No owner linking, owner invitation, owner-account creation, or owner proposal visibility.
- No notifications or analytics events for proposal actions.
- No proposal search.
- No duplicate-address or duplicate-title prevention.
- No automatic primary seller selection or changes to #304's no-primary behavior.
- No redesign of canonical property naming, broad contract generation, assignment management, owner portal, status-change requests, or unrelated navigation.
- No implementation-level file layout, endpoint design, or database schema design in this proposal; those belong to later SDD phases.

## Affected Capabilities and Areas

### New capability: property proposals

The spec phase should define a dedicated capability for seller-owned proposal staging, immutable review rounds, manager review, rejection/resubmission, and atomic approval materialization.

### Modified capabilities

| Capability or area | Expected impact |
|---|---|
| Property engagements | Approved proposals create ordinary canonical asset/engagement records in `CAPTURE`; direct manager creation remains unchanged. |
| Property seller assignment | Approval adds the proposer as an ordinary non-primary assigned seller; all #304 no-primary rules remain authoritative. |
| Tenant isolation and authorization | Proposal data, history, commands, and result links require direct tenant scoping, own-only seller access, manager review permission, and self-review prevention. |
| Active-property quota | Proposal staging is excluded; approval enforces the existing canonical quota atomically and remains reviewable after quota failure. |
| App New property experience | Separate seller proposal lifecycle and manager review surfaces are introduced without exposing canonical manager controls to sellers. |
| Navigation and capability policy | Any proposal destinations must preserve fail-closed role parity and must not broaden canonical create permissions. |
| Public errors and conflicts | Validation, authorization, quota, replay, and competing-transition outcomes require stable safe behavior, including `409` for competing transitions. |
| Canonical compatibility verification | Proposal verification must leave no tenant-limit configuration or temporary state that affects later canonical behavior. |

## Protected Invariants and Compatibility Boundaries

### Tenant isolation

Every proposal, review round, reviewer action, list, filter, and canonical result lookup must remain scoped to the active tenant. Seller ownership checks are additional to tenant scoping, not a substitute for it. Cross-tenant access must fail closed and must not reveal record existence. Canonical materialization may reference only identities and data valid for the proposal's tenant.

### Self-approval prevention

The proposer cannot review their own proposal by acquiring or already holding a manager-capable role. Review authorization must combine proposal-specific permission with an identity check against the durable proposer.

### Exactly-once canonical creation

An approved proposal must map to one and only one canonical aggregate. Retries and concurrent approvals cannot create duplicate assets, engagements, assignments, or result links. No canonical writes occur before approval, and failed approval leaves no partial canonical state.

### Direct-manager path

The existing manager-only canonical property creation path remains available and behaviorally unchanged. This feature neither routes managers through proposal staging nor grants its canonical-create authority to sellers.

### #304 no-primary semantics

The seller assignment created during approval is explicitly non-primary. Approval cannot infer a primary seller from proposer identity, sole assignment, assignment order, or any other condition, and it cannot displace an existing explicit primary designation.

### Canonical compatibility

Staged and rejected proposals never enter canonical property lists or consume canonical active-property quota. Approved materialization appears as an ordinary canonical record and preserves existing manager, seller, and owner visibility rules. Proposal tests and operations must leave no tenant-limit configuration or temporary state that affects later canonical behavior.

## Risks and Tradeoffs

| Risk or tradeoff | Product impact | Required control |
|---|---|---|
| Proposal data leaks across tenants or sellers | Confidential property and owner-reference data is disclosed. | Direct tenant ownership, own-only seller predicates, manager tenant scoping, fail-closed errors, and cross-tenant verification. |
| A proposer with manager authority reviews their own proposal | Approval control becomes cosmetic and audit integrity is lost. | Durable proposer identity comparison on every review command. |
| Approval retries or races duplicate canonical records | Inventory, quota, attribution, and downstream workflows become inconsistent. | Atomic transition, locked/serialized review state, durable uniqueness/idempotency, and concurrency evidence. |
| Drafts reuse canonical records | Unapproved data enters canonical lists, owner-related paths, quotas, and operational actions. | Keep staging separate and create canonical records only on approval. |
| Quota is checked outside approval or consumes drafts | Approval can overrun capacity or sellers can exhaust capacity with drafts. | Enforce quota inside approval materialization; leave quota-blocked proposals in review. |
| Rejected edits overwrite review evidence | Managers and sellers cannot explain prior decisions. | Immutable snapshot per submission and retained rejection/reviewer history. |
| Proposal permission broadens canonical creation | Sellers bypass manager approval. | Separate proposal capabilities and preserve manager-only direct creation. |
| Automatic primary assignment slips into approval | The feature conflicts with #304 and changes owner-contact responsibility implicitly. | Create only `isPrimary=false` assignment and verify no inference or promotion. |
| Approved proposer cannot find the result | Workflow appears to end without an actionable property. | Create ordinary assignment on approval and expose the durable canonical result from proposal detail. |
| Proposal verification leaves configuration or temporary state behind | Later canonical behavior becomes inconsistent. | Ensure subsequent canonical behavior sees unchanged tenant-limit configuration and no proposal-created temporary state. |
| Cross-cutting delivery is forced into one oversized review | Security, data, concurrency, and UI defects become harder to review. | Plan cohesive work-unit slices and let the task forecast decide delivery topology under `ask-on-risk`. |

## Rollout and Rollback

Rollout should enable durable proposal state and tenant safeguards before exposing seller or manager UI. Seller submission, manager review, and approval materialization should be enabled only after authorization, immutable-history, conflict, quota, and exactly-once behavior are verified. Existing direct manager creation remains available throughout rollout.

If rollback is required, first disable proposal entry and review actions while leaving direct manager creation untouched. Preserve existing proposal records, immutable review history, and links to already-created canonical properties; an application rollback must not delete canonical properties produced by valid approvals or detach their ordinary seller assignments. Any later removal of proposal persistence must be a separate, reviewed, data-safe operation. Rollback must not restore a path that lets sellers create canonical properties directly, weaken tenant isolation, infer a primary seller, or leave tenant-limit configuration or temporary state that affects later canonical behavior.

## High-Level Delivery Expectation

This change is expected to require multiple cohesive behavioral slices. The later task forecast, not this proposal, will decide whether those slices become one or several PRs under the 400 changed-line budget and `ask-on-risk` strategy.

Candidate slices are:

1. **Durable proposal lifecycle and isolation** — proposal states, tenant ownership, immutable review-round semantics, and isolation evidence.
2. **Seller proposal workflow** — draft, own-only reads, edit, submit/resubmit, lifecycle validation, and focused tests.
3. **Manager review workflow** — inbox/detail, permissions, self-review prevention, reject, replay/conflict behavior, and focused tests.
4. **Atomic canonical approval** — quota-safe exactly-once materialization, attribution, non-primary assignment, canonical result link, and direct-manager regression proof.
5. **Application contracts and boundaries** — stable BFF/public outcomes and proposal-specific capability enforcement.
6. **Seller experience** — proposal entry, list, form, detail, state/history feedback, and approved navigation.
7. **Manager experience** — pending-first inbox, filters, detail/history, approve/reject interactions, and fail-closed access.
8. **End-to-end integration proof** — approve and reject/edit/resubmit journeys, tenant/security regressions, and canonical compatibility verification.

Slices must remain independently understandable work units with their verification included. They are not a commitment to a PR count or an implementation design.

## Success Criteria

- [ ] A seller can save an own-tenant proposal with a title and cannot view or mutate another seller's proposal.
- [ ] Submission requires title, address, city, province, property type, and operation; drafts require only title.
- [ ] `BORRADOR` and `RECHAZADA` are editable, while `EN_REVISION` and `APROBADA` are locked.
- [ ] Every submit or resubmit creates an immutable review-round snapshot and retains all prior reviewers, outcomes, and rejection reasons.
- [ ] Rejection requires a non-empty reason of at most 1000 characters and creates no canonical property.
- [ ] Both `MANAGER` and `PRINCIPAL_MANAGER` can review tenant proposals through proposal-specific authority, and no proposer can approve or reject their own proposal.
- [ ] The manager inbox defaults to `EN_REVISION` newest first and supports state/history filters without search.
- [ ] Approval creates exactly one canonical asset and engagement in `CAPTURE`, even under replay or concurrency.
- [ ] The proposing seller is the canonical creator, the approving manager is retained as reviewer, and the proposal links durably to the canonical result.
- [ ] Approval assigns the proposer as an ordinary seller with the reviewer as assigner and `isPrimary=false`, with no automatic primary inference or promotion.
- [ ] Draft and rejected proposals do not consume active-property quota; quota-blocked approval creates no partial canonical state and leaves the proposal in `EN_REVISION`.
- [ ] Same-command replay returns the current idempotent result, while competing transitions return a stable `409`.
- [ ] Duplicate titles and addresses remain allowed and do not weaken proposal-identity idempotency.
- [ ] Optional owner references create no owner link, invitation, account access, or owner visibility.
- [ ] Seller proposal access never grants direct canonical creation, and manager direct creation behaves exactly as before.
- [ ] Cross-tenant reads and commands fail closed without disclosing proposal existence or result data.
- [ ] Persisted `EN_REVISION` renders to users as localized `EN_REVISIÓN`.
- [ ] No images, notifications, analytics, withdrawal, deletion, search, owner linking, or manager proposal drafting are introduced.
- [ ] Proposal tests and operations leave no tenant-limit configuration or temporary state that affects later canonical behavior.
- [ ] Strict-TDD evidence covers normal flows, failures, authorization bypass attempts, races, quota behavior, direct-manager regression, and canonical compatibility.

## Proposal Decision Status

The approved issue and confirmed exploration resolve the proposal question round. Business purpose, users, permissions, state rules, validation thresholds, review history, inbox behavior, approval attribution, assignment behavior, quota semantics, idempotency, localization, edge cases, and V1 non-goals are fixed. The spec and design phases should encode these decisions rather than reopen alternatives or infer additional scope.
