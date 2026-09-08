# Tasks: Seller Home Reference Fidelity

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,750–2,330 total; I1A 350–400, I1B 330–390, I1C 150–250, I2 300–390, I3A 190–280, I3B 250–340, I4 180–280 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | P1 → P2 → P3 → P4 → P5 → I1A → I1B → I1C → I2 → I3A → I3B → I4 |
| Delivery strategy | ask-on-risk resolved: human accepted the I3 split; no size exception |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Delivery contract

- Each successor starts from freshly synchronized `develop` only after its predecessor merges, targets `develop`, and contains one independently green, reversible work unit; never base on an unmerged branch.
- Every PR is limited to 400 additions + deletions, includes its tests/docs and actual accounting, and stops on a cohesive measured overage; no code-golf, deferral of required proof, or `size:exception` is allowed.
- Work only in `viewpro-app/` with pnpm. This is frontend-only: do not edit BFF/API/backend/schema/seed/auth/tenant-selection/navigation-policy/shell/manager/owner/#306/#327 surfaces except named regression tests.
- API verification is regression-only and may use only repository Docker PostgreSQL with a visibly disposable local `DATABASE_URL` (for example `localhost`/Docker `viewpro_test`); never Neon, production, or any external database. Receipt review is disabled/unmanaged.

## Planning chain and allowlists

| PR | Allowlist and expected symbol/evidence | Budget and completion boundary |
|---|---|---|
| P1 | `assets/seller-home-reference.jpeg` (SHA-256 `68be…d10c`), `exploration.md` (`Result`, data/state/reference evidence), `preproposal.md` (confirmed `greeting:personalized`, `priority:short-list`) | Asset + discovery/decision evidence only; hash/diff check and ≤400 changed lines. |
| P2 | `proposal.md` (`Decision`, scope, data truthfulness, protected boundaries) | Proposal only; ≤400 changed lines. |
| P3 | `specs/crm-seller-home/spec.md` (R1–R9, 34 scenarios) | Delta specification only; ≤400 changed lines. |
| P4 | `design.md` (`SellerOperationalHomepage`, adapters, `SellerHomeView`, browser strategy) | Design only; ≤400 changed lines. |
| P5 | `tasks.md` (this file: forecast, chain, TDD/evidence/matrix/traceability) | Tasks only; ≤400 changed lines and no implementation claimed complete. |

- [ ] Deliver P1 from fresh `develop`, verify the reference hash, `git diff --check`, stat/status, and ≤400 accounting, then merge before P2. <!-- sdd-owner: parent -->
- [ ] Deliver P2 from fresh `develop` after P1, verify proposal-only scope, diff/status, and ≤400 accounting, then merge before P3. <!-- sdd-owner: parent -->
- [ ] Deliver P3 from fresh `develop` after P2, verify all nine requirements/34 scenarios, diff/status, and ≤400 accounting, then merge before P4. <!-- sdd-owner: parent -->
- [ ] Deliver P4 from fresh `develop` after P3, verify design-only scope, diff/status, and ≤400 accounting, then merge before P5. <!-- sdd-owner: parent -->
- [ ] Deliver P5 from fresh `develop` after P4, verify this tasks-only diff is ≤400 lines and all implementation rows remain unchecked, then merge before I1. <!-- sdd-owner: parent -->

## Shared evidence, safety, and verification

For every implementation phase append one `apply-progress.md` record with: `slice`, `phase` (RED/GREEN/TRIANGULATE/REFACTOR), UTC timestamp, fresh-develop branch, tree/commit SHA, allowed paths, exact command, exit code, decisive output, additions, deletions, total, and pass/skip/blocker reason. RED must fail the named new assertion (not setup); GREEN reruns it; TRIANGULATE proves the stated contrast; REFACTOR has no behavior change and reruns focused proof.

