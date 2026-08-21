# Apply Progress: Neon Clean Production Cutover

## Cumulative Status

- Completed: 1/15 tasks
- Current work unit: 1.1 / WU1
- Delivery: sequential-to-develop; WU1 is committed for review and targets `develop`, never `main` or a parent branch. WU2 may bind only its final reviewed `develop` merge identity.

## Completed Task

- [x] 1.1 **WU1:** RED→GREEN platform-sync/tenant/platform-data specs; visible-render/zero-I/O-idle/receipt.

## Implementation

- `usePlatformSyncDemand` now gates initial, focus, and interval demand on `document.visibilityState === 'visible'`.
- A hidden dashboard performs no synchronization request until a visible focus or cadence event occurs.
- `PlatformSyncProvider` retains its child content while truthfully rendering a degraded synchronization announcement.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `apps/viewpro-web/src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts` | Web integration | 3/3 passed | Hidden mount expected zero demand and failed: actual calls `1` | 4/4 passed after visible-only gate | 5/5 passed: hidden focus stays idle, visible cadence resumes once | None needed; extracted `demandIfVisible` keeps each entry point consistent |
| 1.1 | `apps/viewpro-web/src/features/platform-sync/components/__tests__/platform-sync-provider.spec.tsx` | Web component | N/A (new file) | Covered by the task RED cycle above | 2/2 passed | Degraded and first-response states both preserve visible child content | None needed |

## Verification

- `pnpm --filter viewpro-web test src/features/platform-sync/components/__tests__/use-platform-sync-demand.spec.ts` — safety net 3/3 passed; RED 1/4 failed; GREEN 4/4 passed; triangulation 5/5 passed.
- `pnpm --filter viewpro-web test ...use-platform-sync-demand.spec.ts ...platform-sync-provider.spec.tsx` — 7/7 passed.
- `pnpm --filter viewpro-web test src/features/tenants/components/__tests__/tenant-detail-view-page.spec.tsx` — 11/11 passed; real fixture summary and activity remain visibly rendered.
- `pnpm --filter @viewpro/platform-api test src/platform-data/__tests__/platform-sync-coordinator.spec.ts` — 6/6 passed after local `prisma generate`; initial snapshot still performs zero dependency I/O before demand.
- `pnpm --filter viewpro-web typecheck` — passed.
- Targeted `oxlint --deny-warnings` for changed platform-sync files — passed. Full `lint:strict` remains blocked by seven unrelated warnings already present under `tenants`, `overview`, `lib`, and `proxy` paths.

## Remediation Receipt Boundary

This artifact is the local WU1 implementation receipt only. It grants no provider, traffic, deployment, or candidate authority. WU2 alone may bind the reviewed WU1 identity and evidence to `remediation-manifest.v1.json`; no manifest instance, provider action, or external evidence was created here.

## Remaining Work

- [ ] 1.2 WU2 and all later implementation/lifecycle tasks remain unchecked.
