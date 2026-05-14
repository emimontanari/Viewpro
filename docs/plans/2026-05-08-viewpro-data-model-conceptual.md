# Modelo de Datos Conceptual — ViewPro MVP v1

Este documento define el modelo conceptual del MVP antes de escribir SQL o código. La decisión central es separar la **propiedad física única** de la **gestión que cada inmobiliaria realiza sobre esa propiedad**.

## Decisión principal

```txt
Propiedad física
  → existe una sola vez para el propietario

Gestión inmobiliaria
  → proceso comercial de una inmobiliaria sobre esa propiedad
```

Ejemplo:

```txt
Casa Palermo
  → Gestión con Inmobiliaria Norte
      Estado: Publicación activa
      Vendedores: Juan, María

  → Gestión con Inmobiliaria Sur
      Estado: Consultas y visitas
      Vendedores: Pedro
```

Regla clave:

> El estado, los movimientos, los vendedores y los documentos operativos pertenecen a la gestión inmobiliaria, no a la propiedad física.

## Identidad y tenants

### `users`

Persona global dentro de ViewPro.

Puede ser:

- Platform Owner.
- Gerente.
- Vendedor.
- Propietario.

### `tenants`

Representa una inmobiliaria.

Cada inmobiliaria tiene:

- nombre
- estado: `trial`, `active`, `suspended`, `cancelled`
- límites operativos manuales
- datos de contacto

### `tenant_memberships`

Relación entre un usuario y una inmobiliaria.

Ejemplo:

```txt
Juan Pérez → Inmobiliaria Norte → vendedor
Laura Gómez → Inmobiliaria Norte → gerente principal
```

Esto evita poner roles fijos directamente en `users`.

## Propiedades

### `property_assets`

Representa la propiedad física única.

No representa la gestión comercial de una inmobiliaria.

Datos conceptuales:

- dirección/nombre
- características básicas
- metadata general
- created_at
- updated_at

### `property_asset_owners`

Relación entre usuarios propietarios y la propiedad física.

Soporta varios propietarios, aunque en MVP se use uno principal.

Campos conceptuales:

- property_id
- user_id
- is_primary
- access_status: `invited`, `active`, `revoked`

## Gestiones inmobiliarias

### `property_engagements`

Representa el proceso comercial de una inmobiliaria sobre una propiedad física.

Es el corazón operativo del MVP.

Campos conceptuales:

- property_id
- tenant_id
- operation_type: `sale` | `rent`
- status
- published_price
- created_by_user_id
- created_at
- updated_at

Una propiedad puede tener varias gestiones:

```txt
property_id: Casa Palermo
  → tenant_id: Inmobiliaria Norte
  → tenant_id: Inmobiliaria Sur
```

Privacidad:

> Una inmobiliaria sólo ve su propia gestión. Nunca ve si la misma propiedad física también está gestionada por otra inmobiliaria.

### `property_agents`

Relación entre vendedores y una gestión inmobiliaria.

Campos conceptuales:

- property_engagement_id
- tenant_id
- agent_user_id
- assigned_by_user_id
- assigned_at

No hay vendedor principal en MVP.

## Estados

### `property_status_history`

Historial de cambios de estado de una gestión inmobiliaria.

Campos conceptuales:

- property_engagement_id
- tenant_id
- from_status
- to_status
- changed_by_user_id
- observation
- created_at

Reglas:

- El vendedor asignado puede cambiar estado en MVP.
- El gerente puede cambiar cualquier estado dentro del tenant.
- Todo cambio exige observación.
- Todo cambio genera un movimiento visible.

## Movimientos

### `movements`

Eventos visibles del seguimiento de una gestión.

Campos conceptuales:

- property_engagement_id
- tenant_id
- created_by_user_id
- type
- observation
- next_step
- source: `manual` | `system`
- interest_count opcional
- visit_count opcional
- offer_amount opcional
- interest_level opcional
- created_at

Regla MVP:

> Todo movimiento cargado en una gestión es visible para el propietario.

Campos como `interest_count`, `visit_count`, `offer_amount` e `interest_level` permiten mostrar métricas simples de actividad comercial sin modelar todavía interesados/compradores/inquilinos como usuarios.

Ejemplo de resumen visible:

```txt
12 consultas
4 visitas agendadas
3 visitas realizadas
1 oferta recibida
```

## Documentos

### `documents`

Archivo o recurso documental.

Puede asociarse a:

- propiedad física
- gestión inmobiliaria
- operación/etapa

En MVP, los documentos se visualizan pero no se descargan.

### `document_requests`

Solicitud de documento hecha al propietario.

Campos conceptuales:

- property_id opcional
- property_engagement_id opcional
- tenant_id
- requested_by_user_id
- owner_user_id
- document_name/type
- due_date opcional
- observation
- status: `requested`, `uploaded`, `approved`, `rejected`
- created_at

### `document_versions`

Versiones subidas para una solicitud documental.

Campos conceptuales:

- document_request_id
- file_id/document_id
- version_number
- status
- uploaded_by_user_id
- reviewed_by_user_id
- rejection_reason
- created_at

## Auditoría y notificaciones

### `audit_logs`

Registra acciones sensibles.

Ejemplos:

- Platform Owner entra a un tenant.
- Se cambian límites operativos del tenant.
- Se accede a documentos sensibles.
- Se suspende una inmobiliaria.

### `notifications`

Eventos a comunicar.

Ejemplos:

- Documento solicitado.
- Documento subido.
- Documento aprobado/rechazado.
- Cambio de estado.
- Movimiento cargado.

MVP:

- email real
- notificación interna simple
- WhatsApp mediante link prearmado

## Métricas y analytics del piloto

Desde el MVP se deben capturar eventos de uso para validar si ViewPro genera valor real.

No hace falta construir un BI avanzado desde el inicio, pero sí dejar una base de eventos.

### `product_analytics_events`

Eventos de comportamiento del producto.

Campos conceptuales:

- id
- tenant_id opcional
- user_id opcional
- property_asset_id opcional
- property_engagement_id opcional
- event_name
- metadata
- created_at

Eventos mínimos:

```txt
seller_logged_in
movement_created
property_status_changed
owner_invited
owner_activated
owner_viewed_dashboard
owner_viewed_property
document_requested
document_uploaded
document_approved
document_rejected
whatsapp_contact_clicked
```

Métrica norte:

```txt
% de gestiones activas con al menos una actualización visible por semana
```

Esta métrica ayuda a validar que vendedores están usando la app y propietarios están recibiendo visibilidad real.

## Límites del tenant en MVP

En el MVP no habrá módulo formal de planes, suscripciones ni pagos automáticos.

Sí habrá límites operativos configurables manualmente desde el dashboard de ViewPro.

### `tenant_limits`

Configuración manual de capacidad por inmobiliaria.

Campos conceptuales:

- tenant_id
- max_agents
- max_property_engagements
- max_storage_mb
- documents_enabled
- updated_by_user_id
- updated_at

Ejemplo:

```txt
Inmobiliaria Norte
  max_agents: 5
  max_property_engagements: 20
  documents_enabled: true
```

Modelo comercial recomendado para futuro:

```txt
Paquete por inmobiliaria
  → usuarios internos facturables
  → gestiones/propiedades activas
  → propietarios incluidos
```

Usuarios internos facturables:

- gerentes
- vendedores
- administrativos futuros

Propietarios/clientes finales no deberían contarse como cuentas facturables directas. Son parte del valor que la inmobiliaria compra al contratar ViewPro.

Tampoco se recomienda cobrar por propiedad individual. La capacidad de propiedades/gestiones debe comunicarse como rango incluido en el paquete:

```txt
usuarios internos + hasta X gestiones activas
```

Las gestiones cerradas, canceladas o históricas deberían quedar fuera del cupo activo para no castigar el historial.

