# Design — Stage 23.5 Owner Contact CTA Semantics and Priority Proof

## Status

Draft — 2026-06-17. Companion to:

- Proposal: `openspec/changes/23-5-owner-contact-cta-semantics/proposal.md`
- Spec: `openspec/changes/23-5-owner-contact-cta-semantics/spec.md`

## Scope recap

Replace the buggy `createdBy.whatsappPhone` resolution in `mapOwnerMovement` with assigned-seller
resolution using a deterministic priority rule (earliest `assignedAt`, then `agentUserId` ascending),
rename the analytics `targetType` enum from `'movement_author'` to `'assigned_seller'` end-to-end,
extend the Prisma includes to carry the seller phone alongside the movement, seed a reproducible
demo case, and prove the rule with unit + integration + seeded smoke coverage. No schema migration.
23.4 (E2E + click tracking edge guards) stays out of scope.

---

## Decisions

### D1 — Resolver helper placement: extend `owner-whatsapp-contact.ts`

**Chosen.** Add a single new exported function in
`viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` that receives the engagement's
agents array (already typed as part of `OwnerEngagementRecord`) and returns
`OwnerMovementContactResponse`. The picker logic (tie-break, validation, fallback) lives next to
the existing `mapTenantWhatsappContact` / unavailable fallback helpers and shares
`MIN_WHATSAPP_DIGITS` (`owner-whatsapp-contact.ts:1`).

**Rejected — repository-side picker (option b).** Putting tie-break logic into
`prisma-owner-portal.repository.ts:20-27` would split the contact contract across two files. The
repository already exposes shaped records via `Prisma.PropertyEngagementGetPayload` and the mapper
layer is the natural home for response synthesis (mirrors `mapTenantWhatsappContact` at
`owner-whatsapp-contact.ts:17`).

**Rejected — new `owner-portal/resolvers/` folder (option c).** A single helper does not justify a
new directory; the existing `owner-whatsapp-contact.ts` already groups every WhatsApp contact
mapper.

### D2 — Function rename: rename to `mapAssignedSellerWhatsappContact`

**Chosen.** The semantic shift (input is no longer the author's phone but the engagement's agents)
makes keeping the old name misleading. Renaming is honest, the blast radius is small (only
`owner-movement.response.ts:2,25` imports it today, plus three test files), and `rg movement_author`
already returns a finite set of 18 occurrences to be updated in the same PR (see Pre-implementation
audit below).

**Rejected — keep `mapMovementAuthorWhatsappContact` and change only `targetType` literal
(option a).** Cheaper diff but leaves the function name lying about its behavior, which is exactly
the failure mode 23.5 is fixing. Future readers would assume the input is still the author.

### D3 — Prisma include shape: extend `ownerMovementInclude` AND `ownerEngagementInclude`

**Chosen.** Both includes must learn the seller phone:

- `ownerMovementInclude` (`prisma-owner-portal.repository.ts:25`) gets a new
  `propertyEngagement: { select: { agents: { select: { agentUserId, assignedAt, agentUser: { select: { whatsappPhone } } }, orderBy: [{ assignedAt: 'asc' }, { agentUserId: 'asc' }] } } }`
  branch. This guarantees the resolver receives the agents directly attached to each `Movement`
  row, without changing the existing controller-level fan-out at
  `prisma-owner-portal.repository.ts:88-97`.
- `ownerEngagementInclude` (`prisma-owner-portal.repository.ts:20`) gets `whatsappPhone` added to
  the existing `agents.agentUser.select` so the resolver can reuse the same shape for the
  engagement-header view if `mapOwnerEngagement` ever needs the same logic. No behavioral change
  for current consumers — adding a column to a select cannot break existing readers.

**Rejected — pass the engagement's agents to `mapOwnerMovement` separately (option b).**
`mapOwnerMovement` is invoked in a loop over `items` at the response layer. Passing engagement
agents as a separate argument forces every caller to thread the engagement through, which adds
parameters to `OwnerMovementResponse` and breaks the current one-input ergonomic
(`owner-movement.response.ts:6`). It also doubles the read surface for unit tests.

**Rejected — per-movement lazy loader (option c).** Overkill. The included shape is bounded by the
engagement (typically 1–3 agents) so the join is cheap and the resolver stays synchronous.

### D4 — Multi-seller tie-break: SQL-side `orderBy` (Prisma) is canonical

