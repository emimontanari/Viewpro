import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { DOCUMENT_STORAGE_PORT, type DocumentStoragePort } from '../storage/document-storage.port'
import { mapDocumentVersionReadUrlResponse, type DocumentVersionUrlResponse } from './document-storage-url-response'

const DOCUMENT_READ_URL_TTL_SECONDS = 5 * 60

@Injectable()
export class CreateOwnerDocumentReadUrlUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_STORAGE_PORT)
    private readonly documentStorage: DocumentStoragePort,
  ) {}

  async execute(currentUser: CurrentUser, versionId: string): Promise<DocumentVersionUrlResponse> {
    const version = await this.documentsRepository.findOwnerReadableVersion({ ownerUserId: currentUser.id, versionId })
    if (!version) {
      throw new NotFoundException('Document version not found')
    }

    const readUrl = await this.documentStorage.createReadUrl({ storageKey: version.storageKey, expiresInSeconds: DOCUMENT_READ_URL_TTL_SECONDS })
    return mapDocumentVersionReadUrlResponse(version, readUrl)
  }
}
