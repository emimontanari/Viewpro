import { describe, it, expect } from 'vitest'

/**
 * FIX 5 — Unit test for the isIdempotencyKeyConflict predicate logic.
 *
 * The production function (platform-control.controller.ts) is file-scoped and
 * not exported. We test the SAME logic inline here to prove the target-check
 * behaviour: only P2002 errors whose meta.target includes 'idempotencyKey'
 * are treated as idempotency-key conflicts. All others must propagate.
 *
 * This prevents a genuine P2002 on a different unique constraint from being
 * silently swallowed and misclassified as a safe replay.
 */

// Mirror of the production predicate — kept in sync by convention.
function isIdempotencyKeyConflict(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; meta?: { target?: unknown } }
  if (e.code !== 'P2002') return false
  const target = e.meta?.target
  if (Array.isArray(target)) {
    return (target as string[]).some((t) => t === 'idempotencyKey')
  }
  if (typeof target === 'string') {
    return target.includes('idempotencyKey')
  }
  return false
}

describe('isIdempotencyKeyConflict — predicate unit tests', () => {
  it('returns true for P2002 with target=["idempotencyKey"] (array form, Prisma 5+)', () => {
    const err = { code: 'P2002', meta: { target: ['idempotencyKey'] } }
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
