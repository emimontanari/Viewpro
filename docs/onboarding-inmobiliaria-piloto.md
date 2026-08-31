# Incorporación de una inmobiliaria piloto

Checklist para acompañar el alta de una inmobiliaria, de punta a punta: cuenta,
equipo, primera propiedad, propietario y primer movimiento.

Está escrito contra el producto tal como está hoy — los nombres de campo, roles
y pantallas salen del código, no de un diseño. Si algo no coincide con lo que ves
en pantalla, eso es un hallazgo: anotalo y reportalo (última sección).

> **Antes de empezar.** Los accesos se dan a mano: no hay registro abierto ni
> cobro. Alguien del equipo crea la cuenta junto a la inmobiliaria, o le pasa el
> link para que la cree ella con acompañamiento.

---

## Los tres roles, y en qué se diferencian

Esto es lo primero que hay que acordar con la inmobiliaria, porque define quién
puede hacer qué desde el minuto uno.

| | Encargado principal | Encargado | Vendedor |
|---|---|---|---|
| Nombre interno | `PRINCIPAL_MANAGER` | `MANAGER` | `AGENT` |
| Cómo se obtiene | **crea la cuenta** | por invitación | por invitación |
| Ve propiedades | todas | todas | **solo las asignadas** |
| Crea propiedades | sí | sí | **no** |
| Carga movimientos | sí | sí | sí |
| Pide documentos al propietario | sí | sí | **no** |
| Ve todos los documentos | sí | sí | solo los que revisa |
| Invita y da de baja gente | **sí** | no | no |
| Cambia la configuración de la inmobiliaria | **sí** | no | no |

Dos cosas que conviene decir en voz alta durante la incorporación:

- **Solo hay un camino para ser Encargado principal: crear la cuenta.** No se
  puede invitar a alguien con ese rol. Quien registra la inmobiliaria queda como
  tal, así que **conviene que sea quien va a administrar el equipo**, no
  quien esté a mano ese día.
- **El vendedor ve únicamente sus propiedades asignadas.** Si abre la app y no ve
  nada, lo más probable es que todavía no tenga ninguna asignada — no es un
  error.

---

## 1. La cuenta

Quien registra queda como **Encargado principal**.

Datos que pide el formulario:

- Email
- Contraseña
- Nombre
- **Nombre de la inmobiliaria**
- Teléfono de WhatsApp (opcional)

**Verificá antes de seguir:**

- [ ] Llegó el mail de verificación. Si no llegó, revisá spam; el banner dentro
      de la app permite pedir uno nuevo.
- [ ] El nombre de la inmobiliaria está bien escrito. **Es el que ven los
      propietarios** en la invitación que reciben, así que un nombre de prueba
      queda expuesto.

---

## 2. El equipo

Solo el Encargado principal puede hacer esto, desde **Equipo**.

- [ ] Invitar a cada persona con el rol acordado: **Vendedor** o **Encargado**.
- [ ] Copiar el link de invitación y enviarlo.

**Sobre el link, algo que conviene entender antes de que pase:** la app intenta
copiarlo al portapapeles sola. Si el navegador lo bloquea, muestra el link en
pantalla con un botón **Listo** para cerrarlo una vez que lo copiaste a mano.

**El mail no es garantía de entrega.** La app dice que *pidió* enviarlo, no que
llegó. Si alguien no lo recibe, regenerá el link y pasáselo por otro medio: el
link funciona igual.

- [ ] Cada invitado aceptó y entró.
- [ ] Un vendedor confirma que ve la app y entiende que aún no tiene propiedades.

---

## 3. La primera propiedad

La carga un Encargado o el Encargado principal, desde **Propiedades**.

Requeridos: título, dirección, ciudad, provincia, tipo de propiedad y tipo de
operación.

- [ ] Cargar una propiedad **real**, no de prueba. El objetivo del piloto es ver
      el producto con datos verdaderos.
- [ ] Asignar al menos un vendedor. **Sin esto el vendedor no la ve.**
- [ ] Confirmar con el vendedor que le aparece.

---

## 4. El propietario

Desde la ficha de la propiedad, sección de propietarios.

Datos: nombre, apellido y email.

- [ ] Vincular al propietario e invitarlo.
- [ ] Verificar con él que recibió el mail y que **dice el nombre de la
      inmobiliaria**.

**Qué ve el propietario, y qué no.** La invitación y la pantalla de aceptación
muestran la inmobiliaria, el título de la propiedad, la ciudad y la provincia.
**No muestran la dirección exacta**: quien tenga el link no es necesariamente el
propietario hasta que acepta.

- [ ] El propietario aceptó y ve su propiedad en su portal.

---

## 5. El primer movimiento

Es el corazón del producto: el propietario ve el seguimiento sin llamar por
teléfono.

Un movimiento pide tipo, observación y opcionalmente un próximo paso. Los tipos:

| Tipo | Cuándo |
|---|---|
| Consulta | alguien preguntó por la propiedad |
| Visita agendada | se acordó una visita |
| Visita realizada | la visita ocurrió |
| Oferta recibida | llegó una oferta |
| Documentación | cambió algo de los papeles |
| Estado actualizado | cambió el estado de la propiedad |
| Actualización general | lo que no entra en las anteriores |

- [ ] Un vendedor carga un movimiento real sobre la propiedad.
- [ ] El propietario confirma que **lo ve en su portal**.

Ese último paso es el que cierra el círculo: si el propietario lo ve, el
producto está haciendo lo que promete.

---

## Reportar errores

Hay un botón **Enviar comentarios** dentro de la app, disponible en todo el
panel.

- Elegí el tipo: **error** o **sugerencia**.
- Contá qué pasó, entre 10 y 2000 caracteres.
- Cuando se envía, la app confirma que el comentario fue recibido.

**Qué conviene incluir**, porque la diferencia entre un reporte útil y uno que no
se puede investigar suele ser esto:

- En qué pantalla estabas.
- Qué esperabas que pasara y qué pasó.
- Si la app mostró un cartel, el texto exacto.
- La hora aproximada.

**Para quien acompaña la incorporación:** anotá también lo que la persona *dudó*,
no solo lo que falló. Una pantalla donde alguien se detiene a pensar es un
hallazgo aunque no haya ningún error.

---

## Cierre

- [ ] Los tres roles fueron usados por personas distintas.
- [ ] Hay al menos una propiedad real con propietario aceptado y un movimiento
      visible para él.
- [ ] Los hallazgos de la incorporación quedaron reportados.

> **Este material todavía no fue validado en una incorporación real.** Ese es el
> último criterio de #289 y solo se cumple acompañando a la primera inmobiliaria.
> Al hacerlo, corregí acá lo que no coincida: el valor de este checklist es
> describir el producto que existe, no el que imaginamos.
