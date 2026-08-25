import { describe, expect, it } from 'vitest'
import { parseArContactPhone } from './ar-contact-phone'

// ─── phone.required — absent/blank collapse to one verdict ──────────────────
// The caller's next action is identical in every case: type a number.

describe('parseArContactPhone — phone.required', () => {
  it('rejects a non-string input', () => {
    expect(parseArContactPhone(12345)).toEqual({ ok: false, errorCode: 'phone.required' })
  })

  it('rejects null', () => {
    expect(parseArContactPhone(null)).toEqual({ ok: false, errorCode: 'phone.required' })
  })

  it('rejects undefined', () => {
    expect(parseArContactPhone(undefined)).toEqual({ ok: false, errorCode: 'phone.required' })
  })

  it('rejects an empty string', () => {
    expect(parseArContactPhone('')).toEqual({ ok: false, errorCode: 'phone.required' })
  })

  it('rejects a whitespace-only string', () => {
    expect(parseArContactPhone('   ')).toEqual({ ok: false, errorCode: 'phone.required' })
  })
})

// ─── phone.invalid — a value was submitted but is not a usable AR number ────

describe('parseArContactPhone — phone.invalid', () => {
  it('rejects unparseable garbage', () => {
    expect(parseArContactPhone('abc')).toEqual({ ok: false, errorCode: 'phone.invalid' })
  })

  it('rejects a value that parses but fails the length/validity check', () => {
    expect(parseArContactPhone('123')).toEqual({ ok: false, errorCode: 'phone.invalid' })
  })

  it('rejects an ambiguous fragment with an explicit country prefix', () => {
    expect(parseArContactPhone('+54 1')).toEqual({ ok: false, errorCode: 'phone.invalid' })
  })

  it('ordering: an unparseable value with a foreign prefix is invalid, not country_unsupported', () => {
    // `+56 abc` never becomes a valid number, so validity is checked before
    // country — this must NOT be `phone.country_unsupported`.
    expect(parseArContactPhone('+56 abc')).toEqual({ ok: false, errorCode: 'phone.invalid' })
  })
})

// ─── phone.country_unsupported — only reachable from an already-valid number ─

describe('parseArContactPhone — phone.country_unsupported', () => {
  it('rejects a valid Brazilian number', () => {
    expect(parseArContactPhone('+5511987654321')).toEqual({
      ok: false,
      errorCode: 'phone.country_unsupported',
    })
  })

  it('rejects a valid Chilean number', () => {
    expect(parseArContactPhone('+56912345678')).toEqual({
      ok: false,
      errorCode: 'phone.country_unsupported',
    })
  })

  it('rejects a valid number with no resolvable country (non-geographic calling code)', () => {
    expect(parseArContactPhone('+800 1234 5678')).toEqual({
      ok: false,
      errorCode: 'phone.country_unsupported',
    })
  })
})

// ─── ok:true — valid AR numbers in several input shapes, exact E.164 pinned ─

describe('parseArContactPhone — ok', () => {
  it('canonicalizes the legacy national-form geographic number (no +54, no 9)', () => {
    // This is the exact legacy shape a manager may re-save unedited.
    expect(parseArContactPhone('3510000000')).toEqual({ ok: true, e164: '+543510000000' })
  })

  it('accepts an already-canonical E.164 geographic number', () => {
    expect(parseArContactPhone('+543510000000')).toEqual({ ok: true, e164: '+543510000000' })
  })

  it('canonicalizes a mobile number with the 9 prefix, spaces and a dash', () => {
    expect(parseArContactPhone('+54 9 351 000-0000')).toEqual({
      ok: true,
      e164: '+5493510000000',
    })
  })

  it('canonicalizes a national-form mobile number with spaces and a dash', () => {
    expect(parseArContactPhone('011 15-3456-7890')).toEqual({ ok: true, e164: '+5491134567890' })
  })

  it('canonicalizes a geographic number with parentheses and a dash', () => {
    expect(parseArContactPhone('(011) 4000-0000')).toEqual({ ok: true, e164: '+541140000000' })
  })
})
