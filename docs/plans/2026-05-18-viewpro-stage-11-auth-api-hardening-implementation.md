# Stage 11 Auth/API Public Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden ViewPro's public API boundary with auth rate limiting, explicit CORS, and production-safe error responses.

**Architecture:** Add NestJS-native throttling scoped to auth endpoints, parse/validate CORS origins in config/bootstrap, and adjust the global exception filter to sanitize only production responses while preserving request IDs.

**Tech Stack:** NestJS 11, `@nestjs/throttler`, class-validator, Vitest, Supertest, pnpm 10, Turbo.

---

## Constraints

- Keep the slice backend-only.
- Do not introduce Sentry or Redis in this slice.
- Keep rate limiting scoped to public auth endpoints.
- Do not remove request IDs from error responses.
- Preserve useful validation details in `test`/`development`.
- Do not commit unless the user explicitly approves.

## Task 1: Add throttler dependency and config

**Files:**
- Modify: `viewpro-app/apps/api/package.json`
- Modify: `viewpro-app/pnpm-lock.yaml`
- Modify: `viewpro-app/apps/api/src/config/env.schema.ts`
- Modify: `viewpro-app/apps/api/src/config/app.config.ts`
- Modify: `viewpro-app/apps/api/.env.example`

**Step 1: Write failing import expectation**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
```

Expected before implementation: PASS; after adding imports without dependency, it would fail. Install dependency before final typecheck.

**Step 2: Add dependency**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api add @nestjs/throttler
```

**Step 3: Add env validation**

In `env.schema.ts`, add integer env vars:

- `AUTH_RATE_LIMIT_LOGIN_LIMIT` default `5`
- `AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS` default `60`
- `AUTH_RATE_LIMIT_REGISTER_LIMIT` default `3`
- `AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS` default `60`
- `AUTH_RATE_LIMIT_REFRESH_LIMIT` default `20`
- `AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS` default `60`

Also prepare CORS parsing support by allowing `CORS_ORIGIN` to be omitted outside production while keeping production fail-fast validation in `app.config.ts`.

**Step 4: Add app config shape**

In `app.config.ts`, expose:

```ts
cors: {
  origins: parseCorsOrigins(process.env.CORS_ORIGIN, nodeEnv),
}
authRateLimit: {
  login: { limit, ttlSeconds },
  register: { limit, ttlSeconds },
  refresh: { limit, ttlSeconds },
}
```

Keep old config compatibility only if existing code needs it. Prefer one explicit shape.

**Step 5: Update env example**

Document the new vars and comma-separated CORS origins.

**Step 6: Typecheck**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 2: Add auth route throttling

**Files:**
- Modify: `viewpro-app/apps/api/src/app.module.ts`
- Modify: `viewpro-app/apps/api/src/auth/auth.controller.ts`
- Test: `viewpro-app/apps/api/test/auth.e2e-spec.ts`

**Step 1: Write failing e2e test**

Add a test that repeatedly calls invalid login until `429`:

```ts
it('rate-limits repeated login attempts', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'rate-limit@example.com', password: 'wrong-password' })
      .expect(401)
  }

  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'rate-limit@example.com', password: 'wrong-password' })
    .expect(429)
})
```

If defaults differ in tests, set env before app bootstrap to small values.

**Step 2: Run RED**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- auth.e2e-spec.ts
```

Expected: FAIL before throttling.

**Step 3: Register throttler module**

In `app.module.ts`, register `ThrottlerModule.forRootAsync()` using `ConfigService`.

**Step 4: Decorate auth routes**

In `auth.controller.ts`, use `@UseGuards(ThrottlerGuard)` and `@Throttle()` per route for login/register/refresh.

Do not rate-limit `GET /auth/me` in this slice.

**Step 5: Run GREEN**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- auth.e2e-spec.ts
```

Expected: PASS.

## Task 3: Make CORS explicit and production-safe

