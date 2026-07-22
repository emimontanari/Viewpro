# ViewPro Operator Console Auth

`viewpro-web` talks only to `viewpro-api` (Design B isolation). It is an
**operator-only** console: there is no tenant, membership, or multi-org
concept on the frontend. It does not use any third-party template auth
provider.

## Session source

The session contract lives in `src/lib/session.ts`, backed by `viewpro-api`:

| Operation       | Function      | API endpoint       |
| ---------------- | ------------- | ------------------- |
| Login             | `login()`     | `POST /auth/login`  |
| Current session   | `getSession()`| `GET /auth/me`      |
| Logout            | `logout()`    | `POST /auth/logout` |
| Step-up (destructive actions) | `stepUp()` | `POST /auth/step-up` |

`Session` is `{ operator: { id, email } }` — no `user`, `memberships`, or
`globalRole` fields exist at runtime. There is no `POST /auth/register-tenant`
or `POST /auth/refresh` endpoint in this lane.

The API owns both cookies (access token + step-up token), sets/clears them as
httpOnly, and is the sole authority for validating a session — the frontend
never verifies a JWT itself.

## Client session state

`src/lib/session-context.tsx` provides:

- `session` — `Session | null`
- `isLoading`
- `signOut()`

`SessionProvider` rehydrates via `GET /auth/me` on mount (client-only, no
SSR). A failed rehydration redirects to `/auth/sign-in`. `signOut()` calls
`POST /auth/logout` best-effort, clears the React Query cache, and redirects
to `/auth/sign-in`.

## Session model: rolling idle timeout + absolute cap

The access token is a **rolling (sliding) session** with a hard absolute cap,
enforced entirely by `viewpro-api`'s `AuthGuard`:

- **Idle deadline** — the token's `exp` slides forward on authenticated
  activity, driven by `IDLE_TIMEOUT_SECONDS` (default 600s / 10 minutes). No
  activity for longer than that rejects the next request.
- **Absolute deadline** — a `sessionExp` claim minted at login
  (`now + ABSOLUTE_SESSION_SECONDS`, default 28800s / 8 hours) is carried
  forward byte-identical on every re-issue. Continuous activity cannot extend
  a session past it.

Either deadline alone is sufficient to reject a request with `401` — both the
access-token cookie and the step-up cookie are cleared on that response. The
step-up cookie has its own independent, fixed TTL (`STEP_UP_TTL_SECONDS`) and
is never extended or shortened by idle-timeout activity.

## Frontend 401 handling

`apiRequest` (in `src/lib/api-client.ts`) is the single funnel every
authenticated API call goes through, including the direct (non-React-Query)
`login()` call from the sign-in form. It treats a `401` as session expiry
and redirects to sign-in, **except** for the paths where a 401 means "bad
credentials on this attempt", not "expired session":

- `/auth/login` — wrong credentials stay inline on the sign-in form
- `/auth/step-up` — wrong step-up password stays inline in the step-up dialog
- `/auth/logout` — never redirects on logout itself

Any other `401` triggers `window.location.assign('/auth/sign-in?reason=session_expired&redirect_url=...')`
(a hard navigation, guaranteeing full client-state teardown). The sign-in
view reads `?reason=session_expired` and shows "Tu sesión expiró. Iniciá
sesión de nuevo para continuar." in the existing error `Alert`.

A `403` with `code: 'STEP_UP_REQUIRED'` is a different, unrelated flow (see
below) and is never treated as a `401` — the interceptor matches
`status === 401` only.

## Step-up re-authentication

Destructive operator actions require a fresh step-up: a `403
STEP_UP_REQUIRED` response opens a password-confirmation dialog
(`useStepUpGate`, `StepUpDialog`); on success the retried action proceeds. A
step-up failure (wrong password) is scoped to that dialog and never triggers
the session-expiry redirect or a logout.

## Route protection

`src/proxy.ts` performs a **presence-check only** — it does not verify the
JWT signature — before rendering protected app routes (`/dashboard*`). It
redirects unauthenticated requests to `/auth/sign-in` with a safe
`redirect_url`. Real authority is always `viewpro-api`'s `AuthGuard`, checked
on every protected request and on `GET /auth/me`.

This is not a replacement for backend authorization. API routes must still
enforce auth via `AuthGuard`.

## Do not add

- Third-party template auth packages or imports.
- Tenant, membership, or multi-org concepts — this console is operator-only.
- A frontend JWT verification step — `viewpro-api` is the sole authority.
- Client-only authorization as a security source of truth.
