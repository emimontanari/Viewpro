import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// T-07 — unit tests for PlatformOutboxWriter
//
// Spec: Transactional Outbox Write
//   - emit(tx, event) calls tx.platformOutboxEvent.create with correct fields
//   - If tx.platformOutboxEvent.create throws, the error propagates (no swallowing)
//   - emit uses the SAME transaction client passed in — never opens a new connection
//
// C1: Advisory lock correctness
//   - emit issues SELECT pg_advisory_xact_lock(...) BEFORE the insert
//   - The lock SQL uses the OUTBOX_LOCK_KEY constant
// ---------------------------------------------------------------------------

// Lazy import: RED phase — module does not exist yet
type PlatformOutboxWriterClass = import('../platform-outbox-writer.js').PlatformOutboxWriter

let PlatformOutboxWriter: new () => PlatformOutboxWriterClass
let OUTBOX_LOCK_KEY: bigint

beforeEach(async () => {
  const mod = await import('../platform-outbox-writer.js')
  PlatformOutboxWriter = mod.PlatformOutboxWriter
  OUTBOX_LOCK_KEY = mod.OUTBOX_LOCK_KEY
})

function makeMockTx(overrides?: {
  create?: ReturnType<typeof vi.fn>
  executeRaw?: ReturnType<typeof vi.fn>
}): Prisma.TransactionClient {
  const create = overrides?.create ?? vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n })
  const executeRaw = overrides?.executeRaw ?? vi.fn().mockResolvedValue(1)

  return {
    platformOutboxEvent: { create },
    $executeRaw: executeRaw,
  } as unknown as Prisma.TransactionClient
}

// ---------------------------------------------------------------------------
// T-04 — RED: PlatformOutboxWriter accepts both input shapes (A5)
//
// Spec: platform-data-lane delta — TENANT_REGISTERED Event Type; writer union
//   - emit(tx, { eventType: 'TENANT_REGISTERED', ... }) calls create with correct fields
//   - emit(tx, { eventType: 'TENANT_STATUS_CHANGED', ... }) still accepted (regression)
//   - Both acquire pg_advisory_xact_lock(OUTBOX_LOCK_KEY)
// ---------------------------------------------------------------------------

describe('PlatformOutboxWriter — TENANT_REGISTERED input shape (T-04/T-05)', () => {
  it('emit with TENANT_REGISTERED calls tx.platformOutboxEvent.create with all payload fields', async () => {
    const writer = new PlatformOutboxWriter()
    const mockCreate = vi.fn().mockResolvedValue({ id: 'row-reg', seqNo: 2n })
    const tx = makeMockTx({ create: mockCreate })

    const occurredAt = new Date('2026-01-15T00:00:00Z')

    await writer.emit(tx, {
      eventType: 'TENANT_REGISTERED',
      tenantId: 'tenant-new',
      payload: {
        id: 'tenant-new',
        name: 'New Corp',
        slug: 'new-corp',
        newStatus: 'TRIAL',
        limits: { maxUsers: 5, maxActivePropertyEngagements: null, maxDocumentsStorageMb: 100 },
      },
      occurredAt,
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        eventType: 'TENANT_REGISTERED',
        tenantId: 'tenant-new',
        payload: {
          id: 'tenant-new',
          name: 'New Corp',
          slug: 'new-corp',
          newStatus: 'TRIAL',
          limits: { maxUsers: 5, maxActivePropertyEngagements: null, maxDocumentsStorageMb: 100 },
        },
        occurredAt,
      },
    })
  })

  it('[regression] emit with TENANT_STATUS_CHANGED still accepted after union widening', async () => {
    const writer = new PlatformOutboxWriter()
    const mockCreate = vi.fn().mockResolvedValue({ id: 'row-sc', seqNo: 3n })
    const tx = makeMockTx({ create: mockCreate })

    await writer.emit(tx, {
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-abc',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date(),
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate.mock.calls[0]![0].data.eventType).toBe('TENANT_STATUS_CHANGED')
  })

  it('[C1] TENANT_REGISTERED emit also acquires pg_advisory_xact_lock BEFORE create', async () => {
    const writer = new PlatformOutboxWriter()
    const callOrder: string[] = []
    const mockExecuteRaw = vi.fn().mockImplementation(() => {
      callOrder.push('advisory-lock')
      return Promise.resolve(1)
    })
    const mockCreate = vi.fn().mockImplementation(() => {
      callOrder.push('create')
      return Promise.resolve({ id: 'row-reg', seqNo: 2n })
    })
    const tx = makeMockTx({ create: mockCreate, executeRaw: mockExecuteRaw })

    await writer.emit(tx, {
      eventType: 'TENANT_REGISTERED',
      tenantId: 'tenant-new',
      payload: {
        id: 'tenant-new',
        name: 'New Corp',
        slug: 'new-corp',
        newStatus: 'TRIAL',
        limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      },
      occurredAt: new Date(),
    })

    expect(callOrder).toEqual(['advisory-lock', 'create'])
  })
})

