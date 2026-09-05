# Tasks: Owner Home Reference Fidelity

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Planning P1: 223 Markdown lines + 72,050-byte assets; P2: 111 + 158 + 111 Markdown lines (380; cap 399). Source: 550–750 total; S1: 180–260, S2: 180–280, S3: 220–340. |
| 400-line budget risk | High — source total requires slices; P2 is capped below 400 Markdown lines. |
| Chained PRs recommended | Yes |
| Suggested split | P1 → P2 → Slice 1 → Slice 2 → Slice 3A → Slice 3B |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (repository integration branch: `develop`) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

## Planning delivery

- **P1:** `exploration.md` + `proposal.md` are 223 current Markdown lines; include `assets/owner-actions-reference.jpeg` and `assets/owner-activity-reference.jpeg` as 72,050 bytes of immutable visual evidence.
- **P2:** include delta `specs/owner-portal-home/spec.md` (111 lines), compressed `design.md` (158 lines), and this physical `tasks.md` (111 lines; cap 130), keeping P2 at 380 Markdown lines.
- Planning PRs are docs/assets only and grant no source-apply authority; every source slice begins only after the stated P2 gate from fresh `develop`.

## Boundaries and execution order

- Maintainer approved the audited reset and S3A/S3B split; use `stacked-to-main`, branch every successor from fresh `develop` after its predecessor, and keep each under 400 changed lines.
- This is owner-home frontend-only work. Do not edit API, BFF, schema, authentication, authorization, tenant isolation, document-detail, document-workflow, movement-contact, or WhatsApp URL/message/tracking contract owners.
- Treat `openspec/changes/owner-home-reference-fidelity/assets/owner-actions-reference.jpeg` and `openspec/changes/owner-home-reference-fidelity/assets/owner-activity-reference.jpeg` as read-only visual baselines; check hierarchy, grouping, action order, timeline cues, and continuation affordance, but never copy sample data into product data.
- Run every listed command from `viewpro-app/`; record RED, GREEN, TRIANGULATE, and REFACTOR evidence before the next source slice.

## Slice 1 — bounded engagement activity query and view-model

**Objective:** replace the page-size-one lookup with an engagement-scoped, defensively bounded five-row view-model while retaining the compact presentation.
**Depends on:** P2 merged and Slice 1 branched from fresh `develop`. **Estimate:** 180–260 changed lines.
**Rollback boundary:** revert this slice's six listed files together—including the corrected component ordering fixture—to restore the page-size-one query and previous card mapper; no API cache migration or data repair is required.

### Allowed edit manifest (repository-relative)

```text
viewpro-app/apps/app-new/src/features/owner/api/queries.ts
viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts
viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx
viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx
viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts
viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts
```

- [x] **RED:** In `viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts` and `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts`, add failing characterization for the exact `['owner', 'engagements', engagementId, 'timeline', { order: 'desc', page: 1, pageSize: 5 }]` home key/query call, its distinction from the 25-row detail key, five-row input bound, engagement-id rejection, invalid-date rejection, newest-first ordering, equal-time movement-id tie breaking, normalized-row-zero latest/next-action/card ordering, no-activity-last, and input/query-arrival independence. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `viewpro-app/apps/app-new/src/features/owner/api/queries.ts`, export `ownerEngagementRecentMovementsOptions` with the shared `OWNER_HOME_RECENT_MOVEMENT_LIMIT = 5`; in `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts`, normalize only each card's bounded movement array into `recentMovements`; and in `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`, replace the latest-movement query/index with the aligned recent-movements query/index while retaining the current compact visual summary. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Extend the same mapper/query tests with two agencies on one property, more than five mixed-validity rows, a mismatched `propertyEngagementId`, and completion/input permutations, proving neither the index nor sorting can borrow a sibling engagement's movement and unknown movement types remain eligible for ordering. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Keep the limit defined once in `owner-home-engagement-cards.ts`, keep query/service dependencies out of the pure mapper, remove the retired latest-home helper/index names from `queries.ts` and `owner-home.tsx`, and rerun `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/components/owner-home.test.tsx`. <!-- sdd-owner: implementation -->

