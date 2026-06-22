# Design — Stage 24.5 Notification Routing E2E

## Status

Draft — 2026-06-22. Companion to:

- Proposal: `openspec/changes/24-5-notification-routing-e2e/proposal.md`
- Engram: `sdd/24-5-notification-routing-e2e/proposal`, `sdd/24-5-notification-routing-e2e/design`

## Scope recap

Test-only evidence slice with a conditional production-fix branch. Add a new
`owner-notifications.e2e-spec.ts` at parity with the existing internal
`notifications.e2e-spec.ts`, proving the OWNER surface against a real DB — including the
`ownerScopeWhere` active-owner-access AND/OR filter (the central unproven risk). Add 2 seeded
Playwright tests proving mark-read + reload persistence for owner and manager, with `afterEach`
API cleanup so T07/T08 count assertions stay green. If the new owner spec reveals a real bug in
`ownerScopeWhere`, the fix is in-scope (slice becomes hybrid evidence+fix). Out of scope:
deep-linking precision (24.6), realtime/SSE, push/email, new types, producer changes, UI redesign,
seed change, schema migration. This slice asserts TODAY's link destinations only
(`/owner`, `/owner/properties/{propertyAssetId}`); 24.6 owns changing them.

---

## Grounding facts (confirmed against source)

These drive every decision below.

- **`ownerScopeWhere`** (`prisma-notifications.repository.ts:29-68`) scopes by `recipientUserId` +
  `surface: OWNER`, then ANDs 4 OR-guards — one per nullable FK on `Notification`:
  - `propertyAssetId` → `propertyAsset.owners.some({ userId, accessStatus: ACTIVE })`
  - `propertyEngagementId` → `propertyEngagement.propertyAsset.owners.some(...)`
  - `documentRequestId` → `documentRequest.propertyEngagement.propertyAsset.owners.some(...)`
  - `movementId` → `movement.propertyEngagement.propertyAsset.owners.some(...)`
  Each branch passes trivially when its FK is null; the access check fires only when the FK is set.
- **`Notification` FKs are all nullable** (`schema.prisma:578-590`): `propertyEngagementId`,
  `propertyAssetId`, `documentRequestId`, `movementId`. The internal e2e `seedNotification` helper
  (`notifications.e2e-spec.ts:320-344`) **never sets them**, so every OR-guard in the owner clause
  would short-circuit on `null` — which is exactly why the existing coverage proves nothing about
  the access filter. The new spec MUST seed at least one notification with a non-null FK pointing at
  a property the recipient does NOT have ACTIVE access to.
- **`PropertyAssetOwnerAccessStatus`** (`schema.prisma:64-68`) = `INVITED | ACTIVE | REVOKED`,
  default `INVITED`. Non-ACTIVE = `INVITED` or `REVOKED`.
- **`PropertyAssetOwner`** (`schema.prisma:310-332`) requires `propertyAssetId`, `ownerEmail`,
  `ownerFirstName`, `ownerLastName`; `userId` is nullable; `@@unique([propertyAssetId, userId])`.
- **`PropertyAsset`** (`schema.prisma:278-308`) requires `title`, `addressLine`, `city`, `province`,
  `propertyType`, `createdByUserId`.
- **Owner controller** (`owner-notifications.controller.ts:21-68`) is `@UseGuards(AuthGuard)` ONLY —
  no tenant header, no permission guard. Routes: `GET /api/owner/notifications`,
  `GET /api/owner/notifications/unread-count`, `POST /api/owner/notifications/:id/read` (200),
  `POST /api/owner/notifications/read-all` (200). This weaker guard chain is precisely why the
  repository WHERE clause is the access-isolation invariant.
- **Response shape** (`notification-response.mapper.ts:22-54`): `mapOwnerNotificationResponse` runs
  `sanitizeOwnerNotificationLink({ linkHref, propertyAssetId })`; the response exposes
  `id, type, surface, title, body, linkHref, readAt, createdAt, refs{...}` and does NOT expose
  `tenantId` / `recipientUserId`.
- **Owner link allowlist** (`notification-link.helper.ts:33-56`): `/owner` and
  `/owner/properties/{propertyAssetId}` only; anything else (including `/dashboard*`) → `null`.
