# Verify Report — Stage 24.5 Notification Routing E2E

## Status
Verified — 2026-06-22.
Mode: hybrid (Engram `sdd/24-5-notification-routing-e2e/verify-report` + this file).
Artifacts read: spec.md, tasks.md, design.md, apply-progress.md (file + Engram #4409).

---

## Verdict: PASS WITH WARNINGS

- CRITICAL: 0
- WARNING: 2
- SUGGESTION: 2

No CRITICAL issues. The slice is test-only (Phase 5 conditional fix NOT triggered; `ownerScopeWhere`
proved correct on first real-DB run). API e2e and lint re-run green this session. Warnings are
documentation drift in tasks.md and one pending environment-gated gate — neither blocks archive.

---

## Test & Lint Evidence (re-run this session)

### API e2e — owner-notifications.e2e-spec.ts (real DB: viewpro_test)
Command (from `viewpro-app/apps/api`): `pnpm vitest run test/owner-notifications.e2e-spec.ts`
Verbatim result:
```
 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  15:38:41
   Duration  3.23s (transform 700ms, setup 30ms, import 1.81s, tests 1.25s, environment 0ms)
```
12/12 pass, including S-A6b (mark-read on REVOKED-access OWNER record → 404). Matches apply-progress.

### Lint — demo-smoke.spec.ts
Command (from `viewpro-app/apps/app-new`): `npx oxlint tests/seeded/demo-smoke.spec.ts`
Verbatim result: `OXLINT_EXIT=0` (exit 0, no findings).

### Seeded Playwright (NOT re-run this session — earlier-session result)
The full seeded suite (32/32, exit 0) was confirmed via a `pnpm test:seeded` run in an EARLIER
session, not re-run now (requires a live seeded server + ~2 min). This report does NOT re-execute it.
Code-level confirmation (this session): T-NEW-1 and T-NEW-2 satisfy FR-B1/FR-B2; the title-guarded
`afterEach` (FR-B3/FR-B4) is present and restores seeded state via full `pnpm demo:seed`.
S-D2 (T07/T08 green) is therefore PENDING on a live-server re-run, but the demo-smoke diff is
128 insertions / 0 deletions and does NOT touch T07/T08 bodies — so no code regression is possible
from this slice (see Regression Guards).

---

## Completeness — Tasks Checklist

All implementation tasks (Phases 1–4, 6 except 6.3) are checked. Phase 5 is correctly SKIPPED
(conditional fix not triggered; FR-C3). Task 6.3 (`test:seeded`) is unchecked — environment-gated,
not a code gap.

| Phase | State |
|-------|-------|
| 1 Pre-implementation audit | All [x] — audit outputs recorded in apply-progress |
| 2 Harness + helpers | All [x] |
| 3 Test cases S-A1..S-A10 + S-A6b | All [x] |
| 4 Seeded Playwright extension | All [x] |
| 5 Conditional fix | All [x] N/A — SKIPPED (FR-C3) |
| 6 Verification gates | 6.1,6.2,6.4–6.8 [x]; 6.3 [ ] PENDING (live server) |

---

## Spec Compliance Matrix (FR → test → result)

### Group A — Owner-Notifications API e2e (12/12 real-DB pass)

| FR | Scenario | Test (owner-notifications.e2e-spec.ts) | Result |
|----|----------|----------------------------------------|--------|
| FR-A1 | S-A1 | `rejects unauthenticated requests with 401` | PASS |
| FR-A2, FR-A10 | S-A2 | `lists only recipient's OWNER-surface notifications and hides sensitive fields` (no tenantId/recipientUserId) | PASS |
| FR-A3, FR-A3a, FR-A3b | S-A3 | `excludes cross-property and inactive-REVOKED notifications…` — asset A ACTIVE (visible), asset B REVOKED (hidden), asset C cross-property no-link (hidden); total:1, unreadCount:1 | PASS |
| FR-A3 (relation paths) | S-A3-D1b | `returns notifications via all four FK relation paths…` — asset/engagement/docRequest/movement all returned (total:4) | PASS |
| FR-A4 | S-A4 | `unread-count excludes INTERNAL-surface…` → unreadCount:1 | PASS |
| FR-A5 | S-A5 | `marks own OWNER notification read…200 with non-null readAt` (ISO string) | PASS |
| FR-A6 | S-A6 | `returns 404 when marking another recipient's OWNER notification read` | PASS |
| FR-A6 (mutation-path predicate) | S-A6b | `returns 404 when marking own OWNER notification read on a REVOKED-access property` | PASS |
| FR-A7 | S-A7 | `marks all OWNER…read; INTERNAL remain unread` → updatedCount:2, unreadCount:0, INTERNAL readAt null in DB | PASS |
| FR-A8 | S-A8 | `sanitizes cross-surface /dashboard/* and external links…to null` | PASS |
| FR-A9 (parity) | S-A9, parity comment block | `supports unreadOnly filter…` + file-top parity table | PASS |
| FR-A9 (invalid query parity) | S-A10 | `rejects invalid list query values with 400` | PASS |

The two negative fixtures genuinely isolate the access predicate: B is a same-recipient REVOKED link
(inactive-access branch) and C is a no-link cross-property record (missing-link branch). They are
independent records, so a green assertion names exactly which branch held — matching design D1's
falsifiability requirement. S-A6b proves the mutation path (`markOwnerRead`) routes through the same
`ownerScopeWhere` predicate.

### Group B — Seeded Playwright persistence (code-verified; runtime from earlier-session run)

| FR | Scenario | Test (demo-smoke.spec.ts) | Result |
|----|----------|---------------------------|--------|
| FR-B1 | S-B1 | `owner mark-one-read persists after re-fetch` — captures unread, POST /read, re-fetch asserts readAt truthy string | CODE-VERIFIED (runtime: earlier-session green) |
| FR-B2 | S-B2 | `manager mark-all-read yields unread-count zero after re-fetch` — signIn(DEMO_EMAIL) NO x-tenant-id header, POST read-all, unread-count 0 | CODE-VERIFIED (runtime: earlier-session green) |
| FR-B3, FR-B4 | both | title-guarded `test.afterEach` (lines ~1045-1074), full `pnpm demo:seed` re-seed with correct DOCUMENT_STORAGE_*/API_PUBLIC_URL env; guard matches both test titles exactly | CODE-VERIFIED |

FR-B2/S-B2 corrected-text consistency CONFIRMED: T-NEW-2 uses `signIn(page, DEMO_EMAIL)` with NO
`x-tenant-id` header — tenant is resolved server-side from the session-selected membership
(BFF auto-selects memberships[0] for the single-tenant demo manager), exactly as the corrected
spec/scenario now describe. The implementation matches the corrected spec, NOT the stale tasks text.

### Group C — Conditional fix
| FR | Result |
|----|--------|
| FR-C1, FR-C2 | N/A — not triggered |
| FR-C3 | SATISFIED — `prisma-notifications.repository.ts` unchanged; no production code in diff |

### Group D — Preservation invariants
| FR | Check | Result |
|----|-------|--------|
| FR-D1 | `git diff notifications.e2e-spec.ts` empty | PASS (unchanged) |
| FR-D2 | demo-smoke diff is 128 insertions / 0 deletions; T07/T08 bodies not in diff | PASS code-side (runtime PENDING live-server re-run = S-D2) |
| FR-D3 | `seed-demo.mjs` not in changed files | PASS (unchanged) |
| FR-D4 | `git diff notification-link.helper.ts` empty | PASS (unchanged) |
| FR-D5 | NotificationsController = AuthGuard,TenantMembershipGuard,PermissionGuard; OwnerNotificationsController = AuthGuard | PASS (unchanged) |
| FR-D6 / S-D3 | only `/dashboard/product/some-engagement-id` + external URL asserted (both → null); no document/movement deep-links | PASS |

---

## Design Coherence
All D1–D7 decisions implemented as designed (per apply-progress "Deviations: None"; spot-checked
against source). D1 separate negative fixtures: confirmed. D1b positive-only deeper FK paths:
confirmed (total:4). D2 self-contained mirrored harness, no shared extraction: confirmed.
D3 title-guarded full re-seed afterEach: confirmed (with JD env-parity fix). D4 not triggered.
D5 24.6 boundary comment present in S-A8. D6 parity table present at file top.

---

## Issues

### CRITICAL
None.

### WARNING
- **W1 — Stale tasks.md text on FR-B2 tenant resolution.** tasks.md task 4.4 still says
  "set `x-tenant-id` header to demo tenant id", which contradicts the corrected FR-B2/S-B2
  (session-based tenant resolution, no client header) AND the actual T-NEW-2 code (no header set).
  The CODE is correct; only the tasks doc is stale. Cosmetic drift, not a behavior defect.
  Fix: update tasks.md 4.4 to drop the x-tenant-id instruction before archive.
- **W2 — S-D2 (T07/T08 green) not re-run this session.** The full seeded Playwright suite was
  green 32/32 in an earlier session but is not re-executed here (needs a live server). Code analysis
  shows it is impossible for this slice to regress T07/T08 (zero deletions, bodies untouched), but
  runtime proof for S-D2 / task 6.3 remains environment-gated. Recommend one live-server `test:seeded`
  pass before final close if a fresh runtime gate is desired.

### SUGGESTION
- **S1 — tasks.md acceptance table labels S-A10 as "invalid query 400" but lists an "S-A10 — invalid query 400" row twice in two places with slightly different wording** (line 133 and the FR map). Harmless; tidy the table for a single source of truth.
- **S2 — Consider adding an INVITED-access negative variant** (design D1 noted it "if cheap").
  Current coverage uses REVOKED only for the inactive-access branch. REVOKED is sufficient to prove
  the `accessStatus !== ACTIVE` rejection, so this is optional hardening, not a gap.

---

## Forbidden-scope check (24.6)
PASS. No document-level or movement-level deep-link destination is asserted. The only link literals
in the owner spec are `/dashboard/product/some-engagement-id` and `https://external.example.com`,
both asserted to sanitize to `null`. The 24.6 boundary comment is present in S-A8.

---

## Recommendation
PASS WITH WARNINGS → proceed to `sdd-archive`. The two warnings (stale tasks text, env-gated S-D2
runtime) do not block archive. Optionally: (1) correct tasks.md 4.4 x-tenant-id text, and
(2) run one live-server `test:seeded` to refresh the S-D2 runtime gate.
