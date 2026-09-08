# Design: Seller Home Reference Fidelity

## Decision and protected boundaries

At the `develop@c90aaefa` / post-#522 baseline, redesign only the exact `AGENT` branch of authenticated `/dashboard` as a frontend-only seller command center. The implementation will preserve the reference asset's scan-first hierarchy, compact rounded surfaces, density, and semantic accents while rendering only facts and destinations already authorized by the current seller contracts.

The authoritative visual reference is `assets/seller-home-reference.jpeg` (740×1600, SHA-256 `68be53e4ae82e74c24b94fc638ccda5e6d6628d0e1e3cef908a9922f4f46d10c`). It is a composition reference, not a data fixture. Sample identity, counts, people, images, tasks, calls, visits, messages, quick actions, performance, badges, and shell chrome are not implementation inputs.

No backend, BFF, API, Prisma, database, schema, generated contract, seed, authentication, authorization, tenant-selection, public-route, navigation-policy, shell, manager, owner, #306 seller-proposal, or #327 platform-data-lane behavior will change. If implementation discovers that a required fact or action is absent from the existing contracts, the element is omitted and the scope returns to proposal review rather than expanding this change.

## Architecture

Split seller query ownership and seller presentation out of `operational-homepage.tsx` without moving or redesigning the post-#522 manager implementation:

```text
/dashboard page + existing shell
  -> OperationalHomepage
       -> tenant/session gate
       -> exact role dispatch
          -> AGENT + usable authenticated identity
             -> SellerOperationalHomepage (seller query container, keyed by membership + tenant)
                -> adapt products query -> SellerProductsState
                -> adapt activity query -> SellerActivityState
                -> SellerHomeView (pure seller presentation)
          -> MANAGER | PRINCIPAL_MANAGER
             -> existing ManagerOperationalHomepage
          -> missing/unknown role or unusable identity
             -> UnsupportedDashboardRoleState
```

`OperationalHomepage` remains the sole role dispatcher. `SellerOperationalHomepage` becomes the sole owner of seller queries and adapters. Seller presenters receive discriminated state props and do not import React Query, session hooks, BFF services, or manager summary types. This prevents presentation code from defaulting unavailable values to zero and prevents the seller branch from requesting manager data.

### Role, identity, and tenant gate

Before mounting a role branch:

1. Keep the existing whole-home skeleton while `isTenantLoading` is true.
2. Keep `MissingInmobiliariaState` when no active membership or tenant exists.
3. Require `activeMembership.tenant.id === activeTenantId`; an inconsistent transition renders the neutral loading state and mounts no seller or manager query.
4. Resolve identity from the authenticated `session.user` through `getUserDisplayName(...).trim()`. The existing helper uses real first/last name and only falls back to the authenticated email. If no nonblank authenticated identity exists, fail closed through `UnsupportedDashboardRoleState` and mount no home query; never insert a sample name, tenant name, or generic person.
5. Dispatch only exact `AGENT` to the seller container and exact `MANAGER`/`PRINCIPAL_MANAGER` to the existing manager home. Every other role fails closed.

Mount the seller container with `key={`${activeMembership.id}:${activeTenantId}`}`. The key is a UI isolation backstop: a membership or tenant transition destroys seller-local observer state before the new tenant heading and queries render together.

## Existing data flow and contracts

```text
activeMembership + activeTenantId + authenticated display identity
       |                                      |
       |                                      +--> greeting / tenant context only
       |
       +--> productsQueryOptions({ archived: 'active', limit: 6, page: 1, tenantId })
       |       key: ['products', 'list', filters including tenantId]
       |       request: GET /api/products?archived=active&limit=6&page=1
       |       BFF: GET /property-engagements with session cookies + selected x-tenant-id
       |       API: AuthGuard -> TenantMembershipGuard -> PermissionGuard -> tenant/assignment WHERE
       |       result owner: assigned total + assigned preview
       |
       +--> activityFeedOptions({ kind: 'all', page: 1, pageSize: 6, tenantId })
               key: ['activity', 'feed', filters including tenantId]
               request: GET /api/activity/feed?page=1&pageSize=6
               BFF: GET /analytics/activity-feed with session cookies + selected x-tenant-id
               API: AuthGuard -> TenantMembershipGuard -> PermissionGuard -> tenant/assignment WHERE
               result owner: three counters + priorities + recent activity
```

