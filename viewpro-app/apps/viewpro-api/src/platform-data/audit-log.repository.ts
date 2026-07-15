import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * AuditLogRepository — persists inbound AUDIT_LOGGED events to the
 * append-only `platform_audit_log` projection (vision D3).
 *
 * Idempotency (A8): uses upsert with `update: {}` so a re-delivered event
 * with the same sourceEventId results in a no-op rather than an error or a
 * duplicate row — mirrors MirrorRepository.upsertEvent exactly. This is the
 * SOLE dedup mechanism for AUDIT_LOGGED events — the mirror plays no role
 * (AUDIT_LOGGED is never written to platform_mirror_events, A5/A6).
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the InmoView client.
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendFromEvent(event: PlatformOutboxEvent): Promise<void> {
    const payload = event.payload as {
      action: string
      previousValue?: unknown
      newValue?: unknown
      actor: unknown
    }

    await this.prisma.platformAuditLog.upsert({
      where: { sourceEventId: event.id },
      update: {}, // no-op on conflict — idempotent (A8, mirrors MirrorRepository)
      create: {
        sourceEventId: event.id,
        // W1: convert number (JSON/HTTP boundary) to BigInt (Prisma BigInt column)
        seqNo: BigInt(event.seqNo),
        action: payload.action,
        tenantId: event.tenantId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actor: payload.actor as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previousValue: payload.previousValue as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: payload.newValue as any,
        occurredAt: new Date(event.occurredAt),
      },
    })
  }
}
