# Delta for crm-manager-home

## ADDED Requirements

### Requirement: Exact Manager Home Role Selection
The authenticated `/dashboard` home MUST render the manager-home experience only for memberships whose exact role is `MANAGER` or `PRINCIPAL_MANAGER`. The `AGENT` role MUST retain its existing seller-home content, behavior, and data usage. Any other, missing, or unrecognized membership role MUST fail closed and MUST NOT render manager-home content or request manager-summary data. Client composition MUST NOT replace existing authentication, tenant selection, backend authorization, or tenant-isolation enforcement.

#### Scenario: Allowed manager role opens the manager home

- GIVEN an authenticated user has an active tenant membership with the exact role `MANAGER` or `PRINCIPAL_MANAGER`
- WHEN the user opens `/dashboard`
- THEN the manager-home content is available for that active tenant

#### Scenario: Agent retains the seller home

- GIVEN an authenticated user has an active tenant membership with the exact role `AGENT`
- WHEN the user opens `/dashboard`
- THEN the existing seller-home content is shown and manager-summary data is not requested

#### Scenario: Unknown role fails closed

- GIVEN an authenticated user has a missing, unknown, or non-manager membership role
- WHEN the user opens `/dashboard`
- THEN manager-home content and manager-summary data are unavailable

### Requirement: Truthful Manager Heading and Current Date
The manager home MUST use a personalized greeting based only on truthful authenticated identity as its content heading. It MUST display the real current calendar date formatted with locale `es-AR` and time zone `America/Argentina/Buenos_Aires`, and MUST NOT hardcode the reference date. Truthful seller-heading semantics elsewhere in the product MUST remain intact.

#### Scenario: Greeting renders the Argentina-local current date

- GIVEN a manager opens the dashboard at a known instant
- WHEN the manager-home heading is rendered
- THEN it identifies the authenticated manager truthfully and shows the calendar date for that instant in `es-AR` and `America/Argentina/Buenos_Aires`

#### Scenario: Date changes across calendar days

- GIVEN the same manager opens the dashboard on two different Argentina-local calendar days
- WHEN each heading is rendered
- THEN the displayed date reflects the respective current day rather than a fixed reference value

### Requirement: Reference-Faithful Manager Content Hierarchy
Within the existing application shell, the manager home MUST present a recognizable compact command-center hierarchy: the greeting and date, one dominant operational-summary region, a supported metric group, a truthful priority group, recent activity, top-property and top-seller rankings, and authorized shortcuts. The content MUST preserve clear grouping and emphasis suitable for scanning while adapting to supported viewport sizes and real content. It MUST NOT duplicate the reference mobile menu, notification badge, or bottom navigation, and it MUST omit the unsupported score/rating/trophy presentation.

#### Scenario: Manager sees the supported reference hierarchy

- GIVEN manager-home data is available
- WHEN an authorized manager views the dashboard
- THEN the supported regions appear in the specified scan order within the existing shell without reference-only mobile chrome or a score module

### Requirement: Operational Metrics and Selected-Window Semantics
The manager home MUST offer only the existing rolling windows `7d`, `14d`, and `30d` for operational summaries and MUST identify the selected window where it affects a label or result. It MUST present active properties as active, unarchived property engagements excluding closed and cancelled engagements; movements as movements created on active engagements during the selected window; stale properties as active engagements with no movement created during that window; and attention needed as active engagements whose latest in-window movement is an inquiry, completed visit, or received offer with no meaningful next step. These metrics MUST NOT be relabeled as unique properties, visits today, general alerts, or performance measures.

#### Scenario: Selected range controls metric meaning

- GIVEN a manager selects `14d`
- WHEN the operational metrics are displayed
- THEN movements, stale properties, and attention-needed results are identified and presented using the selected 14-day rolling window

#### Scenario: Metrics preserve their source meanings

- GIVEN the active tenant has active, closed, cancelled, stale, and attention-needed engagements
- WHEN the manager-home metrics are displayed
- THEN each metric includes only records matching its defined meaning and does not claim unsupported visits, alerts, or percentages

#### Scenario: No qualifying records has truthful labels

- GIVEN a successful summary has no qualifying records for one or more metrics in the selected window
- WHEN the metrics are displayed
- THEN each affected metric communicates a truthful no-data result without changing its defined meaning

### Requirement: Truthful Priorities, Activity, and Rankings
The manager home MUST present priorities only from the defined stale-property and attention-needed semantics. Recent activity MUST contain no more than the existing bounded set of newest permitted movement and document-request activity in the selected window and MUST preserve each item's real type, text, time, and engagement destination. Top properties MUST remain a bounded ranking of active engagements by in-window movement and permitted document-request activity. Top sellers MUST remain a bounded ranking by manual movements in the selected window and MAY show only real seller identity and counts supported by that ranking. Property, activity, and seller destinations MUST use real, existing authorized links when a destination is offered.

#### Scenario: Activity and rankings use permitted source records

