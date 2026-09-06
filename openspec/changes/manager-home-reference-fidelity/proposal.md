# Proposal: Manager Home Reference Fidelity

## Decision

Introduce a new `crm-manager-home` capability that redesigns the authenticated `/dashboard` home only for exact `MANAGER` and `PRINCIPAL_MANAGER` memberships. The home will follow the supplied reference's hierarchy, spacing, card density, semantic color and icon roles, and responsive behavior as closely as the existing application shell and truthful authorized data allow.

The redesign will use the current tenant-scoped dashboard data contracts without inventing scores, alerts, tasks, people, actions, or performance claims. `AGENT` keeps the existing seller home. Owner surfaces, seller proposal work in #306, and the platform data lane in #327 remain separate and unchanged.

## Problem and Current-State Gap

The current manager home exposes useful operational data, but its hierarchy does not match the approved compact command-center reference. Managers cannot scan the most important tenant activity, priorities, rankings, and supported actions with the intended visual emphasis and density.

The current presentation also has false-success paths. A failed summary can appear as zero counters or empty lists, and an independent property result can conceal that the summary failed. This makes an outage or authorization/data problem look like a healthy tenant with no work.

A literal copy of the reference would be misleading because ViewPro does not currently provide several facts shown in the image, including a general agency score, today's visits, generic alert totals, periodic deltas, sent-message totals, team performance percentages or photos, invented pending tasks, and several depicted actions. The redesign must improve fidelity without fabricating those facts or broadening access.

## Intent and Target Users

This change serves authenticated managers and principal managers when they open the tenant dashboard to understand current operational work and choose a supported next action.

The intended outcome is a calm, high-density manager command center where a user can:

1. recognize the active tenant context and current date immediately;
2. scan truthful operational counters for a selected supported window;
3. distinguish priorities from normal activity;
4. review recent activity and the most active properties and sellers;
5. follow only existing, authorized destinations and actions; and
6. understand whether each block is loading, empty, unavailable, or ready without failures being represented as zero.

## Proposed Capability

The spec phase will add a delta specification for the new capability `crm-manager-home` under this change. It will define the manager-home role boundary, truthful metric semantics, visible hierarchy, state behavior, supported actions, accessibility, and responsive fidelity.

This proposal does not modify canonical specifications. Any later consolidation into canonical specs belongs to the archive/consolidation lifecycle after the change is accepted and implemented.

## Product Rules

### Role and authorization boundary

- Only exact roles `MANAGER` and `PRINCIPAL_MANAGER` receive the redesigned manager home.
- `AGENT` retains its current separate seller home, query behavior, and content.
- Any other or unknown membership role must fail closed rather than receive manager content.
- Frontend role composition is a user-experience boundary, not authorization. Existing tenant selection, authentication, permissions, BFF behavior, and backend authorization remain authoritative.
- Supported shortcuts must follow existing centralized capability and navigation policy rather than role-name checks alone.

### Supported-data policy

Every visible fact must come from current, tenant-authorized contracts or deterministic calendar formatting:

| Data | Permitted meaning |
| --- | --- |
| Active properties | Count of active, unarchived property engagements whose status is neither closed nor cancelled; it is not a unique physical-property count. |
| Movements in range | Movements created during the selected rolling `7d`, `14d`, or `30d` window on active engagements; it is not a today-only count or a progress percentage. |
| Stale properties | Active engagements with no movement created in the selected window. |
| Attention needed | Active engagements whose latest in-window movement is an inquiry, completed visit, or received offer and has no meaningful next step; it is not a general alert inbox. |
| Recent activity | Up to the existing bounded set of newest permitted movement and document-request activity in the selected window, preserving real type, text, time, and engagement destination. |
| Top properties | The existing bounded ranking of active engagements by in-window movement and permitted document-request activity; counts must not be presented as performance percentages. |
| Top sellers | The existing bounded ranking based on manual movements in the selected window; names and real counts may be shown, but not active-team totals, photos, ratings, or percentages. |
| Current date | The real current calendar date, formatted deterministically using locale `es-AR` and time zone `America/Argentina/Buenos_Aires`; it must never be hardcoded to the reference date. |

