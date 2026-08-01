import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma-platform/client'
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
  private readonly logger = new Logger(AuditLogRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async appendFromEvent(event: PlatformOutboxEvent): Promise<void> {
    const payload = event.payload as {
      action?: string
      previousValue?: unknown
      newValue?: unknown
      actor?: unknown
    }

    // W2-equivalent malformed-payload guard (mirrors MirrorRepository's W2
    // log-and-skip): the projection requires a non-empty `action`, a present
    // `actor`, and a non-empty `tenantId`. If any is missing/empty, log a
    // warning and SKIP — do NOT throw, so the cursor still advances past this
    // event (non-stalling; a malformed event must not head-of-line-block the
    // batch forever). Genuine infrastructure/DB errors are NOT swallowed —
    // they still surface from the upsert below.
    if (!payload.action || payload.actor == null || !event.tenantId) {
      this.logger.warn(
        `[W2] Skipping malformed audit event ${event.id} (seqNo=${event.seqNo}): payload.action/actor or tenantId is missing or empty`,
      )
      return
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

  /**
   * appendNative — writes a ViewPro-native operator-management audit entry
   * (platform-operator-management A4, Decision 1). Always `source:
   * VIEWPRO_NATIVE` and `sourceEventId: null` — Postgres allows multiple NULLs
   * in a unique column, so this NEVER collides with (or dedupes against) the
   * InmoView-outbox `appendFromEvent` path above, which is left untouched.
   *
   * Atomicity (JD FIX 1): accepts an optional transaction client so the native
   * audit write commits-or-rolls-back TOGETHER with the operator mutation that
   * produced it (create/role/status). When `tx` is provided the row is written
   * via that transaction; otherwise it falls back to `this.prisma` (standalone
   * write, e.g. tests). Mirrors the tx-threading of the operator repo methods.
   */
  async appendNative(
    entry: {
      action:
        | 'OPERATOR_CREATED'
        | 'OPERATOR_ROLE_CHANGED'
        | 'OPERATOR_SUSPENDED'
        | 'OPERATOR_REACTIVATED'
        // operator-activity-media (Slice 2a, D7): every successful
        // platform-lane document read-URL mint writes one of these — no
        // dedup (unlike appendFromEvent's sourceEventId upsert): each mint
        // is a distinct access event and gets its own row.
        | 'TENANT_DOCUMENT_VIEWED'
        // platform-payment-ledger: money mutations audit through this same
        // native path, sharing the caller's transaction so a payment can
        // never exist without the row that attributes it.
        | 'PAYMENT_RECORDED'
        | 'PAYMENT_REVERSED'
      actor: { id: string; email: string }
      // operator-activity-media (Slice 2a, D7): TENANT_DOCUMENT_VIEWED's
      // target is `{documentVersionId, filename}`, distinct from the
      // OPERATOR_* actions' `{id, email}` — both are stored as-is in the
      // free-form Json `target` column.
      target:
        | { id: string; email: string }
        | { documentVersionId: string; filename: string }
        // platform-payment-ledger: the target of a money action is the payment
        // row itself; a reversal additionally names the row it created.
        | { paymentId: string; reversalId?: string }
      previousValue?: unknown
      newValue?: unknown
      // operator-activity-media (Slice 2a, D7): optional — the operator-
      // management actions above have no tenant context; TENANT_DOCUMENT_VIEWED
      // always supplies it. Column is already nullable (Decision 1).
      tenantId?: string
    },
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await tx.platformAuditLog.create({
      data: {
        sourceEventId: null,
        source: 'VIEWPRO_NATIVE',
        action: entry.action,
        tenantId: entry.tenantId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actor: entry.actor as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        target: entry.target as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previousValue: (entry.previousValue ?? null) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: (entry.newValue ?? null) as any,
        occurredAt: new Date(),
      },
    })
  }
}
