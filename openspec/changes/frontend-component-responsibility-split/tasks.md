# Tasks: Frontend Component Responsibility Split

These are execution tasks, not completion claims. Leave every checkbox unchecked until its evidence is recorded. Every implementation unit starts from the then-current `origin/develop`, includes its protecting tests, remains runnable alone, and lands only after its gates pass. Proposal, spec, and design are authoritative for detail; this file records execution boundaries.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Planning chain: P0a explore + proposal ~374 lines; P0b spec ~258; P0c design ~246; P0d tasks <400. Implementation chain: ~3,100–4,600 required, or ~3,740–5,075 with both optional controllers; D2a ~270–320 and D2b ~190–250 from the measured 468-line D2 candidate; D4a1 ~190–260 and D4a2 ~230–320 from the measured 470 source-additions-plus-deletions D4a candidate; D4b1 ~225–280 and D4b2 ~310–345 artifact-inclusive. |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | P0a → P0b → P0c → P0d → O1 → D1 → D2a → D2b → D3 → D4a1 → D4a2 → D4b1 → D4b2 → D5 → D6 → optional D7 → #304 gate → T1 → T2 → T3a → T3b → T4 → T5 → optional T6 → final lifecycle |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main, implemented as sequential fresh worktrees/branches landing to `develop` |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Planning-chain boundaries

- P0a contains only `openspec/changes/frontend-component-responsibility-split/{explore.md,proposal.md}` (~374 artifact lines); land it to `develop` before creating the fresh P0b worktree.
- P0b contains only `specs/frontend-component-responsibility-split/spec.md` (~258 lines); land it before fresh P0c.
- P0c contains only `design.md` (~246 lines); land it before fresh P0d.
- P0d contains only this compact `tasks.md` and must remain below 400 lines; land it before O1 or any implementation worktree. No implementation is complete merely because planning artifacts land.
- Each planning PR records its start branch, documentation-only diff, `git diff --check`, landed SHA, and next fresh `origin/develop` worktree. Stop on source changes, duplicate PR #458 work, #304 behavior, or unrelated documentation.

### Implementation budget

Each implementation PR stays below 400 additions plus deletions; stop scope at 350 for reassessment and split before 400. The unit includes its tests, verification, rollback boundary, start/finish state, current-PR `📍` dependency diagram, changed-line count, and explicit non-goals. No API, database, migration, seed, route, deployment, or product-policy work is in scope.

## Shared gates and verification

- A behavior-preserving extraction starts with a passing public characterization; never manufacture RED. A real defect or missing contract stops extraction and becomes a separate RED/GREEN correction unit before resuming.
- Presentation children receive explicit data, pending/error state, and callbacks. They do not fetch, parse URL state, mirror server data, own permissions, or call services. Use direct relative imports and one-way root → model/hook/presentation dependencies.
- Document writes (create/approve/reject) retain payloads, feedback, dialog behavior, and exactly `productKeys.documentRequests(productId, tenantId)` invalidation. A successful user read obtains the safe URL and calls `window.open(url, '_blank', 'noopener,noreferrer')` without invalidating that list; preview reads also do not invalidate it.
- The document deep-link reset/open/scroll/highlight lifecycle remains atomic; the preview query remains solely in `DocumentVersionPreviewMedia` with its existing key, `retry: false`, and `staleTime: 60_000`.
- Product-table work cannot start until the #304 App New gate is landed or definitively rebased away. Afterward fetch and branch from fresh `origin/develop`, confirm types, and pass typecheck. Never add primary-seller behavior; `getAgentSummary` remains first API-ordered assignment.
- A failed focused test, typecheck, strict lint, formatter, ownership audit, diff check, or budget count blocks the next unit. Use a clearly marked test database for any command that could touch API data.

### Focused commands (run from `viewpro-app/`)

```bash
DOC="pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx"
MODEL="pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts"
TABLE="pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/product-tables/product-table.test.tsx"
HOME="pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/dashboard/components/operational-homepage.test.tsx"
TYPE="pnpm --filter next-shadcn-dashboard-starter typecheck"
LINT="pnpm --filter next-shadcn-dashboard-starter lint:strict"
cd apps/app-new && pnpm format:check
cd ../.. && git diff --check && git diff --numstat
```

Record the before-change result, characterization versus genuine RED, after-change result, typecheck, lint, formatter, diff check, and exact changed-line count in every unit. Final checks are listed below.

## Scenario traceability

