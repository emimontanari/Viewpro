# InmoView Demo Deploy Runbook

This runbook makes the `mvp-deploy-readiness` demo deploy path executable. It does not replace platform dashboards and it must not contain secrets.

## Deployment target

```txt
Frontend: https://demo.inmoview.app      -> Vercel -> apps/app-new
API:      https://api-demo.inmoview.app  -> Railway -> apps/api Docker service
Database: Neon Postgres dedicated demo DB
Storage:  Cloudflare R2 / S3-compatible buckets
Sentry:   API + frontend demo environments
```

## Before you start

- Confirm the branch contains only the intended `mvp-deploy-readiness` deploy-readiness changes.
- Confirm no `.env`, database dump, upload, document, image byte, or secret file is staged.
- Confirm the Neon Postgres target is the dedicated demo/staging database.
- Confirm `demo.inmoview.app` and `api-demo.inmoview.app` can be managed in DNS.
- Keep migrations and demo seed/reset as explicit commands. Do not attach them to API container startup.

## 1. Configure Railway API service

Create or update a Railway project for the demo environment.

Service settings:

| Setting | Value |
|---|---|
| Service type | Docker service |
| Docker context/root | `viewpro-app` |
| Dockerfile path | `apps/api/Dockerfile` |
| Public domain | `api-demo.inmoview.app` |
| Start command | Dockerfile `CMD` (`node dist/main.js`) |

The Dockerfile builds the NestJS API and starts the compiled long-running process. It intentionally does not run migrations or demo seed/reset.

## 2. Configure Neon Postgres

- Provision a Neon project/database dedicated to the public demo.
- Copy the Neon connection string into the Railway API service as `DATABASE_URL`.
  Append `?sslmode=require` — Neon requires TLS.
- Use the **direct (non-pooled)** Neon endpoint for `DATABASE_URL`. The Prisma
  schema uses a single `DATABASE_URL` with no `directUrl`, so `prisma migrate
  deploy` must run against the direct endpoint. The pooled (`-pooler`) endpoint
  is only needed later if the demo hits connection limits, and would require a
  `directUrl` split in the schema first.
- Record how to create a backup before seed resets: either a Neon branch of the
  demo database or a `pg_dump` snapshot.
- Record how to restore: promote the Neon branch / point-in-time restore, or
  `pg_restore`/`psql` from the dump.

Do not reuse a future production database for the demo.

## 3. Configure Vercel frontend

Create or update the Vercel project for `demo.inmoview.app`.

- Target the `viewpro-app/apps/app-new` app through the monorepo workspace setup.
- Configure env variables from `env-checklist.md`.
- Map `demo.inmoview.app` to the Vercel project.
- Keep the existing landing page on `inmoview.app` separate.

## 4. Configure R2/S3 storage

Documents are already designed for S3-compatible storage in production-like mode.
Property images are implemented with local and S3/R2 adapters in PR 2, so demo
wiring must choose the S3/R2 driver and public image host before deployed smoke.

- Create or select document bucket.
- Create or select property image bucket or prefix.
- Configure access keys in Railway only.
- Configure CORS for browser document upload/read flows.
- Keep document storage private/signed.
- Configure `PROPERTY_IMAGES_STORAGE_DRIVER=s3` for demo.
- Configure the approved HTTPS `PROPERTY_IMAGES_PUBLIC_BASE_URL` /
  `NEXT_PUBLIC_PROPERTY_IMAGES_PUBLIC_BASE_URL` host for browser-rendered
  property images.

## 5. Configure Sentry

- Create or select frontend demo project/environment.
- Create or select API demo project/environment.
- Configure DSNs in Vercel and Railway.
- Configure source-map upload only if org/project/token setup is ready.
- If source maps are not ready, record the follow-up instead of blocking the first public demo deploy.

## 6. Configure DNS

Expected records:

| Host | Target |
|---|---|
| `demo.inmoview.app` | Vercel demo frontend target |
| `api-demo.inmoview.app` | Railway API custom domain target |

After DNS propagates, verify HTTPS certificates are active before auth testing.

## 7. Run migrations explicitly

Only run this after confirming `DATABASE_URL` points to the dedicated demo DB.

```bash
cd viewpro-app
pnpm --filter @viewpro/api exec prisma migrate deploy --schema prisma/schema.prisma
```

Do not use `prisma migrate dev` against the public demo database. `migrate dev` is for local development; the demo environment should apply already-committed migrations with `migrate deploy`. Do not hide migration execution inside API container startup.

## 8. Seed/reset demo data explicitly

Seed/reset is a manual destructive operation. PR 3 adds a guard that allows the
public demo reset only when all demo-only safety signals are present before the
script creates a Prisma client or resets tenants.

