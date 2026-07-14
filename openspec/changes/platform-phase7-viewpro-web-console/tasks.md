# Tasks: Platform Phase 7 Slice 1 — viewpro-web operator console

> Strict TDD where noted (backend /auth/me + FE session/metrics logic). Pure
> scaffold and copy-strip steps do NOT require RED-first. All paths under
> `viewpro-app/`.

---

## Residual questions — resolved inline

| Question | Decision |
|----------|----------|
| Sign-out strategy | Client-only (clear query cache + redirect) — no backend logout endpoint; httpOnly cookie expires at TTL (D5) |
| Sign-up link | REMOVE. Operators provisioned out-of-band; no self-register in slice 1 |
| `OperatorMeResponse` | Inline type in `auth.controller.ts`; no separate DTO file |
| Dev port | Hard-code `3003` in `dev` script (`next dev -p 3003`) |
| Test surface | Unit/component tests for session + metrics + `/auth/me`; Playwright e2e DEFERRED to slice 2 |
| Sentry | Keep guarded-off config copied; wire per-env later |
| Middleware protected paths | `/dashboard*` only (reuse app-new matcher; operator-specific routes added in slice 2) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1 100–1 500 (new app directory, stripped copies, 3 feature modules, tests, 1 backend route) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → /auth/me backend + viewpro-web scaffold (copy-strip, boots) / PR 2 → operator auth flow (session + middleware + sign-in) / PR 3 → metrics feature + dashboard wiring |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | viewpro-api GET /auth/me (TDD) + viewpro-web scaffold (copy-strip, boots, env, workspace verify) | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/platform-api test` (auth suite) | `GET /api/auth/me` with valid operator session → 200; without → 401 | Delete `apps/viewpro-web`; revert `/auth/me` addition to auth.controller.ts |
| WU-2 | Operator auth: sign-in page + session.ts + session-context + proxy.ts middleware + protected routing | PR 2 (base: PR 1 branch) | `pnpm --filter viewpro-web test` (session + proxy suites) | Sign in at `localhost:3003/auth/sign-in` → cookie set → dashboard redirect; reload → stays logged in | Revert `src/lib/session.ts`, `session-context.tsx`, `proxy.ts`, sign-in feature files |
| WU-3 | Metrics feature module + dashboard page (loading / empty-state / error-state) + wiring | PR 3 (base: PR 2 branch) | `pnpm --filter viewpro-web test` (metrics suite) | Authenticated operator visits `/dashboard` → metrics cards rendered from viewpro-api | Delete `src/features/metrics/`; revert `src/app/dashboard/(overview)/page.tsx` to placeholder |

---

## Dependency Graph

```
T-01 (RED: /auth/me tests — viewpro-api)
  └── T-02 (GREEN: /auth/me implementation)
        └── T-03 (scaffold apps/viewpro-web — copy app-new)
              └── T-04 (strip: delete dead feature directories)
                    └── T-05 (strip: rewrite package.json + config files)
                          └── T-06 (strip: api-client — remove x-tenant-id; point NEXT_PUBLIC_API_URL)
                                └── T-07 (create .env.example + dev :3003 port)
                                      └── T-08 (workspace/turbo smoke test — boots)
                                            ├── T-09 (RED: session.ts unit tests)
                                            │     └── T-10 (GREEN: session.ts — operator-only login + getSession)
                                            │           └── T-11 (RED: proxy.ts unit tests)
                                            │                 └── T-12 (GREEN: proxy.ts — presence-check rewrite)
                                            │                       └── T-13 (RED: session-context unit tests)
                                            │                             └── T-14 (GREEN: session-context — operator-only + signOut D5)
                                            │                                   └── T-15 (strip+wire: app-sidebar + user-nav)
                                            │                                         └── T-16 (strip: sign-in-view — remove sign-up link; wire login())
                                            │                                               └── T-17 (RED: metrics types + service + queries tests)
                                            │                                                     └── T-18 (GREEN: metrics api module)
                                            │                                                           └── T-19 (RED: dashboard page + component tests)
                                            │                                                                 └── T-20 (GREEN: dashboard page + cards + empty/error state)
                                            │                                                                       └── T-21 (final verification)
                                            └── T-09 ↑