| Contract/scenario | Units protecting it |
|---|---|
| Existing `/dashboard` (read-only), `/dashboard/product` (read-only), and `/dashboard/product/[id]` (read-only) entries and singular homepage ownership | O1, final |
| Visible contract: copy, accessibility, permissions, responsive output, query inputs, URL transitions | D2a–D6, optional D7, T2–T5, optional T6, final |
| Document loading/error/empty, hints, filters, mutations, failures, preview fallback | D1, D2a, D2b, D3–D5, optional D7 |
| Core grouping, filtering, active-filter normalization, eligibility, and counts | D1, D2a, D3, D4a1–D4a2 |
| Chronology, compact descriptions, file/version labels, MIME, and compact dates | D1, D2b, D4b2–D5 |
| Read has no list invalidation; create/approve/reject have exact write invalidation | D1, D5, optional D7 |
| Deep-link reset, one-shot open, post-paint scroll/highlight, cleanup, and user collapse | D1, D6 |
| Preview query ownership and file-icon failure fallback | D1, D5 |
| Product tenant/query/URL/pagination/responsive/permission/fetching behavior | #304 gate, T1–T5, optional T6, final |
| First-assignment seller ordering; no primary-seller inference | #304 gate, T1, T3a–T4 |
| Baseline-first extraction and genuine RED/GREEN correction handling | D1, D2a, D2b, D3, D4a1–D6, T1–T5 |
| Independently runnable, rollbackable, under-budget units with recorded evidence | every implementation unit |

## Ordered work units

### P0a–P0d — Sequential planning publication (parent lifecycle gates)

**Targets:** `explore.md`, `proposal.md`, `specs/frontend-component-responsibility-split/spec.md`, `design.md`, and `tasks.md` under `openspec/changes/frontend-component-responsibility-split/`.

**Boundary/dependency:** Publish P0a (~374 lines), then P0b (~258), then P0c (~246), then compact P0d (<400), each from a fresh worktree after the previous SHA lands on `develop`. These are documentation-only; no source, #304 behavior, or recreated #458 diff.

- [x] Land P0a `explore.md` and `proposal.md` as a documentation-only PR, record `git diff --stat`, `git diff --check`, SHA, and next fresh `develop` base. <!-- sdd-owner: parent -->
- [x] Land P0b `specs/frontend-component-responsibility-split/spec.md` after P0a, record its focused documentation evidence and SHA, then create fresh P0c. <!-- sdd-owner: parent -->
- [x] Land P0c `design.md` after P0b, record its focused documentation evidence and SHA, then create fresh P0d. <!-- sdd-owner: parent -->
- [x] Land compact P0d `tasks.md` below 400 lines after P0c; confirm no product source changed before O1 or D1 worktree creation. <!-- sdd-owner: parent -->

### O1 — Adopt PR #458 once (parent lifecycle gate)

**Target:** existing PR #458 branch at `8caf9153bedef4228c2c26c560f5ee12dbc986f9`, with `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx` and its existing `operational-homepage/` modules/tests only if baseline drift requires rebase correction. **Dependency:** P0d landed. **Stop:** duplicate homepage files/imports, behavior/query/range ownership drift, unresolved rebase, or dashboard behavior changes. **Rollback:** revert the existing #458 unit, never a counter-extraction. **Publish:** record merge/already-landed SHA before D1.

- [x] Adopt or rebase PR #458 without duplicating it; verify `/dashboard` (read-only) and record its SHA using `HOME`, `TYPE`, `LINT`, package-local `pnpm format:check`, and `git diff --check`. <!-- sdd-owner: parent -->

### D1 — Document public-boundary baselines (required)

