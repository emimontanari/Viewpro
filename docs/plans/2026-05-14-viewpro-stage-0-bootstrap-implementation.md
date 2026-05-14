# ViewPro Stage 0 Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear el monorepo base de ViewPro dentro de `viewpro-app/` con pnpm, Turborepo, `apps/web`, `apps/api`, `packages/contracts` y `packages/config`, sin implementar todavía dominio de negocio.

**Architecture:** El repo raíz conserva documentación y `viewpro-app/` orquesta tareas con pnpm workspaces y Turborepo. `apps/web` y `apps/api` son aplicaciones independientes con scripts propios; `packages/contracts` queda preparado como frontera OpenAPI y `packages/config` centraliza configuración mínima cuando aporte claridad.

> Nota de implementación: todos los paths de apps/paquetes en este plan son relativos a `viewpro-app/`. Ejecutar `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck` y `pnpm test` con workdir `viewpro-app/`.

**Tech Stack:** pnpm, Turborepo, TypeScript, Next.js App Router, NestJS, OpenAPI/Swagger futuro.

---

## Reglas de ejecución

- No implementar dominio de ViewPro en esta etapa.
- No agregar Prisma, auth, Sentry, BullMQ ni TanStack Query todavía.
- No guardar tokens ni secretos reales.
- Mantener scripts explícitos por app.
- No commitear sin aprobación explícita del usuario, aunque este plan incluya mensajes sugeridos.

## Resultado esperado

Al finalizar esta etapa debe funcionar:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

Y debe existir esta estructura:

```txt
apps/
  web/
  api/
packages/
  contracts/
  config/
```

Estas carpetas viven dentro de `viewpro-app/`; `docs/` permanece en el repo raíz.

---

### Task 1: Crear workspace raíz pnpm + Turborepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `.gitignore`

**Step 1: Crear `package.json` raíz**

Contenido inicial:

```json
{
  "name": "viewpro",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.11.0",
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "pnpm --filter @viewpro/web dev",
    "dev:api": "pnpm --filter @viewpro/api start:dev",
    "build": "turbo build",
    "build:web": "pnpm --filter @viewpro/web build",
    "build:api": "pnpm --filter @viewpro/api build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "openapi:generate": "pnpm --filter @viewpro/contracts generate",
    "openapi:check": "pnpm --filter @viewpro/contracts check"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

**Step 2: Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Crear `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

**Step 4: Actualizar `.gitignore`**

Agregar si no existe:

```gitignore
node_modules/
.turbo/
dist/
.next/
coverage/
.env
.env.*
!.env.example
```

**Step 5: Instalar dependencias raíz**

Run:

```bash
pnpm install
```

Expected:

```txt
pnpm-lock.yaml creado
turbo instalado
```

**Step 6: Verificar scripts raíz sin apps todavía**

Run:

```bash
pnpm build
```

Expected:

```txt
No package tasks yet / no apps found, but turbo command is available.
```

**Suggested commit message:**

```bash
chore: initialize pnpm turbo workspace
```

---

### Task 2: Crear paquete `packages/config`

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig/base.json`
- Create: `packages/config/README.md`

**Step 1: Crear directorio `packages/config`**

Run:

```bash
mkdir -p packages/config/tsconfig
```

**Step 2: Crear `packages/config/package.json`**

```json
{
  "name": "@viewpro/config",
  "version": "0.0.0",
  "private": true,
  "files": [
    "tsconfig"
  ]
}
```

**Step 3: Crear `packages/config/tsconfig/base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Step 4: Crear `packages/config/README.md`**

```markdown
# @viewpro/config

Configuración compartida mínima para el monorepo ViewPro.

Regla: sólo agregar configuración compartida cuando reduzca duplicación real sin ocultar decisiones importantes de cada app.
```

**Step 5: Verificar workspace**

Run:

```bash
pnpm install
```

Expected:

```txt
@viewpro/config detectado como workspace package.
```

**Suggested commit message:**

```bash
chore: add shared config package
```

---

### Task 3: Crear paquete `packages/contracts`

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/generated/.gitkeep`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/README.md`

**Step 1: Crear estructura**

Run:

```bash
mkdir -p packages/contracts/src/generated
```

**Step 2: Crear `packages/contracts/package.json`**

```json
{
  "name": "@viewpro/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "echo 'contracts lint not configured yet'",
    "typecheck": "tsc --noEmit",
    "test": "echo 'contracts tests not configured yet'",
    "generate": "echo 'OpenAPI generation not configured yet'",
    "check": "echo 'OpenAPI contract check not configured yet'"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
```

**Step 3: Crear `packages/contracts/tsconfig.json`**

```json
{
  "extends": "../config/tsconfig/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 4: Crear `packages/contracts/src/index.ts`**

```ts
export type ApiContractStatus = 'not-generated-yet'

export const apiContractStatus: ApiContractStatus = 'not-generated-yet'
```

**Step 5: Crear `packages/contracts/src/generated/.gitkeep`**

Archivo vacío para reservar el directorio de tipos generados.

**Step 6: Crear `packages/contracts/README.md`**

```markdown
# @viewpro/contracts

Frontera de contrato entre `apps/api` y `apps/web`.

En etapas futuras, este paquete contendrá tipos y cliente generados desde OpenAPI.

Reglas:

- No agregar lógica de negocio.
- No importar Prisma.
- No importar React.
- No acoplarse a detalles internos de NestJS.
```

**Step 7: Verificar typecheck del paquete**

Run:

```bash
pnpm --filter @viewpro/contracts typecheck
```

Expected:

```txt
No TypeScript errors.
```

**Suggested commit message:**

```bash
chore: add contracts package placeholder
```

---

### Task 4: Crear `apps/api` con NestJS mínimo

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/.env.example`

