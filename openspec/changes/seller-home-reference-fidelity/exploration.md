# Exploration — Seller Home Reference Fidelity (#523)

## Result

**Skill resolution:** `paths-injected` (`gentle-ai`, `work-unit-commits`).
**Artifact store:** OpenSpec.
**Research lane:** unselected; repository and stored-asset evidence are sufficient.

Issue #523 should be a **frontend-only, authenticated `AGENT` `/dashboard` home recomposition**. It must preserve the existing exact `AGENT` dispatch, assigned-engagement visibility, server authorization, selected-tenant scope, and seller property-proposal boundary (#306). The current API/BFF responses already support a truthful seller summary; no backend, schema, BFF, public-route, owner, manager, or platform-data-lane work is indicated.

The reference asset was inspected directly at `assets/seller-home-reference.jpeg` (740×1600; supplied SHA-256 `68be53e4ae82e74c24b94fc638ccda5e6d6628d0e1e3cef908a9922f4f46d10c`). It is a mobile seller command center: brand/header chrome, greeting, a create-property action, four KPI cards, a task-priorities queue, quick-management icons, recent-activity timeline, weekly-performance card, quick links, and bottom navigation. Its visual hierarchy, compact cards, rounded surfaces, green primary action, and semantic accent colors are adaptable; its sample facts and unsupported product domains are not.

## Current dispatch, composition, and query ownership

| Boundary | Current behavior and evidence | Preservation requirement |
| --- | --- | --- |
| Authenticated entry | `apps/app-new/src/app/dashboard/page.tsx` renders `OperationalHomepage` inside `PageContainer`; `apps/app-new/src/proxy.ts` proxy-protects `/dashboard` and descendants. | Do not alter public routes or proxy/auth behavior. Client composition is not authorization. |
| Exact role dispatch | `OperationalHomepage` waits for `useActiveTenant()`, shows loading or missing-tenant states, then routes only `membership.role === 'AGENT'` to `SellerOperationalHomepage`; exact `MANAGER`/`PRINCIPAL_MANAGER` go to `ManagerOperationalHomepage`; other/missing identity fails closed through `UnsupportedDashboardRoleState`. | Keep the exact seller branch and prove it never requests manager summary data. Do not change the completed manager implementation. |
| Seller query ownership | `SellerOperationalHomepage` owns two independent TanStack queries: `productsQueryOptions({ archived: 'active', limit: 6, page: 1, tenantId })` and `activityFeedOptions({ kind: 'all', page: 1, pageSize: 6, tenantId })`. Both disable focus/reconnect refetch. | Seller redesign remains within this branch and keeps query keys tenant-scoped. It must explicitly represent each independent query state. |
| Current seller composition | The seller branch renders a tenant-name heading, `Ver mis propiedades` and `Ver seguimiento` links, focus/priority copy, four KPI cards, assigned-property preview, and recent activity. `PropertyPreviewList` and `RecentActivityList` provide links to existing engagement detail pages. | Recompose this content around the reference hierarchy rather than introduce a second shell, global feed, bottom nav, notification badge, or direct-create flow. |

The manager home is already separately implemented in `operational-homepage/manager-home.tsx` and `manager-sections.tsx`; its manager-only summary endpoint, headings, date formatter, state model, and controls are protected scope. The owner portal is separately protected by canonical `owner-portal-home`; it must remain untouched. The reference does not authorize copying either surface's data or UI into the seller home.

## Existing seller data, scope, and temporal semantics

### Products / assigned engagements

`GET /api/products` is a temporary App New BFF adapter (`app/api/products/route.ts`) to `GET /property-engagements`. The BFF forwards session cookies and the selected `x-tenant-id` via `lib/bff-api.ts`; it maps only recognized list filters and does not make `tenantId` a backend query parameter. `TenantMembershipGuard` resolves an active membership for that authenticated user and selected tenant, rejects missing/inactive/suspended/cancelled context, and populates trusted role permissions. `PermissionGuard` and controller require `tenant.view`.

