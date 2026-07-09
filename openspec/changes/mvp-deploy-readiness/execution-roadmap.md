# Execution Roadmap — Demo to Production

Chronological, tick-as-you-go checklist to take InmoView from the current state
(code committed, nothing provisioned) to first real inmobiliarias in production.

Legend: 👤 = manual step the operator does in a dashboard (accounts, DNS,
secrets). Unmarked steps are code/config/validation.

Reference docs:
- `deploy-runbook.md` — detailed demo deploy commands.
- `env-checklist.md` — exact env var names per surface.
- `demo-checklist.md` — role-based browser validation.
- `production-readiness-plan.md` — the T-0 gates behind Phase 4.

## Phase 0 — Local pre-flight

- [ ] Run full local validation: `pnpm install --frozen-lockfile`, `db:validate`, `typecheck`, `test`, `build`, `openapi:check`.
- [ ] Confirm no `.env`, secret, or dump is staged (`git diff --check`).
- [ ] Push `develop` (pending commits).

## Phase 1 — Provision demo infrastructure

- [ ] 👤 Neon: create demo project; copy the **direct** connection string with `?sslmode=require`.
- [ ] 👤 R2: create documents bucket (private) + property images bucket (public); create access keys; configure CORS.
- [ ] 👤 Dokploy: create an application from the repo/Dockerfile (build context `viewpro-app`, `apps/api/Dockerfile`), set domain `api-demo.inmoview.app` via Traefik (automatic Let's Encrypt HTTPS), set all env vars from `env-checklist.md` in the Dokploy UI including Neon `DATABASE_URL`.
- [ ] 👤 Vercel: project for `apps/app-new`, domain `demo.inmoview.app`, env vars from checklist.
- [ ] 👤 DNS: point `demo.` → Vercel and `api-demo.` → the Hostinger VPS IP (Dokploy/Traefik); wait for HTTPS.

## Phase 2 — Database and demo data

- [ ] 👤 Confirm `DATABASE_URL` targets the dedicated demo DB.
- [ ] Run `prisma migrate deploy` (never `migrate dev`).
- [ ] Run guarded seed with `INMOVIEW_DEMO_*` vars + `PROPERTY_IMAGES_STORAGE_DRIVER=s3`.

## Phase 3 — Validate the demo

- [ ] Smoke: `/api/health`, `/api/docs`, frontend headers.
- [ ] Walk `demo-checklist.md`: logins, refresh survival, role boundaries, documents, images after redeploy, Sentry init.
- [ ] Record evidence (URLs, SHA, results) in `apply-progress.md`.
- [ ] **Demo shown.**

## Phase 4 — Production hardening (T-0 gates, ~1–2 weeks later)

Non-negotiable before the first real tenant. See `production-readiness-plan.md`.

- [ ] 👤 Isolate prod from demo: new Neon prod DB, separate prod API host (dedicated Dokploy app/environment or a reevaluated managed platform to address the single-VPS SPOF), `app./api.inmoview.app` domains, separate secrets.
- [ ] Add `directUrl = env("DIRECT_URL")` to `schema.prisma`; prod `DATABASE_URL` = Neon **pooled** endpoint, `DIRECT_URL` = direct endpoint.
- [ ] 👤 Never set `INMOVIEW_DEMO_*` vars in the prod service; keep demo identifier non-substring of the prod URL.
- [ ] 👤 Enable scheduled Neon backups; run one restore drill into a branch.
- [ ] 👤 Sentry prod environment with error-rate alerts + a connection-saturation alert.
- [ ] 👤 Rotate `ACCESS_TOKEN_SECRET`; review cookies/CORS/rate-limits for real usage.

## Phase 5 — Go live

- [ ] Prod migrations + real tenant provisioning (not the demo seed).
- [ ] Smoke + checklist on the production domain.
- [ ] Onboard first inmobiliarias.
- [ ] Watch the connection-saturation alert (first wall). If pressure appears, start the scaling path: Redis throttler → horizontal API scaling → queue.
