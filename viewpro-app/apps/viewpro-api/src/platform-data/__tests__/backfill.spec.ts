import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import { runBackfill } from '../../scripts/backfill-platform-tenants'
import type { ChangeFeedClient } from '../change-feed.client'

/**
 * T-21 — RED: backfill seed — first run populates; re-run is idempotent (A12/A14).
 *
 * Spec: tenant-registry — Backfill Idempotent Seed (both scenarios)
 *
 * fetchAllTenants is mocked — no live InmoView HTTP call in the test harness.
 */
describe('runBackfill (T-21/T-22, A12/A14)', () => {
  let moduleRef: TestingModule
  let tenantRepo: PlatformTenantRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PlatformTenantRepository],
    }).compile()

    tenantRepo = moduleRef.get(PlatformTenantRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
  })

  function makeMockChangeFeedClient(
    tenants: Array<{
      id: string
      name: string
      slug: string
      status: string
      limits: { maxUsers: number | null; maxActivePropertyEngagements: number | null; maxDocumentsStorageMb: number | null }
    }>,
  ): Pick<ChangeFeedClient, 'fetchAllTenants'> {
    return {
      fetchAllTenants: vi.fn().mockResolvedValue({ tenants }),
    }
  }

  // Scenario: First backfill run populates all pre-existing tenants
  it('first run: platform_tenants starts empty; after run → two rows with all fields populated', async () => {
    const mockClient = makeMockChangeFeedClient([
      {
        id: 't-seed-1',
        name: 'Seed Corp',
        slug: 'seed-corp',
        status: 'ACTIVE',
        limits: { maxUsers: 10, maxActivePropertyEngagements: 20, maxDocumentsStorageMb: 1000 },
      },
      {
        id: 't-seed-2',
        name: 'Second Seed',
        slug: 'second-seed',
        status: 'TRIAL',
        limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      },
    ])

    const countBefore = await prisma.platformTenant.count()
    expect(countBefore).toBe(0)

    const result = await runBackfill({ changeFeedClient: mockClient, tenantRepo })

    expect(result.count).toBe(2)

    const rows = await prisma.platformTenant.findMany({ orderBy: { id: 'asc' } })
    expect(rows).toHaveLength(2)

    const seed1 = rows.find((r) => r.id === 't-seed-1')
    expect(seed1).toMatchObject({
      name: 'Seed Corp',
      slug: 'seed-corp',
      latestStatus: 'ACTIVE',
      maxUsers: 10,
      maxActivePropertyEngagements: 20,
      maxDocumentsStorageMb: 1000,
    })

    const seed2 = rows.find((r) => r.id === 't-seed-2')
    expect(seed2).toMatchObject({
      name: 'Second Seed',
      slug: 'second-seed',
      latestStatus: 'TRIAL',
      maxUsers: null,
    })

    expect(mockClient.fetchAllTenants).toHaveBeenCalledOnce()
  })

  // Scenario: Re-running backfill is idempotent
  it('second run: platform_tenants still contains exactly two rows — no duplicates', async () => {
    const mockClient = makeMockChangeFeedClient([
      {
        id: 't-seed-1',
        name: 'Seed Corp',
        slug: 'seed-corp',
        status: 'ACTIVE',
        limits: { maxUsers: 10, maxActivePropertyEngagements: 20, maxDocumentsStorageMb: 1000 },
      },
      {
        id: 't-seed-2',
        name: 'Second Seed',
        slug: 'second-seed',
        status: 'TRIAL',
        limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      },
    ])

    await runBackfill({ changeFeedClient: mockClient, tenantRepo })
    const countAfterFirst = await prisma.platformTenant.count()
    expect(countAfterFirst).toBe(2)

    // Re-run with the SAME two tenants — safe to re-run (idempotent upsert).
    await runBackfill({ changeFeedClient: mockClient, tenantRepo })

    const countAfterSecond = await prisma.platformTenant.count()
    expect(countAfterSecond).toBe(2)
  })
})
