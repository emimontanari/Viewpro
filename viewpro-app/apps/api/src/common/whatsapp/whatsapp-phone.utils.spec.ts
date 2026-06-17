import { describe, expect, it } from 'vitest'
import {
  MIN_WHATSAPP_DIGITS,
  isValidWhatsappPhone,
  normalizeWhatsappPhone,
} from './whatsapp-phone.utils'

// ─── normalizeWhatsappPhone ───────────────────────────────────────────────────

describe('normalizeWhatsappPhone', () => {
  it('returns the value unchanged when already in canonical form', () => {
    expect(normalizeWhatsappPhone('+5493510000000')).toBe('+5493510000000')
  })

  it('trims whitespace and strips separators', () => {
    expect(normalizeWhatsappPhone(' +54 9 351 000 0000 ')).toBe('+5493510000000')
  })

  it('strips hyphens and spaces', () => {
    expect(normalizeWhatsappPhone('+54 9 351-000-0000')).toBe('+5493510000000')
  })

  it('preserves a value without leading + (no auto-add)', () => {
    expect(normalizeWhatsappPhone('5493510000000')).toBe('5493510000000')
  })

  it('returns null for an empty string', () => {
    expect(normalizeWhatsappPhone('')).toBeNull()
  })

  it('returns null for a whitespace-only string', () => {
    expect(normalizeWhatsappPhone('   ')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(normalizeWhatsappPhone(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(normalizeWhatsappPhone(undefined)).toBeNull()
  })

  it('strips non-+ non-digit characters (letters, special chars)', () => {
    expect(normalizeWhatsappPhone('+54abc9351xyz000')).toBe('+549351000')
  })

  it('removes embedded + signs that are not at the leading position', () => {
    expect(normalizeWhatsappPhone('+549+351')).toBe('+549351')
  })
})

// ─── isValidWhatsappPhone ─────────────────────────────────────────────────────

describe('isValidWhatsappPhone', () => {
  it('returns true for null (clear operation is valid)', () => {
    expect(isValidWhatsappPhone(null)).toBe(true)
  })

  it('returns true for a 13-digit international number', () => {
    // +5493510000000 → digits: 5493510000000 (13 digits) → valid
    expect(isValidWhatsappPhone('+5493510000000')).toBe(true)
  })

  it(`returns true at the exact boundary of ${MIN_WHATSAPP_DIGITS} digits`, () => {
    // 12345678 = 8 digits → valid (boundary)
    expect(isValidWhatsappPhone('12345678')).toBe(true)
  })

  it(`returns false for ${MIN_WHATSAPP_DIGITS - 1} digits (one below the boundary)`, () => {
    // 1234567 = 7 digits → invalid
    expect(isValidWhatsappPhone('1234567')).toBe(false)
  })

  it('returns false for an empty string (not null)', () => {
    // Empty string is not a clear operation; it has 0 digits → invalid
    expect(isValidWhatsappPhone('')).toBe(false)
  })

  it('returns false for a string that is all non-digit chars', () => {
    expect(isValidWhatsappPhone('abcdefgh')).toBe(false)
  })
})
