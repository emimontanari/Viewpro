# Proposal — Consolidate MVP Master Plan

## Intent

Create one durable, repo-visible MVP execution handoff so Pi, Claude, OpenCode, and future agents stop choosing different next slices.

## Problem

The final MVP execution plan is canonical, but `docs/plans/README.md` had stale Stage 26.0 active/next language. The Stage 26 audit selected seller-permission and route-cleanup fixes, and `develop` has since merged those through PR #138 and PR #140. Without one current handoff, agents can restart completed work or treat historical docs as active commands.

## Scope

- Add `docs/plans/CURRENT_MVP_EXECUTION.md` as the single current status handoff.
- Update `docs/plans/README.md` to route readers there first and remove stale Stage 26.0 active/next wording.
- Update root `AGENTS.md` with a rule to read the handoff before choosing MVP slices.
- Keep OpenSpec artifacts for this docs/control-plane change.

## Current answer to preserve

```txt
Stage: 26
Slice: 26.2 — Deterministic seed contract
Objective: keep a stable demo/pilot dataset that exercises real business flows.
Evidence needed: seed run logs and smoke proof for manager, seller, owner, properties, images, movements, documents, notifications.
Do not touch: production data behavior.
Done: seed is deterministic, safe, and covers the full product story.
Next slice: 26.3 — Full seeded E2E.
```

Stage 26.2 starts only after quick validation that PR #138 seller-permission guards and PR #140 route cleanup still hold. If validation fails, the failed behavior becomes the immediate SDD/OpenSpec slice.

## Out of scope

Product code, seeds, migrations, tests, runtime config, implementing 26.2, broad historical-plan rewrites, or separate tool-specific roadmap copies.

## Success criteria

- A new session identifies the same next slice from one handoff.
- README no longer labels Stage 26.0 as next active slice.
- AGENTS.md points agents to the handoff.
- Historical docs remain context/evidence unless promoted.

## Rollback

Revert the handoff, README edit, AGENTS rule, and this OpenSpec change folder.
