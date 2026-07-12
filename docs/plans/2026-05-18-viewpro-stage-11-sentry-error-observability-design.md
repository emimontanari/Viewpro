# Stage 11 Sentry Error Observability Design

Stage 11 Slice 4 adds minimal Sentry error observability for the pilot. The slice captures frontend and backend errors only when DSNs are configured, preserves safe debugging context like `requestId`, and avoids Replay, broad tracing, source-map upload, or sensitive payload capture.

## Decision

Implement Sentry error-only observability for web and API, disabled by default when DSNs are missing. Defer source maps, Replay, tracing, alerts, and CI release wiring to deploy/release slices.

## Scope

### In scope

- Add Sentry packages to `apps/web` and `apps/api`.
- Configure Next.js client/server/edge instrumentation as minimally as needed.
- Configure NestJS/API capture through the existing global exception path.
- Keep Sentry disabled when DSN env vars are empty or missing.
- Add safe context only:
  - `requestId`;
  - path/route;
  - status code;
  - runtime environment.
- Scrub or avoid unsafe context:
  - cookies;
  - authorization headers;
  - request bodies;
  - tokens/passwords;
  - document metadata/private user payloads.
- Add `.env.example` entries with empty DSN placeholders.
- Add tests for backend capture behavior and disabled/no-DSN behavior.
- Update roadmap/docs.

### Out of scope

- Source map upload.
- `SENTRY_AUTH_TOKEN`, org/project release upload configuration.
- Replay/session recording.
- Performance tracing beyond a disabled/default-zero setting.
- Alert rules.
- CI/CD release integration.
- User identity/PII enrichment.

## Architecture

| Area | Design |
|------|--------|
| Web package | Use `@sentry/nextjs` with minimal instrumentation files. |
| API package | Use Sentry SDK with a small local wrapper/service so tests can mock capture behavior. |
| Enablement | DSN-gated. If no DSN, initialization and capture are no-ops. |
| Frontend context | Capture framework errors only; do not send API response bodies or auth state. |
| Backend context | Capture unexpected/server errors from the global exception filter with safe tags/extras. |
| Request ID | Reuse existing `requestIdMiddleware` and attach `requestId` to Sentry events. |
| Sampling | Keep traces disabled/default `0` in this slice. |

## Backend capture policy

Capture should focus on operationally useful backend failures:

- capture non-HTTP/unexpected exceptions;
- capture HTTP `5xx` exceptions;
- do not capture normal `4xx` auth/validation/not-found denials by default.

The HTTP response body remains governed by the existing `GlobalExceptionFilter` sanitization rules. Sentry context must not reintroduce sensitive data that the response filter intentionally hides.

## Environment variables

API:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0
```

Web:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

No real DSN or token should be committed.

## Testing

Minimum coverage:

- API config test: no DSN means disabled/no-op.
- API exception filter test: unexpected/500 error calls capture with safe context.
- API exception filter test: 4xx validation/auth/not-found does not capture by default.
- Web typecheck/build confirms Sentry instrumentation compiles without requiring DSN.
- Existing API/web/root tests continue passing.

No test should call real Sentry.

## Verification

```bash
pnpm --filter @viewpro/api test -- errors.e2e-spec.ts app-config.spec.ts
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

## Acceptance criteria

- Backend and frontend Sentry are disabled when DSNs are missing.
- Backend captures unexpected/5xx errors with safe context only.
- Normal 4xx denials are not sent to Sentry by default.
- No cookies, auth headers, bodies, tokens, passwords, or private document metadata are captured.
- No source-map upload or CI release config is added.
