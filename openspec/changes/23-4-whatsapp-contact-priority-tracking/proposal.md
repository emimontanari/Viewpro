# Proposal — Stage 23.4 WhatsApp Contact Priority and Tracking Proof

## Status

Draft — proposed 2026-06-18.

## Origin

- `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — slice B-5 (priority + click tracking edge guards), flagged after the 23.5 fix to close the audit row.
- `docs/plans/2026-06-04-final-mvp-execution-plan.md:312-322` — slice contract for Stage 23.4.
- Post-23.5 close-out: 23.5 shipped the assigned-seller resolution fix plus unit/integration coverage and an S-10 seeded smoke (timeline link visible). It explicitly deferred E2E + click-tracking edge guards to 23.4.

## Slice contract

```txt
Stage: 23
Slice: 23.4 — Owner contact priority and click-tracking edge guards (test-only)
Objective: prove that owner contact always resolves to the right destination or an explicit no-config state, and that click tracking only fires when a contact exists.
Evidence needed: backend use-case unit specs for both tracking endpoints (404-on-non-owned, 204-on-success, AnalyticsEvent shape, swallow-on-analytics-failure); FE negative guards that tracking is NOT called when the contact is unavailable; a wa.me URL builder null-phone guard; a seeded smoke proving the movement-level click tracking endpoint is hit at least once.
Do not touch: production code (test-only slice); the wa.me URL format; the message body templates; the assigned-seller resolution rule (23.5); the tenant phone editor (23.3); the user phone editor (23-3b); WhatsApp Business API, bots, automated reminders, message templates; admin/dashboard UI for analytics visualization; rate-limiting; analytics event backfill.
Done: every confirmed contact path (assigned seller, tenant, missing) has an E2E assertion and a click-tracking assertion; every disabled-button path has a negative-guard assertion; every wa.me URL edge has a test; all pre-existing baselines remain green.
Next slice: 24.5 — notification routing E2E.
```

## Investigation summary (2026-06-18)

**Endpoints confirmed.**

- `POST /api/owner/engagements/:id/whatsapp-contact-click` — returns 204; writes an `AnalyticsEvent` of type `WHATSAPP_CONTACT_CLICKED` with `metadata: { context: 'property', targetType: 'tenant' }`; wraps the analytics write in a bare `catch {}` so a failure in the analytics path never breaks the click UX.
- `POST /api/owner/engagements/:id/movements/:movementId/whatsapp-contact-click` — returns 204; writes an `AnalyticsEvent` of type `WHATSAPP_CONTACT_CLICKED` with `metadata: { context: 'movement', targetType: 'assigned_seller' }` (post-23.5); same swallow-on-error wrap.

**Existing coverage (do not duplicate).**

- API e2e positives: `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts:261` (property-level) and `:320` (movement-level).
- FE service tests: `viewpro-app/apps/app-new/src/features/owner/api/service.test.ts:73,91,111,125`.
- FE component spies for tracking helper invocation: `owner-home.test.tsx:171` (property) and `owner-timeline.test.tsx:79` (movement).
- Property-level seeded smoke: `demo-smoke.spec.ts:990` (T19b — intercepts the property-level endpoint, clicks with `modifiers: ['Meta']`, asserts ≥ 1 tracking hit).

**Five gaps this slice closes.**

1. No FE assertion that tracking is NOT called when the contact button is disabled (no phone configured). Currently `owner-home.test.tsx:197` and `owner-timeline.test.tsx:117` exercise the disabled branch but do not spy on the tracking helper.
2. No backend use-case unit specs for either tracking endpoint. The e2e tests cover the happy path but the use-case shape, AnalyticsEvent payload, and 404-on-non-owned branch are not isolated under unit tests.
3. No explicit "analytics swallow" test. Today the e2e proves the endpoint returns 204 when analytics succeeds, but does not prove the endpoint still returns 204 when the analytics repository throws.
4. No seeded smoke for the movement-level tracking endpoint. The property-level T19b at `:990` covers `/owner/engagements/*/whatsapp-contact-click`; the movement-level endpoint has no equivalent.
5. No null-phone guard test on `buildOwnerPropertyWhatsappHref` in `owner-whatsapp-contact.test.ts` (missing `whatsappPhone` should yield `null`, never a malformed `wa.me//?text=...`).

**Analytics consumers reading `metadata.targetType`: ZERO.** `rg "movement_author"` across `viewpro-app/apps/api/src/` returns 0 hits. `analytics-event.mapper.ts` passes `metadata` through the sanitizer unchanged. No use case (analytics, dashboard, pilot summary, activity feed, list-events) reads `WHATSAPP_CONTACT_CLICKED` events or branches on `targetType`. Historical events with the deprecated `'movement_author'` literal are therefore safe to leave in place; no backfill or migration is required.

## Scope

- **FE negative guards (extend existing component tests):**
  - `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx:197` — spy on `trackOwnerWhatsappContactClick`, click the disabled "Contactar inmobiliaria" button, assert the spy was `not.toHaveBeenCalled()`.
  - `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx:117` — same pattern for `trackOwnerMovementWhatsappContactClick` and "Consultar responsable".
- **Backend use-case unit specs (NEW files):**
  - `viewpro-app/apps/api/test/track-owner-whatsapp-contact-click.use-case.spec.ts` — cover 404-on-non-owned engagement, 204-on-success, AnalyticsEvent shape (`type: 'WHATSAPP_CONTACT_CLICKED'`, `metadata: { context: 'property', targetType: 'tenant' }`), and the swallow-on-analytics-failure branch (mock the analytics repository to throw → endpoint still returns 204).
  - `viewpro-app/apps/api/test/track-owner-movement-whatsapp-contact-click.use-case.spec.ts` — same scope for the movement-level endpoint with `metadata: { context: 'movement', targetType: 'assigned_seller' }`.
- **Seeded smoke for movement-level click tracking:** extend the Stage 23.5 describe block at `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts:1438` with a second test inside the same serial-mode describe. It intercepts `**/api/owner/engagements/*/movements/*/whatsapp-contact-click`, clicks the resolved "Consultar responsable" link with `modifiers: ['Meta']` (mirrors the property-level T19b pattern at `:990` to prevent the wa.me navigation from breaking the page context), and asserts at least 1 tracking hit.
- **Wa.me null-phone guard:** extend `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` with a case where `buildOwnerPropertyWhatsappHref` receives `whatsappPhone: undefined` (or omitted) and returns `null` — never a malformed `wa.me//?text=...`.

