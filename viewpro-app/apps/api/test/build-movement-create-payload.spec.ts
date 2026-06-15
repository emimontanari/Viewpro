import { MovementBuiltInOutcome, MovementType, PropertyEngagementStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { buildMovementCreatePayload } from '../src/movements/use-cases/build-movement-create-payload'

const baseInput = {
  tenantId: 'tenant-1',
  propertyEngagementId: 'engagement-1',
  createdByUserId: 'user-1',
  engagementCurrentStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
}

describe('buildMovementCreatePayload', () => {
  it('sets builtInOutcome and nulls customOutcomeLabelId when outcome.builtIn is provided (FR-11)', () => {
    const result = buildMovementCreatePayload({
      ...baseInput,
      dto: {
        type: MovementType.GENERAL_UPDATE,
        observation: 'Test observation',
        outcome: { builtIn: MovementBuiltInOutcome.EN_CAPTACION },
      },
    })

    expect(result.statusUpdate).toBeNull()
    expect(result.movementData.builtInOutcome).toBe(MovementBuiltInOutcome.EN_CAPTACION)
    expect(result.movementData.customOutcomeLabelId).toBeNull()
    // Must never produce a newStatus or previousStatus when outcome is set
    expect(result.movementData.newStatus).toBeUndefined()
    expect(result.movementData.previousStatus).toBeUndefined()
  })

  it('sets customOutcomeLabelId and nulls builtInOutcome when outcome.customLabelId is provided (FR-11)', () => {
    const result = buildMovementCreatePayload({
      ...baseInput,
      dto: {
        type: MovementType.GENERAL_UPDATE,
        observation: 'Test observation',
        outcome: { customLabelId: 'label-uuid-1' },
      },
    })

    expect(result.statusUpdate).toBeNull()
    expect(result.movementData.customOutcomeLabelId).toBe('label-uuid-1')
    expect(result.movementData.builtInOutcome).toBeNull()
    expect(result.movementData.newStatus).toBeUndefined()
    expect(result.movementData.previousStatus).toBeUndefined()
  })

  it('sets both outcome fields to null when no outcome is provided (FR-9)', () => {
    const result = buildMovementCreatePayload({
      ...baseInput,
      dto: {
        type: MovementType.GENERAL_UPDATE,
        observation: 'Test observation',
      },
    })

    expect(result.statusUpdate).toBeNull()
    expect(result.movementData.builtInOutcome).toBeNull()
    expect(result.movementData.customOutcomeLabelId).toBeNull()
  })

  it('produces a non-null statusUpdate and no outcome fields when newStatus is provided', () => {
    const result = buildMovementCreatePayload({
      ...baseInput,
      dto: {
        type: MovementType.STATUS_CHANGE,
        observation: 'Moving to next stage',
        newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
      },
    })

    expect(result.statusUpdate).toEqual({
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
    })
    expect(result.movementData.builtInOutcome).toBeNull()
    expect(result.movementData.customOutcomeLabelId).toBeNull()
    // newStatus and previousStatus belong to the movement record itself
    expect(result.movementData.newStatus).toBe(PropertyEngagementStatus.INQUIRIES_AND_VISITS)
    expect(result.movementData.previousStatus).toBe(PropertyEngagementStatus.ACTIVE_PUBLICATION)
  })

  it('never produces a STATUS_CHANGE movement when outcome is set (FR-11 invariant)', () => {
    const result = buildMovementCreatePayload({
      ...baseInput,
      dto: {
        type: MovementType.GENERAL_UPDATE,
        observation: 'x',
        outcome: { builtIn: MovementBuiltInOutcome.CONSULTAS_Y_VISITAS },
      },
    })

    expect(result.statusUpdate).toBeNull()
    expect(result.movementData.newStatus).toBeUndefined()
    expect(result.movementData.previousStatus).toBeUndefined()
  })
})