- **Internal e2e harness** (`notifications.e2e-spec.ts`): boots the real app via `createApiApp()`,
  uses a real `PrismaService`, wipes tables in `beforeEach` (FK-order delete, lines 23-37),
  registers sessions via `POST /api/auth/register-tenant` returning `{ agent, userId, tenantId }`,
  closes app in `afterAll`. This is the harness to reuse verbatim.
- **Seeded smokes** T07 (`demo-smoke.spec.ts:205-228`, manager) and T08 (`:230-288`, owner) assert
  listing + unread-count presence only. Neither marks read. `tests/seeded/` runs serial
  (`mode: 'serial'`, workers: 1). T20 already demonstrates the title-guarded `afterEach` restore
  pattern (`:1028-1053`).

---

## Decisions

### D1 — Negative fixture for the active-owner-access filter: seed BOTH a cross-property record AND an inactive-access record (insert separate records; do not mutate the positive owner)

**Chosen.** In a dedicated `it(...)` block, seed three `PropertyAsset` rows and the recipient's
`PropertyAssetOwner` links, then seed three OWNER notifications carrying a non-null `propertyAssetId`:

1. **Positive (must be returned):** asset A + `PropertyAssetOwner{ userId: recipient, accessStatus: ACTIVE }`; notification → `propertyAssetId: A`.
2. **Inactive-access branch (must be filtered):** asset B + `PropertyAssetOwner{ userId: recipient, accessStatus: REVOKED }` (also assert a second variant with `INVITED` if cheap); notification → `propertyAssetId: B`, `recipientUserId: recipient`.
3. **Cross-property branch (must be filtered):** asset C + `PropertyAssetOwner{ userId: OTHER user, accessStatus: ACTIVE }` (recipient has NO link to C at all); notification → `propertyAssetId: C`, `recipientUserId: recipient`.

Assert the list returns exactly `[A]` and `total: 1`, and that the `unread-count` reflects only A.

**Why this is the least invasive seam that still exercises BOTH branches.** The 4 OR-guards
collapse to one access predicate: `propertyAsset.owners.some({ userId: recipient, accessStatus: ACTIVE })`.
There are exactly two ways that predicate returns false for a recipient-addressed notification:
(a) a link row exists but is NOT `ACTIVE` (inactive-access branch — fixture 2), and (b) NO matching
link row exists for this recipient on that asset (cross-property branch — fixture 3). Seeding both as
**separate** records is the minimal seam: each record isolates one failure mode, so a green assertion
names exactly which branch held. The asset-level branch (`propertyAsset`) is the simplest of the four
guards and is sufficient to prove the access predicate; the engagement/documentRequest/movement
guards reuse the identical `activeOwnerAccess` object through deeper relation paths (D1b covers their
relation-path proof).

**Rejected — mutate `accessStatus` to non-ACTIVE on an existing PropertyAssetOwner (in place).**
Mutating the positive owner's status would destroy the positive case in the same block (you can't
assert A is returned AND that the same row is filtered). You would need a second positive owner
anyway, so mutation buys nothing and makes the fixture's intent ambiguous. Separate inserts are
clearer and let both branches coexist in one assertion.

**Rejected — rely on a single combined record that is both cross-property and inactive.** A record
that is simultaneously cross-property and inactive cannot distinguish which guard rejected it. If a
future bug flips one branch but not the other, a combined fixture would still pass green and hide the
leak. Two separate records keep the branches independently falsifiable (R5 parity + R1 core risk).

### D1b — Relation-path proof: one record per deeper FK guard, behind ACTIVE access only

**Chosen.** To prove the deeper three guards traverse the correct join path (not just the
asset-level guard), add ONE positive record per deeper FK on the **ACTIVE** asset A and assert each
is returned:

- `propertyEngagementId` → engagement on A.
- `documentRequestId` → document request on engagement on A.
- `movementId` → movement on engagement on A.

This is cheap (asset A already seeded) and proves the relation path resolves. We do NOT need a
negative variant for each deeper guard — the asset-level negative fixtures (D1) already prove the
shared `activeOwnerAccess` predicate rejects correctly; the deeper records prove the join path
reaches that same predicate. Keeping deeper-guard coverage to positive-only bounds the fixture size
while still exercising all four relation paths against a real DB.

**Rejected — full 4×2 matrix (positive + negative for every guard).** Eight FK fixtures plus their
engagement/request/movement scaffolding roughly triples the seed surface for marginal extra
confidence; the predicate under test is shared, so the asset-level negatives already cover the
rejection logic. If D1/D1b surface a path bug, the conditional fix branch (D9) re-proves with the
exact failing record. Defer the full matrix unless a bug is found.