Command shape:

```bash
cd viewpro-app
INMOVIEW_ENVIRONMENT=demo \
INMOVIEW_DEMO_SEED_ALLOWED=true \
INMOVIEW_DEMO_DATABASE_IDENTIFIER=<non-secret-demo-db-identifier> \
PROPERTY_IMAGES_STORAGE_DRIVER=s3 \
VIEWPRO_DEMO_PASSWORD=<set-in-secret-store> \
pnpm demo:seed
```

The value of `INMOVIEW_DEMO_DATABASE_IDENTIFIER` must be a non-secret substring
that appears in the dedicated demo `DATABASE_URL`, such as the demo database
name or Railway service/database identifier. Keep it specific enough to avoid
matching real production databases.

Stable demo accounts created by the seed:

| Role | Email | Password source |
|---|---|---|
| Manager / account owner | `demo@viewpro.local` | `VIEWPRO_DEMO_PASSWORD` from the secret store. |
| Seller | `martin.demo@viewpro.local` | Same demo password. |
| Owner | `propietario.demo@viewpro.local` | Same demo password. |
| ViewPro admin | `admin.demo@viewpro.local` | Same demo password. |

Rules:

- Never run seed/reset against production data.
- Never put the demo password in committed files.
- Keep the demo password in the deployment secret store or password manager.
- For local/dev/test only, `pnpm demo:seed` remains usable when `DATABASE_URL`
  clearly contains `localhost`, `127.0.0.1`, `viewpro_dev`, or `viewpro_test`.
- In public demo mode, property image fixtures are uploaded to the configured
  S3/R2 bucket instead of local API filesystem storage.
- Record the reset time and operator in apply/verify evidence.

## 9. Smoke deployed services

```bash
curl -fsS https://api-demo.inmoview.app/api/health
curl -fsS https://api-demo.inmoview.app/api/docs >/dev/null
curl -I https://demo.inmoview.app
```

Expected outcome:

- API health returns success.
- API docs are reachable for controlled demo validation.
- Frontend returns HTTPS response headers.

## 10. Verify auth and core demo flow

Use `demo-checklist.md` for the role-based browser walkthrough.

Minimum auth checks:

- Manager can log in on `demo.inmoview.app`.
- Protected routes survive browser refresh.
- API requests use credentials successfully.
- Refresh flow works without localhost assumptions.
- Seller and owner cannot access restricted management surfaces.

## 11. Backup, restore, and rollback

Before public handoff, capture evidence for:

| Area | Evidence needed |
|---|---|
| Database backup | Neon branch/point-in-time restore or documented `pg_dump` before demo reset. |
| Database restore | Restore procedure and dry-run notes when safe. |
| API rollback | Railway previous deployment rollback or redeploy previous git SHA. |
| Frontend rollback | Vercel previous deployment promotion/rollback. |
| Storage recovery | R2/S3 cleanup/reseed stance for demo documents and images. |

Evidence template:

| Field | Evidence |
|---|---|
| Demo environment | `<Railway project/service + Vercel project>` |
| Commit/deploy ID | `<git SHA, Railway deployment, Vercel deployment>` |
| DB target confirmed | `<operator + timestamp + demo DB identifier>` |
| Backup captured | `<snapshot/backup id + timestamp>` |
| Migration result | `<command + exit/status>` |
| Seed/reset result | `<command + exit/status; no secrets>` |
| API rollback path | `<previous deployment/SHA>` |
| Frontend rollback path | `<previous Vercel deployment>` |
| Storage reset stance | `<R2/S3 bucket cleanup or reseed notes>` |
| Known gaps | `<follow-ups before public handoff>` |

## 12. Record verification evidence

Record evidence in the SDD apply/verify artifacts, not in secret-bearing files.

Include:

- deployment URLs;
- commit SHA or deployment ID;
- migration command result;
- seed/reset command result;
- smoke command results;
- manual demo checklist result;
- backup/restore/rollback evidence;
- known gaps and follow-ups.

## Rollback quick path

1. Stop new demo resets.
2. Roll back frontend in Vercel to the last known-good deployment.
3. Roll back API in Railway to the last known-good deployment or previous git SHA.
4. Restore Neon Postgres from the last known-good backup (branch/PITR or dump) if data is broken.
5. Re-run smoke checks and the affected checklist sections.
6. Document what was restored and what data may have changed.

## Scope guard

This runbook does not implement:

- ViewPro platform Phase 4;
- billing/Stripe;
- WhatsApp Business API;
- realtime/push notifications;
- transactional email;
- property-image object storage behavior (PR 2, already implemented);
- seed guardrails in code (PR 3, implemented in this change).