## Out of scope

- **Backfill of historical `targetType: 'movement_author'` events.** Investigation confirms zero consumers read `metadata.targetType` anywhere in `viewpro-app/apps/api/src/`. No mapper or use case branches on it. A migration would carry risk without product value; document the decision and move on.
- AnalyticsEvent FK constraints — these are deliberately absent because AnalyticsEvent is an append-only event log.
- Admin or dashboard UI for visualizing `WHATSAPP_CONTACT_CLICKED` events.
- Rate-limiting on the tracking endpoints.
- WhatsApp Business API, bots, automated reminders, message templates.
- Any change to the `wa.me/<digits>?text=<encoded>` URL format.
- Any change to the property-level or movement-level message body templates.
- Any change to the assigned-seller resolution rule (delivered by 23.5).
- `User.whatsappPhone` editor UI (still owned by 23-3b).

## Preserve unchanged

- The existing 715 API tests, 426 app-new tests, and 29 seeded smoke tests must remain green.
- The Stage 26.2 deterministic seed contract.
- The `wa.me/<digits>?text=<encoded>` URL format.
- Property-level and movement-level message body templates.
- The assigned-seller resolution rule (earliest `assignedAt`, then `agentUserId` ascending) shipped by 23.5.
- The property-level resolution rule (tenant `whatsappPhone`).
- The S-10 seeded smoke (visible-link assertion) that 23.5 added at `demo-smoke.spec.ts:1438`.

