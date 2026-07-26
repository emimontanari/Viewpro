# Design: Platform Phase 4 — ViewPro Operator Identity

Stand up `apps/viewpro-api` as an autonomous NestJS app cloned in SHAPE (not content) from `apps/api`, with its own Postgres DB (`viewpro_platform`), its own `Operator` identity store, and an access-token-only sign-in that sets cookie `viewpro_platform_access_token`. Isolation from InmoView is structural: separate DB, separate JWT secret, separate cookie name. All paths below are relative to `viewpro-app/`.

## Locked decisions (do NOT re-open)

| Decision | Choice |
|----------|--------|
| D-plat | Option 1 — ViewPro owns its own Operator store (blueprint §3) |
| Operator model | Minimal: `id, email, passwordHash, status, createdAt, updatedAt` |
| Session model | Access-token ONLY — no refresh rotation this slice |
| Code sharing | DUPLICATE `apps/api/src/auth` patterns; do NOT extract `@viewpro/auth-kit` yet (future refactor) |
| VIEWPRO_ADMIN migration | Out of scope / deferred follow-up |

## Directory Layout — `apps/viewpro-api/`

Mirrors the minimal spine of `apps/api`, dropping every InmoView-specific module (tenants, memberships, analytics, documents, etc.):

```
apps/viewpro-api/
├── package.json                 (name @viewpro/platform-api; same script + dep set, no aws/resend)
├── tsconfig.json                (extends ../../packages/config/tsconfig/base.json — identical shape)
├── prisma/
│   ├── schema.prisma            Operator model + viewpro_platform datasource
│   └── seed.ts                  idempotent first-operator bootstrap
└── src/
    ├── main.ts                  reflect-metadata → createPlatformApp() → listen(app.port)
    ├── app.module.ts            ConfigModule, ThrottlerModule, DatabaseModule, AuthModule, HealthModule
    ├── bootstrap/
    │   ├── brand.constants.ts   PLATFORM_BRAND (Swagger title/description)
    │   └── create-app.ts        cookieParser, setGlobalPrefix('api'), CORS(credentials), ValidationPipe, Swagger
    ├── config/
    │   ├── app.config.ts        registerAs('app', …) — platform-scoped
    │   ├── config.module.ts     NestConfigModule.forRoot({ validate: validateEnv, load:[appConfig] })
    │   └── env.schema.ts        class-validator EnvironmentVariables (platform vars only)
    ├── database/
    │   ├── database.module.ts   @Global, provides+exports PrismaService
    │   ├── prisma.service.ts    PrismaClient + assertSafeTestDatabaseUrl()
    │   └── test-database-url.guard.ts  (viewpro_platform added to safe-test naming)
    ├── health/
    │   ├── health.controller.ts GET /health → 200 { service:'viewpro-platform-api' }
    │   └── health.module.ts
    └── auth/
        ├── auth.constants.ts    ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token'
        ├── auth.controller.ts   POST /auth/login  (+ throttler guard)
        ├── auth.module.ts       JwtModule.registerAsync (own secret), providers
        ├── dto/login.dto.ts     email + password (mirror)
        ├── security/{password-hasher.ts, argon2-password-hasher.ts}  Argon2id (mirror)
        ├── tokens/token.service.ts  signAccessToken / verifyAccessToken / setAccessCookie
        ├── repositories/{operator.repository.ts, prisma-operator.repository.ts}  findByEmail
        ├── guards/{auth.guard.ts, auth-throttler.guard.ts}
        └── use-cases/login.use-case.ts
```

## Architecture Decisions

### Decision: Own Prisma datasource `viewpro_platform`, own client

**Choice**: `datasource db { provider="postgresql"; url=env("DATABASE_URL") }` in `apps/viewpro-api/prisma/schema.prisma`, generating a Prisma client scoped to this app. The app's `DATABASE_URL` points at DB `viewpro_platform`. **Alternatives**: reuse InmoView's `@prisma/client` and add `Operator` to its schema — rejected: that is the exact InmoView coupling D-plat forbids. **Rationale**: a separate generated client physically cannot reach InmoView tables; isolation is compile-time, not convention.

### Decision: Access-token-only, no refresh table

**Choice**: `TokenService` exposes only `signAccessToken`, `verifyAccessToken`, `setAccessCookie`, `clearAccessCookie`. No `RefreshToken` model, no `/auth/refresh`, no second cookie. **Alternatives**: mirror InmoView's refresh rotation — rejected for this slice. **Rationale**: refresh adds a DB table + rotation logic for zero Phase-4 value; the goal is to prove the split, not build the final session model. Re-adding refresh later is additive.

