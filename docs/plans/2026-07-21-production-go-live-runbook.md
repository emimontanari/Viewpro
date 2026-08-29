# Production Go-Live Runbook — ViewPro / InmoView

> ✅ **EJECUTADO 2026-07-22 — PRODUCCIÓN VIVA.** Los 4 servicios corriendo con TLS:
> `app.inmoview.app` (Vercel) · `api.inmoview.app` (Dokploy) · `console.inmoview.app` (Vercel) ·
> `api-console.inmoview.app` (Dokploy). Neon x2 migradas, R2 storage, Sentry x3, Resend emails.
> Operador seedeado. Smoke E2E verificado en prod: registrar inmobiliaria → aparece en consola (3s) →
> activar TRIAL→ACTIVE → operar → step-up+baja → forgot-password envía email real. IDs/secretos en el
> `deploy-secrets.env` de la sesión. Restan solo tareas de Paso 7 (backups Neon, HTTPS panel Dokploy).
>
> Checklist secuenciado para llevar `develop` a producción. Ejecutá los pasos en orden.
> Fuente de verdad de env vars: los `env.schema.ts` de cada backend (fallan al boot si faltan).
> Basado en el deploy de demo (2026-07-11) + los 6 T-0 gates del equipo. Fecha: 2026-07-21.

## Objetivo y alcance

Poner en producción, **aislado del demo**, los 4 servicios:

| Servicio | Rol | Puerto | Deploy | Dominio prod |
|---|---|---|---|---|
| `apps/api` | Backend producto (InmoView) | 3001 | Dokploy | `api.inmoview.app` |
| `apps/app-new` | Frontend producto | 3000 | Vercel o Dokploy | `app.inmoview.app` |
| `apps/viewpro-api` | Backend plataforma/operador | 3002 | Dokploy | `api-console.viewpro.app` (TBD) |
| `apps/viewpro-web` | Frontend operador | 3000 | Vercel o Dokploy | `console.viewpro.app` (TBD) |

**Regla de oro (Gate 3):** el identificador de la DB de demo NUNCA debe ser substring del `DATABASE_URL` de prod, y NUNCA setees `INMOVIEW_ENVIRONMENT` / `INMOVIEW_DEMO_SEED_ALLOWED` / `INMOVIEW_DEMO_DATABASE_IDENTIFIER` / `VIEWPRO_DEMO_PASSWORD` en prod. El guard `seed-demo-safety.mjs` es un substring-match.

---

## Paso 0 — Provisionar infraestructura (antes de tocar env)

- [ ] **Neon — DB de producto**: proyecto/branch **dedicado de prod** (separado del demo). Anotá el endpoint **pooled** (`-pooler`, agregar `?pgbouncer=true&sslmode=require`) y el endpoint **direct** (`?sslmode=require`).
- [ ] **Neon — DB de plataforma**: **segunda DB** separada (Design B). Anotá su connection string. ⚠️ Ver gap de `directUrl` en el Paso 4.
- [ ] **Cloudflare R2** — 4 buckets (o 2 con prefijos): documentos **privado/firmado** (`inmoview-documents`) + imágenes **público** (`inmoview-images`). Generá access keys.
- [ ] **Sentry** — proyectos de prod (`inmoview-api`, `inmoview-frontend`, `viewpro-platform-api`), environment `production`, **separados del `demo`**. Reglas de alerta: error-rate + saturación de conexiones + uptime a `/api/health`.
- [ ] **DNS** — `app.inmoview.app`, `api.inmoview.app`, y los dominios de la consola de operador (definir).
- [ ] **Revocar** el `SENTRY_AUTH_TOKEN` de demo que quedó expuesto (finding de `verify-evidence.md`).

---

## Paso 1 — Generar secretos

Generá cada uno con `openssl rand -base64 48` (≥32 chars). **Reglas críticas:**

| Secreto | App(s) | Regla |
|---|---|---|
| `ACCESS_TOKEN_SECRET` (producto) | `apps/api` **=** `apps/app-new` | ≥32 chars, NO el placeholder. **Mismo valor en ambas** (el BFF valida tokens). |
| `PLATFORM_CONTROL_SECRET` | `apps/api` **=** `apps/viewpro-api` | ≥16. **Mismo valor en ambas** (token de servicio del control-lane). |
| `ACCESS_TOKEN_SECRET` (operador) | `apps/viewpro-api` | ≥16. **Distinto** del de producto. |
| `STEP_UP_TOKEN_SECRET` | `apps/viewpro-api` | ≥16. **Distinto** de los otros dos de viewpro-api. |
| `DOCUMENT_STORAGE_SIGNING_SECRET` | `apps/api` | secreto para firmar URLs de documentos. |

⚠️ En `viewpro-api`, los 3 secretos (`ACCESS_TOKEN_SECRET`, `STEP_UP_TOKEN_SECRET`, `PLATFORM_CONTROL_SECRET`) **deben ser distintos entre sí** o el boot falla (guard `assertDistinctSecrets`).

