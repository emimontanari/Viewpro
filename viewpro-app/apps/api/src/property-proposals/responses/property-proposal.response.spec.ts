import { describe, expect, it, vi } from 'vitest'
import type { TenantRole } from '@prisma/client'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import * as rolePermissions from '../../permissions/role-permissions'
import {
  mapPropertyProposalResultLink,
  resolveCanonicalEngagementId,
  type CurrentResultVisibility,
} from './property-proposal.response'

function current(overrides: Partial<CurrentResultVisibility> = {}): CurrentResultVisibility {
  return {
    proposal: { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'APROBADA' },
    canonicalEngagement: { id: 'engagement-1', tenantId: 'tenant-1', sourceProposalId: 'proposal-1' },
    viewer: { id: 'seller-1', status: 'ACTIVE' },
    membership: { userId: 'seller-1', tenantId: 'tenant-1', status: 'ACTIVE', role: 'AGENT' as TenantRole },
    assignments: [{ tenantId: 'tenant-1', engagementId: 'engagement-1', agentUserId: 'seller-1' }],
    ...overrides,
  }
}

function reviewer(role: TenantRole = 'MANAGER'): CurrentResultVisibility {
  return current({
    viewer: { id: 'reviewer-1', status: 'ACTIVE' },
    membership: { userId: 'reviewer-1', tenantId: 'tenant-1', status: 'ACTIVE', role },
    assignments: [],
  })
}

function resultLink(visibility: CurrentResultVisibility) {
  return mapPropertyProposalResultLink(resolveCanonicalEngagementId(visibility))
}

function expectOmitted(visibility: CurrentResultVisibility) {
  expect(resultLink(visibility)).toEqual({})
}

function withCapabilityRemoved(role: TenantRole, capability: string, assertOmitted: () => void) {
  const getPermissions = rolePermissions.getPermissionsForRole
  const permissions = vi.spyOn(rolePermissions, 'getPermissionsForRole').mockImplementation((currentRole) => (
    currentRole === role
      ? getPermissions(currentRole).filter((currentCapability) => currentCapability !== capability)
      : getPermissions(currentRole)
  ))
  try {
    assertOmitted()
  } finally {
    permissions.mockRestore()
  }
}

describe('property proposal result responses', () => {
  it('emits only the freshly authorized same-tenant assigned seller result ID', () => {
    expect(resultLink(current())).toEqual({ canonicalEngagementId: 'engagement-1' })
  })

  it.each(['MANAGER', 'PRINCIPAL_MANAGER'] as TenantRole[])('emits a current qualified %s reviewer result without an assignment', (role) => {
    expect(resultLink(reviewer(role))).toEqual({ canonicalEngagementId: 'engagement-1' })
  })

  it.each([
    ['missing canonical result', () => current({ canonicalEngagement: undefined })],
    ['cross-tenant result', () => current({ canonicalEngagement: { id: 'engagement-1', tenantId: 'tenant-2', sourceProposalId: 'proposal-1' } })],
    ['unlinked canonical result', () => current({ canonicalEngagement: { id: 'engagement-1', tenantId: 'tenant-1', sourceProposalId: 'other-proposal' } })],
    ['assignment from another tenant', () => current({ assignments: [{ tenantId: 'tenant-2', engagementId: 'engagement-1', agentUserId: 'seller-1' }] })],
    ['assignment for another engagement', () => current({ assignments: [{ tenantId: 'tenant-1', engagementId: 'engagement-2', agentUserId: 'seller-1' }] })],
    ['assignment for another agent', () => current({ assignments: [{ tenantId: 'tenant-1', engagementId: 'engagement-1', agentUserId: 'seller-2' }] })],
    ['missing viewer', () => current({ viewer: undefined })],
    ['missing membership', () => current({ membership: undefined })],
    ['membership for another user', () => current({ membership: { userId: 'seller-2', tenantId: 'tenant-1', status: 'ACTIVE', role: 'AGENT' as TenantRole } })],
    ['membership for another tenant', () => current({ membership: { userId: 'seller-1', tenantId: 'tenant-2', status: 'ACTIVE', role: 'AGENT' as TenantRole } })],
    ['inactive viewer', () => current({ viewer: { id: 'seller-1', status: 'SUSPENDED' } })],
    ['inactive membership', () => current({ membership: { userId: 'seller-1', tenantId: 'tenant-1', status: 'INACTIVE', role: 'AGENT' as TenantRole } })],
    ['assigned viewer who is not the proposer', () => current({
      viewer: { id: 'seller-2', status: 'ACTIVE' },
      membership: { userId: 'seller-2', tenantId: 'tenant-1', status: 'ACTIVE', role: 'AGENT' as TenantRole },
      assignments: [{ tenantId: 'tenant-1', engagementId: 'engagement-1', agentUserId: 'seller-2' }],
    })],
  ])('omits the result ID without leakage for %s', (_reason, build) => {
    expectOmitted(build())
  })

  it.each(['BORRADOR', 'EN_REVISION', 'RECHAZADA'])('omits the result ID for non-approved %s proposals', (state) => {
    expectOmitted(current({ proposal: { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state } }))
  })

  it('denies an otherwise-capable viewer with a non-reviewer role', () => {
    const permissions = vi.spyOn(rolePermissions, 'getPermissionsForRole').mockReturnValue([
      PERMISSIONS.PROPERTY_PROPOSALS_REVIEW,
      PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
    ])
    try {
      expectOmitted(reviewer('AGENT' as TenantRole))
    } finally {
      permissions.mockRestore()
    }
  })

  it('omits an otherwise seller-eligible proposer when the membership role is not AGENT', () => {
    const getPermissions = rolePermissions.getPermissionsForRole
    const permissions = vi.spyOn(rolePermissions, 'getPermissionsForRole').mockImplementation((role) => (
      role === 'MANAGER'
        ? [PERMISSIONS.PROPERTY_PROPOSALS_SELLER, PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED]
        : getPermissions(role)
    ))
    try {
      expectOmitted(current({
        membership: { userId: 'seller-1', tenantId: 'tenant-1', status: 'ACTIVE', role: 'MANAGER' },
      }))
    } finally {
      permissions.mockRestore()
    }
  })

  it.each([
    PERMISSIONS.PROPERTY_PROPOSALS_SELLER,
    PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
  ])('omits the seller result ID when required capability %s is lost', (capability) => {
    withCapabilityRemoved('AGENT', capability, () => expectOmitted(current()))
  })

  it.each(['MANAGER', 'PRINCIPAL_MANAGER'] as TenantRole[])('%s omits the reviewer result ID when each required capability is lost', (role) => {
    for (const capability of [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW, PERMISSIONS.ENGAGEMENTS_VIEW_ALL]) {
      withCapabilityRemoved(role, capability, () => expectOmitted(reviewer(role)))
    }
  })
})
