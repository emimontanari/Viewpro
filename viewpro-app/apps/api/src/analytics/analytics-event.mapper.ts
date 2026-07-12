import type { Prisma } from '@prisma/client'
import type { AnalyticsEventRecord } from './analytics.repository'
import { sanitizeAnalyticsMetadata } from './analytics.service'

export type AnalyticsEventResponse = {
  id: string
  tenantId: string | null
  actorUserId: string | null
  actorType: string
  eventName: string
  propertyEngagementId: string | null
  propertyAssetId: string | null
  documentRequestId: string | null
  movementId: string | null
  metadata: unknown
  occurredAt: string
}

export function mapAnalyticsEventToResponse(event: AnalyticsEventRecord): AnalyticsEventResponse {
  return {
    id: event.id,
    tenantId: event.tenantId,
    actorUserId: event.actorUserId,
    actorType: event.actorType,
    eventName: event.eventName,
    propertyEngagementId: event.propertyEngagementId,
    propertyAssetId: event.propertyAssetId,
    documentRequestId: event.documentRequestId,
    movementId: event.movementId,
    metadata: sanitizeAnalyticsMetadata(event.metadata as Prisma.InputJsonValue | null),
    occurredAt: event.occurredAt.toISOString(),
  }
}
