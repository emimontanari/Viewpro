# Importar propiedades desde ZonaProp — hallazgos

Salida de descubrimiento de #294. **Nada de esto es suposición**: cada afirmación
se validó corriendo el pipeline contra datos reales el 2026-08-31, con un costo
total de ~13 centavos de dólar en Apify.

Inmobiliaria de prueba: **Soriano Propiedades** (Córdoba), publisher `30827834`,
74 propiedades publicadas. La aportó el usuario; no se usaron credenciales de
nadie ni se pidió acceso a ningún sistema privado.

> **Alcance.** #294 es de descubrimiento y no incluye código de importador. Este
> documento registra qué funciona, qué no, y con qué reglas — para que quien
> implemente no repita las siete corridas que costó averiguarlo.

---

## El pipeline, en tres pasos

```
1. apify/web-fetch  →  la página de la inmobiliaria
      formats: ["links"]
      pasa Cloudflare (HTTP 200) y devuelve las URLs de aviso CON SLUG,
      más el total en metadata.title: "74 SORIANO PROPIEDADES — …"
      30 links por página; se pagina con ?n_pg=N

2. filtrar los links que matchean /propiedades/clasificado/

3. memo23/zonaprop-scraper  →  esas URLs en startUrls
      162 campos por propiedad
```

## Lo que NO funciona

Está acá porque cada línea costó una corrida, y las cuatro parecen razonables
antes de probarlas.

| intento | resultado |
|---|---|
| La URL de `/inmobiliarias/…` directo en `startUrls` | **0 resultados** |
| `zonapropSearchParametersOverride: "publisher_id:30827834"` | **0 resultados** |
| URL de aviso **sin el slug** (`/clasificado/59907435.html`) | **0 resultados** |
| `https://bsre.zonaprop.com.ar/v4/postings/<id>` | **0 resultados** |
| `WebFetch` común contra la página de la inmobiliaria | **403** (Cloudflare) |

Ninguno de los otros 7 actores de ZonaProp del store de Apify declara soporte
para páginas de inmobiliaria. **El slug es obligatorio** en las URLs de aviso, y
por eso el paso 1 no se puede saltear.

---

## Reglas de mapeo

### `city` y `province`

`location.neighborhood` es una lista separada por comas donde **el último
elemento es la provincia** y el anteúltimo la ciudad:

```
"Nueva Córdoba, Córdoba, Córdoba"         →  ciudad: Córdoba    provincia: Córdoba
"Aires del Nordeste, Unquillo, Córdoba"   →  ciudad: Unquillo   provincia: Córdoba
"Palermo, Capital Federal"                →  ciudad: Capital Federal
                                             provincia: Capital Federal
```

**El caso borde es CABA**: trae **dos** elementos, no tres, porque Capital
Federal es ciudad y provincia a la vez. Una regla escrita mirando solo una
muestra porteña sale mal; una escrita mirando solo Córdoba también. Hacen falta
las dos.

`location.postalCode` viene **vacío o null** — no sirve como respaldo.
`location.streetAddress` va directo a `addressLine` (`"Crisol 305 2"`).

### Atributos numéricos

Vienen en `mainFeatures[]` con **códigos estables**, no con etiquetas — así que
no se rompen si ZonaProp cambia una traducción:

| código | ejemplo | campo |
|---|---|---|
| `CFT101` | `"57 m² cub."` | `coveredAreaSqm` |
| `CFT100` | `"57 m² tot."` | `totalAreaSqm` |
| `CFT1` | `"3 amb."` | `rooms` |
| `CFT2` | `"2 dorm."` | `bedrooms` |
| `CFT3` | `"2 baños"` | `bathrooms` |
| `CFT5` | `"25 años"` / `"A estrenar"` | `ageYears` (*a estrenar* = 0) |
| `1000029` | `"N"` | `orientation` |

Todos son **strings con unidad**: hay que extraer el número.

### La trampa de scrapear por detalle

Al pasar URLs de aviso (que es el único camino que funciona), **quedan en `null`
los campos que vienen de la tarjeta de listado**:

```
labels.realEstateType   →  null
units.totalAreaRange    →  null
units.roomsRange        →  null
location.listCardAddressLine → null
```

