# Apply Progress: Frontend Component Responsibility Split

## D1 — Document public-boundary baselines

**Status:** complete for assigned work unit `d1-document-public-baselines`; no production extraction or production behavior change was made.

### Structured status consumed

- Native status: `change=frontend-component-responsibility-split`, `next_recommended=apply`, `apply=ready`, `tasks=0/70` at acquisition.
- Native attempt: `proceed` for `d1-document-public-baselines`; evidence goal was public-boundary characterization with no production extraction.
- Action context: only `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-baselines` was an allowed edit root. The environment-only untracked `viewpro-app/node_modules` symlink was not edited or staged.
- Delivery path: `auto-chain`, sequential-to-develop; D1 stays below the 400 changed-line budget.

### Completed implementation-owned tasks

- [x] RED — Added black-box characterizations for query loading/error/empty, create payload/closure/success feedback/exact invalidation, owner eligibility hints, failures, preview fallback, and deep-link user collapse.
- [x] GREEN — No genuine behavioral defect was exposed, so no correction unit or production change was made.
- [x] TRIANGULATE — Verified exact create/approve/reject list-key invalidation and successful read non-invalidation with all D1 public cases passing.
- [x] REFACTOR — Kept tests at the `PropertyDocumentRequests` boundary and formatted the changed test file.

The corresponding four D1 implementation-owned checkboxes in `tasks.md` are visibly marked `- [x]`.

### Parent lifecycle prerequisites recorded

- P0a proposal/exploration landed through PR #461 at `dcc98e090113c4c6fa58291fa47297588e0d025a`.
- P0b specification landed through PR #463 at `4901432b99802b08ed543c7f3b5125e625afa99f`.
- P0c design landed through PR #464 at `ad8ac53267d3f13898fe59019caf01158398251e`.
- P0d tasks and native instance identity landed through PR #465 at `d723474ce01f91da981206ffa980c3079f438767`.
- O1 operational homepage adoption landed through PR #458 at `6f17f1663d418f0ca1cd42713fae4fe709f1ede6` after latest-base focused tests, typecheck, strict lint, formatter, and diff checks passed.
- The five corresponding parent-owned prerequisite checkboxes in `tasks.md` are now marked complete.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| RED / characterization baseline | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` before D1 tests | 25/25 tests passed; this was an existing-behavior characterization baseline, not manufactured RED. |
| Characterization additions | Added public tests only, with no production edits | An initial 4-test failure was limited to test harness/assertion authoring (`rerender` return and unsupported matcher), not a product defect; it was corrected within the test fixture. |
| GREEN | Re-ran focused command after test correction | 34/34 tests passed; no genuine RED and no production correction were required. |
| TRIANGULATE / REFACTOR | Re-ran focused command after file-scoped formatting | 34/34 tests passed; public boundary remains `PropertyDocumentRequests`. |

### Files changed

- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`
- `openspec/changes/frontend-component-responsibility-split/tasks.md`
- `openspec/changes/frontend-component-responsibility-split/apply-progress.md`

No production source, API/config/package files, `product-form.tsx`, D2 files, or `viewpro-app/node_modules` were changed.

### Verification

| Command | Result |
|---|---|
| `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` | PASS — 34/34 tests. |
| `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter typecheck` | PASS. |
| `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` | PASS. |
| `cd viewpro-app/apps/app-new && pnpm exec oxfmt --write src/features/products/components/property-document-requests.test.tsx && pnpm exec oxfmt --check src/features/products/components/property-document-requests.test.tsx` | PASS — changed test file formatted and checked. |
| `cd viewpro-app/apps/app-new && pnpm format:check` | BLOCKED by 89 pre-existing package-wide formatting violations outside D1; the changed D1 test file passes the scoped formatter check. |
| `git diff --check` | PASS. |
| `git diff --numstat` | PASS — final parent evidence counted 194 additions and 31 deletions in tracked files; untracked `apply-progress.md` adds 69 lines, for 294 total changed lines. |

The native D1 attempt settled complete against evidence revision `sha256:b1c0089263e82ad4a21779d92070f6edfec5ead3d20b9885fa0ffdac82dfe3ae`; this later parent evidence finalization only corrects the recorded budget count and prerequisite wording.

### Workload and next unit

- D1 boundary: public-boundary test characterization only; no production extraction.
- Final changed-line count: 294 additions plus deletions (263 additions, 31 deletions), below the 400-line D1 budget.
- Deviations from design: none.
- Remaining implementation tasks: all non-D1 implementation-owned work remains unchecked; the immediate successor is D2 after this D1 unit is landed through parent lifecycle.
- Parent planning and O1 prerequisite checkboxes are recorded complete; final verification and archival checkboxes remain unchanged.

## D2 — Document model/constants budget stop and replan

**Status:** blocked before delivery. This target worktree contains only the appended planning/evidence update; no D2 source or test candidate was applied, and no D2 checkbox is complete.