```

---

## WU-1 — viewpro-api `GET /auth/me` (TDD) + viewpro-web scaffold (copy-strip + boots)

### [x] T-01 — RED: unit tests for `GET /auth/me`
**Type**: test (RED)
**Spec**: operator-session-me — GET /auth/me Endpoint (all 3 scenarios); No Database Access
**WU**: WU-1, commit 1
**Depends on**: nothing

- `apps/viewpro-api/src/auth/__tests__/auth-me.controller.spec.ts` (supertest + test app)
  - **Valid `viewpro_platform_access_token` cookie → 200 + `{ operator: { id, email } }` matching JWT claims** (spec scenario 1)
  - **Missing cookie → 401; no operator data in body** (spec scenario 2)
  - **Expired/tampered cookie → 401; no operator data** (spec scenario 3)
  - **Existing `POST /api/auth/login` unaffected** — login smoke test passes (additive regression)
  - **No Prisma query called** — spy on `PrismaService`; assert zero DB calls (spec: No Database Access)

All RED until `@Get('me')` is added.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(platform-api): RED — GET /auth/me (valid, missing, expired cookie, no-DB, login regression)`

---

### [x] T-02 — GREEN: implement `GET /auth/me` on `auth.controller.ts`
**Type**: impl
**Spec**: operator-session-me — GET /auth/me Endpoint; No Database Access; Additive
**WU**: WU-1, commit 2
**Depends on**: T-01

- `apps/viewpro-api/src/auth/auth.controller.ts`
  - Add import: `Get`, `Req`, `UseGuards` (if not present), `AuthGuard`, `AuthenticatedRequest`
  - Add inline type: `export type OperatorMeResponse = { operator: { id: string; email: string } }`
  - Add method: `@Get('me') @UseGuards(AuthGuard) getMe(@Req() req: AuthenticatedRequest): OperatorMeResponse { return { operator: { id: req.user!.id, email: req.user!.email } } }`
  - No use-case, no migration, no DB call
- Confirm T-01 GREEN; confirm existing login suite GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-01 GREEN; full auth suite GREEN.
**Commit**: `feat(platform-api): GET /auth/me — @UseGuards(AuthGuard) returning operator identity from JWT (D8)`

---

### [x] T-03 — Scaffold `apps/viewpro-web` — copy `apps/app-new`
**Type**: impl
**Spec**: operator-console — scaffold foundation
**WU**: WU-1, commit 3
**Depends on**: T-02

- `cp -r viewpro-app/apps/app-new viewpro-app/apps/viewpro-web`
- No content changes yet — raw copy to establish the git tree

**Exit**: `apps/viewpro-web/` directory exists with full app-new contents.
**Commit**: `chore(viewpro-web): scaffold — raw copy of apps/app-new (pre-strip)`

---

### [x] T-04 — Strip: delete dead feature directories (D1)
**Type**: impl
**Spec**: operator-console — Isolation from InmoView API; proposal R1 no dead code
**WU**: WU-1, commit 4
**Depends on**: T-03

Delete the following paths from `apps/viewpro-web/src/`:
- `features/owner/`
- `features/products/`
- `features/users/`
- `features/activity/`
- `features/notifications/`
- `features/team-*/` (all team-* subdirs)
- `features/status-change-requests/`
- `features/admin/`
- `lib/tenant-selection.ts`
- `app/dashboard/(overview)/page.tsx` content → replace with `export default function Page() { return null }` placeholder (will be rewritten in WU-3)
- Remove all dead dashboard sub-routes (owner, products, team, admin pages) from `app/dashboard/`
- Remove sign-up / "Crear cuenta" link from `src/features/auth/components/sign-in-view.tsx` (residual Q2 resolved)

**Exit**: none of the deleted paths exist; `rg 'tenant-selection' apps/viewpro-web/src/` → zero hits.
**Commit**: `chore(viewpro-web): strip dead feature directories + tenant-selection (D1, R1)`

---

