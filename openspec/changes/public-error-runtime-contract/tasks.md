# Tasks: Public Error Runtime Contract

## Review Workload Forecast

Estimated changed lines: 1,220 total (350 / 290 / 390 / 190)
Chained PRs recommended: Yes
400-line budget risk: High
Decision needed before apply: No — resolved as stacked-to-develop
Chain strategy: stacked-to-develop.
Delivery strategy: chained PRs; no size exception.
Apply boundary: Units 1–3 complete; Unit 4 pending.

Order: PR1/U1 (base `develop`) → PR2/U2 + PR3/U3 (base `develop`; parallel, disjoint) → PR4/U4 (base `develop`; after 2+3); all merge `develop`.

| Unit | Commit/PR boundary | Lines | Rollback boundary |
|---|---|---:|---|
| 1 | `feat(contracts): emit runtime contract`; package/graph/lockfile/proof | 350 | Unit 1 paths and allowed lockfile entries |
| 2 | `feat(api): add compiled contract smoke`; API seam/image | 290 | Unit 2 API paths |
| 3 | `feat(app): add node runtime marker smoke`; marker/image/tests | 390 | Unit 3 App New paths |
| 4 | `docs(ci): document runtime contract release gate`; CI/docs | 190 | CI, README, gate doc |

## Unit 1: Contracts / Turbo Foundation (PR 1)

- [x] 1.1 **RED:** Create `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`; run `pnpm --filter @viewpro/contracts exec vitest run test/runtime-contract.spec.ts`; require failures for `dist/index.{js,d.ts}`, `require`, dynamic `import`, symbols, and extra artifacts.
- [x] 1.2 **GREEN:** Modify `viewpro-app/packages/contracts/{package.json,tsconfig.json}`, `viewpro-app/{package.json,turbo.json,pnpm-lock.yaml}`, and only `dependencies.@viewpro/contracts` in `viewpro-app/apps/{api,app-new}/package.json`. Own Node16 CommonJS emit, scripts/test runner, Vitest `4.1.6`, App New `typecheck` if absent, Turbo graph, and lockfile only for consumer links, contracts Vitest, and required peer entries. Verify frozen install, package `test`, `pnpm build`, `pnpm typecheck`.
- [x] 1.3 **REFACTOR:** Run `pnpm exec turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter`, edit the value, and record restart only after `^build`; confirm no supervisor/lock/DB/Compose scope.

## Unit 2: API Image Seam (PR 2)

- [x] 2.1 **RED:** Create `viewpro-app/apps/api/src/runtime-contract-smoke.spec.ts`; run `pnpm --filter @viewpro/api exec vitest run src/runtime-contract-smoke.spec.ts`; assert static-import/one-shot/image failures.
- [x] 2.2 **GREEN:** Modify only `viewpro-app/apps/api/package.json` (`scripts.runtime:smoke`) and `Dockerfile`; create `src/runtime-contract-smoke.ts`. Build root-context; inspect `Config.Entrypoint`/`Config.Cmd`; run `docker run --rm <image> node dist/runtime-contract-smoke.js`; require 0, no Nest/listener/HTTP/DB activity.
- [x] 2.3 **REOPENED — exit-only stdio correction:** RED proved ordered parent-stdio teardown for exit without close; `exit` termination, `close` stdio closure, bounded neither-event failure without reap/orphan claim, and tokenized Docker cleanup passed. Keep tests/script in PR 2.

## Unit 3: App New Node Marker / Image (PR 3)

- [x] 3.1 **RED:** Create `viewpro-app/apps/app-new/src/instrumentation.spec.ts`; run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/instrumentation.spec.ts` for Node, absent env, Edge no-import, `EADDRINUSE`, and exact-response failures.
- [x] 3.2 **GREEN:** Modify Unit 3 paths in `design.md`; create `instrumentation-node.ts` and `scripts/runtime-contract-image-smoke.mjs`. Prove Node-only import independent of Sentry; helper owns `node:http`, awaited bind/unref, exact marker, `transpilePackages`, separate ports/readiness/teardown.
- [x] 3.3 **REFACTOR:** Run `pnpm --filter next-shadcn-dashboard-starter runtime:smoke`; require `/auth/sign-in` 200, byte-exact private marker, graceful/escalated teardown, and awaited/reaped child.

## Unit 4: CI / Docs / Manual Gate (PR 4; after Units 2/3)

- [ ] 4.1 **RED:** From `viewpro-app`, run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, and `pnpm exec turbo run test --concurrency=1`; record CI/root-guidance/manual-gate gaps.
- [ ] 4.2 **GREEN:** Modify `.github/workflows/ci.yml` and `viewpro-app/README.md`; create `docs/release/manual-vercel-runtime-contract-gate.md` with sequential commands, deployment ID/full SHA/production/READY/settings/HTTPS URL/smoke, reviewer result, and external evidence.
- [ ] 4.3 **REFACTOR:** Document rollback: record external immutable `RESTORE_SHA`, run current Unit 3/2 smokes first, restore 4→1, assert checkout/deployed SHA, use only checks available at that SHA, and add no comparator/capture/hash/Vercel automation.
