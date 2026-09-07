import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, TenantMembershipStatus, TenantRole, UserStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { PrismaService } from '../../database/prisma.service'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { getPermissionsForRole } from '../../permissions/role-permissions'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { classifyRejectionTransition } from './review-transition-conflict'

const conflict = () => new ConflictException({ errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' })
const forbidden = () => new ForbiddenException('Insufficient permissions')

@Injectable()
export class RejectPropertyProposalUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string, input: { reviewRoundId?: unknown; reason?: unknown }) {
    const reason = this.normalizeReason(input.reason)
    const roundId = input.reviewRoundId
    if (typeof roundId !== 'string') throw conflict()
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
      if (!round) throw conflict()
      const transition = classifyRejectionTransition({ state: proposal.state, round, decision: round.decision, roundId, reviewerUserId: currentUser.id, reason })
      if (transition === 'replay') return proposal
      if (transition === 'conflict') throw conflict()

      const decidedAt = new Date()
      await tx.propertyProposalReviewDecision.create({
        data: { tenantId: tenant.tenantId, reviewRoundId: round.id, reviewerUserId: currentUser.id, outcome: 'REJECTED', rejectionReason: reason, decidedAt },
      })
      return tx.propertyProposal.update({ where: { id: proposal.id }, data: { state: 'RECHAZADA', version: { increment: 1 } } })
    })
  }

  private normalizeReason(reason: unknown): string {
    if (typeof reason !== 'string') throw new BadRequestException({ errorCode: 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID', message: 'Property proposal rejection reason is invalid' })
    const normalized = reason.trim()
    if (!normalized || normalized.length > 1000) throw new BadRequestException({ errorCode: 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID', message: 'Property proposal rejection reason is invalid' })
    return normalized
  }
}
