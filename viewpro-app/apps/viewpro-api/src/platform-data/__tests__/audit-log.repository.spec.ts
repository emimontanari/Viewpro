import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../audit-log.repository'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * T-14 — RED: `AuditLogRepository.appendFromEvent` — idempotent upsert on
 * `sourceEventId` (regression guard d).
 *
 * Spec: platform-audit-log — platform_audit_log Append-Only Projection
 *   (both scenarios); A8
 */

function makeAuditEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
  return {
    id: 'evt-audit-1',
    seqNo: 1,
    eventType: 'AUDIT_LOGGED',
    tenantId: 't-1',
    payload: {
      action: 'TENANT_STATUS_CHANGED',
      previousValue: { status: 'TRIAL' },
      newValue: { status: 'ACTIVE' },
      actor: { id: 'op-1', type: 'operator', label: 'op-1' },
    },
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('AuditLogRepository (integration — test DB)', () => {
  let moduleRef: TestingModule
  let repo: AuditLogRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [AuditLogRepository],
    }).compile()

    repo = moduleRef.get(AuditLogRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
  })

  it('appendFromEvent with a fresh sourceEventId → exactly one row with all fields populated', async () => {
    await repo.appendFromEvent(makeAuditEvent())

    const rows = await prisma.platformAuditLog.findMany({ where: { sourceEventId: 'evt-audit-1' } })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.action).toBe('TENANT_STATUS_CHANGED')
    expect(row.tenantId).toBe('t-1')
    expect(row.actor).toEqual({ id: 'op-1', type: 'operator', label: 'op-1' })
    expect(row.previousValue).toEqual({ status: 'TRIAL' })
    expect(row.newValue).toEqual({ status: 'ACTIVE' })
    expect(row.occurredAt).toBeInstanceOf(Date)
    expect(row.seqNo).toBe(1n)
  })

  it('re-invoking appendFromEvent with the SAME sourceEventId → still exactly one row, no error (idempotent)', async () => {
    const evt = makeAuditEvent({ id: 'evt-audit-replay' })

    await repo.appendFromEvent(evt)
    await expect(repo.appendFromEvent(evt)).resolves.toBeUndefined()

    const rows = await prisma.platformAuditLog.findMany({ where: { sourceEventId: 'evt-audit-replay' } })
    expect(rows).toHaveLength(1)
  })

  it('seqNo is stored as BigInt (W1 pattern, mirrors MirrorRepository)', async () => {
    await repo.appendFromEvent(makeAuditEvent({ id: 'evt-audit-seqno', seqNo: 42 }))

    const row = await prisma.platformAuditLog.findUnique({ where: { sourceEventId: 'evt-audit-seqno' } })
    expect(typeof row?.seqNo).toBe('bigint')
    expect(row?.seqNo).toBe(42n)
  })
})
