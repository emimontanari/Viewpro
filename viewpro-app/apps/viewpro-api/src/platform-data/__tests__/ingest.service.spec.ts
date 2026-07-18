import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { IngestService } from '../ingest.service'
import { MirrorRepository } from '../mirror.repository'
import { CursorRepository } from '../cursor.repository'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import { AuditLogRepository } from '../audit-log.repository'
import { TenantRegistryService } from '../tenant-registry.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * T-18 — RED: IngestService idempotent mirror + cursor tests.
 *
 * Spec: platform-data-lane-ingest-metrics
 *   - Idempotent Mirror Ingest (both scenarios)
 *   - Durable Cursor Advance (all 3 scenarios)
 */

function makeEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
  return {
    id: 'evt-abc',
    seqNo: 1,
    eventType: 'TENANT_STATUS_CHANGED',
    tenantId: 't-1',
    payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('IngestService (integration — test DB)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let cursorRepo: CursorRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [IngestService, MirrorRepository, CursorRepository, PlatformTenantRepository, AuditLogRepository],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    cursorRepo = moduleRef.get(CursorRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    // Clean mirror and reset cursor for each test
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  // Scenario: First ingest stores the event (spec scenario 1)
  it('first ingest of evt-abc → exactly one mirror row', async () => {
    await ingestService.ingestBatch([makeEvent({ id: 'evt-abc', seqNo: 1 })])

    const count = await prisma.platformMirrorEvent.count({
      where: { sourceEventId: 'evt-abc' },
    })
    expect(count).toBe(1)
  })

  // Scenario: Re-delivered event is discarded (spec scenario 2; D8)
  it('re-delivered evt-abc → still one row, no error', async () => {
    const evt = makeEvent({ id: 'evt-abc', seqNo: 1 })

    await ingestService.ingestBatch([evt])
    await ingestService.ingestBatch([evt]) // replay

    const count = await prisma.platformMirrorEvent.count({
      where: { sourceEventId: 'evt-abc' },
    })
    expect(count).toBe(1)
  })

  // Scenario: Cursor advances after successful ingest (cursor scenario 1)
  it('cursor advances from 5 to 7 after ingesting seqNo 6 and 7', async () => {
    await prisma.platformIngestCursor.update({ where: { id: 1 }, data: { seqNo: 5 } })

    await ingestService.ingestBatch([
      makeEvent({ id: 'evt-6', seqNo: 6 }),
      makeEvent({ id: 'evt-7', seqNo: 7 }),
    ])

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(7)
  })

  // Scenario: Cursor does NOT advance if ingest write fails (cursor scenario 2)
  it('cursor does not advance if ingest write fails', async () => {
    await prisma.platformIngestCursor.update({ where: { id: 1 }, data: { seqNo: 5 } })

    // Pre-insert evt-dup so the second ingestBatch with a different sourceEventId
    // is forced to fail by inserting a row with a conflicting primaryId via mock.
    // Instead, we test via a forced error in the mirror: create the mirror repo
    // in a way that throws on upsert.

    // We use an event that has an id that will be forcibly duplicated in a single
    // batch with a different sourceEventId but we craft a situation where prisma
    // throws. The simplest way: ingest an event with the same primary ID as an
    // already-used UUID to trigger a PK violation.
    // Easier: just use MirrorRepository directly and replace it with a throwing mock.

    // Since IngestService logs and skips on any mirror error, we verify the cursor
    // stays at 5 by checking that no advance happens when ingestBatch catches.
    // We do this by deleting platform_ingest_cursor first to force a "no advance" scenario,
    // then using IngestService with a custom MirrorRepository that throws.

    // Actually — we test this by creating a local module with a mock MirrorRepository:
    const throwingMirrorRepo = {
      upsertEvent: () => Promise.reject(new Error('mirror write failed (test)')),
    }

    const localModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: throwingMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const svc = localModule.get(IngestService)
    const cursorR = localModule.get(CursorRepository)

    // Set cursor to 5
    await prisma.platformIngestCursor.update({ where: { id: 1 }, data: { seqNo: 5 } })

    // ingestBatch should log-and-skip, NOT advance the cursor
    await svc.ingestBatch([makeEvent({ id: 'evt-fail', seqNo: 6 })])

    const cursor = await cursorR.getCursor()
    expect(cursor).toBe(5) // must NOT have advanced

    await localModule.close()
  })

  // Scenario: Restart resumes from persisted cursor (cursor scenario 3)
  it('restart resumes from persisted cursor — getCursor returns last written value', async () => {
    // Ingest a batch which advances the cursor
    await ingestService.ingestBatch([makeEvent({ id: 'evt-10', seqNo: 10 })])

    // Simulate restart: create a fresh CursorRepository instance
    const freshModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [CursorRepository],
    }).compile()

    const freshCursorRepo = freshModule.get(CursorRepository)
    const cursor = await freshCursorRepo.getCursor()
    expect(cursor).toBe(10)

    await freshModule.close()
  })

  // W2: Malformed event (missing newStatus) must NOT be stored as '' in the mirror
  // and must NOT appear in metrics buckets. The cursor CAN still advance past it.
  it('[W2] event with missing/empty newStatus is NOT stored as a blank row in the mirror', async () => {
    // Override payload to simulate a malformed event — no newStatus field.
    // Build the event manually to bypass the contract's strict payload type.
    const malformedEvent: PlatformOutboxEvent = {
      id: 'evt-malformed',
      seqNo: 42,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-malformed',
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { previousStatus: 'TRIAL' } as any,
    }

    await ingestService.ingestBatch([malformedEvent])

    // The row must NOT have been written (no '' row, no row at all)
    const count = await prisma.platformMirrorEvent.count({
      where: { sourceEventId: 'evt-malformed' },
    })
    expect(count).toBe(0)
  })

  it('[W2] a malformed event does not appear as a status bucket in metrics (no empty-string bucket)', async () => {
    const malformedEvent: PlatformOutboxEvent = {
      id: 'evt-malformed-metrics',
      seqNo: 43,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-malformed-metrics',
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { previousStatus: 'TRIAL' } as any,
    }

    // Also ingest a valid event to prove normal events still work
    const validEvent = makeEvent({ id: 'evt-valid-w2', seqNo: 44, tenantId: 't-w2' })

    await ingestService.ingestBatch([malformedEvent, validEvent])

    const rows = await prisma.platformMirrorEvent.findMany()
    // The valid event should be stored; the malformed one should not
    const sourceIds = rows.map((r) => r.sourceEventId)
    expect(sourceIds).toContain('evt-valid-w2')
    expect(sourceIds).not.toContain('evt-malformed-metrics')

    // No row should have newStatus === '' (blank)
    const blankRows = rows.filter((r) => r.newStatus === '')
    expect(blankRows).toHaveLength(0)
  })

  // S3: Partial-batch crash safety — event 1 commits, event 2 throws → cursor NOT advanced
  // Retry is idempotent: event 1 not double-stored, batch eventually completes.
  it('[S3] partial-batch: event 1 upsert commits, event 2 throws → cursor does NOT advance', async () => {
    await prisma.platformIngestCursor.update({ where: { id: 1 }, data: { seqNo: 0 } })

    let callCount = 0
    const partialMirrorRepo = {
      upsertEvent: async (event: PlatformOutboxEvent) => {
        callCount++
        if (callCount === 2) {
          // Second event throws mid-batch
          throw new Error('upsert failed mid-batch (test)')
        }
        // First event: directly write to real DB to simulate a committed upsert
        await prisma.platformMirrorEvent.upsert({
          where: { sourceEventId: event.id },
          update: {},
          create: {
            sourceEventId: event.id,
            eventType: 'TENANT_STATUS_CHANGED',
            tenantId: 't-s3',
            newStatus: 'ACTIVE',
            occurredAt: new Date(),
            seqNo: BigInt(event.seqNo),
            payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
          },
        })
      },
    }

    const localModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: partialMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const svc = localModule.get(IngestService)
    const cursorR = localModule.get(CursorRepository)

    const evt1 = makeEvent({ id: 'evt-s3-1', seqNo: 10, tenantId: 't-s3' })
    const evt2 = makeEvent({ id: 'evt-s3-2', seqNo: 11, tenantId: 't-s3' })

    // First attempt — mid-batch failure
    await svc.ingestBatch([evt1, evt2])

    // Cursor must NOT have advanced (D7)
    const cursorAfterFailure = await cursorR.getCursor()
    expect(cursorAfterFailure).toBe(0)

    // evt1 IS in the mirror (it was written before the failure)
    const evt1Row = await prisma.platformMirrorEvent.findMany({
      where: { sourceEventId: 'evt-s3-1' },
    })
    expect(evt1Row).toHaveLength(1)

    // Retry: reset callCount to simulate a fresh attempt where both succeed
    callCount = 0
    const retryMirrorRepo = {
      upsertEvent: async (event: PlatformOutboxEvent) => {
        await prisma.platformMirrorEvent.upsert({
          where: { sourceEventId: event.id },
          update: {},
          create: {
            sourceEventId: event.id,
            eventType: 'TENANT_STATUS_CHANGED',
            tenantId: 't-s3',
            newStatus: 'ACTIVE',
            occurredAt: new Date(),
            seqNo: BigInt(event.seqNo),
            payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
          },
        })
      },
    }

    const retryModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: retryMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const retrySvc = retryModule.get(IngestService)
    const retryCursorR = retryModule.get(CursorRepository)

    // Retry full batch — evt1 upsert is a no-op (idempotent), evt2 succeeds
    await retrySvc.ingestBatch([evt1, evt2])

    // Cursor advances on successful retry
    const cursorAfterRetry = await retryCursorR.getCursor()
    expect(cursorAfterRetry).toBe(11)

    // evt1 still only one row (dedup/idempotent)
    const evt1RowAfterRetry = await prisma.platformMirrorEvent.findMany({
      where: { sourceEventId: 'evt-s3-1' },
    })
    expect(evt1RowAfterRetry).toHaveLength(1)

    // evt2 now stored
    const evt2Row = await prisma.platformMirrorEvent.findMany({
      where: { sourceEventId: 'evt-s3-2' },
    })
    expect(evt2Row).toHaveLength(1)

    await localModule.close()
    await retryModule.close()
  })
})

