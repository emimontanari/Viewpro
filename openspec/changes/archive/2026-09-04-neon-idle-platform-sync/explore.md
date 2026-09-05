## Exploration: Neon idle platform synchronization (issue #327)

### Current state
Production evidence on 2026-08-18 showed both Neon projects at about 105.6/100 CU-hours and near-identical query counts: 463,945 product outbox reads and 463,950 platform cursor reads. The unconditional five-second `PlatformDataPollJob` loop is the confirmed cause; Docker health checks, local-Postgres CI, temporary restore projects, and backups do not explain the sustained pair.

The existing lane is sound and retained: product mutations write ordered outbox events transactionally; the producer returns one ascending bounded batch; `viewpro-api` writes idempotent projections sequentially and advances its durable cursor only after writes. Failures replay from that cursor. The defect is the unconditional timer, unbounded feed HTTP wait, and lack of operator-visible synchronization state.

### Historical approaches
| Approach | Finding | Resolution |
|---|---|---|
| Idle backoff | Still wakes both computes and weakens freshness. | Superseded. |
| Demand catch-up | Eliminates idle synchronization wakeups while preserving the lane. | **Approved.** |
| Push/hybrid | Adds delivery/reconciliation ownership and cross-service scope. | Not selected. |
| Distributed coordination | Needed only for concurrent workers/multiple replicas. | Split to independent #329. |

### Approved decisions
- #327 is a demand-triggered, process-local singleton correction. Authenticated visible-console requests reach only `viewpro-api`; one operationally verified synchronization replica is mandatory.
- One demand starts one producer-bounded batch. Demand during an active run joins that promise; it never queues a follow-up. A later visible four-second cadence may start the next batch after completion, eventually draining backlog.
- Feed HTTP is bounded; cursor/projection semantics are preserved. Cold, backlog, timeout, and failure paths expose updating, stale, or failed state.
- #329 independently owns payload/BigInt validation, DB cancellation, multi-replica coordination, automated topology/drift gates, restart-durable evidence, and a new multi-service harness. None blocks #327.
- Planning gate: **PASS**. Delivery is Planning PR0 → A → B → C → D, sequentially to `develop`, each PR ≤400 lines, no size exception.

### Affected areas
- `viewpro-app/apps/viewpro-api/src/platform-data/` — one-batch coordinator, timeout, authenticated demand/status, timer retirement.
- `viewpro-app/apps/viewpro-web/src/features/platform-sync/` and dashboard layout — visible demand, projection invalidation, degraded state.
- `viewpro-app/apps/viewpro-api/src/config/`, `.env.example`, and production runbook — interval removal and ordered release evidence.

### Retained risks
- A longer fixed interval is not a fix; any periodic query inside Neon's five-minute idle window prevents autosuspend.
- Cold activation or backlog can exceed the normal SLO; the UI must not claim otherwise.
- Process-local single-flight is safe only under the manually verified singleton topology. Unknown or non-singleton actual state blocks timer removal and deployment.
- Future outbox cleanup needs a consumer-watermark policy; current retained history permits delayed replay.

### Ready for proposal
Yes. Earlier “not ready” and pending-decision conclusions are superseded by the approved singleton policy, #329 split, conditional SLO, degraded-state contract, and PR0→A→B→C→D plan.
