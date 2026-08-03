<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/consolidate-mvp-master-plan (deleted 2026-07-26), delta dated 2026-06-14 -->
<!-- Rewritten 2026-07-26 for the post-cleanup layout: the handoff moved to the recta-final ledger, -->
<!-- capability specs became the contract, and 120 historical plan docs were deleted. -->

# Execution Control Specification

## Purpose

Keep every agent and contributor aligned on where the contract lives, where
mutable status lives, and what may never override either — so planning documents
cannot drift back into being treated as directives.

## Requirements

### Requirement: Single Live Execution Ledger

The repo MUST expose exactly one live execution ledger holding mutable status.
Agent entrypoints and plan indexes MUST point to it rather than duplicating
status.

#### Scenario: Agent starts from repo instructions

- GIVEN an agent reads `AGENTS.md` or `docs/plans/README.md`
- WHEN it needs current execution status or the next piece of work
- THEN it is directed to `docs/plans/2026-07-20-recta-final-execution.md`
- AND it is NOT directed to any other document for mutable status.

### Requirement: Capability Specs Are the Contract

Consolidated capability specs under `openspec/specs/<capability>/spec.md` MUST
be the authority on required system behavior. Planning documents describe
intent and MUST NOT be read as the behavioral contract.

#### Scenario: Required behavior is in question

- GIVEN a contributor needs to know what a capability must do
- WHEN plans, archived changes, and a capability spec all mention it
- THEN the capability spec under `openspec/specs/` controls
- AND plans and archived changes serve only as intent and evidence.

#### Scenario: A capability spec is missing for shipped behavior

- GIVEN production behavior exists with no capability spec covering it
- WHEN that behavior is about to be modified
- THEN the change MUST add or extend the capability spec before the code changes.

### Requirement: Archived Changes Are Evidence, Never Directives

Everything under `openspec/changes/archive/` MUST be treated as historical
evidence. Its `Status:` lines, checklists, and roadmaps MUST NOT be executed.

#### Scenario: An archived roadmap has unchecked boxes

- GIVEN `openspec/changes/archive/mvp-deploy-readiness/execution-roadmap.md` shows unchecked phases
- AND production has been live since 2026-07-22
- WHEN an agent reads those unchecked boxes
- THEN it MUST NOT treat them as open work
- AND it MUST verify status against the live ledger, git history, and running services.

### Requirement: Stale Document Text Cannot Override Verified Reality

Stale planning text MUST NOT override the live ledger, git-backed history,
capability specs, or an observed production check. An artifact's own status
claim is the weakest form of evidence.

#### Scenario: A proposal claims proposed for shipped work

- GIVEN an archived change's proposal says `Status: proposed`
- AND the feature is present in the schema, the code, and production
- WHEN status is determined
- THEN the code and production evidence control
- AND the stale claim MUST be disregarded.

### Requirement: Product Changes Continue Through SDD/OpenSpec

Future product, source, seed, migration, test, or runtime-config changes MUST
create or update a change under `openspec/changes/` before code changes begin.

#### Scenario: New product behavior is requested

- GIVEN a request that changes product behavior
- WHEN an agent prepares to edit code
- THEN it creates the change's SDD artifacts first
- AND on completion it consolidates the delta spec into `openspec/specs/` and archives the change.

### Requirement: Slice Contract

Every executable slice MUST declare Stage, Slice, Objective, Evidence needed,
Do not touch, Done, and Next slice.

#### Scenario: Slice is ready to execute

- GIVEN a slice is proposed as current or next work
- WHEN a reviewer checks it
- THEN all required fields are present before implementation starts.

## Invariants

- Exactly one live ledger for mutable status; indexes point to it, never restate it.
- `openspec/specs/` is the behavioral contract; `docs/plans/` is intent; `openspec/changes/archive/` is evidence.
- A completed change MUST NOT be deleted before its delta spec is consolidated into `openspec/specs/`.
- Demo credentials and demo URLs MUST NOT be presented as usable; the demo environment was abandoned 2026-07-26.