**Target:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`; no production extraction. **Dependency:** P0d and O1 landed; confirm unchanged `product-form.tsx` prop flow. **Cover:** loading/error/empty; create payload/closure/exact write invalidation/success feedback; no-owner, revoked-only, and invited-owner hints; read/approve/reject failures and dialog retention; preview file-icon fallback; deep-link user collapse. **Stop:** failing baseline, internal-name assertions, or a product decision. **Rollback/publish:** revert test-only additions; land before D2a.

- [x] RED: In `property-document-requests.test.tsx`, add only missing black-box characterizations and record passing baseline or genuine defect RED; do not manufacture failure. <!-- sdd-owner: implementation -->
- [x] GREEN: In `property-document-requests.test.tsx`, resolve a genuine baseline defect only in a separate correction unit, or record that none exists; keep production extraction out of D1. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `DOC` against `property-document-requests.test.tsx` for all required states, hints, mutation feedback/retention, exact write invalidation versus read non-invalidation, preview fallback, and collapse persistence. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Keep `property-document-requests.test.tsx` public-boundary, focused, under budget, and verify `TYPE`, `LINT`, formatter, `git diff --check`, and `git diff --numstat` before landing. <!-- sdd-owner: implementation -->

### D2a — Document core list model (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; new `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/model.ts` and `model.test.ts`. **Dependency:** landed D1, passing `DOC`, and a fresh worktree from the then-current `origin/develop`; D2a must land before D2b starts. **Boundary:** move only filter types/options, owner eligibility, active-filter normalization, grouping/filtering, and counts; add focused pure tests for this slice and wire the root to the core helpers. Leave chronology and metadata helpers for D2b. **Forecast:** approximately 270–320 changed lines, based on the measured candidate allocation, and below 400. **Stop:** failing D1 baseline, UI/service/query/React/URL imports in the model, ordering/copy drift, a non-runnable root, or forecast/actual count of 400 or more. **Rollback/publish:** revert the D2a model/test/root wiring as one unit; confirm the pre-D2a root remains runnable; publish only after all D2a checks pass, then create fresh D2b from landed D2a.

- [x] RED: From `viewpro-app/`, run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx`; record the passing D1 characterization, then add only core edge cases to `model.test.ts`, run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts`, and record the expected missing-module structural RED without manufacturing a behavioral failure. <!-- sdd-owner: implementation -->
- [x] GREEN: In `model.ts`, implement and export only the core list model; update `property-document-requests.tsx` to import and use those helpers while preserving the existing public output, URL owner, query owner, and permissions. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx`; audit `model.ts` for imports limited to feature API types/date formatter and verify `pnpm --filter next-shadcn-dashboard-starter typecheck`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/model.ts src/features/products/components/property-document-requests/model.test.ts`, `cd apps/app-new && pnpm format:check`, `git diff --check`, and `git diff --numstat` below 400. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only the duplicated core definitions from `property-document-requests.tsx`, retain direct relative imports, rerun the focused suites and checks, and leave a runnable rollback boundary for D2b. <!-- sdd-owner: implementation -->

### D2b — Document metadata model (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; existing `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/model.ts` and `model.test.ts`. **Dependency:** D2a is landed, its focused suites/checks pass, and the worktree is refreshed from the landed D2a base; D3 must wait for D2b. **Boundary:** add and wire only chronology selection, compact descriptions, filename/file-format labels, version numbering, MIME classification, and compact date formatting; extend model tests for these helpers and keep the D2a core slice intact. **Forecast:** approximately 190–250 changed lines, based on the measured candidate allocation, and below 400. **Stop:** starting before landed D2a, duplicate state/query/URL ownership, model imports outside the approved dependency boundary, metadata/order/copy drift, a non-runnable root, or forecast/actual count of 400 or more. **Rollback/publish:** revert D2b metadata additions, tests, and root wiring together to the landed D2a state; publish only after its unit checks pass, then allow D3 to start.

- [x] RED: From the landed D2a worktree, rerun `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts`; add only diagnostic metadata edge cases and record characterization or a legitimate missing-contract RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Extend `model.ts` with the metadata helpers, extend `model.test.ts`, and wire their imports into `property-document-requests.tsx` without changing chronology, descriptions, labels, versions, MIME/date output, or ownership. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx`; audit the model dependency boundary and verify `pnpm --filter next-shadcn-dashboard-starter typecheck`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/model.ts src/features/products/components/property-document-requests/model.test.ts`, `cd apps/app-new && pnpm format:check`, `git diff --check`, and `git diff --numstat` below 400. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only the remaining duplicated metadata definitions from `property-document-requests.tsx`, preserve the landed D2a core imports and tests, rerun all D2b checks, and publish the independently rollbackable metadata unit before D3. <!-- sdd-owner: implementation -->

### D3 — Document states, hints, filters (required)

**Targets:** `property-document-requests.tsx`; new `property-document-requests/states-and-filters.tsx`. **Dependency:** D2b landed. **Boundary:** controlled presentation receives counts, archive/permission booleans, active filter, counts, pending/error, and `onFilterChange`; no owners, URL names, query objects, setters, tenant, or services. **Stop:** child URL/query/fetch ownership, copy/loading/error/empty drift, or budget risk. **Rollback/publish:** revert module/root wiring; land before D4a1.

- [x] RED: Re-run `DOC` in `property-document-requests.test.tsx` for loading/error/empty, owner hints, filter counts, and transitions before moving presentation. <!-- sdd-owner: implementation -->
- [x] GREEN: Extract `states-and-filters.tsx` and wire explicit root-owned values/callbacks without changing behavior. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Verify `states-and-filters.tsx` preserves Spanish copy, accessibility, permissions, archive behavior, and no child fetch/URL ownership with `DOC`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only moved presentation from `property-document-requests.tsx`, retain direct imports, and land below budget. <!-- sdd-owner: implementation -->

### D4a1 — Document controlled request section/disclosure shell (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`; existing `property-document-requests.test.tsx`. **Dependency:** D3 is landed, all document tests pass, and this unit starts from a fresh worktree at the then-current `origin/develop`. **Boundary:** move only `DocumentRequestSection`, its group heading, and the controlled resolved `Collapsible`/disclosure shell. Accept explicit children or a render-list input as needed. Keep `DocumentRequestList`, item mapping, `<li data-request-id>`, highlight wrapper/class, and all item/status/rejection/actions/version/preview detail in `property-document-requests.tsx`; the root retains resolved-open value/change ownership. **Forecast:** approximately 190–260 changed lines, allocated from the measured 470-line D4a candidate, below 400. **Stop:** list/anchor detail moves early, child-owned open state, root import, deep-link ordering drift, non-runnable root, or forecast/actual count of 400 or more. **Rollback/publish:** revert this module/root wiring as one shell unit; confirm the root is runnable, run the listed checks, and publish before creating D4a2.

