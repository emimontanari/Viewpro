# Proposal — Stage 20.11 Seguimiento Daily Workflow Corrections

**Status:** proposed, no product decision required.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-4.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B, slice B7.

## Slice contract

```txt
Stage: 20
Slice: 20.11 — Seguimiento daily workflow corrections
Objective: fix confirmed Seguimiento filter/navigation issues without turning it into advanced BI.
Evidence needed: seeded/API/UI proof for seller/date/kind filters, observation display, and stale-property links.
Do not touch: advanced reporting, exports, archived analytics unless separately approved.
Done: daily Seguimiento works predictably for manager/seller workflows.
Next slice: Stage 20.12 if document duplicate/visibility is confirmed.
```

## Findings to address

Filters by seller, date, and kind do not return the expected results against seeded data (audit FB-4). Reproduction must precede implementation: every confirmed failing filter case gets a test before the fix lands.

## Out of scope

Advanced reporting, exports, archived analytics, BI dashboards, KPI work, or any restructuring of the Seguimiento data model.

## Dependency

Sits behind Phase A in the revised plan and depends on the seller permission outcome from `22.8` because seller-scope visibility shares logic with seller-scope filter behavior.

## Next phases

Move to SDD `sdd-spec` once Phase A is closed.
