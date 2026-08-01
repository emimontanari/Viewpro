import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'MERCADOPAGO_LINK', 'OTHER'] as const

const PLAN_CODES = ['BASICO', 'PROFESIONAL', 'EMPRESA'] as const

/**
 * JUDGMENT DAY FIX: currency used to be `@IsOptional() @IsString() @MaxLength(3)`,
 * which accepts `""` — `@IsOptional` only skips null/undefined — and the
 * controller's `?? 'ARS'` is nullish-only, so the empty string was stored
 * verbatim. That row then keyed its own revenue bucket that never joined the
 * ARS total and rendered with a blank currency prefix. Same for 'ars' vs 'ARS'.
 *
 * An allow-list, not a shape check: adding a second currency must be a
 * deliberate edit here, seen by whoever reviews it, because every total in the
 * product is per-currency and nothing sums across them.
 */
export const SUPPORTED_CURRENCIES = ['ARS'] as const

/**
 * DTO for POST /operators/tenants/:tenantId/payments
 *
 * `amountMinorUnits` is a STRING, and that is not an oversight. A JSON number
 * past Number.MAX_SAFE_INTEGER is already corrupted by the time JSON.parse
 * returns, so a numeric field would arrive rounded and every validator
 * downstream would happily approve the wrong value. Taking it as a string
 * keeps the digits intact until `parseMinorUnits` turns them into a bigint.
 *
 * The regex rejects decimals outright: an amount is a whole number of cents.
 * "45000.50" is a client that thinks it is sending pesos, and silently
 * truncating it would book a payment fifty cents short forever.
 *
 * Spec: Record a Payment, Amounts Are Integer Minor Units.
 */
export class RecordPaymentDto {
  @IsString()
  @Matches(/^[1-9]\d*$/, {
    message:
      'amountMinorUnits must be a positive whole number of minor units, sent as a string (e.g. "4500000" for $45.000,00)',
  })
  amountMinorUnits!: string

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: (typeof SUPPORTED_CURRENCIES)[number]

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number]

  @IsIn(PLAN_CODES)
  plan!: (typeof PLAN_CODES)[number]

  @IsISO8601({ strict: true })
  periodStart!: string

  @IsISO8601({ strict: true })
  periodEnd!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiptReference?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
