# Design: Platform Phase 7 Slice 1 — viewpro-web operator console (scaffold + operator login + read-only metrics dashboard)

Stand up `apps/viewpro-web`, a dedicated GLOBAL-operator Next.js console (Design B: it talks ONLY to `viewpro-api`, never InmoView). Slice 1 is the smallest end-to-end vertical: an operator signs in against `viewpro-api` (`POST /api/auth/login`, httpOnly cookie `viewpro_platform_access_token`), lands on a protected route, and sees a read-only metrics dashboard fed by `GET /api/operators/metrics/summary` (Phase 6 mirror). The app is a COPY-AND-STRIP of `apps/app-new` with every multi-tenant/membership/tenant-switcher concept removed — operators are global, so the session collapses to `Session = { operator: { id, email } }`. The only backend change is an additive `GET /api/auth/me` on `viewpro-api` for session rehydrate on reload. Paths below are under `viewpro-app/`.

## Technical Approach

Copy `apps/app-new` → `apps/viewpro-web`, then strip. `pnpm-workspace.yaml` uses the `apps/*` glob and `turbo.json` is task-based (no per-package list), so the new app is auto-registered by both — no workspace edits. The app is retargeted at `viewpro-api` by pointing `NEXT_PUBLIC_API_URL` at `http://localhost:3002/api` and reusing the direct `apiRequest` client (`src/lib/api-client.ts`, already `credentials:'include'`). Session becomes operator-only: `login()` calls `POST /auth/login` (returns `{ operator }`), rehydrate calls `GET /auth/me` (new). `proxy.ts` middleware does a PRESENCE-CHECK of the cookie only (does NOT verify the signature) and defers authority to `/auth/me` — this keeps the JWT secret out of the frontend deploy. There is no refresh leg and no logout endpoint on `viewpro-api`, so both are handled client-side: 401/expiry → redirect to sign-in; sign-out → clear the client query cache + navigate to sign-in.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Scaffold strategy | COPY `apps/app-new` → `apps/viewpro-web`, then STRIP all tenant/membership/BFF-only surface in the SAME PR | Fresh `create-next-app`; keep app-new as-is and branch behavior at runtime | Copy preserves the proven shadcn/Tailwind-v4/TanStack shell, sidebar, and build config; stripping in-PR keeps dead code from shipping (proposal R1) |
| D2 | Session model | `Session = { operator: { id: string; email: string } }` — no `user`, no `memberships`, no permissions | Keep app-new `{ user, memberships }` and leave memberships empty | Operators are GLOBAL; memberships are meaningless. A minimal type makes the strip auditable and prevents tenant logic leaking back in |
| D3 | Middleware auth check | PRESENCE-CHECK the `viewpro_platform_access_token` cookie in `proxy.ts`; `/auth/me` is the authority | Verify HS256 signature in the middleware (app-new pattern) using `ACCESS_TOKEN_SECRET` | Signature-verify requires shipping the operator JWT secret to the FE deploy (Vercel env) — a needless secret-exposure surface. Presence-check gates obvious-unauthenticated navigation cheaply; the real gate is `viewpro-api` `AuthGuard` on every data call + `/auth/me`. See "Middleware approach" below |
| D4 | Session rehydrate | Client-only via TanStack Query `useQuery(['session'], getSession)` calling `GET /auth/me`; `retry:false`; no SSR fetch | SSR session fetch in a server component / layout | Slice 1 is client-rendered; SSR fetch adds a server round-trip + cookie-forwarding plumbing for no slice-1 benefit. `staleTime` from `query-client.ts` (60s) already dedupes |
| D5 | Sign-out (no backend logout) | Client-side: clear `['session']` query data + `queryClient.clear()`, redirect to sign-in. Do NOT call a logout endpoint | Call `POST /auth/logout` (app-new pattern) | `viewpro-api` has NO logout endpoint (confirmed: only `POST /auth/login` exists). The httpOnly cookie cannot be cleared by JS, but clearing client state + redirect ends the session UX; the cookie expires at its 15-min TTL. Flagged as residual (a server logout can be added later) |
| D6 | Session expiry / no-refresh | On any `401`/`403` from `/auth/me` or a data call → treat as unauthenticated → redirect to `/auth/sign-in`. Drop the refresh leg entirely | Port app-new `getSessionWithRefresh` + `/auth/refresh` | `viewpro-api` has NO refresh endpoint; proposal locks "NO refresh leg". Hard logout at the 15-min access-token TTL is an accepted UX tradeoff for an internal tool |
| D7 | Metrics data path | Feature module `src/features/metrics/api/{types,service,queries}.ts` calling `viewpro-api` DIRECTLY via `apiRequest('/operators/metrics/summary')` | Next.js BFF route (`app-new` dashboard `/api/dashboard/summary` pattern) | Design B says the FE talks only to `viewpro-api`; a BFF adds a hop with no auth/aggregation value here. The `apiRequest` direct pattern (mirrors `features/users`) already forwards the cookie with `credentials:'include'` |
| D8 | `/auth/me` shape | New `GET /auth/me` on `auth.controller.ts`, `@UseGuards(AuthGuard)`, returns `{ operator: { id: req.user.id, email: req.user.email } }` read from `request.user`; NO DB, NO migration | New use-case + DB lookup; a `@CurrentUser` decorator | `AuthGuard` already sets `request.user = { id, email }` from the JWT (guard:25). Return it inline — additive, zero DB, matches login's `{ operator }` envelope for FE symmetry |
| D9 | Workspace/turbo wiring | None — rely on `apps/*` glob (`pnpm-workspace.yaml`) + task-based `turbo.json` auto-discovery | Manually register the package | Both configs already discover any `apps/*` package by convention; a manual edit would be redundant/error-prone |
| D10 | Deploy topology | Own Vercel project, Root Directory `viewpro-app/apps/viewpro-web`; `NEXT_PUBLIC_API_URL` per-env | Add a target to the existing app-new Vercel project | Independent lifecycle + the earlier Root-Directory lesson (monorepo app must set Root Directory to the app dir, not repo root). Flagged in Risks |
| D11 | Empty-state (zero tenants) | Dashboard renders explicit "No tenant data yet" empty state when `tenants === 0` / `byStatus === {}`; still shows `generatedAt` | Render zeros as if data | Phase 6 mirror starts empty (no backfill); an empty state avoids implying "0 tenants exist" is an error |

