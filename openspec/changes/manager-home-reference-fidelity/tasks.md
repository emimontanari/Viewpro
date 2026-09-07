# Tasks: Manager Home Reference Fidelity

This is an executable, frontend-only delivery plan for `crm-manager-home`. Drafting this index is complete; delivery, implementation, verification, sync, archive, and issue closure below remain pending and must not be inferred from this artifact.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,840–2,210 across eight implementation PRs; 180–390 per implementation slice |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | P1 → P2 → P3 → P4 → I1 → I2A → I2B → I3 → I4A → I4B → I5 → I6 |
| Delivery strategy | ask-on-risk resolved to required split; no exception |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Delivery contract

- Maximum **400 additions + deletions** per PR; `size:exception` is not authorized.
- This is `stacked-to-main`: every successor begins from freshly updated `develop` **only after** its predecessor merges, targets `develop`, and contains only its own unit. Do not use an unmerged PR branch as a base.
- Each PR includes its tests, stays independently green and rollbackable, records its actual changed-line total once before opening, and states predecessor, next unit, start/end state, protected surfaces, and reverse-revert boundary. If a cohesive unit exceeds 400, stop and return the measured overage; do not code-golf or seek an exception.
- Use conventional commits. Local RED evidence may be recorded, but no failing commit or PR may land on `develop`.
- Preserve `AGENTS.md` rules, API/BFF/contracts/schema/auth/selected-tenant and tenant-isolation behavior, public routes, the shell, owner home, `AGENT` seller home, #306, and #327 throughout.

## Planning delivery

Measured planning boundaries are deliberately separate: P1 is the reference asset plus 178-line exploration; P2 is the 216-line proposal plus 165-line delta spec (381 text lines, and **must not be combined**); P3 is the 231-line design; P4 is this concise tasks index and must remain comfortably below 400 changed lines.

- [x] Deliver P1 from fresh `develop`: add `openspec/changes/manager-home-reference-fidelity/assets/manager-home-reference.jpeg` (SHA-256 `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`) and `exploration.md`; verify asset hash, `git diff --check`, status/diff, ≤400 changed lines, then merge before P2 starts. Delivered in #538 (`54e9295b`). <!-- sdd-owner: parent -->
- [x] Deliver P2 from fresh `develop` after P1 merges: add only `proposal.md` and `specs/crm-manager-home/spec.md`; verify the 381-text-line boundary, `git diff --check`, status/diff, ≤400 changed lines, then merge before P3 starts. Delivered in #540 (`5b088ab9`). <!-- sdd-owner: parent -->
- [x] Deliver P3 from fresh `develop` after P2 merges: add only `design.md`; verify its 231-line boundary, `git diff --check`, status/diff, ≤400 changed lines, then merge before P4 starts. Delivered in #541 (`71d5a7b2`). <!-- sdd-owner: parent -->
- [x] Deliver P4 from fresh `develop` after P3 merges: add only `tasks.md`; verify `git diff --check`, status/diff, an actual comfortably-≤400-line docs diff, and that unchecked implementation work is not reported ready; merge before I1 starts. Delivered in #542 (`0ec2b216`). <!-- sdd-owner: parent -->

## Shared implementation evidence and safety net

For every I1, I2A, I2B, I3, I4A, I4B, I5, and I6, append one evidence record to `openspec/changes/manager-home-reference-fidelity/apply-progress.md` and the PR evidence section: **slice/phase (RED, GREEN, TRIANGULATE, REFACTOR), UTC timestamp, fresh-develop branch, tree or commit SHA, exact command, exit code, and decisive output**. RED must fail on the intended behavioral assertion rather than setup; GREEN reruns it successfully; TRIANGULATE proves a contrasting case; REFACTOR changes no behavior and reruns focused plus slice regression checks.

Run all commands from `viewpro-app/`. API commands are regression-only (no backend change) and may run **only** when `DATABASE_URL` visibly names `viewpro_test` or another disposable test database; never use Neon or an external/production database. Record every skipped command and reason rather than claiming a pass.

