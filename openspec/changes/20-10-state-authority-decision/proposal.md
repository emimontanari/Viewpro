# Proposal — Stage 20.10 State Authority Decision and Change-Request Workflow

**Status:** proposed, awaiting product decision D1 (Cuenta Madre approval requirement before beta).
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-2, manual demo walkthrough 2026-06-13.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase A, slice A3.

## Slice contract

```txt
Stage: 20
Slice: 20.10 — State authority decision and change-request workflow
Objective: decide and, only if confirmed necessary, implement Cuenta Madre authority over official property status with seller change requests.
Evidence needed: current-role status mutation proof, approval/rejection tests if implemented, timeline/movement evidence.
Do not touch: custom workflow builder, custom statuses per agency, ProductForm redesign.
Done: official state cannot be overwritten by sellers outside the agreed rule.
Next slice: Stage 24.5 if notifications are involved; otherwise Stage 20.11.
```

## Open product decision (D1)

Does beta ship with sellers able to change official property status, or must a Cuenta Madre approval workflow gate state changes before pilot?

- If D1 = approval required: this slice is P0 immediate. Design must cover change-request entity, approver routing, owner-facing visibility during pending state, and movement timeline impact.
- If D1 = seller mutation acceptable for beta: this slice moves to backlog; the audit finding is recorded as known-allowed for beta with explicit user sign-off.

## Out of scope

Custom workflow builder, agency-defined custom statuses, ProductForm redesign, broad permission rewrite. Only the seller → Cuenta Madre approval path for official status changes is in scope if D1 = approval required.

## Next phases

Move to SDD `sdd-explore` and `sdd-spec` once D1 is recorded.
