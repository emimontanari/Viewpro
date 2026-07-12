# Existing Owner Invitation Acceptance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an already-registered owner accept a new property/agency invitation without duplicate users or manual database work.

**Architecture:** Reuse the team invitation `register | login | current-session` acceptance model for owner invitations. Keep `PropertyAssetOwner` as the owner/property access record, link existing users to the invited owner row, and preserve the current new-owner registration flow.

**Tech Stack:** NestJS 11, Prisma, Vitest/Supertest, Next.js app-new, React Testing Library, Playwright seeded smoke.

---

## Task 1: API RED for existing owner acceptance

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts`

**Step 1: Write failing tests**

Add tests that prove:

- existing owner email can accept by login password;
- user count for that email remains `1`;
- invited `PropertyAssetOwner` becomes `ACTIVE` and points to the existing user;
- invitation becomes `ACCEPTED`;
- owner can access the property through `/api/owner/properties`;
- wrong password returns `401` and leaves invitation pending;
- current-session with another email returns forbidden/unauthorized and leaves invitation pending.

**Step 2: Run RED**

```bash
cd viewpro-app
DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' \
APP_PUBLIC_URL='http://localhost:3000' \
pnpm --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

Expected: FAIL on existing-owner acceptance because current code returns `409 Owner email is already registered`.

---

## Task 2: Backend DTO/use-case/repository implementation

**Files:**
- Modify: `viewpro-app/apps/api/src/owner-invitations/dto/accept-owner-invitation.dto.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.controller.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/use-cases/accept-owner-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/use-cases/validate-owner-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/prisma-owner-invitations.repository.ts`

**Step 1: Extend accept DTO**

Support:

```ts
mode: 'register' | 'login' | 'current-session'
```

Keep register fields backward-compatible so existing clients without `mode` still behave as register if needed.

**Step 2: Extend validation response**

Add `emailRegistered: boolean` based on lowercased invitation email.

**Step 3: Implement login/current-session acceptance**

- `login`: verify password for user matching invitation email, then accept.
- `current-session`: require current user and matching email, then accept.
- wrong email/session: reject without activating anything.
- new register flow remains unchanged.

**Step 4: Run GREEN**

Use the Task 1 command. Expected: PASS.

---

## Task 3: Frontend API/types RED and implementation

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner-invitations/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner-invitations/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.tsx`

**Step 1: Write failing UI tests**

Add tests for:

- `emailRegistered: true` shows password form, not create-account fields;
- password submit calls API with `{ mode: 'login', password }`;
- matching current session shows direct accept button and sends `{ mode: 'current-session' }`;
- different current session shows switch-account guidance and does not call accept.

**Step 2: Run RED**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: FAIL because the component currently only supports create-account acceptance and a 409 guidance state.

**Step 3: Implement UI**

- Extend invitation type with `emailRegistered`.
- Extend accept input union with `mode`.
- Render registered-email password/current-session/different-session states.
- Keep current new-owner form for unregistered emails.

**Step 4: Run GREEN**

Use the Task 3 command. Expected: PASS.

---

## Task 4: Seeded proof and validation update

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`
- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`
- Modify: `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md` only if evidence matrix changes materially.
- Optionally modify: `docs/plans/README.md` to move next slice to 21.6 after completion.

**Step 1: Add seeded existing-owner invite fixture**

Seed a deterministic pending owner invitation for `propietario.demo@viewpro.local` on `Casa luminosa con patio en Los Boulevares` with token `seeded-existing-owner-invitation-token`.

**Step 2: Add seeded smoke proof**

Open `/owner-invitations/seeded-existing-owner-invitation-token`, accept with the existing owner password, land in `/owner`, and verify `/api/owner/properties` includes both the original owner property and the newly linked property.

**Step 3: Run targeted checks**

```bash
cd viewpro-app
DATABASE_URL='postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' \
APP_PUBLIC_URL='http://localhost:3000' \
pnpm --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts

pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx
```

Expected: PASS.

**Step 4: Run seeded proof**

```bash
cd viewpro-app
APP_PUBLIC_URL='http://127.0.0.1:3100' \
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3101 \
VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3100 \
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Expected: PASS with the existing-owner owner invitation smoke included.

**Step 5: Run broader safety checks**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter next-shadcn-dashboard-starter lint:strict
pnpm --filter next-shadcn-dashboard-starter test -- --runInBand
```

If `--runInBand` is unsupported, run the package test command without it.

**Step 6: Commit work unit**

Only commit after explicit user approval.

Suggested message:

```bash
git commit -m "feat(owner-invitations): accept existing owner invitations"
```
