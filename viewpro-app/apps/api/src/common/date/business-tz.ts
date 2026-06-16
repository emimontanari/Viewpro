/**
 * Business timezone helpers for the ViewPro API.
 *
 * MVP canonical timezone: America/Argentina/Buenos_Aires (UTC-3, no DST).
 * These helpers convert YYYY-MM-DD date-only strings into precise UTC instants
 * using the Intl.DateTimeFormat API — no external dependency required.
 *
 * Design decision (AD-1 from design.md):
 *   Use native Intl.DateTimeFormat so the API package stays dep-free for dates.
 *   date-fns lives only in apps/app-new, not in the API.
 */

export const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parse a YYYY-MM-DD string as the UTC instant of 00:00:00 (start of day)
 * in the given timezone. Defaults to BUSINESS_TIMEZONE.
 *
 * Algorithm:
 *   1. Construct a naive UTC midnight as an initial reference point.
 *   2. Use Intl.DateTimeFormat to find what wall-clock hour/minute/second
 *      that UTC instant corresponds to in `timezone`.
 *   3. Subtract the wall-clock offset from UTC midnight to arrive at a candidate.
 *   4. If the candidate's local date doesn't match the requested date (can happen
 *      when UTC midnight is already showing the previous local day), add 24 hours.
 *
 * This works correctly for fixed-offset zones (Argentina, UTC-3) and DST zones alike.
 *
 * Example (Argentina, UTC-3):
 *   parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')
 *   → new Date('2026-06-15T03:00:00.000Z')
 *   (midnight Buenos Aires = 03:00 UTC)
 *
 * @throws if input is not a bare YYYY-MM-DD string (no time component allowed).
 */
export function parseBusinessDayStart(
  input: string,
  timezone: string = BUSINESS_TIMEZONE,
): Date {
  if (!DATE_ONLY_RE.test(input)) {
    throw new TypeError(
      `parseBusinessDayStart expects a YYYY-MM-DD date-only string, got: "${input}"`,
    )
  }

  // Step 1: Use UTC midnight as a reference point.
  const utcReference = new Date(`${input}T00:00:00Z`)

  // Step 2: Find the wall-clock time that UTC midnight maps to in `timezone`.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const getPart = (d: Date, type: string): number => {
    const parts = fmt.formatToParts(d)
    const part = parts.find((p) => p.type === type)
    if (!part) throw new Error(`Intl part "${type}" not found`)
    const v = parseInt(part.value, 10)
    // hour12:false can return 24 for midnight — normalise to 0
    return type === 'hour' && v === 24 ? 0 : v
  }

  const wallHour = getPart(utcReference, 'hour')
  const wallMinute = getPart(utcReference, 'minute')
  const wallSecond = getPart(utcReference, 'second')

  // Step 3: Subtract the wall-clock time-of-day from utcReference to get a candidate.
  // If the reference is at 21:00 local on day D-1, subtracting 21h gives midnight of D-1.
  const wallOffsetMs = (wallHour * 3600 + wallMinute * 60 + wallSecond) * 1000
  const candidate = new Date(utcReference.getTime() - wallOffsetMs)

  // Step 4: Verify the candidate's local day matches the requested input day.
  const inputDay = parseInt(input.slice(8, 10), 10)
  const candidateDay = getPart(candidate, 'day')

  if (candidateDay === inputDay) {
    return candidate
  }

  // If the candidate landed on the previous day, advance by 24 hours.
  return new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Parse a YYYY-MM-DD string as the EXCLUSIVE end-of-day in the given timezone:
 * the UTC instant of 00:00:00 of (input + 1 day). Defaults to BUSINESS_TIMEZONE.
 *
 * IMPORTANT: Use with Prisma `lt`, NOT `lte`.
 * Rationale: exclusive-end avoids millisecond edge cases and produces correct
 * full-day ranges without timestamp-of-final-tick games.
 *
 * Example:
 *   parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')
 *   → new Date('2026-06-16T03:00:00.000Z')
 *
 * Do NOT change `lt` to `lte` at the call site: that would re-introduce the
 * millisecond-boundary edge case this design intentionally avoids.
 *
 * @throws if input is not a bare YYYY-MM-DD string.
 */
export function parseBusinessDayExclusiveEnd(
  input: string,
  timezone: string = BUSINESS_TIMEZONE,
): Date {
  if (!DATE_ONLY_RE.test(input)) {
    throw new TypeError(
      `parseBusinessDayExclusiveEnd expects a YYYY-MM-DD date-only string, got: "${input}"`,
    )
  }

  // Add one calendar day to the YYYY-MM-DD string and return its start-of-day.
  const nextDay = addOneCalendarDay(input)
  return parseBusinessDayStart(nextDay, timezone)
}

/**
 * Add exactly one calendar day to a YYYY-MM-DD string.
 * Uses UTC Date arithmetic to avoid timezone side-effects during the addition.
 */
function addOneCalendarDay(input: string): string {
  const [yearStr, monthStr, dayStr] = input.split('-')
  const year = parseInt(yearStr!, 10)
  const month = parseInt(monthStr!, 10) - 1 // 0-indexed
  const day = parseInt(dayStr!, 10)

  const d = new Date(Date.UTC(year, month, day + 1))
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = d.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${dd}`
}