**Slice completion evidence:** the focused command passes, `OwnerTimeline` remains unmounted on home, home requests at most five rows per engagement, and only the manifest files changed.

## Slice 2 — reference-style action hierarchy and scoped contact/navigation

**Objective:** recompose controls as exactly three accessible, reference-ordered action tiles and preserve scoped detail, documents, tracking, and agency-contact behavior.
**Depends on:** Slice 1 merged to `develop`; branch Slice 2 from fresh `develop`. **Estimate:** 180–280 changed lines.
**Rollback boundary:** revert this slice's three listed files together to restore previous compact controls while preserving Slice 1's bounded data behavior.

### Allowed edit manifest (repository-relative)

```text
viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx
viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx
viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts
```

- [x] **RED:** In `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`, write failing tests for exactly three primary tiles in DOM/visual order—`1. Actividad reciente`, `2. Documentación`, `3. Comunicarme con mi asesor`—with their supporting copy, decorative icon/arrow treatment, accessible native controls, 44px-or-larger target classes, scoped tracking/documents hrefs, and the lower-emphasis scoped `Ver más` detail href. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`, replace `OwnerActionTile` and the prominent `Abrir propiedad` control with an `OwnerEngagementActionGroup` containing one non-nested interactive surface per ordered tile; render `Ver más` as the secondary scoped detail link; use the existing `buildOwnerPropertyWhatsappHref` and best-effort `trackOwnerWhatsappContactClick(engagement.id)` only for that card's agency contact. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Extend `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx` for a two-agency property with a differing movement primary-seller contact, proving activity/documents/detail hrefs retain the originating engagement and the contact tile still uses only `engagement.contact`; prove a null/unusable agency contact renders the specified disabled native button, unavailable copy, no anchor, and no tracking call. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Update only affected stable selectors in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` from `Abrir propiedad` to the secondary `Ver más` link, retain the seeded agency WhatsApp href/intercept assertions, and run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/components/owner-home.test.tsx src/features/owner/components/owner-property-detail.test.tsx src/features/owner/components/owner-timeline.test.tsx src/features/owner/utils/owner-whatsapp-contact.test.ts src/features/owner/api/service.test.ts 'src/app/api/owner/engagements/[id]/timeline/route.test.ts'`. <!-- sdd-owner: implementation -->

**Slice completion evidence:** the regression command passes; cards retain one agency-specific identity and only three primary tiles; document/detail destinations and WhatsApp URL/message/tracking semantics are unchanged.

## Slice 3A — recent-activity RED/GREEN core

**Objective:** retain only the deterministic Buenos Aires formatter, structured classifier, semantic bounded activity, scoped continuation, and direct unit/component behavior; whole-home state, long-text/responsive triangulation, browser work, and the final gate belong to Slice 3B.
**Depends on:** Slice 2 merged to fresh `develop`. **Estimate:** under 400 changed lines.
**Rollback boundary:** revert this slice's four static files together to restore Slice 2; retain bounded-query and contact contracts.

### Allowed edit manifest (repository-relative)

```text
viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx
viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx
viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.ts
viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.test.ts
```

- [x] **RED:** Create `viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.test.ts` and extend `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx` with failing tests for the exact `DD/MM/YYYY · HH:mm` `es-AR`/`America/Argentina/Buenos_Aires` output (including a UTC instant crossing the Buenos Aires calendar day), supported structured-type visual kinds, neutral unknown/raw labels, no inferred observation categories, ordered semantic `ol`/`li` rows, and at-most-five real observations. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `viewpro-app/apps/app-new/src/features/owner/utils/owner-movement-labels.ts`, add a home-only structured-type presentation classifier and `formatOwnerHomeMovementDateTime` using `Intl.DateTimeFormat(...).formatToParts()` with fixed separators; in `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`, add `OwnerRecentActivity` and row rendering with decorative `aria-hidden` timeline cues, unchanged nonblank observations, existing type labels, a scoped `Ver toda la actividad` link, and no modification to WhatsApp/detail date formatters. <!-- sdd-owner: implementation -->
**Slice 3A completion evidence:** the focused unit/component command passes for the RED/GREEN core; no whole-home state, deliberate long-text/responsive TRIANGULATE, browser, or final-gate claim is made by this slice. The corrected candidate against `b3304e763e0853913594e67c24567b94212fb668` is **395 changed lines**, below the 400-line budget.

## Slice 3B — static/browser triangulation and final gate

**Manifest and rollback:** `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx` for the deferred state/long-text/responsive TRIANGULATE and `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` for browser work; revert only those Slice 3B assertions to retain Slice 3A core behavior.

- [x] **TRIANGULATE:** In `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`, retain/expand whole-home loading, properties failure, engagement failure, and owner-safe empty coverage; also prove local timeline error wins over empty, no activity differs from no next action, all-invalid rows are honest no activity, a successful card never receives sibling rows, long property/agency/observation/unknown-type text wraps without truncating meaning, and responsive structural classes preserve one source-ordered column below `md` and three `minmax(0, 1fr)` columns at/above `md`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR and browser verification:** In `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`, add stable owner-home assertions for the three tiles, a real recent row, scoped `Ver más`/activity navigation, agency WhatsApp href, and intercepted contact tracking; use `page.setViewportSize` for 320px, 375px, the `md` transition, and a full `max-w-6xl` viewport with long strings. Compare the rendered composition with both stored reference assets, but require semantic controls, href/tracking assertions, no horizontal overflow, readable wrapped text, and keyboard reachability as independent oracles rather than using screenshots alone. <!-- sdd-owner: implementation -->
- [x] Run the final frontend gate from `viewpro-app/`: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/utils/owner-movement-labels.test.ts src/features/owner/components/owner-home.test.tsx && pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter next-shadcn-dashboard-starter lint:strict && pnpm --filter next-shadcn-dashboard-starter test:seeded --grep 'owner'`; record any seeded-suite/environment blocker without weakening unit, semantic, or browser assertions. <!-- sdd-owner: implementation -->

