# Proposal: Split Frontend Component Responsibilities

## Decision

Refactor the remaining oversized App New frontend components identified by issue #297 into clearer container, presentation, model, and controller boundaries without changing product behavior. The work is strictly structural: public entry components remain stable, existing state and data ownership remain authoritative, and every extraction is protected first by black-box baseline tests.

PR #458 is the already-implemented `operational-homepage.tsx` slice. This change will adopt or rebase that verified work when it lands; it will not recreate, duplicate, or independently supersede it.

## Origin and Baseline

- Product/engineering request: issue #297, as captured in `explore.md`.
- Change: `frontend-component-responsibility-split`.
- Exploration baseline: `origin/develop@d6504ea23ff6e88233dbf7e5f5f973b3cf66f1b2`.
- Existing implementation evidence: PR #458 at `8caf9153bedef4228c2c26c560f5ee12dbc986f9` for the operational-homepage slice only.
- Related active work: issue #304 / change `optional-primary-seller`, which gates product-table extraction.
- Delivery policy: strict TDD, auto-chained review units, and fewer than 400 changed lines per unit.

## Intent

Reduce the maintenance and review cost of frontend components that currently combine fetching, state transitions, effects, and substantial presentation. The resulting boundaries should make each responsibility easier to understand and modify while preserving the exact workflows users already rely on.

The refactor should leave public behavior explainably unchanged: the same routes render the same states and Spanish copy; URL-backed filters and deep links behave identically; permissions and actions remain available to the same users; API/query and cache contracts remain stable; and responsive and accessible interactions continue to work.

## Current-State Gap

Three issue #297 targets currently contain broad responsibility sets:

- `property-document-requests.tsx` owns the document-request query and mutations, dialog state, URL state, a timing-sensitive deep-link effect cluster, preview reads, and extensive presentation. Existing coverage is strong but does not yet protect several loading, failure, hint, mutation-success, preview-fallback, and user-collapse behaviors.
- `operational-homepage.tsx` combined role branching, query ownership, range state, and presentation on the exploration baseline. PR #458 has already split its safe presentation seams while preserving the public component and black-box coverage.
- `product-tables/index.tsx` owns tenant resolution, URL filters and pagination, the products query, React Table derivation, responsive rendering, actions, and state presentation. Its focused component coverage currently protects only two empty-state permission cases, leaving the largest black-box baseline gap.

Without baseline-first extraction, structural moves could silently change deep-link ordering, URL transitions, query inputs, permissions, responsive parity, seller summaries, or cache invalidation while appearing mechanical in review.

## Product and Structural Rules

1. This change is behavior-preserving. It does not introduce, remove, or reinterpret product behavior.
2. Public routes and entry-component contracts remain stable:
   - `/dashboard/product/[id]` continues to reach `PropertyDocumentRequests` through the existing `product-form.tsx` prop flow.
   - `/dashboard` continues to render `OperationalHomepage` through `app/dashboard/page.tsx`.
   - `/dashboard/product` continues to render `ProductTable` through `product-listing.tsx` and its existing `Suspense` fallback.
3. Existing services, API payloads, query keys and filters, URL state, permissions, Spanish copy, accessibility semantics, responsive behavior, and cache invalidation remain unchanged.
4. Server/query state must not be mirrored into competing local state. Presentational children receive explicit data, pending state, and commands rather than creating parallel fetching or URL-state ownership.
5. The document deep-link effects remain one atomic lifecycle. If extracted, they move together into one hook only after focused regressions exist; their ordering must not be distributed across independent components.
6. `DocumentVersionPreviewMedia` remains the owner of its per-version signed-preview query if that boundary moves.
7. `ProductTable` remains the public container and sole owner of tenant context, URL state, the products query, and `useReactTable`, unless a later optional controller extraction moves that complete orchestration as one unit.
8. Product-table seller summaries continue to use the first API-ordered assignment. This refactor must not infer or display a primary seller.
9. Every extraction begins with sufficient public-boundary baseline coverage and follows strict RED/GREEN sequencing. Tests travel with the work unit they protect.
10. Each review unit is independently understandable, runnable, rollbackable, and below 400 changed lines. A unit forecast to exceed the budget must be split before implementation.

## Scope

### 1. Operational Homepage Adoption

