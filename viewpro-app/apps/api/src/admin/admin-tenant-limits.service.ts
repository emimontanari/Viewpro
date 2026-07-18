import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { CommandActor } from './admin-actor'
import {
  ADMIN_TENANT_LIMITS_REPOSITORY,
  type AdminTenantLimits,
  type AdminTenantLimitsRepository,
} from './admin-tenant-limits.repository'
import {
  mapAdminTenantLimitsUpdateResponse,
  type AdminTenantLimitsUpdateResponse,
} from './responses/admin-tenant-limits.response'

@Injectable()
export class AdminTenantLimitsService {
  constructor(
    @Inject(ADMIN_TENANT_LIMITS_REPOSITORY)
    private readonly adminTenantLimitsRepository: AdminTenantLimitsRepository,
  ) {}

  /**
   * Updates tenant limits with validation.
   *
   * @param tx — optional outer Prisma transaction. When provided the repo runs
   *   inside it (no nested transaction). When omitted the repo starts its own
   *   transaction — preserving the existing /admin call-site behaviour exactly.
   */
  async updateTenantLimits(
    input: {
      tenantId: string
      limits: Partial<AdminTenantLimits>
      actor: CommandActor
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AdminTenantLimitsUpdateResponse> {
    const limits = parseTenantLimits(input.limits)

    const result = await this.adminTenantLimitsRepository.updateTenantLimits(
      {
        tenantId: input.tenantId,
        limits,
        actor: input.actor,
        now: new Date(),
      },
      tx,
    )

    if (result.status === 'notFound') {
      throw new NotFoundException('Tenant not found')
    }

    return mapAdminTenantLimitsUpdateResponse({
      tenantId: result.tenantId,
      previousLimits: result.previousLimits,
      limits: result.limits,
      unchanged: result.status === 'unchanged',
      updatedAt: result.updatedAt,
    })
  }
}

function parseTenantLimits(input: Partial<AdminTenantLimits>): AdminTenantLimits {
  return {
    maxUsers: parseLimitValue(input.maxUsers),
    maxActivePropertyEngagements: parseLimitValue(input.maxActivePropertyEngagements),
    maxDocumentsStorageMb: parseLimitValue(input.maxDocumentsStorageMb),
  }
}

function parseLimitValue(value: number | null | undefined): number | null {
  if (value === null) {
    return null
  }

  if (value === undefined || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException('Unsupported tenant limits')
  }

  return value
}
