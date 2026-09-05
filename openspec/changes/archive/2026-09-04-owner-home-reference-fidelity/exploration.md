# Exploration: Owner Home Reference Fidelity

## Status and intent

**Issue:** #521
**Scope:** owner portal home only (`/owner`), with 1:1 visual fidelity to the supplied InmoView references using truthful, owner-authorized data. This is a visual redesign of the completed engagement-card home, not a redesign of internal CRM manager/seller dashboards.

The active canonical contract remains `openspec/specs/owner-portal-home/spec.md`. Completed engagement-card work is historical evidence at `openspec/changes/archive/2026-08-29-owner-home-engagement-cards/`; its required stable engagement identity, per-engagement isolation, deterministic ordering, scoped detail links, and separate empty/error meanings remain intact. The completed optional-primary-seller work preserves the distinct movement-contact resolver. Tracker #348 is not represented by a repository artifact in this workspace and supplies no implementation authority here; it is explicitly not reopened or conflated with this owner-home-only change.

## Current journey and boundaries

- Authentication proxy protection covers `/owner` and `/owner/**` in `apps/app-new/src/proxy.ts`; the API remains the authority. A dual-context user chooses `/owner` from `/portal`, while owners without an agency membership are redirected there by `apps/app-new/src/app/portal/page.tsx`.
- `/owner` renders `OwnerHome`; `apps/app-new/src/app/owner/layout.tsx` supplies the owner sidebar, header, KBar, and `max-w-6xl` responsive main container. Owner navigation exposes only “Mis propiedades” through `ownerNavGroups` in `apps/app-new/src/config/nav-config.ts`.
- The home fetches owner-authorized properties, then engagements per property, then one latest-timeline query per visible engagement. It uses `buildOwnerHomeEngagementCards` to produce exactly one card per stable engagement ID, independently populated and deterministically sorted.
- Each current card provides property imagery/status/progress, agency identity, latest activity and next action, an engagement-scoped detail URL, a detail tracking link, a detail documents link, and property-level agency WhatsApp contact. The detail page accepts `?engagement=`, scopes its headline/status/summary/tracking/documents to a valid owner-visible engagement, and safely falls back to its existing default for absent or invalid scope.
- The owner API is auth-guarded and repository queries apply `activeOwnerAccess(userId)` to property, engagement, and movement lookup. The BFF only proxies those owner API responses. This visual change must not weaken those checks or trust route/query parameters as authorization.

## Reference-to-capability map

| Reference element | Existing trustworthy capability | Fidelity disposition |
| --- | --- | --- |
| Three numbered option tiles: “Actividad reciente”, “Documentación”, “Comunicarme con mi asesor” | Card already has tracking/documents links and engagement `contact`; documents and contact are engagement-scoped. | Shape mismatch: replace/recompose the current compact action controls as the reference-style tiles, retaining each card’s scoped destination. Contact must mean that card’s agency WhatsApp, not movement primary seller contact. |
| Activity tile subtitle and arrow | Tracking detail is available at `?engagement=<id>&tab=tracking`. | Implementable with an honest navigation label; no global or cross-engagement activity destination. |
| Documentation tile subtitle and arrow | `OwnerDocumentRequests` is available through the scoped documents tab and has loading, empty, error, read, and upload states. | Implementable as a scoped navigation tile; do not synthesize document counts or statuses on the home without a trustworthy aggregate. |
| Advisor-contact tile subtitle and arrow | `OwnerEngagement.contact` is the tenant/agency WhatsApp contact; current code formats its WhatsApp URL and posts best-effort click tracking. | Implementable as a direct agency-contact tile only when `contact.available`; keep the disabled/unavailable treatment otherwise and retain tracking semantics. |
| “Actividad reciente” panel title and vertical activity list | Owner engagement timeline returns ordered real movements with `createdAt`, `type`, `observation`, status/count fields, and an owner-safe timeline detail. | Shape mismatch: current home requests only one movement and renders two compact boxes. A reference-style in-card list can request a bounded set of real movements per engagement and link to the scoped full timeline. |
| Relative day + time | `createdAt` is trustworthy. | Implementable by deterministic locale/date formatting, with a defined timezone policy; no claim of “Hoy/Ayer” without a tested current-time boundary. |
| Icons, connector, and colored category chips | Some real `Movement.type` values have labels in `owner-movement-labels.ts` (e.g. inquiry, completed/scheduled visit, documentation, general/status update, offer). | Visual mapping may use presentation-only icon/color mapping for known enum values. The sample’s promotion/content/price categories have no matching trustworthy owner movement type/value in the inspected contract, so those labels/icons must be omitted or use the actual generic type label—not inferred from free-text observations. |
| Five sample rows and “Ver toda la actividad” | Timeline endpoint supports pagination and descending order; owner detail’s timeline currently requests 25 and has load/error/empty states. | A bounded recent list (likely five) is feasible; “Ver toda” must navigate to the same card’s scoped tracking tab. It must not combine engagements or masquerade missing/failed data as no activity. |

## Data, state, and performance findings

### Required invariants

