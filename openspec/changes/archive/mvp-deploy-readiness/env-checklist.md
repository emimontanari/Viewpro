# InmoView Demo Environment Checklist

Use this checklist to configure the production-like public demo without committing secrets. Values belong in Vercel, Dokploy, Cloudflare R2/S3, and Sentry dashboards — not in the repository.

## Target domains

| Surface | Domain | Owner |
|---|---|---|
| Landing | `https://inmoview.app` | Existing Vercel landing project |
| Demo frontend | `https://demo.inmoview.app` | Vercel InmoView app project |
| Demo API | `https://api-demo.inmoview.app` | Dokploy application (Hostinger KVM2 VPS), Traefik HTTPS |

## Vercel frontend

Project target: `viewpro-app/apps/app-new`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public frontend origin: `https://demo.inmoview.app`. |
| `NEXT_PUBLIC_API_URL` | Browser API base URL: `https://api-demo.inmoview.app/api`. |
| `BFF_API_URL` | Server-side API base URL: `https://api-demo.inmoview.app/api`. |
| `ACCESS_TOKEN_SECRET` | JWT verification secret; must match Dokploy API. |
| `NEXT_PUBLIC_SENTRY_ENABLED` | Enables Sentry in the demo frontend. |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend Sentry DSN. |
| `NEXT_PUBLIC_SENTRY_ORG` | Sentry org for source-map upload when enabled. |
| `NEXT_PUBLIC_SENTRY_PROJECT` | Sentry project for source-map upload when enabled. |
| `SENTRY_TRACES_SAMPLE_RATE` | Frontend tracing sample rate for demo. |
| `CI` | Enables CI-mode build behavior where required by Vercel/Sentry. |

Build settings to confirm:

- Root/project directory points at the monorepo path Vercel needs to build `apps/app-new`.
- Build command targets the Next app workspace package.
- No `.env` files or secret values are committed.

## Dokploy API

Dokploy application settings (self-hosted PaaS on a Hostinger KVM2 VPS, Docker Swarm + Traefik):

| Setting | Expected value |
|---|---|
| Source | Repository/Dockerfile build |
| Root / Docker context | `viewpro-app` |
| Dockerfile path | `apps/api/Dockerfile` |
| Start command | Use Dockerfile `CMD`; do not override with migration/seed commands. |
| Public domain | `https://api-demo.inmoview.app` via Traefik with automatic Let's Encrypt HTTPS |

Runtime variables (set in the Dokploy UI, never committed):

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Must be `production` for demo runtime behavior. |
| `PORT` | Port the Nest API listens on; Traefik routes the public domain to it. |
| `APP_PUBLIC_URL` | Public app origin: `https://demo.inmoview.app`. |
| `API_PUBLIC_URL` | Public API origin: `https://api-demo.inmoview.app`. |
| `CORS_ORIGIN` | Allowed browser origin: `https://demo.inmoview.app`. |
| `DATABASE_URL` | Neon Postgres connection string for the dedicated demo DB. Use the direct (non-pooled) endpoint with `?sslmode=require`. |
| `ACCESS_TOKEN_SECRET` | Strong JWT secret; must match Vercel frontend. Set in the Dokploy UI. |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime if overriding default. |
| `REFRESH_TOKEN_TTL_SECONDS` | Refresh token lifetime if overriding default. |
| `COOKIE_DOMAIN` | `.inmoview.app` for cross-subdomain cookies. |
| `COOKIE_SECURE` | `true` for HTTPS demo cookies. |
| `AUTH_RATE_LIMIT_LOGIN_LIMIT` | Login rate-limit override if needed for demo. |
| `AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS` | Login rate-limit window if overridden. |
| `AUTH_RATE_LIMIT_REGISTER_LIMIT` | Register rate-limit override if needed. |
| `AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS` | Register rate-limit window if overridden. |
| `AUTH_RATE_LIMIT_REFRESH_LIMIT` | Refresh rate-limit override if needed. |
| `AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS` | Refresh rate-limit window if overridden. |
| `SENTRY_DSN` | API Sentry DSN. |
| `SENTRY_ENVIRONMENT` | Use `demo`. |
| `SENTRY_TRACES_SAMPLE_RATE` | API tracing sample rate for demo. |

## Neon Postgres

