import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, TenantMembershipStatus, TenantRole, UserStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { PrismaService } from '../../database/prisma.service'
import {
  CanonicalPropertyMaterializer,
  type CanonicalPropertyMaterializerInput,
} from '../../property-engagements/canonical-property-materializer'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { getPermissionsForRole } from '../../permissions/role-permissions'
import type { TenantContext } from '../../tenant-context/tenant-context.types'

const conflict = () => new ConflictException({ errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' })
const forbidden = () => new ForbiddenException('Insufficient permissions')

@Injectable()
export class ApprovePropertyProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materializer: CanonicalPropertyMaterializer,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string, input: { reviewRoundId?: unknown }) {
    if (typeof input.reviewRoundId !== 'string') throw conflict()
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM property_proposals WHERE id = ${proposalId} AND "tenantId" = ${tenant.tenantId} FOR UPDATE
      `
      if (!locked.length) throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
      const proposal = await tx.propertyProposal.findFirst({ where: { id: proposalId, tenantId: tenant.tenantId } })
      if (!proposal) throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })

      const userIds = [...new Set([currentUser.id, proposal.proposedByUserId])].sort()
      const users = await tx.$queryRaw<{ id: string; status: UserStatus }[]>`
        SELECT id, status FROM users WHERE id IN (${Prisma.join(userIds)}) ORDER BY id ASC FOR NO KEY UPDATE
      `
      const memberships = await tx.$queryRaw<{ id: string; userId: string; role: TenantRole; status: TenantMembershipStatus }[]>`
        SELECT id, "userId", role, status FROM tenant_memberships
        WHERE "tenantId" = ${tenant.tenantId} AND "userId" IN (${Prisma.join(userIds)}) ORDER BY id ASC FOR NO KEY UPDATE
      `
      const reviewer = users.find(({ id }) => id === currentUser.id)
      const reviewerMembership = memberships.find(({ userId }) => userId === currentUser.id)
      const reviewerRole = reviewerMembership?.role
      if (reviewer?.status !== UserStatus.ACTIVE || reviewerMembership?.status !== TenantMembershipStatus.ACTIVE
        || (reviewerRole !== TenantRole.MANAGER && reviewerRole !== TenantRole.PRINCIPAL_MANAGER)
        || !getPermissionsForRole(reviewerRole).includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)) throw forbidden()
      if (proposal.proposedByUserId === currentUser.id) {
        throw new ForbiddenException({ errorCode: 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN', message: 'Property proposal self-review is forbidden' })
      }

      const round = await tx.propertyProposalReviewRound.findFirst({
        where: { proposalId: proposal.id, tenantId: tenant.tenantId }, orderBy: { roundNumber: 'desc' }, include: { decision: true },
      })
      if (!round || proposal.state !== 'EN_REVISION' || round.id !== input.reviewRoundId || round.decision !== null) throw conflict()

      await this.materializer.createInTransaction(tx, this.materializerInput(tenant.tenantId, proposal.id, proposal.proposedByUserId, currentUser.id, round))
      await tx.propertyProposalReviewDecision.create({
        data: { tenantId: tenant.tenantId, reviewRoundId: round.id, reviewerUserId: currentUser.id, outcome: 'APPROVED', rejectionReason: null, decidedAt: new Date() },
      })
      return tx.propertyProposal.update({ where: { id: proposal.id }, data: { state: 'APROBADA', version: { increment: 1 } } })
    })
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
