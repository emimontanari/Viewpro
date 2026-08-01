import { describe, expect, it } from 'vitest'
import { PLATFORM_PERMISSIONS } from '../platform-permissions.constants'
import { ROLE_PERMISSIONS, getPermissionsForRole } from '../role-permissions'

/**
 * T-03 — RED: ROLE_PERMISSIONS map (ANALYST/OPERATIONS/OWNER hierarchy).
 *
 * Spec: operator-platform-roles — Role Hierarchy — OPERATIONS Excludes
 *   PLATFORM_OPERATORS_MANAGE (D3)
 */
describe('ROLE_PERMISSIONS / getPermissionsForRole', () => {
  // platform-payment-ledger: ANALYST gained PAYMENTS_READ. The role's shape is
  // unchanged — read everything, write nothing — and the money ledger is the
  // one place where that read access is the point: an auditor who cannot see
  // payments cannot reconcile an activation against a bank statement.
  it('ANALYST holds exactly the READ permissions and no WRITE/MANAGE permission', () => {
    const permissions = getPermissionsForRole('ANALYST')

    expect([...permissions].sort()).toEqual(
      [
        PLATFORM_PERMISSIONS.METRICS_READ,
        PLATFORM_PERMISSIONS.TENANTS_READ,
        PLATFORM_PERMISSIONS.AUDIT_READ,
        PLATFORM_PERMISSIONS.PAYMENTS_READ,
      ].sort(),
    )
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  })

  // operator-activity-media (Slice 2b, D4): OPERATIONS now also holds
  // TENANT_DOCUMENTS_READ (seeded here) — updated from the pre-2b exact-list
  // assertion (which only had 5 entries) now that seeding has landed.
  it('OPERATIONS holds the READs + tenant WRITEs + TENANT_DOCUMENTS_READ + PAYMENTS_WRITE, and NOT OPERATORS_MANAGE or PAYMENTS_REVERSE', () => {
    const permissions = getPermissionsForRole('OPERATIONS')

    expect([...permissions].sort()).toEqual(
      [
        PLATFORM_PERMISSIONS.METRICS_READ,
        PLATFORM_PERMISSIONS.TENANTS_READ,
        PLATFORM_PERMISSIONS.AUDIT_READ,
        PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE,
        PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE,
        PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ,
        PLATFORM_PERMISSIONS.PAYMENTS_READ,
        PLATFORM_PERMISSIONS.PAYMENTS_WRITE,
      ].sort(),
    )
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
  })

  it('OWNER is a strict superset of OPERATIONS, additionally holding PLATFORM_OPERATORS_MANAGE', () => {
    const ownerPermissions = getPermissionsForRole('OWNER')
    const operationsPermissions = getPermissionsForRole('OPERATIONS')

    for (const permission of operationsPermissions) {
      expect(ownerPermissions).toContain(permission)
    }
    expect(ownerPermissions).toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
    // platform-payment-ledger: OWNER now adds two beyond OPERATIONS —
    // OPERATORS_MANAGE and PAYMENTS_REVERSE.
    expect(ownerPermissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
    expect(ownerPermissions.length).toBe(operationsPermissions.length + 2)
  })

  it('ROLE_PERMISSIONS.OWNER includes PLATFORM_OPERATORS_MANAGE even though no route requires it (AC5)', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  })

  it('TENANT_DOCUMENTS_READ is declared with the expected string value', () => {
    expect(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ).toBe('PLATFORM_TENANT_DOCUMENTS_READ')
  })

  // 2b.1 — operator-activity-media (Slice 2b, D4): TENANT_DOCUMENTS_READ is
  // now SEEDED into OPERATIONS_PERMISSIONS (role-permissions.ts:10) → OWNER
  // inherits it transitively (OWNER_PERMISSIONS spreads OPERATIONS_PERMISSIONS).
  // ANALYST is DELIBERATELY excluded — least-privilege boundary, locked here as
  // a regression guard so a future role edit can't silently widen access.
  // This inverts 2a.13's "not yet granted to any role" assertion now that
  // seeding has landed.
  it('TENANT_DOCUMENTS_READ is granted to OPERATIONS and OWNER (inherited), and NOT to ANALYST (Slice 2b: seeded)', () => {
    expect(getPermissionsForRole('ANALYST')).not.toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
    expect(getPermissionsForRole('OPERATIONS')).toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
    expect(getPermissionsForRole('OWNER')).toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
  })
})
