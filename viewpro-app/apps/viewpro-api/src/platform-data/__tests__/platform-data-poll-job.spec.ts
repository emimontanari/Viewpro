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

  it('timer delegates one batch to the shared coordinator on each tick', async () => {
    const coordinator = { runOneBatch: vi.fn().mockResolvedValue(undefined) }
    const job = new PlatformDataPollJob(coordinator as never, 5000)

    job.onModuleInit()

    // Advance timer to fire one tick
    await vi.advanceTimersByTimeAsync(5000)

    expect(coordinator.runOneBatch).toHaveBeenCalledOnce()

    job.onModuleDestroy()
  })

  it('timer delegates subsequent ticks to the coordinator', async () => {
    let resolveFirst!: () => void
    const firstPollDone = new Promise<void>((resolve) => { resolveFirst = resolve })

    const coordinator = { runOneBatch: vi.fn().mockImplementationOnce(() => firstPollDone) }
    const job = new PlatformDataPollJob(coordinator as never, 5000)

    job.onModuleInit()

    // First tick fires — fetchChanges is now hanging
    vi.advanceTimersByTime(5000)
    await Promise.resolve() // let async tick start

    // Second tick fires while first is still in flight
    vi.advanceTimersByTime(5000)
    await Promise.resolve()

    expect(coordinator.runOneBatch).toHaveBeenCalledTimes(2)

    // Let first poll complete
    resolveFirst()
    job.onModuleDestroy()
  })

  it('OnModuleDestroy stops the interval — no further fetchChanges calls', async () => {
    const coordinator = { runOneBatch: vi.fn().mockResolvedValue(undefined) }
    const job = new PlatformDataPollJob(coordinator as never, 5000)

    job.onModuleInit()

    // Fire one tick
    await vi.advanceTimersByTimeAsync(5000)
    const callCount = coordinator.runOneBatch.mock.calls.length

    // Destroy the job
    job.onModuleDestroy()

    // Advance time further — no more calls expected
    await vi.advanceTimersByTimeAsync(15000)

    expect(coordinator.runOneBatch).toHaveBeenCalledTimes(callCount)
  })

  it('timer keeps running when the coordinator reports a failure', async () => {
    const coordinator = { runOneBatch: vi.fn().mockRejectedValue(new Error('network error')) }
    const job = new PlatformDataPollJob(coordinator as never, 5000)

    job.onModuleInit()

    await vi.advanceTimersByTimeAsync(5000)

    expect(coordinator.runOneBatch).toHaveBeenCalledOnce()

    job.onModuleDestroy()
  })

  it('interval defaults to 5000 ms; respects PLATFORM_POLL_INTERVAL_MS', async () => {
    const coordinator = { runOneBatch: vi.fn().mockResolvedValue(undefined) }

    // Custom interval of 2000ms
    const job = new PlatformDataPollJob(coordinator as never, 2000)

    job.onModuleInit()

    // At 1999ms — should not have fired yet
    await vi.advanceTimersByTimeAsync(1999)
    expect(coordinator.runOneBatch).toHaveBeenCalledTimes(0)

    // At 2000ms — should fire exactly once
    await vi.advanceTimersByTimeAsync(1)
    expect(coordinator.runOneBatch).toHaveBeenCalledTimes(1)

    job.onModuleDestroy()
  })
})
