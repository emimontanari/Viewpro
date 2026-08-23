# Design: Safe Public Error Boundary

## Approach and Decisions

Two WUs close disclosure; PR2 follows PR1. Defer feature/BFF actionability, #340/WU3a, CI/root metadata/cutover, invitation UI/copy, producer annotations.

| Decision | Choice / rationale |
|---|---|
| Contract | Append-only tuple derives membership/types/envelope; prevents duplicate truth. |
| Authority | HTTP status transports; only validated code/ID reach client. |
| Rollback | Default-off switch shapes; server correlation stays secure off. |

`request → real requestIdMiddleware → request.requestId/header → GlobalExceptionFilter → exact body + bounded Sentry context`

| WU | Modify | Create |
|---|---|---|
| 1 | `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `apps/app-new/src/lib/api-client.ts` | `apps/app-new/src/lib/api-client.test.ts` |
| 2 | API `common/{filters/global-exception.filter.ts,errors/api-error-response.ts,middleware/request-id.middleware.ts}`, `bootstrap/create-app.ts`, `config/{app.config.ts,app.config.spec.ts,env.schema.ts,__tests__/env.schema.spec.ts}`, `test/errors.e2e-spec.ts` | `common/middleware/request-id.middleware.spec.ts` |

## WU1 — Catalog + Direct Consumer (220–310 lines; 90 headroom)

Unique ordered `PUBLIC_ERROR_CODES`: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, `STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `REQUEST_FAILED`; derive `PublicErrorCode`, guard, `{statusCode,errorCode,requestId}`. Tests: tuple/13-code prefix/uniqueness, require/import exports.

`ApiError` becomes `{status,message,errorCode?,requestId?}`: never-throw parser retains status, valid code/lowercase UUID-v4 ID; drops prose/fields/`details` for generic fallback. Direct consumers: `lib/session.ts`, team/owner invitation services/acceptance views, admin tenant management, five auth views. Invitation behavior/copy stays; ten feature parsers/57 BFF forwarders defer.

**Strict TDD:** RED `runtime-contract.spec.ts`: require/import catalog/guards; `api-client.test.ts`: malformed/legacy/extra, valid status/code/ID, fallback. Initially fail; run unchanged `pnpm --filter @viewpro/contracts test && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts` for RED/GREEN/REFACTOR, then package/App typechecks.

## WU2 — Global Producer Boundary + Correlation (280–370 lines; 30 headroom)

Config owns default-false boolean `PUBLIC_ERROR_ENVELOPE_ENABLED`; `createApiApp` injects it. Enabled every-route errors are `{statusCode,errorCode,requestId}`; catalog codes pass, unknown/missing becomes `REQUEST_FAILED`, no auth/invitation annotation. Disabled keeps legacy body.

Middleware replaces inbound IDs with lowercase UUID-v4 `randomUUID()` in `request.requestId`/header; body/telemetry reuse it. Test-only `errors.e2e-spec.ts` mounts real middleware/filter+throwing routes+capture double; capture failure cannot alter response. `createApiApp` proves unset/false/true wiring.

**Strict TDD:** RED: config states/invalid input, inbound replacement, exact 4xx/5xx, 13 codes, fallback, fresh equality, contained telemetry failure. Run unchanged `pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts` for GREEN/REFACTOR, then API typecheck.

## Operational Enablement — 0 Repository Lines

Record full `git rev-parse HEAD` as `REVIEWED_SHA`, evidence `safe-public-error-boundary/<REVIEWED_SHA>`. Local only:

| State | Candidate-bound commands |
|---|---|
| Package/App (all states) | `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts && pnpm --filter next-shadcn-dashboard-starter typecheck` |
| Unset | `env -u PUBLIC_ERROR_ENVELOPE_ENABLED pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts` |
| False | `PUBLIC_ERROR_ENVELOPE_ENABLED=false pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts` |
| True | `PUBLIC_ERROR_ENVELOPE_ENABLED=true pnpm --filter @viewpro/api exec vitest run src/config/app.config.spec.ts src/config/__tests__/env.schema.spec.ts src/common/middleware/request-id.middleware.spec.ts test/errors.e2e-spec.ts && pnpm --filter @viewpro/api typecheck` |

`CANDIDATE_API_URL` is isolated Dokploy, not production `https://api.inmoview.app/api` (retired demo ineligible). Retain authenticated URL, deployment/flag/config revisions, inspection ID, UTC transcript/operator. Require `DEPLOYED_REVISION == REVIEWED_SHA`; edits/redeploys require fresh reconciliation.

`GET /api/health` proves success; invalid `POST /api/auth/login` `{}` traverses validation/error. Fail-closed smoke per state:

```bash
set -euo pipefail
: "${EXPECTED_REPO_ROOT:?candidate repository root required}" "${CANDIDATE_API_URL:?isolated candidate /api URL required}" "${REVIEWED_SHA:?}" "${DEPLOYED_REVISION:?}" "${DEPLOYMENT_ID:?}" "${CONFIG_REVISION:?}" "${EVIDENCE_ID:?}" "${OPERATOR:?}" "${STATE:?}"
resolved_repo_root="$(git -C "$EXPECTED_REPO_ROOT" rev-parse --show-toplevel)"
test "$resolved_repo_root" = "$EXPECTED_REPO_ROOT"
test -z "$(git -C "$EXPECTED_REPO_ROOT" status --porcelain)"
test "$(git -C "$EXPECTED_REPO_ROOT" rev-parse HEAD)" = "$REVIEWED_SHA"
test "$CANDIDATE_API_URL" != 'https://api.inmoview.app/api'
test "$DEPLOYED_REVISION" = "$REVIEWED_SHA"
case "$STATE" in unset|false|true) ;; *) exit 1;; esac
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT; attacker='attacker-request-id'
curl --silent --show-error --max-time 15 --header "x-request-id: $attacker" --dump-header "$tmp/s1.h" --output "$tmp/s1.b" --write-out '%{http_code}' "$CANDIDATE_API_URL/health" >"$tmp/s1.s"
curl --silent --show-error --max-time 15 --header "x-request-id: $attacker" --dump-header "$tmp/s2.h" --output "$tmp/s2.b" --write-out '%{http_code}' "$CANDIDATE_API_URL/health" >"$tmp/s2.s"
curl --silent --show-error --max-time 15 --request POST --header 'content-type: application/json' --header "x-request-id: $attacker" --data '{}' --dump-header "$tmp/e.h" --output "$tmp/e.b" --write-out '%{http_code}' "$CANDIDATE_API_URL/auth/login" >"$tmp/e.s"
node - "$tmp" "$STATE" "$attacker" <<'NODE'
const fs=require('node:fs'),[dir,state,attacker]=process.argv.slice(2),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id=n=>{const v=/^x-request-id:\s*(.+)\r?$/im.exec(fs.readFileSync(`${dir}/${n}.h`,'utf8'))?.[1]?.trim();if(!v||!uuid.test(v)||v===attacker)throw Error(`${n}: invalid request id`);return v};
if(['s1','s2'].some(n=>fs.readFileSync(`${dir}/${n}.s`,'utf8')!=='200'))throw Error('health status'); if(fs.readFileSync(`${dir}/e.s`,'utf8')!=='400')throw Error('validation status');
const ids=['s1','s2','e'].map(id);if(new Set(ids).size!==ids.length)throw Error('request IDs not fresh'); const body=JSON.parse(fs.readFileSync(`${dir}/e.b`,'utf8')),keys=Object.keys(body).sort().join(',');
if(state==='true'?(keys!=='errorCode,requestId,statusCode'||body.requestId!==ids[2]):(keys!=='error,message,path,requestId,statusCode,timestamp'||body.requestId!==ids[2]))throw Error('unexpected error shape');
NODE
```

True: exact keys/header-body equality/attacker replacement/3 fresh IDs; unset/false legacy keys/header replacement. Exhaustive all-13 proof local; smoke needn't cover every producer. RED: arbitrary process cwd is ignored/safe; missing/non-repository/mismatched `EXPECTED_REPO_ROOT` exits pre-`curl`; dirty/staged/untracked candidate likewise; clean exact-HEAD proceeds to revision/HTTP. Stop on metadata/SHA/config mismatch, failed/mixed shape, forbidden key/code, telemetry effect, excluded dependency, or ≥400 lines. Rollback: set false, redeploy/reconcile, rerun smoke before WU2→WU1.

## Risks/Dependencies/Threat Matrix

Dependencies: #285/#356 approval; #346/PR #355 merge. Catalog omission downgrades; prefix/table tests contain it. No migration/questions.

| Boundary | Applicability / safe failure / RED |
|---|---|
| Documentation-like paths | N/A — no repository file classification/execution. |
| Git repository selection | Applicable — arbitrary process cwd is ignored/safe; operator evidence resolves/asserts `EXPECTED_REPO_ROOT`; missing/non-repository/mismatched value exits pre-HTTP. RED: pre-`curl` exit. |
| Commit state | Applicable — clean worktree/index, local HEAD exactly `REVIEWED_SHA`; dirty/staged/untracked exits pre-HTTP. RED: each pre-`curl`; clean exact-HEAD proceeds. |
| Push state | N/A — no push/tracking/refspec automation. |
| PR commands | N/A — no PR command composition/automation. |
