import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd(), '../..');
const apiPort = Number(process.env.VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT ?? 3001);
const webPort = Number(process.env.VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT ?? 3100);
const host = '127.0.0.1';
const webBaseUrl = `http://${host}:${webPort}`;
const apiBaseUrl = `http://${host}:${apiPort}`;
const documentStorageRoot = resolve(workspaceRoot, 'apps/api/.document-storage-seeded');
const accessTokenSecret =
  process.env.VIEWPRO_APP_NEW_SEEDED_E2E_ACCESS_TOKEN_SECRET ?? 'app-new-seeded-auth-e2e-local';

export default defineConfig({
  testDir: './tests/seeded',
  globalSetup: './tests/seeded/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry'
  },
  webServer: [
    {
      // AUTH_RATE_LIMIT_LOGIN_LIMIT=100: the seeded suite runs 22 tests with multiple sign-ins.
      // The default limit of 5 per 60s is too restrictive for a serial E2E run. This override
      // is scoped to the local dev test server only (NODE_ENV=development).
      command: `pnpm --filter @viewpro/api build && NODE_ENV=development PORT=${apiPort} CORS_ORIGIN=${webBaseUrl} COOKIE_SECURE=false ACCESS_TOKEN_SECRET=${accessTokenSecret} DOCUMENT_STORAGE_DRIVER=local DOCUMENT_STORAGE_LOCAL_ROOT=${documentStorageRoot} DOCUMENT_STORAGE_SIGNING_SECRET=${accessTokenSecret} API_PUBLIC_URL=${apiBaseUrl} AUTH_RATE_LIMIT_LOGIN_LIMIT=100 pnpm --filter @viewpro/api exec node dist/main.js`,
      cwd: workspaceRoot,
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: `ACCESS_TOKEN_SECRET=${accessTokenSecret} BFF_API_URL=${apiBaseUrl}/api NEXT_PUBLIC_API_URL=${apiBaseUrl}/api NEXT_PUBLIC_APP_URL=${webBaseUrl} pnpm --dir apps/app-new exec next dev --hostname ${host} --port ${webPort}`,
      cwd: workspaceRoot,
      url: webBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'app-new-seeded-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
