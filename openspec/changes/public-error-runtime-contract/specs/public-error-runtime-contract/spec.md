# Public Error Runtime Contract Specification

## Purpose

Define a behavior-neutral emitted runtime contract for `@viewpro/contracts` through root Turbo development, CI, Docker, and a manual authenticated Vercel release gate.

## Requirements

### Requirement: Consumable CommonJS package

`@viewpro/contracts` MUST be `type: commonjs`; emit exactly `dist/index.js` and `dist/index.d.ts`; preserve `ApiContractStatus` and `apiContractStatus`; set `main` to `dist/index.js`, `types` to `dist/index.d.ts`, and `exports.{types,import,require,default}` to the compiled declaration/runtime paths. Unit 1 MUST own a `scripts.build` that uses Node16 module/resolution, `rootDir: src`, `outDir: dist`, declarations, and emit; a `scripts.test` that establishes a build/current-output prerequisite before the focused runtime test; `scripts.typecheck` with `noEmit`; and `devDependencies.vitest` exactly `4.1.6`. Package runtime tests MUST live outside emitted `src/**` (for example, `packages/contracts/test/runtime-contract.spec.ts`) or an explicit build exclusion MUST prevent their output. Unit 1 lockfile changes MUST permit only new `@viewpro/contracts` entries in the `apps/api` and `apps/app-new` importers, each `workspace:*` → `link:../../packages/contracts`; `packages/contracts` importer changes for Vitest `4.1.6`; and required Vitest `4.1.6` peer-resolution entries. ESM output, renamed runtime extensions, dual output, extra emitted test/source artifacts, and unrelated lockfile changes are forbidden.

#### Scenario: Package entries are built and loadable
- **GIVEN** missing or stale contract output
- **WHEN** Unit 1 `scripts.test` establishes current output, then runs the focused Vitest `4.1.6` package proof with `require('@viewpro/contracts')` and dynamic `import('@viewpro/contracts')`
- **THEN** both load the fresh CommonJS artifact, expose the preserved symbols, and any extra/source/ESM/renamed/test artifact fails verification.

### Requirement: Root-native dependency ordering and watch

Consumers MUST declare `@viewpro/contracts`. The only supported development command from `viewpro-app/` is exactly `turbo watch dev --filter=@viewpro/api --filter=next-shadcn-dashboard-starter`. API and App New `dev` tasks MUST each set `dependsOn: ["^build"]`, `persistent: true`, `cache: false`, and `interruptible: true`; contracts has no persistent dev/watch task, and its `build` is non-persistent. Both consumer `typecheck` tasks MUST depend on `^build` and `^typecheck`; API retains its `db:generate` dependency, and App New declares a `typecheck` script if it does not already have one. Contracts `typecheck` remains no-emit. No supervisor, lock, PID, or process-identity mechanism is permitted.

#### Scenario: Contract edit restarts fresh consumers
- **GIVEN** that exact root watch command runs with both consumers
- **WHEN** a behavior-neutral contract value changes
- **THEN** Turbo rebuilds the non-persistent contracts dependency and restarts each affected interruptible consumer; every restarted invocation begins only after `^build` succeeds and observes the new value. This contract makes no claim about when a previous process is interrupted.

#### Scenario: Independent verification owns prerequisites
- **GIVEN** a clean checkout
- **WHEN** root build, typecheck, test, or a focused runtime proof runs
- **THEN** its graph prerequisite establishes current contract output before consumption; consumer typecheck follows both `^build` and `^typecheck` (plus API `db:generate`); aggregate CI runs build, typecheck, and test as sequential phases.

### Requirement: Separate Docker process contracts

Both Docker builders MUST be dependency-aware from `viewpro-app`, install frozen root dependencies containing the pinned Turbo executable, assert `node_modules/.bin/turbo`, and use that executable before every `pnpm exec turbo` invocation. API and App New smokes have separate process lifecycles.

#### Scenario: API image keeps its production command
- **GIVEN** a clean API image
- **WHEN** API runtime verification runs
- **THEN** it first asserts exact image config `Config.Entrypoint=["docker-entrypoint.sh"]` and `Config.Cmd=["node","dist/main.js"]`; it invokes only `docker run --rm <image> node <compiled-smoke>`, which overrides the command while preserving that entrypoint, without editing or overriding Dockerfile `CMD` or `ENTRYPOINT`.

