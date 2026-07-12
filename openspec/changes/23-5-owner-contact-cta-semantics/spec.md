# Spec — Stage 23.5 Owner Contact CTA Semantics and Priority Proof

## Status

Draft — 2026-06-17.

## Origin

Proposal: `openspec/changes/23-5-owner-contact-cta-semantics/proposal.md`
Plan reference: `docs/plans/2026-06-14-mvp-execution-plan-revision.md` Phase B, slice B4.
Evidence audit: `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — FB-6, P0.

---

## Functional Requirements

**FR-1.** `mapOwnerMovement` resolves the movement-level contact using the engagement's assigned-seller
WhatsApp phone. `movement.createdBy.whatsappPhone` is NOT read by the owner movement mapper.

**FR-2.** When an engagement has multiple `PropertyAgent` rows the resolver picks the one with the
earliest `assignedAt`. Tie-break when `assignedAt` is identical: `agentUserId` ascending (lexicographic
for UUID values). The rule is deterministic; no `isPrimary` flag is added.

**FR-3.** Zero `PropertyAgent` rows on the engagement → contact `available: false`,
`displayLabel: 'Contacto no configurado'`.

**FR-4.** The winning seller exists but `whatsappPhone` is null, empty, or has fewer than
`MIN_WHATSAPP_DIGITS` (8) digits after stripping non-digit characters →
contact `available: false`, `displayLabel: 'Contacto no configurado'`.

**FR-5.** The winning seller has a valid phone (≥ 8 digits) →
`available: true`, `targetType: 'assigned_seller'`, `displayLabel: 'Consultar responsable'`,
`whatsappPhone` populated verbatim.

**FR-6.** `OwnerMovementContactResponse.targetType` is renamed from `'movement_author'` to
`'assigned_seller'` end-to-end: backend DTO (`owner-whatsapp-contact.ts`), frontend type
(`features/owner/api/types.ts`), all test fixtures and assertions, analytics tracking payload.
No literal `'movement_author'` remains in source or test files after the change is applied.

**FR-7.** The `track-owner-movement-whatsapp-contact-click` use case writes
`metadata.targetType: 'assigned_seller'` to new analytics events. Past persisted events with
`'movement_author'` are not backfilled; both values may coexist in the analytics store.

**FR-8.** Property-level `Contactar inmobiliaria` resolution is unchanged.
`mapTenantWhatsappContact` and `OwnerPropertyContactResponse` with `targetType: 'tenant'`
are untouched.

**FR-9.** WhatsApp URL format is unchanged: `https://wa.me/<digits-only>?text=<url-encoded-message>`.

**FR-10.** Movement message body is unchanged: property type + engagement status + movement date.
No `observation`, `nextStep`, or movement id is included.

**FR-11.** The 8-digit minimum threshold is enforced exclusively via the shared
`MIN_WHATSAPP_DIGITS` constant from `common/whatsapp/whatsapp-phone.utils.ts`. No inline
digit-count magic numbers are introduced.

**FR-12.** Seed adds `whatsappPhone: '+5493512222222'` to `sofia.demo@viewpro.local` in
`seed-demo.mjs`. This value is distinct from `martin.demo`'s `+5493511111111` and the
demo tenant's `+5493510000000`.

**FR-13.** The seed log summary line is updated atomically with the `whatsappPhone` addition so
any count assertions or log matchers in the seeded smoke suite remain accurate.

**FR-14.** Pre-existing baselines of 702 API tests, 426 app-new tests, and 28 seeded smoke
tests remain GREEN. New tests are additive only; existing assertions are updated only for the
`targetType` literal rename.

### Include shape (contract note)

`ownerMovementInclude` must be extended to join each engagement's `agents` ordered by
`assignedAt asc, agentUserId asc`, and each agent's nested `agentUser { whatsappPhone }` select.
`ownerEngagementInclude` must likewise include `agentUser { whatsappPhone }` on the existing
`agents` join. Both extensions are single nested joins with no intermediate junction; the
performance cost is one additional join per timeline query and is acceptable at demo-dataset scale.
Design phase verifies with EXPLAIN ANALYZE on the extended query if needed.

---

## Acceptance Scenarios

**S-1 — Assigned seller has phone; creator does not.**
Given: engagement has one `PropertyAgent` (seller A, `whatsappPhone: '+5493512222222'`).
Movement `createdBy` is a manager with no phone.
When: `mapOwnerMovement` is called with this movement and engagement.
Then: contact is `available: true`, `targetType: 'assigned_seller'`,
`whatsappPhone: '+5493512222222'`, `displayLabel: 'Consultar responsable'`.