/**
 * T-14 — RED: ingest event-type routing — REGISTERED full upsert,
 * STATUS upsert-create-if-missing, unknown skip (A8/A9).
 *
 * Spec: tenant-registry — platform_tenants Projection (ingest scenarios);
 *       platform-data-lane delta — Ingest Event-Type Routing (all 3 scenarios)
 */
describe('IngestService — platform_tenants routing (T-14/T-15, A8/A9)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let cursorRepo: CursorRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [IngestService, MirrorRepository, CursorRepository, PlatformTenantRepository, AuditLogRepository],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    cursorRepo = moduleRef.get(CursorRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  function makeRegisteredEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-registered-t1',
      seqNo: 1,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-1',
      payload: {
        id: 't-1',
        name: 'Acme',
        slug: 'acme',
        newStatus: 'TRIAL',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      },
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }

  // Scenario: Ingest of TENANT_REGISTERED upserts a full row
  it('TENANT_REGISTERED for a new tenant → one platform_tenants row with all fields', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-1' } })
    expect(row).not.toBeNull()
    expect(row?.name).toBe('Acme')
    expect(row?.slug).toBe('acme')
    expect(row?.latestStatus).toBe('TRIAL')
    expect(row?.maxUsers).toBe(5)
    expect(row?.maxActivePropertyEngagements).toBe(10)
    expect(row?.maxDocumentsStorageMb).toBe(500)
  })

  // Scenario: Re-delivery of TENANT_REGISTERED is idempotent
  it('re-delivered TENANT_REGISTERED for t-1 → still exactly one row, no error', async () => {
    const evt = makeRegisteredEvent()

    await ingestService.ingestBatch([evt])
    await ingestService.ingestBatch([evt]) // replay

    const rows = await prisma.platformTenant.findMany({ where: { id: 't-1' } })
    expect(rows).toHaveLength(1)
  })

  // Scenario: Ingest of TENANT_STATUS_CHANGED updates latestStatus
  it('TENANT_STATUS_CHANGED for an existing tenant → latestStatus updated; name/slug updated when present', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])

    await ingestService.ingestBatch([
      makeEvent({
        id: 'evt-status-t1',
        seqNo: 2,
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-1',
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE', name: 'Acme Renamed', slug: 'acme' },
      }),
    ])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-1' } })
    expect(row?.latestStatus).toBe('ACTIVE')
    expect(row?.name).toBe('Acme Renamed')
  })

  // T-12 — RED: platform_tenants.latestStatus reflects CANCELLED
  // (platform-tenant-cancel, D6)
  //
  // Spec: admin-tenant-status — Downstream Effects (platform_tenants
  //   projection reflects the CANCELLED status)
  it('TENANT_STATUS_CHANGED newStatus=CANCELLED for an existing tenant → latestStatus === CANCELLED', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent({ id: 'evt-registered-cancel-t1', tenantId: 't-1' })])

    await ingestService.ingestBatch([
      makeEvent({
        id: 'evt-cancel-t1',
        seqNo: 2,
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-1',
        payload: { previousStatus: 'ACTIVE', newStatus: 'CANCELLED' },
      }),
    ])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-1' } })
    expect(row?.latestStatus).toBe('CANCELLED')
  })

  // Scenario A9: TENANT_STATUS_CHANGED for a not-yet-registered tenant → create-if-missing
  it('TENANT_STATUS_CHANGED for an absent tenant → row created with id + latestStatus (A9)', async () => {
    await ingestService.ingestBatch([
      makeEvent({
        id: 'evt-status-t2',
        seqNo: 1,
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-2',
        payload: { previousStatus: 'TRIAL', newStatus: 'SUSPENDED' },
      }),
    ])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-2' } })
    expect(row).not.toBeNull()
    expect(row?.latestStatus).toBe('SUSPENDED')
  })

  // Scenario: Unknown event type does not crash ingest — skipped for platform_tenants,
  // mirror append + cursor advance still happen (platform-data-lane delta)
  it('unknown eventType → no platform_tenants write; mirror still appends; cursor advances', async () => {
    const unknownEvent = {
      id: 'evt-unknown-1',
      seqNo: 5,
      eventType: 'UNKNOWN_FUTURE_TYPE',
      tenantId: 't-unknown',
      payload: { newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    await ingestService.ingestBatch([unknownEvent])

    const tenantRow = await prisma.platformTenant.findUnique({ where: { id: 't-unknown' } })
    expect(tenantRow).toBeNull()

    const mirrorRow = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-unknown-1' },
    })
    expect(mirrorRow).not.toBeNull()

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(5)
  })

  // Defensive ingest: a TENANT_REGISTERED payload with newStatus present but
  // limits undefined must NOT throw (no TypeError on the limits destructure),
  // the cursor must still advance, and later events in the same batch must
  // still be processed (no head-of-line blocking from a poison event).
  it('TENANT_REGISTERED with limits undefined → does not throw, cursor advances, later events still processed', async () => {
    const poisonEvent = {
      id: 'evt-registered-no-limits',
      seqNo: 7,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-no-limits',
      payload: {
        id: 't-no-limits',
        name: 'NoLimits Realty',
        slug: 'no-limits-realty',
        newStatus: 'TRIAL',
        // limits intentionally omitted (undefined)
      },
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    // A later, well-formed event in the SAME batch must still be processed.
    const laterEvent = makeEvent({
      id: 'evt-status-after-poison',
      seqNo: 8,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-after-poison',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    })

    await expect(ingestService.ingestBatch([poisonEvent, laterEvent])).resolves.toBeUndefined()

    // The projection row was written with all-null limits (well-formed-enough).
    const poisonRow = await prisma.platformTenant.findUnique({ where: { id: 't-no-limits' } })
    expect(poisonRow).not.toBeNull()
    expect(poisonRow?.latestStatus).toBe('TRIAL')
    expect(poisonRow?.maxUsers).toBeNull()
    expect(poisonRow?.maxActivePropertyEngagements).toBeNull()
    expect(poisonRow?.maxDocumentsStorageMb).toBeNull()

    // The later event was still processed (projection + mirror).
    const laterRow = await prisma.platformTenant.findUnique({ where: { id: 't-after-poison' } })
    expect(laterRow?.latestStatus).toBe('ACTIVE')

    // The cursor advanced past both events (no head-of-line blocking).
    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(8)
  })

  // Both event types append to platform_mirror_events (platform-data-lane delta)
  it('both TENANT_REGISTERED and TENANT_STATUS_CHANGED append a row to platform_mirror_events', async () => {
    await ingestService.ingestBatch([
      makeRegisteredEvent({ id: 'evt-mirror-registered', seqNo: 1, tenantId: 't-mirror' }),
      makeEvent({
        id: 'evt-mirror-status',
        seqNo: 2,
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-mirror-2',
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      }),
    ])

    const registeredMirrorRow = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-mirror-registered' },
    })
    const statusMirrorRow = await prisma.platformMirrorEvent.findUnique({
      where: { sourceEventId: 'evt-mirror-status' },
    })
    expect(registeredMirrorRow).not.toBeNull()
    expect(statusMirrorRow).not.toBeNull()
  })
})

