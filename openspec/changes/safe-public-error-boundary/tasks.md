# Tasks: Safe Public Error Boundary

## Review Workload Forecast

| Scope | Estimate | Risk | Headroom |
|---|---:|---|---:|
| WU1 catalog + direct consumer | 340 measured | Medium | 60 lines |
| WU2a dormant boundary | 361 measured | High | 39 lines |
| WU2b wiring/lifecycle | 120–180 | Medium | 220–280 lines |
| Total | 821–881 | High | Split |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-develop
400-line budget risk: High

Stacked: WU1 / PR1 → WU2a / PR2 → WU2b / PR3 → Operations.

### Suggested Work Units

| Unit / PR boundary | Start → finish | Focused command | Runtime harness | Rollback |
|---|---|---|---|---|
| WU1 / PR1 → `develop` | Catalog + `ApiError` | WU1 command + typechecks | direct | WU1 |
| WU2a / PR2 → `develop` | Default-off config/filter/middleware; `createApiApp.ts` unchanged | `pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts && pnpm --filter @viewpro/api typecheck` | Real unchanged app: legacy-off request proves UUID replacement/header-body equality; filter dormant | Revert `config/{app.config.ts,env.schema.ts}`, `common/{errors/api-error-response.ts,filters/global-exception.filter.ts,middleware/request-id.middleware.ts}`, tests `config/__tests__/env.schema.spec.ts`, `common/middleware/request-id.middleware.spec.ts`, `test/errors.e2e-spec.ts`, and proposal/design/tasks/progress evidence; restore dormant defaults/legacy bodies; then WU1 |
| WU2b / PR3 → WU2a / PR2 | Wire `createApiApp.ts`; configured lifecycle E2E | `PUBLIC_ERROR_ENVELOPE_ENABLED=true pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts && pnpm --filter @viewpro/api typecheck` | configured E2E | false; WU2b→WU2a→WU1 |

## Phase 1: WU1 — Catalog + Direct Consumer

- [x] 1.1 RED: Extend `packages/contracts/test/runtime-contract.spec.ts` to fail unless ordered 13-code prefix is `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`; append `REQUEST_FAILED`; prove uniqueness/order, append-only, require/import exports, guard, envelope.
- [x] 1.2 RED: `api-client.test.ts` covers fields, malformed bodies, fallback, never-throw parsing.
- [x] 1.3 GREEN: `packages/contracts/src/index.ts`: `PUBLIC_ERROR_CODES` derives type/guard/envelope.
- [x] 1.4 GREEN: `api-client.ts` retains status/code/UUID; drops prose/details; generic fallback.
- [x] 1.5 REFACTOR: WU1 command and both typechecks.

## Phase 2: WU2a — Dormant Producer Boundary + Correlation

- [x] 2.1 RED: `env.schema.spec.ts`, middleware, and direct E2E cover config, UUID, catalog/fallback, telemetry.
- [x] 2.2 GREEN: `createApiApp.ts` unchanged; fresh IDs, dormant options, bounded telemetry, legacy bodies; no auth/invitation.
- [x] 2.3 REFACTOR: Run PR2 command; prove PR2 ≤400.

## Phase 3: WU2b — Real App Wiring and Lifecycle Proof

- [ ] 3.1 RED: After WU2a, E2E cover real-app states, correlation, attacker replacement, telemetry, and cleanup failures.
- [ ] 3.2 GREEN: Wire `requestIdMiddleware`, config, filter, and `SentryService` through `apps/api/src/bootstrap/create-app.ts`; production disabled.
- [ ] 3.3 REFACTOR: Run the PR3 command above and prove isolated PR3 ≤400.
- [ ] 4.1 Isolated Dokploy only; arbitrary cwd ignored/safe; record absolute `EXPECTED_REPO_ROOT`, `REVIEWED_SHA`, `safe-public-error-boundary/<REVIEWED_SHA>`, evidence/operator, deployment ID/revision, config revision; reconcile.
- [ ] 4.2 RED: invalid/mismatched root or dirty candidate exits before `curl`; clean exact HEAD runs `design.md` unset/false/true smoke; stop on metadata/SHA/config mismatch, failed/mixed shape, forbidden key/code, telemetry, excluded dependency, or ≥400 lines.
- [ ] 4.3 Switch off/reconcile; false-state smoke before WU2b→WU2a→WU1; no production authorization.

Deferred: actionable auth/invitation codes; invitation/session/credential behavior; ten feature parsers, 57 BFF forwarders; prose bridge; full Sentry/log redesign; CI/root metadata/cutover; #340/WU3a.
