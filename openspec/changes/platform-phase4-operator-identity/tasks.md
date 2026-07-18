# Tasks: Platform Phase 4 — ViewPro Operator Identity

> New NestJS app (`apps/viewpro-api`) with its own Postgres DB (`viewpro_platform`),
> minimal `Operator` model, access-token-only sign-in, cookie `viewpro_platform_access_token`.
> Zero dependency on InmoView's DB. Strict TDD: RED task precedes every GREEN task.

---

## Open Questions — resolved inline (tasks phase)

| Question | Decision |
|----------|----------|
| Final PORT | **3002** (design default; avoids InmoView 3001 collision) |
| prod `COOKIE_DOMAIN` | **`.viewpro.app`** via `COOKIE_DOMAIN` env (unset = host-only local); design commitment |
| tsconfig base | **Reuse `packages/config/tsconfig/base.json`** as-is (`extends ../../packages/config/tsconfig/base.json`) |
| Package name | **`@viewpro/platform-api`** (design §Directory Layout) |
| `viewpro_platform` DB provisioning | Local: docker-compose service (separate DB, shared Postgres instance OK); infra team provisions prod equivalent. Not a code task — note only. |

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated new/changed lines | ~700–900 (all new files; ~30 source files + tests) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 → App scaffold + Prisma + health / PR 2 → Auth module + isolation test |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | App scaffold + Prisma schema + migration + seed + health | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/platform-api test` (health tests only) | `GET /health` → 200 against local `viewpro_platform_test` | Delete `apps/viewpro-api`; drop DB; no other app touched |
| WU-2 | Auth module (LoginDto, use-case, TokenService, controller) + isolation regression | PR 2 (base: PR 1 branch) | `pnpm --filter @viewpro/platform-api test` (full suite) | `POST /api/auth/login` with seeded operator → `viewpro_platform_access_token` cookie | Revert auth files; WU-1 scaffold stays intact |

---

## Dependency Graph

```
T-01 (scaffold)
  └── T-02 (Prisma schema)
        ├── T-03 (RED: schema shape test)
        │     └── T-04 (migration + Prisma client gen)
        │           └── T-05 (seed)
        │                 └── T-06 (RED: seed test)
        │                       └── T-07 (GREEN: seed impl)
        └── T-08 (RED: health test)
              └── T-09 (GREEN: health impl)
                    └── T-10 (workspace verification)
                          └── T-11 (RED: login use-case unit tests)
                                └── T-12 (GREEN: LoginUseCase + OperatorRepository)
                                      └── T-13 (RED: TokenService unit tests)
                                            └── T-14 (GREEN: TokenService + auth.constants)
                                                  └── T-15 (RED: auth controller integration tests)
                                                        └── T-16 (GREEN: auth controller + module wiring)
                                                              └── T-17 (RED: isolation regression test)
                                                                    └── T-18 (GREEN: assert isolation / test passes)
                                                                          └── T-19 (DB safety guard)
                                                                                └── T-20 (final verification)
```

T-03 and T-08 may begin in parallel once T-02 is done.
T-11 and T-13 may begin in parallel; both depend on T-10.

---

## Task List

### WU-1 — App Scaffold + Prisma + Health

---

#### [x] T-01 — Scaffold `apps/viewpro-api` package skeleton
**Type**: impl  
**Spec requirement**: App Bootstrap  
**Work unit**: WU-1, commit 1  
**Depends on**: nothing

Create the bare directory tree and root files so the package exists in the workspace:

- `apps/viewpro-api/package.json` — name `@viewpro/platform-api`, PORT 3002, scripts: `build`, `dev`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`; deps: `@nestjs/*`, `@prisma/client`, `cookie-parser`, `argon2`, `class-validator`, `class-transformer`, `@nestjs/jwt`, `@nestjs/throttler`; devDeps: `vitest`, `supertest`, `prisma`, `typescript`
- `apps/viewpro-api/tsconfig.json` — `extends ../../packages/config/tsconfig/base.json`
- `apps/viewpro-api/src/main.ts` — `import 'reflect-metadata'`; `createPlatformApp()` → `app.listen(config.port)`
- `apps/viewpro-api/src/app.module.ts` — stub importing `ConfigModule`, `ThrottlerModule`, `DatabaseModule`, `AuthModule`, `HealthModule`
- `apps/viewpro-api/src/bootstrap/brand.constants.ts` — `PLATFORM_BRAND` (Swagger title/description)
- `apps/viewpro-api/src/bootstrap/create-app.ts` — `cookieParser`, `setGlobalPrefix('api')`, CORS, `ValidationPipe`, Swagger

