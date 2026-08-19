# Tasks: Remediate DeepmergeTS High Advisory

## Review Workload Forecast

| Field | Value |
|---|---|
| Planning authority | PR #328 stays planning-only, open against `develop`, and ≤400 changed lines. |
| Implementation PR | PR B is exactly the manifest, lockfile, and `apply-progress.md` evidence work unit to `develop`, independently ≤400. |
| 400-line budget risk | High; recount each PR against its actual `develop` base. |
| Delivery strategy | Maintainer-approved implementation-first sequential delivery. |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
400-line budget risk: High

### Work Units

| Unit | PR | Base and boundary |
|---|---|---|
| Planning | #328 | `develop`; only reviewed planning artifacts, ≤400. |
| Remediation | B | Fresh `origin/develop` to `develop`; only `package.json`, `pnpm-lock.yaml`, and `apply-progress.md`, ≤400. |

## Phase 1: Establish Planning Authority

- [x] 1.1 Publicly record the maintainer-approved implementation-first order on #325 and #328 before apply; retain #328's audit failure as baseline evidence. Approval: `https://github.com/emimontanari/Viewpro/issues/325#issuecomment-5331737441`; `https://github.com/emimontanari/Viewpro/pull/328#issuecomment-5331737710`.
- [x] 1.2 Record the published/reviewed pre-apply planning authority `P=2ce6a6923ad4860177dfeab2fee545068d944283`; later published amendments are post-apply evidence, not retroactive pre-apply authority.
- [x] 1.3 Read the planning artifacts at `P`, then create B from fresh `origin/develop@D`; B must cite `P`, target `develop`, and use `Refs #325` without a closing keyword.

## Phase 2: Validate the Delivery Work Unit

- [x] 2.1 Reproduce baseline `pnpm audit --prod --audit-level high` failure without mutation; set B's ≤400 budget and reject global/Prisma overrides, manual lock edits, vulnerable ancestry, or unrelated lock churn.
- [x] 2.2 Add only `@prisma/config@6.19.2>deepmerge-ts` to `viewpro-app/package.json`; run one lockfile-only install, snapshot/archive/hash generated state before deletion, then frozen-install with pnpm 10.13.1.
- [x] 2.3 Use the specified localhost-only Docker lifecycle; run both Prisma validate/generate, typecheck/lint/build, ancestry, exact audit, clean-output/diff/secret checks, and rollback proof.
- [x] 2.4 Record commands/results, residuals, rollback evidence, D, exact boundary/count, predecessor delivery facts, and source/runtime digests in `apply-progress.md`; bind final head/tree/diff externally. Final verify/native CI are post-publication; any later commit invalidates evidence.

## Phase 3: Native CI and Implementation Merge

- [x] 3.1 PR #330 final-candidate evidence retained the all-workspace no-`.only` scan, both direct `vitest run --allowOnly=false --retry=0` commands, and green native CI; no Vitest config changed.
- [x] 3.2 PR #330 merged green to `develop` as `d3afbec53b5bed51abaa2453ca09262eed9a29cc` after its final CI passed.

## Phase 4: Refresh Planning, Close, and Unblock

- [x] 4.1 #328 was refreshed/retested against `develop@d3afbec53b5bed51abaa2453ca09262eed9a29cc`; its self-referential final head, five-file count, and fresh checks are bound externally in the current PR body/CI and invalidated by any new commit.
- [ ] 4.2 Require fresh review and fresh checks for #328's exact final head/base; do not reuse approval or checks from a changed candidate. Merge #328 only when green.
- [ ] 4.3 Authorize and manually close #325 only after B and #328 are both merged green. Only afterward update/rerun #324 against fixed `develop`, keeping this remediation out of #324's feature diff.