- [x] RED: From `viewpro-app/`, run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts`; record the 34/34 and 6/6 characterization baselines for disclosure, grouping, permissions, and unchanged anchors; do not manufacture a behavioral RED. <!-- sdd-owner: implementation -->
- [x] GREEN: In `request-list.tsx` and `property-document-requests.tsx`, move only the controlled section/group-heading/`Collapsible` shell with explicit children or render-list input; leave list, mapping, anchors, and detail in the root. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `DOC`, `TYPE`, `LINT`, `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx`, `cd apps/app-new && pnpm format:check`, and `git diff --check && git diff --numstat`; audit that `request-list.tsx` has no root, query, URL, service, or mutation import and that the count is below 400. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only the moved section/disclosure duplicate from `property-document-requests.tsx`, rerun the focused checks, record the measured under-budget diff, and publish the independently rollbackable D4a1 before D4a2. <!-- sdd-owner: implementation -->

### D4a2 — Document request list/anchor shell (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`; existing `property-document-requests.test.tsx`. **Dependency:** landed D4a1, passing D4a1 focused checks, and a fresh worktree from the D4a1 landing. **Boundary:** move `DocumentRequestList`, item mapping, the `<li data-request-id>` anchor, and the highlight wrapper/class to `request-list.tsx`. Keep item/status/rejection/actions/version/preview detail in the root through a narrow explicit `renderItem` seam. The list module has no root import, services, query/URL ownership, mutations, or independent state. **Forecast:** approximately 230–320 changed lines, allocated from the measured 470-line D4a candidate including the explicit render-item seam, below 400. **Stop:** detail or orchestration leaks into the list module, anchor/highlight drift, root import, independent state, non-runnable root, or forecast/actual count of 400 or more. **Rollback/publish:** revert the list/anchor wiring as one unit, confirm D4a1 remains runnable, and publish D4a2 before D4b1.

- [x] RED: From `viewpro-app/`, run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts`; record the landed D4a1 characterization for list grouping, resolved disclosure, highlight anchors, permissions, item output, and the 6/6 model suite; do not manufacture a behavioral RED. <!-- sdd-owner: implementation -->
- [x] GREEN: In `request-list.tsx` and `property-document-requests.tsx`, move only list composition/mapping and the `<li data-request-id>` highlight wrapper, passing root-owned item detail through an explicit `renderItem` seam. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `DOC`, `TYPE`, `LINT`, `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx`, `cd apps/app-new && pnpm format:check`, and `git diff --check && git diff --numstat`; audit no root/query/URL/service/mutation imports and verify the D4a2 count is below 400. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only the moved list/mapping/anchor duplicate, rerun focused checks, record the measured under-budget diff and rollback boundary, and publish D4a2 before D4b1. <!-- sdd-owner: implementation -->

### D4b1 — Document request status/rejection primitives (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`; existing `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`. **Dependency:** D4a2 is merged as PR #480 at `c668d109`; start from a fresh `origin/develop` containing landed D4a2. **Boundary:** move only `DocumentStatusConfig`, `documentStatusConfig`, `DocumentStatusBadge`, and `RejectionReason` to `request-list.tsx`; keep the root request item intact and have it import those primitives. Complete the missing black-box characterizations for rejection heading/reason and disabled review actions while a mutation is pending, proving the baseline first without manufacturing RED. The child owns no mutations, services, URL/query state, root imports, or independent state. **Forecast:** approximately 225–280 artifact-inclusive changed lines; hard stop at 400 or more. **Rollback/publish:** revert the primitive imports/module and characterization changes together; verify the root remains runnable and land D4b1 before starting D4b2.

