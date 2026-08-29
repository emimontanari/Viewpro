import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertSafeTestDatabaseUrl } from '../src/database/test-database-url.guard'
import { currentPoolId, workerDatabaseUrl } from './worker-databases'

process.env.VIEWPRO_TEST_RUN = 'true'
process.env.NODE_ENV = 'test'

// Delete any InmoView-specific DB env vars to enforce isolation
delete process.env.INMV_DATABASE_URL

loadEnvFile(resolve(process.cwd(), '.env.test'))

// Each worker gets its own database, prepared by test/global-setup.ts. Suites
// clean shared tables between cases, so they must not share one.
process.env.DATABASE_URL = workerDatabaseUrl(currentPoolId())
// No separate pooler in dev/test — migrations use the same connection.
process.env.DIRECT_URL = process.env.DATABASE_URL
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-token-secret'
process.env.STEP_UP_TOKEN_SECRET ??= 'test-step-up-token-secret-min16'
process.env.COOKIE_DOMAIN ??= 'localhost'
process.env.COOKIE_SECURE ??= 'false'
process.env.PLATFORM_CONTROL_SECRET ??= 'test-platform-control-secret-min16'
process.env.INMOVIEW_API_INTERNAL_URL ??= 'http://localhost:3001'

assertSafeTestDatabaseUrl()

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return
  }

  const file = readFileSync(filePath, 'utf8')

  for (const line of file.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim())

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}