**Chosen.** Both the include for movement-level agents and the include for engagement-level agents
declare
`orderBy: [{ assignedAt: 'asc' }, { agentUserId: 'asc' }]`. Prisma's `PropertyAgent` model
(`schema.prisma:450-467`) supports both fields directly, so the multi-key sort is a native
`ORDER BY` clause with no additional index pressure. The resolver then picks `agents[0]`. This
guarantees that even if a caller iterates the array without re-sorting, the first element is
already the winner.

**JS-side sort rejected.** It works but doubles the cost (sort in SQL + re-sort in JS) and forces
the unit tests to assert on the resolver's sort rather than on the SQL contract. Keeping the
contract in the include is also documentation: the next reader sees the priority rule by reading
the repository.

### D5 — Analytics rename: forward-only; no backfill

**Chosen.** `MOVEMENT_WHATSAPP_CONTACT_METADATA` at
`track-owner-movement-whatsapp-contact-click.use-case.ts:6-9` flips to
`targetType: 'assigned_seller'`. New events from the apply-progress cut-over onward write the new
literal. Past persisted events keep `'movement_author'`. Both literals may coexist in the analytics
store. Apply-progress documents the cut-over so any future external dashboard knows to read both
values for historical reporting.

No backfill migration is part of 23.5. The proposal explicitly out-of-scopes it (proposal §Out of
scope) and no external dashboard is known to consume the enum today.

### D6 — Seed phone choice and collision check

**Chosen.** Add `whatsappPhone: '+5493512222222'` to `sofia.demo` in
`seed-demo.mjs:80-97`. Verified uniqueness against:

- `martin.demo`: `+5493511111111` (`seed-demo.mjs:90`).
- demo tenant: `DEMO_TENANT_WHATSAPP_PHONE = '+5493510000000'` (`seed-demo.mjs:54-55`).
- `lucia.demo`, `demo`, `propietario.demo`: no phone today (verified by grep at
  `seed-demo.mjs:72-104`).
- `User.upsert` at `seed-demo.mjs:898-919` writes the value verbatim; no transformation.

**Row count impact: none.** Adding a field to an existing `DEMO_USERS` entry does not change the
number of `User` rows upserted, the number of tenant memberships, or any downstream count
(properties, engagements, movements). The seed's log summary line (counts in console output near
the end of `seedDemoEnvironment`) is unaffected. Verified by scanning `seed-demo.mjs` for any
log line referencing user count — none exists today; only counts for properties / engagements /
documents are logged.

### D7 — Frontend test fixture rename strategy: atomic sweep

**Chosen.** The tasks phase MUST run `rg movement_author viewpro-app/` once before any code change
and produce a checklist of the 18 occurrences (listed in Pre-implementation audit below). All 18
must change in the same PR. The rename for the union literal type lives in
`features/owner/api/types.ts:49`; every fixture and assertion is downstream of that type, so
TypeScript will fail-fast on any missed call site (the literal type narrows the assertion shape).

This is the same fail-fast safety net 20.11 used after the audit shift.

### D8 — Seeded smoke for FR-10 / S-10: visible button + href only

**Chosen.** Add ONE new test block to `tests/seeded/demo-smoke.spec.ts` under the Owner workflow
section (audit row T19a / T19b region around `demo-smoke.spec.ts:8`). The test:

1. Signs in as `propietario.demo@viewpro.local`.
2. Navigates to the engagement timeline for the seeded owner-visible property
   (`OWNER_VISIBLE_PROPERTY_TITLE` at `demo-smoke.spec.ts:36`).
3. Finds at least one movement card where the contact CTA does NOT show `Contacto no configurado`.
4. Asserts that CTA's `href` matches `^https:\/\/wa\.me\/\d{8,}\?text=` and contains the
   digits `5493512222222`.

**Click tracking deferred.** The proposal locks 23.4 as the slice that owns click-tracking edge
guards. 23.5's smoke does not click the button or assert analytics payloads. This boundary keeps
23.5 reviewable in a single PR.

### D9 — Unit vs integration test seeding strategy

**Chosen.**

- **Backend unit tests** (`test/owner-portal.use-cases.spec.ts`, `test/owner-portal.repository.spec.ts`):
  synthetic fixtures only — plain TypeScript objects shaped like
  `OwnerEngagementRecord` and `OwnerMovementRecord`. No Prisma client touched. The five new
  scenarios (S-1 through S-6) are unit-level.
