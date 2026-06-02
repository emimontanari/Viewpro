import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import { NotificationProducerService, type DocumentOwnerNotificationInput } from '../../notifications/notification-producer.service'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import type { CreateDocumentRequestDto } from '../dto/create-document-request.dto'
import { DOCUMENTS_REPOSITORY, type DocumentRequestRecord, type DocumentsRepository } from '../documents.repository'

@Injectable()
export class CreateDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    @Optional()
    @Inject(NotificationProducerService)
    private readonly notificationProducer?: NotificationProducerService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    propertyEngagementId: string,
    input: CreateDocumentRequestDto,
  ): Promise<DocumentRequestResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REQUEST)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    if (!input.propertyAssetOwnerId && !input.ownerUserId) {
      throw new BadRequestException('Property owner link is required')
    }

    const engagement = await this.documentsRepository.findTenantEngagementForDocumentRequest({
      tenantId: tenant.tenantId,
      propertyEngagementId,
      ...(input.propertyAssetOwnerId ? { propertyAssetOwnerId: input.propertyAssetOwnerId } : {}),
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const request = await this.documentsRepository.createRequest({
      tenantId: tenant.tenantId,
      propertyEngagementId,
      propertyAssetOwnerId: engagement.propertyAssetOwnerId,
      ownerUserId: engagement.ownerUserId,
      requestedByUserId: currentUser.id,
      title: input.title,
      description: input.description,
    })

    await this.trackAnalytics({
      eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
      actorType: AnalyticsActorType.INTERNAL_USER,
      tenantId: tenant.tenantId,
      actorUserId: currentUser.id,
      propertyEngagementId,
      documentRequestId: request.id,
    })
    await this.notifyDocumentRequested(request)

    return mapDocumentRequestResponse(request)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break document request creation.
    }
  }

  private async notifyDocumentRequested(request: DocumentRequestRecord): Promise<void> {
    if (!this.notificationProducer) {
      return
    }

    try {
      await this.notificationProducer.notifyDocumentRequested(toDocumentNotificationInput(request))
    } catch {
      // Notifications must not break document request creation.
    }
  }
}

function toDocumentNotificationInput(request: DocumentRequestRecord): DocumentOwnerNotificationInput {
  return {
    tenantId: request.tenantId,
    ownerUserId: request.ownerUserId,
    propertyEngagementId: request.propertyEngagementId,
    propertyAssetId: request.propertyEngagement.propertyAssetId,
    documentRequestId: request.id,
    documentTitle: request.title,
  }
}
