import { describe, it, expect } from 'vitest'
import {
  ARGENTINA_TIME_ZONE,
  createBillingPeriod,
  overdueDaysElapsed,
  paidThrough,
  todayIn,
} from './billing-period'

/**
 * platform-payment-ledger (PR 1) — RED: billing periods and the derived
 * paid-through / overdue state.
 *
 * The current date is injected, never read from a global clock, so these
 * assertions do not depend on when the suite runs or on the container's TZ.
 *
 * Spec: Record a Payment (period validation), Paid-Through Date Is Derived,
 *   Overdue Is Derived and Never Restricts Access, Period Boundaries Use a
 *   Fixed Timezone.
 */
describe('createBillingPeriod', () => {
  it('accepts a period whose end is after its start', () => {
    const period = createBillingPeriod('2026-08-01', '2026-08-31')

    expect(period.start).toBe('2026-08-01')
    expect(period.end).toBe('2026-08-31')
  })

  it('rejects an inverted period', () => {
    expect(() => createBillingPeriod('2026-08-31', '2026-08-01')).toThrow(/after/i)
  })

  it('rejects a zero-length period', () => {
    expect(() => createBillingPeriod('2026-08-01', '2026-08-01')).toThrow(/after/i)
  })

  it('rejects a malformed date', () => {
    expect(() => createBillingPeriod('01/08/2026', '2026-08-31')).toThrow(/format/i)
  })
})

describe('paidThrough', () => {
  it('is the furthest period end across payments', () => {
    const result = paidThrough([
      { end: '2026-08-31' },
      { end: '2026-09-30' },
    ])

    expect(result).toBe('2026-09-30')
  })

  it('is the furthest end regardless of the order payments were recorded in', () => {
    const result = paidThrough([
      { end: '2026-09-30' },
      { end: '2026-08-31' },
    ])

    expect(result).toBe('2026-09-30')
  })

  it('is null when there are no payments', () => {
    expect(paidThrough([])).toBeNull()
  })
})

describe('overdueDaysElapsed', () => {
  it('reports days elapsed once the paid-through date has passed', () => {
    expect(overdueDaysElapsed('2026-08-31', '2026-09-03')).toBe(3)
  })

  it('is not overdue on the paid-through date itself', () => {
    expect(overdueDaysElapsed('2026-08-31', '2026-08-31')).toBeNull()
  })

  it('becomes overdue by one day on the following calendar day', () => {
    expect(overdueDaysElapsed('2026-08-31', '2026-09-01')).toBe(1)
  })

  it('is not overdue when the paid-through date is in the future', () => {
    expect(overdueDaysElapsed('2026-09-30', '2026-09-03')).toBeNull()
  })

  it('is not overdue when there is no paid-through date at all', () => {
    // A tenant nobody ever paid for is not "overdue" — it was never due.
    expect(overdueDaysElapsed(null, '2026-09-03')).toBeNull()
  })

  it('counts across a month boundary', () => {
    expect(overdueDaysElapsed('2026-08-31', '2026-10-01')).toBe(31)
  })
})

describe('todayIn — fixed timezone', () => {
  it('resolves the Argentina calendar date at 23:59 local time', () => {
    // 2026-08-31T23:59 in Buenos Aires (UTC-3) is 2026-09-01T02:59 UTC.
    const instant = new Date('2026-09-01T02:59:00.000Z')

    expect(todayIn(ARGENTINA_TIME_ZONE, instant)).toBe('2026-08-31')
  })

  it('rolls to the next calendar date at 00:01 local time', () => {
    // 2026-09-01T00:01 in Buenos Aires is 2026-09-01T03:01 UTC.
    const instant = new Date('2026-09-01T03:01:00.000Z')

    expect(todayIn(ARGENTINA_TIME_ZONE, instant)).toBe('2026-09-01')
  })

  it('does not report a tenant overdue at 23:59 on its period-end day', () => {
    const instant = new Date('2026-09-01T02:59:00.000Z')

    expect(overdueDaysElapsed('2026-08-31', todayIn(ARGENTINA_TIME_ZONE, instant))).toBeNull()
  })

  it('reports one day elapsed at 00:01 the following day', () => {
    const instant = new Date('2026-09-01T03:01:00.000Z')

    expect(overdueDaysElapsed('2026-08-31', todayIn(ARGENTINA_TIME_ZONE, instant))).toBe(1)
  })

  it('is unaffected by the host timezone because the zone is explicit', () => {
    // Same instant, asked in UTC, yields the UTC calendar date instead.
    const instant = new Date('2026-09-01T02:59:00.000Z')

    expect(todayIn('UTC', instant)).toBe('2026-09-01')
    expect(todayIn(ARGENTINA_TIME_ZONE, instant)).toBe('2026-08-31')
  })
})
