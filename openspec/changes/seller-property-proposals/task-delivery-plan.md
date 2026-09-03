# Task Delivery Plan: Seller Property Proposals

This normative manifest uses exact future paths only. `P/T/F/D` means production, test, fixture, or documentation changed-line range; each unit total is the arithmetic sum of every listed path range. Repeated paths represent later, separately scoped edits and are counted in that unit. U12 and U22A/U22B are verification-only; the parent gate has no changed-line/source unit.

## Audit correction

The unsplit corrected sums are U2 **433–532**, U5 **440–550**, and U22 **485–575**; U4, U11, and U16 also exceed the strict upper bound when all constituent ranges are summed. They are split below into cohesive RED+GREEN units rather than having ranges asserted downward. The five direct page-boundary tests are colocated with their page-owning units and budgeted incrementally.

## Local verification contract

Run from `viewpro-app`. Before every database or seeded command, stop unless this read-only guard succeeds:

```sh
node <<'NODE'
const raw = process.env.DATABASE_URL;
if (!raw) process.exit(1);
let url;
try { url = new URL(raw); } catch { process.exit(1); }
if (!['localhost', '127.0.0.1'].includes(url.hostname)) process.exit(1);
const database = decodeURIComponent(url.pathname).split('/').filter(Boolean).at(-1) ?? '';
if (!/^[A-Za-z0-9][A-Za-z0-9_-]*_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(database)) process.exit(1);
NODE
```

The guard parses `DATABASE_URL`, requires hostname exactly `localhost` or `127.0.0.1`, and requires the decoded final pathname component to be a base name ending `_test`, a retained worker name such as `viewpro_test_w1`–`viewpro_test_w4`, or an explicit `_test_worker_<suffix>` database; every failure exits nonzero. Use only `pnpm install --offline --frozen-lockfile` if installation is required. Restore limits and delete rows/assets, clients, transactions, barriers, and worker state in `finally`. The selected source topology is controlled C1→C20, each ≤650, with no blanket exception; strict400 is rejected forecast/history only. Planning publication is authorized only for the controlled four-PR chain (exploration+proposal → all specs → design+interface → all task artifacts) and only for commits, pushes, and PR creation, with no PR numbers yet; merge and source/apply are not authorized. After planning-chain acceptance and any separately authorized merges, source/apply requires fresh explicit authorization and a fresh `origin/develop` worktree. No provider or external service is allowed.

## Corrected strict-unit manifest