### Decision: Duplicate auth code, do not extract a shared package

**Choice**: copy `argon2-password-hasher`, `token.service`, `auth.guard`, DTO, and use-case shape into `viewpro-api`. **Alternatives**: `@viewpro/auth-kit` shared package now — rejected. **Rationale**: two consumers with diverging needs (InmoView has refresh + memberships; ViewPro is minimal) make premature extraction costly. Note as an explicit future refactor once both stabilize.

### Decision: Cross-domain cookie strategy (sub-question #5, PINNED)

**Choice**: `viewpro-web` (Phase 5) is served under the SAME registrable domain as `viewpro-api` (e.g. `console.viewpro.app` FE, `api.viewpro.app` API). Cookie attributes:

```
httpOnly: true
sameSite: 'lax'
secure:   COOKIE_SECURE (true in prod, false local)
domain:   COOKIE_DOMAIN (unset local → host-only; '.viewpro.app' in prod)
path:     '/'
```

**Alternatives**: `sameSite:'none'` for a fully cross-site FE on an unrelated domain — rejected: forces `secure` everywhere, weakens CSRF posture, and is not needed if we commit to a shared parent domain. **Rationale**: pinning shared-parent-domain now means Phase 5 sets `COOKIE_DOMAIN='.viewpro.app'` and consumes the cookie with NO breaking change. Mirrors InmoView's own `baseCookieOptions` (lax + domain-when-not-localhost). This is a design commitment: Phase 5 FE MUST live under `*.viewpro.app`.

## Data Flow — operator sign-in

```
POST /api/auth/login {email,password}
        │
   AuthController ── AuthThrottlerGuard (rate limit)
        │
   LoginUseCase
        ├─ OperatorRepository.findByEmail(normalizedEmail)   → viewpro_platform ONLY
        ├─ Argon2PasswordHasher.verify(passwordHash, pw)
        ├─ status === ACTIVE ? else 401 (generic message)
        └─ TokenService.signAccessToken({ sub, email })      → own ACCESS_TOKEN_SECRET
        │
   TokenService.setAccessCookie(res, token)  → Set-Cookie: viewpro_platform_access_token=…
        │
   200 { operator: { id, email } }
```

InmoView's `viewpro` DB and `viewpro_access_token` cookie are never referenced on this path.

## Operator model (Prisma)

