import { describe, expect, it, vi } from 'vitest'
import { IngestService } from '../ingest.service'
import { PlatformSyncCoordinator } from '../platform-sync-coordinator'
import { raceDemand } from '../platform-sync.controller'

const event = { seqNo: 6, eventType: 'TENANT_STATUS_CHANGED', tenantId: 't-1', payload: { newStatus: 'ACTIVE' } } as never

// D.2 pre-change gate (#327, AC8–AC9). Run/passed while the timer still
// existed, before D.3 deleted it (apply-progress.md has that run); rewritten
// against `coordinator.runOneBatch()` directly — the same call a rolled-back
// timer-bearing image makes — so it stays meaningful post-deletion. Other
// matrix quadrants: new-API+new-web (Slice B integration, real HTTP);
// new-web+old-API 404 fallback (`use-platform-sync-demand.spec.ts`);
// old-web+new-API DI coexistence (`platform-data.module.spec.ts`).
function makeInfra(events: unknown[] = [event]) {
  let durableCursor = 5
  const cursor = {
    getCursor: vi.fn(() => Promise.resolve(durableCursor)),
    advanceCursor: vi.fn((value: number) => { durableCursor = value }),
  }
  const feed = { fetchChanges: vi.fn().mockResolvedValue({ events }) }
  const ingest = new IngestService({ upsertEvent: vi.fn() } as never, cursor as never, { upsertFromStatusChange: vi.fn() } as never, {} as never)
  return { cursor, feed, ingest }
}

describe('Slice D.2 pre-change gate — old/new API-web compatibility and reverse rollback', () => {
  it('an external caller invoking runOneBatch directly drives a full batch with no demand call (rollback-to-timer-only)', async () => {
    const { cursor, feed, ingest } = makeInfra()
    const coordinator = new PlatformSyncCoordinator(feed as never, ingest, cursor as never)
    await coordinator.runOneBatch() // never touches PlatformSyncController
    expect(feed.fetchChanges).toHaveBeenCalledWith(5)
    expect(cursor.advanceCursor).toHaveBeenCalledWith(6)
    expect(coordinator.getStatus()).toMatchObject({ state: 'updating', lastBatchCount: 1, failureCode: null })
  })

  it('demand and a rolled-back timer-only caller share one coordinator, so an already-advanced batch is never re-processed', async () => {
    const { cursor, feed, ingest } = makeInfra()
    const coordinator = new PlatformSyncCoordinator(feed as never, ingest, cursor as never)
    await raceDemand(coordinator.runOneBatch(), () => coordinator.getStatus(), 4000)
    expect(cursor.advanceCursor).toHaveBeenCalledTimes(1)
    feed.fetchChanges.mockResolvedValueOnce({ events: [] })
    await coordinator.runOneBatch() // simulates the rolled-back image's own interval
    expect(feed.fetchChanges).toHaveBeenLastCalledWith(6)
    expect(coordinator.getStatus()).toMatchObject({ state: 'current', lastBatchCount: 0 })
  })
})
