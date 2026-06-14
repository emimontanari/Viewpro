# Proposal — Stage 26.6a InmoView Copy and Role-Language Pass

**Status:** proposed, no product decision required (low-risk copy pass).
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-10.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase F, slice F1.

## Slice contract

```txt
Stage: 26
Slice: 26.6a — InmoView copy and role-language pass
Objective: apply low-risk user-facing copy corrections for the real-estate audience.
Evidence needed: copy inventory and screenshots/tests for critical login/nav/dashboard/owner/admin surfaces.
Do not touch: internal enum names, auth/permission semantics, database role migrations unless explicitly approved.
Done: critical UI uses InmoView, Vendedor, Encargado, Cuenta Madre language consistently enough for pilot.
Next slice: Stage 26.6 pilot-ready deck.
```

## Copy renames (user-facing only)

- `Agente` → `Vendedor`.
- `Manager` → `Encargado`.
- Preserve `Cuenta Madre` as the term for the head agency entity.
- Brand surface uses `InmoView` for pilot demo.

## Hard rules

- Internal enums (`SELLER`, `MANAGER`, `OWNER`, `VIEWPRO_ADMIN`, etc.) are NOT renamed.
- Database role values are NOT migrated.
- Permission guards and auth semantics are unchanged.
- This slice is copy and translations only. Any code-level rename requires its own slice and approval.

## Dependency

Runs after `26.5a` because pilot domain/branding affects which copy surfaces matter for the handoff.

## Next phases

Move to SDD `sdd-spec` once Phase E is closed.