- GIVEN the selected window contains permitted and excluded activity on active and inactive engagements
- WHEN the manager home renders recent activity and rankings
- THEN it shows only the bounded permitted records and rankings with their real source semantics

#### Scenario: Ranked property opens its real destination

- GIVEN a top-property or recent-activity row has an available authorized engagement destination
- WHEN the manager activates the row
- THEN the existing destination for that engagement is opened

#### Scenario: Empty activity remains distinct from a failure

- GIVEN the activity and ranking response succeeds with no qualifying records
- WHEN the related regions are rendered
- THEN they show a truthful empty state rather than fabricated activity, people, or rankings

### Requirement: Explicit Data States and Relevant Retry
Every applicable manager-home data group MUST visibly distinguish loading, successful content, true empty content, and failure. A failed summary MUST be shown as a summary failure and MUST NOT be represented as zero counters, an empty success state, or fallback values from another data group. When independently loaded groups are available, a failure in one group MUST remain local to that group while available groups remain visible without implying the failed group is empty. Each failed group MUST provide a retry that retries the relevant failed request.

#### Scenario: Loading values are not presented as facts

- GIVEN a manager-home data group is loading
- WHEN the dashboard is rendered
- THEN the group indicates loading and does not present placeholder counters or list entries as real data

#### Scenario: Summary failure is explicit

- GIVEN the manager summary request fails
- WHEN the dashboard is rendered
- THEN the summary region identifies the failure, does not show zero or empty success values in its place, and provides a retry for that summary request

#### Scenario: Independent failure remains local

- GIVEN the summary is available and an independently loaded manager-home group fails
- WHEN the dashboard is rendered
- THEN the available summary remains visible, the failed group identifies its own failure, and its retry targets that group

### Requirement: Authorized Existing Actions Only
The manager home MUST expose only destinations and actions that already exist and are authorized for the active user under the existing centralized capability and navigation policy. Property creation MUST be visible and actionable only when the active user has the existing property-creation permission. The home MUST NOT use a role-name check alone as authority for an action, and server-side authorization MUST remain authoritative.

#### Scenario: Permitted manager sees an existing property action

- GIVEN an allowed manager has the existing permission to create property engagements
- WHEN authorized shortcuts are rendered
- THEN the existing property-creation action may be offered alongside other existing authorized destinations

#### Scenario: User without creation permission cannot create a property

- GIVEN an allowed manager lacks the existing property-creation permission
- WHEN authorized shortcuts are rendered
- THEN the property-creation action is not offered

### Requirement: Unsupported Facts and Actions Are Absent
The manager home MUST NOT display or infer a general score, rating, trophy, visits-today total, generic alert total, periodic comparison delta, sent-message total, team-performance percentage, seller photo, invented task, invented person, or fabricated operational fact. It MUST NOT add or offer new client, agenda or visit scheduling, messaging or news, generic document-upload, reminder, notification-count, or alert-inbox capabilities. Free text MUST NOT be reinterpreted as structured facts.

#### Scenario: Reference-only concepts are omitted

- GIVEN a manager views a fully populated manager home
- WHEN the visible facts and shortcuts are inspected
- THEN no unsupported fact, reference-only score module, or forbidden action or domain is present

### Requirement: Accessible Responsive Manager Home
The manager home MUST use semantic controls with accessible names, visible keyboard focus, and a coherent keyboard traversal order. It MUST keep critical content and controls usable at supported narrow and desktop viewports. Long tenant, property, seller, and activity values MUST wrap or otherwise remain readable without obscuring critical information or making controls inaccessible. Meaning conveyed by visual grouping, icons, or color MUST remain understandable through labels and semantic content.

#### Scenario: Keyboard user reaches controls coherently

- GIVEN a keyboard-only manager uses the dashboard
- WHEN focus moves through the manager-home controls and links
- THEN focus is visible, each interactive element has an accessible name, and traversal follows the displayed content order

#### Scenario: Long content remains usable across critical viewports

- GIVEN manager-home content contains long tenant, property, seller, and activity values
- WHEN the dashboard is viewed at a critical narrow viewport and a critical desktop viewport
- THEN content remains readable and actionable without overlap, inaccessible controls, or loss of hierarchy

### Requirement: Protected Product Boundaries
This capability MUST preserve existing tenant isolation, authentication, selected-tenant behavior, backend authorization, and public routes. It MUST NOT change the owner home, the `AGENT` seller home, seller-property-proposal behavior owned by #306, or platform data-lane behavior owned by #327. It MUST consume only existing tenant-scoped dashboard information and MUST NOT imply or request platform health, synchronization, operator, or provider data.

#### Scenario: Protected surfaces remain unchanged

- GIVEN an owner, an agent, or a public user accesses their existing surface or route
- WHEN the manager-home capability is available
- THEN that surface and its authorization behavior remain unchanged

#### Scenario: Manager home remains tenant scoped

- GIVEN a manager changes the active tenant
- WHEN the manager home is rendered for each tenant
- THEN it presents only the existing authorized dashboard information for the selected tenant and no platform-data-lane information
