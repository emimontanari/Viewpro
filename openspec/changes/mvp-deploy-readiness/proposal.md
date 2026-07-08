# Proposal — InmoView MVP Deploy Readiness

**Status:** proposed for discussion.
**Change:** `mvp-deploy-readiness`.
**Origin:** `docs/plans/CURRENT_MVP_EXECUTION.md` closes the MVP development queue and explicitly reopens deploy planning.
**Exploration:** `openspec/changes/mvp-deploy-readiness/explore.md`.

## Decision

Prepare a public, production-like InmoView demo that is stable enough for real stakeholder walkthroughs, uses the real InmoView domain, and can reset demo data safely.

This is not a private local/staging smoke only. The target is a demo environment that behaves like the future production topology while remaining isolated from real production data.

## Target topology

```txt
Landing
  https://inmoview.app
  Hosted by Vercel

Demo frontend
  https://demo.inmoview.app
  Hosted by Vercel
  Next.js app: viewpro-app/apps/app-new

Demo API
  https://api-demo.inmoview.app
  Hosted by Railway
  NestJS API: viewpro-app/apps/api
  Runtime: Docker/containerized long-running Node service

Demo database
  Neon Postgres
  Dedicated demo/staging database only

Object storage
  Cloudflare R2 or S3-compatible bucket
  Required for documents in production-like mode

Observability
  Sentry for frontend and API
```

## Scope

### Infrastructure and deployment

- Configure Vercel deployment for `apps/app-new` at `demo.inmoview.app`.
- Configure Railway project for the NestJS API at `api-demo.inmoview.app`.
- Deploy the API as an explicit Docker/containerized service rather than adapting Nest to Vercel serverless.
- Provision a dedicated Neon Postgres instance for demo/staging.
- Configure production-like API/frontend environment variables.
- Configure HTTPS, CORS, cookie domain, and secure cookies for the selected subdomains.
- Configure Sentry DSNs/environments for API and frontend.

### Storage

- Use real S3-compatible document storage in demo mode. `DOCUMENT_STORAGE_DRIVER=s3` is required for production-like deploy.
- Decide in design whether property images must move to object storage now or remain an explicitly documented demo limitation.
- If property images remain filesystem-backed, the proposal must mark it as a known demo risk and tasks must include a reset/reseed mitigation.

### Database lifecycle

- Run Prisma migrations explicitly against the dedicated demo DB.
- Seed/reset demo data only through a guarded command/checklist.
- Prevent accidental demo seed execution against non-demo databases.
- Document backup, restore, and rollback evidence required for demo readiness.

### Demo dataset and accounts

- Keep and harden the existing deterministic demo seed.
- Use stable demo accounts for manager, sellers, owner, and admin.
- Ensure the dataset tells a complete product story: properties, images, movements, documents, notifications, WhatsApp/contact semantics, seguimiento activity, tenant limits, and role boundaries.

### Validation

- Prove local pre-deploy checks still pass.
- Prove deployed API health and frontend availability.
- Prove login and core demo workflows with stable demo credentials.
- Prove seeded reset works against the demo DB only.
- Prove starter/template routes remain inaccessible.
- Prove Sentry initializes in the deployed environment.

## Out of scope

- Continuing ViewPro platform Phase 4 (`viewpro-web`, `viewpro-api`, platform operator auth).
- Real production tenant onboarding.
- Billing/Stripe.
- WhatsApp Business API or bot integration.
- Realtime/push notifications.
- Transactional email unless the user explicitly promotes Stage `21.7`.
- Broad technical renames of `viewpro-app`, package names, or app directories.
- Kubernetes, ECS, or heavy infrastructure automation for the first demo.
- Running demo seed against any real production database.

## Recommended decisions already accepted

| Area | Decision |
|---|---|
| Demo type | Public production-like demo, not private staging-only. |
| Domain | `demo.inmoview.app` for the app. |
| API domain | `api-demo.inmoview.app` recommended for the API. |
| Frontend hosting | Vercel. |
| API hosting | Railway. |
| API runtime | Docker/containerized long-running NestJS service. |
| Database | Neon Postgres dedicated to demo/staging (separate from Railway to avoid usage overages). |
| Document storage | Cloudflare R2/S3-compatible storage. |
| Email | Keep manual copy-link unless explicitly promoted. |

## Acceptance criteria

- `https://demo.inmoview.app` loads the InmoView demo frontend over HTTPS.
- `https://api-demo.inmoview.app/api/health` responds successfully over HTTPS.
- Frontend can authenticate against API using production-like secure cookies and explicit CORS.
- Neon Postgres is dedicated to demo/staging and has documented migration, seed, backup, restore, and rollback procedures.
- Document storage uses S3/R2-compatible configuration in demo mode.
- Demo seed can reset the demo dataset with explicit guardrails.
- Demo accounts are documented and work for manager, seller, owner, and admin flows.
- Manual demo checklist passes end-to-end on the deployed environment.
- Sentry is configured for API and frontend demo environments.
- No starter/template dashboard routes are exposed.
- No secrets, `.env` files, database dumps, or document bytes are committed.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Cookie/CORS misconfiguration across subdomains | Login/refresh breaks in deployed demo | Lock `demo.inmoview.app` + `api-demo.inmoview.app` topology and test auth early. |
| Demo seed runs against the wrong DB | Data loss | Add explicit demo-only guardrails and checklist confirmation. |
| Property images remain local-file backed | Images can disappear on redeploy/restart | Prefer object storage follow-up or document/reset mitigation. |
| Railway start/migration coupling | App startup can fail or mutate DB unexpectedly | Keep migrations as explicit deploy/checklist step, not automatic app boot behavior. |
| S3/R2 signed URL/CORS mismatch | Documents fail in browser demo | Include focused storage smoke in design/tasks. |
| Sentry appears configured but emits no useful events | Blind demo failures | Include initialization/log/event verification. |

## Open questions for design

1. Should property images move to object storage in this change, or be accepted as a documented demo limitation with reseed/reset mitigation?
2. Should `api-demo.inmoview.app` be final for the demo API, or should the API be hidden behind a same-origin reverse proxy later?
3. Which exact R2/S3 bucket naming and lifecycle policy should be used for demo documents?
4. What is the minimum acceptable backup/restore proof for the public demo?
5. Should the demo reset command be manual-only, or should there be a protected admin/script workflow for resetting data?

## Next phase

Move to `spec` and `design` after proposal approval.

The spec should define testable requirements for domain, deployment, env, database, storage, demo seed, validation, and operational safety.

The design should identify exact files/scripts/config docs to change and decide the property image storage strategy before implementation tasks are created.