describe('PlatformOutboxWriter', () => {
  it('calls tx.platformOutboxEvent.create with the correct eventType, tenantId, payload, occurredAt', async () => {
    const writer = new PlatformOutboxWriter()
    const mockCreate = vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n })
    const tx = makeMockTx({ create: mockCreate })

    const occurredAt = new Date('2026-01-01T00:00:00Z')

    await writer.emit(tx, {
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-abc',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt,
    })

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 'tenant-abc',
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        occurredAt,
      },
    })
  })

  it('propagates errors from tx.platformOutboxEvent.create (no swallowing)', async () => {
    const writer = new PlatformOutboxWriter()
    const dbError = new Error('DB constraint violation')
    const tx = makeMockTx({ create: vi.fn().mockRejectedValue(dbError) })

    await expect(
      writer.emit(tx, {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 'tenant-xyz',
        payload: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
        occurredAt: new Date(),
      }),
    ).rejects.toThrow('DB constraint violation')
  })

  it('uses the SAME transaction client passed in — never opens a new connection', async () => {
    const writer = new PlatformOutboxWriter()
    const mockCreate = vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n })
    const tx = makeMockTx({ create: mockCreate })

    // Spy: ensure the writer only calls `create` on the PASSED tx.platformOutboxEvent
    await writer.emit(tx, {
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-abc',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date(),
    })

    // The mock was called (means the passed tx was used)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // C1: Advisory lock — serializes outbox seqNo assignment to COMMIT order.
  // pg_advisory_xact_lock is held until the transaction commits, preventing
  // concurrent transactions from skipping seqNos in the poller.
  // -------------------------------------------------------------------------

  it('[C1] emit calls $executeRaw (advisory lock) BEFORE platformOutboxEvent.create', async () => {
    const writer = new PlatformOutboxWriter()

    const callOrder: string[] = []
    const mockExecuteRaw = vi.fn().mockImplementation(() => {
      callOrder.push('advisory-lock')
      return Promise.resolve(1)
    })
    const mockCreate = vi.fn().mockImplementation(() => {
      callOrder.push('create')
      return Promise.resolve({ id: 'row-1', seqNo: 1n })
    })

    const tx = makeMockTx({ create: mockCreate, executeRaw: mockExecuteRaw })

    await writer.emit(tx, {
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-abc',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date(),
    })

    expect(callOrder).toEqual(['advisory-lock', 'create'])
  })

  it('[C1] $executeRaw is called with SQL containing pg_advisory_xact_lock', async () => {
    const writer = new PlatformOutboxWriter()

    const capturedSqlParts: unknown[] = []
    const mockExecuteRaw = vi.fn().mockImplementation((...args: unknown[]) => {
      capturedSqlParts.push(args)
      return Promise.resolve(1)
    })
    const mockCreate = vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n })

    const tx = makeMockTx({ create: mockCreate, executeRaw: mockExecuteRaw })

    await writer.emit(tx, {
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-abc',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
      occurredAt: new Date(),
    })

    expect(mockExecuteRaw).toHaveBeenCalledOnce()

    // The first argument to $executeRaw is a template literal TemplateStringsArray.
    // Verify it contains the advisory lock function name.
    const firstArg = capturedSqlParts[0]
    const sqlStrings = (firstArg as unknown[])[0] as TemplateStringsArray
    const fullSql = sqlStrings.join('')
    expect(fullSql).toContain('pg_advisory_xact_lock')
  })

  it('[C1] OUTBOX_LOCK_KEY is exported as a named bigint constant', () => {
    expect(typeof OUTBOX_LOCK_KEY).toBe('bigint')
    // Must be a fixed non-zero positive value
    expect(OUTBOX_LOCK_KEY).toBeGreaterThan(0n)
  })

  it('[C1] advisory lock propagates errors (lock failure rejects the promise)', async () => {
    const writer = new PlatformOutboxWriter()
    const lockError = new Error('lock acquisition failed')
    const tx = makeMockTx({
      executeRaw: vi.fn().mockRejectedValue(lockError),
      create: vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n }),
    })

    await expect(
      writer.emit(tx, {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 'tenant-abc',
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        occurredAt: new Date(),
      }),
    ).rejects.toThrow('lock acquisition failed')
  })
})
