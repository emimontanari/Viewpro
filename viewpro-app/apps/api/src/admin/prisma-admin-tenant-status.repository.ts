import { Inject, Injectable } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, type TenantStatus } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  AdminTenantStatusRepository,
  UpdateAdminTenantStatusInput,
  UpdateAdminTenantStatusResult,
} from './admin-tenant-status.repository'

type LockedTenantStatusRow = {
  id: string
  status: TenantStatus
  updatedAt: Date
}

@Injectable()
export class PrismaAdminTenantStatusRepository implements AdminTenantStatusRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async updateTenantStatus(input: UpdateAdminTenantStatusInput): Promise<UpdateAdminTenantStatusResult> {
    return this.prisma.$transaction(async (tx) => {
      const [tenant] = await tx.$queryRaw<LockedTenantStatusRow[]>`
        SELECT "id", "status", "updatedAt"
        FROM "tenants"
        WHERE "id" = ${input.tenantId}
        FOR UPDATE
      `

      if (!tenant) {
        return { status: 'notFound' }
      }

      if (tenant.status === input.targetStatus) {
        return {
          status: 'unchanged',
          tenantId: tenant.id,
          previousStatus: tenant.status,
          currentStatus: tenant.status,
          updatedAt: tenant.updatedAt,
        }
      }

      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: input.targetStatus },
      })

      await tx.analyticsEvent.create({
        data: {
          tenantId: tenant.id,
          actorUserId: input.actorUserId,
          actorType: AnalyticsActorType.INTERNAL_USER,
          eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
          metadata: {
            previousStatus: tenant.status,
            newStatus: input.targetStatus,
          },
          occurredAt: input.now,
        },
      })

      return {
        status: 'updated',
        tenantId: updatedTenant.id,
        previousStatus: tenant.status,
        currentStatus: updatedTenant.status,
        updatedAt: updatedTenant.updatedAt,
      }
    })
  }
}
