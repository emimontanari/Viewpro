import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { UnprocessableEntityException } from '@nestjs/common'
import { ConfigModule } from '../../../config/config.module'
import { DatabaseModule } from '../../../database/database.module'
import { PrismaService } from '../../../database/prisma.service'
import { PrismaOperatorRepository } from '../../../auth/repositories/prisma-operator.repository'
import { withLastOwnerGuard } from '../last-owner-invariant'

/**
 * T1.2.5 — RED (integration, concurrency): proves Decision 2 (`FOR UPDATE`
 * row-lock serialization) against the REAL test Postgres, not a mocked unit
 * path. Two concurrent guarded status-changes targeting two DIFFERENT owners
 * from a 2-OWNER seed: exactly one call succeeds; the loser gets the 422
 * LAST_OWNER_PROTECTED rejection — NOT a DB deadlock/error.
 */
describe('withLastOwnerGuard — concurrency race safety (T1.2.5)', () => {
  let moduleRef: TestingModule
  let prisma: PrismaService
  let operatorRepo: PrismaOperatorRepository

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PrismaOperatorRepository],
    }).compile()

    prisma = moduleRef.get(PrismaService)
    operatorRepo = moduleRef.get(PrismaOperatorRepository)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.operator.deleteMany({ where: { email: { contains: 'last-owner-concurrency-test' } } })
  })

  it('two concurrent updateStatus(SUSPENDED) calls on two DIFFERENT owners from a 2-OWNER seed: exactly one succeeds, the loser is 422 (not a deadlock)', async () => {
    // Isolate: suspend every pre-existing global OWNER inside a throwaway
    // transaction is not viable here (we need the seeded pair to be the ONLY
    // active owners for the DURATION of the real concurrent calls, not just
    // one transaction). Suspend other global OWNERs directly, and restore
    // them afterwards, so this test's 2-OWNER seed is the complete active set.
    const otherActiveOwners = await prisma.operator.findMany({
      where: { role: 'OWNER', status: 'ACTIVE' },
      select: { id: true },
    })
    await prisma.operator.updateMany({
      where: { id: { in: otherActiveOwners.map((o) => o.id) } },
      data: { status: 'SUSPENDED' },
    })

    try {
      const ownerA = await prisma.operator.create({
        data: { email: 'last-owner-concurrency-test-a@viewpro.app', passwordHash: '$argon2id$fakehash', role: 'OWNER' },
      })
      const ownerB = await prisma.operator.create({
        data: { email: 'last-owner-concurrency-test-b@viewpro.app', passwordHash: '$argon2id$fakehash', role: 'OWNER' },
      })

      const callA = withLastOwnerGuard(prisma, ownerA.id, (tx) => operatorRepo.updateStatus(ownerA.id, 'SUSPENDED', tx))
      const callB = withLastOwnerGuard(prisma, ownerB.id, (tx) => operatorRepo.updateStatus(ownerB.id, 'SUSPENDED', tx))

      const results = await Promise.allSettled([callA, callB])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')

      // Exactly one succeeds, exactly one is rejected.
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)

      // The rejection MUST be the guardrail's 422, not a DB deadlock/error.
      const rejection = rejected[0] as PromiseRejectedResult
      expect(rejection.reason).toBeInstanceOf(UnprocessableEntityException)

      // Exactly one of the two owners actually ended up SUSPENDED.
      const finalA = await prisma.operator.findUnique({ where: { id: ownerA.id } })
      const finalB = await prisma.operator.findUnique({ where: { id: ownerB.id } })
      const suspendedCount = [finalA?.status, finalB?.status].filter((s) => s === 'SUSPENDED').length
      expect(suspendedCount).toBe(1)
    } finally {
      // Restore the global ACTIVE-OWNER fixtures other suites depend on.
      await prisma.operator.updateMany({
        where: { id: { in: otherActiveOwners.map((o) => o.id) } },
        data: { status: 'ACTIVE' },
      })
    }
  })
})