| Family | Command / required evidence |
|---|---|
| C | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/seller-home.test.tsx src/features/dashboard/components/operational-homepage/seller-sections.test.tsx` |
| BFF | `pnpm --filter next-shadcn-dashboard-starter test src/app/api/activity/feed/route.test.ts src/lib/bff-api.test.ts src/features/products/api/queries.test.ts src/features/products/api/service.test.ts` |
| Protected | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx src/features/owner/components/owner-home.test.tsx` |
| Frontend | `pnpm --filter next-shadcn-dashboard-starter test` · `pnpm --filter next-shadcn-dashboard-starter typecheck` · `pnpm --filter next-shadcn-dashboard-starter lint:strict` |
| Seeded | `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep "seller home|distinct assigned seller dashboard"` · `pnpm --filter next-shadcn-dashboard-starter test:seeded` |
| API local-only | After recording disposable Docker-local `DATABASE_URL`: `pnpm --filter @viewpro/api db:validate` · `pnpm --filter @viewpro/api typecheck` · `pnpm --filter @viewpro/api test` |
| Static/artifact | `git diff --check`, `git diff --stat`, `git status --short`, `pnpm exec openspec validate seller-home-reference-fidelity --strict`, and LSP diagnostics on every changed `.ts/.tsx` file |

| Safety/regression target | Required proof |
|---|---|
| Role/query/tenant isolation | Exact `AGENT`; manager/principal preserved; missing/unknown/identity or membership-tenant mismatch mounts no query; tenant-A race never appears under B; no seller manager-summary request. |
| State truthfulness | Products and activity separately prove loading, ready/zero, error, refreshing, retained-error, local retry/retrying, partial sibling success, and no cross-source zero/empty fallback. |
| Content/navigation | Four owner-bound facts; exactly two non-checkable priorities; six-or-fewer source-order rows; real text only; malformed IDs/times fail closed; only property/detail/follow-up destinations. |
| Protected surfaces | BFF/product/activity service, manager, owner, full frontend, seeded, API-local-only, auth/public/shell/no forbidden action regressions remain green. |
| Cleanup | Remove no generated artifacts; do not commit screenshots, traces, videos, coverage, Playwright output, `.env`, database bytes/dumps, or external connection data; record `git status --short` clean intent. |

## Implementation work units

All implementation rows have `source: implementation; task: implementation; evidence: implementation`. Each unit may modify only its allowlist, must carry tests in the same PR, and rolls back by reverting that PR without touching a predecessor or protected surface.

| Unit | File allowlist and expected symbols | Start → finish / rollback | Forecast |
|---|---|---|---:|
| I1A Seller adapters/extraction | `operational-homepage.tsx` and `operational-homepage.test.tsx` (seller extraction/parity only); new `seller-home.tsx` (container/adapters); new `seller-home.test.tsx`; tasks/progress | Inline seller queries → independently validated seller adapters and unchanged composition; revert extraction/tests together. | 350–400 |
| I1B Seller gates/truthful current state | `operational-homepage.tsx`, both seller tests, tasks/progress | I1A → exact role/identity/membership gates and independent current-composition unavailable/retry/refresh rendering; revert this cutover only. | 330–390 |
| I1C Production tenant-transition proof | `operational-homepage.tsx`, `seller-home.tsx`, both seller tests, tasks/progress | I1B → real container/query-option tenant transition and same-tenant retained proof; revert proof/wiring only. | 150–250 |
| I2 Reference summary composition | `operational-homepage.tsx` (seller import/cutover only); `operational-homepage.test.tsx` (narrow integration regression); `seller-home.tsx`; new `seller-sections.tsx` (`SellerHomeView`, fact/priority/unavailable sections); `seller-home.test.tsx`; new `seller-sections.test.tsx`; `tests/seeded/demo-smoke.spec.ts` (narrow stale-selector correction only); `openspec/changes/seller-home-reference-fidelity/tasks.md`; `openspec/changes/seller-home-reference-fidelity/apply-progress.md` | State foundation → greeting/facts/priorities and beginning hierarchy; revert pure sections plus narrow cutover. | 300–390 |
| I3A Seller bounded list presenters | New `seller-lists.tsx`; direct deterministic coverage in `seller-sections.test.tsx` (create a narrower list test only if demonstrably lower-coupling and more readable); `seller-home.tsx` exports/types only if required by those tests; tasks/progress | I2 summary → independently rendered, source-order bounded seller list presenters with no home cutover or shortcuts; revert presenter/tests only. | 190–280 |
| I3B Seller composition cutover and shortcuts | `operational-homepage.tsx` (seller-owned import/JSX cleanup only); `seller-home.tsx`; `seller-sections.tsx`; `operational-homepage.test.tsx`; `seller-home.test.tsx`; `seller-sections.test.tsx`; tasks/progress | Fresh develop after I3A → composed lists, nav-derived property/follow-up shortcuts, and protected integration evidence; revert cutover/shortcuts only, retaining I3A presenters. | 250–340 |
| I4 Responsive/browser proof | `seller-sections.tsx`; `seller-lists.tsx`; `seller-sections.test.tsx`; `tests/seeded/demo-smoke.spec.ts`; `apply-progress.md` | I3B complete seller view → semantic/focus/wrapping/grid polish and one read-only seeded proof; revert proof/polish only. | 180–280 |

