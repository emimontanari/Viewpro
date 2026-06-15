import type { Prisma, PropertyEngagementStatus } from '@prisma/client'
import type { CreateMovementDto } from '../dto/create-movement.dto'

export type BuildMovementCreatePayloadInput = {
  tenantId: string
  propertyEngagementId: string
  createdByUserId: string
  engagementCurrentStatus: PropertyEngagementStatus
  dto: CreateMovementDto
}

export type BuildMovementCreatePayloadResult = {
  movementData: Prisma.MovementUncheckedCreateInput
  statusUpdate: { newStatus: PropertyEngagementStatus } | null
}

/**
 * Pure deterministic function that produces the exact Prisma create input for a movement.
 *
 * Design contract (FR-11, R1 strategy):
 * - When `dto.outcome` is set, `statusUpdate` is ALWAYS null and the returned
 *   `movementData` NEVER contains `newStatus` or `previousStatus`.
 * - When `dto.newStatus` is set, both outcome fields are null and `statusUpdate`
 *   carries the new status so the caller can update PropertyEngagement separately.
 * - The function never writes to PropertyEngagement directly — that is the caller's
 *   responsibility once it inspects `statusUpdate`.
 */
export function buildMovementCreatePayload(
  input: BuildMovementCreatePayloadInput,
): BuildMovementCreatePayloadResult {
  const { tenantId, propertyEngagementId, createdByUserId, engagementCurrentStatus, dto } = input

  const base = {
    tenantId,
    propertyEngagementId,
    createdByUserId,
    type: dto.type,
    observation: dto.observation,
    nextStep: dto.nextStep ?? null,
    interestCount: dto.interestCount ?? null,
    visitCount: dto.visitCount ?? null,
    offerAmountCents: dto.offerAmountCents ?? null,
    interestLevel: dto.interestLevel ?? null,
  } satisfies Partial<Prisma.MovementUncheckedCreateInput>

  if (dto.outcome) {
    // Outcome path — never sets newStatus/previousStatus (FR-11 invariant)
    const builtInOutcome = 'builtIn' in dto.outcome ? dto.outcome.builtIn : null
    const customOutcomeLabelId = 'customLabelId' in dto.outcome ? dto.outcome.customLabelId : null

    return {
      movementData: {
        ...base,
        builtInOutcome,
        customOutcomeLabelId,
      },
      statusUpdate: null,
    }
  }

  // Status change path (or plain movement with no outcome)
  return {
    movementData: {
      ...base,
      builtInOutcome: null,
      customOutcomeLabelId: null,
      ...(dto.newStatus
        ? {
            previousStatus: engagementCurrentStatus,
            newStatus: dto.newStatus,
          }
        : {}),
    },
    statusUpdate: dto.newStatus ? { newStatus: dto.newStatus } : null,
  }
}
