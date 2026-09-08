import type { TenantRole } from '@prisma/client'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import * as rolePermissions from '../../permissions/role-permissions'

export type ProposalResultLink = {
  canonicalEngagementId?: string
}

export type CurrentResultVisibility = {
  proposal: { id: string; tenantId: string; proposedByUserId: string; state: string }
  canonicalEngagement?: { id: string; tenantId: string; sourceProposalId: string }
  viewer?: { id: string; status: string }
  membership?: { userId: string; tenantId: string; status: string; role: TenantRole }
  assignments?: readonly { tenantId: string; engagementId: string; agentUserId: string }[]
}

const reviewerRoles = new Set<TenantRole>(['MANAGER', 'PRINCIPAL_MANAGER'])

/**
 * Resolves only a result ID that a caller freshly loaded for this viewer.
 * U13 owns the query and response wiring; this boundary never uses a proposal relation.
 */
export function resolveCanonicalEngagementId(current: CurrentResultVisibility): string | undefined {
  const { proposal, canonicalEngagement, viewer, membership } = current
  if (
    proposal.state !== 'APROBADA'
    || !canonicalEngagement
    || canonicalEngagement.tenantId !== proposal.tenantId
    || canonicalEngagement.sourceProposalId !== proposal.id
    || !viewer
    || viewer.status !== 'ACTIVE'
    || !membership
    || membership.userId !== viewer.id
    || membership.tenantId !== proposal.tenantId
    || membership.status !== 'ACTIVE'
  ) return undefined

  const permissions = rolePermissions.getPermissionsForRole(membership.role)
  const reviewerCanView = reviewerRoles.has(membership.role)
    && permissions.includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)
    && permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
  if (reviewerCanView) return canonicalEngagement.id

  const sellerCanView = viewer.id === proposal.proposedByUserId
    && membership.role === 'AGENT'
    && permissions.includes(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
    && permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)
    && current.assignments?.some((assignment) => (
      assignment.tenantId === proposal.tenantId
      && assignment.engagementId === canonicalEngagement.id
      && assignment.agentUserId === viewer.id
    ))
  return sellerCanView ? canonicalEngagement.id : undefined
}

export function mapPropertyProposalResultLink(canonicalEngagementId: string | undefined): ProposalResultLink {
  return canonicalEngagementId ? { canonicalEngagementId } : {}
}
