// Slice 7 pilot metrics dashboard behavior is documented in docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md.

import { apiRequest } from './api-client'

export type AnalyticsEventName =
  | 'SELLER_LOGGED_IN'
  | 'MOVEMENT_CREATED'
  | 'PROPERTY_STATUS_CHANGED'
  | 'OWNER_VIEWED_PROPERTY'
  | 'DOCUMENT_REQUESTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'

export type PilotSummary = {
  window: AnalyticsWindow
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

export type AnalyticsWindow = {
  from: string
  to: string
}

export type InactiveEngagement = {
  id: string
  tenantId: string
  propertyAssetId: string
  status: string
  updatedAt: string
}

export type ListInactiveEngagementsResponse = {
  window: AnalyticsWindow
  items: InactiveEngagement[]
}

export type AnalyticsEvent = {
  id: string
  tenantId: string | null
  actorUserId: string | null
  actorType: string
  eventName: AnalyticsEventName
  propertyEngagementId: string | null
  propertyAssetId: string | null
  documentRequestId: string | null
  movementId: string | null
  metadata: unknown
  occurredAt: string
}

export type ListAnalyticsEventsInput = {
  tenantId: string
  page?: number
  pageSize?: number
  eventName?: AnalyticsEventName
}

export type ListAnalyticsEventsResponse = {
  total: number
  page: number
  pageSize: number
  items: AnalyticsEvent[]
}

export type AnalyticsDashboardData = {
  summary: PilotSummary
  inactiveEngagements: ListInactiveEngagementsResponse
  events: ListAnalyticsEventsResponse
}

export const analyticsEventNames: AnalyticsEventName[] = [
  'SELLER_LOGGED_IN',
  'MOVEMENT_CREATED',
  'PROPERTY_STATUS_CHANGED',
  'OWNER_VIEWED_PROPERTY',
  'DOCUMENT_REQUESTED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
]

export function getPilotSummary(tenantId: string) {
  return apiRequest<PilotSummary>('/analytics/pilot-summary', { tenantId })
}

export function listInactiveEngagements(tenantId: string) {
  return apiRequest<ListInactiveEngagementsResponse>('/analytics/inactive-engagements', { tenantId })
}

export function listAnalyticsEvents(input: ListAnalyticsEventsInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page ?? 1))
  searchParams.set('pageSize', String(input.pageSize ?? 20))

  if (input.eventName) {
    searchParams.set('eventName', input.eventName)
  }

  return apiRequest<ListAnalyticsEventsResponse>(`/analytics/events?${searchParams.toString()}`, {
    tenantId: input.tenantId,
  })
}

export function getAnalyticsDashboardData(input: ListAnalyticsEventsInput): Promise<AnalyticsDashboardData> {
  return Promise.all([
    getPilotSummary(input.tenantId),
    listInactiveEngagements(input.tenantId),
    listAnalyticsEvents(input),
  ]).then(([summary, inactiveEngagements, events]) => ({ summary, inactiveEngagements, events }))
}
