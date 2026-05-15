import { Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreatePropertyEngagementDto } from '../dto/create-property-engagement.dto'
import { PROPERTY_ENGAGEMENTS_REPOSITORY, type PropertyEngagementsRepository } from '../property-engagements.repository'
import { mapPropertyEngagement, type PropertyEngagementResponse } from '../responses/property-engagement.response'

@Injectable()
export class CreatePropertyEngagementUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    input: CreatePropertyEngagementDto,
  ): Promise<PropertyEngagementResponse> {
    const engagement = await this.propertyEngagementsRepository.createWithAsset({
      tenantId: tenant.tenantId,
      createdByUserId: currentUser.id,
      propertyAsset: {
        title: input.title,
        addressLine: input.addressLine,
        city: input.city,
        province: input.province,
        propertyType: input.propertyType,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        createdBy: { connect: { id: currentUser.id } },
      },
      engagement: {
        operationType: input.operationType,
        ...(input.publishedPriceCents !== undefined ? { publishedPriceCents: input.publishedPriceCents } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
      },
    })

    return mapPropertyEngagement(engagement)
  }
}