- Treat PR #458 as the implementation candidate for this target.
- Adopt or rebase it after it lands, resolving only baseline drift.
- Preserve its existing ownership model: tenant/role branching, manager range state, and all four queries remain in the public container while prop-driven presentation and pure helpers live under the existing feature directory.
- Do not repeat its extraction or expand this proposal into follow-up dashboard behavior changes.

### 2. Property Document Requests

#### Baseline prerequisite

Before extracting a relevant seam, add focused black-box coverage at the public component boundary for:

- query loading, query error, and empty rendering;
- create-success payload, dialog closure, exact document-request invalidation, and success feedback;
- owner eligibility hints for no linked owner, revoked-only owners, and invited owners;
- read, approve, and reject failure feedback, including dialog retention where applicable;
- signed image-preview failure falling back to the file icon; and
- a user's collapse of resolved history after deep-link auto-open not being repeatedly overridden.

Existing deep-link tests remain at the public boundary even if pure helper tests are added.

#### Structural extraction

- Extract dependency-free grouping, filtering, counting, chronology, file-label helpers, and constants.
- Extract prop-driven loading, error, empty, eligibility-hint, and filter presentation.
- Extract request section/list/item/version presentation while preserving preview-query ownership.
- Extract the complete deep-link effect cluster into one named hook only after the baseline protects filter reset, auto-open, post-paint scroll, highlight, loading-to-success timing, and user collapse.
- Optionally extract one mutation/controller hook only if the root remains materially mixed after presentation moves. If used, it must retain all four mutations, dialogs, exact invalidation, and safe error handling as one orchestration boundary.

### 3. Product Table

#### Ordering dependency

Product-table work must not begin until issue #304's App New type/UI work has landed or has been definitively rebased away. Once the gate clears, begin from fresh `origin/develop`, run App New typecheck, and preserve first-assignment seller-summary semantics. Responsibility moves from #297 and primary-seller behavior from #304 must never share a review unit.

#### Baseline prerequisite

Before product-table extraction, add black-box component coverage for:

- tenant-loading, no-tenant, query-loading, query-error, retry, and unfiltered-empty states;
- exact query filters derived from URL state, including the default active archive state;
- operation, status, and archive changes resetting page; full clear behavior; and active-filter labels/count;
- page clamping, previous/next disabled states, and page-size reset;
- desktop and mobile identity, status, price, owner, seller, archive badge, and actions;
- permission propagation to quick-status and row actions; and
- background-fetch indication and the filtered-empty clear action.

Tests assert user-visible behavior and `nuqs` setter payloads, not internal extracted component names.

#### Structural extraction

- Keep `ProductTable` as the stable public container and authoritative owner of tenant, URL, query, and table state.
- Extract toolbar and filter controls with explicit values and callbacks and no second URL parser or local filter representation.
- Extract desktop rows and mobile cards with shared identity, thumbnail, and summary primitives so both responsive views continue to consume the same `Product` data and permissions.
- Extract pagination and loading/error/empty/skeleton states as prop-driven units.
- Optionally consolidate the complete URL/query/table derivation in one controller hook only after presentation moves stabilize; do not split fetching and pagination into competing orchestration hooks.

## Delivery Approach

Work proceeds as sequential, review-sized auto-chained units. Each unit includes its verification and leaves the public component runnable; tests are never deferred to a later “test-only” cleanup after an extraction.

| Chain | Unit | Outcome | Expected review size |
|---|---|---|---:|
| Operational | O1 | Adopt/rebase PR #458; do not duplicate it | Existing reviewed candidate |
| Documents | D1 | Add missing public-boundary document-request baselines | 180–300 lines |
| Documents | D2 | Extract pure model/constants with focused pure tests | 220–340 lines |
| Documents | D3 | Extract states, eligibility hint, and filter presentation | 280–390 lines |
| Documents | D4 | Extract request list/item/status presentation | 320–395 lines; split if needed |
| Documents | D5 | Extract version summary and preview-query boundary | 240–360 lines |
| Documents | D6 | Extract the atomic deep-link hook with unchanged black-box tests | 280–390 lines |
| Documents | D7 | Optionally extract one mutation/controller hook if still justified | 300–395 lines |
| Product table | T1 | After the #304 gate, add URL/query/rendering baselines | 250–390 lines |
| Product table | T2 | Extract toolbar/filter presentation | 300–395 lines |
| Product table | T3 | Extract desktop rows and shared identity summaries | 320–395 lines; split if needed |
| Product table | T4 | Extract mobile cards using shared summaries | 260–380 lines |
| Product table | T5 | Extract pagination and state/skeleton presentation | 300–395 lines |
| Product table | T6 | Optionally consolidate complete orchestration in one hook | 260–380 lines |

