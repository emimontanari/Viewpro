import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'

/**
 * T-12 — RED: `platform_tenants` migration additive invariant.
 *
 * Spec: tenant-registry — platform_tenants Projection (schema requirement)
 *
 * Asserts the new table exists with the required columns, AND that the
 * pre-existing `platform_mirror_events` / `platform_ingest_cursor` tables
 * survive untouched (additive-only migration invariant).
 */
describe('platform_tenants migration (additive invariant)', () => {
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

  it('platform_tenants table exists with id/name/slug/latestStatus/limits/trialEndsAt/updatedAt columns', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_tenants'
    `
    const columns = rows.map((r) => r.column_name).sort()

    // platform-self-service-onboarding: additive `trialEndsAt` column.
    expect(columns).toEqual(
      [
        'id',
        'name',
        'slug',
        'latestStatus',
        'maxUsers',
        'maxActivePropertyEngagements',
        'maxDocumentsStorageMb',
        'trialEndsAt',
        'updatedAt',
      ].sort(),
    )
  })

  it('platform_mirror_events survives the migration with its known columns intact', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_mirror_events'
    `
    const columns = rows.map((r) => r.column_name)

    expect(columns).toContain('sourceEventId')
    expect(columns).toContain('seqNo')
    expect(columns).toContain('newStatus')
  })

  it('platform_ingest_cursor survives the migration with its known columns intact', async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'platform_ingest_cursor'
    `
    const columns = rows.map((r) => r.column_name)

    expect(columns).toContain('id')
    expect(columns).toContain('seqNo')
  })
})
