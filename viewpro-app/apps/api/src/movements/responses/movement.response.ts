import type { MovementWithRelations } from '../movements.repository'

export type MovementResponse = ReturnType<typeof mapMovement>

export function mapMovement(movement: MovementWithRelations) {
  return {
    id: movement.id,
    tenantId: movement.tenantId,
    propertyEngagementId: movement.propertyEngagementId,
    type: movement.type,
    observation: movement.observation,
    nextStep: movement.nextStep,
    previousStatus: movement.previousStatus,
    newStatus: movement.newStatus,
    source: movement.source,
    interestCount: movement.interestCount,
    visitCount: movement.visitCount,
    offerAmountCents: movement.offerAmountCents,
    interestLevel: movement.interestLevel,
    createdBy: {
      id: movement.createdBy.id,
      email: movement.createdBy.email,
      firstName: movement.createdBy.firstName,
    },
    createdAt: movement.createdAt.toISOString(),
  }
}