### D2 — e2e harness reuse: copy the internal harness structure into a new sibling spec; do NOT extract a shared helper

**Chosen.** `viewpro-app/apps/api/test/owner-notifications.e2e-spec.ts` (NEW) reuses the internal
spec's harness **by mirroring its structure**: same `beforeAll` env + `createApiApp()` boot, same
`PrismaService` acquisition, the same FK-ordered `beforeEach` delete block
(`notifications.e2e-spec.ts:23-37`), the same `afterAll` close, the same `registerTenantSession`
helper (each owner spec creates its own users via `POST /api/auth/register-tenant`), and an extended
local `seedNotification` that additionally accepts `propertyAssetId` / `propertyEngagementId` /
`documentRequestId` / `movementId`. Two new local helpers, `seedPropertyAsset(createdByUserId)` and
`linkOwner(propertyAssetId, userId, accessStatus)`, build the negative-fixture scaffolding.

**Why no shared extraction.** The internal harness uses `request.agent` over the SAME app instance
and a per-file `beforeEach` wipe. Extracting a shared `setup-notifications-e2e.ts` would couple two
specs that may evolve independently and would force a refactor of the existing passing internal spec
(explicitly "preserve unchanged" in the proposal). Vitest e2e specs in this repo each own their app
lifecycle; mirroring is the established convention (the internal spec itself inlines its helpers).
The duplication is bounded (~40 lines of harness) and keeps the new spec self-contained and
reviewable in isolation. This honors `arch-single-responsibility` without a premature abstraction.

**Note on auth/tenant.** The owner controller is `AuthGuard`-only, so a registered user is
authenticated regardless of tenant membership. `register-tenant` is reused because it is the only
existing path that mints an authenticated agent + a `userId`; the `tenantId` it returns is incidental
for the owner surface (owner scoping is by `recipientUserId`, never tenant). The unauthenticated case
asserts `GET /api/owner/notifications` → **401** with NO agent (parity with the internal 401), and
there is NO 403 "tenant context required" case — that guard does not exist on the owner controller.

### D3 — Seeded mark-read isolation: title-guarded `afterEach` that restores `readAt` via the API, capturing the exact pre-test state per touched record

**Chosen.** Follow the T20 pattern (`demo-smoke.spec.ts:1028-1053`): a single `test.afterEach`
guarded by `testInfo.title` so it runs ONLY for the two new mark-read tests. The restoration strategy
is **capture-then-restore by re-asserting the seed contract**, not blind re-read:

- **Owner mark-one-read test (T-NEW-1):** the seeded owner state is DOCUMENT_REQUESTED **unread**
  (`readAt: null`) and DOCUMENT_REJECTED **read**. The test marks the DOCUMENT_REQUESTED notification
  read. Restoration: there is no public "mark-unread" endpoint, so the test captures the notification
  `id` it mutated and the `afterEach` issues a direct restore. Because the seed is deterministic
  (26.2 contract) and the only mutation is `readAt: null → timestamp` on ONE known record, the
  `afterEach` restores by re-running the demo seed's notification fix for that record. **Mechanism:**
  the cleanup calls a thin test-only restore — see D3-mechanism below — keyed by the captured `id`,
  setting `readAt` back to `null`.
- **Manager mark-all-read test (T-NEW-2):** marks all internal read; seeded manager state is
  DOCUMENT_UPLOADED **unread** + MOVEMENT_CREATED **read**. Restoration must set DOCUMENT_UPLOADED
  back to `readAt: null` (MOVEMENT_CREATED was already read, so it is untouched by the contract).
  The `afterEach` captures, before mutation, the set of currently-unread internal notification `id`s
  for the manager (via `GET /api/notifications?unreadOnly=true`), and on teardown restores exactly
  those ids to `readAt: null`.

**Capture timing.** State is captured at the START of each test (the unread `id` set from the
unread-only list endpoint) and stored in a module-scoped variable, mirroring how T20 stores
`t20TenantId`. The `afterEach` reads that captured set and restores only those ids. This makes the
restore idempotent and independent of test ordering — satisfying the proposal's "state isolation via
afterEach, NOT serial ordering" hard requirement (R2).

**D3-mechanism — how to restore `readAt: null` without a mark-unread endpoint.** There is no
product endpoint to un-read a notification. Two viable seams, decision below:

- **Chosen seam: direct DB restore via the API app's seed/admin path is NOT available to Playwright**
  (Playwright talks HTTP only). Therefore the restore runs through a **seeded test-only reset**: the
  cleanup calls `pnpm demo:seed`-equivalent is too heavy per-test. Instead, capture the mutated ids
  and restore them through the **owner/internal notification rows directly is not HTTP-reachable**.
  The resolved mechanism is: **the `afterEach` re-seeds only the affected notifications' `readAt` to
  null by calling a narrow test-support HTTP route IF one exists; if none exists, the restore falls
  back to running the deterministic demo re-seed of the notifications table.** Because adding a
  test-support route is a production-surface change (out of scope on the happy path), the **default
  mechanism is the deterministic re-seed fallback**, scoped to run only in the title-guarded
  `afterEach`, exactly as T20 documents `pnpm demo:seed` as its hard-kill fallback.

  **Tasks-phase audit required (A4):** before implementing, confirm whether a test-only reset/seed
  HTTP affordance already exists (e.g. a `demo:seed` HTTP trigger or an existing admin/test route).
  If yes, prefer it (lighter than full re-seed). If no, use the documented full-notifications re-seed
  in `afterEach` and DO NOT add a new production route (that would breach the test-only happy path).
  This is the one open mechanism question the tasks phase must close with a grep, not invent.

**Rejected — serial ordering (run mark-read tests last).** The proposal explicitly forbids relying
on ordering (R2). Ordering is fragile: any future test insertion between T08 and the mark-read tests
silently shifts counts. `afterEach` restoration is the contract.

**Rejected — snapshot the entire notifications table and bulk-restore.** Over-broad: it would also
revert unrelated rows that other serial tests legitimately created (e.g. T17 creates a
DOCUMENT_REQUESTED). Restoring only the captured mutated ids is surgical and order-safe.

### D4 — Conditional hybrid decision point: flip to evidence+fix ONLY when an assertion in the new owner e2e spec fails against the real DB on the active-owner-access filter

**Chosen.** The slice stays **test-only** if `owner-notifications.e2e-spec.ts` passes green on first
real-DB run. It flips to **evidence+fix** at exactly this trigger: a D1/D1b assertion fails —
specifically, the list returns a record it must NOT (a leak: inactive-access or cross-property record
appears) OR omits the positive record (over-filtering). The decision point is the **first green/red
result of the new spec**, run before any production edit.

**Minimal fix surface if the WHERE clause is buggy.** The fix is confined to `ownerScopeWhere`
(`prisma-notifications.repository.ts:29-68`) — correcting the specific faulty guard (e.g. a wrong
relation path on the engagement/documentRequest/movement join, or an OR that should be an AND). No
new types, no producer changes, no controller/use-case changes, no schema migration, no refactor of
the surrounding repository methods. The same spec re-runs to green as the proof. If the bug is in a
deeper guard's join path, the fix corrects only that branch's relation traversal. Apply-progress must
record: the failing assertion, the faulty guard, the one-line(s) changed, and the green re-run.

**Likely-vs-unlikely.** The asset-level guard is straightforward and probably correct; the highest
residual risk is a deeper join path (documentRequest → propertyEngagement → propertyAsset → owners)
being mis-specified, since those are only mock-unit-tested today. D1b's positive deeper-FK records
are the tripwire.

### D5 — Assert TODAY's link destinations only (24.6 boundary)

**Chosen.** Link assertions use the CURRENT owner allowlist only: a record with
`linkHref: '/owner/properties/{propertyAssetId}'` AND matching `propertyAssetId` → returned verbatim;
`linkHref: '/owner'` → verbatim; a dashboard-style link (`/dashboard` or `/dashboard/product/...`)
stored on an owner record → sanitized to **null** (cross-surface sanitization case). Add an explicit
code comment in the spec: "Asserts CURRENT 24.5 destinations; Stage 24.6 owns deep-link target
changes — do not update these to document/movement-level hrefs here." (R4 mitigation.)

**Rejected — asserting only `/owner` and skipping the property-link case.** That would miss the
`propertyAssetId`-gated allowlist branch in `sanitizeOwnerNotificationLink` (helper lines 46-53),
under-covering the sanitizer relative to the internal spec's link case (R5 parity).

### D6 — Parity case map locked against the internal spec

**Chosen.** The owner spec mirrors the internal spec case-by-case (cross-checked before tagging done):

