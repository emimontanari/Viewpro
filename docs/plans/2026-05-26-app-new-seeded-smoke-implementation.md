# App-new Seeded Smoke Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add app-new seeded authenticated smoke coverage for the main demo flow.

**Architecture:** Use Playwright in `apps/app-new` with a dedicated seeded config. The config starts the API and app-new dev server with a shared auth secret, runs `pnpm demo:seed` in global setup, then executes serial UI smoke tests against the real sign-in/dashboard flows.

**Tech Stack:** Next.js 16, React 19, Playwright, NestJS API, pnpm workspace, existing `pnpm demo:seed` script.

---

### Task 1: Add Playwright dependency and scripts

**Files:**
- Modify: `viewpro-app/apps/app-new/package.json`
- Modify: `viewpro-app/apps/app-new/vitest.config.ts`
- Modify: `viewpro-app/pnpm-lock.yaml`

**Step 1: Add app-new Playwright dependency**

Run:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter add -D @playwright/test@1.57.0
```

Expected: `apps/app-new/package.json` gains `@playwright/test` in `devDependencies` and `pnpm-lock.yaml` updates.

**Step 2: Add seeded test script**

In `apps/app-new/package.json`, add:

```json
"test:seeded": "playwright test --config playwright.seeded.config.ts"
```

Expected: `pnpm --filter next-shadcn-dashboard-starter test:seeded --help` can resolve the script.

**Step 3: Keep Vitest focused on unit/component tests**

In `apps/app-new/vitest.config.ts`, exclude `tests/seeded/**` so `pnpm --filter next-shadcn-dashboard-starter test` does not collect Playwright specs.

---

### Task 2: Add app-new seeded Playwright config

**Files:**
- Create: `viewpro-app/apps/app-new/playwright.seeded.config.ts`

**Step 1: Create config**

Create a config that:

- imports `defineConfig` and `devices` from `@playwright/test`;
- imports `randomUUID` from `node:crypto`;
- uses host `127.0.0.1`;
- defaults API port to `3001` and app-new port to `3100`;
- supports env overrides:
  - `VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT`
  - `VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT`
  - `VIEWPRO_APP_NEW_SEEDED_E2E_ACCESS_TOKEN_SECRET`
- starts API with `NODE_ENV=development`, `PORT`, `CORS_ORIGIN`, `COOKIE_SECURE=false`, and shared `ACCESS_TOKEN_SECRET`; this suite uses the demo seed against a safe local/dev database instead of the API's strict test-database guard;
- starts app-new with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, and shared `ACCESS_TOKEN_SECRET`;
- sets `globalSetup` to `./tests/seeded/global-setup.ts`;
- sets `testDir` to `./tests/seeded`;
- sets `workers: 1`, `fullyParallel: false`, and trace on retry.

**Step 2: Validate config syntax**

Run:

```bash
cd viewpro-app/apps/app-new
pnpm exec tsc --noEmit --pretty false
```

Expected: no TypeScript errors from the new config.

---

### Task 3: Add seeded global setup

**Files:**
- Create: `viewpro-app/apps/app-new/tests/seeded/global-setup.ts`

**Step 1: Implement setup**

Use `node:child_process` `execFileSync` and `node:path` to run:

```bash
pnpm demo:seed
```

from the workspace root (`apps/app-new/tests/seeded` → `../../../..`). Forward stdio so seed failures are visible.

**Step 2: Validate setup manually**

Run:

```bash
cd viewpro-app/apps/app-new
pnpm exec tsx tests/seeded/global-setup.ts
```

If `tsx` is not available, skip direct execution and rely on Playwright invoking global setup.

---

### Task 4: Add seeded smoke spec

**Files:**
- Create: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Step 1: Write smoke test**

Create one serial test that:

1. visits `/auth/sign-in`;
2. fills `Email` with `demo@viewpro.local`;
3. fills `Contraseña` with `process.env.VIEWPRO_DEMO_PASSWORD ?? 'viewpro-demo-local'`;
4. clicks `Entrar`;
5. waits for `/dashboard`;
6. asserts `Inicio operativo de ViewPro Demo Inmobiliaria` is visible;
7. navigates to `/dashboard/product`;
8. asserts `Inventario de propiedades`, `20 gestiones inmobiliarias en total`, and a visible seeded title such as `Casa compacta en Funes` are visible;
9. opens that row's action menu and clicks `Ver detalle`;
10. asserts `Detalle de propiedad` and the property title are visible;
11. navigates to `/dashboard/seguimiento`;
12. asserts `Seguimiento`, `Últimas actualizaciones`, and either seeded movement/document text is visible.

Prefer role/label selectors. Avoid generated IDs.

**Step 2: Keep assertions stable**

Do not assert exact image counts, analytics counts, or generated URLs. The goal is route/data/auth coverage, not pixel-perfect UI verification.

---

### Task 5: Validate the slice

**Files:**
- All touched files.

Run:

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter test:seeded
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --filter @viewpro/api typecheck
git diff --check
```

Expected:

- Vitest app-new suite passes without collecting Playwright specs.
- Seeded Playwright smoke passes.
- app-new TypeScript check passes.
- API typecheck passes.
- Diff has no whitespace errors.

If `test:seeded` fails because ports are occupied, stop local servers on `3001`/`3100` or override ports with env vars and rerun.

---

### Task 6: Fresh review and PR readiness

**Files:**
- All touched files.

**Step 1: Run fresh review**

Ask a fresh reviewer to inspect the diff for:

- auth secret sharing;
- tenant selection/cookie behavior;
- DB mutation scope;
- brittle selectors;
- package/lock consistency.

**Step 2: Fix blockers only**

Apply only required fixes. Defer optional polish unless it protects the smoke test from flake.

**Step 3: Prepare PR**

Commit with:

```bash
git commit -m "test(app-new): add seeded smoke coverage"
```

Open a PR against `develop` with validation evidence.
