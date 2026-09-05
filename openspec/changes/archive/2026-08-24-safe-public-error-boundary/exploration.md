## Exploration: safe-public-error-boundary

> **Post-Judgment-Day status:** The original exploration below is preserved as evidence. Its all-consumer/all-producer recommendation is superseded by the authoritative re-scope at the end of this document.

### Current State

Issue #356 is a **root-class C bug** in the #285 public-error cluster: one global response boundary trusts producer fields and client-supplied correlation IDs. The fix should harden that boundary once, not add status/message-specific sanitizers.

The worktree is based on exact `origin/develop` SHA `80a943781cdb807051879273910a15d0bdb99e81` (merged PR #355). The predecessor delivered a consumable CommonJS `@viewpro/contracts`, but its current public runtime still exports only `ApiContractStatus` and `apiContractStatus`; it has no public error envelope, catalog, or runtime validator.

Confirmed behavior:

| Surface | Current behavior |
|---|---|
| Existing public codes | The API currently emits 13 unrelated domain codes: `phone.too_short`, `DOCUMENT_DUPLICATE_APPROVED`, `OUTCOME_LABEL_NOT_FOUND`, `LABEL_NAME_COLLIDES_BUILTIN`, `LABEL_ALREADY_DELETED`, `RESOLUTION_COMMENT_REQUIRED`, `SELF_APPROVAL_FORBIDDEN`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`, `NOT_ASSIGNED_TO_ENGAGEMENT`, `ENGAGEMENT_ARCHIVED`, `TARGET_STATUS_SAME_AS_CURRENT`, and `STATUS_CHANGE_REQUEST_ALREADY_PENDING`. They are source literals, not a shared catalog. |
| API boundary | `GlobalExceptionFilter.catch` copies any truthy producer `errorCode`, plus `statusCode`, `error`, sanitized `message`, `path`, `timestamp`, and optional `requestId`. Production sanitizes only `message`; `path`, `timestamp`, arbitrary `errorCode`, and request metadata remain public. |
| Request IDs | `requestIdMiddleware` trims and trusts any incoming `x-request-id`, stores it on the request, and echoes it in the response header and error body. Tests pin this unsafe behavior with values such as `production-request-id`. |
| Configuration | `appConfig` and `EnvironmentVariables` have no public-error producer switch. Sentry has independent DSN/environment/sample-rate configuration. |
| Sentry | The filter captures unhandled/5xx failures as `{type,statusCode}` with `requestId`, `path`, status, and environment. Raw exceptions/messages are excluded, but API `SentryService.captureException` and the filter do not contain a throwing Sentry client; telemetry failure can interrupt public error handling. Public response shaping must remain independent from capture. |
| App New | `api-client.ts` trusts response `message`, retains the complete raw body in `ApiError.details`, and does not expose validated `errorCode` or `requestId`. No focused App New API-client test exists. Invitation views branch on HTTP status and English message substrings (`expired`, `accepted`), then use generic fallbacks. |
| Existing evidence | API `errors.e2e-spec.ts` proves current legacy shape, production message sanitization, attacker-controlled ID echo, and Sentry capture policy. Domain E2E/unit tests prove several existing codes. Invitation component tests prove status/message behavior. None prove catalog closure, unknown-code fallback, tolerant client parsing, or server-owned correlation. |

The consolidated predecessor spec, `openspec/specs/public-error-runtime-contract/spec.md`, governs package loading/build behavior and requires behavior-neutral rollback of its own change. Its archived proposal explicitly names this change as the next dependent capability. No separate archived #285 decomposition exists in OpenSpec; issue #356 is the available approved decomposition.

### Affected Areas

- `viewpro-app/packages/contracts/src/index.ts` — add the single runtime catalog, `PublicErrorCode`, minimal envelope types, and runtime guards without replacing existing exports.
- `viewpro-app/packages/contracts/test/runtime-contract.spec.ts` — prove require/import exports, complete legacy-code preservation, and guard behavior.
- `viewpro-app/apps/app-new/src/lib/api-client.ts` — stop retaining arbitrary response bodies; tolerate legacy/extra/malformed fields while preserving only valid catalog `errorCode` and server-format `requestId`.
- `viewpro-app/apps/app-new/src/lib/api-client.test.ts` — new focused compatibility, unknown-code, invalid-ID, extra-key, and generic-fallback proof.
- `viewpro-app/apps/app-new/src/features/{team-invitations,owner-invitations}/components/*acceptance-view.tsx` and existing tests — replace message-substring classification with catalog codes while retaining safe status-only fallback during consumer-first rollout.
- `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts` (`GlobalExceptionFilter.catch`) — one deny-by-default producer boundary and exact switched envelope.
- `viewpro-app/apps/api/src/common/errors/api-error-response.ts` — align the producer type with the shared contract instead of maintaining a second envelope definition.
- `viewpro-app/apps/api/src/common/middleware/request-id.middleware.ts` (`requestIdMiddleware`) — always replace incoming IDs with a fresh server UUID.
- `viewpro-app/apps/api/src/bootstrap/create-app.ts` (`createApiApp`) — inject the producer switch into the filter; keep middleware before routes/filter use.
- `viewpro-app/apps/api/src/config/{app.config.ts,env.schema.ts}` — one boolean `PUBLIC_ERROR_ENVELOPE_ENABLED`, validated and defaulted to `false`.
- `viewpro-app/apps/api/src/{auth,team,owner-invitations}/**` — attach explicit catalog codes only where the producer owns the domain fact; do not infer them from messages in the filter.
- `viewpro-app/apps/api/test/errors.e2e-spec.ts` — prove legacy-off compatibility, exact switched shape, catalog enforcement, unknown fallback, 4xx/5xx sanitization, ID replacement, header/body equality, and telemetry isolation.
- Existing domain/API tests asserting `errorCode` — compatibility evidence that unrelated codes survive catalog introduction.

### Approaches

1. **One append-only runtime catalog plus one global deny-by-default boundary** — extend the shipped contracts root, deploy a tolerant consumer first, then enable exact API emission behind one default-off switch.
   - Pros: fixes the root once; preserves all 13 existing domain codes; gives both apps one runtime truth; unknown producer strings cannot escape; supports independent rollout/rollback; no message allowlist or second catalog.
   - Cons: requires coordinated contract, consumer, and API tests; invitation-specific producers still need explicit code annotations at their domain decision points.
   - Effort: Medium

2. **Filter-local status/message mapping** — infer public codes from exception status and message text inside `GlobalExceptionFilter`.
   - Pros: fewer producer edits initially.
   - Cons: creates parallel truth, couples security to mutable English text, cannot distinguish equal-status invitation states safely, risks erasing unrelated codes again, and violates systemic root-cause treatment.
   - Effort: Low initially, High to maintain

### Recommendation

Use approach 1 with these locked technical decisions:

1. **Exact producer envelope:** when enabled, emit exactly `{ statusCode, errorCode, requestId }`. `statusCode` is an integer HTTP status, `errorCode` is always a catalog member, and `requestId` is always present. Do not emit `error`, `message`, `path`, `timestamp`, stack data, exception metadata, or arbitrary producer fields. Unknown/missing producer codes map to one catalog code, `REQUEST_FAILED`; they never pass through.
2. **Tolerant consumer:** treat the HTTP response status as transport authority. Parsing any body must never throw. Accept objects with extra legacy keys, but retain only a catalog-valid `errorCode` and canonical server request ID; ignore missing, unknown, wrong-type, or malformed fields. Generate local generic copy for unknown/legacy bodies and remove `ApiError.details`. Do not require exact-key equality on the client.
3. **Server-owned correlation:** generate a new lowercase RFC 4122 UUID v4 with `randomUUID()` for every request. Ignore and replace every incoming `x-request-id`, including a syntactically valid UUID. Set the generated value on `request.requestId` and the response header; switched error bodies use that exact same value. Clients treat it as opaque and only preserve the canonical UUID-v4 shape for support display.
4. **Catalog architecture:** export one append-only `PUBLIC_ERROR_CODES` tuple and derive `PublicErrorCode`, its membership set/guard, and the envelope from it. Seed it with `REQUEST_FAILED`, all 13 confirmed existing codes, and the auth/invitation codes required by the immediately following producer unit. Never create an auth-only replacement array. Producer code must be explicitly attached where the domain outcome is known; the filter only checks membership and falls back.
5. **Rollout and rollback:** deploy Work Unit 1 first. Work Unit 2 introduces `PUBLIC_ERROR_ENVELOPE_ENABLED=false`; production remains legacy until consumer compatibility is verified, then operations enable the switch. Immediate rollback is switching it off; code rollback is independently reverting WU2, then WU1 only after no enabled producer depends on the runtime exports. Keep one temporary legacy branch in the filter, not parallel catalogs or per-status switches.
6. **Sentry boundary:** calculate/capture sanitized internal telemetry independently of the public payload, retain `path` only in Sentry context, use the server-owned request ID, and contain telemetry client failures so they cannot alter the HTTP response. Do not broaden into Sentry sanitization redesign.

Proposed autonomous work units (hard stop and re-slice before review if either forecast reaches 400 changed lines):

| Work unit | Scope and proof | Forecast |
|---|---|---|
| WU1 — consumer and catalog | Contracts tuple/types/guards and runtime export proof; App New tolerant parser with no raw `details`; code-first invitation classification with legacy-safe fallback; focused compatibility/unknown/invalid tests. Deployable while API remains legacy. | 300–380 lines |
| WU2 — producer boundary and correlation | Default-off config; fresh server UUID middleware; exact global envelope and catalog gate; explicit auth/invitation producer codes; telemetry containment; API tests for off/on, existing/unknown codes, 4xx/5xx privacy, and header/body correlation. Independently reversible by switch-off/revert. | 320–390 lines |

No product decision blocks proposal. Existing invitation copy can be retained; any later change to which user-facing action accompanies a code is product scope under #285, not a boundary decision.

Overlap with concurrent #340/WU3a is **none identified**. This plan does not touch `.github/workflows/ci.yml`, root package metadata, `scripts/production-cutover/**`, or the #340 worktree. The only shared predecessor is already-merged runtime-contract infrastructure. If implementation unexpectedly requires those excluded surfaces, stop and report the dependency rather than edit them.

### Risks

- Omitting any of the 13 existing codes from the first catalog would convert a currently actionable unrelated domain failure to `REQUEST_FAILED`; a complete set-equality regression test is mandatory.
- Consumer-first rollout temporarily receives legacy bodies without new auth/invitation codes; status-only generic fallback must remain safe until the producer switch is enabled.
- A switch accidentally defaulting on, or controlling only some response paths, would defeat rollback and create mixed envelopes.
- Trusting even well-formed incoming IDs permits correlation spoofing; replacement must be unconditional.
- Telemetry exceptions currently can escape the capture call; boundary tests must prove Sentry failure cannot prevent the sanitized response.
- WU2 is close to the 400-line budget; auth/invitation producer annotations must stay focused, and any forecast growth requires another autonomous slice before apply.

### Ready for Proposal

Yes. The proposal should lock the exact three-key producer envelope, unconditional UUID-v4 replacement, the complete append-only catalog, tolerant consumer-first ordering, one default-off producer switch, and the two review-budgeted work units above. It should name the 13-code set-equality test, unknown-code fallback test, switched production privacy tests, and request header/body correlation test as closure evidence for #356.

---

## Post-Judgment-Day Re-scope — Authoritative 2026-08-21

Judgment Day ended the twice-corrected design with `JUDGMENT: ESCALATED`. This section replaces the prior recommendation, work-unit forecast, and readiness claim. Source was re-audited at worktree `HEAD=80a943781cdb807051879273910a15d0bdb99e81`; no implementation is authorized by this exploration.

### Current State

#### Production truth versus tests

`GlobalExceptionFilter.resolveMessage` does not preserve producer prose in production. The exact public messages are:

| HTTP status | Production message | Invitation consequence |
|---|---|---|
| 401 | `Request failed` | Login/current-session prose is unavailable. |
| 403 | `Request failed` | Email-mismatch prose is unavailable. |
| 409 | `Request failed` | Member/registered/capacity prose is unavailable. |
| 410 | `Request failed` | Expired, revoked, and accepted invitations are indistinguishable by prose. |
| 404 | `Resource not found` | Not-found remains status-distinguishable, not domain-distinguishable. |
| 400 | `Invalid request payload` | Validation prose is unavailable. |

**Factual verdict on the production-prose bridge:** there is no production expired/accepted prose bridge to preserve. Both invitation views receive `Request failed` for real production 410 responses and fall through to their generic “Invitación no disponible” branch. The component tests manufacture `ApiError(410, '...expired...')` and `ApiError(410, '...accepted...')` directly; the API use-case tests assert pre-filter exception prose. Those tests describe mocked/component or internal behavior, not the deployed public response. Requiring a temporary prose bridge would preserve behavior production does not provide and would import invitation-actionability scope into #356.

Evidence: `apps/api/src/common/filters/global-exception.filter.ts:57-67,81-95`, `apps/api/test/errors.e2e-spec.ts:115-188`, `apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.tsx:547-621`, `apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx:521-594`, and their tests at team lines 169-203 and owner lines 159-243.

#### Consumer entrance inventory

The fresh audit found **17 active error-body parsing call sites** and **57 BFF upstream response forwarders**:

- **1 central direct-browser parser:** `apps/app-new/src/lib/api-client.ts`. It trusts `message`/`error`, retains the complete body in `ApiError.details`, and currently exposes neither `errorCode` nor `requestId`.
- **13 `response.json().catch(...)` parser call sites across 10 feature files:**
  - activity: `features/activity/api/service.ts` (1)
  - admin: `features/admin/api/service.ts` (1)
  - dashboard: `features/dashboard/api/service.ts` (1)
  - notifications: `features/notifications/api/service.ts` (1)
  - owner notifications: `features/owner/api/notifications.ts` (1)
  - owner services: `features/owner/api/service.ts` (3)
  - products: `features/products/api/service.ts` (2)
  - settings/contact: `features/settings/tenant-contact/api/service.ts` (1)
  - status change: `features/status-change-requests/api/service.ts` (1)
  - users/team administration: `features/users/api/service.ts` (1)
- **1 additional browser XHR parser:** `features/owner/api/service.ts:241-315` parses upload failures.
- **1 central server-side raw parser/forwarder:** `apps/app-new/src/lib/bff-api.ts:47-55`; `proxyJsonResponse` forwards the complete upstream JSON body and status.
- **1 bespoke server-side raw parser/forwarder:** `apps/app-new/src/app/api/tenants/me/movement-outcome-labels/[labelId]/route.ts:13-17`.
- The BFF has **57 upstream routes**: **56** use `proxyJsonResponse`; the bespoke movement-label DELETE is the 57th. Group counts are activity 1, admin 5, dashboard 1, document requests 2, document versions 1, notifications 4, owner 14, products 17, status-change requests 2, team 5, tenants/settings 4 (including the bespoke route), and users 1.
- Two additional server-only status adapters do not parse an error body: `apps/app-new/src/proxy.ts:78-115` consumes refresh success/cookies and treats failure as null; `apps/app-new/src/app/page.tsx:20-33` probes `/auth/me` and treats non-success as unauthenticated. Neither needs an envelope migration.

Classification:

| Surface | Browser-visible trust boundary | Server-only adapter | Raw forwarding | Central helper | Retains message/details | Needs code/requestId for #285 | Migration class |
|---|---:|---:|---:|---:|---|---|---|
| `lib/api-client.ts` | Yes, direct API | No | No | It is the direct helper | Message + full `details` | Yes: auth/invitation callers enter here | **SECURITY in #356**: remove raw retention; preserve only validated code/requestId and local generic copy. |
| 10 feature parser files / 14 call sites including XHR | Yes, after BFF | No | No | No; duplicated parsers | Usually message; settings retains unchecked `errorCode`; products can return a raw 404 body as success union | Not for #356; useful to later status-change/settings/product recovery | **Future ACTIONABILITY**. Exact API emission removes unsafe producer fields globally. |
| `lib/bff-api.ts` + 56 routes | Yes, because output reaches browser | Yes | Yes | Yes | Does not retain internally; forwards body; drops upstream response headers | Not required now; body already carries switched code/requestId | **No #356 rewrite required** once the producer emits the exact envelope. |
| Bespoke movement-label DELETE route | Yes | Yes | Yes | Uses `bffFetch`, bypasses `proxyJsonResponse` | Forwards whole error body | No | **Future convergence**, not a distinct security requirement after exact producer shaping. |
| Refresh proxy + landing auth probe | No error body reaches UI | Yes | No | No | None | Session children may later need richer authority | **No migration**. |

The global consumer migration proposed previously is therefore not required for SECURITY. The exact enabled API envelope protects every API route before any BFF or feature parser sees the body. Only the direct `api-client.ts` entrance must stop retaining arbitrary bodies now because it is the auth/invitation entrance named by #285 and issue #356 explicitly requires tolerant preservation of valid `errorCode`/`requestId`. Converging the other ten feature adapters and 57 routes would improve future ACTIONABILITY and consistency, but does not close an additional #356 leak after exact producer shaping.

#### Producer outcome inventory

None of the audited auth/team/owner decision points currently attaches an `errorCode`. Under the exact boundary, #356 should intentionally emit `REQUEST_FAILED` for all of them until the credential, session, and invitation-actionability children define their public semantics.

| Decision point / outcome | Status | Current production public message | Repository/lifecycle truth | Existing code | #356 disposition |
|---|---:|---|---|---|---|
| Register tenant: email exists | 409 | `Request failed` | `UsersRepository.findByEmail` returns user | None | `REQUEST_FAILED`; credential-enumeration child owns any future code. |
| Login: missing user, wrong password, or inactive user | 401 | `Request failed` | Lookup/password/status are intentionally collapsed | None | `REQUEST_FAILED`; preserve non-enumeration. |
| Current session: missing/invalid token or missing/inactive user | 401 | `Request failed` | `AuthGuard` / `GetCurrentUserUseCase` reject session | None | `REQUEST_FAILED`; session child owns actionable authority. |
| Team validate/accept: `notFound` | 404 | `Resource not found` | `ValidateTeamInvitationResult` / `AcceptTeamInvitationResult` | None | `REQUEST_FAILED`; later invitation child may add a code. |
| Team validate/accept: `expired` | 410 | `Request failed` | Explicit repository lifecycle result | None | `REQUEST_FAILED`; defer `INVITATION_EXPIRED`. |
| Team validate/accept: `revoked` | 410 | `Request failed` | Explicit repository lifecycle result | None | `REQUEST_FAILED`; defer revoked actionability. |
| Team validate/accept: `alreadyAccepted` | 410 | `Request failed` | Explicit repository lifecycle result | None | `REQUEST_FAILED`; defer accepted actionability. |
| Team accept: `alreadyMember` | 409 | `Request failed` | Explicit repository result | None | `REQUEST_FAILED`; defer member recovery. |
| Team accept: `userAlreadyExists` | 409 | `Request failed` | Explicit repository result | None | `REQUEST_FAILED`; defer registered-email recovery. |
| Team accept: `tenantUserLimitExceeded` | 409 | `Request failed` | Explicit repository capacity result | None | `REQUEST_FAILED`; defer capacity UX. |
| Team accept: `userNotFound` / session creation missing user | 401 | `Request failed` | Repository result or post-accept lookup failure | None | `REQUEST_FAILED`; do not invent invitation semantics here. |
| Team accept: direct current-user mismatch or repository `emailMismatch` | 403 | `Request failed` | Normalized current/session/repository email mismatch | None | `REQUEST_FAILED`; all three direct mismatch throws remain behaviorally unchanged. |
| Owner validate/accept: not found | 404 | `Resource not found` | Missing invitation, or existing-user lookup returns missing and collapses to `notFound` | None | `REQUEST_FAILED`; do not reinterpret repository ambiguity. |
| Owner validate/accept: expired, revoked, already accepted | 410 | `Request failed` | Status/timestamps or explicit repository result | None | `REQUEST_FAILED`; defer three actionable codes. |
| Owner accept: `userAlreadyExists` | 409 | `Request failed` | Existing user for register mode | None | `REQUEST_FAILED`; defer registered-email recovery. |
| Owner accept: direct or repository `emailMismatch` | 403 | `Request failed` | Current-user email, invitation email, owner email, or bound owner user disagree | None | `REQUEST_FAILED`; all mismatch checks remain intact. |
| Owner/team login mode: missing user or invalid password | 401 | `Request failed` | Credential result intentionally collapsed | None | `REQUEST_FAILED`; credential child owns future semantics. |
| Owner/team current-session mode: no session | 401 | `Request failed` | Optional current user absent | None | `REQUEST_FAILED`; session child owns future semantics. |
| Register/login/current-session DTO and required-field failures | 400 | `Invalid request payload` | Validation or explicit mode precondition | None | `REQUEST_FAILED`; no new code in #356. |

Exact producer paths: `auth/use-cases/{register-tenant,login,get-current-user}.use-case.ts`, `auth/guards/auth.guard.ts`, `team/team-invitations.repository.ts`, `team/use-cases/{validate-team-invitation,accept-team-invitation}.use-case.ts`, `owner-invitations/owner-invitations.repository.ts`, `owner-invitations/prisma-owner-invitations.repository.ts`, and `owner-invitations/use-cases/{validate-owner-invitation,accept-owner-invitation}.use-case.ts`.

#### Correlation and rollout reality

- `requestIdMiddleware` currently trims and accepts any incoming `x-request-id`, assigns it to `request.requestId`, and sets `x-request-id` on **every response, successful or failed**. Production tests pin attacker-controlled echo.
- The corrected intent is: generate one fresh server UUID v4 for every request, ignore every incoming ID, keep the existing success/error response header, and include the same ID in enabled **error bodies only**. Do not add a request ID to successful response bodies. The current spec sentence “MUST NOT add successful-response propagation” is inaccurate because success-header propagation already exists; it must be replaced with this explicit distinction.
- No production-only hook is needed. Observable seams already exist: a direct middleware unit test can assert incoming replacement, request property, header, and `next`; a direct filter test can use the existing mock `ArgumentsHost` plus a throwing `captureException` double; E2E can assert success headers and error header/body equality. Telemetry context is observable through the injected `SentryService` double.
- Telemetry containment stays narrow: wrap the filter’s existing sanitized capture call so a synchronous Sentry client failure cannot alter the HTTP response. This is boundary resilience, not a Sentry redesign.

Feasible evidence matrix, without #340 CI/root-package/cutover surfaces:

| State | Package evidence | App New evidence | API evidence |
|---|---|---|---|
| Switch unset | `pnpm --filter @viewpro/contracts test` proves require/import, exact 13-code preservation, `REQUEST_FAILED`, guard/envelope runtime exports. | Focused `src/lib/api-client.test.ts` proves malformed/legacy/extra-key tolerance, no `details`, valid code/requestId retention, generic local copy. | Focused config/middleware/filter/E2E tests prove unset equals false legacy shape, but IDs are server-owned and success headers remain present. |
| `PUBLIC_ERROR_ENVELOPE_ENABLED=false` | Same built package at the candidate SHA; no separate behavior. | Same focused parser evidence at the candidate SHA. | Explicit false run proves legacy body compatibility, server-owned IDs, telemetry containment, and no mixed exact envelope. |
| `PUBLIC_ERROR_ENVELOPE_ENABLED=true` | Same package bytes and catalog at the candidate SHA. | Same parser accepts exact bodies; invitation 410 remains the generic behavior production already has. | Exact-key tests prove `{statusCode,errorCode,requestId}` only, all 13 existing codes survive, unknown/missing becomes `REQUEST_FAILED`, 4xx/5xx forbidden fields never escape, and header/body/context/telemetry IDs agree. |

Run package/App/API typecheck plus these focused commands at one immutable full Git SHA. Record full SHA, package build result, App/API test transcripts, API deployment ID/image identity, App deployment ID, switch state, and smoke result in an external release record. Enable only on the already-evidenced deployment; changing code, build, or deployment invalidates the matrix. Switch-off rollback re-runs the false-state API smoke at that same deployment. This requires no `.github/workflows/ci.yml`, root package metadata, `scripts/production-cutover/**`, or #340 worktree access.

### Affected Areas

#### Kept in #356

- `viewpro-app/packages/contracts/src/index.ts` and `test/runtime-contract.spec.ts` — append `REQUEST_FAILED` to the complete 13-code catalog and export the guard/minimal envelope.
- `viewpro-app/apps/app-new/src/lib/api-client.ts` plus a focused new test — tolerant direct-browser parsing, no raw `details`, validated `errorCode`/`requestId`, HTTP status authority, local generic copy.
- `viewpro-app/apps/api/src/common/{filters/global-exception.filter.ts,errors/api-error-response.ts,middleware/request-id.middleware.ts}` — exact switched envelope, deny-by-default fallback, contained capture, and server-owned correlation.
- `viewpro-app/apps/api/src/{bootstrap/create-app.ts,config/app.config.ts,config/env.schema.ts}` — one default-false producer switch.
- `viewpro-app/apps/api/test/errors.e2e-spec.ts` and a focused middleware/filter/config seam — unset/false/true proof, exact privacy, known/unknown code handling, success-header behavior, and correlation.

#### Deferred from #356

- All new auth/team/owner public codes and producer annotations.
- Invitation expired/revoked/accepted/member/registered/mismatch UI recovery and code-based actions.
- Credential and current-session semantics.
- Convergence of the ten feature parser files, 56 central BFF routes, and one bespoke raw route.
- BFF propagation of upstream `x-request-id` headers; switched bodies already carry support IDs.
- Any Sentry redesign, #340/WU3a surface, CI/root metadata, or cutover tooling.

### Approaches

1. **A — Global API safety boundary; focused auth/invitation consumer adoption** — Keep the exact envelope/catalog/correlation capability global, migrate only `api-client.ts`, and let unknown auth/invitation outcomes intentionally become `REQUEST_FAILED` until later #285 children.
   - Pros: closes the security boundary for every route; honestly matches production; ships in two sub-400 PRs; unblocks later codes without importing their behavior; no parallel parser framework.
   - Cons: feature adapters remain inconsistent and non-actionable; later children must migrate only the consumers they need.
   - Effort: Medium

2. **B — Keep all-consumer/all-producer scope and add more work units** — Migrate all 17 parser sites/57 forwarders and annotate every auth/team/owner outcome now.
   - Pros: immediate convergence and broad actionability.
   - Cons: mixes security, architecture cleanup, credentials, sessions, invitation lifecycle, and UX; preserves mocked prose behavior; adds codes before owning children define semantics; materially exceeds #356 and the review budget.
   - Effort: High

3. **C — Split API boundary and App consumer convergence into new sibling capabilities** — Make the producer boundary one issue and create a new all-App parser convergence issue.
   - Pros: root classes are explicit if broad convergence is independently required.
   - Cons: a new sibling is unnecessary now: exact producer shaping already closes the security leak, while existing #285 children can adopt codes at their actual consumers. Creating a convergence issue now would add process and a parallel abstraction without a demonstrated closure need.
   - Effort: Medium/High

### Recommendation

**Choose Approach A.** #356 remains one global API envelope/correlation capability, but its consumer adoption is limited to the direct `api-client.ts` auth/invitation entrance and its catalog contains only the 13 established codes plus `REQUEST_FAILED`. No new auth/invitation producer code belongs in #356. The exact enabled envelope protects every route; later #285 children add domain codes and migrate only consumers that need actionable recovery.

This passes the over-engineering test: one switch, one catalog, one producer boundary, one direct consumer parser, no bridge, no new lifecycle state, no message inference, and no global parser migration whose only value is future actionability.

Recommended capability/PR DAG:

| Unit | Scope | Forecast | Dependency / rollback |
|---|---|---:|---|
| PR1 — runtime catalog + direct safe consumer | Contracts tuple/guard/envelope and runtime proof; `api-client.ts` removes `details`, validates code/requestId, and uses local generic copy; focused tests. No invitation component changes. | 220–310 | Starts at accepted planning base; deployable against legacy API; revert independently. |
| PR2 — exact producer boundary + correlation | Default-false switch; exact filter/type; fresh UUID middleware; bootstrap/config; capture containment; unset/false/true API tests and success/error correlation. No producer annotations. | 280–370 | Depends on PR1 catalog; immediate envelope rollback is switch-off; code rollback reverts PR2. |
| Operational enablement | Deploy PR1 then PR2 with switch unset/off; collect candidate-bound package/App/API evidence; set true on the same API deployment; smoke and record approval. | 0 repository lines | Depends on both PRs and exact SHA/deployment binding; switch false on failure. |

Every PR forecast is below 400 changed lines. Stop and re-slice before review if measured additions plus deletions reach 400.

### Statements That Must Be Replaced

- **Proposal:** replace the seven new auth/invitation codes, “shared safe parser for every active entrance,” four-stage bridge/annotation rollout, WU1-WU4 plan, and producer-message/lifecycle preservation criteria. State the 13 existing codes + `REQUEST_FAILED`, direct `api-client.ts` adoption, two PRs, and no prose bridge or producer annotations.
- **Specification:** replace the appended seven codes; the `api-client.ts`/`bff-api.ts`/products global-parser and legacy-410 bridge requirement; mandatory auth/team/owner annotations; the WU3/WU4 rollout language; and “MUST NOT add successful-response propagation.” Specify existing success header versus no success-body field.
- **Design:** replace the four-unit architecture, all-entrance parser claim, bridge data flow, producer mapping table, and WU3/WU4 evidence. Use the two-PR DAG and exact unset/false/true candidate-bound matrix above.

**Issue #356 body must be amended before proposal rewrite.** Its security intent and exclusions are sound, but “App New” must be narrowed to the direct auth/invitation consumer for current SECURITY, broad BFF/feature convergence must be named future ACTIONABILITY, and the delivery section must explicitly reject new auth/invitation codes/bridges in this child. The planned two-work-unit count can remain. No GitHub mutation was made during exploration.

### Risks

- A missing established code in the catalog would silently downgrade an existing domain outcome; exact 13-code set equality remains mandatory.
- Enabling before PR1 and the full matrix are deployed would remove legacy prose from direct clients without the safe parser, even though invitation 410 behavior is already generic in production.
- Off mode no longer restores attacker-controlled request IDs; this is intentional because correlation ownership is the security fix, while the switch rolls back only envelope shape.
- Feature/BFF adapters remain duplicated. Treating that cleanup as secretly required by #356 would recreate the rejected scope.
- New auth/invitation codes added opportunistically in PR2 would import later-child policy and invalidate this re-scope.

### Ready for Proposal

**Yes, after issue #356 is amended to match this scope.** Rewrite proposal/spec/design from this authoritative section; do not patch the rejected four-unit design. No tasks or implementation may start until the rewritten artifacts pass review.

### SDD Result Contract

- `status`: `success`
- `artifact_store`: `openspec`
- `artifact`: `openspec/changes/safe-public-error-boundary/exploration.md`
- `decision`: Approach A; global producer security, focused direct consumer, deferred actionability
- `production_prose_bridge`: false — production emits `Request failed` for 401/403/409/410
- `issue_amendment_required`: true
- `proposal_rewrite_ready`: true, after issue amendment
- `implementation_authorized`: false
- `next_recommended`: amend #356, then rewrite proposal/spec/design and re-run Judgment Day
- `skill_resolution`: `paths-injected` — `sdd-explore`, `systemic-issue-triage`, and `cognitive-doc-design`
