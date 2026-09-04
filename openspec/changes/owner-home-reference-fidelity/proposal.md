# Proposal: Owner Home Reference Fidelity

## Decision

Redesign only the owner portal home (`/owner`) so its engagement cards reproduce the visual hierarchy of the two preserved reference images wherever the current product has trustworthy, owner-authorized data. The result will give owners a clearer path to recent activity, documents, and their engagement's agency WhatsApp contact while preserving the engagement-scoped behavior delivered by completed change #288 / PR #365.

This proposal implements GitHub issue #521 first in the agreed owner → manager → seller sequence. Manager and seller redesigns remain separate issues #522 and #523; tracker #348 supplies no product scope for this change.

## Problem

The current owner home contains the right core capabilities, but presents them as compact controls and a latest-activity/next-action summary that does not match the approved owner references. Owners therefore have a weaker visual hierarchy than intended for the three principal actions and cannot scan a reference-style recent-activity list without opening the property detail.

A literal copy of the reference content would create a second problem: some example categories, claims, counts, and advisor details do not exist as trustworthy structured owner data. The redesign must improve fidelity without inventing information, obscuring failures, or collapsing multiple agency engagements for the same property.

## Intent and User Value

For an owner reviewing active property work, each visible engagement card should make three tasks immediately recognizable:

1. review that engagement's recent activity;
2. open that engagement's documents;
3. contact that engagement's agency through WhatsApp.

Within the same card, the owner should be able to scan a bounded list of real recent movements and continue to the full engagement-scoped timeline. The experience should feel visually faithful to the supplied references while remaining honest when activity, contact data, or optional structured fields are absent or unavailable.

## Product Invariants

This redesign MUST preserve the canonical `owner-portal-home` contract:

- Render exactly one card for every owner-visible engagement, keyed by stable engagement id and naming that engagement's agency.
- Keep property, agency, stage, progress, activity, next action, documents, and contact data isolated to the card's own engagement; never borrow data from a sibling engagement.
- Preserve deterministic card ordering by each card's latest owner-visible movement descending, no-activity cards last, then stable engagement id ascending for ties.
- Keep every home-to-detail destination scoped with the originating owner-visible engagement id. Existing absent or invalid detail scope continues to use the canonical safe fallback.
- Treat route and query parameters only as presentation scope, never as authorization. Existing owner access, tenant isolation, and API/BFF enforcement remain authoritative.
- Keep the home contact separate from movement contact: “Comunicarme con mi asesor” means the agency WhatsApp contact already authorized for that engagement, not the primary-seller contact attached to an individual movement.
- Preserve existing WhatsApp URL/message behavior and best-effort click tracking for the agency contact, including a truthful unavailable state when no usable agency contact exists.
- Keep document access on the existing engagement-scoped documents destination and preserve its read/upload lifecycle and state behavior.

## Scope

### In Scope

- Recompose each owner engagement card around the reference hierarchy for three numbered actions: “Actividad reciente”, “Documentación”, and “Comunicarme con mi asesor”.
- Give each action a clear icon, title, supporting text, and affordance consistent with the reference while preserving accessible link/button semantics.
- Make the activity and documentation actions open the originating engagement's tracking and documents destinations.
- Make the contact action open the originating engagement's configured agency WhatsApp contact and remain visibly unavailable and non-clickable when that contact is unavailable.
- Add a reference-style “Actividad reciente” area inside every engagement card using a small, explicitly bounded, newest-first set of real owner-visible movements from that engagement only.
- Provide a “Ver toda la actividad” path from each card to that same engagement's full tracking view.
- Present only structured movement facts, including timestamps and supported movement-type labels. Presentation-only icons and color treatments may distinguish known structured movement types without changing their meaning.
- Preserve distinct and honest loading, empty, partial-error, and full-error experiences, including the separate no-activity and no-next-action meanings required by the canonical contract.
- Adapt the reference composition responsively for the existing owner shell and real content lengths without losing its hierarchy, grouping, order, or accessibility.

### Fidelity Boundaries

The repository assets `assets/owner-actions-reference.jpeg` and `assets/owner-activity-reference.jpeg` are the visual baseline for this change; acceptance must not depend on an external or private filesystem path.

