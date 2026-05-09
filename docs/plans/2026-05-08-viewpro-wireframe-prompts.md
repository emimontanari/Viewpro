# Prompts para Wireframes MVP ViewPro v1

Este archivo contiene prompts listos para generar wireframes low-fidelity de las pantallas principales del MVP ViewPro. Usalos en una herramienta de diseño asistida por IA, Excalidraw, Figma AI, Uizard, v0, Lovable o similar.

## Prompt maestro

```txt
Creá un wireframe low-fidelity para ViewPro, un SaaS multi-tenant para inmobiliarias.

Contexto del producto:
- ViewPro permite que una inmobiliaria gestione propiedades en venta/alquiler.
- El propietario puede ver el seguimiento de su propiedad en tiempo real.
- Los vendedores cargan movimientos, solicitan documentos y gestionan propiedades asignadas.
- Los gerentes supervisan toda la operación de la inmobiliaria.
- ViewPro como plataforma administra inmobiliarias y límites operativos manuales.

Estilo del wireframe:
- Blanco y negro o escala de grises.
- Sin diseño visual final.
- Enfocado en layout, jerarquía, navegación y acciones principales.
- Usar cajas, tablas, cards, tabs, modales y estados vacíos.
- Mantener lenguaje simple para usuarios no técnicos.
- Priorizar claridad y velocidad de uso.
- No usar ilustraciones complejas ni detalles visuales finales.

Reglas UX:
- Cada pantalla debe tener un título claro.
- Cada acción primaria debe verse rápido.
- Las tablas deben tener filtros cuando corresponda.
- Los formularios deben ser cortos.
- El propietario no debe ver lenguaje técnico como tenant, operation_id o document_request.
```

---

## Auth / Entrada

### 1. Login

```txt
Creá un wireframe low-fidelity para la pantalla de login de ViewPro.

Ruta: /login

Usuarios que ingresan desde esta pantalla:
- Platform Owner
- Gerente
- Vendedor
- Propietario

Contenido:
- Logo/nombre ViewPro.
- Campo email.
- Campo contraseña.
- Botón principal: “Iniciar sesión”.
- Link: “Recuperar contraseña”.
- Link secundario: “Registrar inmobiliaria”.

Después del login, el sistema redirige según rol:
- Platform Owner → dashboard plataforma.
- Gerente/Vendedor → dashboard inmobiliaria.
- Propietario → dashboard propietario.

El wireframe debe ser simple, centrado y profesional.
```

### 2. Registro de inmobiliaria

```txt
Creá un wireframe low-fidelity para el registro autoservicio de una inmobiliaria en ViewPro.

Ruta: /register-inmobiliaria

Objetivo:
Permitir que una inmobiliaria cree su cuenta trial.

Campos:
- Nombre de inmobiliaria.
- Nombre del responsable.
- Apellido del responsable.
- Email.
- Teléfono.
- Contraseña.
- Confirmar contraseña.

Acción principal:
- “Crear cuenta trial”.

Debe mostrar una nota clara:
“Trial sin límite de tiempo: hasta 3 vendedores y 5 propiedades.”

Al terminar, el sistema crea:
- Tenant inmobiliaria.
- Gerente principal.
- Trial limitado por uso.
```

### 3. Onboarding inicial

```txt
Creá un wireframe low-fidelity para la pantalla de onboarding inicial después de registrar una inmobiliaria.

Ruta: /app/onboarding

Objetivo:
Evitar que el usuario vea un dashboard vacío y guiarlo por los primeros pasos.

Contenido:
- Título: “Bienvenido a ViewPro”.
- Checklist de primeros pasos:
  1. Completar datos de la inmobiliaria.
  2. Crear primer vendedor.
  3. Cargar primera propiedad.
  4. Invitar propietario.
- Botón principal: “Comenzar configuración”.

El wireframe debe sentirse guiado, simple y accionable.
```

---

## Platform Owner

### 4. Dashboard ViewPro

