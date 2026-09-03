import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TenantRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { PERMISSIONS } from './permissions.constants'
import { getPermissionsForRole } from './role-permissions'

const EXPECTED_PERMISSIONS: Record<TenantRole, readonly string[]> = {
  [TenantRole.PRINCIPAL_MANAGER]: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.TENANT_MANAGE_SETTINGS,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
    PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
    PERMISSIONS.ENGAGEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_OUTCOME_LABELS_MANAGE,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.DOCUMENTS_REQUEST,
    PERMISSIONS.DOCUMENTS_REVIEW_OWN,
    PERMISSIONS.PROPERTY_PROPOSALS_REVIEW,
  ],
  [TenantRole.MANAGER]: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
    PERMISSIONS.ENGAGEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_OUTCOME_LABELS_MANAGE,
    PERMISSIONS.DOCUMENTS_VIEW_ALL,
    PERMISSIONS.DOCUMENTS_REQUEST,
    PERMISSIONS.PROPERTY_PROPOSALS_REVIEW,
  ],
  [TenantRole.AGENT]: [
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
    PERMISSIONS.MOVEMENTS_CREATE,
    PERMISSIONS.MOVEMENTS_OUTCOME_LABELS_MANAGE,
    PERMISSIONS.DOCUMENTS_REVIEW_OWN,
    PERMISSIONS.PROPERTY_PROPOSALS_SELLER,
  ],
}

describe('property-proposal role permissions', () => {
  it.each([
    TenantRole.PRINCIPAL_MANAGER,
    TenantRole.MANAGER,
    TenantRole.AGENT,
  ])('gives %s its exact ordered permission array', (role) => {
    expect(getPermissionsForRole(role)).toEqual(EXPECTED_PERMISSIONS[role])
  })

  it('does not derive principal-manager permissions from the permission catalog', () => {
    const source = readFileSync(join(__dirname, 'role-permissions.ts'), 'utf8')

    expect(source).not.toContain('Object.values(PERMISSIONS)')
  })
})