**Exit condition**: `pnpm --filter @viewpro/platform-api typecheck` resolves (even with empty module stubs).  
**Commit**: `feat(platform-api): scaffold app skeleton and package.json`

---

#### [x] T-02 — Write Prisma schema for `viewpro_platform`
**Type**: impl  
**Spec requirement**: Operator Model  
**Work unit**: WU-1, commit 2  
**Depends on**: T-01

- `apps/viewpro-api/prisma/schema.prisma` — datasource `db { provider="postgresql"; url=env("DATABASE_URL") }`, generator `client { provider="prisma-client-js"; output="../node_modules/.prisma/client" }`, `enum OperatorStatus { ACTIVE SUSPENDED }`, `model Operator` with exactly: `id String @id @default(uuid())`, `email String @unique`, `passwordHash String`, `status OperatorStatus @default(ACTIVE)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`

**Exit condition**: `pnpm --filter @viewpro/platform-api exec prisma validate` passes.  
**Commit**: `feat(platform-api): add Prisma schema with Operator model`

---

#### [x] T-03 — RED: test that Operator schema has exactly the required columns
**Type**: test (RED)  
**Spec requirement**: Operator Model — "Scenario: Operator table exists with minimal fields"  
**Work unit**: WU-1, commit 3  
**Depends on**: T-02

- `apps/viewpro-api/src/database/__tests__/operator-schema.spec.ts`
- Assert: `prisma.operator.fields` (via `dmmf`) contains exactly `id, email, passwordHash, status, createdAt, updatedAt`; no extra fields (role, refreshToken, invitedBy) exist
- Test is RED until migration is run and client generated

**Exit condition**: test file exists; test is failing (expected).  
**Commit**: `test(platform-api): RED — Operator schema column guard`

---

#### [x] T-04 — Run migration and generate Prisma client
**Type**: impl  
**Spec requirement**: Operator Model  
**Work unit**: WU-1, commit 4  
**Depends on**: T-03

- `pnpm --filter @viewpro/platform-api exec prisma migrate dev --name init_operator` against `viewpro_platform_test` (local)
- Commit the generated `apps/viewpro-api/prisma/migrations/*/migration.sql`
- `pnpm --filter @viewpro/platform-api exec prisma generate`
- Wire `DatabaseModule` + `PrismaService` (`apps/viewpro-api/src/database/database.module.ts`, `apps/viewpro-api/src/database/prisma.service.ts`) — `@Global`, provides + exports `PrismaService`
- Confirm T-03 goes GREEN

**Exit condition**: `pnpm --filter @viewpro/platform-api test` passes T-03.  
**Commit**: `feat(platform-api): run initial migration and wire DatabaseModule`

---

#### [x] T-05 — Write idempotent Prisma seed
**Type**: impl  
**Spec requirement**: Operator Seed  
**Work unit**: WU-1, commit 5  
**Depends on**: T-04

- `apps/viewpro-api/prisma/seed.ts` — reads `SEED_OPERATOR_EMAIL` + `SEED_OPERATOR_PASSWORD` from `process.env`; fails fast if either missing; `prisma.operator.upsert({ where:{ email }, update:{}, create:{ email, passwordHash: await argon2.hash(password), status: 'ACTIVE' } })`
- Wire `package.json` `prisma.seed` → `ts-node prisma/seed.ts`

**Exit condition**: `pnpm --filter @viewpro/platform-api db:seed` completes against `viewpro_platform_test` with env vars set; re-running is idempotent.  
**Commit**: `feat(platform-api): add idempotent Prisma seed for first operator`

---

