# Design: Owner Home Reference Fidelity

## Decision and boundaries

Redesign `/owner` in place around the existing engagement card: exactly three numbered reference-style actions followed by up to five real recent movements. The change is frontend-only and preserves one card per stable engagement, agency identity/isolation, scoped detail behavior, document workflows, owner authorization/tenant isolation, notifications, movement primary-seller contact, WhatsApp URL/message/analytics semantics, and stored data; route/query scope remains presentation, never authorization.

References are `assets/owner-actions-reference.jpeg` and `assets/owner-activity-reference.jpeg`. Match their hierarchy, grouping, treatments, timeline cues, and continuation affordance; adapt dimensions/density for real content and viewports. Never fabricate sample events, counts, advisor identity, document summaries, or categories. No API, BFF, repository, database, schema, authentication, authorization, detail-fallback, notification, document-workflow, movement-contact, shared design-system, manager/seller portal, or global-feed change is allowed.

## Data flow and contracts

```text
properties → engagements per property → timeline per engagement (page 1, size 5, desc)
           → engagement-aligned result index → pure card mapper → deterministic cards
           → optional agency filter → OwnerEngagementSummaryCard
```

- Keep request count `1 + P + E`; increase only each home timeline payload from one to at most five. Never mount `OwnerTimeline` or invoke its 25-row/default detail query on home.
- Export `OWNER_HOME_RECENT_MOVEMENT_LIMIT = 5` from the pure card module and import it into queries; the mapper remains free of React Query/service dependencies. `OWNER_HOME_RECENT_MOVEMENT_FILTERS` is `{ order: 'desc', page: 1, pageSize: 5 }`; `ownerEngagementRecentMovementsOptions` delegates to `ownerEngagementTimelineOptions`.
- The exact home key is `['owner', 'engagements', engagementId, 'timeline', { order: 'desc', page: 1, pageSize: 5 }]`. Because filters are in `ownerKeys.timeline`, it cannot collide with the detail `{ pageSize: 25 }` key or retired home `{ pageSize: 1 }` key.
- Existing service/query serialization, BFF search forwarding, API `createdAt` ordering, and API maximum page size of 50 remain unchanged.
- Replace `latestMovementByEngagementId` with `recentMovementsByEngagementId: Record<string, OwnerMovement[] | null | undefined>` and add `recentMovements: OwnerMovement[]` to `OwnerHomeEngagementCard`.
- `buildRecentMovementsIndex` remains positionally aligned with the engagement array used to create `useQueries`; query completion order cannot reassign results.

### Pure mapper rules

1. Inspect no more than the first five input rows for that engagement as a defensive UI bound.
2. Drop rows whose `propertyEngagementId !== engagement.id`; never repair, reassign, or borrow them.
3. Drop rows with an unparseable `createdAt` because display and ordering require an honest timestamp.
4. Sort valid rows by parsed `createdAt` descending, then stable movement id ascending.
5. Set `recentMovements` to those normalized rows and derive `latestMovement`, `latestMovementAt`, and trimmed `nextAction` only from normalized row zero.
6. Unknown types remain eligible for latest/next-action/order; type support controls presentation only.
7. Sort cards by `latestMovementAt` descending, no-readable-activity cards last, then engagement id ascending. Failed timelines occupy the deterministic no-known-timestamp position but render error, not empty.
8. Apply agency filtering only after global deterministic construction; it changes neither card contents nor retained relative order.

## Component contract

Keep small home-only components in `owner-home.tsx`; do not couple the summary to full-detail `OwnerTimeline` or create a new public component API. Preserve property image/type/status, title/location, agency, stage/progress, and explicit next action. Demote `Abrir propiedad` to a secondary `Ver más` link at `/owner/properties/{propertyId}?engagement={encodedEngagementId}`. Show `Sin próxima acción informada.` whenever row-zero `nextStep` is blank/null, independently of no activity.

### Ordered actions

