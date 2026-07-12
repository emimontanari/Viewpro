import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'
import { mapOwnerEngagement, type OwnerEngagementResponse } from '../responses/owner-engagement.response'

@Injectable()
export class ListOwnerPropertyEngagementsUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
  ) {}

  async execute(input: { userId: string; propertyAssetId: string }): Promise<OwnerEngagementResponse[]> {
    const property = await this.ownerPortalRepository.findPropertyByOwner(input)

    if (!property) {
      throw new NotFoundException('Owner property not found')
    }

    const engagements = await this.ownerPortalRepository.findEngagementsForOwnerProperty(input)

    return engagements.map(mapOwnerEngagement)
  }
}
