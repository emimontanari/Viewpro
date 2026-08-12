# Tasks: Remediate High Dependency Audit Findings

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 365–380 authored lines across seven files |
| Files | 5 planning artifacts + 2 dependency files |
| 400-line budget risk | Low (narrow margin) |
| Chained PRs recommended | No |
| Suggested split | One user-approved unified PR with an atomic two-file dependency sub-boundary |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: none / not applicable
400-line budget risk: Low
Review margin: Narrow — user-approved unified delivery is estimated at 365–380 lines.

### Suggested Work Units

| Unit | Goal | Authorizing issue | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Unified planning plus dependency remediation with complete gates | #310 (`Closes #310` in the unified PR) | CI serial tests plus all dependency gates | Fresh-store frozen install and CI migrations | Revert `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml` together; do not merge the unified PR |

## Phase 1: Planning Integration and Clean Boundary

- [ ] 1.1 Keep the five planning artifacts prepared in the unified PR; do not mark them integrated until that final PR merges. Use canonical Engram #6738–#6742 and preserve PASS/non-blocking signal-trap evidence #6747.
- [ ] 1.2 Use one `fix/dependency-audit-highs` branch from current `origin/develop`; under exception #6840 its one seven-file PR may precede #311 only with every mandatory gate green and `Closes #310`.
- [ ] 1.3 Before dependency editing, require exactly the five planning artifact paths as untracked, `git diff --quiet HEAD`, `git diff --cached --quiet HEAD`, and `test "$(git rev-parse HEAD)" = "$(git rev-parse origin/develop)"`; from `viewpro-app`, require `packageManager`/`pnpm --version` `pnpm@10.13.1`, Node major 22, and header `lockfileVersion: '9.0'`. Capture baseline frozen install, full `pnpm list --recursive --depth Infinity --json`, and exact `pnpm why --recursive fast-uri`/`nanoid` graphs.

## Phase 2: Controlled Two-File Remediation and Scope Guards

- [x] 2.1 Modify only `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`: remove `fast-uri@>=3.0.0 <=3.1.3: >=3.1.4`; replace only target records/references with `fast-uri@3.1.5` (`sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==`) and `nanoid@3.3.18` (`sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==`). Do not update, regenerate, dedupe, use `--latest`, or upgrade parents.
- [x] 2.2 Require the dependency diff to equal both dependency paths while the only untracked paths are the five planning artifacts; run the explicit pathspec for `:(top,literal)viewpro-app/package.json`, `:(top,glob)viewpro-app/apps/*/package.json`, and `:(top,glob)viewpro-app/packages/*/package.json`, expecting exactly `viewpro-app/package.json`; require `git diff --quiet HEAD -- viewpro-app/pnpm-workspace.yaml`, byte-identical `importers:` versus `git show HEAD:viewpro-app/pnpm-lock.yaml`, zero unrelated movement, clean `diff --check`, and under-400 final seven-file `numstat`.
- [x] 2.3 Stage exactly the five planning artifacts plus both dependency files; require cached names to equal all seven paths, clean cached check, no unstaged tracked diff, no untracked files, and final `git status --short` to contain exactly those seven paths.

## Phase 3: Deterministic Verification and Handoff

- [x] 3.1 Create one empty unique `VERIFY_STORE` via `mktemp`, assert emptiness before pnpm, quote it as `--store-dir`, and clean only that store on exit/signals; if scripting is introduced, explicitly exit from signal traps per non-blocking #6747 hardening guidance.
- [x] 3.2 Run in order: fresh-store `pnpm install --frozen-lockfile`; after `pnpm list`/both `pnpm why` graphs, prove only target nodes changed, parent ranges remain Ajv `^3.0.1`/PostCSS `^3.3.16`, and recorded integrities match fetched artifacts; then require zero-high `pnpm audit --prod --audit-level high`.
- [ ] 3.3 Run build/typecheck/lint, frozen/resolution/zero-high audit, both CI migrations, and `pnpm exec turbo run test --concurrency=1` once; require a NEW final verify report, preserve #6786 as FAIL, and repeat all scope/integrity/budget guards; any failure blocks merge.
- [ ] 3.4 On any scope, integrity, audit, or compatibility failure, revert both dependency files together and pause the unified PR; after #310 merges green under #6840, #311 proceeds PR0→PR1→PR2, then refresh #309/#308 before #284.
- [ ] 3.5 Prepare one Conventional Commit work unit (`fix(deps): remediate high production audit findings`) containing the five planning artifacts, the atomic two-file dependency change, evidence, and rollback boundary; do not execute the commit in this phase. Completion evidence is the exact seven-file diff plus every ordered gate passing.