Remaining execution sequence: I3A from fresh `develop` after I2 → I3B from fresh `develop` after I3A → I4 from fresh `develop` after I3B; each targets `develop` and is measured independently against the 400-line budget.

### I1A — seller adapters and extraction

- [x] RED: add pure `seller-home.test.tsx` adapter assertions for loading, ready/zero, error/retrying, refreshing, retained-error, malformed counts, cross-tenant rows, and activity engagement mismatch; run focused C and expect the missing module assertion to fail. <!-- sdd-owner: implementation -->
- [x] GREEN: create seller-only query container and product/activity integrity adapters, retaining existing options and unchanged seller composition; run C and Protected. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: contrast valid product/activity data with malformed totals/counters and tenant/engagement payload mismatches; prove local retry callbacks and run C/BFF. <!-- sdd-owner: implementation -->
- [x] REFACTOR: remove unused seller-query imports/types without behavior change; run C, BFF, Protected, typecheck/lint, parent LSP, OpenSpec, diff/accounting, and stop at 400. <!-- sdd-owner: implementation -->

### I1B — seller gates and truthful current composition

- [x] RED: add operational assertions for exact `AGENT`, identity/membership-tenant no-query gates, and current-composition unavailable/retry/refresh/retained-error states that reject false zero/empty copy. <!-- sdd-owner: implementation -->
- [x] GREEN: add exact gates and independent current-composition unavailable/retry/refresh/retained-error rendering with own-query retries only; run C/Protected. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: contrast product failure/activity ready and vice versa, local retries, and each owner’s same-tenant refresh/retained state with confirmed sibling rows. <!-- sdd-owner: implementation -->
- [x] REFACTOR: preserve manager and seller visual composition while simplifying I1B-only wiring; run C, BFF, Protected, typecheck/lint, parent LSP, OpenSpec, diff/accounting, and stop at 400. <!-- sdd-owner: implementation -->

### I1C — production tenant-transition proof

- [x] PROBE/GREEN-on-arrival + corrective RED: mount real `SellerOperationalHomepage` with production `productsQueryOptions`/`activityFeedOptions`, switch membership/tenant keys before A resolves, and fail on A identity/value/row under B; then prove the public component owns the membership/tenant remount. <!-- sdd-owner: implementation -->
- [x] GREEN: resolve B-owned responses through the real container and prove same-tenant retained refresh/refetch-error separately from the A→B transition. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: vary A late/B ready and B loading/error cases while asserting production query keys and both independent query options remain intact. <!-- sdd-owner: implementation -->
- [x] REFACTOR: retain only production-container transition proof; run C/BFF/Protected/typecheck/lint/LSP/OpenSpec/diff/accounting under 400. <!-- sdd-owner: implementation -->

### I2 — reference summary composition

- [x] RED: after the initial missing-module setup failure, add a corrective `seller-sections.test.tsx` RED for fact/priority order, each-priority refresh/retained state, owner-unavailable sibling success, and forbidden summary content; expect named freshness counts to fail via C. <!-- sdd-owner: implementation -->
- [x] GREEN: add pure `SellerHomeView` summary sections with labeled loading/unavailable/refresh/retained-error states, no numeric placeholders, reference-adapted rounded density, and no visual shell redesign; run C successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: prove usable versus missing identity, product-ready/activity-error versus product-error/activity-ready, and zero-ready versus unavailable; assert no “hoy”, tasks, checkboxes, deadlines, alerts, badges, create/global movement, manager/owner/#306/#327 content, then run C and Protected. <!-- sdd-owner: implementation -->
- [x] REFACTOR: remove only superseded inline seller summary JSX and preserve one `h1`/ordered semantic regions; run C, Frontend, LSP, diff/accounting, record evidence, and stop if I2 exceeds 400. <!-- sdd-owner: implementation -->

