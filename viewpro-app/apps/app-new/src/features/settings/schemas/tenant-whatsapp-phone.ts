import * as z from 'zod'

const MIN_DIGIT_COUNT = 8

/**
 * Normalizes a raw whatsapp phone string: trims whitespace, strips characters
 * that are not `+` or decimal digits, and removes any `+` that is not at the
 * leading position. Returns null for empty / whitespace-only / null input.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null
  const stripped = raw.trim().replace(/[^+\d]/g, '').replace(/(?!^)\+/g, '')
  return stripped || null
}

function countDigits(phone: string): number {
  return (phone.match(/\d/g) ?? []).length
}

export const tenantWhatsappPhoneSchema = z.object({
  whatsappPhone: z
    .string()
    .nullable()
    .transform((val) => normalizePhone(val))
    .refine(
      (val) => {
        if (val === null) return true
        return countDigits(val) >= MIN_DIGIT_COUNT
      },
      { message: 'phone.too_short' }
    )
})

export type TenantWhatsappPhoneValues = {
  whatsappPhone: string | null
}