“1:1 where supported” means matching the references' recognizable composition and hierarchy: three numbered action tiles, their distinct visual treatments and directional affordances, plus an in-card recent-activity panel with ordered rows, timeline cues, supported category treatments, and a continuation action. Exact sample copy, row content, category names, dates, and counts are not requirements because production content must come from the current owner's authorized data.

The implementation may adapt dimensions, wrapping, stacking, and density for the existing application container, responsive breakpoints, localization, accessibility, empty/error states, and real-world text lengths. Those adaptations must preserve action order and prominence and must not substitute decorative fidelity for truthful semantics.

Reference elements without trustworthy structured data MUST be omitted rather than faked or inferred from free text. This includes unsupported promotion/content/price categories, synthetic document counts or status summaries, inferred advisor identity, invented events, and claims derived from an observation string. Unknown movement types may use their honest existing generic label or omit a category treatment; they must not be relabeled as a reference-only category.

## State Semantics

| State | Required owner-facing outcome |
| --- | --- |
| Initial loading | Show a clear loading treatment; do not present placeholder values as real property, engagement, activity, document, or contact facts. |
| No owner-visible engagements | Keep the existing owner-safe empty meaning rather than rendering sample cards. |
| Full properties or engagements failure | Show a full error state and do not imply that an incomplete engagement set is complete. |
| One engagement's activity fails | Keep the failure local to that engagement card, show an activity error rather than an empty list, and never fill it with another engagement's movements. |
| Engagement has no movements | Show the canonical explicit no-activity state and keep the card ordered with other no-activity engagements according to the canonical rule. |
| Latest movement has no next step | Keep the explicit no-next-action meaning separate from no activity, even if the redesigned hierarchy changes its placement. |
| Agency WhatsApp unavailable | Keep the advisor-contact action visibly unavailable, non-clickable, and free of click tracking. |
| Optional structured fields absent | Omit the unsupported detail or treatment without inferring a replacement from prose. |

## Affected Capabilities and Areas

| Capability or area | Proposed impact |
| --- | --- |
| Canonical `owner-portal-home` capability | Extend the owner-home presentation contract with reference-fidelity actions, bounded in-card recent activity, and truthful state requirements while retaining all existing invariants. |
| Owner home engagement cards | Recompose the visual hierarchy and action affordances for each engagement card. |
| Owner recent-activity consumption | Use a bounded set of existing owner-visible timeline movements per engagement rather than presenting only the latest movement on the home. |
| Owner detail navigation | Preserve existing engagement-scoped tracking and documents destinations; no detail workflow redesign is proposed. |
| Agency WhatsApp contact | Relabel and present the existing per-engagement agency contact according to the reference intent without changing contact resolution or tracking semantics. |
| Frontend verification | Characterize fidelity structure, responsive/accessibility behavior, state semantics, deterministic ordering, and cross-engagement isolation. |

No API, repository, authorization, database, or schema change is expected: the current owner timeline and engagement contact contracts already provide the trustworthy data required for this product slice. If later design proves otherwise, unsupported reference content remains omitted unless separately proposed and authorized.

## Non-Goals