Hay que usar `realEstateType` (nivel raíz) y `posting.real_estate_type`, que sí
vienen (`"Departamento"`, `"Terrenos"`), y `mainFeatures` para los números.
Quien mapee contra los campos de nombre más obvio se va a encontrar todo vacío.

### Enums

`PropertyType` tiene cinco valores con `OTHER` de escape, así que la traducción
desde los tipos de ZonaProp (departamento, casa, PH, local, oficina, cochera,
terreno, galpón, quinta, campo) es una tabla corta y sin ambigüedad.
`PropertyOperationType` es `SALE` / `RENT`; *alquiler temporario* cae en `RENT`.

---

## Verificar que la cuenta es de la inmobiliaria

El publisher ID está en el slug de la URL (`…_30827834-inmuebles.html`) **y en
cada resultado** (`publisher.id`). Coincidieron en las tres propiedades de
prueba.

Pero que alguien pegue una URL no prueba que sea suya. Con `enrichContacts`
(**una sola propiedad, $0.03 por inmobiliaria** — el contacto es de la agencia,
no del aviso) se obtiene:

```
contactName:  "SORIANO PROPIEDADES"
phone:        "+5493513696205"
whatsApp:     "+5493516338594"        ← distinto del teléfono
agencyEmail:  "mdutto@sorianopropiedades.com.ar"
```

Dos cosas que definen cómo comparar:

- **Teléfono y WhatsApp son números distintos.** Comparar contra uno solo hace
  fallar verificaciones legítimas.
- **Comparar el dominio del mail, no el mail.** ZonaProp publica el de una
  persona (`mdutto@`) y quien registra la cuenta puede ser otra de la misma
  oficina. El dominio coincide igual.

**Que no coincida no debe bloquear.** Una inmobiliaria que se registró con un
Gmail es perfectamente legítima y quedaría afuera. Sirve para *ganar confianza*
y saltear la revisión manual, no para cerrar la puerta.

Hoy `whatsappPhone` es opcional en el registro; apoyarse en esta verificación
supone pedirlo, o al menos sugerirlo antes de importar.

---

## Costos

`memo23/zonaprop-scraper` es **pay-per-event**:

| evento | precio |
|---|---|
| resultado | $0.001 |
| arranque del actor | $0.007 (por GB, mínimo uno) |
| contacto enriquecido | $0.03 |

**Una inmobiliaria de 74 propiedades sale ~10 centavos**, paginación incluida,
más 3 centavos si se verifica el contacto.

> **`callOptions.maxItems` se ignora en pay-per-event.** Hay que acotar con el
> `maxItems` propio del actor y poner `maxTotalChargeUsd` como techo. Es el tipo
> de detalle que se descubre cuando llega la factura.

---

## Lo que la importación no resuelve

**ZonaProp no publica al propietario.** Ni siquiera con enriquecimiento: eso trae
el teléfono del *agente* y el mail de la *inmobiliaria*.

Las propiedades entran completas — dirección, medidas, precio, fotos — pero con
`ownerName` y `ownerEmail` vacíos, y el propietario se carga después con el flujo
que ya existe.

No es un detalle menor: **el propietario es quien recibe la invitación y ve el
portal**, que es la razón de ser del producto. Conviene decirlo en el onboarding
para que nadie espere que aparezca solo.

---

## Restricciones de manejo de muestras

- No se pidieron ni se almacenaron credenciales de ZonaProp ni de ningún CRM.
- Los datos usados son los que la inmobiliaria **ya publica** en su página
  pública.
- La única URL de prueba la aportó el usuario.
- Las corridas se acotaron con `maxItems` bajo y `maxTotalChargeUsd`.

## Nota sobre el alcance de #294

El issue excluye explícitamente el scraping de terceros y los supuestos sobre
ZonaProp. **Este trabajo entra en ambas exclusiones**, y se hizo igual por
decisión del dueño del producto, que sostiene que ~90% de las inmobiliarias
argentinas publican ahí y que sin resolver esa migración el CRM no arranca.

Queda registrado acá, y no escondido, porque quien revise esto más adelante
merece ver que la decisión fue deliberada y no un descuido.
