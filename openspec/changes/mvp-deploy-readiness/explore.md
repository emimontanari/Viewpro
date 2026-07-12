# Exploration: mvp-deploy-readiness

> SDD explore artifact for change `mvp-deploy-readiness`.
> Goal: reopen deploy planning after the MVP development queue closed and prepare InmoView for a complete demo-ready staging deploy.

## Current State

The MVP development queue is closed according to `docs/plans/CURRENT_MVP_EXECUTION.md`. The next explicit move is deploy planning: Stage 26.5 staging/deploy checklist, external service wiring, architectural scalability prep, 26.6 pilot-ready deck, and the existing `26-5a-inmoview-domain-handoff` proposal.

The deploy-relevant workspace is `viewpro-app/`:

- `apps/api` — NestJS API (`@viewpro/api`) with Prisma/Postgres, cookie auth, S3-compatible document storage, Sentry, and local property image storage.
- `apps/app-new` — active Next.js app (`next-shadcn-dashboard-starter`) with seeded Playwright smoke tests, Sentry, and proxy-based JWT/cookie auth.
- `packages/*` — shared packages, including config/contracts/platform-contract.

## Relevant Existing Commands

Local validation path from current scripts:

```bash
cd viewpro-app
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm demo:seed
pnpm db:validate
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Deploy-relevant app commands:

```bash
pnpm --filter @viewpro/api build
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api db:migrate
pnpm --filter @viewpro/api demo:seed

pnpm --filter next-shadcn-dashboard-starter build
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

## Environment Inventory

Derived from code references. Env example files still need independent verification because the scouting subagent could not directly read `.env*` examples due runtime safety policy.

### API core/runtime

- `NODE_ENV`
- `PORT`
- `APP_PUBLIC_URL` — required in production
- `API_PUBLIC_URL`
- `CORS_ORIGIN` — explicit non-wildcard production origin
- `DATABASE_URL`

### API auth/cookies/rate limits

- `ACCESS_TOKEN_SECRET` — must match frontend/proxy secret
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `COOKIE_DOMAIN`
- `COOKIE_SECURE`
- `AUTH_RATE_LIMIT_LOGIN_LIMIT`
- `AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS`
- `AUTH_RATE_LIMIT_REGISTER_LIMIT`
- `AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS`
- `AUTH_RATE_LIMIT_REFRESH_LIMIT`
- `AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS`

### API observability

- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`

### Document storage

- `DOCUMENT_STORAGE_DRIVER` — production requires `s3`
- `DOCUMENT_STORAGE_LOCAL_ROOT`
- `DOCUMENT_STORAGE_SIGNING_SECRET`
- `DOCUMENT_STORAGE_S3_BUCKET`
- `DOCUMENT_STORAGE_S3_ENDPOINT`
- `DOCUMENT_STORAGE_S3_REGION`
- `DOCUMENT_STORAGE_S3_ACCESS_KEY_ID`
- `DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY`
- `DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE`

### Property images

- `PROPERTY_IMAGES_UPLOADS_ROOT`
- `API_PUBLIC_URL`

Important: property images are currently local filesystem-backed and exposed by the API. This is a staging/deploy risk on ephemeral/serverless hosts.

### Frontend

- `NEXT_PUBLIC_API_URL`
- `BFF_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `ACCESS_TOKEN_SECRET` — must match API
- `BUILD_STANDALONE`
- `NEXT_PUBLIC_SENTRY_DISABLED`
- `NEXT_PUBLIC_SENTRY_ENABLED`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `NEXT_PUBLIC_SENTRY_ORG`
- `NEXT_PUBLIC_SENTRY_PROJECT`
- `CI`

### Seeded/demo E2E

- `VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT`
- `VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT`
- `VIEWPRO_APP_NEW_SEEDED_E2E_ACCESS_TOKEN_SECRET`
- `VIEWPRO_DEMO_PASSWORD`
- `VIEWPRO_DEMO_NOW`
- `VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE`

## Demo Seed Facts

Existing demo seed and smoke tests already define a strong demo baseline:

- Demo tenant: `viewpro-demo-inmobiliaria` / `ViewPro Demo Inmobiliaria`.
- Demo users include:
  - `demo@viewpro.local`
  - `sofia.demo@viewpro.local`
  - `martin.demo@viewpro.local`
  - `lucia.demo@viewpro.local`
  - `propietario.demo@viewpro.local`
  - `admin.demo@viewpro.local`
- Default local demo password: `viewpro-demo-local`, overridable via `VIEWPRO_DEMO_PASSWORD`.
- Seeded suite covers manager workflow, seller workflow, owner workflow, notifications/admin, state change requests, engagement management, WhatsApp/tracking, and tenant limits.

## External-Service Assumptions

- **Database:** Prisma/Postgres. Local Docker Compose exists; no managed provider selected yet.
- **Document storage:** S3-compatible adapter exists; production requires `DOCUMENT_STORAGE_DRIVER=s3`.
- **Property images:** local filesystem only; needs a deploy strategy.
- **Email:** transactional invitation email remains deferred; manual copy-link is the accepted beta path unless promoted.
- **WhatsApp:** stored phone/contact semantics only; no WhatsApp Business API/bot for MVP.
- **Notifications:** in-app DB-backed notifications with deep links/read state; no realtime/push/email provider.
- **Auth:** email/password, HTTP-only access/refresh cookies, local JWT verification in Next proxy.
- **Observability:** Sentry packages/config exist; DSN and source-map/release wiring need deploy proof.
- **Domain/CORS/cookies:** production requires explicit URLs/origins and HTTPS-safe cookie settings.

## Existing Deploy Planning Sources

