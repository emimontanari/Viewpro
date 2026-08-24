```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:89b146c8bdd4fcc3e4e49dce84ae0d9de4c61e4ac8bb0d428040fa65abe29d91
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 9/9
test_command: pnpm --filter @viewpro/contracts test && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts && env -u PUBLIC_ERROR_ENVELOPE_ENABLED pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts && PUBLIC_ERROR_ENVELOPE_ENABLED=false pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts && PUBLIC_ERROR_ENVELOPE_ENABLED=true pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts
test_exit_code: 0
test_output_hash: sha256:6a97e94f4d217ef7ef4c76e53bec64c17c7b10f4188e11a22e4c89dbd1b67874
build_command: pnpm --filter @viewpro/contracts typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter @viewpro/api typecheck
build_exit_code: 0
build_output_hash: sha256:198aa02dfc4fc5d1646f0a4b30c1a3a84da0abda98207ab08ba0880c3352c940
```

## Verification Report

**Change**: safe-public-error-boundary
**Version**: N/A (delta spec `specs/safe-public-error-boundary/spec.md`)
**Mode**: Strict TDD
**Reviewed SHA**: `c343ddee267ced73349c0405dadbae242a3ac212`
**Verified HEAD**: `a9cb55256d495285d10eb9cf91bf5d3432e88c47` (docs-only successor)
**Artifact store**: hybrid (OpenSpec + Engram)

`evidence_revision` is the SHA-256 of the sorted `git ls-tree HEAD` entries for the
thirteen product/test paths owned by this change. It is non-self-referential and
excludes mutable OpenSpec artifacts.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |
| Requirements | 5 |
| Scenarios | 9 |

Native `gentle-ai sdd-status` confirms `taskProgress.allComplete: true`,
`applyState: all_done`, and all planning artifacts `done`.

### Build & Tests Execution

**Build (type-check)**: PASSED — exit 0

```text
pnpm --filter @viewpro/contracts typecheck        -> tsc --noEmit, clean
pnpm --filter next-shadcn-dashboard-starter typecheck -> tsc --noEmit, clean
pnpm --filter @viewpro/api typecheck              -> tsc --noEmit, clean
```

**Tests**: PASSED — exit 0, 147 test executions, 0 failures, 0 skipped

```text
@viewpro/contracts test                     Test Files 1 passed (1)  Tests  5 passed (5)
app-new src/lib/api-client.test.ts          Test Files 1 passed (1)  Tests  7 passed (7)
api matrix, PUBLIC_ERROR_ENVELOPE_ENABLED unset  Test Files 4 passed (4)  Tests 45 passed (45)
api matrix, PUBLIC_ERROR_ENVELOPE_ENABLED=false  Test Files 4 passed (4)  Tests 45 passed (45)
api matrix, PUBLIC_ERROR_ENVELOPE_ENABLED=true   Test Files 4 passed (4)  Tests 45 passed (45)
```

57 distinct test cases; the API suite ran three times (one per switch state).
All five runs were executed independently in this verification, not read from
apply-progress.

**Coverage**: Not available — no coverage tool is configured for these packages.
Informational only; not a failure.

### Spec Compliance Matrix

