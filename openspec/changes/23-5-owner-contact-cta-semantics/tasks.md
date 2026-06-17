# Tasks: Stage 23.5 — Owner Contact CTA Semantics and Priority Proof

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~234 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single-pr |
| Delivery strategy | ask-on-risk → single-pr (under 400 LOC) |
| Chain strategy | not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All phases in one PR | PR 1 | Backend + frontend + seed + smoke; ~234 LOC |

---

## Phase 1 — Pre-implementation audit

Run BEFORE any code mutation. Paste output into apply-progress audit section. Block apply if any count deviates.

- [x] 1.1 Run `rg 'movement_author' viewpro-app/` — list every occurrence; confirm 18 across 9 files. Any count deviation blocks apply. **Done-when**: table of file:line in apply-progress.
- [x] 1.2 Run `rg "createdBy\.whatsappPhone" viewpro-app/apps/api/src/` — confirm exactly 1 occurrence at `owner-movement.response.ts:25`. **Done-when**: count confirmed in apply-progress.
- [x] 1.3 Run `rg "ownerMovementInclude|ownerEngagementInclude" viewpro-app/apps/api/src/` — confirm single declaration per include. **Done-when**: list of occurrences in apply-progress.
- [x] 1.4 Run `rg "mapMovementAuthorWhatsappContact" viewpro-app/` — list every caller. **Done-when**: all callers listed; confirms blast radius before rename.
- [x] 1.5 Read `owner-whatsapp-contact.ts`, `responses/owner-movement.response.ts`, `repositories/prisma-owner-portal.repository.ts`, `use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts` — record current line numbers and shapes. **Done-when**: actual signatures documented in apply-progress.
- [x] 1.6 Read `seed-demo.mjs` around lines 80-97 and any log-summary lines — confirm adding `whatsappPhone` does NOT shift any count assertion (per D6). **Done-when**: log-line audit confirmed in apply-progress.
- [x] 1.7 Run `rg "'movement_author'" viewpro-app/apps/app-new/src/` — confirm frontend occurrences (expected: `types.ts:49`, `owner-timeline.test.tsx:61,126`, `owner-property-detail.test.tsx:134`, `owner-whatsapp-contact.test.ts:19,115,127`). **Done-when**: all frontend occurrences listed.

---

## Phase 2 — Backend resolver helper and Prisma include (single commit)

Depends on: Phase 1 audit complete.

- [x] 2.1 In `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts`: rename exported function `mapMovementAuthorWhatsappContact` → `mapAssignedSellerWhatsappContact`. Update the signature to accept `agents: Array<{ agentUserId: string; assignedAt: Date; agentUser: { whatsappPhone: string | null } }>`. **Done-when**: old export name removed; new name compiles.
- [x] 2.2 Implement picker logic inside `mapAssignedSellerWhatsappContact`: `if (!agents || agents.length === 0) return unavailableAssignedSellerContact()`. Else take `agents[0]` (SQL-sorted). Validate `whatsappPhone` via `isValidWhatsappPhone` / `MIN_WHATSAPP_DIGITS`. Return `{ available: true, targetType: 'assigned_seller', displayLabel: 'Consultar responsable', whatsappPhone }` on success. **Done-when**: logic matches design resolver pseudocode (D1 + D4).
- [x] 2.3 Rename `unavailableMovementAuthorContact` → `unavailableAssignedSellerContact` (per D2). Ensure it emits `targetType: 'assigned_seller'` and `displayLabel: 'Contacto no configurado'`. **Done-when**: no remaining reference to the old name.
- [x] 2.4 In `prisma-owner-portal.repository.ts`: extend `ownerMovementInclude` with a `propertyEngagement: { select: { agents: { orderBy: [{ assignedAt: 'asc' }, { agentUserId: 'asc' }], select: { agentUserId: true, assignedAt: true, agentUser: { select: { whatsappPhone: true } } } } } }` branch. Confirm relation name against actual Prisma `Movement` model before writing. **Done-when**: include shape matches D3 design; Prisma client regeneration not required (field types already exist).
- [x] 2.5 In `prisma-owner-portal.repository.ts`: extend `ownerEngagementInclude`'s existing `agents.agentUser.select` to add `whatsappPhone: true`. **Done-when**: engagement-header path can also surface seller phone (D3 engagement branch).
- [x] 2.6 In `responses/owner-movement.response.ts:25`: replace call `mapMovementAuthorWhatsappContact(movement.createdBy.whatsappPhone)` with `mapAssignedSellerWhatsappContact(movement.propertyEngagement.agents)` (path per T-2.4 confirmed relation). Update import. **Done-when**: `createdBy.whatsappPhone` no longer read by this mapper; `rg "createdBy.whatsappPhone"` returns 0 in `src/`.
- [x] 2.7 In `use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts`: change `targetType: 'movement_author'` literal to `'assigned_seller'` in the analytics metadata object (D5 — forward-only, no backfill). **Done-when**: no `'movement_author'` literal remains in `src/`.
- [x] 2.8 Run `pnpm --filter @viewpro/api typecheck` — GREEN gate. **Done-when**: zero TypeScript errors.

