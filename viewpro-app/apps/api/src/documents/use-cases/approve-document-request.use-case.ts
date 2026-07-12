import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, DocumentRequestStatus, DocumentVersionStatus } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import { NotificationProducerService, type DocumentOwnerNotificationInput } from '../../notifications/notification-producer.service'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentRequestRecord, type DocumentsRepository } from '../documents.repository'
import { findReviewableDocumentRequest } from './review-document-request'

@Injectable()
export class ApproveDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    @Optional()
    @Inject(NotificationProducerService)
    private readonly notificationProducer?: NotificationProducerService,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, requestId: string): Promise<DocumentRequestResponse> {
    await findReviewableDocumentRequest(this.documentsRepository, tenant, currentUser, requestId)

    const request = await this.documentsRepository.reviewRequest({
      tenantId: tenant.tenantId,
      requestId,
      reviewedByUserId: currentUser.id,
      status: DocumentRequestStatus.APPROVED,
      versionStatus: DocumentVersionStatus.APPROVED,
      rejectionReason: null,
    })

    if (!request) {
      throw new NotFoundException('Document request not found')
    }

    await this.trackAnalytics({
      eventName: AnalyticsEventName.DOCUMENT_APPROVED,
      actorType: AnalyticsActorType.INTERNAL_USER,
      tenantId: tenant.tenantId,
      actorUserId: currentUser.id,
      documentRequestId: request.id,
    })
    await this.notifyDocumentApproved(request)

    return mapDocumentRequestResponse(request)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break document approval.
    }
  }

  private async notifyDocumentApproved(request: DocumentRequestRecord): Promise<void> {
    if (!this.notificationProducer) {
      return
    }

    try {
      await this.notificationProducer.notifyDocumentApproved(toDocumentNotificationInput(request))
    } catch {
      // Notifications must not break document approval.
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
