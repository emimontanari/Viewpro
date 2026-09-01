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
- Remaining implementation begins with: `- [ ] RED: Re-run \`DOC\` in \`property-document-requests.test.tsx\` for loading/error/empty, owner hints, filter counts, and transitions before moving presentation. <!-- sdd-owner: implementation -->`
- Deferred lifecycle actions: all parent-owned final verification, landing, synchronization, archive, and issue-update rows remain byte-for-byte unchanged. D3 may start only after this independently runnable D2b unit lands.
