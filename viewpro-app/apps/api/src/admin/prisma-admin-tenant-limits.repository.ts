import { Inject, Injectable } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  AdminTenantLimits,
  AdminTenantLimitsRepository,
  UpdateAdminTenantLimitsInput,
  UpdateAdminTenantLimitsResult,
} from './admin-tenant-limits.repository'

type LockedTenantLimitsRow = {
  id: string
  maxUsers: number | null
  maxActivePropertyEngagements: number | null
  maxDocumentsStorageMb: number | null
  updatedAt: Date
}

@Injectable()
export class PrismaAdminTenantLimitsRepository implements AdminTenantLimitsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async updateTenantLimits(input: UpdateAdminTenantLimitsInput): Promise<UpdateAdminTenantLimitsResult> {
    return this.prisma.$transaction(async (tx) => {
      const [tenant] = await tx.$queryRaw<LockedTenantLimitsRow[]>`
        SELECT "id", "maxUsers", "maxActivePropertyEngagements", "maxDocumentsStorageMb", "updatedAt"
        FROM "tenants"
        WHERE "id" = ${input.tenantId}
        FOR UPDATE
      `

      if (!tenant) {
        return { status: 'notFound' }
      }

      const previousLimits = mapTenantLimits(tenant)

      if (areLimitsEqual(previousLimits, input.limits)) {
        return {
          status: 'unchanged',
          tenantId: tenant.id,
          previousLimits,
          limits: previousLimits,
          updatedAt: tenant.updatedAt,
        }
      }

      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: input.limits,
      })
      const updatedLimits = mapTenantLimits(updatedTenant)

      // Stamp audit actor: operator or product user (discriminated union)
      const actorData =
        input.actor.type === 'operator'
          ? {
              actorType: AnalyticsActorType.PLATFORM_OPERATOR,
              actorOperatorId: input.actor.operatorId,
              actorUserId: null,
            }
          : {
              actorType: AnalyticsActorType.INTERNAL_USER,
              actorOperatorId: null,
              actorUserId: input.actor.userId,
            }

      await tx.analyticsEvent.create({
        data: {
          tenantId: tenant.id,
          ...actorData,
          eventName: AnalyticsEventName.TENANT_LIMITS_UPDATED,
          metadata: {
            previousLimits,
            newLimits: updatedLimits,
          },
          occurredAt: input.now,
        },
      })

      return {
        status: 'updated',
        tenantId: updatedTenant.id,
        previousLimits,
        limits: updatedLimits,
        updatedAt: updatedTenant.updatedAt,
      }
    })
  }
}

function mapTenantLimits(input: AdminTenantLimits): AdminTenantLimits {
  return {
    maxUsers: input.maxUsers,
    maxActivePropertyEngagements: input.maxActivePropertyEngagements,
    maxDocumentsStorageMb: input.maxDocumentsStorageMb,
  }
}

function areLimitsEqual(first: AdminTenantLimits, second: AdminTenantLimits) {
  return (
    first.maxUsers === second.maxUsers &&
    first.maxActivePropertyEngagements === second.maxActivePropertyEngagements &&
    first.maxDocumentsStorageMb === second.maxDocumentsStorageMb
  )
}
