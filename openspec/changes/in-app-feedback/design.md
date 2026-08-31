# Design: Durable Authenticated In-App Feedback

## Decision summary

Implement `POST /api/feedback` as a tenant-member-only Nest boundary backed by two new PostgreSQL models: durable `FeedbackReport` records and short-lived `FeedbackSubmissionAttempt` reservations. A third guard reserves an attempt after authentication and membership succeed but before DTO pipes run. The reservation uses a PostgreSQL transaction-scoped advisory lock and database time, so the rolling five-per-ten-minutes rule remains exact across concurrent requests and multiple API processes. A successful use case persists the report first, then invokes one narrow best-effort notifier once; notification failure is sanitized and never changes the `201` response.

The authenticated Next.js dashboard mounts a client-only floating `FeedbackWidget` without changing navigation. Its service derives `window.location.pathname` and obtains an optional correlation ID only from a private, browser-memory provenance slot populated by `bffRequest` from canonical request IDs on prior BFF responses. The slot exposes a getter and a clear-only lifecycle function, but no setter; the widget clears it on authenticated mount and unmount so client-side user/layout transitions cannot inherit another user's correlation ID. There is no request-ID input and no server ledger.

No auth, role, middleware, navigation configuration, sidebar, owner-portal, or Sentry behavior is changed.

## Existing patterns used

| Concern | Existing code-grounded pattern | Design use |
|---|---|---|
| Authentication | `AuthGuard` and `CurrentUser` in `apps/api/src/auth/guards/auth.guard.ts` and `apps/api/src/auth/decorators/current-user.decorator.ts` | Derive `userId` and email from the verified access token; never accept identity fields. |
| Tenant membership | `TenantMembershipGuard`, `CurrentTenant`, and `TenantContextStore` in `apps/api/src/tenant-context/` | Require `x-tenant-id`, active membership/user/tenant, and use only `tenant.tenantId`. |
| Tenant isolation | `TENANT_OWNED_MODELS` and its schema parity test in `apps/api/src/database/tenant-isolation.extension.ts` and `tenant-isolation.registry.spec.ts` | Register both new direct-`tenantId` models; repositories also include explicit tenant predicates/data. |
| Validation | Global `ValidationPipe` in `apps/api/src/bootstrap/create-app.ts` has `whitelist`, `forbidNonWhitelisted`, and `transform` enabled | Reject spoofed/unknown identity properties and validate exact DTO boundaries. |
| Throttling | `ThrottlerModule`, `AuthThrottlerGuard`, and in-memory default storage in `apps/api/src/app.module.ts` and `apps/api/src/auth/guards/auth-throttler.guard.ts` | Do **not** use it for feedback: its process-local fixed-TTL counters cannot truthfully provide a shared exact rolling pair quota. |
| Public errors | `GlobalExceptionFilter` and `@viewpro/contracts` public envelope | Preserve status/catalog semantics and sanitized Sentry capture; no backend prose controls frontend copy. |
| Email | `createResendClient`/`ResendClient` in `apps/api/src/email/resend-email-sender.ts` and HTML escaping in `email/templates/owner-notification-email.ts` | Reuse only the low-level Resend client construction pattern. Do not extend/reuse invitation/no-op sender methods whose logs include recipients. |
| BFF | `bffFetch`, `proxyJsonResponse`, `bffRequest`, and `BffError` in `apps/app-new/src/lib/` | Proxy the backend `x-request-id`, validate it in the browser, and retain only the latest proven response ID in memory. |
| Authenticated layout | `DashboardLayout` in `apps/app-new/src/app/dashboard/layout.tsx` | Add one floating widget sibling inside the existing layout; do not touch `AppSidebar`, middleware, or nav config. |
| UI primitives | `Dialog`, `Field`, `RadioGroup`, `Textarea`, `Button`, and `Icons` under `apps/app-new/src/components/` | Build an accessible controlled form; all icons come from `@/components/icons`. |

## Architecture and data flow

