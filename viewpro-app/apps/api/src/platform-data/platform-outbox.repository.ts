import { Injectable } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaService } from '../database/prisma.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * PrismaOutboxRepository — read-side repository for the change-feed endpoint.
 *
 * Queries platform_outbox_events with seqNo > cursor, ordered by seqNo ASC,
 * limited to batchSize rows. Never mutates any outbox row (read-only, D1).
 *
 * Note: BigInt seqNo from Prisma is converted to a JS number for JSON safety.
 * This is safe for slice-1 volumes (2^53 boundary only at ~9 quadrillion events).
 */
@Injectable()
export class PrismaOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSince(cursor: number, limit: number): Promise<PlatformOutboxEvent[]> {
    const rows = await this.prisma.platformOutboxEvent.findMany({
      where: {
        seqNo: {
          gt: BigInt(cursor),
        },
      },
      orderBy: {
        seqNo: 'asc',
      },
      take: limit,
    })

    return rows.map((row) => ({
      id: row.id,
      // Convert BigInt to number — safe for slice-1 volumes (seqNo << 2^53)
      seqNo: Number(row.seqNo),
      eventType: row.eventType as 'TENANT_STATUS_CHANGED',
      tenantId: row.tenantId,
      payload: row.payload as PlatformOutboxEvent['payload'],
      // Serialize Date to ISO string
      occurredAt: row.occurredAt.toISOString(),
    }))
  }
}
