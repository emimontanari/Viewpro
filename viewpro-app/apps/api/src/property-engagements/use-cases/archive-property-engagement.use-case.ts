import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ArchivePropertyEngagementDto } from '../dto/archive-property-engagement.dto'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import {
  mapPropertyEngagement,
  type PropertyEngagementResponse,
} from '../responses/property-engagement.response'

@Injectable()
export class ArchivePropertyEngagementUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    input: ArchivePropertyEngagementDto = {},
  ): Promise<PropertyEngagementResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const result = await this.propertyEngagementsRepository.archiveForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL),
      archivedByUserId: currentUser.id,
      archiveReason: input.reason,
    })

    if (!result) {
      throw new NotFoundException('Property engagement not found')
    }

    if (result.status === 'alreadyArchived') {
      throw new BadRequestException('Property engagement is already archived')
    }

    return mapPropertyEngagement(result.engagement)
  }
}