- **Backend integration test** (`test/owner-portal.e2e-spec.ts`): one new end-to-end scenario that
  hits the Postgres test database via the existing `registerTenantSession` helper and asserts the
  full timeline response shape after a real query. Re-use the same helper used by the existing
  movement_author assertion at `owner-portal.e2e-spec.ts:388,473` — just update the literal and
  add a second fixture engagement with a multi-seller setup if the existing fixture does not
  already cover it.

No new test helper or DB setup file is introduced.

### D10 — Workload forecast: single-PR, under budget

**Estimated changed lines** (production + tests + seed + smoke + docs):

| Surface | LOC |
|--------|----|
| `owner-whatsapp-contact.ts` (new resolver + rename + tests-of-record) | ~50 |
| `prisma-owner-portal.repository.ts` (include extensions) | ~25 |
| `owner-portal.repository.ts` (type alias updates for new include shape) | ~15 |
| `owner-movement.response.ts` (rewire + import rename) | ~10 |
| `track-owner-movement-whatsapp-contact-click.use-case.ts` (literal rename) | ~3 |
| Backend tests (`use-cases.spec.ts`, `repository.spec.ts`, `e2e-spec.ts`) | ~80 |
| Frontend type + fixture renames (4 files) | ~10 |
| Seed (`seed-demo.mjs`) | ~1 |
| Seeded smoke (`demo-smoke.spec.ts`) | ~40 |
| OpenSpec design + spec + tasks + apply-progress | already accounted in 23.5 folder |
| **Total** | **~234** |

`single_pr_recommended: true`, `size_exception_required: false`. Budget head-room of ~166 LOC.

---

## Component architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Postgres (PropertyEngagement, PropertyAgent.assignedAt, agentUser.whatsappPhone) │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ Prisma include
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ prisma-owner-portal.repository.ts                                            │
│   ownerMovementInclude.propertyEngagement.agents [orderBy assignedAt,        │
│                                                   agentUserId]               │
│   ownerEngagementInclude.agents.agentUser.whatsappPhone                      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ OwnerMovementRecord (extended type)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ owner-movement.response.ts → mapOwnerMovement                                │
│   contact = mapAssignedSellerWhatsappContact(movement.propertyEngagement     │
│                                                    .agents)                  │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ OwnerMovementResponse.contact
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ owner-whatsapp-contact.ts → mapAssignedSellerWhatsappContact                 │
│   1. if agents.length === 0  → unavailableAssignedSellerContact()           │
│   2. winner = agents[0]  (already SQL-sorted)                                │
│   3. phone = winner.agentUser.whatsappPhone                                  │
│   4. validate digits ≥ MIN_WHATSAPP_DIGITS                                   │
│   5. return { available: true, targetType: 'assigned_seller', … }            │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ HTTP JSON (NestJS controller)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Next.js BFF → features/owner/api/service.ts                                  │
│   typed as OwnerMovementContact { targetType: 'assigned_seller' }            │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ React Query
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ features/owner/components/owner-timeline.tsx                                 │
│   renders WhatsApp CTA from contact.whatsappPhone (existing behavior)        │
└──────────────────────────────────────────────────────────────────────────────┘

Tracking:
  user click → BFF → NestJS use case (track-owner-movement-whatsapp-contact-click)
              → analyticsService.track({ metadata: { targetType: 'assigned_seller' } })
```

---

## Resolver function signature and behavior

Function lives in `owner-whatsapp-contact.ts` and is exported alongside the existing
`mapTenantWhatsappContact`.

```text
Signature (pseudocode):
  mapAssignedSellerWhatsappContact(
    agents: Array<{
      agentUserId: string
      assignedAt: Date
      agentUser: { whatsappPhone: string | null }
    }>
  ): OwnerMovementContactResponse

Behavior:
  if agents is null or empty:
    return unavailableAssignedSellerContact()

  // SQL-side orderBy already enforces [assignedAt asc, agentUserId asc].
  // We do NOT re-sort defensively — the include shape is the contract.
  winner = agents[0]
  phone  = winner.agentUser.whatsappPhone

  if phone is null:
    return unavailableAssignedSellerContact()

  digits = phone.replace(/\D/g, '')
  if digits.length < MIN_WHATSAPP_DIGITS:
    return unavailableAssignedSellerContact()

  return {
    available: true,
    targetType: 'assigned_seller',
    displayLabel: 'Consultar responsable',
    whatsappPhone: phone,
  }

unavailableAssignedSellerContact():
  return {
    available: false,
    targetType: 'assigned_seller',
    displayLabel: 'Contacto no configurado',
  }
