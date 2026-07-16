import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../../config/config.module'
import { DatabaseModule } from '../../../database/database.module'
import { PrismaService } from '../../../database/prisma.service'
import { PrismaOperatorRepository } from '../prisma-operator.repository'

/**
 * T1.2.1 — RED: `PrismaOperatorRepository.{create,list,updateRole,
 * updateStatus,countActiveOwners}` (platform-operator-management, Decision 3).
 */
describe('PrismaOperatorRepository — operator-management extension (T1.2.1)', () => {
  let moduleRef: TestingModule
  let repo: PrismaOperatorRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PrismaOperatorRepository],
    }).compile()

    repo = moduleRef.get(PrismaOperatorRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.operator.deleteMany({ where: { email: { contains: 'prisma-operator-repo-test' } } })
  })

  describe('create', () => {
    it('persists the explicitly given role (never the ANALYST DB default) and never returns passwordHash', async () => {
      const created = await repo.create({
        email: 'Owner-Create@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'OPERATIONS',
      })

      expect(created.role).toBe('OPERATIONS')
      expect(created).not.toHaveProperty('passwordHash')

      const row = await prisma.operator.findUnique({ where: { id: created.id } })
      expect(row?.role).toBe('OPERATIONS')
    })

    it('normalizes email (lowercase + trim) before persisting', async () => {
      const created = await repo.create({
        email: '  Normalize-Test@Prisma-Operator-Repo-Test.viewpro.app  ',
        passwordHash: '$argon2id$fakehash',
        role: 'ANALYST',
      })

      expect(created.email).toBe('normalize-test@prisma-operator-repo-test.viewpro.app')
    })

    it('duplicate email surfaces distinctly (Prisma P2002), not a generic error', async () => {
      await repo.create({
        email: 'dup@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'ANALYST',
      })

      const error = await repo
        .create({
          email: 'dup@prisma-operator-repo-test.viewpro.app',
          passwordHash: '$argon2id$fakehash2',
          role: 'ANALYST',
        })
        .catch((e: unknown) => e)

      expect((error as { code?: string }).code).toBe('P2002')
    })
  })

  describe('list', () => {
    it('never includes passwordHash for any returned operator', async () => {
      await repo.create({
        email: 'list-1@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'ANALYST',
      })
      await repo.create({
        email: 'list-2@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'OWNER',
      })

      const operators = await repo.list()
      const testOperators = operators.filter((op) => op.email.includes('prisma-operator-repo-test'))
      expect(testOperators.length).toBeGreaterThanOrEqual(2)
      for (const op of testOperators) {
        expect(op).not.toHaveProperty('passwordHash')
      }
    })
  })

  describe('updateRole / updateStatus / countActiveOwners — tx-client threading', () => {
    it('updateRole accepts an optional tx client and defaults to this.prisma when omitted', async () => {
      const created = await repo.create({
        email: 'role-change@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'ANALYST',
      })

      const updated = await repo.updateRole(created.id, 'OPERATIONS')
      expect(updated.role).toBe('OPERATIONS')

      const withinTx = await prisma.$transaction(async (tx) => repo.updateRole(created.id, 'OWNER', tx))
      expect(withinTx.role).toBe('OWNER')
    })

    it('updateStatus accepts an optional tx client and defaults to this.prisma when omitted', async () => {
      const created = await repo.create({
        email: 'status-change@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'ANALYST',
      })

      const updated = await repo.updateStatus(created.id, 'SUSPENDED')
      expect(updated.status).toBe('SUSPENDED')

      const withinTx = await prisma.$transaction(async (tx) => repo.updateStatus(created.id, 'ACTIVE', tx))
      expect(withinTx.status).toBe('ACTIVE')
    })

    it('countActiveOwners excludes the given id and counts only ACTIVE OWNER operators, accepts an optional tx client', async () => {
      const ownerA = await repo.create({
        email: 'owner-a@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'OWNER',
      })
      const ownerB = await repo.create({
        email: 'owner-b@prisma-operator-repo-test.viewpro.app',
        passwordHash: '$argon2id$fakehash',
        role: 'OWNER',
      })

      const countExcludingA = await repo.countActiveOwners(ownerA.id)
      expect(countExcludingA).toBeGreaterThanOrEqual(1)

      const countWithinTx = await prisma.$transaction(async (tx) => repo.countActiveOwners(ownerA.id, tx))
      expect(countWithinTx).toBe(countExcludingA)

      // Excluding BOTH owners (by suspending B first) should drop the count for A's exclusion.
      await repo.updateStatus(ownerB.id, 'SUSPENDED')
      const countAfterSuspendingB = await repo.countActiveOwners(ownerA.id)
      expect(countAfterSuspendingB).toBe(countExcludingA - 1)
    })
  })
})
