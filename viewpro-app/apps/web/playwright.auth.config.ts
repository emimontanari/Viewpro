import { defineConfig, devices } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const apiPort = Number(process.env.VIEWPRO_SEEDED_E2E_API_PORT ?? 3001)
const webPort = Number(process.env.VIEWPRO_SEEDED_E2E_WEB_PORT ?? 3100)
const host = '127.0.0.1'
const webBaseUrl = `http://${host}:${webPort}`
const apiBaseUrl = `http://${host}:${apiPort}`
const accessTokenSecret = process.env.VIEWPRO_SEEDED_E2E_ACCESS_TOKEN_SECRET ?? `seeded-auth-e2e-${randomUUID()}`

export default defineConfig({
  testDir: './tests/auth',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `pnpm --filter @viewpro/api build && NODE_ENV=test PORT=${apiPort} CORS_ORIGIN=${webBaseUrl} COOKIE_SECURE=false ACCESS_TOKEN_SECRET=${accessTokenSecret} pnpm --filter @viewpro/api exec node dist/main.js`,
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
