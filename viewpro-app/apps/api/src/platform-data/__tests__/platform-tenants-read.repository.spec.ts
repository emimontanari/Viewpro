import { Test, TestingModule } from '@nestjs/testing'
import { ClsModule } from 'nestjs-cls'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PlatformTenantsReadRepository } from '../platform-tenants-read.repository'

/**
 * platform-tenant-tracking (PR1) — RED: PlatformTenantsReadRepository.findById
 *
 * Spec: platform-tenant-tracking — "InmoView internal tenant summary endpoint"
 *   (clean 404 for unknown tenant ids requires a findById lookup — count
 *   queries silently return 0 for unknown tenants, so a 404 pre-check is
 *   required, per design D4).
 */
describe('PlatformTenantsReadRepository.findById', () => {
  let moduleRef: TestingModule
  let repo: PlatformTenantsReadRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true }), ConfigModule, DatabaseModule],
      providers: [PlatformTenantsReadRepository],
    }).compile()

    repo = moduleRef.get(PlatformTenantsReadRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
  })

  it('returns the tenant row for a known id', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Delta Realty',
        slug: 'delta-realty',
        status: 'ACTIVE',
        maxUsers: 5,
        maxActivePropertyEngagements: 10,
        maxDocumentsStorageMb: 200,
      },
    })

    const result = await repo.findById(tenant.id)

    expect(result).toMatchObject({
      id: tenant.id,
      name: 'Delta Realty',
      slug: 'delta-realty',
      status: 'ACTIVE',
      limits: {
        maxUsers: 5,
        maxActivePropertyEngagements: 10,
        maxDocumentsStorageMb: 200,
      },
    })
  })

  it('returns null for an unknown tenant id', async () => {
    const result = await repo.findById('does-not-exist-tenant-id')

    expect(result).toBeNull()
  })
})
