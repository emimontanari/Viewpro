import type { PlatformOperatorRole } from '@prisma-platform/client'
import { PLATFORM_PERMISSIONS, type PlatformPermission } from './platform-permissions.constants'

const ANALYST_PERMISSIONS: readonly PlatformPermission[] = [
  PLATFORM_PERMISSIONS.METRICS_READ,
  PLATFORM_PERMISSIONS.TENANTS_READ,
  PLATFORM_PERMISSIONS.AUDIT_READ,
  // platform-payment-ledger: ANALYST reads the money ledger deliberately.
  // The role exists to look without touching, and an auditor who cannot see
  // payments cannot reconcile an activation against a bank statement.
  PLATFORM_PERMISSIONS.PAYMENTS_READ,
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
  // platform-payment-ledger: recording a payment is an operations task.
  // Reversal is NOT here — it stays OWNER-only below.
  PLATFORM_PERMISSIONS.PAYMENTS_WRITE,
]

const OWNER_PERMISSIONS: readonly PlatformPermission[] = [
  ...OPERATIONS_PERMISSIONS,
  PLATFORM_PERMISSIONS.OPERATORS_MANAGE,
  // platform-payment-ledger: reversal makes a recorded payment stop counting,
  // so it is held by exactly one role.
  PLATFORM_PERMISSIONS.PAYMENTS_REVERSE,
]

export const ROLE_PERMISSIONS: Record<PlatformOperatorRole, readonly PlatformPermission[]> = {
  ANALYST: ANALYST_PERMISSIONS,
  OPERATIONS: OPERATIONS_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
}

export function getPermissionsForRole(role: PlatformOperatorRole): readonly PlatformPermission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