/**
 * T-19 — RED: threat-matrix — replay / duplicate delivery.
 *
 * Spec: tenant-registry — threat-matrix "Replay / duplicate delivery" row —
 *   redelivered TENANT_REGISTERED/TENANT_STATUS_CHANGED → upsert-on-id no-op;
 *   mirror UNIQUE(sourceEventId) dedup unchanged.
 */
describe('IngestService — replay / duplicate-delivery threat-matrix (T-19)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [IngestService, MirrorRepository, CursorRepository, PlatformTenantRepository, AuditLogRepository],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  function makeRegisteredEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-replay-t1',
      seqNo: 1,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-replay-1',
      payload: {
        id: 't-replay-1',
        name: 'Replay Co',
        slug: 'replay-co',
        newStatus: 'TRIAL',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      },
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }

  // Redeliver the SAME TENANT_REGISTERED event id three times (not just
  // once) → platform_tenants row count MUST stay exactly one across every
  // redelivery, proving the upsert-on-id dedup holds under repeated replay,
  // not just a single re-delivery.
  it('TENANT_REGISTERED redelivered 3x → platform_tenants count unchanged at exactly one row', async () => {
    const evt = makeRegisteredEvent()

    await ingestService.ingestBatch([evt])
    const countAfterFirst = await prisma.platformTenant.count({ where: { id: 't-replay-1' } })
    expect(countAfterFirst).toBe(1)

    await ingestService.ingestBatch([evt])
    await ingestService.ingestBatch([evt])

    const countAfterReplays = await prisma.platformTenant.count({ where: { id: 't-replay-1' } })
    expect(countAfterReplays).toBe(1)
  })

  // Redeliver the SAME TENANT_STATUS_CHANGED event id twice → platform_tenants
  // row count for that tenant stays exactly one (upsert-on-id, not append).
  it('TENANT_STATUS_CHANGED redelivered 2x for the same tenant → platform_tenants count unchanged at exactly one row', async () => {
    const statusEvent = makeEvent({
      id: 'evt-replay-status-t2',
      seqNo: 1,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-replay-2',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    })

    await ingestService.ingestBatch([statusEvent])
    await ingestService.ingestBatch([statusEvent])

    const count = await prisma.platformTenant.count({ where: { id: 't-replay-2' } })
    expect(count).toBe(1)
  })

  // UNIQUE(sourceEventId) is a real DB constraint (not just application-level
  // upsert behavior) — a direct duplicate-key create for a TENANT_REGISTERED
  // mirror row must be rejected by Postgres itself (Prisma P2002).
  it('UNIQUE(sourceEventId) rejects a direct duplicate-key mirror insert for TENANT_REGISTERED', async () => {
    const evt = makeRegisteredEvent({ id: 'evt-unique-registered' })
    await ingestService.ingestBatch([evt])

    await expect(
      prisma.platformMirrorEvent.create({
        data: {
          sourceEventId: 'evt-unique-registered',
          eventType: 'TENANT_REGISTERED',
          tenantId: 't-replay-1',
          newStatus: 'TRIAL',
          occurredAt: new Date(),
          seqNo: BigInt(999),
          payload: { newStatus: 'TRIAL' },
        },
      }),
    ).rejects.toThrow()
  })

  // Same UNIQUE(sourceEventId) enforcement for TENANT_STATUS_CHANGED rows.
  it('UNIQUE(sourceEventId) rejects a direct duplicate-key mirror insert for TENANT_STATUS_CHANGED', async () => {
    const statusEvent = makeEvent({
      id: 'evt-unique-status',
      seqNo: 1,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-replay-3',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    })
    await ingestService.ingestBatch([statusEvent])

    await expect(
      prisma.platformMirrorEvent.create({
        data: {
          sourceEventId: 'evt-unique-status',
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 't-replay-3',
          newStatus: 'ACTIVE',
          occurredAt: new Date(),
          seqNo: BigInt(998),
          payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        },
      }),
    ).rejects.toThrow()
  })
})

/**
 * T-16 — RED: ingest routing — `AUDIT_LOGGED` → `platform_audit_log` ONLY
 * (regression guards a/b/d).
 *
 * Spec: platform-data-lane delta — Ingest Routing for AUDIT_LOGGED (all 4
 *   scenarios); Mirror Append — W2 Guard (all 3 scenarios)
 */
describe('IngestService — AUDIT_LOGGED routing (T-16/T-17)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let cursorRepo: CursorRepository
  let auditLogRepo: AuditLogRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        MirrorRepository,
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    cursorRepo = moduleRef.get(CursorRepository)
    auditLogRepo = moduleRef.get(AuditLogRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  function makeAuditEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-audit-route-1',
      seqNo: 1,
      eventType: 'AUDIT_LOGGED',
      tenantId: 't-audit-1',
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

  // AUDIT_LOGGED → AuditLogRepository.appendFromEvent called once; no
  // platform_mirror_events row; no platform_tenants write (routing isolation).
  it('AUDIT_LOGGED event → exactly one platform_audit_log row; ZERO platform_mirror_events rows; ZERO platform_tenants change', async () => {
    const evt = makeAuditEvent()

    await ingestService.ingestBatch([evt])

    const auditRows = await prisma.platformAuditLog.findMany({ where: { sourceEventId: evt.id } })
    expect(auditRows).toHaveLength(1)

    const mirrorRows = await prisma.platformMirrorEvent.findMany({ where: { sourceEventId: evt.id } })
    expect(mirrorRows).toHaveLength(0)

    const tenantRow = await prisma.platformTenant.findUnique({ where: { id: 't-audit-1' } })
    expect(tenantRow).toBeNull()
  })

  // Re-delivery of the same AUDIT_LOGGED sourceEventId → still exactly one
  // platform_audit_log row (idempotent via the @unique, NOT the mirror — d).
  it('re-delivery of the same AUDIT_LOGGED sourceEventId → still exactly one platform_audit_log row, no error', async () => {
    const evt = makeAuditEvent({ id: 'evt-audit-route-replay' })

    await ingestService.ingestBatch([evt])
    await expect(ingestService.ingestBatch([evt])).resolves.toBeUndefined()

    const auditRows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-route-replay' },
    })
    expect(auditRows).toHaveLength(1)
  })

  // ingestBatch advances the cursor to seqNo=N after processing a batch
  // containing only one AUDIT_LOGGED event (non-stalling — no newStatus guard applies).
  it('a batch containing only one AUDIT_LOGGED event → cursor advances to that seqNo (non-stalling)', async () => {
    await ingestService.ingestBatch([makeAuditEvent({ id: 'evt-audit-cursor', seqNo: 9 })])

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(9)
  })

  // Regression guard (b): TENANT_REGISTERED + TENANT_STATUS_CHANGED +
  // AUDIT_LOGGED in the same batch → platform_tenants reflects registration/
  // status routing EXACTLY as before this change; platform_audit_log gains
  // exactly one row (for the AUDIT_LOGGED event only); cursor advances past all.
  it('mixed batch (TENANT_REGISTERED + TENANT_STATUS_CHANGED + AUDIT_LOGGED) → each routes to the right projection; cursor advances past all', async () => {
    const registeredEvent: PlatformOutboxEvent = {
      id: 'evt-mixed-registered',
      seqNo: 1,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-mixed',
      payload: {
        id: 't-mixed',
        name: 'Mixed Realty',
        slug: 'mixed-realty',
        newStatus: 'TRIAL',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      },
      occurredAt: new Date().toISOString(),
    }
    const statusEvent: PlatformOutboxEvent = {
      id: 'evt-mixed-status',
      seqNo: 2,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-mixed',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
    }
    const auditEvent = makeAuditEvent({ id: 'evt-mixed-audit', seqNo: 3, tenantId: 't-mixed' })

    await ingestService.ingestBatch([registeredEvent, statusEvent, auditEvent])

    const tenantRow = await prisma.platformTenant.findUnique({ where: { id: 't-mixed' } })
    expect(tenantRow?.latestStatus).toBe('ACTIVE')
    expect(tenantRow?.name).toBe('Mixed Realty')

    const auditRows = await prisma.platformAuditLog.findMany({ where: { tenantId: 't-mixed' } })
    expect(auditRows).toHaveLength(1)

    // Mirror gets the two TENANT_* events but NOT the AUDIT_LOGGED one (W2-skip, unregressed).
    const mirrorRows = await prisma.platformMirrorEvent.findMany({ where: { tenantId: 't-mixed' } })
    expect(mirrorRows).toHaveLength(2)

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(3)
  })

  // Direct repository proof (no ingest wiring ambiguity): appendFromEvent is
  // reachable and callable on the injected AuditLogRepository instance.
  it('AuditLogRepository is wired and directly callable', async () => {
    await expect(
      auditLogRepo.appendFromEvent(makeAuditEvent({ id: 'evt-audit-direct' })),
    ).resolves.toBeUndefined()
  })

  // FIX 1: AUDIT_LOGGED must be branched BEFORE the mirror upsert so it never
  // hits MirrorRepository's W2 guard (which would log a false '[W2] malformed
  // event' warning on every audit event). Prove upsertEvent is NOT invoked for
  // AUDIT_LOGGED, while the audit row is still written and the cursor advances.
  it('AUDIT_LOGGED → mirrorRepo.upsertEvent is NOT called; one audit row; cursor advances', async () => {
    const upsertCalls: string[] = []
    const spyMirrorRepo = {
      upsertEvent: async (event: PlatformOutboxEvent) => {
        upsertCalls.push(event.id)
      },
    }

    const localModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: spyMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const svc = localModule.get(IngestService)
    const cursorR = localModule.get(CursorRepository)

    await svc.ingestBatch([makeAuditEvent({ id: 'evt-audit-nomirror', seqNo: 12 })])

    // Crux: the mirror upsert (and therefore the W2 guard) was never reached.
    expect(upsertCalls).toHaveLength(0)

    const auditRows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-nomirror' },
    })
    expect(auditRows).toHaveLength(1)

    const cursor = await cursorR.getCursor()
    expect(cursor).toBe(12)

    await localModule.close()
  })

  // Regression: TENANT_STATUS_CHANGED must STILL flow through the mirror upsert.
  it('TENANT_STATUS_CHANGED still calls mirrorRepo.upsertEvent (regression)', async () => {
    const upsertCalls: string[] = []
    const spyMirrorRepo = {
      upsertEvent: async (event: PlatformOutboxEvent) => {
        upsertCalls.push(event.id)
      },
    }

    const localModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: spyMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const svc = localModule.get(IngestService)

    const statusEvent: PlatformOutboxEvent = {
      id: 'evt-status-mirror-called',
      seqNo: 13,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-status-mirror',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
    }

    await svc.ingestBatch([statusEvent])

    expect(upsertCalls).toContain('evt-status-mirror-called')

    await localModule.close()
  })

  // FIX 2: a malformed AUDIT_LOGGED (missing `action`) must be logged-and-skipped
  // (non-stalling — no throw), the cursor must advance past it, and a later valid
  // event in the SAME batch must still be processed (no head-of-line blocking).
  it('[W2] malformed AUDIT_LOGGED (missing action) → skipped, no throw, cursor advances, later valid event processed', async () => {
    const malformedAudit = {
      id: 'evt-audit-batch-malformed',
      seqNo: 20,
      eventType: 'AUDIT_LOGGED',
      tenantId: 't-audit-mal',
      // action intentionally omitted (malformed)
      payload: { actor: { id: 'op-1', type: 'operator', label: 'op-1' } },
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    const validAudit = makeAuditEvent({
      id: 'evt-audit-batch-valid',
      seqNo: 21,
      tenantId: 't-audit-valid',
    })

    await expect(ingestService.ingestBatch([malformedAudit, validAudit])).resolves.toBeUndefined()

    const malformedRows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-batch-malformed' },
    })
    expect(malformedRows).toHaveLength(0)

    const validRows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-batch-valid' },
    })
    expect(validRows).toHaveLength(1)

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(21)
  })
})

