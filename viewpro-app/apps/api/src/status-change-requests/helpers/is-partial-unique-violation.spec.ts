import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { isPartialUniqueViolation } from './is-partial-unique-violation'

const CONSTRAINT_NAME = 'status_change_requests_pending_engagement_key'

function makePrismaP2002(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  // PrismaClientKnownRequestError constructor: (message, { code, clientVersion, meta })
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta,
  })
}

describe('isPartialUniqueViolation', () => {
  it('returns true when meta.constraint matches the constraint name', () => {
    const err = makePrismaP2002({ constraint: CONSTRAINT_NAME })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(true)
  })

  it('returns true when meta.target array includes the constraint name', () => {
    const err = makePrismaP2002({ target: [CONSTRAINT_NAME] })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(true)
  })

  it('returns true when meta.target includes the constraint among multiple entries', () => {
    const err = makePrismaP2002({ target: ['other_constraint', CONSTRAINT_NAME] })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(true)
  })

  it('returns false when meta.constraint does not match', () => {
    const err = makePrismaP2002({ constraint: 'some_other_constraint' })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(false)
  })

  it('returns false when meta.target does not include the constraint name', () => {
    const err = makePrismaP2002({ target: ['some_other_constraint'] })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(false)
  })

  it('returns false for a non-P2002 Prisma error', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
      meta: {},
    })
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(false)
  })

  it('returns false for a generic Error (non-Prisma)', () => {
    const err = new Error('Something went wrong')
    expect(isPartialUniqueViolation(err, CONSTRAINT_NAME)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPartialUniqueViolation(null, CONSTRAINT_NAME)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPartialUniqueViolation(undefined, CONSTRAINT_NAME)).toBe(false)
  })
})
