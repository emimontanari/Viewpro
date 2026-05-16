import { Inject, Injectable } from '@nestjs/common'
import type { AnalyticsEventName } from '@prisma/client'
import { mapAnalyticsEventToResponse, type AnalyticsEventResponse } from '../analytics-event.mapper'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../analytics.repository'

export type ListAnalyticsEventsInput = {
  tenantId: string
  page: number
  pageSize: number
  eventName?: AnalyticsEventName
}

export type ListAnalyticsEventsResponse = {
  total: number
  page: number
  pageSize: number
  items: AnalyticsEventResponse[]
}

@Injectable()
export class ListAnalyticsEventsUseCase {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepository: AnalyticsRepository) {}

  async execute(input: ListAnalyticsEventsInput): Promise<ListAnalyticsEventsResponse> {
    const [items, total] = await Promise.all([
      this.analyticsRepository.listTenantEvents(input),
      this.analyticsRepository.countTenantEventsForList({ tenantId: input.tenantId, eventName: input.eventName }),
    ])

    return {
      total,
      page: input.page,
      pageSize: input.pageSize,
      items: items.map(mapAnalyticsEventToResponse),
    }
  }
}
