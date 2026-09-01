# Design: Frontend Component Responsibility Split

## Decision summary

Keep the three existing public entry components stable and move only dependency-light model or prop-driven presentation behind them. `PropertyDocumentRequests` remains the document feature boundary, `OperationalHomepage` adopts PR #458 exactly once, and `ProductTable` remains the product-list boundary. Data fetching, URL parsing, permissions, and mutation orchestration stay above presentation. The only intentional child-owned query is the existing per-version signed-preview query in `DocumentVersionPreviewMedia`.

The implementation is delivered as sequential work-unit PRs, each from then-current `origin/develop`, each independently tested and rollbackable, and each below 400 changed lines including additions, deletions, and tests. Existing behavior-preserving extraction starts from a passing characterization baseline; no artificial failing test is created. A real missing contract or defect uses recorded RED/GREEN evidence before extraction.

## Stable public boundaries

No unit changes these paths or contracts:

- `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx` remains the `/dashboard` entry rendered by `app/dashboard/page.tsx`.
- `viewpro-app/apps/app-new/src/features/products/components/product-tables/index.tsx` continues to export `ProductTable`; `product-listing.tsx` retains its existing `Suspense` fallback using `PropertyTableSkeleton`.
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx` continues to export `PropertyDocumentRequests`; `product-form.tsx` retains its current props and route flow for `/dashboard/product/[id]`.

Extracted modules use direct relative imports rather than a new barrel. Imports point inward from the public container to model, hooks, and presentation. Presentation may import shared UI primitives, feature API types, and pure helpers, but it must not import the root container. Except for preview media, presentation must not import product services, React Query, `nuqs`, tenant context, or query keys.

## Operational homepage adoption

PR #458 at `8caf9153bedef4228c2c26c560f5ee12dbc986f9` is the sole implementation candidate. The owning branch is rebased or updated rather than reproducing its diff in this change. If it has already landed, O1 is ancestry and regression verification only and creates no duplicate source PR.

The accepted file layout is:

- `operational-homepage.tsx` — public component; tenant/loading/role branch, manager range state, and all four queries.
- `operational-homepage/constants.ts` — range and preview constants.
- `operational-homepage/helpers.ts` — pure activity, title, count, and range helpers.
- `operational-homepage/range-selector.tsx` — controlled range UI.
- `operational-homepage/priority-panel.tsx` — prop-driven priority card and links.
- `operational-homepage/lists.tsx` — prop-driven activity, property, top-property, and seller lists.
- `operational-homepage/primitives.tsx` — KPI, empty, skeleton, and row-action primitives.
- `operational-homepage/states.tsx` — missing-tenant and homepage skeleton states.

No follow-up query hook, role-policy change, dashboard copy change, or performance cleanup is part of adoption. The existing public `operational-homepage.test.tsx` remains the acceptance boundary. Baseline drift may be corrected only on the PR #458 branch and only where required to preserve its already-reviewed ownership model and behavior.

## Property document request architecture

### Target modules and ownership

The root remains at `components/property-document-requests.tsx`. New modules live under `components/property-document-requests/`:

1. `model.ts`
   - Owns `DocumentFilter`, `DocumentRequestGroup`, filter options, and dependency-free derivations.
   - Owns owner eligibility, active filter normalization, grouping, filtering, counts, chronology selection, compact description, filename/file-format labels, version numbering, MIME classification, and compact date formatting.
   - Imports only feature API types and the existing date formatter dependency; it imports no icons, React hooks, services, query keys, or UI components. Status icon/class configuration stays beside `DocumentStatusBadge` in `request-list.tsx` because it is presentation, not model data.
   - `model.test.ts` directly covers edge cases that are awkward to diagnose through DOM output, while public tests continue to protect observable grouping and copy.

2. `states-and-filters.tsx`
   - Owns `DocumentRequestHint`, loading, query-error, empty, and `DocumentRequestFilters` presentation.
   - Receives eligibility counts, archive/permission booleans, active filter, counts, and `onFilterChange`.
   - Does not know `owners`, URL parameter names, query objects, or setters.

3. `request-list.tsx`
   - Owns `DocumentRequestSection`, controlled resolved `Collapsible`, `DocumentRequestList`, `DocumentRequestItem`, status badge, rejection reason, review/read buttons, and the `data-request-id`/highlight class anchor.
   - Receives request groups, permissions, pending flags, highlighted id, controlled resolved-open state, and command callbacks.
   - Does not create mutations or infer permissions. It imports model helpers and the version presentation module, never the root.

4. `document-version.tsx`
   - Owns `DocumentVersionSummary` and `DocumentVersionPreviewMedia`.
   - `DocumentVersionSummary` remains prop-driven for the user read command.
   - `DocumentVersionPreviewMedia` remains the sole owner of the image-only query keyed by `[..., 'document-version-preview', version.id]`, with `retry: false` and `staleTime: 60_000`. It alone imports `createProductDocumentReadUrl` for preview reads. Query error or absent URL renders the existing file icon and does not fail the request item.

5. `use-document-request-deep-link.ts`
   - Owns the complete deep-link lifecycle as one hook: highlight timer and cleanup, one-shot `documentos` reset guard, one-shot resolved-history opening, target lookup, post-render DOM lookup, scroll, transient highlight, and user-controlled resolved open state.
   - Inputs are `highlightDocId`, query success/data, and the authoritative `setDocumentFilter` command. Output is `{ containerRef, highlightedId, resolvedOpen, onResolvedOpenChange }`.
   - The hook does not parse either URL parameter itself, fetch requests, group data, or own a second filter value. The root still calls `useQueryState` for `documentos` and read-only `doc` and passes their values/command in.
   - Target discovery/opening and post-paint scroll remain separate ordered effects inside this single module so Radix can render and measure resolved content between them. The one-shot open ref is never reset by user collapse. Timer cleanup remains atomic with the effects.

The root owns the list query, `nuqs`, eligible-owner derivation, dialogs, all four mutations, exact query key, and command wiring until an optional controller is justified. It passes query-derived data downward without mirroring the list in local state.

### Mutation and invalidation contract

Create, approve, and reject are writes. Their successful handlers retain payloads, success copy, applicable dialog closure, and exactly:

```ts
queryClient.invalidateQueries({
  queryKey: productKeys.documentRequests(productId, tenantId)
})
```

Read is different: it obtains a safe URL and calls `window.open(url, '_blank', 'noopener,noreferrer')`; it does **not** invalidate the document-request list. Preview reads also do not invalidate the list. Extraction must preserve this read-versus-write distinction in tests and implementation.

### Truly optional document controller

`use-document-request-controller.ts` is optional and is not a completion condition. It may be added only after model, state/filter, list, version, and deep-link moves have landed and `property-document-requests.tsx` still materially interleaves orchestration. If added, one hook owns all four mutations, create/reject dialog state, exact write invalidation, read URL opening, pending states, and safe error/success feedback. It returns commands and dialog props to the root; no presentation module calls services. Do not extract separate create/read/review hooks, and do not move `nuqs`, the list query, or deep-link effects into this controller.

## Product table architecture

### #304 ordering gate

No product-table baseline or extraction branch starts while issue #304 App New type/UI work has unresolved status. The gate is cleared only when those units have landed on `develop` or have been definitively rebased away. Then fetch `origin`, create a fresh worktree from `origin/develop`, confirm the expected #304 type shape, and run App New typecheck before touching table files. A #297 PR must contain no primary-seller UI, type correction, or behavior.

`getAgentSummary` in `product-tables/columns.tsx` remains order-based: `const [firstAgent] = product.agents`. Shared row/card presentation calls that helper and must not inspect `isPrimary`, sort agents, or select `.find(agent => agent.isPrimary)`.

### Target modules and ownership

The public container remains `product-tables/index.tsx`, initially owning `useActiveTenant`, `useQueryStates`, query filter construction, `useQuery`, `useReactTable`, page-count derivation, permission derivation, and all URL setter commands.

New files under `components/product-tables/` are:

1. `toolbar.tsx`
   - Owns `PropertyTableToolbar`, active-filter summary/badges, operation/status selects, archive select, page-size select, and table summary copy.
   - Receives primitive current values, labels/count inputs, permissions, fetching state, and callbacks.
   - Does not import `nuqs`, tenant context, products queries, or maintain local filter state.

2. `product-summary.tsx`
   - Owns shared `PropertyIdentity`, thumbnail, archived badge, owner summary, and metric primitives used by both responsive views.
   - Receives `Product` and display flags only. It imports pure formatting/status helpers from `columns.tsx` directly.

3. `desktop-table.tsx`
   - Owns the desktop table shell/header and `PropertyTableRow`.
   - Receives `Product[]` (or the container's row originals) and `canManageProperties`.
   - Passes the same permission to `QuickStatusSelect` and `CellAction`; it does not authorize independently.
   - Uses `getAgentSummary(product)` unchanged for the first API-ordered assignment.

4. `mobile-cards.tsx`
   - Owns `PropertyMobileCard` and maps the same `Product[]` and permission.
   - Reuses `product-summary.tsx` and `getAgentSummary`, preserving identity, status, price, owner, seller, archive, quick-status, and row-action parity.

5. `pagination.tsx`
   - Owns range text and previous/next controls from `page`, `pageCount`, `pageSize`, `total`, and `onPageChange`.
   - Clamping remains in the authoritative container command; the component only requests adjacent pages.

6. `states.tsx`
   - Owns `PropertyTableMessage`, `PropertyTableEmptyState`, and `PropertyTableSkeleton`.
   - Retry and clear-filter behavior arrive as callbacks; create affordances arrive from `canManageProperties`.
   - It imports no query object, tenant context, or URL state.

`columns.tsx`, `cell-action.tsx`, and `options.tsx` remain existing direct seams. Do not create a new barrel or duplicate their helpers.

### Truly optional product controller

`use-product-table-controller.ts` is optional and follows all presentation extraction. It is justified only if `index.tsx` remains materially mixed after toolbar, responsive output, pagination, and states have moved. If used, it moves the complete orchestration together: tenant context, `useQueryStates`, normalized request filters, products query, page count/clamping, `useReactTable`, permissions, and all setter commands. It returns one view model to `ProductTable`. Fetching, URL state, and pagination must not be split into multiple hooks, and no server data is copied into local state.

## Data flow

### Document requests

1. `product-form.tsx` supplies unchanged props to `PropertyDocumentRequests`.
2. The root parses `documentos` and read-only `doc`, fetches the list, derives model groups/counts, and owns dialogs/mutations.
3. The deep-link hook receives the authoritative URL command and successful query data, then returns controlled resolved/highlight DOM state.
4. Prop-driven states, filters, sections, items, and versions render the view and raise commands.
5. User reads open safe URLs without list invalidation; successful create/approve/reject writes invalidate only the exact property/tenant document-request key.

### Product table

1. `ProductTable` resolves tenant and permission and parses URL-backed page, size, operation, status, and archive state.
2. It constructs the existing query filters, including default `archived: 'active'`, then derives React Table rows and manual page count.
3. Toolbar callbacks update the single `nuqs` state and reset page exactly as today; page-size resets page and page commands clamp.
4. Desktop and mobile presentation receive the same API-ordered products and permission. Both derive seller text from the first assignment.
5. State modules receive retry/clear commands and never read query or URL state themselves.

## Test strategy and strict TDD evidence

The public tests remain black-box acceptance boundaries:

- `components/property-document-requests.test.tsx` covers loading/error/empty; create payload, close, exact write invalidation and feedback; owner hints; read/approve/reject failures and dialog retention; preview fallback; deep-link reset/open/post-paint scroll/highlight/loading transition; and user collapse persistence.
- `components/product-tables/product-table.test.tsx` covers tenant loading/missing, query loading/error/retry/empty, exact query filters, all URL setter payloads, active labels/count, pagination clamping/buttons/page-size reset, desktop/mobile parity, permissions, background fetching, and filtered-empty clear.
- `components/operational-homepage.test.tsx` remains the PR #458 adoption boundary.
- `property-document-requests/model.test.ts` is the only planned internal unit seam; it supplements rather than replaces public behavior tests.

For each unit record: pre-change focused command and result, whether it is a passing characterization baseline or genuine RED, post-change focused GREEN result, typecheck, strict lint, formatter check, and changed-line count. A behavior-preserving extraction starts only after its relevant public tests pass. If a newly specified behavior fails on the unmodified baseline, stop extraction, classify it as a defect/correction, and complete a separate RED/GREEN behavior unit before moving code.

Focused commands run from `viewpro-app/`:

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/product-tables/product-table.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/dashboard/components/operational-homepage.test.tsx
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
```

