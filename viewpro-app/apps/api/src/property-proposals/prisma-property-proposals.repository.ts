import { Injectable } from '@nestjs/common'
import type { PrismaService } from '../database/prisma.service'
import type { PropertyProposalsRepository, SellerPropertyProposalsPage } from './property-proposals.repository'

@Injectable()
export class PrismaPropertyProposalsRepository implements PropertyProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
