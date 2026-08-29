# Proposal: Owner Home Engagement Cards

## Intent

The owner home screen renders one card per property and reads its stage, contact, and progress from `engagements[0]`. When a property is worked by more than one agency, the remaining engagements disappear from the screen and the surviving card mixes one agency's identity with another agency's state. Make the engagement — not the property — the rendering unit, and surface each engagement's own latest visible movement and next action.

## Scope

### In Scope
- One card per owner-visible agency/property engagement, keyed by the stable engagement id, naming its agency.
- Per-engagement stage, latest owner-visible movement with its date, and next action, each selected exclusively from that engagement's own timeline.
- Explicit empty states for an engagement with no movements and for an engagement with no next action.
- A deterministic card order specified below and computed from data, never from client render or fetch completion order.
- `Ver más` navigation scoped to the originating engagement, and an owner property detail that honors that scope instead of defaulting to `engagements[0]`.

### Out of Scope
- Owner portal API responses, repositories, and their integration suites. The latest movement and next action are read from the existing owner timeline endpoint.
- Property detail tab behavior, document requests, notifications, and WhatsApp contact semantics beyond the engagement scoping described above.
- Visual redesign of the card beyond the fields this contract adds.

## Approach

Flatten properties and their engagements into one card record per engagement, then read each engagement's most recent owner-visible movement from the existing timeline query. Ordering and view-model construction live in a pure module so the contract is provable without rendering. The home screen consumes that module and renders one card per record.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts` | Create | Pure card construction and deterministic ordering |
| `apps/app-new/src/features/owner/components/owner-home.tsx` | Modify | Render one card per engagement with activity and next action |
| `apps/app-new/src/features/owner/components/owner-property-detail.tsx` | Modify | Honor the engagement scope carried by `Ver más` |
| `apps/app-new/src/features/owner/api/queries.ts` | Modify | Expose the latest-movement query options used by the home screen |

## Compatibility and Rollout

An owner linked to a single agency keeps the current one-card-per-property outcome, because that property has exactly one engagement. Owners linked to multiple agencies gain the previously hidden cards. No API, storage, or contract change is required, so rollout is a frontend deploy with no migration.

## Risks and Rollback

The home screen issues one timeline query per visible engagement. For pilot-sized portfolios this matches the existing per-property engagement fan-out already in place. If measured latency becomes a problem, the latest movement moves into the engagements response as a separate change. Rollback is a revert of this change.
