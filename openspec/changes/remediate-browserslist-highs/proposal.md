# Proposal: Remediate Browserslist High Advisories

## Intent

Restore the blocking production dependency-audit gate for approved issue #475 by replacing the stale transitive `browserslist@4.28.2` lock resolution with the cached patched `4.28.8` release. The remediation must preserve application behavior and unblock PR #473 without modifying that PR.

## Scope

### In Scope

- Refresh the shared Browserslist resolution in `viewpro-app/pnpm-lock.yaml` from `4.28.2` to `4.28.8` within the ranges already declared by Babel and webpack.
- Permit only mechanically required lockfile updates to existing Browserslist references, peer-qualified `update-browserslist-db` records, and bounded child data packages needed for a resolver-consistent patched graph.
- Prove deterministic installation with pnpm `10.13.1`, a frozen lockfile, patched ancestry, zero high-severity production audit findings, and repository compatibility checks.

### Out of Scope

- Changes to `package.json`, workspace manifests, overrides, or direct dependencies.
- Babel, webpack, Next.js, or other parent-package upgrades.
- Application behavior, source code, schemas, APIs, UI, CI policy, or audit suppression.
- Unrelated dependency refreshes, deduplication, importer movement, or broad resolver churn.
- Any change to PR #473.

## Capabilities

No product capability or specified behavior changes. This change is focused dependency-security maintenance only.

## Approach

Perform a lockfile-only transitive refresh to cached `browserslist@4.28.8`. The existing Babel and webpack ranges already admit this version, so no manifest constraint or override is justified. Accept the candidate only when the diff is confined to the Browserslist resolution family, existing parent references, peer-qualified `update-browserslist-db` consistency updates, and bounded mechanically required child data package movement.

Reject and restore any candidate that changes an importer, parent version, unrelated package, manifest, application file, or CI configuration. Frozen installation and dependency-graph inspection are mandatory; editing lockfile text or obtaining an audit-green result alone is insufficient evidence.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/pnpm-lock.yaml` | Modified | Replace the shared vulnerable Browserslist resolution and update only resolver-required related records. |
| Babel and webpack dependency paths | Verified only | Confirm all existing consumers resolve patched `4.28.8` without parent movement. |
| `viewpro-app/package.json` and workspace manifests | Unchanged | Confirm no direct dependency or override is introduced. |
| Application, schema, API, UI, and CI surfaces | Unchanged | Compatibility and policy remain as they are. |
| PR #473 | Unchanged | This remediation only removes its baseline audit blocker. |

## Risks

| Risk | Mitigation |
|---|---|
| A targeted refresh introduces unrelated resolver churn. | Reject any importer, parent, manifest, or unrelated package movement and restore the lockfile. |
| Peer-qualified or child data records become inconsistent. | Require pnpm `10.13.1` frozen installation and inspect the complete ancestry and lock delta. |
| Audit output is green while a vulnerable Browserslist copy remains. | Prove that every resolved Browserslist copy is `4.28.8` and none is `<=4.28.6`. |
| Build-tool compatibility regresses despite valid semver ranges. | Run the repository build, typecheck, lint, and CI-equivalent serial tests. |
| Low apparent runtime relevance is treated as an exemption. | Keep `pnpm audit --prod --audit-level high` authoritative and require zero high findings. |

## Rollback

Revert `viewpro-app/pnpm-lock.yaml` atomically to its pre-change state and rerun the frozen install. Rollback restores `browserslist@4.28.2`, the two high findings, and the merge block; the audit gate must never be weakened or bypassed to compensate.

## Success Criteria

- [ ] The implementation changes only `viewpro-app/pnpm-lock.yaml`; manifests, overrides, direct dependencies, application surfaces, CI, and PR #473 remain unchanged.
- [ ] The lockfile resolves the existing Babel and webpack paths to cached `browserslist@4.28.8`, with no `browserslist<=4.28.6` copy.
- [ ] Any related lock movement is limited to existing Browserslist references, required peer-qualified `update-browserslist-db` consistency records, and bounded required child data packages; no unrelated resolver churn is present.
- [ ] `pnpm install --frozen-lockfile` succeeds with pnpm `10.13.1` and creates no tracked post-install diff.
- [ ] `pnpm audit --prod --audit-level high` exits zero with zero high-severity production findings; lower-severity residual findings, if any, are recorded without expanding scope.
- [ ] Repository build, typecheck, lint, and CI-equivalent serial tests pass without application behavior changes.
- [ ] The lockfile implementation remains one focused, revertible work unit, and each sequential planning or implementation PR stays within the 400 changed-line review budget.