`OwnerEngagementActionGroup` contains exactly these whole-tile interactive surfaces in DOM and visual order; each has decorative icon/circle and arrow (`aria-hidden`), visible title/supporting copy as its accessible name, and no nested control.

| # | Title and supporting copy | Native behavior |
| ---: | --- | --- |
| 1 | `1. Actividad reciente` — `Seguí las acciones informadas para esta gestión.` | `<Link>` to scoped `&tab=tracking` |
| 2 | `2. Documentación` — `Accedé a los documentos de esta gestión.` | `<Link>` to scoped `&tab=documents` |
| 3 | `3. Comunicarme con mi asesor` — available: `Escribile a tu inmobiliaria por WhatsApp.`; unavailable: `WhatsApp no configurado por la inmobiliaria.` | External `<a>` or native disabled `<button>` |

Contact uses only `buildOwnerPropertyWhatsappHref({ contact: engagement.contact, property })`, never `OwnerMovement.contact`, seller identity, or another card. A usable result keeps `target="_blank"`, `rel="noopener noreferrer"`, and fire-and-forget `trackOwnerWhatsappContactClick(engagement.id).catch(() => undefined)`; an unusable result has honest copy/label, no anchor, handler, or tracking.

### Recent activity

`OwnerRecentActivity` always renders `Actividad reciente` and a same-engagement `Ver toda la actividad` tracking link, including error/empty states. Its body is mutually exclusive: local error `No pudimos cargar la actividad de esta gestión.`; success with no normalized rows `Todavía no hay movimientos registrados.`; or semantic `ol`/`li` rows rendered directly from `card.recentMovements`, with no padding to five.

Each row has decorative timeline icon/connector, deterministic timestamp, unchanged nonblank stored observation (blank is omitted), and `getOwnerMovementTypeLabel(type)` chip. Presentation classification reads only structured `type`:

| Types | Visual kind |
| --- | --- |
| `INQUIRY` | green inquiry/chat |
| `VISIT_SCHEDULED`, `VISIT_COMPLETED` | blue visit/people-clock |
| `DOCUMENTATION_UPDATE` | indigo documentation/file |
| `OFFER_RECEIVED` | amber offer/status |
| `STATUS_CHANGE` | violet status/progress |
| `GENERAL_UPDATE` | slate general/information |
| `ARCHIVED`, `RESTORED`, unknown | neutral |

Unknown types retain the existing generic/raw label and neutral treatment. Never inspect observation/status/count/contact to infer `Promoción`, `Contenido`, price, or any unsupported reference category.

## Date policy

Add home-only `formatOwnerHomeMovementDateTime` in `owner-movement-labels.ts`: locale `es-AR`, timezone `America/Argentina/Buenos_Aires`, numeric `DD/MM/YYYY`, `HH:mm`, `hourCycle: 'h23'`, combined exactly as `DD/MM/YYYY · HH:mm`. Use `Intl.DateTimeFormat(...).formatToParts()` and fixed separators; do not use runtime punctuation, relative labels (`Hoy`/`Ayer`), current-clock logic, or client-only effects. Explicit timezone makes SSR/hydration deterministic. Invalid dates are removed by the mapper. Leave WhatsApp `formatOwnerMovementDate` and detail `formatOwnerMovementShortDate` unchanged.

## State, responsive, and accessibility contract

| State | Result |
| --- | --- |
| Properties/engagements/any initial timeline loading | Existing whole-home skeleton; no placeholder facts |
| Properties failure / any engagement failure | Existing full error; never imply an incomplete set is complete |
| No owner-visible cards | Existing owner-safe empty state; no samples |
| One timeline failure | Keep all cards; affected card shows local error before empty checks |
| Success with zero valid rows | Explicit no activity; card ordered last by engagement id |
| Rows but blank/null row-zero next step | Activity plus separate no-next-action message |
| Unusable agency contact | Legible disabled native button, non-clickable and untracked |

