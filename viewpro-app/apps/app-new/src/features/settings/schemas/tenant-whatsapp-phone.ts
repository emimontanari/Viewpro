import * as z from 'zod'

const PHONE_REQUIRED_MESSAGE = 'Ingresá el teléfono de contacto de la inmobiliaria.'

/**
 * Trims a raw whatsapp phone string. Returns null for empty / whitespace-only
 * / null input.
 *
 * This is a presence-only helper now (#287 WU4, design.md ADR-2/ADR-6): the
 * client no longer strips or reshapes digits — `parseArContactPhone` on the
 * server is the only canonicalizer, so the trimmed raw value is submitted
 * as-is and the server's E.164 output is the single source of truth.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const tenantWhatsappPhoneSchema = z.object({
  whatsappPhone: z
    .string()
    .nullable()
    .transform((val) => normalizePhone(val))
    .refine((val) => val !== null, { message: PHONE_REQUIRED_MESSAGE })
})

export type TenantWhatsappPhoneValues = {
  whatsappPhone: string | null
}
