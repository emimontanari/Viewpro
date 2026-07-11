# Tasks — InmoView MVP Deploy Readiness

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | High: ~700–1,100 if implemented as one PR |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested delivery | 3 PR chain |
| Decision needed before apply | Yes — confirm first PR slice before implementation |

This change spans deployment docs/config, Docker runtime, property-image storage behavior, seed guardrails, and verification artifacts. Do not ship as one oversized PR.

## Suggested PR Chain

### PR 1 — Deploy skeleton and runbooks

Goal: make the deploy plan executable without changing runtime behavior.

- [x] Add API Docker build/start path for the Dokploy application without automatic migrations or seed.
- [x] Add/update demo environment checklist for Vercel frontend, Dokploy API, Neon Postgres, R2/S3, Sentry, cookies, and CORS.
- [x] Add deploy runbook for demo setup, migration, seed/reset, backup/restore, rollback, and smoke commands.
- [x] Add demo checklist for manager, seller, owner, documents, notifications, WhatsApp/contact, route isolation, and Sentry evidence.
- [x] Verify docs contain variable names and purpose only, no secret values.
- [x] Run docs/config validation: `git diff --check` and relevant package metadata/build sanity if Dockerfile changes require it.

### PR 2 — Property image object storage

Goal: make property images production-like and durable across API redeploys.

- [x] Introduce `PropertyImagesStoragePort` and `PROPERTY_IMAGES_STORAGE_PORT` injection token.
- [x] Preserve local property image storage adapter for local development/test.
- [x] Add S3/R2 property image storage adapter using `PutObjectCommand` and `DeleteObjectCommand`.
- [x] Add `PROPERTY_IMAGES_STORAGE_DRIVER` resolver and require `s3` in production/demo mode.
- [x] Add env parsing for property image S3/R2 config without duplicating unsafe secrets in source.
- [x] Update `PropertyEngagementsModule` to select local vs S3 adapter by driver.
- [x] Update upload/delete property image use cases to inject the storage port, not `LocalPropertyImagesStorage` directly.
- [x] Update `next.config.ts` remote image allowlist for configured public property image host or API-mediated image host.
- [x] Add/adjust unit tests for local adapter selection, S3 config validation, storage key safety, upload URL persistence, and delete behavior.
- [x] Run DB-backed upload/delete/render path proof once local Postgres or deployed demo is available. Verified 2026-07-11 against the deployed demo: property image upload → r2.dev serve (HTTP 200) → delete → 404; 60 seeded images render in the dashboard. See `verify-evidence.md`.

### PR 3 — Guarded demo reset and deploy verification evidence

Goal: make public demo reset safe and verifiable.

- [x] Add demo-only guardrails to `scripts/seed-demo.mjs` before destructive/reset behavior.
- [x] Require explicit demo env flags such as `INMOVIEW_ENVIRONMENT=demo` and `INMOVIEW_DEMO_SEED_ALLOWED=true` for demo reset mode.
- [x] Keep local/test seed flows usable without weakening demo safety.
- [x] Update seeded property image creation to use durable object-storage path for demo mode, or document a bounded implementation-safe alternative if direct reuse is too large.
- [x] Document stable demo credentials and reset procedure without committing secrets.
- [x] Capture backup/restore/rollback evidence template in the runbook.
- [x] Run non-destructive local validation: seed syntax/guard tests, `pnpm db:validate`, API typecheck/build, property-image tests, `pnpm openapi:check`, and `git diff --check` as applicable. Do not run DB-backed seed/e2e until a safe DB target exists.
- [x] Run deployed smoke checks after environment wiring: API health, API docs, frontend headers, login, property image persistence, document storage, and route isolation. Verified 2026-07-11 — all pass. See `verify-evidence.md`.

## Cross-PR Acceptance Checklist

- [x] `https://demo.inmoview.app` loads over HTTPS. (verified 2026-07-11)
- [x] `https://api-demo.inmoview.app/api/health` responds over HTTPS. (Let's Encrypt cert; health 200)
- [x] Cross-subdomain auth works with secure cookies and explicit CORS. (login sets cookies; `CORS_ORIGIN=https://demo.inmoview.app`)
- [x] API runs as Docker/containerized NestJS on the Dokploy application (Hostinger KVM2 VPS).
- [x] Demo DB is Neon Postgres and isolated from real production data. (dedicated `neondb`, direct endpoint for migrations)
- [x] Migrations are explicit, not automatic API startup behavior. (`prisma migrate deploy`, 21 migrations; Dockerfile CMD does not migrate)
- [x] Demo seed/reset is explicit and guarded. (`seed-demo-safety.mjs` requires demo flags)
- [x] Documents use R2/S3 in demo mode. (verified round-trip: signed upload → confirm → read, bytes match)
- [x] Property images use R2/S3 in demo mode and survive API redeploy/restart. (60 seeded images persist across API redeploys; upload/delete verified)
- [x] Sentry initializes for API and frontend. (projects `inmoview-api-demo` + `inmoview-frontend-demo`, env `demo`, frontend source maps uploaded)
- [x] Backup/restore/rollback procedure is documented with evidence. (rollback paths in `verify-evidence.md`; Neon backup branch `demo-backup-20260711` created 2026-07-11)
- [x] Demo accounts work for manager, seller, owner, and admin/global demo flow if included. (all 4 log in; RBAC matrix verified)
- [x] Starter/template dashboard routes remain inaccessible. (`/dashboard/billing` redirects; `/dashboard/product` is the real "Propiedades" page)
- [x] No secrets, `.env` files, DB dumps, or document/image bytes are committed.

## Validation Commands

Run from `viewpro-app` unless stated otherwise.

```bash
pnpm install --frozen-lockfile
pnpm db:validate
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Focused commands expected during implementation:

```bash
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
```

Deployed smoke commands:

```bash
curl -fsS https://api-demo.inmoview.app/api/health
curl -fsS https://api-demo.inmoview.app/api/docs >/dev/null
curl -I https://demo.inmoview.app
```

## Implementation Notes

- Keep writes single-threaded.
- Do not run destructive database commands without confirming the target DB.
- Do not commit secrets or generated uploads.
- Keep ViewPro platform Phase 4 out of scope.
- If PR 2 grows beyond review budget, split adapter/config from frontend render allowlist and seeded image updates.
- If real environment credentials are needed, stop and ask the user to configure them in Vercel/Dokploy/R2/Sentry dashboards rather than pasting secrets into chat or files.

## Next Recommended Phase

`verify` / review prep for the local implementation batch.

PR 1, PR 2, and PR 3 implementation tasks are applied locally. Deployed smoke
checks and cross-PR acceptance remain pending until Dokploy, Vercel, R2/S3,
Sentry, DNS, and the dedicated demo DB are configured.
