export const PLATFORM_PERMISSIONS = {
  METRICS_READ: 'PLATFORM_METRICS_READ',
  TENANTS_READ: 'PLATFORM_TENANTS_READ',
  AUDIT_READ: 'PLATFORM_AUDIT_READ',
  TENANT_STATUS_WRITE: 'PLATFORM_TENANT_STATUS_WRITE',
  TENANT_LIMITS_WRITE: 'PLATFORM_TENANT_LIMITS_WRITE',
  OPERATORS_MANAGE: 'PLATFORM_OPERATORS_MANAGE',
  // operator-activity-media: declared in Slice 2a so
  // @RequirePlatformPermission(TENANT_DOCUMENTS_READ) could compile on the
  // document-read route ahead of seeding. Slice 2b seeded it into
  // OPERATIONS_PERMISSIONS (role-permissions.ts) — OWNER inherits, ANALYST is
  // deliberately excluded (least privilege, locked by role-permissions.spec.ts).
  TENANT_DOCUMENTS_READ: 'PLATFORM_TENANT_DOCUMENTS_READ',
  // platform-payment-ledger: money is split three ways on purpose. READ is
  // granted to every role INCLUDING ANALYST — fraud detection depends on the
  // people who cannot write money being able to see it. REVERSE is OWNER-only
  // because reversal is what makes a recorded payment stop counting, which is
  // precisely the lever someone covering a fraudulent entry would reach for.
  // The matrix is locked by payment-permissions.spec.ts.
  PAYMENTS_READ: 'PLATFORM_PAYMENTS_READ',
  PAYMENTS_WRITE: 'PLATFORM_PAYMENTS_WRITE',
  PAYMENTS_REVERSE: 'PLATFORM_PAYMENTS_REVERSE',
} as const

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS]

export const PERMISSION_DENIED_CODE = 'PERMISSION_DENIED'
