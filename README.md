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

## Property engagements backend

Stage 4 agrega backend para propiedades físicas y gestiones inmobiliarias tenant-scoped. Los endpoints protegidos requieren sesión válida y header `x-tenant-id`:

- `POST /api/property-engagements`: crea una propiedad física y su gestión inmobiliaria para el tenant actual.
- `GET /api/property-engagements`: lista gestiones paginadas del tenant actual.
- `GET /api/property-engagements/:id`: lee el detalle de una gestión del tenant actual.
- `POST /api/property-engagements/:id/agents`: asigna un agente miembro del mismo tenant.

Los roles manager ven todas las gestiones del tenant; los agentes sólo ven gestiones asignadas. Usuarios propietarios y portal de propietario siguen fuera de alcance en Stage 4.

## Movements backend

Stage 5 agrega backend para cargar avances y recuperar el timeline de una gestión inmobiliaria. Los endpoints protegidos requieren sesión válida y header `x-tenant-id`:

- `POST /api/property-engagements/:id/movements`: crea un movimiento para la gestión del tenant actual; opcionalmente puede enviar `newStatus` para actualizar el estado de la gestión en la misma operación.
- `GET /api/property-engagements/:id/movements`: devuelve el timeline paginado de movimientos de esa gestión.

Managers pueden crear y leer movimientos de cualquier gestión del tenant. Agentes sólo pueden hacerlo sobre gestiones asignadas. Accesos cross-tenant o a gestiones no asignadas responden `404` para no filtrar existencia. La visualización en portal propietario sigue pendiente para Stage 6.

## Owner portal backend

Stage 6 agrega APIs backend read-only para propietarios existentes. Los propietarios son `User`s autenticados vinculados a propiedades por `PropertyAssetOwner` con acceso `ACTIVE`; no necesitan ser `TenantMembership`s y estas rutas no requieren `x-tenant-id`:

- `GET /api/owner/properties`: lista propiedades activas del propietario autenticado.
- `GET /api/owner/properties/:propertyAssetId`: devuelve el detalle sanitizado de una propiedad accesible.
- `GET /api/owner/properties/:propertyAssetId/engagements`: lista gestiones visibles bajo esa propiedad.
- `GET /api/owner/engagements/:engagementId/timeline`: devuelve el timeline paginado visible para el propietario.

Recursos inexistentes, cross-tenant, revocados, no asignados o inaccesibles responden `404` para no filtrar existencia. Invitaciones, self-registration, UI, documentos, billing, marketplace y tracking de WhatsApp siguen fuera de alcance.

## Documents backend

Stage 7 agrega el flujo backend de solicitudes documentales. La API guarda metadata en Postgres y entrega URLs firmadas sólo después de validar autorización; los bytes quedan detrás de una abstracción `DocumentStoragePort`. En esta etapa se usa un adapter fake/determinístico para tests y backend inicial: no hay proveedor productivo S3/R2/MinIO todavía.

Endpoints internos con sesión, `x-tenant-id`, membership y permisos:

- `POST /api/property-engagements/:propertyEngagementId/document-requests`
- `GET /api/document-requests`
- `GET /api/document-requests/:id`
- `POST /api/document-requests/:id/approve`
- `POST /api/document-requests/:id/reject`
- `POST /api/document-versions/:id/read-url`

Managers ven y revisan todas las solicitudes del tenant. Vendedores/agentes sólo ven y revisan solicitudes que ellos crearon (`requestedByUserId`); vendedores pares, cross-tenant o recursos inexistentes responden `404`.

Endpoints de propietario con `AuthGuard` solamente, sin `x-tenant-id`:

- `GET /api/owner/document-requests`
- `GET /api/owner/document-requests/:id`
- `POST /api/owner/document-requests/:id/upload-url`
- `POST /api/owner/document-versions/:id/confirm-upload`
- `POST /api/owner/document-versions/:id/read-url`

Las solicitudes documentales se dirigen al vínculo `PropertyAssetOwner`, por lo que propietarios `INVITED` o `ACTIVE` pueden recibir pedidos sin crear usuarios falsos. El portal propietario sigue autenticado: un propietario sólo ve/sube solicitudes cuando ese vínculo está `ACTIVE` y su `userId` coincide con el usuario actual. El upload acepta PDF/JPEG/PNG/WebP hasta 10 MB, crea una versión `PENDING_UPLOAD`, confirma la subida como `UPLOADED` y mueve la solicitud a `SUBMITTED` para aprobación o rechazo interno.

## Pilot analytics backend

Stage 8 agrega un event log interno en Postgres (`analytics_events`) para medir el piloto sin depender de PostHog. El backend emite eventos seguros para login, movimientos, vistas owner y documentos; la metadata debe contener sólo IDs/enums seguros y nunca emails, nombres, direcciones completas, contenido documental, observaciones, tokens, passwords ni secretos.

Endpoints internos de reportes con sesión, `x-tenant-id`, membership y permisos de manager:

- `GET /api/analytics/pilot-summary`: resumen semanal con métrica norte, conteos documentales y vistas owner.
- `GET /api/analytics/inactive-engagements`: gestiones activas sin `MOVEMENT_CREATED` reciente; ventana default 7 días.
- `GET /api/analytics/events`: auditoría paginada de eventos del tenant.

Managers/gerentes acceden a reportes agregados; agentes/vendedores no. PostHog queda como adapter futuro de visualización/exportación, no como fuente de verdad del MVP.