### [x] T-05 — Strip: rewrite `package.json` + copy config files
**Type**: impl
**Spec**: operator-console — scaffold
**WU**: WU-1, commit 5
**Depends on**: T-04

- `apps/viewpro-web/package.json`: rename `name` → `viewpro-web`; update `dev` script → `next dev -p 3003`; remove `playwright.seeded` script (e2e deferred); keep all deps
- `apps/viewpro-web/{next.config.ts,tsconfig.json,postcss.config.mjs,components.json}`: keep as-is (Tailwind v4 + shadcn new-york/zinc)
- `apps/viewpro-web/{.eslintrc.*,prettier.*,oxlint.*}`: keep as-is

**Exit**: `cat apps/viewpro-web/package.json | rg '"name"'` → `"viewpro-web"`; dev script shows `-p 3003`.
**Commit**: `chore(viewpro-web): package.json — rename + dev port 3003 (D9)`

---

### [x] T-06 — Strip: `api-client.ts` — remove `x-tenant-id`; retarget `NEXT_PUBLIC_API_URL`
**Type**: impl
**Spec**: operator-console — Isolation from InmoView API; Cookie and Auth Boundary
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/viewpro-web/src/lib/api-client.ts`
  - Remove `x-tenant-id` header (operator-global; no tenant context)
  - Confirm `apiUrl` reads from `process.env.NEXT_PUBLIC_API_URL` (already the pattern; verify only)
  - Confirm `credentials: 'include'` is set on all requests (required for cookie forwarding)
- `apps/viewpro-web/src/lib/query-client.ts`: copy unchanged (staleTime 60 s already set)
- `apps/viewpro-web/src/lib/utils.ts`: copy unchanged

**Exit**: `rg 'x-tenant-id' apps/viewpro-web/src/lib/api-client.ts` → zero hits.
**Commit**: `feat(viewpro-web): api-client — remove x-tenant-id; credentials:include; NEXT_PUBLIC_API_URL (D7, isolation)`

---

### [x] T-07 — Create `.env.example` + CORS config note
**Type**: impl
**Spec**: operator-console — Cookie and Auth Boundary; CORS / cookie config
**WU**: WU-1, commit 7
**Depends on**: T-06

- Create `apps/viewpro-web/.env.example`:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3002/api
  PORT=3003
  # NEXT_PUBLIC_SENTRY_* — off by default; wire per-env
  # ACCESS_TOKEN_SECRET is NOT set here (D3 — presence-check middleware; no signature verification in FE)
  ```
- Add CORS comment to `apps/viewpro-api/.env.example` (or a `docs/cors-config.md` note):
  - Local: `CORS_ORIGIN=http://localhost:3003`
  - Prod: `CORS_ORIGIN=https://console.viewpro.app`, `COOKIE_DOMAIN=.viewpro.app`, `COOKIE_SECURE=true`

**Exit**: `.env.example` exists; `ACCESS_TOKEN_SECRET` absent from viewpro-web env files.
**Commit**: `chore(viewpro-web): .env.example + CORS/cookie config note for viewpro-api (D3, D10)`

---

### [x] T-08 — Workspace/turbo smoke test — confirm app boots
**Type**: verify
**Spec**: operator-console — scaffold; D9 (no workspace edits needed)
**WU**: WU-1, commit 8
**Depends on**: T-07

- `pnpm install` from workspace root — confirm `viewpro-web` registered via `apps/*` glob (no `pnpm-workspace.yaml` edit needed)
- `pnpm --filter viewpro-web typecheck` — passes (or fix import errors from dead deletions)
- `pnpm --filter viewpro-web build` — passes (or fix build errors)
- Confirm `turbo run build --filter=viewpro-web` picks up the app without `turbo.json` edits (D9)
- Keep Sentry config copied but guarded-off (no `NEXT_PUBLIC_SENTRY_*` in local env)

**Exit**: `pnpm --filter viewpro-web typecheck` passes; no dead-import type errors.
**Commit**: `chore(viewpro-web): workspace smoke test — boots, typecheck passes (D9)`

---

## WU-2 — Operator auth: session + middleware + sign-in

