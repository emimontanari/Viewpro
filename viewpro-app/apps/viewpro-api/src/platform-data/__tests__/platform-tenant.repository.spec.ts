import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import type { TenantRegisteredPayload } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * platform-self-service-onboarding — RED: `PlatformTenantRepository`
 * trialEndsAt mapping on `upsertFromRegistered`.
 *
 * Spec: Informational Trial-End Date — ViewPro Projection Persists Trial
 *   End Date (present/absent scenarios) + preserve-on-update (no unconditional
 *   null-out, since scripts/backfill-platform-tenants.ts sends payloads
 *   without trialEndsAt).
 */

function makeRegisteredPayload(
  overrides: Partial<TenantRegisteredPayload> = {},
): TenantRegisteredPayload {
  return {
    id: 't-trial-1',
    name: 'Trial Co',
    slug: 'trial-co',
    newStatus: 'TRIAL',
    limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
    ...overrides,
  }
}

describe('PlatformTenantRepository — trialEndsAt (integration — test DB)', () => {
  let moduleRef: TestingModule
  let repo: PlatformTenantRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PlatformTenantRepository],
    }).compile()

    repo = moduleRef.get(PlatformTenantRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
  })

  it('create + trialEndsAt present → PlatformTenant.trialEndsAt is persisted', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({ id: 't-trial-present', trialEndsAt: '2026-07-30T13:33:38.492Z' }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-present' } })
    expect(row?.trialEndsAt).toEqual(new Date('2026-07-30T13:33:38.492Z'))
  })

  it('create + trialEndsAt absent → PlatformTenant.trialEndsAt is null', async () => {
    await repo.upsertFromRegistered(makeRegisteredPayload({ id: 't-trial-absent' }))

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-absent' } })
    expect(row?.trialEndsAt).toBeNull()
  })

  it('update + trialEndsAt present → overwrites the stored value', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({ id: 't-trial-update', trialEndsAt: '2026-07-30T00:00:00.000Z' }),
    )

    await repo.upsertFromRegistered(
      makeRegisteredPayload({ id: 't-trial-update', trialEndsAt: '2026-08-15T00:00:00.000Z' }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-update' } })
    expect(row?.trialEndsAt).toEqual(new Date('2026-08-15T00:00:00.000Z'))
  })

  it('update + trialEndsAt absent → preserves the existing stored value (no unconditional null-out)', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({ id: 't-trial-preserve', trialEndsAt: '2026-07-30T00:00:00.000Z' }),
    )

    // Re-delivery / backfill-style payload WITHOUT trialEndsAt must not null it out.
    await repo.upsertFromRegistered(makeRegisteredPayload({ id: 't-trial-preserve' }))

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-preserve' } })
    expect(row?.trialEndsAt).toEqual(new Date('2026-07-30T00:00:00.000Z'))
  })

  it('invalid trialEndsAt string → treated as absent (create: null, no throw)', async () => {
    await expect(
      repo.upsertFromRegistered(
        makeRegisteredPayload({ id: 't-trial-invalid', trialEndsAt: 'not-a-date' }),
      ),
    ).resolves.toBeUndefined()

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-invalid' } })
    expect(row?.trialEndsAt).toBeNull()
  })
})