#### [x] T-06 — RED: test that seed creates operator and does not touch InmoView DB
**Type**: test (RED)  
**Spec requirement**: Operator Seed — "Scenario: Seed creates the first operator"  
**Work unit**: WU-1, commit 6  
**Depends on**: T-05

- `apps/viewpro-api/src/database/__tests__/seed.spec.ts`
- Assert: after seed runs, `prisma.operator.findFirst()` returns a row with non-empty `email` and `passwordHash`
- Assert: InmoView `DATABASE_URL` env var is unset during this test (env isolation check)
- Test is RED until seed integration is wired in test environment

**Exit condition**: test file exists; test fails (expected).  
**Commit**: `test(platform-api): RED — seed creates operator + InmoView DB unset guard`

---

#### [x] T-07 — GREEN: wire seed test environment + confirm T-06 passes
**Type**: impl  
**Spec requirement**: Operator Seed  
**Work unit**: WU-1, commit 7  
**Depends on**: T-06

- Configure vitest setup file (`apps/viewpro-api/vitest.config.ts`) to point at `viewpro_platform_test` and explicitly `delete process.env.INMV_DATABASE_URL` (or equivalent InmoView DB var)
- Run `pnpm --filter @viewpro/platform-api test` — T-06 must go GREEN

**Exit condition**: T-06 is GREEN; no test touches InmoView DB env.  
**Commit**: `test(platform-api): GREEN — seed test passes with InmoView DB unset`

---

#### [x] T-08 — RED: test that `GET /health` returns 200
**Type**: test (RED)  
**Spec requirement**: App Bootstrap — "Scenario: Health check returns 200"  
**Work unit**: WU-1, commit 8  
**Depends on**: T-04 (Prisma client exists; can run in parallel with T-06)

- `apps/viewpro-api/src/health/__tests__/health.controller.spec.ts`
- Integration test via `@nestjs/testing` + supertest: boot minimal test app with `DatabaseModule` + `HealthModule`; `GET /api/health` → 200, body `{ status: 'ok', service: 'viewpro-platform-api' }`
- Test is RED until controller and module exist

**Exit condition**: test file exists; test fails (expected).  
**Commit**: `test(platform-api): RED — health endpoint returns 200`

---

#### [x] T-09 — GREEN: implement `HealthController` + `HealthModule`
**Type**: impl  
**Spec requirement**: App Bootstrap  
**Work unit**: WU-1, commit 9  
**Depends on**: T-08

- `apps/viewpro-api/src/health/health.controller.ts` — `@Get('/health')` returns `{ status: 'ok', service: 'viewpro-platform-api', timestamp: new Date().toISOString() }`
- `apps/viewpro-api/src/health/health.module.ts`
- Wire into `app.module.ts`
- Confirm T-08 goes GREEN

**Exit condition**: `pnpm --filter @viewpro/platform-api test` — T-08 GREEN.  
**Commit**: `feat(platform-api): implement HealthController and HealthModule`

---

#### [x] T-10 — Verify workspace / turbo pickup
**Type**: impl + verify  
**Spec requirement**: Workspace Integration  
**Work unit**: WU-1, commit 10  
**Depends on**: T-09

- `pnpm ls -r` from workspace root — confirm `@viewpro/platform-api` appears
- `pnpm turbo run typecheck --filter @viewpro/platform-api` — must resolve and pass
- `pnpm turbo run test --filter @viewpro/platform-api` — must resolve and run T-08 GREEN
- No edits to `pnpm-workspace.yaml` or `turbo.json` expected (glob covers `apps/*`); if pickup fails, document the exact fix needed (e.g., explicit turbo pipeline entry) and apply it

**Exit condition**: both turbo commands resolve `@viewpro/platform-api` and complete without error.  
**Commit**: `chore(platform-api): verify turbo workspace pickup (no-op or minimal fix)`

---

### WU-2 — Auth Module + Isolation Regression

---

#### [x] T-11 — RED: unit tests for `LoginUseCase`
**Type**: test (RED)  
**Spec requirement**: Operator Sign-In — wrong password / unknown operator / happy path  
**Work unit**: WU-2, commit 1  
**Depends on**: T-10

Three vitest unit tests in `apps/viewpro-api/src/auth/use-cases/__tests__/login.use-case.spec.ts`:

1. **Happy path**: mocked `OperatorRepository.findByEmail` returns ACTIVE operator; mocked `Argon2PasswordHasher.verify` returns true → use-case returns `{ operator, token }` (no 401 thrown)
2. **Wrong password**: verify returns false → throws `UnauthorizedException` with generic message `'Invalid email or password'`
3. **SUSPENDED operator**: verify returns true but status is `SUSPENDED` → throws `UnauthorizedException`
4. **Unknown operator**: repository returns null → throws `UnauthorizedException`

All tests RED until use-case and interfaces exist.  
**Exit condition**: test file exists; all 4 assertions fail (expected).  
**Commit**: `test(platform-api): RED — LoginUseCase unit tests (wrong-pw, suspended, unknown, happy-path)`

---

#### [x] T-12 — GREEN: implement `LoginUseCase`, `OperatorRepository`, and password hasher
**Type**: impl  
**Spec requirement**: Operator Sign-In  
**Work unit**: WU-2, commit 2  
**Depends on**: T-11

- `apps/viewpro-api/src/auth/dto/login.dto.ts` — `email: string` (IsEmail), `password: string` (IsString, MinLength 1)
- `apps/viewpro-api/src/auth/security/password-hasher.ts` — interface `IPasswordHasher { hash(pw): Promise<string>; verify(hash, pw): Promise<boolean> }`
- `apps/viewpro-api/src/auth/security/argon2-password-hasher.ts` — argon2id impl
- `apps/viewpro-api/src/auth/repositories/operator.repository.ts` — interface `IOperatorRepository { findByEmail(email): Promise<Operator | null> }`
- `apps/viewpro-api/src/auth/repositories/prisma-operator.repository.ts` — Prisma impl using `PrismaService`
- `apps/viewpro-api/src/auth/use-cases/login.use-case.ts` — injects `IOperatorRepository` + `IPasswordHasher` + `TokenService`; normalises email to lowercase; throws generic 401 on fail; returns `{ operator: { id, email }, token }` on success
- Confirm T-11 goes GREEN

**Exit condition**: `pnpm --filter @viewpro/platform-api test` — T-11 all GREEN.  
**Commit**: `feat(platform-api): implement LoginUseCase, OperatorRepository, and Argon2 hasher`

---

#### [x] T-13 — RED: unit tests for `TokenService` (cookie name + security attrs)
**Type**: test (RED)  
**Spec requirement**: Cookie Name Isolation (Guardrail 2) + Cookie Security Attributes  
**Work unit**: WU-2, commit 3  
**Depends on**: T-10 (can start in parallel with T-11)

Unit tests in `apps/viewpro-api/src/auth/tokens/__tests__/token.service.spec.ts`:

1. **Cookie name literal**: `setAccessCookie` calls `res.cookie` with first arg equal to the literal `'viewpro_platform_access_token'`
2. **Cookie name exclusion**: the literal `'viewpro_access_token'` (without `_platform`) MUST NOT be passed as cookie name in any call
3. **httpOnly**: cookie options include `httpOnly: true`
4. **sameSite**: cookie options include `sameSite: 'lax'`
5. **signAccessToken**: returns a string that can be decoded as a JWT with `sub` and `email` claims
6. **own secret isolation**: a token signed with `SECRET_A` cannot be verified with `SECRET_B`

All RED until `TokenService` and `auth.constants.ts` exist.  
**Exit condition**: test file exists; all 6 assertions fail (expected).  
**Commit**: `test(platform-api): RED — TokenService cookie-name, security attrs, JWT-secret isolation`

---

#### [x] T-14 — GREEN: implement `TokenService` and `auth.constants.ts`
**Type**: impl  
**Spec requirement**: Cookie Name Isolation + Cookie Security Attributes + Database Isolation (secret isolation)  
**Work unit**: WU-2, commit 4  
**Depends on**: T-13

- `apps/viewpro-api/src/auth/auth.constants.ts` — `ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token'` (the single source of truth for the cookie name literal)
- `apps/viewpro-api/src/auth/tokens/token.service.ts` — `signAccessToken({ sub, email })`, `verifyAccessToken(token)`, `setAccessCookie(res, token)` → `res.cookie(ACCESS_TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE, domain: COOKIE_DOMAIN || undefined, path: '/' })`, `clearAccessCookie(res)`
- Confirm T-13 goes GREEN