```txt
Creá un wireframe low-fidelity para el dashboard interno de ViewPro.

Ruta: /platform/dashboard

Usuario: Platform Owner.

Objetivo:
Mostrar el estado general del negocio y operación de tenants.

Cards principales:
- Inmobiliarias registradas.
- Inmobiliarias en trial.
- Inmobiliarias activas.
- Propiedades activas totales.
- Vendedores activos totales.
- Documentos pendientes totales.

Secciones:
- Actividad reciente.
- Nuevos registros.
- Tenants cerca del límite.

Acciones rápidas:
- Ver inmobiliarias.
- Revisar nuevos registros.
- Entrar a una inmobiliaria.
```

### 5. Listado de inmobiliarias

```txt
Creá un wireframe low-fidelity para el listado de inmobiliarias en ViewPro.

Ruta: /platform/inmobiliarias

Usuario: Platform Owner.

Objetivo:
Administrar tenants/inmobiliarias registradas.

Elementos:
- Barra de filtros por estado y uso.
- Tabla con columnas:
  - Nombre.
  - Estado: trial, active, suspended, cancelled.
  - Límites configurados.
  - Vendedores usados/límite.
  - Propiedades usadas/límite.
  - Fecha de registro.
  - Última actividad.
  - Acciones.

Acciones por fila:
- Ver detalle.
- Activar.
- Suspender.
- Ajustar límites.
```

### 6. Detalle de inmobiliaria

```txt
Creá un wireframe low-fidelity para el detalle de una inmobiliaria dentro del panel ViewPro.

Ruta: /platform/inmobiliarias/:id

Usuario: Platform Owner.

Secciones:
- Resumen del tenant:
  - Nombre.
  - Estado.
  - Límites configurados.
  - Fecha de registro.
  - Gerente principal.
  - Contacto.
- Uso:
  - Vendedores usados/límite.
  - Propiedades usadas/límite.
  - Storage usado/límite.
- Usuarios:
  - Gerentes.
  - Vendedores.
  - Propietarios.
- Operación:
  - Propiedades activas.
  - Documentos pendientes.
  - Últimos movimientos.

Acciones:
- Cambiar estado del tenant.
- Ajustar límites.
- Entrar en contexto del tenant.
- Ver auditoría.
```

### 7. Auditoría plataforma

```txt
Creá un wireframe low-fidelity para la pantalla de auditoría interna de ViewPro.

Ruta: /platform/auditoria

Usuario: Platform Owner.

Objetivo:
Trazar acciones sensibles de plataforma.

Tabla con columnas:
- Fecha.
- Usuario.
- Tenant.
- Acción.
- Recurso.
- IP/dispositivo opcional.

Eventos esperados:
- Platform Owner entró a un tenant.
- Cambió límites.
- Activó/suspendió tenant.
- Modificó límites del tenant.
- Accedió a datos sensibles.
```

---

## Gerente / Inmobiliaria

### 8. Dashboard gerente

```txt
Creá un wireframe low-fidelity para el dashboard del gerente de una inmobiliaria.

Ruta: /app/dashboard

Usuario: Gerente o gerente principal.

Objetivo:
Dar visibilidad operativa rápida de la inmobiliaria.

Cards principales:
- Propiedades activas.
- Propiedades en reserva.
- Documentos pendientes.
- Movimientos esta semana.
- Vendedores activos.
- Propietarios activos.

Secciones:
- Actividad reciente.
- Alertas.
- Propiedades por estado.

Alertas:
- Documentos vencidos.
- Propiedades sin movimiento reciente.
- Solicitudes documentales pendientes.
- Propiedades cerca de cierre/reserva.
```

### 9. Vendedores

```txt
Creá un wireframe low-fidelity para la gestión de vendedores de una inmobiliaria.

Ruta: /app/vendedores

Usuario: Gerente con permiso.

Elementos:
- Botón principal: “Crear vendedor”.
- Tabla con columnas:
  - Nombre.
  - Email.
  - Teléfono.
  - Estado.
  - Propiedades asignadas.
  - Última actividad.
  - Acciones.

Acciones:
- Crear vendedor.
- Editar vendedor.
- Activar/desactivar.
- Ver propiedades asignadas.

Para MVP no incluir carga CSV.
```

