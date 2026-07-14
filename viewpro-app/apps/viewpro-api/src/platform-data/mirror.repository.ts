import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * MirrorRepository — persists inbound platform events to the local mirror table.
 *
 * Idempotency (D8): uses upsert with `update: {}` so a re-delivered event with the
 * same sourceEventId results in a no-op rather than an error or a duplicate row.
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the InmoView client.
 */
@Injectable()
export class MirrorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a single event into the mirror.
   * ON CONFLICT (sourceEventId) DO NOTHING — idempotent by design.
   */
  async upsertEvent(event: PlatformOutboxEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>
    const newStatus = (payload['newStatus'] as string | undefined) ?? ''

    await this.prisma.platformMirrorEvent.upsert({
      where: { sourceEventId: event.id },
      update: {}, // no-op on conflict — idempotent
      create: {
        sourceEventId: event.id,
        eventType: event.eventType,
        tenantId: event.tenantId,
        newStatus,
        occurredAt: new Date(event.occurredAt),
        seqNo: event.seqNo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: event.payload as any,
      },
    })
  }
}
