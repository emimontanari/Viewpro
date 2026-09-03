# Property Proposals Specification

## Purpose

The property-proposals capability gives a tenant's sellers a separate, durable workflow for preparing property proposals and gives authorized tenant managers a controlled review lifecycle. A proposal is not a canonical property until approval succeeds; approval creates the canonical property aggregate exactly once.

## ADDED Requirements

### Requirement: Proposals are tenant-owned and proposer-owned

Every proposal MUST belong to exactly one tenant and one proposing seller, with both identities derived from trusted authenticated context. A seller MUST be an authorized active seller in the active tenant. Seller reads and mutations MUST be limited to that seller's proposals in that tenant. Duplicate field values MUST NOT substitute for proposal identity.

#### Scenario: Seller creates a proposal in the active tenant

- GIVEN an authenticated active seller has an active membership in tenant A
- WHEN the seller saves a proposal with a non-empty title in tenant A
- THEN the proposal is stored for tenant A and that seller
- AND neither tenant nor proposer identity can be selected or overridden by request data

#### Scenario: Seller cannot access another seller's or tenant's proposal

- GIVEN a proposal belongs to seller A in tenant A
- WHEN seller B requests it, or a user requests it through tenant B
- THEN the result fails closed without disclosing proposal existence, fields, history, or canonical result data
- AND no proposal state or data is mutated

#### Scenario: Similar proposals remain distinct

- GIVEN two authorized sellers submit proposals with the same title or address
- WHEN both proposals are saved or submitted
- THEN both remain valid distinct proposals
- AND replay and idempotency are evaluated by proposal identity rather than title or address similarity

### Requirement: The lifecycle has four states with state-conditioned validation

The proposal lifecycle MUST use exactly the persisted states `BORRADOR`, `EN_REVISION`, `APROBADA`, and `RECHAZADA`. A draft MUST require only a non-empty title to be saved. Submission MUST require title, address, city, province, property type, and operation. `BORRADOR` and `RECHAZADA` MUST be editable; `EN_REVISION` and `APROBADA` MUST be locked. V1 MUST provide neither withdrawal nor deletion.

#### Scenario: A titled draft can be saved with incomplete submission data

- GIVEN an authorized seller provides a non-empty title but omits one or more submission fields
- WHEN the seller saves the proposal as a draft
- THEN the proposal is stored in `BORRADOR`
- AND the missing submission fields do not prevent draft persistence

#### Scenario: Submission rejects incomplete canonical fields

- GIVEN a proposal is in `BORRADOR` or `RECHAZADA`
- AND one of title, address, city, province, property type, or operation is missing
- WHEN the seller submits or resubmits it
- THEN the command is rejected with no new review round
- AND the proposal remains in its current editable state

#### Scenario: Editability follows each lifecycle state

- GIVEN proposals exist in `BORRADOR`, `EN_REVISION`, `APROBADA`, and `RECHAZADA`
- WHEN the seller attempts to edit each proposal
- THEN edits succeed only for `BORRADOR` and `RECHAZADA`
- AND edits to `EN_REVISION` and `APROBADA` are rejected without changing stored data

#### Scenario: Withdrawal and deletion are unavailable

- GIVEN a proposal exists in any lifecycle state
- WHEN a seller or manager requests withdrawal or deletion
- THEN the operation is not performed
- AND the proposal and its review history remain durable

### Requirement: Each submission creates immutable review-round history

Every successful submit or resubmit MUST create a new immutable review round containing the submitted proposal data. Prior rounds, reviewers, outcomes, and rejection reasons MUST remain durable and visible to users authorized to view that proposal.

#### Scenario: Initial submission snapshots the submitted data

- GIVEN an editable proposal contains all six required submission fields
- WHEN the seller submits it
- THEN its state becomes `EN_REVISION`
- AND one immutable review round contains the submitted values

#### Scenario: Resubmission retains all prior rounds

- GIVEN a rejected proposal has one or more completed review rounds
- WHEN the seller edits it and explicitly resubmits it
- THEN a new immutable round is created
- AND every prior round, outcome, reviewer, and rejection reason remains unchanged and visible in history

#### Scenario: Later edits cannot rewrite a submitted round