**Step 1: Crear estructura**

Run:

```bash
mkdir -p apps/api/src/health
```

**Step 2: Crear `apps/api/package.json`**

```json
{
  "name": "@viewpro/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "lint": "echo 'api lint not configured yet'",
    "typecheck": "tsc --noEmit",
    "test": "echo 'api tests not configured yet'"
  },
  "dependencies": {
    "@nestjs/common": "latest",
    "@nestjs/core": "latest",
    "@nestjs/platform-express": "latest",
    "@nestjs/swagger": "latest",
    "reflect-metadata": "latest",
    "rxjs": "latest"
  },
  "devDependencies": {
    "@nestjs/cli": "latest",
    "@types/node": "latest",
    "typescript": "latest"
  }
}
```

**Step 3: Crear `apps/api/tsconfig.json`**

```json
{
  "extends": "../../packages/config/tsconfig/base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strictPropertyInitialization": false
  },
  "include": ["src/**/*.ts"]
}
```

**Step 4: Crear `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**Step 5: Crear `apps/api/src/main.ts`**

```ts
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const config = new DocumentBuilder()
    .setTitle('ViewPro API')
    .setDescription('REST API for ViewPro')
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT ?? 3001
  await app.listen(port)
}

void bootstrap()
```

**Step 6: Crear `apps/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

**Step 7: Crear health module/controller**

`apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-api'
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
    }
  }
}
```

**Step 8: Crear `apps/api/.env.example`**

```dotenv
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

**Step 9: Instalar y verificar API**

Run:

```bash
pnpm install
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api build
```

Expected:

```txt
Typecheck passes.
Nest build creates apps/api/dist.
```

**Suggested commit message:**

```bash
chore(api): add minimal nestjs app
```

---

### Task 5: Crear `apps/web` con Next.js mínimo

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(auth)/.gitkeep`
- Create: `apps/web/src/app/(platform)/.gitkeep`
- Create: `apps/web/src/app/(tenant-app)/.gitkeep`
- Create: `apps/web/src/app/(owner)/.gitkeep`
- Create: `apps/web/.env.example`

**Step 1: Crear estructura**

Run:

```bash
mkdir -p 'apps/web/src/app/(auth)' 'apps/web/src/app/(platform)' 'apps/web/src/app/(tenant-app)' 'apps/web/src/app/(owner)'
```

**Step 2: Crear `apps/web/package.json`**

```json
{
  "name": "@viewpro/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "echo 'web tests not configured yet'"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest"
  }
}
```

**Step 3: Crear `apps/web/tsconfig.json`**

```json
{
  "extends": "../../packages/config/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "jsx": "preserve",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Crear `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

**Step 5: Crear layout y home mínimos**

`apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'ViewPro',
  description: 'Seguimiento inmobiliario transparente para propietarios',
}

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
```

`apps/web/src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>ViewPro</h1>
      <p>No solo gestionás. Tu cliente lo ve.</p>
    </main>
  )
}
```

**Step 6: Reservar rutas por zona**

Crear archivos vacíos `.gitkeep` en:

```txt
apps/web/src/app/(auth)/.gitkeep
apps/web/src/app/(platform)/.gitkeep
apps/web/src/app/(tenant-app)/.gitkeep
apps/web/src/app/(owner)/.gitkeep
```

**Step 7: Crear `apps/web/.env.example`**

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Step 8: Instalar y verificar web**

Run:

```bash
pnpm install
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
```

Expected:

```txt
Typecheck passes.
Next build succeeds.
```

**Suggested commit message:**

```bash
chore(web): add minimal nextjs app
```

---

### Task 6: Verificar orquestación completa

**Files:**
- Modify: `README.md`

**Step 1: Ejecutar checks raíz**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Expected:

```txt
All configured workspace tasks pass.
Placeholder lint/test scripts complete without failing.
```

**Step 2: Probar dev local**

Run:

```bash
pnpm dev
```

Expected:

```txt
web runs on http://localhost:3000
api runs on http://localhost:3001/api/health
Swagger runs on http://localhost:3001/api/docs
```

**Step 3: Actualizar `README.md`**

```markdown
# ViewPro

SaaS multi-tenant para inmobiliarias. ViewPro permite que una inmobiliaria gestione propiedades, avances y documentación mientras el propietario ve qué está pasando.

## Stack inicial

- Monorepo con pnpm workspaces
- Turborepo
- `apps/web`: Next.js
- `apps/api`: NestJS
- `packages/contracts`: contrato OpenAPI/tipos
- `packages/config`: configuración compartida mínima

## Comandos

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs
```

**Step 4: Verificar status final**

Run:

```bash
git status --short
```

Expected:

```txt
Shows Stage 0 files plus existing planning docs.
No secrets or .env files tracked.
```

**Suggested commit message:**

```bash
chore: verify stage 0 bootstrap
```

---

## Acceptance checklist

- [ ] `pnpm-lock.yaml` existe.
- [ ] `pnpm install` funciona.
- [ ] `pnpm dev` levanta web y api.
- [ ] `pnpm build` funciona.
- [ ] `pnpm lint` funciona.
- [ ] `pnpm typecheck` funciona.
- [ ] `pnpm test` funciona, aunque haya placeholders.
- [ ] `apps/web` no importa código interno de `apps/api`.
- [ ] `apps/api` no importa código de UI.
- [ ] `packages/contracts` no contiene lógica de negocio.
- [ ] `.env.example` existe y `.env` real no se trackea.
- [ ] README explica cómo correr el proyecto.

## Out of scope

- Auth real.
- Prisma schema de dominio.
- Migraciones.
- Sentry.
- TanStack Query.
- UI final.
- Documentos/storage.
- Jobs/colas.
