## Exploration: Remediate DeepmergeTS production-audit failure

### Current State
Fresh `origin/develop` was fetched into `/Users/emimontanari/Work/Apps/Viewpro-worktrees/deepmerge-ts-audit` on branch `fix/deepmerge-ts-audit`. Both the branch and `origin/develop` point to `8f1b393297c68b86a6d56c7e71d932e753350017`.

From `viewpro-app/`, the exact CI command reproduced the failure without changing tracked files:

- Command: `pnpm audit --prod --audit-level high`
- Exit: `1`
- Result: 751 production dependencies; 2 low, 3 moderate, 1 high, 0 critical
- High finding: `GHSA-ggr8-5vv4-36mx` / `CVE-2026-40345`, `deepmerge-ts <8.0.0`, patched in `>=8.0.0`
- Finding path: `apps__api>@prisma/client>prisma>@prisma/config>deepmerge-ts`
- Lockfile SHA-256 before and after: `75acd59029b8dba5c966c1d310cd534850f2e0ac5bb753d39db5a8258b9dab9f`
- `git status --short` remained empty before artifact creation.

This matches GitHub Actions run `32137724875`, job `95712852679`. PR #324's merge ref failed after a successful frozen install, but PR #324 changes neither dependency manifests nor the lockfile. The failure is therefore baseline/pre-existing on clean `develop`, not introduced by PR #324; that 389-line restore-validator slice must remain untouched and separate.

After a disclosed immutable hydration (`pnpm install --frozen-lockfile --ignore-scripts`), both `pnpm why --recursive --prod deepmerge-ts` and `pnpm list --recursive --prod --depth Infinity deepmerge-ts` reported the same installed chain for both API workspaces:

`@prisma/client 6.19.2 -> prisma 6.19.2 (optional peer) -> @prisma/config 6.19.2 -> deepmerge-ts 7.1.5`.

The four manifest/lock hashes remained identical and no tracked file changed. Both local Prisma CLI/client pairs report aligned `6.19.2` versions.

**Root-class triage:** systemic bucket C, a real new bug in the recurring production dependency-audit cluster. The package is not a direct Viewpro dependency. It is not a stale lock resolution: `@prisma/config@6.19.2` pins `deepmerge-ts` exactly to `7.1.5`, so a lock refresh cannot select 8.x. It is not caused by a local override: no existing override mentions `deepmerge-ts`. Viewpro is one Prisma patch behind (`6.19.3` exists), but `@prisma/config@6.19.3` still pins `7.1.5`; current Prisma `7.9.1` does too. The root is Prisma's upstream exact transitive pin combined with the newly published advisory.

The advisory is high severity (CVSS 4.0 score 8.2) because recursive attacker-controlled object graphs can exhaust the Node stack. Practical Viewpro exploitability appears low: Prisma's only call site passes plain `deepmerge` as c12's merger for developer-controlled `prisma.config.*`, and this repository has no Prisma config file. This does not justify waiving the authoritative blocking audit gate.

Issue #310 and merged PR #312 established the convention: isolate dependency remediation, avoid unrelated parent/lock churn, prove frozen resolution and the exact audit, then run build/typecheck/lint/tests. #310 addressed different advisories (`fast-uri` and `nanoid`) and is closed. Searches across all open Viewpro issues and PRs for the GHSA, CVE, package name, and Prisma-audit root returned no matches. This is not a duplicate; it belongs to the same historical dependency-audit cluster.

### Affected Areas
- `viewpro-app/package.json` — likely location for one narrowly parent-scoped pnpm override; no change was applied during exploration.
- `viewpro-app/pnpm-lock.yaml` — would record only the override mirror and `deepmerge-ts` 8.0.1 resolution/snapshot changes.
- `viewpro-app/apps/api/package.json` — evidence for the aligned Prisma 6.19.2 CLI/client pair; no version change is recommended.
- `viewpro-app/apps/viewpro-api/package.json` — second aligned Prisma consumer; no version change is recommended.
- `viewpro-app/apps/{api,viewpro-api}/prisma/schema.prisma` — validation/generation surfaces for compatibility evidence; no schema change is expected.
- `.github/workflows/ci.yml` — authoritative frozen-install and production-audit commands; no workflow change is indicated.
- `openspec/changes/remediate-deepmerge-ts-audit/exploration.md` — this exploration artifact.

### Approaches
1. **Narrow parent-scoped override to `deepmerge-ts@8.0.1`** — override only `@prisma/config@6.19.2>deepmerge-ts`, preserving Prisma 6.19.2 and every unrelated dependency.
   - Pros: smallest immediate remediation; 8.0.1 is patched; pnpm supports parent-scoped overrides; the upstream Prisma fix uses 8.0.1 and reports audit green plus 142 config tests passing; no Prisma client/engine migration.
   - Cons: intentionally crosses a transitive major boundary and creates temporary override debt. DeepmergeTS 8 changes Map merging, `deepmergeInto` mutation behavior, and some types; Prisma uses only plain `deepmerge`, but local config validation/generation must still prove compatibility. The upstream PR remains open and review-required.
   - Compatibility/tests: API surface used by Prisma remains exported with the same Node `>=16` floor. Validate both Prisma schemas, generate both clients, build/typecheck/test both APIs, and inspect resolution/audit evidence.
   - Rollback: revert `package.json` and `pnpm-lock.yaml` atomically; this restores the red high-severity audit, so dependent merges remain paused.
   - Advisory removal: yes, if `pnpm why/list` proves only 8.0.1 and the exact audit exits 0.
   - Effort: Low

