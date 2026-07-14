import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { IngestService } from '../ingest.service'
import { MirrorRepository } from '../mirror.repository'
import { CursorRepository } from '../cursor.repository'
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
      providers: [IngestService, MirrorRepository, CursorRepository],
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
})
