import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { DOCUMENT_STORAGE_PORT, type DocumentStoragePort } from '../storage/document-storage.port'

const DOCUMENT_READ_URL_TTL_SECONDS = 5 * 60

/**
 * Response shape for the platform (operator) document read-url route.
 * Intentionally FLAT (design D5/D6 interfaces) — distinct from
 * `DocumentVersionUrlResponse`'s nested `{version, readUrl}` shape used by
 * the tenant-facing internal route, since the platform lane's caller
 * (viewpro-api's ChangeFeedClient) only needs the fields it forwards.
 */
export type PlatformDocumentReadUrlResponse = {
  url: string
  expiresInSeconds: number
  originalFilename: string
  mimeType: string
}

/**
 * CreatePlatformDocumentReadUrlUseCase — operator-activity-media (Slice 2a).
 *
 * Platform-lane counterpart to CreateInternalDocumentReadUrlUseCase (D5):
 * that use case is TENANT-staff scoped via TenantContext, which the platform
 * lane never has — this use case validates tenant ownership explicitly via
 * `findPlatformReadableVersion({tenantId, versionId})` (D6) instead.
 *
 * Cross-tenant/missing → NotFoundException (404), no mint attempted (avoids
 * a cross-tenant existence oracle — a 403 would leak "this id exists but you
 * can't see it"). Non-image MIME types mint identically; rendering is a
 * client concern, not a gate (spec: operator-document-read).
 */
@Injectable()
export class CreatePlatformDocumentReadUrlUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_STORAGE_PORT)
    private readonly documentStorage: DocumentStoragePort,
  ) {}

  async execute(tenantId: string, versionId: string): Promise<PlatformDocumentReadUrlResponse> {
    const version = await this.documentsRepository.findPlatformReadableVersion({ tenantId, versionId })
    if (!version) {
      throw new NotFoundException('Document version not found')
    }

    const readUrl = await this.documentStorage.createReadUrl({
      storageKey: version.storageKey,
      expiresInSeconds: DOCUMENT_READ_URL_TTL_SECONDS,
    })

    return {
      url: readUrl.url,
      expiresInSeconds: readUrl.expiresInSeconds,
      originalFilename: version.originalFilename,
      mimeType: version.mimeType,
    }
  }
}
