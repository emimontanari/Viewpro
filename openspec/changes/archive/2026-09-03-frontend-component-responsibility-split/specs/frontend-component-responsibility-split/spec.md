# Frontend Component Responsibility Split Specification

## Purpose

Define the behavior and delivery constraints for structurally separating the App New document-request, operational-homepage, and product-table components without changing their public behavior or introducing competing state ownership.

## Requirements

### Requirement: Public entry points and observable behavior remain stable

The change MUST preserve the existing public entry components, route wiring, user-visible states, Spanish copy, accessibility semantics, permissions, responsive behavior, service/API contracts, query keys, and URL behavior.

#### Scenario: Existing dashboard entries remain wired

- GIVEN a user navigates to `/dashboard`, `/dashboard/product`, or `/dashboard/product/[id]`
- WHEN the corresponding page renders
- THEN `/dashboard` reaches `OperationalHomepage`
- AND `/dashboard/product` reaches `ProductTable` through the existing listing and `Suspense` boundary
- AND `/dashboard/product/[id]` reaches `PropertyDocumentRequests` through the existing `product-form.tsx` prop flow
- AND no route or public entry-component contract changes

#### Scenario: Structural extraction does not change the product contract

- GIVEN the same tenant, role, permissions, URL state, and API responses as before extraction
- WHEN the affected component renders and users perform existing interactions
- THEN the visible states, copy, available actions, accessibility semantics, responsive output, query inputs, and URL transitions remain equivalent

### Requirement: Query, URL, and orchestration state has one authoritative owner

Each affected feature MUST retain exactly one authoritative owner for tenant context, URL state, query state, local orchestration state, and commands. Extracted presentation MUST consume explicit data, pending/error state, values, and callbacks and MUST NOT create a competing query, URL parser, mirrored server-data representation, or child-owned mutation boundary.

#### Scenario: Document-request ownership remains singular

- GIVEN `PropertyDocumentRequests` renders document requests and their actions
- WHEN presentation seams are extracted
- THEN the root or one cohesive controller remains authoritative for the document-request query, `nuqs` state, dialogs, deep-link lifecycle state, and four mutations
- AND extracted children do not fetch the request list, parse the URL, mirror server data, or call document services directly

#### Scenario: Product-table ownership remains singular

- GIVEN `ProductTable` renders tenant-scoped products
- WHEN toolbar, rows, cards, pagination, or state views are extracted
- THEN `ProductTable`, or one later complete controller boundary, remains the sole owner of tenant context, URL filters and pagination, the products query, and table derivation
- AND filtering and pagination are not split across competing orchestration hooks

#### Scenario: Operational homepage ownership remains singular

- GIVEN `OperationalHomepage` renders manager or seller dashboard content
- WHEN its adopted presentation seams are used
- THEN tenant/role branching, manager range state, and the four existing queries remain owned by the public container
- AND presentation children receive props rather than creating parallel dashboard queries or range state

### Requirement: Baseline evidence precedes every extraction under strict TDD

A relevant public-boundary characterization baseline MUST pass before each extraction seam begins, and the protecting tests MUST remain with that work unit. Structural extraction MUST start from that passing public-boundary baseline and remain green afterward. RED evidence is REQUIRED only when adding a missing regression contract for an actual behavioral defect or gap; a failing test MUST NOT be manufactured for an extraction that intends to preserve already-existing behavior. When a missing regression contract is added, its behavioral change MUST follow RED/GREEN sequencing before the structural extraction proceeds.

#### Scenario: Existing behavior starts extraction from a passing baseline

- GIVEN a proposed extraction preserves an already-existing public behavior
- WHEN the relevant public-boundary characterization tests pass before the structural change
- THEN the extraction MAY begin without manufacturing a failing behavioral test
- AND the same focused tests MUST remain green against the extracted structure

#### Scenario: A missing regression contract uses RED/GREEN evidence

- GIVEN an actual behavioral defect or missing regression contract is identified
- WHEN its regression test is added before the corrective change
- THEN the expected failing RED result MUST be recorded
- AND the test MUST pass after the corrective change and remain in the protecting work unit

#### Scenario: Document seam is blocked without its baseline

- GIVEN a proposed document-request extraction affects loading, errors, empty state, mutations, eligibility hints, preview fallback, or deep-link behavior
- WHEN the corresponding public-boundary tests have not passed
- THEN the extraction MUST NOT begin
- AND the unit is not complete until those tests pass against the extracted structure

#### Scenario: Product-table extraction is blocked without its baseline