| Unit | Exact manifest paths and ranges | Total; class |
|---|---|---|
| U1 | `packages/contracts/src/index.ts` P35–45; `packages/contracts/test/runtime-contract.spec.ts` T80–95; `apps/api/src/common/filters/global-exception.filter.spec.ts` T30–40; `apps/api/src/permissions/permissions.constants.ts` P12–18; `apps/api/src/permissions/role-permissions.ts` P18–25; `apps/api/src/permissions/property-proposals-role-permissions.spec.ts` T55–65 | **230–288**; production-bearing |
| U2A | `apps/api/prisma/schema.prisma` P115–145; `apps/api/test/property-proposal-schema.spec.ts` T70–85 | **185–230**; production-bearing |
| U2B | `apps/api/prisma/migrations/20260902120000_add_property_proposals/migration.sql` P180–210; `apps/api/test/property-proposal-migration.spec.ts` T70–85 | **250–295**; production-bearing |
| U2C | `apps/api/src/database/tenant-isolation.extension.ts` P8–12; `apps/api/src/database/tenant-isolation.registry.spec.ts` T25–35; `apps/api/test/property-proposal-cleanup.ts` F15–20 | **48–67**; production-bearing |
| U3 | `apps/api/src/property-proposals/domain/normalization.ts` P35–45; `apps/api/src/property-proposals/domain/state-machine.ts` P35–45; `apps/api/src/property-proposals/domain/replay-identity.ts` P25–35; `apps/api/src/property-proposals/domain/normalization.spec.ts` T45–55; `apps/api/src/property-proposals/domain/state-machine.spec.ts` T45–55; `apps/api/src/property-proposals/domain/replay-identity.spec.ts` T30–40 | **215–275**; production-bearing |
| U4A | `apps/api/src/property-engagements/active-property-engagement-capacity.ts` P65–80; `apps/api/src/property-engagements/prisma-property-engagements.repository.ts` P35–45; `apps/api/src/property-engagements/property-engagements.module.ts` P12–18; `apps/api/src/property-engagements/active-property-engagement-capacity.spec.ts` T85–100 F20–25; `apps/api/test/property-engagements.e2e-spec.ts` T35–45 F10–15 | **262–328**; production-bearing |
| U4B | `apps/api/src/property-engagements/canonical-property-materializer.ts` P75–90; `apps/api/src/property-engagements/canonical-property-materializer.spec.ts` T85–100 F10–15; `apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts` T70–85; `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts` T25–35 | **265–325**; production-bearing |
| U5A | `apps/api/src/property-proposals/property-proposals.repository.ts` P70–85; `apps/api/src/property-proposals/prisma-property-proposals.repository.ts` P85–100; `apps/api/src/property-proposals/use-cases/list-property-proposals.use-case.ts` P20–30; `apps/api/src/property-proposals/use-cases/get-property-proposal.use-case.ts` P20–30; `apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts` T45–55 F20–25 | **260–325**; production-bearing |
| U5B | `apps/api/src/property-proposals/property-proposals.module.ts` P45–55; `apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.ts` P35–45; `apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.spec.ts` T65–85 F20–25 (S01/S03 combined) | **165–210**; production-bearing |
| U6 | `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.ts` P45–55; `apps/api/src/property-proposals/helpers/lock-property-proposal.ts` P25–35; `apps/api/src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts` T70–80 F25–30; `apps/api/test/property-proposal-eligibility-race.spec.ts` T40–50 F20–25 | **225–275**; production-bearing |
| U7 | `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.ts` P55–65; `apps/api/src/property-proposals/helpers/map-property-proposal.ts` P20–30; `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.spec.ts` T95–105 F25–30; `apps/api/src/property-proposals/use-cases/submit-property-proposal.replay.spec.ts` T45–55 F15–20 | **255–305**; production-bearing |
| U8 | `apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.ts` P35–45; `apps/api/src/property-proposals/use-cases/get-property-proposal-review.use-case.ts` P25–35; `apps/api/src/property-proposals/review-filter-builder.ts` P25–35; `apps/api/src/property-proposals/prisma-property-proposals.repository.ts` P35–45; `apps/api/src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts` T85–95 F20–25; `apps/api/src/property-proposals/review-filter-builder.spec.ts` T40–50; later S15 edit `apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts` T55–65 F10–15 | **320–400**; production-bearing |
| U9 | `apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.ts` P55–65; `apps/api/src/property-proposals/use-cases/review-transition-conflict.ts` P20–30; `apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts` T95–105 F25–30; `apps/api/src/property-proposals/use-cases/review-transition-conflict.spec.ts` T50–60 F20–25 | **265–315**; production-bearing |
| U10A | `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.ts` P80–95; `apps/api/src/property-proposals/property-proposals.repository.ts` P25–35; `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts` T105–115 F25–30 | **235–275**; production-bearing |
| U10B | `apps/api/src/property-proposals/responses/property-proposal.response.ts` P55–75; `apps/api/src/property-proposals/responses/property-proposal.response.spec.ts` T60–75 F15–20 | **130–170**; production-bearing |
| U11A | `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.ts` P35–45; `apps/api/src/property-proposals/helpers/approval-lock-order.ts` P30–40; `apps/api/src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts` T75–85 F25–30 | **165–200**; production-bearing |
| U11B | `apps/api/src/property-proposals/helpers/approval-replay.ts` P25–35; `apps/api/src/property-proposals/use-cases/approve-property-proposal.replay.spec.ts` T55–65 F20–25; `apps/api/test/property-proposal-approval-race.spec.ts` T65–75 F35–40 | **200–240**; production-bearing |
| U12 | `apps/api/test/property-proposal-concurrency-matrix.e2e-spec.ts` T150–170 F45–55; `apps/api/test/property-proposal-concurrency-fixtures.ts` T45–55 F45–55; `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts` T25–35 | **310–370**; verification-only |
| U13 | `apps/api/src/property-proposals/property-proposals.controller.ts` P55–65; `apps/api/src/property-proposals/dto/create-property-proposal.dto.ts` P25–35; `apps/api/src/property-proposals/dto/update-property-proposal.dto.ts` P25–35; `apps/api/src/property-proposals/dto/submit-property-proposal.dto.ts` P12–18; `apps/api/src/property-proposals/property-proposals.controller.spec.ts` T70–85; `apps/api/src/property-proposals/property-proposals.module.ts` P15–20; `apps/api/src/app.module.ts` P2–4; `apps/api/test/property-proposals.e2e-spec.ts` T75–85 F35–40 | **314–387**; production-bearing |
| U14 | `apps/api/src/property-proposals/property-proposals.controller.ts` P45–55; `apps/api/src/property-proposals/dto/list-property-proposal-review.query.ts` P35–45; `apps/api/src/property-proposals/dto/review-property-proposal.dto.ts` P15–22; `apps/api/src/property-proposals/dto/reject-property-proposal.dto.ts` P18–25; `apps/api/src/property-proposals/dto/list-property-proposal-review.query.spec.ts` T60–75; `apps/api/test/property-proposals.e2e-spec.ts` T60–70 F25–30 | **258–322**; production-bearing |
| U15A | `apps/app-new/src/app/api/property-proposals/route.ts` P25–35; `apps/app-new/src/app/api/property-proposals/[proposalId]/route.ts` P25–35; `apps/app-new/src/app/api/property-proposals/[proposalId]/submit/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/[proposalId]/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/[proposalId]/submit/route.test.ts` T40–55; `apps/app-new/src/lib/bff-api.ts` P12–18; `apps/app-new/src/lib/bff-api.test.ts` T70–80 | **272–363**; production-bearing |
| U15B | `apps/app-new/src/app/api/property-proposals/review/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.test.ts` T40–55 | **240–340**; production-bearing |
| U16A | `apps/app-new/src/features/property-proposals/api/types.ts` P45–55; `apps/app-new/src/features/property-proposals/api/service.ts` P70–80; `apps/app-new/src/lib/bff-client.ts` P15–22; `apps/app-new/src/lib/__tests__/bff-client.spec.ts` T80–90; `apps/app-new/src/features/property-proposals/api/service.test.ts` T45–55 | **255–302**; production-bearing |
| U16B | `apps/app-new/src/features/property-proposals/api/queries.ts` P65–75; `apps/app-new/src/features/property-proposals/api/queries.test.ts` T45–55 | **110–130**; production-bearing |
| U17 | `apps/app-new/src/lib/property-proposal-access.ts` P35–45; `apps/app-new/src/lib/navigation-access.ts` P12–18; `apps/app-new/src/hooks/use-nav.ts` P8–12; `apps/app-new/src/lib/navigation-access.test.ts` T60–70; `apps/app-new/src/hooks/use-nav.test.ts` T35–45; `apps/app-new/src/test/navigation-access-fixtures.ts` T20–25 F15–20 | **185–235**; production-bearing |
| U18A | `apps/app-new/src/features/property-proposals/schemas/property-proposal.ts` P45–55; `apps/app-new/src/features/property-proposals/components/property-proposal-form.tsx` P85–95; `apps/app-new/src/app/dashboard/property-proposals/new/page.tsx` P20–28; `apps/app-new/src/app/dashboard/property-proposals/new/page.test.tsx` T11–15; `apps/app-new/src/features/property-proposals/components/property-proposal-status-label.tsx` P25–35; `apps/app-new/src/features/property-proposals/components/property-proposal-status-label.test.tsx` T35–45; `apps/app-new/src/features/property-proposals/components/property-proposal-form.test.tsx` T65–75 | **286–348**; production-bearing |
| U18B | `apps/app-new/src/features/property-proposals/components/property-proposal-list.tsx` P55–65; `apps/app-new/src/features/property-proposals/components/property-proposal-list.test.tsx` T55–70; `apps/app-new/src/app/dashboard/property-proposals/page.tsx` P20–28; `apps/app-new/src/app/dashboard/property-proposals/page.test.tsx` T11–15; `apps/app-new/src/config/nav-config.ts` P15–22; `apps/app-new/src/config/nav-config.test.ts` T45–55; `apps/app-new/src/components/layout/app-sidebar.tsx` P8–12; `apps/app-new/src/components/kbar/palette.tsx` P8–12; `apps/app-new/src/components/layout/app-sidebar.test.tsx` T55–65; `apps/app-new/src/components/kbar/palette.test.ts` T45–55 | **317–399**; production-bearing |
| U19 | `apps/app-new/src/features/property-proposals/components/property-proposal-detail.tsx` P65–75; `apps/app-new/src/features/property-proposals/components/property-proposal-history.tsx` P45–55; `apps/app-new/src/app/dashboard/property-proposals/[proposalId]/page.tsx` P25–32; `apps/app-new/src/app/dashboard/property-proposals/[proposalId]/page.test.tsx` T11–15; `apps/app-new/src/features/property-proposals/components/property-proposal-detail.test.tsx` T70–80; `apps/app-new/src/features/property-proposals/components/property-proposal-cache.test.tsx` T50–60 | **266–317**; production-bearing |
| U20A | `apps/app-new/src/features/property-proposals/components/property-proposal-review-inbox.tsx` P70–80; `apps/app-new/src/app/dashboard/property-proposals/review/page.tsx` P25–32; `apps/app-new/src/app/dashboard/property-proposals/review/page.test.tsx` T11–15; `apps/app-new/src/features/property-proposals/components/property-proposal-review-inbox.test.tsx` T85–95; `apps/app-new/src/features/property-proposals/components/property-proposal-review-filters.test.tsx` T45–55 | **236–277**; production-bearing |
| U20B | `apps/app-new/src/config/nav-config.ts` P8–12; `apps/app-new/src/config/nav-config.test.ts` T40–50; `apps/app-new/src/components/layout/app-sidebar.tsx` P8–12; `apps/app-new/src/components/layout/app-sidebar.test.tsx` T55–65; `apps/app-new/src/components/kbar/palette.tsx` P8–12; `apps/app-new/src/components/kbar/palette.test.ts` T45–55 | **172–218**; production-bearing |
| U21A | `apps/app-new/src/features/property-proposals/components/property-proposal-review-detail.tsx` P85–95; `apps/app-new/src/features/property-proposals/components/property-proposal-reject-dialog.tsx` P45–55; `apps/app-new/src/app/dashboard/property-proposals/review/[proposalId]/page.tsx` P25–32; `apps/app-new/src/app/dashboard/property-proposals/review/[proposalId]/page.test.tsx` T11–15; `apps/app-new/src/features/property-proposals/components/property-proposal-review-detail.test.tsx` T95–105; `apps/app-new/src/features/property-proposals/components/property-proposal-review-cache.test.tsx` T40–50 | **301–352**; production-bearing |
| U22A | `apps/api/test/property-proposals.e2e-spec.ts` T100–115 F45–55; `apps/api/test/property-proposal-fixtures.ts` T45–55 F55–65; `apps/api/test/property-engagements.e2e-spec.ts` T25–35 | **270–325**; verification-only |
| U22B | `apps/app-new/tests/seeded/property-proposals.spec.ts` T120–135; `apps/app-new/tests/seeded/property-proposals.helpers.ts` T45–55 F50–60 | **215–250**; verification-only |