---

## Paso 2 — Configurar env vars (por servicio)

### 2a. `apps/api` (producto) — en Dokploy

**Requeridas (el boot FALLA sin ellas, o con valores inseguros en prod):**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=<Neon PRODUCTO pooled>?pgbouncer=true&sslmode=require
DIRECT_URL=<Neon PRODUCTO direct>?sslmode=require
ACCESS_TOKEN_SECRET=<≥32, = app-new>
PLATFORM_CONTROL_SECRET=<= viewpro-api>
COOKIE_SECURE=true                 # prod lo exige (assertProductionSecurity)
DOCUMENT_STORAGE_DRIVER=s3         # prod lo exige
CORS_ORIGIN=https://app.inmoview.app
APP_PUBLIC_URL=https://app.inmoview.app
API_PUBLIC_URL=https://api.inmoview.app
COOKIE_DOMAIN=.inmoview.app
```
**Storage de documentos (S3/R2, privado):**
```
DOCUMENT_STORAGE_S3_BUCKET=inmoview-documents
DOCUMENT_STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
DOCUMENT_STORAGE_S3_REGION=auto
DOCUMENT_STORAGE_S3_ACCESS_KEY_ID=<...>
DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY=<...>
DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE=true
DOCUMENT_STORAGE_SIGNING_SECRET=<...>
```
**Storage de imágenes (S3/R2, público) — el app FALLA al boot en prod si el driver no es `s3` (validado en `property-images.storage.ts`), así que seteá estas sí o sí:**
```
PROPERTY_IMAGES_STORAGE_DRIVER=s3
PROPERTY_IMAGES_S3_BUCKET=inmoview-images
PROPERTY_IMAGES_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
PROPERTY_IMAGES_S3_REGION=auto
PROPERTY_IMAGES_S3_ACCESS_KEY_ID=<...>
PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY=<...>
PROPERTY_IMAGES_S3_FORCE_PATH_STYLE=true
PROPERTY_IMAGES_PUBLIC_BASE_URL=https://<cdn-público-de-imágenes>
```
**Email (Resend) + Sentry:**
```
RESEND_API_KEY=<...>
EMAIL_FROM_ADDRESS=no-reply@inmoview.app
SENTRY_DSN=<inmoview-api prod DSN>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```
(Opcionales con default sano: rate limits, TTLs de token, `PLATFORM_DATA_BATCH_LIMIT`.)

### 2b. `apps/viewpro-api` (plataforma) — en Dokploy
```
NODE_ENV=production
PORT=3002
DATABASE_URL=<Neon PLATAFORMA pooled>?pgbouncer=true&sslmode=require
DIRECT_URL=<Neon PLATAFORMA direct>?sslmode=require
ACCESS_TOKEN_SECRET=<≥16, operador, distinto del de producto>
STEP_UP_TOKEN_SECRET=<≥16, distinto>
PLATFORM_CONTROL_SECRET=<= apps/api>
INMOVIEW_API_INTERNAL_URL=https://api.inmoview.app   # apunta al backend de producto
CORS_ORIGIN=https://console.viewpro.app
COOKIE_DOMAIN=.viewpro.app
COOKIE_SECURE=true          # viewpro-api NO tiene guard de prod → setealo explícito
SENTRY_DSN=<viewpro-platform-api prod DSN>
SENTRY_ENVIRONMENT=production
# Operador seed (Paso 5):
SEED_OPERATOR_EMAIL=<tu email de operador>
SEED_OPERATOR_PASSWORD=<password fuerte>
```
⚠️ `ABSOLUTE_SESSION_SECONDS` (28800) debe ser `>` `IDLE_TIMEOUT_SECONDS` (600) — los defaults ya cumplen.

### 2c. `apps/app-new` (frontend producto) — en Vercel/Dokploy
```
BFF_API_URL=https://api.inmoview.app/api
NEXT_PUBLIC_API_URL=https://api.inmoview.app/api
NEXT_PUBLIC_APP_URL=https://app.inmoview.app
ACCESS_TOKEN_SECRET=<= apps/api ACCESS_TOKEN_SECRET>
BUILD_STANDALONE=true                 # solo si Docker; en Vercel no
NEXT_PUBLIC_PROPERTY_IMAGES_PUBLIC_BASE_URL=https://<cdn-imágenes>
# Sentry (opcional):
NEXT_PUBLIC_SENTRY_DSN=<...>
NEXT_PUBLIC_SENTRY_DISABLED=false
```

### 2d. `apps/viewpro-web` (frontend operador) — en Vercel/Dokploy
```
NEXT_PUBLIC_API_URL=https://<api-console.viewpro.app>/api
BUILD_STANDALONE=true                 # solo si Docker
```
(NO lleva `ACCESS_TOKEN_SECRET` ni `BFF_API_URL` — Design B, pega directo a la API.)

---

## Paso 3 — Build & deploy

**Build context de los 4: `viewpro-app/`** (la raíz del monorepo), con `-f apps/<app>/Dockerfile`. Node 22, pnpm 10.13.1. Los Dockerfiles ya corren `db:generate` + `build`; **las migraciones NO corren en el arranque** (son Paso 4).

- [ ] Dokploy: crear app `apps/api` (context `viewpro-app`, Dockerfile `apps/api/Dockerfile`, puerto 3001, healthcheck ya incluido a `/api/health`).
- [ ] Dokploy: crear app `apps/viewpro-api` (Dockerfile `apps/viewpro-api/Dockerfile`, puerto 3002).
- [ ] Frontends: Vercel (root `viewpro-app`, cada app) o Dokploy con sus Dockerfiles (puerto 3000).
- [ ] Traefik/Dokploy: rutear los dominios a cada contenedor con TLS.

---

## Paso 4 — Migraciones de producción (paso explícito, NO en el arranque)

Corré `migrate deploy` (NUNCA `migrate dev`) contra el endpoint **direct** de cada Neon:

```bash
cd viewpro-app
pnpm install --frozen-lockfile