**S-2 — Assigned seller has no phone; creator does.**
Given: engagement has one `PropertyAgent` (seller A, `whatsappPhone: null`).
Movement `createdBy` has `whatsappPhone: '+5493511111111'`.
When: `mapOwnerMovement` is called.
Then: contact is `available: false`, `displayLabel: 'Contacto no configurado'`.
The creator's phone is NOT used.

**S-3 — Two sellers; earliest assignedAt wins and has a phone.**
Given: engagement has two `PropertyAgent` rows.
Seller A: `assignedAt: 2024-01-01`, `whatsappPhone: '+5493512222222'`.
Seller B: `assignedAt: 2024-06-01`, `whatsappPhone: '+5493511111111'`.
When: resolver runs.
Then: seller A wins; contact `whatsappPhone: '+5493512222222'`.

**S-4 — Identical assignedAt; agentUserId tie-break.**
Given: two sellers with equal `assignedAt`.
Seller X: `agentUserId: 'user-aaa'`, `whatsappPhone: '+5493512222222'`.
Seller Y: `agentUserId: 'user-bbb'`, `whatsappPhone: '+5493511111111'`.
When: resolver runs.
Then: seller X wins (`'user-aaa' < 'user-bbb'`); contact `whatsappPhone: '+5493512222222'`.

**S-5 — Zero assigned sellers.**
Given: engagement has no `PropertyAgent` rows.
When: `mapOwnerMovement` is called.
Then: contact is `available: false`, `displayLabel: 'Contacto no configurado'`.

**S-6 — Assigned seller with 7-digit phone (below threshold).**
Given: engagement has one `PropertyAgent`, `whatsappPhone: '+111234567'` (7 digits after stripping).
When: resolver runs.
Then: contact is `available: false`, `displayLabel: 'Contacto no configurado'`.

**S-7 — Assigned seller with valid phone produces correct wa.me URL.**
Given: engagement has one `PropertyAgent`, `whatsappPhone: '+5493512222222'`.
When: contact is resolved and the owner opens the WhatsApp CTA.
Then: `whatsappPhone` is `'+5493512222222'`, `targetType` is `'assigned_seller'`,
and the generated `whatsappUrl` matches `https://wa.me/5493512222222?text=<encoded>`.

**S-8 — Property-level Contactar inmobiliaria is unchanged (regression guard).**
Given: a property engagement where the tenant has `whatsappPhone: '+5493510000000'`.
When: `mapTenantWhatsappContact` is called.
Then: contact is `available: true`, `targetType: 'tenant'`,
`displayLabel: 'Contactar inmobiliaria'`, `whatsappPhone: '+5493510000000'`.
No assigned-seller logic is invoked.

**S-9 — Tracking endpoint writes assigned_seller.**
Given: a demo owner clicks the movement WhatsApp CTA.
When: the `track-owner-movement-whatsapp-contact-click` use case executes.
Then: the persisted analytics event has `metadata.targetType: 'assigned_seller'`.

**S-10 — Seeded smoke: demo owner sees sofia.demo's phone on the timeline.**
Given: the demo seed is applied (`sofia.demo` has `whatsappPhone: '+5493512222222'`
and is the assigned seller on at least one engagement movement visible to the demo owner).
When: the demo owner navigates to `/owner-portal/engagements/:id`.
Then: at least one movement card shows a WhatsApp CTA that is NOT "Contacto no configurado",
and its `href` contains `5493512222222`.

---

## Non-Functional Notes

- No new npm/pnpm dependency introduced.
- No schema migration. `User.whatsappPhone` exists since 23.1; `PropertyAgent` is unchanged.
- The `targetType` rename is a breaking contract change for consumers of `OwnerMovementContactResponse`.
  No external dashboard is known to consume this field today; the cut-over is documented in
  apply-progress for future analytics consumers.
- Spec delta search: no existing OpenSpec file outside this change folder references
  `movement_author` or `targetType` on the movement contact DTO. No cross-spec delta required.
- Performance: the include extension adds one nested join per engagement. Acceptable at demo scale.
  Design phase may verify with EXPLAIN ANALYZE if the query plan is non-obvious.
- Persona scope: spec is in English. UI copy (`'Consultar responsable'`, `'Contacto no configurado'`,
  `'Contactar inmobiliaria'`) stays in Spanish as currently implemented.