| Internal case (`notifications.e2e-spec.ts`) | Owner spec equivalent |
|---|---|
| 401 unauthenticated (+403 tenant) (`:43`) | 401 unauthenticated only — owner has no tenant guard (D2) |
| list scoped to tenant+recipient (`:56`) | list scoped to recipient + `surface: OWNER`; excludes INTERNAL surface and other recipients' owner records; PLUS the D1 access-filter exclusions |
| unread filter + count (`:118`) | unread filter + `unread-count` scoped to owner surface; counts only ACTIVE-access records |
| mark-one own→200 / owner-surface→404 / other-user→404 (`:169`) | mark-one own→200; another user's owner record→404; an inactive/cross-property record→404 (mark-read goes through the same `ownerScopeWhere`) |
| mark-all + sanitize (`:215`) | mark-all-read scoped to owner; unread-count→0; cross-surface dashboard link → null |
| invalid query 400 (`:275`) | invalid `page`/`pageSize`/`unreadOnly` → 400 (DTO is shared `ListNotificationsQuery`) |

The owner spec ADDS the D1/D1b active-owner-access cases (no internal equivalent — that is the whole
point of the slice).

### D7 — Workload forecast: single PR, test-only on the happy path

| Surface | Est. LOC |
|---|---|
| `owner-notifications.e2e-spec.ts` (NEW, harness + helpers + ~7 cases + D1/D1b fixtures) | ~260 |
| `demo-smoke.spec.ts` (2 tests + title-guarded `afterEach` + captured-state vars) | ~70 |
| OpenSpec design/spec/tasks/apply-progress | accounted in 24.5 folder |
| Conditional fix (`ownerScopeWhere`) — only if triggered | ~5 |
| **Total (happy path)** | **~330** |

`single_pr_recommended: true`, `size_exception_required: false` on the happy path (~330 < 400 LOC
budget). If the conditional fix triggers, the +~5 production lines stay well under budget. The owner
list scoping is a hot path; if the fix triggers, run the new spec to green before merge (proposal
safety constraint).

---

## Component / data-flow sketch

```text
                         owner-notifications.e2e-spec.ts (NEW)
                                      │  supertest over createApiApp()
                                      ▼
        ┌──────────────────────────────────────────────────────────┐
        │ HTTP: GET/POST /api/owner/notifications[...]               │
        │   OwnerNotificationsController  (@UseGuards AuthGuard ONLY)│
        └───────────────────────────────┬──────────────────────────┘
                                         ▼
        ┌──────────────────────────────────────────────────────────┐
        │ List/Count/MarkOne/MarkAll OwnerNotifications use-cases    │
        │   → mapOwnerNotificationResponse                           │
        │       → sanitizeOwnerNotificationLink({linkHref,           │
        │                                         propertyAssetId})  │  ← D5 link case
        └───────────────────────────────┬──────────────────────────┘
                                         ▼
        ┌──────────────────────────────────────────────────────────┐
        │ PrismaNotificationsRepository.listOwnerForRecipient        │
        │   where = ownerScopeWhere(recipientUserId) + unread filter │
        │   ownerScopeWhere: surface=OWNER AND 4× OR-guard,          │  ← D1/D1b/D4 target
        │     each → propertyAsset.owners.some({userId, ACTIVE})     │
        └───────────────────────────────┬──────────────────────────┘
                                         ▼
        ┌──────────────────────────────────────────────────────────┐
        │ Real Postgres test DB (beforeEach wipe, FK-ordered)        │
        │   Fixtures (D1/D1b):                                       │
        │     A: PropertyAsset + Owner{recipient, ACTIVE}  → SEEN    │
        │     B: PropertyAsset + Owner{recipient, REVOKED} → HIDDEN  │
        │     C: PropertyAsset + Owner{OTHER, ACTIVE}      → HIDDEN  │
        │     + deeper-FK positives on A (engagement/req/movement)  │
        └──────────────────────────────────────────────────────────┘

Seeded persistence proof (Playwright, tests/seeded/demo-smoke.spec.ts):
  T-NEW-1 owner   : capture unread ids → POST /api/owner/notifications/:id/read
                    → re-fetch → assert readAt non-null → afterEach restore readAt:null  (D3)
  T-NEW-2 manager : capture unread ids → POST /api/notifications/read-all
                    → re-fetch unread-count → assert 0 → afterEach restore captured ids   (D3)
```

