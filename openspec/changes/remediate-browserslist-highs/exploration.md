# Exploration: Remediate Browserslist High Advisories

## Current State

Approved issue [#475](https://github.com/emimontanari/Viewpro/issues/475) records two newly published high-severity advisories against `browserslist <=4.28.6`; both are fixed in `browserslist >=4.28.7`. The repository lockfile at the supplied base `06420a903137872df61415fb72e25a4ba60d3b64` resolves one shared `browserslist@4.28.2`, so both findings apply to the installed production-classified dependency graph and block PR #473 through the authoritative command `pnpm audit --prod --audit-level high`.

The vulnerable package is transitive build tooling, not a direct ViewPro dependency. The single lock record is reached through at least these existing parents:

- `@babel/helper-compilation-targets@7.28.6 -> browserslist@4.28.2`, under Babel's declared `browserslist: ^4.24.0` range.
- Both `webpack@5.106.0` snapshots -> `browserslist@4.28.2`, under webpack's declared `browserslist: ^4.28.1` range.
- `update-browserslist-db@1.2.3` peers against the same Browserslist record and therefore carries a version-qualified snapshot/reference that must remain internally consistent.

Both parent ranges already admit the patched `4.28.8` available in the offline pnpm store. This is therefore a stale transitive lock resolution, not a missing manifest constraint. No direct dependency, root override, Babel upgrade, webpack upgrade, application code change, or audit suppression is needed.

The repository's live execution ledger says the production audit is a blocking gate and records prior high-advisory remediation as focused dependency maintenance. The OpenSpec config fixes pnpm at `10.13.1`, requires frozen installs, strict evidence, rollback, and a 400 changed-line review budget. Existing changes `dependency-audit-highs` and `remediate-deepmerge-ts-audit` establish the relevant precedent: isolate the vulnerable edge, reject unrelated resolver churn, prove the final frozen graph and exact production audit, and preserve product behavior.

## Affected Areas

- `viewpro-app/pnpm-lock.yaml` — future implementation surface; refresh only the shared Browserslist package/snapshot and its existing references, including peer-qualified `update-browserslist-db` records as required by lockfile consistency.
- `viewpro-app/package.json` — evidence that no direct dependency or override is required; no change recommended.
- `.github/workflows/ci.yml` — evidence for pnpm `10.13.1`, `pnpm install --frozen-lockfile`, and the blocking production-audit policy; no change recommended.
- Babel and webpack consumers — compatibility verification surfaces only; no parent or application change expected.
- `openspec/changes/remediate-browserslist-highs/exploration.md` — this exploration artifact.

## Approaches

### 1. Lockfile-only transitive refresh to Browserslist 4.28.8 — recommended

Refresh only the existing Browserslist resolution within the already-declared Babel and webpack ranges, using the available offline `4.28.8` package and retaining all parent versions.

- **Pros:** smallest resolver-valid remediation; patched version is inside every identified parent range; no manifest/override debt; no application behavior change; one transitive package family to review.
- **Cons:** pnpm may rewrite peer-qualified keys or attempt unrelated compatible movement, so the complete lockfile diff must be inspected and any collateral churn rejected.
- **Compatibility:** Babel and webpack already permit this patch. Build, typecheck, lint, and tests remain evidence gates rather than expected behavior changes.
- **Effort:** Low.

### 2. Add a root override or direct Browserslist dependency — rejected

- **Pros:** can force a patched version explicitly.
- **Cons:** duplicates valid upstream ranges, adds long-lived manifest debt, broadens ownership of a transitive build dependency, and is unnecessary for deterministic resolution.
- **Effort:** Low but unjustified.

### 3. Upgrade Babel, webpack, Next.js, or another parent — rejected

- **Pros:** may absorb unrelated maintenance updates.
- **Cons:** materially broadens lockfile and compatibility scope while the current parents already admit the fix; increases review and regression cost without improving this advisory outcome.
- **Effort:** Medium.

### 4. Ignore the advisories or accept audit failure — rejected

- **Pros:** no dependency diff.
- **Cons:** leaves vulnerable bytes installed, violates the blocking production-audit contract, and does not unblock PR #473.
- **Effort:** Low but unacceptable.

## Recommendation

Proceed to a compact proposal for a lockfile-only refresh from `browserslist@4.28.2` to `4.28.8`. The future implementation boundary should contain only `viewpro-app/pnpm-lock.yaml`; `package.json`, workspace manifests, parent versions, application source, CI, and audit policy must remain unchanged.

The implementation design should permit one targeted offline lockfile refresh only if its resulting diff is confined to the Browserslist package/snapshot, the existing Babel and webpack references, and mechanically required `update-browserslist-db` peer-qualified keys/references. If pnpm moves any unrelated package, importer, parent, or manifest, stop and restore the lockfile rather than normalize the churn. A controlled record-limited edit followed by frozen verification remains an acceptable fallback if the targeted resolver cannot preserve that boundary; exact integrity data must be taken from the local pnpm store, never invented.

### Required future evidence

From `viewpro-app/`, with pnpm `10.13.1`:

1. Confirm the pre-change graph resolves only `browserslist@4.28.2` and capture the two-high baseline from `pnpm audit --prod --audit-level high`.
2. Produce the lockfile-only `4.28.8` delta without changing any manifest or parent version.
3. Run `pnpm install --frozen-lockfile` against the candidate lockfile; require success and no post-install tracked diff.
4. Run `pnpm why browserslist --recursive` and/or the equivalent recursive production listing; require only patched `4.28.8` across the Babel and webpack paths and no `<=4.28.6` copy.
5. Run `pnpm audit --prod --audit-level high`; require exit zero and **zero high findings**. Record any residual lower-severity findings without expanding this change.
6. Run repository build, typecheck, lint, and the serial test topology required by CI. No application behavior change is expected, but audit success alone is insufficient compatibility evidence.
7. Review `git diff --check`, exact changed paths, lockfile importer stability, and total additions plus deletions before delivery.

A fresh or explicitly isolated store is preferred for final frozen-install evidence when network access is available; the offline package already present is sufficient to prepare the bounded lock delta. The final acceptance claim must be based on a deterministic frozen install, not merely on editing lockfile text or obtaining audit output.

## Risks and Rollback

- **Resolver churn:** a nominally targeted refresh can move unrelated transitive packages. Reject the candidate unless every changed lock line belongs to the Browserslist resolution family and necessary existing references.
- **Incomplete peer-key update:** changing only the package record can leave `update-browserslist-db` snapshot keys or references inconsistent. Frozen installation and ancestry inspection must catch this.
- **Overstated exploitability:** Browserslist is observed in build-tool paths and no application behavior or request-time exposure is established here. That low apparent runtime relevance does not waive the blocking high-severity gate.
- **False remediation:** audit green without proving that no vulnerable Browserslist copy remains is insufficient.
- **Rollback:** revert `viewpro-app/pnpm-lock.yaml` atomically to the pre-change version and rerun the frozen install. Rollback restores `browserslist@4.28.2`, the two high findings, and the merge block; never weaken or bypass the audit gate to compensate.

## Scope and Forecast

- **Product behavior:** none.
- **Future dependency implementation:** exactly one lockfile; no override or direct dependency.
- **Planning artifacts:** exploration and proposal form the first planning work unit; spec, design, and tasks form a second sequential planning work unit.
- **Expected implementation churn:** approximately 10–30 changed lockfile lines, subject to exact peer-key formatting.
- **Expected delivery:** the full OpenSpec lifecycle exceeds 400 review lines, so three sequential PRs keep each work unit below 400: exploration/proposal, spec/design/tasks, then lockfile/evidence.
- **Chained PRs:** required by the measured planning footprint; each PR targets `develop` after its predecessor merges.
- **Delivery risk:** Low, provided unrelated resolver churn is rejected.

## Ready for Proposal

Yes. Issue #475 is approved, the vulnerable and patched ranges are explicit, `4.28.8` is available offline, all identified parents already admit the fix, the scope is lockfile-only, and the rollback and mandatory gates are defined. No product or architecture decision remains open.
