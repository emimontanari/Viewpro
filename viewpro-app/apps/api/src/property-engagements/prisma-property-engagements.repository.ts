import { Injectable } from '@nestjs/common'
import type { Prisma, PropertyAgent } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreatePropertyEngagementInput,
  ListPropertyEngagementsInput,
  PropertyEngagementsRepository,
  PropertyEngagementWithDetails,
  UpdatePropertyEngagementInput,
} from './property-engagements.repository'

const propertyEngagementInclude = {
  propertyAsset: true,
  agents: { include: { agentUser: true } },
  createdBy: true,
} satisfies Prisma.PropertyEngagementInclude

@Injectable()
export class PrismaPropertyEngagementsRepository implements PropertyEngagementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithAsset(input: CreatePropertyEngagementInput): Promise<PropertyEngagementWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const propertyAsset = await tx.propertyAsset.create({ data: input.propertyAsset })

      return tx.propertyEngagement.create({
        data: {
          ...input.engagement,
          tenantId: input.tenantId,
          propertyAssetId: propertyAsset.id,
          createdByUserId: input.createdByUserId,
        },
        include: propertyEngagementInclude,
      })
    })
  }

  async findMany(
    input: ListPropertyEngagementsInput,
  ): Promise<{ items: PropertyEngagementWithDetails[]; total: number }> {
    const where = this.buildTenantVisibilityWhere(input)

    const [items, total] = await Promise.all([
      this.prisma.propertyEngagement.findMany({
        where,
        include: propertyEngagementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.propertyEngagement.count({ where }),
    ])

    return { items, total }
  }

  findByIdForTenant(input: {
    tenantId: string
    engagementId: string
    userId: string
    canViewAll: boolean
  }): Promise<PropertyEngagementWithDetails | null> {
    return this.prisma.propertyEngagement.findFirst({
      where: this.buildTenantVisibilityWhere(input),
      include: propertyEngagementInclude,
    })
  }


  updateForTenant(input: UpdatePropertyEngagementInput): Promise<PropertyEngagementWithDetails | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.propertyEngagement.findFirst({
        where: this.buildTenantVisibilityWhere(input),
        select: { id: true, propertyAssetId: true },
      })

      if (!existing) {
        return null
      }

      if (Object.keys(input.propertyAsset).length > 0) {
        await tx.propertyAsset.update({
          where: { id: existing.propertyAssetId },
          data: input.propertyAsset,
        })
      }

      if (Object.keys(input.engagement).length > 0) {
        await tx.propertyEngagement.update({
          where: { id: existing.id },
          data: input.engagement,
        })
      }

      return tx.propertyEngagement.findUnique({
        where: { id: existing.id },
        include: propertyEngagementInclude,
      })
    })
  }

  assignAgent(input: {
    tenantId: string
    engagementId: string
    agentUserId: string
    assignedByUserId: string
  }): Promise<PropertyAgent> {
    return this.prisma.propertyAgent.create({
      data: {
        tenant: { connect: { id: input.tenantId } },
        propertyEngagement: { connect: { id: input.engagementId } },
        agentUser: { connect: { id: input.agentUserId } },
        assignedByUser: { connect: { id: input.assignedByUserId } },
      },
    })
  }

  private buildTenantVisibilityWhere(
    input: ListPropertyEngagementsInput | {
      tenantId: string
      engagementId: string
      userId: string
      canViewAll: boolean
    },
  ): Prisma.PropertyEngagementWhereInput {
    const where: Prisma.PropertyEngagementWhereInput = {
      tenantId: input.tenantId,
      ...('engagementId' in input ? { id: input.engagementId } : {}),
      ...('status' in input && input.status ? { status: input.status } : {}),
      ...('operationType' in input && input.operationType ? { operationType: input.operationType } : {}),
    }

    if (!input.canViewAll) {
      where.agents = { some: { agentUserId: input.userId, tenantId: input.tenantId } }
    }

    return where
  }
}
