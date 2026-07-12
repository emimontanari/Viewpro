# Stage 11 Seeded Authenticated E2E Design

Stage 11 Slice 1 adds deterministic authenticated browser coverage without slowing down the existing smoke tests. The slice creates a small real API + DB + web Playwright path for the two highest-value hardening checks: tenant workspace auth and global admin auth.

## Decision

Use a separate seeded Playwright runner that starts the NestJS API and Next.js web app locally, seeds Postgres with deterministic test data, logs in through real cookie auth, and runs serial browser tests.

## Why this slice exists

The current web tests are useful but incomplete:

- public smoke tests cover unauthenticated pages only;
- admin smoke tests mock API responses;
- no browser test proves real login cookies, CORS, tenant headers, DB data, or admin read models.

This slice closes that infrastructure gap before adding broader MVP hardening.

## Scope

### In scope

- Add a separate Playwright config for seeded authenticated E2E.
- Start API on `127.0.0.1:3001` and web on `127.0.0.1:3100`.
- Seed a minimal deterministic fixture with Prisma:
  - one active tenant;
  - one manager user with tenant membership;
  - one global admin user with `VIEWPRO_ADMIN`;
  - one property asset, engagement, movement, document request, and analytics events needed by dashboard/admin read models.
- Login through real `/api/auth/login` so httpOnly cookies are created by the backend.
- Set `viewpro:selected-tenant:v1` only for the manager workspace flow.
- Verify `/admin` does not depend on selected tenant and does not send `x-tenant-id`.
- Keep seeded E2E serial to avoid shared DB races.

### Out of scope

- Owner portal E2E.
- Document upload/download E2E.
- Full movement journey E2E.
- CI/deploy wiring.
- Parallel seeded E2E execution.
- Production-like secret management.

## Architecture

| Area | Design |
|------|--------|
| Runner | Keep `playwright.config.ts` for fast smoke; add a new seeded auth config. |
| API startup | Playwright `webServer` starts `@viewpro/api` with `NODE_ENV=test`, `PORT=3001`, `CORS_ORIGIN=http://127.0.0.1:3100`, `COOKIE_SECURE=false`. |
| Web startup | Seeded config starts Next on `127.0.0.1:3100` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api`. |
| Database | Use the existing local Postgres test/dev DB connection from `DATABASE_URL`; migrations must already be applied. |
| Seeding | A test-only Prisma helper deletes seeded rows in FK-safe order, then creates deterministic fixture records. |
| Auth | Tests call the real login endpoint; no access token is stored in browser storage. |
| Tenant state | Manager flow writes only `viewpro:selected-tenant:v1` to localStorage. |
| Admin state | Admin flow intentionally avoids tenant localStorage and asserts no admin request sends `x-tenant-id`. |

## Test flows

### Manager workspace

1. Seed manager user and tenant membership.
2. Login as manager through real backend auth.
3. Store selected tenant ID using the existing localStorage shape.
4. Open an internal workspace route that requires tenant context.
5. Assert real seeded content renders.
6. Assert tenant-scoped API requests include `x-tenant-id`.

### Admin ViewPro

1. Seed global admin user and read-model data.
2. Login as admin through real backend auth.
3. Open `/admin`.
4. Assert summary, tenant list, and activity render from real API responses.
5. Assert admin API requests do not include `x-tenant-id`.

## Error handling and safety

- Tests must use deterministic seeded IDs/emails plus runtime-generated non-secret login values.
- Seed cleanup must target deterministic seeded emails/IDs/slugs to avoid deleting unrelated local data accidentally.
- Seeded E2E must not become the default `pnpm --filter @viewpro/web test`; developers should opt in with a dedicated command.
- If API or DB is unavailable, the seeded command should fail loudly instead of falling back to mocks.

## Verification

Minimum verification for this slice:

```bash
pnpm --filter @viewpro/web test
pnpm --filter @viewpro/web test:auth:seeded
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

The seeded command may require local Postgres to be running and migrations applied:

```bash
pnpm db:up
pnpm db:migrate
```

## Local seeded runner usage

Run the seeded authenticated browser suite only when local Postgres is available and migrated:

```bash
pnpm db:up
pnpm db:migrate
pnpm --filter @viewpro/web test:auth:seeded
```

The runner remains opt-in, serial, and separate from `pnpm --filter @viewpro/web test`. It defaults to API `127.0.0.1:3001` and web `127.0.0.1:3100`; if those ports are occupied locally, override with `VIEWPRO_SEEDED_E2E_API_PORT` and `VIEWPRO_SEEDED_E2E_WEB_PORT`.

## Acceptance criteria

- Existing smoke tests remain fast and mock-friendly.
- Seeded authenticated E2E can be run separately.
- Manager browser flow proves real auth + tenant context.
- Admin browser flow proves real auth + no tenant context.
- No tokens or secrets are written to localStorage.
- The roadmap documents Stage 11 Slice 1 status and remaining E2E gaps.