### [x] T-09 — RED: unit tests for `session.ts`
**Type**: test (RED)
**Spec**: operator-console — Operator Sign-In (all scenarios); Client Session Model; Session Rehydration
**WU**: WU-2, commit 1
**Depends on**: T-08

- `apps/viewpro-web/src/lib/__tests__/session.spec.ts` (vitest, mocked `apiRequest`)
  - **`login({ email, password })` calls `POST /auth/login`; on 200 returns `{ operator: { id, email } }`** (sign-in spec scenario 1)
  - **`login()` on 401 → throws; no session object returned** (sign-in spec scenario 2)
  - **`getSession()` calls `GET /auth/me`; on 200 returns `{ operator: { id, email } }`** (rehydration spec scenario 1)
  - **`getSession()` on 401 → throws** (rehydration spec scenario 2)
  - **Session object contains ONLY `{ operator: { id, email } }` — no membership/tenant fields** (client session model spec)
  - **`Session` type does NOT include `user`, `memberships`, or `permissions` properties** (compile-time: `@ts-expect-error` negative test)

All RED until `session.ts` is rewritten.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(viewpro-web): RED — session.ts login/getSession operator-only (all spec scenarios)`

---

### [x] T-10 — GREEN: rewrite `session.ts` — operator-only session (D2, D4, D5, D6)
**Type**: impl
**Spec**: operator-console — Operator Sign-In; Client Session Model; Session Rehydration
**WU**: WU-2, commit 2
**Depends on**: T-09

- `apps/viewpro-web/src/lib/session.ts` — REWRITE:
  - `export type Session = { operator: { id: string; email: string } }`
  - `export async function login(credentials: { email: string; password: string }): Promise<Session>` → `apiRequest<Session>('/auth/login', { method: 'POST', body: credentials })`
  - `export async function getSession(): Promise<Session>` → `apiRequest<Session>('/auth/me')`
  - DROP: `AuthUser`, `memberships`, `permissions`, `getSessionWithRefresh`, `logout` endpoint call, `registerTenant`, all tenant helpers
- Confirm T-09 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-09 GREEN.
**Commit**: `feat(viewpro-web): session.ts — operator-only Session type; login→/auth/login; getSession→/auth/me (D2, D4, D6)`

---

### [x] T-11 — RED: unit tests for `proxy.ts` middleware
**Type**: test (RED)
**Spec**: operator-console — Protected Route Middleware (all 3 scenarios); Cookie and Auth Boundary
**WU**: WU-2, commit 3
**Depends on**: T-10

- `apps/viewpro-web/src/lib/__tests__/proxy.spec.ts` (vitest, mocked `NextRequest` / `NextResponse`)
  - **No `viewpro_platform_access_token` cookie on `/dashboard` → redirect to `/auth/sign-in?redirect_url=/dashboard`** (spec scenario 1)
  - **Cookie present on `/dashboard` → `NextResponse.next()` (optimistic pass)** (spec scenario 2; D3 presence-check only)
  - **Cookie present but treating as "expired" test — middleware does NOT verify signature; presence alone allows next()** (spec scenario 3 — middleware is presence-only; 401 arrives from /auth/me client-side, not middleware)
  - **Public paths (`/auth/sign-in`) with no cookie → NOT redirected** (path matcher invariant)
  - **`ACCESS_TOKEN_SECRET` is NOT imported or used in proxy.ts** (D3; compile-time scan via `@ts-expect-error` or import assertion)

All RED until `proxy.ts` is rewritten.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(viewpro-web): RED — proxy.ts presence-check middleware (all scenarios + D3 no-secret invariant)`

---

### [x] T-12 — GREEN: rewrite `proxy.ts` — presence-check middleware (D3)
**Type**: impl
**Spec**: operator-console — Protected Route Middleware; D3
**WU**: WU-2, commit 4
**Depends on**: T-11

- `apps/viewpro-web/src/proxy.ts` — REWRITE:
  - Check for cookie `viewpro_platform_access_token` using `request.cookies.get('viewpro_platform_access_token')`
  - No cookie on protected path → `NextResponse.redirect(new URL('/auth/sign-in?redirect_url=...', request.url))`
  - Cookie present → `NextResponse.next()` (no HS256 verify; no `ACCESS_TOKEN_SECRET` import)
  - Keep `redirect_url` safe-path matcher (only `/dashboard*` is protected in slice 1)
  - DROP: HS256 `jose`/`jsonwebtoken` imports; refresh leg; `ACCESS_TOKEN_SECRET` reference
- Confirm T-11 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-11 GREEN; `rg 'ACCESS_TOKEN_SECRET' apps/viewpro-web/src/proxy.ts` → zero hits.
**Commit**: `feat(viewpro-web): proxy.ts — presence-check middleware; no JWT verify; no secret in FE (D3)`

---

### [x] T-13 — RED: unit tests for `session-context.tsx`
**Type**: test (RED)
**Spec**: operator-console — Session Rehydration; Cookie and Auth Boundary; D5; D6
**WU**: WU-2, commit 5
**Depends on**: T-12

- `apps/viewpro-web/src/lib/__tests__/session-context.spec.tsx` (vitest + RTL, mocked query client + `getSession`)
  - **`useQuery(['session'], getSession, { retry: false })` fetches on mount; 200 → `session.operator` hydrated** (rehydration spec scenario 1)
  - **`getSession()` throws 401 → `session` is `null`; redirect to `/auth/sign-in` triggered** (rehydration spec scenario 2; D6)
  - **`signOut()` calls `queryClient.setQueryData(['session'], null)` + `queryClient.clear()` + redirect to `/auth/sign-in`** (D5 — no backend logout)
  - **`useActiveTenant` / tenant-selection hooks are NOT exported from context** (D2; `@ts-expect-error` or import test)

All RED until `session-context.tsx` is rewritten.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(viewpro-web): RED — session-context rehydration + 401 redirect + signOut D5 (all scenarios)`

---

### [x] T-14 — GREEN: rewrite `session-context.tsx` — operator-only (D2, D4, D5, D6)
**Type**: impl
**Spec**: operator-console — Session Rehydration; D4; D5; D6
**WU**: WU-2, commit 6
**Depends on**: T-13

- `apps/viewpro-web/src/lib/session-context.tsx` — REWRITE:
  - `useQuery(['session'], getSession, { retry: false, staleTime: 60_000 })`
  - On `isError` (401/403) → `router.push('/auth/sign-in')` (D6)
  - `signOut()` → `queryClient.setQueryData(['session'], null); queryClient.clear(); router.push('/auth/sign-in')` (D5)
  - Context shape: `{ session: Session | null; isLoading: boolean; signOut: () => void }`
  - DROP: `useActiveTenant`, membership sync effect, tenant-selection, `useSessionWithRefresh`
- Confirm T-13 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-13 GREEN.
**Commit**: `feat(viewpro-web): session-context — operator-only; TanStack rehydrate; signOut client-only (D2, D4, D5, D6)`

---

### [x] T-15 — Strip+wire: `app-sidebar.tsx` + `user-nav.tsx`
**Type**: impl
**Spec**: operator-console — Client Session Model (session.operator; no tenant fields)
**WU**: WU-2, commit 7
**Depends on**: T-14

- `apps/viewpro-web/src/components/layout/app-sidebar.tsx`
  - Remove tenant-switcher component and imports
  - Remove "Inmobiliarias"/workspaces nav item
  - Keep dashboard nav item
- `apps/viewpro-web/src/components/layout/user-nav.tsx`
  - Read `session.operator.email` (not `session.user.email`)
  - Wire `signOut` from `useSession()` context (D5 client sign-out)
  - Remove any tenant/workspace menu items
- `apps/viewpro-web/src/components/layout/{providers,query-provider,page-container,header}.tsx`: copy unchanged; `providers.tsx` keeps `SessionProvider` + `QueryProvider` + theme

**Exit**: `pnpm --filter viewpro-web typecheck` passes; `rg 'tenant' apps/viewpro-web/src/components/layout/` → zero hits (except comments).
**Commit**: `feat(viewpro-web): sidebar + user-nav — operator-only; signOut via context (D5)`

---

### [x] T-16 — Strip+wire: `sign-in-view.tsx` — remove sign-up; wire `login()`
**Type**: impl
**Spec**: operator-console — Operator Sign-In (both scenarios); residual Q2 (no sign-up)
**WU**: WU-2, commit 8
**Depends on**: T-15

- `apps/viewpro-web/src/features/auth/components/sign-in-view.tsx`
  - `onSubmit` calls `login({ email, password })` from `session.ts`
  - On success → `router.push(getSafeSignInRedirect(redirect_url) ?? '/dashboard'); router.refresh()`
  - On 401 → display inline error message (spec scenario 2)
  - REMOVE sign-up / "Crear cuenta" link (residual Q2 resolved)
  - REMOVE membership/tenant redirect logic
  - Keep `getSafeSignInRedirect` (validates `redirect_url` to `/dashboard*` only)
- `apps/viewpro-web/src/app/auth/sign-in/**`: copy route; remove sign-up page route if present

**Exit**: `rg 'sign.up\|Crear cuenta\|register' apps/viewpro-web/src/features/auth/` → zero hits.
**Commit**: `feat(viewpro-web): sign-in-view — operator-only login; no sign-up link; redirect to dashboard (D2)`

---

## WU-3 — Metrics feature module + dashboard page

### [x] T-17 — RED: unit tests for metrics `types` + `service` + `queries`
**Type**: test (RED)
**Spec**: operator-console — Read-Only Metrics Dashboard (scenarios 1, 2, 3); D7; D11
**WU**: WU-3, commit 1
**Depends on**: T-16

- `apps/viewpro-web/src/features/metrics/api/__tests__/metrics.spec.ts` (vitest, mocked `apiRequest`)
  - **`getMetricsSummary()` calls `GET /operators/metrics/summary`** (spec: dashboard calls correct endpoint)
  - **Response `{ tenants, byStatus, generatedAt }` mapped to `MetricsSummary` type** (spec scenario 1)
  - **`byStatus` keys are iterated dynamically — no hardcoded status enum** (D11 open map)
  - **`metricsKeys` generates stable query key array** (queryOptions integration)
  - **`metricsSummaryOptions` returns `queryOptions` with `queryFn: getMetricsSummary`** (queries wiring)

All RED until metrics api module exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(viewpro-web): RED — metrics api service + queryOptions (spec scenarios 1-2, D7, D11)`

---

### [x] T-18 — GREEN: implement metrics api module (`types` + `service` + `queries`)
**Type**: impl
**Spec**: operator-console — Read-Only Metrics Dashboard; D7; D11
**WU**: WU-3, commit 2
**Depends on**: T-17

- `apps/viewpro-web/src/features/metrics/api/types.ts`
  - `export type MetricsSummary = { tenants: number; byStatus: Record<string, number>; generatedAt: string }`
- `apps/viewpro-web/src/features/metrics/api/service.ts`
  - `export async function getMetricsSummary(): Promise<MetricsSummary>` → `apiRequest<MetricsSummary>('/operators/metrics/summary')`
- `apps/viewpro-web/src/features/metrics/api/queries.ts`
  - `export const metricsKeys = { all: ['metrics'] as const, summary: () => [...metricsKeys.all, 'summary'] as const }`
  - `export const metricsSummaryOptions = queryOptions({ queryKey: metricsKeys.summary(), queryFn: getMetricsSummary })`
- Confirm T-17 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-17 GREEN.
**Commit**: `feat(viewpro-web): metrics api module — MetricsSummary type + service + queryOptions (D7, D11)`

---

### [x] T-19 — RED: component tests for dashboard page + metrics components
**Type**: test (RED)
**Spec**: operator-console — Read-Only Metrics Dashboard (all 3 scenarios); D11
**WU**: WU-3, commit 3
**Depends on**: T-18

- `apps/viewpro-web/src/features/metrics/components/__tests__/metrics-summary-cards.spec.tsx` (vitest + RTL)
  - **Renders total tenant count card** (spec scenario 1)
  - **Renders one card per `byStatus` entry with dynamic key + count** (spec scenario 1; D11 open map)
  - **Renders `generatedAt` timestamp in footer** (spec scenario 1)
  - **`tenants === 0` + `byStatus === {}` → renders empty-state component, NOT an error** (spec scenario 2; D11)
- `apps/viewpro-web/src/app/dashboard/(overview)/__tests__/page.spec.tsx` (vitest + RTL, mocked query)
  - **Loading state → skeleton cards rendered** (not an error)
  - **Successful query → `MetricsSummaryCards` rendered with data** (spec scenario 1)
  - **Query error (non-401) → inline error state rendered with `getApiErrorMessage`** (spec scenario 3)
  - **Page is read-only — no mutation controls rendered** (spec invariant)

All RED until components + page exist.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(viewpro-web): RED — dashboard page + MetricsSummaryCards + empty/error states (all spec scenarios)`

---

### [x] T-20 — GREEN: metrics components + dashboard page
**Type**: impl
**Spec**: operator-console — Read-Only Metrics Dashboard; D11
**WU**: WU-3, commit 4
**Depends on**: T-19

- `apps/viewpro-web/src/features/metrics/components/metrics-summary-cards.tsx`
  - shadcn `<Card>` grid: Total tenants card; per-status count cards (iterate `Object.entries(byStatus)`); `generatedAt` footer
- `apps/viewpro-web/src/features/metrics/components/metrics-empty-state.tsx`
  - Rendered when `tenants === 0` or `byStatus` is empty (D11); displays "No tenant data yet"
- `apps/viewpro-web/src/app/dashboard/(overview)/page.tsx` — REWRITE from placeholder:
  - `useQuery(metricsSummaryOptions)` — `retry: false` on 401 (session redirect handles it in context)
  - Loading → shadcn skeleton cards
  - Empty (`tenants === 0`) → `<MetricsEmptyState />`
  - Error (non-401) → inline alert using `getApiErrorMessage`
  - Success → `<MetricsSummaryCards data={data} />`
- Confirm T-19 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-19 GREEN; full test suite GREEN.
**Commit**: `feat(viewpro-web): metrics dashboard — cards + empty-state + error-state + dashboard page (D11)`

---

### [x] T-21 — Final verification + invariant check
**Type**: verify
**Spec**: All invariants; proposal acceptance criteria (all 7 items)
**WU**: WU-3, commit 5
**Depends on**: T-20

1. `pnpm --filter @viewpro/platform-api test` — all GREEN (auth suite + new /auth/me tests)
2. `pnpm --filter viewpro-web test` — all GREEN (session + proxy + metrics suites)
3. `pnpm --filter viewpro-web typecheck` — passes
4. `pnpm --filter @viewpro/platform-api typecheck` — passes
5. `rg 'ACCESS_TOKEN_SECRET' apps/viewpro-web/src/` → zero hits (D3)
6. `rg 'x-tenant-id\|membership\|useActiveTenant' apps/viewpro-web/src/` → zero hits (D2)
7. `rg 'NEXT_PUBLIC_API_URL\|localhost:3002' apps/viewpro-web/.env.example` → present; no InmoView URL
8. `rg 'apps/api\|INMOVIEW' apps/viewpro-web/src/` → zero hits (isolation)
9. Manually verify: `GET /api/auth/me` returns 401 without cookie; 200 with valid operator session
10. Manually verify: `next dev -p 3003` boots; sign-in page at `localhost:3003/auth/sign-in`; `/dashboard` redirects to sign-in when unauthenticated
11. Confirm `pnpm-workspace.yaml` unchanged; `turbo run build --filter=viewpro-web` resolves without config edit (D9)
12. Add code comment to `proxy.ts`: `// Middleware performs PRESENCE-CHECK only — does NOT verify JWT signature (D3). Authority is viewpro-api AuthGuard + GET /auth/me.`
13. Add comment to `session-context.tsx` `signOut`: `// No backend logout endpoint exists on viewpro-api (D5). Cookie expires at TTL. Follow-up: add POST /auth/logout to viewpro-api.`

**Exit**: all 13 checks pass; no regressions in viewpro-api auth/login; Design-B isolation confirmed.
**Commit**: `chore(platform-phase7-wu3): final verification — viewpro-web isolation, invariants, acceptance criteria`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|-----|-----------------|------------|
| ~~T-01~~ [x] RED: GET /auth/me tests | test | WU-1 | operator-session-me (all 3 scenarios + no-DB) | — |
| ~~T-02~~ [x] GREEN: GET /auth/me impl | impl | WU-1 | operator-session-me; D8 | T-01 |
| ~~T-03~~ [x] scaffold apps/viewpro-web | impl | WU-1 | operator-console scaffold | T-02 |
| ~~T-04~~ [x] strip: delete dead features | impl | WU-1 | Isolation; R1 | T-03 |
| ~~T-05~~ [x] strip: package.json + config | impl | WU-1 | scaffold; D9 | T-04 |
| ~~T-06~~ [x] strip: api-client x-tenant-id | impl | WU-1 | Isolation; Cookie Boundary | T-05 |
| ~~T-07~~ [x] .env.example + CORS note | impl | WU-1 | D3; D10; CORS config | T-06 |
| ~~T-08~~ [x] workspace smoke test | verify | WU-1 | D9; boots | T-07 |
| ~~T-09~~ [x] RED: session.ts tests | test | WU-2 | Sign-In; Session Model; Rehydration | T-08 |
| ~~T-10~~ [x] GREEN: session.ts rewrite | impl | WU-2 | Sign-In; Session Model; D2; D4; D6 | T-09 |
| ~~T-11~~ [x] RED: proxy.ts tests | test | WU-2 | Protected Middleware (all 3 scenarios); D3 | T-10 |
| ~~T-12~~ [x] GREEN: proxy.ts rewrite | impl | WU-2 | Protected Middleware; D3 | T-11 |
| ~~T-13~~ [x] RED: session-context tests | test | WU-2 | Rehydration; D5; D6 | T-12 |
| ~~T-14~~ [x] GREEN: session-context rewrite | impl | WU-2 | Rehydration; D2; D4; D5; D6 | T-13 |
| ~~T-15~~ [x] strip+wire: sidebar + user-nav | impl | WU-2 | Session Model; D5 | T-14 |
| ~~T-16~~ [x] strip+wire: sign-in-view | impl | WU-2 | Sign-In scenarios; residual Q2 | T-15 |
| ~~T-17~~ [x] RED: metrics api tests | test | WU-3 | Dashboard (scenarios 1-2); D7; D11 | T-16 |
| ~~T-18~~ [x] GREEN: metrics api module | impl | WU-3 | Dashboard; D7; D11 | T-17 |
| ~~T-19~~ [x] RED: dashboard page + component tests | test | WU-3 | Dashboard (all 3 scenarios); D11 | T-18 |
| ~~T-20~~ [x] GREEN: metrics components + dashboard | impl | WU-3 | Dashboard; D11 | T-19 |
| ~~T-21~~ [x] final verification | verify | WU-3 | All invariants + acceptance criteria | T-20 |

---

## Success Checklist (maps to spec acceptance)

- [x] viewpro-web boots on `localhost:3003` (T-08, T-21)
- [x] Operator signs in against viewpro-api and lands on `/dashboard` (T-10, T-16)
- [x] Dashboard shows tenant count + byStatus breakdown + generatedAt (T-18, T-20)
- [x] Page reload rehydrates session via `GET /auth/me` without spurious logout (T-10, T-14)
- [x] Unauthenticated visit to `/dashboard` redirects to `/auth/sign-in` (T-11, T-12)
- [x] `GET /api/auth/me` returns 401 without valid operator session (T-01, T-02)
- [x] No InmoView calls from viewpro-web — Design-B isolation confirmed (T-06, T-21)
- [x] `ACCESS_TOKEN_SECRET` absent from all viewpro-web source files (T-11, T-21)
- [x] Empty metrics state (tenants === 0) renders without error (T-19, T-20)
- [x] Sign-up link absent from sign-in page (T-16)
