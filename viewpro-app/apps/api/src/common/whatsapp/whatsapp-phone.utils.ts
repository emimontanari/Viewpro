/**
 * Shared WhatsApp phone number utilities.
 *
 * Used by both the owner-portal read path (contact resolution) and the tenants
 * write path (update-tenant-whatsapp-phone use case). Keeping the rule here
 * avoids a cross-module layering violation (tenants/ importing from owner-portal/).
 */

/** Minimum digit count required for a valid WhatsApp phone number. */
export const MIN_WHATSAPP_DIGITS = 8

/**
 * Normalizes a WhatsApp phone input for storage.
 *
 * Rules:
 * - Trims leading/trailing whitespace.
 * - Strips all characters that are not `+` or decimal digits.
 * - Preserves a leading `+` if present; does NOT add one.
 * - Returns `null` for null, undefined, empty, or whitespace-only inputs.
 *
 * Examples:
 *   " +54 9 351-000-0000 " → "+5493510000000"
 *   "5493510000000"         → "5493510000000"
 *   "+5493510000000"        → "+5493510000000"
 *   ""  /  "   "  / null   → null
 */
export function normalizeWhatsappPhone(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  // Strip everything except + and digits; preserve a leading + if present.
  const normalized = trimmed.replace(/[^+\d]/g, '').replace(/(?!^)\+/g, '')
  return normalized.length === 0 ? null : normalized
}

/**
 * Returns true when the phone value is acceptable for storage:
 * - `null` is valid (represents a clear/unset operation).
 * - A non-null string must contain at least MIN_WHATSAPP_DIGITS decimal digits.
 */
export function isValidWhatsappPhone(value: string | null): boolean {
  if (value === null) return true
  const digits = value.replace(/\D/g, '')
  return digits.length >= MIN_WHATSAPP_DIGITS
}