| Evidence purpose | Authoritative command |
|---|---|
| Focused manager/seller component proof | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` |
| Dashboard BFF preservation | `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts` |
| Owner regression | `pnpm --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx` |
| Frontend regression suite / types / lint | `pnpm --filter next-shadcn-dashboard-starter test` · `pnpm --filter next-shadcn-dashboard-starter typecheck` · `pnpm --filter next-shadcn-dashboard-starter lint:strict` |
| Targeted seeded manager browser proof | `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep "manager home reference hierarchy"` |
| Full seeded regression | `pnpm --filter next-shadcn-dashboard-starter test:seeded` |
| Safe API contract regression only | `DATABASE_URL=...viewpro_test... pnpm --filter @viewpro/api db:validate` · `DATABASE_URL=...viewpro_test... pnpm --filter @viewpro/api typecheck` · `DATABASE_URL=...viewpro_test... pnpm --filter @viewpro/api test` |

## Implementation work units

The following matrix is the narrow source/test allowlist for each independently mergeable PR. No API, BFF, contract, schema, auth, tenant, public-route, owner, #306, or #327 file is an allowed implementation target.

| Slice | Allowed source and test surfaces | Objective, safety net, finish / rollback | Expected lines |
|---|---|---|---|
| I1 | `apps/app-new/src/app/dashboard/page.tsx`; `src/features/dashboard/components/operational-homepage.tsx`; `operational-homepage/helpers.ts`; `operational-homepage/states.tsx`; `operational-homepage.test.tsx`; new `operational-homepage/manager-home.test.tsx`; `tests/seeded/demo-smoke.spec.ts` (existing manager heading assertion only) | Exact `AGENT` / `MANAGER` / `PRINCIPAL_MANAGER` dispatcher; unknown/missing role and missing identity fail closed before any manager query; sole truthful manager `h1`, Argentina date seam, unchanged seller heading/query, and the existing seeded principal-manager assertion matches the deterministic authenticated greeting. Safety: agent/unknown no-summary-query assertions and owner test. Finish: roles/date deterministic. Roll back I1 as one dispatcher/heading change; never restore broad non-agent manager routing. | 220–340 |
| I2A | `src/features/dashboard/components/operational-homepage.tsx`; new `operational-homepage/manager-home.tsx`; `operational-homepage.test.tsx`; `manager-home.test.tsx` | Add serializable `nowMs`, one manager summary adapter/query, and remove manager products preview/fallback. Prove loading/no-facts, zero-success empties, retained-data error precedence, and exact retry; seller stays unchanged. Roll back adapter/query removal. | 250–340 |
| I2B | `operational-homepage/manager-home.test.tsx` | Add successful-refreshing, range/tenant loading, and exact latest-key triangulation evidence; source changes only if that proof finds a defect. | 80–160 |
| I3 | `src/features/dashboard/components/operational-homepage.tsx` (manager composition/imports only); `operational-homepage/manager-home.tsx`; new `operational-homepage/manager-sections.tsx`; `operational-homepage/helpers.ts`; `operational-homepage/primitives.tsx`; `operational-homepage/priority-panel.tsx`; `manager-home.test.tsx` | Render greeting/date → dominant summary/range → four truthful metric tiles → two truthful `/dashboard/seguimiento` priorities, with selected-window labels and successful zero values distinct from failure. Safety: only existing summary fields and 7/14/30d; no visits, alerts, scores, deltas, or percentages. Finish: semantic DOM order and metric meanings proven. Roll back hero/metrics/priorities only. | 300–390 |
| I4A | `src/features/dashboard/components/operational-homepage.tsx` (manager composition/imports only); `operational-homepage/manager-sections.tsx`; `operational-homepage/helpers.ts`; `manager-home.test.tsx` | Add bounded recent activity and reusable atomic-summary unavailable/retry panel: real kind/text/property/time, Argentina-local `<time>`, true empty/loading/error states, wrap-safe text, and fail-closed authorized `/dashboard/product/{engagementId}` links. Safety: no fabricated activity and preserve parent-summary failure. Finish: source, range, bounds, link, empty, long-text, unavailable/retry evidence. Roll back activity/panel only without changing seller lists. | 250–350 |
| I4B | `operational-homepage/manager-sections.tsx`; `operational-homepage/helpers.ts`; `manager-home.test.tsx` | Redesign top-properties from the atomic summary with selected-window context, real title/count/latest activity/time, true empty/error states, wrap-safe text, and authorized engagement links. Safety: retain legacy `TopPropertiesCard` byte-equivalent until this slice and do not change seller lists. Finish: property source, selected window, link, empty, long-text, and unavailable/retry evidence. Roll back top-properties only. | 180–300 |
| I5 | `operational-homepage/manager-sections.tsx`; `operational-homepage/helpers.ts`; `operational-homepage/primitives.tsx`; `manager-home.test.tsx` | Add bounded top-sellers (real name/email and supported manual-movement counts only) and policy-derived shortcuts from `navGroups`, `canAccessNavigation`, and `canManagePropertyEngagements`; hide unresolved/unauthorized routes and create action. Safety: forbidden-content/action proof covers score/rating/trophy, photos, performance, client/agenda/message/upload/reminder, #306 proposals, and #327 platform terms. Finish: permission/policy contrasts and encoded seller destination pass. Roll back seller/shortcut regions only. | 260–380 |
| I6 | `operational-homepage/manager-home.tsx`; `operational-homepage/manager-sections.tsx`; `operational-homepage/primitives.tsx`; `operational-homepage/states.tsx`; `manager-home.test.tsx`; `tests/seeded/demo-smoke.spec.ts` | Polish responsive/a11y behavior only: one/two/four-column thresholds, 44px narrow controls, visible focus, named range group with `aria-pressed`, h1/h2/list/time/link semantics, and no meaningful truncation. Add one serial read-only seeded principal-manager proof at 320×800, 375×812, 768×900, and 1280×900; it uses real auth/summary data and may replace display strings only through `route.fetch()` while preserving IDs/counts/kinds/destinations. Safety: no seed/DB mutation, no auth/permission interception, no network-failure browser mock. Finish: focus/DOM order, wrapping, non-overlap, and `scrollWidth <= innerWidth` pass. Roll back browser proof and polish independently. | 180–320 |

### I1 — role, heading, and date foundation

- [x] RED in `apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx` and `operational-homepage/manager-home.test.tsx`: assert exact manager/principal mounting, `AGENT` seller retention/no manager request, unknown/missing role and identity fail-closed/no request, one manager `h1`, and before/after Buenos Aires-midnight dates; run the focused component command and record its expected assertion failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I1 allowlist: dispatch before query-owning child mount, remove only dashboard generic visible heading ownership, and add pure `es-AR`/`America/Argentina/Buenos_Aires` date formatting with injected `now`; rerun the focused command successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I1 with both manager roles versus `AGENT`/unknown and two Argentina calendar days; rerun focused component plus owner regression commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I1 without semantic change, rerun its focused and owner/seller regression commands, record evidence, measure ≤400 changed lines, and prepare a standalone rollbackable PR. <!-- sdd-owner: implementation -->

### I2A — atomic summary core and retry

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert serializable `nowMs`, exactly one initial manager summary query/config, no manager products preview, loading/no facts, zero-success empty semantics, retained-data error precedence, and disabled/exact retry; record the intended failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I2A allowlist: add the summary adapter/query, retain the tenant/range key and 10-second BFF behavior, remove manager products composition, and rerun focused components plus BFF regression. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I2A with zero-ready versus retained-data error and retrying versus retry-ready; rerun focused component and BFF commands. <!-- sdd-owner: implementation -->
- [x] REFACTOR I2A without changing seller queries or BFF/API code; rerun focused/BFF/frontend suite/typecheck/lint, record evidence, measure ≤400 lines, and prepare its rollbackable PR. <!-- sdd-owner: implementation -->

### I2B — refreshing, range, and tenant proof

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert successful-refreshing keeps truthful ready facts and range/tenant changes do not retain prior facts; record the focused failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I2B allowlist: make the minimum source change only if the refreshing/range/tenant proof exposes a defect; rerun focused components. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I2B with 7d/14d/30d and two tenant IDs, including exact latest summary query key/config; rerun focused components and BFF regression. <!-- sdd-owner: implementation -->
- [x] REFACTOR I2B and run focused, BFF, owner, frontend suite, typecheck, lint, diff/accounting, and final seller regressions; record its independent ≤400-line boundary. <!-- sdd-owner: implementation -->

### I3 — hierarchy, metrics, priorities, and range

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert the specified DOM scan order, selected 14d wording, exact labels/helper semantics for active engagements, movements, stale, and attention, two follow-up priorities, and true zero-success copy; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I3 allowlist: render the dominant summary, accessible range controls, four metric primitives, and priorities from ready atomic data without unsupported claims; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I3 with 7d/14d/30d, nonzero versus zero-ready, and stale versus attention meanings; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I3 while preserving one `h1`, ordered section headings, and no seller primitive behavior change; rerun focused/typecheck/lint, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->

### I4A — recent activity and atomic retry

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert activity source movement/document kind/title/property text, ISO dateTime with deterministic es-AR Buenos Aires visible time, selected 7d/14d/30d context, valid engagement link, and no initial activity heading; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I4A allowlist: render manager-only recent activity and reusable atomic-summary unavailable/retry panel; preserve the parent summary failure and legacy top-properties/seller calls; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I4A with maximum five preserving source order, blank/malformed IDs without links, long wrap-safe text, ready empty, loading, unavailable/retrying, and exactly-one-refetch behavior; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I4A without modifying the seller block or legacy `TopPropertiesCard`, rerun focused/typecheck/lint, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->

### I4B — top-properties and selected-window context

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert selected-window property context, real title/count/latest text/time/destination, true empty state, summary-unavailable panel, and long property wrapping; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I4B allowlist: replace the legacy manager top-properties rendering with a manager-only atomic-summary region and shared unavailable/retry behavior; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I4B with 7d/14d/30d, bounded property ordering, valid versus unavailable destinations, and empty-ready versus error; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I4B without modifying seller list contracts, rerun focused/typecheck/lint, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->

### I5 — sellers, shortcuts, and forbidden content

- [x] RED in `operational-homepage/manager-home.test.tsx`: assert bounded top-seller real identities/counts and encoded follow-up links; assert navigation-policy and create-permission allowed/denied cases; assert forbidden facts/actions/terms never render; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [x] GREEN only the I5 allowlist: map sellers and existing authorized property/follow-up/team/create shortcuts through centralized policy/capability helpers, failing closed on missing policy/route; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I5 with create permission on/off, team policy on/off, seller identity/count variants, and forbidden #306/#327/reference-only copy; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I5 without role-name-only action authority or new destinations, rerun focused/typecheck/lint and owner/seller regressions, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->

### I6 — responsive and seeded browser proof

- [x] RED in `operational-homepage/manager-home.test.tsx` and `tests/seeded/demo-smoke.spec.ts`: assert names/focus/DOM order, long-text readability, target sizes, viewport geometry, and the seeded manager hierarchy; record a meaningful focused assertion failure without mutating seed data or mocking auth/permissions. <!-- sdd-owner: implementation -->
- [x] GREEN only the I6 allowlist: apply semantic responsive/focus/wrapping polish and the one bounded serial seeded manager case; run focused components and the targeted seeded manager command successfully. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE I6 at 320×800, 375×812, 768×900, and 1280×900 with short/long display values while preserving real response semantics; rerun targeted seeded and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [x] REFACTOR I6 without shell/mobile-chrome changes, rerun focused/typecheck/lint/targeted seeded/full seeded checks as environment permits, record skips accurately, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->

## Requirement and scenario traceability

| Delta requirement and scenario | Implementing evidence |
|---|---|
| R1 — Allowed manager role opens the manager home | I1 exact manager/principal dispatch assertions |
| R1 — Agent retains the seller home | I1 seller branch/no-summary-query assertions |
| R1 — Unknown role fails closed | I1 unknown/missing role and identity/no-query assertions |
| R2 — Greeting renders the Argentina-local current date | I1 truthful `h1` and fixed-instant formatter assertions |
| R2 — Date changes across calendar days | I1 before/after Buenos Aires-midnight fixtures |
| R3 — Manager sees the supported reference hierarchy | I3 DOM order; I5 forbidden-content proof; I6 browser hierarchy proof |
| R4 — Selected range controls metric meaning | I2B range/latest-key proof plus I3 7d/14d/30d label assertions |
| R4 — Metrics preserve their source meanings | I3 supported-field and forbidden-label assertions |
| R4 — No qualifying records has truthful labels | I3 zero-ready versus error contrast |
| R5 — Activity and rankings use permitted source records | I4A activity source fixtures, I4B property fixtures, and I5 bounded-seller fixtures |
| R5 — Ranked property opens its real destination | I4A activity and I4B property authorized engagement-link assertions |
| R5 — Empty activity remains distinct from a failure | I4A empty-ready versus unavailable-panel assertions |
| R6 — Loading values are not presented as facts | I2 atomic loading assertions |
| R6 — Summary failure is explicit | I2 error-precedence, no-zero, and exact-refetch assertions |
| R6 — Independent failure remains local | I2 proves the design has no independent manager query: every unavailable group identifies the same atomic summary failure and retries that request |
| R7 — Permitted manager sees an existing property action | I5 centralized capability/policy allowed assertions |
| R7 — User without creation permission cannot create a property | I5 create-denied/hide assertions |
| R8 — Reference-only concepts are omitted | I3 supported-only metrics and I5 forbidden-copy/action matrix |
| R9 — Keyboard user reaches controls coherently | I6 named controls, focus, and DOM-order proof |
| R9 — Long content remains usable across critical viewports | I6 long-text four-viewport geometry proof |
| R10 — Protected surfaces remain unchanged | I1 agent isolation, owner regression, BFF/frontend suite, and no source outside the allowlists |
| R10 — Manager home remains tenant scoped | I2B tenant/latest-key contrast and unchanged selected-tenant BFF regression |

## Verification

- [x] Before each implementation PR, run `git diff --check`, `git diff --stat`, and `git status --short` from `viewpro-app/`; record actual additions + deletions, command exits, and focused evidence in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`, stopping for a measured >400-line cohesive diff. Historical limitation accepted by the human: all eight PRs were recomputed at ≤400, but I1's exact pre-PR timing log is incomplete and is not claimed to exist. <!-- sdd-owner: implementation -->
- [x] After I6, run the shared-matrix focused component, BFF, owner, frontend suite, typecheck, lint, targeted seeded, and full seeded commands; run API validation/typecheck/test only with a visibly disposable `DATABASE_URL`; record every pass, skip, and blocker in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`. <!-- sdd-owner: implementation -->

## Sync

- [ ] Start or reuse bounded review for each independently green P/I PR; confirm the chain context, fresh-`develop` predecessor merge, ≤400 changed lines, strict-TDD evidence, protected-surface regressions, and rollback boundary before merging. <!-- sdd-owner: parent -->
- [ ] Sync implementation evidence and final verification outcomes into `openspec/changes/manager-home-reference-fidelity/` only after all I1–I6 PRs merge; do not mark unrun checks passed or alter canonical specs before acceptance. <!-- sdd-owner: parent -->

## Archive

- [ ] Archive `openspec/changes/manager-home-reference-fidelity/` only after accepted implementation, verification evidence, required spec consolidation decision, and lifecycle gates; retain the change-local history as evidence. <!-- sdd-owner: parent -->

## Issue closure

- [ ] Close #522 only after archive eligibility confirms exact-role behavior, truthful data/state/action boundaries, accessibility/browser proof, protected #306/#327/owner/seller/public surfaces, and no unresolved blockers. <!-- sdd-owner: parent -->
