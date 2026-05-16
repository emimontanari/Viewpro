import type { AnalyticsEventName, Prisma, PropertyEngagementStatus } from '@prisma/client'

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

export type CountTenantAnalyticsEventsForListInput = {
  tenantId: string
  eventName?: AnalyticsEventName
}

export type CountTenantReportEventsInput = {
  tenantId: string
  from: Date
  to: Date
  eventName: AnalyticsEventName
}

export type TenantWindowInput = {
  tenantId: string
  from: Date
  to: Date
}

export type InactiveEngagementRecord = {
  id: string
  tenantId: string
  propertyAssetId: string
  status: PropertyEngagementStatus
  updatedAt: Date
}

export type AnalyticsRepository = {
  create(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord>
  listTenantEvents(input: ListTenantAnalyticsEventsInput): Promise<AnalyticsEventRecord[]>
  countTenantEvents(input: CountTenantAnalyticsEventsInput): Promise<number>
  countTenantEventsForList(input: CountTenantAnalyticsEventsForListInput): Promise<number>
  countTenantReportEvents(input: CountTenantReportEventsInput): Promise<number>
  countActiveEngagements(input: { tenantId: string }): Promise<number>
  countActiveEngagementsWithOwnerVisibleUpdate(input: TenantWindowInput): Promise<number>
  listActiveEngagementsWithoutRecentUpdate(input: TenantWindowInput): Promise<InactiveEngagementRecord[]>
}
