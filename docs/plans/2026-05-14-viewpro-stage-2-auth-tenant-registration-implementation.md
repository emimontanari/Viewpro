# ViewPro Stage 2 Auth + Tenant Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar autenticación propia y registro autoservicio de inmobiliaria: usuario global, tenant, membresía como gerente principal, login, refresh rotativo, logout y `/me`.

**Architecture:** La API mantiene módulos NestJS separados por dominio (`AuthModule`, `UsersModule`, `TenantsModule`, `MembershipsModule`) con controllers delgados, use cases y repositorios Prisma. La sesión usa access token JWT corto en cookie `httpOnly` y refresh token opaco rotativo hasheado en base de datos. El frontend no guarda tokens en `localStorage`.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Argon2id, `@nestjs/jwt`, cookies `httpOnly`, Vitest + Supertest e2e.

---

## Decisiones de Etapa 2

| Tema | Decisión |
|---|---|
| Auth | Propia en NestJS |
| Password hashing | Argon2id |
| Access token | JWT corto, cookie `httpOnly` |
| Refresh token | Token opaco aleatorio, hasheado en DB, rotativo |
| Registro MVP | Crea user + tenant + membership `PRINCIPAL_MANAGER` |
| Tenant inicial | `TRIAL` |
| `/me` | Devuelve user + memberships disponibles |
| Email verification | Campo preparado, flujo fuera de Etapa 2 |
| Reset password | Fuera de Etapa 2 |
| Tenant permissions finos | Fuera de Etapa 2; queda para Etapa 3 |

Regla central:

> El token dice quién sos. La base decide qué podés hacer.

---

## Scope

### Incluye

- Modelos Prisma: `User`, `Tenant`, `TenantMembership`, `RefreshToken`.
- Enums Prisma: `UserStatus`, `TenantStatus`, `TenantRole`.
- Migración inicial real de auth/tenant.
- `AuthModule` con endpoints:
  - `POST /api/auth/register-tenant`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- `UsersModule`, `TenantsModule`, `MembershipsModule` mínimos.
- Password hashing con Argon2id.
- Access token JWT + refresh token rotativo.
- Cookies `httpOnly`, `Secure` configurable, `SameSite=Lax`.
- Tests e2e de registro/login/me/refresh/logout.

### No incluye

- UI de login/registro.
- Email verification real.
- Reset password.
- Roles/permisos granulares.
- Platform owner.
- Invitación de vendedores.
- Tenant switching avanzado.
- Rate limiting.
- Sentry.

---

## Task 1: Agregar dependencias y configuración auth

**Files:**
- Modify: `viewpro-app/apps/api/package.json`
- Modify: `viewpro-app/apps/api/src/config/env.schema.ts`
- Modify: `viewpro-app/apps/api/src/config/app.config.ts`
- Modify: `viewpro-app/apps/api/.env.example`
- Modify: `viewpro-app/apps/api/src/bootstrap/create-app.ts`
- Modify: `viewpro-app/pnpm-lock.yaml`