---

## Pre-implementation audit (tasks phase MUST run before any code)

Paste outputs into apply-progress. Any unexpected count blocks apply.

```text
A1) fd owner-notifications.e2e-spec.ts viewpro-app/apps/api/test
    Expected: NO match (spec does not exist yet). If it exists, STOP — re-scope.

A2) rg "register-tenant|registerTenantSession|createApiApp|seedNotification" \
       viewpro-app/apps/api/test/notifications.e2e-spec.ts
    Expected: the harness symbols to mirror (createApiApp boot, registerTenantSession at :301,
    seedNotification at :320). Confirms the reuse surface before copying.

A3) rg "ownerScopeWhere|activeOwnerAccess|accessStatus" \
       viewpro-app/apps/api/src/notifications/prisma-notifications.repository.ts
    Expected: 1 declaration of ownerScopeWhere (:29), used by listOwnerForRecipient (:186),
    countUnreadOwnerForRecipient (:208), markOwnerRead (:219), markAllOwnerRead (:243).
    Confirms all four owner read/mutate paths share the clause under test.

A4) rg -n "demo:seed|seed-demo|test-support|reset.*notification" \
       viewpro-app/apps/api viewpro-app/apps/app-new/tests
    Purpose: D3-mechanism decision. Determine whether a test-only reset/seed affordance reachable
    over HTTP already exists. If yes → use it in afterEach. If no → use the documented full
    notifications re-seed fallback and DO NOT add a production route.

A5) rg -n "PropertyAssetOwnerAccessStatus|accessStatus" \
       viewpro-app/apps/api/prisma/schema.prisma
    Expected: enum at :64-68 (INVITED|ACTIVE|REVOKED), accessStatus field at :318.
    Confirms the non-ACTIVE values available for the negative fixture (REVOKED / INVITED).

A6) rg -n "mode: 'serial'|test.afterEach|t20TenantId|testInfo.title" \
       viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts
    Expected: serial config at :55, the T20 title-guarded afterEach at :1028.
    Confirms the afterEach restoration pattern to mirror for D3.
```

---

## Risks

- **R1 (core) — `ownerScopeWhere` unproven against a real DB.** Mock unit tests can't catch a wrong
  relation join or a leaking OR. Mitigation: D1/D1b seed must-not-see records (inactive REVOKED +
  cross-property) and positive deeper-FK records, asserting exact inclusion/exclusion. If it leaks,
  D4 activates the conditional fix.
- **R2 — `afterEach` restore incomplete → T07/T08 break.** HIGH likelihood per proposal. Mitigation:
  D3 captures the exact pre-test unread `id` set and restores only those, title-guarded, idempotent,
  order-independent. Verify T07/T08 green in the same run before tagging done.
- **R3 — D3 restore mechanism (no mark-unread endpoint).** Restoring `readAt:null` over HTTP has no
  product endpoint. Mitigation: A4 audit resolves the seam; default is the documented full
  notifications re-seed fallback (same posture as T20's `pnpm demo:seed` fallback) — never a new
  production route on the happy path.
- **R4 — asserting 24.6 deep-link destinations by mistake.** Mitigation: D5 asserts current
  `/owner/properties/{propertyAssetId}` + `/owner` only, with an explicit 24.6-boundary comment.
- **R5 — parity drift from the internal spec.** Mitigation: D6 locks the case map; cross-check before
  done. Owner spec is internal cases minus the tenant-403 case (no such guard) plus the access-filter
  cases.
- **R6 — conditional fix scope creep.** Mitigation: D4 confines any fix to the faulty guard in
  `ownerScopeWhere`; no refactor, no new types, re-proven by the same spec.
- **R7 — e2e fixture FK-order / cascade.** The `beforeEach` delete order matters (notifications →
  documentVersion → document → documentRequest → movement → propertyAgent → propertyEngagement →
  propertyAssetOwner → propertyAsset → ...). Mirror the internal spec's exact order; the new
  PropertyAsset/PropertyAssetOwner fixtures slot into the existing wipe (both already deleted at
  `:31-32`).

---

## Delivery flags

- `single_pr_recommended: true`
- `size_exception_required: false`
- `chain_strategy: not applicable`
- `delivery_strategy: ask-on-risk → single-pr (test-only happy path, ~330 LOC < 400; conditional fix adds ~5 LOC if triggered)`
