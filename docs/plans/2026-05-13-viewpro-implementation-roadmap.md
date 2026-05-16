# Roadmap de Implementación ViewPro MVP

ViewPro se implementará por **slices verticales**. Cada etapa debe entregar una parte verificable del producto, evitando construir durante semanas “capas” aisladas que no prueban valor real.

## Decisión principal

No implementar así:

```txt
1. Toda la base de datos
2. Todo el backend
3. Todo el frontend
4. Recién ahí probar el producto
```

Implementar así:

```txt
Bootstrap técnico
→ auth + tenant real
→ propiedad + gestión
→ movimiento visible
→ propietario ve seguimiento
→ documentos
→ métricas
→ frontend MVP vertical
→ admin ViewPro operativo
→ hardening MVP
```

Regla:

> ViewPro empieza a existir cuando un vendedor carga un avance y un propietario lo ve.

## Etapa 0 — Bootstrap técnico

Objetivo:

Crear la base técnica del monorepo sin implementar dominio grande.

Incluye:

- pnpm workspace
- Turborepo
- `apps/web` con Next.js
- `apps/api` con NestJS
- `packages/contracts`
- `packages/config` si aporta
- scripts base
- env examples

Validación:

```txt
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

Resultado esperado:

Frontend y backend arrancan por separado y desde el comando raíz.

## Etapa 1 — Base backend real

Objetivo:

Tener una API NestJS lista para crecer con estructura correcta.

Incluye:

- configuración env
- health endpoint
- Swagger/OpenAPI
- Prisma inicial
- conexión PostgreSQL
- estructura de módulos base
- GlobalExceptionFilter
- ValidationPipe
- requestId/logging básico

No incluye todavía:

- auth completa
- dominio inmobiliario grande
- documentos
- colas
- Sentry completo

Validación:

- API arranca.
- Swagger disponible.
- Prisma conecta.
- Test básico de health pasa.

## Etapa 2 — Auth + registro de inmobiliaria

Objetivo:

Permitir que una inmobiliaria se registre y cree su gerente principal.

Flujo:

```txt
Usuario registra inmobiliaria
→ se crea user
→ se crea tenant
→ se crea tenant_membership como gerente principal
→ puede iniciar sesión
```

Incluye:

- modelo `users`
- modelo `tenants`
- modelo `tenant_memberships`
- password hashing
- login
- refresh token rotativo básico
- logout
- endpoint `/me`
- pantalla mínima de registro/login

Estado backend:

- Implementado en Stage 2: modelos Prisma, registro tenant, login, refresh rotativo, logout y `/me`.
- Pendiente fuera de este slice: pantalla mínima de registro/login.

Validación:

- usuario puede registrar inmobiliaria
- usuario puede iniciar sesión
- `/me` devuelve usuario y tenant
- no se guardan tokens en `localStorage`

## Etapa 3 — Tenant context + permisos

Objetivo:

Resolver correctamente quién es el usuario, en qué tenant opera y qué puede hacer.

Incluye:

- `TenantMembershipGuard`
- `PermissionGuard`
- perfiles iniciales
- permisos granulares en backend
- contexto de tenant en API mediante header `x-tenant-id`
- manejo de tenant suspendido o inválido

Estado backend:

- Implementado en Stage 3: guards `AuthGuard` → `TenantMembershipGuard` → `PermissionGuard`, permisos derivados del rol, `/me` con permisos y endpoint demo para validación e2e.
- Pendiente fuera de este slice: selección/cambio de tenant en frontend.

Validación:

- un usuario ve sólo tenants donde tiene membresía
- backend rechaza acceso cruzado
- UI oculta acciones sin permiso
- backend sigue siendo autoridad aunque la UI oculte botones
- requests protegidos por tenant envían `x-tenant-id`

## Etapa 4 — Propiedad física + gestión inmobiliaria

Objetivo:

Crear el corazón del dominio: propiedad física separada de gestión inmobiliaria.

Flujo:

```txt
Gerente/vendedor crea propiedad física
→ crea gestión inmobiliaria del tenant
→ asigna vendedores
```

Incluye:

- `property_assets`
- `property_engagements`
- `property_agents`
- listados paginados
- detalle de gestión
- filtros básicos por estado

Estado backend:

- Implementado en Stage 4: backend para `property_assets`, `property_engagements` y `property_agents` con endpoints tenant-scoped bajo `/api/property-engagements`.
- Todos los endpoints protegidos de gestiones requieren `x-tenant-id`; el backend valida membership y permisos antes de ejecutar casos de uso.
- Managers ven todas las gestiones del tenant; agentes ven sólo gestiones asignadas.
- Fuera de alcance de Stage 4: usuarios propietarios, portal propietario, ownership real (`property_asset_owners`), movimientos y documentos.

Validación:

- tenant A no ve gestiones de tenant B
- propiedad física y gestión no se mezclan
- una gestión puede tener varios vendedores
- listados usan paginación/filtros
- leer una gestión de otro tenant responde `404` para no filtrar existencia
- asignar agentes exige que el usuario pertenezca al mismo tenant

## Etapa 5 — Movimientos

Objetivo:

Permitir que el vendedor cargue avances visibles.

Este es el primer punto donde ViewPro empieza a entregar valor real.

Flujo:

```txt
Vendedor entra a una gestión asignada
→ carga movimiento en menos de 60 segundos
→ movimiento queda en timeline
→ propietario podrá verlo
```

Incluye:

- modelo `movements`
- endpoint crear movimiento
- endpoint timeline de gestión
- formulario mobile-first
- tipos fijos de movimiento
- próximo paso opcional
- métricas simples opcionales: consultas, visitas, oferta

Validación:

- vendedor asignado puede cargar movimiento
- vendedor no asignado no puede
- gerente puede ver movimientos del tenant
- movimiento aparece en timeline
- carga no exige formulario largo

Estado backend:

- Implementado en Stage 5: modelo `movements`, `POST /api/property-engagements/:id/movements` y `GET /api/property-engagements/:id/movements` para crear movimientos y recuperar timeline paginado.
- Los endpoints de timeline requieren `x-tenant-id`, autenticación, membership activa y permisos. Managers acceden a todas las gestiones del tenant; agentes sólo a gestiones asignadas.
- `POST /api/property-engagements/:id/movements` puede recibir `newStatus` para actualizar el estado de la gestión junto con el movimiento.
- Acceso cross-tenant o no asignado responde `404` para no filtrar existencia.
- Fuera de alcance de Stage 5: formulario/UI, display en portal propietario, documentos y notificaciones. El portal propietario continúa en Stage 6.

## Etapa 6 — Portal propietario

Objetivo:

El propietario ve sus propiedades y entiende qué está pasando.

Flujo:

```txt
Propietario inicia sesión
→ ve sus propiedades
→ entra al detalle
→ ve gestiones y movimientos visibles
→ puede consultar por WhatsApp
```

Incluye:

- APIs backend read-only para propiedades del propietario
- detalle sanitizado de propiedad física
- gestiones visibles bajo la propiedad
- timeline visible de movimientos
- base de ownership real con `PropertyAssetOwner`
- dashboard propietario, documentos, WhatsApp y eventos de analytics quedan para slices futuros

Validación:

- propietario sólo ve propiedades donde tiene acceso
- no ve datos internos de otras inmobiliarias
- entiende estado y últimos movimientos rápido
- click WhatsApp queda medido en un slice futuro, no en Stage 6 backend

Estado backend:

- Implementado en Stage 6: modelo `PropertyAssetOwner`, repositorio/use cases del portal propietario y endpoints read-only bajo `/api/owner/*`.
- Los endpoints usan cookies de auth y `AuthGuard` solamente; no requieren `x-tenant-id` ni `TenantMembershipGuard`.
- Owners son `User`s existentes vinculados por `PropertyAssetOwner(accessStatus: ACTIVE)`, no miembros del tenant.
- Recursos inexistentes, cross-tenant, revocados, no asignados o inaccesibles responden `404` para no filtrar existencia.
- Fuera de alcance de Stage 6 backend: owner UI, invitaciones, self-registration, documentos, WhatsApp tracking, billing y marketplace.

## Etapa 7 — Documentos

Objetivo:

Ordenar solicitudes documentales entre inmobiliaria y propietario.

Flujo:

```txt
Vendedor solicita documento
→ propietario sube archivo
→ vendedor/gerente aprueba o rechaza
→ queda historial de versiones
```

Incluye:

- `documents`
- `document_requests`
- `document_versions`
- signed upload URLs
- signed read URLs temporales
- aprobación/rechazo con motivo
- visibilidad por propiedad/gestión

Estado backend:

- Implementado en Stage 7: modelos `DocumentRequest`, `Document` y `DocumentVersion`, repositorio/use cases, storage abstraction, controllers internos y owner, tests unit/e2e y documentación.
- Endpoints internos entregados: `POST /api/property-engagements/:propertyEngagementId/document-requests`, `GET /api/document-requests`, `GET /api/document-requests/:id`, `POST /api/document-requests/:id/approve`, `POST /api/document-requests/:id/reject`, `POST /api/document-versions/:id/read-url`.
- Endpoints owner entregados: `GET /api/owner/document-requests`, `GET /api/owner/document-requests/:id`, `POST /api/owner/document-requests/:id/upload-url`, `POST /api/owner/document-versions/:id/confirm-upload`, `POST /api/owner/document-versions/:id/read-url`.
- Regla de propiedad documental: managers ven/revisan todas las solicitudes del tenant; vendedores sólo ven/revisan solicitudes que crearon; propietarios sólo acceden a solicitudes dirigidas a su usuario con acceso activo a la propiedad.
- URLs firmadas se crean sólo después de validar autorización. Stage 7 usa storage fake detrás de `DocumentStoragePort`; un adapter productivo S3/R2/MinIO queda fuera de alcance.

Validación:

- propietario sólo sube documentos solicitados
- backend valida permiso antes de signed URL
- documentos sensibles no quedan públicos
- rechazo exige motivo
- historial de versiones queda trazable

## Etapa 8 — Métricas piloto

Objetivo:

Medir si el MVP realmente funciona.

Métrica norte:

```txt
% de gestiones activas con al menos una actualización visible por semana
```

Eventos mínimos:

```txt
SELLER_LOGGED_IN
MOVEMENT_CREATED
PROPERTY_STATUS_CHANGED
OWNER_VIEWED_PROPERTY
DOCUMENT_REQUESTED
DOCUMENT_UPLOADED
DOCUMENT_APPROVED
DOCUMENT_REJECTED
```

Estado backend:

- Implementado en Stage 8: event log interno `analytics_events`, tracking desde auth/movimientos/owner/documents y reportes manager-only bajo `/api/analytics/*`.
- Endpoints entregados: `GET /api/analytics/pilot-summary`, `GET /api/analytics/inactive-engagements`, `GET /api/analytics/events`.
- La métrica norte usa, por ahora, gestiones activas con al menos un `MOVEMENT_CREATED` semanal como actualización visible para propietario.
- Regla de privacidad: metadata segura solamente; no guardar emails, nombres, direcciones completas, contenido documental, observaciones, tokens, passwords ni secretos.
- PostHog queda como adapter futuro, no fuente de verdad del piloto MVP.
- Diferidos: `OWNER_INVITED`, `OWNER_ACTIVATED`, `OWNER_VIEWED_DASHBOARD`, `WHATSAPP_CONTACT_CLICKED`.

Validación:

- eventos críticos se registran
- se puede consultar actividad semanal
- se detectan gestiones sin actualización
- se mide activación de propietarios

## Etapa 9 — Frontend MVP vertical

Objetivo:

Convertir el backend MVP en una aplicación usable por inmobiliarias y propietarios con una UI claro/editorial premium.

Incluye:

- login/registro y selección de tenant
- dashboard interno de inmobiliaria
- listado/detalle/creación de gestiones
- timeline y creación de movimientos mobile-first
- portal propietario con propiedades, detalle y timeline
- documentos internos y owner básicos
- dashboard visual de métricas piloto

Validación:

- gerente puede operar una gestión desde UI
- vendedor puede cargar un movimiento en menos de 60 segundos
- propietario puede entender el avance sin pedirlo por WhatsApp
- frontend typecheck/build pasan
- la UI no parece template genérico ni “primera UI hecha por AI”

## Etapa 10 — Admin ViewPro operativo

Objetivo:

Dar al equipo ViewPro una pantalla interna para operar y monitorear el piloto completo.

Incluye primera versión read-only:

- listado de inmobiliarias/tenants
- actividad global del piloto
- tenants sin uso reciente
- conteos por tenant de gestiones, documentos y eventos
- soporte operativo básico sin impersonar usuarios

No incluye inicialmente:

- edición peligrosa de tenants
- borrado de datos
- impersonación
- acceso a contenido privado de documentos
- billing

Validación:

- ViewPro puede ver salud general del piloto
- se detectan tenants/inmobiliarias sin actividad
- no se expone información sensible innecesaria

## Etapa 11 — Hardening MVP

Objetivo:

Preparar el piloto real con seguridad, observabilidad y estabilidad razonable.

Incluye:

- tests críticos backend
- smoke tests frontend
- Sentry frontend/backend
- rate limiting login/reset
- CORS correcto
- sanitización de errores
- backups/restore básico documentado
- revisión de permisos multi-tenant
- deploy staging/producción

Validación:

- flujos críticos probados
- errores llegan a Sentry sin datos sensibles
- tenant isolation probado
- app deployada en ambiente piloto

## Primer slice funcional real

El primer slice que demuestra valor es:

```txt
Gerente crea gestión
→ vendedor carga movimiento
→ propietario ve avance
```

Este slice debe guiar las decisiones de implementación. Si una tarea no ayuda a llegar ahí, probablemente puede esperar.

## Criterio de prioridad

Priorizar lo que reduce incertidumbre de producto:

1. ¿La inmobiliaria puede cargar seguimiento?
2. ¿El vendedor lo usa sin fricción?
3. ¿El propietario entiende qué pasa?
4. ¿Se reducen consultas repetidas?
5. ¿El gerente gana visibilidad?

## Qué queda explícitamente para después

- marketplace/portal público
- compradores/inquilinos como usuarios
- WhatsApp Business API
- pagos automáticos
- app mobile nativa
- IA
- estados configurables por inmobiliaria
- permisos editables avanzados
- recompensas/puntos
- reportes BI avanzados

## Próximo paso

Después de aprobar este roadmap:

1. Crear el plan de implementación de la Etapa 0.
2. Ejecutar bootstrap técnico.
3. Commit pequeño y verificable.
4. Continuar con Etapa 1.
