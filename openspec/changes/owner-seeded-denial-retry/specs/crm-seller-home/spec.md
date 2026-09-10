# Delta for CRM Seller Home

## ADDED Requirements

### Requirement: Martin's seeded seller-home proof synchronizes existing upstream interceptions

Martin's seeded seller-home proof MUST poll the existing session, products, and activity interception flags until each is true before evaluating transformed seller-home assertions. The proof MUST retain its existing successful-response and authorized-content assertions, fail within the existing test budget when any required interception never completes, and MUST NOT change seller production query retry behavior.

#### Scenario: All Martin upstream flags are observed before UI assertions

- GIVEN Martin's seeded seller-home proof registers the existing session, products, and activity interceptions
- WHEN the seller home is loaded and its transformed content is asserted
- THEN the proof waits for the session, products, and activity flags to become true through polling
- AND THEN it verifies the existing successful responses and authorized seller-home content

#### Scenario: A missing upstream interception still fails the proof

- GIVEN one of Martin's session, products, or activity interceptions never completes successfully
- WHEN the seller-home proof waits for the upstream flags
- THEN the proof fails within the existing test budget
- AND THEN it does not pass based on a synchronous read of a still-false flag

## Explicit Non-Goals

- Seller production query retry behavior, assignment authorization, backend or BFF behavior, tenant isolation, global retry policy, timeout budgets, and unrelated seller-home queries remain unchanged.
