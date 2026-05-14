# Arquitectura Backend ViewPro MVP

ViewPro usará un backend NestJS separado del frontend. La arquitectura será un monolito modular: una sola aplicación desplegable, organizada por módulos de dominio para soportar crecimiento sin caer en servicios gigantes.

## Decisiones principales

| Tema | Decisión |
|---|---|
| Backend | NestJS separado del frontend |
| Arquitectura | Monolito modular |
| Patrón interno | Controllers + Use Cases + Repositories |
| ORM | Prisma |
| Migraciones | Prisma Migrate |
| API | REST + OpenAPI/Swagger |
| Async jobs | BullMQ |
| Eventos internos | NestJS EventEmitter |
| Storage | S3-compatible, recomendado Cloudflare R2 |
| Auth | Propia en NestJS |
| Monitoring | Sentry frontend/backend |
| Testing | Flujos críticos, no coverage artificial |

## Principio base

```txt
Frontend Next.js
  → consume REST API documentada con OpenAPI

Backend NestJS
  → protege dominio, permisos, datos y procesos
```

Separar frontend/backend no garantiza escalabilidad por sí solo. La escalabilidad real depende de:

- módulos bien separados
- multi-tenancy sólido
- base de datos bien modelada
- queries paginadas e indexadas
- colas para tareas pesadas
- observabilidad
- tests en flujos críticos

## Capas internas

Cada módulo core debe seguir esta idea:

```txt
Controller
  → Use Case
    → Repository Interface
      → Prisma Repository
        → PostgreSQL
```

### Controllers

Reciben HTTP, validan DTOs y delegan.

No contienen lógica de negocio.

### Use Cases

Orquestan una intención concreta.

Ejemplos:

- `CreatePropertyEngagementUseCase`
- `AssignAgentToEngagementUseCase`
- `CreateMovementUseCase`
- `RequestDocumentUseCase`
- `ApproveDocumentUseCase`
- `ChangeEngagementStatusUseCase`

### Repositories

Abstraen acceso a datos.

Los use cases dependen de interfaces, no de Prisma directamente.

### Domain

Contiene reglas del negocio.

Ejemplos:

- un vendedor no asignado no puede cargar movimientos
- un documento rechazado necesita motivo
- una gestión cerrada no consume cupo activo

## Estructura por módulo

```txt
module/
  controllers/
  use-cases/
  repositories/
  domain/
  dto/
  events/
```

Ejemplo:

```txt
property-engagements/
  property-engagements.module.ts
  controllers/
    property-engagements.controller.ts
  use-cases/
    create-property-engagement.use-case.ts
    change-engagement-status.use-case.ts
    list-tenant-engagements.use-case.ts
  repositories/
    property-engagements.repository.ts
    prisma-property-engagements.repository.ts
  domain/
    property-engagement.entity.ts
    engagement-status.ts
  dto/
    create-property-engagement.dto.ts
  events/
    engagement-created.event.ts
    engagement-status-changed.event.ts
```

## Módulos principales

### `AuthModule`

Responsable de:

- registro
- login
- refresh tokens
- logout
- reset password
- email verification

Auth será propia en NestJS.

### `UsersModule`

Identidad global de personas.

Un usuario puede ser vendedor en varias inmobiliarias o propietario de varias propiedades.

### `TenantsModule`

Inmobiliarias.

Maneja:

- creación de tenant
- estado del tenant
- activación/suspensión
- datos generales

### `MembershipsModule`

Relación usuario ↔ inmobiliaria.

```txt
user + tenant + rol/perfil
```

Soporta vendedores o gerentes en varias inmobiliarias.

### `TenantLimitsModule`

Límites operativos manuales por inmobiliaria.

No hay planes/billing en MVP.

### `PropertyAssetsModule`

Propiedad física única.

No maneja estado comercial.

### `PropertyEngagementsModule`

Gestión comercial de una inmobiliaria sobre una propiedad física.

Maneja:

- tenant
- operación venta/alquiler
- estado
- precio publicado
- ciclo comercial

### `PropertyAgentsModule`

Vendedores asignados a una gestión.

No hay vendedor principal en MVP.

### `MovementsModule`

Avances manuales cargados por vendedores.

### `StatusModule`

Cambios de estado e historial.

Puede vivir cerca de `PropertyEngagementsModule`, pero conceptualmente es una responsabilidad separada.

### `DocumentsModule`

Solicitudes documentales, versiones, aprobación/rechazo y visibilidad.

### `ActivityEventsModule`

Eventos automáticos visibles en timelines.

Ejemplos:

- documento aprobado
- estado cambiado
- propietario invitado

### `NotificationsModule`

Emails, notificaciones internas y links WhatsApp.

### `AuditModule`

Trazabilidad sensible.

No mezclar con logs técnicos.

### `AnalyticsModule`

