# U11B2 exploration — same-proposal PostgreSQL races

- Skill resolution: `paths-injected` (`gentle-ai`); preflight is auto / openspec / ask-on-risk / 400.
- Read: live ledger, OpenSpec config/proposal/spec/design/tasks/delivery/commands, U11B1 exploration/progress, and real PostgreSQL cleanup/eligibility/primary race harnesses.
- Native readiness selected explicitly, not ambient: change `seller-property-proposals`, fresh `f234ad60`, cwd `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-u11b2-races/viewpro-app`; U11B1 is complete and U11B2 is the next unchecked apply unit.

## Minimal seam and evidence

1. Add only `apps/api/test/property-proposal-approval-race.spec.ts`; no production barrier, schema, transport, UI, BFF, U11B3, U12, or external work.
2. Construct real `ApprovePropertyProposalUseCase`, `RejectPropertyProposalUseCase`, `CanonicalPropertyMaterializer`, and `ActivePropertyEngagementCapacity` over three named local Prisma clients.
3. Wrap only the winner client's `$transaction` callback in a test-local transaction proxy: after its real first proposal `FOR UPDATE` returns, read its backend PID on that same transaction, signal, and await a bounded release.
4. Start the loser after that signal; observer polls its named `pg_stat_activity` row until `wait_event_type='Lock'` and `pg_blocking_pids(loserPid)` equals exactly `[winnerPid]`; timeout or early settlement fails.
5. Cover four cases: approve(A) wins/approve(B) loses, approve(B) wins/approve(A) loses, approve(A) wins/reject(B) loses, and reject(B) wins/approve(A) loses; winners are 200 and losers coded 409.
6. Assert one durable decision and final state/outcome, and for approval winners exactly one source engagement, asset, non-primary assignment, and result link; rejection winners assert no canonical rows.

## Fixtures, cleanup, and budget

- Preallocate fixture IDs before setup; in `finally` settle both operations, discover/capture every source engagement and asset before deletion, then delete source engagements → captured orphan assets → proposals (rounds/decisions cascade) → memberships/tenant → users.
- Release/reset the proxy barrier in every `finally`; preserve primary, settlement, cleanup, and three-client disconnect failures with `AggregateError`; bounded URL connect/statement/lock timeouts and `afterAll` `allSettled` disconnect leave no named connections.
- Actual budget: test 214 lines + this 23-line exploration + 24-line progress closure + two-line checkbox replacement = 263 changed lines, below 400 without code golf.
- Exact test command, only after the normative local-URL guard: `database_url='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public'; DATABASE_URL="$database_url" DIRECT_URL="$database_url" pnpm --filter @viewpro/api exec vitest run --retry=0 test/property-proposal-approval-race.spec.ts`.
- No U11B3 final-slot, U12 matrix, production seam, or provider work is part of this slice.
- The test-local proxy is removed by process teardown and cannot affect runtime behavior.
- Correction: count all tenant canonical engagements and all fixture-owned assets independently, then filter the former only to prove the exact source link; cleanup captures both complete sets before deletion.
- Every named client disconnects through a 5-second local deadline inside `Promise.allSettled`, so a disconnect timeout joins the preserved aggregate settlement failures.
