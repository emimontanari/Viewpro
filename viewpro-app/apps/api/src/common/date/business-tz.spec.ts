import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TIMEZONE,
  parseBusinessDayStart,
  parseBusinessDayExclusiveEnd,
} from './business-tz'

describe('BUSINESS_TIMEZONE', () => {
  it('is America/Argentina/Buenos_Aires', () => {
    expect(BUSINESS_TIMEZONE).toBe('America/Argentina/Buenos_Aires')
  })
})

describe('parseBusinessDayStart', () => {
  it('returns 03:00Z for 2026-06-15 in Buenos Aires (UTC-3)', () => {
    const result = parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-06-15T03:00:00.000Z'))
  })

  it('returns 03:00Z for a different date (2026-01-01)', () => {
    const result = parseBusinessDayStart('2026-01-01', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-01-01T03:00:00.000Z'))
  })

  it('uses BUSINESS_TIMEZONE as default when no timezone arg provided', () => {
    const withDefault = parseBusinessDayStart('2026-06-15')
    const withExplicit = parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(withDefault).toEqual(withExplicit)
  })

  it('returns correct UTC instant for a March date (season boundary test)', () => {
    // March 20 — Argentina stays at UTC-3 year-round (no DST)
    const result = parseBusinessDayStart('2026-03-20', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-03-20T03:00:00.000Z'))
  })

  it('returns correct UTC instant for an October date', () => {
    // October 15 — Argentina stays at UTC-3 year-round (no DST)
    const result = parseBusinessDayStart('2026-10-15', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-10-15T03:00:00.000Z'))
  })

  it('throws on non-date-only input', () => {
    expect(() => parseBusinessDayStart('not-a-date', 'America/Argentina/Buenos_Aires')).toThrow()
    expect(() => parseBusinessDayStart('2026-06-15T00:00:00', 'America/Argentina/Buenos_Aires')).toThrow()
  })
})

describe('parseBusinessDayExclusiveEnd', () => {
  it('returns next-day 03:00Z for 2026-06-15 in Buenos Aires', () => {
    // Exclusive end of June 15 = start of June 16 in Buenos Aires = 2026-06-16T03:00:00.000Z
    const result = parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-06-16T03:00:00.000Z'))
  })

  it('uses BUSINESS_TIMEZONE as default when no timezone arg provided', () => {
    const withDefault = parseBusinessDayExclusiveEnd('2026-06-15')
    const withExplicit = parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(withDefault).toEqual(withExplicit)
  })

  it('produces a result strictly greater than parseBusinessDayStart for the same input', () => {
    const start = parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')
    const end = parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('the gap between start and exclusive end is exactly 24 hours', () => {
    const start = parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')
    const end = parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('handles month boundary correctly (end of month)', () => {
    // End of May 31 → exclusive end = June 1 03:00Z
    const result = parseBusinessDayExclusiveEnd('2026-05-31', 'America/Argentina/Buenos_Aires')
    expect(result).toEqual(new Date('2026-06-01T03:00:00.000Z'))
  })

  it('throws on non-date-only input', () => {
    expect(() => parseBusinessDayExclusiveEnd('bad-date', 'America/Argentina/Buenos_Aires')).toThrow()
  })
})
