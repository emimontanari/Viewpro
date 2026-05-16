import { apiRequest } from './api-client'

export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER'
export type PropertyOperationType = 'SALE' | 'RENT'
export type PropertyEngagementStatus =
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

export type EngagementAgent = {
  id: string
  userId: string
  email: string
  firstName: string | null
}

export type PropertyEngagement = {
  id: string
  tenantId: string
  operationType: PropertyOperationType
  status: PropertyEngagementStatus
  publishedPriceCents?: number | null
  currency?: string | null
  property: {
    id: string
    title: string
    addressLine: string
    city: string
    province: string
    propertyType: PropertyType
    ownerName?: string | null
    ownerEmail?: string | null
  }
  agents: EngagementAgent[]
  createdAt: string
  updatedAt: string
}

export type ListEngagementsInput = {
  tenantId: string
  page?: number
  pageSize?: number
  status?: PropertyEngagementStatus
  operationType?: PropertyOperationType
}

export type ListEngagementsResponse = {
  items: PropertyEngagement[]
  total: number
  page: number
  pageSize: number
}

export type CreateEngagementInput = {
  tenantId: string
  title: string
  addressLine: string
  city: string
  province: string
  propertyType: PropertyType
  operationType: PropertyOperationType
  ownerName?: string
  ownerEmail?: string
  publishedPriceCents?: number
  currency?: string
}

export function listEngagements(input: ListEngagementsInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page ?? 1))
  searchParams.set('pageSize', String(input.pageSize ?? 20))

  if (input.status) {
    searchParams.set('status', input.status)
  }

  if (input.operationType) {
    searchParams.set('operationType', input.operationType)
  }

  return apiRequest<ListEngagementsResponse>(`/property-engagements?${searchParams.toString()}`, {
    tenantId: input.tenantId,
  })
}

export function getEngagement(tenantId: string, engagementId: string) {
  return apiRequest<PropertyEngagement>(`/property-engagements/${engagementId}`, {
    tenantId,
  })
}

export function createEngagement(input: CreateEngagementInput) {
  const { tenantId, ...body } = input

  return apiRequest<PropertyEngagement>('/property-engagements', {
    body,
    method: 'POST',
    tenantId,
  })
}
