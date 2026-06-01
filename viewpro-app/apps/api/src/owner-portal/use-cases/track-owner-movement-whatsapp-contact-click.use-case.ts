import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService } from '../../analytics/analytics.service'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'

const MOVEMENT_WHATSAPP_CONTACT_METADATA = {
  context: 'movement',
  targetType: 'movement_author',
} as const

@Injectable()
export class TrackOwnerMovementWhatsappContactClickUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(input: { userId: string; engagementId: string; movementId: string }): Promise<void> {
    const movement = await this.ownerPortalRepository.findMovementContactContextForOwner(input)

    if (!movement) {
      throw new NotFoundException('Owner movement not found')
    }

    try {
      await this.analyticsService.track({
        eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
        actorType: AnalyticsActorType.OWNER,
        actorUserId: input.userId,
        tenantId: movement.tenantId,
        propertyEngagementId: movement.propertyEngagementId,
        propertyAssetId: movement.propertyAssetId,
        movementId: movement.id,
        metadata: MOVEMENT_WHATSAPP_CONTACT_METADATA,
      })
    } catch {
      // Analytics must not break owner contact navigation.
    }
  }
}
