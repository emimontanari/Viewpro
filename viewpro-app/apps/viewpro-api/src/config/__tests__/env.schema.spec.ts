import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../env.schema'

const VALID_SECRET = 'a-sufficiently-long-secret'

describe('validateEnv', () => {
  it('accepts a config with a strong ACCESS_TOKEN_SECRET', () => {
    expect(() => validateEnv({ ACCESS_TOKEN_SECRET: VALID_SECRET })).not.toThrow()
  })

  it('rejects a config with no ACCESS_TOKEN_SECRET (required, no default)', () => {
    expect(() => validateEnv({})).toThrow(/ACCESS_TOKEN_SECRET/)
  })

  it('rejects an ACCESS_TOKEN_SECRET shorter than 16 chars', () => {
    expect(() => validateEnv({ ACCESS_TOKEN_SECRET: 'too-short' })).toThrow(
      /ACCESS_TOKEN_SECRET/,
    )
  })
})
