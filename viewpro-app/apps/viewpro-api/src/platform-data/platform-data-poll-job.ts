import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ChangeFeedClient } from './change-feed.client'
import { IngestService } from './ingest.service'
import { CursorRepository } from './cursor.repository'

/**
 * PlatformDataPollJob — interval-based poll job for the data lane.
 *
 * D9 design choices:
 *  - Uses Node.js `setInterval` directly (no @nestjs/schedule, no BullMQ).
 *  - Boolean overlap guard: if a poll is already in flight, the next tick is
 *    silently skipped (no queued ticks, no pile-up).
 *  - OnModuleDestroy clears the interval for clean shutdown.
 *
 * Feed error handling: any error from fetchChanges or ingestBatch is caught,
 * logged, and the tick exits without advancing the cursor. The interval fires
 * again on the next tick for an automatic retry.
 */
@Injectable()
export class PlatformDataPollJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformDataPollJob.name)
  private isPolling = false
  private intervalHandle: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly feedClient: ChangeFeedClient,
    private readonly ingestService: IngestService,
    private readonly cursorRepo: CursorRepository,
    private readonly pollIntervalMs: number = 5000,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      void this.tick()
    }, this.pollIntervalMs)

    this.logger.log(
      `PlatformDataPollJob started — interval ${this.pollIntervalMs}ms`,
    )
  }

  onModuleDestroy(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
      this.logger.log('PlatformDataPollJob stopped')
    }
  }

  /**
   * Single poll tick.
   *
   * Overlap guard: if `isPolling` is already true, this tick is skipped
   * entirely — no concurrent polls, no pile-up.
   */
  private async tick(): Promise<void> {
    if (this.isPolling) {
      this.logger.debug('Poll tick skipped — previous poll still in flight')
      return
    }

    this.isPolling = true
    try {
      const cursor = await this.cursorRepo.getCursor()
      const response = await this.feedClient.fetchChanges(cursor)
      await this.ingestService.ingestBatch(response.events)
    } catch (err) {
      this.logger.error('Poll tick error — will retry next interval', err)
    } finally {
      this.isPolling = false
    }
  }
}
