# Exploration: Frontend component responsibility split (#297)

## Scope and evidence

Exploration used the planning baseline `origin/develop@d6504ea23ff6e88233dbf7e5f5f973b3cf66f1b2`, the active `optional-primary-seller` OpenSpec artifacts for issue #304, and the separate PR #458 worktree at `8caf9153bedef4228c2c26c560f5ee12dbc986f9` only as evidence for the completed `operational-homepage.tsx` slice. No product code was changed.

The public entry points are narrow and must remain stable:

- `/dashboard/product/[id]` reaches `PropertyDocumentRequests` through `product-form.tsx` with the existing permissions, archive state, owners, product id, and tenant id.
- `/dashboard` renders `OperationalHomepage` directly from `app/dashboard/page.tsx`.
- `/dashboard/product` renders `ProductTable` through `product-listing.tsx` and its existing `Suspense` fallback.

## Responsibility maps

### `property-document-requests.tsx`

**Fetching:** one property-scoped document-request query is owned by the root component. Four root mutations create, read, approve, and reject; successful writes invalidate exactly `productKeys.documentRequests(productId, tenantId)`. Each image preview independently queries one signed read URL by version id with a one-minute stale time.

**State transitions:** local state owns the create dialog, selected request-to-reject, controlled resolved-history disclosure, transient highlighted request, timer, and one-shot guards. `nuqs` owns the `documentos` filter and read-only `doc` deep-link. Create/reject success closes its dialog; approval/rejection/create invalidate the same list; read opens a safe new tab.

**Effects:** four effects form one coupled deep-link lifecycle: timer cleanup; one-shot filter reset; target discovery plus one-shot opening of resolved history; and post-paint scroll/highlight after resolved content exists. Their ordering prevents a Radix render/measurement race and must not be distributed across independent components.

**Presentation:** owner eligibility hints, loading/error/empty states, filter tabs and counts, grouped sections, resolved collapsible, request cards, review actions, status badges, rejection copy, file metadata, preview media, and pure sorting/formatting helpers are currently colocated.

**Safe seams:**

1. Extract pure grouping/filter/count/chronology/file-label helpers and constants into a dependency-free model/helper module.
2. Extract loading/error/empty/hint and filter controls as prop-driven presentation.
3. Extract request section/list/item/version presentation; keep `DocumentVersionPreviewMedia` as the sole owner of its per-version preview query.
4. Move the complete deep-link effect cluster into one named hook only after focused regressions exist; return the container ref, highlight id, resolved state, and change handler without creating another query or URL-state representation.
5. If mutation orchestration is extracted, one controller hook must retain all four mutations, dialogs, cache invalidation, and safe error handling. Presentational units must receive commands and pending state rather than call services themselves.

Do not replace server/query state with mirrored local arrays, move a preview query to every card render boundary unnecessarily, or key the scroll effect on later user filter changes.

### `operational-homepage.tsx`

**Fetching:** the manager branch owns dashboard-summary and active-product-preview queries; range changes alter only the summary query. The seller branch owns active assigned-product and activity-feed queries. Both disable focus/reconnect refetching and share no fetched state.

**State transitions:** only the manager range (`7d`, `14d`, `30d`) is local state. Tenant membership/loading state comes from `useActiveTenant`; role determines the manager/seller branch.

**Effects:** there are no explicit effects. React Query reacts to tenant/range keys.

**Presentation:** manager and seller hero panels, KPI cards, priority links, recent activity, property previews, top-property and top-seller lists, empty/loading states, row actions, and label helpers were colocated on the baseline.

**PR #458 assessment:** the implemented split is a sound seam. It keeps tenant branching, range state, and all four query declarations in `operational-homepage.tsx`; moves constants, pure helpers, range selector, priority panel, list/card presentation, primitives, and missing/loading states into `operational-homepage/`; and leaves the public component/import unchanged. The existing focused nine tests remain black-box tests of the entry component and reportedly pass 9/9 with typecheck, lint, and formatter. Do not recreate or independently supersede this slice. Rebase/adopt PR #458 when it lands, resolving only baseline drift.