```text
browser FeedbackWidget
  -> submitFeedback({ type, description })
     derives window.location.pathname
     reads latest proven request ID (optional; no setter/user field)
  -> POST /api/feedback (Next BFF route)
     bffFetch adds auth cookie + selected x-tenant-id
  -> POST /api/feedback (Nest)
     AuthGuard
     -> TenantMembershipGuard (sets validated tenant context/CLS)
     -> FeedbackRateLimitGuard (atomic attempt reservation)
     -> global DTO validation
     -> SubmitFeedbackUseCase
        -> FeedbackRepository.create (durable commit)
        -> FeedbackNotifier.notify once
           success or deterministic non-production no-op
           failure -> allowlisted diagnostic only, swallowed
     <- 201 { accepted: true }
```

The report ID and notification details never appear in the public success response. Existing exception filtering produces the established safe error shape.

## Domain and persistence design

### Prisma models

Add `FeedbackType { ERROR SUGGESTION }` and these relations to `apps/api/prisma/schema.prisma`:

- `User.feedbackReports`, `User.feedbackSubmissionAttempts`
- `Tenant.feedbackReports`, `Tenant.feedbackSubmissionAttempts`

`FeedbackReport` fields:

| Field | Prisma shape | Reason |
|---|---|---|
| `id` | `String @id @default(uuid())` | Internal durable report reference. |
| `tenantId` | `String` | Direct tenant ownership and isolation registry participation. |
| `userId` | `String` | Server-derived submitter. |
| `type` | `FeedbackType` | Exactly the two approved categories at DB and DTO boundaries. |
| `description` | `String` | Plaintext only; never rendered as HTML. Migration uses `TEXT`. |
| `pathname` | `String?` | Optional pathname; migration uses `VARCHAR(512)`. |
| `requestId` | `String?` | Optional canonical UUIDv4 correlation value; migration uses PostgreSQL `UUID`. |
| `createdAt` | `DateTime @default(now())` | Durable acceptance timestamp and notification field. |

Relations reference `Tenant` and `User`; use the repository's prevailing tenant-owned `onDelete: Cascade` behavior. Add `@@index([tenantId, createdAt])` and `@@index([tenantId, userId, createdAt])` for tenant retention/report retrieval and pair attribution. Map to `feedback_reports`.

`FeedbackSubmissionAttempt` fields are `id`, `tenantId`, `userId`, and `attemptedAt @default(now())`, with tenant/user relations, `@@index([tenantId, userId, attemptedAt])`, and table `feedback_submission_attempts`. It contains no feedback prose or request context. It is operational quota state, not a report.

Create `apps/api/prisma/migrations/<timestamp>_add_feedback/migration.sql` with enum, tables, foreign keys, and indexes. Add both Prisma model names to `TENANT_OWNED_MODELS`; the existing schema-registry parity test must fail until both are registered.

### Repository boundaries

`apps/api/src/feedback/feedback.repository.ts` defines two tokens/interfaces:

- `FeedbackRateLimitRepository.reserveAttempt({ tenantId, userId }): Promise<'allowed' | 'limited'>`
- `FeedbackRepository.create(input): Promise<PersistedFeedbackForNotification>`

`PersistedFeedbackForNotification` contains only the approved report fields plus selected `user.email` and `tenant.name`. `PrismaFeedbackRepository` implements both interfaces; the module may bind one class to both tokens with `useExisting` to keep one implementation instance.

`create` performs one Prisma `feedbackReport.create` with explicit server-derived `tenantId`/`userId` and selects the report fields, `user.email`, and `tenant.name`. No feedback list/read endpoint is introduced.

### Exact rolling-limit algorithm

The existing Nest throttler is unsuitable because its default storage is per process, its configured tracker is IP/path rather than the authenticated pair, and its TTL behavior is not a shared exact rolling event set. Feedback therefore uses PostgreSQL.

`reserveAttempt` runs one database transaction:

1. Build a lock key from the already validated `tenantId:userId` pair.
2. Acquire `pg_advisory_xact_lock(hashtextextended(key, 0))` using parameterized `$queryRaw`. Hash collisions can serialize unrelated pairs briefly but cannot share their counts or reject them.
3. Read `CURRENT_TIMESTAMP` from PostgreSQL; application clocks do not define the window.
4. Delete expired attempt rows for the active tenant where `attemptedAt <= dbNow - interval '10 minutes'`.
5. Count this exact pair where `attemptedAt > dbNow - interval '10 minutes'`.
6. If count is at least five, return `limited` without inserting a sixth row. Otherwise insert one row with `attemptedAt = dbNow` and return `allowed`.

The advisory transaction lock serializes count-plus-insert for the pair across connections, concurrent requests, pods, and processes. The sixth of six simultaneous requests therefore cannot race through. Different pairs use independent predicates and quotas even if a hash collision temporarily serializes execution.

An **attempt** is an HTTP submission that reaches `FeedbackRateLimitGuard` after both `AuthGuard` and `TenantMembershipGuard` succeed. Because guards run before Nest parameter pipes, authorized requests with unsupported fields, invalid DTO values, persistence failures, and notification outcomes consume one slot. Malformed JSON rejected by body parsing, unauthenticated requests, and failed membership requests do not reach the pair guard and do not consume a slot. A rejected sixth request does not insert another attempt row. This definition is testable and matches “subject to its own authentication and input rules” without trusting client identity.

## API boundary and use case

### Route and guards

Add `FeedbackController` with:

```ts
@Controller('feedback')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, FeedbackRateLimitGuard)
export class FeedbackController {
  @Post()
  submit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() body: SubmitFeedbackDto,
  ) { /* use case */ }
}
```

No `PermissionGuard` or role permission is added: the approved audience is every active tenant member, and `TenantMembershipGuard` already proves that contract. Owner controllers/modules do not import `FeedbackModule`.

The guard reads only `request.user.id` and `request.tenantContext.tenantId`, which preceding guards populate. `limited` throws HTTP 429. A new public error code is unnecessary: the UI can distinguish the stable `429` status, while public-envelope mode safely maps unrecognized/no codes to existing `REQUEST_FAILED`. This avoids expanding the frozen contracts package.

### DTO validation

`SubmitFeedbackDto` has only `type`, `description`, `pathname?`, and `requestId?`:

- `type`: `@IsEnum(FeedbackType)`.
- `description`: `@IsString()`, `@MinLength(10)`, `@MaxLength(2000)`. Do not trim, parse, or render it; length is the exact submitted string length.
- `pathname`: optional string, maximum 512, matching `^/[^?#]*$`. This admits `/`, requires pathname form, and rejects literal query/hash characters rather than stripping them.
- `requestId`: optional string matching lowercase canonical UUIDv4 exactly: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`. `@IsUUID('4')` alone is not used because it can accept non-canonical casing.

With `forbidNonWhitelisted`, `userId`, `tenantId`, recipient, or any other spoof field yields 400 and can never influence persistence. It still consumes an authorized pair's reserved attempt because the rate guard precedes DTO pipes.

### Responses and failures

| Outcome | HTTP/public behavior | Durable effect |
|---|---|---|
| Accepted, notifier succeeds/no-ops/fails | `201 { "accepted": true }` | Exactly one committed report. |
| DTO/unknown field invalid | Existing validation `400` safe envelope | No report; authorized attempt consumed. |
| Missing/invalid session | Existing `401`, catalog `SESSION_EXPIRED` where enabled | No attempt and no report. |
| Missing/inactive/non-member tenant | Existing `403` behavior | No attempt and no report. |
| Sixth active-window attempt | `429`; frontend uses status only | No sixth attempt row and no report. |
| Durable create fails | Existing sanitized `500`/`REQUEST_FAILED` path | No accepted report; reserved attempt remains consumed. |

`SubmitFeedbackUseCase.execute(tenant, user, dto)` calls `FeedbackRepository.create` and does not catch persistence errors. Only after the create promise resolves does it call `FeedbackNotifier.notify` exactly once. It catches notification failure, writes one sanitized event, and returns `{ accepted: true }`; there is no transaction spanning notification, rollback, delivery retry, or duplicate report creation.

## Notification and configuration

### Narrow adapter and template

Do not add feedback methods to `EmailSender`, `NoopEmailSender`, invitation templates, or `RecordingEmailSender`: existing no-op methods log recipient addresses and provider exceptions can contain prose. Instead add a feedback-only port under `apps/api/src/feedback/notification/`:

```ts
interface FeedbackNotifier {
  notify(input: FeedbackNotification): Promise<void>
}
```

`FeedbackNotification` contains exactly: report type, description, pathname, createdAt, report/user/tenant IDs, optional requestId, user email, and tenant name. Recipient configuration is constructor-private to the production adapter and cannot come from the controller/use case.

`renderFeedbackEmail` creates text and escaped HTML from only those fields. Reuse the escaping approach, not the owner/invitation template. Markup-looking descriptions are escaped in HTML and literal in text. Static labels/subject introduce no extra operational data.

Production uses a narrow `ResendFeedbackNotifier` built with `createResendClient`. It invokes `emails.send` once with one string `to` value. It immediately maps any returned/thrown provider value to this closed diagnostic vocabulary and discards raw prose:

- category/code `rate_limited / RESEND_RATE_LIMITED`
- category/code `unavailable / RESEND_UNAVAILABLE`
- category/code `rejected / RESEND_REJECTED`
- fallback `unknown / FEEDBACK_NOTIFICATION_UNKNOWN`

The use case catches only the sanitized error shape; an unknown throw is mapped to the fallback. Its `Logger.warn` payload has exactly `{ reportId, timestamp, category, code }`. It never passes the exception object or notification input to Logger/Sentry. Tests must inspect serialized log arguments for absence of description, recipient, user email, tenant name, and injected provider prose.

`NoopFeedbackNotifier` is deterministic, invokes no provider, emits no recipient/content log, and resolves once. It is selected whenever `NODE_ENV` is `development` or `test`, regardless of incidental Resend settings, preventing accidental local/test delivery.

### Environment and readiness

Extend `EnvironmentVariables` in `apps/api/src/config/env.schema.ts` with optional, trimmed `FEEDBACK_RECIPIENT_EMAIL` plus `@IsEmail()`. In `assertProductionSecurity`, production requires:

1. a non-empty valid single recipient; comma/semicolon lists fail email validation; and
2. `RESEND_API_KEY`, because production must not fall through to no-op notification.

Add `app.email.feedbackRecipient` in `apps/api/src/config/app.config.ts` and document one `FEEDBACK_RECIPIENT_EMAIL=` entry in `apps/api/.env.example`. `FeedbackModule` chooses the adapter from `app.nodeEnv`, `app.email.apiKey`, `app.email.fromAddress`, and `app.email.feedbackRecipient`.

Fail-fast env validation is the readiness contract: a production process missing recipient/transport cannot boot and therefore cannot become ready. `HealthController.getReadiness` remains database-only and needs no edit; a running production process has already passed config validation. Non-production missing recipient is explicitly operational as no-op, not silently inherited by production.

## Request-ID provenance through the BFF

### Current gap

`apps/app-new/src/lib/bff-client.ts` validates `errorCode` but drops `requestId`; `proxyJsonResponse` in `bff-api.ts` also rebuilds responses without forwarding the backend `x-request-id`. The backend already issues canonical UUIDs and sets that header in `requestIdMiddleware`.

### Minimal provenance mechanism

1. Change `proxyJsonResponse` to copy only a canonical lowercase UUIDv4 backend `x-request-id` into the returned `NextResponse` header. It still proxies the JSON/status as today.
2. In `bff-client.ts`, keep a module-private `latestApplicationRequestId: string | undefined`. Export `getLatestApplicationRequestId()` and a clear-only `clearLatestApplicationRequestId()` that can only assign `undefined`; export no setter or value-taking mutation API. The getter returns `undefined` during SSR.
3. After each browser-side `fetch` resolves, validate both the response header and a JSON body's `requestId`; prefer the canonical header, otherwise use the canonical body value. Record only when `typeof window !== 'undefined'`, preventing SSR requests from populating shared module state. Invalid, uppercase, non-v4, and arbitrary values are ignored. The value is private browser memory only; reload clears it, while client-side logout or user switching is handled explicitly by the widget lifecycle rather than assumed to reload the bundle.
4. On authenticated `FeedbackWidget` mount, a client effect calls `clearLatestApplicationRequestId()` before that widget can intentionally reuse correlation state. The effect cleanup calls it again on unmount. Thus a prior authenticated layout is cleared when it leaves, a newly mounted authenticated layout starts empty even if prior cleanup was skipped, and IDs captured by subsequent `bffRequest` calls during the current mount remain available until unmount.
5. `BffError` may retain a validated `requestId` for correlation tests/diagnostics but never exposes server prose. The private provenance slot is populated only by `bffRequest` itself, not by a form prop, URL, storage, exported setter, or user input.
6. `features/feedback/api/service.ts` accepts only `{ type, description }`. At invocation it derives `window.location.pathname` and reads `getLatestApplicationRequestId()` before calling `bffRequest`. It conditionally adds that exact ID. The feedback UI has no request-ID field and cannot supply an arbitrary ID through the typed service.

This satisfies the approved UI provenance contract for prior application responses without claiming server ownership verification. Direct API callers can still supply any canonical UUIDv4, exactly as the V1 spec permits; the API performs shape validation only and creates no ledger.

## Authenticated floating UI

Add `FeedbackWidget` as a client component and mount it from `DashboardLayout` as a sibling after the existing dashboard content structure. Do not edit `AppSidebar`, `Header`, `proxy.ts`, nav config, roles, or middleware.

The trigger is a fixed 44px button using `Icons.chat`, with an `aria-label`/title in Spanish, `z-40`, `right-4`, and `bottom-[calc(1rem+env(safe-area-inset-bottom))]`; this keeps it reachable on mobile and clear of navigation. The modal uses existing Radix-backed `Dialog` focus trapping and close behavior.

A mount-only client effect clears the private request-ID slot and returns the same clear-only function as its unmount cleanup. This lifecycle boundary is independent of whether logout, user switching, or authenticated-layout replacement performs a full page reload.

The widget owns controlled local state:

- `open`
- `type: 'ERROR' | 'SUGGESTION'`
- `description`
- field validation text
- phase: `editing | submitting | success | retryable-error | rate-limited`

Exactly two radio options are rendered. The textarea uses existing `Field`/`Textarea` primitives, `minLength=10`, `maxLength=2000`, visible character count, help text, and associated errors. Submitted content is never inserted with `dangerouslySetInnerHTML`.

While submitting, controls and close-triggered duplicate actions are disabled, the button uses `Icons.spinner`, and repeated submit events are ignored. On `201`, show durable-acceptance copy with `Icons.circleCheck`; do not promise email delivery. On failure, preserve type and description and render an explicit retry button. Closing and reopening a failed dialog also preserves content; only success completion or an explicit “discard” action resets it.

Copy selection is a pure function of structured data:

- status `429` -> rolling-window guidance and preserved retry state;
- status `401` or `errorCode === 'SESSION_EXPIRED'` -> session guidance;
- all other statuses/catalog codes -> safe generic retry guidance.

No branch reads `error.message`, response prose, provider text, or substring matches. Status/error copy is announced through `aria-live="polite"`; errors use `role="alert"`. All visual icons (`chat`, `send`, `spinner`, `circleCheck`, `warning`) come through `Icons` in `@/components/icons`.

## Strict-TDD strategy

Every implementation work unit follows RED -> GREEN -> TRIANGULATE -> REFACTOR and keeps tests with the code. RED/GREEN command output and the temporary mutation evidence below must be recorded in the later apply/verification artifact. Existing 48 API and 29 frontend tests remain the baseline floor.

### Test seams

- Inject repository tokens into the guard/use case for deterministic unit ordering and failure tests.
- Inject `FEEDBACK_NOTIFIER`; use a fake that records calls or rejects with hostile provider prose.
- Keep notification rendering and failure mapping pure for exact allowlist/escaping tests.
- Exercise `PrismaFeedbackRepository.reserveAttempt` against the real PostgreSQL test database for transaction/concurrency claims; mocks cannot prove multi-process correctness.
- Test the widget with Testing Library and a mocked feedback service, while testing pathname/request-ID construction separately in the service.
- Populate provenance in tests only through `bffRequest` responses. The production lifecycle API is clear-only: no setter, value-taking reset, form field, or service argument can inject a request ID.

### Required matrix

| Area | Executable proof |
|---|---|
| Authorization | Unauthenticated is 401 with no attempt/report; a normally valid authenticated submission succeeds only when `AuthGuard` decodes/populates the token context; active token plus absent/wrong/deactivated membership is 403 with no attempt/report; owner routes/layout remain unchanged. |
| Identity spoofing | Bodies containing `userId`, `tenantId`, email, or recipient are 400 and never affect stored attribution; valid report IDs match current server user/tenant. |
| Tenant isolation | Registry parity includes both models; explicit repository predicates; reports/attempts for T1 and T2 do not cross; CLS isolation integration rejects cross-tenant reads. |
| Inputs | Both types; unsupported/case variants; description lengths 9/10/2000/2001; inert script-looking text; pathname missing, `/`, 512/513, `?`, `#`, and missing leading slash; canonical UUIDv4 versus uppercase/non-v4/malformed. |
| Attempt definition | An authorized invalid DTO and a persistence failure consume slots; unauthenticated/non-member calls do not; notification result does not alter quota. |
| Rolling limit | Five allowed and sixth 429; a row exactly at cutoff expires; user/tenant pairs are independent; DB clock is used. |
| Concurrency | Six `Promise.all` reservations for one pair against PostgreSQL yield exactly five allowed/one limited and five rows; concurrent distinct pairs each receive five. Run with a pool so calls use independent transactions. |
| Persistence/order | Repository failure prevents notifier call and returns sanitized 500; successful create resolves before notifier starts; selected relation data is approved-only. |
| Provider failure | One notifier invocation; rejection leaves one report and returns 201; no rollback/retry/duplicate. |
| Redaction | Hostile description/address/name/provider prose is absent from logger arguments and public result; log object keys equal reportId/timestamp/category/code and values belong to allowlists. |
| Configuration | Production missing/empty/malformed/multiple recipient fails validation; production missing Resend key fails; one email passes; development/test missing recipient selects no-op; `.env.example` contains one variable. |
| BFF provenance | `proxyJsonResponse` forwards only canonical backend header; `bffRequest` records canonical header/body in browser only and ignores invalid values; SSR getter/capture remains empty; capture during one authenticated widget mount is observable to the service, unmount clears it, and remount starts empty. Export-surface and UI/service tests prove there is no public setter, value-taking mutation, request-ID form input, or request-ID service argument. |
| UI | Floating trigger, exact choices, 10–2000 help/count, validation, pathname service call, duplicate-submit prevention, spinner, durable success, provider-failure-as-success, preserved generic retry, preserved 429 guidance, close/reopen preservation, explicit reset, keyboard/focus labels, mobile placement. |
| Error branching | Same status/errorCode with different backend messages produces identical copy; 429 differs from generic failure; unexpected body details never render. |
| Regression | Full API/frontend suites remain green in addition to focused tests. |

