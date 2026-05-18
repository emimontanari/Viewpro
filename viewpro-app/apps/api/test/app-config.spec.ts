import { describe, expect, it } from 'vitest'
import { parseCorsOrigins } from '../src/config/app.config'

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
})