### `product-tables/index.tsx`

**Fetching:** one tenant-scoped products query is built from URL-backed page, page size, operation, status, and archive filters. It is disabled until tenant resolution completes.

**State transitions:** `nuqs` is the sole filter/pagination state. Filter/archive changes reset page to one; clear resets all filters; page changes clamp to the derived page count; page-size changes reset page. `useReactTable` derives rows and manual pagination from query data.

**Effects:** there are no explicit effects. Query keys and `nuqs` transitions drive updates.

**Presentation:** tenant/loading/error states, retry, toolbar, active-filter summary, selects, responsive desktop rows and mobile cards, property identity/thumbnail/metrics, owner and seller summaries, pagination, empty state, and skeleton are colocated. `columns.tsx`, `cell-action.tsx`, and `options.tsx` are already separate seams.

**Safe seams:**

1. Keep `ProductTable` as the public container and sole owner of tenant context, URL state, products query, and `useReactTable`.
2. Extract toolbar/filter controls with explicit values and callbacks; do not introduce a second URL parser or local filter state.
3. Extract desktop table and mobile cards together with shared identity/thumbnail/summary primitives so both views continue to render the same `Product` data and permission.
4. Extract pagination and loading/error/empty/skeleton states as prop-driven units.
5. Consider a controller hook only after presentation moves stabilize; if used, it must own the complete URL/query/table derivation rather than splitting fetching and pagination into competing hooks.

The current table reads seller summary from the first API-ordered assignment through `getAgentSummary`. A responsibility-only refactor must preserve that visible behavior; choosing a primary seller is a separate product decision.

## Existing coverage and missing baseline tests

### Property document requests

The existing component test is comparatively strong: submitted/pending/resolved actions, safe read URLs, approval/rejection invalidation, permissions/archive behavior, grouping/sorting/filter counts, signed image previews, deep-link filter reset/open/scroll/highlight ordering, loading-to-success scroll timing, and create-conflict copy are covered.

Before splitting the relevant seams, add focused black-box baselines for:

- query loading, query error, and empty rendering;
- create success payload, dialog closure, exact invalidation, and success feedback;
- owner eligibility hints for no linked owner, revoked-only owners, and invited owners;
- read/approve/reject failure feedback and dialog retention where applicable;
- image-preview failure falling back to the file icon;
- user collapse after deep-link auto-open not being repeatedly overridden.

Keep the deep-link cases at the public component boundary even if pure helper tests are added.

### Operational homepage

The nine existing tests cover tenant loading/missing state, manager default/range changes, backend insights, responsive action affordances, seller query selection and copy, seller data, and seller empty state. That is sufficient evidence for the already-completed structural PR. Useful follow-up coverage, if changed behavior later requires it, is explicit manager/seller query-error copy and empty recent/top insight panels; these should not block adopting a verified behavior-preserving PR #458.

### Product table

Only two focused component tests exist, both for seller-versus-manager empty-state creation affordances. Seeded E2E proves the inventory heading and one happy-path total, but does not protect component transitions. This is the largest baseline gap. Before extraction, cover:

- tenant-loading, no-tenant, query-loading, query-error, retry, and unfiltered empty states;
- exact query filters produced from URL state, including default active archive state;
- operation/status/archive changes resetting page, full clear behavior, and active-filter labels/count;
- page clamping, previous/next disabled states, and page-size reset;
- desktop and mobile rendering of identity, status, price, owner, seller, archive badge, and actions;
- permission propagation to quick status and row actions;
- background-fetch indicator and filtered-empty clear action.

These tests should assert user-visible behavior and `nuqs` setter payloads, not internal extracted component names.

## Collision and ordering constraints

