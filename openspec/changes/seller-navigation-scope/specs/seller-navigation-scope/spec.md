# Seller Navigation Scope (#284)

## Delivery

This specification is the planning contract for the sequential PR0 → PR1 → PR2 chain to `develop`. PR0 versions this contract only. #307 owns route/session hardening, and #291 owns seeded CI; neither is required here.

## Requirements

### Requirement: Navigation policy has explicit resolution and membership semantics

PR1 MUST provide one navigation access context and policy consumed by Sidebar and KBar and available to PR2.

#### Scenario: Resolved and membership are independent

- GIVEN context loading has completed
- WHEN `resolved` is evaluated
- THEN it represents only completed context loading
- AND membership remains a separate value that may be absent

#### Scenario: Protected access is conjunctive and fail-closed

- GIVEN a policy declares `requireOrg`, a role allowlist, or a permission
- WHEN access is evaluated
- THEN membership is required
- AND every declared requirement must match
- AND an empty role allowlist denies access

#### Scenario: Matching role without permission is denied

- GIVEN a resolved membership with an allowed role but without a required permission
- WHEN the policy is evaluated
- THEN access is denied

#### Scenario: Loading does not expose protected navigation

- GIVEN a retained membership and unresolved context
- WHEN a protected policy is evaluated
- THEN access is denied

### Requirement: Sidebar and KBar have complete rendered parity

PR1 MUST apply the same filtered navigation policy to Sidebar and KBar. Tests MUST exercise rendered consumer behavior for realistic resolved MANAGER, PRINCIPAL_MANAGER, and AGENT states plus loading.

#### Scenario: AGENT has only permitted destinations

- GIVEN a resolved AGENT membership
- WHEN Sidebar and KBar render
- THEN both expose the same permitted destinations
- AND neither exposes restricted destinations

#### Scenario: Manager and principal destinations remain distinct

- GIVEN resolved MANAGER and PRINCIPAL_MANAGER memberships with their existing permissions
- WHEN Sidebar and KBar render
- THEN each sees its permitted destinations
- AND principal-only destinations remain absent for MANAGER

#### Scenario: Loading retains only unrestricted destinations

- GIVEN a retained MANAGER, PRINCIPAL_MANAGER, or AGENT membership while context is loading
- WHEN Sidebar and KBar render
- THEN protected destinations are absent

### Requirement: OrgSwitcher consumes PR1 policy without redesign

PR2 MUST start only after PR1 merges and MUST consume the merged policy for the workspace-administration action. It MUST preserve existing agency switching, manager/principal action availability, loading fail-closed behavior, accessibility, and persistence.

#### Scenario: AGENT administration action is hidden

- GIVEN a resolved AGENT membership
- WHEN OrgSwitcher renders
- THEN the administration action is absent

#### Scenario: Existing switching behavior is preserved

- GIVEN existing memberships and a resolved MANAGER or PRINCIPAL_MANAGER membership
- WHEN OrgSwitcher renders and switches agency
- THEN the administration action remains available
- AND the existing accessibility and persistence behavior is preserved

## Non-goals

- #307 route/session hardening.
- #291 seeded CI.
- New roles, role labels, permissions, backend behavior, dropdown primitives, or other user-visible OrgSwitcher redesign.

## Delivery boundaries

- PR0: planning artifacts only; rollback is a docs-only revert.
- PR1: context, policy, types, navigation configuration, `useNav`, Sidebar/KBar parity, and navigation documentation; no OrgSwitcher, session, or dropdown work.
- PR2: only the AGENT administration-action boundary using PR1 policy; blocked until PR1 merges.