**Slice completion evidence:** all final gates pass; home shows only bounded, engagement-scoped real movements; timestamps are deterministic across host timezones; reference-only data is omitted; and all four viewport checks have non-screenshot behavioral/accessibility evidence.

## Cleanup and handoff

- Seeded Playwright removes `apps/api/.document-storage-seeded` and runs `pnpm demo:seed` during global setup; after interruption or state mutation, restore deterministic fixtures from `viewpro-app/` with `pnpm demo:seed`, close test-created popups/servers, and retain no generated documents, traces, screenshots, or fixture mutations.
- Before each source handoff, run `git diff --check` and `git diff --stat` from workspace root; confirm only its manifest changed, no generated artifacts escaped it, and its diff is under 400 lines.

## Parent-owned lifecycle gates

- [x] Delivery chain is selected: `stacked-to-main` on repository integration branch `develop`; no size exception is authorized. <!-- sdd-owner: parent -->
- [x] **P1 gate:** PR #525 passed all 10 reported checks and was squash-merged to `develop` as `17d2291137dd7408ef1a039d27c7807bfca91d11`; P2 branched from that fresh integration commit. <!-- sdd-owner: parent -->
- [x] **P2 gate:** PR #526 passed all 10 reported checks and was squash-merged to `develop` as `3655452a76b38d198503917879d9f1850cf91fad`; Slice 1 branched from that fresh integration commit. <!-- sdd-owner: parent -->
- [x] After implementation evidence, start or reuse bounded review for each source slice under the effective review-mode policy, checking fresh-`develop` dependency, manifest, under-400 budget, rollback boundary, CI, and clean diff before its merge. <!-- sdd-owner: parent -->
- [x] Gate verify, sync, and archive only after P1, P2, and all four source-slice checks are recorded (S1, S2, S3A, S3B); do not claim review approval when review mode is disabled or unmanaged. <!-- sdd-owner: parent -->
