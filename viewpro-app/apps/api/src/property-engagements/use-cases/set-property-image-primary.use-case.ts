import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import { mapPropertyImage, type PropertyImageResponse } from '../responses/property-engagement.response'

@Injectable()
export class SetPropertyImagePrimaryUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    imageId: string,
  ): Promise<PropertyImageResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL),
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const image = await this.propertyEngagementsRepository.setImageAsPrimary({
      propertyAssetId: engagement.propertyAsset.id,
      imageId,
    })

    if (!image) {
      throw new NotFoundException('Property image not found')
    }

    return mapPropertyImage(image)
  }
}