The home must omit unsupported general scores, ratings, visits-today totals, generic alert totals, comparison deltas, sent-message totals, team-performance percentages or photos, invented pending tasks, and unsupported actions or domains. Free text must not be reinterpreted to manufacture structured facts.

### State and failure semantics

- Loading treatment must not present placeholder values as real facts.
- A successful response with no records must produce an explicit, truthful empty state appropriate to that block.
- A failed summary is a summary failure, not a successful zero-value or empty response.
- Independently loaded groups, if retained, must keep failures local and identify the affected block; available data may remain visible without implying that unavailable data is empty.
- Every failed data group must expose a retry that retries the relevant request.
- Missing or failed summary counters must not fall back to a separate count in a way that conceals the failure.
- No-data, loading, error, partial availability, and success must remain distinguishable.

## Visible Hierarchy and Fidelity Boundary

The stored asset `assets/manager-home-reference.jpeg` is the authoritative visual reference for this change. Its supplied SHA-256 is `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`.

Within the existing application shell, the redesigned manager content should preserve this recognizable order and emphasis:

1. a branded manager greeting using truthful authenticated identity and the deterministic current date;
2. one dominant operational-summary region without the unsupported reference score;
3. a compact metric group using only supported active-property, movement, stale, and attention meanings;
4. a truthful priority group based only on supported stale and attention semantics;
5. recent activity for the selected supported range;
6. top-property and top-seller activity rankings using their existing meanings;
7. a compact group of existing, authorized destinations or actions.

The personalized manager greeting is the content heading. Seller-heading semantics must remain truthful and must not be removed globally merely to avoid a duplicate manager title.

The implementation may adapt exact dimensions, wrapping, stacking, and grid columns to the existing shell, supported viewports, localization, accessibility needs, and real-world text lengths. It must preserve hierarchy, grouping, semantic color/icon roles, readable labels, keyboard order, accessible names, and wrapping for long tenant, property, seller, and activity values.

The current shell remains the canonical navigation surface. The redesign must not duplicate the reference's mobile menu, notification badge, or bottom navigation.

## Scope

### In Scope

- Redesigning only the manager/principal-manager `/dashboard` content composition.
- Making the exact manager-role allowlist fail closed while preserving the separate `AGENT` branch.
- Presenting a personalized manager greeting and deterministic Argentina-local current date.
- Presenting truthful supported counters, priorities, recent activity, top properties, and top sellers with documented window and no-data semantics.
- Exposing only existing, authorized property, follow-up, and team destinations or actions, including property creation only when current permission policy permits it.
- Providing explicit loading, empty, error, partial-availability, and relevant retry behavior.
- Adapting the reference hierarchy and visual language responsively within the current application shell.
- Verifying role isolation, state semantics, metric wording, action authorization, accessible keyboard order, wrapping, and critical responsive widths.

### Out of Scope

- Any owner-home change, including the canonical `owner-portal-home` capability and its engagement-scoped behavior.
- Any redesign or behavior change for the `AGENT` seller home.
- Any new API, BFF, repository, database, schema, generated contract, authentication, authorization, tenant-selection, or public-route behavior unless a later accepted design proves the current contracts insufficient.
- General agency scores, ratings, trophies, benchmarks, visits-today totals, generic alerts, periodic deltas, sent-message totals, performance percentages, seller photos, invented people, or fabricated tasks.
- New client, agenda/visit, messaging/news, generic document-upload, reminder, notification-count, or alert-inbox capabilities.
- Duplicating or redesigning the application shell, sidebar, header, global navigation, KBar, notification route, or mobile bottom navigation.
- Changing property, follow-up, team, workspace, status-change-request, or tenant-settings workflows reached from the home.
- Treating presentation role checks as a replacement for server-side permission enforcement.

## Protected Boundaries

### Owner home

The owner portal and canonical `owner-portal-home` contract remain unchanged. This change must not alter owner cards, engagement scoping, activity, documents, agency contact, movement contact, routing, or owner state behavior.

### Seller home

`AGENT` retains the existing seller home and must not request or render manager summary data. Seller headings, content, queries, routes, and supported actions remain unchanged except for regression proof that role isolation still holds.

### #306 — seller property proposals

