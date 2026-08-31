import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { normalizeEmail } from '../../auth/utils/slugify'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { USERS_REPOSITORY, type UsersRepository } from '../../users/users.repository'
import type { LinkPropertyOwnerDto } from '../dto/link-property-owner.dto'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import { mapPropertyOwner, type PropertyOwnerResponse } from '../responses/property-owner.response'

@Injectable()
export class LinkPropertyOwnerUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    input: LinkPropertyOwnerDto,
  ): Promise<PropertyOwnerResponse> {
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

    const ownerEmail = normalizeEmail(input.email)
    const ownerFirstName = input.firstName.trim()
    const ownerLastName = input.lastName.trim()

    if (!ownerFirstName || !ownerLastName) {
      throw new BadRequestException('Owner first name and last name are required')
    }

    const ownerUser = await this.usersRepository.findByEmail(ownerEmail)

    const result = await this.propertyEngagementsRepository.linkOwner({
      propertyAssetId: engagement.propertyAssetId,
      ownerUserId: ownerUser?.id ?? null,
      ownerEmail,
      ownerFirstName,
      ownerLastName,
      propertyEngagementId: engagement.id,
    })

    if (result.status === 'alreadyLinked') {
      throw new ConflictException('Owner is already linked to this property')
    }

    return mapPropertyOwner(result.owner)
  }
}
