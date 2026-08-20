# Apply Progress: Public Error Runtime Contract

## Scope

- Change: `public-error-runtime-contract`
- Delivery: chained PRs with stacked-to-develop semantics.
- Remediation incident preserved: `unit-1-turbo-graph-remediation` repaired the confirmed generic Turbo dependency and strict-environment watch evidence defects. Its earlier single settlement request was blocked as `invalid_continuation`; no retry was made.
- Final remediation settlement: **complete** — token `sha256:85088994c917861c97077af39efa1fe9793fd3d12c8364f0aeff88ea535aaecc`, request `settle-public-error-runtime-contract-unit1-remediation-20260820-audit-7f3c91b2`, evidence revision `sha256:d01f4214702c88192cf99a885ed1320ff5cbd31d6c91a14ffffc66963677c1ad`.
- Review: clean dual Judgment Day approval recorded for the final Unit 1 remediation evidence.
- Commit status: no commit created.

## Completed Tasks

- [x] 1.1 RED — package runtime contract proof.
- [x] 1.2 GREEN — CommonJS package output, consumer edges, lockfile ownership, and Turbo graph.
- [x] 1.3 REFACTOR — bounded root watch rebuilt and restarted both consumers for temporary and restored contract values.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `packages/contracts/test/runtime-contract.spec.ts` | Unit/runtime | N/A (new proof) | `pnpm --filter @viewpro/contracts exec vitest run test/runtime-contract.spec.ts` → 3/3 failed: missing `dist/index.{js,d.ts}` and both package load paths | `pnpm --filter @viewpro/contracts test` → 3/3 passed after build | Three independent assertions: exact artifact whitelist/declaration, `require`, dynamic `import` | Clean; generated `dist/**` removed after proof |
| 1.2 | `packages/contracts/test/runtime-contract.spec.ts` | Unit/runtime / Turbo graph | ✅ 3/3 package runtime proof | Fresh triage dry-runs failed: generic `build`/`typecheck` materialized `<NONEXISTENT>` `db:generate` nodes for non-API packages | Frozen install, package build/typecheck/test, root build/typecheck, and corrected root dry-runs passed; no `db:generate` node is nonexistent and only the two Prisma APIs retain real Prisma nodes | Build and typecheck independently confirmed generic ordering plus API/platform-API `db:generate` overrides | Generic `db:generate` was removed only from `build`/`typecheck`; no loose environment mode was added |
| 1.3 | `packages/contracts/test/runtime-contract.spec.ts` | Root watch integration | ✅ 3/3 package runtime proof before the temporary edit | Fresh triage dry-run showed API dev had no strict-environment passthrough for `PLATFORM_CONTROL_SECRET` | The exact root watch command, with only inline synthetic `PLATFORM_CONTROL_SECRET` and without `--env-mode=loose`, started both consumers; temporary and restored values each rebuilt contracts, restarted both consumers, and were observed from the API consumer workspace | Initial, temporary, and restored contract values were separately observed; both transitions rebuilt before API/App New dev invocations | ✅ Watcher and child processes terminated; generated `dist/` directories removed |

## Commands and Results