**Step 1: Instalar dependencias**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api add --save-exact @nestjs/jwt argon2 cookie-parser
pnpm --filter @viewpro/api add -D --save-exact @types/cookie-parser
```

Expected:

```txt
Dependencies installed and lockfile updated.
```

**Step 2: Agregar variables env**

Update `viewpro-app/apps/api/src/config/env.schema.ts`:

```ts
import { plainToInstance } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator'

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development'

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001

  @IsString()
  CORS_ORIGIN = 'http://localhost:3000'

  @IsOptional()
  @IsString()
  DATABASE_URL?: string

  @IsString()
  ACCESS_TOKEN_SECRET = 'change-me-in-real-env'

  @IsString()
  COOKIE_DOMAIN = 'localhost'

  @IsBoolean()
  COOKIE_SECURE = false

  @IsInt()
  @Min(60)
  ACCESS_TOKEN_TTL_SECONDS = 900

  @IsInt()
  @Min(3600)
  REFRESH_TOKEN_TTL_SECONDS = 2592000
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    throw new Error(errors.toString())
  }

  return validatedConfig
}
```

**Step 3: Exponer config auth/cookies**

Update `viewpro-app/apps/api/src/config/app.config.ts`:

```ts
import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  auth: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? 'change-me-in-real-env',
    accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000),
  },
  cookies: {
    domain: process.env.COOKIE_DOMAIN ?? 'localhost',
    secure: process.env.COOKIE_SECURE === 'true',
  },
}))
```

**Step 4: Actualizar `.env.example`**

```dotenv
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro?schema=public
ACCESS_TOKEN_SECRET=change-me-in-real-env
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
```

**Step 5: Registrar cookie parser**

Update `viewpro-app/apps/api/src/bootstrap/create-app.ts`:

```ts
import cookieParser from 'cookie-parser'
```

Add before CORS/pipes:

```ts
app.use(cookieParser())
```

**Step 6: Verificar typecheck**

Run:

```bash
pnpm --filter @viewpro/api typecheck
```

Expected:

```txt
No TypeScript errors.
```

---

## Task 2: Crear modelos Prisma de auth/tenant

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Modify: `viewpro-app/apps/api/src/database/prisma.service.ts`

**Step 1: Actualizar schema Prisma**

Add to `viewpro-app/apps/api/prisma/schema.prisma`:

```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
}

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum TenantRole {
  PRINCIPAL_MANAGER
  MANAGER
  AGENT
}

model User {
  id              String             @id @default(uuid())
  email           String             @unique
  passwordHash    String
  firstName       String
  lastName        String?
  status          UserStatus         @default(ACTIVE)
  emailVerifiedAt DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  memberships     TenantMembership[]
  refreshTokens   RefreshToken[]

  @@map("users")
}

model Tenant {
  id          String             @id @default(uuid())
  name        String
  slug        String             @unique
  status      TenantStatus       @default(TRIAL)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  memberships TenantMembership[]

  @@map("tenants")
}

model TenantMembership {
  id        String     @id @default(uuid())
  userId    String
  tenantId  String
  role      TenantRole
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([userId])
  @@map("tenant_memberships")
}