### 10. Gerentes

```txt
Creá un wireframe low-fidelity para la gestión de gerentes dentro de una inmobiliaria.

Ruta: /app/gerentes

Usuario: Gerente principal.

Objetivo:
Crear y administrar supervisores internos.

Elementos:
- Botón: “Crear gerente”.
- Tabla de gerentes.
- Estado activo/inactivo.
- Perfil asignado.

Perfiles MVP:
- Gerente principal.
- Gerente supervisor.

No diseñar permisos enterprise complejos. Sólo perfiles simples.
```

### 11. Propietarios

```txt
Creá un wireframe low-fidelity para el listado de propietarios de una inmobiliaria.

Ruta: /app/propietarios

Usuario: Gerente.

Tabla con columnas:
- Nombre.
- Email.
- Teléfono.
- Propiedades asociadas.
- Estado de cuenta.
- Última actividad.
- Acciones.

Acciones:
- Crear/invitar propietario.
- Ver detalle.
- Ver propiedades.
- Reenviar invitación.
```

### 12. Detalle de propietario

```txt
Creá un wireframe low-fidelity para el detalle de un propietario dentro de una inmobiliaria.

Ruta: /app/propietarios/:id

Usuario: Gerente.

Secciones:
- Datos personales.
- Estado de cuenta/invitación.
- Propiedades asociadas.
- Documentos solicitados pendientes.
- Actividad reciente.

Acciones:
- Editar datos.
- Asociar propiedad.
- Reenviar invitación.
```

### 13. Listado de propiedades

```txt
Creá un wireframe low-fidelity para el listado general de propiedades de una inmobiliaria.

Ruta: /app/propiedades

Usuario: Gerente.

Filtros:
- Estado.
- Vendedor.
- Propietario.
- Venta/alquiler.
- Activas/finalizadas.

Tabla:
- Propiedad.
- Operación: venta/alquiler.
- Propietario.
- Estado.
- Vendedores asignados.
- Último movimiento.
- Documentos pendientes.
- Acciones.

Acciones:
- Crear propiedad.
- Ver detalle.
```

### 14. Detalle de propiedad — vista gerente

```txt
Creá un wireframe low-fidelity para el detalle de una propiedad desde la vista gerente.

Ruta: /app/propiedades/:id

Usuario: Gerente.

Secciones:
- Resumen:
  - Dirección/nombre.
  - Tipo operación.
  - Estado.
  - Propietario.
  - Vendedores asignados.
  - Precio.
- Movimientos:
  - Timeline general.
  - Filtro por vendedor.
  - Acción “Cargar movimiento”.
- Documentos:
  - Documentos generales.
  - Documentos de operación.
  - Solicitudes pendientes.
  - Historial.
- Equipo asignado:
  - Vendedores.
  - Agregar/quitar vendedores.
- Estado:
  - Cambiar estado manualmente.
  - Ver historial de cambios.
```

### 15. Centro documental

```txt
Creá un wireframe low-fidelity para el centro documental de una inmobiliaria.

Ruta: /app/documentos

Usuario: Gerente.

Secciones:
- Documentos pendientes de revisión.
- Solicitudes vencidas.
- Documentos rechazados.
- Documentos aprobados recientes.

Cada fila/card debe mostrar:
- Documento.
- Propiedad.
- Propietario.
- Vendedor responsable.
- Estado.
- Acción para visualizar.
```

### 16. Actividad inmobiliaria

```txt
Creá un wireframe low-fidelity para el timeline global de actividad de una inmobiliaria.

Ruta: /app/actividad

Usuario: Gerente.

Eventos:
- Movimientos cargados.
- Documentos solicitados.
- Documentos subidos.
- Documentos aprobados/rechazados.
- Cambios de estado.
- Altas de usuarios.

Incluir filtros por tipo de evento, vendedor y propiedad.
```

