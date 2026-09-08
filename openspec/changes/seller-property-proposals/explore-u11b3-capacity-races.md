# U11B3 exploration — final-slot capacity races

- Skill resolution: `paths-injected` (`gentle-ai`); preflight is auto / openspec / ask-on-risk / 400.
- Read live ledger first, OpenSpec config/proposal/spec/design/tasks/delivery/commands/progress, U11B2 exploration/harness, shared capacity, and direct create/restore transactions.
- Consumed parent-native selection: `seller-property-proposals` / OpenSpec / apply-ready, 46/81, repo-local target fresh `3b6f6912`, with the exact target root as the only allowed edit root and no action-context warning.

## Normative scope and minimal seam

1. Extend only `viewpro-app/apps/api/test/property-proposal-approval-race.spec.ts`; no production, schema, transport, UI, DB-test execution, or publication work.
2. Cover six real PostgreSQL final-slot cases: approval(A)/approval(B), approval(B)/approval(A), approval/direct-create, direct-create/approval, approval/active-restore, and active-restore/approval.
3. The direct-create and restore arms use `PrismaPropertyEngagementsRepository` transactions; direct-create/restore versus each other is not specified.
4. Set tenant capacity to one with no initial active engagement; each race proves exactly one capacity consumer succeeds, active count is one, and the losing approval returns coded quota 409 while losing direct-create/restore retains its message-only 409.
5. Approval success additionally proves its proposal/decision/source/CAPTURE asset/non-primary assignment; a losing proposal remains `EN_REVISION`; restore fixtures use an archived active engagement and prove its final archive state.
6. Pause the winner only after the real shared lock `SELECT id FROM tenants WHERE id = $tenantId FOR UPDATE`, not the approval proposal lock; observer requires loser `wait_event_type='Lock'` and `pg_blocking_pids(loserPid) === [winnerPid]` exactly.

## Fixtures, TDD, and forecast

- Preallocate proposal/round/user/tenant and restore IDs; cleanup captures every tenant engagement and every fixture-actor asset before deleting engagements → orphan assets → proposals → memberships/tenant → users, resets barriers, settles promises, and deadline-disconnects all named clients in `finally`.
- Existing U11B2 same-proposal coverage is GREEN-on-arrival; new final-slot assertions must first RED, then GREEN, with an exact-blocker-PID mutant; do not fabricate a RED for existing behavior.
- Forecast: race harness 225–255 + exploration 24 + `tasks.md` checkbox replacement 2 + `apply-progress.md` 24–30 = **275–311 physical lines**, under 400; no extraction is planned, and any extraction counts deletion plus addition then requires a new forecast/split stop.

## Applied evidence

- The test-local proxy pauses only after the actual tenant `FOR UPDATE` query has returned, then records that same transaction backend PID; the loser uses its named backend and is observed in `pg_stat_activity` waiting only on that PID.
- All six final-slot races passed against guarded localhost `viewpro_test`; the matrix checks exact approval-code versus direct-path message-only 409 responses, one active consumer, durable approval identities, CAPTURE/source/non-primary assignment, and archived restore state.
- The new observer seam had an honest RED (`pauseAfterTenantLock is not defined`); the first same-proposal attempt then returned the expected existing state-conflict code, so the final matrix uses two distinct proposals for approval/approval capacity contention. The targeted wrong-blocker-PID mutant failed all 10 race cases and was restored.

## Static evidence correction

- The first correction check was a static audit failure, not a new behavioral RED: final-slot winner decisions lacked `reviewRoundId`, restore lacked archive/movement audit coverage, and cleanup used fail-fast discovery.
- Final-slot assertions now bind the winner to its immutable round, assert proposal and engagement creator/source identities, preserve the losing approval snapshot at version 2 with no decision for its exact round, and distinguish restore's cleared win from actor/reason-preserved loss with a `RESTORED` movement audit.
- Cleanup obtains engagement and asset discovery results independently through `Promise.allSettled`, aggregates every discovery error, and falls back only to this fixture's tenant, actor, and preallocated restore IDs; this prevents one failed lookup from skipping cleanup of the other branch.
