# Design: Truthful Reference-Fidelity Manager Home

## Decision summary

The authenticated `/dashboard` route will keep the existing application shell and replace only the content selected for exact `MANAGER` and `PRINCIPAL_MANAGER` memberships. `OperationalHomepage` will become an explicit role dispatcher. A manager-only container will own one atomic dashboard-summary query, selected range, authenticated identity, and a clock seam; manager-only presentational components will render the reference hierarchy without unsupported score or mobile chrome.

The manager products query will be removed. The dashboard summary already owns the active-engagement count, recent activity, top-property ranking, and top-seller ranking required by this capability. Keeping `/api/products` would preserve an unsupported “properties to resume” list and recreate the cross-query fallback/partial-state ambiguity. The seller branch will retain its existing products and activity queries unchanged.

Current code supports this frontend-only design: session supplies real user identity, role, permissions, tenant identity/status; the summary response supplies every required operational fact; existing routes and navigation policies supply all permitted destinations. No API, BFF, contract, schema, auth, tenant, or backend change is needed.

## Verified current architecture

| Concern | Verified source and current symbol | Design consequence |
| --- | --- | --- |
| Route heading | `apps/app-new/src/app/dashboard/page.tsx` → `Dashboard`; `PageContainer` currently emits generic “Inicio” before feature content. | Omit `pageTitle`/`pageDescription` on this route. Manager greeting becomes its sole `h1`; the existing seller and missing-tenant `h1` elements remain truthful. Metadata stays unchanged. |
| Role composition | `features/dashboard/components/operational-homepage.tsx` → `OperationalHomepage`, `ManagerOperationalHomepage`, `SellerOperationalHomepage`, `isSellerMembership`. All non-agents currently reach manager code. | Dispatch `AGENT`, exact manager allowlist, then fail closed. Manager and identity checks happen before mounting a query-owning child. |
| Identity/tenant | `lib/session-context.tsx` → `useSession`, `useActiveTenant`; `lib/session.ts` → `Session.user`, `getUserDisplayName`, `TenantMembership`. | Greeting uses only `getUserDisplayName(session.user)` and `activeMembership.tenant.name`. Missing identity is a closed state, not invented copy. |
| Summary query | `features/dashboard/api/{queries,service,types}.ts` → `dashboardSummaryOptions`, `getDashboardSummary`, `DashboardSummaryResponse`. | Keep the tenant/range query key, same-origin BFF, and 10-second timeout. Do not send tenant in the URL. |
| BFF | `app/api/dashboard/summary/route.ts` and `.test.ts`. | Keep `7d`/`14d`/`30d` validation, selected-tenant forwarding through `bffFetch`, and 502/504 behavior unchanged. |
| Backend authority | API `AnalyticsController.dashboardSummary`, `GetDashboardSummaryUseCase.execute`, `PrismaAnalyticsRepository`. | Existing auth, membership and permission guards plus `ENGAGEMENTS_VIEW_ALL` remain authoritative. `Promise.all` makes the response HTTP-atomic. |
| Existing presentation | `operational-homepage/{constants,helpers,lists,primitives,priority-panel,range-selector,states}.tsx`. | Reuse cards, buttons, badges, range options and icons. Add manager-only stateful props instead of changing seller list/error behavior. |
| Navigation policy | `config/nav-config.ts`; `lib/navigation-access.ts`; `lib/session.ts` → `canManagePropertyEngagements`. | Resolve list/follow-up/team destinations from `navGroups` and `canAccessNavigation`; use the capability helper for create. Missing route/policy resolution fails closed. |
| Component proof | `components/operational-homepage.test.tsx`. | Preserve seller assertions and add role/query isolation. Put dense manager-state tests in a new adjacent test file to control review size. |
| Browser proof | `tests/seeded/demo-smoke.spec.ts`; seeded principal manager is `Demo ViewPro`. | Extend one bounded manager flow; do not alter seed data or seller/owner flows. |

The reference asset is `openspec/changes/manager-home-reference-fidelity/assets/manager-home-reference.jpeg`, SHA-256 `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`.

## Target files and symbols

### Existing files

