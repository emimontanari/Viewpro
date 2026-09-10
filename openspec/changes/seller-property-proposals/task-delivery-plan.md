# Task Delivery Plan: Seller Property Proposals

This normative manifest uses exact future paths only. `P/T/F/D` means production, test, fixture, or documentation changed-line range; each unit total is the arithmetic sum of every listed path range. Repeated paths represent later, separately scoped edits and are counted in that unit. U12 and U22A/U22B are verification-only; the parent gate has no changed-line/source unit.

## Audit correction

The historical unsplit forecasts are U2 **433–532**, U5 **440–550**, and U22 **485–575**; the reconstituted C2A candidate is measured separately at 611 additions + 38 deletions = 649 changed lines, while C2B1 and C2B2 are each hard-capped at 635; U4, U11, and U16 also exceed the strict upper bound when all constituent ranges are summed. They are split below into cohesive RED+GREEN units rather than having ranges asserted downward. The five direct page-boundary tests are colocated with their page-owning units and budgeted incrementally.

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

The guard parses `DATABASE_URL`, requires hostname exactly `localhost` or `127.0.0.1`, and requires the decoded final pathname component to be a base name ending `_test`, a retained worker name such as `viewpro_test_w1`–`viewpro_test_w4`, or an explicit `_test_worker_<suffix>` database; every failure exits nonzero. Use only `pnpm install --offline --frozen-lockfile` if installation is required. Restore limits and delete rows/assets, clients, transactions, barriers, and worker state in `finally`. The selected source topology is controlled C1→C2A→C2B1→C2B2→C3A→C3B→C4→C5A→C5B1→C5B2→C6A→C6B→C7A1→C7A2→C7B→C8A→C8B→C9…C20 (31 groups total); C5A/U5B must merge before C5B1/U6, then C5B1 must merge before C5B2, C2B1 and C2B2 are each ≤635, and every other group ≤650; C5B2 uses the maintainer-approved normal-boundary expansion from 250 to <400 with no size exception; strict400 is rejected forecast/history only. Planning publication is authorized only for the controlled four-PR chain (exploration+proposal → all specs → design+interface → all task artifacts) and only for commits, pushes, and PR creation, with no PR numbers yet; merge and source/apply are not authorized. After planning-chain acceptance and any separately authorized merges, source/apply requires fresh explicit authorization and a fresh `origin/develop` worktree. No provider or external service is allowed.

## Corrected strict-unit manifest