#### Scenario: API one-shot is contained
- **GIVEN** the overridden API command
- **WHEN** it imports/asserts the compiled static-import seam
- **THEN** it exits `0` without Nest, listener, HTTP, or database activity; spawn, import, assertion, nonzero exit, signal, or timeout fails verification. `exit` proves direct-child termination, `close` additionally proves stdio closure; exit-only failure tears down parent stdio and unrefs the child, while neither event reports `runtime_smoke_termination_unconfirmed` without a reap/orphan claim.

#### Scenario: App New marker is Node-only, opt-in, and exact
- **GIVEN** `src/instrumentation.ts` statically imports `@viewpro/contracts`
- **WHEN** `NEXT_RUNTIME=nodejs` and `VIEWPRO_RUNTIME_MARKER_PORT` is present
- **THEN** instrumentation dynamically imports `instrumentation-node.ts` independently of the Sentry early return; that helper alone imports `node:http`, validates the port, awaits bind, rejects bind errors, then unrefs a successful `127.0.0.1` listener. It exposes only `GET /runtime-contract` and returns exactly status `200`, `text/plain`, and bytes `viewpro-contract-runtime:not-generated-yet\n`.
- **AND GIVEN** the marker variable is absent
- **THEN** no marker listener exists.
- **AND GIVEN** `NEXT_RUNTIME` is not `nodejs`
- **THEN** the helper is not imported and no marker listener or public route exists.

#### Scenario: App New marker RED cases
- **GIVEN** focused instrumentation tests
- **WHEN** they exercise the Node marker, absent marker variable, Edge runtime, `EADDRINUSE`, and its response
- **THEN** the Node case imports/binds/unrefs; absent and Edge cases do not import the helper; bind rejection propagates; and status, content type, and body are exact.

#### Scenario: App New standalone smoke is contained
- **GIVEN** a clean App New image
- **WHEN** its smoke uses a separate allocated loopback app-server port and marker port
- **THEN** readiness `GET /auth/sign-in` is `200`; the marker response is byte-exact; the marker is never published; and readiness, premature exit, request/status/body, timeout, graceful teardown, and escalation failures are RED cases that await/reap the server.

### Requirement: Manual authenticated Vercel blocking gate

No committed schema, capture, comparator, hashing, alias, or automated Vercel/release tooling is part of this capability. Before rollout, the maintainer or release operator MUST attach authenticated evidence to the release record (not the repository) for the exact deployment ID, full reviewed SHA, production target, READY state, current documented `viewpro-app` root/build settings, deployment-specific HTTPS URL, and a successful request smoke. A reviewer MUST record pass or fail. Missing, stale, mismatched, or drifted evidence blocks rollout. Future automation is out of scope and requires a separate operations child.

#### Scenario: Manual evidence blocks drift
- **GIVEN** a pending rollout
- **WHEN** the reviewer cannot reconcile every required field to the reviewed deployment and current settings
- **THEN** the reviewer records fail and rollout is blocked; only a matching authenticated evidence set and successful HTTPS request smoke permits pass.

### Requirement: Behavior-neutral rollback

Rollback MUST preserve public error, auth, session, invitation, UI, and telemetry behavior. Before any rollback action, the operator MUST record immutable full `RESTORE_SHA` outside the repository. Before reverting Unit 3 or Unit 2, the operator MUST run the current new API and App New smokes and retain their results only as diagnostic evidence. Restore units in reverse dependency order (4→1); after full restoration, assert both checkout revision and deployed revision equal `RESTORE_SHA`. Run only checks available in that SHA: frozen install; native sequential CI build, typecheck, and test; build/deploy; API `GET /api/health` and `GET /api/health/ready`; deployment-specific App HTTPS smoke; and fresh authenticated manual deployment evidence bound to `RESTORE_SHA`. A deleted `runtime:smoke` script MUST NOT be required after restoration. Operational evidence is never committed as self-proof.

#### Scenario: Restoration verifies the restored revision
- **GIVEN** rollback has an immutable `RESTORE_SHA`
- **WHEN** Units 3 and 2 would be reverted
- **THEN** the current new smokes run first as diagnostics; after Units 4→1 are restored, acceptance uses only checks present at `RESTORE_SHA`, verifies both revisions equal it, and records fresh authenticated deployment evidence bound to it.