### Deliberate guard falsification after GREEN

After each guard is green, intentionally apply each mutation **one at a time**, run the named focused tests and capture the expected failure, then restore the implementation and rerun green before continuing:

1. Remove/bypass `AuthGuard` on `FeedbackController`; run the focused normally valid authenticated-success test. It must fail because the access token is no longer decoded into/populates `request.user`, even if `TenantMembershipGuard` is the component that ultimately rejects or cannot proceed. Keep the unauthenticated 401/no-write test as coverage, but do not use it alone as proof of `AuthGuard` because membership enforcement may still block that request.
2. Remove/bypass `TenantMembershipGuard`; the non-member/no-write and server-tenant attribution tests must fail.
3. Make `FeedbackRateLimitGuard` always allow; fifth/sixth and concurrent-six tests must fail.
4. Remove `FeedbackReport` or `FeedbackSubmissionAttempt` from `TENANT_OWNED_MODELS`; schema-registry parity must fail for each mutation.
5. Replace server-derived IDs with body values in the controller/use-case seam; spoofing/attribution tests must fail (the mutation may require temporarily admitting the fields solely for the mutation run, then restoring both DTO and implementation).
6. Remove the pathname query/hash or canonical-v4 validator; corresponding boundary tests must fail.
7. Move notification before repository create or stop swallowing notifier rejection; ordering/provider-degradation tests must fail.
8. Log the caught provider object or notification input; redaction key-set/content tests must fail.
9. Permit production no-op or multiple recipient parsing; production config tests must fail.
10. Add a public request-ID setter/value-taking mutation, omit either widget mount/unmount clear, or allow form/service callers to pass `requestId`; export-surface, capture-unmount-remount, SSR-empty, and UI/service provenance tests must fail.
11. Branch UI copy on `error.message`; equal-status/different-message tests must fail.

