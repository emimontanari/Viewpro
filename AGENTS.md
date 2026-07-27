# Code Review Rules

## Execution source of truth

Before choosing or implementing work, read `docs/plans/2026-07-20-recta-final-execution.md` — the live execution ledger. Production has been live since 2026-07-22 (`app.inmoview.app`); see `docs/plans/2026-07-21-production-go-live-runbook.md` for the deployed topology.

For what the system is contractually required to do, read `openspec/specs/<capability>/spec.md` — the consolidated capability specs. Product and source changes go through SDD/OpenSpec (`openspec/changes/`) before code. Completed changes live in `openspec/changes/archive/` and are historical evidence only.

## General
- Keep changes small and focused.
- Exception: a one-time baseline import of an isolated third-party template may be large when the source, intent, and follow-up plan are documented, and later changes return to small focused commits.
- Prefer clear names over clever code.
- Update docs when behavior or setup changes.

## Configuration
- Keep configuration explicit and easy to understand.
- Avoid unnecessary complexity in project setup files.

## Git
- Use conventional commits.
- Do not commit secrets or credentials.