### Truthful failed-attempt evidence

- Read-only source evidence: `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-model/openspec/changes/frontend-component-responsibility-split/apply-progress.md`.
- Native failed attempt settled with state `proceed` for the D2 work unit.
- The complete D2 candidate was behaviorally green: `MODEL` 2/2, `DOC` 34/34, App New typecheck, strict lint, formatter checks, `git diff --check`, and the model forbidden-import audit all passed.
- Exact candidate changed lines were **468**: root `property-document-requests.tsx` had 20 additions and 208 deletions; `model.ts` had 153 additions; `model.test.ts` had 87 additions.
- The 468-line candidate exceeded the hard 400-line budget, so the candidate was fully restored. No D2 production change, incomplete test, or completed D2 checkbox remains.

### Parent replan decision

The parent decision is to split required D2 into sequential, under-budget work units: **D2a** lands the core list model (filters, eligibility, normalization, grouping/filtering, and counts), then **D2b** lands the metadata model (chronology, descriptions, labels, versions, MIME, and dates) on the landed D2a base. D3 remains blocked until D2b lands. D1 history above is preserved unchanged.

## D2a — Document core list model

**Status:** complete for `d2a-document-core-list-model`; all four D2a implementation checkboxes are visibly checked.

### Structured status and scope

- Consumed native authority: `frontend-component-responsibility-split` was apply-ready with 9/74 complete; the parent-held D2a attempt was `proceed` under `auto-chain` sequential-to-develop.
- Action context reconstructed as `repo-local` at `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-core-model`; edits stayed within the parent-supplied five file surfaces. The untracked `viewpro-app/node_modules` symlink was not edited.
- PR boundary: D2a core list model only; rollback is the root wiring, `model.ts`, and `model.test.ts` as one unit. D2b remains the next implementation unit.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| Safety net | `DOC` before D2a | PASS — 34/34 characterization tests. |
| RED | New pure-model test imported missing `./model` | Expected structural RED: Vite could not resolve the missing module; no behavioral RED was manufactured. |
| GREEN | Implemented the pure core model and wired the root | `MODEL` PASS — 4/4; `DOC` PASS — 34/34. |
| TRIANGULATE / REFACTOR | Tested valid/unknown filters, owner states, non-empty grouping/order/counts, and filter copy/order; formatted and reran focused suites | PASS — `MODEL` 4/4 and `DOC` 34/34. |

### Files and verification

- Changed: `property-document-requests.tsx`, `property-document-requests/model.ts`, `property-document-requests/model.test.ts`, `tasks.md`, and this cumulative progress file.
- `MODEL`: PASS — 4/4; `DOC`: PASS — 34/34; App New typecheck: PASS; strict lint: PASS.
- Scoped `oxfmt --write` then `--check` for all three changed source/test files: PASS. `git diff --check`: PASS. Model forbidden-import audit: PASS (only feature API type import).
- Package `pnpm format:check`: D1 recorded the known 89-file package-wide blocker; this run reported 88 remaining files, all outside D2a. The D2a scoped formatter check is green.
- Exact tracked and untracked D2a changed-line count: **333** additions plus deletions, below 400.

### Boundary and remaining work

- `model.ts` contains only filter options/types, owner eligibility, active-filter normalization, grouping/filtering, and counts. Root retains chronology, descriptions, labels, versions, MIME/date formatting, icons/status presentation, UI, queries, URL state, and mutations.
- No design deviation, product behavior change, API/config/package change, commit, push, or D2b work occurred.
- Remaining work begins with the four unchecked D2b lines; parent-owned lifecycle actions remain deferred unchanged.

## D2b — Document metadata model

**Status:** complete for `d2b-document-metadata-model`; the four D2b implementation checkboxes are visibly checked.

### Structured status and boundary

- Consumed native authority: apply-ready, parent D2b attempt `proceed`, `auto-chain` stacked-to-main, 13/74 complete at acquisition.
- Action context: repo-local; edits stayed within the five supplied surfaces. The untracked `viewpro-app/node_modules` symlink was not touched.
- PR boundary: metadata helpers, diagnostic pure tests, and root wiring only; D3, UI/query/URL/services/permissions/presentation configuration, API/config/package changes, commit, and push remain out of scope.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| Safety net | Pre-change `MODEL` and `DOC` | PASS — 4/4 and 34/34 characterization tests. |
| RED | Metadata model exports were absent | Expected structural RED — 2 new pure tests failed because helpers were not exported; no behavioral RED was manufactured. |
| GREEN / TRIANGULATE | Exported existing metadata behavior and tested chronology/description and labels/version/MIME/date edges | PASS — `MODEL` 6/6. |
| REFACTOR | Removed only root metadata duplicates, formatted, and reran focused suites | PASS — `MODEL` 6/6; `DOC` 34/34. |

### Files and verification