- GIVEN a proposed product-table extraction
- WHEN tenant, query, URL-transition, pagination, desktop/mobile, permission, background-fetch, and filtered-empty characterization tests have not passed
- THEN the extraction MUST NOT begin
- AND the tests MUST assert user-visible behavior and `nuqs` setter payloads rather than extracted component names

#### Scenario: Baselines protect behavior rather than implementation names

- GIVEN a focused test suite for an affected public component
- WHEN internal helpers or presentation components are renamed or relocated
- THEN the suite continues to verify the public component's observable behavior
- AND it does not require a particular extracted file or component name

### Requirement: Document deep-link handling remains one atomic lifecycle

The document deep-link lifecycle MUST remain a single ordered orchestration boundary. It MUST preserve filter reset, resolved-history auto-open, post-paint scroll, highlight timing, loading-to-success sequencing, timer cleanup, and respect for a user's later collapse of resolved history.

#### Scenario: Deep link resets, opens, scrolls, and highlights in order

- GIVEN a document deep link identifies a request in resolved history
- WHEN `PropertyDocumentRequests` processes the link
- THEN the `doc` target causes the existing document filter reset
- AND resolved history opens once when the target is available
- AND scrolling occurs only after the resolved content has rendered and been measured
- AND the target is highlighted with the existing timing
- AND the lifecycle does not distribute these steps across independent effects or components

#### Scenario: Deep-link auto-open does not override user collapse

- GIVEN a deep link has auto-opened resolved history
- WHEN the user collapses resolved history
- THEN the collapsed state remains collapsed
- AND the deep-link lifecycle does not repeatedly reopen it

#### Scenario: Deep-link timing is cleaned up

- GIVEN the deep-link lifecycle schedules a highlight or scroll transition
- WHEN the component unmounts or the lifecycle is superseded
- THEN pending timers and one-shot work are cleaned up
- AND no stale target is scrolled to or highlighted

### Requirement: Document mutations preserve exact invalidation and feedback

Successful document create, approve, and reject mutations MUST preserve their existing payloads, dialog transitions, feedback, and exact cache invalidation. Each of those successful write mutations MUST invalidate `productKeys.documentRequests(productId, tenantId)` and MUST NOT broaden invalidation to unrelated keys or replace it with a competing cache update. A successful read mutation MUST preserve its safe-URL acquisition and opening behavior and MUST NOT invalidate the document-request list key. Mutation failures MUST preserve safe feedback and applicable dialog retention.

#### Scenario: Successful create, approve, and reject invalidate the document-request key

- GIVEN a document create, approve, or reject mutation succeeds for `productId` and `tenantId`
- WHEN the mutation completion is handled
- THEN the existing success feedback and applicable dialog behavior occur
- AND the exact `productKeys.documentRequests(productId, tenantId)` key is invalidated
- AND no unrelated product or tenant cache key is invalidated by the extraction

#### Scenario: Successful read opens a safe URL without list invalidation

- GIVEN a document read mutation succeeds for `productId` and `tenantId`
- WHEN the read completion is handled
- THEN the safe URL is obtained and opened using the existing behavior
- AND the `productKeys.documentRequests(productId, tenantId)` list key is not invalidated
- AND no read-specific list-cache invalidation is introduced by the extraction

#### Scenario: Mutation failure preserves safe recovery behavior

- GIVEN create, read, approve, or reject returns an error
- WHEN the public component handles the failure
- THEN the existing failure feedback is shown
- AND any dialog that must remain open for recovery remains open
- AND no optimistic or mirrored state contradicts the server result

### Requirement: Preview query ownership and failure fallback remain stable

`DocumentVersionPreviewMedia` MUST remain the sole owner of each version's signed-preview query if preview logic is moved. A signed-preview failure MUST render the existing file-icon fallback and MUST NOT make the request card or document workflow fail.

#### Scenario: Preview failure falls back to the file icon

- GIVEN a document version's signed-preview query fails
- WHEN its preview media renders
- THEN the existing file icon is shown
- AND the surrounding request remains usable
- AND no duplicate per-version preview query is introduced by a parent or sibling presentation component

### Requirement: PR #458 is adopted without duplicate homepage implementation

The operational-homepage portion MUST adopt or rebase the verified PR #458 slice as the sole implementation of that structural split. This change MUST NOT recreate, duplicate, or independently supersede the same extraction.

#### Scenario: Existing homepage slice is adopted once