`ListPropertyEngagementsUseCase.execute` requires either `engagements.view_all` or `engagements.view_assigned`; it passes trusted tenant/user/capability values to `PrismaPropertyEngagementsRepository.findMany`. `buildTenantVisibilityWhere` always filters `tenantId`; for a seller (`canViewAll === false`) it also requires `agents.some({ tenantId, agentUserId: currentUser.id })`. Thus the seller product response is a list/count of active, current-tenant engagements to which that seller is assigned, not a universal property total and not necessarily a unique physical-asset count. `archived=active` means `archivedAt: null`; it does not exclude closed/cancelled statuses.

The response has real engagement ID/status, property title/address, agents, optional primary image, and optional commercial fields. It supports a truthful six-row assigned-engagement preview and link to `/dashboard/product/<engagementId>`. It does **not** provide a seller task queue, personal portfolio target, visits schedule, contact list, proposal count, performance percentage, or general alert/badge count.

### Seller activity and counters

`GET /api/activity/feed` (`app/api/activity/feed/route.ts`) proxies to `GET /analytics/activity-feed`. `AnalyticsController.activityFeed` requires authenticated, active tenant membership and at least one of `engagements.view_all` / `engagements.view_assigned`. `ListActivityFeedUseCase` derives `canViewAll` from the trusted tenant context, and the movement repository's `buildActivityEngagementWhere` applies tenant ID, `archivedAt: null`, excludes `CLOSED`/`CANCELLED`, and for sellers requires their assignment. Document-request activity is included only when document permissions permit it; standard `AGENT` permissions include `documents.review_own`, but no `documents.view_all` or `documents.request`.

The seller branch uses `kind=all`, so the response can merge real manual/system movement rows and permitted document-request rows. It is ordered newest first by `createdAt`, then descending ID. Activity supports an honest bounded recent list and actual engagement links, but not fabricated calls, WhatsApp responses, photos, price changes, visits completed, contacts, or task completion.

`ActivityFeedCounters` are returned in the same activity response, but their meanings must remain exact:

| Current field | Derivation | Truthful label / important limit |
| --- | --- | --- |
| `products.total` | Active (unarchived) assigned engagements from the separate products response. | “Mis gestiones asignadas” / “Mis propiedades asignadas”; it is an engagement count. |
| `counters.todayCount` | Count of **movements**, not document requests, created during `[now − 24 hours, now)`, on visible active engagements. | “Movimientos de las últimas 24 horas”, not “hoy”, visits, new consultations, calls, or calendar-day activity. It is a rolling instant window, not Argentina-local midnight-to-now. |
| `counters.staleCount` | Visible active engagements with no movement in `[now − 7 days, now)`. | “Sin movimientos en los últimos 7 días”; document requests do not reset it. It must not become general pending work. |
| `counters.attentionCount` | Visible active engagements whose latest movement (not restricted to a window) is `INQUIRY`, `VISIT_COMPLETED`, or `OFFER_RECEIVED` and whose `nextStep` is null/blank after trimming. | “Requieren seguimiento” only with this narrow explanation. It is not an alert inbox, task count, or count of every missing next step. |
| `items` | At most six newest permitted movement/document-request items requested by the home. | “Actividad reciente” with real kind/title/observation/next-step and existing detail destination. |

`nextStep` is optional stored free text (validated up to 500 chars); it is only reliable as text and blank/nonblank for the defined attention counter. It must never be parsed into a task name, deadline, reminder, person, call, visit, or status. Movement `observation` is free text (up to 2000 chars). Movement types provide structured labels (`GENERAL_UPDATE`, `INQUIRY`, `VISIT_SCHEDULED`, `VISIT_COMPLETED`, `OFFER_RECEIVED`, `DOCUMENTATION_UPDATE`, `STATUS_CHANGE`; lifecycle types cannot be manually created), but they do not prove the reference samples' calls, photos, prices, WhatsApp exchanges, or outcomes. `visitCount`, `interestCount`, and offer amount are optional movement fields, not supported aggregates for the reference metrics.

Seller counters are independently returned only as part of the activity-feed HTTP response. Products and activity are independent home queries; there is no seller-summary aggregate and no successful partial activity response. A product result must not substitute for a failed activity counter/list, or vice versa.

## Existing authorized routes and actions

