import { describe, it, expect } from 'vitest'
import { isIdempotencyKeyConflict } from '../platform-control.controller'

/**
 * FIX 5 — Unit test for the EXPORTED isIdempotencyKeyConflict predicate.
 *
 * Only P2002 errors whose meta.target refers to the idempotencyKey unique
 * constraint are treated as idempotency-key conflicts; all others must
 * propagate so a genuine P2002 on a different constraint is not swallowed.
 */

describe('isIdempotencyKeyConflict — predicate unit tests', () => {
  it('returns true for P2002 with target=["idempotencyKey"] (array form, Prisma 5+)', () => {
    const err = { code: 'P2002', meta: { target: ['idempotencyKey'] } }
    expect(isIdempotencyKeyConflict(err)).toBe(true)
  })

  it('returns true for P2002 with target=["PlatformCommandLog_idempotencyKey_key"] (index-name form)', () => {
    const err = { code: 'P2002', meta: { target: ['PlatformCommandLog_idempotencyKey_key'] } }
    expect(isIdempotencyKeyConflict(err)).toBe(true)
  })

  it('returns true for P2002 with target="idempotencyKey" (string form, old Prisma)', () => {
    const err = { code: 'P2002', meta: { target: 'idempotencyKey' } }
    expect(isIdempotencyKeyConflict(err)).toBe(true)
  })

  it('returns false for P2002 on a DIFFERENT constraint (e.g. slug)', () => {
    const err = { code: 'P2002', meta: { target: ['slug'] } }
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for P2002 on a different constraint (string form)', () => {
    const err = { code: 'P2002', meta: { target: 'tenant_slug_unique' } }
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for P2002 with no meta.target (unknown constraint)', () => {
    const err = { code: 'P2002', meta: {} }
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for P2002 with no meta at all', () => {
    const err = { code: 'P2002' }
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for a non-P2002 Prisma error (P2025 record not found)', () => {
    const err = { code: 'P2025', meta: { target: ['idempotencyKey'] } }
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for a plain Error (not a Prisma error)', () => {
    const err = new Error('some runtime error')
    expect(isIdempotencyKeyConflict(err)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isIdempotencyKeyConflict(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isIdempotencyKeyConflict(undefined)).toBe(false)
  })
})