All expanded paths are exact; no consolidated BFF route test exists in the manifest. The requested API controller, review-query DTO, response, primary-agent, every BFF route test, and `.test.ts` KBar path are individually budgeted.

## Read-only arithmetic worksheet

Mechanical checks (lower and upper bounds use the same addition):

```text
U1 35+80+30+12+18+55 = 230; 45+95+40+18+25+65 = 288
U2A 115+70 = 185; 145+85 = 230
U2B 180+70 = 250; 210+85 = 295
U2C 8+25+15 = 48; 12+35+20 = 67
U3 35+35+25+45+45+30 = 215; 45+45+35+55+55+40 = 275
U4A 65+35+12+85+20+35+10 = 262; 80+45+18+100+25+45+15 = 328
U4B 75+85+70+25+10 = 265; 90+100+85+35+15 = 325
U5A 70+85+20+20+45+20 = 260; 85+100+30+30+55+25 = 325
U5B 45+35+65+20 = 165; 55+45+85+25 = 210
U6 45+25+70+25+40+20 = 225; 55+35+80+30+50+25 = 275
U7 55+20+95+25+45+15 = 255; 65+30+105+30+55+20 = 305
U8 35+25+25+35+85+20+40+45+10 = 320; 45+35+35+45+95+25+50+55+15 = 400
U9 55+20+95+25+50+20 = 265; 65+30+105+30+60+25 = 315
U10A 80+25+105+25 = 235; 95+35+115+30 = 275
U10B 55+60+15 = 130; 75+75+20 = 170
U11A 35+30+75+25 = 165; 45+40+85+30 = 200
U11B 25+55+20+65+35 = 200; 35+65+25+75+40 = 240
U12 150+45+45+25+45 = 310; 170+55+55+35+55 = 370
U13 55+25+25+12+70+15+2+75+35 = 314; 65+35+35+18+85+20+4+85+40 = 387
U14 45+35+15+18+60+60+25 = 258; 55+45+22+25+75+70+30 = 322
U15A 25+25+20+40+40+40+12+70 = 272; 35+35+30+55+55+55+18+80 = 363
U15B 20+20+20+20+40+40+40+40 = 240; 30+30+30+30+55+55+55+55 = 340
U16A 45+70+15+80+45 = 255; 55+80+22+90+55 = 302
U16B 65+45 = 110; 75+55 = 130
U17 35+12+8+60+35+20+15 = 185; 45+18+12+70+45+25+20 = 235
U18A 45+85+20+11+25+35+65 = 286; 55+95+28+15+35+45+75 = 348
U18B 55+55+20+11+15+45+8+8+55+45 = 317; 65+70+28+15+22+55+12+12+65+55 = 399
U19 65+11+45+25+70+50 = 266; 75+15+55+32+80+60 = 317
U20A 70+25+11+85+45 = 236; 80+32+15+95+55 = 277
U20B 8+40+8+55+8+45 = 172; 12+50+12+65+12+55 = 218
U21A 85+11+45+25+95+40 = 301; 95+15+55+32+105+50 = 352
U22A 100+45+45+55+25 = 270; 115+55+55+65+35 = 325
U22B 120+45+50 = 215; 135+55+60 = 250
```