| Candidate reference action/destination | Repository evidence | Disposition |
| --- | --- | --- |
| Open assigned property | `/dashboard/product` and `/dashboard/product/[productId]`; list/detail authorization uses selected tenant and seller assignment server-side. | Supported existing navigation. |
| View follow-up/activity | `/dashboard/seguimiento`, visible to AGENT through centralized `navGroups`/`useFilteredNavGroups`; activity endpoint retains assigned scope. | Supported existing navigation. |
| Create movement/update | The `Agregar actualización` dialog is available from `PropertyDetailHeader` only after opening a specific assigned engagement. `CreateMovementUseCase` requires `movements.create`, an assigned-or-view-all visibility lookup, trusted tenant context, and rejects unassigned/not-found engagements. | Supported **only as property-contextual navigation** (for example, an assigned-property row may open detail). Do not create a global “registrar gestión rápida” action with no assigned engagement ID. |
| Property creation / reference “Crear propiedad” | Canonical `POST /property-engagements` requires `engagements.create`; AGENT lacks it in `role-permissions.ts`. #306 owns seller proposal entry/lifecycle as a separate domain. | Omit. No direct create, proposal count, proposal CTA, or proposal workflow in this change. |
| Edit/status/images/price | Product mutation/image/status routes require `engagements.create`; sellers do not receive it. Detail hides edit control. | Omit, including quick price/photo actions. |
| Document request/upload | Seller standard permissions do not include `documents.request`; the seller seeded journey proves “Solicitar documento” absent. | Omit generic document action. A real permitted document activity row may still appear in the activity feed. |
| Tasks, agenda/visit scheduling, clients/contacts, calls, messages/WhatsApp, reminders | No corresponding seller-home data/action contract or navigation policy is available. | Omit. |
| Notifications/badges and mobile bottom nav | Notification route exists but home loads no unread count; sidebar/header/KBar are canonical shell/nav. | Omit badge and duplicate mobile shell/navigation. |

Centralized `navGroups` gives AGENT only Inicio, Propiedades, Seguimiento, and Perfil after resolved access; privileged status requests, workspaces, team, and tenant-contact destinations remain absent. This is a rendering policy, not a backend authorization replacement.

## Reference hierarchy adaptation table

| Reference module | Fidelity disposition | Truthful adaptation or reason to omit |
| --- | --- | --- |
| InmoView logo/header/greeting | Adapt | Retain application shell; use only real active tenant and authenticated display identity where available. Do not duplicate mobile header chrome or profile imagery. |
| Bell with “3” badge | Omit | No unread-count query is loaded by the seller home. |
| “Crear propiedad” button | Omit | AGENT has no canonical create permission; #306 remains disjoint. |
| Four top KPI cards | Adapt | Assigned engagement total; rolling-24h movement count; narrow missing-next-step attention count; seven-day no-movement count. Labels must retain the table above's temporal/semantic limits. |
| “Mis prioridades de hoy” task checklist | Truthful adaptation | A non-checkable priority region may link to existing follow-up only using attention/stale aggregate semantics. Do not display individual tasks, completion controls, due times, calls, people, visits, photos, or reminder claims. |
| “Registrar gestión rápida” icon strip | Omit except contextual navigation | No global action exists safely. Movement creation needs an assigned engagement context; phone/WhatsApp/visit/photo/price/observation quick actions are unsupported or unauthorized. |
| Recent-activity timeline | Adapt | Render bounded, newest-first real permitted activity rows with movement/document kind and honest stored text; icon/color may distinguish real structured kinds/types only. Omit reference invented call/photo/WhatsApp/price/visit claims and thumbnails. |
| Weekly performance card (visits, contacts, responses, percent) | Omit | No authorized, structured performance, contacts, response, completed-visit, or percentage aggregate exists. |
| Quick access: properties | Support | Existing `/dashboard/product` navigation. |
| Quick access: clients / agenda | Omit | No current authorized seller routes/actions or data backing these reference domains. |
| Bottom navigation | Omit | Existing sidebar/header/KBar own navigation; adding a mobile shell is outside the home composition. |
| Sample persons, faces, property photos, status chips, counts, alerts | Omit unless direct existing row data | Never invent people, photos, badges, performance, dates, price changes, calls, contacts, responses, or alerts. A real product title/status and activity text may appear only in its own existing data context. |

## State, safety, and resilience risks

