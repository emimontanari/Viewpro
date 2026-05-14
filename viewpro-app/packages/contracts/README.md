# @viewpro/contracts

Frontera de contrato entre `apps/api` y `apps/web`.

En etapas futuras, este paquete contendrá tipos y cliente generados desde OpenAPI.

Reglas:

- No agregar lógica de negocio.
- No importar Prisma.
- No importar React.
- No acoplarse a detalles internos de NestJS.