| Requirement | Scenario | Test evidence | Result |
|-------------|----------|---------------|--------|
| Canonical public error catalog | Catalog preservation | `packages/contracts/test/runtime-contract.spec.ts:61` exact 14-tuple, 13-code prefix, uniqueness, all-accepted guard; `:83` declaration envelope; `apps/api/test/errors.e2e-spec.ts:223` `it.each` emits each of the 14 codes unchanged when enabled | COMPLIANT |
| Canonical public error catalog | Unknown or missing code | `apps/api/test/errors.e2e-spec.ts:12-13` cases `[undefined,'REQUEST_FAILED']` and `['unknown-code','REQUEST_FAILED']` driven through `:223`; `runtime-contract.spec.ts:79-80` guard rejects unknown/missing | COMPLIANT |
| Focused tolerant direct consumer | Legacy or malformed body | `apps/app-new/src/lib/api-client.test.ts:94` malformed JSON + non-JSON HTML; `:110` empty body; `:119` body read rejects — all yield status + local generic fallback, never throw | COMPLIANT |
| Focused tolerant direct consumer | Valid fields only | `apps/app-new/src/lib/api-client.test.ts:16` retains only code + request ID and discards prose/`details`; `:36` unknown/missing code dropped; `:54` invalid ID and prose dropped; `:73` four non-canonical UUID shapes rejected | COMPLIANT |
| Global exact producer envelope | Exact enabled response | `apps/api/test/errors.e2e-spec.ts:223` 16 direct-filter cases assert exactly `{statusCode,errorCode,requestId}`; `:119` real-app `true` state asserts `Object.keys(...).sort()` equals `errorCode,requestId,statusCode` and the exact body at `:136-142` | COMPLIANT |
| Global exact producer envelope | Telemetry failure isolation | `apps/api/test/errors.e2e-spec.ts:259` `captureException` throws; the exact three-key sanitized body and fresh ID are still returned | COMPLIANT |
| Server-owned correlation | Fresh replacement and equality | `apps/api/src/common/middleware/request-id.middleware.spec.ts:9` replaces attacker ID in context and header; `:22` distinct fresh UUID v4 per request; `apps/api/test/errors.e2e-spec.ts:119-134` two requests per state prove header/body equality, freshness, and attacker replacement in all three states; `:44` legacy-state regression | COMPLIANT |
| Controlled rollout and rollback | Candidate enablement gate | `apps/api/src/config/__tests__/env.schema.spec.ts:47` `it.each` resolves unset/`false` to `false` and `true` to `true`; `:59` rejects an invalid value; the three-state API matrix and both consumer suites re-run green in this verification; candidate-bound deployment evidence recorded in `apply-progress.md:52-56` | COMPLIANT (deployed portion operator-attested, see SUGGESTION 4) |
| Controlled rollout and rollback | Switch-off rollback | `apps/api/test/errors.e2e-spec.ts:98` `describe.each` — the `false` state returns the exact legacy key set while correlation (`:126-134`) stays active; the app-new consumer suite passes unchanged under all states; operator-recorded switch-off-first rollback in `apply-progress.md:55` | COMPLIANT |

