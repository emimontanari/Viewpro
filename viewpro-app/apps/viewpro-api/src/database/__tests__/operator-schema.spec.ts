import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma-platform/client'

describe('Operator schema shape', () => {
  it('contains exactly the required fields and no extras', () => {
    const fields = Prisma.dmmf.datamodel.models
      .find((m) => m.name === 'Operator')
      ?.fields.map((f) => f.name)

    expect(fields).toBeDefined()

    const expected = ['id', 'email', 'passwordHash', 'status', 'createdAt', 'updatedAt']
    expect(fields?.sort()).toEqual(expected.sort())

    // Guardrails: fields that must NOT exist in this slice
    expect(fields).not.toContain('role')
    expect(fields).not.toContain('refreshToken')
    expect(fields).not.toContain('invitedBy')
  })
})