- Changed: `property-document-requests.tsx`, `property-document-requests/model.ts`, `property-document-requests/model.test.ts`, `tasks.md`, and this file.
- `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts` PASS — 6/6; `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` PASS — 34/34; typecheck PASS; strict lint PASS; scoped `oxfmt --write`/`--check` PASS; model import audit PASS (only `date-fns`, `date-fns/locale`, and feature API types); `git diff --check` PASS.
- Package `pnpm format:check` remains blocked by the known 88 unrelated package-wide files; the three D2b files pass their scoped formatter check.
- D2b is independently rollbackable by reverting its root wiring, model metadata helpers, and diagnostic model tests together; no design deviation or behavior change was found.

### Workload and remaining work

- Exact artifact-inclusive `git diff --numstat` count: **379** additions plus deletions (260 additions, 119 deletions), below the 400-line hard maximum.
- Remaining implementation begins with: `- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for loading/error/empty, owner hints, filter counts, and transitions before moving presentation. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions: all parent-owned final verification, landing, synchronization, archive, and issue-update rows remain byte-for-byte unchanged. D3 may start only after this independently runnable D2b unit lands.

## D3 — Document states, hints, filters

**Status:** complete for `d3-document-states-hints-filters`; all four D3 implementation-owned checkboxes are visibly checked.

### Structured status and boundary

- Consumed parent native authority: apply-ready, D3 attempt `proceed`, `auto-chain` sequential-to-develop, and 17/74 complete at acquisition.
- Action context: `repo-local` in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-states-filters`; edits were limited to the supplied root, new presentation module, and OpenSpec artifacts. The existing untracked `viewpro-app/node_modules` symlink was not touched.
- PR boundary: D3 state/hint/filter presentation only; D4a list/section extraction, services, queries, URL ownership, mutations, API/config/package changes, commits, pushes, and PR actions remain out of scope.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| D3 states/hints/filters | `property-document-requests.test.tsx` | Public component | `DOC` 34/34; `MODEL` 6/6 | Passing characterization; no behavioral RED was manufactured for this preserving extraction. | A first post-extraction `DOC` run exposed a missing retained `Badge` root import; restoring it returned `DOC` to 34/34. | Existing public cases cover loading/error/empty, three owner-hint cases, filter counts/order/transitions, archive, and permissions. | Scoped formatting passed and final `DOC`/`MODEL` remained green. |

### Verification and ownership

- `DOC`: PASS — 34/34; `MODEL`: PASS — 6/6; App New typecheck: PASS; strict lint: PASS.
- Scoped `oxfmt --write` and `--check` for the root and `states-and-filters.tsx`: PASS. `pnpm format:check` remains BLOCKED by the unchanged known 88 unrelated package formatting violations; both D3 source files pass scoped formatting.
- `git diff --no-ext-diff --check`: PASS. The repository has `diff.external=/bin/false`, so `--no-ext-diff` was required for the native diff check.
- Forbidden-import and ownership audits: PASS. The new module imports only UI primitives, `cn`, and direct model filter data/types; it has no query, URL, tenant/product, owner collection, service, mutation, or root import.
- Source changed-line count: **314** additions plus deletions (10 additions, 143 deletions, 161 new-module additions); artifact-inclusive total: **355**. The near-350 reassessment confirmed this remains below the 400 hard maximum. No design deviation or user-visible behavior drift was found.

### Files and persisted tasks

