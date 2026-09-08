# Delta for crm-seller-home

## ADDED Requirements

### Requirement: Exact Seller Home Role Selection
The authenticated `/dashboard` home MUST render the seller command-center composition only for an active membership whose exact role is `AGENT`. Memberships whose exact role is `MANAGER` or `PRINCIPAL_MANAGER` MUST retain the protected manager home. Missing, unknown, and every other role MUST fail closed and MUST NOT render seller or manager content. The seller branch MUST NOT request manager-summary data.

#### Scenario: Exact agent receives the seller home

- GIVEN an authenticated user has an active selected-tenant membership whose exact role is `AGENT`
- WHEN the user opens `/dashboard`
- THEN the seller command-center composition is available for that selected tenant
- AND THEN manager-summary data is not requested.

#### Scenario: Protected manager roles do not receive seller content

- GIVEN an authenticated user has an active selected-tenant membership whose exact role is `MANAGER` or `PRINCIPAL_MANAGER`
- WHEN the user opens `/dashboard`
- THEN the protected manager home remains available
- AND THEN seller command-center content is absent.

#### Scenario: Missing or unrecognized role fails closed

- GIVEN an authenticated user has no resolved active membership role or has an unrecognized role
- WHEN the user opens `/dashboard`
- THEN seller content, manager content, and manager-summary data are unavailable.

### Requirement: Truthful Personalized Reference Hierarchy
Within the existing application shell, the seller home MUST present a compact, scan-first hierarchy adapted from the approved stored reference: a truthful personalized greeting with adjacent active-tenant context, the supported fact group, the priorities region, assigned engagements, recent activity, and authorized shortcuts. It MUST preserve clear grouping, compact density, rounded surfaces, and semantic emphasis where those treatments do not imply unsupported facts. The greeting MUST use the authenticated user's real display identity when available and MUST NOT substitute a fabricated identity; the tenant context MUST identify the actual active tenant.

#### Scenario: Authenticated identity and selected tenant are presented truthfully

- GIVEN an `AGENT` has a real authenticated display name and an active tenant
- WHEN the seller home renders
- THEN the greeting identifies that display name
- AND THEN the adjacent tenant context identifies the active tenant rather than a sample or prior tenant.

#### Scenario: Missing display identity is not fabricated

- GIVEN an `AGENT` has no usable authenticated display name
- WHEN the seller home renders
- THEN it does not display a fabricated personal name or reference sample identity
- AND THEN any remaining greeting and tenant context remain truthful.

#### Scenario: Reference-only shell chrome is excluded

- GIVEN an `AGENT` views a populated seller home
- WHEN the visible hierarchy is inspected
- THEN the supported regions appear in the required scan order within the existing shell
- AND THEN no duplicate header, profile chrome, bottom navigation, or notification badge is introduced.

### Requirement: Exact Supported Fact Meanings
The seller home MUST present only these four supported facts and MUST preserve their exact meanings:

- Assigned engagements MUST mean the total active, unarchived engagements in the selected tenant to which the authenticated seller is assigned; it MUST NOT claim to be universal inventory, unique physical properties, seller-created listings, or a status-filtered count beyond that contract.
- Movements in the last 24 hours MUST mean movement records, excluding document-request activity, created on visible active engagements during the rolling interval `[now − 24 hours, now)`; it MUST NOT be labeled or implied as calendar-day “today,” calls, visits, contacts, or all activity.
- Require follow-up MUST mean visible active engagements whose latest movement, without a time-window restriction, is an inquiry, completed visit, or received offer and whose next step is null or blank after trimming; it MUST NOT be presented as a general alert, task, overdue-work, or inbox count.
- No movements in the last 7 days MUST mean visible active engagements with no movement during `[now − 7 days, now)`; document-request activity MUST NOT reset that meaning, and the fact MUST NOT be presented as calendar-day inactivity or a task count.

A fact MUST be unavailable when its owning successful result is unavailable; values from the other seller data group MUST NOT fill, infer, default, or conceal it.

#### Scenario: Assigned-engagement total retains its assignment scope

