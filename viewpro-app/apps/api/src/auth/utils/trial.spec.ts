import { describe, expect, it } from 'vitest'
import { TRIAL_DURATION_DAYS, computeTrialEndsAt } from './trial'

describe('TRIAL_DURATION_DAYS', () => {
  it('is 14 (fixed constant, not configurable this slice)', () => {
    expect(TRIAL_DURATION_DAYS).toBe(14)
  })
})

describe('computeTrialEndsAt', () => {
  it('returns exactly 14 days after the given date', () => {
    const from = new Date('2026-07-16T13:33:38.000Z')
    const result = computeTrialEndsAt(from)
    expect(result).toEqual(new Date('2026-07-30T13:33:38.000Z'))
  })

  it('returns exactly 14 days after a different date (triangulation)', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const result = computeTrialEndsAt(from)
    expect(result).toEqual(new Date('2026-01-15T00:00:00.000Z'))
  })

  it('does not mutate the input date', () => {
    const from = new Date('2026-07-16T13:33:38.000Z')
    const originalTime = from.getTime()
    computeTrialEndsAt(from)
    expect(from.getTime()).toBe(originalTime)
  })
})
