import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import type { CurrentUser } from '../../auth/types/current-user'
import { mapDocumentVersionResponse, type DocumentVersionResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'

@Injectable()
export class ConfirmOwnerDocumentUploadUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    private readonly analyticsService: AnalyticsService,
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

    return mapDocumentVersionResponse(uploadedVersion)
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break upload confirmation.
    }
  }
}
