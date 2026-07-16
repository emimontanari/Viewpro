import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

export type AuditLogItem = {
  id: string
  action: string
  tenantId: string | null
  actor: unknown
  target: unknown
  previousValue: unknown
  newValue: unknown
  occurredAt: string
  seqNo: number | null
  source: 'INMOVIEW_OUTBOX' | 'VIEWPRO_NATIVE'
}

export type AuditFeedList = {
  total: number
  items: AuditLogItem[]
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * AuditService — paginated read of the operator global audit feed (A9/A10).
 *
 * Reads EXCLUSIVELY from `platform_audit_log` via PrismaService
 * (@prisma-platform/client) — never touches InmoView's database.
 *
 * Q3: no tenantId filter — the feed is intentionally global-only.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List audit rows sorted by occurredAt DESC (newest first), paginated by
   * offset/limit. Interleaves InmoView-outbox rows (source=INMOVIEW_OUTBOX,
   * populated seqNo/tenantId) and ViewPro-native rows
   * (source=VIEWPRO_NATIVE, seqNo/tenantId null, target populated) —
   * platform-operator-management (A4), Decision 1.
   *
   * A9: `limit` is capped at 200 regardless of the requested value.
   *
   * Ordering changed from `seqNo: 'desc'` to `occurredAt: 'desc'` because
   * native rows have no seqNo (null) — occurredAt is the only field both
   * origins always populate, so it is the sole correct interleave key.
   */
  async listAudit(offset = 0, limit: number = DEFAULT_LIMIT): Promise<AuditFeedList> {
    const cappedLimit = Math.min(limit, MAX_LIMIT)

    const [total, rows] = await Promise.all([
      this.prisma.platformAuditLog.count(),
      this.prisma.platformAuditLog.findMany({
        skip: offset,
        take: cappedLimit,
        orderBy: { occurredAt: 'desc' },
      }),
    ])

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        tenantId: row.tenantId,
        actor: row.actor,
        target: row.target,
        previousValue: row.previousValue,
        newValue: row.newValue,
        occurredAt: row.occurredAt.toISOString(),
        // W1: convert BigInt (Prisma column) to number at the JSON boundary
        // (mirrors PrismaOutboxRepository.findSince / CursorRepository).
        // Native rows have seqNo: null — preserved as null, never coerced to 0.
        seqNo: row.seqNo === null ? null : Number(row.seqNo),
        source: row.source,
      })),
    }
  }
}
