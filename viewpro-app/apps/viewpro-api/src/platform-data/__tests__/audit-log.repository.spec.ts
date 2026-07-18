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
    const row = rows.at(0)
    expect(row).toBeDefined()
    expect(row?.action).toBe('TENANT_STATUS_CHANGED')
    expect(row?.tenantId).toBe('t-1')
    expect(row?.actor).toEqual({ id: 'op-1', type: 'operator', label: 'op-1' })
    expect(row?.previousValue).toEqual({ status: 'TRIAL' })
    expect(row?.newValue).toEqual({ status: 'ACTIVE' })
    expect(row?.occurredAt).toBeInstanceOf(Date)
    expect(row?.seqNo).toBe(1n)
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

  // FIX 2: non-stalling malformed-payload guard (mirrors MirrorRepository's W2
  // log-and-skip). A payload missing a required field (`action`) must be
  // logged-and-skipped — NOT throw — so the ingest cursor can still advance
  // past it instead of head-of-line-blocking the batch forever.
  it('[W2] malformed AUDIT_LOGGED (missing action) → logged-and-skipped, no throw, no row written', async () => {
    const malformed = {
      id: 'evt-audit-missing-action',
      seqNo: 1,
      eventType: 'AUDIT_LOGGED',
      tenantId: 't-1',
      // action intentionally omitted
      payload: {
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
        previousValue: { status: 'TRIAL' },
        newValue: { status: 'ACTIVE' },
      },
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    await expect(repo.appendFromEvent(malformed)).resolves.toBeUndefined()

    const rows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-missing-action' },
    })
    expect(rows).toHaveLength(0)
  })

  // Same non-stalling guard for a missing `actor`.
  it('[W2] malformed AUDIT_LOGGED (missing actor) → logged-and-skipped, no throw, no row written', async () => {
    const malformed = {
      id: 'evt-audit-missing-actor',
      seqNo: 2,
      eventType: 'AUDIT_LOGGED',
      tenantId: 't-1',
      // actor intentionally omitted
      payload: {
        action: 'TENANT_STATUS_CHANGED',
        previousValue: { status: 'TRIAL' },
        newValue: { status: 'ACTIVE' },
      },
      occurredAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as PlatformOutboxEvent

    await expect(repo.appendFromEvent(malformed)).resolves.toBeUndefined()

    const rows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-missing-actor' },
    })
    expect(rows).toHaveLength(0)
  })
})

/**
 * T1.1.1 — RED: `PlatformAuditLog` schema gains nullable `sourceEventId`/
 * `seqNo`/`tenantId`, a `source` (`INMOVIEW_OUTBOX | VIEWPRO_NATIVE`)
 * discriminator defaulting to `INMOVIEW_OUTBOX`, and a nullable `target`
 * Json column — so ViewPro-native audit writes (no source outbox event) can
 * coexist with InmoView-outbox rows without breaking the sourceEventId
 * unique-dedup path (Postgres allows multiple NULLs in a unique column).
 *
 * Design: Decision 1 (sdd/platform-operator-management/design)
 */
