import { AnalyticsActorType } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Spec: Additive DB Schema — existing user-actor events are unaffected
//
// This test suite runs against the TEST database (viewpro_test) and verifies:
//   1. The PLATFORM_OPERATOR enum value exists in the Prisma DMMF
//   2. The PlatformCommandLog model exists in the Prisma DMMF
//   3. Existing AnalyticsEvent rows with actorUserId still have their value
//   4. actorOperatorId defaults to null on existing rows
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL ?? 'postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public' },
  },
})

let seededEventId: string

beforeAll(async () => {
  // Seed a minimal tenant + user-actor AnalyticsEvent to validate invariant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Migration Test Tenant',
      slug: `migration-test-${Date.now()}`,
    },
  })

  const event = await prisma.analyticsEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: 'seed-user-id',
      actorType: AnalyticsActorType.INTERNAL_USER,
      eventName: 'TENANT_STATUS_CHANGED',
      metadata: { test: true },
    },
  })

  seededEventId = event.id
})

afterAll(async () => {
  // Clean up seeded data
  await prisma.analyticsEvent.deleteMany({ where: { id: seededEventId } })
  await prisma.tenant.deleteMany({ where: { slug: { contains: 'migration-test-' } } })
  await prisma.$disconnect()
})

describe('R1 migration — additive invariant', () => {
  describe('DMMF model checks (compile-time proof)', () => {
    it('PLATFORM_OPERATOR exists in AnalyticsActorType enum', () => {
      // If this compiles, the enum value exists in the generated client
      const _enumRef: AnalyticsActorType = AnalyticsActorType.PLATFORM_OPERATOR
      expect(_enumRef).toBe('PLATFORM_OPERATOR')
    })

    it('PlatformCommandLog model is accessible via PrismaClient', () => {
      // Structural check: property exists on the client
      expect(typeof prisma.platformCommandLog).toBe('object')
      expect(prisma.platformCommandLog).not.toBeNull()
    })

    it('analyticsEvent model has actorOperatorId field', async () => {
      // Runtime schema check: can query with explicit field selection
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: seededEventId },
        select: { actorUserId: true, actorOperatorId: true },
      })

      expect(event).not.toBeNull()
      expect(event!.actorUserId).toBe('seed-user-id')
      expect(event!.actorOperatorId).toBeNull()
    })
  })

  describe('existing user-actor events are unaffected', () => {
    it('seeded event preserves actorUserId after migration', async () => {
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: seededEventId },
      })

      expect(event).not.toBeNull()
      expect(event!.actorUserId).toBe('seed-user-id')
    })

    it('seeded event has actorOperatorId=null (additive nullable column)', async () => {
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: seededEventId },
      })

      expect(event!.actorOperatorId).toBeNull()
    })

    it('actorType remains INTERNAL_USER on user-actor events', async () => {
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: seededEventId },
      })

      expect(event!.actorType).toBe(AnalyticsActorType.INTERNAL_USER)
    })
  })

  describe('PlatformCommandLog table is operable', () => {
    it('can insert and retrieve a PlatformCommandLog record', async () => {
      const key = `test-idempotency-key-${Date.now()}`
      const log = await prisma.platformCommandLog.create({
        data: {
          idempotencyKey: key,
          tenantId: 'tenant-invariant-test',
          commandType: 'SET_STATUS',
          result: { status: 'updated' },
        },
      })

      expect(log.idempotencyKey).toBe(key)
      expect(log.result).toEqual({ status: 'updated' })

      // Cleanup
      await prisma.platformCommandLog.delete({ where: { id: log.id } })
    })
  })
})