The two `useQuery` calls remain independent, enabled only for the resolved active tenant, with `refetchOnReconnect: false` and `refetchOnWindowFocus: false`. Do not add `placeholderData`, `keepPreviousData`, a combined query, a seller-summary endpoint, cross-query fallback, or coordinated retry. `tenantId` remains cache ownership only; it is intentionally not serialized by either frontend service. The selected `x-tenant-id`, session cookies, membership guard, permissions, tenant predicates, and seller-assignment predicates remain the authorization path.

Products continue to request active/unarchived rows only. Their `total` includes seller-assigned unarchived engagements across existing statuses; it is not all inventory, a unique physical-property count, or an additional closed/cancelled exclusion. Activity continues to return one atomic response containing its counters and up to six newest merged permitted movement/document-request rows. The frontend does not recompute any counter from items.

## Discriminated seller state contract

Define the following seller-only contracts in `operational-homepage/seller-home.tsx`:

```ts
type SellerProductsState =
  | { status: 'loading'; tenantId: string }
  | { status: 'error'; tenantId: string; retry: () => void; retrying: boolean }
  | { status: 'ready'; tenantId: string; data: ProductsResponse }
  | { status: 'refreshing'; tenantId: string; data: ProductsResponse }
  | {
      status: 'retained-error';
      tenantId: string;
      data: ProductsResponse;
      retry: () => void;
      retrying: boolean;
    };

type SellerActivityState =
  | { status: 'loading'; tenantId: string }
  | { status: 'error'; tenantId: string; retry: () => void; retrying: boolean }
  | { status: 'ready'; tenantId: string; data: ActivityFeedResponse }
  | { status: 'refreshing'; tenantId: string; data: ActivityFeedResponse }
  | {
      status: 'retained-error';
      tenantId: string;
      data: ActivityFeedResponse;
      retry: () => void;
      retrying: boolean;
    };
```

`toSellerProductsState(query, tenantId)` and `toSellerActivityState(query, tenantId)` are pure adapters over the minimum query snapshot (`data`, `isError`, `isFetching`, `isLoading`, `isSuccess`, `refetch`). They apply this precedence:

| Query condition | Adapter state | Presentation rule |
| --- | --- | --- |
| No data and pending/loading | `loading` | Labeled skeleton; no number or empty claim. |
| No data and error | `error` | Local unavailable copy and product-only or activity-only retry. |
| Valid data and background fetch | `refreshing` | Keep the same-tenant result visible with `Actualizando…`; do not replace it with skeletons. |
| Valid data and refetch error | `retained-error` | Keep last confirmed same-tenant data only with `No se pudo actualizar; mostramos la última información disponible` and relevant retry. |
| Valid successful settled data | `ready` | Render values and distinguish true empty from populated content. |
| Missing success/data invariant or invalid tenant payload | `error` | Fail closed; never normalize to zero or empty. |

A retry is always `() => void query.refetch()` from its own adapter. No retry callback invalidates or refetches the other key. Retry buttons are disabled and renamed while `retrying` is true.

As a defensive response-integrity check, products are renderable only when all returned item `tenantId` values equal the adapter tenant and totals are finite nonnegative numbers. Activity is renderable only when every item `tenantId` equals the adapter tenant, each item keeps `propertyEngagementId === property.engagementId`, and all three counters are finite nonnegative numbers. An empty response is still bound by its tenant-scoped query key and keyed container; it is never borrowed from another key.

### Tenant-transition guarantee

Tenant isolation uses four cooperating safeguards rather than inspecting visible labels:

