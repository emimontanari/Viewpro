import { defineConfig, devices } from '@playwright/test'

const smokeTestPort = 3100
const smokeTestBaseUrl = `http://127.0.0.1:${smokeTestPort}`

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: smokeTestBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${smokeTestPort}`,
    url: smokeTestBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