**Compliance summary**: 9/9 scenarios compliant, 5/5 requirements satisfied.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Canonical public error catalog | Implemented | `packages/contracts/src/index.ts:5-20` is the single ordered 14-value `as const` tuple in exact spec order, `REQUEST_FAILED` last; `PublicErrorCode` (`:22`), `PublicErrorEnvelope` (`:24-28`), and `isPublicErrorCode` (`:30-32`) all derive from it. No auth, invitation, or actionable codes present. |
| Focused tolerant direct consumer | Implemented | `apps/app-new/src/lib/api-client.ts:98-109` `toApiError` keeps `response.status` as transport authority, substitutes `GENERIC_API_ERROR_MESSAGE`, and conditionally spreads only a catalog-valid `errorCode` and a UUID-v4 `requestId`. `parseJsonResponse` (`:77-96`) uses nested try/catch so neither `text()` rejection nor `JSON.parse` failure can throw. Scope limited to `api-client.ts`; no feature parser or BFF forwarder was touched. |
| Global exact producer envelope | Implemented | `apps/api/src/common/filters/global-exception.filter.ts:48-58` branches on `options.publicErrorEnvelopeEnabled`; `publicErrorPayload` (`:74-80`) returns exactly three keys and maps any non-catalog code to `REQUEST_FAILED`. Telemetry capture (`:60-69`) is wrapped in `try {} catch {}` and runs before `response.status().json()` at `:71`, so capture failure cannot alter the response. |
| Server-owned correlation | Implemented | `apps/api/src/common/middleware/request-id.middleware.ts:9-13` unconditionally calls `randomUUID()`, ignores any inbound header, and sets both `request.requestId` and the `x-request-id` response header. `create-app.ts:19` registers it before every other middleware. The filter has a defensive fallback at `global-exception.filter.ts:31-36` for unmatched-middleware paths. |
| Controlled rollout and rollback | Implemented | `apps/api/src/config/env.schema.ts:187-189` declares `PUBLIC_ERROR_ENVELOPE_ENABLED = false` with `parsePublicErrorEnvelopeEnabled` (`:22-32`) resolving `undefined`/`false`/`'false'` to `false` and throwing on anything else. `app.config.ts:102-103` exposes `app.publicErrorEnvelope.enabled`; `create-app.ts:43-45` passes it into the filter. Default-off is proven at three levels: schema, config, and real-app E2E. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Append-only tuple is the single source of truth | Yes | `packages/contracts/src/index.ts:5` — type, guard, and envelope all derive; no duplicate catalog exists anywhere in the repo. |
| HTTP status is transport authority; only validated code/ID reach the client | Yes | `api-client.ts:104` uses `response.status`; only `isPublicErrorCode` and `isCanonicalRequestId` survivors are attached. |
| Default-off switch shapes the body; correlation stays secure when off | Yes | `errors.e2e-spec.ts:98` proves legacy keys plus fresh replaced IDs in the unset and false states. |
| `request -> requestIdMiddleware -> requestId/header -> GlobalExceptionFilter -> exact body + bounded Sentry context` | Yes | Realized verbatim in `create-app.ts:19,42-46` and `global-exception.filter.ts:27-72`. |
| WU2a dormant, WU2b wires `createApiApp` | Yes | The wiring lives only at `create-app.ts:43-45`; the filter defaults to `{}` options (`global-exception.filter.ts:24`), so it stays dormant without explicit configuration. |
| Bounded telemetry — no raw URL or exception detail | Yes | `safeRoutePath` (`:99-101`) emits a route template or `unmatched_route`; `sanitizeExceptionForSentry` (`:103-108`) emits only `{type,statusCode}`. Proven at `errors.e2e-spec.ts:147,166,239`. |
| Operations add zero repository lines | Yes | Commit `a9cb552` touched only `apply-progress.md` and `tasks.md`: 10 insertions, 4 deletions, no source or test file. |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | `apply-progress.md:16-29` Strict TDD Cycle Evidence table, 11 rows |
| All tasks have tests | Yes | 11/11 implementation tasks (1.1-1.5, 2.1-2.3, 3.1-3.3) have named test files; the three Operations tasks (4.1-4.3) are zero-repository-line by design and carry prose RED/GREEN evidence at `apply-progress.md:52-56` |
| RED confirmed (test files exist) | Yes | 6/6 referenced test files verified on disk |
| GREEN confirmed (tests pass) | Yes | 6/6 files pass under independent re-execution; 147/147 executions green |
| Triangulation adequate | Yes | Catalog: 14 codes plus unknown plus missing = 16 cases. Consumer: valid, unknown, missing, invalid ID (4 shapes), malformed, non-JSON, empty, unreadable. Config: unset/false/true plus invalid. Lifecycle: 3 states plus close-reject and close-success cleanup. |
| Safety Net for modified files | Yes | Recorded baselines: contracts 3/3, `errors.e2e-spec.ts` 26/26 and 23/23 before edits, App New new-file N/A |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 24 | 4 | vitest (`runtime-contract.spec.ts` 5, `api-client.test.ts` 7, `request-id.middleware.spec.ts` 2, `app.config.spec.ts` 3, `env.schema.spec.ts` counted below) |
| Unit (config) | 12 | 1 | vitest (`env.schema.spec.ts`) |
| Integration / E2E | 28 | 1 | vitest + supertest + real `createApiApp()` Nest lifecycle (`errors.e2e-spec.ts`) |
| **Total distinct** | **57** | **6** | |

Every requirement with runtime disclosure risk is covered by the real-app
Supertest layer, not unit tests alone. `runtime-contract.spec.ts` additionally
spawns real `node` subprocesses to prove CommonJS `require` and ESM dynamic
import both resolve the published catalog.

### Changed File Coverage

Coverage analysis skipped — no coverage tool is configured for `@viewpro/contracts`,
`next-shadcn-dashboard-starter`, or `@viewpro/api`. Informational, not blocking.

### Assertion Quality

No tautologies, orphan empty-collection checks, standalone type-only assertions,
assertions that never call production code, incomplete-TDD assertions, or
smoke-test-only cases were found.

