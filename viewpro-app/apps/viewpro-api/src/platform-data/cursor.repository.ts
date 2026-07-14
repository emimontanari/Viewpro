import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

/**
 * CursorRepository — persists the poll cursor in the single-row platform_ingest_cursor table.
 *
 * D7: The cursor is only advanced AFTER the mirror upserts have committed durably.
 * This guarantees at-least-once delivery: a crash before the cursor advance causes
 * the poller to re-fetch the same batch on restart, and dedup absorbs the duplicates.
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the InmoView client.
 */
@Injectable()
export class CursorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read the current poll cursor (seqNo of the last successfully ingested event).
   * Assumes the seed row (id=1, seqNo=0) was created by the migration.
   *
   * W1: Prisma returns BigInt for BigInt columns. We convert to number at this
   * boundary — safe up to 2^53 events (Number.MAX_SAFE_INTEGER). The since/cursor
   * JSON contract uses number, so callers remain unaffected.
   */
  async getCursor(): Promise<number> {
    const row = await this.prisma.platformIngestCursor.findUniqueOrThrow({ where: { id: 1 } })
    return Number(row.seqNo)
  }

  /**
   * Advance the cursor to newSeqNo.
   * Must only be called after all mirror upserts in the batch have committed (D7).
   *
   * W1: accepts number at the call site (from the JSON/HTTP boundary) and
   * converts to BigInt for the Prisma write (BigInt column).
   */
  async advanceCursor(newSeqNo: number): Promise<void> {
    await this.prisma.platformIngestCursor.update({
      where: { id: 1 },
      data: { seqNo: BigInt(newSeqNo) },
    })
  }
}