- Changed: `property-document-requests.tsx`, new `property-document-requests/states-and-filters.tsx`, `tasks.md`, and this cumulative progress file.
- The D3 RED, GREEN, TRIANGULATE, and REFACTOR rows are visibly `- [x]` in `tasks.md`.
- Remaining implementation starts with `- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for grouping, resolved disclosure, highlight anchor, and permissions before moving the shell. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions remain parent-owned and byte-for-byte unchanged; next implementation boundary is D4a after parent lifecycle lands D3.

### Independent-review follow-up

- Added public assertions for exact tab order, Todos URL reset/selection, the exact archive hint, and permission-gated hint suppression; formatted `DOC` remains PASS at 34/34.
- Revised exact artifact-inclusive changed-line total: **380** additions plus deletions, below 400.

## D4a — Document request section/list shell

**Status:** blocked before delivery for `d4a-document-request-list-shell`; D4a source edits were fully restored and all four D4a implementation checkboxes remain unchecked.

### Structured status and action context

- Consumed native authority: `frontend-component-responsibility-split` was apply-ready with 21/74 complete; the parent-held D4a attempt was `proceed` under `auto-chain` stacked-to-main from `06420a90`.
- Action context: the parent supplied the D4a worktree and four allowed edit surfaces. The attempted source edits stayed inside the two source surfaces; the environment-only untracked `viewpro-app/node_modules` symlink was not edited.
- PR boundary was D4a only: controlled section/list shell, with root-owned item/status/rejection/review/read/version detail; D4b and D5 were not started.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net / RED | GREEN / TRIANGULATE / REFACTOR |
|---|---|---|---|---|
| D4a section/list shell | `property-document-requests.test.tsx` and `model.test.ts` | Public component + pure model | Passing characterization baseline, not a manufactured behavioral RED: `DOC` 34/34 and `MODEL` 6/6. | Not reached: the first minimal shell candidate reached 470 source additions plus deletions, so it was restored before GREEN to honor the 400-line hard maximum. |

### Budget stop and verification

- The attempted root-to-shell seam moved `DocumentRequestSection`, controlled `Collapsible`, list composition, and the `<li data-request-id>` highlight wrapper while leaving card/item detail in the root render callback.
- The candidate measured **470 source additions plus deletions** before artifacts: root 107 additions and 250 deletions, plus the new shell module. This exceeded the hard 400-line limit, so no source candidate remains.
- `DOC` passed 34/34 and `MODEL` passed 6/6 before edits. No post-extraction typecheck, strict lint, package formatter, or full import audit was run because the candidate was restored at the mandatory budget stop.
- No design or product decision was required, but the current D4a allocation cannot satisfy both the requested DOM-anchor extraction and the 400-line budget without a parent-approved scope split.

### Remaining tasks and deferred lifecycle actions

- `- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for grouping, resolved disclosure, highlight anchor, and permissions before moving the shell. <!-- sdd-owner: implementation -->`
- `- [ ] GREEN: Extract the controlled section/list shell in `request-list.tsx` with unchanged commands and DOM anchors. <!-- sdd-owner: implementation -->`
- `- [ ] TRIANGULATE: Verify `request-list.tsx` resolved-history state, highlighting, action availability, and root-only orchestration with `DOC`, `TYPE`, `LINT`, formatter, diff check, and import audit. <!-- sdd-owner: implementation -->`
- `- [ ] REFACTOR: Keep item/status/version detail for D4b/D5 if needed, remove only `request-list.tsx` shell duplicates, and land below budget. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions remain parent-owned and unchanged. The required parent decision is a smaller D4a scope that fits the 400-line cap, or explicit maintainer `size:exception`; D4b must remain blocked.

### Parent replan decision

The parent authorized a sequential split with no size exception: **D4a1** moves only `DocumentRequestSection`, its group heading, and the controlled resolved `Collapsible`/disclosure shell, while root `property-document-requests.tsx` keeps `DocumentRequestList`, item mapping, `<li data-request-id>`, highlight wrapper/class, and all item/status/rejection/actions/version/preview detail. Root-owned resolved-open and change values remain authoritative; explicit children or render-list input may cross the seam.

After D4a1 lands, **D4a2** moves `DocumentRequestList`, item mapping, the `<li data-request-id>` anchor, and highlight wrapper/class into `request-list.tsx`. It keeps all item detail in the root through a narrow explicit `renderItem` seam and forbids root, service, query/URL, mutation, and independent-state ownership in the list module. D4b is blocked until landed D4a2.

The split is derived from the failed **470 source additions plus deletions** D4a candidate: D4a1 forecasts approximately 190–260 changed lines and D4a2 approximately 230–320, each below the hard 400-line limit. The candidate was already fully restored, no D4a work is complete, and no new source or test code was changed. Native status after replanning is **21/78 complete**; prior D4a evidence and all earlier history remain preserved.

## D4a1 — Document controlled request section/disclosure shell

**Status:** complete for `d4a1-document-disclosure-shell`; all four D4a1 implementation-owned rows are persisted as checked.

### Structured status and action context

