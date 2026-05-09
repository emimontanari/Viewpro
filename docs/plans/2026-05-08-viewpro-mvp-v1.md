# Plan MVP ViewPro v1

ViewPro será un SaaS multi-tenant para inmobiliarias. El MVP debe permitir que una inmobiliaria mediana use la aplicación en un piloto real para gestionar venta/alquiler de propiedades, cargar movimientos, ordenar documentación y dar visibilidad al propietario.

## Objetivo

Validar si ViewPro reduce consultas repetidas, ordena el seguimiento inmobiliario y mejora la experiencia del propietario.

Promesa central:

> El propietario puede ver en tiempo real qué está pasando con su propiedad, sin tener que vivir preguntando por WhatsApp.

## Alcance del MVP

El MVP no es una demo. Es una versión mínima funcional para una inmobiliaria real.

Incluye:

- Registro autoservicio de inmobiliarias.
- Trial sin límite de tiempo, limitado por uso y configurado manualmente desde ViewPro.
- Gerente principal, gerentes, vendedores y propietarios.
- Propietarios con cuenta global.
- Propiedades físicas únicas con gestiones de venta/alquiler por inmobiliaria.
- Estados fijos.
- Movimientos manuales visibles para el propietario.
- Múltiples vendedores por gestión de una propiedad.
- Consulta al vendedor por WhatsApp mediante link prearmado.
- Documentos por propiedad física, gestión u operación.
- Solicitudes documentales al propietario.
- Aprobación/rechazo de documentos con historial de versiones.

Fuera del MVP:

- Compradores/inquilinos como usuarios.
- WhatsApp Business API.
- Pagos automáticos.
- App mobile nativa.
- IA.
- Reportes avanzados.
- Estados configurables por inmobiliaria.
- Planes, suscripciones y pagos automáticos.
- Descarga de documentos.
- Chat interno.
- Integraciones externas.

## Modelo de producto

```txt
ViewPro
  → Inmobiliarias
    → Gerentes
    → Vendedores
    → Propietarios
      → Propiedades físicas
        → Gestiones por inmobiliaria
```

ViewPro no es marketplace. El MVP se enfoca en la relación:

```txt
Inmobiliaria → Vendedores → Gestiones de propiedades → Propietarios
```

Decisión de dominio:

> La propiedad física es una. Los estados, movimientos, vendedores y documentos operativos pertenecen a la gestión que una inmobiliaria hace sobre esa propiedad.

## Roles

### Platform Owner

Usuario de ViewPro.

- Ve todas las inmobiliarias.
- Administra límites operativos por inmobiliaria.
- Puede entrar a tenants con auditoría.

### Gerente principal

Primer usuario de una inmobiliaria.

- Administra la inmobiliaria.
- Crea gerentes.
- Crea vendedores.
- Gestiona permisos generales.
- Ve todo dentro del tenant.

### Gerente

Supervisor dentro de la inmobiliaria.

- Puede tener permisos variables.
- Algunos gerentes podrán editar.
- Otros sólo podrán supervisar.

### Vendedor

- Gestiona propiedades asignadas.
- Carga movimientos.
- Solicita documentos.
- Aprueba o rechaza documentos que solicitó.

### Propietario

- Tiene usuario y contraseña.
- Ve sus propiedades.
- Puede pertenecer a varias inmobiliarias.
- Puede subir documentos sólo cuando se los solicitan.

## Registro y trial

El MVP incluye registro autoservicio.

Flujo:

```txt
Inmobiliaria se registra
→ se crea tenant
→ se crea gerente principal
→ entra en trial limitado
→ ViewPro controla límites desde dashboard
```

Límites iniciales recomendados:

- Sin límite de tiempo.
- Hasta 3 vendedores.
- Hasta 5 propiedades.
- Storage básico.

En el MVP no habrá planes ni billing automático. ViewPro configurará manualmente los límites de cada inmobiliaria desde el dashboard interno.

No habrá landing pública en el MVP. La entrada inicial será una pantalla simple de login/registro.

## Propietarios

El propietario es una cuenta global de ViewPro.

Ejemplo:

```txt
Carlos Gómez
  → Casa Palermo
      → Gestión con Inmobiliaria Norte
      → Gestión con Inmobiliaria Sur
  → Depto Belgrano
      → Gestión con Inmobiliaria Norte
```

Primera vista del propietario:

```txt
Mis propiedades
  → Activas
  → Finalizadas/cerradas
  → Archivadas
```

Archivar una propiedad sólo cambia la vista del propietario. No borra la propiedad ni afecta a la inmobiliaria.