D4 and T3 must be split further if the implementation forecast reaches 400 changed lines. Optional D7 and T6 are not completion requirements unless the preceding extractions leave materially mixed orchestration that a single coherent controller can improve without changing behavior.

## Dependencies and Ordering

1. The canonical capability contracts under `openspec/specs/` remain authoritative; this proposal introduces no product-behavior override.
2. PR #458 is the operational-homepage implementation dependency and must be adopted rather than recreated.
3. Missing black-box baseline tests are a hard prerequisite for each remaining target's relevant extraction.
4. Document-request units may proceed independently of #304, but must not alter `product-form.tsx` prop flow.
5. Product-table units are blocked until #304's App New type/UI work lands or is definitively rebased away.
6. Every later unit starts from its then-current landed predecessor so the chain remains reviewable and rollbackable.
7. Strict TDD applies to every unit: establish failing or characterization evidence before the structural change, then retain passing focused regressions after it.

## Affected Areas

| Area | Expected impact |
|---|---|
| App New document-request feature | New model/helper, presentation, and possibly cohesive hook boundaries behind the unchanged public component. |
| App New operational homepage | Adoption of PR #458 only, with no duplicate implementation. |
| App New product listing/table feature | Baseline coverage followed by prop-driven presentation boundaries behind the unchanged `ProductTable` container. |
| Focused App New component tests | Expanded black-box characterization of current states, transitions, permissions, responsive output, and failures. |
| Pure helper tests | Focused coverage where dependency-free document/table derivations are extracted. |
| OpenSpec change artifacts | Structural preservation requirements, design, task sequencing, and verification evidence. |

No API, database, migration, seed, route, deployment, or product-policy change is expected.

## Explicit Non-Goals

- No redesign of document-request workflows, statuses, review actions, owner eligibility, or deep-link behavior.
- No dashboard metric, query policy, role branch, priority content, or manager/seller experience change.
- No product-table filter, pagination, archive, empty-state, action, or responsive UX change.
- No primary-seller inference, selection, display change, or adoption of issue #304 behavior in a #297 unit.
- No changes to routes, BFF/service contracts, API payloads, query keys, cache invalidation targets, or refetch policy.
- No changes to visible Spanish copy, accessibility labels/semantics, permissions, or responsive breakpoints.
- No mirrored server data, duplicate URL parsers, local copies of query state, or child-owned fetching introduced for presentation convenience.
- No recreation or independent supersession of PR #458.
- No opportunistic performance optimization, styling refresh, naming campaign, or unrelated cleanup.
- No mandatory controller-hook extraction when simpler container-plus-presentation boundaries are already clear.

## Risks and Controls

| Risk | Impact | Required control |
|---|---|---|
| Mechanical extraction changes document deep-link timing | Resolved history may fail to open, scroll, highlight, or respect later user collapse. | Add public-boundary regressions first and move the complete effect lifecycle atomically. |
| Data or URL ownership is duplicated | Filters, pagination, requests, or mutations can drift between sources of truth. | Keep one query/URL/controller owner and make extracted presentation prop-driven. |
| Cache invalidation changes during mutation extraction | Document state may remain stale or unrelated caches may refresh. | Assert exact `productKeys.documentRequests(productId, tenantId)` invalidation before moving orchestration. |
| Preview fetching moves to an unstable render boundary | Signed-URL requests may multiply or fallback behavior may regress. | Keep per-version query ownership in the preview unit and protect failure fallback. |
| Responsive table views diverge | Desktop and mobile users may see different data, permissions, or actions. | Share identity/summary primitives and baseline both render paths before extraction. |
| #304 type/UI changes collide with table extraction | Type/import churn could become an accidental primary-seller behavior change. | Enforce the ordering gate, start from fresh `origin/develop`, and preserve first-assignment semantics. |
| PR #458 is duplicated | Review effort and merge conflicts increase with competing homepage splits. | Adopt/rebase the existing candidate only. |
| A moved-code unit exceeds the review budget | Review quality falls and auto-chain policy is violated. | Forecast deletion-plus-addition and tests together; split before 400 changed lines. |
| “Cleanup” changes user-visible behavior | A structural issue becomes an unreviewed product change. | Treat every observable contract as invariant and require a separate accepted change for behavior modifications. |

