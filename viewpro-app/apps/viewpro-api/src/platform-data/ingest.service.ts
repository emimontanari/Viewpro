import { Injectable, Logger } from '@nestjs/common'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import { MirrorRepository } from './mirror.repository'
import { CursorRepository } from './cursor.repository'
import { PlatformTenantRepository } from './platform-tenant.repository'
import { AuditLogRepository } from './audit-log.repository'

/**
 * IngestService — processes a batch of outbox events from the change-feed.
 *
 * D7 (advance-after-commit): All mirror upserts are issued first; the cursor
 *   advances only after every upsert in the batch has committed durably.
 *   A crash between the upserts and the cursor update causes the batch to be
 *   re-fetched on restart. UNIQUE(sourceEventId) on the mirror table makes
 *   re-processing idempotent (D8).
 *
 * A8: after the mirror upsert (which runs for EVERY event regardless of
 *   eventType), the batch is additionally routed by eventType into the
 *   `platform_tenants` projection:
 *     - TENANT_REGISTERED     → full identity + limits upsert
 *     - TENANT_STATUS_CHANGED → latestStatus (+ name/slug) upsert, create-if-missing (A9)
 *     - any other eventType   → skipped without error
 *
 * A6 (platform-audit-log): AUDIT_LOGGED events have no `newStatus` field, so
 *   they must NOT go through the TENANT_* newStatus-guarded branches. They
 *   are routed EXCLUSIVELY to `platform_audit_log` via AuditLogRepository —
 *   never to `platform_tenants`. The mirror upsert above already W2-skips
 *   AUDIT_LOGGED (no `newStatus`) with ZERO MirrorRepository code change
 *   (A5) — this keeps MetricsService's latest-event-wins query uncorrupted.
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
    private readonly tenantRepo: PlatformTenantRepository,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  /**
   * Ingest a batch of events from the change-feed.
   *
   * - Upserts each event into the mirror (idempotent — ON CONFLICT DO NOTHING).
   * - Routes each event into the `platform_tenants` projection by eventType (A8/A9).
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
        await this.routeToTenantProjection(event)
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

  /**
   * A8/A9: route a single event into the `platform_tenants` projection by
   * eventType. Any other eventType is skipped without error (forward
   * compatibility with future event types).
   *
   * Mirrors the mirror repo's W2 guard: a malformed payload with a missing
   * `newStatus` is skipped here too — this prevents a blank/undefined
   * `latestStatus` from being persisted (same malformed-event contract as
   * the mirror table, so existing malformed-event regression coverage
   * continues to hold for the projection as well).
   */
  private async routeToTenantProjection(event: PlatformOutboxEvent): Promise<void> {
    // A6: AUDIT_LOGGED has no newStatus — must NOT go through the TENANT_*
    // newStatus guards below. Routes exclusively to platform_audit_log.
    if (event.eventType === 'AUDIT_LOGGED') {
      await this.auditLogRepo.appendFromEvent(event)
      return
    }

    if (event.eventType === 'TENANT_REGISTERED') {
      const payload = event.payload as { newStatus?: string } & Record<string, unknown>
      if (!payload.newStatus) {
        return
      }
      await this.tenantRepo.upsertFromRegistered(
        event.payload as Parameters<PlatformTenantRepository['upsertFromRegistered']>[0],
      )
      return
    }

    if (event.eventType === 'TENANT_STATUS_CHANGED') {
      const payload = event.payload as { newStatus?: string } & Record<string, unknown>
      if (!payload.newStatus) {
        return
      }
      await this.tenantRepo.upsertFromStatusChange(
        event.tenantId,
        event.payload as Parameters<PlatformTenantRepository['upsertFromStatusChange']>[1],
      )
      return
    }

    // Unknown eventType — skip projection routing without error; the mirror
    // append above already ran, and the cursor still advances normally.
  }
}