- GIVEN a proposal has a submitted review round
- WHEN an editable later version of the proposal is changed
- THEN the submitted round's snapshot remains byte-for-byte equivalent in meaning to the original submitted data
- AND the change does not alter its recorded outcome or attribution

### Requirement: Review authority is tenant-scoped and prevents self-review

Only an active same-tenant `MANAGER` or `PRINCIPAL_MANAGER` with the proposal-specific review authority MAY review, reject, or approve proposals. Managers MAY view proposals in every state. The proposer MUST NOT approve or reject their own proposal, even if the proposer later gains manager authority or changes membership.

#### Scenario: Both manager roles can review tenant proposals

- GIVEN an active manager or principal manager has proposal review authority in tenant A
- AND a proposal in tenant A was submitted by another user
- WHEN the reviewer views or reviews the proposal
- THEN the reviewer can inspect its current state and immutable history
- AND can approve or reject it only when its state is `EN_REVISION`

#### Scenario: A seller cannot review through a hidden or forged capability

- GIVEN an authenticated seller lacks proposal review authority
- WHEN the seller attempts to approve or reject a tenant proposal, including by bypassing the user interface
- THEN the backend rejects the command
- AND the proposal remains unchanged

#### Scenario: Self-review remains forbidden after identity or role changes

- GIVEN a proposal was created by user A
- AND user A later acquires a manager-capable role or membership
- WHEN user A attempts to approve or reject that proposal
- THEN the command is rejected as self-review
- AND no reviewer, outcome, canonical record, or proposal state is written

### Requirement: The manager inbox is pending-first and filterable without search

The manager review inbox MUST default to `EN_REVISION` proposals ordered newest first. It MUST support filtering by proposal state and by review-history presence or outcome. V1 MUST NOT provide proposal search, and filtering MUST remain tenant-scoped.

#### Scenario: Default inbox shows pending proposals newest first

- GIVEN a manager has access to several proposals in multiple states with different submission times
- WHEN the manager opens the proposal inbox without filters
- THEN only `EN_REVISION` proposals are shown
- AND they are ordered from newest submission first

#### Scenario: State and history filters preserve scope

- GIVEN a manager has proposals in multiple states and with different review histories in tenant A
- WHEN the manager applies a state or history filter
- THEN only matching tenant-A proposals are returned
- AND the filter does not disclose another tenant's proposals

#### Scenario: No search behavior is introduced

- GIVEN a manager uses the proposal inbox
- WHEN the manager supplies a text search term or requests search behavior
- THEN the capability does not perform proposal search
- AND the supported state and history filters remain the only filtering behavior

### Requirement: Rejection is reasoned and resubmission is explicit

A rejection MUST require a non-empty reason of no more than 1000 characters. Rejection MUST preserve the rejected round, create no canonical property or related canonical records, and return the proposal to `RECHAZADA`. Editing a rejected proposal MUST NOT resubmit it; resubmission MUST be an explicit command.

#### Scenario: Invalid rejection reasons are rejected

- GIVEN a proposal is in `EN_REVISION`
- WHEN a manager rejects it with an empty reason or a reason longer than 1000 characters
- THEN the rejection is rejected
- AND the proposal, round, and canonical records remain unchanged

#### Scenario: Valid rejection preserves history without materialization

- GIVEN a submitted proposal is in `EN_REVISION`
- WHEN an authorized non-proposer manager rejects it with a valid reason
- THEN the proposal becomes `RECHAZADA`
- AND the round records the reviewer, rejected outcome, and reason
- AND no canonical asset, engagement, assignment, or result link is created

#### Scenario: Rejected editing requires explicit resubmission

- GIVEN a proposal is `RECHAZADA`
- WHEN the seller edits its staged data and saves it
- THEN it remains `RECHAZADA` and no new round is created
- AND when the seller explicitly resubmits complete data, the proposal becomes `EN_REVISION` with a new round

### Requirement: Approval is the sole atomic canonical materialization

Approval MUST be the only proposal operation that creates canonical property records. A successful approval MUST create exactly one canonical asset and exactly one canonical engagement for the proposal, and MUST create the canonical result reference as part of the same business operation. The engagement MUST begin in `CAPTURE`. The approved proposal MUST be locked and MUST NOT be reopened.

#### Scenario: Approval creates one canonical aggregate in CAPTURE

