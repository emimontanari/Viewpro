# Proposal: Seller Home Reference Fidelity

## Decision

Redesign the authenticated `/dashboard` home only for an exact `AGENT` membership as a frontend-only, reference-faithful seller command center. The composition will use the two existing independent seller data contracts—assigned property engagements and permitted activity—without changing their authorization, tenant scope, or source meanings.

The home will greet the seller by the real authenticated display name and show the active tenant as adjacent context. It will adapt the reference hierarchy into truthful KPI cards, a compact non-checkable priorities list based only on the supported attention and stale aggregates, assigned-property content, recent activity, and existing authorized property/follow-up links.

Visual fidelity is subordinate to data truthfulness and authorization. Unsupported reference modules and actions will be omitted rather than simulated. Manager, owner, public/auth, tenant-selection, BFF/API, seller-proposal (#306), platform-data-lane (#327), and application-shell behavior remain protected and unchanged.

## Problem and Current-State Gap

The current seller home exposes useful assigned-property and activity data, but it does not deliver the compact, scan-first hierarchy approved in issue #523 and shown in the stored reference. Sellers must work through a comparatively generic composition instead of seeing their real portfolio context, supported follow-up signals, and recent activity with the intended emphasis.

The current state handling can also misrepresent unavailable data as a healthy zero or empty result. Product and activity requests are independent, yet failed responses can currently be normalized into zero counters, an empty assigned-property list, or “no recent movements.” This prevents sellers from distinguishing no work from a loading, authorization, network, or service failure and provides no relevant retry path.

A literal copy of the reference would create a different and misleading problem. The existing seller contracts do not support the reference's task checklist, calls, contacts, agenda, messages, visits-today total, property creation, proposal count, photos, price changes, weekly performance, completion percentage, alerts, badge count, or global quick-management action. The change must therefore preserve the reference's hierarchy and visual language while showing only real, authorized facts.

## Goals

1. Give authenticated sellers a recognizable, compact command-center home within the existing application shell.
2. Personalize the greeting from the authenticated real display name while keeping the active tenant visible as adjacent context.
3. Present assigned engagements, rolling-24-hour movements, attention-needed engagements, seven-day stale engagements, and recent permitted activity with their precise source meanings.
4. Present the attention and stale aggregates as a short, non-checkable priorities list without implying individual tasks, deadlines, or completion state.
5. Keep independent product and activity loading, empty, error, partial-availability, retained-data, and retry states honest and local to the affected data group.
6. Provide only existing authorized navigation to assigned property engagements, the property list, and follow-up activity.
7. Establish bounded seeded proof for responsive behavior and accessibility in addition to deterministic component-level behavior evidence.

## Non-Goals

- No backend, BFF, API, Prisma, database, generated-contract, or schema change.
- No direct property creation for sellers and no seller proposal entry, count, status, terminology, or lifecycle behavior owned by #306.
- No global movement, “quick management,” or create action. Movement creation remains available only from an authorized assigned-property context.
- No task model, checklist completion, deadlines, reminders, agenda, visit scheduling, clients, contacts, calls, messages, WhatsApp actions, photos, price changes, response metrics, performance scores, percentages, alerts, or notification badges.
- No fabricated people, events, images, counts, statuses, comparisons, or operational outcomes.
- No manager or principal-manager home changes and no use of manager-summary data or manager-only presentation facts.
- No owner-home, public-route, authentication, selected-tenant, authorization, navigation-policy, or platform-data-lane change.
- No duplicate mobile header, bottom navigation, sidebar, KBar, or other application-shell replacement.
- No reinterpretation of stored free text as structured tasks, people, dates, outcomes, or actions.
- No decision in this phase about the exact implementation or PR placement of the required seeded browser proof; that belongs to task planning.

## User Value and Product Outcome

This change serves authenticated `AGENT` users at the moment they enter the active tenant workspace and need to decide where to focus. After the change, a seller can:

1. confirm their identity and active tenant immediately;
2. scan the size of their assigned engagement portfolio and the exact activity signals currently supported;
3. recognize whether attention or stale follow-up exists without mistaking aggregate signals for personal tasks;
4. review bounded real activity and assigned properties;
5. continue through existing authorized property and follow-up destinations; and
6. understand when each data group is loading, truly empty, unavailable, partially available, or ready.

The intended experience is visually close to the reference in hierarchy, density, grouping, rounded card treatment, semantic accents, and scan order, while remaining explainable from existing data contracts.

## Scope

### In Scope

- Recomposition of only the exact `AGENT` branch of authenticated `/dashboard`.
- A personalized greeting sourced from authenticated display identity, with active tenant context shown alongside it.
- A compact KPI group using only:
  - assigned active/unarchived engagement total from the product response;
  - movements in the rolling previous 24 hours from activity counters;
  - the narrow attention-needed engagement count from activity counters; and
  - engagements with no movements in the rolling previous seven days from activity counters.
- A compact priorities region containing exactly the supported attention and stale aggregate meanings as non-checkable rows.
- A bounded preview of real assigned engagements with safe existing engagement destinations.
- A bounded newest-first recent-activity region using permitted real movement and document-request items.
- Existing authorized navigation to `/dashboard/product`, assigned engagement detail, and `/dashboard/seguimiento`.
- Explicit and independent loading, true-empty, failure, partial-availability, retained-data/background-refresh, and relevant retry presentation for the product and activity groups.
- Responsive and accessible adaptation for narrow and desktop layouts, long real text, keyboard use, visible focus, semantic labels, and non-color-only meaning.
- Deterministic behavior evidence plus bounded seeded responsive/accessibility proof; task planning will choose the smallest independently reviewable slice for that browser evidence.

### Out of Scope

- New seller data aggregates or a combined seller-summary endpoint.
- Calendar-day “today” semantics for the existing rolling-24-hour movement count.
- Any action that lacks an existing authorized route and required engagement context.
- Changes to property creation, property mutation, status, image, price, document-request, or proposal workflows.
- Changes to centralized role/capability navigation beyond consuming existing destinations.
- Changes to manager, principal-manager, owner, operator, platform, public, or authentication experiences.
- Changes to the existing shell or global navigation behavior.

## Data Truthfulness Contract

The seller home will consume the existing product and activity responses as independent sources. Neither source may fill, default, or conceal the unavailable facts of the other.

| Visible fact | Required meaning | Prohibited interpretation |
| --- | --- | --- |
| Assigned engagements | Total active/unarchived property engagements in the selected tenant to which the authenticated seller is assigned. This is an engagement count, and the product contract does not additionally exclude closed or cancelled statuses. | All tenant properties, unique physical properties, personal listings created, available inventory, or an active-status-only count. |
| Movements in the last 24 hours | Movement records created in `[now − 24 hours, now)` on visible active engagements. Document-request activity is not counted. | “Today,” calendar-day activity, consultations, calls, visits, contacts, messages, or all activity kinds. |
| Require follow-up | Visible active engagements whose latest movement, without a time-window restriction, is `INQUIRY`, `VISIT_COMPLETED`, or `OFFER_RECEIVED` and whose `nextStep` is null or blank after trimming. | General alerts, all missing next steps, pending tasks, overdue work, or an inbox count. |
| No movements in the last 7 days | Visible active engagements with no movement in `[now − 7 days, now)`. Permitted document-request activity does not reset this counter. | All stale properties, seven calendar days, pending tasks, neglected clients, or inactivity based on every activity kind. |
| Recent activity | No more than the existing requested bound of newest permitted movement and document-request items, ordered by the source response and preserving real kind, structured movement type where available, stored text, time, and engagement identity. | Invented calls, WhatsApp replies, photo uploads, price changes, visits, people, outcomes, tasks, or inferred structured facts. |
| Assigned-property preview | Up to the existing requested bound of real assigned engagement rows using available title, address, status, optional image, and engagement identity in their existing context. | A fabricated portfolio, unassigned inventory, proposal queue, or permission to mutate the property. |

`nextStep` and `observation` remain optional free text. They may be displayed as stored prose with truthful fallbacks, wrapping, and truncation treatment where necessary, but they must not be parsed into a task title, person, deadline, priority, reminder, visit, call, or completion status.

Malformed, blank, or missing engagement identifiers must fail closed for navigation. Such content may remain readable when otherwise valid, but it must not generate an unsafe or broken detail link.

## State and Resilience Contract

Products and activity are separate tenant-scoped queries and must remain separately understandable:

- **Loading:** A group that has no available result communicates loading and does not present placeholder counters or rows as facts.
- **Successful empty:** Only a successful zero-product response may claim that the seller has no assigned properties. Only a successful empty activity response may claim there is no recent permitted activity.
- **Failure:** A failed group identifies that its data is unavailable and never substitutes zero counters, an empty list, or another query's values.
- **Partial availability:** If one query succeeds and the other fails, successful content remains visible while the failure stays local. The page must not imply that the unavailable group is empty.
- **Retry:** Each failed group provides an accessible retry that refetches only the relevant request.
- **Retained data and refresh:** When previously successful data remains visible during a background refresh, the presentation must distinguish refresh state consistently without discarding valid data or presenting stale data as a newly confirmed result.
- **Tenant transition:** Query ownership remains keyed to the active tenant. No content from a prior tenant may be presented as the current tenant's result during selection changes.
- **Long or partial content:** Long tenant names, display names, property text, activity observations, and next steps remain readable without overlap or inaccessible controls. Missing optional fields receive neutral labels rather than invented detail.
- **Time display:** Any rendered activity time uses deterministic existing Argentina-oriented formatting behavior or an equivalently tested safe formatter. Malformed times do not produce fabricated dates.

Client state handling does not replace server authorization. Authentication, selected-tenant verification, active membership, tenant isolation, seller assignment predicates, and permission checks remain authoritative on every request.

## Reference Adaptation

The authoritative visual reference is `openspec/changes/seller-home-reference-fidelity/assets/seller-home-reference.jpeg`, supplied with SHA-256 `68be53e4ae82e74c24b94fc638ccda5e6d6628d0e1e3cef908a9922f4f46d10c`.

Within the existing application shell, the seller content should preserve this scan order and emphasis:

1. personalized seller greeting with adjacent active-tenant context;
2. compact supported KPI group;
3. short non-checkable priorities list for attention and stale aggregates;
4. bounded assigned-engagement preview;
5. bounded real recent activity;
6. compact existing property and follow-up destinations.

The implementation may adapt exact dimensions, columns, stacking, and spacing to supported viewports, localization, accessibility, and real text lengths. It should preserve the reference's compact cards, rounded surfaces, clear grouping, semantic accent colors, icon roles, and high information density where those choices do not imply unsupported meaning.

| Reference module | Adaptation decision |
| --- | --- |
| Brand/header and greeting | Keep the canonical shell. Adapt only the content greeting using real authenticated display name and adjacent active tenant; do not duplicate profile or mobile header chrome. |
| Four metric cards | Adapt to the four supported facts with exact rolling-window and engagement meanings. |
| “My priorities today” checklist | Replace with two non-checkable aggregate rows for attention and seven-day stale meanings. Do not use “today,” checkboxes, people, times, tasks, or deadlines. |
| Create-property action | Omit. Exact `AGENT` lacks direct canonical creation authority, and #306 remains separate. |
| Quick-management strip | Omit. There is no authorized context-free movement, call, WhatsApp, visit, photo, price, or observation action. |
| Recent-activity timeline | Adapt from real bounded permitted activity only, with safe property destinations where a valid engagement ID exists. |
| Weekly performance card | Omit because no supported seller performance, visit, contact, response, or completion aggregate exists. |
| Quick access | Adapt only to existing property and follow-up routes available to the seller. |
| Notification badge and bottom navigation | Omit because the home has no unread-count contract and the application shell owns navigation. |
| Sample people, images, statuses, and counts | Omit unless the exact fact is present in its existing authorized product or activity row context. |

## Dependencies and Protected Boundaries

| Boundary | Required preservation |
| --- | --- |
| Exact role dispatch | Only exact `AGENT` receives this seller composition. Exact `MANAGER` and `PRINCIPAL_MANAGER` continue to receive the completed canonical `crm-manager-home`; unknown or missing roles continue to fail closed. The seller branch must not request manager-summary data. |
| Manager capability | `openspec/specs/crm-manager-home/spec.md` is a protected role boundary only. Its manager data, selected windows, rankings, controls, date treatment, and state composition are not source facts or a template for this seller home. |
| Owner surfaces | Owner home, owner engagement scope, owner activity/documents, owner routing, and canonical owner contracts remain unchanged. |
| Authentication and public routes | Existing proxy protection, session behavior, sign-in/auth flows, public pages, and public error behavior remain unchanged. |
| Tenant scope and authorization | Active-tenant selection, BFF tenant forwarding, `TenantMembershipGuard`, permission guards, tenant isolation, and assigned-engagement visibility remain authoritative and unchanged. Frontend `tenantId` usage remains query-cache ownership, not authorization. |
| BFF and API | Existing `/api/products` and `/api/activity/feed` adapters and their backend endpoints, filters, response shapes, and semantics remain unchanged. No combined seller-summary request is introduced. |
| #306 seller property proposals | Proposal entry, drafting, review, counts, routes, permissions, and lifecycle remain wholly outside this home change. No proposal CTA or indirect creation path is added. |
| #327 platform data lane | No platform health, synchronization, demand, operator, provider, topology, or polling data is requested or implied. |
| Application shell | Existing sidebar, header, KBar, navigation groups, responsive chrome, and route ownership remain unchanged. The page does not add a second shell or bottom navigation. |
| Property-contextual movement flow | Existing movement creation remains reachable only after opening an authorized assigned engagement and remains governed by current server permissions and visibility checks. |

The proposal depends on the existing authenticated display identity, active-tenant context, assigned-products query, activity-feed query/counters, safe engagement destination behavior, and current centralized navigation policy being available as documented in exploration. Discovery of a genuine contract gap is a scope escalation requiring an accepted proposal update before any BFF or API work.

## Affected Areas

| Area | Proposed impact |
| --- | --- |
| Seller home capability | Define a truthful reference-adapted experience for exact `AGENT` memberships in a later change-local specification. |
| Authenticated dashboard composition | Recompose only the existing seller branch while preserving manager dispatch and fail-closed unsupported roles. |
| Seller product presentation | Present existing assigned engagement totals and preview rows with honest independent states and safe links. |
| Seller activity presentation | Present existing counters and bounded recent activity with exact semantics, independent states, and relevant retry. |
| Frontend accessibility and responsiveness | Add focused evidence for semantic controls, keyboard order, visible focus, long-text behavior, and critical narrow/desktop layouts. |

No canonical specification, backend capability, persistent data, authorization rule, route contract, or shell behavior is expected to change during this proposal.

## Delivery Risks and Mitigations

| Risk | Product impact | Mitigation |
| --- | --- | --- |
| Visual fidelity encourages unsupported modules | Sellers could see fabricated work or unauthorized actions. | Bind every region to the adaptation table and assert that unsupported actions, facts, and domains are absent. |
| Counter labels drift from source semantics | Rolling windows or narrow aggregates could be mistaken for today, tasks, or alerts. | Preserve the exact 24-hour, seven-day, latest-movement, active-engagement, and movement-only meanings in labels and later acceptance tests. |
| Independent failures look like zero work | Sellers could make decisions from an outage disguised as an empty tenant. | Require local loading/error/empty/partial/retry states and prohibit cross-query fallback. |
| Role isolation regresses | Agents could request manager data or another role could receive seller content. | Keep exact role dispatch, fail closed, and prove manager-summary requests are absent for `AGENT`. |
| A shortcut broadens permission | A seller could be led toward unsupported create or mutation behavior. | Reuse only existing authorized property/follow-up destinations; require engagement context for movement creation; preserve server checks. |
| Tenant changes expose retained content | Data from one tenant could appear under another tenant's heading. | Preserve tenant-scoped query ownership and verify transition/loading behavior without cross-tenant fallback. |
| Malformed IDs create unsafe links | Activity or property rows could navigate to invalid destinations. | Fail closed when constructing engagement links and leave non-link content semantically readable where valid. |
| Dense layout harms accessibility | Long real content could overlap, truncate essential meaning, or disrupt keyboard use. | Require semantic controls, visible focus, coherent source-order traversal, readable wrapping, and bounded seeded critical-width proof. |
| Frontend work expands into API or adjacent capabilities | Review scope and protected contracts could become coupled. | Treat any data-contract insufficiency as a proposal escalation; preserve BFF/API/#306/#327/manager/owner/shell boundaries. |
| Seeded proof becomes an oversized delivery slice | Review quality could decline or behavior work could be coupled to broad E2E changes. | Require the proof but defer its smallest exact slice to task planning under the configured review budget. |

## Rollout and Rollback

Rollout is a seller-home frontend presentation change. It should proceed only after focused deterministic evidence proves exact-role isolation, truthful metric wording, independent data states, local retries, safe navigation, and forbidden-content absence, and after bounded seeded evidence proves the required responsive and accessibility behavior against real authorized seller data.

No migration, backend deployment, data rewrite, permission change, or route rollout is planned. Existing product and activity contracts remain the runtime source of truth.

If the redesign causes fidelity, state, accessibility, or navigation regressions, revert the seller composition and its seller-specific presentation/state support together to the prior seller home. Rollback must leave the manager and owner homes, public/auth behavior, selected-tenant and server authorization, BFF/API contracts, #306 and #327 behavior, application shell, routes, and stored data unchanged. No data repair is required because this change creates no persistent-data transformation.

## Acceptance Outline

- [ ] Only an exact authenticated `AGENT` membership receives the redesigned seller home; manager roles retain the protected manager home, unknown roles fail closed, and the seller branch never requests manager-summary data.
- [ ] The greeting uses the authenticated real display name and presents the active tenant as adjacent context without duplicating application-shell identity chrome.
- [ ] The seller home is recognizably faithful to the stored reference's hierarchy, compact density, grouping, rounded surfaces, semantic accent treatment, and scan order within the existing shell.
- [ ] Assigned engagements are labeled as the seller's assigned engagement/property work and are not represented as universal inventory or unique physical assets.
- [ ] The movement counter explicitly means the rolling last 24 hours, not “today,” and counts movements rather than document requests, calls, visits, contacts, or all activity.
- [ ] The stale counter explicitly means no movements in the rolling last seven days, and permitted document activity is not claimed to reset it.
- [ ] The attention counter retains its narrow latest-movement-type plus blank-next-step meaning and is not presented as a general task or alert count.
- [ ] The priorities region contains the attention and stale aggregates as compact non-checkable rows with no invented individual tasks, people, deadlines, due times, reminders, or completion controls.
- [ ] Recent activity contains only the existing bounded newest permitted real movement/document items and preserves available source kind, text, time, and safe engagement destination.
- [ ] Assigned-property rows and activity rows construct detail links only from valid real engagement IDs and fail closed for malformed or blank IDs.
- [ ] Product and activity loading, successful-empty, failure, partial-availability, retained-data refresh, retry, and success states remain distinct; no failed group appears as zero or empty success.
- [ ] Each retry refetches only its relevant failed query, while successful independent content may remain visible.
- [ ] A successful zero-product result is the only basis for “no assigned properties,” and it does not offer direct property creation.
- [ ] Only existing authorized property-list, engagement-detail, and follow-up navigation is exposed; no global movement or unsupported create/mutation action appears.
- [ ] No proposal, task, agenda, client, contact, call, message, WhatsApp, visit, photo, price-change, performance, percentage, alert, badge, or duplicate mobile-shell module is introduced.
- [ ] Long identity, tenant, property, observation, and next-step text remains readable; optional or malformed values do not create fabricated detail.
- [ ] Interactive elements have semantic accessible names, visible focus, and coherent keyboard traversal, and visual meaning is not conveyed by color or icons alone.
- [ ] Bounded seeded proof covers the agreed responsive/accessibility risks at critical narrow and desktop layouts; task planning defines the exact independently reviewable browser slice.
- [ ] Existing authentication, public routes and errors, active-tenant selection, tenant isolation, BFF/API behavior, server authorization, and query semantics remain unchanged.
- [ ] Manager, owner, #306 seller-property-proposal, #327 platform-data-lane, and application-shell behavior remain unchanged.
- [ ] Delivery remains frontend-only unless a separately accepted proposal update establishes a genuine contract gap.

## Explicit Assumptions

- Issue #523 is approved and is the product authority for this seller-home fidelity change.
- The pre-proposal gate is complete; `greeting:personalized` and `priority:short-list` are confirmed decisions rather than open alternatives.
- The supplied reference asset and repository evidence are sufficient; the research lane remains unselected and no external research is needed.
- Authenticated display identity and active-tenant context remain available to the seller composition.
- The existing product request remains bounded to six assigned active/unarchived engagement rows and provides the total used by the home.
- The existing activity request remains bounded to six newest permitted items and returns the rolling-24-hour, stale, and attention counters together; those counters are unavailable as a successful partial activity payload.
- Products and activity remain independent requests with tenant-scoped query ownership and no combined seller-summary endpoint.
- Existing server guards continue to enforce active membership, selected tenant, permissions, tenant isolation, and seller assignment independently of frontend rendering.
- Existing property-detail and follow-up routes remain the only seller-home destinations needed for this slice.
- Spanish visible copy may follow current product conventions, while technical artifacts remain in English.
- Strict TDD applies in later implementation phases.
- Responsive/accessibility seeded proof is mandatory, but its exact file placement and delivery slice are intentionally deferred to task planning.
- Any newly discovered need for backend data, a new route, a global action, calendar-day semantics, or proposal integration is outside this proposal and requires explicit scope acceptance.

## Evidence and Authority

- Product authority: GitHub issue #523 contract supplied through the exploration context.
- Confirmed decisions: `openspec/changes/seller-home-reference-fidelity/preproposal.md`.
- Repository and contract evidence: `openspec/changes/seller-home-reference-fidelity/exploration.md`.
- Visual evidence: `openspec/changes/seller-home-reference-fidelity/assets/seller-home-reference.jpeg`, SHA-256 `68be53e4ae82e74c24b94fc638ccda5e6d6628d0e1e3cef908a9922f4f46d10c`.
- Protected manager-role boundary only: `openspec/specs/crm-manager-home/spec.md`.
- Execution source of truth: `docs/plans/2026-07-20-recta-final-execution.md`.

## Proposal Decision Status

The confirmed pre-proposal gate resolves the product question round for this phase. The target user, role boundary, business outcome, greeting, priority shape, supported facts, state semantics, reference adaptation, required browser evidence, authorized destinations, frontend-only scope, and protected domains are fixed. This proposal does not infer additional consent. Any later discovery that requires new data, permissions, actions, or adjacent-capability work must return through an explicit scope decision rather than silently expanding implementation.
