# Demo → Production Readiness Plan

Forward-looking hardening plan for the gap between the public InmoView demo and
the first real inmobiliarias using the app as production (expected ~1–2 weeks
after the demo).

The demo config is intentionally simple. This plan records exactly what MUST
change before real tenant data exists, what scales next, and what deliberately
stays the same to avoid premature complexity.

## Architectural summary (verified)

- Frontend on Vercel and object storage on R2 scale effectively for free; they
  are not the capacity constraint.
- The whole capacity question collapses onto **one Railway API container + its
  Postgres connections**.
- The API is effectively stateless: sessions/refresh tokens live in Postgres
  (`auth/tokens/prisma-refresh-token.repository.ts`), not in process memory.
  This is what makes horizontal scaling cheap later.
- No Redis, no queue, no websockets today. Correct for this stage — do not add
  them until a concrete need below is hit.

## Capacity expectation

| Stage | Handles without change |
|---|---|
| Demo | Hundreds of concurrent users. Not a concern. |
| Production, single container | Dozens of agencies, thousands of properties, roughly hundreds to ~1–2k active users doing typical CRUD. |

A real-estate SaaS is low-frequency (agents doing CRUD, not mass consumer
traffic). The business will be healthy long before this architecture strains.

## T-0 gates — MUST be done before the first real tenant

These are non-negotiable because they protect real customer data or are the
first bottleneck under real concurrency.

### 1. Separate production from demo (hard isolation)

- Separate Neon database/project for production (never reuse the demo DB).
- Separate Railway service/environment for the production API.
- Separate domain for production (e.g. `app.inmoview.app` / `api.inmoview.app`),
  keeping `demo.inmoview.app` as the throwaway demo.
- Separate secret store values (do not reuse demo `ACCESS_TOKEN_SECRET`,
  storage keys, or DSNs).

### 2. Neon connection model (the #1 scaling change)

- Production `DATABASE_URL` MUST use the **pooled** (`-pooler`) Neon endpoint,
  not the direct endpoint used for the demo.
- Add `directUrl = env("DIRECT_URL")` to `apps/api/prisma/schema.prisma` and set
  `DIRECT_URL` to the direct (non-pooled) Neon endpoint so `prisma migrate
  deploy` still works.
- Keep `?sslmode=require` on both.
- This is the setting that will exhaust connections first under real load if
  left on the direct endpoint. It is a ~2-line change; do it before real load,
  not after an incident.

### 3. Data-loss safety for the demo seed/reset

The seed guard (`scripts/seed-demo-safety.mjs`) already fails closed: it refuses
`NODE_ENV=production` outside guarded demo mode and requires all three
`INMOVIEW_DEMO_*` vars plus a substring match on `DATABASE_URL`. To keep it safe
in production:

- NEVER set `INMOVIEW_ENVIRONMENT`, `INMOVIEW_DEMO_SEED_ALLOWED`, or
  `INMOVIEW_DEMO_DATABASE_IDENTIFIER` in the production Railway service.
- Choose the demo `INMOVIEW_DEMO_DATABASE_IDENTIFIER` so it can NEVER be a
  substring of the production `DATABASE_URL` (the guard is a substring match).
- Treat `pnpm demo:seed` as a demo-only command; production onboarding uses real
  tenant provisioning, not the demo seed.

### 4. Backups on a schedule (not just pre-reset)

- Enable scheduled Neon backups / set point-in-time-restore retention for the
  production database (the demo only backs up before manual resets).
- Perform one real restore drill into a Neon branch before go-live so the
  restore path is proven, not assumed.

### 5. Observability with alerts

- Sentry production environment separate from `demo`, with alert rules for error
  rate spikes (not just event capture).
- Uptime check on `/api/health` and the frontend.
- One alert on Neon connection saturation — this is the first wall, so watch it
  directly.

### 6. Secrets and auth hygiene

- Fresh, strong production `ACCESS_TOKEN_SECRET` (shared API/frontend), rotated
  away from any demo value.
- Confirm secure cookies + exact CORS origin for the production domains.
- Review auth rate-limit values for real usage (demo values may be permissive).

## Scaling path — in order, only when the wall is hit

Do NOT do these preemptively. Each has a concrete trigger.

1. **Pooled DB connections** — done at T-0 gate #2. Buys the most headroom.
2. **Throttler storage → Redis** — trigger: running more than one API instance.
   The current throttler is in-memory/per-container, so per-user limits break
   across instances without shared storage.
3. **Horizontal API scaling** — trigger: single container CPU/latency pressure
   after the DB is pooled. Cheap because the API is already stateless (sessions
   in Postgres). Run N Railway instances behind the platform load balancer.
4. **Background queue (BullMQ/Redis)** — trigger: work that should not block a
   request (bulk imports, heavy document processing, outbound notifications).
   Not needed until such a feature exists.

## Deliberately unchanged (avoid premature complexity)

- No microservices. The monolith is correct.
- No Redis until gate/trigger #2 above.
- No realtime/websocket layer until a feature demands it.
- No infrastructure-as-code / Kubernetes for the first production tenants.

## Timeline shape

| When | Action |
|---|---|
| Demo | Ship current simple config (direct Neon endpoint, single container). |
| Before first real tenant | All T-0 gates 1–6. |
| As load appears | Scaling path steps 2–4, each on its trigger. |
