import { Inject, Injectable } from '@nestjs/common'
import { AnalyticsEventName } from '@prisma/client'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../analytics.repository'

export type GetPilotSummaryInput = {
  tenantId: string
  now?: Date
  from?: Date
  to?: Date
}

export type PilotSummaryResponse = {
  window: {
    from: string
    to: string
  }
  activeEngagements: number
  activeEngagementsWithOwnerVisibleUpdate: number
  activeEngagementUpdatePercentage: number
  documentEvents: {
    requested: number
    uploaded: number
    approved: number
    rejected: number
  }
  ownerViewedPropertyCount: number
}

@Injectable()
export class GetPilotSummaryUseCase {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepository: AnalyticsRepository) {}

  async execute(input: GetPilotSummaryInput): Promise<PilotSummaryResponse> {
    const window = resolveCurrentWeekWindow(input)
    const [
      activeEngagements,
      activeEngagementsWithOwnerVisibleUpdate,
      requested,
      uploaded,
      approved,
      rejected,
      ownerViewedPropertyCount,
    ] = await Promise.all([
      this.analyticsRepository.countActiveEngagements({ tenantId: input.tenantId }),
      this.analyticsRepository.countActiveEngagementsWithOwnerVisibleUpdate({ tenantId: input.tenantId, ...window }),
      this.countReportEvent(input.tenantId, AnalyticsEventName.DOCUMENT_REQUESTED, window),
      this.countReportEvent(input.tenantId, AnalyticsEventName.DOCUMENT_UPLOADED, window),
      this.countReportEvent(input.tenantId, AnalyticsEventName.DOCUMENT_APPROVED, window),
      this.countReportEvent(input.tenantId, AnalyticsEventName.DOCUMENT_REJECTED, window),
      this.countReportEvent(input.tenantId, AnalyticsEventName.OWNER_VIEWED_PROPERTY, window),
    ])

    return {
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      activeEngagements,
      activeEngagementsWithOwnerVisibleUpdate,
      activeEngagementUpdatePercentage: calculatePercentage(activeEngagementsWithOwnerVisibleUpdate, activeEngagements),
      documentEvents: { requested, uploaded, approved, rejected },
      ownerViewedPropertyCount,
    }
  }

  private countReportEvent(
    tenantId: string,
    eventName: AnalyticsEventName,
    window: { from: Date; to: Date },
  ): Promise<number> {
    return this.analyticsRepository.countTenantReportEvents({ tenantId, eventName, ...window })
  }
}

function resolveCurrentWeekWindow(input: GetPilotSummaryInput): { from: Date; to: Date } {
  if (input.from && input.to) {
    return { from: input.from, to: input.to }
  }

  const now = input.now ?? new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = from.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  from.setUTCDate(from.getUTCDate() - daysSinceMonday)

  const to = new Date(from)
  to.setUTCDate(to.getUTCDate() + 7)

  return { from, to }
}

function calculatePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }

  return Math.round((numerator / denominator) * 100)
}