Las propiedades cerradas siguen visibles para el propietario como historial y carpeta documental.

## Propiedades y gestiones inmobiliarias

El MVP soporta venta y alquiler con el mismo flujo de estados, pero separa dos conceptos:

```txt
Propiedad física
  → inmueble único del propietario

Gestión inmobiliaria
  → proceso comercial de una inmobiliaria sobre esa propiedad
```

Esto evita duplicar mentalmente una propiedad cuando varias inmobiliarias la gestionan.

Datos mínimos de la propiedad física:

- Dirección o nombre.
- Características básicas.
- Propietario principal.
- Copropietarios futuros.
- Documentación general.

Datos mínimos de la gestión inmobiliaria:

- Inmobiliaria responsable.
- Tipo de operación: venta/alquiler.
- Estado actual.
- Precio publicado.
- Vendedores asignados.
- Movimientos.
- Documentos de operación/etapa.

Una propiedad puede tener varias gestiones inmobiliarias. Cada gestión puede tener varios vendedores asignados.

## Estados

Los estados serán fijos en el MVP.

Propuesta inicial:

```txt
Captación
Documentación pendiente
Preparación de publicación
Publicación activa
Consultas y visitas
Oferta / negociación
Reserva iniciada
Documentación final
Operación cerrada
Cancelada
```

El estado pertenece a la gestión inmobiliaria, no a la propiedad física.

El estado se cambia manualmente por vendedor o gerente.

Algunos movimientos pueden sugerir un cambio de estado, pero el usuario confirma o ignora la sugerencia.

Ejemplo:

```txt
Movimiento: Reserva iniciada
→ sugerir cambiar estado a Reserva iniciada
→ vendedor confirma
→ se actualiza el estado
→ se genera movimiento visible
```

## Movimientos

Los movimientos los carga manualmente el vendedor.

Todos los movimientos cargados sobre una gestión de propiedad son visibles para el propietario.

Cada movimiento tiene:

- Tipo fijo.
- Observación.
- Fecha/hora.
- Vendedor responsable.
- Próximo paso opcional.
- Gestión de propiedad asociada.

Tipos iniciales:

- Consulta recibida.
- Visita agendada.
- Visita realizada.
- Publicación actualizada.
- Documentación solicitada.
- Documentación recibida.
- Oferta recibida.
- Reserva iniciada.
- Cambio de precio.
- Seguimiento general.

Regla UX:

> Cargar un movimiento debería tardar menos de 60 segundos.

## Vista del propietario sobre movimientos

En cada propiedad, el propietario ve sus gestiones por inmobiliaria.

Para cada gestión, ve:

- Resumen general.
- Estado actual.
- Últimos movimientos.
- Vendedores asignados.
- Movimientos por vendedor.
- Botón para consultar por WhatsApp.

Estructura:

```txt
Propiedad
  → Gestión Inmobiliaria Norte
      → Todos los movimientos
      → Vendedores asignados
          → Movimientos de cada vendedor
          → Consultar por WhatsApp
  → Gestión Inmobiliaria Sur
      → Estado y movimientos propios
```

La consulta al vendedor se resuelve con un link prearmado de WhatsApp, no con chat interno.

## Documentos

Los documentos pueden ser generales de la propiedad física o propios de una gestión/operación/etapa.

### Documentos generales

Ejemplos:

- Escritura.
- DNI.
- Fotos.
- Autorización.
- Impuestos.
- Planos.

### Documentos de operación

Ejemplos:

- Reserva.
- Contrato.
- Comprobante.
- Documentación de cierre.

Cada documento o solicitud documental puede estar asociado a:

```txt
property
property_engagement
operation/stage
```

En el MVP, los roles autorizados sólo visualizan documentos. No descargan.

## Visibilidad documental

La inmobiliaria/gerencia ve toda la documentación dentro de su tenant.

Los documentos sensibles de una operación no son visibles automáticamente para todos los vendedores asignados a una gestión.

Regla:

```txt
Vendedor ejecutor: ve y gestiona
Gerente/Admin inmobiliaria: ve y supervisa
Propietario: ve lo que corresponde
Otros vendedores: ven estado, no documentos sensibles
Platform Owner: acceso auditado
```

## Solicitudes documentales

El vendedor o gerente puede solicitar documentos al propietario.

Formulario:

- Tipo/nombre de documento.
- Fecha límite opcional.
- Observación.
- Notificación por email.
- Link de WhatsApp prearmado opcional.

Flujo:

