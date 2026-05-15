import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { DocumentRequestStatus, DocumentVersionStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { findReviewableDocumentRequest } from './review-document-request'

@Injectable()
export class ApproveDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
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

    return mapDocumentRequestResponse(request)
  }
}
