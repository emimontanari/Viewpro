import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma-platform/client'

const prisma = new PrismaClient()

/**
 * Pins the least-privilege guarantee (JD hardening): an Operator row inserted
 * WITHOUT an explicit role must fall back to the DB column default, which is
 * ANALYST — never the privilege-maximizing OWNER. Any future operator-creation
 * path (e.g. the planned A4 invite flow) that omits `role` therefore gets the
 * lowest-privilege role by default, matching the change's fail-closed posture.
 */
describe('Operator.role DB default (least-privilege)', () => {
  const email = 'role-default-probe@viewpro.app'

  beforeAll(async () => {
    await prisma.operator.deleteMany({ where: { email } })
  })

  afterAll(async () => {
    await prisma.operator.deleteMany({ where: { email } })
    await prisma.$disconnect()
  })

  it('a row inserted without an explicit role defaults to ANALYST', async () => {
    const created = await prisma.operator.create({
      // role intentionally omitted — the DB column default must apply.
      data: {
        email,
        passwordHash: 'unused-hash',
        status: 'ACTIVE',
      },
    })

    const readBack = await prisma.operator.findUniqueOrThrow({
      where: { id: created.id },
    })

    expect(readBack.role).toBe('ANALYST')
  })
})