1. `SessionProvider` keeps `isTenantLoading` true while the selected tenant storage/cookie is being synchronized.
2. role dispatch requires membership/tenant ID agreement before mounting queries;
3. both query keys include `tenantId`, and neither uses previous-key placeholder data; and
4. the membership/tenant keyed seller container remounts on transition.

Therefore a late tenant-A response can populate only tenant A's cache key. It cannot become tenant B's observer result. If a malformed cache/test value nevertheless contains tenant-A rows under tenant B's key, the adapter rejects it. During the transition, the UI shows neutral loading or tenant-B-owned cached/loading/error/success state; it never renders tenant-A identity, totals, counters, rows, or activity under tenant B.

## Presentation contract

### Top-level props

`SellerHomeView` is a pure presenter:

```ts
type SellerHomeViewProps = {
  displayName: string;
  tenantName: string;
  products: SellerProductsState;
  activity: SellerActivityState;
  shortcuts: readonly SellerShortcut[];
};

type SellerShortcut = {
  href: '/dashboard/product' | '/dashboard/seguimiento';
  icon: 'product' | 'trendingUp';
  label: string;
  description: string;
};
```

The two shortcuts are mapped only from the existing `navGroups` entries for `/dashboard/product` and `/dashboard/seguimiento` after a resolved exact-`AGENT` membership. No new route, query parameter, mutation, permission interpretation, or role-only authorization is introduced. Server authorization remains authoritative after navigation.

### DOM and visual order

The DOM order is also the narrow-layout visual and keyboard order:

1. `<header>` greeting: one page `<h1>` `Hola, {displayName}` and adjacent active-tenant text.
2. `<section aria-labelledby="seller-facts-heading">`: visually compact four-card semantic list.
3. `<section aria-labelledby="seller-priorities-heading">`: priority card with exactly two aggregate rows when activity data is available.
4. `<section aria-labelledby="seller-engagements-heading">`: bounded assigned-engagement preview.
5. `<section aria-labelledby="seller-activity-heading">`: bounded recent permitted activity.
6. `<nav aria-labelledby="seller-shortcuts-heading">`: property and follow-up shortcuts, in that order.

The facts use one column at narrow widths, two from `sm`, and four from `xl`. Assigned engagements and activity remain sequential in the DOM and may form two equal `minmax(0, 1fr)` columns at `xl`. Shortcuts use one column narrowly and two from `sm`. Rounded `2xl`/`3xl` cards, compact padding, low-contrast borders, green primary context, and explicit blue/amber/violet/green accents adapt the reference without conveying meaning by color alone.

There is no create button in the greeting, quick-management strip, weekly-performance card, notification badge, profile avatar, duplicate header, mobile bottom navigation, or shell replacement.

## Exact fact ownership and copy

The fact group always reserves exactly four labeled cards in this order. A loading or unavailable owner produces a labeled non-value state, never `0`.

| Order | Visible fact | Owner | Required explanatory meaning |
| ---: | --- | --- | --- |
| 1 | `Mis gestiones asignadas` | products `total` | Unarchived engagements in the active tenant where this seller is assigned; no narrower status claim. |
| 2 | `Movimientos en las últimas 24 horas` | activity `todayCount` | Movements created in rolling `[now − 24h, now)`; excludes document requests and is never called “hoy.” |
| 3 | `Requieren seguimiento` | activity `attentionCount` | Latest movement is inquiry/completed visit/received offer and trimmed next step is blank; not a general alert/task count. |
| 4 | `Sin movimientos en los últimos 7 días` | activity `staleCount` | No movements in rolling `[now − 7d, now)`; document requests do not reset it. |

The facts region renders the visible helper `Ventanas móviles · America/Argentina/Buenos_Aires` so both rolling-window meanings identify their timezone without being mislabeled as calendar-day “today.” Activity item timestamps use the same zone with `es-AR` formatting.

Cards render numeric zero only from their own successful or explicitly retained same-tenant response. Products failure affects only card 1 and the assigned section. Activity failure affects only cards 2–4, priorities, and recent activity. Available content from the other source stays visible.

## Priorities

When activity is `ready`, `refreshing`, or `retained-error`, render one semantic `<ul>` containing exactly two `<li>` aggregate rows in this order:

1. `Requieren seguimiento`, its count, and the narrow latest-movement/blank-next-step explanation.
2. `Sin movimientos en los últimos 7 días`, its count, and the rolling movement-only explanation.

Each row may be a whole-row link to the existing `/dashboard/seguimiento` destination. It is not a checkbox, button, task, reminder, person, due time, completion state, or individual work item. Icons are decorative. Zero counters retain both rows and their meanings. During initial loading there are labeled skeleton rows but no list of facts. During `error`, render only activity-unavailable recovery. During `retained-error`, retained rows are visibly marked as last confirmed and the retry still targets activity only.

## Assigned-engagement preview

Render no more than `PROPERTY_PREVIEW_SIZE` (six) items in API source order; never pad or synthesize rows. Each item may show only:

- a nonblank real property title, otherwise `Propiedad sin título`;
- nonblank address/city/province parts, otherwise `Dirección no informada`;
- the existing engagement status label; and
- a detail link only when `getDashboardEngagementHref(product.id)` succeeds.

Do not show owner identity, seller identity, invented imagery, commercial comparisons, proposal state, or mutation controls. Optional images are deliberately omitted from this compact implementation; this avoids turning reference sample imagery into a visual requirement and does not discard any required fact.

A successful products result with `total === 0` and no rows is the only basis for `Sin propiedades asignadas`. A successful positive total with an unexpectedly empty preview uses neutral `No hay gestiones para mostrar en esta vista` copy rather than claiming no assignments. A blank/malformed ID leaves the truthful row readable but noninteractive.

## Recent activity

Render no more than `SELLER_ACTIVITY_PREVIEW_SIZE` (six) items in the response's newest-first source order. Do not sort client-side or derive counters from these rows.

For movement items, show the structured movement-type label when supported, unchanged nonblank `observation` as prose, optional unchanged nonblank `nextStep` under the explicit prefix `Próximo paso informado`, the property title/address fallback, and a safely formatted time. For document-request items, show the literal kind `Solicitud documental`, unchanged nonblank request title, optional unchanged nonblank description under `Descripción`, the property context, and safely formatted time. Do not show or infer actors, contacts, calls, messages, people, outcomes, visits, prices, photos, tasks, deadlines, or completion from free text.

Use the existing `formatArgentinaActivityTime` (`es-AR`, `America/Argentina/Buenos_Aires`). A valid result renders `<time dateTime={normalizedISOString}>`; a malformed/missing value renders neutral `Fecha no disponible` text and no `<time>`. Use `getDashboardEngagementHref(item.property.engagementId)` for the only row action. Invalid IDs retain readable content with no link.

Only a successful activity result with zero items may say `Sin actividad reciente` and explain that no permitted movements or document requests are available. Activity failure never uses this copy.

## Unavailability, refresh, and accessibility behavior

- Every unavailable panel has `role="alert"`, names its owning group, states that prior data is not being shown as current, and offers a minimum-44px native button.
- Refresh and retained-error notices use visible text plus polite status semantics. Spinner/icon animation is never the only status signal.
- Loading skeletons carry group-specific accessible names and no numeric placeholder text.
- Every link/button has a visible focus ring and a minimum 44×44px target at narrow viewports. Desktop compact row actions may remain 32px only if their whole-row link supplies a 44px target; otherwise retain 44px.
- Decorative icons and accent shapes use `aria-hidden="true"`. Facts remain understandable from labels/helper text without color or icon recognition.
- Headings are one `<h1>` followed by ordered `<h2>` region headings. Lists use `<ul>`/`<ol>` and `<li>` rather than generic clickable containers.
- Use `min-w-0`, `break-words`, and wrapping. Do not line-clamp identity, tenant, title, address, observation, next-step, or document text whose omitted portion would remove meaning. No home region introduces horizontal scrolling.
- At 320px and 375px, all regions stack in DOM order. At 768px the fact/shortcut grids use two columns. At 1280px facts use four columns and the assigned/activity regions may share a row while retaining source order.