```

Empty-array handling: covered by S-5. Null `whatsappPhone` on winner: covered by S-2 / S-4 variant.
Sub-threshold digits: covered by S-6 (the FR-4 + FR-11 boundary).

---

## Pre-implementation audit (R-D3 from 20.11 / 20.9)

The tasks phase MUST run these commands BEFORE any code mutation and paste the output into the
apply-progress audit section:

```text
1) rg 'movement_author' viewpro-app/
   Expected: 18 occurrences across 9 files (file:line confirmed in this design):
     viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts:12,53,70
     viewpro-app/apps/api/src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts:8
     viewpro-app/apps/api/test/owner-portal.repository.spec.ts:350
     viewpro-app/apps/api/test/owner-portal.e2e-spec.ts:388,473
     viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts:284,327,377,498
     viewpro-app/apps/app-new/src/features/owner/api/types.ts:49
     viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx:61,126
     viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx:134
     viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts:19,115,127
   All 18 must change in the same PR. Any deviation in count blocks apply.

2) rg "createdBy\.whatsappPhone" viewpro-app/apps/api/src/
   Expected: 1 occurrence at owner-movement.response.ts:25.
   After apply: 0 occurrences.

3) rg "ownerMovementInclude" viewpro-app/apps/api/src/
   Expected: 3 occurrences (declaration + 1 usage in prisma-owner-portal.repository.ts).
   Confirms single source for the include.

4) rg "agents.*include|agents.*select" viewpro-app/apps/api/src/owner-portal/
   Expected: only the existing ownerEngagementInclude declaration matches.
   Confirms no other consumer of the agents shape is silently perturbed.

5) rg "DEMO_TENANT_WHATSAPP_PHONE|whatsappPhone" viewpro-app/apps/api/scripts/seed-demo.mjs
   Expected: 4 occurrences — martin.demo at :90, two writes inside upsert at :905,:914,
   tenant at :54,:55,:935. After apply: 5 occurrences (sofia.demo gains :81-or-similar).
```

If any command returns an unexpected count, apply STOPS and the discrepancy is reported back to
the design phase.

---

## Risks

- **R1 — Rename completeness.** If even one of the 18 `'movement_author'` literals is missed, the
  TypeScript union type at `features/owner/api/types.ts:49` narrows to `'assigned_seller'` and any
  remaining fixture asserting `'movement_author'` fails compile. Backend mirror: the
  `OwnerMovementContactResponse` literal type narrows the same way. Mitigation: tasks phase runs
  audit #1 and lists every occurrence; CI fails fast on type errors.
- **R2 — Tie-break determinism in production data.** The Prisma `orderBy` uses two keys
  (`assignedAt asc`, `agentUserId asc`). Postgres orders strings lexicographically by collation
  default; UUIDs compared as text sort lexicographically, which matches the spec at FR-2.
  Mitigation: S-4 covers the tie-break with two UUIDs (`'user-aaa' < 'user-bbb'`); the unit test
  asserts the SQL-sorted order is honored end-to-end.
- **R3 — Analytics enum coexistence.** Past persisted events keep `'movement_author'`; new events
  use `'assigned_seller'`. Any downstream consumer (none today, but documented for future) must
  read both. Mitigation: D5 captures the cut-over; apply-progress logs the timestamp of the first
  new-literal write so a future consumer can compute the boundary.
- **R4 — Prisma include perf at scale.** `ownerMovementInclude` now joins the engagement's
  `agents` per movement. For a 50-movement timeline with 2 agents per engagement, the join is
  bounded (50 movement rows × constant nested array). Prisma flattens this into a single query
  with grouped joins; no N+1 risk at the repository level. Mitigation: smoke test runs against
  seeded data with `EXPLAIN ANALYZE` available; if a regression appears at scale, fall back to
  option D3-b (pass engagement agents separately to the mapper) without changing the contract.
- **R5 — Seed count integrity (per 20.11 / 20.9).** Adding `whatsappPhone` to `sofia.demo` does
  not change row count, tenant membership count, or any logged total. Verified in D6 by inspecting
  `seed-demo.mjs:895-924` — only field assignment changes. Mitigation: audit command #5 in tasks
  confirms the before/after grep delta is exactly `+1` and the existing `Document requests:` /
  `Users created:` log lines (if any) remain unchanged.

---

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (under 400 LOC, no fork in delivery shape)`