- GIVEN an authorized non-proposer manager reviews an `EN_REVISION` proposal and canonical quota is available
- WHEN the manager approves it
- THEN exactly one canonical asset and one canonical engagement are created for that proposal
- AND the engagement starts in `CAPTURE`
- AND the proposal becomes `APROBADA` with a durable reference to that canonical result

#### Scenario: Approval failure leaves no partial aggregate

- GIVEN approval cannot complete
- WHEN the approval operation fails
- THEN no canonical asset, engagement, assignment, or result reference is left partially persisted
- AND the proposal is not reported as `APROBADA`

### Requirement: Approval preserves creator, reviewer, and ordinary assignment attribution

On successful approval, the proposing seller MUST be recorded as creator of both the canonical asset and engagement. The approving manager MUST remain the durable proposal reviewer. The proposer MUST receive an ordinary canonical seller assignment recorded as assigned by the reviewer, with `isPrimary=false`; approval MUST NOT infer, promote, or backfill a primary seller.

#### Scenario: Canonical creator and reviewer are distinct and durable

- GIVEN seller A proposed a property and manager B approves it
- WHEN approval completes
- THEN seller A is the creator of the canonical asset and engagement
- AND manager B is recorded as the proposal reviewer
- AND both attributions remain available from the approved proposal history

#### Scenario: Approval assignment is ordinary and non-primary

- GIVEN seller A proposed a property and manager B approves it
- WHEN the canonical aggregate is materialized
- THEN seller A has one ordinary assignment with manager B as assigner
- AND that assignment has `isPrimary=false`
- AND no primary seller is inferred from proposer identity, sole assignment, or assignment order

### Requirement: Proposal staging preserves active-property quota

Drafting, editing, submission, review, rejection, and resubmission MUST NOT consume active-property quota. Approval MUST enforce the existing canonical active-property quota as part of materialization. A quota-blocked approval MUST leave the proposal in `EN_REVISION` for a later retry.

#### Scenario: Staging does not consume canonical capacity

- GIVEN a tenant has active-property capacity available or exhausted
- WHEN sellers create, edit, submit, reject, or resubmit proposals
- THEN the tenant's active canonical property quota is unchanged by those proposals

#### Scenario: Quota-blocked approval is atomic and retryable

- GIVEN an `EN_REVISION` proposal and no available active-property capacity
- WHEN an authorized manager attempts approval
- THEN the command fails with the stable quota outcome
- AND no canonical records or assignment are created
- AND the proposal remains `EN_REVISION` for a later retry

#### Scenario: Approval can succeed after capacity is restored

- GIVEN a proposal remained `EN_REVISION` after a quota-blocked approval
- WHEN canonical capacity later becomes available and an authorized manager approves it
- THEN exactly one canonical aggregate is created and the proposal becomes `APROBADA`
- AND prior failed attempts did not consume additional quota or create duplicates

### Requirement: Proposals do not expose owners, images, notifications, or analytics

Optional owner name and owner email on a proposal MUST remain reference data only. V1 MUST NOT create owner links, invitations, owner accounts, owner access, or owner-visible proposal surfaces. V1 MUST NOT accept, stage, or promote proposal images, and proposal actions MUST NOT emit notifications or analytics events.

#### Scenario: Owner references remain non-authorizing

- GIVEN a proposal contains optional owner name or owner email
- WHEN the proposal is saved, reviewed, or approved
- THEN no owner link, invitation, account access, owner notification, or owner-visible proposal is created

#### Scenario: Proposal images are unavailable

- GIVEN a proposal is in any lifecycle state
- WHEN a user attempts to attach or promote an image for it
- THEN the image operation is unavailable or rejected
- AND no proposal image or canonical image is created

#### Scenario: Proposal actions have no notification or analytics side effects

- GIVEN a seller or manager creates, edits, submits, rejects, resubmits, or approves a proposal
- WHEN the command completes
- THEN no proposal notification or analytics event is emitted
- AND the durable proposal outcome remains the source of truth

### Requirement: Replays are idempotent and competing transitions conflict

Replaying a command after it has already produced the current state MUST return the idempotent current result without duplicating work. A competing transition against the same reviewable state MUST return a stable HTTP `409` conflict. Concurrent approvals MUST leave at most one canonical asset, engagement, assignment, and result reference for the proposal.

#### Scenario: Replaying approval returns the existing result

