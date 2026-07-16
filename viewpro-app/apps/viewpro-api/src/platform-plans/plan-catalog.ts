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

export const PLAN_CATALOG: Record<PlanCode, PlatformTenantRegistryLimits> = {
  BASICO: {
    maxUsers: 3,
    maxActivePropertyEngagements: 25,
    maxDocumentsStorageMb: 500,
  },
  PROFESIONAL: {
    maxUsers: 10,
    maxActivePropertyEngagements: 100,
    maxDocumentsStorageMb: 5000,
  },
  EMPRESA: {
    maxUsers: null,
    maxActivePropertyEngagements: null,
    maxDocumentsStorageMb: null,
  },
}

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
