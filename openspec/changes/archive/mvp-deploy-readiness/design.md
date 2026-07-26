# Design — InmoView MVP Deploy Readiness

## Technical Approach

Ship the public demo as a production-like environment using the current monorepo apps, without rewriting the product architecture:

```txt
https://demo.inmoview.app      -> Vercel -> apps/app-new (Next.js)
https://api-demo.inmoview.app  -> Dokploy (Hostinger KVM2 VPS, Traefik HTTPS) -> apps/api (NestJS Docker service)
Neon Postgres                 -> dedicated demo database
Cloudflare R2 / S3-compatible -> documents + property images
Sentry                        -> frontend + API observability
```

The implementation should happen in small, reviewable slices. The most important engineering change is moving property images from API-local filesystem storage to the same object-storage discipline used for documents. Deployment configuration and runbooks should be explicit, but secrets must stay out of the repository.

## Current Code Touchpoints

### API deploy/runtime

- `viewpro-app/apps/api/package.json` — build/typecheck/test/migrate/seed scripts.
- `viewpro-app/apps/api/src/config/app.config.ts` — production URL/CORS/auth/cookie/Sentry env parsing.
- `viewpro-app/apps/api/src/bootstrap/create-app.ts` — CORS credentials, global `/api` prefix, Swagger, static `/uploads` serving.
- New: `viewpro-app/apps/api/Dockerfile` or root-level Dockerfile with API target.
- New: deploy/runbook docs for the Dokploy application settings and env variables.

### Frontend deploy/runtime

- `viewpro-app/apps/app-new/package.json` — build/test/lint/seeded smoke scripts.
- `viewpro-app/apps/app-new/next.config.ts` — `BUILD_STANDALONE`, remote image allowlist, Sentry source maps.
- `viewpro-app/apps/app-new/src/proxy.ts` — cookie/JWT refresh behavior against API.
- New/updated: deploy env checklist for Vercel.

### Document storage

- `viewpro-app/apps/api/src/documents/documents.module.ts` — selects `DOCUMENT_STORAGE_PORT`; already requires `DOCUMENT_STORAGE_DRIVER=s3` in production.
- `viewpro-app/apps/api/src/documents/storage/s3-document-storage.adapter.ts` — S3/R2-compatible signed PUT/GET adapter.
- Existing document storage config can remain the canonical model for R2/S3 env handling.

### Property image storage

Current state:

- `viewpro-app/apps/api/src/property-engagements/property-images.storage.ts` defines `LocalPropertyImagesStorage` only.
- `viewpro-app/apps/api/src/property-engagements/property-engagements.module.ts` provides `LocalPropertyImagesStorage` directly.
- `upload-property-image.use-case.ts` and `delete-property-image.use-case.ts` inject `LocalPropertyImagesStorage` directly.
- `create-app.ts` exposes local `/uploads` for images.
- `next.config.ts` only allowlists `api.slingacademy.com` for remote images.

Design direction:

- Introduce a storage port/token for property images, mirroring the documents storage port pattern.
- Keep local filesystem adapter for local development/test.
- Add S3/R2 property image adapter for demo/production-like deploy.
- Select storage driver via `PROPERTY_IMAGES_STORAGE_DRIVER`, with production/demo requiring `s3`.
- Use stable object keys under `property-images/<tenantId>/<propertyAssetId>/<imageId>.<ext>`.
- Return durable URLs that the frontend can render after API redeploy.

## Proposed File Changes

### 1. API Docker/runtime

Add one explicit Docker build path for the API.

Preferred file:

- `viewpro-app/apps/api/Dockerfile`

Docker strategy:

- Use Node image compatible with current project.
- Enable pnpm via Corepack.
- Copy workspace manifests and app/package sources.
- Install with frozen lockfile.
- Generate Prisma client if required by build/runtime.
- Build `@viewpro/api`.
- Start with compiled API entrypoint, e.g. `node dist/main.js` from `apps/api`.

