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

## Property engagements backend

Stage 4 soporta propiedades físicas y gestiones inmobiliarias tenant-scoped desde la API. Todas estas rutas requieren autenticación, membership activa y header `x-tenant-id`:

- `POST /api/property-engagements`
- `GET /api/property-engagements`
- `GET /api/property-engagements/:id`
- `POST /api/property-engagements/:id/agents`

Los managers pueden crear, listar y leer todas las gestiones del tenant, además de asignar agentes del mismo tenant. Los agentes sólo listan y leen gestiones asignadas. Usuarios propietarios, ownership real y portal de propietario quedan fuera de alcance para Stage 4.

## Movements backend

Stage 5 soporta creación de movimientos y recuperación del timeline desde la API. Todas estas rutas requieren autenticación, membership activa y header `x-tenant-id`:

- `POST /api/property-engagements/:id/movements`: crea un movimiento en una gestión del tenant; el body puede incluir `newStatus` para actualizar el estado de la gestión junto con el movimiento.
- `GET /api/property-engagements/:id/movements`: lista el timeline paginado de movimientos de la gestión.

Managers acceden a todas las gestiones del tenant. Agentes acceden sólo a gestiones asignadas. Accesos cross-tenant o no asignados responden `404`. El display en portal propietario continúa como alcance futuro de Stage 6.

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs

## Regla de alcance Stage 5

Stage 5 incluye sólo backend de movimientos y timeline. No incluye UI, portal propietario, documentos, notificaciones ni endpoints demo de producción.
