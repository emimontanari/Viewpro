import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_IMAGES_STORAGE_PORT,
  type PropertyImagesStoragePort,
} from '../property-images.storage'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'

export type DeletePropertyImageResponse = {
  deleted: true
  id: string
}

@Injectable()
export class DeletePropertyImageUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(PROPERTY_IMAGES_STORAGE_PORT)
    private readonly propertyImagesStorage: PropertyImagesStoragePort,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    imageId: string,
  ): Promise<DeletePropertyImageResponse> {
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

    const deletedImage = await this.propertyEngagementsRepository.deleteImageForAsset({
      propertyAssetId: engagement.propertyAsset.id,
      imageId,
    })

    if (!deletedImage) {
      throw new NotFoundException('Property image not found')
    }

    await this.propertyImagesStorage.delete(deletedImage.deletedStorageKey)

    return { deleted: true, id: imageId }
  }
}
