# Spec — Stage 23.4 WhatsApp Contact Priority and Tracking Proof

## Status

Draft — 2026-06-18.

## Origin

Proposal: `openspec/changes/23-4-whatsapp-contact-priority-tracking/proposal.md`
Plan reference: `docs/plans/2026-06-04-final-mvp-execution-plan.md:312-322`
Evidence audit: `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — slice B-5.

---

## Functional Requirements

**FR-1.** The FE component MUST NOT invoke the tracking helper when `contact.available === false`.
This guard applies independently at the property-level CTA (`trackOwnerWhatsappContactClick`) and
at the movement-level CTA (`trackOwnerMovementWhatsappContactClick`). Both disabled-button branches
MUST be covered by a spy asserting `not.toHaveBeenCalled()`.

**FR-2.** `TrackOwnerWhatsappContactClickUseCase` (property-level) MUST return 204 on a valid
owned engagement. It MUST write exactly one `AnalyticsEvent` with
`eventName: 'WHATSAPP_CONTACT_CLICKED'` and
`metadata: { context: 'property', targetType: 'tenant' }`.
The event MUST carry the correct `propertyEngagementId`, `propertyAssetId`, and `actorUserId`.

**FR-3.** `TrackOwnerMovementWhatsappContactClickUseCase` (movement-level) MUST return 204 on a
valid owned engagement with a visible movement. It MUST write exactly one `AnalyticsEvent` with
`eventName: 'WHATSAPP_CONTACT_CLICKED'` and
`metadata: { context: 'movement', targetType: 'assigned_seller' }`.
The event MUST carry `movementId` in addition to the fields listed in FR-2.

**FR-4.** Both use cases MUST throw `NotFoundException` (HTTP 404) when the requesting owner cannot
see the target engagement (or, for FR-3, the movement). NO `AnalyticsEvent` row MAY be written in
this case.

**FR-5.** When the analytics repository or service throws during the event write, both use cases
MUST swallow the error. The endpoint MUST still return 204. The error MUST NOT propagate to the
HTTP layer or alter the observable response to the caller.

**FR-6.** The seeded smoke MUST exercise the movement-level click-tracking path end-to-end. It
MUST use Playwright route interception on `**/api/owner/engagements/*/movements/*/whatsapp-contact-click`,
click the resolved "Consultar responsable" link with `modifiers: ['Meta']` (mirrors T19b at
`demo-smoke.spec.ts:990`), and assert at least 1 POST hit on that route.

**FR-7.** `buildOwnerPropertyWhatsappHref` MUST return `null` when the input contact's
`whatsappPhone` is `null` OR `undefined` (or the key is absent). It MUST NOT return a malformed
`wa.me//?text=...` string in either case.

**FR-8.** All pre-existing positive scenarios are preserved without modification:
- API e2e positives at `owner-portal.e2e-spec.ts:261` (property-level) and `:320` (movement-level).
- FE service tests at `service.test.ts:73,91,111,125`.
- FE component spies at `owner-home.test.tsx:171` and `owner-timeline.test.tsx:79`.
- Property-level seeded smoke T19b at `demo-smoke.spec.ts:990`.
- Stage 23.5 S-10 visible-link smoke at `demo-smoke.spec.ts:1438`.
New tests are additive only; no existing assertion is modified.

**FR-9.** No consumer of historical analytics events with `metadata.targetType: 'movement_author'`
exists in `viewpro-app/apps/api/src/`. Backfill is NOT performed. This decision MUST be recorded in
apply-progress. The sweep confirming zero consumers (`rg "movement_author"` across `api/src/`) MUST
be re-run immediately before the apply phase; if any consumer is found the apply MUST be stopped
and the finding escalated to a follow-up slice.

---

## Acceptance Scenarios

**S-1 — Property-level disabled button: tracking not called.**
Given: a property engagement where `contact.available === false` (no tenant phone configured).
When: the owner views the property card and the "Contactar inmobiliaria" button is disabled.
Then: clicking (or simulating a click on) the disabled button does NOT invoke
`trackOwnerWhatsappContactClick`. The spy asserts `not.toHaveBeenCalled()`.

**S-2 — Movement-level disabled button: tracking not called.**
Given: a movement engagement where `contact.available === false` (no assigned-seller phone).
When: the owner views the timeline card and the "Consultar responsable" button is disabled.
Then: simulating a click does NOT invoke `trackOwnerMovementWhatsappContactClick`.
The spy asserts `not.toHaveBeenCalled()`.