- GIVEN approval has already completed for a proposal
- WHEN the same approval command is replayed
- THEN the response returns the existing approved state and canonical result reference
- AND no second asset, engagement, assignment, or result reference is created

#### Scenario: Replaying rejection returns the current rejected result

- GIVEN a valid rejection has already completed for a proposal
- WHEN the same rejection command is replayed
- THEN the response returns the current rejected state and durable rejection history
- AND no additional rejection side effect is created

#### Scenario: A competing review transition returns 409

- GIVEN two different authorized managers act on the same `EN_REVISION` proposal
- WHEN one transition commits first and the other attempts the stale competing transition
- THEN the losing command returns HTTP `409`
- AND it does not overwrite the committed outcome or create canonical records

#### Scenario: Concurrent approvals create one canonical result

- GIVEN two authorized managers concurrently approve the same `EN_REVISION` proposal
- WHEN both commands complete
- THEN durable state contains one approved proposal, one canonical asset, one canonical engagement, one ordinary assignment, and one result reference
- AND no response reports a duplicate canonical result as successful

### Requirement: Seller proposal authority is separate from canonical property creation

Seller proposal authority MUST NOT grant direct canonical property-create authority or access to unrelated canonical property management.

#### Scenario: Proposal access cannot create a canonical property directly

- GIVEN a seller is authorized to create and submit proposals
- WHEN the seller attempts direct canonical property creation or a canonical property-management command
- THEN the operation is rejected
- AND the seller can use only the proposal capability granted to that seller

### Requirement: Managers retain direct canonical creation

Managers MUST retain the existing direct canonical property creation capability, and managers MUST NOT be required to create a proposal for that path.

#### Scenario: Direct manager creation remains available and unchanged

- GIVEN an authorized manager uses the existing direct canonical property-create capability
- WHEN the manager creates a canonical property without a proposal
- THEN the direct flow remains available with its existing validation, authorization, quota, and canonical behavior
- AND no proposal draft or review round is created

### Requirement: User surfaces localize state and fail closed on result links

User-facing proposal surfaces MUST render persisted `EN_REVISION` as localized `EN_REVISIÓN` while preserving the persisted symbol for system behavior. An approved proposal MAY expose a canonical result link only when the linked canonical record is present, belongs to the proposal's tenant, and is visible under the user's existing canonical authorization. Missing, stale, or cross-tenant result references MUST fail closed without disclosing result data.

#### Scenario: Review state is localized without changing persisted identity

- GIVEN a proposal is persisted with state `EN_REVISION`
- WHEN a Spanish user views its list, detail, inbox, or history
- THEN the displayed label is `EN_REVISIÓN`
- AND the underlying state remains `EN_REVISION`

#### Scenario: Authorized proposer can follow a valid approved result

- GIVEN an approved proposal has a canonical result in the same tenant
- AND the proposing seller has ordinary assigned access to that canonical engagement
- WHEN the seller follows the proposal's result link
- THEN the canonical property detail opens for that tenant-scoped result

#### Scenario: Invalid result links are unavailable

- GIVEN an approved proposal has a missing, stale, or cross-tenant canonical result reference
- WHEN an authorized user views the proposal or follows its result link
- THEN the result link is unavailable or the lookup fails closed
- AND no canonical identifier, fields, or cross-tenant existence is disclosed

### Requirement: Proposal work preserves canonical behavior

Proposal work MUST remain separate from canonical property behavior. Staged and rejected proposals MUST never enter canonical property lists or consume canonical active-property quota. An approved proposal aggregate MUST appear as an ordinary canonical record under the existing canonical visibility, ordering, and quota semantics. Proposal work MUST leave no tenant-limit configuration or temporary state that affects later canonical behavior.

#### Scenario: Proposal lifecycle leaves canonical behavior durable and unaffected

- GIVEN a tenant has canonical properties and proposals that are staged, rejected, or approved
- WHEN canonical property lists, active-property quota, and later canonical behavior are observed after proposal work
- THEN staged and rejected proposals are absent from canonical property lists and have not consumed canonical active-property quota
- AND the approved aggregate appears as an ordinary canonical record under the existing canonical visibility and ordering behavior
- AND later canonical behavior sees unchanged tenant-limit configuration and no proposal-created temporary state
