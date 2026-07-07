# Specification — InmoView MVP Deploy Readiness

## Purpose

Define what MUST be true for the public production-like InmoView demo to be considered deploy-ready.

This spec covers the demo environment only. It does not ship real production onboarding, billing, ViewPro platform Phase 4, or transactional email.

## Requirements

### REQ-1 — Public demo domains

The system MUST expose the demo frontend at `https://demo.inmoview.app`.

The system MUST expose the demo API at `https://api-demo.inmoview.app`.

Both domains MUST use HTTPS.

The landing domain `https://inmoview.app` MUST remain separate from the demo app.

#### Scenario: demo frontend loads over HTTPS

- **Given** the demo environment is deployed
- **When** a user opens `https://demo.inmoview.app`
- **Then** the InmoView frontend loads over HTTPS
- **And** it does not require localhost-only configuration

#### Scenario: demo API health is reachable

- **Given** the demo API is deployed
- **When** a user or smoke check requests `https://api-demo.inmoview.app/api/health`
- **Then** the API responds successfully over HTTPS

### REQ-2 — Deployment topology

The frontend MUST be deployed as the existing Next.js app under `viewpro-app/apps/app-new`.

The API MUST be deployed as the existing NestJS app under `viewpro-app/apps/api`.

The API MUST run as a long-running Node process in a Docker/containerized Railway service.

The API MUST NOT be adapted to Vercel serverless for this demo.

#### Scenario: API starts from production build

- **Given** the Railway API service is built
- **When** the service starts
- **Then** it runs the compiled NestJS API as a long-running process
- **And** it does not depend on Next.js or Vercel serverless handlers

### REQ-3 — Demo database isolation

The demo environment MUST use a dedicated Railway Postgres database.

The demo database MUST be isolated from any future real production database.

The demo database connection MUST be provided through `DATABASE_URL`.

#### Scenario: migration targets demo database only

- **Given** an operator runs Prisma migrations for the demo environment
- **When** the migration command executes
- **Then** it uses the dedicated demo `DATABASE_URL`
- **And** the runbook/checklist makes the target database explicit before mutation

### REQ-4 — Demo seed reset safety

The demo seed/reset flow MUST be explicit and guarded.

The demo seed MUST NOT run automatically on API process startup.

The seed/reset flow MUST require evidence that the target is the dedicated demo database.

The seed/reset flow MUST preserve stable demo credentials or document any intentional credential rotation.

#### Scenario: guarded demo reset

- **Given** the operator wants to reset demo data
- **When** the reset command is run
- **Then** the command requires demo-only confirmation/configuration
- **And** it refuses or clearly blocks unsafe non-demo targets
- **And** the demo can be logged into with the documented demo accounts after reset

### REQ-5 — Demo accounts and dataset

The demo MUST provide stable accounts for at least these roles:

- manager / account owner
- seller
- owner
- admin/global demo operator if still part of the demo story

The demo dataset MUST support a complete product walkthrough:

- properties
- property images
- movements/engagements
- documents
- notifications and deep links
- WhatsApp/contact semantics
- seguimiento activity
- tenant limits or admin controls if shown in the demo
- role boundary evidence

#### Scenario: manager demo story works

- **Given** the demo dataset is seeded
- **When** a manager logs into `demo.inmoview.app`
- **Then** the dashboard shows seeded properties, movements, documents, notifications, and seguimiento activity
- **And** the shown copy is InmoView-facing where expected

#### Scenario: seller and owner role boundaries work

- **Given** the demo dataset is seeded
- **When** a seller or owner logs in
- **Then** each user sees only the surfaces appropriate to that role
- **And** restricted management controls remain inaccessible

### REQ-6 — Object storage for documents and property images

The demo environment MUST use S3-compatible object storage for documents.

The demo environment MUST move property images to S3-compatible object storage for demo readiness.

Cloudflare R2 is the preferred implementation unless design finds a blocking incompatibility.

Local filesystem storage MAY remain available for local development/test only.

#### Scenario: document storage uses S3-compatible configuration