2. **Consume an upstream Prisma release containing the fix** — update aligned `prisma` and `@prisma/client` versions in both APIs only after Prisma publishes the `deepmerge-ts` 8 change.
   - Pros: upstream owns and tests the transitive major change; no local override debt.
   - Cons: no such release exists today. Prisma 6.19.3 and 7.9.1 remain vulnerable; upstream issue #30052 and PR #30054 target the v7 line. Moving Viewpro from Prisma 6 to 7 is a major migration, not a security-maintenance patch, and generated-client/runtime changes would broaden scope substantially. A Prisma 6 backport is not promised.
   - Compatibility/tests: future patch/minor could use the same verification set; a Prisma 7 update requires its own migration design, generated-client review, and broader regression suite.
   - Rollback: revert all aligned Prisma manifest and lock changes together, including regenerated artifacts if any.
   - Advisory removal: only after a published package's `@prisma/config` resolves `deepmerge-ts >=8`; current releases do not.
   - Effort: Low if a 6.x backport ships; High for Prisma 7

3. **Lockfile-only refresh or manual lock edit** — attempt to move only the locked transitive package.
   - Pros: superficially small diff.
   - Cons: not legitimate here. The parent manifest pins exactly `7.1.5`; a normal refresh must retain it, while a manual 8.x lock substitution misrepresents the parent contract and is not a maintainable resolver outcome. Frozen determinism may fail or future installs may restore 7.1.5.
   - Compatibility/tests: cannot establish a valid manifest-to-lock contract.
   - Rollback: revert the lockfile, restoring the audit failure.
   - Advisory removal: a hand-edited lock might silence audit temporarily, but it is rejected as invalid remediation.
   - Effort: Low but unacceptable

4. **Broad override, audit ignore, or unrelated parent upgrade** — force every `deepmerge-ts` consumer, suppress the GHSA, or upgrade Prisma to latest solely for scanner output.
   - Pros: a broad override can turn audit green; an ignore is tiny.
   - Cons: broader compatibility surface than necessary; ignoring leaves vulnerable bytes installed; Prisma 7 still pins 7.1.5 and adds migration risk. None shrinks the root safely.
   - Compatibility/tests: broad override requires inventorying every consumer; an ignore cannot pass remediation acceptance.
   - Rollback: remove the override/ignore/major upgrade, reopening the gate.
   - Advisory removal: broad override yes if 8.x resolves; ignore no; current Prisma upgrade no.
   - Effort: Low to High, not recommended

### Recommendation
Use a compact security-maintenance OpenSpec change and, only after issue approval and accepted planning artifacts, apply one parent-and-version-scoped override from `@prisma/config@6.19.2` to `deepmerge-ts@8.0.1`. Keep both Prisma CLI/client pairs at 6.19.2. This is the smallest valid immediate path, matches the compatibility analysis and test evidence in upstream PR #30054, and avoids conflating the remediation with a Prisma 7 migration or PR #324.

The override must be treated as temporary debt. Track upstream #30052/#30054 and remove it only when an adopted Prisma release declares a patched deepmerge dependency and the same verification remains green.

**Smallest named verification set (future implementation):**

1. `pnpm install --frozen-lockfile` and a second clean/frozen install check; reject manifest/lock mismatch or unrelated lock churn.
2. `pnpm why --recursive --prod deepmerge-ts` and `pnpm list --recursive --prod --depth Infinity deepmerge-ts`; require 8.0.1 under both API Prisma paths and no 7.x copy.
3. `pnpm audit --prod --audit-level high`; require exit 0 and document residual low/moderate findings.
4. With non-secret local placeholder URLs only: `pnpm --filter @viewpro/api db:validate`, `pnpm --filter @viewpro/platform-api db:validate`, then both `db:generate` commands. Require no tracked generated-client diff. The product client generates under `node_modules`; the platform client generates under ignored `src/generated/`.
5. `pnpm --filter @viewpro/api typecheck`, `lint`, `build`, `test` and the same four commands for `@viewpro/platform-api`, using only sanctioned test databases where tests require them. No production/cloud/database access belongs in this change.
6. Final `git diff --check`, boundary review, and confirmation that PR #324 remains untouched.

**Superseded forecast (historical):** The original 220-320-line, one-PR Low-risk recommendation is superseded by the measured >400 forecast and maintainer-approved implementation-first two-PR delivery. Keep the root-cause evidence above; #328 planning and PR B are independently ≤400. OpenSpec planning and verification remain mandatory.

### Risks
- DeepmergeTS 8 is a real major release; audit green alone does not prove Prisma config compatibility.
- Upstream PR #30054 is open, review-required, and targets Prisma v7; its evidence is strong but not a released support guarantee for Prisma 6.
- A broad resolver command can introduce unrelated lock churn; the future design must constrain and inspect the exact lock delta.
- Waiting for upstream leaves PR #324 and other merges blocked for an unknown period; upgrading to Prisma 7 merely to clear this advisory is disproportionate.
- Rollback necessarily restores the high finding and must pause dependent merges rather than weaken CI.

### Ready for Proposal
Yes, after a new Viewpro bug issue is created in the established #310 format and a maintainer adds `status:approved`. This checkout has no repository issue-template files, so creation must not pretend a template exists. No open issue/PR duplicates this advisory; #310 is historical evidence for the same cluster, not a canonical open tracker for this new root. Do not implement, open a remediation PR, or touch PR #324 before that approval and acceptance of the compact OpenSpec proposal/design/tasks.
