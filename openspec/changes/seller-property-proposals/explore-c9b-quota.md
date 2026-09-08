# C9B / U11A Exploration — approval quota and proposer eligibility (#306)

## Status and readiness
- Skill resolution: `paths-injected` (`gentle-ai`). Active store: OpenSpec.
- Target-worktree evidence resolves the selected status as `apply: ready`, next `apply`, **41/79** complete (40 implementation + the completed parent authorization); selected slice is C9B/U11A, auto-chain/stacked-to-`develop`.
- Fresh baseline is the authorized target worktree at `faa759a0`; C9B may begin locally. No delivery/publication authorization is implied.

## Minimal edit surface
1. `viewpro-app/apps/api/src/property-proposals/use-cases/approve-property-proposal.use-case.ts` — inject/use the existing capacity lease, validate locked proposer eligibility, and map its domain error.
2. `viewpro-app/apps/api/src/property-proposals/helpers/approval-lock-order.ts` — isolate sorted reviewer/proposer user-membership locking and eligibility classification.
3. `viewpro-app/apps/api/src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts` — strict behavioral RED/GREEN evidence.
4. This exploration only; do not edit capacity, materializer, direct create/restore, module wiring, schema, transport, BFF, UI, or migrations.

## Transaction and outcomes
- One outer transaction locks proposal `FOR UPDATE` → acquires tenant capacity lock `FOR UPDATE` → locks involved users by ascending ID `FOR NO KEY UPDATE` → exact tenant memberships by ascending membership ID `FOR NO KEY UPDATE` → reads round/decision → asserts capacity only for a new approval → materializes, decides, and transitions.
- Proposer must be locked/re-read as `UserStatus.ACTIVE`, active exact-tenant `AGENT`; otherwise return 409 `PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE`, with no canonical/decision/proposal write.
- Catch `ActivePropertyCapacityExceededError` outside the transaction and return 409 `TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED`; preserve existing direct create/restore message-only conflicts and existing approval 404/403/state-conflict mappings.
- The shared lease already proves the isolated predicate: same tenant, `archivedAt: null`, excluding only `CLOSED` and `CANCELLED`; it opens no nested transaction. The U11A fake must prove one outer transaction, tenant lock before identity locks, `assertAvailable` before materialization, and rollback leaves `EN_REVISION`.

## Strict RED plan and boundary
- RED: full final slot yields the coded quota 409/no writes; inactive/deactivated/wrong-role proposer yields coded 409/no writes; restoring capacity then retries once to one approved aggregate; injected materializer/decision/update failure rolls back; lock/order and count predicate regressions fail.
- GREEN: smallest use-case/helper changes; TRIANGULATE by moving tenant lock after identities, omitting proposer eligibility, asserting after materialization, and broadening the inactive-status predicate; restore each mutant before refactor.
- Exclude U11B approval replay/competing approval-rejection/final-slot race proof, U13 mounting, and all external/provider work. U11A has no real multi-command race claim.

## Forecast and invocation
- U11A implementation is 165–200 lines; this 28-line exploration yields **193–228 physical lines**, below 400 with no exception.
- Native status invocation (target, not ambient): `gentle-ai sdd-status seller-property-proposals --cwd /Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c9b-quota`
- Later verification from `viewpro-app`: `pnpm --filter @viewpro/api exec vitest run src/property-proposals/use-cases/approve-property-proposal.quota.spec.ts && pnpm --filter @viewpro/api typecheck` (after the mandated localhost `*_test` guard).
