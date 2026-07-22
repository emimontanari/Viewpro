import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assertSafeTestDatabaseUrl, isTestRuntime } from '../test-database-url.guard'

describe('assertSafeTestDatabaseUrl', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Ensure we are in test runtime so the guard runs
    process.env.VITEST = 'true'
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when DATABASE_URL points at the production viewpro_platform DB (no _test suffix)', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform',
      ),
    ).toThrow()
  })

  it('passes when DATABASE_URL points at viewpro_platform_test', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test',
      ),
    ).not.toThrow()
  })

  it('throws when DATABASE_URL points at the production viewpro DB', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://user:pass@localhost:5432/viewpro'),
    ).toThrow()
  })

  it('throws when DATABASE_URL is an empty string', () => {
    // Note: passing undefined uses the default param (process.env.DATABASE_URL).
    // Pass empty string to explicitly test missing-URL guard.
    expect(() => assertSafeTestDatabaseUrl('')).toThrow()
  })

  it('passes when DATABASE_URL points at viewpro_test', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://user:pass@localhost:5432/viewpro_test'),
    ).not.toThrow()
  })
})

describe('isTestRuntime', () => {
  it('returns true when VITEST is true', () => {
    expect(isTestRuntime({ VITEST: 'true' })).toBe(true)
  })

  it('returns true when NODE_ENV is test', () => {
    expect(isTestRuntime({ NODE_ENV: 'test' })).toBe(true)
  })

  it('returns false in production-like env', () => {
    expect(isTestRuntime({ NODE_ENV: 'production' })).toBe(false)
  })
})