```txt
Vendedor solicita documento
→ propietario lo ve en su panel
→ propietario sube archivo
→ vendedor recibe aviso
→ gerente recibe aviso
→ vendedor aprueba o rechaza
```

Estados:

```txt
requested
uploaded
approved
rejected
```

Si se rechaza:

- El vendedor escribe motivo.
- El propietario ve el motivo.
- La solicitud vuelve a requerir carga.
- El propietario puede subir una nueva versión.

Se guarda historial de versiones.

Datos mínimos por versión:

- Número de versión.
- Archivo.
- Estado.
- Fecha.
- Subido por.
- Revisado por.
- Motivo de rechazo, si aplica.

## Notificaciones

MVP:

- Email real.
- Notificaciones internas simples.
- WhatsApp mediante links prearmados.

No entra WhatsApp Business API todavía.

Eventos importantes:

- Documento solicitado.
- Documento subido.
- Documento aprobado.
- Documento rechazado.
- Cambio de estado.
- Movimiento cargado.

## Dashboards

### Dashboard ViewPro

Debe permitir:

- Ver inmobiliarias registradas.
- Ver estado del tenant.
- Ver uso de límites.
- Configurar límites.
- Activar/suspender tenant.

### Dashboard gerente

Debe permitir:

- Ver propiedades activas.
- Ver vendedores.
- Ver propietarios.
- Ver documentos pendientes.
- Ver actividad reciente.
- Supervisar operaciones.

### Dashboard vendedor

Debe permitir:

- Ver propiedades asignadas.
- Cargar movimientos.
- Solicitar documentos.
- Revisar documentos subidos.
- Consultar propietarios por WhatsApp.

### Dashboard propietario

Debe permitir:

- Ver propiedades activas.
- Ver propiedades finalizadas.
- Archivar propiedades visualmente.
- Entrar al seguimiento de cada propiedad.
- Ver movimientos.
- Ver documentos.
- Subir documentos solicitados.
- Consultar vendedores por WhatsApp.

## Stack recomendado

```txt
Frontend: Next.js
Backend: NestJS
Base de datos: PostgreSQL
Jobs/colas: Redis + BullMQ
Storage: S3 compatible
Errores/logs: Sentry
Deploy inicial: Vercel + Railway/Render/Fly.io
```

PostgreSQL será la fuente de verdad.

Redis se usará para:

- Jobs.
- Colas.
- Caché puntual.
- Rate limiting.

## Métricas de éxito del piloto

El MVP funciona si:

- Baja la cantidad de consultas repetidas del propietario.
- Los vendedores cargan movimientos sin fricción.
- La documentación queda más ordenada.
- El gerente gana visibilidad operativa.
- El propietario entiende qué pasa con su propiedad.

## Riesgo crítico: adopción del vendedor

ViewPro depende de que los vendedores usen la aplicación de forma constante. Si el vendedor siente que la app es “trabajo extra”, el producto pierde valor y no escala operativamente.

Principios UX para reducir fricción:

- Cargar un movimiento debe tardar menos de 60 segundos.
- Las acciones principales deben estar dentro del contexto de la propiedad.
- Usar tipos fijos y plantillas para evitar escritura repetitiva.
- Mostrar próximos pasos y pendientes para que ViewPro también ayude al vendedor.
- Evitar formularios largos y pantallas innecesarias.
- Medir propiedades sin actualización y documentos pendientes sin convertirlo en persecución.

Regla de producto:

> Cada acción que ViewPro pida al vendedor debe ahorrar tiempo, reducir memoria operativa o evitar consultas repetidas.

## Decisiones pendientes

- Alta de vendedores: manual, invitación o carga CSV.
- Detalle fino del dashboard del gerente.
- Detalle fino del dashboard del vendedor.
- Proveedor de auth.
- ORM: Prisma o Drizzle.
- Proveedor de storage.
- Deploy inicial exacto.
- Métricas concretas del piloto.

## Futuro explícito

- Matching de propiedades confirmado por propietario para evitar duplicados visuales en su dashboard.
- Bóveda documental del propietario para reutilizar documentos generales con consentimiento.
- Planes, suscripciones, pagos automáticos y upgrades autoservicio.
- Sistema de puntos/recompensas para incentivar adopción diaria de vendedores, cuidando premiar calidad y constancia, no carga basura.

## Próximo paso

Validar este plan y convertirlo luego en:

1. Mapa de pantallas.
2. Modelo de datos inicial.
3. Arquitectura backend/frontend.
4. Roadmap de implementación por etapas.
