# Exploration — Manager Home Reference Fidelity (#522)

## Outcome

Recompose only the authenticated `/dashboard` home for exact `MANAGER` and `PRINCIPAL_MANAGER` memberships around the supplied mobile reference's visual hierarchy, using the existing tenant-authorized dashboard summary contract. Do not change the `AGENT` home, backend contracts, repositories, schema, public routes, owner surfaces, seller proposals (#306), or platform data lane (#327).

The supplied asset is present at `assets/manager-home-reference.jpeg`; its supplied SHA-256 is the stated `97cf…d3c9`. No external research is needed: the visual and repository contracts are sufficient.

## Evidence reviewed

- Root `AGENTS.md`, `docs/plans/2026-07-20-recta-final-execution.md`, and `openspec/config.yaml`.
- Canonical specs: `owner-portal-home`, `seller-navigation-scope`, `property-primary-seller`, `platform-data-lane`, and `platform-data-lane-ingest-metrics`.
- Current manager home route, session/role boundary, dashboard BFF, frontend dashboard feature, products/activity APIs, Nest analytics controller/use case/repository, and existing frontend/API/seeded tests.
- Active #306 exploration only to establish its currently reserved proposal-domain boundary.

## Reference interpretation

The reference is a compact mobile command center: dark branded top region; friendly greeting; one dominant rounded summary card; four equal metric tiles; a priority queue; recent-activity summary; team strip; quick-action strip; and a persistent bottom navigation. Its visual language is high-density but calm: white cards, subtle separators/shadows, rounded icon containers, green as positive/action color, and distinct blue/purple/orange/red semantic accents.

Translate that hierarchy to the existing responsive application rather than copying unsupported mobile chrome. The existing dashboard shell owns desktop sidebar/header/navigation. In the content region, stack the hero and cards at narrow widths; use two/four-column metric and card grids only where content remains readable; retain semantic links/buttons, visible labels, keyboard order, and accessible names. Long tenant, property, seller, and activity values must wrap rather than become reference-like sample text or inaccessible icon-only controls.

## Current entry route and role split

| Boundary | Current behavior | Required preservation |
|---|---|---|
| `apps/app-new/src/app/dashboard/page.tsx` | Wraps `OperationalHomepage` in `PageContainer`, whose generic “Inicio” heading precedes the feature. | This is the authenticated home entry route; any reference-style greeting must not fabricate identity and should avoid duplicative headings. |
| `features/dashboard/components/operational-homepage.tsx` | Waits for `useActiveTenant`; shows missing-tenant state; routes `AGENT` to `SellerOperationalHomepage`; every non-`AGENT` role reaches `ManagerOperationalHomepage`. | Make the manager branch an explicit `MANAGER`/`PRINCIPAL_MANAGER` allowlist (and fail closed for another role); retain the seller branch without its query or UI changes. |
| `lib/session-context.tsx` | Provides active membership, tenant id, tenant name/status, and loading state from API-backed session membership. | Use it for real tenant identity and role only; client-side routing remains UX, not authorization. |
| Nest `AnalyticsController` | `GET /analytics/dashboard-summary` requires auth, active tenant membership, permission guard, and `ENGAGEMENTS_VIEW_ALL`. | Keep backend authorization and selected-tenant header/BFF behavior unchanged. |

The current `isSellerMembership()` split is intentionally seller-safe but too broad for the new stated target: an unknown/non-agent role would currently see manager content. This must be corrected in the frontend composition without treating that as a substitute for the API guard.

## Existing data and contract map

### Query/BFF chain

`ManagerOperationalHomepage` currently starts two independent TanStack queries scoped by active tenant id:

1. `dashboardSummaryOptions({ tenantId, range })` → `getDashboardSummary()` → same-origin `GET /api/dashboard/summary` → BFF `GET /analytics/dashboard-summary`.
2. `productsQueryOptions({ archived: 'active', limit: 6, page: 1, tenantId })` → `/api/products` → BFF `/property-engagements`.

The summary BFF validates only `7d`, `14d`, and `30d`, proxies the selected-tenant context through `bffFetch`, and returns 502/504 on BFF failure. The summary frontend request has a ten-second timeout. The selected `tenantId` is part of query keys; it is not sent as an untrusted URL parameter.

`GetDashboardSummaryUseCase` computes all summary fields with a `Promise.all`, scoped by trusted current tenant. The backend response is atomic at HTTP level: it cannot presently report a successful subset of its internal analytics calls. `GET /analytics/dashboard-summary` is restricted to `ENGAGEMENTS_VIEW_ALL`; this is appropriate for manager/principal-manager data and must not be requested by the `AGENT` branch.

