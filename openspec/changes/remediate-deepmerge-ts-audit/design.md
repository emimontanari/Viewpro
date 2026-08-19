# Design: Remediate DeepmergeTS High Advisory

## Outcome

Fix only issue #325 / `GHSA-ggr8-5vv4-36mx`: retain Prisma `6.19.2`, product behavior, and PR #324 isolation; add one scoped override and clear the production audit.

## Resolution and Compatibility

| Decision | Rationale |
|---|---|
| Use `"@prisma/config@6.19.2>deepmerge-ts": "8.0.1"` | Exact pnpm `10.13.1` parent-child edge. |
| Reject global override, Prisma upgrade, manual lock edit | Broader risk or no resolver truth. |
| No config fixture | No `prisma.config.*`; do not add support. |

Both production paths resolve `@prisma/config@6.19.2 -> deepmerge-ts@7.1.5`; replace only that node and remove `7.1.5` from the lockfile. `@prisma/config` passes `deepmerge` to c12; v8 retains it and needs Node `>=16`. Validate/generate do not prove config-object/Map merging; roll back, never widen.

## Delivery Topology and Gates

Historical pre-apply authority `P` on PR #328 → PR #330 from fresh `origin/develop@D` → PR #330 merged green to `develop@d3afbec53b5bed51abaa2453ca09262eed9a29cc` → PR #328 refreshed, reviewed, and checked at final head/base → pending PR #328 merge.

Historical pre-apply authority is `P=2ce6a6923ad4860177dfeab2fee545068d944283` on reviewed PR #328. The maintainer approval is recorded on issue #325 and #328: `https://github.com/emimontanari/Viewpro/issues/325#issuecomment-5331737441` and `https://github.com/emimontanari/Viewpro/pull/328#issuecomment-5331737710`. Later review-driven amendments were published as post-apply evidence, not retroactive pre-apply authority. PR #330 is merged and PR #328 is refreshed against that merge; its self-referential final head is bound externally by the PR body and checks.

PR #330 was created from fresh `origin/develop@D`, targeted `develop`, and contained exactly `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, and `openspec/changes/remediate-deepmerge-ts-audit/apply-progress.md`. Its changed-line count stayed within 400, used `Refs #325`, and did not close #325. `apply-progress.md` records D, the exact boundary, predecessor implementation facts, and source/runtime digests; the final head/tree/diff and test results are bound externally by immutable runtime/PR/CI evidence, never self-referentially in that commit. At PR #330's final candidate, the all-workspace focused-test source scan over `viewpro-app/apps` and `viewpro-app/packages` found no `.only` matches, both direct commands below passed, and native CI passed; CI alone is insufficient. Any new commit invalidates these results; any scan/direct/native failure blocks delivery. This approved equivalent guard changed no Vitest config. [Issue #332](https://github.com/emimontanari/Viewpro/issues/332) tracks systemic `.only` hardening separately and is nonblocking for #325 because this candidate used the final-head scan and direct `--allowOnly=false --retry=0` runs.

PR #330 merged green as `d3afbec53b5bed51abaa2453ca09262eed9a29cc`. PR #328 was refreshed and retested against fixed `develop`; its final head, five-file count, and fresh native CI/Vercel/CodeRabbit results are bound externally in the current PR body and checks so this file never claims its own commit identity. Pending: merge #328, then authorize and manually close #325; only afterward update/rerun #324 from fixed `develop` without this remediation. Never force-push, bypass CI, suppress audit, or combine units.

## Files, Install, and Budget

| File | Action |
|---|---|
| `viewpro-app/package.json` | PR #330 added the sole override. |
| `viewpro-app/pnpm-lock.yaml` | PR #330 applied only the resolution/edge delta. |
| `openspec/changes/remediate-deepmerge-ts-audit/apply-progress.md` | PR #330 carries repository-traceable source-run evidence; final verify and native CI passed after publication. |

Execution hashed/statused dependency files, ran `pnpm install --lockfile-only --ignore-scripts` once, rejected other diffs, confirmed pnpm `10.13.1`, snapshot/archived/hashed ignored generated outputs, removed workspace `node_modules`, then ran one frozen install (never `--ignore-scripts`).

## Verification and Safe Local Database

| Gate | Evidence |
|---|---|
| Resolution | `pnpm why --recursive --prod deepmerge-ts` and `pnpm list --recursive --prod --depth Infinity deepmerge-ts` show only `8.0.1`. |
| Security | `pnpm audit --prod --audit-level high` exits 0; record 2 low/3 moderate findings. |
| APIs | Both Prisma validate/generate, `typecheck`, stub `lint`, `build`, and direct Vitest pass: `pnpm --filter @viewpro/api exec vitest run --allowOnly=false --retry=0`; `pnpm --filter @viewpro/platform-api exec vitest run --allowOnly=false --retry=0`. |
| Boundary | Diff check/stat/status and `gitleaks detect --no-git --source openspec/changes/remediate-deepmerge-ts-audit --no-banner` exit 0. |

Every security, install, ancestry, Prisma, API/platform, rollback, boundary, and CI gate is mandatory. A rationale may document an omission but cannot authorize B to merge; only explicitly non-mandatory informational checks may be skipped.

PR #330 used CI PostgreSQL 16, not `docker-compose.yml`, with a reviewed immutable image. It failed closed on occupied or probe/tool/daemon/permission errors; used per-run credentials with `env -i` and never sourced `.env` or logged values; and cleaned only procedure-owned CID-file containers and data. Before deleting generated state, it archived/hashed output; rollback restored it, frozen-installed, regenerated, and reran both API checks.

## Rollback

On selector/install/compatibility/output/audit/API/delivery/diff failure, atomically restore dependency files and both archived pre-run outputs; saved hashes must match. Frozen-install/regenerate the reverted graph, verify `7.1.5` ancestry, and retain the merge block/audit gate.
