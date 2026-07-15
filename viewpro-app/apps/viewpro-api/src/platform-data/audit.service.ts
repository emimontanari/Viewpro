import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

export type AuditLogItem = {
  id: string
  action: string
  tenantId: string
  actor: unknown
  previousValue: unknown
  newValue: unknown
  occurredAt: string
  seqNo: number
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
   * List audit rows sorted by seqNo DESC (newest first), paginated by
   * offset/limit.
   *
   * A9: `limit` is capped at 200 regardless of the requested value.
   */
  async listAudit(offset = 0, limit: number = DEFAULT_LIMIT): Promise<AuditFeedList> {
    const cappedLimit = Math.min(limit, MAX_LIMIT)

    const [total, rows] = await Promise.all([
      this.prisma.platformAuditLog.count(),
      this.prisma.platformAuditLog.findMany({
        skip: offset,
        take: cappedLimit,
        orderBy: { seqNo: 'desc' },
      }),
    ])

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        tenantId: row.tenantId,
        actor: row.actor,
        previousValue: row.previousValue,
        newValue: row.newValue,
        occurredAt: row.occurredAt.toISOString(),
        // W1: convert BigInt (Prisma column) to number at the JSON boundary
        // (mirrors PrismaOutboxRepository.findSince / CursorRepository).
        seqNo: Number(row.seqNo),
      })),
    }
  }
}
