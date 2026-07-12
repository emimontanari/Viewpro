# InmoView Demo — Deploy Verification Evidence

Verification of the deployed public demo against the `mvp-deploy-readiness`
acceptance checklist. Captured 2026-07-11. Contains no secrets (see
`deploy-runbook.md` §8 — demo password lives in the secret store only).

## Environment identity

| Surface | Value |
|---|---|
| Frontend | `https://demo.inmoview.app` (Vercel project `inmoview-demo`, `apps/app-new`) |
| API | `https://api-demo.inmoview.app/api` (Dokploy app on Hostinger VPS `93.188.164.215`, Traefik) |
| Deployed commit (API) | `a8ae689` on `develop` (autoDeploy on push) |
| Database | Neon Postgres `neondb` (migrations run against the direct/non-pooler endpoint) |
| Storage | Cloudflare R2 — `inmoview-demo-documents` (private/signed), `inmoview-demo-images` (public r2.dev) |
| Monitoring | Sentry `inmoview-api-demo` + `inmoview-frontend-demo`, environment `demo` |

## 1. Smoke checks (deploy-runbook §9)

| Check | Result |
|---|---|
| `GET /api/health` | HTTP 200 `{"status":"ok","service":"viewpro-api"}` |
| `GET /api/docs` | HTTP 200 |
| `GET https://demo.inmoview.app` | HTTP 307 → `/auth/sign-in` → 200 (valid Let's Encrypt cert) |
| HTTPS cert (API) | Let's Encrypt (issuer `C=US, O=Let's Encrypt`) |

## 2. Migrations (runbook §7)

`prisma migrate deploy` applied 21 migrations against the dedicated demo Neon DB
(direct endpoint). Exit 0. Container CMD does not run migrations at startup.

## 3. Seed / reset (runbook §8)

Guarded demo seed succeeded (`seed-demo-safety.mjs` enforced
`INMOVIEW_ENVIRONMENT=demo`, `INMOVIEW_DEMO_SEED_ALLOWED=true`,
`INMOVIEW_DEMO_DATABASE_IDENTIFIER` substring match). Seeded: 20 properties,
60 property images to R2, 79 tracked updates, 4 demo accounts + isolation tenant.

## 4. Auth & core demo flow (runbook §10)

- Manager (`demo@viewpro.local`) logs in on `demo.inmoview.app`; dashboard and
  "Seguimiento" render seeded data (20 properties, 79 updates). 0 console errors.
- All four demo roles authenticate (manager, seller, owner, admin).

## 5. RBAC / route isolation (security source of truth = API)

Verified with the auth cookie **and** the `x-tenant-id` header (the Next BFF adds
this; raw calls without it return 403 for everyone).

| Endpoint (permission) | manager | seller (AGENT) | owner | admin |
|---|---|---|---|---|
| `/team/invitations` (TEAM_MANAGE) | 200 | 403 | 403 | 403 |
| `/team/members` (TEAM_VIEW) | 200 | 403 | 403 | 403 |
| `/tenants/me/whatsapp-phone` (TENANT_MANAGE_SETTINGS) | 200 | 403 | 403 | 403 |
| `/admin/summary`, `/admin/tenants` (platform admin) | 403 | 403 | 403 | 200 |

- Seller and owner cannot reach management surfaces. Owner has no tenant
  membership (owners are not agency team members).
- Template routes: `/dashboard/billing` redirects to `/dashboard` (blocked);
  `/dashboard/product` is the real "Propiedades" page (repurposed, not template).

## 6. Document storage e2e (R2/S3, runbook §4)

Full round-trip (owner): request upload URL → **R2 PUT with `Origin:
https://demo.inmoview.app` → HTTP 200** → `confirm-upload` 201 → request read
URL → **R2 GET 200** → downloaded bytes matched the uploaded file exactly.
Proves the R2 CORS on `inmoview-demo-documents` works for real browser uploads.

## 7. Property image storage e2e (R2/S3)

Round-trip (manager): `POST /property-engagements/:id/images` (multipart) → 201
with public r2.dev URL → **GET public URL 200 `image/png`** → `DELETE
.../images/:imageId` 200 → **GET public URL 404** (removed). Render of the 60
seeded images verified in the dashboard.

## 8. Observability (runbook §5)

Sentry initializes on both sides (env `demo`). Test events ingested into both
projects. Frontend source maps uploaded at build time (de-minified stack traces).

## 9. Backup / restore / rollback (runbook §11)

| Area | Evidence / path |
|---|---|
| API rollback | Redeploy a previous **`done`** Dokploy deployment (last known-good commits `a8ae689`, `92cde8f`). Hostinger VPS weekly backups + 1 snapshot as fallback. |
| Frontend rollback | Vercel — promote/rollback to a previous production deployment (`vercel rollback`); several prior deployments exist for `inmoview-demo`. |
| Storage recovery | Demo R2 buckets are reseedable; the guarded seed is idempotent (resets tenants first). |
| DB backup | Neon branch `demo-backup-20260711` created from `production` (data + schema, auto-delete Never) as a restorable snapshot. Restore via Neon reset-from-branch. Recovery fallback: the guarded seed is idempotent (`prisma migrate deploy` + `pnpm demo:seed` rebuilds the demo). |

## Known gaps / follow-ups

- **Sentry auth token:** the frontend source-map `SENTRY_AUTH_TOKEN` was rotated
  to an org token; the originally-exposed token should be revoked in the Sentry UI.
- **R2 CORS** for `inmoview-demo-documents` was set manually in the Cloudflare
  dashboard (the app's object-scoped key cannot call `PutBucketCors`).
