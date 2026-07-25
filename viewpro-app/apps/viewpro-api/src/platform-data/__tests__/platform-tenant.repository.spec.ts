import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Logger } from '@nestjs/common'
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
 * audit-view (Slice 1, Phase 1) — RED: `findByIds` batch tenant name
 * resolution for the operator audit feed (design D2).
 *
 * Spec: Batch tenant name resolution — exactly one batch lookup per page,
 *   unknown ids simply absent from the returned Map (no throw).
 */
describe('PlatformTenantRepository — findByIds (integration — test DB)', () => {
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

  it('returns a Map<id,name> for known ids, unknown id simply absent', async () => {
    await repo.upsertFromRegistered(makeRegisteredPayload({ id: 't-findbyids-a', name: 'Tenant A' }))
    await repo.upsertFromRegistered(makeRegisteredPayload({ id: 't-findbyids-b', name: 'Tenant B' }))

    const result = await repo.findByIds(['t-findbyids-a', 't-findbyids-b', 't-findbyids-unknown'])

    expect(result).toEqual(
      new Map([
        ['t-findbyids-a', 'Tenant A'],
        ['t-findbyids-b', 'Tenant B'],
      ]),
    )
    expect(result.has('t-findbyids-unknown')).toBe(false)
  })

  it('empty ids array → empty Map, no query issued', async () => {
    const findManySpy = vi.spyOn(prisma.platformTenant, 'findMany')

    const result = await repo.findByIds([])

    expect(result.size).toBe(0)
    expect(findManySpy).not.toHaveBeenCalled()

    findManySpy.mockRestore()
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

  it('missing tenant → logs a WARNING (observability for a dropped limits change) and still does not create a row or throw', async () => {
    // Reliability guard: a TENANT_LIMITS_CHANGED arriving for a tenantId with no
    // projection row (deploy/backfill window — its TENANT_REGISTERED fell outside
    // feed retention and it was never backfilled) matches ZERO rows. The drop must
    // stay silent to the pipeline (no create, no throw, cursor advances) BUT must
    // be observable via a warn log that names the tenantId — otherwise the limits
    // change is permanently lost with no trace.
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    try {
      await expect(
        repo.applyLimitsChange('t-limits-drop-missing', {
          maxUsers: 25,
          maxActivePropertyEngagements: 100,
          maxDocumentsStorageMb: 5000,
        }),
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0]?.[0]).toContain('t-limits-drop-missing')

      const row = await prisma.platformTenant.findUnique({
        where: { id: 't-limits-drop-missing' },
      })
      expect(row).toBeNull()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

/**
 * platform-manual-plans (Slice 4, Part 2) — RED: `setPlan` write + the
 * drift-clear recompute folded into `applyLimitsChange` (design D5).
 *
 * Spec: Assign-plan action drives the existing limits control lane;
 *   Plan-label drift on raw limit edit (both scenarios).
 * Design D5: single choke point — every limits change (raw edit AND
 *   assign-plan's own push) recomputes plan-vs-limits match at ingest.
 */
describe('PlatformTenantRepository — setPlan + drift-clear (integration — test DB)', () => {
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

  it('setPlan writes the plan column', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-set',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )

    await repo.setPlan('t-plan-set', 'BASICO')

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-set' } })
    expect(row?.plan).toBe('BASICO')
  })

  it('setPlan on a missing projection row → does NOT throw, logs a WARNING, and creates no row', async () => {
    // Robustness guard (mirrors applyLimitsChange's zero-match posture): the
    // assign-plan flow pushes limits to InmoView FIRST (enforced), THEN calls
    // setPlan. For a not-yet-projected / backfill-window tenant, no
    // platform_tenants row exists — an update() would throw Prisma P2025 and
    // 500 AFTER a successful side effect. setPlan must instead drop the label
    // write observably (warn) without throwing or fabricating a partial row.
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    try {
      await expect(repo.setPlan('t-plan-set-missing', 'BASICO')).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0]?.[0]).toContain('t-plan-set-missing')
      expect(warnSpy.mock.calls[0]?.[0]).toContain('BASICO')

      const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-set-missing' } })
      expect(row).toBeNull()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('upsertFromRegistered UPDATE path with limits that diverge from the stored plan clears the plan label (universal drift choke point)', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-reg-drift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )
    await repo.setPlan('t-plan-reg-drift', 'BASICO')

    // A re-delivered TENANT_REGISTERED whose limits diverge from BASICO's
    // preset must clear the stored plan too — upsertFromRegistered's UPDATE
    // branch overwrites the limit columns and MUST flow through the same drift
    // recompute as applyLimitsChange (D5 single choke point).
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-reg-drift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 1000 },
      }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-reg-drift' } })
    expect(row?.plan).toBeNull()
  })

  it('upsertFromRegistered UPDATE path with limits that still match the stored plan keeps the plan label', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-reg-nodrift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )
    await repo.setPlan('t-plan-reg-nodrift', 'BASICO')

    // Re-delivery carrying the exact BASICO preset must NOT self-clear.
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-reg-nodrift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-reg-nodrift' } })
    expect(row?.plan).toBe('BASICO')
  })

  it('raw-edit to limits that no longer match the stored plan clears the plan label', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-drift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )
    await repo.setPlan('t-plan-drift', 'BASICO')

    // Raw edit to 3/25/1000 — no longer matches BASICO's 500 MB preset.
    await repo.applyLimitsChange('t-plan-drift', {
      maxUsers: 3,
      maxActivePropertyEngagements: 25,
      maxDocumentsStorageMb: 1000,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-drift' } })
    expect(row?.plan).toBeNull()
  })

  it('raw-edit to limits that still match the stored plan keeps the plan label', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-nodrift',
        limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 },
      }),
    )
    await repo.setPlan('t-plan-nodrift', 'BASICO')

    // Same exact values re-applied — no actual change.
    await repo.applyLimitsChange('t-plan-nodrift', {
      maxUsers: 3,
      maxActivePropertyEngagements: 25,
      maxDocumentsStorageMb: 500,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-nodrift' } })
    expect(row?.plan).toBe('BASICO')
  })

  it("regression: assign-plan's own limits push re-matches its own tier and must NOT self-clear the label", async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-self-assign',
        limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      }),
    )

    // Simulates the assign-plan endpoint's own ordering: setPlan first (as
    // the controller does after the lane push succeeds), THEN the
    // TENANT_LIMITS_CHANGED ingest for that very push arrives and calls
    // applyLimitsChange with the SAME preset the plan was just set to.
    await repo.setPlan('t-plan-self-assign', 'PROFESIONAL')
    await repo.applyLimitsChange('t-plan-self-assign', {
      maxUsers: 10,
      maxActivePropertyEngagements: 100,
      maxDocumentsStorageMb: 5000,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-self-assign' } })
    expect(row?.plan).toBe('PROFESIONAL')
  })

  it('a tenant with no assigned plan is unaffected by applyLimitsChange (plan stays null)', async () => {
    await repo.upsertFromRegistered(
      makeRegisteredPayload({
        id: 't-plan-none',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      }),
    )

    await repo.applyLimitsChange('t-plan-none', {
      maxUsers: 25,
      maxActivePropertyEngagements: 100,
      maxDocumentsStorageMb: 5000,
    })

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-none' } })
    expect(row?.plan).toBeNull()
  })
})
