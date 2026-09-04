# Verification Commands: Seller Property Proposals

This companion is normative for commands. Run from `viewpro-app`; App commands use the workspace filter shown. A database or seeded command starts only after this guard succeeds:

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

The guard parses `DATABASE_URL`, requires hostname exactly `localhost` or `127.0.0.1`, and requires the decoded final pathname component to be a base name ending `_test`, a retained worker name such as `viewpro_test_w1`–`viewpro_test_w4`, or an explicit `_test_worker_<suffix>` database; every failure exits nonzero. Stop on failure. Use `pnpm install --offline --frozen-lockfile` only when needed. Do not use providers, external services, Neon, Git mutation, GitHub, or delivery commands. All database, concurrency, and seeded fixtures restore limits and remove rows/assets, barriers, clients, transactions, and worker state in `finally`.

## Unit commands

| Unit | Exact command(s) | Evidence boundary |
|---|---|---|
| U1 | `pnpm --filter @viewpro/contracts test`; `pnpm --filter @viewpro/api exec vitest run src/common/filters/global-exception.filter.spec.ts src/permissions/property-proposals-role-permissions.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Catalog, exact three-key API error envelope, filter passthrough/fallback, and permission RED/GREEN; no DB |
| C2A (U2A + U2B core + U2C registry) | `pnpm exec turbo run typecheck --filter=@viewpro/api --force`; `pnpm --filter @viewpro/api db:validate`; `pnpm --filter @viewpro/api exec vitest run test/property-proposal-schema.spec.ts test/property-proposal-migration.spec.ts test/restore-schema-parity.spec.ts src/database/tenant-isolation.registry.spec.ts` | Run the uncached compiler/Prisma generation before focused Prisma-importing Vitest; then prove readable schema, migrated-client source-link, repository restore-schema parity, and direct-tenant registry parity after the local guard. |
| C2A pristine deploy | `database_url=postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test_worker_c2a_pristine?schema=public; DATABASE_URL="$database_url" DIRECT_URL="$database_url" pnpm --filter @viewpro/api exec prisma migrate deploy` | Empty disposable local database applies all 32 migrations; create and drop it only under the local guard. |
| C2B1 (S39; before C2B2) | `pnpm exec turbo run typecheck --filter=@viewpro/api --force`; `pnpm --filter @viewpro/api db:validate`; `pnpm --filter @viewpro/api exec vitest run test/property-proposal-migration.spec.ts test/property-proposal-migration-hardening.spec.ts`; `pnpm --filter @viewpro/api lint` | Run uncached compiler/Prisma generation before the exact core-migration and new hardening tests; then cover S39 decision/check, planner/index, deletion/update, duplicate, and production-shaped actual-DDL lock evidence only. |
| C2B2 (mandatory before C3) | `pnpm exec turbo run typecheck --filter=@viewpro/api --force`; `pnpm --filter @viewpro/api db:validate`; `pnpm --filter @viewpro/api exec vitest run test/property-proposal-cleanup.spec.ts test/property-proposal-migration.spec.ts test/property-proposal-migration-hardening.spec.ts`; `pnpm --filter @viewpro/api lint`; repeat `pnpm --filter @viewpro/api exec vitest run test/property-proposal-cleanup.spec.ts` | Forced uncached generation/typecheck, bounded migration smoke cleanup, C2B1 hardening regression, exhaustive direct work/cleanup/disconnect matrix, lint, and timeout repeat. |
| U3 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/domain/normalization.spec.ts src/property-proposals/domain/state-machine.spec.ts src/property-proposals/domain/replay-identity.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Pure domain only |
| U4A | `pnpm --filter @viewpro/api exec vitest run src/property-engagements/active-property-engagement-capacity.spec.ts test/property-engagements.e2e-spec.ts`; `pnpm --filter @viewpro/api typecheck` | Capacity and direct manager path |
| U4B | `pnpm --filter @viewpro/api exec vitest run src/property-engagements/canonical-property-materializer.spec.ts src/property-engagements/use-cases/set-primary-property-agent.use-case.spec.ts test/property-agent-primary-concurrency.e2e-spec.ts`; `pnpm --filter @viewpro/api typecheck` | Materializer and first primary compatibility behavior |
| U5A | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/prisma-property-proposals.repository.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Scoped reads and safe absence |
| U5B | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/create-property-proposal.use-case.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Seller draft creation, proposal identity, and duplicate title/address allowance |
| U6 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/update-property-proposal.use-case.spec.ts test/property-proposal-eligibility-race.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Editable state and eligibility race |
| U7 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/submit-property-proposal.use-case.spec.ts src/property-proposals/use-cases/submit-property-proposal.replay.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Submission and immutable rounds |
| U8 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/list-property-proposal-review.use-case.spec.ts src/property-proposals/review-filter-builder.spec.ts src/property-proposals/prisma-property-proposals.repository.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Inbox/filter behavior |
| U9 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/reject-property-proposal.use-case.spec.ts src/property-proposals/use-cases/review-transition-conflict.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Rejection, replay, and 409 |
| U10A | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/approve-property-proposal.use-case.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Approval materialization and rollback |
| U10B | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/responses/property-proposal.response.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Result-link response safety |
| U11A | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Quota and proposer eligibility |
| U11B | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/approve-property-proposal.replay.spec.ts test/property-proposal-approval-race.spec.ts`; `pnpm --filter @viewpro/api typecheck` | Replay and bounded race |
| U12 | `pnpm --filter @viewpro/api exec vitest run test/property-proposal-concurrency-matrix.e2e-spec.ts test/property-agent-primary-concurrency.e2e-spec.ts` (repeat the same command) | Verification-only blocking evidence; no fix |
| U13 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/property-proposals.controller.spec.ts test/property-proposals.e2e-spec.ts`; `pnpm --filter @viewpro/api typecheck` | Seller transport, exclusions, first mount |
| U14 | `pnpm --filter @viewpro/api exec vitest run src/property-proposals/dto/list-property-proposal-review.query.spec.ts test/property-proposals.e2e-spec.ts`; `pnpm --filter @viewpro/api typecheck` | Reviewer transport/search boundary |
| U15A | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/bff-api.test.ts src/app/api/property-proposals/route.test.ts 'src/app/api/property-proposals/[proposalId]/route.test.ts' 'src/app/api/property-proposals/[proposalId]/submit/route.test.ts'`; `pnpm --filter next-shadcn-dashboard-starter typecheck` | Three seller routes, each colocated test |
| U15B | `pnpm --filter next-shadcn-dashboard-starter exec vitest run 'src/app/api/property-proposals/review/route.test.ts' 'src/app/api/property-proposals/review/[proposalId]/route.test.ts' 'src/app/api/property-proposals/review/[proposalId]/reject/route.test.ts' 'src/app/api/property-proposals/review/[proposalId]/approve/route.test.ts'`; `pnpm --filter next-shadcn-dashboard-starter typecheck` | Four reviewer routes, each colocated test |
| U16A | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/__tests__/bff-client.spec.ts src/features/property-proposals/api/service.test.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | BFF client/service boundary |
| U16B | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/api/queries.test.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Query keys and invalidation |
| U17 | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/navigation-access.test.ts src/hooks/use-nav.test.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Fail-closed policy; no destination exposure |
| U18A | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/components/property-proposal-status-label.test.tsx src/features/property-proposals/components/property-proposal-form.test.tsx 'src/app/dashboard/property-proposals/new/page.test.tsx'`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Working seller form/label and direct seller-new page boundary |
| U18B | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/components/property-proposal-list.test.tsx 'src/app/dashboard/property-proposals/page.test.tsx' src/config/nav-config.test.ts src/components/layout/app-sidebar.test.tsx src/components/kbar/palette.test.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Seller list/page behavior, direct seller-list/root boundary, and atomic seller navigation exposure |
| U19 | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/components/property-proposal-detail.test.tsx src/features/property-proposals/components/property-proposal-cache.test.tsx 'src/app/dashboard/property-proposals/[proposalId]/page.test.tsx'`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Seller detail/cache and direct seller-detail page boundary |
| U20A | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/components/property-proposal-review-inbox.test.tsx src/features/property-proposals/components/property-proposal-review-filters.test.tsx 'src/app/dashboard/property-proposals/review/page.test.tsx'`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Direct reviewer-inbox boundary and behavior only; no navigation exposure |
| U20B | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/config/nav-config.test.ts src/components/layout/app-sidebar.test.tsx src/components/kbar/palette.test.ts src/lib/navigation-access.test.ts src/hooks/use-nav.test.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Atomic post-inbox nav-config, Sidebar, KBar, navigation-access, and use-nav parity exposure |
| U21A | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/property-proposals/components/property-proposal-review-detail.test.tsx src/features/property-proposals/components/property-proposal-review-cache.test.tsx 'src/app/dashboard/property-proposals/review/[proposalId]/page.test.tsx'`; `pnpm --filter next-shadcn-dashboard-starter typecheck`; `pnpm --filter next-shadcn-dashboard-starter lint:strict` | Reviewer decisions/cache after atomic reviewer navigation exposure and direct reviewer-detail page boundary |
| U22A | `pnpm --filter @viewpro/api exec vitest run test/property-proposals.e2e-spec.ts test/property-engagements.e2e-spec.ts` | Verification-only API journeys |
| U22B | `pnpm --filter next-shadcn-dashboard-starter test:seeded -- tests/seeded/property-proposals.spec.ts`; `pnpm --filter next-shadcn-dashboard-starter typecheck` | Verification-only browser journeys |

## Final navigation and error-boundary evidence

After atomic seller and reviewer exposure, U20B's exact final command is:

```sh
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/config/nav-config.test.ts src/components/layout/app-sidebar.test.tsx src/components/kbar/palette.test.ts src/lib/navigation-access.test.ts src/hooks/use-nav.test.ts
```

S43–S45 additionally require both `pnpm --filter @viewpro/contracts test` and `pnpm --filter @viewpro/api exec vitest run src/common/filters/global-exception.filter.spec.ts`.

## Final gate

After all selected units, run these valid repository scripts locally and record each result; this gate does not authorize delivery:

```sh
pnpm --filter @viewpro/contracts test
pnpm --filter @viewpro/api db:validate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

A parent may additionally run `git diff --check` as a read-only documentation gate. It is not an implementation command and performs no Git mutation. No commit, push, branch delivery, merge, provider check, or GitHub operation is permitted.
