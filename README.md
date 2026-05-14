# ViewPro

SaaS multi-tenant para inmobiliarias. ViewPro permite que una inmobiliaria gestione propiedades, avances y documentación mientras el propietario ve qué está pasando.

## Estructura del repo

- `docs/`: documentación, planes y decisiones de arquitectura.
- `viewpro-app/`: monorepo técnico con apps y paquetes ejecutables.

## Comandos de desarrollo

Ejecutar los comandos desde `viewpro-app/`:

```bash
cd viewpro-app
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

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs

## Auth backend

Stage 2 agrega autenticación propia para registrar una inmobiliaria y su gerente principal.

Endpoints principales:

- `POST /api/auth/register-tenant`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

La API usa cookies `httpOnly` para access y refresh tokens; el frontend no debe guardar tokens en `localStorage`.

## Tenant context backend

Stage 3 agrega contexto de tenant y permisos backend. Las llamadas protegidas que operen dentro de una inmobiliaria deben enviar `x-tenant-id`; la API valida que el usuario autenticado tenga membership activa y permiso suficiente antes de ejecutar la acción.