- Within the shell's `max-w-6xl`/responsive padding, stack actions in one source-ordered column below `md`; use three equal `minmax(0, 1fr)` columns from `md`.
- Keep media/identity stacked when narrow. Timeline uses icon plus `minmax(0, 1fr)` content; chip is below content when narrow and may move trailing only when space permits.
- Use `min-w-0`, `break-words`, and wrapping for property/agency names, support copy, observations, and unknown labels; do not line-clamp meaningful content or introduce horizontal scrolling.
- All tiles, `Ver más`, and `Ver toda la actividad` have at least 44px activation height. Available controls retain native keyboard behavior and repository focus-visible rings.
- Keyboard/DOM order is detail, activity, documents, available contact, continuation. Decorations/connectors are hidden from assistive technology; ordered-list semantics expose sequence.
- Manually/browser-check 320px, 375px, the `md` transition, and full `max-w-6xl` with long property, agency, observation, and unknown-type strings. JSDOM semantics/classes supplement but do not replace geometry/overflow checks.

## Exact files

| Production path | Change |
| --- | --- |
| `viewpro-app/apps/app-new/src/features/owner/api/queries.ts` | Five-row helper/filter and shared limit; retire latest helper. |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts` | Limit, recent array view-model, mismatch/date filtering, deterministic normalization/order. |
| `viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.ts` | Structured classifier and deterministic home formatter only. |
| `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx` | Recent query/index, three actions, secondary detail, recent panel/rows, states; preserve current contracts. |
| `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` | Adapt `openOwnerPropertyDetail` for `Ver más`; add stable action/activity/navigation/contact checks. |

No changes to `api/service.ts`, `api/types.ts`, `utils/owner-whatsapp-contact.ts`, `components/owner-property-detail.tsx`, `components/owner-timeline.tsx`, App New owner BFF routes, or API owner-portal files.

## Strict-TDD seams and tests

Every seam runs RED → GREEN → TRIANGULATE → REFACTOR with focused evidence:

1. `viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts`: exact five-row key/queryFn call and distinction from detail 25-row key.
2. `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts`: bound, descending/equal-time order, row-zero derivation, malformed/mismatched rejection, unknown eligibility, multi-agency isolation, no-activity-last, input/completion independence.
3. `viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.test.ts`: all supported kinds, unknown neutral/raw label, exact Buenos Aires output including UTC previous-day crossing; preserve WhatsApp tests.
4. `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`: exactly three ordered semantic tiles, copy/icons/affordances, 44px targets, scoped tracking/documents/detail/continuation, available and disabled agency contact, best-effort/no tracking.
5. Slice 3A component core: bounded ordered real rows, timestamps/types, neutral/raw unknown labels without free-text inference, semantic list, and scoped continuation.
6. Slice 3B component TRIANGULATE: full/local states, no-activity versus no-next-action, all-invalid rows, sibling isolation, deliberate long-copy fixtures, source order, and breakpoint classes.
7. Regression paths unchanged: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`, `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`, `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`, `viewpro-app/apps/app-new/src/features/owner/api/service.test.ts`, `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/timeline/route.test.ts`.
8. Slice 3B seeded smoke: three tiles, real recent row, scoped `Ver más`/activity navigation, WhatsApp href/intercepted tracking, keyboard reachability, no overflow, deliberate long-string viewport checks, and comparison with both stored references; screenshots are not the sole oracle.

