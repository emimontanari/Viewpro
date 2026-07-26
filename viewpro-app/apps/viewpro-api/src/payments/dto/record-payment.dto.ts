import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'MERCADOPAGO_LINK', 'OTHER'] as const

const PLAN_CODES = ['BASICO', 'PROFESIONAL', 'EMPRESA'] as const

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
  @IsString()
  @MaxLength(3)
  currency?: string

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