**Exit condition**: `pnpm --filter @viewpro/platform-api test` — T-13 all GREEN.  
**Commit**: `feat(platform-api): implement TokenService and auth.constants (cookie name + JWT)`

---

#### [x] T-15 — RED: integration tests for auth controller (login flow)
**Type**: test (RED)  
**Spec requirement**: Operator Sign-In (all scenarios) + Cookie Name Isolation + Cookie Security Attributes  
**Work unit**: WU-2, commit 5  
**Depends on**: T-12, T-14

Integration tests in `apps/viewpro-api/src/auth/__tests__/auth.controller.spec.ts` (supertest, `viewpro_platform_test` DB):

1. **Valid credentials → 200 + cookie**: `POST /api/auth/login` with seeded operator → HTTP 200, `Set-Cookie` contains `viewpro_platform_access_token`, cookie value is valid JWT
2. **Wrong password → 401, no cookie**: HTTP 401, no `Set-Cookie`
3. **Unknown operator → 401, no cookie**: HTTP 401, no `Set-Cookie`
4. **Cookie name guard**: `Set-Cookie` value does NOT contain `viewpro_access_token` as a standalone cookie name (regex: `/^viewpro_access_token=/m`)
5. **httpOnly guard**: `Set-Cookie` value includes `HttpOnly`
6. **sameSite guard**: `Set-Cookie` value includes `SameSite=Lax` (case-insensitive)
7. **Response body**: 200 body is `{ operator: { id, email } }` — no `passwordHash` in response

All RED until controller + module wiring exist.  
**Exit condition**: test file exists; all 7 assertions fail (expected).  
**Commit**: `test(platform-api): RED — auth controller integration tests (login scenarios + cookie guards)`

---

#### [x] T-16 — GREEN: implement `AuthController`, `AuthModule`, and env config
**Type**: impl  
**Spec requirement**: Operator Sign-In + Cookie Security Attributes  
**Work unit**: WU-2, commit 6  
**Depends on**: T-15

- `apps/viewpro-api/src/config/env.schema.ts` — class-validator `EnvironmentVariables`: `NODE_ENV`, `PORT` (default 3002), `DATABASE_URL`, `ACCESS_TOKEN_SECRET` (required), `ACCESS_TOKEN_TTL_SECONDS` (default 900), `COOKIE_DOMAIN` (optional), `COOKIE_SECURE` (bool, default false), `CORS_ORIGIN` (optional), `AUTH_RATE_LIMIT_LOGIN_LIMIT` + `AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS`
- `apps/viewpro-api/src/config/app.config.ts` — `registerAs('app', …)`
- `apps/viewpro-api/src/config/config.module.ts` — `NestConfigModule.forRoot({ validate: validateEnv, load:[appConfig] })`
- `apps/viewpro-api/src/auth/guards/auth-throttler.guard.ts`
- `apps/viewpro-api/src/auth/guards/auth.guard.ts`
- `apps/viewpro-api/src/auth/auth.controller.ts` — `@Post('login')` + throttler guard; calls `LoginUseCase`; calls `TokenService.setAccessCookie`; returns `{ operator: { id, email } }`
- `apps/viewpro-api/src/auth/auth.module.ts` — `JwtModule.registerAsync` (own `ACCESS_TOKEN_SECRET`); provide repositories and use-case; wire throttler
- Update `app.module.ts` to import `ConfigModule`, `DatabaseModule`, `AuthModule`, `HealthModule`, `ThrottlerModule`
- Confirm T-15 goes GREEN

**Exit condition**: `pnpm --filter @viewpro/platform-api test` — T-15 all GREEN (plus prior tests still GREEN).  
**Commit**: `feat(platform-api): implement AuthController, AuthModule, env config`

---

#### [x] T-17 — RED: isolation regression test (InmoView DB unset)
**Type**: test (RED)  
**Spec requirement**: Database Isolation — "Scenario: Sign-in succeeds when InmoView DB is unreachable" + "Scenario: Sign-in uses its own JWT secret"  
**Work unit**: WU-2, commit 7  
**Depends on**: T-16

