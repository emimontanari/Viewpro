import type { StatusChangeRequest } from '@prisma/client'

export type StatusChangeRequestResponse = ReturnType<typeof mapStatusChangeRequest>

export function mapStatusChangeRequest(record: StatusChangeRequest): {
  id: string
  tenantId: string
  propertyEngagementId: string
  requestedByUserId: string
  targetStatus: string
  currentStatusSnapshot: string
  requestNote: string | null
  status: string
  resolvedByUserId: string | null
  resolvedAt: string | null
  resolutionComment: string | null
  createdAt: string
  updatedAt: string
} {
  return {
    id: record.id,
    tenantId: record.tenantId,
    propertyEngagementId: record.propertyEngagementId,
    requestedByUserId: record.requestedByUserId,
    targetStatus: record.targetStatus,
    currentStatusSnapshot: record.currentStatusSnapshot,
    requestNote: record.requestNote ?? null,
    status: record.status,
    resolvedByUserId: record.resolvedByUserId ?? null,
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    resolutionComment: record.resolutionComment ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}