/**
 * platform-manual-plans (Slice 4, Part 1) — RED: ingest routing for
 * TENANT_LIMITS_CHANGED (staleness fix).
 *
 * Spec: ViewPro projects TENANT_LIMITS_CHANGED into platform_tenants
 * Design D1: branched BEFORE mirrorRepo.upsertEvent (same pattern as
 *   AUDIT_LOGGED) — a limits event must never enter the mirror/W2 guard.
 */
describe('IngestService — TENANT_LIMITS_CHANGED routing (platform-manual-plans Part 1)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let cursorRepo: CursorRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [IngestService, MirrorRepository, CursorRepository, PlatformTenantRepository, AuditLogRepository],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    cursorRepo = moduleRef.get(CursorRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  function makeRegisteredEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-limits-registered',
      seqNo: 1,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-limits',
      payload: {
        id: 't-limits',
        name: 'Limits Realty',
        slug: 'limits-realty',
        newStatus: 'TRIAL',
        limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
      },
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }

  function makeLimitsChangedEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-limits-changed',
      seqNo: 2,
      eventType: 'TENANT_LIMITS_CHANGED',
      tenantId: 't-limits',
      payload: {
        limits: { maxUsers: 25, maxActivePropertyEngagements: 100, maxDocumentsStorageMb: 5000 },
      },
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }

  // Scenario: Operator table reflects updated limits after ingest
  it('TENANT_LIMITS_CHANGED for a registered tenant → platform_tenants limit columns are updated', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])
    await ingestService.ingestBatch([makeLimitsChangedEvent()])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-limits' } })
    expect(row?.maxUsers).toBe(25)
    expect(row?.maxActivePropertyEngagements).toBe(100)
    expect(row?.maxDocumentsStorageMb).toBe(5000)
  })

  // Design D1 crux: mirror/upsertEvent is NOT invoked for TENANT_LIMITS_CHANGED
  // (the W2-guard regression this fix targets — a limits event must never
  // reach the mirror). Cursor still advances (non-stalling).
  it('TENANT_LIMITS_CHANGED → mirrorRepo.upsertEvent is NOT called; cursor still advances', async () => {
    const upsertCalls: string[] = []
    const spyMirrorRepo = {
      upsertEvent: async (event: PlatformOutboxEvent) => {
        upsertCalls.push(event.id)
      },
    }

    const localModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        { provide: MirrorRepository, useValue: spyMirrorRepo },
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
      ],
    }).compile()

    const svc = localModule.get(IngestService)
    const cursorR = localModule.get(CursorRepository)

    await svc.ingestBatch([makeLimitsChangedEvent({ id: 'evt-limits-nomirror', seqNo: 15 })])

    expect(upsertCalls).toHaveLength(0)

    const cursor = await cursorR.getCursor()
    expect(cursor).toBe(15)

    await localModule.close()
  })

  // Malformed payload (missing `limits`) must be skipped without throwing or
  // stalling the batch — a later valid event in the SAME batch still processes.
  it('malformed TENANT_LIMITS_CHANGED (missing limits) → skipped, no throw, cursor advances, later valid event processed', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])

    const malformedEvent = {
      id: 'evt-limits-malformed',
      seqNo: 3,
      eventType: 'TENANT_LIMITS_CHANGED',
      tenantId: 't-limits',
      // limits intentionally omitted (malformed)
      payload: {},
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    // Ingest the malformed event alone first — must not throw, must not
    // touch the limits (still the TENANT_REGISTERED values), cursor advances.
    await expect(ingestService.ingestBatch([malformedEvent])).resolves.toBeUndefined()

    const rowAfterMalformed = await prisma.platformTenant.findUnique({ where: { id: 't-limits' } })
    expect(rowAfterMalformed?.maxUsers).toBe(5)

    const cursorAfterMalformed = await cursorRepo.getCursor()
    expect(cursorAfterMalformed).toBe(3)

    // A later, well-formed event (same batch scenario covered by "no
    // head-of-line blocking" pattern elsewhere) is still processed normally.
    const laterEvent = makeLimitsChangedEvent({ id: 'evt-limits-after-malformed', seqNo: 4 })
    await ingestService.ingestBatch([laterEvent])

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(4)

    const rowAfterLater = await prisma.platformTenant.findUnique({ where: { id: 't-limits' } })
    expect(rowAfterLater?.maxUsers).toBe(25)
  })

  // Non-stalling within a SINGLE batch: a malformed TENANT_LIMITS_CHANGED
  // followed by a well-formed TENANT_STATUS_CHANGED for a DIFFERENT tenant
  // in the same batch must not head-of-line-block the later event.
  it('malformed TENANT_LIMITS_CHANGED does not block a later valid event in the SAME batch', async () => {
    const malformedEvent = {
      id: 'evt-limits-malformed-batch',
      seqNo: 5,
      eventType: 'TENANT_LIMITS_CHANGED',
      tenantId: 't-limits-poison',
      payload: {},
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    const laterStatusEvent: PlatformOutboxEvent = {
      id: 'evt-status-after-limits-poison',
      seqNo: 6,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-after-limits-poison',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
    }

    await expect(
      ingestService.ingestBatch([malformedEvent, laterStatusEvent]),
    ).resolves.toBeUndefined()

    const laterRow = await prisma.platformTenant.findUnique({ where: { id: 't-after-limits-poison' } })
    expect(laterRow?.latestStatus).toBe('ACTIVE')

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(6)
  })

  // Regression: existing AUDIT_LOGGED/TENANT_REGISTERED/TENANT_STATUS_CHANGED
  // routing and the mirror's existing behavior are unchanged by this addition.
  it('mixed batch (TENANT_REGISTERED + TENANT_STATUS_CHANGED + TENANT_LIMITS_CHANGED) → each routes correctly; mirror has exactly 2 rows (not the limits event)', async () => {
    const registeredEvent = makeRegisteredEvent({ id: 'evt-mixed2-registered', seqNo: 1, tenantId: 't-mixed2' })
    const statusEvent: PlatformOutboxEvent = {
      id: 'evt-mixed2-status',
      seqNo: 2,
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 't-mixed2',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date().toISOString(),
    }
    const limitsEvent = makeLimitsChangedEvent({ id: 'evt-mixed2-limits', seqNo: 3, tenantId: 't-mixed2' })

    await ingestService.ingestBatch([registeredEvent, statusEvent, limitsEvent])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-mixed2' } })
    expect(row?.latestStatus).toBe('ACTIVE')
    expect(row?.maxUsers).toBe(25)

    const mirrorRows = await prisma.platformMirrorEvent.findMany({ where: { tenantId: 't-mixed2' } })
    expect(mirrorRows).toHaveLength(2)

    const cursor = await cursorRepo.getCursor()
    expect(cursor).toBe(3)
  })

  // Task 12 — Verification: end-to-end check. Emits TENANT_LIMITS_CHANGED
  // from an InmoView-shaped event, runs it through ViewPro ingest, then
  // reads the operator-facing TenantRegistryService (which backs
  // GET /operators/tenants) and asserts it reflects the new limits with no
  // staleness — closing the read-model staleness bug end to end.
  it('E2E: TENANT_LIMITS_CHANGED ingest → TenantRegistryService.listTenants reflects fresh limits (no staleness)', async () => {
    const registryModule = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [TenantRegistryService],
    }).compile()
    const registryService = registryModule.get(TenantRegistryService)

    await ingestService.ingestBatch([
      makeRegisteredEvent({
        id: 'evt-e2e-registered',
        seqNo: 10,
        tenantId: 't-e2e-fresh',
        payload: {
          id: 't-e2e-fresh',
          name: 'E2E Fresh Realty',
          slug: 'e2e-fresh-realty',
          newStatus: 'TRIAL',
          limits: { maxUsers: 5, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
        },
      }),
    ])

    const staleResult = await registryService.listTenants()
    const staleItem = staleResult.items.find((i) => i.id === 't-e2e-fresh')
    expect(staleItem?.limits.maxUsers).toBe(5)

    await ingestService.ingestBatch([
      makeLimitsChangedEvent({ id: 'evt-e2e-limits', seqNo: 11, tenantId: 't-e2e-fresh' }),
    ])

    const freshResult = await registryService.listTenants()
    const freshItem = freshResult.items.find((i) => i.id === 't-e2e-fresh')
    expect(freshItem?.limits.maxUsers).toBe(25)
    expect(freshItem?.limits.maxActivePropertyEngagements).toBe(100)
    expect(freshItem?.limits.maxDocumentsStorageMb).toBe(5000)

    await registryModule.close()
  })
})