| Unit | Exact manifest paths and ranges | Total; class |
|---|---|---|
| U1 | `packages/contracts/src/index.ts` P35–45; `packages/contracts/test/runtime-contract.spec.ts` T80–95; `apps/api/src/common/filters/global-exception.filter.spec.ts` T30–40; `apps/api/src/permissions/permissions.constants.ts` P12–18; `apps/api/src/permissions/role-permissions.ts` P18–25; `apps/api/src/permissions/property-proposals-role-permissions.spec.ts` T55–65 | **230–288**; production-bearing |
| U2A / C2A | `apps/api/prisma/schema.prisma` P115–145; `apps/api/test/property-proposal-schema.spec.ts` T55–65 | **170–210**; production-bearing |
| U2B core / C2A | `apps/api/prisma/migrations/20260902120000_add_property_proposals/migration.sql` P110–130; `apps/api/test/property-proposal-migration.spec.ts` T120–145; `apps/api/test/restore-schema-parity.spec.ts` | **230–275**; production-bearing |
| U2B S39 hardening / C2B1 | `apps/api/test/property-proposal-migration-hardening.spec.ts` only; decision/check, planner/index, deletion/update, duplicate, and actual-DDL lock evidence only | **hard max ≤635**; production-bearing |
| U2C registry / C2A | `apps/api/src/database/tenant-isolation.extension.ts` P8–12; `apps/api/src/database/tenant-isolation.registry.spec.ts` T25–35 | **33–47**; production-bearing |
| U2C reusable cleanup / C2B2 | `apps/api/test/property-proposal-cleanup.ts`, exhaustive direct `apps/api/test/property-proposal-cleanup.spec.ts`, and retained C2A `apps/api/test/property-proposal-migration.spec.ts` helper retrofit with bounded failure-preserving cleanup | **318 changed lines ≤635**; production-bearing |
| U3 | `apps/api/src/property-proposals/domain/normalization.ts` P35–45; `apps/api/src/property-proposals/domain/state-machine.ts` P35–45; `apps/api/src/property-proposals/domain/replay-identity.ts` P25–35; `apps/api/src/property-proposals/domain/normalization.spec.ts` T45–55; `apps/api/src/property-proposals/domain/state-machine.spec.ts` T45–55; `apps/api/src/property-proposals/domain/replay-identity.spec.ts` T30–40 | **215–275**; production-bearing |
| U4A | `apps/api/src/property-engagements/active-property-engagement-capacity.ts` P65–80; `apps/api/src/property-engagements/prisma-property-engagements.repository.ts` P35–45; `apps/api/src/property-engagements/property-engagements.module.ts` P12–18; `apps/api/src/property-engagements/active-property-engagement-capacity.spec.ts` T85–100 F20–25; `apps/api/test/property-engagements.e2e-spec.ts` T35–45 F10–15 | **262–328**; production-bearing |
| U4B | `apps/api/src/property-engagements/canonical-property-materializer.ts` P75–90; `apps/api/src/property-engagements/canonical-property-materializer.spec.ts` T85–100 F10–15; `apps/api/src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts` T70–85; `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts` T25–35 | **265–325**; production-bearing |
| U5A | `apps/api/src/property-proposals/property-proposals.repository.ts` P70–85; `apps/api/src/property-proposals/prisma-property-proposals.repository.ts` P85–100; `apps/api/src/property-proposals/use-cases/list-property-proposals.use-case.ts` P20–30; `apps/api/src/property-proposals/use-cases/get-property-proposal.use-case.ts` P20–30; `apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts` T45–55 F20–25 | **260–325**; production-bearing |
| U5B / C5A | `apps/api/src/property-proposals/property-proposals.module.ts` P18–24; `apps/api/src/property-proposals/property-proposals.repository.ts` P10–14; `apps/api/src/property-proposals/prisma-property-proposals.repository.ts` P28–40; `apps/api/src/property-proposals/prisma-property-proposals.repository.spec.ts` T64–90 F25–40; `apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.ts` P25–32; `apps/api/src/property-proposals/use-cases/create-property-proposal.use-case.spec.ts` T65–85 (S01/S03 combined) | **235–325**; production-bearing |
| U6 / C5B1 | `apps/api/src/property-proposals/property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, `property-proposals.module.ts`, `helpers/lock-property-proposal.ts`, update use case, update spec, and focused repository spec | **372 changed lines (<400)**; production-bearing |
| U6 / C5B2 | `apps/api/test/property-proposal-eligibility-race.spec.ts` plus final OpenSpec closure | **374 changed lines (<400)**; production-bearing; maintainer-approved normal-boundary expansion from 250, no size exception |
| U7 / C6A | `apps/api/src/property-proposals/use-cases/submit-property-proposal.use-case.ts`, `helpers/map-property-proposal.ts`, `helpers/lock-property-proposal.ts`, repository port/adapter/module, `submit-property-proposal.use-case.spec.ts`, and focused repository coverage for initial BORRADOR submission | **203 tracked additions + 22 tracked deletions + 91 untracked lines = 316 changed lines (≤325)**; production-bearing |
| U7 / C6B | Rejected resubmit/history/exact-replay adapter and `submit-property-proposal.replay.spec.ts` / repository coverage | **231 source/test changed lines; 312 entire C6B candidate lines**; production-bearing, completed after merged C6A |
| C7A1 / U8 filter RED | `apps/api/src/property-proposals/review-filter-builder.ts` and `review-filter-builder.spec.ts` only | **188 untracked builder/source-test + 78 tracked metadata additions + 18 tracked metadata deletions = 284 changed lines (≤400)**; production-bearing; owns pure S15 filter primitives and pagination RED only, not reviewer ordering; includes the 20-line evidence-ownership correction |
| C7A2 / U8 repository GREEN | `apps/api/src/property-proposals/property-proposals.repository.ts`, `prisma-property-proposals.repository.ts`, and `prisma-property-proposals.repository.spec.ts` | **190–240**; production-bearing; owns S15 repository GREEN and exact `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC` ordering evidence; pending |
| C7B / U8 use-case half | reviewer list/detail use cases and specs | **130–160**; production-bearing; owns S11/S14 only |
| U9 | `apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.ts` P55–65; `apps/api/src/property-proposals/use-cases/review-transition-conflict.ts` P20–30; `apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts` T95–105 F25–30; `apps/api/src/property-proposals/use-cases/review-transition-conflict.spec.ts` T50–60 F20–25 | **265–315**; production-bearing |
| U10A | `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.ts` P80–95; `apps/api/src/property-proposals/property-proposals.repository.ts` P25–35; `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts` T105–115 F25–30 | **235–275**; production-bearing |
| U10B | `apps/api/src/property-proposals/responses/property-proposal.response.ts` P55–75; `apps/api/src/property-proposals/responses/property-proposal.response.spec.ts` T60–75 F15–20 | **130–170**; production-bearing |
| U11A | `apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.ts` P35–45; `apps/api/src/property-proposals/helpers/approval-lock-order.ts` P30–40; `apps/api/src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts` T75–85 F25–30 | **165–200**; production-bearing |
| U11B1 | `apps/api/src/property-proposals/helpers/approval-replay.ts`, approval use case, and the three focused approval specs | **≤400 total physical lines including OpenSpec closure**; production-bearing replay ordering/source invariant only |
| U11B2 | `apps/api/test/property-proposal-approval-race.spec.ts` same-proposal approval/approval and approval/rejection proof | **≤400**; production-bearing |
| U11B3 | `apps/api/test/property-proposal-approval-race.spec.ts` final-slot approval/approval and approval/direct-create/restore proof | **≤400**; production-bearing |
| U12 | import-only `apps/api/test/property-proposal-concurrency-matrix.e2e-spec.ts`; bounded-observer `apps/api/test/property-agent-primary-concurrency.e2e-spec.ts`. No `property-proposal-concurrency-fixtures.ts`: the matrix registers existing green suites without duplicating their fixtures. | **87–119**; verification-only, plus the existing exploration note |
| U13A1 | Six seller DTO paths, `dto/property-proposal-transport.spec.ts`, and concise OpenSpec closure only. No projection, controller/module mount, endpoint, query, role check, or C9A response-source edit. | **Pre-code forecast:** 128–151 source + 108–136 test; final working-tree arithmetic must remain ≤400 and native new delta ≤313; production-bearing |
| U13A2 | Pure literal-allowlisted projection and its focused spec only. | Deferred after U13A1; production-bearing |
| U13B1 | `property-proposals.repository.ts`, Prisma seller reads, seller-list use case/spec, summary transport/spec, and concise U13 artifacts; list summaries only with fresh batched visibility. | **≤400 physical lines**; production-bearing |
| U13B2 | Seller detail/history shaping after U13B1; no controller or module mount. | Deferred; production-bearing |
| U13C1 | `apps/api/src/property-proposals/property-proposals.controller.ts`, its controller contract spec, `property-proposals.module.ts`, `app.module.ts`, and concise U13 artifacts; exactly five seller routes, safe mutation rereads, and first mount only. | **≤400 physical lines**; production-bearing, no HTTP/E2E transport integration |
| U13C2 | Seller HTTP/E2E transport integration and aggregate U13/U13C completion after U13C1. | Deferred; production-bearing |
| U14A1 | reviewer list port/Prisma adapter/list use case and their focused specs, plus the literal reviewer-summary transport/spec | **≤400**; production-bearing list-only slice; no detail/history, controller, DTO, module, route, or E2E |
| U14A2 | reviewer detail/history shaping and focused evidence only | Deferred after U14A1; production-bearing |
| U14B | reviewer DTO/controller/module/provider contract and static-route proof | Deferred after U14A2; production-bearing |
| U14C | guarded reviewer HTTP E2E only | Deferred after U14B; verification-bearing |
| U15A1 | `apps/app-new/src/app/api/property-proposals/route.ts`, its colocated test, `apps/app-new/src/lib/bff-api.ts`, and `bff-api.test.ts`; shared helper plus collection only | **≤400**; production-bearing, no detail/submit routes |
| U15A2 | seller `[proposalId]` and `[proposalId]/submit` routes with their colocated tests only | **≤400**; production-bearing after U15A1, no helper or collection changes |
| U15B1 reviewer reads | `apps/app-new/src/app/api/property-proposals/review/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/route.test.ts` T40–55 | **120–170**; production-bearing; collection/detail GET only |
| U15B2 reviewer decisions | `apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.ts` P20–30; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/reject/route.test.ts` T40–55; `apps/app-new/src/app/api/property-proposals/review/[proposalId]/approve/route.test.ts` T40–55 | **120–170**; production-bearing; reject/approve only after U15B1 |
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
U2A / C2A 115+55 = 170; 145+65 = 210
U2B core / C2A 110+120 = 230; 130+145 = 275
U2B S39 hardening / C2B1 = hard max ≤635
U2C registry / C2A 8+25 = 33; 12+35 = 47
U2C reusable cleanup / C2B2 = hard max ≤635
U3 35+35+25+45+45+30 = 215; 45+45+35+55+55+40 = 275
U4A 65+35+12+85+20+35+10 = 262; 80+45+18+100+25+45+15 = 328
U4B 75+85+70+25+10 = 265; 90+100+85+35+15 = 325
U5A 70+85+20+20+45+20 = 260; 85+100+30+30+55+25 = 325
U5B / C5A 18+10+28+(64+25)+25+65 = 235; 24+14+40+(90+40)+32+85 = 325
U6 / C5B historical combined 275–360; C5B1 verified candidate 372 changed lines (<400); C5B2 final = source/test 19 additions + 19 deletions + 256 race-test lines (294) + OpenSpec 66 additions (apply-progress) + 2/+2 (tasks) + 4/+4 (this plan) + 1/+1 (verification command) = 374 changed lines (<400), with maintainer-approved 250→<400 boundary expansion and no size exception
C6A initial submit/snapshot = 203 tracked additions + 22 tracked deletions + 91 untracked lines = 316 changed lines (≤325); C6B prior source/test = 4 additions + 1 deletion (repository spec) + 42 additions + 20 deletions (adapter) + 92 untracked replay-test lines = 159, and prior OpenSpec = 50 additions + 7 deletions = 57, so the independently rejected pre-correction candidate was 216; final C6B = 136 tracked additions + 29 tracked deletions + 147 untracked replay-test lines = 312 (≤400).
C7A1 current candidate = 188 untracked builder/source-test + 78 tracked metadata additions + 18 tracked metadata deletions = 284 changed lines (≤400), including the 20-line evidence-ownership correction; C7A2 = 190–240 and C7B = 130–160 are separate dependency-ordered groups. C7A1 owns only S15 filter/pagination RED, C7A2 owns its repository GREEN including exact `COALESCE(latestSubmittedAt, createdAt) DESC, id DESC` ordering, and C7B owns S11/S14.
U9 55+20+95+25+50+20 = 265; 65+30+105+30+60+25 = 315
U10A 80+25+105+25 = 235; 95+35+115+30 = 275
U10B 55+60+15 = 130; 75+75+20 = 170
U11A 35+30+75+25 = 165; 45+40+85+30 = 200
U11B is split: U11B1 replay ordering/source invariant, U11B2 same-proposal races, and U11B3 final-slot races; each has a hard ≤400 physical-line boundary.
U12 import-only matrix + bounded primary observer = 87; upper bound = 119; existing exploration remains separately retained
The 575-line U13A DTO/projection prototype was discarded rather than exceed 400, code-golf, or omit coverage. The user-approved U13A1 DTO-only rescope is independently forecast at 128–151 source plus 108–136 test lines; U13A2 retains projection.
U14 is split: U14A1 list-only is ≤400; U14A2 detail/history, U14B transport contract, and U14C HTTP evidence are separate ≤400 boundaries.
U15A1 helper+collection and U15A2 detail+submit are separate hard ≤400 slices; their former aggregate forecast was 272–363.
U15B1 reviewer reads 20+20+40+40 = 120; 30+30+55+55 = 170. U15B2 reviewer decisions 20+20+40+40 = 120; 30+30+55+55 = 170. The aggregate remains 240–340 but its two independently applied slices stay under 400.
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