- **Given** the demo API runs in production-like mode
- **When** documents are uploaded/read through the app
- **Then** document bytes are stored through the S3-compatible storage adapter
- **And** signed URL behavior works in the browser demo

#### Scenario: property images survive API redeploy

- **Given** seeded property images are visible in the demo
- **When** the API service is redeployed or restarted
- **Then** property images remain available
- **And** availability does not depend on Railway container filesystem persistence

### REQ-7 — Auth, cookies, CORS, and secrets

The demo frontend and API MUST use explicit production-like URLs and CORS settings.

The API MUST allow credentials only from the demo frontend origin.

Cookies MUST be HTTPS-safe for the selected demo subdomain topology.

The frontend proxy and API MUST share the same `ACCESS_TOKEN_SECRET` value in the deployed environment.

No secrets or `.env` files MUST be committed.

#### Scenario: cross-subdomain login works

- **Given** the demo frontend is served from `https://demo.inmoview.app`
- **And** the API is served from `https://api-demo.inmoview.app`
- **When** a demo user logs in
- **Then** authentication cookies are set securely
- **And** protected frontend routes can call the API with credentials
- **And** refresh behavior works without localhost assumptions

### REQ-8 — Environment checklist

The change MUST produce or update a deploy environment checklist covering API, frontend, database, object storage, Sentry, domains, cookies, and seed/reset variables.

The checklist MUST list variable names and purpose but MUST NOT include secret values.

The checklist MUST reconcile code-required variables with existing `.env.example`/documentation where readable.

#### Scenario: deploy operator can configure environment safely

- **Given** a deploy operator is preparing the demo environment
- **When** they follow the checklist
- **Then** they can identify every required variable by service
- **And** no secret values are stored in the repository

### REQ-9 — Observability

The demo environment MUST configure Sentry for both frontend and API.

The verification evidence MUST prove that Sentry initializes in the demo environment.

If source map upload or release tracking is not completed in the first deploy slice, the gap MUST be documented with a follow-up.

#### Scenario: deployed app initializes Sentry

- **Given** frontend and API are deployed with Sentry env vars
- **When** the deploy verification runs
- **Then** logs or a safe controlled test prove Sentry initialization
- **And** any missing release/source-map evidence is documented

### REQ-10 — Backup, restore, and rollback

The demo database MUST have documented backup and restore evidence before the demo is marked ready.

The API and frontend MUST have documented rollback steps.

The object storage bucket MUST have a documented recovery/reset stance for demo data.

#### Scenario: restore evidence exists

- **Given** the demo DB has been seeded
- **When** demo readiness is verified
- **Then** there is documented evidence of backup/snapshot and restore procedure
- **And** the operator knows how to recover from a broken seed or deploy

### REQ-11 — Validation gates

The change MUST define local pre-deploy validation commands.

The change MUST define deployed smoke checks.

The change MUST define a manual demo checklist covering the core role flows.

The deployed demo MUST not expose starter/template dashboard routes.

#### Scenario: local validation remains green

- **Given** the change is ready for deploy verification
- **When** local validation runs from `viewpro-app`
- **Then** the configured typecheck/test/build/openapi/seeded smoke commands pass or any skipped command is justified with evidence

#### Scenario: deployed demo checklist passes

- **Given** the demo environment is deployed and seeded
- **When** the manual demo checklist is executed
- **Then** manager, seller, owner, notification, document, WhatsApp/contact, and route-isolation checks pass

### REQ-12 — Scope boundaries

The change MUST NOT implement ViewPro platform Phase 4.

The change MUST NOT implement billing/Stripe.

The change MUST NOT implement WhatsApp Business API/bot integration.

The change MUST NOT implement realtime/push notifications.

The change MUST NOT implement transactional email unless explicitly promoted by a separate accepted decision.

The change MUST NOT perform broad technical renames of the monorepo, package scope, or app directories.

#### Scenario: deploy readiness does not become platform work

- **Given** implementation tasks are created
- **When** the task list is reviewed
- **Then** tasks only support InmoView public demo readiness
- **And** ViewPro control-plane work remains out of scope