- [x] RED: From `viewpro-app/`, run `DOC` and `MODEL` against the landed D4a2 baseline, then add or complete only the public assertions in `property-document-requests.test.tsx` for rejection heading/reason and disabled review actions during a pending mutation; record passing characterization as baseline and do not manufacture a failing RED. <!-- sdd-owner: implementation -->
- [x] GREEN: Move only `DocumentStatusConfig`, `documentStatusConfig`, `DocumentStatusBadge`, and `RejectionReason` into `request-list.tsx`; update the intact root item to import and use those exports without moving mutations, services, URL/query state, root imports, or state ownership. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: Run `DOC`, `MODEL`, `TYPE`, `LINT`, and `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx src/features/products/components/property-document-requests.test.tsx`; run `cd apps/app-new && pnpm format:check` and classify any package-wide failure against the known unrelated formatting baseline; run `git diff --check && git diff --numstat`, record exact additions plus deletions, and audit `request-list.tsx` for no mutation/service/URL/query/root imports or child-owned state. <!-- sdd-owner: implementation -->
- [x] REFACTOR: Remove only the duplicated status/rejection primitive definitions, rerun `DOC` and `MODEL`, record the measured 225–280 artifact-inclusive diff and independent rollback boundary, and publish D4b1 before D4b2. <!-- sdd-owner: implementation -->

### D4b2 — Document request item/read/review shell (required)

**Targets:** `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`; `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`; existing `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`. **Dependency:** D4b1 is landed with its focused suites/checks passing; start from a fresh `origin/develop` containing landed D4b1. **Boundary:** move `DocumentRequestItem` into `request-list.tsx`, retain the D4a2 `renderItem` seam, and have the root render the exported item with explicit `request`, permission, pending flags, callbacks, and a root-built `versionSummary: ReactNode`. Preserve exact markup, button order, copy, feedback-triggering commands, review/read behavior, and the preview boundary. The root retains mutations, feedback, rejection controlled state/dialog, `DocumentVersionSummary`, preview query/media/file icon (D5), URL/deep-link lifecycle (D6), list anchors/highlight, and group/disclosure ownership as already designed. The child owns no service/query/URL/mutation/root imports or independent state. **Forecast:** approximately 310–345 artifact-inclusive changed lines; reassess immediately at 350 and hard stop at 400 or more. **Rollback/publish:** revert the item shell/seam wiring atomically; verify D4b1 remains runnable and land D4b2 before D5.

- [ ] RED: From `viewpro-app/`, run `DOC` and `MODEL` against the landed D4b1 baseline and record submitted, pending, resolved, status, permission, review/read, feedback, and item-output characterization; preserve passing behavior as the baseline and do not manufacture a failing RED. <!-- sdd-owner: implementation -->
- [ ] GREEN: Move `DocumentRequestItem` into `request-list.tsx` behind the D4a2 `renderItem` seam; pass explicit request, permission, pending flags, callbacks, and root-built `versionSummary: ReactNode`, preserving exact markup, button order, copy, feedback commands, review/read behavior, and preview boundary while rejection state/dialog ownership remains in the root. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Run `DOC`, `MODEL`, `TYPE`, `LINT`, and `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx src/features/products/components/property-document-requests.test.tsx`; run `cd apps/app-new && pnpm format:check` and classify package-wide failures against the known unrelated formatting baseline; run `git diff --check && git diff --numstat`, record exact additions plus deletions and reassess at 350, and audit child imports/state plus root ownership of mutations, feedback, rejection dialog, version summary, preview, URL/deep-link lifecycle, anchors/highlight, and disclosure. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only the duplicated root `DocumentRequestItem` definition and rerun `DOC`, `MODEL`, `TYPE`, `LINT`, scoped formatting, package-format baseline classification, diff check, import/ownership audit, and exact numstat; record the 310–345 artifact-inclusive result, rollback boundary, and pre-D5 landing. <!-- sdd-owner: implementation -->

### D5 — Document version and preview (required)

