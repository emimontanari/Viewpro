# Delta for Property Primary Seller

## ADDED Requirements

### Requirement: Proposal approval preserves explicit no-primary semantics

When approval materializes a canonical property from a proposal, the proposing seller MUST be added only as an ordinary assigned seller, with the approving reviewer recorded as assigner and `isPrimary=false`. The newly approved engagement MUST have no primary seller. Approval MUST NOT select, infer, backfill, promote, or replace a primary seller from proposer identity, sole assignment, or assignment order. Any later primary designation MUST remain a separate explicit operation governed by the canonical primary-seller rules.

#### Scenario: Approved proposal creates an ordinary non-primary assignment

- GIVEN an authorized manager approves a proposal submitted by seller A
- WHEN the canonical property engagement is materialized
- THEN seller A has an ordinary assignment recorded as assigned by that manager
- AND the assignment has `isPrimary=false`
- AND the newly approved engagement has no primary seller

#### Scenario: A sole proposal assignment is not promoted

- GIVEN approval creates the only seller assignment for the canonical engagement
- WHEN the engagement and its assignments are read
- THEN the engagement remains in the valid no-primary state
- AND no seller is selected or promoted automatically

#### Scenario: Later primary management remains explicit

- GIVEN a canonical engagement was created from an approved proposal with a non-primary proposer assignment
- WHEN an authorized assignment manager later manages primary status
- THEN only the existing explicit primary set, change, or clear rules can change primary status
- AND proposal approval itself is not treated as a primary operation
