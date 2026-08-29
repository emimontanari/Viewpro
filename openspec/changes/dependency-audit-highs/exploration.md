## Exploration: Dependency audit highs

### Current State
The production dependency gate is currently red on the unchanged `develop` dependency tree. A fresh `pnpm audit --prod --audit-level high --json` reports 751 production dependencies, 2 low, 3 moderate, 2 high, and no critical vulnerabilities. CI run `31487292122` for docs-only PR #309 reproduces the same two highs after a successful frozen install; its typecheck/lint/build and test jobs are green.

The two high findings have separate package-level symptoms but one root cluster: newly published advisories against transitive build tooling recorded as production dependencies.

- `fast-uri` is locked once at 4.1.1 and is reached in the blocking audit through `apps/app-new > @sentry/nextjs 10.53.1 > @sentry/webpack-plugin 5.3.0 > webpack 5.106.0 > schema-utils 4.3.3 > ajv 8.20.0 > fast-uri`. Ajv 8.18.0 and 8.20.0 both declare `fast-uri: ^3.0.1`, but the root override `fast-uri@>=3.0.0 <=3.1.3: >=3.1.4` replaced that bounded range with an unbounded lower bound and forced 4.1.1 across a major boundary. GHSA-7p8r-x3mc-p8w7 affects 3.x before 3.1.5 and 4.x before 4.1.2; 3.1.5 is the smallest patched version that remains inside Ajv's declared range.
- `nanoid` is locked once at 3.3.16 through PostCSS 8.5.23. PostCSS declares `nanoid: ^3.3.16`, so patched 3.3.18 is already compatible without changing PostCSS, Next.js, Tailwind, Vite, or another parent. GHSA-2v37-7h3g-55p8 affects nanoid before 3.3.17. PostCSS imports `nanoid/non-secure` and calls `nanoid(6)` for anonymous CSS input IDs; it does not use the vulnerable zero-size `customAlphabet`/`customRandom` shape.

Both packages are runtime-classified by pnpm because their parents are under application `dependencies`, but the observed paths are build/compile tooling. The repository does not expose either advisory's vulnerable primitive to request-controlled application data: fast-uri is used by Ajv inside webpack schema validation, and nanoid is used by PostCSS with a constant size of six. Direct production exploit relevance is therefore low, while merge relevance is immediate because the required audit gate is authoritative.

Issue #310 is a root-class C confirmed bug in the dependency-audit cluster. It is not a duplicate of a parent-package upgrade. PR #309 did not introduce the vulnerable tree; its docs-only merge ref inherited the unchanged `develop` lockfile and is blocked until #310 lands and #309 reruns against the updated base.

### Affected Areas
- `viewpro-app/package.json` — remove the stale, unbounded `fast-uri` override that caused the incompatible 4.x resolution.
- `viewpro-app/pnpm-lock.yaml` — resolve `fast-uri` 3.1.5 and `nanoid` 3.3.18 without changing parent packages.
- `.github/workflows/ci.yml` — evidence source for the frozen-install and blocking production-audit commands; no change is indicated.
- `openspec/changes/dependency-audit-highs/exploration.md` — records the read-only diagnosis and remediation boundary.

### Approaches
1. **Remove the stale fast-uri override and refresh only the two transitive packages** — let Ajv's existing `^3.0.1` range select 3.1.5 and PostCSS's existing `^3.3.16` range select nanoid 3.3.18.
   - Pros: deletes the root cause; stays within both parents' declared ranges; avoids framework/parent upgrades; smallest lockfile diff; permits future compatible patch resolution.
   - Cons: requires a targeted lockfile refresh and diff inspection to prevent unrelated resolver churn.
   - Effort: Low

2. **Replace the fast-uri override with an exact 3.1.5 pin and add a nanoid override** — force both patched versions from the root manifest.
   - Pros: deterministic resolution independent of the current lockfile refresh command.
   - Cons: preserves and expands override debt, duplicates ranges already declared by Ajv/PostCSS, and creates future cleanup work.
   - Effort: Low