- GIVEN the selected tenant contains assigned active unarchived engagements, unassigned engagements, and engagements in varied non-archive statuses
- WHEN the assigned-engagement fact is shown
- THEN it counts only the authenticated seller's assigned active unarchived engagements
- AND THEN it does not claim a count of all tenant inventory, unique properties, or only a narrower status subset.

#### Scenario: Rolling movement and stale facts exclude unsupported activity semantics

- GIVEN visible active engagements contain movements and document-request activity inside and outside the rolling 24-hour and 7-day intervals
- WHEN the movement and stale facts are shown
- THEN the 24-hour fact counts only qualifying movements in its rolling interval
- AND THEN the 7-day fact identifies engagements with no qualifying movements regardless of document-request activity.

#### Scenario: Narrow follow-up fact does not become a general task count

- GIVEN visible active engagements include latest movements of qualifying and non-qualifying types and next steps that are blank, present, or whitespace only
- WHEN the follow-up fact is shown
- THEN it includes only the qualifying latest-movement and blank-next-step engagements
- AND THEN it does not claim to count all missing next steps, alerts, tasks, or deadlines.

### Requirement: Two-Row Non-Checkable Priorities
Whenever the activity result is successfully available, the priorities region MUST contain exactly two non-checkable aggregate rows: one for the narrow require-follow-up fact and one for the seven-day no-movements fact. The rows MUST retain the fact meanings defined above and MUST NOT represent individual work items, completion state, checkboxes, people, due times, reminders, calls, visits, or deadlines. When activity is unavailable, the region MUST communicate that local unavailability rather than render zero-valued or fabricated priority rows.

#### Scenario: Successful activity renders exactly two aggregate priority rows

- GIVEN the activity result succeeds with supported counters
- WHEN the priorities region renders
- THEN it contains exactly the require-follow-up and seven-day no-movements aggregate rows
- AND THEN neither row is checkable or presented as an individual task.

#### Scenario: Zero priority aggregates remain truthful

- GIVEN the activity result succeeds and both supported priority aggregates are zero
- WHEN the priorities region renders
- THEN the two rows retain their defined aggregate meanings
- AND THEN no sample task, person, deadline, or completion control is introduced.

#### Scenario: Activity failure does not produce false priorities

- GIVEN the activity result fails
- WHEN the priorities region renders
- THEN it identifies the activity unavailability and offers only the relevant recovery
- AND THEN it does not present zero, empty-success, or product-derived priority facts.

### Requirement: Truthful Bounded Engagement and Activity Content
A successful products result MUST provide a bounded preview of real assigned engagements using only available engagement identity, title, address, status, and optional image or other existing row fields in their truthful context. A successful activity result MUST provide a bounded newest-first preview of permitted movement and document-request items in source order, preserving available real kind, structured movement type where available, stored text, time, and engagement identity. Optional next-step and observation text MAY be displayed only as stored prose and MUST NOT be reinterpreted as structured tasks, people, dates, outcomes, or actions. Rendered activity time MUST be truthful and deterministic; malformed or unavailable time MUST NOT produce a fabricated date or time.

#### Scenario: Assigned preview uses only real assigned engagement fields

- GIVEN the products result contains assigned engagements with complete and partial optional fields
- WHEN the assigned-engagement preview renders
- THEN it shows no more than the existing request bound of real rows using only their available truthful fields
- AND THEN missing optional fields receive neutral treatment rather than invented images, addresses, statuses, or commercial detail.

#### Scenario: Recent activity preserves permitted source content and order

- GIVEN the activity result contains permitted movement and document-request items in source order
- WHEN recent activity renders
- THEN it shows no more than the existing request bound in newest-first source order
- AND THEN each displayed item preserves only its available real kind, type, text, time, and engagement context.

#### Scenario: Empty successful groups do not show samples

- GIVEN the products result succeeds with zero engagements and the activity result succeeds with no permitted items
- WHEN their content regions render
- THEN the products region states that there are no assigned properties and the activity region states that there is no recent permitted activity
- AND THEN neither region shows sample rows or fabricated facts.

#### Scenario: Free text and malformed times are not invented into facts