**Targets:** `property-document-requests.tsx`; new `property-document-requests/document-version.tsx`; existing public test. **Dependency:** D4b2. **Boundary:** prop-driven `DocumentVersionSummary` raises read; only `DocumentVersionPreviewMedia` owns `[..., 'document-version-preview', version.id]`, `retry:false`, `staleTime:60_000`, and `createProductDocumentReadUrl`; absent/error URL keeps file icon. **Stop:** duplicate preview query, read/list invalidation, unsafe read, or request failure on preview error. **Rollback/publish:** atomically revert module/root wiring; land before D6.

- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for preview fallback, version metadata, safe read, exact write invalidation, and read/no-list-invalidation behavior. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `document-version.tsx` while preserving sole preview query ownership, settings, file icon, read command, and failure recovery. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `document-version.tsx` and its public test, prove failed previews leave requests usable and reads do not invalidate the list; run `DOC`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only moved version code from `property-document-requests.tsx`, keep direct relative imports, and land below budget. <!-- sdd-owner: implementation -->

### D6 — Atomic document deep-link hook (required)

**Targets:** `property-document-requests.tsx`; new `property-document-requests/use-document-request-deep-link.ts`; existing public test. **Dependency:** D5. **Boundary:** hook inputs `highlightDocId`, successful data, authoritative `setDocumentFilter`; returns `{containerRef, highlightedId, resolvedOpen, onResolvedOpenChange}` and keeps reset, one-shot open, post-paint lookup/scroll, highlight timer/cleanup, and user collapse together. Root retains read-only `doc` and `nuqs` `documentos`. **Stop:** distributed effects, reset open-ref on collapse, pre-measure scroll, stale timer, URL parsing/fetching/grouping in hook. **Rollback/publish:** revert hook atomically; land before D7 decision and table chain.

- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for deep-link reset/open/scroll/highlight, loading-to-success timing, supersession/unmount cleanup, and user-collapse cases. <!-- sdd-owner: implementation -->
- [ ] GREEN: Move the complete ordered lifecycle to `use-document-request-deep-link.ts` without a second filter value or URL owner. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `use-document-request-deep-link.ts`, exercise Radix measurement timing and cleanup, audit effect/ref ordering and ownership, and run `DOC`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only root effect duplicates from `property-document-requests.tsx`, keep ordered effects together, and land the atomic under-budget hook. <!-- sdd-owner: implementation -->

### D7 — Optional document controller

**Optional, not completion-required.** **Targets:** `property-document-requests.tsx`; optional `property-document-requests/use-document-request-controller.ts`; public test. **Dependency:** D6 and written proof that root orchestration remains materially mixed. One controller may own all four mutations, dialogs, pending/feedback, safe read, and exact write invalidation; it must not own `nuqs`, list query, or deep-link effects. **Omit** if root is coherent. **Stop/rollback:** stop on split mutation ownership, changed payload/dialog retention, read invalidation, broad cache invalidation, or budget risk; revert controller independently.

- [ ] RED: In `property-document-requests.test.tsx` and the D7 decision record, re-run mutation characterization and record justification, or record D7 omission. <!-- sdd-owner: implementation -->
- [ ] GREEN: If justified, extract one complete controller; otherwise leave `property-document-requests.tsx` unchanged and record omission. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `use-document-request-controller.ts` or `property-document-requests.tsx`, verify create/approve/reject exact `productKeys.documentRequests(productId, tenantId)` invalidation and read non-invalidation, feedback, safe URL, and dialog retention with `DOC`, `TYPE`, `LINT`, formatter, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Land only a clearer independently rollbackable `use-document-request-controller.ts`, or land the documented omission decision without source changes. <!-- sdd-owner: implementation -->

### GATE-T — Clear issue #304 before tables (parent lifecycle gate)

**Targets/discovery:** issue #304 status and landed/rebased App New files, especially `features/products/api/types.ts`, `property-agents-section.tsx`, `manage-property-agents-dialog.tsx`, and related tests. **Dependency:** required D1–D6 and D7 decision landed. **Gate:** #304 must land or be definitively rebased away; then `git fetch origin`, fresh `origin/develop` worktree, expected `Product`/agent shape, and pre-change App New typecheck. **Stop:** any pending/unresolved drift; never change seller selection or #304 files in T units. **Rollback:** abandon/rebase unstarted table branch.

- [ ] Confirm the #304 App New gate and SHA/rebase decision, create fresh post-gate `origin/develop`, verify expected types, and record passing pre-change `TYPE` before T1. <!-- sdd-owner: parent -->

### T1 — Product-table public baselines (required)

