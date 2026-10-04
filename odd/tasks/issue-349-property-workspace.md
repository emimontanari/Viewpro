# Issue #349 — Property detail workspace exploration

Branch: `docs/349-property-workspace-exploration`, base `origin/develop` @ 48733f86.
Approved issue: #349. User accepted the detail hub retaining `/edit` and authorized specs, tests and implementation.

## Tasks

- [x] Map detail/edit routes, current operations, authorization boundaries and tests.
- [x] Recommend desktop/mobile navigation and a bounded initial work unit.
- [x] Document the OpenSpec design before implementation.

## Constraints

Preserve separate domain operations, backend authorization and audit trails. No new primary-seller or property-proposal behavior. User prefers autonomous routine work without repeated OK prompts. #623 paused because VPS read access unavailable; no infrastructure changes.

## Accepted UX direction

Use the property detail as a hub and retain `/edit` for data/image editing. Four navigation groups: Data and images; People (owners/agents); Activity (status/movements); Documents. Preserve manager/seller affordances, archived-state rules and existing mutations. First proposed work unit: navigation and permission-aware links/anchors only, bounded by 400 authored diff lines; no component-wide rewrite.

Evidence: read-only handoff murld715-c-w9nx. Detail/edit are two modes of ProductViewPage/ProductForm. Existing save/cancel return to detail; list return is explicit. All operations already exist but lack a unified navigation hierarchy.

Planning: `openspec/changes/property-detail-workspace/`, 102 lines including accepted design, delta spec and tasks. Implementation groups visible data/images, people, status/requests/movements and documents without new operations.

## Verification and delivery

RED/GREEN evidence: missing links initially, then missing activity status/request content; 88 focused tests passed after corrections. Typecheck, scoped lint and formatting passed. Parent Playwright checks passed for manager and seller at 1440px/390px: keyboard/hash navigation, single visible data renderer, activity content, no horizontal overflow; manager edit/cancel/save/list returns passed on isolated `viewpro_349_navigation` fixtures. Archived affordances covered by integration/component tests, not a browser journey.

User selected `feature-branch-chain`: preparation (accepted planning plus pre-existing form formatting), then navigation with tests (~390 authored lines relative to preparation). Tracker remains draft/no-merge; each slice must stay under 400 additions/deletions. Native RDD, remote delivery and required CI remain pending.