model RefreshToken {
  id                String         @id @default(uuid())
  userId            String
  tokenHash         String         @unique
  expiresAt         DateTime
  revokedAt         DateTime?
  replacedByTokenId String?
  createdAt         DateTime       @default(now())

  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  replacedByToken   RefreshToken?  @relation("RefreshTokenRotation", fields: [replacedByTokenId], references: [id])
  replacedTokens    RefreshToken[] @relation("RefreshTokenRotation")

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

**Step 2: Generar migración**

Run from `viewpro-app/` with Docker/Postgres available:

```bash
pnpm db:up
pnpm --filter @viewpro/api prisma migrate dev --name init_auth_tenant
```

If Docker is unavailable, use:

```bash
pnpm --filter @viewpro/api db:generate
pnpm --filter @viewpro/api db:validate
```

Expected:

```txt
Prisma schema validates and client generates.
Migration created if DB is available.
```

**Step 3: Mantener PrismaService sin conexión eager**

Keep `PrismaService` simple; do not connect on module init yet:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

---

## Task 3: Crear módulos Users, Tenants y Memberships mínimos

**Files:**
- Create: `viewpro-app/apps/api/src/users/users.module.ts`
- Create: `viewpro-app/apps/api/src/users/users.repository.ts`
- Create: `viewpro-app/apps/api/src/users/prisma-users.repository.ts`
- Create: `viewpro-app/apps/api/src/tenants/tenants.module.ts`
- Create: `viewpro-app/apps/api/src/tenants/tenants.repository.ts`
- Create: `viewpro-app/apps/api/src/tenants/prisma-tenants.repository.ts`
- Create: `viewpro-app/apps/api/src/memberships/memberships.module.ts`
- Create: `viewpro-app/apps/api/src/memberships/memberships.repository.ts`
- Create: `viewpro-app/apps/api/src/memberships/prisma-memberships.repository.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Design:**

- Repositories son providers explícitos con tokens.
- Use cases de auth dependen de interfaces/tokens, no de Prisma directo.
- No controllers en estos módulos todavía.

**Repository tokens:**

Use `Symbol()` exports:

```ts
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY')
```

**Required repository capabilities:**

Users:

```ts
create(data)
findByEmail(email)
findById(id)
```

Tenants:

```ts
create(data)
findBySlug(slug)
```

Memberships:

```ts
create(data)
findManyByUserId(userId)
```

**Step: Import modules in AppModule**

```ts
imports: [
  ConfigModule,
  DatabaseModule,
  UsersModule,
  TenantsModule,
  MembershipsModule,
  HealthModule,
]
```

**Verify:**

```bash
pnpm --filter @viewpro/api typecheck
```

---

## Task 4: Crear AuthModule con servicios criptográficos

**Files:**
- Create: `viewpro-app/apps/api/src/auth/auth.module.ts`
- Create: `viewpro-app/apps/api/src/auth/security/password-hasher.ts`
- Create: `viewpro-app/apps/api/src/auth/security/argon2-password-hasher.ts`
- Create: `viewpro-app/apps/api/src/auth/tokens/token.service.ts`
- Create: `viewpro-app/apps/api/src/auth/tokens/refresh-token.repository.ts`
- Create: `viewpro-app/apps/api/src/auth/tokens/prisma-refresh-token.repository.ts`
- Create: `viewpro-app/apps/api/src/auth/auth.constants.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Password hashing interface:**

```ts
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER')

export type PasswordHasher = {
  hash(password: string): Promise<string>
  verify(hash: string, password: string): Promise<boolean>
}
```

**Argon2 implementation:**

```ts
import { Injectable } from '@nestjs/common'
import { hash, verify } from 'argon2'
import type { PasswordHasher } from './password-hasher'

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string) {
    return hash(password, { type: 2 })
  }

  verify(hashValue: string, password: string) {
    return verify(hashValue, password)
  }
}
```

**TokenService responsibilities:**

- Sign access token with user id/email.
- Generate random refresh token using `crypto.randomBytes(64)`.
- Hash refresh token with SHA-256 before storing.
- Create cookie options from config.

**AuthModule imports:**

- `JwtModule.registerAsync(...)`
- `UsersModule`
- `TenantsModule`
- `MembershipsModule`
- `DatabaseModule`

---

## Task 5: DTOs y response models

**Files:**
- Create: `viewpro-app/apps/api/src/auth/dto/register-tenant.dto.ts`
- Create: `viewpro-app/apps/api/src/auth/dto/login.dto.ts`
- Create: `viewpro-app/apps/api/src/auth/responses/auth-user.response.ts`
- Create: `viewpro-app/apps/api/src/auth/responses/me.response.ts`

**Register DTO:**

```ts
import { IsEmail, IsString, MinLength } from 'class-validator'

export class RegisterTenantDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsString()
  @MinLength(1)
  firstName!: string

  @IsString()
  @MinLength(1)
  tenantName!: string
}
```

**Login DTO:**

```ts
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string
}
```

**Response rule:**

Never return `passwordHash`, refresh token hashes, or raw tokens in JSON.

---

## Task 6: Register tenant use case

**Files:**
- Create: `viewpro-app/apps/api/src/auth/use-cases/register-tenant.use-case.ts`
- Create: `viewpro-app/apps/api/src/auth/utils/slugify.ts`
- Modify: `viewpro-app/apps/api/src/auth/auth.module.ts`

**Flow:**

```txt
normalize email
check user email is unique
generate tenant slug from tenantName
ensure slug unique or append suffix
hash password
transaction:
  create user
  create tenant status TRIAL
  create membership role PRINCIPAL_MANAGER
create refresh token record
return auth session
```

**Important:**

Use Prisma transaction for user + tenant + membership.

If repo abstractions make transaction awkward, create a focused `AuthRegistrationRepository` for this use case. Do NOT spread transaction logic across controller.

---

## Task 7: Login, refresh, logout y me use cases

**Files:**
- Create: `viewpro-app/apps/api/src/auth/use-cases/login.use-case.ts`
- Create: `viewpro-app/apps/api/src/auth/use-cases/refresh-session.use-case.ts`
- Create: `viewpro-app/apps/api/src/auth/use-cases/logout.use-case.ts`
- Create: `viewpro-app/apps/api/src/auth/use-cases/get-current-user.use-case.ts`
- Create: `viewpro-app/apps/api/src/auth/guards/auth.guard.ts`
- Create: `viewpro-app/apps/api/src/auth/decorators/current-user.decorator.ts`

**Login flow:**

```txt
normalize email
find user
verify password
reject inactive/suspended user
create access token
create refresh token DB row
set cookies
return safe user + memberships
```

**Refresh flow:**

```txt
read refresh cookie
hash token
find DB refresh token
reject missing/expired/revoked
rotate:
  revoke old token
  create new refresh token
issue new access token
set cookies
```

**Logout flow:**

```txt
read refresh cookie if present
revoke token if found
clear cookies
return ok
```

**Me flow:**

```txt
AuthGuard validates access token cookie
use case loads user + memberships from DB
return safe response
```

---

## Task 8: AuthController

**Files:**
- Create: `viewpro-app/apps/api/src/auth/auth.controller.ts`
- Modify: `viewpro-app/apps/api/src/auth/auth.module.ts`

**Endpoints:**

```txt
POST /api/auth/register-tenant
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

**Controller rules:**

- Controller receives DTOs and `Response` only for cookies.
- Controller delegates all business logic to use cases.
- Controller never touches Prisma.
- Cookies are set/cleared via `TokenService` helper methods.

---

## Task 9: E2E tests

**Files:**
- Create: `viewpro-app/apps/api/test/auth.e2e-spec.ts`
- Modify: `viewpro-app/apps/api/vitest.config.ts` if needed

**Test setup:**

Use real app and test database. If local Postgres is not available, report blocker before implementation.

At minimum, tests must cover:

1. Register tenant creates user/tenant/membership and sets cookies.
2. Duplicate email returns conflict.
3. Login works with valid credentials.
4. Login rejects wrong password.
5. `/me` returns user + memberships with cookie auth.
6. Refresh rotates refresh token and keeps `/me` working.
7. Logout clears/revokes session; `/me` fails after logout.

**Expected commands:**

```bash
pnpm db:up
pnpm db:migrate
pnpm --filter @viewpro/api test
```

---

## Task 10: OpenAPI, docs y final verification

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md` if status needs marking

**Docs update:**

Add backend auth commands and endpoints summary.

**Final verification:**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api db:generate
pnpm db:migrate
pnpm --filter @viewpro/api db:validate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Run from repo root:

```bash
git status --short --branch
```

Expected:

```txt
All checks pass.
Only intended Stage 2 files changed.
No secrets tracked.
```

---

## Acceptance checklist

- [ ] User can register a tenant and principal manager.
- [ ] Registration creates `User`, `Tenant`, `TenantMembership` atomically.
- [ ] Password is stored only as Argon2id hash.
- [ ] Login validates credentials and sets cookies.
- [ ] Access token is not returned as JSON.
- [ ] Refresh token raw value is never stored in DB.
- [ ] Refresh rotates token and revokes previous token.
- [ ] Logout revokes/clears session.
- [ ] `/me` returns safe user + memberships.
- [ ] No auth token is stored in `localStorage`.
- [ ] E2E tests cover happy path and failure path.
- [ ] No domain modules beyond user/tenant/membership/auth.

## Known follow-ups

- Etapa 3: tenant context guards and granular permissions.
- Add rate limiting for login/register.
- Add email verification.
- Add reset password.
- Replace placeholder lint with real ESLint.
