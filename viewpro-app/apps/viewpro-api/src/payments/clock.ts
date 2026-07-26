/**
 * platform-payment-ledger — injectable clock.
 *
 * Overdue depends on "today", and a test that cannot control today is either
 * flaky or written to always pass. Injecting the clock lets the suite pin a
 * date and assert the boundary exactly (last day of a period vs the next
 * morning) instead of stubbing globals.
 */
export interface Clock {
  now(): Date
}

export const CLOCK = Symbol('CLOCK')

export const systemClock: Clock = {
  now: () => new Date(),
}