### 17. Configuración inmobiliaria

```txt
Creá un wireframe low-fidelity para la configuración básica de una inmobiliaria.

Ruta: /app/configuracion

Usuario: Gerente principal.

Contenido:
- Datos de inmobiliaria.
- Nombre comercial.
- Teléfono.
- Dirección.
- Logo opcional.
- Límites de uso en modo lectura.
- Uso actual.

No incluir configuraciones avanzadas.
```

---

## Vendedor

### 18. Dashboard vendedor

```txt
Creá un wireframe low-fidelity para el dashboard operativo del vendedor.

Ruta: /app/dashboard

Usuario: Vendedor.

Objetivo:
Mostrar qué debe atender hoy.

Cards:
- Mis propiedades activas.
- Documentos para revisar.
- Movimientos cargados esta semana.
- Propiedades sin actualización reciente.
- Próximos pasos pendientes.

Secciones:
- Mis tareas/próximos pasos.
- Actividad reciente propia.
```

### 19. Mis propiedades

```txt
Creá un wireframe low-fidelity para el listado de propiedades asignadas al vendedor.

Ruta: /app/mis-propiedades

Usuario: Vendedor.

Tabla:
- Propiedad.
- Operación.
- Propietario.
- Estado.
- Último movimiento.
- Documentos pendientes.
- Próximo paso.
- Acciones.

Filtros:
- Estado.
- Venta/alquiler.
- Documentos pendientes.
- Sin movimiento reciente.

Acciones rápidas:
- Ver detalle.
- Cargar movimiento.
- Solicitar documento.
```

### 20. Detalle de propiedad — vista vendedor

```txt
Creá un wireframe low-fidelity para el detalle de propiedad desde vista vendedor.

Ruta: /app/propiedades/:id

Usuario: Vendedor.

Puede ver:
- Datos generales.
- Propietario.
- Estado.
- Vendedores asignados.
- Timeline general.
- Timeline por vendedor.
- Documentos permitidos.
- Solicitudes documentales.

Puede hacer:
- Cargar movimiento.
- Solicitar documento.
- Revisar documento solicitado por él.
- Aprobar/rechazar documento.
- Sugerir/cambiar estado si tiene permiso.
- Consultar propietario por WhatsApp.
```

### 21. Modal cargar movimiento

```txt
Creá un wireframe low-fidelity para un modal o drawer de carga de movimiento.

Usuario: Vendedor.

Campos:
- Tipo de movimiento.
- Observación.
- Próximo paso opcional.
- Fecha/hora.

Si el tipo de movimiento sugiere cambio de estado, mostrar:
“¿Querés cambiar el estado de la propiedad a Reserva iniciada?”

Acciones:
- Confirmar cambio.
- Mantener estado actual.
- Guardar movimiento.

Regla:
La carga debe sentirse posible en menos de 60 segundos.
```

### 22. Modal solicitar documento

```txt
Creá un wireframe low-fidelity para un modal o drawer de solicitud documental.

Usuario: Vendedor.

Campos:
- Tipo/nombre de documento.
- Alcance: propiedad u operación/etapa.
- Fecha límite opcional.
- Observación.
- Checkbox: notificar por email.
- Acción: generar mensaje de WhatsApp.

Resultado esperado:
- Se crea solicitud documental.
- Aparece en el portal propietario.
- Se genera movimiento visible.
- Se notifica según configuración.
```

### 23. Documentos pendientes vendedor

```txt
Creá un wireframe low-fidelity para la vista de documentos pendientes del vendedor.

Ruta: /app/documentos-pendientes

Usuario: Vendedor.

Tabla:
- Documento.
- Propiedad.
- Propietario.
- Fecha de subida.
- Estado.
- Acción.

Acciones:
- Visualizar documento.
- Aprobar.
- Rechazar con motivo.

Si rechaza, mostrar modal con motivo obligatorio.
```

---

## Propietario

### 24. Dashboard propietario

