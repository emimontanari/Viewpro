# InmoView — Handoff del demo (pilot) — ⛔ DEPRECADO

> ## ⛔ NO USAR — el entorno de demo está muerto
>
> **Deprecado el 2026-07-26.** El demo fue abandonado: `api-demo.inmoview.app` devuelve **502**.
> `demo.inmoview.app` todavía sirve la pantalla de login, así que quien abra ese link ve un
> formulario que no autentica. **No repartas ninguna URL ni credencial de este documento.**
>
> **Usá producción para todo**, incluidas las demos a clientes:
>
> | Qué | URL |
> | --- | --- |
> | App (usuarios reales) | https://app.inmoview.app |
> | API producto | https://api.inmoview.app |
> | Consola de operador | https://console.inmoview.app |
> | API plataforma | https://api-console.inmoview.app |
>
> Producción quedó viva el 2026-07-22 y verificada E2E — ver
> `docs/plans/2026-07-21-production-go-live-runbook.md`. Para mostrar el producto, registrá
> una inmobiliaria real en `app.inmoview.app` (self-service) en lugar de usar cuentas seed.
>
> Sigue vigente una regla del demo: **nunca** setees `INMOVIEW_DEMO_*` ni `VIEWPRO_DEMO_PASSWORD`
> en producción, y nunca corras `pnpm demo:seed` contra la DB de prod (el guard
> `seed-demo-safety.mjs` hace substring-match sobre el `DATABASE_URL`).
>
> Lo que sigue se conserva solo como registro histórico del pilot.

**Slice:** 26.5a — InmoView domain, branding, and demo handoff.
**Objetivo:** que se pueda abrir el demo desplegado, iniciar sesión con las cuentas de prueba y mostrar el pilot de forma segura.
**Última verificación live:** smoke test OK sobre `api-demo.inmoview.app` y `demo.inmoview.app` (health 200, sign-in 200, login 201 en las 6 cuentas) — **verificación de 2026-07-11, ya no válida**.

> Este documento describía un entorno **de demostración** con datos sembrados (seed). Las credenciales de abajo eran solo para el pilot; no son datos reales ni de producción real.

---

## URLs

| Qué | URL |
| --- | --- |
| App (frontend) | https://demo.inmoview.app |
| Pantalla de login | https://demo.inmoview.app/auth/sign-in |
| API | https://api-demo.inmoview.app |
| Health check de la API | https://api-demo.inmoview.app/api/health |

---

## Cómo iniciar sesión

1. Abrí https://demo.inmoview.app — redirige solo a la pantalla de login.
2. Ingresá el email de la cuenta que quieras mostrar (ver tabla) y la contraseña del demo.
3. **Contraseña (igual para todas las cuentas):** `InmoViewDemo2026!`

---

## Cuentas de prueba

Inmobiliaria del demo: **ViewPro Demo Inmobiliaria**.

| Email | Rol visible | Qué puede mostrar |
| --- | --- | --- |
| `demo@viewpro.local` | **Encargado principal** (Cuenta Madre) | Vista completa de gestión: propiedades, equipo, movimientos, panel operativo. Es la cuenta recomendada para arrancar la demo. |
| `sofia.demo@viewpro.local` | **Encargado** | Gestión operativa del equipo y las propiedades según permisos. |
| `martin.demo@viewpro.local` | **Vendedor** | Vista de vendedor: propiedades asignadas y su actividad. |
| `lucia.demo@viewpro.local` | **Vendedor** | Segundo vendedor, útil para mostrar asignaciones y aislamiento entre vendedores. |
| `propietario.demo@viewpro.local` | **Dueño / Propietario** | Vista del propietario: resumen de su propiedad y actividad informada por la inmobiliaria. |
| `admin.demo@viewpro.local` | **Admin de plataforma** (ViewPro) | Lane administrativa interna (`/admin`). No es parte del recorrido para el cliente; usar solo si hace falta mostrar la capa de plataforma. |

> Los términos internos (`PRINCIPAL_MANAGER`, `MANAGER`, `AGENT`, `OWNER`, `VIEWPRO_ADMIN`) no se muestran al usuario: la interfaz habla de **Encargado**, **Vendedor**, **Dueño** y **Cuenta Madre**.

---

## Recorrido sugerido para la demo

1. **Entrar como Encargado principal** (`demo@viewpro.local`) → mostrar el panel operativo y el listado de propiedades.
2. **Abrir una propiedad** → mostrar el detalle, los vendedores asignados y los movimientos/actividad.
3. **Gestión de equipo** → mostrar cómo se invita a un Encargado o Vendedor (la invitación se genera como link para copiar; ver limitaciones).
4. **Cambiar de perspectiva** → entrar como **Vendedor** (`martin.demo@viewpro.local`) para mostrar la vista acotada, y como **Dueño** (`propietario.demo@viewpro.local`) para la vista del propietario.

---

## Limitaciones conocidas (para no sorprenderse en la demo)

- **Invitaciones por email:** el envío automático de emails todavía no está integrado. Al invitar a alguien, la app genera un **link de invitación para copiar y enviar manualmente** (no llega un email automático).
- **Imágenes por propiedad:** límite actual de **5 imágenes** por propiedad.
- **Entorno de demo:** corre sobre una sola VPS y una base de datos de demo. Es estable para mostrar el pilot, pero no es la infraestructura de producción final.

---

## Auditoría de entorno (gate G2 — sin rutas de template expuestas)

Verificado en esta pasada de handoff:

| Ítem | Resultado |
| --- | --- |
| API health (`/api/health`) | ✅ 200 |
| Frontend sign-in | ✅ 200 |
| Login de las 6 cuentas demo | ✅ 201 (sesión creada) |
| Ruta template `billing` | ✅ neutralizada — redirige a `/dashboard` |
| Ruta `workspaces` | ✅ feature real de ViewPro (Inmobiliarias), no template |
| Rutas no autenticadas | ✅ el middleware redirige (307) a login |

La seguridad real vive en la API/BFF; el filtrado de navegación es solo UX.

---

## Contacto / soporte durante el pilot

Ante cualquier problema durante la demo, avisar al equipo de desarrollo (ViewPro). Errores en vivo quedan registrados en Sentry (proyectos `inmoview-api-demo` y `inmoview-frontend-demo`, environment `demo`).
