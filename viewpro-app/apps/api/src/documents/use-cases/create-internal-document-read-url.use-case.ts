import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { DOCUMENT_STORAGE_PORT, type DocumentStoragePort } from '../storage/document-storage.port'
import { canViewAllDocumentRequests } from './document-permissions'
import { mapDocumentVersionReadUrlResponse, type DocumentVersionUrlResponse } from './document-storage-url-response'

const DOCUMENT_READ_URL_TTL_SECONDS = 5 * 60

@Injectable()
export class CreateInternalDocumentReadUrlUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_STORAGE_PORT)
    private readonly documentStorage: DocumentStoragePort,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, versionId: string): Promise<DocumentVersionUrlResponse> {
    const canViewAll = canViewAllDocumentRequests(tenant)
    if (!canViewAll && !tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const version = await this.documentsRepository.findInternalReadableVersion({
      tenantId: tenant.tenantId,
      versionId,
      viewerUserId: currentUser.id,
      canViewAll,
    })
    if (!version) {
      throw new NotFoundException('Document version not found')
    }

    const readUrl = await this.documentStorage.createReadUrl({ storageKey: version.storageKey, expiresInSeconds: DOCUMENT_READ_URL_TTL_SECONDS })
    return mapDocumentVersionReadUrlResponse(version, readUrl)
  }
}