Run from `viewpro-app/`:

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/utils/owner-movement-labels.test.ts src/features/owner/components/owner-home.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/components/owner-property-detail.test.tsx src/features/owner/components/owner-timeline.test.tsx src/features/owner/utils/owner-whatsapp-contact.test.ts src/features/owner/api/service.test.ts 'src/app/api/owner/engagements/[id]/timeline/route.test.ts'
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded -- --grep 'owner'
```

## Sequential slices and review forecast

Use six sequential, under-400 PRs—P1 → P2 → Slice 1 → Slice 2 → Slice 3A → Slice 3B—each branched from fresh `develop` after its predecessor; the maintainer approved the audited reset and split.

| Slice | Boundary and estimate | Rollback |
| --- | --- | --- |
| 1. Bounded data | Query/helper tests + mapper/tests; home consumes arrays while retaining compact UI. **180–260** lines. | Revert its six Slice 1 files together—query, query test, mapper, mapper test, home adapter, and home fixture test—to restore page-size-one behavior, no migration/repair. |
| 2. Action hierarchy | Three tiles, scoped `Ver más`, contact semantics, responsive actions, component/seeded selectors. **180–280** lines. | Revert its presentation/test files together; retain Slice 1 bounded data. |
| 3A. Recent-activity RED/GREEN core | Panel, date/type helpers, bounded semantic rows, neutral unknown/raw presentation, and scoped continuation. **395 changed lines against `b3304e76` (under 400).** | Revert its four static presentation/helper/test files; retain Slice 2. |
| 3B. Static/browser triangulation | Whole-home/local states, deliberate long-text/responsive component proof, seeded/browser assertions, and final gate. **Under 400** lines. | Revert only Slice 3B component/seeded assertions; retain 3A core. |

Slice 1 is limited to `api/queries.ts`, `api/queries.test.ts`, `components/owner-home.tsx`, `components/owner-home.test.tsx`, `utils/owner-home-engagement-cards.ts`, and `utils/owner-home-engagement-cards.test.ts` under `viewpro-app/apps/app-new/src/features/owner/`.
Slice 2 is limited to `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`, its `.test.tsx`, and `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`.
Slice 3A is limited to `owner-home.tsx`, its test, `owner-movement-labels.ts`, and its test. Slice 3B owns the deferred state/long-text/responsive assertions in `owner-home.test.tsx`, `demo-smoke.spec.ts`, and final verification; it retains all seeded/browser work.

## Rollout, rollback, risks

Deploy as one frontend capability only after focused/regression tests, typecheck, strict lint, seeded owner smoke, reference comparison, and all viewport checks pass. No migration, feature flag, cache migration, backend ordering, or new telemetry is needed; monitor ordinary timeline failures/latency without identifiers, observations, phone values, or message text.

Full rollback reverts the query helper, mapper contract, presentation, and tests together, restoring the one-row compact home while retaining #288 card identity/order/scoping, authorization, document/contact behavior, API data, and stored state. Filtered query keys prevent five-row cache data from matching the restored one-row key; no data repair is required.

| Risk | Control |
| --- | --- |
| Fan-out payload/latency | Keep `1 + P + E`, page size/render bound five, and never mount 25-row detail timeline. |
| Cross-engagement leakage | Align query/index by engagement id and reject mismatched rows again in the pure mapper. |
| Wrong row drives order/next action | Derive all latest semantics only from normalized row zero and test permutations/ties. |
| Failure appears empty | Preserve per-engagement error ids and branch error before empty. |
| Date/hydration drift | Absolute Buenos Aires `h23` output assembled with `formatToParts`. |
| Invented category/advisor | Classify only structured type; neutral unknown/raw labels; use only `engagement.contact`; never infer from prose. |
| Fourth primary action | Keep `Ver más` secondary and exactly three actions in the group. |
| Narrow-content/accessibility regression | Wrap meaningful text, 44px targets, semantic controls/list, focus rings, keyboard and four viewport checks. |
| Scope/review expansion | Use the three slices; do not refactor detail, API, BFF, auth, documents, contact contracts, or design system. |

Rejected: reusing 25-row `OwnerTimeline`, adding backend aggregation, relative `Hoy`/`Ayer`, free-text category inference, or collapsing engagements into a combined property feed; each violates the bounded, deterministic, frontend-only, truthful, engagement-isolated contract.
