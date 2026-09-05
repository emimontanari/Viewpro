# Delta for Owner Portal Home

## ADDED Requirements

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