## No-fabrication and forbidden-content rules

Presentation may read only the authenticated display identity, active membership tenant name, products response, activity response, and fixed authorized route metadata. Missing values receive neutral “not informed/unavailable” treatment or are omitted. Free text remains prose and is never parsed.

The seller home must contain no direct property creation; proposal entry/count/status/lifecycle; global movement entry; task/checklist/completion; agenda; clients; contacts; calls; messages; WhatsApp; reminders; visits-today aggregate; photo action/sample; price change; generic document action; performance/ranking/percentage/comparison; alert/inbox/badge/notification count; manager summary/range/ranking; owner content; platform health/synchronization/operator/provider content; #306 content; #327 content; or duplicate shell/mobile navigation. Existing property-contextual movement creation remains reachable only after an authorized valid engagement detail navigation and remains governed by current server checks.

## File and symbol ownership

| Path | Ownership and intended change |
| --- | --- |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx` | Keep tenant/session gate, exact role dispatch, and current manager composition. Import the extracted seller container; remove inline seller query/presentation code incrementally. No manager behavior rewrite. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/seller-home.tsx` | New seller-only query container, query snapshot adapters, discriminated states, tenant integrity checks, and `SellerOperationalHomepage`. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/seller-sections.tsx` | New pure greeting, four facts, priorities, unavailable/refresh treatment, final shortcut navigation, and top-level `SellerHomeView`. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/seller-lists.tsx` | New bounded product/activity rows, neutral field fallbacks, structured activity presentation, and validated links/time. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx` | Retain top-level tenant/session/exact-role/no-manager-query regression coverage; avoid adding the full seller state matrix here. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/seller-home.test.tsx` | New query option, adapter transition, independent failure/retry, refresh, retained-error, identity, and tenant-transition tests. |
| `viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/seller-sections.test.tsx` | New pure DOM order, facts/priorities, bounded rows, safe formatting/navigation, long text, accessibility, and forbidden-content tests. |
| `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` | Add one bounded real-seller hierarchy/responsive/keyboard proof; preserve existing serial workflow and authorization scenarios. |

Reuse `PROPERTY_PREVIEW_SIZE`, `SELLER_ACTIVITY_PREVIEW_SIZE`, `getDashboardEngagementHref`, `formatArgentinaActivityTime`, existing status labels, `Card`, `Button`, `Badge`, and `Icons`. Do not change product/activity service or API types, BFF routes, `bff-api.ts`, `session-context.tsx`, `session.ts`, `nav-config.ts`, `navigation-access.ts`, manager files/tests, API files, or shell files.

Existing seller-oriented exports in `lists.tsx`/`primitives.tsx` may become unused after cutover. Their cleanup is not coupled to this capability because those files also carry historical/shared dashboard primitives; remove them only in a separately measured cleanup if lint requires it. Do not refactor manager primitives merely to share seller styling.

## Strict TDD seams

Implementation follows RED → GREEN → TRIANGULATE → REFACTOR for each independently green slice.

1. **Role/identity seam:** prove exact `AGENT`, protected managers, unknown roles, missing session/display identity, membership/tenant mismatch, and absence of manager-summary queries from the seller path.
2. **Products adapter seam:** prove initial loading, populated success, successful zero, local error, product-only retry/retrying, retained refresh, retained refetch failure, malformed totals, cross-tenant rows, and no activity refetch.
3. **Activity adapter seam:** prove the corresponding matrix atomically covers all three counters plus items, activity-only retry, malformed counters, item/engagement mismatch, and no product refetch.
4. **Tenant transition seam:** use a real `QueryClient` test rather than only a `useQuery` mock: resolve tenant A, switch membership/tenant to B before A completes, resolve A, and assert no A identity/value/row appears under B; then resolve B. Also cover same-tenant cached refresh as distinct from cross-tenant retention.
5. **Pure presentation seam:** pass every products/activity state pairing to `SellerHomeView`; assert one query never fills the other's fact, empty copy appears only after success, refresh/retained-error labels remain visible, and successful content survives a sibling failure.
6. **Reference/content seam:** assert the six top-level regions and four facts in exact DOM order, exactly two non-checkable priority rows, exact rolling-window wording, bounded source-order rows, authorized destinations, and complete forbidden-content absence.
7. **Safety seam:** triangulate blank/whitespace fields, long prose, malformed/cross-tenant IDs, malformed timestamps, movement/document discrimination, neutral fallbacks, no free-text inference, and no unsafe href or fabricated `<time>`.
8. **Accessibility/responsive component seam:** assert semantic headings/lists/nav, accessible retry names, disabled retrying state, focus classes, 44px narrow targets, wrapping classes, and breakpoint grid classes. JSDOM does not claim geometry.
9. **Protected regression seam:** run the existing manager-home, navigation, session, products/activity service, and BFF tests without modifying their contracts. API tests are regression evidence only; no destructive API suite is needed for a frontend-only change unless scope changes.

