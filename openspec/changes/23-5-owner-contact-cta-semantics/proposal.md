# Proposal — Stage 23.5 Owner Contact CTA Semantics and Priority Proof

## Status

Draft — proposed 2026-06-17.

## Origin

- `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — FB-6 movement-level contact priority proof flagged as PARTIAL, P0.
- Manual demo walkthrough 2026-06-13 — owner timeline rendered "Contacto no configurado" for movements created by a manager on properties with an assigned seller that has a phone configured.
- `docs/plans/2026-06-14-mvp-execution-plan-revision.md` — Phase B, slice B4.
- PR #171 (closed without merge) — previous attempt at this slice; superseded by this proposal with locked scope decisions.

## Slice contract

```txt
Stage: 23
Slice: 23.5 — Owner movement contact resolves to the assigned seller (fix + unit/integration proof)
Objective: replace the buggy createdBy-based resolution on the owner movement timeline with assigned-seller resolution, rename the analytics target enum end-to-end, and prove the new rule with unit + integration tests plus a seeded smoke navigation.
Evidence needed: API mapper unit tests for the new resolver (assigned-seller resolves; createdBy ignored; multi-seller tie-break by earliest assignedAt then agentUserId ascending; 0 sellers degrades to no-config); API repository tests covering the extended Prisma include; frontend unit tests on the renamed targetType; seeded smoke proving the demo owner sees the assigned seller's number instead of "Contacto no configurado".
Do not touch: WhatsApp Business API, bots, automated reminders, chat inboxes, message templates, property-level "Contactar inmobiliaria" behavior, tenant phone editor (23.3), user phone editor (23-3b), E2E + click tracking edge guards (deferred to 23.4).
Done: owner movement timeline buttons resolve to the assigned seller's phone using the locked priority rule; the analytics `targetType` is renamed to `'assigned_seller'` everywhere; the seed makes the bug reproducible; the new rule is covered by unit + integration tests; the seeded smoke proves the fix end-to-end.
Next slice: 23.4 — E2E + click tracking edge guards.
```

## Investigation summary (2026-06-17)

**Bug root cause.** `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts:25` passes `movement.createdBy.whatsappPhone` to `mapMovementAuthorWhatsappContact`. The owner expects the **assigned seller's** phone, not the row creator's. When a manager (who may have no phone) creates a movement on a property whose assigned seller does have a phone, the timeline incorrectly renders "Contacto no configurado".

**Schema.** `PropertyAgent` in `viewpro-app/apps/api/prisma/schema.prisma:450` is a 0..N relation per engagement, unique key `(propertyEngagementId, agentUserId)`. There is no `isPrimary` flag.

**Tie-break (locked).** When an engagement has multiple sellers, resolve by **earliest `assignedAt`**, with secondary tie-break by `agentUserId` ascending for identical timestamps. Deterministic; no schema change.

**Prisma include gaps.** `ownerEngagementInclude` in `viewpro-app/apps/api/src/owner-portal/repositories/prisma-owner-portal.repository.ts:22` selects `agents` for the engagement header but the inner `agentUser` select omits `whatsappPhone`. `ownerMovementInclude` (used for the timeline movements query) only joins `createdBy`. Both must be extended so the assigned-seller phone is reachable from the mapper without an N+1.

**Resolver location.** `mapMovementAuthorWhatsappContact` lives at `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts:38` and today accepts a single `whatsappPhone: string | null` argument. After the fix it must receive the resolved assigned-seller phone (via a new resolver helper) or be wrapped by one that does, and fall back to the no-config state otherwise. Pick whichever is least invasive and document in design.

**`targetType` rename (locked).** Rename `'movement_author'` → `'assigned_seller'` end-to-end. Breaks the backend DTO at `OwnerMovementContact.targetType`, the frontend type at `viewpro-app/apps/app-new/src/features/owner/api/types.ts:47`, every fixture and assertion that hardcodes the old literal, and the live analytics metadata persisted by `track-owner-movement-whatsapp-contact-click.use-case.ts`. All consumers are internal; no external dashboard reads this enum today.

**Seed reproducibility.** `viewpro-app/apps/api/scripts/seed-demo.mjs:80-97` defines `sofia.demo@viewpro.local` without `whatsappPhone`. Add `whatsappPhone: '+5493512222222'` (distinct from `martin.demo`'s `+5493511111111` and the demo tenant `+5493510000000`) so the bug — and its fix — are reproducible end-to-end via demo-owner navigation.

**WhatsApp URL/message format.** `wa.me/<digits>?text=<encoded>`; the movement message body at `owner-whatsapp-contact.ts:68` uses type + status + date and deliberately excludes `observation`, `nextStep`, and movement id. Preserve verbatim.

**23.4 boundary (locked).** 23.5 owns the fix plus unit/integration test coverage of the new resolution rule. 23.4 stays as a separate later slice owning E2E + click tracking edge guards (e.g., "tracking not called when contact unavailable" and "stored `analytics.targetType == 'assigned_seller'`").

## Scope

- Extend `ownerEngagementInclude` and `ownerMovementInclude` in the Prisma owner-portal repository so the assigned-seller `whatsappPhone` and `assignedAt` are joined alongside the existing fields.
- New resolver helper that picks the assigned-seller phone for a given engagement using the locked priority rule (earliest `assignedAt`, then `agentUserId` ascending; returns null if no seller has a usable phone).
- Rewire `mapOwnerMovement` to use the resolved assigned-seller phone instead of `movement.createdBy.whatsappPhone`.
- Rename `targetType` from `'movement_author'` to `'assigned_seller'` end-to-end (backend DTO, frontend type, all fixtures and assertions, analytics tracking payload metadata).
- Extend unit + integration test coverage for the new rule: (a) assigned-seller resolves; (b) `createdBy` is ignored even when present; (c) multi-seller tie-break by earliest `assignedAt`; (d) secondary tie-break by `agentUserId` ascending; (e) zero sellers or all sellers without phone degrades to the no-config state.
- Seed: add `whatsappPhone: '+5493512222222'` to `sofia.demo@viewpro.local` in `seed-demo.mjs`.
- Seeded smoke: one new test where the demo owner navigates to the timeline and sees the assigned seller's number (NOT "Contacto no configurado").

## Out of scope

- `User.whatsappPhone` editor UI (deferred to slice 23-3b).
- E2E / Playwright coverage of tracking and click guards (deferred to 23.4).
- `PropertyAgent.isPrimary` flag or any per-engagement primary-seller selection UI.
- WhatsApp Business API, automated reminders, chat inboxes, message templates.
- Analytics backfill for past events with `'movement_author'` metadata. Past events keep the old enum; only future events get `'assigned_seller'`.
- Any schema migration. The `whatsappPhone` column has existed on `User` since 23.1.
- Property-level `Contactar inmobiliaria` resolution. Only movement-level changes.

## Preserve unchanged

- The existing 702 API tests, 426 app-new tests, and 28 seeded smoke tests must remain green (modulo deterministic adjustments to assertions affected by the rename).
- The Stage 26.2 deterministic seed contract.
- Property-level `Contactar inmobiliaria` behavior — still resolves to the tenant phone.
- Tenant phone editor from 23.3.
- The `wa.me/<digits>?text=<encoded>` URL format.
- The movement message body template at `owner-whatsapp-contact.ts:68` (type + status + date, no observation/nextStep/id).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `owner-portal`: movement-level WhatsApp contact resolution changes from `createdBy.whatsappPhone` to the engagement's assigned-seller phone, resolved by earliest `assignedAt` (then `agentUserId` ascending). Analytics `targetType` enum renames `'movement_author'` → `'assigned_seller'`.

## Affected areas

API (NestJS):

- `viewpro-app/apps/api/src/owner-portal/repositories/prisma-owner-portal.repository.ts` — extend `ownerEngagementInclude` and `ownerMovementInclude` to join the assigned-seller `whatsappPhone` and `assignedAt`.
- `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts` — rewire `mapOwnerMovement` to use the assigned-seller resolver instead of `createdBy.whatsappPhone`.
- `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` — add the assigned-seller resolver helper; either rename `mapMovementAuthorWhatsappContact` → `mapAssignedSellerWhatsappContact` or keep the name and update only the `targetType` literal. Pick whichever is least invasive; document in design.
- `viewpro-app/apps/api/src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts` — update analytics metadata `targetType` to `'assigned_seller'`.

App (Next.js):

- `viewpro-app/apps/app-new/src/features/owner/api/types.ts` — rename `OwnerMovementContact.targetType` literal from `'movement_author'` to `'assigned_seller'`.

Tests:

- `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts` — extend with the five new resolution scenarios.
- `viewpro-app/apps/api/test/owner-portal.repository.spec.ts` — extend mapper-level tests on `mapOwnerMovement` covering the Prisma include shape.
- `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` — fixture rename.
- `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` — fixture + util-level rename.

Seed and smoke:

- `viewpro-app/apps/api/scripts/seed-demo.mjs` — add `whatsappPhone: '+5493512222222'` to `sofia.demo`.
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — new seeded smoke proving the demo owner sees the assigned seller's number on the timeline.

OpenSpec:

- `openspec/changes/23-5-owner-contact-cta-semantics/` — this folder.

## Safety and integrity constraints

- No schema migration. The `whatsappPhone` column already exists on `User` since 23.1 and `PropertyAgent` is unchanged.
- No UI redesign. The renderer in `owner-timeline.tsx` only reacts to a non-null `contact.whatsappUrl`; the visual state for "no config" is preserved.
- Preserve the `wa.me/<digits>?text=<encoded>` URL format and the movement message body template verbatim.
- The analytics `targetType` rename is breaking for any external dashboard reading the old `'movement_author'` enum. None are known to exist today; document the cut-over in apply-progress so analytics consumers (if any are added later) can be informed.
- No `--no-verify` on commits; lint/typecheck/tests must pass.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1 — Tie-break decision (earliest `assignedAt`) untested in production data.** | Med | Add an explicit unit test for the tie-break with two sellers and assert the resolver picks the earlier `assignedAt`. Seed scenario in design should include the tie. |
| **R2 — `targetType` rename propagates to live analytics metadata.** Past events keep `'movement_author'`, future events get `'assigned_seller'`. | High | Document the cut-over in apply-progress; explicitly out-of-scope a backfill. Note both literals in analytics readme (if present) once the apply phase runs. |
| **R3 — Prisma include extension could degrade query performance.** Joining `agents.agentUser` on every movement timeline read may inflate row count if the engagement has many sellers. | Low | Verify with explain/analyze on the demo dataset and a multi-seller fixture before tagging the spec as complete; if cost is non-trivial, keep the join on engagement-level only and resolve once per timeline rather than per movement. |
| **R4 — Existing tests assert `targetType: 'movement_author'` literally; missing one in the rename sweep breaks the suite.** | High | Before mutating, grep every consumer of the literal (`rg "'movement_author'"`) and list them in design. Update all in the same PR. |
| **R5 — Seed change shifts log-line counts or other count assertions** (per 20.11 / 20.9 lessons). | Med | Pre-audit `seed-demo.mjs` output and any tests asserting `Document requests:` / `Users created:` style counts. Adjust expectations or hide behind tolerant matchers. |

## Rollback

Revert: the resolver rewire in `mapOwnerMovement`, the new resolver helper, the `targetType` rename across backend + frontend + analytics, the Prisma include extensions, the seed `whatsappPhone` line, the test fixtures, the seeded smoke test, and this OpenSpec folder. No schema migration to roll back. Pre-existing baselines (702 API tests, 426 app-new tests, 28 seeded smoke, the 26.2 deterministic contract, property-level `Contactar inmobiliaria`, tenant phone editor from 23.3) remain intact.

## Success criteria

- [ ] Owner timeline movement buttons resolve to the assigned seller's phone using the locked priority rule (earliest `assignedAt`, then `agentUserId` ascending).
- [ ] `createdBy.whatsappPhone` is no longer read by the owner movement mapper.
- [ ] The analytics `targetType` enum is `'assigned_seller'` everywhere in the codebase; no remaining literal `'movement_author'` outside historical event records.
- [ ] Multi-seller tie-break is covered by an explicit unit test.
- [ ] Zero-seller and no-phone fallbacks degrade to the no-config state in tests.
- [ ] Seeded smoke proves the demo owner sees the assigned seller's WhatsApp number on the timeline and does NOT see "Contacto no configurado".
- [ ] All pre-existing test baselines remain green.

## Next phases

Proceed to `sdd-spec` (and `sdd-design` if needed in parallel).
