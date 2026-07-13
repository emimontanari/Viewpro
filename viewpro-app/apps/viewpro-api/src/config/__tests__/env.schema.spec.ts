import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../env.schema'

const VALID_SECRET = 'a-sufficiently-long-secret'
const VALID_CONTROL_SECRET = 'a-sufficiently-long-control-secret'
const VALID_INMOVIEW_URL = 'http://localhost:3001'

const VALID_BASE = {
  ACCESS_TOKEN_SECRET: VALID_SECRET,
  PLATFORM_CONTROL_SECRET: VALID_CONTROL_SECRET,
  INMOVIEW_API_INTERNAL_URL: VALID_INMOVIEW_URL,
}

describe('validateEnv', () => {
  it('accepts a config with all required secrets and URL', () => {
    expect(() => validateEnv(VALID_BASE)).not.toThrow()
  })

  it('rejects a config with no ACCESS_TOKEN_SECRET (required, no default)', () => {
    expect(() => validateEnv({})).toThrow(/ACCESS_TOKEN_SECRET/)
  })

  it('rejects an ACCESS_TOKEN_SECRET shorter than 16 chars', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, ACCESS_TOKEN_SECRET: 'too-short' }),
    ).toThrow(/ACCESS_TOKEN_SECRET/)
  })

  it('rejects a missing PLATFORM_CONTROL_SECRET', () => {
    const { PLATFORM_CONTROL_SECRET: _, ...rest } = VALID_BASE
    expect(() => validateEnv(rest)).toThrow(/PLATFORM_CONTROL_SECRET/)
  })

  it('rejects a PLATFORM_CONTROL_SECRET shorter than 16 chars', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, PLATFORM_CONTROL_SECRET: 'short' }),
    ).toThrow(/PLATFORM_CONTROL_SECRET/)
  })

  it('rejects a missing INMOVIEW_API_INTERNAL_URL', () => {
    const { INMOVIEW_API_INTERNAL_URL: _, ...rest } = VALID_BASE
    expect(() => validateEnv(rest)).toThrow(/INMOVIEW_API_INTERNAL_URL/)
  })
})