Focused commands from `viewpro-app/`:

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run \
  src/features/dashboard/components/operational-homepage.test.tsx \
  src/features/dashboard/components/operational-homepage/seller-home.test.tsx \
  src/features/dashboard/components/operational-homepage/seller-sections.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec vitest run \
  src/features/dashboard/components/operational-homepage/manager-home.test.tsx
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded --grep 'seller home|assigned seller dashboard'
```

## Seeded browser strategy

Use a real seeded authorized `AGENT` such as `martin.demo@viewpro.local`, establish the selected tenant through the normal sign-in/session path, and require successful real `/api/products` and `/api/activity/feed` responses with at least one authorized seeded row before geometry assertions. Keep the existing seller assignment checks proving returned engagements include that seller and exclude a known unassigned engagement. Do not create, update, assign, archive, or otherwise mutate seed data.

The browser proof asserts:

- personalized authenticated greeting and real active tenant;
- required region, fact, priority-row, product-row, activity-row, and shortcut order;
- exact two priorities and absence of all forbidden modules/actions;
- real seeded detail links and existing property/follow-up destinations;
- keyboard traversal through priority links, valid engagement/activity links, then final shortcuts in displayed order;
- visible focus and minimum target geometry;
- one/two/four fact columns at 320/375, 768, and 1280px as designed;
- wrapped long content and no document-level horizontal overflow.

If real seed strings are too short to exercise geometry, Playwright may intercept successful authenticated responses and substitute display strings only on rows that already exist:

- `/api/auth/me`: first/last display name and the already active membership's tenant display name;
- `/api/products`: existing row title/address text only;
- `/api/activity/feed`: existing observation, next-step, document title/description, and property display text only.

The substitution must preserve response status, row count, total, counters, IDs, tenant IDs, assignment agents, status, kind, structured movement type, timestamps, order, permissions, memberships, and destinations. It may not add a row, change an ID/counter/kind/type/time, fabricate authorization, switch roles, bypass sign-in, mutate seed data, or fulfill a failed/empty real response as success. The test records that each intercepted upstream response succeeded and contained the real row before substitution. Display substitution is geometry evidence only; semantic/authorization assertions use the unchanged real response values. Screenshots may aid review but are never the sole oracle.

## Delivery forecast and planning split

The full frontend and proof are forecast at approximately **1,050–1,450 changed lines**, mostly new seller presenters and deterministic tests. A single PR is therefore high risk against the 400-line review budget. Under `ask-on-risk`, task planning must pause for a delivery decision before implementation; this design proposes slices but does not infer permission to chain or accept `size:exception`.

The initially suggested “reference composition/content” unit is not honestly under 400 once its behavior tests and the inline-component removal are included. Split that planning artifact into summary composition and bounded content/cutover:

| Work unit | Independently green outcome | Forecast |
| --- | --- | ---: |
| 1. Seller state foundation | Add seller query adapters and focused tests; wire independent loading/error/empty/refresh/retained-error/retry and tenant-key isolation into the still-current composition without changing manager contracts. | 300–390 |
| 2. Reference summary composition | Add personalized greeting, exact four owner-bound facts, exact two priority rows, DOM hierarchy start, omissions, and pure tests; incrementally remove corresponding inline JSX. | 300–390 |
| 3. Bounded content and seller cutover | Add seller-only engagement/activity presenters, validated link/time behavior, final shortcuts, complete extraction from `operational-homepage.tsx`, and deterministic content/accessibility tests. | 320–395 |
| 4. Responsive/browser proof | Add real-seed seller hierarchy, authorization, keyboard, geometry, long-display substitution, and critical viewport evidence plus final regression documentation. | 180–280 |

Each unit keeps tests and change-local verification notes with its behavior, leaves the repository green, and can be rolled back without reverting unrelated manager/owner work. If measured changed lines exceed 400, stop after one honest slicing pass and return to the delivery gate; do not compress tests, delete explanatory code, or infer a size exception.

## Rollout, observability, and rollback

Roll out as a frontend presentation change only after all four work units, focused tests, manager regression, typecheck, strict lint, seeded seller proof, reference comparison, and critical viewport checks are green. No migration, feature flag, cache migration, seed operation, backend deployment, or staged data rollout is required. Existing tenant-keyed query keys remain unchanged, so deployment does not invalidate or reinterpret server data.

No new telemetry is justified for a presentation-only slice. Preserve ordinary client/BFF error handling and request IDs; do not log identity, tenant names, property text, activity prose, or IDs from the home. During rollout, monitor existing frontend exception reporting and `/api/products` and `/api/activity/feed` failure/latency signals, and manually verify that a partial outage yields the corresponding local unavailable/retry state rather than zero facts.

Rollback reverts the seller container/presenters, seller dispatch import, and seller-specific tests/browser assertions together to the prior seller branch. Query keys, API contracts, selected-tenant behavior, authorization, manager/owner homes, shell, routes, and stored data remain untouched; no data repair or cache migration is needed. Intermediate work units are independently revertible in reverse order.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A failed query appears as zero/empty | Discriminated adapters prohibit defaults and tests cover every cross-product state pair. |
| One source falsifies the other | Facts declare a single owner; presenters receive both states but never derive across owners. |
| Prior-tenant retained data appears under a new tenant | Session synchronization gate, membership/tenant agreement, tenant query keys, no previous-key placeholders, keyed remount, integrity checks, and a real QueryClient race test. |
| Refetch hides valid data or presents it as current | Explicit `refreshing` and `retained-error` states keep same-tenant data with visible freshness wording. |
| Reference fidelity introduces unsupported domains | Exact adaptation/forbidden lists plus fully populated absence tests; unsupported needs return to proposal. |
| Malformed identifiers create unsafe navigation | Reuse fail-closed `getDashboardEngagementHref`; readable row content is independent of link creation. |
| Malformed time fabricates chronology | Reuse deterministic Buenos Aires formatter; invalid values render no `<time>` and no substitute date. |
| Free text becomes an inferred task/person/outcome | Show it only under literal observation/next-step/description labels; never parse it or choose semantics from it. |
| Dense cards break at narrow widths | Mobile-first source order, `minmax(0,1fr)`, wrapping, 44px targets, keyboard checks, and four browser widths. |
| Seller extraction destabilizes manager #522 code | New seller-only files, incremental inline removal, no manager query/type/presenter edits, and manager regression tests in every cutover. |
| Browser geometry proof fabricates business data | Require successful authorized real rows first and permit display-only substitution under the strict preservation rules above. |
| Scope or review budget expands | Four measured work units, frontend-only file boundary, `ask-on-risk` delivery gate, and no implicit exception. |

## Non-goals

This design does not introduce a seller summary endpoint, calendar-day “today” semantics, additional aggregates, a task model, notifications, proposal integration, global movement creation, property mutation, new navigation, new permissions, a design-system refactor, shell changes, manager/owner changes, public/auth changes, backend tests as implementation work, seed changes, or external research. It also does not clean unrelated legacy dashboard exports unless a focused lint failure requires a separately measured cleanup.
