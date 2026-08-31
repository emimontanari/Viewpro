# Property Primary Seller Specification

## Purpose

Define an optional, explicitly managed primary seller for a property engagement without changing the existing multi-seller assignment or access model.

## Requirements

### Requirement: Primary designation is optional and explicit

A property engagement MUST have zero or one primary seller. The system MUST NOT select, infer, backfill, or silently replace a primary when an assignment is created, when existing data is read, or when a primary becomes unavailable. Setting, changing, and clearing the designation MUST be separate explicit actions.

#### Scenario: Assignment does not auto-select a primary

- GIVEN a property engagement has no primary and a seller is assigned to it
- WHEN the assignment is created or the assignment set is read
- THEN the engagement still has no primary

#### Scenario: Existing records remain unselected after deployment

- GIVEN an existing property engagement has assigned sellers but no stored primary designation
- WHEN the new capability is deployed and the engagement is read
- THEN it remains in the valid no-primary state
- AND no seller is selected from assignment order, including when exactly one seller is assigned

#### Scenario: Clear leaves an intentional no-primary state

- GIVEN an authorized assignment manager has a primary seller selected
- WHEN the manager explicitly clears the primary
- THEN the engagement has no primary
- AND no other assigned seller is selected

### Requirement: Primary selection requires current assignment and exact eligibility

A set or change operation MUST succeed only when the candidate is currently assigned to the property engagement, the candidate user is active, the candidate has an active membership in the property's tenant, and that membership's role is exactly `AGENT`. The operation MUST validate these conditions together and MUST reject any candidate that fails one or more of them.

#### Scenario: Eligible assigned agent can be selected

- GIVEN a candidate is assigned to the property engagement
- AND the candidate user is active
- AND the candidate has an active membership in the same tenant with role exactly `AGENT`
- WHEN an authorized manager explicitly sets the candidate as primary
- THEN the candidate becomes the primary seller

#### Scenario: An eligible candidate can replace the current primary

- GIVEN an engagement has a current primary seller
- AND a different candidate is currently assigned, active, and an active same-tenant member with role exactly `AGENT`
- WHEN an authorized manager explicitly changes the primary to that candidate
- THEN the candidate becomes the sole primary
- AND the previous primary is no longer primary

#### Scenario: Unassigned or stale candidate is rejected

- GIVEN a candidate is not currently assigned to the property engagement, including a stale assignment reference
- WHEN a set or change operation is requested
- THEN the operation fails with a stable validation outcome
- AND neither the assignment set nor the current primary is changed

#### Scenario: Ineligible candidate is rejected

- GIVEN a candidate is assigned but the user is inactive, the same-tenant membership is inactive, or the membership role is not exactly `AGENT`
- WHEN a set or change operation is requested
- THEN the operation fails with a stable validation outcome
- AND neither the assignment set nor the current primary is changed

### Requirement: Primary operations are authorized and tenant-isolated by the backend

The backend MUST authorize primary set, change, and clear operations using the existing property-assignment management boundary. Primary status MUST grant no additional authorization. Every operation and result MUST remain scoped to the authenticated tenant and property engagement; a request MUST NOT select or disclose a user, membership, assignment, or property from another tenant. These rules MUST hold independently of any UI or BFF behavior.

#### Scenario: Unauthorized manager cannot mutate primary state

- GIVEN an authenticated user who cannot manage assignments for the property engagement
- WHEN the user requests a primary set, change, or clear
- THEN the backend rejects the operation
- AND the primary designation and assignment set remain unchanged

#### Scenario: Cross-tenant candidate is rejected without disclosure

- GIVEN a candidate user or membership belongs to another tenant, even if the candidate has a matching identifier or role
- WHEN a primary set or change is requested for the current tenant's property engagement
- THEN the backend rejects it as invalid for that scoped engagement
- AND it does not disclose cross-tenant candidate state or mutate any assignment or primary

### Requirement: Assignment lifecycle cannot preserve or promote an invalid primary

Removing the assignment that is designated primary MUST leave the property engagement with no primary. Deactivation of the primary user, deactivation of the same-tenant membership, or changing its role away from exact `AGENT` MUST make the designation unavailable for consumption without selecting another seller. An invalid designation MUST NOT be used as a fallback winner.

#### Scenario: Removing the primary assignment leaves none

- GIVEN an engagement has a primary seller and at least one other assigned seller
- WHEN the primary seller's assignment is removed
- THEN the removed seller is no longer assigned
- AND the engagement has no primary
- AND no other assigned seller is promoted

#### Scenario: Primary invalidation does not promote another seller

- GIVEN an engagement has a primary seller and another assigned seller
- WHEN the primary user's status, membership status, or exact role becomes ineligible
- THEN the primary is not used as an eligible primary
- AND the other seller is not selected automatically

### Requirement: Database state and responses preserve the zero-or-one concurrency outcome

Concurrent primary set or change operations MUST leave database state with at most one primary seller for the property engagement. Each operation's result MUST expose server-confirmed primary state: a losing or conflicting operation MUST NOT report an uncommitted winner as successful, and a client MUST be able to refresh to the durable winner or no-primary state.

#### Scenario: Concurrent changes leave one server-confirmed winner

- GIVEN two authorized managers concurrently request different eligible sellers as primary for the same engagement
- WHEN both operations complete
- THEN durable state contains zero or one primary, never two
- AND responses and subsequent reads expose the server-confirmed winner or a clear conflict/no-primary outcome
- AND no response represents a losing seller as the durable primary

### Requirement: Assignment responses and management surfaces represent server state

The existing property-assignment response path MUST expose the current primary state for assigned sellers and the valid no-primary state. Users who can already manage assignments MUST be able to explicitly set, change, and clear the primary in the existing seller-management surface. After a mutation, the surface MUST render server-confirmed state and MUST present validation or conflict failures without an optimistic state that contradicts durable data. The UI MUST NOT be the authorization boundary.

#### Scenario: No-primary and selected-primary states are clear

- GIVEN an assignment manager views an engagement with no primary or with one eligible primary
- WHEN the existing seller-management surface loads
- THEN it clearly shows no primary or identifies the selected primary
- AND it does not require a primary selection to preserve the assignment set

#### Scenario: Losing mutation refreshes authoritative state

- GIVEN a concurrent mutation causes the manager's requested change not to become the durable primary
- WHEN the manager's mutation result is received
- THEN the surface reports the failure or conflict and displays the server-confirmed primary state after refresh

### Requirement: Primary status does not alter any-assignee access

Existing authorization and property visibility based on any current seller assignment MUST remain unchanged. A primary seller MUST receive no access beyond an ordinary assigned seller, and a non-primary assigned seller MUST retain the same access and visibility it had before primary designation.

#### Scenario: Non-primary assigned seller remains authorized and visible

- GIVEN two sellers are assigned to the same property engagement and one is primary
- WHEN the non-primary seller accesses the property through existing seller flows
- THEN the seller retains the existing any-assignee authorization and visibility
- AND clearing or changing the primary does not remove that access while the assignment remains
