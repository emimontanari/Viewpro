# Apply Progress — Stage 26.4 Security and Isolation Regression

**Status**: DONE (all 29 tasks complete)
**Mode**: Strict TDD (RED/GREEN confirmed for T-N4)
**PR strategy**: Single PR with `size:exception` (~970 lines total including READMEs)
**Branch**: `feat/stage-26-4-security-isolation-regression`

---

## Commit Groups Summary

### Commit A — `chore(api): add isolation tenant seed fixture and resetTenantBySlug helper (26.4 commit A)`

Files:
- `openspec/changes/26-4-security-isolation-regression/spec.md` — 4 spec patches (B-1, B-7, MUI-1, MUI-2)
- `viewpro-app/apps/api/scripts/seed-demo.mjs` — isolation tenant fixture + resetTenantBySlug helper

Seed shape:
- `viewpro-isolation-tenant` tenant (ACTIVE)
- 1 manager: `manager.isolation@viewpro.local`
- 1 owner: `propietario.isolation@viewpro.local` (ACTIVE access to isolation asset)
- 1 `PropertyAsset` (title "Propiedad isolation")
- 1 `PropertyEngagement` (CAPTURE, USD, price 1)
- No agents, movements, notifications, documents

Reset: `resetTenantBySlug(slug, knownUserEmails)` — shared helper; FK-safe deletion order.
Idempotency: verified by running `pnpm demo:seed` twice in succession (exit 0 both times).
T-5 sanity: demo tenant 20 engagements, isolation tenant 1 engagement — enforced in seed output and as a hard assert.

### Commit B — `test(api): add security-isolation.e2e-spec.ts with 13 negative tests covering B-1..B-7 (26.4 commit B)`

File:
- `viewpro-app/apps/api/test/security-isolation.e2e-spec.ts`

Tests (13 total, part of 632 total passing):
- S-1, S-2 (B-1 cross-tenant)
- S-3, S-4 (B-2 seller unassigned)
- S-6 (B-3 owner unowned)
- S-8, S-9 (B-4 notification surface)
- S-10, S-11 (B-5 document URL privacy)
- S-12, S-13 (B-6 admin scope)
- S-14 (B-7 SCR unassigned)
- T-13 (B-1 extra — cross-tenant SCR bandeja)

No-leak approach: NestJS error bodies include a `path` field echoing the request URL (framework behavior, not a data leak). The `expectNoLeak` helper asserts resource *content* (title, email, tenant slug) is absent — not the URL path. Decision documented per test via comments.

Runtime title derivation (T-6/S-8): `SEEDED_OWNER_NOTIFICATION_TITLES` is derived at runtime via `GET /api/owner/notifications` in `beforeAll`. No hardcoded titles.

### Commit C — `test(app-new): add seeded UI isolation block + READMEs + apply-progress (26.4 commit C)`

Files:
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — isolation block (U-1, U-2)
- `viewpro-app/apps/app-new/tests/seeded/_helpers.ts` — `signInSellerWithTenantContext` helper
- `viewpro-app/apps/app-new/tests/seeded/README.md` — 2 new audit rows
- `viewpro-app/apps/api/test/README.md` — 13-row audit trace for the API catalogue
- `openspec/changes/26-4-security-isolation-regression/tasks.md` — all tasks marked [x]
- `openspec/changes/26-4-security-isolation-regression/apply-progress.md` (this file)

---

## Test Count Delta

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| API e2e (Vitest) | 619 | 632 | +13 |
| app-new unit (Vitest) | 403 | 403 | 0 |
| Seeded E2E (Playwright) | 22 | 24 | +2 |

All suites GREEN.

---

## Verification Results

| Check | Result |
|-------|--------|
| `db:validate` | PASS |
| `typecheck` (API) | PASS |
| `pnpm --filter @viewpro/api test` | PASS (632/632) |
| `lint:strict` (app-new) | PASS |
| `pnpm --filter next-shadcn-dashboard-starter test` | PASS (403/403) |
| `pnpm demo:seed` (twice) | PASS (idempotent) |
| Seeded E2E (24 tests) | PASS (24/24 in 1.4 min) |

---

## T-N4 Sanity Inversion

**Test chosen**: S-1 (T-7) — "S-1: cross-tenant property engagement read returns 403 and no resource detail"

**Target guard**: `TenantMembershipGuard` in `PropertyEngagementsController`
(`viewpro-app/apps/api/src/property-engagements/property-engagements.controller.ts:50`)

**RED result**: Commented `/* TenantMembershipGuard, */` out → 114 tests FAILED (not just S-1, but all tests that depend on this guard).

**GREEN result**: Restored guard → 632/632 PASSED.

Evidence: removing this guard causes property engagements to be accessible to unauthenticated tenants and the VIEWPRO_ADMIN, directly proving the guard is load-bearing.

---

## Design Deltas Discovered

### MUI-1 actual surface

The design stated `notFound()` fires at `product-view-page.tsx:65`. This is correct but the mechanism differs from the initial doc: when the API returns 404, `getProductById` has `allowedErrorStatuses: [404]` so it returns the error body as data (no throw). The React Query `isError` stays `false`. The data fails `isPropertyEngagement()` → `notFound()` is called at line 64. Result: Next.js `src/app/not-found.tsx` renders ("Something's missing"). The test assertion uses this actual text.

### No-leak: URL path disclosure is acceptable

NestJS error responses include a `path` field with the request URL, which always contains the resource ID. This is inherent to the NestJS global exception filter and reflects only what the requester already sent. The `expectNoLeak` helper was adjusted to only check resource *content* (title, email, tenant slug) — not the echoed URL path. This is documented in the catalogue file and the API README.

---

## Acceptance Trace (S → commit)

| Scenario | Coverage | Commit |
|----------|---------|--------|
| S-1, S-2 cross-tenant | T-7, T-8 (B) | Commit B |
| S-3, S-4 seller unassigned | T-9, T-10 (B) | Commit B |
| S-5 seller deep link | U-1 | Commit C |
| S-6 owner unowned | T-11 (B) | Commit B |
| S-7 owner deep link | U-2 | Commit C |
| S-8 manager notifications | T-12 (B) | Commit B |
| S-9 owner notifications | T-13 (B) | Commit B |
| S-10 unauth doc URL | T-14 (B) | Commit B |
| S-11 owner unowned doc URL | T-15 (B) | Commit B |
| S-12 admin tenant content | T-16 (B) | Commit B |
| S-13 admin access-check | T-17 (B) | Commit B |
| S-14 SCR unassigned | T-18 (B) | Commit B |
| T-13 cross-tenant bandeja | T-19 (B) | Commit B |
| No spec drift | T-1 | Commit A |
| Guard not weakened | T-N4 | Verified locally |
| Existing tests green | T-N1, T-N2, T-N3 | All commits |

---

## Existing tests referenced (not duplicated)

Per design R4:
- `status-change-requests.e2e-spec.ts > S-9` — cross-tenant SCR → 404
- `status-change-requests.e2e-spec.ts > S-11` — unassigned seller SCR → 403

These are referenced in the acceptance map comment at the top of `security-isolation.e2e-spec.ts`. The catalogue tests add the no-leak body assertion that the module spec does not have.
