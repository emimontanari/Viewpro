# Recta Final — Execution Ledger (MVP → primeros clientes de pago)

> **Ledger vivo.** Se actualiza en `develop` en cada merge (no va por PR).
> Fuente de verdad compartida para no perder contexto entre sesiones.
> Última actualización: 2026-07-20 (Etapa 1: 6 work-units de código entregados — seguridad, CI,
> /admin, deploy plataforma, observabilidad, directUrl, seed operador, readiness/health. **Parte de
> código de Etapa 1 COMPLETA.** Restan solo tareas de infra/ops (necesitan credenciales/topología del
> usuario): backups Neon + restore drill, aislar hosts/secrets demo vs prod + SPOF VPS. Y 3 switches
> de deploy: SENTRY_DSN, endpoint pooled en DATABASE_URL prod, correr db:seed del operador).

## Norte

Pasar de MVP a producto comercial: **primeros clientes de pago y primeras suscripciones**.
No faltan features grandes — falta blindar producción, cerrar 2 huecos de seguridad de
config, y encender el cobro (ya diseñado como planes manuales sin pasarela).

- Informe estratégico completo (6 dimensiones): Artifact `recta-final` (ViewPro · Informe de Recta Final).
- Roadmap origen del equipo: [`2026-07-12-post-demo-roadmap.md`](./2026-07-12-post-demo-roadmap.md), [`2026-06-24-platform-backoffice-vision.md`](./2026-06-24-platform-backoffice-vision.md).

## Decisiones ya fijadas (contexto que NO se re-discute)

- **"Transacción" = cliente SaaS de pago**, no flujo de dinero. El producto es un CRM
  inmobiliario (`PropertyEngagement`); no hay ni habrá procesamiento de dinero inmobiliario.
- **Modelo comercial: planes manuales, sin pasarela** (D1 del backoffice-vision:
  "money changes hands out-of-band"). Catálogo `BASICO/PROFESIONAL/EMPRESA` ya existe
  (`apps/viewpro-api/src/platform-plans/plan-catalog.ts`) — falta **precio**.
- **Aislamiento multi-tenant verificado sólido** (row-level, locks `FOR UPDATE`, sin leaks).

## Modalidad de trabajo

- **Work-unit = un worktree + una branch + un PR.** Uno por tarea. Nunca un worktree grande.
- Worktrees en `../Viewpro-worktrees/<nombre>`, salidos de `develop`.
- Branch `tipo/descripcion`; commits **conventional**, sin atribución AI.
- **Code review al final de cada work-unit, antes de mergear** (nunca acumulado).
  - CI (automático): typecheck·lint·build·test — piso.
  - Review de calidad (yo, adversarial en lo sensible: billing/deploy/auth) — techo.
- Chico/mecánico → directo. Con lógica nueva → ciclo SDD dentro del worktree.
- Merge cuando review ✅ y CI ✅ → luego `git worktree remove` + `git branch -d`.

---

## Etapa 1 — Blindaje de producción (antes del primer cliente)

| Estado | Tarea | PR |
|---|---|---|
| ✅ | P0 seguridad: guards de producción en env.schema (secreto de sesión + cookies + s3) | #234 (`b4864e6`) |
| ✅ | CI GitHub Actions (typecheck·lint·build·test + audit no bloqueante) | #235 (`2925205`) |
| ✅ | Quick-win: fix aserción E2E `/admin` ("Admin ViewPro" → "Admin InmoView") | #236 (`582d697`) |
| ✅ | Deploy de plataforma: reescribir `viewpro-web/Dockerfile` + crear `viewpro-api/Dockerfile` | #237 (`7f1bd7c`) |
| 🟡 | Sentry en prod + módulo de observabilidad en `viewpro-api` | #239 (`99d136b`) — código listo; falta **setear `SENTRY_DSN` en prod** |
| ⬜ | Backups programados de Neon + restore drill probado | — |
| 🟡 | `directUrl` en schema.prisma (apps/api) — código listo | #240 (`4868572`) — falta: usar endpoint pooled en `DATABASE_URL` prod, replicar en viewpro-api al deploy |
| ⬜ | Aislar hosts/secrets de demo vs prod; resolver SPOF de la VPS única | — |
| ✅ | Seed de operador documentado + `viewpro-api/.env.example` (seed verificado E2E) | #241 (`f4b6129`) — correr `pnpm --filter @viewpro/platform-api db:seed` en deploy |
| ✅ | Readiness real en `/health/ready` (SELECT 1) + `HEALTHCHECK` en los 4 Dockerfiles | #242 (`2280883`) |

## Etapa 2 — Autoservicio + primer cobro (para facturar)

| Estado | Tarea |
|---|---|
| ✅ | Recuperar contraseña — backend + frontend (flujo completo E2E) | #243 (`dd6781f`) backend · #244 (`df5f5df`) FE |
| ✅ | Verificación de email — backend + frontend (soft, verify + banner de reenvío) | #245 (`0789f07`) backend · #246 (`3c09eea`) FE |
| ⬜ | Definir **precios** por tier + documentar cobro out-of-band + flujo operador TRIAL→ACTIVE |
| ⬜ | Enforcement de trial por cap + suspensión reversible por falta de pago |
| ⬜ | Notificaciones críticas por email (pedido de documento, cambio de estado) |
| ⬜ | Bump de `multer` (único CVE runtime) → luego pasar audit a gate bloqueante |
| ⬜ | Unificar la doble superficie admin (step-up canónico) |

## Etapa 3 — Automatización y escala (post primeros clientes)

| Estado | Tarea |
|---|---|
| ⬜ | MercadoPago Suscripciones (preapproval ARS) + tablas Subscription/Payment + webhook idempotente |
| ⬜ | UI de billing self-service (rehabilitar `/dashboard/billing`) |
| ⬜ | Dunning, prorrateo, upgrades/downgrades |
| ⬜ | Limpieza de código muerto (chat/kanban/forms/mock-api, `/dashboard/overview`, `TenantContextDemoController`) |
| ⬜ | OpenAPI real, logging estructurado, oxfmt + lint gate |
| ⬜ | Cerrar ciclo SDD de los 12 cambios de plataforma (verify/archive); reconciliar roadmap |
| ⬜ | Facturación electrónica AFIP/ARCA (bloqueante legal a mediano plazo) |

---

## Decisiones abiertas (destraban Etapa 2)

- **D1** — Confirmar "transacción" = cliente SaaS de pago. *(Recomendado: sí.)*
- **D2** — Precio de cada tier (BÁSICO / PROFESIONAL / EMPRESA). *(Bloquea el cobro.)*
- **D3** — Método de cobro inicial. *(Recomendado: MercadoPago link/transferencia manual.)*
- **D4** — Proveedor de email. *(Recomendado: Resend, ya integrado.)*
- **D5** — Imágenes 5→10 + auth de operador Opción 1 (ya implementada, confirmar formal).

## Follow-ups técnicos anotados

- CI: de-flake primario del patrón notification **resuelto** (#238, `d5be7d5`) — los specs
  de status-change ahora hacen poll de los side-effects async. El `retry: 2` queda como red
  de seguridad para otras suites (errors/tenants-whatsapp ECONNRESET); revisar bajarlo cuando
  se estabilicen o llegue el aislamiento de DB por worker.
- `pnpm audit` está no bloqueante hasta remediar `multer` (único high de runtime).