## Affected areas

Tests (this slice is test-only — no production code changes):

- `viewpro-app/apps/api/test/track-owner-whatsapp-contact-click.use-case.spec.ts` (NEW).
- `viewpro-app/apps/api/test/track-owner-movement-whatsapp-contact-click.use-case.spec.ts` (NEW).
- `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx` (extend negative-guard case).
- `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx` (extend negative-guard case).
- `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts` (extend null-phone guard).
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (extend the existing Stage 23.5 describe block at `:1438` with one new test).

OpenSpec:

- `openspec/changes/23-4-whatsapp-contact-priority-tracking/` — this folder.

## Safety and integrity constraints

- **Test-only slice.** No production code change — no controller, no use case, no resolver, no UI, no copy.
- No seed change (the deterministic 26.2 contract stands).
- No schema migration.
- No `--no-verify` on commits; lint/typecheck/tests must pass.
- New unit specs MUST mock the analytics repository / service rather than reach for the real DI graph, so the swallow-on-error branch is testable without breaking the wider e2e harness.

## Risks

- **R1 — Movement-level seeded smoke under `modifiers: ['Meta']` could be flaky.** The property-level T19b at `demo-smoke.spec.ts:990` is the proven pattern; mirror it verbatim (same modifier, same intercept timing, same hit-count assertion). Verify the route pattern matches `**/api/owner/engagements/*/movements/*/whatsapp-contact-click` exactly before tagging the spec done.
- **R2 — Swallow-on-error unit test must mock cleanly.** The analytics path lives behind a repository abstraction; the unit spec must mock that repo (or the analytics service the use case depends on) to throw, without breaking the real DI graph elsewhere. If the use case calls the repo directly the mock is trivial; if it goes through a service layer, design will pick the correct seam.
- **R3 — FE negative guards must spy on the right helper.** The component dispatches the tracking call through the imported `trackOwnerWhatsappContactClick` / `trackOwnerMovementWhatsappContactClick` helper, not the React Query mutation directly. The spy MUST target the helper (or its module) so the disabled-button early-return path is actually exercised.
- **R4 — Analytics backfill punt assumes no external dashboard.** The decision rests on a `rg` sweep of `viewpro-app/apps/api/src/`. Re-run the sweep (including `src/analytics`, `src/admin`, `src/pilot`) immediately before the apply phase to confirm zero consumers still hold; if a consumer appears, escalate to a follow-up slice before merging.

## Rollback

Revert the two new use-case spec files, revert the test extensions in `owner-home.test.tsx`, `owner-timeline.test.tsx`, `owner-whatsapp-contact.test.ts`, and `demo-smoke.spec.ts`, and revert this OpenSpec folder. No production code, seed, schema, or UI touched. Pre-existing baselines (715 API, 426 app-new, 29 seeded smoke, the 26.2 deterministic contract, and the 23.5 S-10 visible-link smoke) remain intact.

## Success criteria

- [ ] Every confirmed contact path (assigned seller, tenant, missing) has an E2E or component assertion AND a tracking assertion (positive when present, negative when disabled).
- [ ] Both tracking endpoints have backend use-case unit specs covering 404-on-non-owned, 204-on-success, AnalyticsEvent shape, and swallow-on-analytics-failure.
- [ ] The wa.me URL builder returns `null` (never a malformed string) when the phone is missing.
- [ ] A seeded smoke proves the movement-level click tracking endpoint is hit at least once on the demo dataset.
- [ ] Backfill decision for historical `'movement_author'` events is documented in this proposal and no migration ships.
- [ ] All pre-existing test baselines (715 API, 426 app-new, 29 seeded smoke) remain green.

## Next phases

Proceed to `sdd-spec` (and `sdd-design` in parallel if the spec phase surfaces a non-trivial use-case test seam decision).