Integration test in `apps/viewpro-api/src/auth/__tests__/isolation.spec.ts`:

1. **InmoView DB unset**: test bootstraps `viewpro-api` with own `DATABASE_URL` set to `viewpro_platform_test`; any known InmoView DB env var (`INMV_DATABASE_URL`, `DATABASE_URL` for InmoView process, etc.) is explicitly deleted from `process.env`; `POST /api/auth/login` with valid operator → 200 and cookie issued
2. **JWT secret isolation**: issue token with `SECRET_A`; attempt `jwt.verify(token, 'SECRET_B')` → must throw; confirms tokens are not cross-verifiable
3. **Cookie name literal assertion**: `Set-Cookie` header value MUST match `viewpro_platform_access_token=` exactly as cookie name (belt-and-suspenders against regression)

Test RED (will require the bootstrapped environment with isolation env setup).  
**Exit condition**: test file exists; all 3 assertions fail (expected).  
**Commit**: `test(platform-api): RED — isolation regression (InmoView DB unset, own JWT secret)`

---

#### [x] T-18 — GREEN: confirm isolation test passes with env isolation setup
**Type**: impl  
**Spec requirement**: Database Isolation  
**Work unit**: WU-2, commit 8  
**Depends on**: T-17

- Extend `apps/viewpro-api/vitest.config.ts` (or a dedicated `vitest.isolation.config.ts`) to:
  - Clear any InmoView-named env vars before the test suite
  - Point `DATABASE_URL` to `viewpro_platform_test`
- Run `pnpm --filter @viewpro/platform-api test` — T-17 must go GREEN
- Full test suite must remain GREEN (no regression in prior tests)

**Exit condition**: all tests GREEN; T-17 isolation assertions pass.  
**Commit**: `test(platform-api): GREEN — isolation regression confirmed`

---

#### [x] T-19 — Add `viewpro_platform` to test-DB safety guard
**Type**: impl  
**Spec requirement**: Database Isolation (safety, Workspace Integration)  
**Work unit**: WU-2, commit 9  
**Depends on**: T-18

- `apps/viewpro-api/src/database/test-database-url.guard.ts` — mirrors `apps/api` pattern; adds `viewpro_platform` to the set of dangerous production DB names; `assertSafeTestDatabaseUrl()` throws if `DATABASE_URL` does not end with `_test`
- Call `assertSafeTestDatabaseUrl()` from `PrismaService.onModuleInit()` when `NODE_ENV === 'test'`
- Unit test in `apps/viewpro-api/src/database/__tests__/test-database-url.guard.spec.ts`:
  - Guard throws when URL points at `viewpro_platform` (non-test)
  - Guard passes when URL points at `viewpro_platform_test`

**Exit condition**: guard unit tests GREEN; full suite still GREEN.  
**Commit**: `feat(platform-api): add test-DB safety guard for viewpro_platform`

---

#### [x] T-20 — Final workspace verification and invariant check
**Type**: verify  
**Spec requirement**: Workspace Integration + all invariants  
**Work unit**: WU-2, commit 10  
**Depends on**: T-19

1. `pnpm turbo run build --filter @viewpro/platform-api` — passes
2. `pnpm turbo run test --filter @viewpro/platform-api` — all tests GREEN
3. `pnpm turbo run typecheck --filter @viewpro/platform-api` — passes
4. `git diff HEAD -- apps/api/` — empty (InmoView untouched)
5. `git diff HEAD -- apps/api/prisma/schema.prisma` — empty
6. `rg 'viewpro_access_token' apps/viewpro-api/src` — zero hits (only `viewpro_platform_access_token` present)
7. Confirm `pnpm ls -r` lists `@viewpro/platform-api`
8. Leave a `NOTE (deferred follow-up)` comment in `apps/viewpro-api/README.md` (if README exists) or inline in seed.ts: "VIEWPRO_ADMIN → Operator migration is a separate follow-up task; existing records in InmoView's `viewpro` DB are untouched."

