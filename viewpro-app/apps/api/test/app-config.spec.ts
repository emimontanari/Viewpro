import { describe, expect, it } from 'vitest'
import { getSentryConfig, parseCorsOrigins } from '../src/config/app.config'

describe('app configuration', () => {
  it('requires explicit CORS origins in production', () => {
    expect(() => parseCorsOrigins(undefined, 'production')).toThrow(
      'CORS_ORIGIN must contain explicit origins in production',
    )
    expect(() => parseCorsOrigins('', 'production')).toThrow('CORS_ORIGIN must contain explicit origins in production')
  })

  it('rejects production CORS wildcard and empty origin entries', () => {
    expect(() => parseCorsOrigins('*', 'production')).toThrow('CORS_ORIGIN must contain explicit origins in production')
    expect(() => parseCorsOrigins('https://*.viewpro.example', 'production')).toThrow(
      'CORS_ORIGIN must contain explicit origins in production',
    )
    expect(() => parseCorsOrigins('https://app.viewpro.example,', 'production')).toThrow(
      'CORS_ORIGIN must contain explicit origins in production',
    )
  })

  it('keeps the local CORS default outside production', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual(['http://localhost:3000'])
    expect(parseCorsOrigins(undefined, 'test')).toEqual(['http://localhost:3000'])
  })

  it('keeps Sentry disabled by default with zero tracing', () => {
    expect(getSentryConfig('development', {})).toEqual({
      dsn: undefined,
      environment: 'development',
      tracesSampleRate: 0,
    })
  })

  it('uses explicit Sentry environment and bounded trace sample rate', () => {
    expect(
      getSentryConfig('production', {
        SENTRY_DSN: 'https://public.example/1',
        SENTRY_ENVIRONMENT: 'staging',
        SENTRY_TRACES_SAMPLE_RATE: '0.25',
      }),
    ).toEqual({
      dsn: 'https://public.example/1',
      environment: 'staging',
      tracesSampleRate: 0.25,
    })

    expect(() => getSentryConfig('production', { SENTRY_TRACES_SAMPLE_RATE: '1.5' })).toThrow(
      'SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1',
    )
  })
})