**Files:**
- Modify: `viewpro-app/apps/api/src/bootstrap/create-app.ts`
- Modify: `viewpro-app/apps/api/src/config/app.config.ts`
- Test: `viewpro-app/apps/api/test/errors.e2e-spec.ts` or create `viewpro-app/apps/api/test/cors.e2e-spec.ts`

**Step 1: Write CORS tests**

Create focused e2e coverage:

```ts
it('allows configured credentialed origins', async () => {
  const response = await request(app.getHttpServer())
    .options('/api/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('Access-Control-Request-Method', 'POST')
    .expect(204)

  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  expect(response.headers['access-control-allow-credentials']).toBe('true')
})
```

Add disallowed-origin assertion that no matching `access-control-allow-origin` is returned.

**Step 2: Implement origin callback**

In `create-app.ts`, use a CORS origin callback:

```ts
const allowedOrigins = configService.getOrThrow<string[]>('app.cors.origins')

origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
  return callback(null, false)
}
```

**Step 3: Add production validation**

In config parsing, throw if `NODE_ENV=production` and allowed origins are missing, empty, include `*`, include wildcard-like values, or contain empty comma-separated entries.

**Step 4: Run tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- cors.e2e-spec.ts
```

Expected: PASS.

## Task 4: Add production error sanitization

**Files:**
- Modify: `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts`
- Test: `viewpro-app/apps/api/test/errors.e2e-spec.ts`

**Step 1: Write production sanitization test**

Add a test that temporarily sets `NODE_ENV=production`, creates the app, calls a missing route, and expects a generic message:

```ts
expect(response.body).toMatchObject({
  statusCode: 404,
  error: 'Not Found',
  message: 'Resource not found',
  requestId: 'production-request-id',
})
expect(response.body.message).not.toContain('/api/missing-route')
```

Keep the existing test-mode assertion unchanged.

**Step 2: Run RED**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- errors.e2e-spec.ts
```

Expected: FAIL before sanitization.

**Step 3: Implement sanitization**

In `GlobalExceptionFilter`, determine production mode from `process.env.NODE_ENV` or injected config. For production:

- 500: `Unexpected error`
- 404: `Resource not found`
- validation 400: `Invalid request payload`
- other 4xx: use generic HTTP-safe message or current message only if known safe.

Preserve `requestId`.

**Step 4: Run GREEN**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- errors.e2e-spec.ts
```

Expected: PASS.

## Task 5: Update docs and roadmap

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Keep: `docs/plans/2026-05-18-viewpro-stage-11-auth-api-hardening-design.md`
- Keep: `docs/plans/2026-05-18-viewpro-stage-11-auth-api-hardening-implementation.md`

**Step 1: Add Stage 11 status**

Under Stage 11 status, add:

```markdown
- Slice 2 implementado: hardening público del API con rate limiting en auth, CORS explícito y sanitización de errores en producción.
```

**Step 2: Document env vars**

Ensure `.env.example` includes the new CORS/rate limit variables.

## Task 6: Full verification

**Step 1: Targeted API tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- auth.e2e-spec.ts errors.e2e-spec.ts cors.e2e-spec.ts
```

Expected: PASS.

**Step 2: API typecheck/build**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
```

Expected: PASS.

**Step 3: Root checks**

```bash
cd viewpro-app
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Diff check**

```bash
git diff --check
```

Expected: PASS.

## Commit boundary

Only if the user explicitly authorizes it:

```bash
git add docs/plans/2026-05-13-viewpro-implementation-roadmap.md \
  docs/plans/2026-05-18-viewpro-stage-11-auth-api-hardening-design.md \
  docs/plans/2026-05-18-viewpro-stage-11-auth-api-hardening-implementation.md \
  viewpro-app/apps/api \
  viewpro-app/pnpm-lock.yaml
git commit -m "fix(api): harden public auth boundary"
```

Do not push unless the user explicitly approves after commit.
