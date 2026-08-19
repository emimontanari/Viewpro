import { describe, expect, it, vi } from 'vitest'
import { ChangeFeedTimeoutError } from '../change-feed.client'
import { IngestService } from '../ingest.service'
import { PlatformSyncCoordinator } from '../platform-sync-coordinator'
const event = { seqNo: 6, eventType: 'TENANT_STATUS_CHANGED', tenantId: 't-1', payload: { newStatus: 'ACTIVE' } } as never

function makeRealCoordinator(events = [event]) {
  let durableCursor = 5
  const cursor = { getCursor: vi.fn().mockResolvedValue(5), advanceCursor: vi.fn((value: number) => { durableCursor = value }) }
  const projection: unknown[] = []
  const ingest = new IngestService({ upsertEvent: vi.fn((value: unknown) => projection.push(value)) } as never, cursor as never, { upsertFromStatusChange: vi.fn() } as never, {} as never)
  const feed = { fetchChanges: vi.fn().mockResolvedValue({ events }) }
  return { coordinator: new PlatformSyncCoordinator(feed as never, ingest, cursor as never), cursor, feed, projection, durableCursor: () => durableCursor }
}
describe('PlatformSyncCoordinator', () => {
  it('joins an active batch without queueing and releases it for the next batch', async () => {
    let release!: (value: { events: never[] }) => void
    const first = new Promise<{ events: never[] }>((resolve) => { release = resolve }); const { coordinator, feed } = makeRealCoordinator(); feed.fetchChanges.mockImplementationOnce(() => first)
    const running = coordinator.runOneBatch()
    expect(coordinator.runOneBatch()).toBe(running)
    await Promise.resolve()
    expect(feed.fetchChanges).toHaveBeenCalledOnce()
    release({ events: [event] })
    await expect(running).resolves.toMatchObject({ state: 'updating', inFlight: false, lastObservedCursor: 6 })
    await coordinator.runOneBatch()
    expect(feed.fetchChanges).toHaveBeenCalledTimes(2)
  })
  it('durably projects and advances a non-empty batch while status stays updating', async () => {
    const { coordinator, cursor, projection, durableCursor } = makeRealCoordinator()
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ state: 'updating', lastBatchCount: 1, lastObservedCursor: 6 })
    expect(projection).toEqual([event])
    expect(cursor.advanceCursor).toHaveBeenCalledWith(6)
    expect(durableCursor()).toBe(6)
  })
  it('reports projection and cursor-advance failures from real ingest', async () => {
    const projection = new IngestService({ upsertEvent: vi.fn().mockRejectedValue(new Error()) } as never, {} as never, {} as never, {} as never)
    const cursor = new IngestService({ upsertEvent: vi.fn() } as never, { advanceCursor: vi.fn().mockRejectedValue(new Error()) } as never, { upsertFromStatusChange: vi.fn() } as never, {} as never)
    await Promise.all([expect(projection.ingestBatch([event])).resolves.toEqual({ kind: 'failed', stage: 'projection' }), expect(cursor.ingestBatch([event])).resolves.toEqual({ kind: 'failed', stage: 'cursor-advance' })])
  })
  it('maps cursor, feed, and typed ingest failures and releases after each failure', async () => {
    const cursor = { getCursor: vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue(5), advanceCursor: vi.fn() }; const feed = { fetchChanges: vi.fn().mockRejectedValueOnce(new ChangeFeedTimeoutError()).mockRejectedValueOnce(new Error()).mockResolvedValue({ events: [event] }) }
    const ingest = { ingestBatch: vi.fn().mockResolvedValueOnce({ kind: 'failed', stage: 'projection' }).mockResolvedValueOnce({ kind: 'failed', stage: 'cursor-advance' }) }; const coordinator = new PlatformSyncCoordinator(feed as never, ingest as never, cursor as never)
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ failureCode: 'CURSOR_READ_FAILED', inFlight: false })
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ failureCode: 'FEED_TIMEOUT', lastObservedCursor: 5 })
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ failureCode: 'FEED_FAILED' })
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ failureCode: 'PROJECTION_FAILED', lastObservedCursor: 5 })
    await expect(coordinator.runOneBatch()).resolves.toMatchObject({ failureCode: 'CURSOR_ADVANCE_FAILED', lastObservedCursor: 5 })
    expect(feed.fetchChanges).toHaveBeenCalledTimes(4)
  })
  it('confirms an empty batch after failure without advancing its durable cursor', async () => {
    const { coordinator, cursor, feed } = makeRealCoordinator([])
    feed.fetchChanges.mockRejectedValueOnce(new ChangeFeedTimeoutError()); await expect(coordinator.runOneBatch()).resolves.toMatchObject({ state: 'failed', consecutiveFailureCount: 1 })
    const recovered = await coordinator.runOneBatch()
    expect(recovered).toMatchObject({ state: 'current', lastBatchCount: 0, lastObservedCursor: 5, consecutiveFailureCount: 0 })
    expect(recovered.lastSuccessAt).toEqual(expect.any(String)); expect(cursor.advanceCursor).not.toHaveBeenCalled()
  })
  it('snapshot starts stale with null observations, touches no dependency, and tracks an in-progress run without a new read', async () => {
    let release!: (value: { events: never[] }) => void
    const first = new Promise<{ events: never[] }>((resolve) => { release = resolve })
    const { coordinator, cursor, feed } = makeRealCoordinator(); feed.fetchChanges.mockImplementationOnce(() => first)
    expect(coordinator.getStatus()).toMatchObject({ state: 'stale', inFlight: false, lastAttemptAt: null, lastObservedCursor: null, failureCode: null })
    expect(cursor.getCursor).not.toHaveBeenCalled(); expect(feed.fetchChanges).not.toHaveBeenCalled()
    const running = coordinator.runOneBatch(); await Promise.resolve()
    expect(coordinator.getStatus()).toMatchObject({ state: 'updating', inFlight: true }); expect(feed.fetchChanges).toHaveBeenCalledOnce()
    release({ events: [] }); await running
  })
})
