import { Inject, Injectable } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, type Prisma, type TenantStatus } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { PlatformOutboxWriter } from '../platform-data/platform-outbox-writer'
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly outboxWriter: PlatformOutboxWriter,
  ) {}

  async updateTenantStatus(
    input: UpdateAdminTenantStatusInput,
    tx?: Prisma.TransactionClient,
  ): Promise<UpdateAdminTenantStatusResult> {
    const run = async (client: Prisma.TransactionClient): Promise<UpdateAdminTenantStatusResult> => {
      const [tenant] = await client.$queryRaw<LockedTenantStatusRow[]>`
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

      const updatedTenant = await client.tenant.update({
        where: { id: tenant.id },
        data: { status: input.targetStatus },
      })

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

      await client.analyticsEvent.create({
        data: {
          tenantId: tenant.id,
          ...actorData,
          eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
          metadata: {
            previousStatus: tenant.status,
            newStatus: input.targetStatus,
          },
          occurredAt: input.now,
        },
      })

      // D3: emit outbox event inside the SAME transaction as the domain mutation.
      // D4: only on the `updated` branch — no-op/unchanged transitions emit nothing.
      await this.outboxWriter.emit(client, {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: tenant.id,
        payload: {
          previousStatus: tenant.status,
          newStatus: input.targetStatus,
        },
        occurredAt: input.now,
      })

      return {
        status: 'updated',
        tenantId: updatedTenant.id,
        previousStatus: tenant.status,
        currentStatus: updatedTenant.status,
        updatedAt: updatedTenant.updatedAt,
      }
    }

    // If an outer transaction is provided, run inside it (no nested $transaction).
    // Otherwise start an own transaction — preserves the existing /admin behaviour.
    return tx ? run(tx) : this.prisma.$transaction(run)
  }
}
