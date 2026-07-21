# Recta Final — Execution Ledger (MVP → primeros clientes de pago)

> **Ledger vivo.** Se actualiza en `develop` en cada merge (no va por PR).
> Fuente de verdad compartida para no perder contexto entre sesiones.
> Última actualización: 2026-07-20 (Etapa 1: 6 work-units de código entregados — seguridad, CI,
> /admin, deploy plataforma, observabilidad, directUrl, seed operador, readiness/health. **Parte de
> código de Etapa 1 COMPLETA.** Restan solo tareas de infra/ops (necesitan credenciales/topología del
> usuario): backups Neon + restore drill, aislar hosts/secrets demo vs prod + SPOF VPS. Y 3 switches
> de deploy: SENTRY_DSN, endpoint pooled en DATABASE_URL prod, correr db:seed del operador).
> **Auditoría de código 2026-07-20** (4 frentes en paralelo — backend·frontend·tests·planes-vs-código)
> agregada abajo (sección "Auditoría de código"): arquitectura de nivel senior, pero 3 hallazgos **P0**
> a cerrar antes del primer cliente de pago.

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
| ✅ | Remediados TODOS los 6 high de producción (multer→2.2, js-yaml, effect, brace-expansion vía overrides + borrar `sort-by` muerto) + audit ahora es **gate bloqueante** (`--prod`) | #248 (`1402e4a`) — multer 2.1.1 NO estaba fixeado (necesitaba ≥2.2.0) |
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

## Auditoría de código — Recta Final (2026-07-20)

> Auditoría senior de 4 frentes (backend·frontend·tests·planes-vs-código) vía sub-agentes en paralelo.
> **Veredicto:** la arquitectura es de nivel senior — ports+adapters consistente, seam outbox→mirror CQRS
> entre `apps/api` y `apps/viewpro-api`, transacciones cuidadas (advisory lock en el outbox-writer),
> tests de integración reales contra Postgres + catálogo de aislamiento multi-tenant + E2E Playwright
> con seed, y CI real en la raíz (`.github/workflows/ci.yml`). **La distancia a producción NO es
> arquitectura** — es una red de seguridad, higiene visible al cliente y un hueco de config.

Prioridad: **P0** = no dejaría pasar a un cliente de pago. Cada fila mapea a la Etapa que le corresponde.

| Prio | Estado | Hallazgo | Evidencia | Acción |
|---|---|---|---|---|
| P0 | ✅ | Aislamiento multi-tenant — backstop **enforzado para TODA operación de clase A** (lectura + escritura by-id). Fases 1-2-3a-3b-3c. Un tenant no puede leer ni escribir datos de otro; cross-tenant update/delete → P2025 sin mutar. Probado con 2 tenants (isolation spec 10/10). **Warnings 94→0.** | `#249`·`#250`·`#251`·`#252`·Fase 3c `#253` (`f08e891`) | Cerrado en lo sustancial. **Fase 4 opcional**: guardrail estático anti-regresión + relacional clase B (`Document`/`PropertyAsset`). |
| P0 | ✅ | Dashboard **FALSO** alcanzable dentro del CRM real — data de faker. **Cerrado**: borrada la ruta `/dashboard/overview` (18 archivos) + `mock-api.ts`/`mock-api-users.ts` (solo los usaba overview; build verde). | `#247` (`c622dd5`) | Hecho. → Etapa 1. |
| ~~P0~~ **P2** | ⬜ | **Corregido (verificado 2026-07-21): NO es un hueco real.** `viewpro-api/src/config/app.config.ts:63` ya fuerza `secure: nodeEnv==='production' || ...` → cookies seguras en prod. Y los 3 secretos son `@MinLength(16)` **sin default** (fail-fast). El gap real es solo defensa-en-profundidad: falta un `assertProductionSecurity()` por consistencia con `apps/api`. | `apps/viewpro-api/src/config/app.config.ts:63`, `env.schema.ts` | Replicar el guard fail-fast en `viewpro-api` (consistencia, no urgente). → Etapa 3. |
| P1 | ⬜ | `lint` stub (`echo "not configured yet"`) en ambos backends → el gate "Lint" del CI pasa trivialmente; sin red estática para el riesgo P0 de aislamiento. | `apps/api/package.json`, `apps/viewpro-api/package.json` (`"lint"`) | Configurar ESLint real en ambos; volver el gate efectivo. → Etapa 1/2. |
| P1 | ⬜ | Código muerto de template nunca podado (`chat`, `kanban` 1023 líneas, `forms` 829, react-query-demo) — en AMBOS frontends, duplicado sin paquete UI compartido. | `apps/app-new/src/features/{chat,kanban,forms,react-query-demo,elements}/**`, `apps/*/src/components/ui/kanban.tsx`, `apps/*/src/components/forms/demo-form.tsx` | Borrar módulos huérfanos; evaluar paquete UI compartido. → Etapa 3 (limpieza). |
| P2 | ⬜ | God-components: `property-document-requests.tsx` 1104 líneas / 16 hooks, `operational-homepage.tsx` 962, `product-tables/index.tsx` 859. | `apps/app-new/src/features/**` (rutas citadas) | Split fetch/estado/presentación. → Etapa 3. |
| P2 | ⬜ | Rot de nombres product↔property — el feature `products` es en realidad `property-engagements` (auto-rotulado "Temporary Product-Named Adapter"). | `apps/app-new/src/features/products/api/service.ts` | Renombrado gradual a `property-engagements`. → Etapa 3. |
| ℹ️ | ✅ | **Resuelto (2026-07-21):** al confirmar con `pnpm audit`, multer 2.1.1 NO estaba fixeado (advisory nuevo exige ≥2.2.0). Remediados los 6 high de prod vía overrides + borrar `sort-by`; audit ahora es gate bloqueante `--prod`. | `#248` (`1402e4a`) | Hecho. |

**Nota de atribución (importante para leer el ledger):** el repo tiene 2 pares de apps — `apps/api` + `apps/app-new` (CRM InmoView, tenant-facing) y `apps/viewpro-api` + `apps/viewpro-web` (plataforma/backoffice). Las filas de Etapa 2 (recuperar contraseña, verificación de email) viven en `apps/api`/`app-new`, **no** en `viewpro-api`. `apps/web` está muerto (solo artefactos de build).

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
