# Proposal — Stage 26.3 Full Seeded E2E

**Status:** proposed, ready to enter SDD `sdd-spec` after acceptance.
**Origin:** `docs/plans/2026-06-04-final-mvp-execution-plan.md` Phase 7 (canonical) and `docs/plans/2026-06-14-mvp-execution-plan-revision.md` Phase B (active). Predecessor closures: 20.13 movement outcomes (PR #152 + #155), 20.10 state change request workflow (PR #157 + #158), and the owner invitation expiry fix (PR #159) that restored the seeded smoke suite to 13/13 green.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B, slice B1.

## Slice contract

```txt
Stage: 26
Slice: 26.3 — Full seeded E2E
Objective: prove the entire pilot workflow in one reproducible Playwright/seeded suite that exits clean.
Evidence needed: a single `pnpm --filter next-shadcn-dashboard-starter test:seeded` run that covers manager → seller → owner → property → Seguimiento → documents → notifications → WhatsApp → admin status/limits and exits green.
Do not touch: new product features, the 26.2 deterministic seed contract, the 26.2.1 image fixtures, the API 403 guard, or any unrelated UI.
Done: every audit-confirmed pilot flow is covered by an automated seeded test, the full Playwright suite runs in <2 minutes, and the suite is reproducible from a clean `pnpm demo:seed`.
Next slice: 26.4 — Security and isolation regression.
```

## Problem

The audit on 2026-06-13 listed 11 pilot-readiness flows that need automated proof before staging handoff. As of 2026-06-15 the seeded Playwright suite covers many of them — 13/13 tests are green after PR #159 — but several audit-listed flows are still missing or partially covered. The next pilot demo must reproduce the entire workflow from a single command without manual steps. Stage 26.3 closes that gap.

## Current coverage baseline (2026-06-15)

Verified by running the full `test:seeded` suite (13/13 pass). The existing scenarios already cover:

| Area | Coverage today |
|---|---|
| Manager dashboard / property list / property detail | ✅ Test 1 |
| Seller assigned-only visibility and absence of `Nueva propiedad` CTA | ✅ Tests 2 + 3 (both martin and lucia) |
| Owner portal read-only follow-up | ✅ Test 4 |
| Owner document upload | ✅ Test 5 |
| Existing-owner invitation acceptance | ✅ Test 6 (now stable after #159) |
| Manager seeing internal notifications | ✅ Test 7 |
| Owner notifications + images + contacts | ✅ Test 8 |
| ViewPro admin tenant-limits browser flow | ✅ Test 9 |
| Movement outcomes + FR-11 status-invariant gate | ✅ Test 10 |
| Manager reviewing submitted document request | ✅ Test 11 |
| Status change request reject path (manager) | ✅ Test 12 |
| Status change request approve path (manager) | ✅ Test 13 |

## Audit-listed flows still missing or partial

| Gap | What is missing | Priority |
|---|---|---|
| G-1 Manager creates engagement from scratch in browser | Existing tests open seeded engagements; no test creates one through the UI. | High — covers `manager creates property engagement` audit row. |
| G-2 Manager assigns/unassigns seller through the UI | Seed pre-assigns sellers; no browser flow exercises `Gestionar vendedores`. | High — covers `manager assigns seller` audit row + complements seller-permission proof. |
| G-3 Manager creates movement through the UI (independent of the 20.13 outcome scenario) | Test 10 covers movement-with-outcome; no test exercises a plain status update without outcome. | Medium — covers `manager creates movement/status update`. |
| G-4 Manager requests a new document through the UI (request creation, not just review) | Owner upload + manager review covered; the manager-side request creation flow is not. | High — covers `manager requests document`. |
| G-5 Document rejection path | Approve covered (test 11), reject is not. | High — completes `manager approves/rejects document`. |
| G-6 WhatsApp contact link priority + tracking | No browser test follows the WhatsApp link logic from property → owner contact → tracking event. | Medium — covers the `WhatsApp contact link` audit row. |
| G-7 Tenant limit exceeded error surfaces in the user UI | API blocks correctly (covered in unit tests); browser UX of "you hit the limit" is not exercised. | Medium — covers `tenant suspended/limit behavior` row. |

## Scope

- Add new Playwright seeded smoke tests covering G-1 through G-7. Reuse the existing demo tenant seed and fixtures wherever possible; extend the seed only when a UI flow needs a new prerequisite that is not otherwise creatable through the browser.
- Keep the suite serial (`fullyParallel: false, workers: 1` per `playwright.seeded.config.ts`). Each new test continues the convention of fresh `page` context per test.
- Place new tests in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` next to the existing scenarios for cohesion, OR split into a new file `viewpro-app/apps/app-new/tests/seeded/pilot-choreography.spec.ts` if the audit prefers a dedicated story file. The SDD design phase picks the right approach.
- Add a small documentation block (likely a Markdown table) at the top of the test file or in `viewpro-app/apps/app-new/tests/seeded/README.md` mapping each test to the audit row it proves.
- Confirm the entire run is reproducible from a fresh `pnpm demo:seed` followed by `pnpm --filter next-shadcn-dashboard-starter test:seeded`. The whole sequence must be runnable from a single command without manual intervention.

## Out of scope

- New product features. If a flow has a missing UI piece, this slice may add the minimal wiring to expose it, but it must not introduce new product behavior. Any such addition is flagged in design as a `Minimal UI wiring required` note for review.
- Refactoring or rewriting any existing test.
- The 26.2 deterministic seed contract or the 26.2.1 image fixtures. They stay frozen.
- The existing API 403 guard for direct seller `STATUS_CHANGE` mutations.
- Security / isolation regression (that is Stage 26.4).
- Staging deploy or InmoView domain handoff (Stages 26.5 / 26.5a).

## Preserve unchanged

- All current Playwright tests in `demo-smoke.spec.ts` continue to pass without edits. New tests are additive.
- The seed contract: `pnpm demo:seed` produces the same canonical output. Any new seed fixture is appended, not substituted.
- The `playwright.seeded.config.ts` ports, server commands, and serial execution model.

## Affected areas

- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (or a new sibling file per design decision).
- `viewpro-app/apps/app-new/tests/seeded/README.md` (new or extended) for the audit-row trace table.
- Possibly `viewpro-app/apps/api/scripts/seed-demo.mjs` (additive only; only when a UI flow demands a prerequisite that the browser cannot create from a clean state).
- This OpenSpec change folder.

## Safety and integrity constraints

- New tests must not depend on wall-clock time beyond the `pnpm demo:seed` baseline. Any fixture that crosses time boundaries must use a 10-year window per the 2026-06-15 lesson learned (engram #4121).
- Tests must never bypass authorization or guards. The pilot workflow has to flow through the same paths a real user would walk.
- Tests must not modify the API 403 guard contract.
- Each test must clean up after itself or rely on fresh `page` context; cross-test state leak is forbidden.

## Risks

- **Suite duration creeping past 2 minutes** as 7 new tests are added. Mitigation: each test gets a soft target of <10s; design must call out any test that exceeds that and justify it.
- **Flaky time-bound assertions**: a UI element that depends on relative time strings ("hace 2 horas") can drift. Mitigation: prefer asserting structural elements over time-relative copy.
- **UI wiring missing for a flow**: G-7 (tenant limit error surface) might not have a UI today; if so, the design phase calls it out as `Minimal UI wiring required` and decides whether to implement here or punt to a follow-up. The proposal does not pre-commit either direction.
- **Test pollution of the demo DB**: if a new test creates persistent state, subsequent tests must tolerate it OR the test must be the last in its serial group OR the test must clean up. Mitigation: design picks one strategy and enforces it.
- **Owner invitation expiry-style time bombs**: any new fixture with TTL needs the wide-window treatment.

## Rollback

Delete the new tests, revert any seed appendages, revert this OpenSpec change folder. The pre-existing 13/13 baseline remains intact.

## Success criteria

- The full `test:seeded` suite passes with at least **20 tests** green (13 existing + ≥7 new) in a single reproducible run, under 2 minutes wall-clock on the same dev box that runs PR #158 today.
- Every audit-listed pilot flow has at least one test reference recorded in the README trace table.
- A new pilot can be demoed with one terminal command sequence: `pnpm demo:seed && pnpm --filter next-shadcn-dashboard-starter test:seeded` and have no manual steps in between.
- The 26.2 deterministic seed contract, the 26.2.1 image fixtures, and the API 403 guard are all unchanged.
- No new product features were introduced beyond explicitly-flagged `Minimal UI wiring required` items, which the design phase enumerates and the apply phase commits to a single dedicated commit each.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted. The spec phase converts G-1..G-7 into testable functional requirements with Given/When/Then scenarios mapped 1:1 to audit rows.
