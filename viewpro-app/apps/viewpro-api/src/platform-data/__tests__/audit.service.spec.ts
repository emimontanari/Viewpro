import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { OPERATOR_REPOSITORY, type IOperatorRepository } from '../../auth/repositories/operator.repository'
import { PrismaOperatorRepository } from '../../auth/repositories/prisma-operator.repository'
import { AuditLogRepository } from '../audit-log.repository'
import { AuditService } from '../audit.service'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import type {
  PlatformOutboxEvent,
  TenantRegisteredPayload,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * audit-view (Slice 1, Phase 1) — CRITICAL DI note: `AuditService` now also
 * depends on `PlatformTenantRepository` and `OPERATOR_REPOSITORY` (batch
 * name resolution, design D1-D3). EVERY `Test.createTestingModule` in this
 * file that provides `AuditService` must also provide these two — otherwise
 * `.compile()` throws "Nest can't resolve dependencies" for every describe
 * block below, not just the new ones.
 */

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
      providers: [
        AuditLogRepository,
        AuditService,
        PlatformTenantRepository,
        { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
      ],
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

/**
 * audit-view (Slice 1, Phase 1) — RED: batch tenant name resolution
 * (design D1/D2).
 *
 * Spec: Batch tenant name resolution.
 */
describe('AuditService.listAudit — batch tenant name resolution (Slice 1, Phase 1)', () => {
  let moduleRef: TestingModule
  let auditLogRepo: AuditLogRepository
  let auditService: AuditService
  let platformTenantRepository: PlatformTenantRepository
  let prisma: PrismaService

  function makeTenantPayload(
    overrides: Partial<TenantRegisteredPayload> = {},
  ): TenantRegisteredPayload {
    return {
      id: 't-enrich-default',
      name: 'Default Tenant',
      slug: 'default-tenant',
      newStatus: 'TRIAL',
      limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      ...overrides,
    }
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        AuditLogRepository,
        AuditService,
        PlatformTenantRepository,
        { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
      ],
    }).compile()

    auditLogRepo = moduleRef.get(AuditLogRepository)
    auditService = moduleRef.get(AuditService)
    platformTenantRepository = moduleRef.get(PlatformTenantRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
    await prisma.platformTenant.deleteMany()
  })

  it('page of 50 rows across 12 distinct tenants → exactly ONE batch tenant lookup, each row carries the resolved tenantName (Scenario: mixed-tenant page)', async () => {
    const tenantIds = Array.from({ length: 12 }, (_, i) => `t-mixed-${i}`)
    await Promise.all(
      tenantIds.map((id, i) =>
        platformTenantRepository.upsertFromRegistered(makeTenantPayload({ id, name: `Tenant ${i}` })),
      ),
    )

    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        auditLogRepo.appendFromEvent(
          makeAuditEvent({
            id: `evt-mixed-${i}`,
            tenantId: tenantIds[i % tenantIds.length],
            occurredAt: new Date(Date.now() - i * 1000).toISOString(),
          }),
        ),
      ),
    )

    const findManySpy = vi.spyOn(prisma.platformTenant, 'findMany')

    const result = await auditService.listAudit(0, 50)

    expect(result.items).toHaveLength(50)
    expect(findManySpy).toHaveBeenCalledTimes(1)
    for (const item of result.items) {
      const index = tenantIds.indexOf(item.tenantId as string)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(item.tenantName).toBe(`Tenant ${index}`)
    }

    findManySpy.mockRestore()
  })

  it('unknown tenantId → row still returns, tenantName is null, no throw (Scenario: unknown tenantId)', async () => {
    await auditLogRepo.appendFromEvent(
      makeAuditEvent({ id: 'evt-unknown-tenant', tenantId: 't-does-not-exist' }),
    )

    const result = await auditService.listAudit()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.tenantId).toBe('t-does-not-exist')
    expect(result.items[0]?.tenantName).toBeNull()
  })
})

/**
 * audit-view (Slice 1, Phase 1) — RED: actor identity resolution by
 * source/type (design D3/D8).
 *
 * Spec: Actor identity resolution by source/type.
 */
