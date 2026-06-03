import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, MovementType } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import type { CurrentUser } from '../../auth/types/current-user'
import { NotificationProducerService } from '../../notifications/notification-producer.service'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../../property-engagements/property-engagements.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateMovementDto } from '../dto/create-movement.dto'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../movements.repository'
import { mapMovement, type MovementResponse } from '../responses/movement.response'

const lifecycleMovementTypes = new Set<MovementType>([MovementType.ARCHIVED, MovementType.RESTORED])

@Injectable()
export class CreateMovementUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    @Inject(NotificationProducerService)
    private readonly notificationProducer: NotificationProducerService,
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

    if (lifecycleMovementTypes.has(input.type)) {
      throw new BadRequestException('Lifecycle movements must be created through property lifecycle actions')
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

    await this.trackAnalytics({
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
      actorType: AnalyticsActorType.INTERNAL_USER,
      tenantId: tenant.tenantId,
      actorUserId: currentUser.id,
      propertyEngagementId: engagementId,
      movementId: movement.id,
    })

    if (movement.newStatus) {
      await this.trackAnalytics({
        eventName: AnalyticsEventName.PROPERTY_STATUS_CHANGED,
        actorType: AnalyticsActorType.INTERNAL_USER,
        tenantId: tenant.tenantId,
        actorUserId: currentUser.id,
        propertyEngagementId: engagementId,
        movementId: movement.id,
        metadata: {
          previousStatus: movement.previousStatus,
          newStatus: movement.newStatus,
        },
      })
      await this.notifyOwnersOfStatusChange({
        tenantId: tenant.tenantId,
        propertyEngagementId: engagementId,
        propertyAssetId: engagement.propertyAssetId,
        movementId: movement.id,
        previousStatus: movement.previousStatus,
        newStatus: movement.newStatus,
      })
    }

    return mapMovement(movement)
  }

  private async notifyOwnersOfStatusChange(input: {
    tenantId: string
    propertyEngagementId: string
    propertyAssetId: string
    movementId: string
    previousStatus?: Parameters<NotificationProducerService['notifyPropertyStatusChanged']>[0]['previousStatus']
    newStatus: Parameters<NotificationProducerService['notifyPropertyStatusChanged']>[0]['newStatus']
  }): Promise<void> {
    try {
      const ownerUserIds = await this.movementsRepository.listActiveOwnerUserIdsForEngagement({
        tenantId: input.tenantId,
        propertyEngagementId: input.propertyEngagementId,
      })

      await this.notificationProducer.notifyPropertyStatusChanged({
        ...input,
        ownerUserIds,
      })
    } catch {
      // Notifications must not break movement creation.
    }
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break movement creation.
    }
  }
}