### Exact metric semantics

| Existing response field | Exact backend source and meaning | Safe reference use |
|---|---|---|
| `counters.activeProperties` | Count of this tenant's unarchived engagements whose status is neither `CLOSED` nor `CANCELLED`. | “Propiedades activas” metric; it is an engagement count, not a count of unique physical assets. |
| `counters.movementsInRange` | Count of movements created within selected rolling 7/14/30-day window on those active engagements. | “Movimientos del período”; never label as today, visits, or progress. |
| `counters.staleProperties` | Count of active engagements with no movement created in the selected window. | “Sin novedades en N días” priority/metric. It does not include document requests as movement. |
| `counters.attentionNeeded` | Count of active engagements whose latest movement inside the selected window is `INQUIRY`, `VISIT_COMPLETED`, or `OFFER_RECEIVED` and has blank/missing `nextStep`. | “Requieren atención” / a priority item with that narrow explanation; not a general alert count. |
| `recentActivity` | At most five newest merged movement and permitted document-request activity records in the selected window, sorted `createdAt` descending and then id descending. Documents appear only for `DOCUMENTS_VIEW_ALL`; inactive/archived engagements are excluded. | Recent activity list with real title/observation, date, kind, and engagement link. |
| `topProperties` | At most three active tenant engagements ranked by combined movement plus document-request count in the window, then last activity time. Each contains those counts and the real latest movement observation or request title. | “Propiedades con más movimiento”; retain counts and do not reinterpret as percentage performance. |
| `topSellers` | At most three users ranked by manual movements on active tenant engagements in the window; contains name/email, movement count, distinct touched engagement count, and last movement time. | “Vendedores con más movimiento”; text/initial presentation only unless a real image contract is later supplied. |
| `products.total` | Property-engagement list total under current tenant visibility and `archived=active`; the current manager fallback uses it only if the summary count is absent. | Not needed for a summary-backed active-property metric; removing that fallback prevents a failed summary from looking successful. |

The use case and Prisma repository apply tenant filters to each count/list and exclude archived/closed/cancelled engagements. Existing API integration coverage proves tenant and archived-record exclusion. No new API, repository, database, or generated contract is required for the truthful composition described here.

## Reference-module classification

| Visible reference module | Classification | Truthful treatment |
|---|---|---|
| Branded greeting, date, menu/bell chrome | Supportable composition / omit unsupported pieces | Tenant/session gives agency identity; a greeting may use only authenticated identity if already available, and the current date is derivable. Keep existing app shell rather than duplicating menu/bottom nav. Do not show the red notification count because no count is loaded here. |
| General-agency 86% score, “Muy bueno”, trophy ring, details action | Omit | No general score, rating, benchmark, score history, or score-details contract exists. |
| Properties metric | Directly supported | `activeProperties`, with the engagement semantics above. |
| “18 vendedores activos” | Adapted support | `topSellers` supports only sellers with most manual movement during the selected range; it cannot state active team size. If retained, label it as activity ranking, not active sellers. |
| “9 visitas hoy” | Omit | There is no truthful today-visit aggregate. Movement `visitCount` does not define the reference metric and the dashboard aggregate is range-wide movements. |
| “42 alertas pendientes” | Adapted support | Use `attentionNeeded` and/or `staleProperties` only with their exact labels; neither is a general alert inbox. |
| “Pendientes importantes” queue | Supportable composition | Use existing priority links for stale engagements and the narrowly-defined attention count. A document row may only be described as the count of document-request items within the already capped recent-activity set, never as all pending documents. |
| “Actividad reciente” three-stat strip and deltas | Adapted support | Render real recent activity and selected-range counters; omit week-over-week percentage deltas, sent-message count, and fabricated visits. |
| Team performance avatars and percentages | Adapted support | Render `topSellers` as a bounded movement ranking with names and real counts. Omit photos, per-person percentages, colored performance bars, and unnamed people. |
| Quick actions | Adapted support | Only expose current authorized destinations/actions: a permission-gated “Nueva propiedad” where `ENGAGEMENTS_CREATE` exists, plus existing properties/follow-up/team destinations when their existing access policy allows them. Omit new client, agenda visit, message/news, generic document upload, and reminder creation because those domains/actions are not authorized by this change. |
| Mobile bottom navigation | Omit/adapt to current shell | Existing sidebar/header/KBar navigation remains the canonical navigation surface. No separate reference bottom nav should be created. |

## Hidden-failure findings

The current manager UI has material false-success paths:

