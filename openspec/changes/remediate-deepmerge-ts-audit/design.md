# Design: Remediate DeepmergeTS High Advisory

## Outcome

Fix only issue #325 / `GHSA-ggr8-5vv4-36mx`: retain Prisma `6.19.2`, product behavior, and PR #324 isolation; add one scoped override and clear the production audit.

## Resolution and Compatibility

| Decision | Rationale |
|---|---|
| Use `"@prisma/config@6.19.2>deepmerge-ts": "8.0.1"` | Exact pnpm `10.13.1` parent-child edge. |
| Reject global override, Prisma upgrade, manual lock edit | Broader risk or no resolver truth. |
| No config fixture | No `prisma.config.*`; do not add support. |

Both production paths end at `@prisma/config@6.19.2 -> deepmerge-ts@7.1.5`. Replace only that node; the lockfile removes `7.1.5` with no other change.

```yaml
overrides:
  '@prisma/config@6.19.2>deepmerge-ts': 8.0.1
packages:
  deepmerge-ts@8.0.1:
    resolution: {integrity: sha512-szCXE7YLCvLKR9bFPJcvsezOShdalctSvrgN/LM/QGUEPZQajwjmsMObZ6/DuANT5lxzM/wtO8Feubwdkz8myA==}
    engines: {node: '>=16.0.0'}
snapshots:
  '@prisma/config@6.19.2':
    dependencies: {deepmerge-ts: 8.0.1}
  deepmerge-ts@8.0.1: {}
```

`@prisma/config` passes `deepmerge` to c12; v8 retains it and Node `>=16`. Validate/generate do not prove config-object/Map merging; roll back, never widen.

## Files, Install, and Budget

| File | Action |
|---|---|
| `viewpro-app/package.json` | Add the sole override. |
| `viewpro-app/pnpm-lock.yaml` | Apply only the resolution/edge delta above. |
| `openspec/changes/remediate-deepmerge-ts-audit/*` | PR A records planning; PR B records apply/verify evidence. |

Hash/status both dependency files. Run `pnpm install --lockfile-only --ignore-scripts` once; reject other diffs. Confirm pnpm `10.13.1`, snapshot/archive/hash ignored generated outputs, remove workspace `node_modules`, then run one full `pnpm install --frozen-lockfile` (never `--ignore-scripts`).

| Budget item | Lines | Basis |
|---|---:|---|
| Current PR A | 375 additions + 0 deletions | Exact five-file diff after final corrections. |
| PR A limit | 400 | Planning-only; never exceed. |
| Complete forecast | 450–491 planning estimate | Two sequential PRs; not current diff authority. |
| PR B | ≤149 forecast | Recount independently; total ≤400 |
| Strategy | — | Both PRs target `develop`; no tracker |

The 25-line headroom is a hard ceiling. If unsafe, report blocked; never hide an overage.

## Verification and Safe Local Database

| Gate | Evidence |
|---|---|
| Resolution | `pnpm why --recursive --prod deepmerge-ts` and `pnpm list --recursive --prod --depth Infinity deepmerge-ts` show only `8.0.1`. |
| Security | `pnpm audit --prod --audit-level high` exits 0; record 2 low/3 moderate findings. |
| APIs | Both Prisma validate/generate, `typecheck`, stub `lint`, `build`, and `test` pass. |
| Boundary | Diff check/stat/status and `gitleaks detect --no-git --source openspec/changes/remediate-deepmerge-ts-audit --no-banner` exit 0. |

From `viewpro-app`, use CI PostgreSQL 16, not `docker-compose.yml`. Require a reviewed immutable image input; fail closed on occupied or probe/tool/daemon/permission errors. Generate credentials per run, use `env -i` rather than `.env`, and remove only exact CID-file IDs even if stopping fails. Readiness is ten five-second retries.

1. Require `POSTGRES_16_ALPINE_IMAGE` to match `postgres:16-alpine@sha256:<64 hex>`; record the reviewed digest as evidence. Do not accept a tag or invent a digest.
2. Run `docker info`. A port probe treats `lsof` exit 0 as occupied, clean exit 1 as free, and stderr/other exit as unavailable; an exact-name `docker container ls -aq` query treats nonzero as unavailable. Any failure stops before provisioning.
3. Generate users/passwords with `openssl rand`; build localhost URLs in memory and use `env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=... DIRECT_URL=...` for migrations and every API command. Never source `.env` or log values.
4. Before startup, create/protect a unique procedure-owned parent directory, reserve unique nonexistent `--cidfile` paths without creating files, and register an exit/signal trap. Let each `docker run --cidfile "$path"` create its file (Docker rejects an existing file); cleanup tolerates absence/partial starts/interrupts, reads exact IDs only from files there, runs `docker rm -f` only for them, removes only those files, preserves cleanup failure, then removes the owned directory.
5. Before any `node_modules` or generated-state deletion, resolve the product client output path, then tar/hash it and `apps/viewpro-api/src/generated/prisma`; archive absence too. On rollback, remove each target, extract its preserved archive (or reassert absence), recompute its hash, then frozen-install/regenerate and rerun both API checks.

## Rollback and Integration

On selector, install, compatibility, output, audit, or API failure, atomically restore dependency files; restore both archived pre-run outputs and require their saved hashes to match. Then frozen-install/regenerate the reverted graph, verify `7.1.5` ancestry, and retain the merge block/audit gate.

PR A is planning-only and reversible. After it merges, branch PR B from updated `develop`; roll back B as above. Close #325 only when B merges green; then update/rerun #324 without copying this fix.
