import type {
  Prisma,
  PropertyAgent,
  PropertyEngagementStatus,
  PropertyOperationType,
} from '@prisma/client'

export const PROPERTY_ENGAGEMENTS_REPOSITORY = Symbol('PROPERTY_ENGAGEMENTS_REPOSITORY')

export type PropertyEngagementWithDetails = Prisma.PropertyEngagementGetPayload<{
  include: { propertyAsset: true; agents: { include: { agentUser: true } }; createdBy: true }
}>

export type CreatePropertyEngagementInput = {
  tenantId: string
  createdByUserId: string
  propertyAsset: Prisma.PropertyAssetCreateWithoutEngagementsInput
  engagement: Omit<
    Prisma.PropertyEngagementUncheckedCreateWithoutPropertyAssetInput,
    'tenantId' | 'createdByUserId'
  >
}

export type ListPropertyEngagementsInput = {
  tenantId: string
  userId: string
  canViewAll: boolean
  page: number
  pageSize: number
  status?: PropertyEngagementStatus
  operationType?: PropertyOperationType
}

export type UpdatePropertyEngagementInput = {
  tenantId: string
  engagementId: string
  userId: string
  canViewAll: boolean
  propertyAsset: Prisma.PropertyAssetUpdateInput
  engagement: Prisma.PropertyEngagementUncheckedUpdateInput
}

export type PropertyEngagementsRepository = {
  createWithAsset(input: CreatePropertyEngagementInput): Promise<PropertyEngagementWithDetails>
  findMany(input: ListPropertyEngagementsInput): Promise<{ items: PropertyEngagementWithDetails[]; total: number }>
  findByIdForTenant(input: {
    tenantId: string
    engagementId: string
    userId: string
    canViewAll: boolean
  }): Promise<PropertyEngagementWithDetails | null>
  updateForTenant(input: UpdatePropertyEngagementInput): Promise<PropertyEngagementWithDetails | null>
  assignAgent(input: {
    tenantId: string
    engagementId: string
    agentUserId: string
    assignedByUserId: string
  }): Promise<PropertyAgent>
}