# Producto — corre sobre DIRECT_URL:
DATABASE_URL="<Neon producto DIRECT>" DIRECT_URL="<Neon producto DIRECT>" \
  pnpm --filter @viewpro/api exec prisma migrate deploy

# Plataforma — corre sobre DIRECT_URL (viewpro-api ya soporta directUrl, PR #255):
DATABASE_URL="<Neon plataforma DIRECT>" DIRECT_URL="<Neon plataforma DIRECT>" \
  pnpm --filter @viewpro/platform-api exec prisma migrate deploy
```

> `viewpro-api` ya tiene el split `url`/`directUrl` (PR #255), así que podés poner
> la DB de plataforma detrás del **pooler** de Neon (`DATABASE_URL` = pooled,
> `DIRECT_URL` = direct) igual que el producto. Las migraciones corren sobre el direct.

---

## Paso 5 — Seed del primer operador

Sin esto **no hay con quién loguearse a la consola de operador**. Idempotente (upsert por email).

```bash
DATABASE_URL="<Neon plataforma DIRECT>" \
SEED_OPERATOR_EMAIL="<tu email>" \
SEED_OPERATOR_PASSWORD="<password fuerte>" \
  pnpm --filter @viewpro/platform-api db:seed
```

> **NO corras `pnpm demo:seed`** en prod (es el seed de demo, con datos ficticios y guardado por `seed-demo-safety.mjs`).

---

## Paso 6 — Smoke checks (confirmar que quedó bien)

- [ ] `curl https://api.inmoview.app/api/health` → 200 (liveness).
- [ ] `curl https://api.inmoview.app/api/health/ready` → 200 (readiness = DB reachable). Si da 503, la DB no conecta.
- [ ] `curl https://<api-console>/api/health` → 200 (plataforma viva).
- [ ] Registrar una inmobiliaria real en `app.inmoview.app` (self-service) → debería loguear + mandar email de verificación (banner "verificá tu email").
- [ ] Probar "olvidé mi contraseña" → llega el email (Resend configurado).
- [ ] Log in to the operator console with the seeded operator → see the newly registered tenant appear (authenticated demand triggers the change-feed sync; idle performs no synchronization work — timer retired in Slice D, issue #327).
- [ ] Subir una imagen a una propiedad → confirmar que persiste tras un redeploy (valida `PROPERTY_IMAGES_STORAGE_DRIVER=s3`).
- [ ] Verificar en Sentry (prod) que llegan eventos.

---

## Paso 7 — Post go-live (no bloqueante, pero pronto)

- [ ] **Backups Neon programados + un restore drill real** (restaurar a una branch y verificar datos). Gate 4 — crítico antes de tener volumen.
- [ ] R2: setear **CORS** en el bucket de documentos a mano en Cloudflare (la key object-scoped no puede `PutBucketCors`).
- [ ] Alertas de saturación de conexiones en Neon ("la primera pared").
- [ ] Resolver el **SPOF de la VPS única** (Gate 1/7) cuando haya >1 cliente: reevaluar multi-nodo o Railway/Fly/Render.

---

## Gaps de código (estado 2026-07-21)

1. ✅ **`viewpro-api` sin `directUrl`** — CERRADO en PR #255. Ya soporta pooler de Neon.
2. ✅ **`PROPERTY_IMAGES_STORAGE_DRIVER`** — **falso positivo**: verificado, `property-images.storage.ts` YA falla al boot en prod si el driver no es `s3` (factory al bootstrap). No requería fix.
3. ✅ **`viewpro-api` sin `assertProductionSecurity`** — CERRADO en PR #255 (fuerza `COOKIE_SECURE=true` al boot en prod, en paridad con apps/api).

Los tres resueltos/descartados — el runbook queda sin asteriscos de código.