These are temporary local mutations, never commits. The verification record must identify mutation, failing test, restoration, and final green result; a test that stays green under its mutation is inadequate and must be strengthened.

## Likely file map

### API/data

- Modify `apps/api/prisma/schema.prisma`.
- Add `apps/api/prisma/migrations/<timestamp>_add_feedback/migration.sql`.
- Modify `apps/api/src/database/tenant-isolation.extension.ts` (registry only).
- Existing `apps/api/src/database/tenant-isolation.registry.spec.ts` should require no product change; extend isolation integration coverage where needed.
- Add `apps/api/src/feedback/dto/submit-feedback.dto.ts`.
- Add `apps/api/src/feedback/feedback.repository.ts`.
- Add `apps/api/src/feedback/prisma-feedback.repository.ts`.
- Add `apps/api/src/feedback/feedback-rate-limit.guard.ts`.
- Add `apps/api/src/feedback/use-cases/submit-feedback.use-case.ts`.
- Add `apps/api/src/feedback/feedback.controller.ts`.
- Add `apps/api/src/feedback/feedback.module.ts`.
- Add `apps/api/src/feedback/notification/feedback-notifier.port.ts`.
- Add `apps/api/src/feedback/notification/feedback-notifier.adapters.ts`.
- Add `apps/api/src/feedback/notification/feedback-email.template.ts`.
- Modify `apps/api/src/app.module.ts` to import `FeedbackModule`.
- Modify `apps/api/src/config/env.schema.ts`, `apps/api/src/config/app.config.ts`, and `apps/api/.env.example`.
- Add focused specs under `apps/api/src/feedback/**/__tests__/` and `apps/api/test/feedback.e2e-spec.ts`; extend config tests in `apps/api/src/config/__tests__/env.schema.spec.ts` and `apps/api/src/config/app.config.spec.ts`.