- Redesigning manager or seller dashboards, internal `/dashboard` workflows, navigation, or data models.
- Treating tracker #348 as implementation authority or combining issues #521, #522, and #523 into one change.
- Creating a global, cross-property, or cross-engagement activity feed.
- Collapsing multiple engagements into one property card or selecting a representative agency.
- Changing owner authentication, authorization, invitation/access rules, tenant isolation, API/BFF enforcement, or query-parameter trust boundaries.
- Changing property-detail tab behavior, document request/upload/read lifecycles, notification deep links, or invalid engagement-scope fallback.
- Changing agency WhatsApp formatting, message content, analytics payload, click tracking, or movement-contact primary-seller resolution.
- Adding document counts, document status summaries, advisor profiles, unsupported activity categories, or other new data inferred from free text.
- Reproducing reference sample events or fixed row counts when real data does not support them.
- Introducing backend aggregation or loading the full engagement timeline on the home.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Visual fidelity encourages fabricated sample content | Owners could see misleading activity or advisor information. | Render only structured owner-authorized data and omit unsupported reference blocks or category treatments. |
| Recent rows leak across engagements | An owner could attribute one agency's work to another. | Keep every list and destination keyed to one owner-visible engagement and retain multi-agency isolation coverage. |
| Contact wording is mistaken for movement primary-seller contact | The wrong person or contact policy could be exposed. | Define the home tile as the engagement agency WhatsApp contact and preserve movement contact as a separate detail-timeline capability. |
| Empty and failed activity look identical | Owners could interpret an outage as no agency work. | Preserve explicit local loading/error/empty semantics and full-error handling. |
| Larger per-engagement timeline payload increases home cost | Owners with many engagements may see slower loading. | Keep the home list explicitly small and bounded, preserve query isolation, and avoid full-timeline loading; any aggregation is a separate proposal. |
| Relative date labels vary by timezone or hydration context | “Hoy” or “Ayer” could be wrong or unstable. | Require a deterministic, tested date/time policy in later design before using relative labels; otherwise show an honest stable date/time. |
| Responsive adaptation weakens the approved hierarchy | Mobile users may lose action order, readability, or usable controls. | Preserve action sequence and prominence while testing stacking, wrapping, keyboard access, labels, and real-content overflow. |
| Scope expands into adjacent portals or data features | Delivery and review become harder and the sequence is violated. | Restrict this change to issue #521 and omit data the current owner contracts cannot support. |

## Rollout and Rollback

Roll out as an owner-frontend presentation change after focused automated coverage confirms reference structure, engagement isolation, scoped navigation/contact, truthful states, and bounded activity behavior. No data migration or backend rollout is planned.

If the redesigned home causes usability, fidelity, or performance regressions, revert the owner-home presentation and its bounded recent-activity consumption together, restoring the current compact actions and latest-activity summary. Keep the completed #288 engagement-card behavior, canonical detail scoping, authorization, document workflows, contact behavior, and stored data unchanged. Because this change adds no schema or persistent-data transformation, rollback requires no data repair.

## Success Criteria

- [ ] `/owner` renders exactly one redesigned card for every owner-visible engagement and still identifies the correct agency when one property has multiple engagements.
- [ ] Every card presents the three reference-ordered actions—recent activity, documentation, and advisor contact—with the reference hierarchy adapted accessibly to supported viewport sizes.
- [ ] The activity and documentation actions, plus “Ver toda la actividad”, retain the originating engagement id and open that engagement's tracking or documents destination.
- [ ] “Comunicarme con mi asesor” uses only that engagement's agency WhatsApp contact, preserves existing URL/message and best-effort click-tracking behavior, and is disabled without tracking when unavailable.
- [ ] Each card's recent-activity area renders only a small explicit bound of real, newest-first owner-visible movements belonging to that engagement; it never fetches or displays the full timeline on the home.
- [ ] Known structured movement types may receive faithful icons/chips, while unsupported or unknown types never become invented promotion, content, price, or other reference-only categories.
- [ ] Card ordering remains latest movement descending, no-activity last, and stable engagement id ascending for ties, independent of input or query completion order.
- [ ] Loading, full empty, full error, per-engagement activity error, no activity, no next action, and unavailable contact remain distinguishable and do not display fabricated fallback data.
- [ ] Existing owner authorization, tenant isolation, engagement-scoped detail fallback, document behavior, notification behavior, and movement primary-seller contact behavior remain unchanged.
- [ ] The resulting owner home is recognizably faithful to both stored reference assets in hierarchy, grouping, action order, timeline cues, and continuation affordance while tolerating real content and responsive constraints.

## Evidence and Authority

- Product authority: GitHub issue #521 and the confirmed pre-proposal decisions for this change.
- Canonical behavior: `openspec/specs/owner-portal-home/spec.md`.
- Historical evidence only: `openspec/changes/archive/2026-08-29-owner-home-engagement-cards/` for completed #288 / PR #365 behavior.
- Visual evidence: the two JPEG assets stored under this change's `assets/` directory.
- Exploration evidence: `openspec/changes/owner-home-reference-fidelity/exploration.md`.
