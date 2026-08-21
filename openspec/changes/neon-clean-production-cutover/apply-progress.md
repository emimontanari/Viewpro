# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Completed: 2/16 tasks
- Current work unit: WU2 closure is satisfied; WU3a and WU3b remain unchecked and pending the approved sequential split.
- Delivery: `sequential-to-develop`; planning base is `800d1a3`. WU3a resolves then-live `origin/develop` when its fresh worktree is created. #347 WU2 implementation `d53a57c04f34efd20fc825aff5c03115c9c6c99f` is bound; WU1 remains `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`. `3212c43…` remains WU2 closure metadata only, never a runtime patch or base.

## Completed Tasks

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [x] 1.2 **WU2:** #347 merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` bound as reviewed-develop-merged; exact repository remediation receipt closed.

## Completed WU2 Identity Closure

- #347 implementation/TDD/native evidence remains verified; `remediation-manifest.v1.json` records WU2 as `reviewed-develop-merged` with `d53a57c04f34efd20fc825aff5c03115c9c6c99f` and the stable apply-progress receipt.
- WU2 is complete and its closure gate is satisfied.

## WU3 Failure, Review Blockers, and Approved Split

- Production reconstruction remains `main@868dc70` + #331/#333/#334/#335/#336 + reviewed WU1/WU2 runtime patches + later reviewed WU3a/WU3b/WU4–WU7 patches. #338/#341/#344/#351 and #314 remain excluded candidate identities while normal `develop` history is retained. WU2 closure `3212c43…` is receipt/gate metadata, not an automatic runtime patch. Candidate tooling rejects hidden and optional dependencies.
- Failed WU3 native attempt 5 is terminal failed with evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`. Review blockers were canonical repository/resolved Git authority, controlled real-Git/process evidence, detached/final-tree binding, explicit porcelain-v2 `-z` cleanliness, bounded TERM→KILL cleanup, and closed NUL/tree/path/dependency validation; the projected correction exceeded the 350-line review stop.
- Approved split: unchecked WU3a owns `candidate.mjs`, baseline spec, justified root package/lock entries, and additive CI with ~344-line target/stop 350 and native max 390; unchecked WU3b follows WU3a review/green CI/merge and owns the closed remediation/release schema/template/NUL tree/path/dependency/#314/excluded-patch classification with ~182-line target/stop 350 and native max 390. Both are autonomous PRs to `develop`; WU4 waits for WU3b.
- Before either slice, audit live `develop`, branches, worktrees, and paths; overlap/new commit requires refresh AND re-plan. WU3a uses a clean worktree, ignores dirty-root/stale-worktree contamination, and owns only root-importer (`.`) entries required by explicit `package.json` tooling pins/scripts. Preserve merged deepmerge; reject other/external importers, `autoInstallPeers` changes, and unrelated resolutions. Add AJV only if schema execution proves necessary.

## Implementation

- `usePlatformSyncDemand` now gates initial, focus, and interval demand on `document.visibilityState === 'visible'`.
- A hidden dashboard performs no synchronization request until a visible focus or cadence event occurs.
- `PlatformSyncProvider` retains its child content while truthfully rendering a degraded synchronization announcement.
- `SentryService` emits only classified tags (`environment`, `statusCode`, `exceptionType`, optional internal `failureCode`), contains client failures, and sends no request IDs or URL paths.
- `PlatformSyncCoordinator` emits a generic `PlatformSyncFailure` receipt for each mapped failure, contains telemetry failures, and never serializes dependency errors.
- Platform-sync integration tests own `platform-sync.fixture.ts` instead of importing the #334 shared operator fixture.
- `remediation-manifest.v1.json` binds WU1 and WU2 reviewed merges; it gates only WU3–WU7 implementation/compatibility and explicitly denies operational authority.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `apps/viewpro-web/src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts` | Web integration | 3/3 passed | Hidden mount expected zero demand and failed: actual calls `1` | 4/4 passed after visible-only gate | 5/5 passed: hidden focus stays idle, visible cadence resumes once | None needed; extracted `demandIfVisible` keeps each entry point consistent |
| 1.1 | `apps/viewpro-web/src/features/platform-sync/components/__tests__/platform-sync-provider.spec.tsx` | Web component | N/A (new file) | Covered by the task RED cycle above | 2/2 passed | Degraded and first-response states both preserve visible child content | None needed |
| 1.2 | `apps/viewpro-api/src/{common/filters,observability,platform-data}/__tests__/*` | Unit + platform integration | 12/12 passed after local `prisma generate` repaired the missing generated client | Original 5 assertions failed before implementation; correction evidence: DI 3/3, fixture 2/3, and Sentry containment 4 failures | 30/30 passed after runtime token wiring, credential-free fixture setup, and contained telemetry client failures | All five failure codes; 499/500/unhandled filter paths; capture/init failures preserve coordinator/filter control flow | Direct unit constructors pass explicit `undefined`; Nest remains fail-closed on a missing runtime token |
| 1.2 | `apps/viewpro-api/src/observability/__tests__/remediation-manifest.spec.ts` | Unit contract | 1/1 passed | Exact reviewed WU2 receipt expectation failed against candidate/null manifest | 1/1 passed after only the WU2 receipt was closed | Skipped: one exact structural receipt output | None needed; exact-object assertion proves candidateBranch/reviewBoundary absence |

## Verification

- `pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts` — safety net 3/3 passed; RED 1/4 failed; GREEN 4/4 passed; triangulation 5/5 passed.
- `pnpm --filter viewpro-web test ...use-platform-sync-demand.spec.ts ...platform-sync-provider.spec.tsx` — 7/7 passed.
- `pnpm --filter viewpro-web test src/features/tenants/components/__tests__/tenant-detail-view-page.spec.tsx` — 11/11 passed; real fixture summary and activity remain visibly rendered.
- `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-sync-coordinator.spec.ts` — 6/6 passed after local `prisma generate`; initial snapshot still performs zero dependency I/O before demand.
- `pnpm --filter viewpro-web typecheck` — passed.
- Targeted `oxlint --deny-warnings` for changed platform-sync files — passed. Full `lint:strict` remains blocked by seven unrelated warnings already present under `tenants`, `overview`, `lib`, and `proxy` paths.
- `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-sync-coordinator.spec.ts src/test-support/__tests__/operator.fixture.spec.ts` — safety net: initial harness load failed because `@prisma-platform/client` was not generated; after local `pnpm --filter @viewpro/platform-api db:generate`, 12/12 passed.
- `pnpm --filter @viewpro/platform-api test src/observability/__tests__/sentry.service.spec.ts src/observability/__tests__/remediation-manifest.spec.ts src/platform-data/__tests__/platform-sync-coordinator.spec.ts src/platform-data/__tests__/platform-sync.controller.spec.ts src/platform-data/__tests__/platform-sync.fixture.spec.ts` — RED: 5 initial failures plus 2 fixture-boundary failures; GREEN/refactor: 21/21 passed.
- `pnpm --filter @viewpro/platform-api typecheck` — passed.
- Targeted `pnpm exec oxlint --deny-warnings …` — unavailable: this frozen workspace has no `oxlint` executable.
- Refresh correction: stashed tracked and untracked WU2 files, rebased `faf870…` to `origin/develop@392bcb…`, restored the stash, proved the preserved candidate diff unchanged before correction, then dropped only the temporary WU2 stash. No conflict or unexpected file appeared.
- `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-data.module.spec.ts` — correction RED: 3/3 failed because Nest could not resolve `PlatformSyncCoordinator` constructor index 3; correction GREEN: 3/3 passed with the exported `SENTRY_CAPTURE` token/provider.
- `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-sync.fixture.spec.ts` — correction RED: 2/3 failed when no `DATABASE_URL` was supplied; correction GREEN: 3/3 passed after blank credentials are rejected before the DB guard.
- Sentry correction RED: 4 failures (`init`, `capture`, coordinator, filter delegation); GREEN: 15/15 passed. Final focused suite including global filter, all five coordinator classifications, module, fixture, and manifest: 30/30 passed; typecheck/diff-check passed; `oxlint` unavailable.
- `pnpm --filter @viewpro/platform-api test src/observability/__tests__/remediation-manifest.spec.ts` — closure safety net 1/1 passed; RED 1/1 failed against `candidate-awaits-review`/null merge with candidateBranch/reviewBoundary; GREEN 1/1 passed after the exact #347 reviewed-develop receipt.

## Remediation Receipt Boundary

`viewpro-app/scripts/production-cutover/remediation-manifest.v1.json` is a repository-local WU1/WU2 remediation receipt. It binds WU1 to reviewed `develop` merge `faf870ab0a29e6a271b7391776fc2f9cf25c12ac` and WU2 to #347 reviewed `develop` merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f`, each with the stable apply-progress receipt. It gates only WU3–WU7 implementation/compatibility, denies provider mutation/D.4/candidate promotion/traffic/production receipts, and creates no provider, traffic, deployment, candidate, release manifest, or external evidence.

## Native Attempt Status

- Attempt 5 remains terminal failed at evidence `sha256:e448a25dcbcaf1db88f994d05ef987bfecef4d044319320babe6ec61542496a2`; WU3a and WU3b are not settled, passed, or complete.
- No native reset, acquire, or settle occurs in this planning PR. After merge, WU3a requires a fresh worktree, then-live `origin/develop`, and explicit maintainer-authorized reset+acquire; settlement requires strict TDD, fresh 3-lens review, and final evidence. WU3b requires its own clean reset+acquire after WU3a merges.

## Remaining Work

- [ ] 2.1a WU3a remains pending; after planning merge, use a fresh then-live `origin/develop` worktree and explicit maintainer-authorized reset+acquire, then strict-TDD/3-lens review and final evidence before settlement.
- [ ] 2.1b WU3b remains pending until WU3a review, green CI, merge, fetch, and overlap audit; then use its own clean reset+acquire and separate strict-TDD/3-lens settlement gate.
- [ ] 2.2 WU4 remains blocked until reviewed-merged WU3b.

## Next Action

Submit this planning-only PR for review. The split decision is complete via the maintainer interactive decision and Engram #8114; native reset approval remains separate and phase-scoped. No provider, application, source, test, package, lock, CI, or production mutation is authorized here.
