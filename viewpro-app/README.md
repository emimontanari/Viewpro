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
pnpm db:migrate
pnpm db:generate
pnpm db:down
```

## Base de datos local

```bash
pnpm db:up
pnpm db:migrate
pnpm db:generate
pnpm db:down
```

La base local usa PostgreSQL en Docker con credenciales de desarrollo definidas en `apps/api/.env.example`.
Para aplicar migraciones:

```bash
pnpm db:migrate
```

Si el entorno local no tiene `apps/api/.env`, copiá `apps/api/.env.example` antes de ejecutar comandos de Prisma.

## Auth backend

La API expone auth propia multi-tenant inicial:

- `POST /api/auth/register-tenant`: crea `User`, `Tenant` y `TenantMembership` `PRINCIPAL_MANAGER`.
- `POST /api/auth/login`: valida credenciales y setea cookies `httpOnly`.
- `POST /api/auth/refresh`: rota refresh token opaco hasheado en base de datos.
- `POST /api/auth/logout`: revoca refresh token y limpia cookies.
- `GET /api/auth/me`: lee el usuario autenticado y sus memberships desde la base.

Los tokens no se devuelven en JSON ni deben guardarse en `localStorage`.

## Tenant context backend

Las rutas protegidas por tenant usan el header `x-tenant-id`. El frontend puede navegar por slug para UX, pero la API valida el `tenantId` real contra la membership del usuario y sus permisos derivados del rol.

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs

## Regla de alcance Stage 3

Stage 3 incluye sólo contexto de tenant y permisos backend, más endpoints demo explícitos para pruebas. No incluye UI de selección de tenant, roles editables ni endpoints reales de dominio.
