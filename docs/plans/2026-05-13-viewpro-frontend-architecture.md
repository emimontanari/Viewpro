# Arquitectura Frontend ViewPro MVP

ViewPro usará un frontend Next.js separado del backend NestJS. El frontend será responsable de la experiencia por rol, navegación, formularios, estado de UI y consumo de la API REST; el backend seguirá siendo la autoridad de permisos, datos y reglas de negocio.

## Decisiones principales

| Tema | Decisión |
|---|---|
| Framework | Next.js App Router |
| Render | Server Components por defecto; Client Components sólo donde haya interacción |
| Contrato API | Cliente TypeScript generado desde OpenAPI |
| Server state | TanStack Query para datos interactivos en cliente |
| Auth en frontend | Cookies `httpOnly`, `Secure`, `SameSite`; nunca tokens en `localStorage` |
| Estado local | React local/context; evitar store global hasta que duela de verdad |
| Forms | Formularios tipados y validación coherente con DTOs del backend |
| Observabilidad | Sentry frontend con sanitización de datos sensibles |
| Performance | Mobile-first, bundles chicos, paginación y carga progresiva |

## Principio base

```txt
Next.js App Router
  → experiencia, rutas, layouts, formularios, cache de UI

Cliente OpenAPI generado
  → contrato tipado contra NestJS REST API

NestJS Backend
  → auth, permisos, tenant context, dominio y datos
```

Regla:

> El frontend puede mejorar la experiencia, pero nunca decide seguridad. Todo permiso y acceso real se valida en backend.

## Zonas de la aplicación

La app se divide por zonas para evitar mezclar navegaciones, permisos y layouts.

```txt
app/
  (auth)/
  (platform)/
  (tenant-app)/
  (owner)/
```

### `(auth)`

Pantallas públicas de autenticación:

- login
- registro de inmobiliaria
- recuperación de contraseña
- verificación de email

No debe cargar dependencias pesadas del dashboard.

### `(platform)`

Dashboard interno de ViewPro.

Usado por Platform Owner para:

- ver tenants
- revisar uso
- cambiar límites manuales
- suspender/activar tenants
- entrar a tenant con auditoría

Debe estar totalmente separado visual y mentalmente del producto que usa la inmobiliaria.

### `(tenant-app)`

Zona operativa de inmobiliarias.

Ruta conceptual:

```txt
/app/[tenantSlug]
```

Incluye:

- dashboard gerente
- dashboard vendedor
- propiedades/gestiones
- movimientos
- documentos
- vendedores/usuarios internos
- configuración básica del tenant

El `tenantSlug` ayuda a que el usuario entienda en qué inmobiliaria está trabajando, pero el backend valida el `tenant_id` real con la membresía.

### `(owner)`

Portal del propietario.

Ruta conceptual:

```txt
/owner
```

Incluye:

- mis propiedades
- detalle de propiedad física
- gestiones por inmobiliaria
- movimientos visibles
- documentos solicitados
- subida de documentos
- contacto por WhatsApp con vendedores asignados

Esta zona debe ser simple. Si el propietario no entiende qué pasa en 10 segundos, el producto falla.

## Routing recomendado

```txt
/(auth)/login
/(auth)/register
/(auth)/forgot-password
/(auth)/verify-email

/(platform)/platform/tenants
/(platform)/platform/tenants/[tenantId]

/(tenant-app)/app/[tenantSlug]
/(tenant-app)/app/[tenantSlug]/properties
/(tenant-app)/app/[tenantSlug]/properties/[engagementId]
/(tenant-app)/app/[tenantSlug]/documents
/(tenant-app)/app/[tenantSlug]/team
/(tenant-app)/app/[tenantSlug]/settings

/(owner)/owner
/(owner)/owner/properties/[propertyAssetId]
/(owner)/owner/documents
```

## Data fetching

Usar dos caminos según el tipo de pantalla.

### 1. Server Components para primera carga

Usar Server Components para:

- layouts protegidos
- navegación inicial
- datos necesarios para pintar la primera pantalla
- checks livianos de sesión

Ejemplos:

```txt
Tenant layout
  → lee sesión
  → obtiene tenant actual
  → obtiene permisos visibles
  → renderiza navegación
```

Datos de usuario/tenant deben tratarse como dinámicos:

- no cache global compartida
- no ISR para datos privados
- reenviar cookies al backend
- usar `no-store` o revalidación controlada cuando corresponda

