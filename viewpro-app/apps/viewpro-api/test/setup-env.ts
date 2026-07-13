import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertSafeTestDatabaseUrl } from '../src/database/test-database-url.guard'

process.env.VIEWPRO_TEST_RUN = 'true'
process.env.NODE_ENV = 'test'

// Delete any InmoView-specific DB env vars to enforce isolation
delete process.env.INMV_DATABASE_URL

loadEnvFile(resolve(process.cwd(), '.env.test'))

process.env.DATABASE_URL ??=
  'postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test'
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-token-secret'
process.env.COOKIE_DOMAIN ??= 'localhost'
process.env.COOKIE_SECURE ??= 'false'

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