The current seller implementation has the same false-success issue that manager work corrected: it derives `items ?? []` and counters/totals `?? 0`, passes only `isLoading` to list components, and sets a shared `hasDataError` sentence. Consequently, a failed products query can look like zero assigned properties; a failed activity query can render zeros and “Sin movimientos recientes”; one failure can coexist with a success while the UI does not identify the failed data group; neither query exposes a retry. The reference redesign must correct this seller-specific behavior without altering the manager branch.

Required later state contract risks and test seams:

1. **Independent query state:** products and activity each need loading, success-with-zero, failure, and relevant `refetch` retry treatment. A partial failure stays local; available data may remain visible but must not imply the failed group is empty or zero. Retained successful data during a background refresh must be identified consistently rather than discarded or misrepresented.
2. **No assignments:** a successful zero-product response is the only basis for the existing explicit “Sin propiedades asignadas” meaning. It must not show sample cards or offer direct property creation.
3. **Activity semantics:** a successful empty activity response is distinct from activity failure. Counter failure prevents all dependent KPI/priority facts from being presented as zero. Product success cannot fill those facts.
4. **Navigation safety:** activity and assigned-product IDs arrive from server data but should still be validated before constructing a detail URL, following the existing `getDashboardEngagementHref` fail-closed pattern. Malformed/blank IDs must remove the interactive link rather than produce unsafe/broken routing. A global movement CTA must not be introduced because it lacks assigned-engagement context.
5. **Long and malformed content:** activity observations (2000), next steps (500), tenant/property names, labels, and optional/null fields require wrapping (`min-w-0`, `break-words` or equivalent), clear fallback labels, semantic accessible names, and no icon-only essential controls. Do not treat stored prose as structured facts.
6. **Time:** show the rolling `24 hours` meaning unless a later design explicitly defines Argentina-local calendar semantics. Existing activity date formatting uses `es-AR` and `America/Argentina/Buenos_Aires` and returns null for malformed ISO input; a seller adaptation should use that seam or a similarly tested formatter. It must not label the raw 24-hour count “hoy”.
7. **Scope and authorization:** selected tenant comes from BFF header/cookie and is verified afresh by `TenantMembershipGuard`; query `tenantId` is query-cache ownership, not authority. Preserve server tenant + assignment predicates and do not trust URL/query context as authorization.

## Likely source and test surfaces

| Path / symbol | Likely later role |
| --- | --- |
| `apps/app-new/src/features/dashboard/components/operational-homepage.tsx` — `OperationalHomepage`, `SellerOperationalHomepage` | Primary seller-only role branch, state composition, reference hierarchy, tenant-scoped queries, and no-manager-query regression. |
| `apps/app-new/src/features/dashboard/components/operational-homepage/lists.tsx` — `PropertyPreviewList`, `RecentActivityList` | Add seller-local explicit error/retry support or extract a seller presentation seam; current signatures cannot distinguish error from empty. |
| `apps/app-new/src/features/dashboard/components/operational-homepage/primitives.tsx`, `states.tsx`, `priority-panel.tsx` | Reuse only small semantic, state, and responsive primitives when they avoid a large component rewrite; manager components remain manager-only. |
| `apps/app-new/src/features/dashboard/components/operational-homepage/helpers.ts` | Reuse/extend safe engagement href and Argentina formatter helpers only where seller behavior needs the same tested semantics. |
| `apps/app-new/src/features/dashboard/components/operational-homepage.test.tsx` | Main deterministic seller component seam: exact AGENT dispatch, query options, all state classes, retries, metric wording, no unsupported actions/content, safe links, and long text. |
| `apps/app-new/src/features/dashboard/components/operational-homepage/manager-home.test.tsx` | Regression evidence only: manager remains isolated and untouched. |
| `apps/app-new/tests/seeded/demo-smoke.spec.ts` | Existing seller assignment/detail authorization proof; a bounded browser addition may establish seller hierarchy, focus order, wrapping, and critical widths only if it fits a separate review slice. |
| `apps/app-new/src/features/products/components/product-form.tsx`, `property-detail-summary.tsx`, `create-property-movement-dialog.tsx` | Protected behavior evidence: seller movement creation is a property-detail action with permission/context, not a home quick action. |
| `apps/app-new/src/app/api/{products,activity/feed}/route.ts`, `lib/bff-api.ts` | Regression evidence for current BFF and selected-tenant forwarding; no expected edit. |
| `apps/api/src/{analytics,property-engagements,movements}/**` | Authorization/scope/semantics evidence only; no expected edit. |