---

## Phase 3 — Backend tests (single commit, after Phase 2)

Depends on: Phase 2 GREEN typecheck.

- [x] 3.1 In `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts`: add test cases for S-1 (assigned seller has phone; creator does not), S-2 (assigned seller null phone; creator's phone ignored), S-3 (two sellers; earliest `assignedAt` wins), S-4 (identical `assignedAt`; `agentUserId` tie-break), S-5 (zero sellers → unavailable). Each case uses synthetic fixture objects; no Prisma client. **Done-when**: 5 new tests present and named after scenarios.
- [x] 3.2 In `viewpro-app/apps/api/test/owner-portal.repository.spec.ts`: add mapper-level test for assigned-seller resolution covering the Prisma include shape and the `agents[0]` pick. Also add tie-break test mirroring S-4 at the repository-spec level. **Done-when**: tests assert `targetType === 'assigned_seller'` and correct `whatsappPhone`.
- [x] 3.3 In the same or adjacent spec file: add/update analytics tracking test asserting the use-case emits `metadata.targetType === 'assigned_seller'` (S-9). **Done-when**: analytics assertion present for `track-owner-movement-whatsapp-contact-click`.
- [x] 3.4 Update all existing occurrences of `'movement_author'` literal in `owner-portal.use-cases.spec.ts`, `owner-portal.repository.spec.ts`, and `owner-portal.e2e-spec.ts` to `'assigned_seller'`. **Done-when**: `rg 'movement_author' viewpro-app/apps/api/test/` returns 0.
- [x] 3.5 Run `pnpm --filter @viewpro/api test` — GREEN gate. **Done-when**: ≥ 702 baseline tests pass + new tests.

---

## Phase 4 — Frontend type and test fixture rename (single commit, after Phase 3)

Depends on: Phase 3 GREEN.

- [ ] 4.1 In `viewpro-app/apps/app-new/src/features/owner/api/types.ts:49`: rename `OwnerMovementContact.targetType` union member from `'movement_author'` to `'assigned_seller'`. **Done-when**: type definition updated; TypeScript will flag all downstream fixture mismatches.
- [ ] 4.2 In `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`: replace every fixture literal `'movement_author'` with `'assigned_seller'` (expected at lines 61, 126). Test behavior unchanged; only literal swap. **Done-when**: `rg 'movement_author' owner-timeline.test.tsx` returns 0.
- [ ] 4.3 In `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`: replace fixture literal `'movement_author'` at line 134. **Done-when**: `rg 'movement_author' owner-property-detail.test.tsx` returns 0.
- [ ] 4.4 In `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`: replace all `'movement_author'` literals (expected at lines 19, 115, 127). **Done-when**: `rg 'movement_author' owner-whatsapp-contact.test.ts` returns 0.
- [ ] 4.5 Run `rg "'movement_author'" viewpro-app/apps/app-new/src/` — confirm 0 remaining occurrences. **Done-when**: sweep complete; no missed call site.
- [ ] 4.6 Run `pnpm --filter next-shadcn-dashboard-starter lint:strict` + `tsc --noEmit` + `pnpm --filter next-shadcn-dashboard-starter test` — GREEN gate. **Done-when**: 0 lint errors, 0 type errors, ≥ 426 baseline tests pass.

---

## Phase 5 — Seed (single commit, after Phase 4)

Depends on: Phase 4 GREEN.

- [ ] 5.1 In `viewpro-app/apps/api/scripts/seed-demo.mjs` around lines 80-97: add `whatsappPhone: '+5493512222222'` to the `sofia.demo` user definition. Verify value is distinct from `martin.demo` (`+5493511111111`) and demo tenant (`+5493510000000`). **Done-when**: single-line addition; no other `DEMO_USERS` entry modified.
- [ ] 5.2 Confirm no log-summary line or count assertion requires updating (Phase 1 T-1.6 audit validates this). **Done-when**: `rg 'Users created|Document requests' viewpro-app/apps/api/scripts/seed-demo.mjs` output matches pre-apply audit; no numeric literal in those lines changes.
- [ ] 5.3 Run `pnpm demo:seed` from `viewpro-app/` — GREEN gate. **Done-when**: process exits 0 with accurate log output.

---

## Phase 6 — Seeded smoke (single commit, after Phase 5)

Depends on: Phase 5 GREEN seed run.

- [ ] 6.1 In `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`: add a new `test.describe('Stage 23.5 — owner movement contact resolves to assigned seller', ...)` block with `test.describe.configure({ mode: 'serial' })`. Single test: sign in as `propietario.demo@viewpro.local`, navigate to the tracked engagement timeline, find a movement card whose CTA is NOT "Contacto no configurado", assert `href` matches `^https:\/\/wa\.me\/\d{8,}\?text=` and contains `5493512222222`. No click, no analytics assertion (23.4 boundary). **Done-when**: test block present and runnable.
- [ ] 6.2 Run `pnpm --filter next-shadcn-dashboard-starter test:seeded` — GREEN gate. **Done-when**: ≥ 29 seeded tests pass (28 baseline + 1 new S-10).

---

## Phase 7 — Verification gates

Depends on: all prior phases GREEN.

- [ ] 7.1 (T-N1) `pnpm --filter @viewpro/api db:validate` + `pnpm --filter @viewpro/api typecheck` + `pnpm --filter @viewpro/api test` — all GREEN.
- [ ] 7.2 (T-N2) `pnpm --filter next-shadcn-dashboard-starter lint:strict` + `tsc --noEmit` + `pnpm --filter next-shadcn-dashboard-starter test` — all GREEN.
- [ ] 7.3 (T-N3) `pnpm demo:seed` — exits 0; log output matches pre-apply baseline.
- [ ] 7.4 (T-N4) `pnpm --filter next-shadcn-dashboard-starter test:seeded` — ≥ 29/29 GREEN.
- [ ] 7.5 (T-N5) Tie-break inversion sanity: temporarily reverse Prisma `ownerMovementInclude.propertyEngagement.agents.orderBy` to `[{ assignedAt: 'desc' }]`, confirm S-3 / S-4 unit tests FAIL, restore `asc`, confirm GREEN. **Done-when**: RED/GREEN evidence recorded in apply-progress.

---

## Acceptance checklist — spec scenarios

| Scenario | Covered by task(s) | Done |
|----------|--------------------|------|
| S-1 Assigned seller has phone; creator does not | T-3.1 | [x] |
| S-2 Assigned seller null phone; creator's phone ignored | T-3.1 | [x] |
| S-3 Two sellers; earliest `assignedAt` wins | T-3.1, T-3.2 | [x] |
| S-4 Identical `assignedAt`; `agentUserId` tie-break | T-3.1, T-3.2 | [x] |
| S-5 Zero assigned sellers | T-3.1 | [x] |
| S-6 Assigned seller with 7-digit phone (below threshold) | T-3.1 | [x] |
| S-7 Valid phone produces correct wa.me URL | T-3.1, T-3.2 | [x] |
| S-8 Property-level Contactar inmobiliaria unchanged (regression) | T-3.4, T-4.6 | [x] |
| S-9 Tracking endpoint writes `assigned_seller` | T-3.3 | [x] |
| S-10 Seeded smoke: demo owner sees sofia.demo's phone | T-6.1, T-6.2 | [ ] |