- GIVEN an activity item has long free text and a malformed or missing timestamp
- WHEN the item renders
- THEN its text remains stored prose and the unavailable time is not fabricated
- AND THEN the item is not relabeled as a call, person, deadline, visit, outcome, or other inferred fact.

### Requirement: Independent Seller Data Availability and Tenant Transitions
Products and activity MUST remain independently understandable tenant-scoped data groups. For each group, initial loading without a result MUST communicate loading and MUST NOT present placeholder facts; successful empty MUST remain distinct from failure; and failure MUST remain local and MUST NOT become zero counters, an empty success state, or content derived from the other group. When one group succeeds and the other fails, the successful group MUST remain available while the failure is explicit. Each failed group MUST provide an accessible retry that refetches only that group. Previously successful content MAY remain visible during its own background refresh only when refresh status is distinguishable and the retained content is not represented as newly confirmed. During an active-tenant change, data owned by the prior tenant MUST NOT be presented as the current tenant's result.

#### Scenario: Initial product loading does not imply no assignments

- GIVEN the products group has no available result and is loading
- WHEN the seller home renders
- THEN the products group communicates loading
- AND THEN it does not claim zero assigned engagements or show an empty-success state.

#### Scenario: Successful empty is distinct for both groups

- GIVEN products succeeds with zero engagements and activity succeeds with no permitted items and zero supported counters
- WHEN the seller home renders
- THEN the products and activity regions communicate their respective successful empty meanings
- AND THEN those meanings are not used for either group's loading or failure state.

#### Scenario: Product failure remains local to products

- GIVEN the products group fails while activity succeeds
- WHEN the seller home renders
- THEN activity facts and permitted activity remain available
- AND THEN products identifies its own unavailability without showing zero assignments or activity-derived substitute content.

#### Scenario: Activity failure remains local to activity

- GIVEN the activity group fails while products succeeds
- WHEN the seller home renders
- THEN the assigned-engagement total and preview remain available
- AND THEN activity counters, priorities, and recent activity identify their local unavailability without product-derived fallback values.

#### Scenario: Relevant retry targets only the failed group

- GIVEN exactly one seller data group has failed
- WHEN the user activates that group's accessible retry
- THEN only that failed group is requested again
- AND THEN available content from the other group is not discarded or retried as a side effect.

#### Scenario: Retained refresh data remains distinguishable

- GIVEN a seller data group has previously succeeded and is refreshing in the background
- WHEN the seller home renders
- THEN its valid retained content remains available with distinguishable refresh status
- AND THEN it is not presented as a newly confirmed result or replaced by placeholder facts.

#### Scenario: Tenant transition never relabels prior-tenant content

- GIVEN an `AGENT` changes the active tenant while a prior tenant's seller data is retained or in flight
- WHEN the dashboard begins rendering for the new tenant
- THEN no prior-tenant engagement, activity, counter, or tenant identity is presented as the new tenant's result
- AND THEN the new tenant's groups remain loading, unavailable, or successful according to their own results.

### Requirement: Authorized Contextual Destinations and Explicit Omissions
The seller home MUST expose only existing authorized destinations for the property list, an assigned engagement detail, and follow-up activity. An engagement-detail destination MUST be offered only when a real valid engagement identifier is available; blank or malformed identifiers MUST fail closed without a broken or unsafe link. Any movement creation reachable after following an engagement destination MUST remain property-contextual and subject to existing authorization. The seller home MUST NOT offer direct property creation, a proposal entry or count, global movement entry, or any unsupported action or domain, including tasks, agenda, clients, contacts, calls, messages, WhatsApp, visits, photos, price changes, document-request actions, performance, percentages, alerts, badges, notifications, platform data, #306 seller-property-proposal content, or #327 platform-data-lane content.

#### Scenario: Existing authorized destinations remain usable

- GIVEN an `AGENT` has real assigned engagement rows and existing authorized property-list and follow-up destinations
- WHEN the seller home renders shortcuts and valid row destinations
- THEN it offers only those existing destinations in their existing authorization context.

#### Scenario: Invalid engagement identity fails closed

