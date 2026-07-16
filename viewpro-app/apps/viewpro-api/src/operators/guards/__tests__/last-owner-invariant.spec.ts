import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { UnprocessableEntityException } from '@nestjs/common'
import { ConfigModule } from '../../../config/config.module'
import { DatabaseModule } from '../../../database/database.module'
import { PrismaService } from '../../../database/prisma.service'
import { assertNotLastActiveOwner } from '../last-owner-invariant'

/**
 * T1.2.3 — RED: `assertNotLastActiveOwner(tx, targetId)` — rejects (422) when
 * excluding `targetId` from the ACTIVE-OWNER set would leave zero ACTIVE
 * OWNERs, run inside a `prisma.$transaction` + `SELECT ... FOR UPDATE`
 * (platform-operator-management, Decision 2).
 */
describe('assertNotLastActiveOwner (T1.2.3)', () => {
  let moduleRef: TestingModule
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
    }).compile()

    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.operator.deleteMany({ where: { email: { contains: 'last-owner-invariant-test' } } })
  })

  async function seedOwner(email: string, status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    return prisma.operator.create({
      data: { email, passwordHash: '$argon2id$fakehash', role: 'OWNER', status },
    })
  }

  // The ACTIVE-OWNER set is genuinely global (production reality), and other
  // test suites/seed scripts leave real OWNER fixtures in this DB. To test
  // the "sole owner" scenario in isolation, every OTHER active OWNER is
  // suspended INSIDE the same transaction as the assertion. The assertion
  // throws (LAST_OWNER_PROTECTED), which aborts the transaction — so the
  // temporary suspension of unrelated OWNER fixtures is always rolled back,
  // never committed.
  it('rejects with UnprocessableEntityException when the target is the ONLY active OWNER', async () => {
    const lastOwner = await seedOwner('last-owner-invariant-test-sole@viewpro.app')

    const error = await prisma
      .$transaction(async (tx) => {
        await tx.operator.updateMany({
          where: { role: 'OWNER', status: 'ACTIVE', id: { not: lastOwner.id } },
          data: { status: 'SUSPENDED' },
        })
        await assertNotLastActiveOwner(tx, lastOwner.id)
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
  })

  it('resolves without throwing when at least one OTHER active OWNER remains', async () => {
    const ownerA = await seedOwner('last-owner-invariant-test-a@viewpro.app')
    await seedOwner('last-owner-invariant-test-b@viewpro.app')

    await expect(
      prisma.$transaction((tx) => assertNotLastActiveOwner(tx, ownerA.id)),
    ).resolves.toBeUndefined()
  })

  it('a SUSPENDED owner is not counted as active — targeting the sole ACTIVE owner still rejects even if a SUSPENDED owner exists', async () => {
    const activeOwner = await seedOwner('last-owner-invariant-test-active@viewpro.app')
    await seedOwner('last-owner-invariant-test-suspended@viewpro.app', 'SUSPENDED')

    const error = await prisma
      .$transaction(async (tx) => {
        await tx.operator.updateMany({
          where: { role: 'OWNER', status: 'ACTIVE', id: { not: activeOwner.id } },
          data: { status: 'SUSPENDED' },
        })
        await assertNotLastActiveOwner(tx, activeOwner.id)
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
  })
})
