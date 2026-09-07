# Archive Report: Manager Home Reference Fidelity

## Status

**PASS — archived after completed canonical sync.**

- Source: `openspec/changes/manager-home-reference-fidelity/`
- Destination: `openspec/changes/archive/2026-09-07-manager-home-reference-fidelity/`
- Issue: #522 remains open; its tasks row remains `[ ]`. Closure is intentionally postponed until this archive PR merges.
- Review: disabled/unmanaged; no receipt approval is claimed.

## Canonical inventory and digests

- Canonical target: `openspec/specs/crm-manager-home/spec.md`; strict validation PASS.
- Exact canonical inventory: **10 requirements / 22 scenarios**, unique and ordered.
- Source delta SHA-256: `62af12ebc660f0f33304eb1b1668d10fd2c735488c0c9b191212e4c39bf1172f`.
- Canonical SHA-256: `c5bccdb6966199ebbbdf2e004d767f8b37f4965d78c3729762aa0a5cfcfd4848`.
- Requirement inventory SHA-256: `9b378e9b34579f06f7af2736721c953aa395f0ceded251b059e194df13bb8b9e`.
- Scenario inventory SHA-256: `321b0febd35550ff879c31301fcb64de22b1ea7378e6443a4977af2ecc9e8eee`.
- Exact requirement/scenario blocks SHA-256 in source and canonical: `0259c3060299f7d5bb353ac300a78b037ffa8134549b5cbf8d693a2c711f5f5c`.

## Verification and accepted limitations

- Verification: **PASS**, 10/10 requirements and 22/22 scenarios; focused 38/38, frontend 790/790, seeded 34/34, API 1,623/1,623, BFF 5/5, owner 19/19.
- Accepted evidence limitations: I2A has budget-failure rather than behavioral RED; I2B was GREEN-on-arrival after the authorized split; I1 lacks a complete exact pre-PR timing log. No evidence was manufactured.
- Residual evidence limitation: seeded long activity/property/seller geometry is conditional on real rows; deterministic component fixtures cover those values and the browser proof always covers long tenant wrapping.

## Boundaries and validation

- Protected: no source/tests/API/BFF/auth/session/public-route/owner/seller/#306/#327 mutation; unrelated archives and canonical specs preserved.
- Asset `assets/manager-home-reference.jpeg` SHA-256 remains `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`.
- Strict change and canonical OpenSpec validation: PASS; active same-domain delta inventory: only this change before move.
- Archive inventory exact; archived delta and all evidence present; active source path absent after move.
- `git diff --check`, `git status --short --branch`, and `git -c diff.external= diff --no-ext-diff --numstat`: PASS.
- Combined sync plus archive accounting: **279 additions + 3 deletions = 282 changed lines** (temporary-index equivalent); no exception used.

## File inventory and rollback

Archived files: `archive-report.md`, `apply-progress.md`, `assets/manager-home-reference.jpeg`, `design.md`, `exploration.md`, `proposal.md`, `specs/crm-manager-home/spec.md`, `sync-report.md`, `tasks.md`, `verify-report.md`.

Rollback: move the complete dated directory back to `openspec/changes/manager-home-reference-fidelity/`; remove only the archive report and revert only the archive task checkbox if the archive is rejected. Do not alter canonical specs or unrelated archives.

## Next step

After the archive PR merges, close issue #522 and then mark the issue-closure lifecycle row complete. No issue closure, commit, push, PR, source change, or API mutation was performed here.
