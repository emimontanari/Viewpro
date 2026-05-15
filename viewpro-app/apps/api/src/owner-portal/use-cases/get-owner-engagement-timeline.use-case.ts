import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'
import { mapOwnerEngagement, type OwnerEngagementResponse } from '../responses/owner-engagement.response'
import { mapOwnerMovement, type OwnerMovementResponse } from '../responses/owner-movement.response'

export type OwnerEngagementTimelineResponse = {
  engagement: OwnerEngagementResponse
  items: OwnerMovementResponse[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class GetOwnerEngagementTimelineUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
  ) {}

  async execute(input: {
    userId: string
    engagementId: string
    page: number
    pageSize: number
    order: 'asc' | 'desc'
  }): Promise<OwnerEngagementTimelineResponse> {
    const result = await this.ownerPortalRepository.findEngagementTimelineForOwner(input)

    if (!result.engagement) {
      throw new NotFoundException('Owner engagement not found')
    }

    return {
      engagement: mapOwnerEngagement(result.engagement),
      items: result.items.map(mapOwnerMovement),
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
    }
  }
}
