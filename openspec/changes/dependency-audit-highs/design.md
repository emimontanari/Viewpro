# Design: Surgically Remediate High Dependency Audit Findings

## Technical Approach

Implement approved issue [#310](https://github.com/emimontanari/Viewpro/issues/310) as one unified seven-file work unit: five planning artifacts plus an atomic two-file dependency sub-boundary. Because pnpm 10.13.1 cannot safely guarantee a named transitive update without collateral direct-dependency movement, do not run `pnpm update` or regenerate the lockfile. Remove the unsafe root override and make a controlled lockfile 9.0 edit limited to the known package records and dependency references. A fresh-store frozen install then proves manifest consistency and verifies registry integrity.

Target outcomes remain exact: Ajv 8.18.0 and 8.20.0 resolve `fast-uri@3.1.5` through `^3.0.1`; PostCSS 8.5.23 resolves `nanoid@3.3.18` through `^3.3.16`; no parent version changes.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| pnpm 10.13.1 recursive update | Can move direct and deep transitive dependencies | **Rejected** as non-surgical. |
| Controlled lockfile edit plus frozen verification | Requires exact record knowledge; produces a bounded, reviewable diff | **Chosen** because every changed line is predetermined and integrity-checked. |
| One unified seven-file PR | Avoids closing #310 before remediation while retaining a narrow dependency sub-boundary | **Chosen** by the user; expected 365–380 changed lines and must use `Closes #310`. |

## Preconditions and Branch Boundary

Create one `fix/dependency-audit-highs` branch from current `origin/develop`; its one PR contains all five planning artifacts and both dependency files and uses `Closes #310`. The separate planning-only PR prerequisite is superseded. Before dependency edits, the five planning artifacts are the only permitted untracked changes; they remain part of the final unified PR rather than becoming a prerequisite base.

Before dependency edits, require `git diff --quiet HEAD`, `git diff --cached --quiet HEAD`, `test "$(git rev-parse HEAD)" = "$(git rev-parse origin/develop)"`, and exactly the five planning artifact paths from `git status --porcelain=v1 --untracked-files=all`; any other untracked path blocks apply.

From `viewpro-app`, require `package.json#packageManager == pnpm@10.13.1`, `pnpm --version == 10.13.1`, Node major 22, and `pnpm-lock.yaml` beginning exactly `lockfileVersion: '9.0'`. Stop rather than changing tooling. Run the baseline `pnpm install --frozen-lockfile`, then capture `pnpm why --recursive fast-uri` and `pnpm why --recursive nanoid`.

## Controlled Remediation

1. In `viewpro-app/package.json`, delete only `fast-uri@>=3.0.0 <=3.1.3: >=3.1.4` from `pnpm.overrides`.
2. In `viewpro-app/pnpm-lock.yaml`, delete only the matching top-level override and replace these exact records/references:

| Target | Required lockfile changes | Registry integrity |
|---|---|---|
| `fast-uri@3.1.5` | Replace the `4.1.1` package key, both Ajv snapshot references, and snapshot key | `sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==` |
| `nanoid@3.3.18` | Replace the `3.3.16` package key, PostCSS snapshot reference, and snapshot key | `sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==` |

Do not run `pnpm update`, `pnpm install --lockfile-only`, `pnpm dedupe`, `--latest`, or parent upgrades. Any other resolver-required change is a blocker, not permission for churn.

## Diff and Contract Review

For the dependency sub-boundary, `git diff HEAD --name-only` must list exactly `viewpro-app/package.json` and `viewpro-app/pnpm-lock.yaml`; the five planning artifacts remain the only permitted untracked paths until final staging. From the repository root, validate manifests with explicit pathspecs derived from `pnpm-workspace.yaml` (`apps/*`, `packages/*`):

```bash
git diff HEAD --name-only -- \
  ':(top,literal)viewpro-app/package.json' \
  ':(top,glob)viewpro-app/apps/*/package.json' \
  ':(top,glob)viewpro-app/packages/*/package.json'
```

Expected output is exactly one line: `viewpro-app/package.json`. No output would miss the required root change; any additional `apps/*/package.json` or `packages/*/package.json` line is a blocking nested workspace-manifest change. Separately require `git diff --quiet HEAD -- viewpro-app/pnpm-workspace.yaml`. Compare the lockfile `importers:` block byte-for-byte with `git show HEAD:viewpro-app/pnpm-lock.yaml`; it must be unchanged. Inspect `git diff HEAD --numstat`, `git diff HEAD --check`, and the complete `git diff HEAD --unified=0 --`.

At final review, stage exactly the five planning artifacts plus the two dependency files. Require those seven paths from `git diff --cached HEAD --name-only`, clean `git diff --cached --check`, no unstaged tracked diff (`git diff --quiet`), no untracked files, and a total under 400 changed lines. Reject Ajv, PostCSS, webpack, Sentry, importer, other manifest, or unrelated package movement.

## Validation Strategy

From `viewpro-app`, create a unique temporary pnpm store for the entire sequence so cached tarballs cannot mask integrity failure:

```bash
VERIFY_STORE="$(mktemp -d "${TMPDIR:-/tmp}/viewpro-pnpm-store.XXXXXX")" || exit 1
readonly VERIFY_STORE
cleanup_verify_store() { rm -rf -- "$VERIFY_STORE"; }
trap cleanup_verify_store EXIT HUP INT TERM
test -d "$VERIFY_STORE"
test -z "$(find "$VERIFY_STORE" -mindepth 1 -maxdepth 1 -print -quit)"
```

The emptiness assertion must pass before pnpm runs. The trap removes only this quoted, `mktemp`-created external store on success, failure, interruption, or rollback; dependency-file rollback remains the separate two-file operation defined below.

1. `pnpm install --frozen-lockfile --store-dir "$VERIFY_STORE"`
2. Run both `pnpm why --recursive` checks; compare paths to baseline and confirm only target versions changed.
3. `pnpm audit --prod --audit-level high` — zero high findings and exit zero.
4. `pnpm build`
5. `pnpm typecheck`
6. `pnpm lint`
7. Provision and migrate both CI test databases, then run the mandatory serial command `pnpm exec turbo run test --concurrency=1`.

The fresh-store frozen install must fetch artifacts matching the recorded integrity hashes and must not alter either dependency file or the five planning artifacts. Write a NEW final verify report after one full pass; #6786 remains FAIL, no retry exception applies, and #311 owns the stronger concurrent uncached zero-retry harness.

## Rollout and Rollback

No migration is required. If any scope, integrity, audit, or compatibility gate fails, revert both dependency files together and pause the unified PR; the prepared planning artifacts remain unmerged and the restored red audit state must not merge. Under #6840, after #310 merges green, deliver #311 PR0→PR1→PR2, then refresh #309/#308 and continue #284.

## Open Questions

None.