describe('PlatformAuditLog schema — native-audit support (nullable columns + source discriminator)', () => {
  let moduleRef: TestingModule
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
    }).compile()

    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
  })

  it('sourceEventId/seqNo/tenantId accept null (nullable columns for native writes)', async () => {
    const row = await prisma.platformAuditLog.create({
      data: {
        sourceEventId: null,
        seqNo: null,
        tenantId: null,
        action: 'OPERATOR_CREATED',
        actor: { id: 'op-1' },
        occurredAt: new Date(),
      },
    })

    expect(row.sourceEventId).toBeNull()
    expect(row.seqNo).toBeNull()
    expect(row.tenantId).toBeNull()
  })

  it('source column defaults to INMOVIEW_OUTBOX when omitted (existing ingest rows unaffected)', async () => {
    const row = await prisma.platformAuditLog.create({
      data: {
        sourceEventId: 'evt-source-default-1',
        seqNo: 1,
        action: 'TENANT_STATUS_CHANGED',
        tenantId: 't-1',
        actor: { id: 'op-1' },
        occurredAt: new Date(),
      },
    })

    expect(row.source).toBe('INMOVIEW_OUTBOX')
  })

  it('source column accepts VIEWPRO_NATIVE explicitly, and the nullable target Json column stores structured data', async () => {
    const row = await prisma.platformAuditLog.create({
      data: {
        sourceEventId: null,
        source: 'VIEWPRO_NATIVE',
        action: 'OPERATOR_CREATED',
        actor: { id: 'op-1', email: 'owner@viewpro.app' },
        target: { id: 'op-2', email: 'new@viewpro.app' },
        occurredAt: new Date(),
      },
    })

    expect(row.source).toBe('VIEWPRO_NATIVE')
    expect(row.target).toEqual({ id: 'op-2', email: 'new@viewpro.app' })
  })

  // Regression guard (dedup invariant, Decision 1): two native rows with
  // sourceEventId: null must NOT collide with each other or with an
  // outbox-sourced row's populated sourceEventId — Postgres unique indexes
  // permit multiple NULLs.
  it('two native rows with sourceEventId: null coexist (no unique-constraint collision)', async () => {
    await prisma.platformAuditLog.create({
      data: {
        sourceEventId: null,
        source: 'VIEWPRO_NATIVE',
        action: 'OPERATOR_CREATED',
        actor: { id: 'op-1' },
        occurredAt: new Date(),
      },
    })

    await expect(
      prisma.platformAuditLog.create({
        data: {
          sourceEventId: null,
          source: 'VIEWPRO_NATIVE',
          action: 'OPERATOR_SUSPENDED',
          actor: { id: 'op-1' },
          occurredAt: new Date(),
        },
      }),
    ).resolves.toMatchObject({ sourceEventId: null })

    const rows = await prisma.platformAuditLog.findMany({ where: { sourceEventId: null } })
    expect(rows).toHaveLength(2)
  })
})

/**
 * T1.1.3 — RED: `AuditLogRepository.appendNative(entry)` — writes a
 * VIEWPRO_NATIVE row with sourceEventId: null, and does NOT collide with the
 * existing outbox `appendFromEvent` sourceEventId-deduped path.
 *
 * Spec: Operator-Management Audit Trail — Existing ingest audit unaffected
 */
describe('AuditLogRepository.appendNative (T1.1.3)', () => {
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

  it('appendNative writes a VIEWPRO_NATIVE row with sourceEventId null and the given actor/target/action', async () => {
    await repo.appendNative({
      action: 'OPERATOR_CREATED',
      actor: { id: 'op-owner-1', email: 'owner@viewpro.app' },
      target: { id: 'op-new-1', email: 'new@viewpro.app' },
    })

    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'OPERATOR_CREATED' } })
    expect(rows).toHaveLength(1)
    const row = rows.at(0)
    expect(row?.source).toBe('VIEWPRO_NATIVE')
    expect(row?.sourceEventId).toBeNull()
    expect(row?.actor).toEqual({ id: 'op-owner-1', email: 'owner@viewpro.app' })
    expect(row?.target).toEqual({ id: 'op-new-1', email: 'new@viewpro.app' })
  })

  it('regression: appendNative (null sourceEventId) does not collide with appendFromEvent (populated sourceEventId), and re-appendFromEvent still dedupes', async () => {
    await repo.appendFromEvent({
      id: 'evt-audit-regression-1',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await repo.appendNative({
      action: 'OPERATOR_SUSPENDED',
      actor: { id: 'op-owner-1', email: 'owner@viewpro.app' },
      target: { id: 'op-2', email: 'target@viewpro.app' },
    })

    // Both rows persisted, no collision.
    const allRows = await prisma.platformAuditLog.findMany()
    expect(allRows).toHaveLength(2)

    // Re-delivering the SAME outbox event still dedupes (no-op, no error, no new row).
    await repo.appendFromEvent({
      id: 'evt-audit-regression-1',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const rowsAfterReplay = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-audit-regression-1' },
    })
    expect(rowsAfterReplay).toHaveLength(1)

    const allRowsAfterReplay = await prisma.platformAuditLog.findMany()
    expect(allRowsAfterReplay).toHaveLength(2)
  })
})
