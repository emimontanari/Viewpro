# Delta for Owner Portal Home

## ADDED Requirements

### Requirement: Owner movement WhatsApp contact resolves only from a valid primary seller

Owner movement WhatsApp contact MUST be available only when the engagement has a currently valid primary seller whose user is active, whose same-tenant membership is active with role exactly `AGENT`, who remains currently assigned to that engagement, and whose phone is usable under the existing phone rules. The resolver MUST fail closed when any condition is false. It MUST NOT use assignment age, another assigned seller, the tenant's property-level agency contact, or any other fallback to produce movement contact.

#### Scenario: Valid primary with usable phone provides movement contact

- GIVEN an owner-visible engagement has a primary seller who is currently assigned
- AND that seller's user and same-tenant `AGENT` membership are active
- AND the seller has a usable phone
- WHEN the owner movement contact is resolved
- THEN contact is available for that primary seller

#### Scenario: No primary leaves movement contact unavailable

- GIVEN an owner-visible engagement has no primary seller
- WHEN the owner movement contact is resolved
- THEN movement contact is unavailable
- AND the oldest assigned seller is not used

#### Scenario: Invalid primary fails closed without replacement

- GIVEN the designated primary is removed, has an inactive user, has an inactive same-tenant membership, no longer has exact role `AGENT`, or is no longer assigned
- AND another seller remains assigned
- WHEN the owner movement contact is resolved
- THEN movement contact is unavailable
- AND no other seller is selected

#### Scenario: Unusable primary phone fails closed without replacement

- GIVEN the primary remains eligible by assignment, user, membership, and role
- AND the primary's phone is unusable
- AND another seller has a usable phone
- WHEN the owner movement contact is resolved
- THEN movement contact is unavailable
- AND the other seller is not used

### Requirement: Owner contact preserves existing non-resolution behavior

Changing the movement contact's seller-resolution source MUST NOT change the existing owner-facing unavailable response or UI behavior, WhatsApp URL and message semantics, analytics event shape, or click-tracking behavior. Property-level agency contact behavior MUST remain unchanged and MUST NOT become a fallback for movement contact.

#### Scenario: Existing contact contract remains unchanged for a valid primary

- GIVEN movement contact resolves to a valid primary with a usable phone
- WHEN the owner uses the contact action
- THEN the existing WhatsApp formatting, message, analytics, and click-tracking behavior is preserved

#### Scenario: Property-level agency contact remains independent

- GIVEN an engagement has a configured property-level agency contact and no valid primary seller contact
- WHEN owner movement contact is resolved
- THEN movement contact remains unavailable
- AND the property-level agency contact continues to follow its existing contract without being substituted into movement contact