Summing all 30 production-bearing units gives **6,887–8,513**. Summing U12, U22A, and U22B gives **795–945** verification-only. Therefore the strict implementation/test forecast is **7,682–9,458**, with parent gate **0**. Every strict unit maximum is ≤400.

## Selected controlled ≤650 source grouping

The corrected strict units mechanically group into **20** dependency-ordered options. Execute C1→C20 and execute units left-to-right within each group; each displayed maximum is ≤650:

| Group | Units | Maximum arithmetic | Group range |
|---|---|---:|---:|
| C1 | U1 | 288 | 230–288 |
| C2 | U2A + U2B + U2C | 230+295+67=592 | 483–592 |
| C3 | U3 + U4A | 275+328=603 | 477–603 |
| C4 | U4B + U5A | 325+325=650 | 525–650 |
| C5 | U5B + U6 | 210+275=485 | 390–485 |
| C6 | U7 | 305 | 255–305 |
| C7 | U8 | 400 | 320–400 |
| C8 | U9 + U10A | 315+275=590 | 500–590 |
| C9 | U10B + U11A | 170+200=370 | 295–370 |
| C10 | U11B + U12 | 240+370=610 | 510–610 |
| C11 | U13 | 387 | 314–387 |
| C12 | U14 | 322 | 258–322 |
| C13 | U15A | 363 | 272–363 |
| C14 | U15B + U16A | 340+302=642 | 495–642 |
| C15 | U16B + U17 | 130+235=365 | 295–365 |
| C16 | U18A | 348 | 286–348 |
| C17 | U18B | 399 | 317–399 |
| C18 | U19 + U20A | 317+277=594 | 502–594 |
| C19 | U20B + U21A | 218+352=570 | 473–570 |
| C20 | U22A + U22B | 325+250=575 | 485–575 |