1. `summaryQuery.data?.counters.* ?? 0`, `recentActivity ?? []`, `topProperties ?? []`, and `topSellers ?? []` turn a summary failure into zero KPI values and empty panels. Only the priority-card sentence mentions an error.
2. `activePropertiesTotal` falls back from a failed/absent summary counter to `productsQuery.data?.total ?? 0`; a mixed query result can conceal which source failed, and two failures render `0` properties.
3. `RecentActivityList`, `PropertyPreviewList`, `TopPropertiesCard`, and `SellerActivityCard` accept only loading/data props, so failed queries arrive as their normal empty states.
4. Priority links remain active with zero-derived counts during error; there is no explicit retry control. Existing component tests never mock `isError: true`.
5. The same pattern also exists in the separate seller home, but changing it is out of scope because the approved target roles explicitly exclude `AGENT`. The manager work must not regress that separation.

The replacement manager composition must make each rendered data group show loading, true empty, error/partial availability, and a retry path. For the atomic summary endpoint, a failed summary is a full summary failure—not an empty/zero or invented partial result. If independent manager queries are retained, their error must remain local and identify the affected block; if the property-preview query is removed, do not invent a partial-error state that the sole response cannot supply. A retry must invoke the relevant query `refetch`, not merely link to a potentially unrelated destination.

## Existing routes and actions that may be linked, not reinvented

- `/dashboard/product` and permission-gated `/dashboard/product/new` are the canonical property list/create surfaces.
- `/dashboard/product/[engagementId]` is the engagement detail target used by activity and ranking rows.
- `/dashboard/seguimiento` is the canonical cross-property tracking surface; seller filters already use `?sellerId=<encoded id>`.
- `/dashboard/users` is the existing team-management route, subject to its centralized navigation/access policy.
- `/dashboard/status-change-requests`, `/dashboard/workspaces`, and principal-manager-only `/dashboard/settings/tenant-contact` remain existing navigation, not quick-action domains to redesign.
- `/dashboard/notifications` exists, but this home loads no unread total and must not imitate the reference badge count.

Use centralized `canManagePropertyEngagements()` and/or the existing navigation policy for conditional shortcuts rather than role-name-only UI checks. Backend authorization remains authoritative.

## Test and coverage map

| Layer | Existing evidence | Gap for this change |
|---|---|---|
| Frontend component | `features/dashboard/components/operational-homepage.test.tsx` covers tenant loading/missing state, normal manager content/range selection, and AGENT query/UI separation. | Add explicit principal-manager render, exact role fail-closed behavior, manager loading/empty/error/retry states for every new group, no-zero-on-error assertions, authorized shortcut visibility, and reference hierarchy/accessibility/order assertions. |
| Dashboard BFF | `app/api/dashboard/summary/route.test.ts` covers permitted range forwarding and invalid-range omission. | No BFF behavior change is expected; retain as regression evidence unless an implementation changes it. |
| API unit/E2E | `apps/api/test/analytics.use-cases.spec.ts` verifies range/default mapping; `analytics.e2e-spec.ts` verifies summary counters, active/archived exclusion, and cross-tenant exclusion. | No backend change is intended; retain focused regression commands only. |
| Seeded browser | `apps/app-new/tests/seeded/demo-smoke.spec.ts` checks manager landing heading and a separate seller dashboard, but does not assert manager reference hierarchy or failure/retry behavior. | Add a small manager-home seeded/browser assertion only if it can use real deterministic data and remains below the review budget; mock network failures belong in component tests. |

## Strict-TDD seams

1. Start RED in `operational-homepage.test.tsx` (or narrowly extracted manager presentation tests) for exact manager/principal branching, query error treatment, retry calls, true empty treatment, supported labels/semantics, keyboard-visible links, and the unchanged AGENT non-summary query assertion.
2. Implement the smallest manager-only state/presentation seams. Pure mapping/label helpers should have direct unit tests when they encode source semantics, especially preventing “alerts”, “today visits”, percentages, and active-seller language.
3. Run focused frontend tests GREEN, then the frontend suite/lint. Only add/adjust seeded browser coverage after component behavior is green; do not use it to manufacture data or mask state failures.
4. No API RED/GREEN cycle is warranted unless later design introduces a backend contract; that would be a scope/risk escalation requiring the parent to decide.

Baseline commands (from `viewpro-app/`; API tests are destructive and require a clearly test-only database):

```bash
pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter @viewpro/api db:validate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
```

No commands were run during this read-only exploration.

## Smallest coherent edit surfaces and review slices

