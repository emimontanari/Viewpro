import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { TenantRegistryService } from '../tenant-registry.service'
import { TenantBillingStatusService } from '../../payments/tenant-billing-status.service'
import { PrismaPaymentRepository } from '../../payments/prisma-payment.repository'
import { CLOCK, systemClock } from '../../payments/clock'

/**
 * platform-self-service-onboarding — RED: `TenantRegistryService.listTenants`
 * maps `PlatformTenant.trialEndsAt` onto `TenantRegistryItem.trialEndsAt`.
 *
 * Spec: Informational Trial-End Date — Operator UI Displays Trial End Date
 *   (indirectly — this is the read-model mapping the UI consumes).
 */
describe('TenantRegistryService — trialEndsAt mapping (integration — test DB)', () => {
  let moduleRef: TestingModule
  let service: TenantRegistryService
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [TenantRegistryService, TenantBillingStatusService, PrismaPaymentRepository, { provide: CLOCK, useValue: systemClock }, TenantBillingStatusService, PrismaPaymentRepository, { provide: CLOCK, useValue: systemClock }],
    }).compile()

    service = moduleRef.get(TenantRegistryService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
  })

  it('row with trialEndsAt set → item.trialEndsAt is the ISO string', async () => {
    await prisma.platformTenant.create({
      data: {
        id: 't-registry-trial',
        name: 'Trial Registry Co',
        slug: 'trial-registry-co',
        latestStatus: 'TRIAL',
        trialEndsAt: new Date('2026-07-30T13:33:38.492Z'),
      },
    })

    const result = await service.listTenants()
    const item = result.items.find((i) => i.id === 't-registry-trial')

    expect(item?.trialEndsAt).toBe('2026-07-30T13:33:38.492Z')
  })

  it('row with trialEndsAt null → item.trialEndsAt is null', async () => {
    await prisma.platformTenant.create({
      data: {
        id: 't-registry-no-trial',
        name: 'Active Registry Co',
        slug: 'active-registry-co',
        latestStatus: 'ACTIVE',
      },
    })

    const result = await service.listTenants()
    const item = result.items.find((i) => i.id === 't-registry-no-trial')

    expect(item?.trialEndsAt).toBeNull()
  })
})

/**
 * platform-manual-plans (Slice 4, Part 2) — RED: `TenantRegistryService.listTenants`
 * maps `PlatformTenant.plan` onto `TenantRegistryItem.plan`.
 *
 * Spec: Assign-plan action drives the existing limits control lane —
 *   Operator UI shows plan and fresh limits together; Neutral placeholder
 *   for unassigned plan.
 */
describe('TenantRegistryService — plan mapping (integration — test DB)', () => {
  let moduleRef: TestingModule
  let service: TenantRegistryService
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [TenantRegistryService, TenantBillingStatusService, PrismaPaymentRepository, { provide: CLOCK, useValue: systemClock }, TenantBillingStatusService, PrismaPaymentRepository, { provide: CLOCK, useValue: systemClock }],
    }).compile()

    service = moduleRef.get(TenantRegistryService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
  })

  it('row with plan set → item.plan is the plan code string', async () => {
    await prisma.platformTenant.create({
      data: {
        id: 't-registry-plan-set',
        name: 'Plan Registry Co',
        slug: 'plan-registry-co',
        latestStatus: 'ACTIVE',
        plan: 'BASICO',
      },
    })

    const result = await service.listTenants()
    const item = result.items.find((i) => i.id === 't-registry-plan-set')

    expect(item?.plan).toBe('BASICO')
  })

  it('row with plan null → item.plan is null (neutral placeholder scenario)', async () => {
    await prisma.platformTenant.create({
      data: {
        id: 't-registry-plan-none',
        name: 'No Plan Registry Co',
        slug: 'no-plan-registry-co',
        latestStatus: 'TRIAL',
      },
    })

    const result = await service.listTenants()
    const item = result.items.find((i) => i.id === 't-registry-plan-none')

    expect(item?.plan).toBeNull()
  })
})
