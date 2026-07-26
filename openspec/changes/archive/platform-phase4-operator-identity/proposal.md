# Proposal: Platform Phase 4 — ViewPro Operator Identity (viewpro-api skeleton + own DB)

Stand up the ViewPro platform API as a **separate NestJS app with its OWN Postgres DB** (`viewpro_platform`) and its OWN operator identity + login. This is the smallest Phase 4 slice: prove the physical Design B split by making operator sign-in work end-to-end against ViewPro's DB, with zero dependency on InmoView's DB.

## Locked decision (do NOT re-open)

**D-plat = Option 1 — ViewPro owns its own Operator identity store** (blueprint §3). `viewpro-api` gets its own `Operator` table, its own JWT, its own cookie name (`viewpro_platform_access_token`). Operator login MUST NOT touch InmoView's DB. This REVISES #4477 (which assumed ViewPro lived inside InmoView); topology decision #4484 invalidated that assumption. Guardrail 2: never inherit `viewpro_access_token`; own clearly-named DB + cookie.

## Intent

Today the only platform boundary is `GlobalAdminGuard`, DI-coupled to InmoView's `UsersRepository` (its product DB). Under Design B autonomy, ViewPro cannot depend on InmoView to log its operators in. Phase 4 breaks that coupling physically: a standalone `viewpro-api` with its own identity store. Success = an operator signs in against `viewpro_platform` and gets a ViewPro-branded, isolated cookie — the platform now owns its own front door.

## Scope

### In Scope
- Scaffold `viewpro-app/apps/viewpro-api/` — NestJS app mirroring `apps/api/` structure (bootstrap, config module + env schema, `/health` endpoint returning 200).
- Its own `prisma/schema.prisma` with an `Operator` model; its own `DATABASE_URL` → separate Postgres DB `viewpro_platform`.
- Operator auth module: sign-in endpoint issuing ViewPro's own JWT via a dedicated `TokenService`, setting cookie `viewpro_platform_access_token`; mirrors `apps/api/src/auth/` patterns (Argon2 hashing, httpOnly/sameSite/secure cookie options) but fully isolated.
- Seed/migration to bootstrap the first operator into `viewpro_platform`.
- Register the app in the workspace so turbo tasks (`build`/`dev`/`lint`/`typecheck`/`test`) apply (`pnpm-workspace.yaml` already globs `apps/*`; verify turbo picks it up).

### Out of Scope (defer to Phase 5/6)
- `viewpro-web` operator console (Phase 5).
- Wiring `@viewpro/platform-contract` into `viewpro-api` as a command handler (Phase 5).
- Migrating `apps/api/src/admin/` endpoints over the control lane; rewriting `GlobalAdminGuard` (Phase 5).
- The `/admin` middleware gap in `apps/app-new/src/proxy.ts` — noted prep item, not this slice.
- Data lane / outbox / metrics (Phase 6).
- **Executing** the one-time migration of existing `VIEWPRO_ADMIN` records out of InmoView's DB — planned here, lands as a follow-up task (see Dependencies).

## Capabilities

### New Capabilities
- `viewpro-operator-identity`: ViewPro's own `Operator` store, sign-in endpoint, JWT, and isolated cookie; plus the `viewpro-api` app skeleton (bootstrap, config, health) as the host. No dependency on InmoView's DB for operator login.

### Modified Capabilities
- None. `apps/api` (InmoView) is untouched; existing operator records stay put until the follow-up migration task.

## Approach