- `src/app/dashboard/page.tsx`: `Dashboard` stops owning a visible content heading.
- `src/features/dashboard/components/operational-homepage.tsx`: `OperationalHomepage` owns session/tenant resolution and exact role dispatch; `SellerOperationalHomepage` remains behaviorally unchanged.
- `operational-homepage/helpers.ts`: add pure Argentina date/time formatting and authorized-shortcut mapping helpers; keep existing title/count helpers.
- `operational-homepage/states.tsx`: add `UnsupportedDashboardRoleState` and reusable manager `DataUnavailablePanel`; retain tenant loading/missing states.
- `operational-homepage/primitives.tsx`: add manager metric/shortcut primitives with semantic tone props; do not change seller `KpiCard` behavior.
- `operational-homepage/priority-panel.tsx`: add manager priorities that accept a discriminated state; retain seller `PriorityLink` contract.
- `operational-homepage/lists.tsx`: retain shared seller lists; manager-specific lists move to the new file below so seller copy and query behavior do not drift.
- `operational-homepage.test.tsx`: role dispatcher, query isolation, page-heading integration assumptions, and unchanged-agent regressions.
- `tests/seeded/demo-smoke.spec.ts`: one bounded manager hierarchy/layout/keyboard proof.

### New frontend files

- `operational-homepage/manager-home.tsx`: exported `ManagerOperationalHomepage`; owns range and the sole manager query, converts query state once, and passes no fallback values.
- `operational-homepage/manager-sections.tsx`: `ManagerHomeView`, `ManagerRecentActivity`, `ManagerTopProperties`, `ManagerTopSellers`, `ManagerShortcuts`.
- `operational-homepage/manager-home.test.tsx`: deterministic manager date, data-state, mapping, hierarchy, action, and accessibility tests.

No implementation file outside `apps/app-new` is a target. New file names may be combined only when the same work unit remains readable and at or below 400 changed lines.

## Component and state architecture

```text
Dashboard (PageContainer, no generic visible heading)
└─ OperationalHomepage(now?)
   ├─ tenant unresolved → OperationalHomepageSkeleton
   ├─ tenant/membership absent → MissingInmobiliariaState
   ├─ AGENT → existing SellerOperationalHomepage (products + activity)
   ├─ MANAGER | PRINCIPAL_MANAGER + real session identity
   │  └─ ManagerOperationalHomepage (range + dashboard summary only)
   │     └─ ManagerHomeView (pure rendering)
   └─ unknown role or missing identity → UnsupportedDashboardRoleState
```

Public/testable contracts:

```ts
type OperationalHomepageProps = { now?: () => Date };
type ManagerSummaryState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void; retrying: boolean }
  | { status: 'ready'; data: DashboardSummaryResponse; refreshing: boolean };
type ManagerShortcut = {
  href: string; label: string; description: string; icon: typeof Icons.product;
};
type ManagerHomeViewProps = {
  displayName: string; tenantName: string;
  today: { dateTime: string; label: string };
  range: DashboardSummaryRange; onRangeChange: (range: DashboardSummaryRange) => void;
  summary: ManagerSummaryState; shortcuts: ManagerShortcut[];
};
```

`OperationalHomepage` defaults `now` to `() => new Date()`. The manager child snapshots it once on mount, so range changes do not move the displayed day; reopening on another Argentina-local day computes a new value. Production callers pass no prop.

The query adapter gives `isError` precedence even if TanStack retains old data after a failed refetch. Thus stale values are not presented as current. `ready` requires successful `data`; `refreshing` may show a non-blocking labeled progress indicator without replacing valid facts. Retry calls exactly `void summaryQuery.refetch()` and is disabled/labeled while fetching.

Because every manager data section comes from one atomic response, there is no honest local partial-success state. On failure, the dominant summary, metric group, priorities, recent activity, top properties, and top sellers each render an unavailable panel wired to the same summary refetch; none renders zero or empty. Shortcuts and truthful identity/date remain visible because they are session/policy data, not summary data. A successful response can independently contain zero counters or empty arrays, and those are true empty results.

## Role and state transitions