The #306 proposal domain owns seller draft/submit/edit/resubmit behavior, manager proposal review, approval/rejection, proposal counts and routes, and canonical materialization. This manager-home change must not add proposal cards, counts, priorities, shortcuts, terminology, permissions, API calls, or lifecycle behavior. Existing direct manager property creation remains only an already-authorized action.

### #327 — platform data lane

The #327 platform data lane owns InmoView-to-platform synchronization, cursor and ingest state, operator metrics, demand, topology, and provider evidence. This home must use only existing tenant-scoped InmoView dashboard contracts. It must not query platform metrics, create synchronization demand, alter polling or configuration, or imply platform health or alerts.

## Affected Capabilities and Areas

| Capability or area | Proposed impact |
| --- | --- |
| New `crm-manager-home` capability | Define exact manager roles, hierarchy, truthful metrics, states, authorized actions, accessibility, and responsive fidelity in a change-local delta spec. |
| Authenticated dashboard composition | Select the redesigned manager home only for `MANAGER` and `PRINCIPAL_MANAGER`, retain `AGENT`, and fail closed for other roles. |
| Existing dashboard summary consumption | Present current tenant-scoped counters, activity, and rankings without changing their source meanings or masking failures. |
| Existing application navigation policy | Reuse only destinations and actions already available to the active user; do not create new domains. |
| Frontend verification | Add deterministic component evidence for roles and states plus bounded seeded browser evidence for real-data hierarchy, keyboard order, wrapping, and critical responsive widths. |

No canonical capability, backend contract, persistent data, or public route is expected to change.

## Dependencies and Assumptions

- The supplied reference asset and repository contracts are sufficient; no external research is required.
- Existing dashboard summary, activity, products, session, permission, and navigation contracts provide the authorized data needed for this product slice.
- Existing dashboard range options remain `7d`, `14d`, and `30d`; this proposal does not add another analytics window.
- The existing app shell remains in place and owns navigation chrome.
- Delivery is frontend-only unless a later design demonstrates a specific contract gap. Such a gap is a scope escalation and requires an accepted proposal/design update before backend work.
- Strict TDD applies to implementation work. Component tests provide deterministic role, loading, empty, error, partial-availability, retry, metric, and action evidence; seeded browser proof remains bounded to real-data hierarchy and browser-only interaction/layout risks.

## Staged Delivery Assumptions

The work will be planned as independently green, reviewable slices. Every PR, including planning-only work, must remain at or below 400 changed lines with no exception. When multiple PRs are required, they use `stacked-to-main` sequencing against `develop`.

Expected planning units are:

1. **Planning contract** — proposal, `crm-manager-home` delta spec, design, and tasks without source changes.
2. **Manager state and role foundation** — strict-TDD coverage for exact-role routing, explicit state semantics, failure visibility, and retry behavior.
3. **Reference hierarchy** — strict-TDD coverage and the truthful responsive manager composition, including supported actions.
4. **Bounded browser proof** — seeded real-data assertions for hierarchy, keyboard order, wrapping, and critical responsive widths when not already covered in a prior slice within budget.

These are planning assumptions, not implementation details or a fixed PR count. Later design and task forecasting may refine slice boundaries, but no slice may exceed the review budget or become non-green in isolation.

## Risks and Mitigations

| Risk | Product impact | Mitigation |
| --- | --- | --- |
| Visual fidelity encourages unsupported facts | Managers could make decisions from fabricated or mislabeled data. | Bind every displayed fact to the supported-data policy, omit unsupported modules, and verify forbidden claims do not appear. |
| Role selection is too broad | Another role could see manager data or controls. | Use the exact two-role allowlist, fail closed otherwise, preserve backend guards, and retain seller isolation evidence. |
| Failures appear as zero or empty | Managers may believe an outage means there is no work. | Require explicit block states and relevant retry behavior; prohibit cross-query fallback that conceals failure. |
| Metric labels drift from backend meaning | Users may interpret movements as visits, stale work as alerts, or rankings as performance. | Encode exact semantics, selected windows, timezone, and no-data behavior in the delta spec and focused tests. |
| Dense cards reduce accessibility or responsive usability | Long real data may truncate, reorder, or make controls hard to use. | Preserve semantic controls, accessible names, visible keyboard order, wrapping, and bounded proof at critical widths. |
| Quick actions broaden product scope or permission | Users may see unsupported or unauthorized operations. | Reuse only current destinations under centralized capability/navigation policy and omit reference-only actions. |
| Scope collides with owner, seller, #306, or #327 work | Independent contracts could regress or become coupled. | Keep explicit protected boundaries and use only current manager tenant analytics. |
| A broad visual rewrite exceeds review capacity | Review quality and independent rollback could suffer. | Keep each planning and implementation slice independently green and at or below 400 changed lines, stacked against `develop` when needed. |

