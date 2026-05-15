import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../../property-engagements/property-engagements.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateMovementDto } from '../dto/create-movement.dto'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../movements.repository'
import { mapMovement, type MovementResponse } from '../responses/movement.response'

@Injectable()
export class CreateMovementUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    input: CreateMovementDto,
  ): Promise<MovementResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.MOVEMENTS_CREATE)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
    const canViewAssigned = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)

    if (!canViewAll && !canViewAssigned) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll,
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const movement = await this.movementsRepository.create({
      tenantId: tenant.tenantId,
      propertyEngagementId: engagementId,
      createdByUserId: currentUser.id,
      type: input.type,
      observation: input.observation,
      nextStep: input.nextStep,
      newStatus: input.newStatus,
      interestCount: input.interestCount,
      visitCount: input.visitCount,
      offerAmountCents: input.offerAmountCents,
      interestLevel: input.interestLevel,
    })

    if (!movement) {
      throw new NotFoundException('Property engagement not found')
    }

    return mapMovement(movement)
  }
}