Important: do **not** run Prisma migrations or `demo:seed` automatically in the container `CMD`. Migrations and seed/reset remain explicit deploy operations.

No repo-committed platform config file is required. The Dokploy application
config (source repo/Dockerfile, build context, domain, Traefik HTTPS, and env
vars) is set in the Dokploy dashboard and documented in the runbook.

### 2. Property image object storage

Refactor:

- `viewpro-app/apps/api/src/property-engagements/property-images.storage.ts`

Into a port + adapters. Either split files immediately or keep a compact first pass, but the final shape should be clear:

```txt
property-engagements/
  property-images.storage.ts              # shared types + token + driver resolver OR barrel
  storage/
    property-images-storage.port.ts       # token/types if split
    local-property-images-storage.adapter.ts
    s3-property-images-storage.adapter.ts
```

Introduce:

```ts
export const PROPERTY_IMAGES_STORAGE_PORT = Symbol('PROPERTY_IMAGES_STORAGE_PORT')

export interface PropertyImagesStoragePort {
  save(input: SavePropertyImageInput): Promise<SavedPropertyImage>
  delete(storageKey: string): Promise<void>
}
```

Update:

- `property-engagements.module.ts` to provide local + s3 adapters and select by driver.
- `upload-property-image.use-case.ts` to inject `PROPERTY_IMAGES_STORAGE_PORT`.
- `delete-property-image.use-case.ts` to inject `PROPERTY_IMAGES_STORAGE_PORT`.

New env:

```txt
PROPERTY_IMAGES_STORAGE_DRIVER=local|s3
PROPERTY_IMAGES_S3_BUCKET=<bucket>
PROPERTY_IMAGES_S3_ENDPOINT=<r2/s3 endpoint>
PROPERTY_IMAGES_S3_REGION=auto
PROPERTY_IMAGES_S3_ACCESS_KEY_ID=<secret>
PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY=<secret>
PROPERTY_IMAGES_S3_FORCE_PATH_STYLE=true|false
PROPERTY_IMAGES_PUBLIC_BASE_URL=<optional public bucket/custom domain URL>
PROPERTY_IMAGES_SIGNED_READ_URLS=true|false (only if design chooses signed image URLs)
```

Recommended first cut for demo:

- Upload images to R2/S3 through API server using `PutObjectCommand`.
- Store `storageKey` exactly as today in DB.
- Store `url` as a durable object-storage URL if bucket is public/readable behind custom domain, or as API-mediated URL if access must remain private.

For demo simplicity, prefer a public-read R2 bucket/custom domain for non-sensitive property images. Documents remain signed/private. If public property image hosting is unacceptable, design must add an API read endpoint or signed URL refresh flow, which is larger.

### 3. Next image allowlist

Update:

- `viewpro-app/apps/app-new/next.config.ts`

Add remote pattern support for the selected property image host:

```txt
<r2-public-host-or-custom-domain>
api-demo.inmoview.app if API-mediated image URLs remain in use
```

Do not hardcode secret bucket endpoints into client code. Use public hostnames only.

### 4. Seed/reset guardrails

Update:

- `viewpro-app/apps/api/scripts/seed-demo.mjs`

Add explicit guardrails before destructive/reset behavior:

```txt
INMOVIEW_DEMO_SEED_ALLOWED=true
INMOVIEW_ENVIRONMENT=demo
DATABASE_URL contains/points to known demo database identifier, if safely detectable
```

The exact guard should be strict enough to prevent accidental production execution but not rely on secrets in source control.

The seed should continue to support:

- stable demo password via `VIEWPRO_DEMO_PASSWORD`
- deterministic time via `VIEWPRO_DEMO_NOW`
- deterministic WhatsApp phone via `VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE`

If the seed currently writes local image files, update it to seed property images through the selected property image storage abstraction or a small internal script helper so seeded image URLs survive redeploys.

### 5. Environment/runbook docs

Add docs under the OpenSpec change and/or deploy docs. Recommended:

```txt
openspec/changes/mvp-deploy-readiness/deploy-runbook.md
openspec/changes/mvp-deploy-readiness/env-checklist.md
openspec/changes/mvp-deploy-readiness/demo-checklist.md
```

These are change artifacts until verified/archived. They can later be promoted into canonical docs.

Checklist sections:

- Vercel frontend env.
- Dokploy API env.
- Neon Postgres linkage.
- R2/S3 bucket and CORS configuration.
- Domain/DNS mapping.
- Cookie/CORS values.
- Sentry env/release notes.
- Migration command.
- Seed/reset command.
- Backup/restore command/evidence.
- Rollback steps.

No secret values in docs.

## Environment Design

### API — Dokploy (Hostinger KVM2 VPS)

Required values (set in the Dokploy UI, never committed):

```txt
NODE_ENV=production
PORT=<configured; Traefik routes api-demo.inmoview.app to this port>
APP_PUBLIC_URL=https://demo.inmoview.app
API_PUBLIC_URL=https://api-demo.inmoview.app
CORS_ORIGIN=https://demo.inmoview.app
DATABASE_URL=<Neon direct (non-pooled) URL, with ?sslmode=require>
ACCESS_TOKEN_SECRET=<shared strong secret>
COOKIE_DOMAIN=.inmoview.app
COOKIE_SECURE=true
DOCUMENT_STORAGE_DRIVER=s3
DOCUMENT_STORAGE_SIGNING_SECRET=<strong secret>
DOCUMENT_STORAGE_S3_BUCKET=<r2-documents-bucket>
DOCUMENT_STORAGE_S3_ENDPOINT=<r2 endpoint>
DOCUMENT_STORAGE_S3_REGION=auto
DOCUMENT_STORAGE_S3_ACCESS_KEY_ID=<secret>
DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY=<secret>
DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE=true
PROPERTY_IMAGES_STORAGE_DRIVER=s3
PROPERTY_IMAGES_S3_BUCKET=<r2-images-bucket or shared bucket>
PROPERTY_IMAGES_S3_ENDPOINT=<r2 endpoint>
PROPERTY_IMAGES_S3_REGION=auto
PROPERTY_IMAGES_S3_ACCESS_KEY_ID=<secret>
PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY=<secret>
PROPERTY_IMAGES_S3_FORCE_PATH_STYLE=true
PROPERTY_IMAGES_PUBLIC_BASE_URL=<public R2/custom-domain URL>
SENTRY_DSN=<api DSN>
SENTRY_ENVIRONMENT=demo
SENTRY_TRACES_SAMPLE_RATE=<low demo value>
```

### Frontend — Vercel

Required values:

```txt
NEXT_PUBLIC_APP_URL=https://demo.inmoview.app
NEXT_PUBLIC_API_URL=https://api-demo.inmoview.app/api
BFF_API_URL=https://api-demo.inmoview.app/api
ACCESS_TOKEN_SECRET=<same value as API>
NEXT_PUBLIC_SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=<frontend DSN>
NEXT_PUBLIC_SENTRY_ORG=<if source maps enabled>
NEXT_PUBLIC_SENTRY_PROJECT=<if source maps enabled>
SENTRY_TRACES_SAMPLE_RATE=<low demo value>
```

If Vercel builds from repo root, configure project root/build command to target `viewpro-app/apps/app-new` through pnpm workspace scripts.

## Cookie/CORS Design

Use explicit two-subdomain topology:

```txt
Frontend origin: https://demo.inmoview.app
API origin:      https://api-demo.inmoview.app
Cookie domain:   .inmoview.app
Secure cookies:  true
CORS origin:     https://demo.inmoview.app
Credentials:     true
```

Do not use wildcard CORS in demo/production-like mode.

Validation must prove:

- login sets expected cookies;
- protected frontend pages load after refresh;
- refresh token flow works;
- owner/seller/manager route boundaries still hold.

## Migration and Seed Design

### Migrations

Run explicitly:

```bash
cd viewpro-app
pnpm --filter @viewpro/api exec prisma migrate deploy --schema prisma/schema.prisma
```

