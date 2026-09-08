import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TenantMembershipStatus, TenantRole, UserStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { PrismaService } from '../../database/prisma.service'
import {
  ActivePropertyCapacityExceededError,
  ActivePropertyEngagementCapacity,
} from '../../property-engagements/active-property-engagement-capacity'
import {
  CanonicalPropertyMaterializer,
  type CanonicalPropertyMaterializerInput,
} from '../../property-engagements/canonical-property-materializer'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { getPermissionsForRole } from '../../permissions/role-permissions'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { lockApprovalIdentities } from '../helpers/approval-lock-order'
import { isApprovalReplay } from '../helpers/approval-replay'

const conflict = () => new ConflictException({ errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' })
const forbidden = () => new ForbiddenException('Insufficient permissions')
const proposerIneligible = () => new ConflictException({ errorCode: 'PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE', message: 'Property proposal proposer is ineligible' })
const quotaExceeded = () => new ConflictException({ errorCode: 'TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED', message: 'Tenant active property engagement limit exceeded' })

@Injectable()
export class ApprovePropertyProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materializer: CanonicalPropertyMaterializer,
    private readonly activePropertyEngagementCapacity: ActivePropertyEngagementCapacity,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string, input: { reviewRoundId?: unknown }) {
    if (typeof input.reviewRoundId !== 'string') throw conflict()
    const reviewRoundId = input.reviewRoundId
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM property_proposals WHERE id = ${proposalId} AND "tenantId" = ${tenant.tenantId} FOR UPDATE
        `
        if (!locked.length) throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
        const proposal = await tx.propertyProposal.findFirst({ where: { id: proposalId, tenantId: tenant.tenantId } })
        if (!proposal) throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })

        const capacity = await this.activePropertyEngagementCapacity.acquire(tx, tenant.tenantId)
        const identities = await lockApprovalIdentities(tx, { tenantId: tenant.tenantId, reviewerUserId: currentUser.id, proposerUserId: proposal.proposedByUserId })
        const reviewerRole = identities.reviewerMembership?.role
        if (identities.reviewer?.status !== UserStatus.ACTIVE || identities.reviewerMembership?.status !== TenantMembershipStatus.ACTIVE
          || (reviewerRole !== TenantRole.MANAGER && reviewerRole !== TenantRole.PRINCIPAL_MANAGER)
          || !getPermissionsForRole(reviewerRole).includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)) throw forbidden()
        if (proposal.proposedByUserId === currentUser.id) {
          throw new ForbiddenException({ errorCode: 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN', message: 'Property proposal self-review is forbidden' })
        }
        const round = await tx.propertyProposalReviewRound.findFirst({
          where: { proposalId: proposal.id, tenantId: tenant.tenantId }, orderBy: { roundNumber: 'desc' }, include: { decision: true },
        })
        const sourceEngagement = proposal.state === 'APROBADA'
          ? await tx.propertyEngagement.findFirst({ where: { sourceProposalId: proposal.id, tenantId: tenant.tenantId } })
          : null
        if (round && isApprovalReplay({
          proposalState: proposal.state, requestedRoundId: reviewRoundId, roundId: round.id,
          decision: round.decision, reviewerUserId: currentUser.id, hasSameTenantSource: sourceEngagement !== null,
        })) return proposal
        if (!round || proposal.state !== 'EN_REVISION' || round.id !== reviewRoundId || round.decision !== null) throw conflict()
        if (identities.proposer?.status !== UserStatus.ACTIVE || identities.proposerMembership?.status !== TenantMembershipStatus.ACTIVE
          || identities.proposerMembership?.role !== TenantRole.AGENT) throw proposerIneligible()

        await capacity.assertAvailable()
        await this.materializer.createInTransaction(tx, this.materializerInput(tenant.tenantId, proposal.id, proposal.proposedByUserId, currentUser.id, round))
        await tx.propertyProposalReviewDecision.create({
          data: { tenantId: tenant.tenantId, reviewRoundId: round.id, reviewerUserId: currentUser.id, outcome: 'APPROVED', rejectionReason: null, decidedAt: new Date() },
        })
        return tx.propertyProposal.update({ where: { id: proposal.id }, data: { state: 'APROBADA', version: { increment: 1 } } })
      })
    } catch (error) {
      if (error instanceof ActivePropertyCapacityExceededError) throw quotaExceeded()
      throw error
    }
  }

  private materializerInput(
    tenantId: string,
    sourceProposalId: string,
    proposerUserId: string,
    reviewerUserId: string,
    round: {
      title: string; addressLine: string | null; city: string | null; province: string | null
      propertyType: CanonicalPropertyMaterializerInput['propertyType'] | null
      operationType: CanonicalPropertyMaterializerInput['operationType'] | null
      totalAreaSqm: number | null; coveredAreaSqm: number | null; rooms: number | null; bedrooms: number | null
      bathrooms: number | null; garages: number | null; ageYears: number | null; orientation: string | null
      ownerName: string | null; ownerEmail: string | null; publishedPriceCents: number | null; currency: string | null
    },
  ): CanonicalPropertyMaterializerInput {
    return {
      tenantId, sourceProposalId, creatorUserId: proposerUserId,
      title: round.title, addressLine: round.addressLine!, city: round.city!, province: round.province!,
      propertyType: round.propertyType!, operationType: round.operationType!,
      totalAreaSqm: round.totalAreaSqm, coveredAreaSqm: round.coveredAreaSqm, rooms: round.rooms,
      bedrooms: round.bedrooms, bathrooms: round.bathrooms, garages: round.garages, ageYears: round.ageYears,
      orientation: round.orientation, ownerName: round.ownerName, ownerEmail: round.ownerEmail,
      publishedPriceCents: round.publishedPriceCents, currency: round.currency,
      assignment: { agentUserId: proposerUserId, assignedByUserId: reviewerUserId },
    }
  }
}
