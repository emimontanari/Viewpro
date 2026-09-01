import { Inject, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { activeOwnerAccess } from '../owner-access/active-owner-access'
import type {
  OwnerEngagementRecord,
  OwnerMovementContactContext,
  OwnerMovementRecord,
  OwnerPortalRepository,
  OwnerPrimarySellerContactCandidate,
  OwnerPropertyRecord,
} from './owner-portal.repository'

const ownerPropertyInclude = {
  images: true,
} satisfies Prisma.PropertyAssetInclude

const ownerEngagementInclude = {
  tenant: { select: { id: true, name: true, whatsappPhone: true } },
  agents: {
    select: {
      agentUserId: true,
      agentUser: { select: { firstName: true, email: true } },
    },
  },
} satisfies Prisma.PropertyEngagementInclude

const ownerMovementInclude = {
  createdBy: { select: { id: true, email: true, firstName: true } },
} satisfies Prisma.MovementInclude

@Injectable()
export class PrismaOwnerPortalRepository implements OwnerPortalRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findPropertiesByOwnerUserId(userId: string): Promise<OwnerPropertyRecord[]> {
    return this.prisma.propertyAsset.findMany({
      where: activeOwnerAccess(userId),
      include: ownerPropertyInclude,
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
      include: ownerPropertyInclude,
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
  }): Promise<{
    engagement: OwnerEngagementRecord | null
    items: OwnerMovementRecord[]
    total: number
    primarySellerContact: OwnerPrimarySellerContactCandidate | null
  }> {
    const engagement = await this.prisma.propertyEngagement.findFirst({
      where: {
        id: input.engagementId,
        propertyAsset: activeOwnerAccess(input.userId),
      },
      include: ownerEngagementInclude,
    })

    if (!engagement) {
      return { engagement: null, items: [], total: 0, primarySellerContact: null }
    }

    const where = { propertyEngagementId: input.engagementId } satisfies Prisma.MovementWhereInput
    const [items, total, primarySellerContact] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: ownerMovementInclude,
        orderBy: { createdAt: input.order },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.movement.count({ where }),
      this.prisma.propertyAgent.findFirst({
        where: {
          tenantId: engagement.tenantId,
          propertyEngagementId: engagement.id,
          isPrimary: true,
          agentUser: {
            status: 'ACTIVE',
            memberships: {
              some: {
                tenantId: engagement.tenantId,
                status: 'ACTIVE',
                role: 'AGENT',
              },
            },
          },
        },
        select: {
          id: true,
          agentUserId: true,
          agentUser: { select: { whatsappPhone: true } },
        },
      }),
    ])

    return { engagement, items, total, primarySellerContact }
  }

  findEngagementContactContextForOwner(input: { userId: string; engagementId: string }) {
    return this.prisma.propertyEngagement.findFirst({
      where: {
        id: input.engagementId,
        propertyAsset: activeOwnerAccess(input.userId),
      },
      select: {
        id: true,
        tenantId: true,
        propertyAssetId: true,
      },
    })
  }

  async findMovementContactContextForOwner(input: {
    userId: string
    engagementId: string
    movementId: string
  }): Promise<OwnerMovementContactContext | null> {
    const movement = await this.prisma.movement.findFirst({
      where: {
        id: input.movementId,
        propertyEngagementId: input.engagementId,
        propertyEngagement: {
          propertyAsset: activeOwnerAccess(input.userId),
        },
      },
      select: {
        id: true,
        tenantId: true,
        propertyEngagementId: true,
        propertyEngagement: { select: { propertyAssetId: true } },
      },
    })

    if (!movement) {
      return null
    }

    return {
      id: movement.id,
      tenantId: movement.tenantId,
      propertyEngagementId: movement.propertyEngagementId,
      propertyAssetId: movement.propertyEngagement.propertyAssetId,
    }
  }
}
