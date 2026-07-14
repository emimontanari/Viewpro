import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * MirrorRepository — persists inbound platform events to the local mirror table.
 *
 * Idempotency (D8): uses upsert with `update: {}` so a re-delivered event with the
 * same sourceEventId results in a no-op rather than an error or a duplicate row.
 *
 * W2 (malformed-event guard): if an event's payload.newStatus is missing or empty,
 * the event is logged and skipped — no '' row is written to the mirror. The cursor
 * may still advance past it (a malformed event must not stall the pipe indefinitely).
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the InmoView client.
 */
@Injectable()
export class MirrorRepository {
  private readonly logger = new Logger(MirrorRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a single event into the mirror.
   * ON CONFLICT (sourceEventId) DO NOTHING — idempotent by design.
   *
   * W2: skips events whose payload.newStatus is missing or empty to avoid
   * persisting a blank '' row that would corrupt the metrics bucket counts.
   */
  async upsertEvent(event: PlatformOutboxEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>
    const newStatus = (payload['newStatus'] as string | undefined) ?? ''

    // W2: reject malformed events — a missing/empty newStatus would create a
    // '' row that pollutes latest-event-wins metrics. Log a warning and skip.
    // The cursor may still advance past this event (non-stalling skip).
    if (newStatus === '') {
      this.logger.warn(
        `[W2] Skipping malformed event ${event.id} (seqNo=${event.seqNo}): payload.newStatus is missing or empty`,
      )
      return
    }

    await this.prisma.platformMirrorEvent.upsert({
      where: { sourceEventId: event.id },
      update: {}, // no-op on conflict — idempotent
      create: {
        sourceEventId: event.id,
        eventType: event.eventType,
        tenantId: event.tenantId,
        newStatus,
        occurredAt: new Date(event.occurredAt),
        // W1: convert number (JSON/HTTP boundary) to BigInt (Prisma BigInt column)
        seqNo: BigInt(event.seqNo),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: event.payload as any,
      },
    })
  }
}
