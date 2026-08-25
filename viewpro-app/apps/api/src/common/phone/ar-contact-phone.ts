import { parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * Parses and validates an Argentine (AR) agency contact phone number.
 *
 * Sibling to `whatsapp-phone.utils.ts`, never an extension of it: that module's
 * `null`-is-valid semantics are correct for the optional clear-value path it
 * also serves, and wrong here, where the phone is mandatory.
 */

export type ArContactPhoneErrorCode = 'phone.required' | 'phone.invalid' | 'phone.country_unsupported'

export type ArContactPhoneResult = { ok: true; e164: string } | { ok: false; errorCode: ArContactPhoneErrorCode }

/**
 * Verdict order — the order IS the contract:
 * 1. Not a string, or blank after trimming (covers `null`, `undefined`, `''`,
 *    and whitespace-only) -> `phone.required`. All collapse deliberately: the
 *    caller's next action is identical in every case.
 * 2. Unparseable, or parseable but not a valid number -> `phone.invalid`.
 *    This check runs before country, so `+56 abc` is `phone.invalid`, not
 *    `phone.country_unsupported`.
 * 3. Valid but not an Argentine number, including an undefined country (a
 *    valid non-geographic calling code) -> `phone.country_unsupported`.
 * 4. Valid AR number -> `{ ok: true, e164 }` in canonical E.164.
 *
 * Default region is `AR`, so a bare national-form input such as
 * `3510000000` canonicalizes to `+543510000000` instead of failing — the
 * behaviour that keeps a legacy stored value re-saved unedited working.
 */
export function parseArContactPhone(input: unknown): ArContactPhoneResult {
  if (typeof input !== 'string') return { ok: false, errorCode: 'phone.required' }

  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: false, errorCode: 'phone.required' }

  const parsed = parsePhoneNumberFromString(trimmed, 'AR')
  if (!parsed || !parsed.isValid()) return { ok: false, errorCode: 'phone.invalid' }

  if (parsed.country !== 'AR') return { ok: false, errorCode: 'phone.country_unsupported' }

  return { ok: true, e164: parsed.number }
}