## Rollout and Rollback

No feature flag, data migration, or coordinated runtime rollout is required because the change is structural and behavior-preserving. Deliver each unit through its own auto-chained review slice after focused tests, App New typecheck, strict lint, and repository-required checks pass.

Rollback is unit-based:

- Revert only the failing extraction and its colocated tests; earlier baseline units may remain because they characterize existing behavior.
- Reverting a presentation or helper extraction restores the prior component layout without data repair.
- Revert the document deep-link hook atomically rather than partially distributing its effects.
- Revert optional controller hooks independently if ownership becomes less clear.
- Roll back adopted PR #458 through its existing work unit rather than constructing a second homepage implementation.
- If #304 drift invalidates a product-table unit, stop the table chain and rebase/re-characterize from current `origin/develop`; do not resolve the conflict by changing seller-summary behavior.

## Measurable Success Criteria

- [ ] PR #458 is adopted/rebased as the sole operational-homepage slice, with no duplicate extraction introduced by this change.
- [ ] Property-document extraction does not begin until the missing loading, error, empty, mutation-success, eligibility-hint, failure, preview-fallback, and user-collapse baselines relevant to the seam pass at the public boundary.
- [ ] Product-table extraction does not begin until its URL/query/state/responsive/permission baselines pass and the #304 ordering gate is cleared.
- [ ] `/dashboard`, `/dashboard/product`, and `/dashboard/product/[id]` retain their existing entry points and routing behavior.
- [ ] API/query contracts, query keys, URL state transitions, cache invalidation, permissions, Spanish copy, accessibility semantics, and responsive behavior remain unchanged under focused black-box tests.
- [ ] Document deep-link reset, resolved auto-open, post-paint scroll, highlight timing, loading-to-success behavior, and later user collapse remain unchanged.
- [ ] Product-table desktop and mobile views continue to render equivalent identity, status, price, owner, first-assignment seller summary, archive, permission, and action information.
- [ ] No extracted presentational component introduces its own competing query, URL parser, or mirrored server state.
- [ ] Every implementation unit includes its protecting tests, is independently runnable and rollbackable, and stays below 400 changed lines.
- [ ] Focused component tests pass after every unit, followed by App New typecheck and strict lint; final delivery also passes the configured App New test, seeded E2E, formatter/diff, and build gates when exposed by the repository.
- [ ] No API, database, schema, migration, seed, or unrelated product behavior is changed.

## Proposal Question Round

These proposal-shaping questions are recorded for review because this delegated auto-chain phase cannot pause for an interactive round. They are intended to uncover product implications, edge cases, and scope tradeoffs rather than delivery mechanics. The issue #297 contract and exploration currently resolve them as follows:

1. **What user-visible outcome justifies the split?** Maintenance and review become safer and more understandable, while users experience no deliberate product change.
2. **Which behavior boundaries are inviolable during extraction?** Routes, API/query contracts, URL state, permissions, Spanish copy, accessibility, responsive behavior, cache invalidation, deep-link ordering, and first-assignment seller summaries all remain unchanged.
3. **How should already-completed homepage work be handled?** PR #458 is adopted or rebased as the sole operational-homepage slice and is not recreated.
4. **What must happen before the two remaining targets move?** Relevant black-box baselines must pass first; product-table work additionally waits for #304's App New type/UI work to land or be definitively rebased away.
5. **When are controller hooks warranted?** Only after presentation extraction, and only when one cohesive hook can own the complete orchestration without creating competing state or query ownership.

A reviewer may accept these assumptions, correct the framing, skip further questions, or request a second proposal question round before the spec is finalized.

## Proposal Status

Proposed and ready for review. The recommended next phase is `spec`, followed by design and review-sized task planning. No product source code is implemented by this proposal.