**Target:** `viewpro-app/apps/app-new/src/features/products/components/product-tables/product-table.test.tsx`; no production extraction. **Dependency:** clear GATE-T and fresh base/typecheck. **Cover:** tenant/no-tenant and query loading/error/retry/empty; URL filters including `archived:'active'`; filter/clear labels/count and page resets; clamping, disabled controls, page-size reset; desktop/mobile identity/status/price/owner/first-assignment seller/archive/actions; permissions; background fetching; filtered-empty clear. Assert behavior and `nuqs` payloads, not names. **Stop/rollback/publish:** failing baseline, #304 type drift, primary-seller inference, or product decision; test-only revert; land before T2.

- [ ] RED: Add/run only missing black-box cases in `product-table.test.tsx`, recording passing characterization or genuine RED from the post-#304 base. <!-- sdd-owner: implementation -->
- [ ] GREEN: In `product-table.test.tsx`, resolve a genuine baseline defect separately, or record none; do not extract production code in T1. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `product-table.test.tsx`, verify URL filters/setters, active archive, page behavior, responsive parity, permissions, background fetch, filtered-empty clear, and first-assignment ordering with `TABLE`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Keep `product-table.test.tsx` black-box, under budget, and free of primary-seller behavior, then land T1. <!-- sdd-owner: implementation -->

### T2 — Product-table toolbar/filters (required)

**Targets:** `product-tables/index.tsx`, new `product-tables/toolbar.tsx`, existing table test. **Dependency:** T1. **Boundary:** controlled toolbar, badges, selects, page-size and summary receive primitive values/labels/counts/permissions/fetching/callbacks; no `nuqs`, tenant, query, or local filter state. **Stop/rollback/publish:** second URL owner, reset/label/count/permission drift, or budget risk; revert toolbar/root wiring; land before T3a.

- [ ] RED: Re-run `product-table.test.tsx` toolbar values, labels/counts, archive default, clear, and page-reset payload characterization. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `toolbar.tsx` with explicit callbacks while `index.tsx` remains URL/query authority. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Verify `toolbar.tsx` controls, accessibility, permissions, fetching, one-way imports, `TABLE`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only moved toolbar code from `product-tables/index.tsx` and land below budget. <!-- sdd-owner: implementation -->

### T3a — Shared product summaries (required)

**Targets:** `product-tables/index.tsx`, new `product-tables/product-summary.tsx`, existing `columns.tsx` and table test. **Dependency:** T2 and seller-order tests. **Boundary:** shared identity/thumbnail/archive/owner/metric presentation receives `Product` and flags; use pure helpers directly; never inspect `isPrimary`, sort/select sellers, fetch, parse URL, or authorize. **Stop/rollback/publish:** seller-order or viewport divergence, forbidden inference, or budget risk; revert module/wiring; land before T3b/T4.

- [ ] RED: Re-run desktop/mobile identity, owner, seller, archive, metric, action, and first-assignment characterization in `product-table.test.tsx`. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `product-summary.tsx` without changing `getAgentSummary` or adding primary-seller selection. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `product-summary.tsx` and `product-table.test.tsx`, test two ordered assignments where the first is not primary, verify both paths consume the same `Product`, and run `TABLE`, `TYPE`, `LINT`, formatter, diff check, and import audit. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only duplicated summary markup from `product-tables/index.tsx` and land the shared primitive below budget. <!-- sdd-owner: implementation -->

### T3b — Desktop table/rows (required)

**Targets:** `product-tables/index.tsx`, new `product-tables/desktop-table.tsx`, existing `columns.tsx`, `cell-action.tsx`, and table test. **Dependency:** T3a. **Boundary:** desktop shell/header/rows receive original products and `canManageProperties`; pass permission unchanged to quick status and row actions; no query/table ownership. **Stop/rollback/publish:** row/action/permission/seller/accessibility drift or budget risk; revert desktop move; land before T4.

- [ ] RED: Re-run desktop identity/status/price/owner/first-assignment seller/archive/action and permission characterization in `product-table.test.tsx`. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `desktop-table.tsx` with unchanged inputs, shared summaries, and permission callbacks. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Verify `desktop-table.tsx` actions, quick status, seller order, accessibility, and no child query ownership with `TABLE`, `TYPE`, `LINT`, formatter, diff check, import audit, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only moved desktop markup from `product-tables/index.tsx` and land a focused under-budget unit. <!-- sdd-owner: implementation -->

### T4 — Mobile cards (required)

**Targets:** `product-tables/index.tsx`, new `product-tables/mobile-cards.tsx`, `product-summary.tsx`, `cell-action.tsx`, and table test. **Dependency:** T3b. **Boundary:** same `Product[]`, shared summaries, and `canManageProperties`; no inferred values, query, URL, or child authorization. **Stop/rollback/publish:** responsive/action/permission/primary-seller drift or budget risk; revert mobile wiring; land before T5.