| Pattern audited | Finding |
|---|---|
| Ghost loop | `api-client.test.ts:83-91` loops over `invalidRequestIds`, but `:81` asserts `toHaveLength(4)` first, so the loop can never silently pass on an empty collection. Correctly guarded. |
| Mock-call assertions | `errors.e2e-spec.ts:162-163,183-184,254-256` assert on `captureException.mock.calls[0]`, but each is a disclosure assertion ("the raw error and secret never reached telemetry") paired with a value assertion on the same call. Behavioral, not implementation coupling. |
| Type-only assertions | `errors.e2e-spec.ts:58,401` use `expect.any(String)` for `timestamp`, always combined with exact-value `toMatchObject` assertions in the same test. Acceptable. |
| Mock/assertion ratio | Well under 2x in every file. `api-client.test.ts` uses real `Response` objects throughout except one deliberate rejected-`text()` double at `:120-124`, which is the only way to exercise that branch. |
| Exact-shape assertions | `errors.e2e-spec.ts:133-134` and `:232-236` use `Object.keys(...).sort()` and `toHaveBeenCalledWith` exact objects, so an extra leaked key fails the test. This is the strongest available assertion for a disclosure boundary. |

**Assertion quality**: All assertions verify real behavior. 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: Not run — no lint script is wired for these packages in this change's
declared command set. Informational.
**Type Checker**: PASSED — `tsc --noEmit` clean for all three packages.

### Repository State

Worktree is clean apart from the single untracked
`openspec/changes/safe-public-error-boundary/exploration.md`, which was preserved
byte-for-byte and never staged, moved, or modified. No `apps/api/dist` was
created (no `nest build` was run). No source, test, spec, design, task, or
apply-progress file was modified by this verification.

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. Hybrid artifact store is incomplete on the Engram side. The session preflight
   declares `hybrid` (OpenSpec files plus Engram), but Engram holds only
   `sdd/safe-public-error-boundary/proposal` (observation #8170). There are no
   `sdd/safe-public-error-boundary/spec`, `/design`, `/tasks`, or
   `/apply-progress` topics. The OpenSpec files are complete and authoritative,
   and native `sdd-status` reads them correctly, so this does not block archive
   or change any behavior — but Engram-only recovery of this change would be
   incomplete. Recommend the archive phase record the lineage explicitly.

**SUGGESTION**:

1. Sibling app `apps/viewpro-api` still trusts an inbound request ID.
   `apps/viewpro-api/src/common/middleware/request-id.middleware.ts:9-10` reads
   `request.header('x-request-id')` and only falls back to `randomUUID()`, so an
   attacker can pin the correlation ID on that service. This is explicitly
   outside this change's scope (the spec scopes correlation to `apps/api` and the
   App New consumer, and forbids claiming migration of other surfaces), so it is
   not a defect of this change. It is a genuine residual surface worth a
   follow-up change.

2. Legacy consumer `apps/viewpro-web/src/lib/api-client.ts:168-180` still returns
   `details: body` and server prose in its `ApiError`. Again explicitly deferred
   by the spec's "Explicit scope" and "MUST NOT claim migration" clause, so this
   change is compliant. Track as follow-up alongside the ten feature parsers and
   57 BFF forwarders already listed as deferred.

3. `tasks.md:44` phrases task 3.2 as "production disabled". The wiring at
   `apps/api/src/bootstrap/create-app.ts:43-45` has no `NODE_ENV` branch; the
   envelope is off in production because the flag defaults to `false` when unset,
   not because production is hard-coded off. The behavior matches the spec
   requirement exactly ("MUST default to `false` when unset"); only the task
   wording is loose. No code change needed.

4. Operations 4.1-4.3 evidence is operator-attested and not independently
   reproducible in this verification. The ephemeral candidate was fully torn
   down before verification began, and this phase is barred from deployment,
   infrastructure, network, and provider commands. The reproducible half of
   those tasks — the three-state local API matrix, both consumer suites, and all
   three type-checks — was re-executed here and passed. The deployed-candidate
   half rests on the digests and results recorded at `apply-progress.md:52-56`
   and the closure of issue #356. Recorded as an audit note, not a gap: the
   attested results are internally consistent with, and independently predicted
   by, the local three-state matrix that this verification did re-run.

5. `apply-progress.md` records no TDD Cycle Evidence table row for tasks 4.1-4.3.
   Those tasks add zero repository lines by design, so there is no test file to
   cite; their RED/GREEN evidence is written in prose at `apply-progress.md:54`.
   Consider a short table row marked `N/A (operations)` for symmetry in future
   changes.

### Verdict

**PASS WITH WARNINGS** — 5/5 requirements and 9/9 scenarios are satisfied with
passing runtime evidence re-executed in this phase; 0 CRITICAL, 1 WARNING
(Engram side of the hybrid store is incomplete), 5 SUGGESTIONS. Nothing blocks
`sdd-archive`.
