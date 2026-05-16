import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  AnalyticsEventRecord,
  AnalyticsRepository,
  CountTenantAnalyticsEventsInput,
  CreateAnalyticsEventInput,
  ListTenantAnalyticsEventsInput,
} from './analytics.repository'

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord> {
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        eventName: input.eventName,
        propertyEngagementId: input.propertyEngagementId ?? null,
        propertyAssetId: input.propertyAssetId ?? null,
        documentRequestId: input.documentRequestId ?? null,
        movementId: input.movementId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        occurredAt: input.occurredAt ?? new Date(),
      },
    })
  }

  listTenantEvents(input: ListTenantAnalyticsEventsInput): Promise<AnalyticsEventRecord[]> {
    return this.prisma.analyticsEvent.findMany({
      where: this.buildTenantEventWhere(input),
      orderBy: { occurredAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    })
  }

  countTenantEvents(input: CountTenantAnalyticsEventsInput): Promise<number> {
    return this.prisma.analyticsEvent.count({
      where: {
        ...this.buildTenantEventWhere(input),
        occurredAt: { gte: input.from, lt: input.to },
      },
    })
  }

  private buildTenantEventWhere(
    input: Pick<ListTenantAnalyticsEventsInput | CountTenantAnalyticsEventsInput, 'tenantId' | 'eventName'>,
  ): Prisma.AnalyticsEventWhereInput {
    return {
      tenantId: input.tenantId,
      ...(input.eventName ? { eventName: input.eventName } : {}),
    }
  }
}
