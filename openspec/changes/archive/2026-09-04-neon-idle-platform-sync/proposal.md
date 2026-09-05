# Proposal: Demand-Triggered Platform Synchronization

## Intent
Resolve authoritative issue #327: unconditional five-second synchronization prevents both production Neon computes from autosuspending. Replace idle polling with authenticated console demand while preserving the existing ordered/idempotent outbox, projection, and durable-cursor lane.

## Scope
### In scope
- One manually verified `viewpro-api` synchronization replica; process-local single-flight and one producer-bounded batch per demand. **AC1, AC3, AC4**
- Authenticated browser→`viewpro-api` demand only; bounded product-feed HTTP timeout; no unconditional timer. **AC2, AC5**
- Conditional feed-visible→render SLO ≤10s and explicit updating/stale/failed states outside its normal-path conditions. **AC6**
- Existing ordered replay and cursor-after-durable-write behavior; mixed-version rollout/rollback and focused evidence. **AC7–AC9**
- Manual pre-retirement topology gate and ≥24h read-only normalized CU/autosuspend evidence before closure. **AC10–AC11**

### Out of scope
Independent #329: full envelope/payload and `BigInt` validation, DB-operation cancellation, multi-replica coordination, automated Dokploy/image/drift gates, restart-durable demand evidence, and a new multi-service acceptance harness.

## Capabilities
### New capabilities
None.
### Modified capabilities
- `platform-data-lane-ingest-metrics`: demand-triggered singleton catch-up, bounded feed wait, status, and idle quietness.
- `operator-console`: visible authenticated demand, conditional freshness, and degraded projection state.

## Approach
Extract the timer tick into a shared one-batch coordinator. Timer and demand coexist through additive slices; compatible web demand ships next. Only after manual actual-singleton and mixed-version evidence pass does the final slice remove timer/config. Delivery is finalized at 269 PR0 lines plus A→B→C→D, sequentially to `develop`, each ≤400 lines, no exception.

## Acceptance map
| Contract | Spec | Design | Tasks |
|---|---|---|---|
| AC1–AC4 | Lane: Demand/Singleton | Flow, coalescing | A, B, D gate |
| AC5–AC7 | Lane: Timeout/Cursor; Console: SLO | Status/SLO | A–C |
| AC8–AC11 | Lane: Rollout/Evidence | Gates/rollback | A–D |

## Risks and rollback
Cold/backlog/failure may exceed the SLO; display degraded state and continue one batch per later visible cadence. Roll back backend first to the paired timer-bearing image, then web, without cursor reset or outbox deletion; never roll back into concurrent-worker topology.

## Success criteria
- [ ] AC1–AC9 have named focused evidence; idle performs no synchronization work.
- [ ] AC10 records ≥24h evidence per project and passes only when `observed CU-hours × (720 / observation-window hours) ≤ 10 CU-hours/project`; sub-30-day evidence is labeled projected.
- [ ] AC11 keeps #327 open until implementation and provider evidence pass; #329 remains independent.