| Item | Purpose |
|---|---|
| Dedicated Neon project/database | Keeps demo data isolated from future production data; managed serverless Postgres separate from the API host. |
| `DATABASE_URL` linkage | Provides API and explicit migration/seed commands with the demo DB connection. Use the direct (non-pooled) endpoint with `?sslmode=require`. |
| Branch/PITR or `pg_dump` backup | Required before demo reset and before public handoff. |
| Restore procedure | Neon branch promotion / point-in-time restore, or `pg_restore`/`psql` from a dump. |

Before migrations or seed/reset, confirm the target DB is the dedicated demo database.

## Cloudflare R2 / S3-compatible storage

Documents are private/signed. Property images are implemented with local and
S3/R2 adapters in PR 2; the demo environment must configure the S3/R2 variables
before deployed smoke.

| Variable | Purpose |
|---|---|
| `DOCUMENT_STORAGE_DRIVER` | Must be `s3` in production-like demo. |
| `DOCUMENT_STORAGE_SIGNING_SECRET` | Strong secret for document storage signatures. |
| `DOCUMENT_STORAGE_S3_BUCKET` | R2/S3 bucket for documents. |
| `DOCUMENT_STORAGE_S3_ENDPOINT` | R2/S3 endpoint. |
| `DOCUMENT_STORAGE_S3_REGION` | Region, commonly `auto` for R2. |
| `DOCUMENT_STORAGE_S3_ACCESS_KEY_ID` | R2/S3 access key ID. |
| `DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY` | R2/S3 secret access key. |
| `DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE` | `true` when required by provider. |
| `PROPERTY_IMAGES_STORAGE_DRIVER` | Must be `s3` in demo. |
| `PROPERTY_IMAGES_S3_BUCKET` | R2/S3 bucket for property images. |
| `PROPERTY_IMAGES_S3_ENDPOINT` | R2/S3 endpoint for property images. |
| `PROPERTY_IMAGES_S3_REGION` | Region, commonly `auto` for R2. |
| `PROPERTY_IMAGES_S3_ACCESS_KEY_ID` | R2/S3 access key ID for property images. |
| `PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY` | R2/S3 secret access key for property images. |
| `PROPERTY_IMAGES_S3_FORCE_PATH_STYLE` | `true` when required by provider. |
| `PROPERTY_IMAGES_PUBLIC_BASE_URL` | Public image host/custom domain for browser-rendered property images. |

Storage checklist:

- Configure CORS for browser document upload/read flows.
- Keep document bytes private and use signed URLs.
- Use the approved HTTPS public image host for property image URLs.
- Document cleanup/reset stance for demo buckets.

## Sentry

| Surface | Required evidence |
|---|---|
| API | Dokploy env has API DSN and `SENTRY_ENVIRONMENT=demo`; logs or safe event prove initialization. |
| Frontend | Vercel env has frontend DSN and Sentry enabled; build/deploy logs prove initialization. |
| Source maps | If org/project/token are not fully configured, document the gap and follow-up. |

## Cookie and CORS values

| Setting | Expected demo value |
|---|---|
| Frontend origin | `https://demo.inmoview.app` |
| API origin | `https://api-demo.inmoview.app` |
| `CORS_ORIGIN` | `https://demo.inmoview.app` |
| `COOKIE_DOMAIN` | `.inmoview.app` |
| `COOKIE_SECURE` | `true` |
| Credentials | Enabled only for the demo frontend origin |

## Seed/reset variables

PR 3 implements guarded demo seed/reset. These variables are required only for
public demo reset mode; local/dev/test seed flows continue to work when
`DATABASE_URL` clearly points at a local, dev, or test database.

| Variable | Purpose |
|---|---|
| `INMOVIEW_ENVIRONMENT` | Must be `demo` for guarded public demo reset. |
| `INMOVIEW_DEMO_SEED_ALLOWED` | Must be `true` for guarded public demo reset. |
| `INMOVIEW_DEMO_DATABASE_IDENTIFIER` | Non-secret identifier that must be contained in the dedicated demo `DATABASE_URL`. |
| `VIEWPRO_DEMO_PASSWORD` | Stable demo password set in the secret store. |
| `VIEWPRO_DEMO_NOW` | Deterministic demo clock when needed. |
| `VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE` | Demo tenant WhatsApp phone when needed. |

## Secret safety

- Do not commit `.env`, database dumps, document bytes, uploaded images, private keys, API tokens, DSNs with credentials, or generated secrets.
- Store secrets only in Vercel, Dokploy, R2/S3, and Sentry dashboards.
- Use this checklist for variable names and purpose only.
