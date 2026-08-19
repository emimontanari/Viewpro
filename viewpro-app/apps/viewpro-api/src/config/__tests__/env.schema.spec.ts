import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../env.schema'

const VALID_SECRET = 'a-sufficiently-long-secret'
const VALID_CONTROL_SECRET = 'a-sufficiently-long-control-secret'
const VALID_INMOVIEW_URL = 'http://localhost:3001'

const VALID_STEP_UP_SECRET = 'a-sufficiently-long-step-up-secret'

const VALID_BASE = {
  ACCESS_TOKEN_SECRET: VALID_SECRET,
  PLATFORM_CONTROL_SECRET: VALID_CONTROL_SECRET,
  INMOVIEW_API_INTERNAL_URL: VALID_INMOVIEW_URL,
  STEP_UP_TOKEN_SECRET: VALID_STEP_UP_SECRET,
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

  it('rejects a missing STEP_UP_TOKEN_SECRET (required, no default)', () => {
    const { STEP_UP_TOKEN_SECRET: _, ...rest } = VALID_BASE
    expect(() => validateEnv(rest)).toThrow(/STEP_UP_TOKEN_SECRET/)
  })

  it('rejects a STEP_UP_TOKEN_SECRET shorter than 16 chars', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, STEP_UP_TOKEN_SECRET: 'too-short' }),
    ).toThrow(/STEP_UP_TOKEN_SECRET/)
  })

  it('STEP_UP_TTL_SECONDS omitted defaults to 300', () => {
    const config = validateEnv(VALID_BASE) as unknown as { STEP_UP_TTL_SECONDS: number }
    expect(config.STEP_UP_TTL_SECONDS).toBe(300)
  })

  it('rejects a STEP_UP_TTL_SECONDS below the 60-second floor', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, STEP_UP_TTL_SECONDS: 10 }),
    ).toThrow(/STEP_UP_TTL_SECONDS/)
  })

  it('rejects STEP_UP_TOKEN_SECRET equal to ACCESS_TOKEN_SECRET (cross-token isolation)', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, STEP_UP_TOKEN_SECRET: VALID_SECRET }),
    ).toThrow(/STEP_UP_TOKEN_SECRET.*ACCESS_TOKEN_SECRET|ACCESS_TOKEN_SECRET.*STEP_UP_TOKEN_SECRET/)
  })

  it('rejects PLATFORM_CONTROL_SECRET equal to ACCESS_TOKEN_SECRET', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, PLATFORM_CONTROL_SECRET: VALID_SECRET }),
    ).toThrow(/ACCESS_TOKEN_SECRET.*PLATFORM_CONTROL_SECRET|PLATFORM_CONTROL_SECRET.*ACCESS_TOKEN_SECRET/)
  })

  it('rejects PLATFORM_CONTROL_SECRET equal to STEP_UP_TOKEN_SECRET', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, PLATFORM_CONTROL_SECRET: VALID_STEP_UP_SECRET }),
    ).toThrow(/STEP_UP_TOKEN_SECRET.*PLATFORM_CONTROL_SECRET|PLATFORM_CONTROL_SECRET.*STEP_UP_TOKEN_SECRET/)
  })

  it('accepts all three auth/control secrets when pairwise distinct', () => {
    expect(() => validateEnv(VALID_BASE)).not.toThrow()
  })

  it('IDLE_TIMEOUT_SECONDS omitted defaults to 600', () => {
    const config = validateEnv(VALID_BASE) as unknown as { IDLE_TIMEOUT_SECONDS: number }
    expect(config.IDLE_TIMEOUT_SECONDS).toBe(600)
  })

  it('ABSOLUTE_SESSION_SECONDS omitted defaults to 28800', () => {
    const config = validateEnv(VALID_BASE) as unknown as { ABSOLUTE_SESSION_SECONDS: number }
    expect(config.ABSOLUTE_SESSION_SECONDS).toBe(28800)
  })

  it('rejects an IDLE_TIMEOUT_SECONDS below the 60-second floor', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, IDLE_TIMEOUT_SECONDS: 10 }),
    ).toThrow(/IDLE_TIMEOUT_SECONDS/)
  })

  it('rejects an ABSOLUTE_SESSION_SECONDS below the 300-second floor', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, ABSOLUTE_SESSION_SECONDS: 100 }),
    ).toThrow(/ABSOLUTE_SESSION_SECONDS/)
  })

  it('rejects ABSOLUTE_SESSION_SECONDS <= IDLE_TIMEOUT_SECONDS (window-order boot guard)', () => {
    expect(() =>
      validateEnv({
        ...VALID_BASE,
        IDLE_TIMEOUT_SECONDS: 600,
        ABSOLUTE_SESSION_SECONDS: 600,
      }),
    ).toThrow(/ABSOLUTE_SESSION_SECONDS.*IDLE_TIMEOUT_SECONDS|IDLE_TIMEOUT_SECONDS.*ABSOLUTE_SESSION_SECONDS/)
  })

  it('rejects STEP_UP_TOKEN_SECRET equal to ACCESS_TOKEN_SECRET (assertDistinctSecrets regression pin)', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, STEP_UP_TOKEN_SECRET: VALID_SECRET }),
    ).toThrow(/STEP_UP_TOKEN_SECRET.*ACCESS_TOKEN_SECRET|ACCESS_TOKEN_SECRET.*STEP_UP_TOKEN_SECRET/)
  })

  it('rejects COOKIE_SECURE not true in production (assertProductionSecurity)', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, NODE_ENV: 'production' }),
    ).toThrow(/COOKIE_SECURE/)
  })

  it('accepts a hardened production config with COOKIE_SECURE=true', () => {
    expect(() =>
      validateEnv({ ...VALID_BASE, NODE_ENV: 'production', COOKIE_SECURE: 'true' }),
    ).not.toThrow()
  })

  // Slice D (#327): the timer this interval configured is retired — demand
  // is authenticated-console-triggered only. Pin the field's removal so a
  // later change cannot silently reintroduce a polling interval knob.
  it('no longer defines PLATFORM_POLL_INTERVAL_MS (timer retired, Slice D)', () => {
    const config = validateEnv(VALID_BASE) as unknown as Record<string, unknown>
    expect(config.PLATFORM_POLL_INTERVAL_MS).toBeUndefined()
  })
})
