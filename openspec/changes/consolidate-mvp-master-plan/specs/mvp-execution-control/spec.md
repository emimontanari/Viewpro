# MVP Execution Control Specification

## Purpose

Keep all agents aligned on current ViewPro MVP execution state before selecting or implementing slices.

## Requirements

### Requirement: Single Current Execution Handoff

The repo MUST expose one current MVP execution handoff. Agent entrypoints and plan indexes MUST point to it instead of duplicating mutable state.

#### Scenario: Agent starts from repo instructions

- GIVEN an agent reads `AGENTS.md` or `docs/plans/README.md`
- WHEN it needs current MVP state
- THEN it is directed to `docs/plans/CURRENT_MVP_EXECUTION.md`.

### Requirement: Explicit Slice State With Evidence

The handoff MUST distinguish completed, validation-required, current, and next work. Status claims MUST include evidence references.

#### Scenario: Stage 26 status is selected

- GIVEN PR #138 and PR #140 are merged in current-branch history
- WHEN the handoff lists Stage 26 state
- THEN it identifies Stage 26.2 as next unless quick validation shows a regression.

### Requirement: Source Precedence Is Explicit

The handoff MUST define how to resolve conflicts between itself, the final MVP plan, audit overlays, OpenSpec artifacts, git evidence, indexes, and historical docs.

#### Scenario: Sources conflict

- GIVEN older docs contain stale active-work language
- WHEN an agent chooses the next slice
- THEN the handoff controls mutable status
- AND the final MVP plan controls gates, order, non-goals, and slice template.

### Requirement: Stale Plan Text Cannot Override Current Status

Stale plan sections MUST NOT override git-backed current status, accepted OpenSpec artifacts, or linked verification evidence.

#### Scenario: README mentions old active work

- GIVEN an index still mentions Stage 26.0 as active/next
- WHEN current branch evidence has moved beyond it
- THEN the index MUST be corrected or routed through the handoff.

### Requirement: Future Slice Contract

Every executable slice MUST declare Stage, Slice, Objective, Evidence needed, Do not touch, Done, and Next slice.

#### Scenario: Slice is ready to execute

- GIVEN a slice is proposed as current or next work
- WHEN a reviewer checks it
- THEN all required fields are present before implementation starts.

### Requirement: Product Changes Continue Through SDD/OpenSpec

Future product/source/seed/test/migration/runtime changes MUST use SDD/OpenSpec before code changes begin.

#### Scenario: Stage 26.2 starts

- GIVEN Stage 26.2 is next
- WHEN an agent prepares to change seeds or product behavior
- THEN it creates or updates that slice's OpenSpec artifacts first.