The runbook must require the operator to verify the target database before running. Demo deployments must use Prisma `migrate deploy`, not local-development `migrate dev`.

### Seed/reset

Run explicitly, never during app boot:

```bash
cd viewpro-app
INMOVIEW_ENVIRONMENT=demo \
INMOVIEW_DEMO_SEED_ALLOWED=true \
VIEWPRO_DEMO_PASSWORD=<demo-password> \
pnpm demo:seed
```

The design should prefer failing closed if required demo guard env vars are absent.

## Backup/Restore/Rollback Design

Minimum evidence for demo readiness:

- Neon branch/point-in-time restore or documented `pg_dump` before demo reset.
- Restore procedure documented and dry-run evidence via a Neon branch without risking the active demo.
- API rollback: redeploy a previous build/commit from Dokploy deployment history; the Hostinger VPS weekly backups / snapshot are the fallback.
- Frontend rollback: Vercel previous deployment promotion/rollback.
- R2 reset stance: demo bucket can be reseeded, with lifecycle policy or manual cleanup documented.

## Validation Plan

### Local pre-deploy

```bash
cd viewpro-app
pnpm install --frozen-lockfile
pnpm db:validate
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

If API tests require destructive test DB, use only the configured test DB per `openspec/config.yaml`.

### Deployed smoke

```bash
curl -fsS https://api-demo.inmoview.app/api/health
curl -fsS https://api-demo.inmoview.app/api/docs >/dev/null
curl -I https://demo.inmoview.app
```

### Browser demo checklist

- Manager login.
- Properties list and detail.
- Property images load after API redeploy/restart.
- Document upload/read path works through R2/S3.
- Seguimiento activity and filters render.
- Notifications deep-link and read/unread persist.
- Seller login respects visibility boundaries.
- Owner login shows portal/timeline/documents/contact CTA.
- Admin/global demo screen works only if included in demo story.
- Starter/template routes remain inaccessible.
- Sentry init evidence captured for API and frontend.

## Work Slices

Recommended implementation split:

1. **Deploy docs/config skeleton** — Dockerfile, env checklist, runbook, no behavior changes.
2. **Property image object storage** — storage port/adapters, Next image allowlist, tests.
3. **Seed/reset guardrails and demo dataset hardening** — guarded seed and object-storage seeded images.
4. **Staging/demo deployment validation docs** — commands, smoke checklist, backup/restore/rollback evidence templates.
5. **Actual environment wiring** — may require manual platform steps outside repo; record evidence in apply/verify artifacts, not secrets.

If the diff exceeds the 400-line review budget, split into chained PRs: first docs/Docker/runbook, then property-image storage, then seed/reset/evidence.

## Risks and Tradeoffs

| Risk | Design response |
|---|---|
| Property image access model grows too large | Prefer public-read demo image bucket/custom domain for property images; keep documents private/signed. |
| Seed guard blocks local developer usage | Gate only destructive demo reset behavior; preserve local test/dev paths with explicit env. |
| Dockerfile breaks monorepo caching | Keep Dockerfile minimal and document the Dokploy build context; optimize later after first successful deploy. The 8 GB VPS builds the image on-box; if build resources ever become a constraint, fall back to building the image in CI and having Dokploy pull it. |
| Cross-subdomain cookies fail | Validate early with real domains before investing in polish. |
| Platform setup cannot be fully tested locally | Keep platform steps in runbook and verify with deployed evidence. |

## Non-Goals

- ViewPro platform Phase 4.
- Billing/Stripe.
- WhatsApp Business API/bot.
- Realtime/push notifications.
- Transactional email.
- Broad package/app renames.
- Full infrastructure-as-code.
- AWS/ECS/Kubernetes migration.

## Next Recommended Phase

`tasks` for `mvp-deploy-readiness`.

The task phase should split work into reviewable slices and include a Review Workload Forecast. It must treat property image object storage as an implementation requirement, not a deferred optional enhancement.
