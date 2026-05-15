import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { DocumentRequestStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { mapDocumentRequestResponse, mapDocumentVersionResponse, type DocumentRequestResponse, type DocumentVersionResponse } from '../document-response.mapper'
import { MAX_DOCUMENT_UPLOAD_SIZE_BYTES, type CreateDocumentUploadUrlDto } from '../dto/create-document-upload-url.dto'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { DOCUMENT_STORAGE_PORT, type DocumentStoragePort, type SignedStorageUrl } from '../storage/document-storage.port'

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const DOCUMENT_UPLOAD_URL_TTL_SECONDS = 10 * 60

export type CreateOwnerDocumentUploadUrlResponse = {
  request: DocumentRequestResponse
  version: DocumentVersionResponse
  uploadUrl: SignedStorageUrl
}

@Injectable()
export class CreateOwnerDocumentUploadUrlUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_STORAGE_PORT)
    private readonly documentStorage: DocumentStoragePort,
  ) {}

  async execute(
    currentUser: CurrentUser,
    requestId: string,
    input: CreateDocumentUploadUrlDto,
  ): Promise<CreateOwnerDocumentUploadUrlResponse> {
    assertAllowedUpload(input)

    const request = await this.documentsRepository.findOwnerRequestDetail({ ownerUserId: currentUser.id, requestId })
    if (!request) {
      throw new NotFoundException('Document request not found')
    }

    if (request.status !== DocumentRequestStatus.PENDING && request.status !== DocumentRequestStatus.REJECTED) {
      throw new BadRequestException('Document request is not accepting uploads')
    }

    const storageKey = buildDocumentStorageKey(request.id, input.originalFilename)
    const version = await this.documentsRepository.createPendingVersion({
      documentRequestId: request.id,
      uploadedByUserId: currentUser.id,
      storageKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
    })
    const uploadUrl = await this.documentStorage.createUploadUrl({ storageKey: version.storageKey, expiresInSeconds: DOCUMENT_UPLOAD_URL_TTL_SECONDS })

    return { request: mapDocumentRequestResponse(request), version: mapDocumentVersionResponse(version), uploadUrl }
  }
}

function assertAllowedUpload(input: CreateDocumentUploadUrlDto): void {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(input.mimeType)) {
    throw new BadRequestException('Unsupported document MIME type')
  }

  if (input.sizeBytes > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    throw new BadRequestException('Document file exceeds 10 MB')
  }

  if (input.sizeBytes < 1) {
    throw new BadRequestException('Document file is empty')
  }
}

function buildDocumentStorageKey(requestId: string, originalFilename: string): string {
  const filename = originalFilename.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  if (!filename) {
    throw new BadRequestException('Original filename is required')
  }

  return `document-requests/${requestId}/${filename}`
}
