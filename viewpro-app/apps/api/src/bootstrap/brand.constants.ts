/**
 * App-local brand constants for the API (apps/api).
 * Phase 1: extraction only — values read "ViewPro".
 * Phase 2: flip values to "InmoView" by editing this file alone.
 *
 * Intentionally NOT imported from the FE brand module — separate deploy unit,
 * separate tsconfig. Any flip in Phase 2 must update BOTH files independently.
 */
export const API_BRAND = {
  /** Swagger document title */
  apiTitle: 'ViewPro API',
  /** Swagger document description */
  apiDescription: 'REST API for ViewPro'
} as const