### 2. TanStack Query para interacción cliente

Usar TanStack Query para server state interactivo:

- listas filtrables
- paginación cursor
- mutaciones
- invalidación de datos
- optimistic UI cuando tenga sentido
- refetch de dashboards operativos

Casos claros:

- cargar movimiento
- cambiar estado
- solicitar documento
- aprobar/rechazar documento
- subir documento
- asignar vendedor
- actualizar filtros de propiedades

Regla:

> Server Components cargan el contexto inicial; TanStack Query maneja la vida interactiva de los datos en cliente.

## Cliente OpenAPI

El backend NestJS expone Swagger/OpenAPI y el frontend genera tipos/cliente.

Recomendación MVP:

```txt
OpenAPI JSON
  → openapi-typescript
  → cliente fetch tipado
  → wrappers por dominio
  → TanStack Query hooks manuales donde aporte valor
```

Evitar magia excesiva al inicio. Generar tipos sí; esconder todo el flujo detrás de hooks generados automáticamente puede volver opaco el manejo de errores, permisos e invalidaciones.

Estructura sugerida:

```txt
src/
  api/
    generated/
      schema.ts
    client.ts
    errors.ts
    tenants.api.ts
    engagements.api.ts
    movements.api.ts
    documents.api.ts
  queries/
    tenant-keys.ts
    engagement-keys.ts
    document-keys.ts
```

## Query keys

Las keys deben incluir contexto para evitar mezclar datos entre tenants o roles.

Ejemplos:

```txt
['tenant', tenantId, 'engagements', filters]
['tenant', tenantId, 'engagement', engagementId]
['tenant', tenantId, 'documents', filters]
['owner', userId, 'properties']
['owner', userId, 'property', propertyAssetId]
```

Reglas:

- nunca usar keys genéricas tipo `['properties']`
- limpiar cache al hacer logout
- invalidar por dominio después de mutaciones
- no guardar documentos sensibles como blobs persistentes en cache cliente

## Auth y sesión

Auth pertenece al backend, pero el frontend debe proteger la experiencia.

### Tokens

No guardar tokens en:

- `localStorage`
- `sessionStorage`
- variables globales del browser

Usar cookies:

- `httpOnly`
- `Secure`
- `SameSite=Lax` o más estricto si el flujo lo permite
- dominio controlado, idealmente `app.viewpro...` y `api.viewpro...` bajo la misma raíz

### Sesión frontend

El frontend puede consultar:

```txt
GET /me
```

Para obtener:

- usuario actual
- tenants disponibles
- rol/permisos por tenant
- flags mínimos de UI

Pero no debe confiar ciegamente en eso para seguridad. Sirve para renderizar navegación y esconder acciones, no para autorizar.

## Permisos en UI

El frontend usa permisos para mostrar u ocultar acciones.

Ejemplos:

- mostrar botón “Cargar movimiento” si puede crear movimientos
- mostrar documentos sensibles sólo si el backend también autoriza
- mostrar configuración del tenant sólo a gerente autorizado

Regla:

> La UI evita frustración; el backend evita vulnerabilidades.

## Estado local

No introducir store global por costumbre.

Usar:

- estado local para modales, tabs y formularios
- URL search params para filtros compartibles
- React Context sólo para contexto de layout estable
- TanStack Query para server state

Evaluar Zustand más adelante sólo si aparece estado de UI compartido y real:

- command palette
- drawers globales
- preferencias visuales
- estado complejo no servidor

## Formularios

Los formularios son críticos porque el vendedor debe cargar información rápido.

Principios:

- mobile-first
- acciones dentro del contexto de la gestión
- pocos campos por pantalla
- valores por defecto inteligentes
- plantillas para movimientos frecuentes
- feedback inmediato
- errores claros y accionables

Flujo de “Cargar movimiento”:

```txt
Abrir desde detalle de gestión
→ elegir tipo
→ escribir observación corta
→ opcional: próximo paso / métricas simples
→ sugerir cambio de estado si aplica
→ guardar
→ invalidar timeline y resumen
```

Objetivo UX:

> Cargar un movimiento debe tardar menos de 60 segundos.

## Documentos y archivos

El frontend no maneja permisos de archivos por su cuenta.

Flujo recomendado de subida:

```txt
Frontend pide autorización de upload
→ backend valida permiso y document_request
→ backend devuelve signed upload URL temporal
→ frontend sube archivo a R2/S3
→ frontend confirma subida al backend
→ backend registra versión/documento
```

Visualización:

```txt
Frontend pide ver documento
→ backend valida permiso
→ backend genera signed read URL temporal
→ frontend muestra preview si corresponde
```

Reglas:

- no URLs públicas permanentes
- no guardar URLs firmadas por mucho tiempo
- no descargar documentos en MVP si está fuera de alcance
- no enviar contenido documental a Sentry

## Errores y feedback

Centralizar traducción de errores API.

Tipos comunes:

- no autenticado
- sin permiso
- tenant suspendido
- límite alcanzado
- validación de formulario
- conflicto de estado
- archivo demasiado grande

La UI debe decir qué hacer, no sólo “algo salió mal”.

Ejemplo:

```txt
No: Error 403
Sí: No tenés permiso para aprobar este documento. Pedile a un gerente que lo revise.
```

## Observabilidad frontend

Usar Sentry desde el MVP.

Capturar:

- errores runtime
- errores de navegación
- fallos de API no esperados
- contexto mínimo de tenant/rol sin datos sensibles

No enviar:

- tokens
- contraseñas
- documentos
- direcciones completas si no hace falta
- datos legales completos
- payloads crudos de formularios sensibles

## Analytics del piloto

Los eventos mínimos del plan MVP deben dispararse desde backend cuando representen una acción de negocio confirmada.

El frontend puede disparar eventos de interacción pura:

- `owner_viewed_dashboard`
- `owner_viewed_property`
- `whatsapp_contact_clicked`
- tiempos de carga de movimiento
- abandono de formulario de movimiento

Regla:

> Si el evento confirma negocio, backend. Si mide experiencia de UI, frontend.

## Performance

Prioridades:

- mobile-first
- Server Components por defecto
- Client Components en hojas interactivas, no en layouts enteros
- evitar barrel imports pesados
- lazy load de componentes grandes
- paginación cursor en listas
- skeletons en dashboards
- no listados infinitos sin control

No cachear datos privados como si fueran contenido público.

Para ViewPro, performance no es sólo Lighthouse. Es velocidad operativa:

- abrir propiedad rápido
- cargar movimiento rápido
- subir documento sin confusión
- volver al tablero sin perder contexto

## Seguridad supply-chain frontend

Se puede usar TanStack Query, pero con disciplina.

Decisión:

> TanStack Query queda aprobado para ViewPro porque el postmortem de TanStack confirmó `@tanstack/query*` como familia limpia en el incidente npm de 2026-05-11.

Guardrails:

- usar lockfile
- instalaciones congeladas en CI
- no instalar desde `latest` a ciegas
- revisar diffs de lockfile
- auditar que no aparezca `@tanstack/setup`
- rotar credenciales sólo si una máquina instaló versiones afectadas durante la ventana del incidente

## Testing frontend

No buscar coverage artificial.

Testear flujos que rompen confianza:

- login y sesión
- selección de tenant
- gerente ve gestiones del tenant
- vendedor carga movimiento
- propietario ve timeline actualizado
- propietario sube documento solicitado
- usuario sin permiso no ve ni ejecuta acciones restringidas
- logout limpia cache y sesión visual

Herramientas recomendadas:

- tests de componentes para piezas críticas
- Playwright para flujos principales
- validación de tipos generados desde OpenAPI en CI

## Estructura sugerida

```txt
src/
  app/
    (auth)/
    (platform)/
    (tenant-app)/
    (owner)/
  api/
    generated/
    client.ts
    errors.ts
  features/
    auth/
    platform/
    tenants/
    engagements/
    movements/
    documents/
    owner-portal/
  shared/
    components/
    forms/
    layout/
    permissions/
    telemetry/
    utils/
  queries/
    keys/
    providers/
```

Regla de arquitectura:

> Organizar por experiencia/dominio, no por tipo técnico infinito. `features/movements` es más claro que repartir todo entre `components`, `hooks`, `services` sin contexto.

## Próximo paso

Después de validar esta arquitectura frontend:

1. Definir estructura del repo: monorepo o repos separados.
2. Definir bootstrap técnico inicial.
3. Crear roadmap de implementación por etapas.
4. Recién después empezar a scaffoldar frontend/backend.