### I3A — seller bounded list presenters

- [x] RED: add direct deterministic `seller-sections.test.tsx` coverage for the absent `seller-lists.tsx` presenters—≤6 source-order assigned/activity rows, truthful property/activity field fallbacks, movement versus document-request content, safe href and Argentina `<time>` versus malformed neutral text, and success-empty versus error/positive-total-empty copy; create a narrower direct test only when it demonstrably reduces coupling and improves readability; run C and expect the named missing-presenter/content assertion to fail. <!-- sdd-owner: implementation -->
- [x] GREEN: implement only `seller-lists.tsx` and any test-required seller export/type wiring; render bounded source-order rows, stored-prose/neutral field fallbacks, movement/document distinctions, validated detail hrefs, and safe Argentina time; retain truthful product/activity successful-empty, error, and positive-total-empty states without cutting over `SellerHomeView` or `OperationalHomepage` and without shortcuts; run direct C and BFF successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: contrast blank/whitespace/long optional fields, movement versus document request, valid versus blank/malformed/cross-tenant IDs and times, and each successful-empty/error/positive-total-empty owner state; prove no free-text inference, proposal/create/mutation/document-request/global action, shortcut, or home-composition change; run C, BFF, and Protected. <!-- sdd-owner: implementation -->
- [x] REFACTOR: retain presenter-only boundaries and direct tests; run C, Frontend, Protected, LSP, diff/accounting, and strict OpenSpec validation, record evidence, and stop if I3A exceeds 400. <!-- sdd-owner: implementation -->

### I3B — seller composition cutover and shortcuts

- [x] RED: add composition integration regressions in `seller-sections.test.tsx`, `seller-home.test.tsx`, and/or `operational-homepage.test.tsx` for rendering the I3A lists through the seller home, nav-derived property/follow-up shortcuts, exact role and membership/tenant gates, independent products/activity states, and protected manager/owner behavior; run C and Protected and expect the named cutover/shortcut assertion to fail. <!-- sdd-owner: implementation -->
- [x] GREEN: from fresh `develop` after I3A, compose `seller-lists.tsx` into the seller home, derive only the existing property/follow-up shortcuts from navigation metadata, and remove only superseded seller-owned inline imports/JSX from `operational-homepage.tsx`; preserve every independent owner state, exact `AGENT` and membership/tenant gates, manager/owner composition, and no global/create action; run C, BFF, and Protected successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: contrast product-ready/activity-error and activity-ready/product-error, refreshing/retained-error, successful-empty/positive-total-empty list states, valid/invalid row destinations, exact `AGENT` against manager/owner/unknown/mismatched-tenant cases, and nav-derived shortcuts against forbidden actions; run C, BFF, and Protected. <!-- sdd-owner: implementation -->
- [x] REFACTOR: remove only seller-owned dead inline imports/JSX, not shared `lists.tsx`/`primitives.tsx` cleanup; rerun C, Frontend, Protected, LSP, diff/accounting, and strict OpenSpec validation, record evidence, and stop if I3B exceeds 400. <!-- sdd-owner: implementation -->

### I4 — responsive and browser proof

- [ ] RED: add component and one serial seeded seller case requiring semantic headings/list/nav, accessible retry names/disabled retry, visible focus/44px targets, wrapping/no overflow, 1/2/4 fact grids at 320/375/768/1280, real authorized rows and source-order keyboard traversal; run C and targeted Seeded and expect the named assertions to fail. <!-- sdd-owner: implementation -->
- [ ] GREEN: make only seller section/list accessibility-responsive changes and add the read-only `martin.demo@viewpro.local` proof that waits for real successful `/api/products` and `/api/activity/feed` rows; run C and targeted Seeded successfully. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: verify all four widths with short and permitted display-only long substitutions; intercept only successful real responses and preserve status, rows, IDs, tenant IDs, assignments, counters, kinds/types/times/order/destinations while recording upstream success; run targeted Seeded and Frontend. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove test artifacts and retain no screenshots/traces/videos/coverage; run C, Frontend, Protected, targeted and full Seeded, API local-only, OpenSpec, LSP, diff/accounting, recording every pass/skip/blocker and stopping if I4 exceeds 400. <!-- sdd-owner: implementation -->