```prisma
enum OperatorStatus { ACTIVE  SUSPENDED }

model Operator {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  status       OperatorStatus @default(ACTIVE)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

## Env schema (isolated, `env.schema.ts` + `app.config.ts`)

Platform-only variables — InmoView's `DATABASE_URL`/`ACCESS_TOKEN_SECRET` are different env values in a different app process:

| Var | Constraint | Notes |
|-----|-----------|-------|
| `NODE_ENV` | in dev/test/prod | default development |
| `PORT` | int 1–65535 | default 3002 (avoid InmoView 3001 collision) |
| `DATABASE_URL` | string | → `viewpro_platform` DB |
| `ACCESS_TOKEN_SECRET` | string, required | OWN secret, distinct from InmoView |
| `ACCESS_TOKEN_TTL_SECONDS` | int ≥60 | default 900 |
| `COOKIE_DOMAIN` | optional string | `.viewpro.app` in prod |
| `COOKIE_SECURE` | bool | true in prod |
| `CORS_ORIGIN` | optional string | Phase-5 FE origin |
| `AUTH_RATE_LIMIT_LOGIN_LIMIT` / `_TTL_SECONDS` | int ≥1 | login throttle |

No `REFRESH_TOKEN_*`, no `RESEND_*`, no `DOCUMENT_STORAGE_*`, no `SENTRY_*` unless trivially carried.

## Seed approach — `prisma/seed.ts`

Env-driven and idempotent: read `SEED_OPERATOR_EMAIL` + `SEED_OPERATOR_PASSWORD`; `prisma.operator.upsert({ where:{ email }, update:{}, create:{ email, passwordHash: await argon2.hash(pw), status:'ACTIVE' } })`. Upsert makes re-runs safe. Fail fast if either env var is missing. Wired via `package.json` `prisma.seed` + a `db:seed` script.

## Workspace / turbo wiring

- `pnpm-workspace.yaml` already globs `apps/*` → `apps/viewpro-api` is picked up automatically. VERIFY only (`pnpm ls -r` shows `@viewpro/platform-api`).
- `turbo.json` is task-glob only (no per-app list). Tasks `build/dev/lint/typecheck/test` apply automatically. NO turbo edit; verify `pnpm turbo run typecheck --filter @viewpro/platform-api` resolves.
- `test-database-url.guard.ts`: add `viewpro_platform` to the dangerous-names set so tests refuse to run against the real platform DB.

## Isolation proof

Operator login cannot reach InmoView's DB by construction:

1. **Separate Prisma client** — `apps/viewpro-api` generates its own client from a schema that contains ONLY `Operator`; no `User`/tenant tables exist to query.
2. **Separate `DATABASE_URL`** — resolved from viewpro-api's own env process → `viewpro_platform`. InmoView's `viewpro` connection string is never loaded into this process.
3. **Separate `ACCESS_TOKEN_SECRET`** — a `viewpro_platform_access_token` cannot be verified by InmoView and vice-versa; no token confusion across apps.
4. **Separate cookie name** — `viewpro_platform_access_token` (Guardrail 2), never `viewpro_access_token`.

A regression test asserts (a) the cookie name literal, and (b) that the app boots and authenticates with InmoView's `DATABASE_URL` UNSET — proving zero dependency.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-api/**` (full tree above) | Create | NestJS skeleton + auth + prisma |
| `apps/viewpro-api/prisma/schema.prisma` | Create | Operator + `viewpro_platform` datasource |
| `apps/viewpro-api/prisma/seed.ts` | Create | Idempotent first-operator bootstrap |
| `pnpm-workspace.yaml` / `turbo.json` | Verify | No edit expected; confirm pickup |
| `viewpro_platform` Postgres DB | Provision | Local + deploy infra |
| `apps/api/**`, InmoView `viewpro` DB | Untouched | Must not appear in diff |

## Interfaces / Contracts

```
POST /api/auth/login  Body: { email: string; password: string }
  200 → Set-Cookie viewpro_platform_access_token; { operator: { id, email } }
  401 → { message: 'Invalid email or password' }   (generic, no user enumeration)
GET  /api/health  → 200 { status:'ok', service:'viewpro-platform-api', … }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | TokenService cookie attrs (name/httpOnly/sameSite/domain); Argon2 verify | vitest |
| Unit | LoginUseCase: bad password / SUSPENDED → 401; happy path signs token | vitest, mocked repo |
| Integration | `POST /auth/login` sets `viewpro_platform_access_token`; `GET /health` 200 | supertest against `viewpro_platform_test` |
| Isolation | app authenticates with InmoView `DATABASE_URL` unset; cookie name literal asserted | supertest / boot test |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. (Standard HTTP auth over an isolated DB.)

## Migration / Rollout

No InmoView data migration. New app + new DB only. Rollback = delete `apps/viewpro-api`, drop `viewpro_platform`, remove workspace registration; nothing in InmoView to undo. Existing `VIEWPRO_ADMIN` records untouched.

## Risks / Tradeoffs

| Risk | Sev | Mitigation |
|------|-----|-----------|
| **Sequencing** — roadmap recommends Phase 4 AFTER go-live; user chose to advance now | Med | Recorded as a decision, not a blocker. Slice is additive + isolated, ships nothing to real tenants. |
| Duplicate auth code diverges from InmoView | Low | Accepted; extract `@viewpro/auth-kit` later once both stabilize |
| Dual identity stores coexist until VIEWPRO_ADMIN migration | Med | Seed covers operator #1; migration is an explicit deferred follow-up |
| Port/cookie collision with InmoView on shared host | Low | Distinct PORT (3002) + distinct cookie name + distinct secret |
| Cross-domain cookie assumption (shared `*.viewpro.app`) | Med | Pinned as a design commitment; Phase 5 FE MUST honor it |

## Open Questions (for tasks phase)

- [ ] Confirm final PORT (3002 proposed) and prod hostnames for `COOKIE_DOMAIN`.
- [ ] Provisioning mechanism for `viewpro_platform` (docker-compose service vs. shared instance + separate DB).
- [ ] Whether `viewpro-api` reuses `packages/config/tsconfig/base.json` as-is (assumed yes).
- [ ] Confirm `@viewpro/platform-api` package name (vs. `@viewpro/viewpro-api`) for workspace naming consistency.
