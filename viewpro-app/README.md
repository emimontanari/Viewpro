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

## Base de datos de tests API

Los tests del API hacen limpieza destructiva de tablas. Para proteger la DB local de desarrollo, Vitest carga `apps/api/.env.test`/defaults de test y la API falla rápido si `DATABASE_URL` no apunta a una base claramente de test.

Setup local recomendado:

```bash
cd viewpro-app
pnpm db:up
docker compose exec -T postgres createdb -U viewpro viewpro_test 2>/dev/null || true
DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' pnpm --filter api exec prisma migrate deploy
```

Opcionalmente copiá `apps/api/.env.test.example` a `apps/api/.env.test`. Nunca apuntes los e2e a `viewpro`; el guard debe rechazarlo antes de ejecutar cualquier `deleteMany()`.

## Backup and restore básico

El estado durable actual de ViewPro vive en PostgreSQL. Las migraciones Prisma están versionadas en el repo; los dumps respaldan datos, no secretos ni variables de entorno.

### Backup local

Desde `viewpro-app/`, con la base local levantada:

```bash
pnpm db:up
mkdir -p backups
docker compose exec -T postgres pg_dump -U viewpro -d viewpro --format=custom --no-owner --no-acl > backups/viewpro-$(date +%Y%m%d-%H%M%S).dump
```

### Verificar que el dump se puede leer

```bash
docker compose exec -T postgres pg_restore --list < backups/<dump-file>.dump
```

### Restore seguro en base aislada

Nunca restaures primero sobre la base activa de desarrollo o producción. Probá siempre en una base descartable:

```bash
docker compose exec -T postgres dropdb -U viewpro --if-exists viewpro_restore_check
docker compose exec -T postgres createdb -U viewpro viewpro_restore_check
docker compose exec -T postgres pg_restore -U viewpro -d viewpro_restore_check --clean --if-exists --no-owner --no-acl < backups/<dump-file>.dump
```

### Checklist post-restore

- El archivo `.dump` existe y no está vacío.
- `pg_restore --list` puede leer el dump.
- El restore termina sin errores en `viewpro_restore_check`.
- Existen tablas core: `users`, `tenants`, `tenant_memberships`, `property_engagements`, `movements`, `document_requests`, `documents`, `document_versions`, `analytics_events`.
- La app puede conectarse a la base restaurada si se apunta temporalmente a ella.
- No se restauró sobre una base activa por accidente.

### Producción

En PostgreSQL gestionado, preferí backups automáticos y PITR del proveedor cuando estén disponibles. Este runbook manual sirve como verificación o mecanismo de portabilidad; no reemplaza una estrategia de backup gestionada.

Antes del piloto real tiene que estar definido:

- proveedor de PostgreSQL;
- retención de backups;
- restore probado al menos una vez en una base no productiva;
- dueño del procedimiento de restore;
- ubicación de backups;
- secretos guardados fuera de dumps de base de datos.

### Document storage

La metadata documental vive en PostgreSQL y queda cubierta por el dump. Los bytes de documentos todavía no están respaldados por storage real porque Stage 7 usa un adapter fake; cuando exista S3/R2/MinIO u otro storage productivo, ese storage necesitará su propia política de backup y restore.

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
- `POST /api/property-engagements/:id/images`
- `DELETE /api/property-engagements/:id/images/:imageId`
- `POST /api/property-engagements/:id/agents`

Los managers pueden crear, listar y leer todas las gestiones del tenant, además de asignar agentes del mismo tenant. Los agentes sólo listan y leen gestiones asignadas. Usuarios propietarios, ownership real y portal de propietario quedan fuera de alcance para Stage 4.

Las imágenes de propiedades usan storage local en desarrollo. Por defecto se guardan bajo `apps/api/uploads`; se puede configurar `PROPERTY_IMAGES_UPLOADS_ROOT` para separar entornos. Los tests API usan `uploads-test` para no borrar imágenes cargadas en la base de desarrollo.

## Movements backend

Stage 5 soporta creación de movimientos y recuperación del timeline desde la API. Todas estas rutas requieren autenticación, membership activa y header `x-tenant-id`:

- `POST /api/property-engagements/:id/movements`: crea un movimiento en una gestión del tenant; el body puede incluir `newStatus` para actualizar el estado de la gestión junto con el movimiento.
- `GET /api/property-engagements/:id/movements`: lista el timeline paginado de movimientos de la gestión.

Managers acceden a todas las gestiones del tenant. Agentes acceden sólo a gestiones asignadas. Accesos cross-tenant o no asignados responden `404`. El display en portal propietario continúa como alcance futuro de Stage 6.

## Owner portal backend

Stage 6 soporta el portal propietario desde APIs backend read-only. Estas rutas usan cookies de auth existentes, `AuthGuard` solamente y no requieren `x-tenant-id`, porque el propietario no opera dentro del workspace de una inmobiliaria:

- `GET /api/owner/properties`
- `GET /api/owner/properties/:propertyAssetId`
- `GET /api/owner/properties/:propertyAssetId/engagements`
- `GET /api/owner/engagements/:engagementId/timeline`

El acceso se resuelve con `PropertyAssetOwner(accessStatus: ACTIVE)`, no con `TenantMembership`. Las respuestas exponen datos sanitizados de propiedad, gestión, agentes y movimientos; recursos revocados, ajenos o inaccesibles responden `404`. Invitaciones, self-registration, UI, documentos y tracking de WhatsApp quedan fuera de alcance.

## Documents backend

Stage 7 soporta solicitudes documentales backend entre inmobiliaria y propietarios. La metadata vive en Postgres (`DocumentRequest`, `Document`, `DocumentVersion`) y los archivos se acceden mediante URLs firmadas generadas después de validar permisos. El storage queda detrás de `DocumentStoragePort`; esta etapa usa adapter fake y no incluye proveedor productivo S3/R2/MinIO.

Rutas internas con auth, tenant y permisos:

- `POST /api/property-engagements/:propertyEngagementId/document-requests`
- `GET /api/document-requests`
- `GET /api/document-requests/:id`
- `POST /api/document-requests/:id/approve`
- `POST /api/document-requests/:id/reject`
- `POST /api/document-versions/:id/read-url`

Managers administran todas las solicitudes del tenant. Vendedores sólo administran solicitudes propias (`requestedByUserId`). Recursos de vendedores pares, cross-tenant o inexistentes responden `404` para no filtrar existencia.

Rutas owner con cookies de auth y sin `x-tenant-id`:

- `GET /api/owner/document-requests`
- `GET /api/owner/document-requests/:id`
- `POST /api/owner/document-requests/:id/upload-url`
- `POST /api/owner/document-versions/:id/confirm-upload`
- `POST /api/owner/document-versions/:id/read-url`

El upload owner valida propiedad activa, estado de solicitud, MIME permitido (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) y tamaño máximo de 10 MB. Confirmar la subida marca la versión como `UPLOADED`, la vuelve versión actual y deja la solicitud en `SUBMITTED`.

## Apps

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- API docs: http://localhost:3001/api/docs

## Regla de alcance Stage 7

Stage 7 incluye sólo backend de documentos, e2e y documentación. No incluye UI, notificaciones, analytics, OCR, antivirus, previews, links públicos ni integración productiva de storage.

## Pilot analytics backend

Stage 8 usa `analytics_events` como event log interno del piloto. Los eventos actuales son `SELLER_LOGGED_IN`, `MOVEMENT_CREATED`, `PROPERTY_STATUS_CHANGED`, `OWNER_VIEWED_PROPERTY`, `DOCUMENT_REQUESTED`, `DOCUMENT_UPLOADED`, `DOCUMENT_APPROVED` y `DOCUMENT_REJECTED`.

Regla de seguridad: guardar sólo IDs y metadata segura basada en enums/fuentes; no guardar emails, nombres, direcciones completas, contenido documental, observaciones de movimientos, tokens, passwords ni secretos.

Rutas internas con auth, tenant y permiso manager (`engagements.view_all`):

- `GET /api/analytics/pilot-summary`
- `GET /api/analytics/inactive-engagements`
- `GET /api/analytics/events`

Los reportes siempre filtran por tenant. PostHog queda fuera de Stage 8 como adapter futuro para dashboards/exportación.
