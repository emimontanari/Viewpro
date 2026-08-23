# Apply Progress: Safe Public Error Boundary
## Status and Identity
WU1 / PR1 is complete in Strict TDD mode; `WU1-test-hardening` adds reviewer regression coverage only. Tasks 1.1–1.5 remain complete; WU2 and operations remain untouched.
- Initial token / request: `sha256:633ef3cb39fc758d6b9b41cf5cc2f4b76ff7290bd9be934193b11622dea1f88c` / `sperr-wu1-20260823-1425`.
- Review-hardening token / acquire request: `sha256:f79d3a8de1f74c12133dcefdfa6c3bcbbe6fa47926e9fe37caaea918ceff9206` / `sperr-wu1-tests-acquire-20260823-1450`.
- Delivery: chained `stacked-to-main`; WU1 / PR1 targets `develop`.
- Initial evidence revision: `sha256:5c47fb60a3fd122ed0e90a007a32498a19edd7d803dd60e86119c883fdb10406`.
- Current evidence revision: `sha256:71777a02c1a057cef5581059b5df5cb3c3f0fea794fa675cf893ced6bb8b408a`, reproduced by `git diff --cached --binary -- viewpro-app/packages/contracts/src/index.ts viewpro-app/packages/contracts/test/runtime-contract.spec.ts viewpro-app/apps/app-new/src/lib/api-client.ts viewpro-app/apps/app-new/src/lib/api-client.test.ts | shasum -a 256`.
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
- Implementation budget: 253 additions + 36 deletions = 289 source/test lines. Complete PR snapshot: 299 additions + 41 deletions = 340 changed lines, leaving 60 lines of headroom. `git diff --check` passed.
## Files Changed
`viewpro-app/packages/contracts/src/index.ts` (catalog); `viewpro-app/packages/contracts/test/runtime-contract.spec.ts` (runtime proof); `viewpro-app/apps/app-new/src/lib/api-client.ts` (sanitizer); `viewpro-app/apps/app-new/src/lib/api-client.test.ts` (parser matrix); `openspec/changes/safe-public-error-boundary/tasks.md` (1.1–1.5 checked); `openspec/changes/safe-public-error-boundary/apply-progress.md` (cumulative evidence).
## Deviations and Issues
None. The hardening cycle changed tests/evidence only. Initial dependency install used `pnpm install --frozen-lockfile` without lockfile or package-metadata change.
## Remaining and Next Boundary
- [ ] 2.1–2.3 WU2 producer boundary and server-owned correlation.
- [ ] 3.1–3.3 Candidate-bound enablement and rollback smoke.
WU1 is ready for independent review; WU2 must not start until WU1 merges.
