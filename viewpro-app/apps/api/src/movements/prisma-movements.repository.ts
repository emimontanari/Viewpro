import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreateMovementInput,
  ListMovementsInput,
  MovementsRepository,
  MovementWithRelations,
} from './movements.repository'

const movementInclude = {
  createdBy: true,
} satisfies Prisma.MovementInclude

@Injectable()
export class PrismaMovementsRepository implements MovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateMovementInput): Promise<MovementWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const engagement = await tx.propertyEngagement.findFirst({
        where: { id: input.propertyEngagementId, tenantId: input.tenantId },
      })

      if (!engagement) {
        return null
      }

      const movement = await tx.movement.create({
        data: {
          tenantId: input.tenantId,
          propertyEngagementId: input.propertyEngagementId,
          createdByUserId: input.createdByUserId,
          type: input.type,
          observation: input.observation,
          nextStep: input.nextStep,
          previousStatus: input.newStatus ? engagement.status : null,
          newStatus: input.newStatus ?? null,
          interestCount: input.interestCount,
          visitCount: input.visitCount,
          offerAmountCents: input.offerAmountCents,
          interestLevel: input.interestLevel,
        },
        include: movementInclude,
      })

      if (input.newStatus) {
        await tx.propertyEngagement.update({
          where: { id: input.propertyEngagementId },
          data: { status: input.newStatus },
        })
      }

      return movement
    })
  }

  async findMany(
    input: ListMovementsInput,
  ): Promise<{ items: MovementWithRelations[]; total: number }> {
    const where = {
      tenantId: input.tenantId,
      propertyEngagementId: input.propertyEngagementId,
    } satisfies Prisma.MovementWhereInput

    const [items, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: input.order },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.movement.count({ where }),
    ])

    return { items, total }
  }
}
