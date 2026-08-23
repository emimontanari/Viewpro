# Tasks: Safe Public Error Boundary

## Review Workload Forecast

| Scope | Estimate | Risk | Headroom |
|---|---:|---|---:|
| WU1 catalog + direct consumer | 220–310 | Medium | 90 lines |
| WU2 producer boundary + correlation | 280–370 | Medium | 30 lines |
| Total | 500–680 | High | Split |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR0: planning-only proposal/spec/design/tasks to `develop`; no product WU; WU1/WU2 separate PRs.

### Suggested Work Units

| Unit / PR boundary | Start → finish | Focused command | Runtime harness | Rollback |
|---|---|---|---|---|
| WU1 / PR1 → `develop` | Stub+legacy client → catalog+safe `ApiError` | `pnpm --filter @viewpro/contracts test && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts`; package/App typechecks | N/A: direct-client unit seam; HTTP is WU2 | Pre-WU2: revert WU1 alone |
| WU2 / PR2 → `develop` after WU1 | Legacy filter/config → default-off exact envelope+fresh correlation | `pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts`; API typecheck | `design.md` curl+Node smoke, isolated Dokploy candidate, unset/false/true | Post-WU2: set false/reconcile, then WU2→WU1 |

## Phase 1: WU1 — Catalog + Direct Consumer

- [x] 1.1 RED: Extend `packages/contracts/test/runtime-contract.spec.ts` to fail unless ordered 13-code prefix is `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`; append `REQUEST_FAILED`; prove uniqueness/order, append-only, require/import exports, guard, envelope.
- [x] 1.2 RED: Create `apps/app-new/src/lib/api-client.test.ts`; fail for valid/unknown/missing codes, canonical/invalid IDs, status authority, malformed/non-JSON bodies, ignored details/prose, local fallback, and never-throw parsing.
- [x] 1.3 GREEN: In `packages/contracts/src/index.ts`, make `PUBLIC_ERROR_CODES` single truth and derive `PublicErrorCode`, membership guard, and `{ statusCode, errorCode, requestId }` exports.
- [x] 1.4 GREEN: In `apps/app-new/src/lib/api-client.ts`, implement safe `ApiError`/parser: retain status, valid code, lowercase UUID-v4 ID; drop prose/details; use local fallback. No feature parsers, BFFs, or invitation copy.
- [x] 1.5 REFACTOR: Rerun unchanged WU1 command and `pnpm --filter @viewpro/contracts typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck`.

## Phase 2: WU2 — Global Producer Boundary + Correlation

- [ ] 2.1 RED: Extend `apps/api/src/config/{app.config.spec.ts,__tests__/env.schema.spec.ts}`, create `common/middleware/request-id.middleware.spec.ts`, extend `test/errors.e2e-spec.ts`; fail on config states/invalid input, ID replacement/freshness, success/error headers, exact 4xx/5xx envelope, all-13 pass-through, unknown fallback, and contained telemetry failure.
- [ ] 2.2 GREEN: Wire one `appConfig`/`validateEnv` owner through `bootstrap/create-app.ts`; make `requestIdMiddleware` generate fresh server UUID-v4 context/header IDs; update `GlobalExceptionFilter`/`ApiErrorResponse` for exact enabled envelope, bounded telemetry, disabled legacy body. No auth/invitation annotations.
- [ ] 2.3 REFACTOR: Rerun unchanged WU2 API command and `pnpm --filter @viewpro/api typecheck`.

## Phase 3: Operational Enablement — Zero Repository Lines

- [ ] 3.1 Separate local/isolated Dokploy; arbitrary cwd is ignored/safe; record absolute `EXPECTED_REPO_ROOT`, `REVIEWED_SHA`, `safe-public-error-boundary/<REVIEWED_SHA>`, evidence/operator, deployment ID/revision, config revision; reconcile.
- [ ] 3.2 RED: arbitrary cwd is ignored/safe; missing/non-repository/mismatched `EXPECTED_REPO_ROOT` exits before `curl`; dirty/staged/untracked candidate likewise; clean exact-HEAD runs `design.md` unset/false/true smoke; stop on metadata/SHA/config mismatch, failed/mixed shape, forbidden key/code, telemetry effect, excluded dependency, or ≥400 lines.
- [ ] 3.3 Switch off/reconcile; pass false-state rollback smoke before WU2→WU1; no production authorization.

Deferred: actionable auth/invitation codes; invitation/session/credential behavior; ten feature parsers, 57 BFF forwarders; prose bridge; full Sentry/log redesign; CI/root metadata/cutover; #340/WU3a.
