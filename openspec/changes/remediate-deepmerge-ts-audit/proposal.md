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

No product requirement changes; this is dependency remediation only.

## Approach

Constrain the override to the vulnerable parent-child relationship. A lock refresh cannot escape the exact pin, broad overrides expand risk, and available Prisma upgrades remain vulnerable. Prove the supported pnpm selector and lockfile result rather than assume syntax.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/package.json` | Modified | Parent-scoped override |
| `viewpro-app/pnpm-lock.yaml` | Modified | Minimal deterministic resolution |
| Both Prisma API workspaces | Verified | Validate, generate, and regression evidence only |

## Risks and Rollback

| Risk | Mitigation |
|---|---|
| Transitive major-version incompatibility | Require Prisma validate/generate and both API suites; audit-green is insufficient. |
| Unrelated lockfile churn | Review ancestry and exact lock delta after frozen installation. |
| Temporary override debt | Remove only after an adopted Prisma release carries the fix and repeats verification. |

The planning artifacts and implementation work unit are independently reversible. On an implementation failure, atomically revert `package.json` and `pnpm-lock.yaml`; because that restores the high advisory, keep dependent merges paused and never weaken the audit gate.

## Delivery Order and Issue Relationship

- Before apply, record the maintainer-approved implementation-first order publicly on issue #325 and PR #328. Keep #328 open against `develop` as the exact, independently reviewed planning authority; its current audit failure is expected baseline evidence.
- Record #328's published final planning head SHA before apply. PR B must cite that SHA and read those exact planning artifacts before implementation begins.
- Create PR B from fresh `origin/develop`; target `develop` and limit it to the focused implementation/evidence work unit at no more than 400 additions plus deletions. It receives native GitHub CI and uses `Refs #325`, never a closing keyword.
- Merge PR B only after its native checks are green. Then update and retest #328 against the fixed `develop`; require fresh review and fresh checks for #328's exact final head and base before merging its planning-only diff.
- Manually close #325 only after PR B and #328 have both merged green. Only afterward update and rerun #324 against fixed `develop`, without copying this remediation into #324's feature diff.

## Success Criteria

- [ ] Frozen install succeeds; ancestry shows patched 8.x under both Prisma config paths and no vulnerable 7.x.
- [ ] Both Prisma schemas validate and generate without tracked generated-client changes.
- [ ] Relevant typecheck, lint, build, and tests pass for product and platform APIs.
- [ ] `pnpm audit --prod --audit-level high` exits 0; the 2 low and 3 moderate findings remain documented and out of scope.
- [ ] The delivered implementation diff contains only the intended manifest/lock remediation and evidence; PR #324 remains unchanged.
