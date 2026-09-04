import { Injectable } from '@nestjs/common'
import { Prisma, PropertyEngagementStatus } from '@prisma/client'

const inactiveEngagementStatuses = [
  PropertyEngagementStatus.CLOSED,
  PropertyEngagementStatus.CANCELLED,
]

export class ActivePropertyCapacityExceededError extends Error {
  constructor() {
    super('Active property engagement capacity exceeded')
    this.name = 'ActivePropertyCapacityExceededError'
  }
}

@Injectable()
export class ActivePropertyEngagementCapacity {
  async acquire(tx: Prisma.TransactionClient, tenantId: string): Promise<{
    assertAvailable(): Promise<void>
  }> {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`

    return {
      assertAvailable: async () => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { maxActivePropertyEngagements: true },
        })
        if (!tenant || tenant.maxActivePropertyEngagements === null) return

        const activeEngagements = await tx.propertyEngagement.count({
          where: {
            tenantId,
            archivedAt: null,
            status: { notIn: inactiveEngagementStatuses },
          },
        })
        if (activeEngagements >= tenant.maxActivePropertyEngagements) {
          throw new ActivePropertyCapacityExceededError()
        }
      },
    }
  }
}
