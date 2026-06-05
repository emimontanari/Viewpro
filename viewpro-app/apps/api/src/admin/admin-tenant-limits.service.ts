import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
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

  async updateTenantLimits(input: {
    tenantId: string
    limits: Partial<AdminTenantLimits>
    actorUserId: string
  }): Promise<AdminTenantLimitsUpdateResponse> {
    const limits = parseTenantLimits(input.limits)

    const result = await this.adminTenantLimitsRepository.updateTenantLimits({
      tenantId: input.tenantId,
      limits,
      actorUserId: input.actorUserId,
      now: new Date(),
    })

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
