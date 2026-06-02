import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import type { CurrentUser } from '../../auth/types/current-user'
import { NotificationProducerService } from '../../notifications/notification-producer.service'
import { mapDocumentVersionResponse, type DocumentVersionResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository, type DocumentVersionRecord } from '../documents.repository'

@Injectable()
export class ConfirmOwnerDocumentUploadUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    @Inject(NotificationProducerService)
    private readonly notificationProducer: NotificationProducerService,
  ) {}

  async execute(currentUser: CurrentUser, versionId: string): Promise<DocumentVersionResponse> {
    const version = await this.documentsRepository.findOwnerPendingUploadVersion({ ownerUserId: currentUser.id, versionId })
    if (!version) {
      throw new NotFoundException('Document version not found')
    }

    const uploadedVersion = await this.documentsRepository.markVersionUploaded({ versionId })
    if (!uploadedVersion) {
      throw new NotFoundException('Document version not found')
    }

    await this.trackAnalytics({
      eventName: AnalyticsEventName.DOCUMENT_UPLOADED,
      actorType: AnalyticsActorType.OWNER,
      actorUserId: currentUser.id,
      documentRequestId: uploadedVersion.document?.documentRequestId ?? version.document?.documentRequestId,
    })
    await this.notifyDocumentUploaded(uploadedVersion, version)

    return mapDocumentVersionResponse(uploadedVersion)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break upload confirmation.
    }
  }

  private async notifyDocumentUploaded(
    uploadedVersion: DocumentVersionRecord,
    pendingVersion: DocumentVersionRecord,
  ): Promise<void> {
    const request = uploadedVersion.document?.documentRequest ?? pendingVersion.document?.documentRequest
    const propertyAssetId = request?.propertyEngagement.propertyAssetId

    if (!request?.requestedByUserId || !propertyAssetId) {
      return
    }

    try {
      await this.notificationProducer.notifyDocumentUploaded({
        tenantId: request.tenantId,
        requestedByUserId: request.requestedByUserId,
        propertyEngagementId: request.propertyEngagementId,
        propertyAssetId,
        documentRequestId: request.id,
        documentTitle: request.title,
      })
    } catch {
      // Notifications must not break upload confirmation.
    }
  }
}
