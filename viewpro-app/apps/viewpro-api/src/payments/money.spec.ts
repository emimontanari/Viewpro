import { describe, it, expect } from 'vitest'
import { addMinorUnits, formatMinorUnits, parseMinorUnits, sumMinorUnits } from './money'

/**
 * platform-payment-ledger (PR 1) — RED: money is integer minor units end to
 * end. Nothing in the stack may represent an amount as a floating-point
 * number, and the amount crosses the wire as a string because a JSON number
 * past Number.MAX_SAFE_INTEGER is already corrupted before validation runs.
 *
 * Spec: Amounts Are Integer Minor Units.
 */
describe('parseMinorUnits', () => {
  it('parses a plain integer string to bigint', () => {
    expect(parseMinorUnits('4500000')).toBe(4500000n)
  })

  it('preserves values beyond Number.MAX_SAFE_INTEGER without loss', () => {
    // 9007199254740993 is MAX_SAFE_INTEGER + 2 — unrepresentable as a JS number.
    const beyondSafe = '9007199254740993'

    expect(parseMinorUnits(beyondSafe)).toBe(9007199254740993n)
    expect(parseMinorUnits(beyondSafe).toString()).toBe(beyondSafe)
  })

  it('rejects a fractional amount', () => {
    expect(() => parseMinorUnits('4500.75')).toThrow(/integer/i)
  })

  it('rejects zero', () => {
    expect(() => parseMinorUnits('0')).toThrow(/positive/i)
  })

  it('rejects a negative amount', () => {
    expect(() => parseMinorUnits('-4500000')).toThrow(/positive/i)
  })

  it('rejects a non-numeric string', () => {
    expect(() => parseMinorUnits('cuatro mil')).toThrow(/integer/i)
  })

  // The ledger column is BIGINT (int8). Without an upper bound the value
  // survives every validator, reaches Postgres, and blows up there — which
  // surfaces as a 500, blaming the server for what is a client typing too many
  // zeros. The bound belongs here, next to the lower one, so both ends of the
  // representable range are stated in the same place.
  it('accepts the largest amount the ledger column can hold', () => {
    expect(parseMinorUnits('9223372036854775807')).toBe(9223372036854775807n)
  })

  it('rejects an amount one minor unit beyond what the column can hold', () => {
    expect(() => parseMinorUnits('9223372036854775808')).toThrow(RangeError)
  })

  it('rejects an absurdly long digit string without hanging', () => {
    expect(() => parseMinorUnits('9'.repeat(400))).toThrow(RangeError)
  })

  it('rejects an empty string', () => {
    expect(() => parseMinorUnits('')).toThrow(/integer/i)
  })

  it('rejects a number that arrived as a JS number instead of a string', () => {
    // Guards the boundary: accepting a number here would mean precision was
    // already lost upstream in JSON.parse.
    expect(() => parseMinorUnits(4500000 as unknown as string)).toThrow(/string/i)
  })
})

describe('sumMinorUnits', () => {
  it('sums exactly where float arithmetic would drift', () => {
    // The spec's canonical case: 1010 + 2020 + 3030 must be exactly 6060.
    expect(sumMinorUnits([1010n, 2020n, 3030n])).toBe(6060n)
  })

  it('sums a case that provably breaks under float cents arithmetic', () => {
    // 0.1 + 0.2 !== 0.3 in floats. In minor units it is exact, always.
    expect(sumMinorUnits([10n, 20n])).toBe(30n)
    expect(Number(sumMinorUnits([10n, 20n])) / 100).toBe(0.3)
  })

  it('is exact across many large values', () => {
    const values = Array.from({ length: 1000 }, () => 999999999999n)

    expect(sumMinorUnits(values)).toBe(999999999999000n)
  })

  it('returns zero for an empty list', () => {
    expect(sumMinorUnits([])).toBe(0n)
  })
})

describe('addMinorUnits', () => {
  it('adds two amounts exactly', () => {
    expect(addMinorUnits(4500000n, 500000n)).toBe(5000000n)
  })
})

describe('formatMinorUnits', () => {
  it('renders minor units as a decimal string with two places', () => {
    expect(formatMinorUnits(4500000n)).toBe('45000.00')
  })

  it('pads sub-unit amounts correctly', () => {
    expect(formatMinorUnits(5n)).toBe('0.05')
    expect(formatMinorUnits(50n)).toBe('0.50')
  })

  it('round-trips through parseMinorUnits without loss', () => {
    const original = 9007199254740993n

    expect(parseMinorUnits(original.toString())).toBe(original)
  })
})
