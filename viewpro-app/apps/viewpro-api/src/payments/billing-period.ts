/**
 * platform-payment-ledger — billing periods and the derived paid-through /
 * overdue state.
 *
 * Periods are calendar dates, not instants: a payment covers "August", not
 * "from this millisecond to that one". They are handled as `YYYY-MM-DD`
 * strings so no timezone conversion can shift a boundary by a day, which is
 * the classic way an end-of-month period silently becomes overdue one day
 * early for anyone east of the server.
 *
 * Overdue is derived here at read time. It is never persisted, never produced
 * by a scheduled job, and never restricts a tenant's access — going overdue
 * only changes what operators see in the console.
 *
 * Spec: Paid-Through Date Is Derived, Overdue Is Derived and Never Restricts
 *   Access, Period Boundaries Use a Fixed Timezone.
 */

/**
 * Billing periods are interpreted in Argentina time regardless of where the
 * process runs. Stated explicitly rather than inherited from the container so
 * a UTC deployment behaves identically to a developer's laptop.
 */
export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** A calendar date in `YYYY-MM-DD` form. */
export type CalendarDate = string

export interface BillingPeriod {
  readonly start: CalendarDate
  readonly end: CalendarDate
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const MILLISECONDS_PER_DAY = 86_400_000

function assertCalendarDate(value: string, label: string): void {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new TypeError(`${label} must use YYYY-MM-DD format, received "${value}"`)
  }

  if (Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new TypeError(`${label} must use YYYY-MM-DD format, received "${value}"`)
  }
}

/**
 * Build a period, rejecting anything an operator could not have meant.
 *
 * A zero-length period is rejected alongside an inverted one: paying for a
 * window that covers no days is always a data-entry mistake, and letting it
 * through would produce a payment that can never make a tenant paid-up.
 */
export function createBillingPeriod(start: string, end: string): BillingPeriod {
  assertCalendarDate(start, 'Period start')
  assertCalendarDate(end, 'Period end')

  if (end <= start) {
    throw new RangeError(`Period end must be after period start (${start} → ${end})`)
  }

  return Object.freeze({ start, end })
}

/**
 * The furthest period end across the given payments, or null when there are
 * none. Callers pass only non-reversed payments — the reversal filter lives in
 * the repository so it is expressed once rather than restated per caller.
 *
 * Lexicographic comparison is exact for `YYYY-MM-DD`, so no date parsing is
 * needed to find the maximum.
 */
export function paidThrough(payments: readonly { end: CalendarDate }[]): CalendarDate | null {
  return payments.reduce<CalendarDate | null>(
    (furthest, payment) => (furthest === null || payment.end > furthest ? payment.end : furthest),
    null,
  )
}

/**
 * Days elapsed since the paid-through date, or null when the tenant is not
 * overdue.
 *
 * Null covers two distinct situations that both mean "do not flag this
 * tenant": it is still within its paid period, or it was never paid for at
 * all. A tenant nobody ever charged is not overdue — it was never due.
 */
export function overdueDaysElapsed(
  paidThroughDate: CalendarDate | null,
  today: CalendarDate,
): number | null {
  if (paidThroughDate === null) {
    return null
  }

  assertCalendarDate(paidThroughDate, 'Paid-through date')
  assertCalendarDate(today, 'Current date')

  if (today <= paidThroughDate) {
    return null
  }

  const elapsedMs =
    Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${paidThroughDate}T00:00:00.000Z`)

  return Math.round(elapsedMs / MILLISECONDS_PER_DAY)
}

/**
 * The calendar date at `instant` in the given timezone.
 *
 * `instant` is injected so tests pin it instead of stubbing the global clock,
 * and so the caller decides which clock is authoritative.
 */
export function todayIn(timeZone: string, instant: Date): CalendarDate {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape used throughout.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}
