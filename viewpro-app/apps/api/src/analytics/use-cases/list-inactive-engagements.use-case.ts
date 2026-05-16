import { Inject, Injectable } from '@nestjs/common'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository, type InactiveEngagementRecord } from '../analytics.repository'

export type ListInactiveEngagementsInput = {
  tenantId: string
  now?: Date
  from?: Date
  to?: Date
}

export type InactiveEngagementResponse = {
  id: string
  tenantId: string
  propertyAssetId: string
  status: string
  updatedAt: string
}

export type ListInactiveEngagementsResponse = {
  window: {
    from: string
    to: string
  }
  items: InactiveEngagementResponse[]
}

@Injectable()
export class ListInactiveEngagementsUseCase {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepository: AnalyticsRepository) {}

  async execute(input: ListInactiveEngagementsInput): Promise<ListInactiveEngagementsResponse> {
    const window = resolveSevenDayWindow(input)
    const inactiveEngagements = await this.analyticsRepository.listActiveEngagementsWithoutRecentUpdate({
      tenantId: input.tenantId,
      ...window,
    })

    return {
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      items: inactiveEngagements.map(mapInactiveEngagement),
    }
  }
}

function resolveSevenDayWindow(input: ListInactiveEngagementsInput): { from: Date; to: Date } {
  if (input.from && input.to) {
    return { from: input.from, to: input.to }
  }

  const to = input.now ?? new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)

  return { from, to }
}

function mapInactiveEngagement(engagement: InactiveEngagementRecord): InactiveEngagementResponse {
  return {
    id: engagement.id,
    tenantId: engagement.tenantId,
    propertyAssetId: engagement.propertyAssetId,
    status: engagement.status,
    updatedAt: engagement.updatedAt.toISOString(),
  }
}
