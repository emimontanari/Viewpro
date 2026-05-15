import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { mapDocumentVersionResponse, type DocumentVersionResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'

@Injectable()
export class ConfirmOwnerDocumentUploadUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
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

    return mapDocumentVersionResponse(uploadedVersion)
  }
}
