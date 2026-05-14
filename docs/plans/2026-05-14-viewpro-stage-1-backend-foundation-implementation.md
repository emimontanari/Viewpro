# ViewPro Stage 1 Backend Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convertir `apps/api` de una API NestJS mínima a una base backend real, preparada para configuración, errores consistentes, request tracing, OpenAPI, Prisma y tests e2e básicos.

**Architecture:** La API mantiene un monolito modular NestJS. La configuración se centraliza con `@nestjs/config`, el bootstrap se extrae a una función reutilizable para tests, los errores pasan por un `GlobalExceptionFilter`, cada request recibe `requestId`, y Prisma queda instalado/preparado sin introducir dominio todavía.

**Tech Stack:** NestJS 11, TypeScript 6, `@nestjs/config`, Prisma, PostgreSQL local vía Docker Compose, Vitest, Supertest, OpenAPI/Swagger.

---

## Reglas de ejecución

- No implementar auth, usuarios, tenants, propiedades, movimientos ni documentos.
- No agregar Sentry, BullMQ, storage ni TanStack Query.
- No meter modelos de negocio falsos para “probar Prisma”.
- Mantener la API arrancable aunque la DB local no esté levantada.
- Tests críticos primero: health e2e y shape de errores.
- Commits sugeridos por work unit; no commitear sin aprobación explícita del usuario.

## Resultado esperado

Al final de Etapa 1 debe funcionar desde `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm build
```

Y opcionalmente, si Docker está disponible:

```bash
pnpm db:up
pnpm --filter @viewpro/api db:generate
pnpm db:down
```

---

## Task 1: Agregar dependencias backend base

**Files:**
- Modify: `viewpro-app/apps/api/package.json`
- Modify: `viewpro-app/package.json`
- Modify: `viewpro-app/pnpm-lock.yaml`

**Step 1: Instalar dependencias runtime de API**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api add --save-exact @nestjs/config class-validator class-transformer @prisma/client
```

Expected:

```txt
Dependencies added to apps/api/package.json.
pnpm-lock.yaml updated.
```

**Step 2: Instalar dev dependencies de API**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api add -D --save-exact prisma vitest supertest @types/supertest @nestjs/testing
```

Expected:

```txt
Dev dependencies added to apps/api/package.json.
```

**Step 3: Agregar scripts API**

Modify `viewpro-app/apps/api/package.json` scripts:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "lint": "echo 'api lint not configured yet'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate",
    "db:studio": "prisma studio"
  }
}
```

**Step 4: Agregar scripts raíz de DB**

Modify `viewpro-app/package.json` scripts:

```json
{
  "scripts": {
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:generate": "pnpm --filter @viewpro/api db:generate",
    "db:validate": "pnpm --filter @viewpro/api db:validate",
    "db:studio": "pnpm --filter @viewpro/api db:studio"
  }
}
```

**Step 5: Verificar instalación**

Run from `viewpro-app/`:

```bash
pnpm install
```

Expected:

```txt
Lockfile up to date.
No dependency errors.
```

**Suggested commit message:**

```bash
chore(api): add backend foundation dependencies
```

---

## Task 2: Configuración env formal

**Files:**
- Create: `viewpro-app/apps/api/src/config/env.schema.ts`
- Create: `viewpro-app/apps/api/src/config/app.config.ts`
- Create: `viewpro-app/apps/api/src/config/config.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`
- Modify: `viewpro-app/apps/api/.env.example`

**Step 1: Crear schema de env**

`viewpro-app/apps/api/src/config/env.schema.ts`:

```ts
import { plainToInstance } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator'

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
  @IsUrl({ require_tld: false })
  DATABASE_URL?: string
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

**Step 2: Crear config tipada**

`viewpro-app/apps/api/src/config/app.config.ts`:

```ts
import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
}))
```

**Step 3: Crear módulo de config**

`viewpro-app/apps/api/src/config/config.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { appConfig } from './app.config'
import { validateEnv } from './env.schema'

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
```

**Step 4: Importar en AppModule**

Modify `viewpro-app/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [ConfigModule, HealthModule],
})
export class AppModule {}
```

**Step 5: Actualizar `.env.example`**

`viewpro-app/apps/api/.env.example`:

```dotenv
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://viewpro:viewpro@localhost:5432/viewpro?schema=public
```

**Step 6: Verificar typecheck**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
```

Expected:

```txt
No TypeScript errors.
```

**Suggested commit message:**

```bash
chore(api): add validated environment config
```

---

## Task 3: Extraer bootstrap reutilizable y CORS

**Files:**
- Create: `viewpro-app/apps/api/src/bootstrap/create-app.ts`
- Modify: `viewpro-app/apps/api/src/main.ts`

**Step 1: Crear función `createApiApp`**

`viewpro-app/apps/api/src/bootstrap/create-app.ts`:

```ts
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from '../app.module'

