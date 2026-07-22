import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

export interface MetricsSummary {
  tenants: number
  byStatus: Record<string, number>
  generatedAt: string
}

/**
 * MetricsService — derives operator metrics from the local mirror ONLY.
 *
 * D6 (latest-event-wins): For each tenantId, the row with the highest seqNo
 * represents the current status. This is implemented as a subquery that selects
 * the max seqNo per tenant, then groups and counts by newStatus.
 *
 * Isolation invariant: this service NEVER queries InmoView's database.
 * It uses only PrismaService (@prisma-platform/client) against viewpro_platform.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the operator metrics summary derived from the mirror table.
   *
   * Strategy (D6): subquery to find max seqNo per tenant, join back to get
   * newStatus for those rows, then group and count.
   */
  async getSummary(): Promise<MetricsSummary> {
    // Use raw SQL for the DISTINCT ON (tenantId) ORDER BY seqNo DESC pattern (D6)
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string; newStatus: string }>>`
      SELECT DISTINCT ON ("tenantId") "tenantId", "newStatus"
      FROM "platform_mirror_events"
      ORDER BY "tenantId", "seqNo" DESC
    `

    const byStatus: Record<string, number> = {}
    for (const row of rows) {
      byStatus[row.newStatus] = (byStatus[row.newStatus] ?? 0) + 1
    }

    return {
      tenants: rows.length,
      byStatus,
      generatedAt: new Date().toISOString(),
    }
  }
}
