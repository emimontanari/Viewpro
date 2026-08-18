# Proposal: Remediate DeepmergeTS High Advisory

## Intent

Remove `GHSA-ggr8-5vv4-36mx` while preserving product behavior and Prisma 6.19.2. Prisma config's vulnerable `deepmerge-ts@7.1.5` pin fails the blocking production audit on clean `develop` and unrelated PR #324.

## Scope

### In Scope
- Add one parent-scoped override so only Prisma config resolves patched `deepmerge-ts` 8.x, currently evaluated as 8.0.1.
- Regenerate the lockfile with no unrelated dependency churn.
- Prove deterministic resolution, Prisma compatibility, repository health, and production-audit remediation.

### Out of Scope
- The 2 low and 3 moderate audit findings; retain them as documented residual findings.
- Prisma upgrades, application/schema behavior changes, audit suppression, or broad overrides.
- Any modification to PR #324.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None; this is dependency remediation with no product requirement change.

## Approach

Constrain the override to the vulnerable parent-child relationship. A lock refresh cannot escape the exact pin, broad overrides expand risk, and available Prisma upgrades remain vulnerable. Design must prove the supported pnpm selector and lockfile result rather than assume unverified syntax.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/package.json` | Modified | Parent-scoped override |
| `viewpro-app/pnpm-lock.yaml` | Modified | Minimal deterministic resolution |
| Both Prisma API workspaces | Verified | Validate, generate, and regression evidence only |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Transitive major-version incompatibility | Medium | Require Prisma validate/generate and both API suites; audit-green is insufficient |
| Unrelated lockfile churn | Medium | Review ancestry and exact lock delta after frozen installation |
| Temporary override debt | High | Remove after an adopted Prisma release carries the fix and repeats verification |

## Rollback Plan

PR A is planning-only and can be reverted independently. In PR B, revert `package.json` and `pnpm-lock.yaml` atomically. Because that rollback restores the high advisory, keep dependent merges paused; never weaken the audit gate.

## Issue and PR Relationship

Use two sequential PRs to `develop`, never a feature-branch tracker. PR A contains only exploration, proposal, spec, design, and tasks; its current exact five-file diff is 375 additions + 0 deletions, leaving 25 changed-line headroom under 400. After PR A merges, branch PR B from updated `develop`; it contains implementation plus apply/verify evidence and must independently remain at or below 400. The 450–491 two-PR figure is a historical planning estimate, not current diff authority. Issue #325 closes only when PR B merges green; only then update and rerun PR #324, without copying this fix into its diff.

## Success Criteria

- [ ] Frozen install succeeds; ancestry shows patched 8.x under both Prisma config paths and no vulnerable 7.x.
- [ ] Both Prisma schemas validate and generate without tracked generated-client changes.
- [ ] Relevant typecheck, lint, build, and tests pass for product and platform APIs.
- [ ] `pnpm audit --prod --audit-level high` exits 0; the 2 low and 3 moderate findings remain documented and out of scope.
- [ ] The diff contains only this OpenSpec change plus the intended manifest/lock remediation, and PR #324 remains unchanged.
