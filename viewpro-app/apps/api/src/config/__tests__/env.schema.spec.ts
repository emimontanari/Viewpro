import 'reflect-metadata'
import { describe, expect, it } from 'vitest'
import { validateEnv } from '../env.schema'

// ---------------------------------------------------------------------------
// Spec: Production security hardening of env validation
// Two P0 config risks + one belt-and-suspenders guard, enforced ONLY when
// NODE_ENV=production so local dev and the test suite keep their defaults:
//   - ACCESS_TOKEN_SECRET must be present, not the placeholder, and >= 32 chars
//     (a weak/known session secret lets anyone forge tokens for any tenant)
//   - COOKIE_SECURE must be true (session cookies must not travel unencrypted)
//   - DOCUMENT_STORAGE_DRIVER must be 's3' (no local/fake storage in prod)
// ---------------------------------------------------------------------------

const STRONG_SECRET = 'a'.repeat(32)

// Minimal config that already satisfies the always-on field constraints.
const baseValid = {
  PLATFORM_CONTROL_SECRET: 'platform-secret-at-least-16',
}

const productionHardened = {
  ...baseValid,
  NODE_ENV: 'production',
  ACCESS_TOKEN_SECRET: STRONG_SECRET,
  COOKIE_SECURE: 'true',
  DOCUMENT_STORAGE_DRIVER: 's3',
}

describe('validateEnv — non-production', () => {
  it('accepts the default weak secret and insecure cookies in development', () => {
    // Defaults (placeholder ACCESS_TOKEN_SECRET, COOKIE_SECURE=false) must keep
    // working outside production so local dev and tests are unaffected.
    expect(() => validateEnv({ ...baseValid, NODE_ENV: 'development' })).not.toThrow()
  })

  it('accepts defaults under NODE_ENV=test', () => {
    expect(() => validateEnv({ ...baseValid, NODE_ENV: 'test' })).not.toThrow()
  })

  const publicErrorEnvelopeStates = [
    [undefined, false],
    ['false', false],
    ['true', true],
  ] as const

  it.each(publicErrorEnvelopeStates)(
    'resolves PUBLIC_ERROR_ENVELOPE_ENABLED=%s to %s',
    (value, expected) => {
      const config = {
        ...baseValid,
        ...(value === undefined ? {} : { PUBLIC_ERROR_ENVELOPE_ENABLED: value }),
      }

      expect(validateEnv(config).PUBLIC_ERROR_ENVELOPE_ENABLED).toBe(expected)
    },
  )

  it('rejects an invalid public error envelope value', () => {
    expect(() => validateEnv({ ...baseValid, PUBLIC_ERROR_ENVELOPE_ENABLED: 'enabled' })).toThrow(
      /PUBLIC_ERROR_ENVELOPE_ENABLED/,
    )
  })
})

describe('validateEnv — production hardening', () => {
  it('accepts a fully hardened production config', () => {
    expect(() => validateEnv(productionHardened)).not.toThrow()
  })

  it('rejects the placeholder ACCESS_TOKEN_SECRET in production', () => {
    expect(() =>
      validateEnv({ ...productionHardened, ACCESS_TOKEN_SECRET: 'change-me-in-real-env' }),
    ).toThrow(/ACCESS_TOKEN_SECRET/)
  })

  it('rejects a short ACCESS_TOKEN_SECRET in production', () => {
    expect(() =>
      validateEnv({ ...productionHardened, ACCESS_TOKEN_SECRET: 'too-short' }),
    ).toThrow(/ACCESS_TOKEN_SECRET/)
  })

  it('rejects COOKIE_SECURE=false in production', () => {
    expect(() =>
      validateEnv({ ...productionHardened, COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/)
  })

  it('rejects a non-s3 document storage driver in production', () => {
    expect(() =>
      validateEnv({ ...productionHardened, DOCUMENT_STORAGE_DRIVER: 'local' }),
    ).toThrow(/DOCUMENT_STORAGE_DRIVER/)
  })

  it('reports every production violation at once', () => {
    expect(() =>
      validateEnv({
        ...baseValid,
        NODE_ENV: 'production',
        ACCESS_TOKEN_SECRET: 'change-me-in-real-env',
        COOKIE_SECURE: 'false',
        DOCUMENT_STORAGE_DRIVER: 'local',
      }),
    ).toThrow(/ACCESS_TOKEN_SECRET.*COOKIE_SECURE.*DOCUMENT_STORAGE_DRIVER/s)
  })
})