```txt
Creá un wireframe low-fidelity para el dashboard del propietario en ViewPro.

Ruta: /owner/dashboard

Usuario: Propietario.

Objetivo:
Que vea todas sus propiedades en un solo lugar.

Secciones:
- Propiedades activas.
- Propiedades finalizadas.
- Propiedades archivadas.

Agrupar por inmobiliaria.

Cada card de propiedad debe mostrar:
- Nombre/dirección.
- Inmobiliaria.
- Estado.
- Último movimiento.
- Vendedores asignados.
- Documentos pendientes, si tiene.
- Botón: “Ver seguimiento”.
```

### 25. Detalle de propiedad propietario

```txt
Creá un wireframe low-fidelity para el detalle de una propiedad desde el portal propietario.

Ruta: /owner/properties/:id

Usuario: Propietario.

Objetivo:
Responder: “¿Qué está pasando con mi propiedad?”

Secciones:
- Resumen:
  - Nombre/dirección.
  - Inmobiliaria.
  - Estado actual.
  - Operación: venta/alquiler.
  - Último movimiento.
  - Próximo paso.
- Estado/progreso:
  - Captación → Documentación → Publicación → Consultas → Reserva → Cierre.
- Movimientos:
  - Todos los movimientos.
  - Por vendedor.
- Vendedores asignados:
  - Card de vendedor.
  - Último movimiento.
  - Botón “Consultar por WhatsApp”.

Usar lenguaje humano, no técnico.
```

### 26. Documentos propietario

```txt
Creá un wireframe low-fidelity para la pantalla de documentos visibles para el propietario.

Ruta: /owner/properties/:id/documents

Usuario: Propietario.

Contenido:
- Documentos generales aprobados.
- Documentos de operación visibles.
- Documentos históricos.
- Documentos de propiedades finalizadas.

Acciones:
- Visualizar documento.

No incluir descarga en MVP.
```

### 27. Solicitudes documentales propietario

```txt
Creá un wireframe low-fidelity para la pantalla de solicitudes documentales del propietario.

Ruta: /owner/properties/:id/requests

Usuario: Propietario.

Estados de solicitud:
- Solicitado.
- Subido.
- Aprobado.
- Rechazado.

Card de solicitud:
- Nombre del documento.
- Solicitado por.
- Fecha límite.
- Observación.
- Estado.
- Botón “Subir documento”.

Si fue rechazado:
- Mostrar motivo.
- Botón “Subir nueva versión”.

Si fue aprobado:
- Mostrar estado aprobado.
- Permitir visualizar.
```

### 28. Archivadas / historial propietario

```txt
Creá un wireframe low-fidelity para mostrar propiedades finalizadas y archivadas dentro del dashboard propietario.

Usuario: Propietario.

Comportamiento:
- Las propiedades finalizadas siguen visibles.
- El propietario puede archivarlas visualmente.
- Archivar no borra la propiedad.
- Debe existir opción “Ver archivadas”.
- Debe existir acción “Restaurar” si archivó por error.

El objetivo es que ViewPro también funcione como carpeta histórica/documental.
```

---

## Prompt para generar un flujo completo navegable

```txt
Creá un wireframe navegable low-fidelity del MVP ViewPro conectando las pantallas principales.

Flujo principal:
1. Inmobiliaria se registra.
2. Gerente principal entra al onboarding.
3. Crea vendedor.
4. Crea propietario.
5. Crea propiedad.
6. Asigna vendedores.
7. Invita al propietario.
8. Vendedor carga movimiento.
9. Propietario ve seguimiento.
10. Vendedor solicita documento.
11. Propietario sube documento.
12. Vendedor aprueba o rechaza.
13. Gerente supervisa actividad.
14. Platform Owner ve uso del tenant y límites.

El wireframe debe mostrar:
- Pantallas principales.
- Flechas de navegación.
- Acciones primarias.
- Estados importantes.
- Qué ve cada rol.

No diseñar UI final. Sólo estructura clara para explicar el MVP al cliente.
```
