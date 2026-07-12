# Stage 11 Seeded Authenticated E2E Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic authenticated browser E2E infrastructure for ViewPro manager workspace and global admin flows.

**Architecture:** Keep existing public/mocked smoke tests unchanged and add a separate seeded Playwright runner. The seeded runner starts the real NestJS API and Next.js web app, creates deterministic Prisma fixtures, logs in through real httpOnly cookie auth, and runs serial tests against local Postgres.

**Tech Stack:** Next.js 16, React 19, Playwright 1.57, NestJS 11, Prisma 6, PostgreSQL, pnpm 10, Turbo.

---

## Constraints

- Do not make seeded E2E part of the default web `test` script.
- Do not store access or refresh tokens in localStorage.
- Only the manager flow may write `viewpro:selected-tenant:v1`.
- Admin tests must not send `x-tenant-id`.
- Keep seeded E2E serial until DB isolation is stronger.
- Do not commit unless the user explicitly approves.

## Task 1: Add seeded Playwright config and script

**Files:**
- Create: `viewpro-app/apps/web/playwright.auth.config.ts`
- Modify: `viewpro-app/apps/web/package.json`

**Step 1: Write the failing command expectation**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded
```

Expected: FAIL because `test:auth:seeded` does not exist.

**Step 2: Create seeded config**

Add `viewpro-app/apps/web/playwright.auth.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const apiPort = 3001
const webPort = 3100
const host = '127.0.0.1'
const webBaseUrl = `http://${host}:${webPort}`
const apiBaseUrl = `http://${host}:${apiPort}`

export default defineConfig({
  testDir: './tests/auth',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `NODE_ENV=test PORT=${apiPort} CORS_ORIGIN=${webBaseUrl} COOKIE_SECURE=false pnpm --filter @viewpro/api start:dev`,
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `NEXT_PUBLIC_API_URL=${apiBaseUrl}/api pnpm --filter @viewpro/web exec next dev --hostname ${host} --port ${webPort}`,
      url: webBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'seeded-auth-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

If `/api/health` does not exist, use the existing API root/Swagger route or add a test-only-safe health endpoint only after confirming it is already part of API conventions.

**Step 3: Add package script**

Modify `viewpro-app/apps/web/package.json`:

```json
"test:auth:seeded": "playwright test --config playwright.auth.config.ts"
```

Keep `"test": "pnpm test:smoke"` unchanged.

**Step 4: Verify the command starts looking for tests**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded
```

Expected: FAIL or no-test result because seeded auth tests do not exist yet, not because the script is missing.

## Task 2: Add deterministic seeded fixture helper

**Files:**
- Create: `viewpro-app/apps/web/tests/auth/seeded-auth-fixture.ts`

**Step 1: Write the helper with stable constants**

Create deterministic fixture constants:

```ts
import { randomUUID } from 'node:crypto'

const fixtureRunId = randomUUID()

function createRuntimeLoginValue(label: string) {
  return `seeded-auth-e2e-${label}-${fixtureRunId}`
}

export const seededAuthFixture = {
  tenant: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Aurora Propiedades Seeded',
    slug: 'aurora-seeded-e2e',
  },
  manager: {
    email: 'manager.seeded@viewpro.test',
    loginValue: createRuntimeLoginValue('manager'),
  },
  admin: {
    email: 'admin.seeded@viewpro.test',
    loginValue: createRuntimeLoginValue('admin'),
  },
} as const
```

Then implement:

```ts
export async function resetSeededAuthFixture() {
  // Instantiate PrismaClient.
  // Delete only deterministic seeded rows in FK-safe order.
  // Recreate tenant, users, memberships, property, engagement, movement,
  // document request, and analytics events.
  // Hash runtime-generated login values with argon2, matching the API login use case.
  // Disconnect Prisma in finally.
}
```

**Step 2: Keep cleanup narrow**

Cleanup must target seeded values only:

- `manager.seeded@viewpro.test`
- `admin.seeded@viewpro.test`
- `aurora-seeded-e2e`
- deterministic seeded IDs created by the helper

Do not add broad `deleteMany({})` cleanup from web tests.

**Step 3: Typecheck the helper**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web typecheck
```

Expected: PASS.

## Task 3: Add real login browser helper

**Files:**
- Create: `viewpro-app/apps/web/tests/auth/auth-browser.ts`

**Step 1: Implement API login helper**

Add a helper that logs in via Playwright request context:

```ts
import type { Page } from '@playwright/test'

export async function loginWithApi(page: Page, email: string, password: string) {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()}`)
  }
}
```

If Playwright request baseURL points to the web host instead of the API host, use the explicit API URL from the seeded config, for example `http://127.0.0.1:3001/api/auth/login`.

**Step 2: Implement selected tenant helper**

Add:

```ts
export async function selectSeededTenant(page: Page, tenantId: string) {
  await page.addInitScript((selectedTenantId) => {
    window.localStorage.setItem(
      'viewpro:selected-tenant:v1',
      JSON.stringify({
        selectedTenantId,
        updatedAt: new Date().toISOString(),
        version: 1,
      }),
    )
  }, tenantId)
}
```

