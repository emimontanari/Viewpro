// Slice 4 behavior is documented in docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md.

import { apiRequest } from './api-client'
import type { PropertyEngagementStatus } from './engagements'

export type MovementType =
  | 'GENERAL_UPDATE'
  | 'INQUIRY'
  | 'VISIT_SCHEDULED'
  | 'VISIT_COMPLETED'
  | 'OFFER_RECEIVED'
  | 'DOCUMENTATION_UPDATE'
  | 'STATUS_CHANGE'

export type MovementSource = 'MANUAL' | 'SYSTEM'

export type InterestLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type Movement = {
  id: string
  tenantId: string
  propertyEngagementId: string
  type: MovementType
  observation: string
  nextStep?: string | null
  previousStatus?: PropertyEngagementStatus | null
  newStatus?: PropertyEngagementStatus | null
  source: MovementSource
  interestCount?: number | null
  visitCount?: number | null
  offerAmountCents?: number | null
  interestLevel?: InterestLevel | null
  createdBy: {
    id: string
    email: string
    firstName?: string | null
  }
  createdAt: string
}

export type ListMovementsInput = {
  tenantId: string
  propertyEngagementId: string
  page?: number
  pageSize?: number
  order?: 'asc' | 'desc'
}

export type ListMovementsResponse = {
  items: Movement[]
  total: number
  page: number
  pageSize: number
}

export type CreateMovementInput = {
  tenantId: string
  propertyEngagementId: string
  type: MovementType
  observation: string
  nextStep?: string
  newStatus?: PropertyEngagementStatus
}

export function listMovements(input: ListMovementsInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page ?? 1))
  searchParams.set('pageSize', String(input.pageSize ?? 20))
  searchParams.set('order', input.order ?? 'desc')

  return apiRequest<ListMovementsResponse>(
    `/property-engagements/${input.propertyEngagementId}/movements?${searchParams.toString()}`,
    { tenantId: input.tenantId },
  )
}

export function createMovement(input: CreateMovementInput) {
  const { tenantId, propertyEngagementId, ...body } = input

  return apiRequest<Movement>(`/property-engagements/${propertyEngagementId}/movements`, {
    body,
    method: 'POST',
    tenantId,
  })
}