### Authenticated app/BFF

- Add `apps/app-new/src/app/api/feedback/route.ts` and `route.test.ts`.
- Modify `apps/app-new/src/lib/bff-api.ts`; add `apps/app-new/src/lib/bff-api.test.ts` for header allowlisting.
- Modify `apps/app-new/src/lib/bff-client.ts` and `apps/app-new/src/lib/__tests__/bff-client.spec.ts`.
- Add `apps/app-new/src/features/feedback/api/types.ts`, `service.ts`, and `service.test.ts`.
- Add `apps/app-new/src/features/feedback/components/feedback-widget.tsx` and `feedback-widget.test.tsx`.
- Modify only `apps/app-new/src/app/dashboard/layout.tsx` for mounting; add a focused layout assertion if the widget test cannot prove placement.
- `apps/app-new/src/components/icons.tsx` already exposes all selected icons, so no icon-file change is expected.

Explicitly excluded: `apps/app-new/src/config/nav-config.ts`, `src/proxy.ts`, all sidebar files, auth/role/permission definitions, middleware, owner layout/routes, and issue #307 surfaces.

## Review workload and auto-chain forecast

The complete feature is forecast at roughly 1,550–1,950 authored changed lines including tests and migration, so `delivery_strategy: auto-chain` must produce multiple PRs targeting `develop`. Keep every PR at or below 400 changed lines and keep code plus its tests together; do not slice by file type.

