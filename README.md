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
```

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs
