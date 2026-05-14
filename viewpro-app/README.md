# ViewPro App

Monorepo técnico de ViewPro. Este directorio contiene las apps y paquetes ejecutables; la documentación de producto y arquitectura queda en el repo raíz bajo `docs/`.

## Stack inicial

- Monorepo con pnpm workspaces
- Turborepo
- `apps/web`: Next.js
- `apps/api`: NestJS
- `packages/contracts`: contrato OpenAPI/tipos
- `packages/config`: configuración compartida mínima

## Comandos

Ejecutar desde `viewpro-app/`:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:up
pnpm db:generate
pnpm db:down
```

## Base de datos local

```bash
pnpm db:up
pnpm db:generate
pnpm db:down
```

La base local usa PostgreSQL en Docker con credenciales de desarrollo definidas en `apps/api/.env.example`.

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs

## Regla de alcance Stage 1

Este backend foundation no incluye dominio, auth real, Sentry, BullMQ, TanStack Query, storage ni UI final.