## Rollout and Rollback

Roll out as a manager-home frontend presentation change after focused tests prove role isolation, truthful state handling, metric/action semantics, and accessibility, and after bounded seeded browser evidence proves real-data hierarchy and critical responsive behavior. No data migration, backend deployment, or canonical-spec edit is planned.

If the redesign causes usability, accessibility, fidelity, or reliability regressions, revert the manager-home presentation and its manager-only state composition together, restoring the previous manager home. Preserve the seller home, owner home, application shell, existing routes, authorization, tenant isolation, query contracts, and stored data. Because this change introduces no persistent-data transformation, rollback requires no data repair.

## Success Criteria

- [ ] Only exact `MANAGER` and `PRINCIPAL_MANAGER` memberships receive the redesigned home; `AGENT` retains its current home and other roles fail closed.
- [ ] The personalized manager greeting is the content heading and uses truthful authenticated identity without globally deleting truthful seller-heading semantics.
- [ ] The current date is real rather than hardcoded and is formatted deterministically with `es-AR` and `America/Argentina/Buenos_Aires`.
- [ ] The manager home is recognizably faithful to the stored reference in hierarchy, spacing, card density, semantic color/icon roles, and responsive behavior within the existing shell.
- [ ] Active properties, movements, stale properties, attention needed, recent activity, top properties, and top sellers retain their documented source semantics, supported window, and no-data meaning.
- [ ] No general score, visits-today count, generic alert count, periodic delta, sent-message total, performance percentage/photo, invented task, person, action, or domain is displayed.
- [ ] Loading, true empty, error, partial availability, retry, and success are explicit for each applicable data group, and failures never appear as zero or empty success.
- [ ] Every retry invokes the relevant failed data request rather than navigating to an unrelated destination.
- [ ] Every visible action or destination already exists and is shown only when current authorization/navigation policy permits it.
- [ ] Long tenant, property, seller, and activity content wraps readably; controls retain labels, accessible names, semantic operation, and coherent keyboard order at critical supported widths.
- [ ] Bounded seeded browser proof uses real authorized data to verify hierarchy, keyboard order, wrapping, and responsive behavior; deterministic component tests cover loading, empty, error, partial-availability, and retry states.
- [ ] Existing tenant isolation, authentication, backend authorization, selected-tenant handling, public routes, and application shell behavior remain unchanged.
- [ ] Owner home, seller home, #306 proposal behavior, and #327 platform data-lane behavior remain unchanged.
- [ ] Delivery remains frontend-only unless a separately accepted scope update establishes that current contracts are insufficient.
- [ ] Every planning and implementation PR is independently green, reviewable, and no larger than 400 changed lines; required slices are stacked against `develop`.

## Proposal Question Round

The confirmed pre-proposal handoff resolves the product question round for this phase. It fixes the business outcome, exact target roles, truthful-data policy, visual-fidelity boundary, heading/date decisions, required state and browser evidence, protected domains, frontend-only expectation, and delivery constraints. There are no unresolved proposal choices to infer here; any newly discovered contract insufficiency or product tradeoff must be returned for explicit acceptance rather than silently expanding scope.

## Evidence and Authority

- Product authority: GitHub issue #522, `feat(dashboard): rediseñar el inicio de cuenta madre con datos operativos reales`, and its supplied acceptance criteria.
- Confirmed decisions: the orchestrator's pre-proposal handoff for this exact change.
- Exploration evidence: `openspec/changes/manager-home-reference-fidelity/exploration.md`.
- Visual evidence: `openspec/changes/manager-home-reference-fidelity/assets/manager-home-reference.jpeg` with supplied SHA-256 `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`.
- Protected canonical behavior: `owner-portal-home`, seller navigation/home contracts, #306 seller property proposals, and #327 platform data-lane contracts.
