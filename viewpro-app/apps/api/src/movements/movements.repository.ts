import type { Movement, Prisma, PropertyEngagementStatus } from '@prisma/client'

export const MOVEMENTS_REPOSITORY = Symbol('MOVEMENTS_REPOSITORY')

export type MovementWithRelations = Prisma.MovementGetPayload<{
  include: { createdBy: true }
}>

export type CreateMovementInput = {
  tenantId: string
  propertyEngagementId: string
  createdByUserId: string
  type: Movement['type']
  observation: string
  nextStep?: string
  newStatus?: PropertyEngagementStatus
  interestCount?: number
  visitCount?: number
  offerAmountCents?: number
  interestLevel?: Movement['interestLevel']
}

export type ListMovementsInput = {
  tenantId: string
  propertyEngagementId: string
  page: number
  pageSize: number
  order: 'asc' | 'desc'
}

export type MovementsRepository = {
  create(input: CreateMovementInput): Promise<MovementWithRelations | null>
  findMany(input: ListMovementsInput): Promise<{ items: MovementWithRelations[]; total: number }>
}