1. Every visible card remains keyed by and derived exclusively from one owner-visible engagement; repeated property imagery is acceptable and no property-level aggregation may select a representative agency.
2. Card order remains derived from the card’s own latest movement descending, then stable engagement ID ascending, with no-activity cards last. Increasing timeline page size must preserve the first movement as the ordering source.
3. “No activity”, “no next action”, and “activity could not load” remain distinct. A partial timeline failure may not render an empty activity list or borrow another engagement’s events.
4. The activity list, documentation route, and agency WhatsApp action are all scoped to the same card engagement. The property-level agency contact must not be replaced with the valid-primary-seller movement contact introduced by PR #365-era semantics.
5. All fields shown are returned structured data. Do not create badges, counts, activity categories, document status summaries, advisor identities, or dates from free text.

### Query fan-out and partial failures

`OwnerHome` currently performs `1 + P + E` requests: one properties query, one engagement query per property (`P`), and one page-size-one timeline query per visible engagement (`E`). Changing latest movement to a bounded recent list preserves request count but increases per-engagement payload. A later design must set a small explicit page size, avoid fetching full timelines on home, and keep timeline query keys distinct by their filters.

The current home blocks on any loading properties/engagement/timeline query; any engagement-query error replaces the whole home with a fallback; a timeline error remains local as “No pudimos cargar la actividad de esta gestión.” Cards built during a failed timeline query have no latest movement and therefore sort as no-activity, but their rendered state correctly signals an error. Preserve that error signal and avoid an apparent ordering guarantee based on unavailable timestamps. The reference panel should retain per-card loading/error/empty rendering rather than use partial data from another card.

## Likely future source and test surfaces

| Path | Expected later role |
| --- | --- |
| `apps/app-new/src/features/owner/components/owner-home.tsx` | Primary visual recomposition, responsive tile/list layout, bounded activity rendering, and existing state preservation. |
| `apps/app-new/src/features/owner/api/queries.ts` | Change the home’s explicit latest/recent timeline query shape only if the presentation requires more than one item. |
| `apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts` | Preserve/test card view-model isolation and first-item ordering if recent activity is represented in the model. |
| `apps/app-new/src/features/owner/utils/owner-movement-labels.ts` | Reuse or safely extend only structured movement-type presentation mappings. |
| `apps/app-new/src/features/owner/components/owner-home.test.tsx` | Characterize reference tiles, scoped href/contact, actual recent rows, local error/empty/loading state, and responsive class/semantic expectations. |
| `apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts` | Retain one-card-per-engagement, no leakage, sort/tie, no-activity, malformed-date, and filter characterization. |
| `apps/app-new/src/features/owner/api/queries.test.ts` | Add query-option coverage for the selected bounded home activity page size/order. |
| `apps/app-new/src/features/owner/components/owner-property-detail.tsx` and `.test.tsx` | Likely unchanged but regression coverage is required for scoped `tracking`/`documents` destinations and invalid-scope fallback. |
| `apps/app-new/src/features/owner/components/owner-timeline.tsx` and `.test.tsx` | Likely unchanged; retain full-timeline, contact, empty/error, and scoped movement behavior as the “Ver toda” destination contract. |
| `openspec/specs/owner-portal-home/spec.md` | Canonical contract to update only in a later accepted spec phase if new testable visual/navigation requirements belong there. |

No API/controller/repository/schema change is presently indicated: the existing owner timeline yields the real data needed for a bounded recent list, while agency WhatsApp and document navigation already exist. Do not alter `apps/api/src/owner-portal/**` unless later investigation proves a reference element needs structured data unavailable from the current contract.

## Non-goals

- Internal `/dashboard` manager/seller dashboard redesign, its navigation, or its data model.
- Cross-property or cross-engagement activity aggregation, agency selection changes, or a new global activity feed.
- Faked reference-only promotion/content/price events, inferred advisor identity, document counts, or document summaries.
- Changes to owner authorization, BFF forwarding, tenant isolation, owner invitation/access rules, movement contact’s primary-seller validation, WhatsApp formatting, analytics payload, or click tracking.
- Document upload/read lifecycle changes and property-detail tab behavior beyond preserving the existing scoped destinations.

## Open technical questions for design

1. Which exact bounded row count and mobile overflow behavior are needed for 1:1 fidelity when only desktop references were supplied?
2. What explicit timezone should relative-day/time labels use so SSR/client locale differences do not mislabel “Hoy” or “Ayer”?
3. Should a failed recent-list query leave the card in its current deterministic “unreadable activity” position or surface a neutral order treatment without violating the canonical latest-movement ordering contract?
4. Are only real movement types eligible for reference-like chips, and should an unknown type render its existing text label or no chip?
5. Does “Comunicarme con mi asesor” require a defined unavailable label matching the reference when the engagement agency has no configured WhatsApp number?

## Likely characterization tests and review forecast

Before implementation, add/red tests for: one reference-style option group per engagement; each tracking/documents link retaining that engagement query; agency contact uses only the same engagement’s available tenant contact and best-effort tracking; two agencies on one property cannot mix recent rows; bounded list renders ordered real events and “Ver toda” remains scoped; known type mapping never invents unsupported category labels; no-activity, no-next-action, activity-error, and loading states remain distinguishable; and desktop/mobile layout accessibility for tile labels and activity list.

Expected change is frontend-only but spans the home component, query/view-model utility, and multiple existing unit/component tests. Forecast roughly 250–400 changed lines if kept as a focused recomposition. **Review-size warning:** extracting a new presentational recent-activity/tile component plus tests can exceed the 400-line review budget; split presentation extraction from behavior changes or seek review approval before crossing it.