Summing all 30 production-bearing units gives **7,082–8,813**. Summing U12, U22A, and U22B gives **572–694** verification-only. Therefore the strict implementation/test forecast is **7,654–9,507**, with parent gate **0**. Every strict unit maximum is ≤400.

## Selected controlled ≤650 source grouping

The corrected strict units mechanically group into **31** dependency-ordered options. Execute C1→C2A→C2B1→C2B2→C3A→C3B→C4→C5A→C5B1→C5B2→C6A→C6B→C7A1→C7A2→C7B→C8A→C8B→C9…C20 and execute units left-to-right within each group; C5A/U5B must merge before C5B1/U6 and C5B1 must merge before C5B2/U6 races. C2B1 contains only the new S39 hardening spec, while C2B2 owns the reusable cleanup helper/direct matrix and retained C2A migration-smoke teardown retrofit. C2B2 is mandatory before C3A, C3B is mandatory before C4/U4B, C2B1/C2B2 are each ≤635, and every other displayed maximum is ≤650:

| Group | Units | Maximum arithmetic | Group range |
|---|---|---:|---:|
| C1 | U1 | 288 | 230–288 |
| C2A | U2A + U2B core + U2C registry + restore-schema parity | 649 current ≤650 | 649 current |
| C2B1 | U2B S39 migration/index/lock hardening only | hard max ≤635 | hard max ≤635 |
| C2B2 | U2C reusable cleanup helper plus exhaustive direct matrix | hard max ≤635 | hard max ≤635 |
| C3A | U3 | 275 | 215–275 |
| C3B | U4A | 328 | 262–328 |
| C4 | U4B + U5A | 325+325=650 | 525–650 |
| C5A | U5B | 325 | 235–325 |
| C5B1 | U6 update/lock/replay (after C5A merge) | 372 | 372 changed lines (<400) |
| C5B2 | U6 barriers/real PostgreSQL races plus final OpenSpec closure | 374 | 374 changed lines (<400); approved normal-boundary expansion (250→<400), no size exception |
| C6A | U7 initial BORRADOR submit/snapshot | 316 | 203 tracked additions + 22 tracked deletions + 91 untracked lines = 316 changed lines (≤325) |
| C6B | U7 rejected resubmit/history/exact replay | 231 source/test | 312 entire candidate, ≤400 |
| C7A1 | U8 pure review-filter builder (S15 filter/pagination RED) | 400 | 284 changed lines (≤400), including ownership correction |
| C7A2 | U8 reviewer repository reads (S15 GREEN; exact COALESCE ordering) | 240 | 190–240, pending |
| C7B | U8 reviewer use cases (S11/S14) | 160 | 130–160 |
| C8A | U9 rejection/replay/conflicts | 315 | 265–315 |
| C8B | U10A approval materialization | 275 | 235–275 |
| C9 | U10B + U11A | 170+200=370 | 295–370 |
| C10A | U11B1 | 400 | ≤400 replay ordering/source invariant |
| C10B | U11B2 | 400 | ≤400 same-proposal races |
| C10C | U11B3 + U12 | 400+119=519 planned; execute as separate U11B3 then verification-only U12 | each slice ≤400 |
| C11A1 | U13A1 DTO contracts and validation | <400 | DTO-only slice; final total and native delta are hard gates |
| C11A2 | U13A2 pure projection | <400 | after U13A1 |
| C11B1 | U13B1 seller-list summaries/current visibility | <400 | list-only, no detail/history/controller/module |
| C11B2 | U13B2 seller detail/history shaping | <400 | deferred after U13B1 |
| C11C1 | U13C1 seller controller contract and module/AppModule mount | <400 | first U13C slice; no HTTP/E2E transport integration |
| C11C2 | U13C2 seller HTTP/E2E transport integration | <400 | after U13C1 |
| C12A1 | U14A1 reviewer list-only projection | 400 | ≤400 |
| C12A2 | U14A2 reviewer detail/history projection | 400 | ≤400 |
| C12B | U14B reviewer transport contract | 400 | ≤400 |
| C12C | U14C reviewer HTTP E2E | 400 | ≤400 |
| C13A | U15A1 helper + collection | 400 | ≤400 |
| C13B | U15A2 detail + submit | 400 | ≤400 |
| C14 | U15B1 reviewer reads → U15B2 reviewer decisions → U16A | max independently applied sub-slice 302 | 120–170; 120–170; 255–302 |
| C15 | U16B + U17 | 130+235=365 | 295–365 |
| C16 | U18A | 348 | 286–348 |
| C17 | U18B | 399 | 317–399 |
| C18 | U19 + U20A | 317+277=594 | 502–594 |
| C19 | U20B + U21A | 218+352=570 | 473–570 |
| C20 | U22A + U22B | 325+250=575 | 485–575 |

