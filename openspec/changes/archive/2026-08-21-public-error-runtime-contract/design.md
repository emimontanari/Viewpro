# Design: Public Error Runtime Contract

## Technical Approach

Compile one CommonJS contract, let native root Turbo order its two consumers, and prove API and App New in separate image processes. Vercel’s repository-owned filtered-Turbo build prerequisite is authorized; dashboard and manual release automation remain deferred.

## Decisions

| Decision | Choice and rationale |
|---|---|
| Package | CommonJS Node16 `src` → `dist`; declarations and `main/types/exports` at `dist/index.{js,d.ts}`. Unit 1 owns build-before-test, no-emit typecheck, Vitest `4.1.6`. Lockfile permits only new `@viewpro/contracts` entries in `apps/api`/`apps/app-new` importers (`workspace:*` → `link:../../packages/contracts`), `packages/contracts` importer Vitest `4.1.6`, and required peer-resolution entries. |
| Root development | `viewpro-app/package.json` owns exactly `turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter`. In `turbo.json`, consumer `dev` owns `^build`, `persistent`, `cache: false`, and `interruptible`; consumer `typecheck` owns `^build` + `^typecheck` (API also retains `db:generate`); contracts typecheck is no-emit. No custom lifecycle layer. |
| API smoke | Assert exact `Config.Entrypoint=["docker-entrypoint.sh"]` and `Config.Cmd=["node","dist/main.js"]`, then invoke `docker run --rm <image> node <compiled-smoke>`. The command override preserves entrypoint and proves one-shot import/assert semantics without changing production startup. |
| App New smoke | Node-only `instrumentation-node.ts` statically imports the contract; Edge-safe `src/instrumentation.ts` dynamically loads that helper only for `NEXT_RUNTIME=nodejs` plus `VIEWPRO_RUNTIME_MARKER_PORT`. The helper alone owns `node:http`, port validation, awaited bind/rejection, then successful unref. This path is independent of Sentry. The standalone app and marker use different loopback ports. |
| Vercel build/release | `viewpro-app/apps/app-new/vercel.json` versions the filtered-Turbo `buildCommand` and exactly one `ignoreCommand`. Its production branch exits `1`, so Vercel continues an explicit production promotion; every non-production branch delegates to `npx turbo-ignore` and retains preview skip behavior. Root-local config overrides dashboard ignored-build settings; dashboard mutation remains forbidden. A maintainer/operator attaches authenticated evidence outside Git; the production gate remains manual. |

## Flow

`contracts/src → dist/index.{js,d.ts} → ^build → API one-shot | App New instrumentation → image smoke`

After a contract change, root watch rebuilds the dependency and restarts affected interruptible consumer tasks; each restarted invocation begins after `^build` succeeds and observes current output. It makes no claim about when an old process is interrupted. API smoke imports compiled output and exits. App smoke starts `node server.js`, waits for `GET /auth/sign-in` `200` on its app port, requests the marker port byte-for-byte, then graceful/escalated teardown awaits/reaps the child.

## Threat Matrix

| Boundary | Applicability, safe/failure behavior, and planned RED test |
|---|---|
| Documentation-like paths | N/A — no executable-file classifier exists. |
| Git repository selection | N/A — manual evidence records a reviewed SHA but introduces no Git command/tooling. |
| Commit state | N/A — no commit-state automation exists. |
| Push state | N/A — no push automation exists. |
| PR commands | N/A — no PR automation exists. |
| Docker/CLI smoke process integration — API one-shot | Applicable — override only invocation command, assert exact entrypoint/CMD, and reject spawn/import/assert/nonzero/signal/timeout. `exit` proves termination, `close` also proves stdio closure; exit-only failure tears down parent stdio/unrefs, and neither event is `termination_unconfirmed` without a reap/orphan claim. |
| Docker/CLI smoke process integration — App New standalone | Applicable — separate loopback ports; reject readiness/premature-exit/status/body/timeout/graceful-teardown/escalation failures and await/reap. Marker RED tests also cover Node, absent env, Edge no-import, `EADDRINUSE`, and exact response. |

## Units, Evidence, and Rollback

| Unit / forecast | Exact create/modify paths and owned fields | Prerequisite → end state; evidence | Rollback boundary |
|---|---|---|---|
| 1. Package/graph (350) | Modify `viewpro-app/packages/contracts/{package.json,tsconfig.json}`, `viewpro-app/{package.json,turbo.json,pnpm-lock.yaml}`, and only `dependencies.@viewpro/contracts` in `viewpro-app/apps/{api,app-new}/package.json`; add App New `scripts.typecheck` if absent; create `viewpro-app/packages/contracts/test/runtime-contract.spec.ts`. Own package/root/Turbo fields and only new `apps/api`/`apps/app-new` importer contract entries (`workspace:*` → `link:../../packages/contracts`), contracts importer Vitest `4.1.6`, and required peer-resolution entries. | Clean → compiled graph; prove shape, loads, package/root checks. | Revert fields and permitted lockfile entries. |
| 2. API/image smoke (290) | Modify only `scripts.runtime:smoke` in `viewpro-app/apps/api/package.json` and `viewpro-app/apps/api/Dockerfile`; create `viewpro-app/apps/api/src/runtime-contract-smoke.ts` and `viewpro-app/apps/api/src/runtime-contract-smoke.spec.ts`. Own API static import, compiled smoke, Docker build, and exact entrypoint/CMD assertion. | Unit 1 → production image config retained and command-only one-shot passes. Focused/API-image RED evidence. | Revert these API paths; no App New or graph rollback. |
| 3. App New marker/image smoke (390) | Modify only `scripts.runtime:smoke` in `viewpro-app/apps/app-new/package.json`, `viewpro-app/apps/app-new/{Dockerfile,next.config.ts,src/instrumentation.ts}`, and `viewpro-app/apps/app-new/vercel.json`; create `viewpro-app/apps/app-new/src/instrumentation-node.ts`, `viewpro-app/apps/app-new/scripts/runtime-contract-image-smoke.mjs`, and `viewpro-app/apps/app-new/src/instrumentation.spec.ts`. The Vercel path owns only the filtered-Turbo `buildCommand`; no dashboard/manual-gate field. | Unit 1 → Node-only private marker and standalone smoke pass. RED evidence covers Node, absent env, Edge no-import, `EADDRINUSE`, and exact response. | Revert these App New paths, including `vercel.json`; marker disappears with instrumentation change. |
| 4. CI/docs/manual gate (190) | Modify `viewpro-app/README.md`, `.github/workflows/ci.yml`, and `viewpro-app/apps/app-new/vercel.json`; create `docs/release/manual-vercel-runtime-contract-gate.md`. Unit 4 owns the production-aware ignored-build policy and CI proof; all dashboard, deployment-policy, manual-preview, and release automation remain forbidden. | Units 1–3 → checks documented and release gate usable. CI proves production continues without `turbo-ignore` and preview delegates; authenticated evidence remains outside Git. | Revert only these docs/CI/config paths; never delete external evidence. |

**Forecast: 1,220 lines; four units, each below 400.** Record immutable `RESTORE_SHA`; before reverting Units 3/2, run current API/App New smokes diagnostically. Restore 4→1, assert checkout/deployed revision equals `RESTORE_SHA`, then run only checks in that SHA: frozen install; native sequential CI build/typecheck/test; build/deploy; API `/api/health` and `/api/health/ready`; deployment-specific App HTTPS smoke; fresh authenticated evidence bound to `RESTORE_SHA`. Never require a deleted `runtime:smoke` script.
