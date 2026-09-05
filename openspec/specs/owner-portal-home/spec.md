# Owner Portal Home Specification

## Purpose

Define the owner home screen as an engagement-scoped surface: every owner-visible agency/property engagement is represented exactly once, and no card borrows identity, stage, or activity from another engagement.

## Requirements

### Requirement: One card per owner-visible engagement

The owner home screen MUST render exactly one card for each owner-visible agency/property engagement. Each card MUST be keyed by its stable engagement id and MUST identify the agency that owns the engagement. A property with engagements from multiple agencies MUST produce one card per engagement. Collapsing a property's engagements into a single card, and selecting a representative engagement by position, are both forbidden.

#### Scenario: One property with two agencies produces two cards
- **GIVEN** an owner-visible property carrying an engagement with agency A and an engagement with agency B
- **WHEN** the owner home screen renders
- **THEN** two cards exist, each keyed by its own engagement id, each naming its own agency, and neither card is omitted.

#### Scenario: A single agency keeps the current outcome
- **GIVEN** an owner-visible property carrying exactly one engagement
- **WHEN** the owner home screen renders
- **THEN** exactly one card exists for that property, preserving the pre-existing single-agency presentation.

### Requirement: Engagement-scoped stage, activity, and next action

A card's stage, progress, latest owner-visible movement with its date, next action, and agency contact MUST be selected exclusively from that card's own engagement. Aggregating across agencies is forbidden, and a card whose engagement has no movements MUST NOT fall back to activity belonging to any other engagement.

#### Scenario: Activity does not leak between agencies
- **GIVEN** two engagements on the same property where only agency A's engagement has movements
- **WHEN** the owner home screen renders
- **THEN** agency A's card shows agency A's latest movement, and agency B's card shows its empty movement state rather than agency A's activity.

### Requirement: Explicit empty states

A card whose engagement has no owner-visible movements MUST render an explicit no-activity state. A card whose latest owner-visible movement carries no next step MUST render an explicit no-next-action state. The two states are distinct and MUST NOT be replaced by omitting the section.

#### Scenario: Missing activity and missing next action are stated separately
- **GIVEN** one engagement with no movements and one engagement whose latest movement has a null next step
- **WHEN** the owner home screen renders
- **THEN** the first card states that no activity has been recorded, and the second card states that no next action is loaded while still showing its latest movement.

### Requirement: Deterministic card order

Cards MUST be ordered by the date of their engagement's latest owner-visible movement, descending. Engagements with no owner-visible movements MUST be placed after every engagement that has one. Ties MUST be resolved by the stable engagement id, ascending. The order MUST be computed from the card data and MUST NOT depend on client render order, query completion order, or the order in which properties or engagements arrive from the API.

#### Scenario: Equal timestamps resolve by engagement id
- **GIVEN** two engagements whose latest owner-visible movements share the same timestamp
- **WHEN** the owner home screen renders
- **THEN** the engagement with the lower stable id is placed first, regardless of arrival order.

#### Scenario: Engagements without activity are placed last
- **GIVEN** engagements with and without owner-visible movements
- **WHEN** the owner home screen renders
- **THEN** every engagement with a movement precedes every engagement without one, and the movement-less engagements keep the ascending stable-id order among themselves.

### Requirement: Engagement-scoped detail navigation

A card's `Ver más` navigation MUST carry the card's engagement id, and the owner property detail MUST scope its headline agency, status panel, summary, and tracking content to that engagement. When no engagement scope is supplied, or the supplied scope does not match an owner-visible engagement of that property, the detail MUST fall back to its existing default engagement selection.

#### Scenario: Detail opens on the originating engagement
- **GIVEN** a property with engagements from agency A and agency B, and a card for agency B
- **WHEN** the owner follows that card's `Ver más`
- **THEN** the detail presents agency B as the engagement in scope rather than the first engagement returned by the API.

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

### Requirement: Reference-fidelity engagement action hierarchy

Each owner-visible engagement card MUST present exactly three primary action tiles in this order: “Actividad reciente”, “Documentación”, and “Comunicarme con mi asesor”. Each tile MUST expose a recognizable icon, title, supporting text, and directional affordance consistent with the stored owner-home references while retaining accessible link or button semantics. The composition MAY adapt dimensions, wrapping, density, and stacking for supported viewports and real content lengths, but MUST preserve the action order, grouping, prominence, keyboard operation, and accessible name of every available action.

This presentation MUST preserve the canonical one-card-per-stable-engagement identity, agency identity, engagement isolation, deterministic ordering, and distinct no-activity and no-next-action meanings; it MUST NOT collapse engagements or use presentation state to substitute data from another engagement.

#### Scenario: Ordered actions retain their card semantics

- **GIVEN** an owner-visible engagement with available agency WhatsApp contact
- **WHEN** its home card renders
- **THEN** the card exposes the three action tiles in the specified order with semantic, accessible controls
- **AND THEN** activity and documentation are engagement-scoped navigations while the contact tile is the card's agency WhatsApp action.

#### Scenario: Responsive layout preserves usable hierarchy

- **GIVEN** an engagement card rendered in a supported narrow viewport with long property, agency, or action-supporting text
- **WHEN** the action group adapts its layout
- **THEN** all three actions remain present in the specified order with readable accessible names and keyboard-reachable controls
- **AND THEN** wrapping or stacking does not change an action's engagement scope or replace it with a decorative-only control.

### Requirement: Bounded, engagement-scoped recent activity