**Step 3: Typecheck**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web typecheck
```

Expected: PASS.

## Task 4: Add manager workspace seeded E2E

**Files:**
- Create: `viewpro-app/apps/web/tests/auth/manager-workspace.spec.ts`

**Step 1: Write the failing test**

Create a test that:

```ts
import { expect, test } from '@playwright/test'
import { loginWithApi, selectSeededTenant } from './auth-browser'
import { resetSeededAuthFixture, seededAuthFixture } from './seeded-auth-fixture'

test.beforeAll(async () => {
  await resetSeededAuthFixture()
})

test('manager opens the seeded tenant workspace with real auth and tenant context', async ({ page }) => {
  const tenantHeaders: Array<string | undefined> = []

  page.on('request', (request) => {
    if (request.url().includes('/api/property-engagements') || request.url().includes('/api/analytics')) {
      tenantHeaders.push(request.headers()['x-tenant-id'])
    }
  })

  await loginWithApi(page, seededAuthFixture.manager.email, seededAuthFixture.manager.loginValue)
  await selectSeededTenant(page, seededAuthFixture.tenant.id)
  await page.goto('/dashboard')

  await expect(page.getByText('Aurora Propiedades Seeded')).toBeVisible()
  await expect.poll(() => tenantHeaders.some((header) => header === seededAuthFixture.tenant.id)).toBe(true)
})
```

Adjust route and visible assertions to the actual internal dashboard labels if needed. Do not assert implementation details that make the test brittle.

**Step 2: Run and confirm RED**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded -- manager-workspace.spec.ts
```

Expected: FAIL until fixture data and route assertions are correct.

**Step 3: Fix fixture and assertions minimally**

Use the existing Prisma schema names exactly. Keep the seeded records minimal.

**Step 4: Run and confirm GREEN**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded -- manager-workspace.spec.ts
```

Expected: PASS.

## Task 5: Add admin seeded E2E

**Files:**
- Create: `viewpro-app/apps/web/tests/auth/admin-backoffice.spec.ts`

**Step 1: Write the failing test**

Create a test that:

```ts
import { expect, test } from '@playwright/test'
import { loginWithApi } from './auth-browser'
import { resetSeededAuthFixture, seededAuthFixture } from './seeded-auth-fixture'

test.beforeAll(async () => {
  await resetSeededAuthFixture()
})

test('admin opens the real admin backoffice without tenant headers', async ({ page }) => {
  const adminTenantHeaders: Array<string | undefined> = []

  page.on('request', (request) => {
    if (request.url().includes('/api/admin/')) {
      adminTenantHeaders.push(request.headers()['x-tenant-id'])
    }
  })

  await loginWithApi(page, seededAuthFixture.admin.email, seededAuthFixture.admin.loginValue)
  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: 'Admin ViewPro' })).toBeVisible()
  await expect(page.getByText('Aurora Propiedades Seeded')).toBeVisible()
  await expect(page.getByText('Read-only v1')).toBeVisible()
  expect(adminTenantHeaders.length).toBeGreaterThan(0)
  expect(adminTenantHeaders.every((header) => header === undefined)).toBe(true)
})
```

**Step 2: Run and confirm RED/GREEN**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded -- admin-backoffice.spec.ts
```

Expected: PASS after fixture and API startup are correct.

## Task 6: Document Stage 11 Slice 1 usage

**Files:**
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Modify: `docs/plans/2026-05-18-viewpro-stage-11-seeded-auth-e2e-design.md`

**Step 1: Update roadmap**

Under Stage 11, add status text:

```markdown
Estado:

- Slice 1 implementado: runner Playwright seeded autenticado para manager workspace y Admin ViewPro, separado del smoke público/mockeado.
```

**Step 2: Add local run notes**

Document:

```bash
pnpm db:up
pnpm db:migrate
pnpm --filter @viewpro/web test:auth:seeded
```

Mention seeded E2E remains opt-in and serial.

## Task 7: Full verification

**Files:**
- No new files unless verification exposes a real issue.

**Step 1: Run targeted seeded tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/web test:auth:seeded
```

Expected: PASS.

**Step 2: Run normal web smoke tests**

```bash
cd viewpro-app
pnpm --filter @viewpro/web test
```

Expected: PASS.

**Step 3: Run typecheck/build**

```bash
cd viewpro-app
pnpm --filter @viewpro/web typecheck
pnpm --filter @viewpro/web build
pnpm typecheck
pnpm build
```

Expected: PASS.

**Step 4: Run root tests**

```bash
cd viewpro-app
pnpm test
```

Expected: PASS. This should not require seeded browser E2E because seeded E2E is opt-in.

**Step 5: Check whitespace**

```bash
git diff --check
```

Expected: PASS.

## Commit boundary

Only if the user explicitly authorizes it:

```bash
git add docs/plans/2026-05-13-viewpro-implementation-roadmap.md \
  docs/plans/2026-05-18-viewpro-stage-11-seeded-auth-e2e-design.md \
  docs/plans/2026-05-18-viewpro-stage-11-seeded-auth-e2e-implementation.md \
  viewpro-app/apps/web/package.json \
  viewpro-app/apps/web/playwright.auth.config.ts \
  viewpro-app/apps/web/tests/auth
git commit -m "test(web): add seeded authenticated e2e"
```

Do not push unless the user explicitly approves after the commit.
