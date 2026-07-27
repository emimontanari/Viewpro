# Proposal — Stage 26.4 Security and Isolation Regression

**Status:** proposed, ready to enter SDD `sdd-spec` after acceptance.
**Origin:** `docs/plans/2026-06-04-final-mvp-execution-plan.md` Phase 7 (canonical) and `docs/plans/2026-06-14-mvp-execution-plan-revision.md` Phase E. Builds on the 22/22 seeded smoke baseline restored by Stage 26.3 (PR #161).
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase E, slice E1.

## Slice contract

```txt
Stage: 26
Slice: 26.4 — Security and isolation regression
Objective: prove that no role, surface, or tenant can read or mutate resources outside its declared scope.
Evidence needed: a focused suite of negative API and seeded UI tests that exercise each isolation boundary the audit listed and asserts the expected denial response.
Do not touch: schema, permission semantics, the API 403 guard, the 26.2 deterministic seed contract, the 26.2.1 image fixtures, or any product UI beyond minimal wiring if a denial path lacks an error surface.
Done: every listed isolation boundary has at least one automated test that proves the denial; the test suite is reproducible from a clean `pnpm demo:seed`.
Next slice: 26.5 — Staging/deploy checklist.
```

## Problem

Stages 22.8 (closed by evidence), 20.10, 20.13, and 26.3 prove the **positive** flows: managers can manage, sellers can sell, owners can own, and the workflow plumbing is sound end-to-end. None of those slices systematically proves the **negative**: that the system rejects what it must reject.

The Stage 26.0 audit listed seven isolation boundaries that must hold before a pilot demo:

- cross-tenant denial (no `tenant A` user sees `tenant B` data),
- seller unassigned denial (a seller never sees an unassigned property),
- owner unauthorised access (an owner cannot reach a property they do not own),
- notification surface isolation (dashboard notifications never reach the owner surface; owner notifications never expose dashboard links),
- private document URL privacy (signed URLs cannot be guessed; unauthorised users cannot fetch document bytes),
- admin scope (a `VIEWPRO_ADMIN` can administer tenants but cannot browse private tenant content),
- status change request scope (a seller cannot see or act on another tenant's requests, an owner sees none).

Some of these are partially covered by existing API integration tests, but coverage is uneven, the responses are not consistently asserted, and the audit's UX expectations (no information leak through error messages) are not verified.

## Coverage baseline (2026-06-15)

From a quick review of the current test base (no exhaustive run for this proposal — the audit will be done by `sdd-spec`):

| Boundary | Today | Gap |
|---|---|---|
| Cross-tenant API denial | Partially asserted in some module e2e specs | No central catalogue; mixed `403` vs `404` |
| Seller unassigned (API) | Covered for movements; uneven elsewhere | Property reads, document requests, status change requests need consistent proof |
| Seller unassigned (UI) | Test 2 + 3 in seeded smoke assert assigned-only listings | No test asserts a direct deep link to an unassigned property is denied |
| Owner unauthorised | Owner portal lists property scope correctly | Direct deep link, document URL, and notification routes need negative proof |
| Notification surface | Owner/internal model is split and the sanitiser is tested in unit | E2E proof that a manager cannot see an owner-only notification, and vice versa, is missing |
| Document URL privacy | Signed URLs exist; some tests assert ownership | No test attempts to fetch a document URL as an unauthorised user |
| Admin scope | Admin tenant-status flow tested | No test attempts to fetch tenant-private content as `VIEWPRO_ADMIN` |
| `StatusChangeRequest` scope | 20.10 PR 1 tests partially cover | No cross-tenant negative for the bandeja endpoint |

## Scope

- Add a focused **security regression** test file:
  - `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts` — central API negative-test catalogue. Each test names the boundary it proves and the audit row.
- Extend the seeded Playwright smoke with a small **isolation** block that proves the UI-layer denials a manual reviewer would do during a demo:
  - cross-tenant deep link denial,
  - unassigned-seller deep link denial,
  - owner deep link denial,
  - notification surface deep link denial.
- Document and standardise the **response convention**:
  - `404` for resource lookups across tenant or unrelated owners (no existence leak).
  - `403` for explicit role/permission denial within the same tenant where existence is already disclosed (e.g., seller acting on a known-visible property they are not assigned to but inside their tenant).
  - The design phase chooses the exact split per endpoint by reviewing the existing guards.
- If a denial path **lacks an error surface** in the UI (e.g., a deep link to an unauthorised page renders a blank screen), the slice may add the **smallest possible 404 or "no tenés acceso" component** so the test has something to assert. Each such addition is flagged in design as `Minimal UI wiring required` and is review-visible.
- Add a README section at `viewpro-app/apps/app-new/tests/seeded/README.md` and `viewpro-app/apps/api/test/README.md` (or create the file) trace-mapping each test to its audit row.

## Out of scope

- New product features beyond minimal denial-surface UI flagged above.
- Changes to permission semantics, role definitions, or the `TenantRole` enum.
- Changes to the API 403 guard for direct seller `STATUS_CHANGE` mutations.
- The 26.2 deterministic seed contract or the 26.2.1 image fixtures.
- Stage 26.5 (deploy checklist), 26.5a (InmoView domain), or any later slice.
- Cryptographic review of the signed-URL scheme. This slice asserts behaviour at the HTTP boundary only.
- Refactoring existing guard code.

## Preserve unchanged

- All current positive tests must continue to pass without edits.
- The 22/22 seeded smoke baseline stays at ≥22 tests (any new isolation tests are additive).
- `pnpm demo:seed` produces the same canonical output; only additive fixtures if a negative test needs a second-tenant fixture.

## Affected areas

- `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts` (new).
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` (extended with an isolation block; or a sibling file if design prefers).
- Possibly `viewpro-app/apps/api/scripts/seed-demo.mjs` (additive only; a second-tenant fixture if needed to assert cross-tenant denials without crafting tokens at runtime).
- Possibly `viewpro-app/apps/app-new/src/app/...` (minimal denial component if a route currently renders blank for unauthorised access).
- `viewpro-app/apps/app-new/tests/seeded/README.md` and `viewpro-app/apps/api/test/README.md` for the audit-row trace.
- This OpenSpec change folder.

## Safety and integrity constraints

- Tests must never bypass authorization (no internal-only headers, no DB shortcuts). Each negative test calls the real BFF or API endpoint exactly as an attacker would.
- A negative test must assert both the status code AND the absence of leaked content (no error message that includes the targeted resource id, owner email, or tenant name).
- Any new seed fixture follows the 10-year-window pattern learned from PR #159 if it has a TTL.
- Tests run within the existing serial Playwright suite (`fullyParallel: false, workers: 1`) and the existing Vitest API suite.

## Risks

- **Existing guards inconsistently return 403 vs 404.** Mitigation: design audits the actual responses and lists the canonical mapping before tasks start; any per-endpoint deviation is documented or fixed within scope.
- **A denial path renders blank in the UI.** Mitigation: design flags each missing surface as `Minimal UI wiring required`; apply implements the smallest possible 404/no-access component.
- **Cross-tenant fixtures expand the seed.** Mitigation: design decides whether a second-tenant seed entry is needed or if existing fixtures plus runtime-created tokens are sufficient. Only additive seed entries are allowed; no rewrite.
- **Test bloat.** Each boundary needs only one or two tests; design caps the number per boundary to keep the suite under 2 minutes.
- **False sense of security from happy-path assertions.** Mitigation: each negative test must FAIL when the corresponding guard is removed; design includes a sanity step where the apply phase verifies one such inversion locally before committing.

## Rollback

Delete the new test files, revert any minimal denial-surface component, revert any seed appendages, revert this OpenSpec change folder. The pre-existing baselines (619 API tests, 22 seeded smoke tests, 403 app-new unit tests) remain intact.

## Success criteria

- A new central API negative-test file proves the 7 isolation boundaries with at least one test each, each test naming its audit row.
- The seeded Playwright suite gains a small isolation block proving the UI denial paths.
- The total seeded suite stays under 2 minutes wall-clock; the API suite gains <30s.
- Each negative test asserts both the status code AND the absence of resource detail leak.
- Any added denial-surface UI is minimal, flagged in design, and review-visible.
- The 22/22 positive seeded baseline holds; existing 619 API tests stay green.
- A trace table in the test READMEs maps each test to its audit row.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted. The spec phase converts the 7 boundaries into testable FRs with Given/When/Then scenarios mapped 1:1 to audit rows and to the canonical 403/404 response per endpoint.
