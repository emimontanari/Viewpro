# C8A / U9 Exploration — Rejection

- Skill resolution: `none`; no phase-skill path was injected.
- Roots: worktree `/Users/emimontanari/Work/Apps/Viewpro-worktrees/seller-property-proposals-c8a-rejection`; app `viewpro-app`; change `openspec/changes/seller-property-proposals`. `openspec/config.yaml` identifies `viewpro-app` and canonical repo root `/Users/emimontanari/Work/Apps/Viewpro`.
- Recorded status is OpenSpec `ready` / `next: apply`, 35/79 after C7B; native status execution is unavailable to this read-only executor.

## U9 map

- Add only `apps/api/src/property-proposals/use-cases/reject-property-proposal.use-case.ts`, `review-transition-conflict.ts`, and their two colocated specs.
- Reject validates direct unknown input before the transaction: string only, trim, length 1..1000; invalid input is coded 400 `PROPERTY_PROPOSAL_REJECTION_REASON_INVALID`.
- In one transaction lock tenant-scoped proposal `FOR UPDATE`, reload it, lock reviewer and proposer users by ascending ID and exact memberships by ascending ID using `FOR NO KEY UPDATE`, then read the latest round and its decision.
- Revalidate reviewer from locked rows as active `MANAGER|PRINCIPAL_MANAGER` with current `PROPERTY_PROPOSALS_REVIEW`; role/status/capability loss denies before replay. Compare the durable `proposedByUserId` to actor ID and throw coded 403 self-review denial.
- The pure conflict helper classifies only the exact current round: an undecided `EN_REVISION` round may reject; same actor/outcome/normalized reason on durable `RECHAZADA` replays; stale round, other actor/outcome/reason, or any other state is coded 409.
- New decision insert is append-only (`REJECTED`, normalized reason) followed by proposal `RECHAZADA`/version increment. It creates no asset, engagement, assignment, source link, event, or canonical mutation.
- Existing review reads are insufficient for a locked command and the repository has no reject port. The U9 manifest intentionally adds no adapter/port: inject `PrismaService` in this use case; no repository/schema change is justified.

## RED, scope, and forecast

- Collected behavioral RED covers invalid reason matrix, current authority/replay loss, durable self-review after role gain, exact replay/no write, competing outcomes/actors/stale rounds 409, append-only rejection/no canonical rows, and rejected edit versus existing explicit C6 resubmit.
- Test lock-order and rollback cases; cleanup decisions, then rounds, proposals, and any captured assets in `finally` (U9 should create none). Run the U9 focused Vitest command and API typecheck from `viewpro-app` under the localhost `_test` guard.
- Update `tasks.md` and `task-delivery-plan.md` from C8 to C8A=U9 and C8B=U10A, retain C9–C20 names, and state 29 groups; record C8A TDD/verification in `apply-progress.md`. No U10A/B, controller/DTO/module/BFF/UI, schema/repository, provider, staging, or production work.
- Forecast: U9 source/tests 265–315 + ≤40-line exploration + ~25–30 topology/evidence closure = 330–385 changed lines, within 400; C8B remains a separate future U10A 235–275-line group.