- GIVEN an otherwise readable assigned-engagement or activity row has a blank or malformed engagement identifier
- WHEN the row renders
- THEN its readable non-navigation content may remain available
- AND THEN no engagement-detail link or other unsafe destination is offered.

#### Scenario: Movement creation remains contextual

- GIVEN an `AGENT` follows a valid assigned-engagement destination
- WHEN an existing property-contextual movement flow is available and authorized there
- THEN that flow remains governed by its existing context and server checks
- AND THEN the seller home itself provides no global movement action.

#### Scenario: Fully populated home omits unsupported reference content

- GIVEN all supported seller data is available
- WHEN the seller home is inspected
- THEN no unsupported fact, action, domain, #306 content, #327 content, or reference-only sample module is present
- AND THEN no unsupported content is inferred from free text or missing fields.

### Requirement: Accessible, Responsive, and Browser-Usable Seller Home
The seller home MUST provide semantic interactive controls with accessible names, visible focus, and coherent keyboard traversal in displayed content order. It MUST preserve readable, actionable hierarchy at supported narrow and desktop viewport sizes and in supported browsers. Long display names, tenant names, property fields, observations, and next steps MUST wrap, truncate with an accessible equivalent, or otherwise remain understandable without overlap, clipped essential meaning, or inaccessible controls. Color, icons, surfaces, and layout MUST NOT be the sole carrier of a fact, state, or action meaning.

#### Scenario: Keyboard traversal and focus remain usable

- GIVEN a keyboard-only `AGENT` views a populated seller home
- WHEN focus moves through shortcuts, valid row destinations, and any retry controls
- THEN every interactive control has an accessible name and visible focus
- AND THEN traversal follows the displayed hierarchy without reaching decorative-only controls.

#### Scenario: Long truthful content works at narrow and desktop widths

- GIVEN seller content contains long identity, tenant, property, observation, and next-step values
- WHEN the seller home is viewed at supported narrow and desktop viewport sizes
- THEN the required content and controls remain readable and operable without overlap or loss of hierarchy.

#### Scenario: Non-color meaning survives supported browser rendering

- GIVEN supported facts, loading, refresh, empty, and failure states are rendered in a supported browser
- WHEN color or icon recognition is unavailable to the user
- THEN labels and semantic content still distinguish the facts, states, and available actions.

### Requirement: Protected Authentication, Tenant, Server, and Shell Boundaries
This capability MUST remain a frontend-only seller-home presentation change over existing seller contracts. Existing authentication, session behavior, public routes and public error behavior, active-tenant selection, BFF tenant forwarding, API contracts and semantics, server-side membership and permission checks, tenant isolation, and seller assignment visibility MUST remain authoritative and unchanged. Client tenant state MUST NOT become authorization. The capability MUST NOT change owner surfaces, manager surfaces, the application shell, centralized navigation policy, backend, BFF, API, database, schema, or persistent data behavior.

#### Scenario: Server authorization remains authoritative

- GIVEN a user attempts to access seller data or a seller destination without an active authorized selected-tenant membership or assignment
- WHEN the request reaches existing server boundaries
- THEN the existing server authorization and tenant-isolation behavior decides access
- AND THEN seller-home presentation state does not grant access.

#### Scenario: Public and authentication surfaces remain unchanged

- GIVEN a public user or an unauthenticated user visits an existing public or authentication route
- WHEN the seller-home capability is available
- THEN the existing route, session, proxy, and public-error behavior remain unchanged
- AND THEN seller-home content is not exposed.

#### Scenario: Owner, manager, and shell surfaces remain protected

- GIVEN an owner or a protected manager role accesses its existing dashboard surface
- WHEN the seller-home capability is available
- THEN its existing home and application-shell behavior remain unchanged
- AND THEN no seller composition or seller data behavior is introduced there.

#### Scenario: Existing contract boundaries are not expanded

- GIVEN the seller home needs a fact or action not available through existing authorized seller contracts
- WHEN the capability renders
- THEN the unsupported element is absent
- AND THEN no new BFF, API, backend, database, schema, or platform-data request is implied or introduced.