- GIVEN PR #458's verified operational-homepage implementation is available
- WHEN this change integrates the homepage portion
- THEN the existing public component and import path remain intact
- AND the container ownership described above remains intact
- AND repository history and diff review show no parallel homepage extraction or duplicate implementation

### Requirement: Product-table work waits for the #304 gate and preserves seller ordering

Product-table extraction MUST NOT begin until issue #304's App New type/UI work has landed or has been definitively rebased away. After the gate, the work MUST start from a fresh `origin/develop` state and pass the App New typecheck before extraction. Responsibility splitting MUST remain separate from #304 primary-seller behavior.

#### Scenario: The #304 gate blocks table extraction

- GIVEN issue #304's App New type/UI work is still pending or has unresolved drift
- WHEN a product-table extraction unit is proposed
- THEN that unit is blocked
- AND no table extraction is combined with primary-seller behavior changes

#### Scenario: Table work begins from a verified post-gate baseline

- GIVEN the #304 gate is cleared by landing or definitive rebase
- WHEN product-table work starts
- THEN the work is based on fresh `origin/develop`
- AND App New typecheck passes before the extraction
- AND the first-assignment seller-summary contract remains under test

#### Scenario: Seller summary remains first-assignment ordered

- GIVEN a product has multiple API-ordered seller assignments
- WHEN the product table renders its seller summary
- THEN it displays the summary from the first API-ordered assignment
- AND it does not infer, select, promote, or display a primary seller as part of this responsibility split

### Requirement: Product-table responsive and permission behavior remains in parity

Desktop rows and mobile cards MUST continue to render equivalent product identity, status, price, owner, first-assignment seller summary, archive badge, and available actions from the same product data. Existing permission propagation MUST remain unchanged for quick-status controls and row actions.

#### Scenario: Desktop and mobile views expose equivalent product information

- GIVEN the same product data and viewport-specific rendering path
- WHEN desktop rows and mobile cards render
- THEN both expose the same identity, status, price, owner, seller summary, archive state, and applicable actions
- AND shared data is not replaced with view-specific inferred values

#### Scenario: Permissions remain consistent across views

- GIVEN a user with or without the existing quick-status and row-action permissions
- WHEN desktop and mobile product views render
- THEN each view exposes exactly the actions allowed by those permissions
- AND extraction does not grant, remove, or relocate authorization to the presentation child

### Requirement: Every review unit is independently verifiable and rollbackable below budget

Every implementation work unit MUST include the tests that protect its behavior, remain runnable after applying only that unit, be independently understandable and rollbackable, and contain fewer than 400 changed lines including tests and moved code. A forecast at or above 400 changed lines MUST be split before implementation.

#### Scenario: A review unit stays within the change budget

- GIVEN a planned extraction or baseline unit
- WHEN its additions, deletions, and test changes are forecast
- THEN the total is below 400 changed lines
- AND the unit has one clear behavioral or structural purpose
- AND its focused verification is included in the same unit

#### Scenario: A unit can be reverted without unrelated damage

- GIVEN a completed review unit and its landed predecessors
- WHEN only that unit is reverted
- THEN the public component remains runnable
- AND unrelated features and earlier characterization baselines remain intact
- AND an atomic deep-link or cohesive controller extraction is reverted as one boundary

### Requirement: Verification is completed after each unit and at final delivery

After every unit, focused affected-component tests MUST pass, followed by App New typecheck and strict lint. Final delivery MUST also run the configured App New test suite, seeded E2E suite, formatter and diff checks, and the repository build gate when exposed; results, skipped checks, blockers, and residual risks MUST be recorded.

#### Scenario: Unit verification gates the next unit

- GIVEN a review unit has been implemented
- WHEN its verification is run
- THEN focused component or helper tests pass
- AND App New typecheck and strict lint pass
- AND the next unit cannot start with an unresolved failure

#### Scenario: Final verification covers focused and repository gates

- GIVEN all required units have landed
- WHEN final verification is performed
- THEN the configured App New tests pass with `pnpm --filter next-shadcn-dashboard-starter test`
- AND App New typecheck passes with `pnpm --filter next-shadcn-dashboard-starter typecheck`
- AND strict lint passes with `pnpm --filter next-shadcn-dashboard-starter lint:strict`
- AND seeded E2E passes with `pnpm --filter next-shadcn-dashboard-starter test:seeded`
- AND formatter check passes with `pnpm --filter next-shadcn-dashboard-starter format:check`
- AND `git diff --check` and the exposed build gate pass
- AND exact command results, skipped checks, blockers, and residual risks are recorded
