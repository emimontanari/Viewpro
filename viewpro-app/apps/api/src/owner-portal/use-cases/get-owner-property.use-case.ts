import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'
import { mapOwnerProperty, type OwnerPropertyResponse } from '../responses/owner-property.response'

@Injectable()
export class GetOwnerPropertyUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(input: { userId: string; propertyAssetId: string }): Promise<OwnerPropertyResponse> {
    const property = await this.ownerPortalRepository.findPropertyByOwner(input)

    if (!property) {
      throw new NotFoundException('Owner property not found')
    }

    await this.trackAnalytics({
      eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
      actorType: AnalyticsActorType.OWNER,
      actorUserId: input.userId,
      propertyAssetId: input.propertyAssetId,
    })

    return mapOwnerProperty(property)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break owner property detail reads.
    }
  }
}