Expected source changes are frontend-only. Likely files are `app/dashboard/page.tsx` only if heading ownership must change; `features/dashboard/components/operational-homepage.tsx`; and its existing `operational-homepage/{states,primitives,lists,helpers,constants}.tsx` siblings only where an extracted manager state/presentational seam materially keeps the main component below the review budget. Do not touch BFF, Nest API, Prisma, owners, platform apps, or source outside the manager-home feature without a new accepted decision.

| Work unit | Scope | Forecast / boundary |
|---|---|---|
| WU0 — OpenSpec planning | Proposal, delta spec, design, and tasks derived from this exploration. | Keep planning artifacts as their own reviewable docs-only unit; split before 400 changed lines rather than mixing them with code. |
| WU1 — manager-state foundation | RED/GREEN tests plus manager-only loading, empty, error, retry, and exact-role routing seams. | Target 250–380 changed lines. Keep AGENT implementation/text/query behavior untouched except a regression assertion. |
| WU2 — reference hierarchy | RED/GREEN tests plus visual composition of hero, truthful metric tiles, priorities, recent activity, seller ranking, and authorized shortcut group. | Target 300–390 changed lines. Reuse existing cards/icons and split extracted presentational files if the main rewrite would exceed 400. |
| WU3 — browser proof, only if necessary | Seeded manager hierarchy/responsive semantic proof and any deterministic fixture-only adjustment. | Target under 250 lines; do not combine with WU2 if the combined diff approaches 400. |

A single broad rewrite of `operational-homepage.tsx` plus its existing roughly 500-line test is likely to exceed the 400-line PR limit. Do not use a line-count exception. Each source unit must include its corresponding strict-TDD tests so the PR remains green; test-only RED commits are local/stacked development evidence, not independently mergeable failing PRs.

## Product decisions

### Confirmed

- Only `MANAGER` and `PRINCIPAL_MANAGER` receive the reference-fidelity manager home; `AGENT` remains its separate seller home.
- Maximum visual fidelity is bounded by real, authorized data; unsupported score, visit, alert, delta, message, performance, task, person, and quick-action facts are forbidden.
- Loading, empty, error/partial availability, and retry must be explicit; query failure must never silently look like zero, empty, or success.
- Tenant isolation, backend authorization, public routes, owner/seller surfaces, #306, and #327 are preserved.
- New agenda/tasks/clients/alerts domains, general score, seller-home redesign, and owner redesign are out of scope.
- External research is not needed for this change.

### Genuinely unresolved for the parent to resolve if needed

1. Whether the page-level `PageContainer` title/description should be removed or visually subordinated so the reference-style greeting is the sole content heading; this is presentation ownership, not a data contract.
2. Whether a real current calendar date is desired in the greeting. It is derivable and truthful, but it changes with locale/time zone and is not needed for the reference hierarchy.
3. Whether WU3 needs seeded browser coverage. Current component tests can cover error/retry deterministically; browser coverage is valuable only if a concise real-data hierarchy/responsive assertion fits the budget.

## Scope collision boundaries

### #306 — seller property proposals

#306 owns a separate tenant-owned proposal aggregate, seller draft/submit/edit/resubmit workflow, manager review/approve/reject, approval materialization of exactly one canonical asset/engagement, and its audit/concurrency/isolation rules. This change must not add proposal counts, proposal cards, proposal quick actions, proposal routes, permissions, schema, API calls, or approval terminology. Existing direct manager property creation remains merely an already-authorized shortcut when permission allows it.

### #327 — platform data lane

#327 owns demand-triggered synchronization between InmoView and the separate `viewpro-api` platform mirror, durable cursor/ingest state, operator-only metrics, singleton topology, and provider evidence. This manager home reads only tenant-scoped InmoView analytics through existing app-new BFF routes. It must not query platform metrics, mount platform sync demand, alter polling/sync/configuration, or imply any platform status/alerts from #327 data.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A visually faithful card labels unsupported numbers as reference facts. | Bind each displayed metric to the semantic table above; omit unsupported modules and test forbidden copy. |
| A role broadening exposes manager data to another membership. | Explicit frontend allowlist plus unchanged backend `ENGAGEMENTS_VIEW_ALL` guard and AGENT regression test. |
| Query failures again appear as empty/zero. | State-bearing manager components, explicit retry, and error tests for every manager data group. |
| Density harms narrow viewport accessibility. | Mobile-first one-column composition, labeled semantic controls, visible focus order, wrapping text, and a concise viewport proof if WU3 is selected. |
| A broad visual rewrite exceeds review budget. | Deliver WU0–WU3 as small stacked work units, each at or below 400 changed lines. |