New independent NestJS app under `apps/viewpro-api`, cloned in shape (not content) from `apps/api`: config module with a `viewpro-api`-scoped env schema (own `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, cookie/TTL vars), a Prisma datasource pointing at `viewpro_platform`, a minimal `Operator` model (id, email, passwordHash, status, timestamps), a `/health` controller, and an `auth` module (`sign-in` use-case + `TokenService` with `ACCESS_TOKEN_COOKIE = 'viewpro_platform_access_token'`). A Prisma seed bootstraps operator #1. Isolation is enforced structurally: separate DB, separate JWT secret, separate cookie name.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/viewpro-api/**` | New | NestJS skeleton: bootstrap, config, health, auth, prisma |
| `apps/viewpro-api/prisma/schema.prisma` | New | `Operator` model + `viewpro_platform` datasource |
| `apps/viewpro-api/prisma/seed.ts` | New | Bootstrap first operator |
| `pnpm-workspace.yaml` / `turbo.json` | Verify/Modified | Ensure new app is in the workspace + turbo tasks apply |
| env / infra (`viewpro_platform` DB) | New | Separate Postgres DB provisioning |
| `apps/api/**`, InmoView DB `viewpro` | Untouched | Operator login must not reach this DB |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sequencing: roadmap recommends Phase 4 AFTER go-live (Track 1 hardening higher priority); user chose to advance now | Med | Sequencing note, not a blocker — user decision recorded; slice is additive and isolated, ships nothing to real tenants |
| Accidental reuse of `viewpro_access_token` cookie (collision across shared/related domains) | Med | Guardrail 2: dedicated cookie name asserted in spec + test; distinct JWT secret |
| Operator login silently hitting InmoView's DB | Med | Acceptance criterion + spec scenario: no `viewpro` DB dependency; separate `DATABASE_URL` proven by isolation test |
| Migrating existing `VIEWPRO_ADMIN` operators forgotten | Med | Explicit deferred follow-up task; seed covers first operator to unblock the slice |
| Duplicate/divergent auth code between two apps | Low | Mirror patterns now; extracting a shared auth package is a later refactor, not this slice |

## Rollback Plan

The slice is purely additive: a new app + a new DB, no change to InmoView or its data. Rollback = delete/disable `apps/viewpro-api`, drop the `viewpro_platform` DB, remove workspace registration. No InmoView migration, cookie, or enum change to undo. Existing `VIEWPRO_ADMIN` records remain untouched in InmoView.

## Dependencies

- Phase 3 `@viewpro/platform-contract` exists (present, not wired here).
- Infra: ability to provision a second Postgres DB `viewpro_platform` (local + deploy).
- Follow-up (separate task): one-time migration of existing `VIEWPRO_ADMIN` records from `viewpro` into `viewpro_platform`, then plan their removal from the product DB.

## Success Criteria

- [ ] `apps/viewpro-api` boots as a standalone NestJS app.
- [ ] `GET /health` returns 200.
- [ ] An operator can sign in against `viewpro_platform` and receive a valid session.
- [ ] The auth cookie is named `viewpro_platform_access_token` (NOT `viewpro_access_token`).
- [ ] Operator sign-in has zero dependency on InmoView's `viewpro` DB (isolated `DATABASE_URL`, own JWT secret).
- [ ] Prisma seed bootstraps the first operator into `viewpro_platform`.
- [ ] New app is included in the workspace and turbo tasks run against it.

## Open sub-questions (deferred to spec/design — deliberately not resolved here)

1. **Operator model shape**: minimal (`id, email, passwordHash, status`) vs. include role/name/invitedBy now? Blueprint mentions "existing operator invites others" (#4477) — is invite flow in this slice or a later one?
2. **Refresh token**: does the first slice include refresh-token rotation (mirroring `apps/api`) or access-token-only for the skeleton? Impacts DB tables and cookie count.
3. **Shared vs. duplicated auth code**: mirror-and-duplicate now (accepted) vs. extract a `@viewpro/auth-kit` package? Recommend duplicate now, refactor later — confirm in design.
4. **Migration timing**: does the `VIEWPRO_ADMIN` → `Operator` migration follow-up land before or after Phase 5 `/admin` cutover? Affects how long dual identity stores coexist.
5. **Cross-domain cookie scope**: exact `domain`/`sameSite` for `viewpro_platform_access_token` given viewpro-web (Phase 5) will consume it — design should pin this to avoid a later breaking change.