This selected controlled source topology has no blanket exception: execute C1–C20 in dependency order, including U1 before C2's atomic U2A/U2B/U2C, U5A before U5B, U20A before U20B, and U20B before U21A. Schema, migration, tenant registry, and cleanup land together in C2 because generated-client and migrated-database paths must agree. Strict400 is retained only as rejected forecast/history.

## Planning delivery arithmetic

Whole-change planning accounting uses exploration **215**, proposal **252**, primary capability spec **347**, three smaller specs **29+27+45=101**, and actual design plus interface-design counts **143+229=372** lines. Final physical counts are `tasks.md` **271**, `task-evidence-matrix.md` **60**, `task-delivery-plan.md` **141**, and `task-verification-commands.md` **83**, for a final all-task-artifact aggregate of **555 lines** and a true final whole planning total of **1,842 lines**. The rejected strict400 planning forecast used seven ordered slices: exploration; proposal; primary spec; three small specs; design+interface (**372** physical lines); tasks+matrix (**331** physical lines); delivery+commands (**224** physical lines). The selected controlled ≤650 planning chain has four ordered PRs: exploration+proposal (**467**); all specs (**448**); design+interface (**372**); all task artifacts (**555**). These are planning counts only; publication is limited to commits, pushes, and PR creation, and merge or source/apply needs the separate fresh authorization gate.