3. **Upgrade Sentry/webpack/PostCSS or other parents** — accept the audit tool's suggested parent upgrades.
   - Pros: may absorb additional upstream fixes.
   - Cons: unnecessary for these advisories, materially broadens compatibility risk and lockfile churn, and duplicates remediation already available inside current parent ranges.
   - Effort: Medium

### Original Recommendation (Superseded)
The original exploration candidate is retained as history only and is **rejected**. It must not be interpreted as an active implementation instruction or executed: `pnpm update fast-uri nanoid --recursive --lockfile-only` can introduce collateral dependency movement.

The reviewed controlled-lockfile design in [`design.md`](./design.md) supersedes this candidate. It requires a manual, record-limited lockfile edit and explicitly prohibits `pnpm update`, `pnpm install --lockfile-only`, `pnpm dedupe`, `--latest`, and parent upgrades. The active outcome remains `fast-uri@3.1.5` and `nanoid@3.3.18` without changing Ajv, PostCSS, Sentry, or webpack parent versions.

Expected authored/lock churn is limited to deleting one manifest override plus the lockfile override mirror, replacing the two package resolution/integrity entries, changing both Ajv snapshot references, changing the PostCSS snapshot reference, and replacing the two empty snapshot keys. No importer or parent version should move. Do not run `pnpm dedupe`: the read-only `pnpm dedupe --check` already predicts unrelated js-yaml and semver churn.

Verification commands from `viewpro-app/`:

1. `pnpm install --frozen-lockfile`
2. `pnpm why fast-uri --recursive`
3. `pnpm why nanoid --recursive`
4. `pnpm audit --prod --audit-level high`
5. `pnpm build`
6. `pnpm typecheck`
7. `pnpm lint`
8. Exact CI serial topology: provision and migrate both test databases, then run `pnpm exec turbo run test --concurrency=1`.

The final audit may continue to report the currently observed 2 low and 3 moderate findings, but it must exit successfully at `--audit-level high`. The unified PR must contain the five planning artifacts plus the two dependency files; its dependency sub-boundary must contain only `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`, with no parent upgrade.

Rollback is a normal two-file revert. It has no schema, data, configuration, or runtime-state migration, but rollback restores the two vulnerable locks and reopens the blocking audit failure, so it is only appropriate if build/test compatibility fails and the merge remains paused.

### Risks
- A broad update, install regeneration, or dedupe can introduce unrelated lockfile churn; use the approved controlled lockfile edit and reject parent/importer movement.
- Removing the override without explicitly refreshing fast-uri could leave the existing 4.1.1 lock entry in place; resolution evidence must show 3.1.5.
- Audit output classifies build-tool paths as production because of manifest placement; this must not be misrepresented as confirmed request-time exploitability or used to waive the blocking gate.
- PR #309 remains red until the remediation is merged into `develop` and its merge ref/checks are refreshed.

### Ready for Proposal
Yes. The root causes, patched versions, package boundaries, commands, rollback, and relationship to issue #310/PR #309 are confirmed. No parent upgrade or product decision is required.

### Decisions Still Needed
None. Preserve the approved single-PR strategy and 400-line review budget. During implementation, reject any generated diff that upgrades parents or includes unrelated dedupe churn.

### Forecast
- Expected unified PR footprint: approximately 365–380 changed lines across seven files; the dependency sub-boundary remains approximately 15–30 lockfile-resolution lines.
- Expected files: five planning artifacts plus exactly `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`.
- Delivery: exception #6840 permits the unified seven-file `Closes #310` PR before #311 only after every mandatory CI check, frozen/resolution/audit/build/typecheck/lint gate, and a NEW final verify report pass; #6786 remains historical FAIL, concurrent uncached zero-retry belongs to #311, then #311 PR0→PR1→PR2 precedes #309/#308→#284.
- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Low