Formatter scope is deliberately package-local so unrelated packages do not enter a structural diff:

```bash
cd viewpro-app/apps/app-new
pnpm format:check
```

Final delivery additionally runs from `viewpro-app/`:

```bash
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter next-shadcn-dashboard-starter build
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
git diff --check
git status --short
```

Skipped commands, environmental blockers, and residual risks are recorded rather than represented as passing.

## Review-unit and line-budget control

Each unit contains one behavior or extraction seam and its tests. Before writing source, forecast with the expected file list; during work, inspect `git diff --stat` and `git diff --numstat`. Additions plus deletions count. At 350 changed lines, stop adding scope and reassess. At a forecast or actual count of 400 or more, do not commit or open the PR: restore a runnable boundary and split before continuing.

Likely splits are:

- D4a section/list/status shell, then D4b request item/actions if one list/item move cannot stay below budget.
- D5 version summary plus preview ownership remains separate from D4.
- T3a shared product summary primitives, then T3b desktop shell/rows if their combined move and tests approach budget.
- Mobile cards remain a later unit so responsive parity is reviewable against landed shared primitives.

Tests are never deferred to a test-only follow-up after moved code. A commit is the complete work unit, not a file-type batch.

## Worktree and PR sequence

1. **Planning only:** land proposal/spec/design/tasks from the planning worktree in a documentation-only PR. It contains no source correction, PR #458 diff, #304 behavior, or extraction.
2. **O1 / PR #458:** update/rebase the existing PR #458 branch and land it once. If already merged, record its merge SHA and only verify; do not open a replacement extraction PR.
3. **Document D1 onward:** after O1 is settled, create each document unit in a fresh worktree/branch from then-current `origin/develop`. Land D1 baseline before D2, then land each extraction before creating its successor. A genuine baseline defect is its own correction PR and is not hidden in an extraction.
4. **#304 chain:** continues in its own worktrees and PRs. No #297 branch edits primary-seller contracts or absorbs #304 corrections.
5. **Product T1 onward:** only after the #304 gate, fetch and create T1 from fresh `origin/develop`, run pre-change typecheck, and add table characterization. Each later T unit starts only after its predecessor lands.
6. Optional D7/T6 controller units are created only from the fully landed presentation state and only with a recorded justification; omission is a valid completed design.

