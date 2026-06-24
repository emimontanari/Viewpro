/**
 * App-local brand constants for the API (apps/api).
 * Single source of truth for the API's user/integrator-visible brand strings.
 *
 * Intentionally NOT imported from the FE brand module — separate deploy unit,
 * separate tsconfig. A brand flip must update BOTH files independently.
 */
export const API_BRAND = {
  /** Swagger document title */
  apiTitle: 'InmoView API',
  /** Swagger document description */
  apiDescription: 'REST API for InmoView'
} as const