Every engagement card MUST contain an “Actividad reciente” area that renders only the newest owner-visible movements belonging to that card's engagement. The home MUST request and render at most five recent movements per engagement in descending movement-time order and MUST NOT load an engagement's full timeline for this area. The first valid movement in that ordered bounded set MUST remain the source for the canonical latest-activity, next-action, and card-order semantics.

Each activity area MUST provide a “Ver toda la actividad” continuation that navigates to the originating engagement's tracking destination. Activity rows MUST present only real owner-authorized movement data. They SHALL include an honest timestamp and MAY display the movement's stored owner-visible observation without changing its meaning; they MUST NOT fabricate reference sample events, dates, counts, document summaries, advisor identity, or claims inferred from free text.

#### Scenario: Recent rows stay within their engagement and bound

- **GIVEN** one property has two owner-visible engagements and each engagement has more than five owner-visible movements
- **WHEN** the owner home renders
- **THEN** each card displays at most its five newest movements in descending movement-time order
- **AND THEN** no row from either engagement appears in the other card.

#### Scenario: Continuation opens the same engagement timeline

- **GIVEN** a card for an owner-visible engagement on a property with another agency engagement
- **WHEN** the owner follows “Ver toda la actividad” from that card
- **THEN** the destination carries that card's engagement id and selects its tracking view
- **AND THEN** the destination does not select the sibling engagement.

### Requirement: Truthful movement presentation

The recent-activity area MUST use category labels, icons, color treatments, and timeline cues only for supported structured movement types without changing the movement's meaning. Unsupported reference categories or data MUST be omitted and MUST NEVER be inferred from free-text observations. An unknown movement type MUST retain its honest existing generic type label or omit category treatment; it MUST NOT be relabeled as a reference-only promotion, content, price, or other unsupported category.

#### Scenario: Supported types receive only supported treatment

- **GIVEN** recent movements with supported structured types and a movement with an unknown type
- **WHEN** the activity area renders
- **THEN** supported types MAY receive their corresponding presentation treatment
- **AND THEN** the unknown type remains honestly labeled or has no category treatment
- **AND THEN** no unsupported reference category is created from any movement observation.

### Requirement: Scoped documentation and agency contact actions

The “Documentación” tile MUST navigate to the originating engagement's existing documents destination and MUST preserve the existing document read, upload, loading, empty, and error behavior. The “Comunicarme con mi asesor” tile MUST use only the originating engagement's already-authorized agency WhatsApp contact; it MUST NOT resolve or substitute an individual movement's primary-seller contact.

When the agency contact is usable, the contact action MUST preserve the existing WhatsApp URL and message semantics and best-effort click tracking. When the agency contact is unavailable or unusable, the action MUST be visibly unavailable, non-clickable, and free of contact click tracking.

#### Scenario: Documentation remains engagement-scoped

- **GIVEN** a property with two owner-visible engagements
- **WHEN** the owner follows “Documentación” from one engagement card
- **THEN** the documents destination carries that card's engagement id
- **AND THEN** its existing document lifecycle is not redirected to or populated from the other engagement.

#### Scenario: Agency contact remains distinct from movement contact

- **GIVEN** a card has an available agency WhatsApp contact and one of its movements has a different primary-seller contact
- **WHEN** the owner follows “Comunicarme con mi asesor”
- **THEN** the action uses the agency contact's existing WhatsApp URL, message, and best-effort tracking behavior
- **AND THEN** it does not use the movement contact.

#### Scenario: Unavailable agency contact cannot be activated or tracked

- **GIVEN** an engagement has no usable agency WhatsApp contact
- **WHEN** its home card renders
- **THEN** “Comunicarme con mi asesor” is visibly unavailable and non-clickable
- **AND THEN** activating its unavailable control does not emit contact click tracking.

### Requirement: Honest reference-fidelity states

The reference-style action and activity composition MUST preserve distinct owner-facing states. Initial loading MUST show loading treatment without placeholder facts. No owner-visible engagements MUST show the existing owner-safe empty state without sample cards. A properties or engagements failure MUST show a full error state and MUST NOT imply that the engagement set is complete. A failure loading one engagement's activity MUST remain local to that card and MUST show an activity error rather than an empty list or another engagement's movements. An engagement with no movements MUST show the canonical explicit no-activity state, and a latest movement without a next step MUST retain the separate explicit no-next-action meaning.

#### Scenario: Local activity failure is not presented as emptiness

- **GIVEN** activity loads for one engagement and fails for a second engagement on the same property
- **WHEN** the owner home renders
- **THEN** the first card may show only its own activity
- **AND THEN** the second card shows a local activity error rather than no activity or the first card's rows.

#### Scenario: Empty activity and missing next action remain distinct

- **GIVEN** one engagement has no owner-visible movements and another has a latest owner-visible movement with no next step
- **WHEN** their cards render in the reference-style composition
- **THEN** the first card states the explicit no-activity meaning
- **AND THEN** the second card retains its latest activity while stating the separate no-next-action meaning.

### Requirement: Frontend-only fidelity boundary

This change MUST remain an owner-home frontend presentation change using existing owner-authorized contracts. It MUST NOT require API, repository, database, schema, authentication, authorization, tenant-isolation, document-workflow, detail-fallback, notification, movement-contact resolution, WhatsApp formatting, message, analytics payload, or click-tracking behavior changes. If a reference element lacks trustworthy structured data from the current contracts, the element MUST be omitted unless separately proposed and authorized.

#### Scenario: Unsupported reference data is omitted

- **GIVEN** the current owner-authorized data does not provide a reference-style category, document aggregate, advisor identity, or other requested detail
- **WHEN** the owner home renders
- **THEN** that unsupported detail is omitted
- **AND THEN** the home does not infer or fabricate it from free text or introduce a new data contract.