Every implementation PR targets `develop`, includes start/finish state, focused evidence, total changed lines, rollback command/scope, and explicit non-goals. Do not stack unmerged local implementation branches or reuse a worktree with unrelated changes.

## Rollout and rollback

No feature flag, migration, API rollout, or data repair is required. Each landed unit is a behavior-preserving structural release.

- Revert a presentation/model unit with its colocated tests; earlier public characterization may remain.
- Revert the deep-link hook as one unit. Never partially move its effects back.
- Revert an optional controller independently to restore root ownership.
- Revert PR #458 through its existing work unit; never counter it with a second homepage implementation.
- If #304 drift or typecheck failure appears, stop the product chain, discard/rebase the unlanded table unit onto current `origin/develop`, and re-characterize. Do not resolve drift by changing seller selection.
- A failed focused test, typecheck, strict lint, package formatter, line budget, or ownership audit blocks the next unit.

## Risks and controls

| Risk | Control |
|---|---|
| Deep-link extraction changes effect timing | Keep all effects, refs, cleanup, and controlled resolved state in one hook; preserve public timing tests. |
| URL/query state gains a second owner | Pass primitives and callbacks; presentation cannot import `nuqs`, query options, or tenant context. |
| Read starts invalidating list cache | Assert no invalidation for user/preview reads and exact invalidation for create/approve/reject writes. |
| Preview query duplicates | Keep it only in `DocumentVersionPreviewMedia`, keyed per version with existing retry/stale settings. |
| Desktop/mobile values diverge | Feed both the same `Product[]`, permission, shared summaries, and first-assignment helper. |
| #304 causes primary inference | Gate table work, typecheck fresh develop, and test two ordered assignments where first is not necessarily primary. |
| Mechanical move exceeds review capacity | Count additions and deletions continuously; stop at 350 for reassessment and split before 400. |
| Extracted barrels or circular imports obscure ownership | Use direct imports and one-way root → hook/model/presentation dependencies. |

## Non-goals

No route, service/API payload, query key, cache policy, Spanish copy, accessibility semantic, permission, responsive breakpoint, filter behavior, product behavior, performance optimization, styling refresh, or primary-seller selection changes. No mirrored query data, duplicate URL parser, separate mutation hooks, mandatory controller extraction, or recreation of PR #458 is allowed.
