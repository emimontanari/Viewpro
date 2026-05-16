import { Injectable } from '@nestjs/common'
import { AnalyticsEventName, Prisma, PropertyEngagementStatus } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  AnalyticsEventRecord,
  AnalyticsRepository,
  CountTenantAnalyticsEventsInput,
  CountTenantAnalyticsEventsForListInput,
  CountTenantReportEventsInput,
  CreateAnalyticsEventInput,
  InactiveEngagementRecord,
  ListTenantAnalyticsEventsInput,
  TenantWindowInput,
} from './analytics.repository'

const INACTIVE_STATUSES = [PropertyEngagementStatus.CLOSED, PropertyEngagementStatus.CANCELLED]

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
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
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

  countTenantEventsForList(input: CountTenantAnalyticsEventsForListInput): Promise<number> {
    return this.prisma.analyticsEvent.count({ where: this.buildTenantEventWhere(input) })
  }

  async countTenantReportEvents(input: CountTenantReportEventsInput): Promise<number> {
    const scopedReferenceFilters = await this.buildTenantReferenceFilters(input.tenantId, input.eventName)

    return this.prisma.analyticsEvent.count({
      where: {
        eventName: input.eventName,
        occurredAt: { gte: input.from, lt: input.to },
        OR: [{ tenantId: input.tenantId }, ...scopedReferenceFilters],
      },
    })
  }

  countActiveEngagements(input: { tenantId: string }): Promise<number> {
    return this.prisma.propertyEngagement.count({
      where: this.buildActiveEngagementWhere(input.tenantId),
    })
  }

  async countActiveEngagementsWithOwnerVisibleUpdate(input: TenantWindowInput): Promise<number> {
    const updatedEngagementIds = await this.listUpdatedEngagementIds(input)

    if (updatedEngagementIds.length === 0) {
      return 0
    }

    return this.prisma.propertyEngagement.count({
      where: {
        ...this.buildActiveEngagementWhere(input.tenantId),
        id: { in: updatedEngagementIds },
      },
    })
  }

  async listActiveEngagementsWithoutRecentUpdate(input: TenantWindowInput): Promise<InactiveEngagementRecord[]> {
    const updatedEngagementIds = await this.listUpdatedEngagementIds(input)

    return this.prisma.propertyEngagement.findMany({
      where: {
        ...this.buildActiveEngagementWhere(input.tenantId),
        ...(updatedEngagementIds.length > 0 ? { id: { notIn: updatedEngagementIds } } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        propertyAssetId: true,
        status: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
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

  private buildActiveEngagementWhere(tenantId: string): Prisma.PropertyEngagementWhereInput {
    return {
      tenantId,
      status: { notIn: INACTIVE_STATUSES },
    }
  }

  private async listUpdatedEngagementIds(input: TenantWindowInput): Promise<string[]> {
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        tenantId: input.tenantId,
        eventName: AnalyticsEventName.MOVEMENT_CREATED,
        occurredAt: { gte: input.from, lt: input.to },
        propertyEngagementId: { not: null },
      },
      distinct: ['propertyEngagementId'],
      select: { propertyEngagementId: true },
    })

    return rows.flatMap((row) => (row.propertyEngagementId ? [row.propertyEngagementId] : []))
  }

  private async buildTenantReferenceFilters(
    tenantId: string,
    eventName: AnalyticsEventName,
  ): Promise<Prisma.AnalyticsEventWhereInput[]> {
    if (
      eventName === AnalyticsEventName.DOCUMENT_REQUESTED ||
      eventName === AnalyticsEventName.DOCUMENT_UPLOADED ||
      eventName === AnalyticsEventName.DOCUMENT_APPROVED ||
      eventName === AnalyticsEventName.DOCUMENT_REJECTED
    ) {
      const documentRequests = await this.prisma.documentRequest.findMany({
        where: { tenantId },
        select: { id: true },
      })
      const documentRequestIds = documentRequests.map((request) => request.id)

      return documentRequestIds.length > 0 ? [{ documentRequestId: { in: documentRequestIds } }] : []
    }

    if (eventName === AnalyticsEventName.OWNER_VIEWED_PROPERTY) {
      const engagements = await this.prisma.propertyEngagement.findMany({
        where: { tenantId },
        distinct: ['propertyAssetId'],
        select: { propertyAssetId: true },
      })
      const propertyAssetIds = engagements.map((engagement) => engagement.propertyAssetId)

      return propertyAssetIds.length > 0 ? [{ propertyAssetId: { in: propertyAssetIds } }] : []
    }

    return []
  }
}
