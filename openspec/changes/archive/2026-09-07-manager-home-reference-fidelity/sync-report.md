# Sync Report: Manager Home Reference Fidelity

## Status

**synced** — the verified ADDED delta was consolidated into the new canonical `crm-manager-home` capability without archiving the active change.

- Source: `openspec/changes/manager-home-reference-fidelity/specs/crm-manager-home/spec.md`
- Target: `openspec/specs/crm-manager-home/spec.md`
- Base/action context: explicit repo-local target at fresh `develop@32b175224f2a1d16cdbb6c2a371ceb535f49dc67`; generation 24 objective `manager-home-canonical-spec-sync`, running/finish. The unrelated dispatcher status was non-applicable to this worktree.
- Domain synced: `crm-manager-home`
- Collision check: no other active change has a `crm-manager-home` delta.
- Delta operations: ADDED 10; MODIFIED 0; REMOVED 0; RENAMED 0. No destructive approval was required.

## Exact inventory and digests

Requirement names, in canonical order:

1. Exact Manager Home Role Selection
2. Truthful Manager Heading and Current Date
3. Reference-Faithful Manager Content Hierarchy
4. Operational Metrics and Selected-Window Semantics
5. Truthful Priorities, Activity, and Rankings
6. Explicit Data States and Relevant Retry
7. Authorized Existing Actions Only
8. Unsupported Facts and Actions Are Absent
9. Accessible Responsive Manager Home
10. Protected Product Boundaries

- Exact count: **10 requirements / 22 scenarios**.
- Source file SHA-256: `62af12ebc660f0f33304eb1b1668d10fd2c735488c0c9b191212e4c39bf1172f`.
- Canonical file SHA-256: `c5bccdb6966199ebbbdf2e004d767f8b37f4965d78c3729762aa0a5cfcfd4848` (canonical Purpose/Requirements wrapper accounts for the file-level difference).
- Requirement-name inventory SHA-256: `9b378e9b34579f06f7af2736721c953aa395f0ceded251b059e194df13bb8b9e`.
- Scenario-name inventory SHA-256: `321b0febd35550ff879c31301fcb64de22b1ea7378e6443a4977af2ecc9e8eee`.
- Exact requirement/scenario blocks SHA-256: `0259c3060299f7d5bb353ac300a78b037ffa8134549b5cbf8d693a2c711f5f5c` in both source and canonical files.

## Verification and review reconciliation

- Verification remains **PASS: 10/10 requirements and 22/22 scenarios**.
- The three human-accepted historical limitations remain explicit: I2A lacks a behavioral RED, I2B was GREEN-on-arrival after the authorized split, and I1 lacks a complete exact pre-PR timing log. No missing evidence was manufactured.
- Live GitHub inspection covered P1–P4, I1, I2A, I2B, I3, I4A, I4B, I5, I6, and verify PRs `#538,#540,#541,#542,#543,#545,#546,#548,#551,#552,#553,#556,#558`: all 13 are merged and each reports 10/10 successful current check/status entries, including CI and CodeRabbit.
- Parent-native independent reviews reported each reviewed head safe to squash; no unresolved review blocker remains. Receipt mode was disabled/unmanaged, so no receipt approval exists or is claimed.
- The parent review-reconciliation and sync rows are `[x]`. Archive and #522 closure remain `[ ]`.

## Protected boundaries

No source, test, API, BFF, contract, schema, auth, tenant, public-route, owner-home, seller-home, #306, or #327 file changed. The active change directory was not moved. Canonical capabilities outside `crm-manager-home` were not modified.

## Commands and results

- `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --type change --strict --no-interactive` — PASS.
- `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate crm-manager-home --type spec --strict --no-interactive` — PASS; 10 requirements, with six informational long-text notices only.
- `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec list --specs | grep -F crm-manager-home` — PASS; `requirements 10`.
- Exact Python heading/inventory/block comparison — PASS; 10/22, ordered inventories equal, requirement/scenario blocks byte-equal.
- Active same-domain delta search — PASS; only this change owns `specs/crm-manager-home/spec.md`.
- Live `gh pr view`/GitHub API reconciliation — PASS; 13/13 merged PRs and 130/130 successful check/status entries.
- `git diff --check` — PASS.

## Accounting, rollback, and next phase

Final sync accounting is **233 additions + 2 deletions = 235 changed lines**, below the requested 270-line target and leaving 165 lines in the combined 400-line closeout budget. Rollback is bounded: delete the newly created canonical capability, remove this report, and revert only the two parent task checkmarks. No data repair or product rollback is needed.

Archive forecast: a later metadata/report update plus a rename of the active change should keep combined sync+archive below 400 changed lines if the already-synced canonical spec is not re-added. Stop archive if measured accounting disproves that forecast. Next recommended phase: **`sdd-archive`**.
