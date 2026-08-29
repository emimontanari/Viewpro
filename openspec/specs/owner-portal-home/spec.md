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
