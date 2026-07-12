import { Inject, Injectable } from '@nestjs/common'
import { OWNER_PORTAL_REPOSITORY, type OwnerPortalRepository } from '../owner-portal.repository'
import { mapOwnerProperty, type OwnerPropertyResponse } from '../responses/owner-property.response'

@Injectable()
export class ListOwnerPropertiesUseCase {
  constructor(
    @Inject(OWNER_PORTAL_REPOSITORY)
    private readonly ownerPortalRepository: OwnerPortalRepository,
  ) {}

  async execute(userId: string): Promise<OwnerPropertyResponse[]> {
    const properties = await this.ownerPortalRepository.findPropertiesByOwnerUserId(userId)

    return properties.map(mapOwnerProperty)
  }
}
