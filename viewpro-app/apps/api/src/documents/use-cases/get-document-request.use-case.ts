import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { canViewAllDocumentRequests } from './document-permissions'

@Injectable()
export class GetDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, requestId: string): Promise<DocumentRequestResponse> {
    const canViewAll = canViewAllDocumentRequests(tenant)

    if (!canViewAll && !tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const request = await this.documentsRepository.findInternalRequestDetail({
      tenantId: tenant.tenantId,
      requestId,
      viewerUserId: currentUser.id,
      canViewAll,
    })

    if (!request) {
      throw new NotFoundException('Document request not found')
    }

    return mapDocumentRequestResponse(request)
  }
}
