import { Injectable } from '@nestjs/common'
import { TenantMembershipStatus, TenantRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreatePropertyProposalDraftInput,
  CreatePropertyProposalResult,
  PropertyProposalsRepository,
  SellerPropertyProposalsPage,
} from './property-proposals.repository'

@Injectable()
export class PrismaPropertyProposalsRepository implements PropertyProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreatePropertyProposalDraftInput): Promise<CreatePropertyProposalResult> {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users
        WHERE id = ${input.proposedByUserId} AND status = ${UserStatus.ACTIVE}::"UserStatus"
        FOR NO KEY UPDATE
      `
      if (users.length === 0) return { kind: 'ineligible' }

      const memberships = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM tenant_memberships
        WHERE "userId" = ${input.proposedByUserId} AND "tenantId" = ${input.tenantId}
          AND status = ${TenantMembershipStatus.ACTIVE}::"TenantMembershipStatus"
          AND role = ${TenantRole.AGENT}::"TenantRole"
        FOR NO KEY UPDATE
      `
      if (memberships.length === 0) return { kind: 'ineligible' }

      const proposal = await tx.propertyProposal.create({
        data: { ...input, state: 'BORRADOR', version: 1, latestSubmittedAt: null },
      })
      return { kind: 'created', proposal }
    })
  }

  async listForSeller(input: {
    tenantId: string
    proposedByUserId: string
    page: number
    pageSize: number
  }): Promise<SellerPropertyProposalsPage> {
    const where = { tenantId: input.tenantId, proposedByUserId: input.proposedByUserId }
    const [items, total] = await Promise.all([
      this.prisma.propertyProposal.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.propertyProposal.count({ where }),
    ])
    return { items, total }
  }

  findForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }) {
    return this.prisma.propertyProposal.findFirst({
      where: {
        id: input.proposalId,
        tenantId: input.tenantId,
        proposedByUserId: input.proposedByUserId,
      },
    })
  }
}