export async function createApiApp() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ViewPro API')
    .setDescription('REST API for ViewPro')
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document)

  return app
}
```

**Step 2: Simplificar `main.ts`**

`viewpro-app/apps/api/src/main.ts`:

```ts
import { ConfigService } from '@nestjs/config'
import { createApiApp } from './bootstrap/create-app'

async function bootstrap() {
  const app = await createApiApp()
  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port') ?? 3001

  await app.listen(port)
}

void bootstrap()
```

**Step 3: Verificar build**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api build
```

Expected:

```txt
Nest build succeeds.
```

**Suggested commit message:**

```bash
refactor(api): extract reusable app bootstrap
```

---

## Task 4: Health endpoint más útil

**Files:**
- Modify: `viewpro-app/apps/api/src/health/health.controller.ts`

**Step 1: Actualizar response shape**

`viewpro-app/apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-api'
  version: string
  uptime: number
  timestamp: string
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API health status' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'viewpro-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
```

**Step 2: Verificar typecheck**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
```

Expected:

```txt
No TypeScript errors.
```

**Suggested commit message:**

```bash
feat(api): enrich health endpoint response
```

---

## Task 5: GlobalExceptionFilter con error shape consistente

**Files:**
- Create: `viewpro-app/apps/api/src/common/errors/api-error-response.ts`
- Create: `viewpro-app/apps/api/src/common/filters/global-exception.filter.ts`
- Modify: `viewpro-app/apps/api/src/bootstrap/create-app.ts`

**Step 1: Crear tipo de error API**

`viewpro-app/apps/api/src/common/errors/api-error-response.ts`:

```ts
export type ApiErrorResponse = {
  statusCode: number
  error: string
  message: string | string[]
  path: string
  timestamp: string
  requestId?: string
}
```

**Step 2: Crear filtro global**

`viewpro-app/apps/api/src/common/filters/global-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ApiErrorResponse } from '../errors/api-error-response'

type HttpExceptionBody = {
  error?: string
  message?: string | string[]
  statusCode?: number
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { requestId?: string }>()

    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : undefined

    const body = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? (exceptionResponse as HttpExceptionBody)
      : undefined

    const payload: ApiErrorResponse = {
      statusCode,
      error: body?.error ?? (statusCode === 500 ? 'Internal Server Error' : 'Error'),
      message: body?.message ?? (typeof exceptionResponse === 'string' ? exceptionResponse : 'Unexpected error'),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    }

    response.status(statusCode).json(payload)
  }
}
```

**Step 3: Registrar filtro en bootstrap**

Modify `viewpro-app/apps/api/src/bootstrap/create-app.ts`:

```ts
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter'
```

Add after pipes:

```ts
app.useGlobalFilters(new GlobalExceptionFilter())
```

**Step 4: Verificar typecheck**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
```

Expected:

```txt
No TypeScript errors.
```

**Suggested commit message:**

```bash
feat(api): add global exception filter
```

---

## Task 6: RequestId middleware

**Files:**
- Create: `viewpro-app/apps/api/src/common/middleware/request-id.middleware.ts`
- Modify: `viewpro-app/apps/api/src/bootstrap/create-app.ts`

**Step 1: Crear middleware**

`viewpro-app/apps/api/src/common/middleware/request-id.middleware.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestIdMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
) {
  const incomingRequestId = request.header('x-request-id')
  const requestId = incomingRequestId?.trim() || randomUUID()

  request.requestId = requestId
  response.setHeader('x-request-id', requestId)

  next()
}
```

**Step 2: Registrar middleware**

Modify `viewpro-app/apps/api/src/bootstrap/create-app.ts`:

```ts
import { requestIdMiddleware } from '../common/middleware/request-id.middleware'
```

Add before global prefix or before pipes:

```ts
app.use(requestIdMiddleware)
```

**Step 3: Verificar typecheck**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
```

Expected:

```txt
No TypeScript errors.
```

**Suggested commit message:**

```bash
feat(api): add request id middleware
```

---

## Task 7: Prisma base y Docker Compose PostgreSQL

**Files:**
- Create: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/docker-compose.yml`
- Create: `viewpro-app/apps/api/src/database/prisma.service.ts`
- Create: `viewpro-app/apps/api/src/database/database.module.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`
- Modify: `viewpro-app/apps/api/.env.example`
- Modify: `viewpro-app/README.md`

