// Slice 5 owner portal behavior is documented in docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md.

import { apiRequest } from './api-client'

export type OwnerPropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER'
export type OwnerOperationType = 'SALE' | 'RENT'
export type OwnerEngagementStatus =
  | 'CAPTURE'
  | 'DOCUMENTATION_PENDING'
  | 'PUBLICATION_PREPARATION'
  | 'ACTIVE_PUBLICATION'
  | 'INQUIRIES_AND_VISITS'
  | 'OFFER_NEGOTIATION'
  | 'RESERVATION_STARTED'
  | 'FINAL_DOCUMENTATION'
  | 'CLOSED'
  | 'CANCELLED'

export type OwnerMovementType =
  | 'GENERAL_UPDATE'
  | 'INQUIRY'
  | 'VISIT_SCHEDULED'
  | 'VISIT_COMPLETED'
  | 'OFFER_RECEIVED'
  | 'DOCUMENTATION_UPDATE'
  | 'STATUS_CHANGE'

export type OwnerMovementSource = 'MANUAL' | 'SYSTEM'
export type OwnerInterestLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type OwnerProperty = {
  id: string
  title: string
  addressLine: string
  city: string
  province: string
  propertyType: OwnerPropertyType
  createdAt: string
  updatedAt: string
}

export type OwnerEngagement = {
  id: string
  tenant: {
    id: string
    name: string
  }
  operationType: OwnerOperationType
  status: OwnerEngagementStatus
  publishedPriceCents?: number | null
  currency?: string | null
  agents: OwnerEngagementAgent[]
  createdAt: string
  updatedAt: string
}

export type OwnerEngagementAgent = {
  userId: string
  firstName?: string | null
  email: string
}

export type OwnerMovement = {
  id: string
  propertyEngagementId: string
  type: OwnerMovementType
  observation: string
  nextStep?: string | null
  previousStatus?: OwnerEngagementStatus | null
  newStatus?: OwnerEngagementStatus | null
  source: OwnerMovementSource
  interestCount?: number | null
  visitCount?: number | null
  offerAmountCents?: number | null
  interestLevel?: OwnerInterestLevel | null
  createdBy: {
    id: string
    email: string
    firstName?: string | null
  }
  createdAt: string
}

export type OwnerTimelineResponse = {
  engagement: OwnerEngagement
  items: OwnerMovement[]
  total: number
  page: number
  pageSize: number
}

export type ListOwnerTimelineInput = {
  engagementId: string
  page?: number
  pageSize?: number
  order?: 'asc' | 'desc'
}

export function listOwnerProperties() {
  return apiRequest<OwnerProperty[]>('/owner/properties')
}

export function getOwnerProperty(propertyAssetId: string) {
  return apiRequest<OwnerProperty>(`/owner/properties/${propertyAssetId}`)
}

export function listOwnerPropertyEngagements(propertyAssetId: string) {
  return apiRequest<OwnerEngagement[]>(`/owner/properties/${propertyAssetId}/engagements`)
}

export function getOwnerEngagementTimeline(input: ListOwnerTimelineInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page ?? 1))
  searchParams.set('pageSize', String(input.pageSize ?? 20))
  searchParams.set('order', input.order ?? 'desc')

  return apiRequest<OwnerTimelineResponse>(`/owner/engagements/${input.engagementId}/timeline?${searchParams.toString()}`)
}