This selected controlled source topology has no blanket exception: execute C1→C2A→C2B1→C2B2→C3A→C3B→C4→C5A→C5B1→C5B2→C6A→C6B→C7A1→C7A2→C7B→C8A→C8B→C9…C20 in dependency order, including U1 before C2A, C2B1 before C2B2, mandatory C2B2 before C3A, mandatory C3B/U4A before C4/U4B, U5A before C5A/U5B, mandatory C5A merge before C5B1/U6, and mandatory C5B1 merge before C5B2/U6 races. U20A remains before U20B, and U20B before U21A. Schema, migration, and tenant registry land atomically in C2A because generated-client, migrated-database, and isolation paths must agree; C2B1 supplies only S39 hardening, C2B2 supplies the mandatory reusable cleanup/direct matrix plus retained C2A migration-smoke teardown retrofit before C3A, C3A supplies only U3, and C3B supplies only U4A. Strict400 is retained only as rejected forecast/history.

## Planning delivery arithmetic

Whole-change planning accounting uses exploration **215**, proposal **252**, primary capability spec **347**, three smaller specs **29+27+45=101**, and actual design plus interface-design counts **143+229=372** lines. Historical pre-split physical counts were `tasks.md` **282**, `task-evidence-matrix.md` **59**, `task-delivery-plan.md` **148**, and `task-verification-commands.md` **83**, for a then-final all-task-artifact aggregate of **572 lines** and whole planning total of **1,859 lines**. The rejected strict400 planning forecast used seven ordered slices: exploration; proposal; primary spec; three small specs; design+interface (**372** physical lines); tasks+matrix (**331** physical lines); delivery+commands (**224** physical lines). The selected controlled ≤650 planning chain has four ordered PRs: exploration+proposal (**467**); all specs (**448**); design+interface (**372**); all task artifacts (**572**). These are planning counts only; publication is limited to commits, pushes, and PR creation, and merge or source/apply needs the separate fresh authorization gate.
