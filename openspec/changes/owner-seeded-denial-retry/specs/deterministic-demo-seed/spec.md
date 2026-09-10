# Delta for Deterministic Demo Seed

## ADDED Requirements

### Requirement: Seeded direct-denial proof remains leak-free

The seeded smoke evidence MUST retain direct-denial coverage for an assigned-scope violation and an owner-scope violation. Each denied direct deep-link MUST show the existing safe denial or not-found state and MUST NOT render the denied property's title or other denied property content. The proof MUST continue to use the existing seeded isolation fixtures and authorized-data boundaries.

#### Scenario: Seeded direct denials expose no property data

- GIVEN the seeded seller opens a direct link for an engagement to which the seller is not assigned
- AND the seeded owner opens a direct link for a property the owner does not own
- WHEN each direct read is denied
- THEN each surface shows its existing safe denial or not-found state
- AND THEN neither denied property's title or property content appears

### Requirement: Martin's seeded seller-home proof waits for upstream interceptions

Martin's seeded seller-home proof MUST poll the existing session, products, and activity interception flags until each is true before evaluating the transformed seller-home assertions. The proof MUST retain its existing authorized response checks and MUST fail within the existing test budget if any required upstream interception never completes. It MUST NOT increase timeouts or replace real authorized-data assertions with fabricated or synchronous flag assumptions.

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
