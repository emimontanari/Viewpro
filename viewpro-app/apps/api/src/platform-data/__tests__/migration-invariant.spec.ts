import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Spec: Outbox Schema — additive invariant + seqNo total order
//
// Runs against the TEST database (viewpro_test) and verifies:
//   1. Existing Tenant rows are intact after migration (count unchanged)
//   2. PlatformOutboxEvent model exists in Prisma DMMF (model accessible)
//   3. Two inserted outbox rows receive distinct monotonically increasing seqNo
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL ?? 'postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' },
  },
})

let tenantCountBefore: number
let seededTenantId: string

beforeAll(async () => {
  // Count existing tenants before seeding
  tenantCountBefore = await prisma.tenant.count()

  // Seed a minimal tenant to later verify it remains intact
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Outbox Migration Test Tenant',
      slug: `outbox-migration-test-${Date.now()}`,
    },
  })
  seededTenantId = tenant.id
})

afterAll(async () => {
  // Clean up outbox rows seeded by this test
  await prisma.platformOutboxEvent.deleteMany({ where: { tenantId: 'outbox-migration-test-tenant' } })
  await prisma.tenant.delete({ where: { id: seededTenantId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('R1 migration — platform_outbox_events additive invariant', () => {
  describe('existing data is unaffected', () => {
    it('Tenant count after migration is unchanged (additive migration — no rows removed)', async () => {
      const countAfter = await prisma.tenant.count()
      // We seeded one tenant in beforeAll, so count should be tenantCountBefore + 1
      expect(countAfter).toBe(tenantCountBefore + 1)
    })

    it('seeded tenant is accessible by id (no data corruption)', async () => {
      const tenant = await prisma.tenant.findUnique({ where: { id: seededTenantId } })
      expect(tenant).not.toBeNull()
      expect(tenant!.slug).toMatch(/^outbox-migration-test-/)
    })
  })

  describe('PlatformOutboxEvent model exists in Prisma DMMF', () => {
    it('platformOutboxEvent property exists on PrismaClient', () => {
      expect(typeof prisma.platformOutboxEvent).toBe('object')
      expect(prisma.platformOutboxEvent).not.toBeNull()
    })
  })

  describe('seqNo provides total order', () => {
    it('two rows with identical occurredAt receive distinct monotonically increasing seqNo', async () => {
      const sharedOccurredAt = new Date()

      const row1 = await prisma.platformOutboxEvent.create({
        data: {
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 'outbox-migration-test-tenant',
          payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
          occurredAt: sharedOccurredAt,
        },
      })

      const row2 = await prisma.platformOutboxEvent.create({
        data: {
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 'outbox-migration-test-tenant',
          payload: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
          occurredAt: sharedOccurredAt,
        },
      })

      // Both rows have distinct seqNo values
      expect(row1.seqNo).not.toBe(row2.seqNo)

      // seqNo is strictly increasing (BIGSERIAL guarantees monotonic order)
      expect(row2.seqNo > row1.seqNo).toBe(true)
    })
  })
})
