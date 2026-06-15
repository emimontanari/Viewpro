import { Inject, Injectable } from '@nestjs/common'
import type { Prisma, StatusChangeRequest } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreatePendingInput,
  FindActivePendingByEngagementInput,
  FindByIdForTenantInput,
  ListByEngagementForTenantInput,
  ListPendingForTenantInput,
  ResolveInTransactionInput,
  StatusChangeRequestsRepository,
} from './status-change-requests.repository'

@Injectable()
export class PrismaStatusChangeRequestsRepository implements StatusChangeRequestsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingInput): Promise<StatusChangeRequest> {
    return this.prisma.statusChangeRequest.create({
      data: {
        tenantId: input.tenantId,
        propertyEngagementId: input.propertyEngagementId,
        requestedByUserId: input.requestedByUserId,
        targetStatus: input.targetStatus as never,
        currentStatusSnapshot: input.currentStatusSnapshot as never,
        requestNote: input.requestNote ?? null,
        status: 'PENDING',
      },
    })
  }

  async findByIdForTenant(input: FindByIdForTenantInput): Promise<StatusChangeRequest | null> {
    return this.prisma.statusChangeRequest.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
    })
  }

  async findActivePendingByEngagement(
    input: FindActivePendingByEngagementInput,
  ): Promise<StatusChangeRequest | null> {
    return this.prisma.statusChangeRequest.findFirst({
      where: {
        propertyEngagementId: input.engagementId,
        tenantId: input.tenantId,
        status: 'PENDING',
      },
    })
  }

  async listByEngagementForTenant(
    input: ListByEngagementForTenantInput,
  ): Promise<StatusChangeRequest[]> {
    return this.prisma.statusChangeRequest.findMany({
      where: {
        propertyEngagementId: input.engagementId,
        tenantId: input.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listPendingForTenant(input: ListPendingForTenantInput): Promise<StatusChangeRequest[]> {
    return this.prisma.statusChangeRequest.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: input.take,
    })
  }

  async resolveInTransaction(
    tx: Prisma.TransactionClient,
    input: ResolveInTransactionInput & { id: string },
  ): Promise<StatusChangeRequest> {
    return tx.statusChangeRequest.update({
      where: { id: input.id },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: input.resolvedByUserId,
        resolvedAt: new Date(),
        ...(input.resolutionComment != null ? { resolutionComment: input.resolutionComment } : {}),
      },
    })
  }
}
