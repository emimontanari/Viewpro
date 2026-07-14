import { Injectable, Logger } from '@nestjs/common'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import { MirrorRepository } from './mirror.repository'
import { CursorRepository } from './cursor.repository'

/**
 * IngestService — processes a batch of outbox events from the change-feed.
 *
 * D7 (advance-after-commit): All mirror upserts are issued first; the cursor
 *   advances only after every upsert in the batch has committed durably.
 *   A crash between the upserts and the cursor update causes the batch to be
 *   re-fetched on restart. UNIQUE(sourceEventId) on the mirror table makes
 *   re-processing idempotent (D8).
 *
 * Feed error handling: a failure during any single event's upsert causes the
 *   entire batch to be logged-and-skipped. The cursor does NOT advance, so the
 *   poller retries the same batch on the next tick.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)

  constructor(
    private readonly mirrorRepo: MirrorRepository,
    private readonly cursorRepo: CursorRepository,
  ) {}

  /**
   * Ingest a batch of events from the change-feed.
   *
   * - Upserts each event into the mirror (idempotent — ON CONFLICT DO NOTHING).
   * - Advances the cursor to the max seqNo in the batch ONLY after all upserts commit.
   * - On any error: logs and skips — the cursor is NOT advanced.
   */
  async ingestBatch(events: PlatformOutboxEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    try {
      for (const event of events) {
        await this.mirrorRepo.upsertEvent(event)
      }
    } catch (err) {
      // D7: cursor must NOT advance if mirror write failed.
      // Log-and-skip: retry next tick.
      this.logger.error('Failed to ingest batch — cursor not advanced; will retry next tick', err)
      return
    }

    // D7: advance cursor only after all upserts have committed.
    const maxSeqNo = Math.max(...events.map((e) => e.seqNo))
    try {
      await this.cursorRepo.advanceCursor(maxSeqNo)
    } catch (err) {
      // Cursor advance failure is also logged; the events are already in the mirror
      // so dedup ensures they won't be duplicated on the next re-poll.
      this.logger.error('Failed to advance cursor after successful ingest', err)
    }
  }
}
