# Proposal: Public Error Runtime Contract

## Intent

`@viewpro/contracts` currently exposes source without emitted runtime output. Make its compiled CommonJS contract consumable by API and App New from a clean checkout, root-native Turbo development, and production images without changing product behavior.

## Scope

### In Scope
- Unit 1 owns one CommonJS-only package: `type: commonjs`, `main: dist/index.js`, `types: dist/index.d.ts`, and `exports.{types,import,require,default}` targeting those compiled paths. Its `scripts.build` emits Node16 `src` to `dist` with declarations; `scripts.test` first builds/current-output-prerequisites, then runs the focused runtime test outside `src/**`; `scripts.typecheck` is no-emit; and `devDependencies.vitest` is exactly `4.1.6`. Its `pnpm-lock.yaml` scope permits only new `@viewpro/contracts` entries in the `apps/api` and `apps/app-new` importers, each `workspace:*` → `link:../../packages/contracts`; `packages/contracts` importer changes for Vitest `4.1.6`; and required Vitest `4.1.6` peer-resolution entries. No ESM, extension rename, dual output, or unrelated lockfile change.
- Root-only development through exactly `turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter`. Both consumer `dev` tasks depend on `^build`, are persistent, uncached, and interruptible; the contracts build is non-persistent. Native Turbo is the sole coordinator.
- Clean-artifact, `require`, dynamic-`import`, API static-import/one-shot, and App New instrumentation/standalone-server proofs.
- Dependency-aware Docker builds. API smoke overrides only the invoked container command and preserves the production image command `node dist/main.js` and its existing ENTRYPOINT.
- A blocking manual, authenticated Vercel release gate. Root-local `viewpro-app/apps/app-new/vercel.json` versions the filtered-Turbo `buildCommand` and a production-aware `ignoreCommand`: production exits `1` to continue explicit promotions, while previews delegate to `npx turbo-ignore`. The operator attaches deployment-specific evidence and the reviewer records pass or fail. No Vercel evidence schema, capture, comparator, hashing, alias, dashboard-setting, or release automation is created or owned here.
- Active documentation for root commands and the manual gate.

### Out of Scope
- Per-app development, custom supervision, locks, PIDs, fencing, or duplicate-process guarantees.
- Automated Vercel evidence tooling, Git/PR tooling, or committing operational evidence as self-proof. Future automation is a separate operations child.
- Error, auth, session, invitation, UI, and telemetry behavior changes.

## Approach

Emit the contract and express its consumer edges in Turbo. After a contract change, root watch rebuilds the dependency and restarts affected interruptible consumers; every restarted invocation begins after `^build` succeeds and observes current output. API verification is a foreground one-shot; App New verification is a bounded loopback server proof with a Node-only, opt-in instrumentation marker. Release rollout is blocked until a human reviewer accepts authenticated Vercel evidence for the exact deployment.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `viewpro-app/packages/contracts/**` | Modify | Compiled CommonJS entry and focused package proof |
| `viewpro-app/{package.json,turbo.json,pnpm-lock.yaml}` | Modify | Root watch command and graph fields |
| `viewpro-app/apps/{api,app-new}/**` | Modify | Consumer imports and isolated image smokes |
| `viewpro-app/README.md`, `.github/workflows/ci.yml`, release guide | Modify/Create | Sequential verification, root guidance, manual gate |

## Compatibility and Rollout

Behavior-neutral. Four independent work units are forecast below the 400-line review budget: graph/package (350), API/image smoke (290), App New marker/image smoke (390), and CI/docs/manual gate (190): **1,220 lines total**. Rollout requires the manual Vercel gate after runtime checks.

## Risks and Rollback

CJS loading, stale output, watch restart ordering, image command drift, marker publication, and Vercel setting drift are blocked by focused proofs and the authenticated gate. Before rollback, record the immutable full `RESTORE_SHA` outside the repository. Before reverting Units 3 or 2, run the current new API and App New smokes as diagnostic evidence. Restore units 4→1; then assert the checkout and deployed revision equal `RESTORE_SHA`. Run only checks available in that SHA: frozen install; native sequential CI build/typecheck/test; build/deploy; API `GET /api/health` and `GET /api/health/ready`; deployment-specific App HTTPS smoke; and fresh authenticated manual deployment evidence bound to `RESTORE_SHA`. Never require a deleted `runtime:smoke` script after restoration, and never commit evidence.

## Dependencies

None. This is prerequisite for `safe-public-error-boundary` and later umbrella children.

## Success Criteria

- [ ] Clean output is exactly `dist/index.js` and `dist/index.d.ts`; CommonJS `require` and dynamic `import` load it.
- [ ] The exact root watch command rebuilds contracts and restarts affected consumers; every restarted invocation begins after `^build` succeeds and observes current output.
- [ ] API image inspection retains its production command and one-shot smoke overrides only `docker run` arguments; App New proves the exact opt-in loopback marker with bounded teardown.
- [ ] A reviewer blocks rollout unless authenticated Vercel evidence matches the exact reviewed deployment, SHA, production target, READY state, current settings, HTTPS URL, and request smoke.
- [ ] Rollback records immutable `RESTORE_SHA`, preserves current-smoke diagnostics before Units 3/2 are removed, and accepts restoration only through checks available at that SHA and fresh evidence bound to it.