## Middleware approach — presence-check vs verify (justification)

`app-new/src/proxy.ts` verifies the HS256 signature locally with `ACCESS_TOKEN_SECRET` (dev-fallback `change-me-in-real-env`). Porting that to `viewpro-web` would require the operator JWT signing secret (`ACCESS_TOKEN_SECRET`, `MinLength(16)`, no default — see `viewpro-api/src/config/env.schema.ts`) to live in the frontend's deploy environment. That is an unnecessary secret-exposure surface: the FE never mints tokens and does not need to cryptographically trust one.

DECISION (D3): the middleware does a PRESENCE-CHECK only.
- No cookie on a protected path → redirect to `/auth/sign-in?redirect_url=…`.
- Cookie present → `NextResponse.next()` (optimistic pass).
- AUTHORITY is `viewpro-api`: every protected data call and `GET /auth/me` runs through `AuthGuard` (HS256 verify, cookie `viewpro_platform_access_token`). A present-but-invalid/expired cookie fails there → client sees 401 → redirect (D6).

Tradeoff: a forged/expired cookie can pass the middleware and render the shell for one paint before `/auth/me` returns 401 and redirects. This is acceptable — the middleware is UX-level defense-in-depth, not the security boundary (same philosophy as app-new's proxy comment: "InmoView's own AdminGuard remains the authoritative gate"). The strict security gate is server-side and unchanged.

## Session / Auth Flow

    LOGIN
      sign-in form → login({email,password})
        POST  {NEXT_PUBLIC_API_URL}/auth/login   (credentials:'include')
          viewpro-api LoginUseCase → TokenService.setAccessCookie
          Set-Cookie: viewpro_platform_access_token (httpOnly, sameSite=lax, secure=prod)
        ⇐ 200 { operator:{ id, email } }
      router.push(safeRedirect ?? '/dashboard'); router.refresh()

    PROTECTED NAV (proxy.ts middleware — PRESENCE-CHECK only)
      cookie present?  no → redirect /auth/sign-in?redirect_url=…
                       yes → NextResponse.next()   (optimistic)

    REHYDRATE (client, on mount / reload — SessionProvider)
      useQuery(['session'], getSession, { retry:false })
        GET  {NEXT_PUBLIC_API_URL}/auth/me   (credentials:'include')
          viewpro-api AuthGuard verifies HS256 cookie → request.user
        ⇐ 200 { operator:{ id, email } }        → session hydrated → dashboard
        ⇐ 401/403                               → session=null → redirect /auth/sign-in  (D6, no refresh)

    DATA (dashboard)
      metricsSummaryOptions → getMetricsSummary()
        GET  {NEXT_PUBLIC_API_URL}/operators/metrics/summary   (AuthGuard)
        ⇐ 200 { tenants, byStatus, generatedAt }   → cards (empty-state if tenants===0)
        ⇐ 401                                       → redirect /auth/sign-in

    SIGN-OUT (D5 — no backend logout)
      queryClient.setQueryData(['session'], null); queryClient.clear()
      router.push('/auth/sign-in')     (httpOnly cookie expires at TTL)

## /auth/me controller method + DTO

    // viewpro-api/src/auth/auth.controller.ts (ADD to existing controller)
    @Get('me')
    @UseGuards(AuthGuard)
    getMe(@Req() req: AuthenticatedRequest): OperatorMeResponse {
      // AuthGuard has set req.user = { id, email } from the verified JWT (no DB).
      return { operator: { id: req.user!.id, email: req.user!.email } }
    }

    // response type (inline or a small dto file — no shared package; contract archived post-P3)
    export type OperatorMeResponse = { operator: { id: string; email: string } }

- `AuthenticatedRequest` (`user?: { id; email }`) already exists in `auth/guards/auth.guard.ts` — import it.
- Envelope `{ operator }` matches `POST /auth/login`'s response for FE symmetry (D8).
- Additive: no use-case, no DB, no migration (viewpro-api not yet in prod).

## Metrics feature module + dashboard structure

    src/features/metrics/api/types.ts     MetricsSummary = { tenants:number; byStatus:Record<string,number>; generatedAt:string }
                          service.ts       getMetricsSummary() → apiRequest<MetricsSummary>('/operators/metrics/summary')
                          queries.ts       metricsKeys + metricsSummaryOptions = queryOptions({ queryKey, queryFn:getMetricsSummary })

    src/features/metrics/components/
      metrics-summary-cards.tsx            shadcn <Card> grid: Total tenants; per-status counts (byStatus); generatedAt footer
      metrics-empty-state.tsx              rendered when tenants===0 / byStatus==={} (D11)

    src/app/dashboard/(overview)/page.tsx  page: useQuery(metricsSummaryOptions) → loading skeleton / empty-state / cards

- `MetricsSummary` mirrors `viewpro-api/src/platform-data/metrics.service.ts` verbatim (`tenants`, `byStatus`, `generatedAt`). `byStatus` keys are dynamic strings (TRIAL/ACTIVE/SUSPENDED/CANCELLED) — render by iterating entries, don't hardcode a closed union (mirror keeps it open).
- Loading: shadcn skeleton cards. Error (401): handled by session redirect; other errors show an inline alert (reuse `getApiErrorMessage`).

## Copy-and-strip file map (apps/viewpro-web)

| Path | Action | Description |
|------|--------|-------------|
| `apps/viewpro-web/package.json` | Copy+edit | Rename `name` → `viewpro-web`; keep deps; drop `playwright.seeded` if no seeded e2e in slice 1 |
| `apps/viewpro-web/{next.config.ts,tsconfig.json,postcss.config.mjs,components.json,oxlint/prettier}` | Copy | Keep Tailwind v4 + shadcn (new-york, zinc) config as-is |
| `apps/viewpro-web/src/components/ui/**` | Copy | Reuse ALL shadcn primitives unchanged |
| `apps/viewpro-web/src/lib/{api-client,query-client,utils}.ts` | Copy | Retarget via `NEXT_PUBLIC_API_URL`; strip `x-tenant-id` header from `api-client` (operator-global) |
| `apps/viewpro-web/src/lib/session.ts` | Rewrite | `Session={ operator:{id,email} }`; `login()`→`/auth/login`, `getSession()`→`/auth/me`; DROP `AuthUser`, memberships, permissions, refresh, logout-endpoint call, register-tenant, tenant helpers |
| `apps/viewpro-web/src/lib/session-context.tsx` | Rewrite | Operator-only: `useQuery(['session'],getSession,{retry:false})`; DROP tenant-selection, `useActiveTenant`, membership sync effect; `signOut` = clear cache + redirect (D5) |
| `apps/viewpro-web/src/lib/tenant-selection.ts` | DELETE | Tenant switcher gone (operators global) |
| `apps/viewpro-web/src/proxy.ts` | Rewrite | Cookie `viewpro_platform_access_token`; PRESENCE-CHECK only (D3); drop verify + refresh legs; keep `redirect_url` param + safe-path matcher |
| `apps/viewpro-web/src/components/layout/{app-sidebar,user-nav}.tsx` | Copy+strip | Remove tenant-switcher; `user-nav` reads `session.operator` (not `session.user`), drop "Inmobiliarias"/workspaces item; sign-out via D5 |
| `apps/viewpro-web/src/components/layout/{providers,query-provider,page-container,header}.tsx` | Copy | Keep shell; `providers` keeps `SessionProvider`+`QueryProvider`+theme |
| `apps/viewpro-web/src/features/auth/components/sign-in-view.tsx` | Copy+strip | Keep form/shadcn; DROP membership/tenant redirect logic; `onSubmit`→`login()`→push `redirect_url??'/dashboard'`; keep `getSafeSignInRedirect` (protected paths = `/dashboard*`) |
| `apps/viewpro-web/src/app/auth/sign-in/**` | Copy | Keep route; drop sign-up/register links if register is out of scope |
| `apps/viewpro-web/src/features/metrics/**` | Create | Metrics feature module + dashboard components (above) |
| `apps/viewpro-web/src/app/dashboard/**` | Copy+strip | Keep dashboard layout shell; replace overview page with metrics dashboard; DELETE all tenant/owner/products/team feature routes |
| `apps/viewpro-web/.env.example` | Create | `NEXT_PUBLIC_API_URL=http://localhost:3002/api` (see env vars) |
| `apps/viewpro-web/src/features/{owner,products,users,activity,notifications,team-*,status-change-requests,admin}/**` | DELETE | Not in slice-1 scope; remove to avoid dead code (R1) |
| `apps/viewpro-web/{instrumentation*,sentry*}` | Copy or drop | Sentry off by default in dev; keep config guarded, wire per-env later |

## viewpro-api file changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-api/src/auth/auth.controller.ts` | Modify | Add `GET /auth/me` `@UseGuards(AuthGuard)` returning `{ operator:{id,email} }` from `req.user` (D8). Import `AuthGuard`, `AuthenticatedRequest`, `@Get`, `@Req`, `@UseGuards` |
| `apps/viewpro-api/src/auth/*.dto.ts` or inline | Optional | `OperatorMeResponse` type — inline is sufficient (no shared FE package) |
| `apps/viewpro-api/src/config/env.schema.ts` | Config | `CORS_ORIGIN` must include the viewpro-web origin (comma-list) — no schema change, doc the value |

## CORS / cookie config (local + prod)

    LOCAL DEV
      viewpro-web  http://localhost:3003   (Next dev on :3003)
      viewpro-api  http://localhost:3002   (PORT default 3002)
      viewpro-api  CORS_ORIGIN = http://localhost:3003   (create-app.ts splits comma-list, credentials:true)
      cookie: httpOnly, sameSite='lax', secure=false, NO domain
        → cross-PORT on localhost is same-site for cookies (host-only, port-agnostic) → lax cookie is sent on top-level nav + same-site XHR with credentials:'include'. Works. No COOKIE_DOMAIN needed.

    PROD (cross-subdomain)
      viewpro-web  https://console.viewpro.app   (example)
      viewpro-api  https://api.viewpro.app
      viewpro-api  CORS_ORIGIN = https://console.viewpro.app   (credentials:true)
      cookie: httpOnly, sameSite='lax', secure=true, COOKIE_DOMAIN=.viewpro.app
        → shared parent domain .viewpro.app makes the cookie same-site (lax) across subdomains → sent on console→api requests. TokenService.baseCookieOptions already emits `domain` when COOKIE_DOMAIN≠localhost and `secure` from COOKIE_SECURE.

- `create-app.ts` already: `app.enableCors({ origin: CORS_ORIGIN.split(','), credentials:true })` + `cookie-parser`. Only the env VALUE changes.
- Reminder: with `credentials:true`, CORS `origin` must be an explicit allowlist (never `*`) — already enforced by the split-list.

## Environment variables (viewpro-web)

| Var | Local | Prod | Notes |
|-----|-------|------|-------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3002/api` | `https://api.viewpro.app/api` | Consumed by `api-client.ts` (`apiUrl`) |
| `PORT` (dev script) | `3003` | n/a (Vercel) | `next dev -p 3003` |
| `NEXT_PUBLIC_SENTRY_*` | unset (off) | optional | Sentry guarded-off in dev |

- NOT set on the FE: `ACCESS_TOKEN_SECRET` — deliberately absent (D3, presence-check middleware).

## Workspace / turbo / Vercel wiring

- `pnpm-workspace.yaml` (`apps/*`) + `turbo.json` (task-based) auto-register `viewpro-web` — no edits (D9).
- Vercel: NEW project, Root Directory `viewpro-app/apps/viewpro-web`, framework Next.js, env `NEXT_PUBLIC_API_URL` per environment (D10). Recall the earlier Root-Directory fix: a monorepo app deploys from the APP dir, not the repo root — misconfig builds the wrong package or fails install.

## Isolation / Design-B Proof

1. `viewpro-web` calls ONLY `NEXT_PUBLIC_API_URL` (= `viewpro-api`). No InmoView URL, no `INMOVIEW_API_INTERNAL_URL`, no `PLATFORM_CONTROL_SECRET` in the FE.
2. Metrics come from `viewpro-api GET /operators/metrics/summary`, which reads the Phase-6 mirror only — the FE never sees InmoView.
3. No shared package dependency (`@viewpro/platform-contract` archived post-Phase 3); FE types are local copies of the `viewpro-api` response shapes.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (api) | `GET /auth/me` returns `{operator:{id,email}}` from `req.user`; no DB call | supertest + forged/valid cookies; 401 on missing/expired |
| Unit (api) | existing `POST /auth/login` unaffected by the additive route | supertest regression |
| Unit (web) | `session.ts` `login`/`getSession` hit correct paths; operator-only type | vitest, mocked `apiRequest` |
| Unit (web) | `proxy.ts` presence-check: no cookie→redirect(+redirect_url); cookie present→next() | vitest, mocked NextRequest |
| Unit (web) | `session-context` 401→session null→redirect; `signOut` clears cache (D5/D6) | vitest + mocked query client |
| Unit (web) | metrics `service`/`queries` map response; empty-state when tenants===0 (D11) | vitest / RTL |
| Component (web) | dashboard renders cards from `byStatus`; empty state; loading skeleton | RTL |
| E2E (optional) | login→dashboard→reload rehydrate; unauth→redirect | Playwright — residual (slice-1 may defer to unit) |

## Risks / Tradeoffs

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Copy-strip dead-code noise (tenant/owner/products features) | High | DELETE all out-of-scope features in the same PR (R1); reviewer checklist; the file map above lists every delete |
| No-refresh hard logout at 15-min TTL | Med | Documented UX tradeoff (D6); redirect to sign-in; acceptable for internal tool |
| No backend logout → cookie lingers until TTL after sign-out | Med | Client clears state + redirects (D5); flag a future `POST /auth/logout` |
| Cross-port cookie (local) not sent | Low | sameSite=lax + host-only cookie is same-site across ports on localhost; `credentials:'include'` on every call; verify in dev |
| Cross-subdomain cookie (prod) misconfig | Med | `COOKIE_DOMAIN=.viewpro.app` + `secure=true` + explicit `CORS_ORIGIN` allowlist; documented |
| Vercel Root Directory misconfig | Med | Own project, Root Directory `viewpro-app/apps/viewpro-web` (recall earlier fix); flagged (D10) |
| Middleware presence-check renders shell before `/auth/me` 401 | Low | Accepted; middleware is UX defense-in-depth, `AuthGuard` is the real gate (D3) |
| `byStatus` keys drift from expected statuses | Low | Render by iterating entries (open map), don't hardcode a closed union (mirror keeps `byStatus` open) |

## Residual Questions (for tasks phase)

- [ ] Sign-out: ship client-only (D5) for slice 1, or also add `POST /auth/logout` to `viewpro-api` now to clear the httpOnly cookie server-side? (Recommend client-only for slice 1; note the follow-up.)
- [ ] Sign-in page: keep the app-new "Crear cuenta"/sign-up link, or remove it (operator accounts provisioned out-of-band, no self-register)? (Recommend remove.)
- [ ] Middleware protected-path matcher: reuse `/dashboard*` from app-new, or add operator-specific routes? (Slice 1 = `/dashboard*` only.)
- [ ] E2E: Playwright login+dashboard happy path in slice 1, or unit/component-only and defer e2e? (Recommend unit/component for slice 1.)
- [ ] `OperatorMeResponse`: inline type vs a small `dto/me.dto.ts` file for OpenAPI/Swagger doc surface. (Recommend inline; add DTO only if Swagger doc is wanted.)
- [ ] Dev port: hard-code `3003` in the `dev` script (`next dev -p 3003`) vs env-driven — confirm 3003 is free alongside app-new (:3000/:3001) and viewpro-api (:3002).
- [ ] Sentry: keep guarded-off config copied, or strip Sentry entirely from viewpro-web for slice 1? (Recommend keep guarded-off, wire per-env later.)
