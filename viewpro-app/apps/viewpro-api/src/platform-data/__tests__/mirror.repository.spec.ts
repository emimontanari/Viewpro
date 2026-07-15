import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { MirrorRepository } from '../mirror.repository'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * T-16 — RED: regression guard (a) — confirms A5/A6 with ZERO
 * `MirrorRepository` code change. The EXISTING W2 guard already correctly
 * excludes `AUDIT_LOGGED` (no `newStatus` in payload) from
 * `platform_mirror_events` — this is documented/formalized behavior, not new
 * behavior; this test file proves the pre-existing guard covers the new
 * event type without modification.
 *
 * Spec: platform-data-lane delta — Mirror Append — W2 Guard Correctly
 *   Excludes AUDIT_LOGGED (No MirrorRepository Change)
 */
describe('MirrorRepository — W2 guard correctly excludes AUDIT_LOGGED (regression guard a)', () => {
  let moduleRef: TestingModule
  let mirrorRepo: MirrorRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [MirrorRepository],
    }).compile()

    mirrorRepo = moduleRef.get(MirrorRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformMirrorEvent.deleteMany()
  })

  it('AUDIT_LOGGED event (no newStatus in payload) → no platform_mirror_events row created', async () => {
    const auditEvent: PlatformOutboxEvent = {
      id: 'evt-mirror-audit-1',
      seqNo: 1,
      eventType: 'AUDIT_LOGGED',
      tenantId: 't-mirror-audit',
      payload: {
        action: 'TENANT_LIMITS_UPDATED',
        previousValue: { maxUsers: 5 },
        newValue: { maxUsers: 10 },
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
      },
      occurredAt: new Date().toISOString(),
    }

    await mirrorRepo.upsertEvent(auditEvent)

    const row = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-mirror-audit-1' },
    })
    expect(row).toBeNull()
  })

  // Regression: a TENANT_STATUS_CHANGED event with missing newStatus is
  // STILL skipped — same guard, unmodified behavior for the pre-existing case.
  it('TENANT_STATUS_CHANGED with missing newStatus is STILL skipped (regression, unmodified guard)', async () => {
    const malformedEvent: PlatformOutboxEvent = {
      id: 'evt-mirror-malformed-regression',
      seqNo: 2,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-mirror-malformed',
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { previousStatus: 'TRIAL' } as any,
    }

    await mirrorRepo.upsertEvent(malformedEvent)

    const row = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-mirror-malformed-regression' },
    })
    expect(row).toBeNull()
  })

  // Regression: a well-formed TENANT_STATUS_CHANGED event is STILL appended
  // (unregressed — the guard only rejects malformed/no-newStatus events).
  it('TENANT_STATUS_CHANGED with a valid newStatus is STILL appended to the mirror (unregressed)', async () => {
    const validEvent: PlatformOutboxEvent = {
      id: 'evt-mirror-valid-regression',
      seqNo: 3,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-mirror-valid',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
    }

    await mirrorRepo.upsertEvent(validEvent)

    const row = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-mirror-valid-regression' },
    })
    expect(row).not.toBeNull()
    expect(row?.newStatus).toBe('ACTIVE')
  })
})