Issue #304 (`optional-primary-seller`) is active and currently reports only its first schema/persistence unit complete; its planned App New work later changes `features/products/api/types.ts`, services/BFF routes, `property-agents-section.tsx`, `manage-property-agents-dialog.tsx`, and focused tests. Its design explicitly expects no structural change in `product-form.tsx` and names no direct edit to `product-tables/index.tsx` or `columns.tsx`.

Collision risk is nevertheless **medium** for the product-table slice:

- #304 will narrow `PropertyEngagement.agents` to a property-specific agent subtype with required `isPrimary`, and `Product` aliases that engagement type.
- `product-tables/index.tsx` and `columns.tsx` consume `Product`, while `getAgentSummary` currently depends on assignment order rather than primary state.
- A simultaneous extraction could produce type/import churn or accidentally turn a mechanical split into a seller-summary behavior change.

Therefore:

1. Adopt/land PR #458 independently first; #304 explicitly excludes operational-homepage work.
2. Property-document extraction may proceed independently after its missing baselines because #304 does not plan edits to that component. Coordinate around `product-form.tsx` and avoid changing its prop flow.
3. Defer product-table extraction until #304's App New type/UI units land or are definitively rebased away. Start from fresh `origin/develop`, run typecheck, and preserve first-assignment summary semantics unless a separate accepted requirement changes it.
4. Never combine #297 responsibility moves with #304 primary-seller behavior in one review unit.

## Review-sized work-unit forecast

Strict TDD and the 400 changed-line budget make one PR per target unsuitable: moving code counts as deletion plus addition and tests must travel with each seam. Suggested independent, sequential units are:

| Unit | Outcome | Expected review size |
|---|---|---:|
| D1 | Add missing property-document behavioral baselines only | 180–300 lines |
| D2 | Extract document pure model/constants and focused pure tests | 220–340 lines |
| D3 | Extract document states, hint, and filter presentation | 280–390 lines |
| D4 | Extract document request list/item/status presentation | 320–395 lines; split item/version if needed |
| D5 | Extract version summary/preview query boundary | 240–360 lines |
| D6 | Extract the atomic deep-link hook with unchanged black-box tests | 280–390 lines |
| D7 | Optionally extract one mutation/controller hook if the root remains materially mixed | 300–395 lines |
| O1 | Adopt the already-implemented PR #458 slice; do not duplicate it | Existing reviewed candidate |
| T1 | Add product-table URL/query/rendering baselines only | 250–390 lines |
| T2 | Extract toolbar/filter presentation | 300–395 lines |
| T3 | Extract desktop table rows and shared identity summaries | 320–395 lines |
| T4 | Extract mobile cards using the shared summaries | 260–380 lines |
| T5 | Extract pagination and state/skeleton presentation | 300–395 lines |
| T6 | Optionally consolidate URL/query/table orchestration in one controller hook | 260–380 lines |

Every unit should begin from the then-current landed predecessor, include RED/GREEN evidence for its own boundary, and stop before 400 changed lines rather than postponing tests. D4 and T3 are the likeliest to need one additional split. No unit should be organized as “move files” followed by “add tests”; each must leave the public component behavior runnable and rollbackable.

## Verification and non-goals

Focused component tests must run after every unit, followed by App New typecheck and strict lint. Before delivery, run the configured full App New tests, seeded E2E, build if the package exposes the repository build gate, formatter, and repository diff checks. Public routes, service/API payloads, query keys, visible Spanish copy, accessibility labels, responsive behavior, permissions, and cache invalidation remain unchanged.

This change is structural only. It must not redesign document workflows, alter dashboard metrics, change table filtering, infer primary sellers, add data fetching to presentational children, introduce mirrored server state, or optimize behavior without a separately accepted requirement.

## Readiness

Ready for proposal with an auto-chain delivery strategy. The proposal should treat PR #458 as the operational-homepage implementation candidate, make baseline tests a prerequisite for each remaining target, and encode the #304 ordering gate for product-table work.
