import type { PlatformOperatorRole } from '@prisma-platform/client'
import { PLATFORM_PERMISSIONS, type PlatformPermission } from './platform-permissions.constants'

const ANALYST_PERMISSIONS: readonly PlatformPermission[] = [
  PLATFORM_PERMISSIONS.METRICS_READ,
  PLATFORM_PERMISSIONS.TENANTS_READ,
  PLATFORM_PERMISSIONS.AUDIT_READ,
]

const OPERATIONS_PERMISSIONS: readonly PlatformPermission[] = [
  ...ANALYST_PERMISSIONS,
  PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE,
  PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE,
  // operator-activity-media (Slice 2b, D4): granted to OPERATIONS (and
  // inherited by OWNER below) — operators who manage tenants, not the
  // read-only ANALYST role. Least-privilege boundary locked by
  // role-permissions.spec.ts.
  PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ,
]

const OWNER_PERMISSIONS: readonly PlatformPermission[] = [
  ...OPERATIONS_PERMISSIONS,
  PLATFORM_PERMISSIONS.OPERATORS_MANAGE,
]

export const ROLE_PERMISSIONS: Record<PlatformOperatorRole, readonly PlatformPermission[]> = {
  ANALYST: ANALYST_PERMISSIONS,
  OPERATIONS: OPERATIONS_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
}

export function getPermissionsForRole(role: PlatformOperatorRole): readonly PlatformPermission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
