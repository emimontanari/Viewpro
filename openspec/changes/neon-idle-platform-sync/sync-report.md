# Sync Report: Demand-Triggered Platform Synchronization

## Status

**synced**

The verified `neon-idle-platform-sync` delta is merged into both canonical capability specifications. The active change remains in place and is ready for `sdd-archive`.

## Domains and canonical files

| Domain | Canonical file | Result |
|---|---|---|
| `operator-console` | `openspec/specs/operator-console/spec.md` | Updated |
| `platform-data-lane-ingest-metrics` | `openspec/specs/platform-data-lane-ingest-metrics/spec.md` | Updated |

## Delta operations

### ADDED

- `operator-console`: `Authenticated Visible Demand [AC2–AC4]`
- `operator-console`: `Explicit Projection State [AC4–AC6]`
- `operator-console`: `Conditional Normal-Path Freshness [AC6, AC9]`
- `platform-data-lane-ingest-metrics`: `Bounded Feed and Truthful Process Status [AC5–AC6]`
- `platform-data-lane-ingest-metrics`: `Compatibility, Rollback, and Provider Evidence [AC8–AC11]`

### MODIFIED

- `platform-data-lane-ingest-metrics`: `Interval Poll Job [AC1–AC4]`
- `platform-data-lane-ingest-metrics`: `Durable Cursor Advance [AC5, AC7]`
- `platform-data-lane-ingest-metrics`: `Data-Lane Environment Configuration [AC2]`

### REMOVED

None. Obsolete perpetual-poll wording and its parallel-poller invariant were removed only where superseded by the modified demand/single-flight contract.

## Guardrails and approvals

- Verification verdict: `pass_with_warnings`, with zero blockers and zero critical findings.
- Active same-domain collisions: none; the active `seller-property-proposals` change touches other domains.
- Legacy flat spec: none.
- Unsupported `RENAMED Requirements`: none.
- Destructive sync approval: the parent context explicitly approves the large MODIFIED canonical merge.
- Historical warning retained: D.4 singleton reconfirmation happened after merge/deploy rather than before it; verification treats this as non-blocking but permanently disclosed.
- `openspec/config.yaml` contains no `rules.sync` overrides.

## Status and action context

- Consumed native `gentle-ai.sdd-status` schema version 2 for the unambiguous change `neon-idle-platform-sync`.
- Artifact store: `openspec`; tasks are 14/14 complete and verification is complete.
- Action context: `repo-local`; workspace and allowed edit root are `/Users/emimontanari/Work/Apps/Viewpro-worktrees/neon-idle-platform-sync-canonical`.
- All canonical and report paths are within the authoritative workspace and allowed edit root.

## Validation

- Parsed both canonical files and confirmed unique requirement and scenario headings.
- Confirmed every scenario contains GIVEN, WHEN, and THEN structure.
- Confirmed all eight expected ADDED/MODIFIED requirements are present exactly once.
- Confirmed obsolete timer tick, configurable polling interval, and perpetual poller contracts are absent.
- Confirmed no active same-domain collision and no legacy flat change spec.
- `git diff --check`: PASS.
- Exact changed-path allowlist and `<400` changed-line checks: PASS.
- Canonical SHA-256: `operator-console` `c743e2955d39ebad93f4674458b1e412e5da82c182646cacc6f120d6cf29a6d1`; `platform-data-lane-ingest-metrics` `cc814b3061f97855b6af977f177536f65feb2e89536df5538ce32a7102f25ec6`.
- No source tests or builds were rerun because this phase changes canonical Markdown only; the passing verification report remains authoritative.

## Next recommended phase

Run `sdd-archive` after reviewing this canonical-only sync. Do not move the change during sync.
