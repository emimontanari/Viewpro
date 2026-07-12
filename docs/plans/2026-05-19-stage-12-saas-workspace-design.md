# Stage 12 — SaaS Workspace Inmobiliaria

Stage 12 corrige el problema de producto detectado antes del piloto: ViewPro ya tiene funcionalidades reales, pero el workspace cliente todavía se presenta como una superficie técnica. El objetivo es que una inmobiliaria entienda de inmediato dónde está, qué tiene que hacer hoy y cómo acceder a todas las capacidades tenant-facing sin ver lenguaje interno.

## Decisión

Rediseñar el workspace cliente como un SaaS operativo para inmobiliarias, manteniendo el Admin ViewPro separado en `/admin`.

| Área | Decisión |
| --- | --- |
| Enfoque | Slice 12.1 cambia navegación, copy y dashboard sin reescribir dominio ni API. |
| Lenguaje | Usar inmobiliaria, gestiones, propiedades, propietarios, documentos, equipo, métricas. |
| Términos prohibidos en UI cliente | `tenant`, `UUID`, `workspace`, `request`, `backend`, `contexto`, `x-tenant-id`. |
| Admin | `/admin` sigue siendo interno/técnico y no se mezcla con el workspace cliente. |
| Persistencia local | Mantener sólo `selectedTenantId` en `localStorage`; no tokens ni datos sensibles. |

## Alcance de Slice 12.1

### Incluye

- Rediseñar `InternalShell` como shell SaaS para inmobiliarias.
- Convertir `/dashboard` en `Inicio` con resumen operativo.
- Exponer navegación visible hacia todas las áreas tenant-facing.
- Reescribir copy técnico en pantallas cliente críticas.
- Agregar estado visible para `Equipo`, aunque la gestión completa de vendedores quede para Slice 12.2.
- Agregar o ajustar smoke coverage para evitar regresiones de lenguaje técnico.

### No incluye

- Nuevos endpoints de equipo/vendedores.
- Cambios de permisos backend.
- Reescritura del portal propietario.
- Cambios en Admin ViewPro `/admin`.
- Billing, invitaciones reales, roles editables avanzados o configuración profunda.

## Arquitectura de navegación

La navegación cliente debe contar el producto, no la implementación.

| Ruta | Nombre visible | Propósito |
| --- | --- | --- |
| `/dashboard` | Inicio | Resumen operativo de la inmobiliaria. |
| `/engagements` | Gestiones | Operar gestiones inmobiliarias activas. |
| `/engagements/new` | Nueva gestión | Cargar una propiedad/gestión nueva. |
| Pendiente o estado vacío | Propiedades | Entrada visible al inventario de propiedades. |
| Portal/owner flows existentes | Propietarios | Acceso conceptual a relación con propietarios. |
| Document flows existentes | Documentos | Documentos internos y compartidos. |
| Pendiente Slice 12.2 | Equipo | Vendedores y colaboradores. |
| `/analytics` | Métricas | Salud operativa y métricas piloto en lenguaje de negocio. |
| Pendiente o estado vacío | Configuración | Datos de inmobiliaria y preferencias futuras. |

## Diseño de `Inicio`

`/dashboard` debe responder tres preguntas en menos de cinco segundos:

1. ¿Estoy en el panel de mi inmobiliaria?
2. ¿Qué requiere atención hoy?
3. ¿Dónde entro para operar?

### Bloques propuestos

| Bloque | Contenido |
| --- | --- |
| Encabezado | Nombre de la inmobiliaria, rol del usuario y llamada a la acción principal. |
| Prioridades de hoy | Documentos pendientes, gestiones sin actualización, próximas acciones. |
| Gestiones activas | Entrada a listado y creación de gestión. |
| Actividad reciente | Últimos movimientos o explicación clara si todavía no hay actividad. |
| Equipo | Preview/estado de vendedores con mensaje “gestión de equipo llega en el próximo slice”. |
| Accesos rápidos | Nueva gestión, ver documentos, revisar métricas, cambiar inmobiliaria. |

## Copy y UX

Regla base: la UI debe hablar como una herramienta para inmobiliarias, no como una consola de desarrollo.

| Antes | Después |
| --- | --- |
| Dashboard | Inicio |
| Tenant | Inmobiliaria |
| Workspace interno | Panel de la inmobiliaria |
| Requests con alcance de tenant | Operaciones de la inmobiliaria |
| Contexto de tenant listo | Inmobiliaria seleccionada |
| UUID del propietario | Identificador del propietario / selector futuro |

Cuando todavía falte funcionalidad, la UI debe mostrar un estado honesto y orientado al usuario: “La gestión de equipo llega en el próximo paso” es aceptable; “endpoint pendiente” no.

## Datos y flujo

- `getSelectedTenantId()` sigue siendo el mecanismo local para saber qué inmobiliaria está seleccionada.
- `getSession()` sigue aportando membresías, nombre de inmobiliaria y rol.
- El dashboard puede derivar estados visuales iniciales desde la sesión y enlaces existentes.
- No se agregan datos sensibles a `localStorage`.
- La API sigue usando `x-tenant-id` internamente donde corresponda, pero ese detalle no aparece en copy cliente.

## Estética

Dirección visual: SaaS premium claro/editorial para operación inmobiliaria.

- Composición más editorial y menos “panel técnico”.
- Jerarquía fuerte: título, prioridades, acciones.
- Tarjetas con densidad controlada y lenguaje concreto.
- Sin emojis como íconos.
- Sin estética genérica de dashboard AI ni gradientes violeta/azules.

## Aceptación

- Una inmobiliaria entiende que está en su panel operativo sin explicación externa.
- La navegación muestra las áreas tenant-facing principales.
- El dashboard no contiene términos técnicos prohibidos.
- El usuario puede llegar a gestiones, documentos y métricas desde el shell.
- Equipo aparece como área de producto visible aunque su gestión real quede para Slice 12.2.
- `/admin` no cambia ni se mezcla con el workspace cliente.
- Typecheck y smoke tests del frontend pasan.

## Slices siguientes

| Slice | Objetivo |
| --- | --- |
| 12.1 | Shell + Inicio SaaS + copy cliente. |
| 12.2 | Equipo/Vendedores real: listar, invitar/agregar, cambiar rol, desactivar acceso. |
| 12.3 opcional | Propiedades/propietarios/documentos con menos fricción de identificadores. |
