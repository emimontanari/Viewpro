import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_IMAGES_STORAGE_PORT,
  type PropertyImagesStoragePort,
} from '../property-images.storage'
import { PROPERTY_ENGAGEMENTS_REPOSITORY, type PropertyEngagementsRepository } from '../property-engagements.repository'
import { mapPropertyImage, type PropertyImageResponse } from '../responses/property-engagement.response'

export type UploadedPropertyImageFile = {
  originalname: string
  mimetype: string
  size: number
  buffer?: Buffer
}

const ALLOWED_PROPERTY_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const PROPERTY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PROPERTY_IMAGE_MAX_COUNT = 5

@Injectable()
export class UploadPropertyImageUseCase {
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
    file: UploadedPropertyImageFile | undefined,
  ): Promise<PropertyImageResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    this.validateFile(file)

    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL),
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const existingImageCount = await this.propertyEngagementsRepository.countImagesForAsset(engagement.propertyAsset.id)

    if (existingImageCount >= PROPERTY_IMAGE_MAX_COUNT) {
      throw new BadRequestException('A property can have up to 5 images')
    }

    const imageId = randomUUID()
    const savedImage = await this.propertyImagesStorage.save({
      tenantId: tenant.tenantId,
      propertyAssetId: engagement.propertyAsset.id,
      imageId,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    })

    const image = await this.propertyEngagementsRepository.createImage({
      id: imageId,
      propertyAssetId: engagement.propertyAsset.id,
      uploadedByUserId: currentUser.id,
      storageKey: savedImage.storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      isPrimary: true,
    })

    return mapPropertyImage(image)
  }

  private validateFile(
    file: UploadedPropertyImageFile | undefined,
  ): asserts file is UploadedPropertyImageFile & { buffer: Buffer } {
    if (!file?.buffer) {
      throw new BadRequestException('Property image file is required')
    }

    if (!ALLOWED_PROPERTY_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Property image must be a JPEG, PNG, or WebP file')
    }

    if (file.size > PROPERTY_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Property image must be 5 MB or smaller')
    }
  }
}
