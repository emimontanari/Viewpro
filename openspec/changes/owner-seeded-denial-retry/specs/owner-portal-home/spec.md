# Delta for Owner Portal Home

## ADDED Requirements

### Requirement: Owner detail authorization-shaped 404s are terminal

The owner property read and owner property-engagements read MUST issue no retry when their existing typed `BffError` has status `404`. Every other failure handled by these reads MUST retain eligibility for the existing maximum of three retries. This change MUST NOT alter the global query retry policy or retry behavior for unrelated queries.

#### Scenario: Owner property denial is not retried

- GIVEN an owner property read fails with a typed `BffError` whose status is exactly `404`
- WHEN the query settles
- THEN no retry request is issued
- AND THEN the existing owner property failure or not-found state is rendered without denied property data

#### Scenario: Owner engagement denial is not retried

- GIVEN an owner property-engagements read fails with a typed `BffError` whose status is exactly `404`
- WHEN the query settles
- THEN no retry request is issued
- AND THEN the existing owner engagement failure state is rendered without engagement data from the denied property

#### Scenario: Other detail failures retain three retry opportunities

- GIVEN either affected owner read fails with a non-`404` failure, including another typed `BffError` status or a non-`BffError` failure
- WHEN the same failure is returned repeatedly
- THEN the query remains eligible for the existing three retry opportunities
- AND THEN it issues no more than the initial request plus three retries

### Requirement: Direct owner denial does not leak property data

When an authenticated owner directly opens a property outside the owner's authorized scope, the existing owner-safe denial state MUST remain visible and the denied property's title and other property content MUST NOT be rendered. Terminal handling of the authorization-shaped `404` MUST NOT expose the denied response as owner-visible data.

#### Scenario: Owner deep-link to an unowned property remains leak-free

- GIVEN the seeded owner is authenticated
- AND the direct property URL identifies a property the owner does not own
- WHEN the owner opens that URL directly
- THEN the existing owner property denial or error state is shown
- AND THEN the unowned property's title and property content are absent

## Explicit Non-Goals

- The global query retry policy, backend authorization, BFF routes, API contracts, authentication, tenant isolation, and owner detail fallback selection are unchanged.
- No timeout budget, status classification beyond the exact typed `BffError` `404`, or unrelated query behavior is introduced by this delta.
