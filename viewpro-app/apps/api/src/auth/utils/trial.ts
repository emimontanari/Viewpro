// Fixed trial duration (registration + N days). Purely informational this
// slice — nothing enforces it. Not env/per-plan configurable (spec invariant).
export const TRIAL_DURATION_DAYS = 14

/**
 * Computes the trial end date as `from + TRIAL_DURATION_DAYS` calendar days.
 * Pure function — does not mutate `from`.
 */
export function computeTrialEndsAt(from: Date): Date {
  const result = new Date(from.getTime())
  result.setUTCDate(result.getUTCDate() + TRIAL_DURATION_DAYS)
  return result
}
