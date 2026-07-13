import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { type Prisma, TenantStatus } from '@prisma/client'
import type { CommandActor } from './admin-actor'
import {
  ADMIN_TENANT_STATUS_REPOSITORY,
  type AdminTenantStatusRepository,
} from './admin-tenant-status.repository'
import {
  mapAdminTenantStatusUpdateResponse,
  type AdminTenantStatusUpdateResponse,
} from './responses/admin-tenant-status.response'

const ALLOWED_TARGET_STATUSES = new Set<TenantStatus>([TenantStatus.ACTIVE, TenantStatus.SUSPENDED])

@Injectable()
export class AdminTenantStatusService {
  constructor(
    @Inject(ADMIN_TENANT_STATUS_REPOSITORY)
    private readonly adminTenantStatusRepository: AdminTenantStatusRepository,
  ) {}

  /**
   * Updates tenant status with validation.
   *
   * @param tx — optional outer Prisma transaction. When provided the repo runs
   *   inside it (no nested transaction). When omitted the repo starts its own
   *   transaction — preserving the existing /admin call-site behaviour exactly.
   */
  async updateTenantStatus(
    input: {
      tenantId: string
      targetStatus: TenantStatus
      actor: CommandActor
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AdminTenantStatusUpdateResponse> {
    if (!ALLOWED_TARGET_STATUSES.has(input.targetStatus)) {
      throw new BadRequestException('Unsupported tenant status')
    }

    const result = await this.adminTenantStatusRepository.updateTenantStatus(
      {
        tenantId: input.tenantId,
        targetStatus: input.targetStatus,
        actor: input.actor,
        now: new Date(),
      },
      tx,
    )

    if (result.status === 'notFound') {
      throw new NotFoundException('Tenant not found')
    }

    return mapAdminTenantStatusUpdateResponse({
      tenantId: result.tenantId,
      previousStatus: result.previousStatus,
      status: result.currentStatus,
      unchanged: result.status === 'unchanged',
      updatedAt: result.updatedAt,
    })
  }
}