/**
 * platform-manual-plans (Slice 4, Part 2) — Task 36 verification: the
 * TENANT_LIMITS_CHANGED ingest choke point (D1/D5) is exercised end to end
 * through `ingestService.ingestBatch`, not just the repository directly —
 * closing the loop between the assign-plan endpoint's own round-trip and the
 * drift-clear recompute.
 *
 * Spec: Plan-label drift on raw limit edit (both scenarios); Assign-plan
 *   action drives the existing limits control lane (isolation scenario).
 * Design D5: single choke point — assign-plan's own push re-matches its own
 *   tier and must NOT self-clear; a raw edit that no longer matches DOES
 *   clear it.
 */
describe('IngestService — plan drift-clear at ingest (platform-manual-plans Part 2, D5)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let tenantRepo: PlatformTenantRepository
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [IngestService, MirrorRepository, CursorRepository, PlatformTenantRepository, AuditLogRepository],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    tenantRepo = moduleRef.get(PlatformTenantRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  function makeRegisteredEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
    return {
      id: 'evt-plan-drift-registered',
      seqNo: 1,
      eventType: 'TENANT_REGISTERED',
      tenantId: 't-plan-drift-ingest',
      payload: {
        id: 't-plan-drift-ingest',
        name: 'Plan Drift Realty',
        slug: 'plan-drift-realty',
        newStatus: 'TRIAL',
        limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      },
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it("regression: assign-plan's own round-trip through ingest re-matches its own tier and does NOT self-clear the plan", async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])

    // Simulates the assign-plan endpoint's own ordering (D7): the control
    // lane push already landed InmoView-side and setPlan was called
    // ViewPro-side; THEN the resulting TENANT_LIMITS_CHANGED event for that
    // very push arrives via ingest, carrying the SAME PROFESIONAL preset.
    await tenantRepo.setPlan('t-plan-drift-ingest', 'PROFESIONAL')
    await ingestService.ingestBatch([
      {
        id: 'evt-plan-drift-selfpush',
        seqNo: 2,
        eventType: 'TENANT_LIMITS_CHANGED',
        tenantId: 't-plan-drift-ingest',
        payload: { limits: { maxUsers: 10, maxActivePropertyEngagements: 100, maxDocumentsStorageMb: 5000 } },
        occurredAt: new Date().toISOString(),
      },
    ])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-drift-ingest' } })
    expect(row?.plan).toBe('PROFESIONAL')
  })

  it('a raw-edit-shaped TENANT_LIMITS_CHANGED that no longer matches the stored plan clears it, via the real ingest path', async () => {
    await ingestService.ingestBatch([makeRegisteredEvent()])
    await tenantRepo.setPlan('t-plan-drift-ingest', 'BASICO')

    // Raw-edit shaped event: limits diverge from BASICO's 3/25/500 preset.
    await ingestService.ingestBatch([
      {
        id: 'evt-plan-drift-rawedit',
        seqNo: 2,
        eventType: 'TENANT_LIMITS_CHANGED',
        tenantId: 't-plan-drift-ingest',
        payload: { limits: { maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 999 } },
        occurredAt: new Date().toISOString(),
      },
    ])

    const row = await prisma.platformTenant.findUnique({ where: { id: 't-plan-drift-ingest' } })
    expect(row?.plan).toBeNull()
  })
})