| Resolved input | Mounted branch | Manager summary request | Visible state |
| --- | --- | --- | --- |
| Tenant context loading | None | No | Neutral dashboard skeleton. |
| No active tenant or membership | None | No | Existing choose-an-inmobiliaria state. |
| Exact `AGENT` | Existing seller | No | Existing seller heading, products/activity queries and content. |
| Exact `MANAGER` | Manager | Yes | New manager hierarchy for active tenant. |
| Exact `PRINCIPAL_MANAGER` | Manager | Yes | Same hierarchy; shortcuts still policy-derived. |
| Unknown/empty role | None | No | Closed unavailable-role state; no manager facts/actions. |
| Allowed role but session identity absent | None | No | Closed unavailable state; no fabricated greeting. |
| Manager range changes | Manager remount not required | New summary key for selected range | Loading for the new atomic result, then ready/error. |
| Active tenant changes | Dispatcher receives new membership/id | New tenant-scoped summary key | No previous-tenant fallback; new atomic state. |
| Summary retry | Same manager | Refetch current tenant/range key | Retrying label/disabled controls, then ready/error. |

## Data flow and exact display mapping

```text
active tenant id + selected 7d/14d/30d
→ dashboardSummaryOptions
→ /api/dashboard/summary?range=<preset>
→ bffFetch with trusted selected tenant
→ /analytics/dashboard-summary (auth + tenant + ENGAGEMENTS_VIEW_ALL)
→ one atomic DashboardSummaryResponse
→ discriminated ManagerSummaryState
→ all manager data sections
```

| Region | Contract field | Exact rendering |
| --- | --- | --- |
| Dominant summary | `counters.activeProperties`, `counters.movementsInRange`, selected range | Large “Resumen operativo” card stating active **gestiones** and movements in the last N days; no evaluation, score, percentage, trophy, or “today” claim. |
| Metric 1 | `counters.activeProperties` | “Propiedades activas”; helper clarifies active unarchived engagements excluding closed/cancelled, not unique assets. |
| Metric 2 | `counters.movementsInRange` | “Movimientos en los últimos N días”; never visits or progress. |
| Metric 3 | `counters.staleProperties` | “Sin novedades en N días”; active engagements with no movement in the rolling window. |
| Metric 4 | `counters.attentionNeeded` | “Requieren atención”; latest in-window inquiry/completed visit/received offer has no meaningful next step. |
| Priorities | stale + attention counters | Two labeled rows only, each linking to `/dashboard/seguimiento`; no capped-document count presented as a global pending total. |
| Recent activity | `recentActivity` (maximum five) | Real kind, title/observation, property, Argentina-local timestamp, and `/dashboard/product/{engagementId}`. Empty array says no qualifying in-window activity. |
| Top properties | `topProperties` (maximum three) | Real title/address fallback, movement count, permitted document count, latest source text/time, and engagement link; no percentage. |
| Top sellers | `topSellers` (maximum three) | Name/email, manual movement count, distinct touched-engagement count, last movement time, and encoded `/dashboard/seguimiento?sellerId=…`; text initials may decorate but no photo/rating/bar. |
| Shortcuts | session + existing policy | Property list, follow-up, team when `navGroups` policy permits, and create only via `canManagePropertyEngagements`; no invented destinations. |

All list text is treated as display text only. It is never parsed into tasks, alerts, visits, scores, or structured facts.

## Heading, date, and localization ownership

`ManagerHomeView` renders exactly one manager content `h1`: `Hola, {getUserDisplayName(session.user)}`. Tenant name is adjacent context, not substituted for person identity. `SellerOperationalHomepage` keeps `Tu jornada comercial en {tenant}` as its `h1`; missing/unsupported states own their own truthful `h1`.

`formatArgentinaCalendarDate(instant)` is a pure helper using `Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' })`. It returns a human label plus a `YYYY-MM-DD` value assembled from `formatToParts` for `<time dateTime>`. Activity timestamps use the same fixed locale/time-zone constants through a separate pure helper. Tests use UTC instants immediately before and after Buenos Aires midnight; no test changes the machine timezone or relies on today.

## Visual, responsive, and accessibility design