- [ ] RED: Re-run mobile-versus-desktop identity, status, price, owner, first-assignment seller, archive, action, and permission characterization in `product-table.test.tsx`. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `mobile-cards.tsx` using shared summaries and unchanged commands. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Verify `mobile-cards.tsx` parity, accessible controls, permission propagation, no child URL/query ownership, and run `TABLE`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only moved mobile markup from `product-tables/index.tsx` and land the rollbackable responsive unit. <!-- sdd-owner: implementation -->

### T5 — Pagination and table states (required)

**Targets:** `product-tables/index.tsx`, new `product-tables/pagination.tsx` and `states.tsx`, existing table test. **Dependency:** T4. **Boundary:** pagination receives page/count/size/total and `onPageChange`; root retains clamping. States receive retry/clear/create callbacks and no query, tenant, or URL state. **Stop/rollback/publish:** changed clamping, reset, disabled controls, copy, skeleton, retry/clear, or budget risk; revert modules/root wiring; land before T6 decision.

- [ ] RED: Re-run pagination, loading/error/empty/retry/clear, skeleton, and background-fetch characterization in `product-table.test.tsx`. <!-- sdd-owner: implementation -->
- [ ] GREEN: Extract `pagination.tsx` and `states.tsx` with root-owned query/URL/clamping commands. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Verify `pagination.tsx`/`states.tsx` boundaries, disabled controls, page-size reset, filtered-empty clear, permissions, no child query ownership, and run `TABLE`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Remove only moved state/pagination markup from `product-tables/index.tsx` and land the stable public container unit. <!-- sdd-owner: implementation -->

### T6 — Optional product-table controller

**Optional, not completion-required.** **Targets:** `product-tables/index.tsx`; optional `product-tables/use-product-table-controller.ts`; table test. **Dependency:** T5, #304 still landed/rebased, and written proof that the root remains materially mixed. One controller may own tenant, `useQueryStates`, normalized filters, products query, page count/clamping, `useReactTable`, permissions, and setters; never split orchestration or mirror server data. **Omit** if root is coherent. **Stop/rollback:** seller/#304 drift, less-clear ownership, mirrored state, or budget risk; revert independently.

- [ ] RED: In `product-table.test.tsx` and the T6 decision record, re-run T5 baselines and record justification, or record T6 omission. <!-- sdd-owner: implementation -->
- [ ] GREEN: If justified, extract one complete controller; otherwise leave `index.tsx` unchanged and record omission. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: In `use-product-table-controller.ts` or `product-tables/index.tsx`, verify filters/setter payloads, clamping, React Table derivation, permissions, seller order, and no mirrored state with `TABLE`, `TYPE`, `LINT`, formatter, diff check, and numstat. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: Land `use-product-table-controller.ts` only if ownership is clearer and rollbackable; otherwise land the documented omission decision without source changes. <!-- sdd-owner: implementation -->

## Parent-owned post-implementation lifecycle

Run only after required units land; D7/T6 omission records satisfy their optional decisions. From `viewpro-app/`, run:

```bash
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter next-shadcn-dashboard-starter build
cd apps/app-new && pnpm format:check
cd ../.. && git diff --check && git status --short
```

A skipped or blocked command is not a pass. Record focused DOC/MODEL/TABLE/HOME results, every full-command result, blockers, residual risks, final changed-line totals, and landed SHA sequence. Stop delivery on any unresolved gate, source-policy diff, failed check, or missing evidence.

- [ ] Run final focused tests for `property-document-requests.test.tsx`, `model.test.ts`, `product-table.test.tsx`, and `operational-homepage.test.tsx`, plus all listed App New test, typecheck, lint, seeded E2E, build, formatter, diff, and status checks; record exact results and blockers. <!-- sdd-owner: parent -->
- [ ] Confirm required units landed sequentially to `develop`, optional D7/T6 decisions are recorded, no PR reached 400 changed lines, and no API/database/route/product-policy change entered the `viewpro-app/` final diff. <!-- sdd-owner: parent -->
- [ ] Synchronize and archive `openspec/changes/frontend-component-responsibility-split/` according to repository policy, retaining verification evidence and residual risks. <!-- sdd-owner: parent -->
- [ ] Close or update issue #297 only after archive evidence exists, referencing unit PRs, PR #458 SHA, and #304 gate evidence. <!-- sdd-owner: parent -->
