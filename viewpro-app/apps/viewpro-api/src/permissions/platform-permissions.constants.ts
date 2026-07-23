export const PLATFORM_PERMISSIONS = {
  METRICS_READ: 'PLATFORM_METRICS_READ',
  TENANTS_READ: 'PLATFORM_TENANTS_READ',
  AUDIT_READ: 'PLATFORM_AUDIT_READ',
  TENANT_STATUS_WRITE: 'PLATFORM_TENANT_STATUS_WRITE',
  TENANT_LIMITS_WRITE: 'PLATFORM_TENANT_LIMITS_WRITE',
  OPERATORS_MANAGE: 'PLATFORM_OPERATORS_MANAGE',
  // operator-activity-media (Slice 2a, D4): declared here so
  // @RequirePlatformPermission(TENANT_DOCUMENTS_READ) can compile on the new
  // document-read route. Declaration ONLY — intentionally NOT added to
  // OPERATIONS_PERMISSIONS/ROLE_PERMISSIONS in this slice, so no role
  // currently grants it (seeding + the OWNER-inherits/ANALYST-excluded
  // enforcement spec ship in Slice 2b). The route (2a.12) mocks/overrides
  // the permission guard until then.
  TENANT_DOCUMENTS_READ: 'PLATFORM_TENANT_DOCUMENTS_READ',
} as const

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS]

export const PERMISSION_DENIED_CODE = 'PERMISSION_DENIED'