- Preserve reference scan order in DOM: greeting/date → dominant summary/range → four metrics → priorities → recent activity → top properties → top sellers → shortcuts.
- Use the existing shell, `Card`, `Button`, `Badge`, `Icons`, theme border/shadow/radius tokens, and a dark branded hero treatment. Do not add menu, bell badge, bottom navigation, score ring, or mobile-only fixed chrome.
- Semantic tones are consistent and dark-mode paired: green/house for active, blue/activity for movements, amber/clock for stale, destructive/warning for attention. Labels and helper text carry meaning; color/icon is never the only signal and decorative icons are `aria-hidden`.
- Use one column at 320/375 px, two columns where `sm` content remains readable, and four metric columns only at `xl`; ranking cards become two columns only at `xl`. Controls are at least 44 px high on narrow screens.
- Manager lists do not use `line-clamp` or `truncate` on meaningful tenant/property/seller/activity text. Use `min-w-0`, `break-words`, and `break-all` only for email/opaque identifiers. Actions remain labeled on narrow screens.
- Range controls form an accessible named group and retain `aria-pressed`. Sections use one `h1`, ordered `h2` headings, lists for rows, `<time>` for dates, real links for navigation, buttons for retry/range, and visible `focus-visible` styles.
- Critical browser viewports are 320×800, 375×812, 768×900, and 1280×900. Proof checks wrapping, non-overlap, minimum target size, DOM/focus order, and `documentElement.scrollWidth <= innerWidth`.

## Verification and strict-TDD evidence

### Deterministic fixture policy

Component fixtures use fixed session identity, exact role/permission sets, fixed UTC instants, and typed summary factories. Tests must include nonzero success, all-zero success, empty arrays, loading, failure, retrying, manager/principal/agent/unknown roles, create permission on/off, team policy on/off, tenant change, and long strings. Forbidden-copy assertions cover score, rating, visits today, generic alerts, deltas, sent messages, percentages, photos, client/agenda/message/upload/reminder actions, #306 proposals, and #327 platform terms.

The seeded browser test signs in through the real principal-manager flow, calls the real summary endpoint, and first proves at least one authorized seeded identity/item. For wrapping only, it may `route.fetch()` that real response and replace display strings on one existing item with fixed long values while preserving IDs, counts, kinds, and destinations. It must not mutate the database, manufacture counters, intercept auth/permissions, or use network failures; error/retry belongs in component tests. The test remains one serial, read-only manager-home case.

### RED → GREEN → TRIANGULATE → REFACTOR

For every implementation slice:

1. **RED:** add the smallest behavioral assertion first; run the focused command and record the expected assertion failure, not a compile/setup accident.
2. **GREEN:** implement only enough behavior to pass; record the same command succeeding.
3. **TRIANGULATE:** add a contrasting case (manager/principal vs unknown/agent, before vs after Buenos Aires midnight, zero success vs error, permission allowed vs denied, short vs long content) and record success.
4. **REFACTOR:** remove duplication/extract props without behavior changes; rerun focused tests plus the slice regression command.

Record phase, UTC timestamp, branch/commit or working-tree identifier, exact command, exit code, and decisive test output in `apply-progress.md` and the PR evidence section. Local RED commits/evidence may exist, but no failing commit or PR lands on `develop`.

Run from `viewpro-app/`:

```bash
pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx
pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep "manager home reference hierarchy"
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Backend regression is contract-preservation evidence, not a backend TDD cycle:

```bash
pnpm --filter @viewpro/api db:validate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
```

Run API tests only with `DATABASE_URL` visibly pointing to `viewpro_test` or another disposable test database. Record any skipped full seeded/API command and reason; never report it as passed.

## Staged delivery (no size exception)

Every slice includes its tests, ends green, changes at most 400 lines (`additions + deletions`), targets `develop`, and begins from fresh `develop` only after its predecessor merges. This is stacked-to-main sequencing, not child PRs targeting an unmerged branch. Before opening each PR, measure the actual diff once; if a cohesive slice exceeds 400, stop and ask rather than code-golf or claim an exception.

| Order | Independently green work unit | Forecast |
| --- | --- | --- |
| I1 | Exact role dispatcher, fail-closed state, session identity, route heading ownership, pure date seam/tests; old manager body otherwise retained. | 220–340 |
| I2 | Extract manager query container, remove manager products query/preview/fallback, add atomic loading/error/retry/zero-vs-error tests. | 280–390 |
| I3 | Dominant summary, four metric tiles, truthful priorities and range semantics with tests. | 300–390 |
| I4 | Manager recent activity and top-property sections, timestamp/wrapping/link/empty/error tests. | 280–390 |
| I5 | Top-seller section plus policy-derived shortcuts and forbidden-content tests. | 260–380 |
| I6 | Responsive/density polish and one bounded seeded browser proof at four critical widths. | 180–320 |

Each PR states start/end state, predecessor, next slice, protected surfaces, exact evidence, changed-line total, and rollback boundary. Conventional commits describe behavior; tests stay with their behavior.

## Planning-artifact delivery split

The accumulated reference asset, exploration, proposal, delta spec, this design, and tasks cannot honestly fit one 400-line docs PR. Deliver them as exactly four stacked-to-main docs units: P1 is the reference asset plus `exploration.md` (178 text lines plus the binary asset); P2 contains only `proposal.md` (216 lines) and `specs/crm-manager-home/spec.md` (165 lines), totaling 381 text lines, with nothing else added; P3 contains only `design.md` (231 lines); and P4 contains only `tasks.md` (currently 152 lines, comfortably at or below 400). Every unit starts from fresh `develop` only after its predecessor merges, targets `develop`, and runs `git diff --check` plus repository status/diff inspection. No planning PR receives a size exception.

## Rollout, rollback, and observability

Rollout is naturally role-gated by the exact frontend dispatcher and remains server-authorized. No feature flag, data migration, seed migration, cache migration, contract generation, or coordinated backend deploy is required. Deploy only after focused/full frontend checks and bounded seeded proof pass.

Removing the manager products query reduces one request per manager home/range-independent load. Existing TanStack/BFF/API/Sentry behavior remains the operational telemetry source; no new event, logging schema, or analytics contract is introduced. Visible unavailable states and retries improve user diagnosis, while BFF 502/504 and backend guard responses remain unchanged. Monitor manager summary failures, retry success, frontend exceptions, and unexpected authorization responses with existing tooling.

Rollback reverses manager slices in reverse order or reverts the complete manager presentation/state set. I1 can restore the old generic page heading and broad manager component only if the whole feature is rolled back; never leave unknown roles routed to manager data. There is no persisted data to repair. Seller, owner, public, shell, route, and backend behavior must remain intact throughout rollback.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Unknown role or absent identity mounts manager hooks. | Dispatch before mounting `ManagerOperationalHomepage`; assert no dashboard query. |
| A failed/refetching query leaks stale or zero facts. | Discriminated atomic state, error precedence, no `?? 0` before success, no products fallback. |
| Repeated retry panels imply independent requests. | Label each as the same “resumen operativo” source and wire every retry to the one current summary query. |
| Shortcut policy drifts from sidebar. | Resolve current `navGroups` policy and centralized access helper; route lookup failure hides the shortcut. |
| Argentina date differs by host timezone. | Fixed `Intl` locale/timezone and boundary fixtures through injected `now`. |
| Dense reference styling truncates real data. | No manager clamps, semantic labels, critical-width geometry/overflow proof. |
| Browser proof becomes flaky or mutates shared seed. | One read-only serial test; real response first, contract-preserving display-string substitution only for geometry. |
| Review slices grow beyond 400 lines. | Separate state, hierarchy, rankings, shortcuts, and browser proof; measure once and stop on overage. |

## Non-goals and protected surfaces

Do not change backend/API/BFF/contracts/generated clients/database/schema/auth/session payload/tenant selection/public routes. Do not change owner home, `AGENT` seller behavior, shell/sidebar/header/KBar/notifications, product/follow-up/team destination workflows, seller proposals or proposal terms/routes/permissions (#306), platform synchronization/metrics/demand/configuration (#327), or behaviors protected by #306/#327 and the existing #522 boundaries. Do not add score, trophy, rating, visits-today, generic alerts, deltas, message totals, team percentages/photos, invented tasks/people, bottom navigation, or new client/agenda/message/document/reminder actions.
