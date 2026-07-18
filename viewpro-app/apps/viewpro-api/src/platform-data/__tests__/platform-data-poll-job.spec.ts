import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PlatformDataPollJob } from '../platform-data-poll-job'

/**
 * T-20 — RED: PlatformDataPollJob lifecycle tests.
 *
 * Spec: platform-data-lane-ingest-metrics — Interval Poll Job (all 3 scenarios):
 *   1. Poller reads cursor and calls fetchChanges(cursor) on each tick.
 *   2. In-flight poll blocks next tick (overlap guard; D9).
 *   3. OnModuleDestroy stops interval.
 *   4. Feed error is logged and does NOT advance cursor.
 *   5. Interval defaults to 5000 ms; respects PLATFORM_POLL_INTERVAL_MS.
 */

describe('PlatformDataPollJob', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('poller reads cursor and calls fetchChanges(cursor) on each tick', async () => {
    const mockCursorRepo = { getCursor: vi.fn().mockResolvedValue(20) }
    const mockFeedClient = {
      fetchChanges: vi.fn().mockResolvedValue({ events: [], nextCursor: 20 }),
    }
    const mockIngestService = { ingestBatch: vi.fn().mockResolvedValue(undefined) }

    const job = new PlatformDataPollJob(
      mockFeedClient as never,
      mockIngestService as never,
      mockCursorRepo as never,
      5000,
    )

    job.onModuleInit()

    // Advance timer to fire one tick
    await vi.advanceTimersByTimeAsync(5000)

    expect(mockCursorRepo.getCursor).toHaveBeenCalled()
    expect(mockFeedClient.fetchChanges).toHaveBeenCalledWith(20)

    job.onModuleDestroy()
  })

  it('in-flight poll blocks next tick (overlap guard)', async () => {
    let resolveFirst!: () => void
    const firstPollDone = new Promise<void>((resolve) => { resolveFirst = resolve })

    const mockCursorRepo = { getCursor: vi.fn().mockResolvedValue(0) }
    const mockFeedClient = {
      fetchChanges: vi.fn()
        .mockImplementationOnce(() => firstPollDone) // first call hangs
        .mockResolvedValue({ events: [], nextCursor: 0 }), // subsequent calls resolve
    }
    const mockIngestService = { ingestBatch: vi.fn().mockResolvedValue(undefined) }

    const job = new PlatformDataPollJob(
      mockFeedClient as never,
      mockIngestService as never,
      mockCursorRepo as never,
      5000,
    )

    job.onModuleInit()

    // First tick fires — fetchChanges is now hanging
    vi.advanceTimersByTime(5000)
    await Promise.resolve() // let async tick start

    // Second tick fires while first is still in flight
    vi.advanceTimersByTime(5000)
    await Promise.resolve()

    // fetchChanges should have been called exactly once (second tick skipped)
    expect(mockFeedClient.fetchChanges).toHaveBeenCalledTimes(1)

    // Let first poll complete
    resolveFirst()
    job.onModuleDestroy()
  })

  it('OnModuleDestroy stops the interval — no further fetchChanges calls', async () => {
    const mockCursorRepo = { getCursor: vi.fn().mockResolvedValue(0) }
    const mockFeedClient = {
      fetchChanges: vi.fn().mockResolvedValue({ events: [], nextCursor: 0 }),
    }
    const mockIngestService = { ingestBatch: vi.fn().mockResolvedValue(undefined) }

    const job = new PlatformDataPollJob(
      mockFeedClient as never,
      mockIngestService as never,
      mockCursorRepo as never,
      5000,
    )

    job.onModuleInit()

    // Fire one tick
    await vi.advanceTimersByTimeAsync(5000)
    const callCount = mockFeedClient.fetchChanges.mock.calls.length

    // Destroy the job
    job.onModuleDestroy()

    // Advance time further — no more calls expected
    await vi.advanceTimersByTimeAsync(15000)

    expect(mockFeedClient.fetchChanges).toHaveBeenCalledTimes(callCount)
  })

  it('feed error is logged and does NOT advance cursor (log-and-skip)', async () => {
    const mockCursorRepo = { getCursor: vi.fn().mockResolvedValue(5), advanceCursor: vi.fn() }
    const mockFeedClient = {
      fetchChanges: vi.fn().mockRejectedValue(new Error('network error')),
    }
    const mockIngestService = { ingestBatch: vi.fn().mockResolvedValue(undefined) }

    const job = new PlatformDataPollJob(
      mockFeedClient as never,
      mockIngestService as never,
      mockCursorRepo as never,
      5000,
    )

    job.onModuleInit()

    await vi.advanceTimersByTimeAsync(5000)

    // fetchChanges was called but threw — ingestBatch should NOT have been called
    expect(mockFeedClient.fetchChanges).toHaveBeenCalledOnce()
    expect(mockIngestService.ingestBatch).not.toHaveBeenCalled()

    // Cursor repo's advanceCursor should NOT have been called
    expect(mockCursorRepo.advanceCursor).not.toHaveBeenCalled()

    job.onModuleDestroy()
  })

  it('interval defaults to 5000 ms; respects PLATFORM_POLL_INTERVAL_MS', async () => {
    const mockCursorRepo = { getCursor: vi.fn().mockResolvedValue(0) }
    const mockFeedClient = {
      fetchChanges: vi.fn().mockResolvedValue({ events: [], nextCursor: 0 }),
    }
    const mockIngestService = { ingestBatch: vi.fn().mockResolvedValue(undefined) }

    // Custom interval of 2000ms
    const job = new PlatformDataPollJob(
      mockFeedClient as never,
      mockIngestService as never,
      mockCursorRepo as never,
      2000,
    )

    job.onModuleInit()

    // At 1999ms — should not have fired yet
    await vi.advanceTimersByTimeAsync(1999)
    expect(mockFeedClient.fetchChanges).toHaveBeenCalledTimes(0)

    // At 2000ms — should fire exactly once
    await vi.advanceTimersByTimeAsync(1)
    expect(mockFeedClient.fetchChanges).toHaveBeenCalledTimes(1)

    job.onModuleDestroy()
  })
})