Responsive/accessibility evidence is already seeded in the feature: dashboard cards use mobile-first grids and `min-w-0`; list rows use `break-words`/responsive row controls; manager browser coverage tests 320, 375, 768, and 1280 widths, control geometry, keyboard traversal, and long text. Seller tests currently prove role isolation, assigned data, and empty assigned state, but lack seller failure/retry and reference-hierarchy/viewport coverage. A seller implementation should seed the same evidence rather than claim visual fidelity from screenshot resemblance alone.

## Baseline commands and delivery forecast

No commands were run during this read-only exploration. From `viewpro-app/`, the relevant baseline commands are:

```bash
pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter @viewpro/api db:validate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
```

API tests are destructive and require an explicitly test-only database. No API behavior change is expected, so focused frontend tests are the primary RED/GREEN seam; backend commands remain regression evidence if a later design does not expand scope.

Expected implementation is frontend-only but likely touches the seller composition, a small state/presentation helper or existing list primitives, and substantial component tests. A cohesive initial delivery forecast is **two implementation slices**, each kept at or below the 400 changed-line budget:

1. **Seller state foundation (target 250–380 lines):** strict-TDD tests plus independent products/activity loading, true-empty, failure, partial-failure, retry, no-assignment, and exact-AGENT/query-isolation treatment. This must be independently green.
2. **Reference hierarchy (target 280–400 lines):** strict-TDD tests plus truthful KPI/priority/recent-activity/quick-access visual recomposition, safe contextual navigation, responsive/accessibility/long-text behavior, and forbidden-content assertions. Reuse components rather than mix manager changes.

A separate **browser proof** slice (under 250 lines) is warranted only if concise seeded seller viewport/focus evidence cannot remain within the hierarchy slice. Under the configured `ask-on-risk` strategy, pause for a delivery decision if an honest slice forecast crosses 400 lines; do not compress tests or accept a size exception implicitly.

## Product decisions

### Confirmed

- #523 is only the authenticated seller (`AGENT`) dashboard home; manager/principal-manager, owner, public/auth, #306 property proposals, and #327 platform data lane are protected boundaries.
- The stored asset is the visual baseline, but visual fidelity is always constrained by truthful, authorized, current seller data.
- Assigned engagements, rolling 24-hour movement count, seven-day no-movement count, narrow no-next-step attention count, and permitted activity are real sources with the exact semantics stated above.
- Movement creation requires a current assigned engagement context and server `movements.create`/visibility authorization; a global quick-log action is forbidden.
- Direct seller property creation is forbidden; proposal work remains #306-only.
- Unsupported tasks, agenda, clients, messages, calls, contacts, responses, visits, performance, percentages, reminders, people, photos, price changes, badges, alerts, and mobile shell/navigation must be absent.
- Seller loading, empty, error, partial availability, and retry must be explicit; failures must never become zero/empty success.
- Spanish visible UI may follow existing product conventions; planning evidence remains English.

### Unresolved only for later design, not scope expansion

1. Whether the seller greeting should use authenticated display name (available through `useSession`) or retain tenant-focused wording; either choice must remain truthful and avoid a duplicate page heading.
2. Whether the two supported priority aggregates should be visualized as compact non-checkable cards or a short list; neither can imply individual tasks or deadlines.
3. Whether a concise seeded browser proof is necessary after deterministic component coverage; it should be selected only if it fits its own review budget.

## Recommended proposal boundary

A later proposal should define a seller-home presentation capability limited to the `AGENT` branch of `/dashboard`: reference-faithful hierarchy, exact data labels/temporal semantics, independent query-state/retry rules, existing authorized contextual links, responsive/accessible content, and explicit omissions. It should state frontend-only expectation and forbid changes to BFF/API/Prisma, selected-tenant/auth/authorization, property/proposal workflows, owner/manager surfaces, app shell/navigation, and platform data. Any desire for new seller aggregate data, calendar-day “today”, a global movement action, tasks/agenda/clients/messages, or proposal integration is a separate product decision and OpenSpec change.