**S-3 — Non-owner role cannot exercise these endpoints (regression guard).**
Given: a `PRINCIPAL_MANAGER` (or any non-owner) JWT is used.
When: a POST is sent to either tracking endpoint.
Then: the API returns 403 (or 401). No `AnalyticsEvent` row is written.
(Covered by existing auth guards; this scenario is a regression note, not a new test.)

**S-4 — Owner posts property-level click on owned engagement → 204 + event.**
Given: a valid owner JWT and an engagement owned by that owner.
When: `POST /api/owner/engagements/:id/whatsapp-contact-click`.
Then: response status is 204. Exactly one `AnalyticsEvent` row exists with
`eventName: 'WHATSAPP_CONTACT_CLICKED'`, `metadata.context: 'property'`,
`metadata.targetType: 'tenant'`, and the correct `propertyEngagementId` / `propertyAssetId` / `actorUserId`.

**S-5 — Owner posts property-level click on non-owned engagement → 404 + no event.**
Given: a valid owner JWT and an engagement NOT owned by that owner.
When: `POST /api/owner/engagements/:id/whatsapp-contact-click`.
Then: response status is 404. Zero `AnalyticsEvent` rows are written.

**S-6 — Owner posts movement-level click on owned engagement + movement → 204 + event.**
Given: a valid owner JWT, an owned engagement, and a movement visible to that owner.
When: `POST /api/owner/engagements/:id/movements/:movementId/whatsapp-contact-click`.
Then: response status is 204. Exactly one `AnalyticsEvent` row exists with
`metadata.context: 'movement'`, `metadata.targetType: 'assigned_seller'`,
and the correct `movementId` FK.

**S-7 — Owner posts movement-level click on unknown movementId → 404 + no event.**
Given: a valid owner JWT, an owned engagement, and a movementId that is non-existent or
belongs to a different engagement.
When: `POST /api/owner/engagements/:id/movements/:movementId/whatsapp-contact-click`.
Then: response status is 404. Zero `AnalyticsEvent` rows are written.

**S-8 — Analytics service throws → endpoint still returns 204.**
Given: a valid owner JWT, an owned engagement, and the analytics repository mocked to throw.
When: `POST /api/owner/engagements/:id/whatsapp-contact-click` (or movement-level equivalent).
Then: response status is 204. No error propagates to the HTTP layer. The owner is unaffected.

**S-9 — Seeded smoke: movement-level tracking endpoint hit.**
Given: the demo seed is applied and `propietario.demo` is signed in (serial describe block).
When: the owner navigates to an engagement timeline and clicks "Consultar responsable"
with `modifiers: ['Meta']`.
Then: Playwright intercepts at least 1 POST to
`**/api/owner/engagements/*/movements/*/whatsapp-contact-click`.

**S-10 — Wa.me builder: null phone returns null.**
Given: `buildOwnerPropertyWhatsappHref` is called with `whatsappPhone: null`.
When: the function executes.
Then: the return value is `null`.

**S-11 — Wa.me builder: undefined phone returns null.**
Given: `buildOwnerPropertyWhatsappHref` is called with `whatsappPhone: undefined`
(or the key omitted from the input object).
When: the function executes.
Then: the return value is `null`, never `'wa.me//?text=...'` or any non-null string.

---

## Non-Functional Notes

- No new npm/pnpm dependency introduced.
- No production code change. No schema migration. No seed change.
- New backend unit specs MUST mock the analytics repository/service interface; no real database
  connection or DI graph is exercised in these specs (Vitest + Nest `TestingModule`).
- The seeded smoke test MUST run inside the existing Stage 23.5 serial-mode describe block
  (inheriting the signed-in `propietario.demo` state from `:1438`); it MUST NOT start a new
  browser context or re-authenticate.
- Persona scope: spec and test files in English. UI copy
  (`'Consultar responsable'`, `'Contactar inmobiliaria'`, `'Contacto no configurado'`)
  stays in Spanish as used by existing assertions.
- Spec deltas required: `false`. This slice adds test evidence only; no contract changes.
- Pre-existing baselines (715 API tests, 426 app-new tests, 29 seeded smoke tests,
  the Stage 26.2 deterministic seed contract) MUST remain GREEN.
