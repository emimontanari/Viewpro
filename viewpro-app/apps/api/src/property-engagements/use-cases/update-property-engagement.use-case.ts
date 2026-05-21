import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { UpdatePropertyEngagementDto } from '../dto/update-property-engagement.dto'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import {
  mapPropertyEngagement,
  type PropertyEngagementResponse,
} from '../responses/property-engagement.response'

@Injectable()
export class UpdatePropertyEngagementUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    input: UpdatePropertyEngagementDto,
  ): Promise<PropertyEngagementResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.propertyEngagementsRepository.updateForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL),
      propertyAsset: {
        ...(input.title != null ? { title: input.title } : {}),
        ...(input.addressLine != null ? { addressLine: input.addressLine } : {}),
        ...(input.city != null ? { city: input.city } : {}),
        ...(input.province != null ? { province: input.province } : {}),
        ...(input.propertyType != null ? { propertyType: input.propertyType } : {}),
        ...(input.totalAreaSqm !== undefined ? { totalAreaSqm: input.totalAreaSqm } : {}),
        ...(input.coveredAreaSqm !== undefined ? { coveredAreaSqm: input.coveredAreaSqm } : {}),
        ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
        ...(input.bedrooms !== undefined ? { bedrooms: input.bedrooms } : {}),
        ...(input.bathrooms !== undefined ? { bathrooms: input.bathrooms } : {}),
        ...(input.garages !== undefined ? { garages: input.garages } : {}),
        ...(input.ageYears !== undefined ? { ageYears: input.ageYears } : {}),
        ...(input.orientation !== undefined ? { orientation: input.orientation } : {}),
        ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
        ...(input.ownerEmail !== undefined ? { ownerEmail: input.ownerEmail } : {}),
      },
      engagement: {
        ...(input.operationType != null ? { operationType: input.operationType } : {}),
        ...(input.publishedPriceCents !== undefined
          ? { publishedPriceCents: input.publishedPriceCents }
          : {}),
        ...(input.currency != null ? { currency: input.currency } : {}),
      },
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    return mapPropertyEngagement(engagement)
  }
}
