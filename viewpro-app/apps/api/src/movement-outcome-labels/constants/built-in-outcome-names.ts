import { MovementBuiltInOutcome } from '@prisma/client'

/**
 * Set of all built-in outcome names lowercased for case-insensitive collision detection (FR-7).
 * Used in CreateLabelUseCase to reject label names that collide with built-in values.
 */
export const BUILT_IN_OUTCOME_NAMES_LOWER: ReadonlySet<string> = new Set(
  Object.values(MovementBuiltInOutcome).map((v) => v.toLowerCase()),
)
