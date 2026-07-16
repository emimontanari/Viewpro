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

  it('create + trialEndsAt explicit JSON null → PlatformTenant.trialEndsAt is null (not 1970 epoch)', async () => {
    // The wire payload is ingested via an unvalidated cast, so an explicit
    // JSON `null` (`"trialEndsAt": null`) can reach the repository even though
    // the contract type is `string | undefined`. It must be treated identically
    // to an absent field — never coerced to `new Date(null)` (epoch 1970).
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-trial-null',
        trialEndsAt: null as unknown as string,
      }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-null' } })
    expect(row?.trialEndsAt).toBeNull()
  })

  it('update + trialEndsAt explicit JSON null → preserves the existing stored value (no 1970 overwrite)', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({ id: 't-trial-null-update', trialEndsAt: '2026-07-30T00:00:00.000Z' }),
    )

    // Re-delivery carrying an explicit JSON null must not overwrite the real date.
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-trial-null-update',
        trialEndsAt: null as unknown as string,
      }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-trial-null-update' } })
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

/**
 * platform-manual-plans (Slice 4, Part 1) — RED: `applyLimitsChange` full
 * overwrite of the 3 limit columns (update-if-exists only, no create).
 *
 * Spec: ViewPro projects TENANT_LIMITS_CHANGED into platform_tenants
 *   (Operator table reflects updated limits after ingest)
 * Design D3: full overwrite via `updateMany`, update-if-exists only, null is
 *   a legitimate target value (unlimited).
 */
describe('PlatformTenantRepository — applyLimitsChange (integration — test DB)', () => {
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

  it('existing tenant → overwrites all 3 limit columns with the new values', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-limits-overwrite',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      }),
    )

    await repo.applyLimitsChange('t-limits-overwrite', {
      maxUsers: 25,
      maxActivePropertyEngagements: 100,
      maxDocumentsStorageMb: 5000,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-limits-overwrite' } })
    expect(row?.maxUsers).toBe(25)
    expect(row?.maxActivePropertyEngagements).toBe(100)
    expect(row?.maxDocumentsStorageMb).toBe(5000)
  })

  it('null limit values persist as null (unlimited) — not skipped', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-limits-null',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      }),
    )

    await repo.applyLimitsChange('t-limits-null', {
      maxUsers: null,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: null,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-limits-null' } })
    expect(row?.maxUsers).toBeNull()
    expect(row?.maxActivePropertyEngagements).toBeNull()
    expect(row?.maxDocumentsStorageMb).toBeNull()
  })

  it('missing tenant → does NOT create a row (update-if-exists only, per D3)', async () => {
    await expect(
      repo.applyLimitsChange('t-does-not-exist', {
        maxUsers: 25,
        maxActivePropertyEngagements: 100,
        maxDocumentsStorageMb: 5000,
      }),
    ).resolves.toBeUndefined()

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-does-not-exist' } })
    expect(row).toBeNull()
  })
})
