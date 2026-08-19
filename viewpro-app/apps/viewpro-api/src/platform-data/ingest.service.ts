import { Injectable, Logger } from '@nestjs/common'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import { MirrorRepository } from './mirror.repository'
import { CursorRepository } from './cursor.repository'
import { PlatformTenantRepository } from './platform-tenant.repository'
import { AuditLogRepository } from './audit-log.repository'

export type IngestBatchOutcome =
  | { kind: 'succeeded'; advancedCursor: number | null }
  | { kind: 'failed'; stage: 'projection' | 'cursor-advance' }

/**
 * IngestService — processes a batch of outbox events from the change-feed.
 *
 * D7 (advance-after-commit): All mirror upserts are issued first; the cursor
 *   advances only after every upsert in the batch has committed durably.
 *   A crash between the upserts and the cursor update causes the batch to be
 *   re-fetched on restart. UNIQUE(sourceEventId) on the mirror table makes
 *   re-processing idempotent (D8).
 *
 * A8: after the mirror upsert (which runs for every TENANT_* event), the
 *   batch is additionally routed by eventType into the `platform_tenants`
 *   projection:
 *     - TENANT_REGISTERED     → full identity + limits upsert
 *     - TENANT_STATUS_CHANGED → latestStatus (+ name/slug) upsert, create-if-missing (A9)
 *     - any other eventType   → skipped without error
 *
 * A6 (platform-audit-log): AUDIT_LOGGED events have no `newStatus` field. They
 *   are branched BEFORE the mirror upsert and routed EXCLUSIVELY to
 *   `platform_audit_log` via AuditLogRepository — never to the mirror and
 *   never to `platform_tenants`. Branching before the mirror means AUDIT_LOGGED
 *   never reaches the W2 guard, so it produces no false '[W2] malformed event'
 *   warning; the crux invariant (AUDIT_LOGGED absent from platform_mirror_events)
 *   holds by construction, keeping MetricsService's latest-event-wins query
 *   uncorrupted with ZERO MirrorRepository code change (A5).
 *
 * platform-manual-plans (Slice 4, Part 1) — D1: TENANT_LIMITS_CHANGED is
 *   likewise branched BEFORE the mirror upsert (same pattern as AUDIT_LOGGED)
 *   and routed straight to the `platform_tenants` projection via
 *   `routeToTenantProjection`. It also has no `newStatus` field, so it must
 *   never reach the mirror's W2 guard either — the same false-warning and
 *   metrics-corruption risk applies.
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
  async ingestBatch(events: PlatformOutboxEvent[]): Promise<IngestBatchOutcome> {
    if (events.length === 0) {
      return { kind: 'succeeded', advancedCursor: null }
    }

    try {
      for (const event of events) {
        // A6: AUDIT_LOGGED has no `newStatus`, so it must NOT reach
        // mirrorRepo.upsertEvent — the mirror's W2 guard would log a false
        // '[W2] Skipping malformed event' warning on every audit event,
        // flooding logs and burying genuine malformed-TENANT-event warnings.
        // Branch it BEFORE the mirror call so the crux invariant (AUDIT_LOGGED
        // is never written to platform_mirror_events) holds by construction.
        if (event.eventType === 'AUDIT_LOGGED') {
          await this.auditLogRepo.appendFromEvent(event)
          continue
        }
        // D1 (platform-manual-plans Part 1): TENANT_LIMITS_CHANGED is routed
        // straight to the projection, BEFORE (instead of) the mirror upsert —
        // it must never reach the mirror's W2 guard (mirrors the AUDIT_LOGGED
        // branch above).
        if (event.eventType === 'TENANT_LIMITS_CHANGED') {
          await this.routeToTenantProjection(event)
          continue
        }
        await this.mirrorRepo.upsertEvent(event)
        await this.routeToTenantProjection(event)
      }
    } catch (err) {
      // D7: cursor must NOT advance if mirror write failed.
      // Log-and-skip: retry next tick.
      this.logger.error('Failed to ingest batch — cursor not advanced; will retry next tick', err)
      return { kind: 'failed', stage: 'projection' }
    }

    // D7: advance cursor only after all upserts have committed.
    const maxSeqNo = Math.max(...events.map((e) => e.seqNo))
    try {
      await this.cursorRepo.advanceCursor(maxSeqNo)
    } catch (err) {
      // Cursor advance failure is also logged; the events are already in the mirror
      // so dedup ensures they won't be duplicated on the next re-poll.
      this.logger.error('Failed to advance cursor after successful ingest', err)
      return { kind: 'failed', stage: 'cursor-advance' }
    }
    return { kind: 'succeeded', advancedCursor: maxSeqNo }
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
    // A6: AUDIT_LOGGED is routed to platform_audit_log in ingestBatch BEFORE
    // the mirror upsert, so it never reaches this method (nor the mirror W2
    // guard). Only TENANT_* events flow through here.
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

    if (event.eventType === 'TENANT_LIMITS_CHANGED') {
      // Malformed payload (missing `limits`) is skipped without throwing —
      // non-stalling ingest posture, same as the newStatus guards above.
      const payload = event.payload as { limits?: unknown } & Record<string, unknown>
      if (!payload.limits) {
        return
      }
      await this.tenantRepo.applyLimitsChange(
        event.tenantId,
        payload.limits as Parameters<PlatformTenantRepository['applyLimitsChange']>[1],
      )
      return
    }

    // Unknown eventType — skip projection routing without error; the mirror
    // append above already ran, and the cursor still advances normally.
  }
}
