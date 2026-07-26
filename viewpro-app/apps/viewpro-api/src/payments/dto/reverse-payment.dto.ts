import { IsString, MaxLength, MinLength } from 'class-validator'

/**
 * DTO for POST /operators/payments/:paymentId/reversal
 *
 * The reason is mandatory and cannot be blank. A reversal is the one operation
 * that makes a recorded payment stop counting, so an unexplained one is
 * indistinguishable from someone quietly erasing an inconvenient entry. The
 * minimum length exists to stop a single character from satisfying the field.
 *
 * Spec: Reversal Corrects Without Erasing.
 */
export class ReversePaymentDto {
  @IsString()
  @MinLength(3, { message: 'A reversal requires a reason explaining why the payment does not count' })
  @MaxLength(500)
  reason!: string
}
