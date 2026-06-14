# Tasks — Consolidate MVP Master Plan

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–400 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single docs/control-plane PR |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Tasks

- [x] RED — Confirm drift exists: README points to stale Stage 26.0 active/next work and AGENTS lacks a current-plan handoff rule.
- [x] GREEN — Add `docs/plans/CURRENT_MVP_EXECUTION.md` with current answer, precedence, status ledger, validation gate, Stage 26.2 contract, and update rule.
- [x] GREEN — Update `docs/plans/README.md` so the handoff is first and stale Stage 26.0 active/next blocks are replaced.
- [x] GREEN — Update `AGENTS.md` to require reading the handoff before choosing MVP slices.
- [x] TRIANGULATE — Verify no tool-specific doc duplicates mutable next-slice state; do not add `CLAUDE.md` now.
- [x] REFACTOR — Tighten wording for cognitive load and keep historical docs as links/evidence.
- [x] VERIFY — Run docs-only checks: `git status --short`, handoff link grep, stale README negative grep, unchecked task grep, and `git diff --check`.

## Acceptance

- [x] New sessions identify Stage 26.2 as next after PR #138/#140 quick validation.
- [x] README no longer labels Stage 26.0 as next active slice.
- [x] AGENTS.md points agents to the handoff.
- [x] No product code changed.
