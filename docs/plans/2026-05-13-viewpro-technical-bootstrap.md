# Bootstrap Técnico ViewPro MVP

ViewPro arrancará con **pnpm + Turborepo liviano** dentro de `viewpro-app/`, manteniendo la documentación en el repo raíz. El objetivo es tener frontend y backend separados, scripts claros y una base que escale sin convertir el setup inicial en una plataforma compleja.

## Decisión principal

| Tema | Decisión |
|---|---|
| Package manager | pnpm |
| Monorepo runner | Turborepo |
| Frontend | `apps/web` con Next.js App Router |
| Backend | `apps/api` con NestJS |
| Contratos | `packages/contracts` |
| Config compartida | `packages/config` |
| ORM | Prisma, cuando se inicialice backend persistente |
| API contract | REST + OpenAPI/Swagger |

Regla:

> El bootstrap debe ser chico, explícito y fácil de entender. No meter tooling pesado antes de tener dolor real.

## Por qué pnpm

pnpm es la mejor opción inicial para ViewPro porque:

- funciona muy bien con workspaces
- instala rápido
- evita duplicación innecesaria de dependencias
- tiene lockfile claro
- permite scripts por app y por paquete
- es estándar en monorepos modernos

Regla de seguridad:

> No instalar paquetes desde `latest` a ciegas. Revisar lockfile y mantener instalaciones reproducibles.

## Por qué Turborepo

Turborepo alcanza para el MVP porque permite:

- correr tareas por workspace
- cachear builds/checks
- filtrar por app
- mantener scripts simples
- escalar sin forzar una arquitectura compleja

No se elige Nx al inicio porque sería demasiado para una sola persona en esta etapa. Nx puede ser útil más adelante si aparecen necesidades reales de generators, ownership complejo o CI avanzado.

## Estructura inicial

```txt
Viewpro/
  viewpro-app/
    apps/
      web/
      api/

    packages/
      contracts/
      config/

    package.json
    pnpm-workspace.yaml
    turbo.json

  docs/
    plans/
    diagrams/
```

Los comandos pnpm se ejecutan desde `viewpro-app/`.

## Scripts raíz

Scripts esperados en el `package.json` raíz:

```txt
pnpm dev          → levanta web + api
pnpm dev:web      → levanta sólo Next.js
pnpm dev:api      → levanta sólo NestJS

pnpm build        → build general con turbo
pnpm build:web    → build frontend
pnpm build:api    → build backend

pnpm lint         → lint general
pnpm typecheck    → typecheck general
pnpm test         → tests generales

pnpm db:generate  → Prisma generate
pnpm db:migrate   → Prisma migrate dev
pnpm db:studio    → Prisma Studio

pnpm openapi:generate → genera contrato/cliente desde backend
pnpm openapi:check    → valida contrato sincronizado
```

No todos los scripts tienen que existir el primer día. La idea es definir el mapa para no improvisar nombres después.

## Orden de bootstrap

### 1. Base del workspace

Crear:

```txt
package.json
pnpm-workspace.yaml
turbo.json
```

Objetivo:

- instalar dependencias con pnpm
- definir workspaces
- preparar scripts base
- no agregar frameworks todavía

### 2. Backend NestJS

Crear `apps/api`.

Debe incluir al inicio:

- NestJS
- estructura base por módulos
- health check simple
- configuración env mínima
- Swagger/OpenAPI preparado

No meter todavía:

- auth completa
- Prisma schema complejo
- BullMQ
- Sentry
- módulos de dominio grandes

Primero se valida que la API arranque bien y exponga una base ordenada.

### 3. Frontend Next.js

Crear `apps/web`.

Debe incluir al inicio:

- Next.js App Router
- TypeScript
- estructura de zonas vacía
- layout base
- configuración env mínima
- preparación para cliente API

No meter todavía:

- dashboard final
- UI compleja
- flows reales
- TanStack Query hasta tener endpoints reales o mocks útiles

### 4. Contracts

Crear `packages/contracts`.

Primera versión:

- paquete vacío o mínimo
- lugar definido para tipos generados
- scripts preparados para OpenAPI

Más adelante:

```txt
apps/api OpenAPI JSON
→ packages/contracts generated types
→ apps/web consume types/client
```

### 5. Config compartida

Crear `packages/config` sólo si simplifica.

Puede contener:

- TypeScript base config
- ESLint config compartida

Regla:

> Config compartida sí, abstracción innecesaria no.

Si mantener config compartida complica más de lo que ayuda, se deja configuración local por app.

## Variables de entorno

Cada app debe tener env separada.

```txt
apps/web/.env.local
apps/api/.env
```

Reglas:

- no commitear secretos
- usar `.env.example`
- separar variables públicas Next.js con prefijo explícito
- no exponer secretos backend al frontend

Ejemplo conceptual:

```txt
apps/web
  NEXT_PUBLIC_API_URL=

apps/api
  DATABASE_URL=
  JWT_SECRET=
  CORS_ORIGIN=
```

## Dependencias iniciales

### Raíz

Mínimas:

- `turbo`
- `typescript` si se centraliza
- tooling compartido sólo si aporta

### `apps/api`

Inicial:

- NestJS core
- Swagger
- config/env
- validation pipe

Después:

- Prisma
- auth
- Sentry
- BullMQ
- storage SDK

### `apps/web`

Inicial:

- Next.js
- React
- TypeScript

Después:

- TanStack Query
- OpenAPI client
- Sentry
- librería UI cuando se defina diseño visual

## Testing inicial

No buscar coverage artificial.

Checks mínimos al principio:

```txt
apps/api
  → test de health endpoint
  → test e2e básico con Supertest cuando exista estructura

apps/web
  → typecheck
  → build
  → smoke test futuro con Playwright
```

Los tests importantes vienen cuando haya dominio real:

- registro de inmobiliaria
- login
- tenant context
- crear propiedad/gestión
- cargar movimiento
- propietario visualiza seguimiento

## CI inicial

El CI debe reflejar los límites del monorepo.

Primera versión:

```txt
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Después se puede optimizar por paths:

```txt
apps/web changed → checks web
apps/api changed → checks api
contracts changed → regenerar/validar cliente
docs changed → no build pesado
```

## Guardrails contra deuda técnica

- No importar código backend desde frontend.
- No compartir entidades internas de Prisma con UI.
- No crear paquetes compartidos genéricos sin necesidad real.
- No meter Nx, microservicios o CI complejo antes de necesitarlos.
- No guardar tokens en `localStorage`.
- No acoplar deploy de `web` y `api`.
- Mantener OpenAPI como frontera.

## Primer hito técnico

El bootstrap está bien hecho cuando se pueda ejecutar:

```txt
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

Y existan:

```txt
apps/web funcionando
apps/api funcionando
packages/contracts preparado
docs actualizados
```

Sin haber implementado todavía el dominio grande de ViewPro.

## Próximo paso

Después de este bootstrap:

1. Crear roadmap de implementación por etapas.
2. Definir el primer slice funcional: auth + tenant registration o base API.
3. Recién ahí empezar a escribir código de aplicación.
