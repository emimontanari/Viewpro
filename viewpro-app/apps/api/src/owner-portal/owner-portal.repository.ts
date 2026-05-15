import type { Prisma, PropertyAsset } from '@prisma/client'

export const OWNER_PORTAL_REPOSITORY = Symbol('OWNER_PORTAL_REPOSITORY')

export type OwnerPropertyRecord = PropertyAsset

export type OwnerEngagementRecord = Prisma.PropertyEngagementGetPayload<{
  include: {
    tenant: { select: { id: true; name: true } }
    agents: { select: { agentUserId: true; agentUser: { select: { firstName: true; email: true } } } }
  }
}>

export type OwnerMovementRecord = Prisma.MovementGetPayload<{
  include: { createdBy: { select: { id: true; email: true; firstName: true } } }
}>

export type OwnerPortalRepository = {
  findPropertiesByOwnerUserId(userId: string): Promise<OwnerPropertyRecord[]>
  findPropertyByOwner(input: {
    userId: string
    propertyAssetId: string
  }): Promise<OwnerPropertyRecord | null>
  findEngagementsForOwnerProperty(input: {
    userId: string
    propertyAssetId: string
  }): Promise<OwnerEngagementRecord[]>
  findEngagementTimelineForOwner(input: {
    userId: string
    engagementId: string
    page: number
    pageSize: number
    order: 'asc' | 'desc'
  }): Promise<{ engagement: OwnerEngagementRecord | null; items: OwnerMovementRecord[]; total: number }>
}
