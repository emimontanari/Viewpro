import type { Prisma, PropertyAsset, StatusChangeRequest } from '@prisma/client'

/** StatusChangeRequest enriched with the engagement's property title. */
export type StatusChangeRequestWithPropertyTitle = StatusChangeRequest & {
  propertyEngagement: { propertyAsset: Pick<PropertyAsset, 'title'> }
}

export const STATUS_CHANGE_REQUESTS_REPOSITORY = Symbol('STATUS_CHANGE_REQUESTS_REPOSITORY')

export type CreatePendingInput = {
  tenantId: string
  propertyEngagementId: string
  requestedByUserId: string
  targetStatus: string
  currentStatusSnapshot: string
  requestNote?: string | null
}

export type FindByIdForTenantInput = {
  id: string
  tenantId: string
}

export type FindActivePendingByEngagementInput = {
  engagementId: string
  tenantId: string
}

export type ListByEngagementForTenantInput = {
  engagementId: string
  tenantId: string
}

export type ListPendingForTenantInput = {
  tenantId: string
  take: number
}

export type ResolveInTransactionInput = {
  id: string
  resolvedByUserId: string
  resolutionComment?: string | null
}

export type StatusChangeRequestsRepository = {
  /**
   * Creates a PENDING request. Throws Prisma P2002 on partial unique violation
   * (one PENDING per engagement). The use case maps this to 409.
   */
  createPending(input: CreatePendingInput): Promise<StatusChangeRequest>
  findByIdForTenant(input: FindByIdForTenantInput): Promise<StatusChangeRequest | null>
  findActivePendingByEngagement(input: FindActivePendingByEngagementInput): Promise<StatusChangeRequest | null>
  listByEngagementForTenant(input: ListByEngagementForTenantInput): Promise<StatusChangeRequest[]>
  listPendingForTenant(input: ListPendingForTenantInput): Promise<StatusChangeRequestWithPropertyTitle[]>
  /**
   * Marks a request RESOLVED. Called inside the approve/reject transactions.
   * The tx client is passed in so the caller controls the transaction boundary.
   */
  resolveInTransaction(
    tx: Prisma.TransactionClient,
    input: ResolveInTransactionInput & { id: string },
  ): Promise<StatusChangeRequest>
}
