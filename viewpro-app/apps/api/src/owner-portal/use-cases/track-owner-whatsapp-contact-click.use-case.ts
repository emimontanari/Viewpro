import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService } from '../../analytics/analytics.service'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'

const PROPERTY_WHATSAPP_CONTACT_METADATA = {
  context: 'property',
  targetType: 'tenant',
} as const

@Injectable()
export class TrackOwnerWhatsappContactClickUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(input: { userId: string; engagementId: string }): Promise<void> {
    const engagement = await this.ownerPortalRepository.findEngagementContactContextForOwner(input)

    if (!engagement) {
      throw new NotFoundException('Owner engagement not found')
    }

    try {
      await this.analyticsService.track({
        eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
        actorType: AnalyticsActorType.OWNER,
        actorUserId: input.userId,
        tenantId: engagement.tenantId,
        propertyEngagementId: engagement.id,
        propertyAssetId: engagement.propertyAssetId,
        metadata: PROPERTY_WHATSAPP_CONTACT_METADATA,
      })
    } catch {
      // Analytics must not break owner contact navigation.
    }
  }
}
