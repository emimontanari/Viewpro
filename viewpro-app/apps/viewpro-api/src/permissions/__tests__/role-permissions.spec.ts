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
  it('ANALYST holds exactly the 3 READ permissions and no WRITE/MANAGE permission', () => {
    const permissions = getPermissionsForRole('ANALYST')

    expect([...permissions].sort()).toEqual(
      [
        PLATFORM_PERMISSIONS.METRICS_READ,
        PLATFORM_PERMISSIONS.TENANTS_READ,
        PLATFORM_PERMISSIONS.AUDIT_READ,
      ].sort(),
    )
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  })

  it('OPERATIONS holds the 3 READs + 2 WRITEs and does NOT include PLATFORM_OPERATORS_MANAGE', () => {
    const permissions = getPermissionsForRole('OPERATIONS')

    expect([...permissions].sort()).toEqual(
      [
        PLATFORM_PERMISSIONS.METRICS_READ,
        PLATFORM_PERMISSIONS.TENANTS_READ,
        PLATFORM_PERMISSIONS.AUDIT_READ,
        PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE,
        PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE,
      ].sort(),
    )
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  })

  it('OWNER is a strict superset of OPERATIONS, additionally holding PLATFORM_OPERATORS_MANAGE', () => {
    const ownerPermissions = getPermissionsForRole('OWNER')
    const operationsPermissions = getPermissionsForRole('OPERATIONS')

    for (const permission of operationsPermissions) {
      expect(ownerPermissions).toContain(permission)
    }
    expect(ownerPermissions).toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
    expect(ownerPermissions.length).toBe(operationsPermissions.length + 1)
  })

  it('ROLE_PERMISSIONS.OWNER includes PLATFORM_OPERATORS_MANAGE even though no route requires it (AC5)', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  })

  // 2a.13 — operator-activity-media (Slice 2a, D4): TENANT_DOCUMENTS_READ is
  // DECLARED (so @RequirePlatformPermission(...) compiles on the new route)
  // but intentionally NOT yet seeded into any role — seeding + the
  // OWNER-inherits/ANALYST-excluded enforcement spec is Slice 2b's job.
  it('TENANT_DOCUMENTS_READ is declared with the expected string value', () => {
    expect(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ).toBe('PLATFORM_TENANT_DOCUMENTS_READ')
  })

  it('TENANT_DOCUMENTS_READ is NOT yet granted to any role (Slice 2a: declared, not seeded)', () => {
    expect(getPermissionsForRole('ANALYST')).not.toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
    expect(getPermissionsForRole('OPERATIONS')).not.toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
    expect(getPermissionsForRole('OWNER')).not.toContain(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
  })
})
