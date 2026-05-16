import type { AnalyticsEventName, Prisma } from '@prisma/client'

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY')

export type AnalyticsEventRecord = Prisma.AnalyticsEventGetPayload<object>

export type CreateAnalyticsEventInput = Prisma.AnalyticsEventUncheckedCreateInput

export type ListTenantAnalyticsEventsInput = {
  tenantId: string
  page: number
  pageSize: number
  eventName?: AnalyticsEventName
}

export type CountTenantAnalyticsEventsInput = {
  tenantId: string
  from: Date
  to: Date
  eventName?: AnalyticsEventName
}

export type AnalyticsRepository = {
  create(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord>
  listTenantEvents(input: ListTenantAnalyticsEventsInput): Promise<AnalyticsEventRecord[]>
  countTenantEvents(input: CountTenantAnalyticsEventsInput): Promise<number>
}
