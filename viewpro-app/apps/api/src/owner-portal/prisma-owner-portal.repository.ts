import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  OwnerEngagementRecord,
  OwnerMovementRecord,
  OwnerPortalRepository,
  OwnerPropertyRecord,
} from './owner-portal.repository'

const activeOwnerAccess = (userId: string) => ({
  owners: { some: { userId, accessStatus: 'ACTIVE' } },
}) satisfies Prisma.PropertyAssetWhereInput

const ownerEngagementInclude = {
  tenant: { select: { id: true, name: true } },
  agents: { select: { agentUserId: true, agentUser: { select: { firstName: true, email: true } } } },
} satisfies Prisma.PropertyEngagementInclude

const ownerMovementInclude = {
  createdBy: { select: { id: true, email: true, firstName: true } },
} satisfies Prisma.MovementInclude

@Injectable()
export class PrismaOwnerPortalRepository implements OwnerPortalRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPropertiesByOwnerUserId(userId: string): Promise<OwnerPropertyRecord[]> {
    return this.prisma.propertyAsset.findMany({
      where: activeOwnerAccess(userId),
      orderBy: { createdAt: 'desc' },
    })
  }

  findPropertyByOwner(input: {
    userId: string
    propertyAssetId: string
  }): Promise<OwnerPropertyRecord | null> {
    return this.prisma.propertyAsset.findFirst({
      where: {
        id: input.propertyAssetId,
        ...activeOwnerAccess(input.userId),
      },
    })
  }

  findEngagementsForOwnerProperty(input: {
    userId: string
    propertyAssetId: string
  }): Promise<OwnerEngagementRecord[]> {
    return this.prisma.propertyEngagement.findMany({
      where: {
        propertyAssetId: input.propertyAssetId,
        propertyAsset: activeOwnerAccess(input.userId),
      },
      include: ownerEngagementInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findEngagementTimelineForOwner(input: {
    userId: string
    engagementId: string
    page: number
    pageSize: number
    order: 'asc' | 'desc'
  }): Promise<{ engagement: OwnerEngagementRecord | null; items: OwnerMovementRecord[]; total: number }> {
    const engagement = await this.prisma.propertyEngagement.findFirst({
      where: {
        id: input.engagementId,
        propertyAsset: activeOwnerAccess(input.userId),
      },
      include: ownerEngagementInclude,
    })

    if (!engagement) {
      return { engagement: null, items: [], total: 0 }
    }

    const where = { propertyEngagementId: input.engagementId } satisfies Prisma.MovementWhereInput
    const [items, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: ownerMovementInclude,
        orderBy: { createdAt: input.order },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.movement.count({ where }),
    ])

    return { engagement, items, total }
  }
}
