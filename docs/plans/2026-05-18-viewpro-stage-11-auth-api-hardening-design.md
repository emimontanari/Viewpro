# Stage 11 Auth/API Public Hardening Design

Stage 11 Slice 2 hardens ViewPro's public API boundary before the pilot. The slice protects auth endpoints from brute-force traffic, makes CORS configuration explicit, and reduces production error leakage while preserving request IDs for debugging.

## Decision

Use NestJS-native throttling for public auth endpoints, validated multi-origin CORS configuration, and production-only error sanitization in the global exception filter.

## Scope

### In scope

- Add `@nestjs/throttler` to the API.
- Rate-limit only public auth endpoints:
  - `POST /api/auth/login`
  - `POST /api/auth/register-tenant`
  - `POST /api/auth/refresh`
- Make auth throttling thresholds configurable by env.
- Support explicit allowed CORS origins while keeping `credentials: true`.
- Fail fast in production if CORS is empty or wildcard-like.
- Sanitize production error responses so unexpected internals and overly detailed validation messages are not leaked.
- Keep `requestId`, `statusCode`, `path`, and timestamp in error payloads.
- Add focused API tests for throttling, CORS, and production sanitization.
- Update `.env.example` and roadmap docs.

### Out of scope

- Sentry.
- Redis/shared throttling storage.
- Global API throttling.
- WAF/proxy rules.
- Frontend changes.
- Deploy/staging configuration.

## Architecture

| Area | Design |
|------|--------|
| Rate limiting | Register `ThrottlerModule` in the API and apply route-level `@Throttle()` decorators to auth endpoints. |
| Defaults | Use conservative testable defaults; allow env overrides for limit/window. |
| Storage | Use default in-memory throttler for this slice; document that multi-instance production needs shared storage later. |
| CORS | Parse `CORS_ORIGIN` as comma-separated allowed origins. Keep credentials enabled. |
| Production CORS | Reject empty, `*`, or unsafe wildcard config when `NODE_ENV=production`. |
| Error filter | Inject/read environment mode and sanitize details only in production. |
| Error payload | Preserve the API's existing response contract shape, especially `requestId`. |

## Rate-limit policy

Initial defaults should protect login without punishing normal use:

| Endpoint | Suggested default |
|----------|-------------------|
| `login` | 5 attempts / 60 seconds |
| `register-tenant` | 3 attempts / 60 seconds |
| `refresh` | 20 attempts / 60 seconds |

These should be configurable. If one env pair is simpler for Slice 2, use a shared auth limit/window and document the tradeoff; route-specific thresholds can follow later.

## CORS behavior

- `CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3100` allows both origins.
- Allowed origins receive `access-control-allow-origin` matching the request origin and `access-control-allow-credentials: true`.
- Disallowed origins do not receive credentialed CORS approval.
- Requests without an `Origin` header are allowed so same-origin/server-to-server callers are not blocked by browser CORS policy.
- Production must not boot with missing `CORS_ORIGIN`, empty entries, `*`, or wildcard-like origins such as `https://*.example.com`.

## Error sanitization

Development/test responses can keep useful details for debugging and existing tests.

Production responses should:

- keep `statusCode`, `error`, `path`, `timestamp`, `requestId`;
- return generic messages for 500s;
- avoid leaking route internals like `Cannot GET /api/...`;
- avoid returning detailed validation arrays if those could expose internals.

## Testing

Minimum coverage:

- Auth e2e proves repeated invalid login attempts hit `429`.
- CORS e2e proves an allowed origin receives credentialed CORS headers.
- CORS e2e proves a disallowed origin is not allowed and no-origin requests are still accepted.
- Error e2e proves production not-found/500-style payloads are sanitized and still include `requestId`.
- Existing auth/error tests continue passing in `NODE_ENV=test`.

## Verification

```bash
pnpm --filter @viewpro/api test -- auth.e2e-spec.ts errors.e2e-spec.ts
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

## Acceptance criteria

- Public auth endpoints are rate-limited.
- CORS config is explicit, credential-safe, and production-validated.
- Production errors do not leak unnecessary details.
- Request IDs remain available in error responses.
- No frontend behavior changes.
