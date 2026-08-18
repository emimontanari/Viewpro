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

`PR #328 planning authority@P` → `PR B from fresh origin/develop@D` → `green B merged to develop@D'` → `#328 refreshed, reviewed, and checked at final head/base` → `#328 merged to develop`.

Before apply, publicly record maintainer approval on issue #325 and #328: `https://github.com/emimontanari/Viewpro/issues/325#issuecomment-5331737441` and `https://github.com/emimontanari/Viewpro/pull/328#issuecomment-5331737710`. Keep #328 open to `develop` as the independently reviewed planning authority; its audit failure is baseline evidence. Record final planning SHA `P`; B cites `P` and reads those artifacts before implementation.

Create PR B from fresh `origin/develop@D`, target `develop`, and contain exactly `viewpro-app/package.json`, `viewpro-app/pnpm-lock.yaml`, and `openspec/changes/remediate-deepmerge-ts-audit/apply-progress.md`. Its changed-line count is at most 400 additions plus deletions; it uses `Refs #325` and never closes #325. At B's exact final head SHA after its last commit, retain an all-workspace focused-test source scan over `viewpro-app/apps` and `viewpro-app/packages` with no `.only` matches, both direct commands below, and passing native CI; CI alone is insufficient. Any new commit invalidates all results; any scan/direct/native failure blocks B. This approved equivalent guard changes no Vitest config.

After green B merges, update/retest #328 against fixed `develop`. Confirm it remains planning-only and at most 400 lines; require fresh review/checks for its final head/base—changed candidates reuse neither. Merge only then; authorize and manually close #325 only after both merge green. Then update/rerun #324 from fixed `develop` without this remediation. Never force-push, bypass CI, suppress audit, or combine units.

## Files, Install, and Budget

| File | Action |
|---|---|
| `viewpro-app/package.json` | Add the sole override. |
| `viewpro-app/pnpm-lock.yaml` | Apply only the resolution/edge delta. |
| `openspec/changes/remediate-deepmerge-ts-audit/apply-progress.md` | B carries repository-traceable source-run evidence; final verify report and native CI remain post-publication. |

Hash/status dependency files. Run `pnpm install --lockfile-only --ignore-scripts` once; reject other diffs. Confirm pnpm `10.13.1`, snapshot/archive/hash ignored generated outputs, remove workspace `node_modules`, then run one frozen install (never `--ignore-scripts`).

## Verification and Safe Local Database

| Gate | Evidence |
|---|---|
| Resolution | `pnpm why --recursive --prod deepmerge-ts` and `pnpm list --recursive --prod --depth Infinity deepmerge-ts` show only `8.0.1`. |
| Security | `pnpm audit --prod --audit-level high` exits 0; record 2 low/3 moderate findings. |
| APIs | Both Prisma validate/generate, `typecheck`, stub `lint`, `build`, and direct Vitest pass: `pnpm --filter @viewpro/api exec vitest run --allowOnly=false --retry=0`; `pnpm --filter @viewpro/platform-api exec vitest run --allowOnly=false --retry=0`. |
| Boundary | Diff check/stat/status and `gitleaks detect --no-git --source openspec/changes/remediate-deepmerge-ts-audit --no-banner` exit 0. |

Every security, install, ancestry, Prisma, API/platform, rollback, boundary, and CI gate is mandatory. A rationale may document an omission but cannot authorize B to merge; only explicitly non-mandatory informational checks may be skipped.

`viewpro-app` uses CI PostgreSQL 16, not `docker-compose.yml`, with a reviewed immutable image. Fail closed on occupied or probe/tool/daemon/permission errors; generate per-run credentials, use `env -i` not `.env`, remove only exact CID-file IDs even if stopping fails, and use ten five-second readiness retries.

1. Require `POSTGRES_16_ALPINE_IMAGE` to match `postgres:16-alpine@sha256:<64 hex>`; record the reviewed digest. Do not accept a tag or invent a digest.
2. Run `docker info`. A port probe treats `lsof` exit 0 as occupied, clean exit 1 as free, and stderr/other exit as unavailable; an exact-name `docker container ls -aq` query treats nonzero as unavailable. Any failure stops before provisioning.
3. Generate users/passwords with `openssl rand`; build localhost URLs in memory and use `env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=... DIRECT_URL=...` for migrations and every API command. Never source `.env` or log values.
4. Before startup, create/protect a unique procedure-owned parent directory, reserve unique nonexistent `--cidfile` paths without creating files, and register an exit/signal trap. Let each `docker run --cidfile "$path"` create its file; cleanup reads exact IDs only there, runs `docker rm -f` only for them, removes only those files, preserves cleanup failure, then removes the owned directory.
5. Before any `node_modules` or generated-state deletion, resolve the product client output path, then tar/hash it and `apps/viewpro-api/src/generated/prisma`; archive absence too. On rollback, remove each target, extract its preserved archive (or reassert absence), recompute its hash, then frozen-install/regenerate and rerun both API checks.

## Rollback

On selector/install/compatibility/output/audit/API/delivery/diff failure, atomically restore dependency files and both archived pre-run outputs; saved hashes must match. Frozen-install/regenerate the reverted graph, verify `7.1.5` ancestry, and retain the merge block/audit gate.
