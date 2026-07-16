import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../audit-log.repository'
import { AuditService } from '../audit.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * T1.1.5 — RED: `AuditService.listAudit()` gains `source`, `target`,
 * `seqNo: number | null`, `tenantId: string | null` on `AuditLogItem`, and
 * interleaves native + outbox rows ordered by `occurredAt DESC`
 * (platform-operator-management, Decision 1).
 */
function makeAuditEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
  return {
    id: 'evt-audit-svc-1',
    seqNo: 1,
    eventType: 'AUDIT_LOGGED',
    tenantId: 't-1',
    payload: {
      action: 'TENANT_STATUS_CHANGED',
      previousValue: { status: 'TRIAL' },
      newValue: { status: 'ACTIVE' },
      actor: { id: 'op-1', type: 'operator', label: 'op-1' },
    },
    occurredAt: new Date('2026-07-15T10:00:00.000Z').toISOString(),
    ...overrides,
  }
}

describe('AuditService.listAudit — native + outbox interleaving (T1.1.5)', () => {
  let moduleRef: TestingModule
  let auditLogRepo: AuditLogRepository
  let auditService: AuditService
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [AuditLogRepository, AuditService],
    }).compile()

    auditLogRepo = moduleRef.get(AuditLogRepository)
    auditService = moduleRef.get(AuditService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
  })

  it('outbox-sourced item carries source=INMOVIEW_OUTBOX, target=null, numeric seqNo, string tenantId', async () => {
    await auditLogRepo.appendFromEvent(makeAuditEvent())

    const result = await auditService.listAudit()
    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    expect(item?.source).toBe('INMOVIEW_OUTBOX')
    expect(item?.target).toBeNull()
    expect(item?.seqNo).toBe(1)
    expect(item?.tenantId).toBe('t-1')
  })

  it('native item carries source=VIEWPRO_NATIVE, populated target, seqNo=null, tenantId=null', async () => {
    await auditLogRepo.appendNative({
      action: 'OPERATOR_CREATED',
      actor: { id: 'op-owner-1', email: 'owner@viewpro.app' },
      target: { id: 'op-new-1', email: 'new@viewpro.app' },
    })

    const result = await auditService.listAudit()
    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    expect(item?.source).toBe('VIEWPRO_NATIVE')
    expect(item?.target).toEqual({ id: 'op-new-1', email: 'new@viewpro.app' })
    expect(item?.seqNo).toBeNull()
    expect(item?.tenantId).toBeNull()
  })

  it('interleaves native and outbox rows ordered by occurredAt DESC', async () => {
    // Outbox row occurredAt = 2026-07-15T10:00:00Z (older)
    await auditLogRepo.appendFromEvent(makeAuditEvent({ id: 'evt-audit-svc-older' }))

    // Native row occurs "now" (newer) — appendNative always uses new Date().
    await auditLogRepo.appendNative({
      action: 'OPERATOR_CREATED',
      actor: { id: 'op-owner-1', email: 'owner@viewpro.app' },
      target: { id: 'op-new-1', email: 'new@viewpro.app' },
    })

    const result = await auditService.listAudit()
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    // Newest (native) first.
    expect(result.items[0]?.source).toBe('VIEWPRO_NATIVE')
    expect(result.items[1]?.source).toBe('INMOVIEW_OUTBOX')
  })
})
