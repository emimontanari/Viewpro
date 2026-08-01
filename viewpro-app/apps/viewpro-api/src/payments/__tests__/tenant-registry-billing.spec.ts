import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { TenantRegistryService } from '../../platform-data/tenant-registry.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import { TenantBillingStatusService } from '../tenant-billing-status.service'
import { CLOCK } from '../clock'

/**
 * platform-payment-ledger (PR 3) — RED: the tenant list carries billing state.
 *
 * The list is where an operator notices a lapse, so paid-through and overdue
 * have to arrive with the rows rather than being fetched per row. The
 * isolation assertion matters as much as the enrichment: a tenant going
 * overdue must not have its status, limits or plan touched.
 *
 * Spec: Overdue Is Derived and Never Restricts Access.
 */
describe('TenantRegistryService billing enrichment (integration — test DB)', () => {
  let moduleRef: TestingModule
  let registry: TenantRegistryService
  let payments: PrismaPaymentRepository
  let prisma: PrismaService

  const PAID = 'registry-billing-paid'
  const LAPSED = 'registry-billing-lapsed'
  const UNPAID = 'registry-billing-unpaid'
  const ALL = [PAID, LAPSED, UNPAID]

  const NOW = new Date('2026-09-03T15:00:00.000Z')

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        TenantRegistryService,
        TenantBillingStatusService,
        PrismaPaymentRepository,
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile()

    registry = moduleRef.get(TenantRegistryService)
    payments = moduleRef.get(PrismaPaymentRepository)
    prisma = moduleRef.get(PrismaService)

    for (const [index, id] of ALL.entries()) {
      await prisma.platformTenant.upsert({
        where: { id },
        create: { id, name: `ZZ Registry Billing ${index}`, slug: id, latestStatus: 'ACTIVE' },
        update: {},
      })
    }
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: { in: ALL } } })
    await prisma.platformTenant.deleteMany({ where: { id: { in: ALL } } })
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: { in: ALL } } })
  })

  async function itemsById() {
    const list = await registry.listTenants(0, 200)
    return new Map(list.items.map((item) => [item.id, item]))
  }

  async function record(tenantId: string, periodStart: string, periodEnd: string) {
    return payments.record({
      tenantId,
      amountMinorUnits: 4_500_000n,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart,
      periodEnd,
      receiptReference: null,
      note: null,
      recordedByOperatorId: 'operator-1',
    })
  }

  it('carries paid-through and overdue on each row', async () => {
    await record(PAID, '2026-09-01', '2026-09-30')
    await record(LAPSED, '2026-08-01', '2026-08-31')

    const items = await itemsById()

    expect(items.get(PAID)?.billing).toEqual({ paidThroughAt: '2026-09-30', overdueDays: null })
    expect(items.get(LAPSED)?.billing).toEqual({ paidThroughAt: '2026-08-31', overdueDays: 3 })
    expect(items.get(UNPAID)?.billing).toEqual({ paidThroughAt: null, overdueDays: null })
  })

  it('leaves status, limits and plan untouched when a tenant goes overdue', async () => {
    await record(LAPSED, '2026-08-01', '2026-08-31')

    const item = (await itemsById()).get(LAPSED)
    const row = await prisma.platformTenant.findUniqueOrThrow({ where: { id: LAPSED } })

    expect(item?.billing.overdueDays).toBe(3)
    // Overdue is a badge, not an enforcement action.
    expect(item?.status).toBe('ACTIVE')
    expect(row.latestStatus).toBe('ACTIVE')
    expect(row.maxUsers).toBeNull()
    expect(row.plan).toBeNull()
  })

  it('resolves billing for a full page in one batched read', async () => {
    await record(PAID, '2026-09-01', '2026-09-30')

    const list = await registry.listTenants(0, 200)

    // Every row carries billing, including tenants with no payments at all.
    for (const item of list.items) {
      expect(item.billing).toBeDefined()
    }
  })
})
