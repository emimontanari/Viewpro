# Stage 11 Sentry Error Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add disabled-by-default Sentry error observability for ViewPro web and API without sending sensitive data.

**Architecture:** Use minimal Next.js Sentry instrumentation for frontend errors and a small API-side Sentry wrapper integrated with the existing NestJS global exception filter. Capture only unexpected/5xx backend errors, attach safe request context, and avoid Replay, tracing, source-map upload, and PII enrichment.

**Tech Stack:** Next.js 16, React 19, NestJS 11, Sentry SDKs, Vitest, Supertest, pnpm 10, Turbo.

---

## Constraints

- Do not commit real DSNs, auth tokens, org/project names, or credentials.
- Sentry must be disabled/no-op when DSN is missing.
- Do not add Replay, source-map upload, release upload, or CI integration.
- Do not capture request bodies, cookies, auth headers, tokens, passwords, or private document metadata.
- Keep traces disabled/default `0`.
- Do not commit unless the user explicitly approves.

## Task 1: Add Sentry dependencies and env examples

**Files:**
- Modify: `viewpro-app/apps/web/package.json`
- Modify: `viewpro-app/apps/api/package.json`
- Modify: `viewpro-app/pnpm-lock.yaml`
- Modify: `viewpro-app/apps/web/.env.example`
- Modify: `viewpro-app/apps/api/.env.example`
- Modify: `viewpro-app/apps/api/src/config/env.schema.ts`
- Modify: `viewpro-app/apps/api/src/config/app.config.ts`

**Step 1: Install packages**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web add @sentry/nextjs
pnpm --filter @viewpro/api add @sentry/node
```

Use `@sentry/nestjs` only if it is compatible and adds clear value; otherwise keep API integration explicit and testable with `@sentry/node`.

**Step 2: Add env examples**

API `.env.example`:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0
```

Web `.env.example`:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

**Step 3: Add API env/config**

Expose:

```ts
sentry: {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? nodeEnv,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
}
```

Validate sample rate between `0` and `1`.

**Step 4: Typecheck API config**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 2: Add API Sentry wrapper

**Files:**
- Create: `viewpro-app/apps/api/src/observability/sentry.service.ts`
- Create: `viewpro-app/apps/api/src/observability/observability.module.ts`
- Test: `viewpro-app/apps/api/test/sentry.service.spec.ts` or equivalent unit test

**Step 1: Write disabled behavior test**

Test that missing DSN makes capture a no-op.

**Step 2: Implement wrapper**

Create a small service with methods like:

```ts
initialize(): void
captureException(error: unknown, context: SafeErrorContext): void
isEnabled(): boolean
```

`SafeErrorContext` should include only:

- `requestId`
- `path`
- `statusCode`
- `environment`

**Step 3: Scrub unsafe data by construction**

Do not accept request body, headers, cookies, user email, tokens, or arbitrary metadata in the wrapper API.

**Step 4: Run unit test**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- sentry.service.spec.ts
```

Expected: PASS.

## Task 3: Integrate backend capture with global exception filter

**Files:**
- Modify: `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts`
- Modify: `viewpro-app/apps/api/src/bootstrap/create-app.ts` or provider wiring as needed
- Test: `viewpro-app/apps/api/test/errors.e2e-spec.ts` or new focused unit test

**Step 1: Write capture policy tests**

Cover:

- unexpected/500 exception captures once with safe context;
- normal 404/400 does not capture;
- response body still includes `requestId` and remains sanitized in production.

Use a mock/stub wrapper; do not call real Sentry.

**Step 2: Inject or pass Sentry wrapper to filter**

Prefer dependency injection if practical. If current filter is created manually in bootstrap, resolve the service from the app and pass it to the filter constructor.

**Step 3: Implement capture policy**

Capture only:

- non-HTTP exceptions;
- HTTP exceptions with `status >= 500`.

Skip `4xx` by default.

**Step 4: Run tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- errors.e2e-spec.ts sentry.service.spec.ts
```

Expected: PASS.

## Task 4: Add minimal Next.js Sentry instrumentation

**Files:**
- Modify: `viewpro-app/apps/web/next.config.ts`
- Create as required by current Sentry/Next docs:
  - `viewpro-app/apps/web/instrumentation.ts`
  - `viewpro-app/apps/web/instrumentation-client.ts`
  - optionally `viewpro-app/apps/web/sentry.server.config.ts`
  - optionally `viewpro-app/apps/web/sentry.edge.config.ts`

**Step 1: Configure DSN-gated init**

Use env vars:

- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`

Do not enable Replay.

**Step 2: Wrap Next config minimally**

Use `withSentryConfig` only for runtime integration. Disable/no-op source map upload in this slice; do not require auth token/org/project.

**Step 3: Ensure no API error bodies are manually captured**

Do not wire global API client error capture in this slice.

**Step 4: Verify web**

```bash
cd viewpro-app
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
```

Expected: PASS without DSN.

## Task 5: Update docs and roadmap

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Keep: `docs/plans/2026-05-18-viewpro-stage-11-sentry-error-observability-design.md`
- Keep: `docs/plans/2026-05-18-viewpro-stage-11-sentry-error-observability-implementation.md`

**Step 1: Add Stage 11 status**

```markdown
- Slice 4 implementado: Sentry error-only frontend/backend, desactivado sin DSN y sin Replay/tracing/source-map upload.
```

**Step 2: Document operational notes**

Mention that real DSNs are environment/secret values and must not be committed.

## Task 6: Full verification

**Step 1: Targeted tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- errors.e2e-spec.ts sentry.service.spec.ts app-config.spec.ts
```

Expected: PASS.

**Step 2: App checks**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
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
  docs/plans/2026-05-18-viewpro-stage-11-sentry-error-observability-design.md \
  docs/plans/2026-05-18-viewpro-stage-11-sentry-error-observability-implementation.md \
  viewpro-app/apps/api \
  viewpro-app/apps/web \
  viewpro-app/pnpm-lock.yaml
git commit -m "feat(observability): add sentry error capture"
```

Do not push unless the user explicitly approves after commit.