- RED bootstrap: `pnpm --filter @viewpro/contracts exec vitest run test/runtime-contract.spec.ts` initially failed because Vitest was not yet a contracts dependency.
- RED evidence: after the package dependency/lockfile update, the same command failed 3/3: `dist/` was absent and `require('@viewpro/contracts')` plus dynamic `import('@viewpro/contracts')` each resolved the missing `dist/index.js`.
- GREEN: `pnpm --filter @viewpro/contracts test` passed 3/3 after `tsc -p tsconfig.json` emitted the two allowed files.
- Frozen install: `pnpm install --frozen-lockfile` passed.
- Replacement graph GREEN: `pnpm exec turbo run build --dry=json` and `pnpm exec turbo run typecheck --dry=json` each reported no nonexistent `db:generate` task. Each retained exactly `@viewpro/api#db:generate` and `@viewpro/platform-api#db:generate`, both running `prisma generate`; generic build resolved `^build`, generic typecheck resolved `^build` then `^typecheck`, and both API overrides retained their required edges plus `db:generate`.
- Replacement dev GREEN: `pnpm exec turbo run dev --filter=@viewpro/api --dry=json` reported strict mode with `dependsOn: ["^build"]`, `cache: false`, `persistent: true`, `interruptible: true`, and `passThroughEnv: ["PLATFORM_CONTROL_SECRET"]`. The secret remains passthrough-only: it is neither hashed nor persisted.
- Replacement root watch: exactly `PLATFORM_CONTROL_SECRET=<synthetic> pnpm exec turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter` ran without `--env-mode=loose`. Initial contracts build completed before both dev invocations. The temporary edit produced a fresh contracts build before fresh API/App New dev invocations; restoration replayed the current contracts build before fresh API/App New dev invocations. The API consumer workspace observed `not-generated-yet` → `temporarily-generated` → `not-generated-yet` from the emitted package. This evidence makes no claim about old-process interruption timing.
- Cleanup: the bounded watcher was terminated after both transitions; process inspection found no worktree `turbo watch`, `nest start --watch`, or `next dev` process. Generated `packages/contracts/dist`, `apps/api/dist`, and `apps/viewpro-api/dist` were removed after verification.
- Final regression: `pnpm install --frozen-lockfile`, `pnpm --filter @viewpro/contracts test` (3/3), `pnpm --filter @viewpro/contracts build`, `pnpm --filter @viewpro/contracts typecheck`, `pnpm build` (8/8), and `pnpm typecheck` (10/10) all passed after restoration.

## Changed Files

- `viewpro-app/packages/contracts/package.json`
- `viewpro-app/packages/contracts/tsconfig.json`
- `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`
- `viewpro-app/package.json`
- `viewpro-app/turbo.json`
- `viewpro-app/apps/api/package.json`
- `viewpro-app/apps/app-new/package.json`
- `viewpro-app/pnpm-lock.yaml`
- `tasks.md` and this progress artifact.

## Review and Rollback

- Source/test/config/lockfile changed lines: **118 / 400** (OpenSpec bookkeeping excluded; 75 tracked additions/deletions plus 43 lines in the new runtime test).
- Rollback boundary: revert the eight Unit 1 source/test/config/lockfile paths and only the two consumer contract importer links plus the contracts Vitest importer entry; remove the Unit 1 test. No Unit 2–4 path was changed.
- Current boundary: Units 1–2 complete; Unit 3 independently eligible; Unit 4 pending. Units 3–4 are untouched.

## Unit 2 — ordinal 5 exit-only correction

- Ordinal 4 passed with `settle-public-error-runtime-contract-unit2-bounded-reap-20260820-1`, token `sha256:d1df362b994c5857bad75e05f94ce8fee31c7bff170df03f5230410d75b49e1f`, and evidence `sha256:6abf3def1cdea72e21be1d0ad2d79086f3e3f0b44dbc7c93b8fe9fbf53f82655`; it is predecessor evidence only and does not prove this future source.
- 2.3 was reopened. RED: focused Vitest failed 4/13 for missing exit-only stdout/stderr destruction and persistent late-error guarding.
- GREEN: exit-only timed-out/nonzero/signaled failures and natural-success final-evidence expiry now settle, clear timers/remove terminal listeners, retain the runner error guard, destroy stdout then stderr, and unref. Neither event reports `runtime_smoke_termination_unconfirmed` without a reap/orphan claim; complete close success preserves streams/output.
- Focused Vitest passed 13/13; coverage includes cooperative timeout, SIGKILL exit-only, natural exit-only deadline, neither-event, unowned late error settle-once, complete success, ordered teardown, and tokenized Docker cleanup.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.3 | `apps/api/src/runtime-contract-smoke.spec.ts` | Unit/process | prior 13/13 | 4/13 failed before source change | 13/13 passed | six exit/close paths | no behavior change |

- `pnpm install --frozen-lockfile`, API typecheck, forced Turbo API build (4/4), real `runtime:smoke`, and `git diff --check` passed. Image `sha256:3228c1bf1b063a292d6538b413867aee7db83e3445e278f7644e3db6582d51f6` and all matching labeled containers were removed.
- Final exact numstat: implementation **331 / 400** (target ≤351); complete PR **361 / 400**. Settlement complete exactly once: `settle-public-error-runtime-contract-unit2-exit-stdio-20260820-1`, token `sha256:a2cb626e2ef6567385b6e5e3d73cd3c57c20739f6f96650d3ba6e0de5c61fb47`.