Definición:

```txt
gestión activa = propiedad en seguimiento comercial abierto
```

Consumen cupo activo:

- captación
- documentación pendiente
- preparación de publicación
- publicación activa
- consultas y visitas
- oferta / negociación
- reserva iniciada
- documentación final

No consumen cupo activo:

- operación cerrada
- cancelada
- archivada/histórica

Si un vendedor trabaja en varias inmobiliarias:

```txt
users: una identidad global
tenant_memberships: una membresía por inmobiliaria
facturación futura: cada tenant consume su propia cuenta interna activa
```

Cuando una inmobiliaria llega a un límite:

```txt
Se bloquea o limita la acción
→ se muestra aviso
→ se ofrece contactar a ViewPro
→ Platform Owner actualiza límites manualmente
```

Futuro:

```txt
plans
subscriptions
payments
invoices
self_service_upgrades
```

## Dashboard propietario

El propietario ve propiedades físicas únicas, no una propiedad repetida por cada inmobiliaria.

Cada propiedad puede mostrar una o más gestiones inmobiliarias.

```txt
Casa Palermo
  → Inmobiliaria Norte
      Estado: Publicación activa
      Último movimiento: Visita agendada

  → Inmobiliaria Sur
      Estado: Consultas y visitas
      Último movimiento: Consulta recibida
```

Esto evita mostrar la misma propiedad repetida como si fueran inmuebles distintos.

## Vinculación futura de propiedades duplicadas

Problema:

Una inmobiliaria puede cargar la misma propiedad con otro nombre, otras fotos o datos distintos. Si varias inmobiliarias cargan la misma casa, el propietario no debería verla repetida cinco veces en su dashboard.

Solución futura:

```txt
Owner-confirmed property matching
```

Flujo esperado:

```txt
Inmobiliaria carga una propiedad
→ invita al propietario
→ propietario acepta invitación
→ sistema busca propiedades existentes del propietario
→ muestra posibles coincidencias
→ propietario confirma:
   “Sí, es esta propiedad”
   o
   “No, crear propiedad nueva”
```

Reglas:

- El sistema puede sugerir coincidencias.
- El sistema no debe fusionar propiedades automáticamente sólo por dirección.
- La decisión final la toma el propietario.
- La inmobiliaria no ve si existe otra gestión de otra inmobiliaria.

Señales futuras para sugerir coincidencias:

- dirección parecida
- ciudad/barrio
- tipo de propiedad
- propietario asociado
- teléfono/email del propietario
- fotos parecidas en una versión posterior
- nomenclatura/catastro si existiera

## Bóveda documental futura

En el MVP, las solicitudes documentales se manejan por gestión inmobiliaria.

Futuro:

```txt
owner_document_vault
property_asset_documents
document_access_grants
```

Objetivo:

- evitar que el propietario suba el mismo documento varias veces
- permitir reutilización sólo con consentimiento explícito
- mantener privacidad entre inmobiliarias

Ejemplo futuro:

```txt
Inmobiliaria B solicita Escritura
→ el propietario ya tiene escritura.pdf en su bóveda
→ ViewPro pregunta si quiere compartirla
→ propietario autoriza
→ B la revisa/aprueba en su propia gestión
```

Reglas:

- El archivo puede existir una sola vez.
- El acceso se concede por inmobiliaria/gestión.
- La aprobación sigue siendo por gestión.
- Una inmobiliaria no ve que otra ya pidió o aprobó ese documento.

## Pendientes de validación

- Nombre final de `property_engagements`: puede ser `listings`, `property_cases` o `property_assignments`.
- Si el precio publicado vive sólo en la gestión o también existe un precio de referencia en la propiedad física.
- Si las direcciones se normalizan desde MVP o se dejan como texto simple.
- Nivel exacto de permisos para gerentes secundarios.
- Qué tan simple será el matching inicial al aceptar invitaciones del propietario.