- `docs/plans/CURRENT_MVP_EXECUTION.md` — development closed; reopen deploy planning explicitly.
- `docs/plans/2026-06-04-final-mvp-execution-plan.md` Stage 26.5 — env vars, auth, S3/R2 storage, CORS, DB migrations, seed/smoke, backup/restore, rollback, Sentry/observability.
- `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md` — deploy branch confirmation, domain/storage/email assumptions, FB-11 InmoView domain plus stable demo accounts.
- `docs/plans/2026-06-14-mvp-execution-plan-revision.md` — deploy Phase E/F ordering.
- `openspec/changes/26-5a-inmoview-domain-handoff/proposal.md` — existing domain/demo handoff scope.

## Gaps / Blockers

1. Provider decisions are not documented as executable deploy choices.
2. Property images are local-file backed; unsafe on ephemeral API hosts unless explicitly accepted for demo.
3. Document storage must be S3/R2-compatible in production.
4. Env examples/checklists need verification against the code-derived env inventory.
5. Cookie/domain topology must be selected before deploy.
6. `pnpm demo:seed` must be guarded so it only runs against a dedicated staging/demo DB.
7. Email is not wired; either keep manual copy-link or promote `21-7-transactional-invitation-email`.
8. No infrastructure-as-code or deployment manifests were found.
9. Backup/restore/rollback evidence is still missing.
10. Sentry runtime/source-map/release pipeline needs staging proof.

## Service Options to Discuss

| Area | Recommended demo path | Tradeoff |
|---|---|---|
| Frontend | Vercel for `apps/app-new` | Best Next.js fit; API remains separate and needs cookie/CORS care. |
| API | Dokploy on a Hostinger KVM2 VPS (chosen demo path); Railway/Fly.io/Render were the compared managed alternatives | Fits Nest/Prisma as a Docker/containerized long-running Node process; Dokploy (Docker Swarm + Traefik) gives full control on a self-hosted box; managed alternatives remain a Phase 4 reevaluation option. |
| Postgres | Neon Postgres (chosen) | Managed serverless Postgres separate from the API host; branch/PITR backups; use the direct endpoint for Prisma migrations. |
| Object storage | Cloudflare R2 | S3-compatible and low egress; signed URL/CORS behavior must be tested. |
| Error tracking | Sentry | Already integrated; needs DSNs/env/release/source-map proof. |
| Email | Manual copy-link for MVP; Resend only if promoted | Avoids new scope; real email requires domain verification/templates/tests. |
| Domain topology | `app.inmoview.*` + `api.inmoview.*` under one parent domain | Clear production shape; cookies/CORS must be precise. |

Recommended demo topology:

```txt
Frontend: https://app.inmoview.<tld> or https://demo.inmoview.<tld>
API:      https://api.inmoview.<tld>
Cookies:  COOKIE_DOMAIN=.inmoview.<tld>, COOKIE_SECURE=true
CORS:     CORS_ORIGIN=<frontend URL>
```

## Proposed Staging Validation Path

1. Provision dedicated staging/demo Postgres and object storage bucket.
2. Configure API env with production-safe secrets, explicit CORS, S3/R2 storage, Sentry, and cookie settings.
3. Run migrations against staging DB.
4. Confirm the target DB is demo/staging, then run `VIEWPRO_DEMO_PASSWORD=<demo-password> pnpm demo:seed`.
5. Smoke API:

```bash
curl -fsS https://api.inmoview.<tld>/api/health
curl -fsS https://api.inmoview.<tld>/api/docs >/dev/null
```

1. Smoke frontend:

```bash
curl -I https://app.inmoview.<tld>
```

1. Run manual browser demo checklist.
2. Verify backup snapshot and restore command.
3. Verify rollback path for API/frontend deploys.

## Manual Demo Checklist

- Login as manager `demo@viewpro.local`.
- Confirm dashboard loads for the seeded demo agency with InmoView-facing copy.
- Verify seeded properties and visible property images.
- Open a property detail and verify documents, movements, assigned sellers, and owner card.
- Verify `Seguimiento` filters/activity.
- Exercise a safe document request/reject/approve path in the demo DB.
- Login as seller and confirm seller-only visibility and denied management controls.
- Login as owner and verify owner portal, timeline, notifications, document upload/read URL, and WhatsApp contact CTA.
- Login as admin and verify admin/tenant limit screen if part of demo.
- Verify notification click-through and read/unread persistence.
- Verify starter/template routes remain inaccessible.
- Verify Sentry initialization through logs or a controlled non-production test event.
- Confirm backup/restore evidence is documented.

## Open Questions for Proposal

1. Which hosting split should be first-class for the MVP demo: Vercel frontend + a self-hosted Dokploy API (or a managed Railway/Fly/Render API), or one provider for both?
2. Which managed Postgres provider should be selected for staging/demo?
3. Should property images move to object storage before demo, or can the first demo explicitly accept reseed/local-file volatility?
4. Should transactional email remain deferred with manual copy-link, or must email delivery be promoted into this deploy-readiness change?
5. What final demo domain/subdomain should be used?
6. What demo roles/accounts must be shown live, and which can remain seeded-only evidence?
7. What backup/restore evidence is sufficient for MVP demo readiness?

## Next Recommended Phase

`proposal` for `mvp-deploy-readiness`.

The proposal should lock scope boundaries, choose or explicitly defer provider decisions, define demo readiness acceptance criteria, and decide whether property image storage/email are in-scope or deferred risks.

## Scout Source

Detailed reconnaissance artifact: `.pi-subagents/artifacts/outputs/92435fd6/.pi-subagents/artifacts/mvp-deploy-readiness-scout.md`.

## skill_resolution

paths-injected
