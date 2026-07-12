import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, DocumentRequestStatus, DocumentVersionStatus } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import { NotificationProducerService, type DocumentOwnerNotificationInput } from '../../notifications/notification-producer.service'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import type { RejectDocumentRequestDto } from '../dto/reject-document-request.dto'
import { DOCUMENTS_REPOSITORY, type DocumentRequestRecord, type DocumentsRepository } from '../documents.repository'
import { findReviewableDocumentRequest } from './review-document-request'

@Injectable()
export class RejectDocumentRequestUseCase {
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
    requestId: string,
    input: RejectDocumentRequestDto,
  ): Promise<DocumentRequestResponse> {
    const rejectionReason = input.reason.trim()

    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required')
    }

    await findReviewableDocumentRequest(this.documentsRepository, tenant, currentUser, requestId)

    const request = await this.documentsRepository.reviewRequest({
      tenantId: tenant.tenantId,
      requestId,
      reviewedByUserId: currentUser.id,
      status: DocumentRequestStatus.REJECTED,
      versionStatus: DocumentVersionStatus.REJECTED,
      rejectionReason,
    })

    if (!request) {
      throw new NotFoundException('Document request not found')
    }

    await this.trackAnalytics({
      eventName: AnalyticsEventName.DOCUMENT_REJECTED,
      actorType: AnalyticsActorType.INTERNAL_USER,
      tenantId: tenant.tenantId,
      actorUserId: currentUser.id,
      documentRequestId: request.id,
    })
    await this.notifyDocumentRejected(request)

    return mapDocumentRequestResponse(request)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break document rejection.
    }
  }

  private async notifyDocumentRejected(request: DocumentRequestRecord): Promise<void> {
    if (!this.notificationProducer) {
      return
    }

    try {
      await this.notificationProducer.notifyDocumentRejected(toDocumentNotificationInput(request))
    } catch {
      // Notifications must not break document rejection.
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
