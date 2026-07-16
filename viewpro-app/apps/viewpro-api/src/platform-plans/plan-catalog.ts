import type { PlatformTenantRegistryLimits } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * platform-manual-plans (Slice 4, Part 2) — D10: fixed three-tier plan
 * catalog, viewpro-api-owned single source of truth.
 *
 * The plan concept lives ONLY in viewpro-api (Design B isolation) — InmoView
 * never receives or stores a plan name, only the resolved limit numbers via
 * the existing control lane.
 */
export type PlanCode = 'BASICO' | 'PROFESIONAL' | 'EMPRESA'

// Deeply frozen: the catalog is a shared exported singleton passed by
// reference into the control-lane call. Freezing the outer map AND each tier
// object turns any accidental future mutation into a no-op (throws in strict
// mode) instead of a silent corruption of everyone's copy. No behavior change.
export const PLAN_CATALOG: Record<PlanCode, PlatformTenantRegistryLimits> = Object.freeze({
  BASICO: Object.freeze({
    maxUsers: 3,
    maxActivePropertyEngagements: 25,
    maxDocumentsStorageMb: 500,
  }),
  PROFESIONAL: Object.freeze({
    maxUsers: 10,
    maxActivePropertyEngagements: 100,
    maxDocumentsStorageMb: 5000,
  }),
  EMPRESA: Object.freeze({
    maxUsers: null,
    maxActivePropertyEngagements: null,
    maxDocumentsStorageMb: null,
  }),
})

/**
 * Pure reverse-lookup: does `limits` exactly match `plan`'s preset in
 * `PLAN_CATALOG`? Used at the ingest choke point (D5) to drift-clear a
 * stored plan label when raw-edited limits no longer match it, and to keep
 * the label when assign-plan's own push re-matches its own tier.
 */
export function planMatchesLimits(plan: PlanCode, limits: PlatformTenantRegistryLimits): boolean {
  const preset = PLAN_CATALOG[plan]

  return (
    preset.maxUsers === limits.maxUsers &&
    preset.maxActivePropertyEngagements === limits.maxActivePropertyEngagements &&
    preset.maxDocumentsStorageMb === limits.maxDocumentsStorageMb
  )
}