describe('AuditService.listAudit — actor identity resolution (Slice 1, Phase 1)', () => {
  let moduleRef: TestingModule
  let auditLogRepo: AuditLogRepository
  let auditService: AuditService
  let operatorRepository: IOperatorRepository
  let prisma: PrismaService

  async function seedOperator(id: string, email: string): Promise<void> {
    await prisma.operator.create({
      data: { id, email, passwordHash: 'test-hash', status: 'ACTIVE', role: 'ANALYST' },
    })
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        AuditLogRepository,
        AuditService,
        PlatformTenantRepository,
        { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
      ],
    }).compile()

    auditLogRepo = moduleRef.get(AuditLogRepository)
    auditService = moduleRef.get(AuditService)
    operatorRepository = moduleRef.get(OPERATOR_REPOSITORY)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
    await prisma.operator.deleteMany()
  })

  it('VIEWPRO_NATIVE actor → actorEmail passthrough from the inline email, zero operator-repository lookups (Scenario: TENANT_DOCUMENT_VIEWED via native)', async () => {
    const findByIdSpy = vi.spyOn(operatorRepository, 'findById')

    await auditLogRepo.appendNative({
      action: 'TENANT_DOCUMENT_VIEWED',
      actor: { id: 'op-native-1', email: 'native@viewpro.app' },
      target: { documentVersionId: 'dv-1', filename: 'contract.pdf' },
      tenantId: 't-native-doc',
    })

    const result = await auditService.listAudit()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.actorEmail).toBe('native@viewpro.app')
    expect(findByIdSpy).not.toHaveBeenCalled()

    findByIdSpy.mockRestore()
  })

  it('outbox actor type:operator → resolved via ONE deduped batch IOperatorRepository.findById call across the page (Scenario: OPERATOR_SUSPENDED via outbox)', async () => {
    await seedOperator('op-dedupe-1', 'operator1@viewpro.app')

    const findByIdSpy = vi.spyOn(operatorRepository, 'findById')

    await auditLogRepo.appendFromEvent(
      makeAuditEvent({
        id: 'evt-outbox-op-1',
        tenantId: 't-outbox-op',
        payload: {
          action: 'OPERATOR_SUSPENDED',
          actor: { id: 'op-dedupe-1', type: 'operator', label: 'op-dedupe-1' },
          previousValue: null,
          newValue: null,
        },
      }),
    )
    await auditLogRepo.appendFromEvent(
      makeAuditEvent({
        id: 'evt-outbox-op-2',
        tenantId: 't-outbox-op',
        occurredAt: new Date(Date.now() - 1000).toISOString(),
        payload: {
          action: 'OPERATOR_REACTIVATED',
          actor: { id: 'op-dedupe-1', type: 'operator', label: 'op-dedupe-1' },
          previousValue: null,
          newValue: null,
        },
      }),
    )

    const result = await auditService.listAudit()

    expect(result.items).toHaveLength(2)
    expect(findByIdSpy).toHaveBeenCalledTimes(1)
    expect(findByIdSpy).toHaveBeenCalledWith('op-dedupe-1')
    for (const item of result.items) {
      expect(item.actorEmail).toBe('operator1@viewpro.app')
    }

    findByIdSpy.mockRestore()
  })

  it('outbox actor type:user → actorEmail is null, no operator-repository call for it (Scenario: InmoView user actor)', async () => {
    const findByIdSpy = vi.spyOn(operatorRepository, 'findById')

    await auditLogRepo.appendFromEvent(
      makeAuditEvent({
        id: 'evt-outbox-user-1',
        tenantId: 't-outbox-user',
        payload: {
          action: 'TENANT_STATUS_CHANGED',
          actor: { id: 'usr-1', type: 'user', label: 'usr-1' },
          previousValue: null,
          newValue: null,
        },
      }),
    )

    const result = await auditService.listAudit()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.actorEmail).toBeNull()
    expect(findByIdSpy).not.toHaveBeenCalled()

    findByIdSpy.mockRestore()
  })

  it('outbox operator actor with no matching IOperatorRepository row → row still returns, actorEmail null, raw actor id preserved, no throw (Scenario: missing operator row)', async () => {
    await auditLogRepo.appendFromEvent(
      makeAuditEvent({
        id: 'evt-missing-operator',
        tenantId: 't-missing-op',
        payload: {
          action: 'OPERATOR_ROLE_CHANGED',
          actor: { id: 'op-does-not-exist', type: 'operator', label: 'op-does-not-exist' },
          previousValue: null,
          newValue: null,
        },
      }),
    )

    const result = await auditService.listAudit()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.actorEmail).toBeNull()
    expect((result.items[0]?.actor as { id: string }).id).toBe('op-does-not-exist')
  })
})
