# Design — Consolidate MVP Master Plan

## Decision

Add one short handoff at `docs/plans/CURRENT_MVP_EXECUTION.md` and route the planning index plus agent instructions to it. The handoff owns mutable current/completed/next state; the final MVP plan remains canonical for gates, order, non-goals, and slice template.

## Target artifacts

| Artifact | Action |
| --- | --- |
| `docs/plans/CURRENT_MVP_EXECUTION.md` | Add current answer, source precedence, status ledger, quick validation gate, next-slice contract, and update rule. |
| `docs/plans/README.md` | Make the handoff priority 1 and replace stale Stage 26.0 active/next blocks with handoff pointers. |
| `AGENTS.md` | Add a compact rule requiring agents to read the handoff before choosing MVP slices. |
| `CLAUDE.md` | Do not add now; add later only as a tiny pointer if needed. |
| `openspec/changes/consolidate-mvp-master-plan/` | Keep proposal/spec/design/tasks/apply/verify artifacts. |

## Flow

```txt
Agent starts
  -> reads AGENTS.md or docs/plans/README.md
  -> opens docs/plans/CURRENT_MVP_EXECUTION.md
  -> applies source precedence and quick validation gate
  -> validation passes: start SDD/OpenSpec for Stage 26.2
  -> validation fails: start SDD/OpenSpec for the regression slice
```

## Verification

- Changed paths stay limited to docs/OpenSpec/control-plane files.
- README and AGENTS both point to `CURRENT_MVP_EXECUTION.md`.
- README no longer labels Stage 26.0 as next active slice.
- Handoff includes the complete Stage 26.2 slice contract.
- `git diff --check` passes.

## Rollback

Revert the handoff, README edit, AGENTS rule, and this OpenSpec change folder. Historical plans and product code remain untouched.