**Exit condition**: all 7 checks pass; InmoView diff is empty; `viewpro_access_token` has zero hits in new code.  
**Commit**: `chore(platform-api): final verification — workspace, invariants, isolation confirmed`

---

## Summary Table

| Task | Type | WU | Parallel group | Spec requirement | Depends on |
|------|------|-----|---------------|-----------------|------------|
| T-01 Scaffold package skeleton | impl | WU-1 | — | App Bootstrap | — |
| T-02 Prisma schema | impl | WU-1 | — | Operator Model | T-01 |
| T-03 RED: schema column guard | test | WU-1 | A | Operator Model | T-02 |
| T-04 Migration + client gen + DatabaseModule | impl | WU-1 | — | Operator Model | T-03 |
| T-05 Seed impl | impl | WU-1 | — | Operator Seed | T-04 |
| T-06 RED: seed test | test | WU-1 | — | Operator Seed | T-05 |
| T-07 GREEN: seed test env | impl | WU-1 | — | Operator Seed | T-06 |
| T-08 RED: health test | test | WU-1 | A (after T-04) | App Bootstrap | T-04 |
| T-09 GREEN: HealthController | impl | WU-1 | — | App Bootstrap | T-08 |
| T-10 Workspace / turbo verify | verify | WU-1 | — | Workspace Integration | T-09 |
| T-11 RED: LoginUseCase unit tests | test | WU-2 | B | Operator Sign-In | T-10 |
| T-12 GREEN: LoginUseCase + repos | impl | WU-2 | — | Operator Sign-In | T-11 |
| T-13 RED: TokenService unit tests | test | WU-2 | B (parallel to T-11) | Cookie Name + Security Attrs | T-10 |
| T-14 GREEN: TokenService + constants | impl | WU-2 | — | Cookie Name + Security Attrs | T-13 |
| T-15 RED: auth controller integration tests | test | WU-2 | — | Sign-In + Cookie guards | T-12, T-14 |
| T-16 GREEN: AuthController + AuthModule + config | impl | WU-2 | — | Sign-In + Cookie Security | T-15 |
| T-17 RED: isolation regression test | test | WU-2 | — | Database Isolation | T-16 |
| T-18 GREEN: isolation env setup | impl | WU-2 | — | Database Isolation | T-17 |
| T-19 Test-DB safety guard | impl | WU-2 | — | Database Isolation | T-18 |
| T-20 Final verification | verify | WU-2 | — | All invariants | T-19 |

---

## Success Checklist (maps to spec)

- [x] App Bootstrap: `apps/viewpro-api` boots as standalone NestJS app (T-01, T-09, T-10)
- [x] App Bootstrap: `GET /api/health` → 200 `{ status:'ok', service:'viewpro-platform-api' }` (T-08, T-09)
- [x] Operator Model: `Operator` table exists with exactly `id, email, passwordHash, status, createdAt, updatedAt` (T-02, T-03, T-04)
- [x] Operator Seed: seed creates first operator idempotently; no row in InmoView `viewpro` DB (T-05, T-06, T-07)
- [x] Operator Sign-In: valid credentials → 200 + `viewpro_platform_access_token` cookie (T-15, T-16)
- [x] Operator Sign-In: wrong password or unknown operator → 401, no cookie (T-11, T-15)
- [x] Cookie Name Isolation: cookie name is exactly `viewpro_platform_access_token`; `viewpro_access_token` never emitted (T-13, T-14, T-15, T-20)
- [x] Cookie Security: `HttpOnly`, `SameSite=Lax`, `Secure` in prod-equivalent (T-13, T-14, T-15)
- [x] Database Isolation: sign-in succeeds with InmoView `DATABASE_URL` unset (T-17, T-18)
- [x] Database Isolation: `viewpro_platform_access_token` JWT cannot be verified with InmoView's secret (T-13, T-17)
- [x] Workspace Integration: `pnpm turbo run typecheck/test --filter @viewpro/platform-api` runs (T-10, T-20)
- [x] Test-DB safety guard blocks production DB names in test context (T-19)
- [x] `apps/api` diff is empty — InmoView untouched (T-20)
- [x] VIEWPRO_ADMIN migration deferred follow-up noted (T-20)
