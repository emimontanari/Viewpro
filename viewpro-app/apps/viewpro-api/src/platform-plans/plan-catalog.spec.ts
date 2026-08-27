import { describe, it, expect } from 'vitest'
import { PLAN_CATALOG, planMatchesLimits } from './plan-catalog'

/**
 * platform-manual-plans (Slice 4, Part 2) — RED: fixed three-tier plan
 * catalog (D10) and its pure reverse-lookup helper.
 *
 * Spec: Fixed three-tier plan catalog — Catalog values are fixed and
 *   centrally defined.
 */
describe('PLAN_CATALOG', () => {
  it('BASICO → 3 users / 25 active property engagements / 500 MB storage', () => {
    expect(PLAN_CATALOG.BASICO).toEqual({
      maxUsers: 3,
      maxActivePropertyEngagements: 25,
      maxDocumentsStorageMb: 500,
    })
  })

  it('PROFESIONAL → 10 users / 100 active property engagements / 5000 MB storage', () => {
    expect(PLAN_CATALOG.PROFESIONAL).toEqual({
      maxUsers: 10,
      maxActivePropertyEngagements: 100,
      maxDocumentsStorageMb: 5000,
    })
  })

  it('EMPRESA → unlimited (null/null/null)', () => {
    expect(PLAN_CATALOG.EMPRESA).toEqual({
      maxUsers: null,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: null,
    })
  })

  it('is deeply frozen — an accidental mutation attempt does not alter the catalog', () => {
    expect(Object.isFrozen(PLAN_CATALOG)).toBe(true)
    expect(Object.isFrozen(PLAN_CATALOG.BASICO)).toBe(true)

    // A stray mutation must be a silent no-op (frozen), never a corruption of
    // the shared singleton passed by reference into the control-lane call.
    expect(() => {
      ;(PLAN_CATALOG.BASICO as { maxUsers: number | null }).maxUsers = 999
    }).toThrow(/Cannot assign to read only property/)
    expect(PLAN_CATALOG.BASICO.maxUsers).toBe(3)
  })
})

describe('planMatchesLimits', () => {
  it('returns true when limits exactly match the plan preset', () => {
    expect(
      planMatchesLimits('BASICO', {
        maxUsers: 3,
        maxActivePropertyEngagements: 25,
        maxDocumentsStorageMb: 500,
      }),
    ).toBe(true)
  })

  it('returns false when a single field diverges from the plan preset', () => {
    expect(
      planMatchesLimits('BASICO', {
        maxUsers: 3,
        maxActivePropertyEngagements: 25,
        maxDocumentsStorageMb: 1000,
      }),
    ).toBe(false)
  })

  it('returns true for EMPRESA when all limits are null (unlimited)', () => {
    expect(
      planMatchesLimits('EMPRESA', {
        maxUsers: null,
        maxActivePropertyEngagements: null,
        maxDocumentsStorageMb: null,
      }),
    ).toBe(true)
  })

  it('returns false when a plan-less tenant has PROFESIONAL-shaped limits but is checked against BASICO', () => {
    expect(
      planMatchesLimits('BASICO', {
        maxUsers: 10,
        maxActivePropertyEngagements: 100,
        maxDocumentsStorageMb: 5000,
      }),
    ).toBe(false)
  })
})
