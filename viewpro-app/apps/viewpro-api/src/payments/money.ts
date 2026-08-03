/**
 * platform-payment-ledger — money primitives.
 *
 * Amounts are integer minor units (cents) as `bigint`, end to end. No layer of
 * this stack may represent money as a JS `number`: 0.1 + 0.2 !== 0.3, and the
 * error only surfaces months later during a bank reconciliation, where it is
 * effectively untraceable.
 *
 * Amounts cross the wire as strings. A JSON number beyond
 * Number.MAX_SAFE_INTEGER is already corrupted by the time JSON.parse returns,
 * so validating it afterwards proves nothing — the digits are gone before any
 * validator runs. Parsing from a string is the only boundary where the value
 * is still intact.
 *
 * Spec: Amounts Are Integer Minor Units.
 */

/** Number of decimal places used when rendering minor units for humans. */
const MINOR_UNIT_SCALE = 2

const INTEGER_PATTERN = /^-?\d+$/

/**
 * Largest amount the ledger can store: `TenantPayment.amountMinorUnits` is
 * Prisma `BigInt` → Postgres `BIGINT` (int8).
 *
 * This bound is a STORAGE limit, not a business one. It exists so an amount
 * the database cannot hold is refused here, as a client error, instead of
 * travelling all the way down and exploding inside Postgres — which surfaced
 * as a 500 and told whoever was filling the form nothing at all.
 *
 * It is deliberately NOT a sane-payment ceiling. A plausible maximum monthly
 * fee is a product decision, and inventing one here would silently reject
 * amounts nobody agreed to reject.
 */
export const MAX_MINOR_UNITS = 9223372036854775807n

/**
 * Parse an amount in minor units from its string representation.
 *
 * Rejects anything that is not a plain integer string, and any amount that is
 * not strictly positive — a payment of zero is not a payment, and negative
 * amounts are not how this ledger models corrections (reversal rows carry a
 * positive amount and are identified by their link to the original).
 */
export function parseMinorUnits(raw: string): bigint {
  if (typeof raw !== 'string') {
    throw new TypeError('Amount must be provided as a string to preserve precision')
  }

  if (!INTEGER_PATTERN.test(raw)) {
    throw new TypeError(`Amount must be an integer number of minor units, received "${raw}"`)
  }

  const value = BigInt(raw)

  if (value <= 0n) {
    throw new RangeError(`Amount must be positive, received "${raw}"`)
  }

  if (value > MAX_MINOR_UNITS) {
    throw new RangeError(
      `Amount exceeds the largest value the ledger can store (${MAX_MINOR_UNITS}), received "${raw}"`,
    )
  }

  return value
}

/** Add two amounts in minor units. */
export function addMinorUnits(a: bigint, b: bigint): bigint {
  return a + b
}

/** Sum a list of amounts in minor units. Exact by construction. */
export function sumMinorUnits(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n)
}

/**
 * Render minor units as a fixed-point decimal string for display.
 *
 * Returns a string rather than a number so the value stays exact all the way
 * to the UI. Formatting with a currency symbol and locale separators is the
 * presentation layer's job, not this module's.
 */
export function formatMinorUnits(value: bigint): string {
  const divisor = 10n ** BigInt(MINOR_UNIT_SCALE)
  const whole = value / divisor
  const fraction = (value < 0n ? -value : value) % divisor

  return `${whole}.${fraction.toString().padStart(MINOR_UNIT_SCALE, '0')}`
}
