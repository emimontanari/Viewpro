# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Completed: 2/15 tasks
- Current work unit: 1.2 / WU2 identity closure complete; WU3 is next and pending its closure-PR review/CI/merge gate.
- Delivery: sequential-to-develop; #347 reviewed WU2 develop merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` is bound; WU1 remains `faf870ab0a29e6a271b7391776fc2f9cf25c12ac`.

## Completed Tasks

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.
- [x] 1.2 **WU2:** #347 merge `d53a57c04f34efd20fc825aff5c03115c9c6c99f` bound as reviewed-develop-merged; exact repository remediation receipt closed.

## Completed WU2 Identity Closure

- #347 implementation/TDD/native evidence remains verified; `remediation-manifest.v1.json` records WU2 as `reviewed-develop-merged` with `d53a57c04f34efd20fc825aff5c03115c9c6c99f` and the stable apply-progress receipt.
- WU2 is complete. WU3 remains blocked pending this closure PR's review/green CI/merge.

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

## Native Settlement Status

- Maintainer-authorized rebaseline attempt 4 completed at native revision `sha256:a4df1fe07c4eb182f40e19bca5de424f8a9dbac91daaed1401c28c8a6858f824` with evidence `sha256:fd82d03e536b5e2fd78c49b381b199eb10daf5da740150d315c819cf7b5e505d`.
- Attempt 3 remains immutable: its 537 counted lines comprise 400 base-only lines from mandatory #344 refresh plus 137 tracked WU2 lines. Complete WU2 is 329 lines; no size exception applies.

## Remaining Work

- [ ] 2.1 WU3 remains blocked until this WU2 closure PR is reviewed/CI-green/merged; all later tasks remain unchecked.