| Work unit / candidate chained PR | Behavior delivered with tests | Forecast |
|---|---|---:|
| 1. Atomic tenant-pair quota foundation | Schema/migration, isolation registration, repository reservation, cutoff/pair/concurrency integration tests | 330–390 |
| 2. Safe feedback persistence boundary | DTO, report create repository, route/module/guards, auth/spoof/input/tenant/persistence e2e tests | 350–400 |
| 3. Best-effort notification and production config | Narrow template/adapters, use-case ordering, allowlisted logging, no-op/fail-fast config, provider/config tests | 330–390 |
| 4. Provenance-preserving BFF submission | Feedback BFF route/service, request-ID header propagation/browser slot, pathname/provenance/route tests | 300–370 |
| 5. Authenticated floating feedback flow | Widget, dashboard-layout mount, state/copy/accessibility/mobile tests | 330–390 |
| 6. Cross-slice hardening if needed | Remaining real-DB isolation/e2e mutation coverage and regression evidence only when it accompanies a concrete guard hardening change | 180–300 |

If a unit forecasts above 400 after exact task decomposition, split it at a behavior seam (for example, quota repository before HTTP integration), never into “tests only” or “models only.” Each unit records strict-TDD evidence and is independently revertible. Follow the established Viewpro convention: each work unit gets its own worktree and branch, refreshed from `origin/develop` only after its predecessor merges, and every PR targets `develop`; no PR targets `main`. This design does not choose a different chain strategy on the user's behalf, and task execution may still require the orchestrator's explicit chain-strategy gate.

## Rollout and rollback

1. Merge chained PRs to `develop` in dependency order and keep full baseline suites green at each step.
2. Apply the additive feedback migration before enabling UI traffic. Verify both tables, enum, indexes, and generated Prisma client.
3. Configure exactly one production `FEEDBACK_RECIPIENT_EMAIL` plus existing Resend/from settings. Validate production boot failure with missing/malformed values and non-production no-op behavior.
4. Deploy frontend through the normal pipeline. Dokploy backend deployment remains a manual operator action; verify migration completion and readiness before routing traffic.
5. Smoke-test one authorized durable submission, one non-member rejection, and notification degradation without exposing report content in diagnostics.

For application rollback, remove/disable the dashboard widget and Nest route/module together, then remove the notifier wiring. Do not roll back by dropping `feedback_reports`; accepted records remain under normal retention. The attempt table may remain harmlessly additive and expire through lazy cleanup. A later schema removal requires a separate data-retention decision and reviewed migration. Existing Sentry, auth, owner portal, and navigation remain operational throughout.

## Architecture risks

| Risk | Control |
|---|---|
| Advisory-lock implementation is replaced by count-then-insert | Real PostgreSQL concurrent-six test plus deliberate rate-guard/repository mutation evidence. |
| Attempt semantics surprise users after invalid input | Definition is explicit: authorized requests reaching the guard consume quota; UI validates locally to avoid waste. |
| Notification exception leaks prose through generic infrastructure | Dedicated adapter/error vocabulary and exact logger key-set tests; do not reuse invitation/no-op logging. |
| Browser provenance leaks across users during client-side logout, user switching, or authenticated-layout replacement | Capture only in private browser memory, keep SSR reads/capture empty, expose only a getter and clear-only lifecycle function with no setter, and clear on both authenticated widget mount and unmount; do not rely on logout reloading the bundle. |
| BFF transport-generated errors masquerade as application IDs | Only canonical IDs actually present in a backend-proxied header/body are captured; generated 502/504 bodies contain none. |
| Cross-cutting diff exceeds review budget | Six behavior-oriented auto-chain units, each forecast below 400 lines, all targeting `develop`. |
