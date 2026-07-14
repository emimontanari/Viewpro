import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// T-07 — RED: unit tests for PlatformOutboxWriter
//
// Spec: Transactional Outbox Write
//   - emit(tx, event) calls tx.platformOutboxEvent.create with correct fields
//   - If tx.platformOutboxEvent.create throws, the error propagates (no swallowing)
//   - emit uses the SAME transaction client passed in — never opens a new connection
// ---------------------------------------------------------------------------

// Lazy import: RED phase — module does not exist yet
type PlatformOutboxWriterClass = import('../platform-outbox-writer.js').PlatformOutboxWriter

let PlatformOutboxWriter: new () => PlatformOutboxWriterClass

beforeEach(async () => {
  const mod = await import('../platform-outbox-writer.js')
  PlatformOutboxWriter = mod.PlatformOutboxWriter
})

function makeMockTx(overrides?: {
  create?: ReturnType<typeof vi.fn>
}): Prisma.TransactionClient {
  const create = overrides?.create ?? vi.fn().mockResolvedValue({ id: 'row-1', seqNo: 1n })

  return {
    platformOutboxEvent: { create },
  } as unknown as Prisma.TransactionClient
}

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
})
