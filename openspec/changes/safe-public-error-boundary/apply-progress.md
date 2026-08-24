# Apply Progress: Safe Public Error Boundary
## Status and Identity
WU1 / PR1 and WU2a / PR2 are complete in Strict TDD mode; WU2b / PR3 and operations remain untouched.
- Delivery: chained `stacked-to-develop`: WU1 / PR1 → WU2a / PR2 → WU2b / PR3 → Operations.
- Initial WU1 evidence revision: `sha256:5c47fb60a3fd122ed0e90a007a32498a19edd7d803dd60e86119c883fdb10406`.
- WU1 evidence revision: `sha256:71777a02c1a057cef5581059b5df5cb3c3f0fea794fa675cf893ced6bb8b408a`, reproduced by `git diff --binary 863d78e^ 863d78e -- viewpro-app/packages/contracts/src/index.ts viewpro-app/packages/contracts/test/runtime-contract.spec.ts viewpro-app/apps/app-new/src/lib/api-client.ts viewpro-app/apps/app-new/src/lib/api-client.test.ts | shasum -a 256`.
## Completed Tasks
- [x] 1.1 Runtime catalog RED: ordered append-only tuple, guard, CommonJS/dynamic-import, and declaration envelope proof.
- [x] 1.2 Direct-client RED: valid/invalid fields, status authority, malformed/non-JSON bodies, local fallback, never-throw parsing.
- [x] 1.3 GREEN: `PUBLIC_ERROR_CODES` is the single truth with derived type, guard, and envelope.
- [x] 1.4 GREEN: `ApiError` retains only status, catalog code, and lowercase UUID-v4 request ID.
- [x] 1.5 REFACTOR: focused tests and both typechecks pass.
## Strict TDD Cycle Evidence
| Task | Test/layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| 1.1 | contracts runtime/unit | contracts 3/3 | contracts 2/5 failed: exports absent | contracts 5/5 | require/import, exact prefix/order, uniqueness, valid/unknown/missing guard, declarations | final focused green |
| 1.2 | App New/unit real `fetch`/`Response` | N/A (new test) | App 4/4 failed: legacy prose/details | App 4/4 | valid; unknown/missing; uppercase invalid ID; malformed/non-JSON | final focused green |
| 1.3 | contracts runtime/unit | shared 1.1 3/3 | shared 1.1 2/5 | contracts 5/5 | exact 14-value tuple and independent imports | final focused green |
| 1.4 | App New/unit real `fetch`/`Response` | N/A (no prior direct-client test) | shared 1.2 4/4 | App 4/4 | valid, unknown/missing, invalid-ID, malformed, non-JSON branches | final focused green |
| 1.5 | both/unit | prior GREEN | N/A, refactor-only | contracts 5/5; App 4/4 | prior matrices | no code change; typechecks green |
| 2.1 | API config, middleware, direct E2E | historical combined WU2 RED: 9 failures | config states/rejection, UUID replacement, exact 4xx/5xx catalog/fallback envelopes, telemetry containment | provisional GREEN: 25 passed; isolated GREEN: 40/40 | exact WU2 API command | final focused green |
| 2.2 | direct E2E | historical combined WU2 RED: 9 failures | named dormant options and legacy disabled body | provisional GREEN: 25 passed; isolated GREEN: 40/40 | exact WU2 API command | final focused green |
| 2.3 | focused API/typecheck | prior GREEN | N/A, isolation refactor | focused 40/40; API typecheck | legacy E2E and WU1 regression | complete at 361 lines |
## Review-Driven Test Hardening
Test-first characterization/triangulation: pre-edit baseline was contracts 5/5 and App 4/4, so RED is intentionally N/A; production was not changed.
- Lowercase UUIDs with wrong version, invalid RFC variant, truncation, or an extra character are rejected while status and valid code remain.
- Empty real `Response` body and a minimal double whose `text()` rejects both become local generic `ApiError`s, not parser/read exceptions or server prose.
- GREEN/REFACTOR: unchanged focused command is contracts 5/5 and App 7/7; unchanged typechecks pass.
## Work Unit Evidence
- Focused: `pnpm --filter @viewpro/contracts test && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts` — exit 0; contracts 5/5, App 7/7.
- Typechecks: `pnpm --filter @viewpro/contracts typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck` — exit 0.
- Runtime: N/A by design—direct-client seam; deployed HTTP/producer envelope is WU2. Tests use real `Response` parsing except the minimal rejected-read double.
- Rollback: revert WU1's four source/test files and its task/progress evidence before any WU2 enablement; no feature parser, BFF, invitation, producer, or operations coupling.
- Original transcript: Engram #8321, session `safe-public-error-boundary-wu2-20260823`, records RED 9 failures and provisional GREEN 25/25. Native ordinal 3 began at tree `0c4e92522425fb8c8295edadec0aa6a5d8a4a819` and interrupted at `sha256:ffe2dee171545c9cf88e2ae0391de887c26658720e71dab26cc0fd1c8d5003df`; that interrupted identity is not the original RED revision. Reproduced fixture: base `b91d7db1fbe7a07d70a7cf2f3919600d82cbc8d4`; ordered WU2a test-diff SHA `f3ce0d305ca466f78aef4fb54a95ebfe9e6d8ba7da4ebd798e9eee97037786d6` from `{ git diff --binary b91d7db -- viewpro-app/apps/api/src/config/app.config.spec.ts viewpro-app/apps/api/src/config/__tests__/env.schema.spec.ts viewpro-app/apps/api/test/errors.e2e-spec.ts; git diff --binary --no-index /dev/null viewpro-app/apps/api/src/common/middleware/request-id.middleware.spec.ts || true; } | shasum -a 256`. Temporary base-production reproduction ran `pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts`: 28/40 failures—4 env flag, 2 middleware, 22 error-boundary cases (legacy/production UUID, two Sentry policy, 16 catalog/fallback, matched-route, telemetry). Current isolated command adds API typecheck: GREEN 40/40; no WU2b harness or operations ran. Independent WU2a rollback reverts all WU2a product paths, tests, and proposal/design/tasks/progress evidence to dormant defaults/legacy bodies, without `bootstrap/create-app.ts` or PR3 wiring.
- Complete PR2 count: 292 additions + 69 deletions = 361 changed lines, excluding only `exploration.md`; 39 lines of headroom; `git diff --check` passes. WU2a source/test revision: `sha256:ed63847f5b04d5d79eae8fde8e46ae9641d30080cdd8d46dac4fac028890f896`, reproduced with `{ git diff --binary -- viewpro-app/apps/api/src/config/app.config.ts viewpro-app/apps/api/src/config/app.config.spec.ts viewpro-app/apps/api/src/config/env.schema.ts viewpro-app/apps/api/src/config/__tests__/env.schema.spec.ts viewpro-app/apps/api/src/common/errors/api-error-response.ts viewpro-app/apps/api/src/common/filters/global-exception.filter.ts viewpro-app/apps/api/src/common/middleware/request-id.middleware.ts viewpro-app/apps/api/test/errors.e2e-spec.ts; git diff --binary --no-index /dev/null viewpro-app/apps/api/src/common/middleware/request-id.middleware.spec.ts || true; } | shasum -a 256`.
## Files Changed
WU2a: `apps/api/src/config/{app.config.ts,env.schema.ts,__tests__/env.schema.spec.ts}`, `common/{errors/api-error-response.ts,filters/global-exception.filter.ts,middleware/request-id.middleware.ts,middleware/request-id.middleware.spec.ts}`, `test/errors.e2e-spec.ts`. Artifacts: `proposal.md`, `design.md`, `tasks.md`, `apply-progress.md`. Local research only: `exploration.md`, excluded from PR2/count and never staged.
## Deviations and Issues
None. The isolated implementation matches WU2a design; no WU2b wiring or lifecycle harness remains. Initial dependency install used `pnpm install --frozen-lockfile` without lockfile or package-metadata change.
## Remaining and Next Boundary
WU2a is ready for independent review within the 400-line cap; remaining: 3.1–3.3 WU2b wiring/lifecycle after review, then 4.1–4.3 candidate-bound enablement/rollback. Production enablement remains prohibited.
