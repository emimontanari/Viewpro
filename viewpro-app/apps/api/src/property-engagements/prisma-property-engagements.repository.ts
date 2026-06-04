import { Inject, Injectable } from '@nestjs/common'
import { MovementSource, MovementType, OwnerInvitationStatus, PropertyAssetOwnerAccessStatus } from '@prisma/client'
import type { Prisma, PropertyAssetImage } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { createOwnerInvitationToken } from './owner-invitation-token'
import type {
  ArchivePropertyEngagementInput,
  ArchivePropertyEngagementResult,
  AssignPropertyAgentResult,
  CreatePropertyEngagementInput,
  CreatePropertyAssetImageInput,
  CreateOwnerInvitationLinkResult,
  DeletePropertyAssetImageResult,
  LinkPropertyOwnerResult,
  ListPropertyEngagementsInput,
  PropertyEngagementsRepository,
  PropertyEngagementWithDetails,
  RevokeOwnerInvitationLinkResult,
  RestorePropertyEngagementInput,
  RestorePropertyEngagementResult,
  UpdatePropertyEngagementInput,
} from './property-engagements.repository'

const propertyOwnerSelect = {
  id: true,
  propertyAssetId: true,
  userId: true,
  ownerEmail: true,
  ownerFirstName: true,
  ownerLastName: true,
  isPrimary: true,
  accessStatus: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.PropertyAssetOwnerSelect

const propertyEngagementInclude = {
  propertyAsset: {
    include: {
      images: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      },
      owners: {
        select: propertyOwnerSelect,
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  },
  agents: { include: { agentUser: true } },
  createdBy: true,
} satisfies Prisma.PropertyEngagementInclude

@Injectable()
export class PrismaPropertyEngagementsRepository implements PropertyEngagementsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  archiveForTenant(input: ArchivePropertyEngagementInput): Promise<ArchivePropertyEngagementResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.propertyEngagement.findFirst({
        where: this.buildTenantVisibilityWhere(input),
        select: { id: true, archivedAt: true },
      })

      if (!existing) {
        return null
      }

      if (existing.archivedAt) {
        return { status: 'alreadyArchived' }
      }

      const archivedResult = await tx.propertyEngagement.updateMany({
        where: { id: existing.id, archivedAt: null },
        data: {
          archivedAt: new Date(),
          archivedByUserId: input.archivedByUserId,
          archiveReason: input.archiveReason ?? null,
        },
      })

      if (archivedResult.count === 0) {
        return { status: 'alreadyArchived' }
      }

      await tx.movement.create({
        data: {
          tenantId: input.tenantId,
          propertyEngagementId: existing.id,
          createdByUserId: input.archivedByUserId,
          type: MovementType.ARCHIVED,
          observation: input.archiveReason ?? 'Property archived',
          source: MovementSource.MANUAL,
        },
      })

      const archived = await tx.propertyEngagement.findUniqueOrThrow({
        where: { id: existing.id },
        include: propertyEngagementInclude,
      })

      return { status: 'archived', engagement: archived }
    })
  }

  restoreForTenant(input: RestorePropertyEngagementInput): Promise<RestorePropertyEngagementResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.propertyEngagement.findFirst({
        where: this.buildTenantVisibilityWhere(input),
        select: { id: true, archivedAt: true },
      })

      if (!existing) {
        return null
      }

      if (!existing.archivedAt) {
        return { status: 'notArchived' }
      }

      const restoredResult = await tx.propertyEngagement.updateMany({
        where: { id: existing.id, archivedAt: { not: null } },
        data: {
          archivedAt: null,
          archivedByUserId: null,
          archiveReason: null,
        },
      })

      if (restoredResult.count === 0) {
        return { status: 'notArchived' }
      }

      await tx.movement.create({
        data: {
          tenantId: input.tenantId,
          propertyEngagementId: existing.id,
          createdByUserId: input.userId,
          type: MovementType.RESTORED,
          observation: 'Property restored',
          source: MovementSource.MANUAL,
        },
      })

      const restored = await tx.propertyEngagement.findUniqueOrThrow({
        where: { id: existing.id },
        include: propertyEngagementInclude,
      })

      return { status: 'restored', engagement: restored }
    })
  }

  countImagesForAsset(propertyAssetId: string): Promise<number> {
    return this.prisma.propertyAssetImage.count({ where: { propertyAssetId } })
  }

  createImage(input: CreatePropertyAssetImageInput): Promise<PropertyAssetImage> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.propertyAssetImage.updateMany({
          where: { propertyAssetId: input.propertyAssetId },
          data: { isPrimary: false },
        })
      }

      return tx.propertyAssetImage.create({ data: input })
    })
  }

  deleteImageForAsset(input: {
    propertyAssetId: string
    imageId: string
  }): Promise<DeletePropertyAssetImageResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const image = await tx.propertyAssetImage.findFirst({
        where: {
          id: input.imageId,
          propertyAssetId: input.propertyAssetId,
        },
      })

      if (!image) {
        return null
      }

      const deleted = await tx.propertyAssetImage.deleteMany({
        where: {
          id: image.id,
          propertyAssetId: input.propertyAssetId,
        },
      })

      if (deleted.count === 0) {
        return null
      }

      let promotedImageId: string | null = null
      if (image.isPrimary) {
        const promotedImage = await tx.propertyAssetImage.findFirst({
          where: { propertyAssetId: input.propertyAssetId },
          orderBy: { createdAt: 'desc' },
        })

        if (promotedImage) {
          await tx.propertyAssetImage.update({
            where: { id: promotedImage.id },
            data: { isPrimary: true },
          })
          promotedImageId = promotedImage.id
        }
      }

      return { deletedStorageKey: image.storageKey, promotedImageId }
    })
  }

  setImageAsPrimary(input: {
    propertyAssetId: string
    imageId: string
  }): Promise<PropertyAssetImage | null> {
    return this.prisma.$transaction(async (tx) => {
      const image = await tx.propertyAssetImage.findFirst({
        where: {
          id: input.imageId,
          propertyAssetId: input.propertyAssetId,
        },
      })

      if (!image) {
        return null
      }

      await tx.propertyAssetImage.updateMany({
        where: { propertyAssetId: input.propertyAssetId },
        data: { isPrimary: false },
      })

      return tx.propertyAssetImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      })
    })
  }

  assignAgent(input: {
    tenantId: string
    engagementId: string
    agentUserId: string
    assignedByUserId: string
  }): Promise<AssignPropertyAgentResult> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.propertyAgent.createMany({
        data: {
          tenantId: input.tenantId,
          propertyEngagementId: input.engagementId,
          agentUserId: input.agentUserId,
          assignedByUserId: input.assignedByUserId,
        },
        skipDuplicates: true,
      })

      if (created.count === 0) {
        return { status: 'alreadyAssigned' }
      }

      const assignment = await tx.propertyAgent.findFirstOrThrow({
        where: {
          tenantId: input.tenantId,
          propertyEngagementId: input.engagementId,
          agentUserId: input.agentUserId,
        },
      })

      return { status: 'assigned', assignment }
    })
  }

  async removeAgent(input: {
    tenantId: string
    engagementId: string
    agentId: string
  }): Promise<boolean> {
    const removed = await this.prisma.propertyAgent.deleteMany({
      where: {
        id: input.agentId,
        tenantId: input.tenantId,
        propertyEngagementId: input.engagementId,
      },
    })

    return removed.count > 0
  }

  linkOwner(input: {
    propertyAssetId: string
    ownerUserId: string | null
    ownerEmail: string
    ownerFirstName: string
    ownerLastName: string
  }): Promise<LinkPropertyOwnerResult> {
    return this.prisma.$transaction(async (tx) => {
      const activePrimaryOwners = await tx.propertyAssetOwner.count({
        where: {
          propertyAssetId: input.propertyAssetId,
          isPrimary: true,
          accessStatus: {
            in: [PropertyAssetOwnerAccessStatus.INVITED, PropertyAssetOwnerAccessStatus.ACTIVE],
          },
        },
      })

      const created = await tx.propertyAssetOwner.createMany({
        data: {
          propertyAssetId: input.propertyAssetId,
          userId: input.ownerUserId,
          ownerEmail: input.ownerEmail,
          ownerFirstName: input.ownerFirstName,
          ownerLastName: input.ownerLastName,
          accessStatus: input.ownerUserId
            ? PropertyAssetOwnerAccessStatus.ACTIVE
            : PropertyAssetOwnerAccessStatus.INVITED,
          isPrimary: activePrimaryOwners === 0,
        },
        skipDuplicates: true,
      })

      if (created.count === 0) {
        return { status: 'alreadyLinked' }
      }

      const owner = await tx.propertyAssetOwner.findFirstOrThrow({
        where: {
          propertyAssetId: input.propertyAssetId,
          ownerEmail: input.ownerEmail,
        },
        select: propertyOwnerSelect,
      })

      if (!input.ownerUserId) {
        const { tokenHash, expiresAt } = createOwnerInvitationToken()
        await tx.ownerInvitation.create({
          data: {
            propertyAssetOwnerId: owner.id,
            email: input.ownerEmail,
            tokenHash,
            expiresAt,
          },
        })
      }

      return { status: 'linked', owner }
    })
  }

  createOwnerInvitationLink(input: {
    propertyAssetId: string
    ownerId: string
  }): Promise<CreateOwnerInvitationLinkResult> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.propertyAssetOwner.findFirst({
        where: {
          id: input.ownerId,
          propertyAssetId: input.propertyAssetId,
        },
        select: {
          id: true,
          ownerEmail: true,
          accessStatus: true,
        },
      })

      if (!owner) {
        return { status: 'ownerNotFound' }
      }

      if (owner.accessStatus !== PropertyAssetOwnerAccessStatus.INVITED) {
        return {
          status: 'ownerNotInvited',
          accessStatus: owner.accessStatus,
        }
      }

      const now = new Date()
      const { token, tokenHash, expiresAt } = createOwnerInvitationToken(now)

      await tx.ownerInvitation.updateMany({
        where: {
          propertyAssetOwnerId: owner.id,
          status: OwnerInvitationStatus.PENDING,
        },
        data: {
          status: OwnerInvitationStatus.REVOKED,
          revokedAt: now,
        },
      })

      const invitation = await tx.ownerInvitation.create({
        data: {
          propertyAssetOwnerId: owner.id,
          email: owner.ownerEmail,
          tokenHash,
          expiresAt,
        },
        select: {
          id: true,
          propertyAssetOwnerId: true,
          email: true,
          expiresAt: true,
        },
      })

      return {
        status: 'created',
        invitation: {
          ...invitation,
          token,
        },
      }
    })
  }

  revokeOwnerInvitationLink(input: {
    propertyAssetId: string
    ownerId: string
    now: Date
  }): Promise<RevokeOwnerInvitationLinkResult> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.propertyAssetOwner.findFirst({
        where: {
          id: input.ownerId,
          propertyAssetId: input.propertyAssetId,
        },
        select: {
          id: true,
          accessStatus: true,
        },
      })

      if (!owner) {
        return { status: 'ownerNotFound' }
      }

      if (owner.accessStatus !== PropertyAssetOwnerAccessStatus.INVITED) {
        return {
          status: 'ownerNotInvited',
          accessStatus: owner.accessStatus,
        }
      }

      const pendingInvitations = await tx.ownerInvitation.findMany({
        where: {
          propertyAssetOwnerId: owner.id,
          status: OwnerInvitationStatus.PENDING,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        select: { id: true },
      })

      if (pendingInvitations.length === 0) {
        return { status: 'noPendingInvitation' }
      }

      const revokedInvitationIds = pendingInvitations.map((invitation) => invitation.id)
      await tx.ownerInvitation.updateMany({
        where: {
          id: { in: revokedInvitationIds },
          status: OwnerInvitationStatus.PENDING,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        data: {
          status: OwnerInvitationStatus.REVOKED,
          revokedAt: input.now,
        },
      })

      return {
        status: 'revoked',
        propertyAssetOwnerId: owner.id,
        revokedInvitationIds,
      }
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

    if ('page' in input) {
      const archiveFilter = input.archived ?? 'active'

      if (archiveFilter === 'active') {
        where.archivedAt = null
      }

      if (archiveFilter === 'archived') {
        where.archivedAt = { not: null }
      }
    }

    if (!input.canViewAll) {
      where.agents = { some: { agentUserId: input.userId, tenantId: input.tenantId } }
    }

    return where
  }
}