**Step 1: Crear Prisma schema sin modelos de dominio**

`viewpro-app/apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Step 2: Crear Docker Compose PostgreSQL**

`viewpro-app/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: viewpro-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: viewpro
      POSTGRES_PASSWORD: viewpro
      POSTGRES_DB: viewpro
    ports:
      - "5432:5432"
    volumes:
      - viewpro_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U viewpro -d viewpro"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  viewpro_postgres_data:
```

**Step 3: Crear PrismaService**

`viewpro-app/apps/api/src/database/prisma.service.ts`:

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

**Step 4: Crear DatabaseModule**

`viewpro-app/apps/api/src/database/database.module.ts`:

```ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

**Step 5: Importar DatabaseModule**

Modify `viewpro-app/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule],
})
export class AppModule {}
```

**Step 6: Verificar Prisma generate**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api db:generate
```

Expected:

```txt
Prisma Client generated.
```

**Step 7: Actualizar README con DB local**

Add to `viewpro-app/README.md`:

```markdown
## Base de datos local

```bash
pnpm db:up
pnpm db:generate
pnpm db:down
```

La base local usa PostgreSQL en Docker con credenciales de desarrollo definidas en `apps/api/.env.example`.
```

**Step 8: Verificar typecheck/build**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
```

Expected:

```txt
No TypeScript errors.
Nest build succeeds.
```

**Suggested commit message:**

```bash
chore(api): prepare prisma postgres foundation
```

---

## Task 8: Tests e2e mínimos con Vitest + Supertest

**Files:**
- Create: `viewpro-app/apps/api/vitest.config.ts`
- Create: `viewpro-app/apps/api/test/health.e2e-spec.ts`
- Create: `viewpro-app/apps/api/test/errors.e2e-spec.ts`

**Step 1: Crear config Vitest**

`viewpro-app/apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
})
```

**Step 2: Crear health e2e test**

`viewpro-app/apps/api/test/health.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'

describe('HealthController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns API health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'viewpro-api',
      version: '0.1.0',
    })
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.body.uptime).toEqual(expect.any(Number))
    expect(response.headers['x-request-id']).toEqual(expect.any(String))
  })
})
```

**Step 3: Crear error shape e2e test**

`viewpro-app/apps/api/test/errors.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'

describe('GlobalExceptionFilter (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns consistent not found error payload with request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/missing-route')
      .set('x-request-id', 'test-request-id')
      .expect(404)

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/missing-route',
      path: '/api/missing-route',
      requestId: 'test-request-id',
    })
    expect(response.body.timestamp).toEqual(expect.any(String))
    expect(response.headers['x-request-id']).toBe('test-request-id')
  })
})
```

**Step 4: Ejecutar tests**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api test
```

Expected:

```txt
Health e2e passes.
Error shape e2e passes.
```

**Suggested commit message:**

```bash
test(api): add backend foundation e2e coverage
```

---

## Task 9: Verificación final Etapa 1

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`

**Step 1: Ejecutar checks API**

Run from `viewpro-app/`:

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected:

```txt
All API checks pass.
```

**Step 2: Ejecutar checks monorepo**

Run from `viewpro-app/`:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Expected:

```txt
All configured workspace checks pass.
```

**Step 3: Actualizar READMEs si faltan comandos**

Root `README.md` debe seguir indicando que los comandos se ejecutan desde `viewpro-app/`.

`viewpro-app/README.md` debe listar:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm db:up
pnpm db:generate
pnpm db:down
```

**Step 4: Revisar status**

Run from repo root:

```bash
git status --short --branch
```

Expected:

```txt
Only intended Etapa 1 files changed.
No .env secrets tracked.
No dist/.next/node_modules artifacts tracked.
```

**Suggested commit message:**

```bash
chore(api): complete backend foundation setup
```

---

## Acceptance checklist

- [ ] Env validation exists and fails fast on invalid values.
- [ ] CORS uses configured origin.
- [ ] Swagger still works at `/api/docs`.
- [ ] Health returns `status`, `service`, `version`, `uptime`, `timestamp`.
- [ ] Every response includes `x-request-id`.
- [ ] Errors return consistent JSON shape.
- [ ] Prisma is installed and `prisma generate` works.
- [ ] PostgreSQL local service is documented via Docker Compose.
- [ ] API e2e tests pass.
- [ ] Root monorepo checks pass.
- [ ] No domain/business modules added yet.

## Out of scope

- Auth and JWT.
- Users/tenants/memberships.
- Prisma domain models.
- Migrations for business tables.
- Sentry.
- BullMQ.
- Storage/R2.
- Frontend integration.