Eventos de uso para validar piloto.

Ejemplos:

- `movement_created`
- `owner_viewed_property`
- `document_uploaded`

## Tenant Context y permisos

Cada request protegida debe resolver:

```txt
current_user
current_tenant opcional
current_membership opcional
permissions
```

Tipos de acceso:

- platform access
- tenant access
- owner access

Guards recomendados:

- `AuthGuard`
- `PlatformGuard`
- `TenantMembershipGuard`
- `PermissionGuard`
- `PropertyOwnerAccessGuard`

Regla:

> El frontend puede mandar IDs, pero el backend siempre valida acceso y contexto.

## Permisos

MVP:

- UI con perfiles predefinidos
- backend con permisos granulares

Ejemplo:

```txt
manager_supervisor:
  - engagements.view_all
  - movements.view_all
  - documents.view_all

agent:
  - engagements.view_assigned
  - movements.create
  - documents.request
  - documents.review_own
```

Futuro:

- perfiles editables por inmobiliaria
- scopes por sucursal/equipo

## Eventos internos y colas

Usar eventos internos de NestJS para desacoplar módulos.

Ejemplos:

```txt
movement.created
status.changed
document.requested
document.uploaded
document.approved
document.rejected
owner.invited
agent.assigned
tenant.limit_reached
```

Flujo ejemplo:

```txt
DocumentsModule aprueba documento
→ emite document.approved
→ ActivityEventsHandler crea evento visible
→ NotificationsHandler encola email
→ AnalyticsHandler registra métrica
```

BullMQ se usa para:

- emails
- procesamiento de archivos
- reintentos
- jobs programados
- notificaciones futuras

## Transacciones

Use cases críticos usan transacciones Prisma.

Regla:

```txt
DB consistente primero.
Efectos externos después.
```

Ejemplo:

```txt
ApproveDocumentUseCase
  transaction:
    - actualizar document_request
    - actualizar document_version
    - crear activity_event

  after commit:
    - emitir document.approved
    - encolar email
    - registrar analytics
```

## Storage

Archivos fuera de Postgres.

```txt
PostgreSQL → metadata
Cloudflare R2/S3-compatible → archivo real
```

Usar `StorageService` abstracto:

- `uploadFile()`
- `getSignedUrl()`
- `deleteFile()`
- `getMetadata()`

Reglas:

- no URLs públicas permanentes
- signed URLs temporales
- backend valida permisos antes de generar URL
- no descarga visible en MVP

## Auth propia

Auth propia en NestJS.

MVP:

- email/password
- hash con Argon2 o bcrypt
- access token corto
- refresh token rotativo
- logout
- reset password
- email verification
- rate limiting en login/reset

Regla:

> El token dice quién sos. La base decide qué podés hacer.

## API contract

Usar REST + OpenAPI/Swagger.

No usar tRPC como contrato principal.

Motivos:

- frontend/backend separados
- posible app mobile futura
- integraciones futuras
- documentación estándar
- cliente TypeScript generado para frontend

## Prisma y DB

Usar Prisma con Repository Pattern.

Reglas:

- Prisma sólo en repositories concretos
- migraciones con Prisma Migrate
- no tocar DB manualmente en producción
- seeds separados
- cuidar N+1
- evitar `include` gigantes
- usar paginación e índices desde el inicio

## Paginación e índices

Todo listado importante debe tener:

- `limit`
- cursor o paginación
- filtros
- sort

Preferir cursor pagination en listas grandes.

Índices iniciales conceptuales:

```txt
property_engagements(tenant_id, status, created_at)
movements(tenant_id, property_engagement_id, created_at)
document_requests(tenant_id, status, created_at)
tenant_memberships(tenant_id, user_id)
property_agents(property_engagement_id, agent_user_id)
activity_events(tenant_id, property_engagement_id, created_at)
```

## Errores, logging y observabilidad

MVP:

- `GlobalExceptionFilter`
- logs estructurados
- requestId
- Sentry frontend/backend
- health checks
- audit logs separados

Regla:

```txt
logs = debugging técnico
```

No enviar a Sentry:

- documentos
- tokens
- contraseñas
- datos legales completos

## Testing

No buscar 100% coverage artificial.

Testear lo que puede romper negocio, seguridad o confianza.

Tipos:

- unit tests para use cases críticos
- integration tests para repositories/módulos importantes
- e2e tests con Supertest para flujos principales

Flujos e2e mínimos:

- registro inmobiliaria + gerente principal
- login + tenant context
- crear property asset + engagement
- vendedor carga movimiento
- propietario visualiza seguimiento
- solicitud documental completa
- aislamiento tenant A vs tenant B

## Próximo paso

Después de validar esta arquitectura backend:

1. Definir arquitectura frontend Next.js.
2. Definir estructura del monorepo/repositorios.
3. Preparar roadmap técnico por etapas.