## Requirement and scenario traceability

| Scenario | Implementing evidence |
|---|---|
| R1.1 exact agent | I1B role/query test |
| R1.2 protected managers | I1B Protected manager regression |
| R1.3 fail closed | I1B missing/unknown/no-query test |
| R2.1 real identity + tenant | I2 greeting/tenant test; I4 seeded proof |
| R2.2 missing identity | I1B identity gate; I2 no-fabrication test |
| R2.3 no reference shell chrome | I2 hierarchy/absence test; I4 browser |
| R3.1 assigned scope | I2 product-owner fact test |
| R3.2 rolling movement/stale | I2 exact window/timezone helper-copy and owner test |
| R3.3 narrow follow-up | I2 priority meaning/forbidden-task test |
| R4.1 two rows | I2 exact `<ul>/<li>` count test |
| R4.2 truthful zero priorities | I2 zero-ready contrast |
| R4.3 activity failure priorities | I1B activity error; I2 local recovery |
| R5.1 real assigned preview | I3A bounds/field-fallback presenter test; I3B composition integration |
| R5.2 permitted source activity | I3A kind/order/bound presenter test; I3B composition integration |
| R5.3 successful empties | I3A product/activity successful-empty versus error/positive-total-empty contrast; I3B composition integration |
| R5.4 prose/malformed time | I3A no-inference/no-`time` presenter contrast |
| R6.1 product initial loading | I1A loading adapter; I1B current composition |
| R6.2 both successful empty | I1A ready-zero; I3A empty-copy presenter test; I3B composition integration |
| R6.3 product local failure | I1B product-error/activity-ready test |
| R6.4 activity local failure | I1B activity-error/product-ready test |
| R6.5 local retry | I1A callback; I1B one-query current-composition retry |
| R6.6 retained refresh | I1A adapter; I1B current-composition contrast; I1C production container proof |
| R6.7 tenant transition | I1C production `SellerOperationalHomepage` A→B race proof |
| R7.1 authorized destinations | I3A valid-row-link test; I3B nav-derived shortcut/composition integration; I4 real seed |
| R7.2 invalid identity | I3A fail-closed link presenter test; I3B composition integration |
| R7.3 contextual movement only | I3B forbidden-action composition regression plus existing detail regression |
| R7.4 forbidden populated home | I2/I3B complete forbidden-content matrix |
| R8.1 keyboard/focus | I4 focus-order/accessible-name proof |
| R8.2 long responsive content | I4 four-width wrapping/overflow proof |
| R8.3 non-color meaning | I2/I4 visible-label/state assertions |
| R9.1 server authorization | BFF/API-local-only regression; no client authorization edits |
| R9.2 public/auth unchanged | Protected/full regression; allowlist audit |
| R9.3 owner/manager/shell unchanged | Protected manager/owner regression; allowlist audit |
| R9.4 contracts not expanded | BFF/API regression and no-new-request assertion |

## Parent lifecycle gates

- [ ] Start or reuse bounded review for every P/I PR; verify fresh-develop predecessor merge, allowlist, ≤400 accounting, strict-TDD records, rollback boundary, and protected regressions before merge. <!-- sdd-owner: parent -->
- [ ] After I4 and all merges, sync accurate `apply-progress.md` and final verification outcomes into this change without marking skipped checks as passed. <!-- sdd-owner: parent -->
- [ ] Archive only after implementation acceptance, complete verification, and the canonical-spec consolidation decision; retain change-local evidence. <!-- sdd-owner: parent -->
- [ ] Manually close issue #523 only after archive eligibility confirms all 34 scenarios, browser/accessibility proof, protected boundaries, and no unresolved blocker. <!-- sdd-owner: parent -->
