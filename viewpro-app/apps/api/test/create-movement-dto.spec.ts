import { MovementBuiltInOutcome, MovementType, PropertyEngagementStatus } from '@prisma/client'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { describe, expect, it } from 'vitest'
import { CreateMovementDto } from '../src/movements/dto/create-movement.dto'

async function validateDto(plain: object) {
  const instance = plainToInstance(CreateMovementDto, plain)
  return validate(instance)
}

describe('CreateMovementDto — outcome + newStatus mutual exclusion (FR-30)', () => {
  it('accepts a valid movement with builtIn outcome only', async () => {
    const errors = await validateDto({
      type: MovementType.GENERAL_UPDATE,
      observation: 'Something happened',
      outcome: { builtIn: MovementBuiltInOutcome.EN_CAPTACION },
    })
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid movement with customLabelId outcome only', async () => {
    const errors = await validateDto({
      type: MovementType.GENERAL_UPDATE,
      observation: 'Something happened',
      outcome: { customLabelId: '00000000-0000-0000-0000-000000000001' },
    })
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid movement with newStatus only', async () => {
    const errors = await validateDto({
      type: MovementType.STATUS_CHANGE,
      observation: 'Status updated',
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
    })
    expect(errors).toHaveLength(0)
  })

  it('accepts a valid movement with no outcome and no newStatus', async () => {
    const errors = await validateDto({
      type: MovementType.GENERAL_UPDATE,
      observation: 'Plain movement',
    })
    expect(errors).toHaveLength(0)
  })

  it('rejects when both outcome.builtIn and outcome.customLabelId are provided (OUTCOME_BOTH_PROVIDED)', async () => {
    const errors = await validateDto({
      type: MovementType.GENERAL_UPDATE,
      observation: 'Bad request',
      outcome: {
        builtIn: MovementBuiltInOutcome.EN_CAPTACION,
        customLabelId: '00000000-0000-0000-0000-000000000001',
      },
    })
    expect(errors.length).toBeGreaterThan(0)
    const allMessages = errors.flatMap((e) => Object.values(e.constraints ?? {}))
    expect(allMessages.some((m) => m.includes('OUTCOME_BOTH_PROVIDED') || m.includes('mutually exclusive'))).toBe(true)
  })

  it('rejects when both outcome and newStatus are provided (FR-30)', async () => {
    const errors = await validateDto({
      type: MovementType.GENERAL_UPDATE,
      observation: 'Bad request',
      outcome: { builtIn: MovementBuiltInOutcome.EN_CAPTACION },
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
    })
    expect(errors.length).toBeGreaterThan(0)
    const allMessages = errors.flatMap((e) => Object.values(e.constraints ?? {}))
    expect(allMessages.some((m) => m.includes('OUTCOME_BOTH_PROVIDED') || m.includes('mutually exclusive'))).toBe(true)
  })
})