- Consumed parent native authority: `apply=ready`, `21/78 complete`, attempt `proceed`, work unit `d4a1-document-disclosure-shell`, delivery path `auto-chain` / sequential stack, and hard 400-line limit.
- Produced OpenSpec status: `schemaName=spec-driven`, `changeName=frontend-component-responsibility-split`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=apply`; proposal, design, tasks, and cumulative apply-progress were present. The canonical spec artifact was not found at the configured `openspec/specs` path, but the parent-provided native authority explicitly confirmed apply readiness and the landed proposal/design/tasks governed this structural slice.
- `actionContext.mode=repo-local`; the authoritative workspace was `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-disclosure-shell`. Edits stayed inside the four parent-approved source/artifact surfaces. The pre-existing untracked `viewpro-app/node_modules` symlink was not edited.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| RED / characterization | Pre-change `DOC` and `MODEL` | PASS — 34/34 and 6/6; this behavior-preserving extraction did not manufacture a behavioral RED. |
| GREEN | Added controlled `DocumentRequestSection` shell and passed root-owned list markup as `children` | Public `DOC` PASS — 34/34; `MODEL` PASS — 6/6. |
| TRIANGULATE | Typecheck, strict lint, scoped formatter, diff check, and ownership audit | PASS; the new module has no root, React Query, nuqs, query-key, tenant/product context, service, or mutation import. |
| REFACTOR | Removed only the root section/disclosure duplicate and reran focused suites | PASS — 34/34 and 6/6. |

### Completed scope and persisted tasks

- [x] RED — Recorded the 34/34 public and 6/6 model characterization baselines.
- [x] GREEN — Created `property-document-requests/request-list.tsx` with only the group-heading and controlled resolved-disclosure shell; the root provides explicit list `children`.
- [x] TRIANGULATE — Verified direct inward imports and an under-budget source diff.
- [x] REFACTOR — Removed only the moved shell from the root; `DocumentRequestList`, mapping, list anchors/highlight wrapper, and all item/status/rejection/action/version/preview detail remain in the root.

The four D4a1 task rows in `tasks.md` are visibly `- [x]`. D4a2, D4b, D5, and parent-owned lifecycle rows were not modified.

### Files changed

- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
- `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`
- `openspec/changes/frontend-component-responsibility-split/tasks.md`
- `openspec/changes/frontend-component-responsibility-split/apply-progress.md`

### Verification

| Command | Result |
|---|---|
| `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` | PASS — 34/34 before and after extraction. |
| `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts` | PASS — 6/6 before and after extraction. |
| `pnpm --filter next-shadcn-dashboard-starter typecheck` | PASS. |
| `pnpm --filter next-shadcn-dashboard-starter lint:strict` | PASS. |
| `pnpm exec oxfmt --write` and `--check` for root plus `request-list.tsx` | PASS. |
| `pnpm format:check` | BLOCKED by the established 88 unrelated package-wide formatting violations; both D4a1 files pass scoped formatting. |
| `git diff --no-ext-diff --check` | PASS. |
| Forbidden-import ownership audit | PASS. |

### Workload, deviations, and remaining work

- Source diff: root **16 additions + 99 deletions**, new module **55 additions**, for **170 additions plus deletions**; the artifact-inclusive D4a1 worktree diff is **246 additions plus deletions**. Both are below the reassessment threshold and the 400-line cap.
- PR boundary: independently rollbackable D4a1 controlled disclosure shell only; no commit, push, PR, tests edits, API/config/package change, or node_modules edit occurred.
- Deviations from design: none. Root remains the public/query/URL/mutation/deep-link/list/item owner and retains `resolvedOpen` plus `setResolvedOpen`; the child owns no independent state.
- Immediate unchecked successor rows are:
  - `- [ ] RED: From `viewpro-app/`, run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx` and `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests/model.test.ts`; record the landed D4a1 characterization for list grouping, resolved disclosure, highlight anchors, permissions, item output, and the 6/6 model suite; do not manufacture a behavioral RED. <!-- sdd-owner: implementation -->`
  - `- [ ] GREEN: In `request-list.tsx` and `property-document-requests.tsx`, move only list composition/mapping and the `<li data-request-id>` highlight wrapper, passing root-owned item detail through an explicit `renderItem` seam. <!-- sdd-owner: implementation -->`
  - `- [ ] TRIANGULATE: Run `DOC`, `TYPE`, `LINT`, `cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx`, `cd apps/app-new && pnpm format:check`, and `git diff --check && git diff --numstat`; audit no root/query/URL/service/mutation imports and verify the D4a2 count is below 400. <!-- sdd-owner: implementation -->`
  - `- [ ] REFACTOR: Remove only the moved list/mapping/anchor duplicate, rerun focused checks, record the measured under-budget diff and rollback boundary, and publish D4a2 before D4b. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions: all parent-owned landing, final verification, sync, archive, and issue-update rows remain byte-for-byte unchanged. Parent settlement must remediate failed evidence `sha256:f03cb6364541ab28e647d8300f816ae3b758a48ccd040404fe2da806c2336474`.

## D4a2 — Document request list/anchor shell

**Status:** complete for `d4a2-document-list-anchor-shell`; the four D4a2 implementation rows are persisted as checked.

### Structured status and boundary

- Consumed authoritative parent status: `schemaName=spec-driven`, `artifactStore=openspec`, `changeName=frontend-component-responsibility-split`, `applyState=ready`, `nextRecommended=apply`, `25/78 complete`; the D4a2 attempt was `proceed` under `auto-chain`.
- `actionContext.mode=repo-local`; authoritative workspace and allowed edit root were `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-list-anchor-shell`. Only the two source files and OpenSpec artifacts changed; the existing untracked `viewpro-app/node_modules` symlink was untouched.
- PR boundary: list composition, mapping, `<li data-request-id>`, and highlight class only. The root retains item/status/rejection/action/version/preview detail, queries, URL state, mutations, permissions, callbacks, and deep-link state.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| RED / characterization | Pre-change `DOC` and `MODEL` | PASS — 34/34 and 6/6; behavior-preserving extraction, no artificial RED. |
| GREEN | Added prop-driven `DocumentRequestList` with root `renderItem` | `DOC` PASS — 34/34; `MODEL` PASS — 6/6. |
| TRIANGULATE / REFACTOR | Scoped formatting, typecheck, lint, ownership/anchor audit, and diff count | PASS; package-wide formatting remains an unrelated baseline. |

### Completed tasks, files, and verification

- [x] RED, GREEN, TRIANGULATE, and REFACTOR D4a2 rows are visibly checked in `tasks.md`.
- Changed: `property-document-requests.tsx`, `property-document-requests/request-list.tsx`, `tasks.md`, and this cumulative progress file; no test, API, config, package, or node_modules change.
- `DOC`: PASS — 34/34 before and after; `MODEL`: PASS — 6/6 before and after; strict lint: PASS; scoped `oxfmt --write` then `--check`: PASS; `git diff --no-ext-diff --check`: PASS; ownership/anchor audit: PASS.
- App New typecheck initially failed because the temporary cross-worktree `node_modules` symlink resolved a stale `@viewpro/contracts` build without the landed `PRIMARY_AGENT_*` codes. The parent replaced that environment-only symlink with a local frozen install, built `@viewpro/contracts`, and reran typecheck: PASS. Package `pnpm format:check` is BLOCKED by 92 unrelated package-wide files; both D4a2 source files pass scoped formatting.
- Source diff is **306** additions plus deletions (108 additions/160 deletions root; 38 additions list); exact artifact-inclusive worktree total is **345** (181 additions, 164 deletions), below 350 reassessment and 400 maximum. D4a2 is rollbackable by reverting the root/list wiring together; no design deviation occurred.

### Remaining work and delivery

- Next unchecked D4b rows: `- [ ] RED: Re-run `DOC` in `property-document-requests.test.tsx` for submitted/pending/resolved actions, status/rejection copy, pending flags, and permissions. <!-- sdd-owner: implementation -->`; `- [ ] GREEN: Extract request item/status/review/read presentation into `request-list.tsx` while preserving markup, feedback, commands, and preview boundary. <!-- sdd-owner: implementation -->`; `- [ ] TRIANGULATE: Audit `request-list.tsx` for no child mutation/service ownership and run `DOC`, `MODEL`, `TYPE`, `LINT`, formatter, diff check, import audit, and numstat. <!-- sdd-owner: implementation -->`; `- [ ] REFACTOR: Remove only duplicated item definitions and land the focused under-budget `request-list.tsx` unit. <!-- sdd-owner: implementation -->`
- D4b remains untouched. Parent-owned landing, verification, sync, archive, and issue-update rows remain deferred unchanged; next recommended action is `parent-lifecycle`.

## D4b budget replan

- D4a2 merged as PR #480 at `c668d109`.
- Read-only forecast: D4b1 is approximately 225–280 artifact-inclusive changed lines; D4b2 is approximately 310–345 artifact-inclusive changed lines. D4b2 must be reassessed immediately at 350 and both units hard-stop at 400 or more.
- No D4b source/test work or runtime attempt started; this entry records planning only and does not claim any D4b command was run.
- D4b1 is next, starting from a fresh `origin/develop` after landed D4a2; D4b2 starts only after D4b1 lands.
- D5 remains untouched.

## D4b1 — Document status/rejection primitives

**Status:** complete for the assigned D4b1 work unit; the four D4b1 implementation rows are persisted as checked.

### Structured status and action context

- Consumed parent runtime authority: `proceed` for D4b1; delivery path is `auto-chain` / stacked-to-main.
- Produced status: `schemaName=spec-driven`, `changeName=frontend-component-responsibility-split`, `artifactStore=openspec`, proposal/spec/design/tasks/apply-progress present, `applyState=ready`, `taskProgress=28/72`, `deferredParentActions=5/10`, and `nextRecommended=apply`.
- `actionContext.mode=repo-local`; edits stayed within the five supplied source/OpenSpec surfaces under `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-status-primitives`. No authority token, dependency, config, generated output, D4b2/D5/D6 source, or ignored artifact was changed.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| RED / characterization | Landed D4a2 `DOC` and `MODEL` before additions | PASS — 34/34 and 6/6; accepted passing characterization, with no manufactured RED. |
| Characterization additions | Public rejection heading/reason and pending-approval decision-disable assertions | PASS — `DOC` 36/36 before extraction. |
| GREEN / TRIANGULATE | Moved only status/rejection primitives and reran focused suites | PASS — `DOC` 36/36 and `MODEL` 6/6. |
| REFACTOR | Scoped formatting, typecheck, strict lint, and ownership audit | PASS; root item remains intact and authoritative. |

### Completed tasks and boundary

- [x] RED — Added only black-box rejection heading/reason and pending-review-action disabled-state coverage.
- [x] GREEN — Moved only `DocumentStatusConfig`, `documentStatusConfig`, `DocumentStatusBadge`, and `RejectionReason` to `request-list.tsx`; the root imports the two exported presentation components.
- [x] TRIANGULATE — Verified focused suites, App New typecheck, strict lint, scoped formatter, package formatter baseline, diff, numstat, and ownership boundary.
- [x] REFACTOR — Removed only the duplicated root primitives; rollback is the root/list/test wiring as one D4b1 unit.

The matching D4b1 checkboxes in `tasks.md` are visibly `- [x]`; D4b2 remains 0/4 and later task states are unchanged.

### Verification and ownership

| Command | Result |
|---|---|
| `DOC` before test additions | PASS — 34/34. |
| `MODEL` before test additions | PASS — 6/6. |
| `DOC` after characterization and after extraction/formatting | PASS — 36/36. |
| `MODEL` after extraction/formatting | PASS — 6/6. |
| `pnpm --filter next-shadcn-dashboard-starter typecheck` | PASS. |
| `pnpm --filter next-shadcn-dashboard-starter lint:strict` | PASS. |
| Scoped `oxfmt --write` then `--check` for root, list, and test | PASS. |
| `pnpm format:check` | BASELINE BLOCKED — the known 92 unrelated package files fail; all three D4b1 files pass scoped formatting. |
| `git diff --no-ext-diff --check` | PASS. |
| Import/ownership audit | PASS — `request-list.tsx` imports only UI, `cn`, React type, feature API types, and model type; no root/service/query/URL/mutation/context/independent-state import. |

### Files, workload, and remaining work

- Changed: `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`, `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/request-list.tsx`, `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`, `tasks.md`, and this cumulative progress file.
- Exact artifact-inclusive `git diff --numstat` total: **245** additions plus deletions; below the 350 reassessment threshold and 400 hard stop.
- Deviations: none. The root retains item markup, mutations/services/React Query/URL state/feedback/rejection controlled state/dialog/version/preview/deep-link/list anchors/highlight/disclosure ownership.
- Immediate remaining D4b2 lines are unchanged:
  - `- [ ] RED: From \`viewpro-app/\`, run \`DOC\` and \`MODEL\` against the landed D4b1 baseline and record submitted, pending, resolved, status, permission, review/read, feedback, and item-output characterization; preserve passing behavior as the baseline and do not manufacture a failing RED. <!-- sdd-owner: implementation -->`
  - `- [ ] GREEN: Move \`DocumentRequestItem\` into \`request-list.tsx\` behind the D4a2 \`renderItem\` seam; pass explicit request, permission, pending flags, callbacks, and root-built \`versionSummary: ReactNode\`, preserving exact markup, button order, copy, feedback commands, review/read behavior, and preview boundary while rejection state/dialog ownership remains in the root. <!-- sdd-owner: implementation -->`
  - `- [ ] TRIANGULATE: Run \`DOC\`, \`MODEL\`, \`TYPE\`, \`LINT\`, and \`cd apps/app-new && pnpm exec oxfmt --check src/features/products/components/property-document-requests.tsx src/features/products/components/property-document-requests/request-list.tsx src/features/products/components/property-document-requests.test.tsx\`; run \`cd apps/app-new && pnpm format:check\` and classify any package-wide failure against the known unrelated formatting baseline; run \`git diff --check && git diff --numstat\`, record exact additions plus deletions and reassess at 350, and audit child imports/state plus root ownership of mutations, feedback, rejection dialog, version summary, preview, URL/deep-link lifecycle, anchors/highlight, and disclosure. <!-- sdd-owner: implementation -->`
  - `- [ ] REFACTOR: Remove only the duplicated root \`DocumentRequestItem\` definition and rerun \`DOC\`, \`MODEL\`, \`TYPE\`, \`LINT\`, scoped formatting, package-format baseline classification, diff check, import/ownership audit, and exact numstat; record the 310–345 artifact-inclusive result, rollback boundary, and pre-D5 landing. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions: all ten parent-owned rows remain byte-for-byte unchanged; no commit, push, PR, receipt, review, or lifecycle gate was performed.

## D4b2 — Document request item/read/review shell

**Status:** complete for the assigned D4b2 work unit; the four D4b2 implementation-owned rows are persisted as checked.

### Structured status and boundary

- Consumed parent runtime authority: `proceed` for D4b2 under `auto-chain` / stacked-to-main. Authoritative OpenSpec artifacts (proposal, specs, design, tasks, and cumulative progress) were present; reconstructed status is `applyState=ready`, `nextRecommended=apply`, `actionContext.mode=repo-local`, with edits confined to the four supplied source/artifact paths in `/Users/emimontanari/Work/Apps/Viewpro-worktrees/frontend-component-document-item-shell`.
- Expected native aggregate task status after the persisted updates: **37/82**; implementation-owned progress is 32/72, with 5/10 parent-owned rows already complete. No ownership marker was malformed, and all parent rows were preserved byte-for-byte.
- PR boundary: only the `DocumentRequestItem` presentation shell and root seam wiring. Rollback is the two source files plus D4b2 artifact evidence as one unit; D5/D6/D7 source and tests remain untouched.

### TDD Cycle Evidence

| Step | Evidence | Result |
|---|---|---|
| RED / characterization | Pre-edit `DOC` and `MODEL` | PASS — 36/36 and 6/6; preserving extraction, so no artificial failing test was added. |
| GREEN | Moved only the item shell and passed root-built `versionSummary` | `DOC` PASS — 36/36; `MODEL` PASS — 6/6. |
| TRIANGULATE / REFACTOR | Typecheck, strict lint, scoped formatting, diff, and ownership audit | PASS; no behavior, test, API, config, or package change. |

### Verification and ownership

- `DOC`: PASS — 36/36 before and after. `MODEL`: PASS — 6/6 before and after. App New typecheck and strict lint: PASS. Scoped `oxfmt --write` then `--check` for the two source files: PASS. `git diff --no-ext-diff --check`: PASS.
- `pnpm format:check`: BASELINE BLOCKED — 94 package-wide violations, all outside the two D4b2 source files; scoped formatting is green. This is an environment/repository baseline classification, not a D4b2 failure.
- `request-list.tsx` imports only UI primitives, `cn`, React type, feature API types, and model helpers/types; it has no root, service, query, URL, mutation, context, or independent-state import. Root retains mutations, feedback, safe read, rejection state/dialog, version summary, preview/query/media/file-icon, URL/deep-link lifecycle, list anchors/highlight, and disclosure ownership.

### Files, workload, and remaining work

- Changed: `property-document-requests.tsx`, `property-document-requests/request-list.tsx`, `tasks.md`, and this cumulative progress file. No tests were added because the landed 36/36 public characterization already covers the preserved contract.
- The four D4b2 rows are visibly `- [x]`; source diff is 12 additions + 136 deletions in the root and 130 additions in `request-list.tsx`. Final artifact-inclusive numstat is **316** additions plus deletions (176 additions, 140 deletions), below the 350 reassessment threshold and 400 hard stop.
- Remaining immediate implementation rows are `- [ ] RED: Re-run \`DOC\` in \`property-document-requests.test.tsx\` for preview fallback, version metadata, safe read, exact write invalidation, and read/no-list-invalidation behavior. <!-- sdd-owner: implementation -->` and `- [ ] GREEN: Extract \`document-version.tsx\` while preserving sole preview query ownership, settings, file icon, read command, and failure recovery. <!-- sdd-owner: implementation -->`; D5/D6/D7 and all parent lifecycle actions remain unchanged.

