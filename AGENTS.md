# Code Review Rules

## MVP execution source of truth

Before choosing or implementing MVP work, read `docs/plans/CURRENT_MVP_EXECUTION.md` first. Follow its source-precedence rules, use SDD/OpenSpec for product/source changes, and treat historical planning docs as context/evidence only unless the current handoff or an accepted OpenSpec change promotes them.

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