## D5 — Document version and preview

**Status:** complete for D5; its four implementation-owned task rows are persisted as checked (aggregate **41/82**; implementation **36/72**, parent **5/10**).

- **Status/context:** parent runtime authority was `proceed`; authoritative file-backed OpenSpec artifacts were present. `actionContext.mode=repo-local`; edits stayed in the four allowed D5 paths. Delivery was `auto-chain`, D5 only; D6/D7 and parent rows remain untouched.
- **TDD evidence:** characterization baseline `DOC` **36/36** and `MODEL` **6/6** passed before extraction (no manufactured RED). The first GREEN run caught a missing retained root `useQuery` import; it was restored, then final `DOC` **36/36**, `MODEL` **6/6**, typecheck, strict lint, and scoped `oxfmt --write/--check` passed.
- **Implementation/audit:** new direct-import `property-document-requests/document-version.tsx` owns `DocumentVersionSummary`, preview media, and file icon. It contains the single key `[...productKeys.all, 'document-version-preview', version.id]`, `createProductDocumentReadUrl`, `retry: false`, and `staleTime: 60_000`; the root has no preview query/media/icon helper. Missing/error URLs retain the icon fallback without disabling request actions.
- **Root contract:** list query, mutations/dialogs/feedback, safe `window.open(url, '_blank', 'noopener,noreferrer')`, deep-link/URL state, and item seam remain root-owned. Create/approve/reject retain exactly three `documentRequestsQueryKey` invalidations, while read has none.
- **Verification:** scoped formatter PASS; `git diff --no-ext-diff --check` PASS. Package `pnpm format:check` is BASELINE BLOCKED by 94 unrelated files (the two D5 files pass scoped formatting). Source numstat is root **1 add / 89 delete** plus untracked module **94 add** = **184** changed lines; final artifact-inclusive aggregate is **204**, below 350 reassessment and the 400 hard cap. Untracked module: `viewpro-app/apps/app-new/src/features/products/components/property-document-requests/document-version.tsx`.
- **Files:** `property-document-requests.tsx`, new `property-document-requests/document-version.tsx`, `tasks.md`, and this cumulative progress file. No tests were added because existing public cases cover preview success/fallback, version metadata, safe read, exact write invalidation, and read/no-list-invalidation.
- **Remaining implementation:** `- [ ] RED: Re-run \`DOC\` in \`property-document-requests.test.tsx\` for deep-link reset/open/scroll/highlight, loading-to-success timing, supersession/unmount cleanup, and user-collapse cases. <!-- sdd-owner: implementation -->`; D6 is next. Deferred parent lifecycle rows are unchanged.
